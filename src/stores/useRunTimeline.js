// The Work-mode run timeline — a PURE REDUCER over an event log.
//
// WHY A REDUCER WHEN NOTHING EMITS EVENTS YET. The current Work view renders state SNAPSHOTS: it
// re-hydrates a plan on every change and draws a card per run. That single fact produces every symptom
// we have — the duplicate card, status flipping only at the end, durations appearing after the fact, a
// new card per loop pass. Patching a snapshot renderer produces eight patches and still feels choppy.
//
// So the shape lands first. `apply()` below is the contract from the spec — `append` a node, `patch` a
// node's fields, `delta` text into its buffer, keyed on a stable `node_id` and ordered by `seq`. Today
// it is fed by `eventsFromSnapshot()`, which derives that log from the plan snapshot the server already
// sends. When the server emits the real log (P1) the adapter is deleted and nothing else here changes.
//
// The reducer is deliberately ignorant of where events come from, which is what makes reload, replay
// and out-of-order frames safe: the log is the truth and the DOM is derived.
import { defineStore } from 'pinia'

/** A node as the rail draws it. `buffer` exists so `delta` has somewhere to stream. */
function newNode(event) {
  return {
    node_id: event.node_id,
    parent_id: event.parent_id || null,
    type: event.type,
    buffer: '',
    ...(event.payload || {}),
  }
}

export const useRunTimeline = defineStore('runTimeline', {
  state: () => ({
    // run_id -> { nodes: {node_id: node}, order: [node_id], lastSeq, gap }
    byRun: {},
  }),

  getters: {
    // Render order is APPEND order, never sort order. A node that patches later must not jump.
    nodesFor: (s) => (runId) => {
      const r = s.byRun[String(runId)]
      if (!r) return []
      return r.order.map((id) => r.nodes[id]).filter(Boolean)
    },
    lastSeqFor: (s) => (runId) => (s.byRun[String(runId)] || {}).lastSeq || 0,
    // A gap means the client missed frames and its tree is no longer trustworthy. Surfaced rather
    // than hidden: rendering a tree with a hole in it is worse than saying so.
    hasGapFor: (s) => (runId) => !!(s.byRun[String(runId)] || {}).gap,
  },

  actions: {
    _run(runId) {
      const k = String(runId)
      if (!this.byRun[k]) this.byRun[k] = { nodes: {}, order: [], lastSeq: 0, gap: false }
      return this.byRun[k]
    },

    reset(runId) {
      this.byRun[String(runId)] = { nodes: {}, order: [], lastSeq: 0, gap: false }
    },

    /**
     * Apply ONE event. Returns 'applied' | 'duplicate' | 'gap' | 'ignored'.
     *
     * Idempotent by `seq`, which is what makes replaying the whole log twice produce an identical
     * tree (spec §11.1) and what makes a duplicated socket frame harmless (§11.7).
     */
    apply(runId, event) {
      if (!event || !event.node_id || !event.kind) return 'ignored'
      const r = this._run(runId)
      const seq = Number(event.seq || 0)
      // Replay and duplicate delivery both land here. Dropping is correct for BOTH: the node already
      // carries this event's effect.
      if (seq && seq <= r.lastSeq) return 'duplicate'
      if (seq && r.lastSeq && seq > r.lastSeq + 1) {
        // Do NOT apply out of order. A patch landing before its append creates a node with no identity
        // and a delta landing early streams text into nothing.
        r.gap = true
        return 'gap'
      }

      switch (event.kind) {
        case 'append':
          // An append for a node we already hold is the DUPLICATE CARD BUG. Patch it instead — the
          // node_id is the identity, and a second announcement of the same node is not a second node.
          if (r.nodes[event.node_id]) {
            Object.assign(r.nodes[event.node_id], event.payload || {})
          } else {
            r.nodes[event.node_id] = newNode(event)
            r.order.push(event.node_id)
          }
          break
        case 'patch': {
          const n = r.nodes[event.node_id]
          if (!n) return 'ignored'          // nothing to patch; never conjure a node from a patch
          Object.assign(n, event.payload || {})
          break
        }
        case 'delta': {
          const n = r.nodes[event.node_id]
          if (!n) return 'ignored'
          n.buffer = (n.buffer || '') + String((event.payload || {}).text || '')
          break
        }
        default:
          return 'ignored'
      }
      if (seq) r.lastSeq = seq
      return 'applied'
    },

    applyAll(runId, events) {
      for (const e of events || []) this.apply(runId, e)
    },

    /** Rebuild this run's tree from a plan snapshot. Idempotent — safe to call on every hydrate. */
    ingestSnapshot(runId, plan) {
      this.reset(runId)
      this.applyAll(runId, eventsFromSnapshot(plan))
    },
  },
})

// ── P0 bridge: the plan snapshot, expressed as the event log the rail wants ──────────────────
//
// DELETED IN P1, when the server emits this log itself. Until then the rail must not be blocked on the
// protocol — the layout, the node identity and the retry-in-place behaviour are the visible half of the
// fix and they do not need new transport to land.
//
// Deterministic by construction: the same snapshot always yields the same events in the same order, so
// re-hydrating cannot reorder or duplicate the rail.

const STEP_STATE = {
  pending: 'pending', in_progress: 'active', started: 'active',
  completed: 'done', skipped: 'done', blocked: 'failed', failed: 'failed',
}

/** Terminal run states, and whether the run reached its goal. Words come from the server. */
function terminalOf(plan) {
  const s = String(plan?.run_status || '')
  if (!['completed', 'insufficient_evidence', 'failed', 'cancelled'].includes(s)) return null
  return { state: s, label: plan?.plan_status_label || '' }
}

const CLOSED_GOAL_STATES = ['ACHIEVED', 'EXHAUSTED', 'PAUSED', 'ABANDONED']

/** True when the run is over: a terminal run status, or a Work goal that has closed. */
export function runHasEnded(plan) {
  if (!plan) return false
  if (terminalOf(plan) || ['blocked'].includes(String(plan.run_status || ''))) return true
  // THE SERVER'S USER-FACING PLAN STATUS IS THE AUTHORITY, and asking it is what keeps the card and
  // the composer chip saying the same thing.
  //
  // MEASURED, prod conv 1799: the card read "Blocked 0/2" while the chip beside the composer read
  // "Active plan 0/2" with a live green dot. The card had been fixed to derive `blocked` from a paused
  // run; this function had not, because it only ever looked at `run_status` — and a run that pauses
  // with no work goal is neither terminal nor 'blocked' nor a closed goal, so it fell through every
  // branch and the chip kept claiming the run was going.
  if (String(plan.plan_status_user || '') === 'blocked') return true
  const goal = plan.work_goal
  return !!(goal && CLOSED_GOAL_STATES.includes(String(goal.state || '')))
}

function stepStateOf(s, ended) {
  const state = STEP_STATE[s.status_user] || STEP_STATE[s.status] || 'pending'
  return ended && state === 'active' ? 'stopped' : state
}

export function eventsFromSnapshot(plan) {
  if (!plan) return []
  const out = []
  let seq = 0
  const push = (kind, type, node_id, payload, parent_id) => {
    out.push({ seq: ++seq, kind, type, node_id, parent_id: parent_id || null, payload })
  }

  // The whole plan lands at once as pending nodes that activate in place. This is what shows the run
  // start to end instead of one step at a time — and it is why there is no separate plan panel.
  // A step with no server identity cannot be drawn safely: anything we invent here collides on the
  // next render. Dropped and counted, never positionally identified.
  const all = plan.steps || []
  const steps = all.filter((s) => s.node_id || s.step_id || s.step_uid || s.id)
  // A STEP CANNOT STILL BE RUNNING ON A RUN THAT ENDED. Prod conv 1645 paused on a provider refusal with its
  // step left `in_progress` in the plan, and the rail kept the live ring spinning under "Paused".
  const ended = runHasEnded(plan)
  push('append', 'plan.created', 'plan', { count: steps.length, unidentified: all.length - steps.length })
  steps.forEach((s, i) => {
    // `node_id` is generated by the server (spec rule 1). The older names are the same value under
    // three spellings and remain only for a snapshot hydrated before `node_id` existed.
    //
    // THE INDEX IS NOT IN THIS CHAIN, deliberately. An index fallback is what turns a re-render into an
    // append beside a node instead of a patch of it — the duplicate-card shape. A step the server could
    // not identify is DROPPED below rather than given a positional identity that will collide.
    push('append', 'step', s.node_id || s.step_id || s.step_uid || s.id, {
      index: i + 1,
      label: s.title || s.description || '',
      state: stepStateOf(s, ended),
      duration_ms: s.duration_ms || null,
      failure: s.failure_summary || '',
      // What the step was allowed to reach for. The rail collapses this behind a chevron: a reader
      // scanning the run does not want it, and a reader asking "what did step 2 actually do?" has
      // nowhere else to look.
      // In WORDS (`tool_labels`, from the server's one label map). The raw `tool_hints` names are
      // deliberately not carried: the rail drew them as `CREATE_DOCUMENT` `FETCH_PAGE` chips.
      tool_labels: (s.tool_labels || []).slice(0, 6),
      details: s.details || '',
    })
  })

  // A RETRY IS THE SAME STEP. The attempt badge patches the step that already exists; the plan never
  // grows. Four steps stay four steps however many times the loop turns.
  const goal = plan.work_goal || null
  // AN ATTEMPT IS A TRY AT THE GOAL — one segment, one goal check. `goal.attempts` are the runtime's inner
  // repair-loop rows, several per segment and from more than one loop, so counting them told prod conv 1626
  // "attempt 4" for a run that made three tries (3 segments, 4 loop rows).
  const attemptNo = Number(goal && goal.segments_used) || ((goal && goal.verdicts) || []).length
    || ((goal && goal.attempts) || []).length
  if (attemptNo > 1 && steps.length) {
    for (const s of steps) {
      const id = s.node_id || s.step_id || s.step_uid || s.id
      if (id) push('patch', 'step.retry', id, { attempt: attemptNo })
    }
  }

  // Why the loop re-entered, as a NODE on the rail with the blocking findings — not a divider, and
  // not an "Iteration N of M" band. The reason belongs on the verdict that caused it.
  if (goal && goal.last_verdict && goal.last_verdict !== 'met' && (goal.last_findings || []).length) {
    push('append', 'loop.continuing', `verdict_${attemptNo || 1}`, {
      verdict: goal.last_verdict,
      findings: (goal.last_findings || []).slice(0, 6).map((f) => ({
        issue: f.observation || f.repair_instruction || '',
        remedy: f.observation ? (f.repair_instruction || '') : '',
      })),
    })
  }

  // One unambiguous end — and what the run cost, which is the question a reader actually has there.
  // A goal that closed on a run left PAUSED (goal not met, segments spent; a stop between segments) is
  // over too. With no end row the rail simply stopped mid-story, which reads as still running.
  const closedGoal = goal && CLOSED_GOAL_STATES.includes(String(goal.state || ''))
  const term = terminalOf(plan) || (closedGoal ? { state: String(plan.run_status || ''), label: '' } : null)
  if (term) {
    const done = steps.filter((s) => ['completed', 'skipped'].includes(s.status)).length
    const t = (goal && goal.totals) || {}
    push('append', 'run.completed', 'terminal', {
      state: term.state,
      label: term.label,
      steps: steps.length,
      done,
      retried: attemptNo > 1 ? attemptNo - 1 : 0,
      duration_ms: t.duration_ms || null,
      total_tokens: t.total_tokens || null,
      cost_usd: t.cost_usd || null,
    })
  }
  return out
}
