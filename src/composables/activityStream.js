// Activity-stream state machine — turns the raw chat WebSocket event stream into a
// human "what the agent is doing" timeline (Thinking → Reading X → Running Y →
// Generating → Done), exactly like Claude/ChatGPT/Perplexity.
//
// REAL, not a simulation: every step is driven by an actual backend event. Phase 1
// derives steps from the events the consumer already emits (assistant_typing,
// tool_call, tool_result, assistant_message_chunk/_complete, error). Phase 2 will add a
// native `agent_progress` event with ready-made labels — already handled here too, so
// the UI needs no change when the backend gets richer.
//
// Pure functions over a plain `activity` object so they're trivially unit-testable and
// framework-agnostic; Vue reactivity tracks the mutations when the object is reactive.

let _sid = 0
const sid = () => `s${++_sid}`
const now = () => Date.now()

export function createActivity() {
  return {
    // status: 'running' | 'done' | 'error' | 'pending_approval' | 'blocked' | 'rejected'
    steps: [],      // { id, phase, label, tool, status, error, startTs, endTs }
    running: false,
    done: false,
    startTs: 0,
  }
}

// Statuses that are still "in progress" (a result/approval can still close them).
const ACTIVE_STATUSES = new Set(['running', 'pending_approval'])

// ---- step helpers ----------------------------------------------------------
function lastActive(a) {
  for (let i = a.steps.length - 1; i >= 0; i--) if (ACTIVE_STATUSES.has(a.steps[i].status)) return a.steps[i]
  return null
}

function closeRunning(a, t, status = 'done', error = '') {
  const s = lastActive(a)
  if (s) {
    s.status = status
    s.endTs = t
    if (error) s.error = error
  }
  return s
}

function openStep(a, { phase, label, tool }, t, singleton = false) {
  const cur = lastActive(a)
  if (cur) {
    // If we're already running this same phase (e.g. repeated typing), keep it.
    if (singleton && cur.phase === phase) return cur
    cur.status = 'done'
    cur.endTs = t
  }
  const step = { id: sid(), phase, label, tool: tool || '', status: 'running', error: '', startTs: t, endTs: 0 }
  a.steps.push(step)
  return step
}

// ---- friendly tool labels (Phase 1; Phase 2 sends labels directly) ---------
function basename(x) {
  return x ? String(x).split(/[\\/]/).pop() : ''
}
function prettyName(n) {
  return String(n || 'tool').replace(/[_\-]+/g, ' ').trim().toLowerCase()
}
export function friendlyToolLabel(name, params) {
  const p = params || {}
  const key = String(name || '').toLowerCase()
  const builders = {
    read_file: () => `Reading ${basename(p.path || p.file || p.filename) || 'file'}`,
    write_file: () => `Writing ${basename(p.path || p.file || p.filename) || 'file'}`,
    edit_file: () => `Editing ${basename(p.path || p.file || p.filename) || 'file'}`,
    list_directory: () => `Listing ${p.path || 'directory'}`,
    list_dir: () => `Listing ${p.path || 'directory'}`,
    search_files: () => `Searching for ${p.query || p.pattern || 'matches'}`,
    grep: () => `Searching for ${p.query || p.pattern || 'matches'}`,
    bash: () => `Running: ${String(p.command || '').slice(0, 45)}`,
    run_command: () => `Running: ${String(p.command || '').slice(0, 45)}`,
    fetch_url: () => `Fetching ${String(p.url || '').slice(0, 40)}`,
    web_search: () => `Searching the web for ${p.query || ''}`,
    http_request: () => `Calling ${String(p.url || p.method || 'API').slice(0, 40)}`,
  }
  if (builders[key]) return builders[key]()
  return `Using ${prettyName(name)}`
}

function extractErr(d) {
  if (!d) return ''
  if (typeof d.error === 'string') return d.error
  if (typeof d.result === 'string' && /error|exception|failed|not found/i.test(d.result)) {
    return d.result.slice(0, 200)
  }
  return ''
}

// ---- the reducer -----------------------------------------------------------
export function start(activity) {
  activity.steps = []
  activity.running = true
  activity.done = false
  activity.startTs = now()
  // Seed the opening "Thinking" step so the timeline shows immediately on send.
  activity.steps.push({
    id: sid(), phase: 'thinking', label: 'Thinking', tool: '',
    status: 'running', error: '', startTs: activity.startTs, endTs: 0,
  })
}

export function ingest(activity, evt) {
  if (!activity || !evt) return
  const t = now()
  switch (evt.type) {
    // Phase 2 native protocol (ready-made labels) ---------------------------
    case 'agent_progress': {
      if (evt.status === 'running') {
        openStep(activity, { phase: evt.phase || 'tool', label: evt.label || 'Working', tool: evt.metadata?.tool }, t)
      } else {
        const s = activity.steps.find((x) => x.id === evt.step_id) || lastActive(activity)
        if (s) {
          s.status = evt.status === 'error' ? 'error' : 'done'
          s.endTs = t
          if (evt.error) s.error = evt.error
        }
      }
      return
    }

    // Phase 1 — derive from existing events ---------------------------------
    case 'assistant_typing':
      if (evt.typing === false) return
      // Reopen a Thinking step only when nothing is currently running (e.g. between
      // tools), so the spinner reflects real inter-tool reasoning without spamming.
      if (!lastActive(activity)) openStep(activity, { phase: 'thinking', label: 'Thinking' }, t, true)
      return

    case 'tool_call': {
      const name = evt.tool_name || (evt.data && evt.data.tool) || evt.tool || 'tool'
      const params = evt.tool_input || (evt.data && evt.data.params) || evt.parameters || {}
      // Prefer the backend's authoritative human label (Phase 2) when present.
      const label = evt.label || friendlyToolLabel(name, params)
      openStep(activity, { phase: 'tool', label, tool: name }, t)
      return
    }

    case 'tool_result': {
      const d = evt.data || evt
      const ok = d.success !== false
      closeRunning(activity, t, ok ? 'done' : 'error', ok ? '' : extractErr(d))
      return
    }

    // The backend gated a tool for human approval — show it as WAITING, never "running".
    case 'hitl_request': {
      const s = lastActive(activity)
      const summary = (evt.summary || '').toString().slice(0, 80)
      if (s && s.phase === 'tool') {
        s.status = 'pending_approval'
        s.label = summary ? `Waiting for approval — ${summary}` : 'Waiting for your approval'
      } else {
        openStep(activity, { phase: 'approval', label: summary ? `Waiting for approval — ${summary}` : 'Waiting for your approval' }, t)
        const ns = lastActive(activity)
        if (ns) ns.status = 'pending_approval'
      }
      return
    }

    // A tool the router blocked before approval (e.g. PLAN_ONLY/CLARIFY) — show "Blocked", not running.
    case 'tool_blocked': {
      closeRunning(activity, t, 'blocked', evt.reason || 'Blocked — requires approval')
      return
    }

    // Explicit approval outcome (optional; backend may send it). Resolves a pending step.
    case 'hitl_resolved': {
      const approved = evt.approved !== false
      closeRunning(activity, t, approved ? 'approved' : 'rejected', approved ? '' : (evt.reason || 'Rejected'))
      return
    }

    case 'assistant_message_chunk':
      if (!(evt.chunk || '')) return
      openStep(activity, { phase: 'generating', label: 'Generating response' }, t, true)
      return

    case 'error':
      // A tool/turn error: mark the current step red (the agent may still recover/retry,
      // so we don't end the timeline here — the host calls finish() on turn end).
      closeRunning(activity, t, 'error', evt.error || evt.message || 'Error')
      return

    default:
      return
  }
}

export function finish(activity) {
  if (!activity) return
  const t = now()
  for (const s of activity.steps) {
    if (ACTIVE_STATUSES.has(s.status)) {
      // A still-pending approval at turn end "failed safe" (timed out without approval).
      s.status = s.status === 'pending_approval' ? 'blocked' : 'done'
      s.endTs = t
    }
  }
  activity.running = false
  activity.done = true
}

// ---- view helpers ----------------------------------------------------------
export function stepSeconds(s) {
  if (!s || !s.endTs || !s.startTs) return null
  return Math.max(0, (s.endTs - s.startTs) / 1000)
}
export function activitySummary(a) {
  if (!a || !a.steps.length) return { count: 0, seconds: 0 }
  const first = a.steps[0]
  const last = a.steps[a.steps.length - 1]
  const seconds = Math.max(0, ((last.endTs || now()) - (first.startTs || now())) / 1000)
  return { count: a.steps.length, seconds }
}
