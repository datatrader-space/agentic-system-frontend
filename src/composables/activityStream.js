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
    // Live token metering for this turn (fed by `token_usage` events): the latest running
    // snapshot { total, prompt, completion, cached, cost, estimated }. null until the first tick.
    tokens: null,
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

function openStep(a, fields, t, singleton = false) {
  const { phase, label, tool } = fields
  const cur = lastActive(a)
  if (cur) {
    // If we're already running this same phase (e.g. repeated typing), keep it.
    if (singleton && cur.phase === phase) return cur
    cur.status = 'done'
    cur.endTs = t
  }
  const step = {
    id: sid(), phase, label, tool: tool || '',
    // Rich transcript fields (Claude-Code-style): the renderer expands these.
    kind: fields.kind || '', input: fields.input != null ? fields.input : null,
    output: null, exitCode: null, stdout: null, stderr: null, thinkingText: '',
    status: 'running', error: '', startTs: t, endTs: 0,
  }
  a.steps.push(step)
  return step
}

// Pick a renderer kind for a tool when the backend didn't send `kind` (graceful fallback;
// mirrors agent/progress.py tool_kind).
function toolKindFallback(name) {
  const n = String(name || '').toLowerCase()
  if (/(read_file|readfile|^read$|cat|open_file)/.test(n)) return 'read'
  if (/(write_file|create_file|save_file)/.test(n)) return 'write'
  if (/(edit|patch|modify|update_file|apply_diff)/.test(n)) return 'edit'
  if (/(bash|shell|run_command|execute_command|terminal|^exec$|command)/.test(n)) return 'bash'
  if (/(search|grep|find|lookup)/.test(n)) return 'search'
  if (/(http|fetch|request|url|api_call)/.test(n)) return 'http'
  return 'generic'
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

// v3 Auto Mode gate status → human label for the activity timeline. Each gate has a `reviewing`
// in-progress state plus its resolution states (so the timeline reads as a clear sequence:
// reviewing → resolved/escalated).
function autoStatusLabel(gate, decision) {
  const map = {
    plan: {
      reviewing: 'Auto Mode: reviewing plan',
      approved: 'Auto Mode: plan approved by AI policy',
      revise: 'Auto Mode: plan requires revision — rewriting',
      rejected: 'Auto Mode: plan rejected — escalated',
    },
    tool: {
      reviewing: 'Auto Mode: reviewing tool risk',
      approve: 'Auto Mode: approved by AI policy',
      block: 'Auto Mode: blocked by AI policy',
      escalate: 'Auto Mode: escalated for human review',
    },
    // LLM clarification interceptor (Question Gate).
    question: {
      reviewing: 'Auto Mode: choosing approach',
      proceed_with_choice: 'Auto Mode: direction resolved autonomously',
      use_conservative_default: 'Auto Mode: direction resolved autonomously',
      resolved: 'Auto Mode: direction resolved autonomously',
      escalate: 'Auto Mode: escalated — human input needed',
    },
    progress: { continue: 'Auto Mode: progress checkpoint — continuing', stop: 'Auto Mode: progress checkpoint — stopping run', escalate: 'Auto Mode: progress checkpoint — escalated' },
    phase: { proceed: 'Auto Mode: phase complete — proceeding', stop: 'Auto Mode: phase complete — stopping', skip_phase: 'Auto Mode: skipping next phase', escalate: 'Auto Mode: phase complete — escalated' },
  }
  return (map[gate] && map[gate][decision]) || (gate ? `Auto Mode: ${gate} — ${decision}` : '')
}

function safeJson(x) {
  try { return JSON.stringify(x, null, 2) } catch { return String(x) }
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
  activity.tokens = null
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
        const s = openStep(activity, { phase: evt.phase || 'tool', label: evt.label || 'Working', tool: evt.metadata?.tool }, t)
        if (evt.detail) s.thinkingText = evt.detail // expandable "Thought" body
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
      // Prefer the backend's authoritative human label + kind (Phase 2/transcript) when present.
      const label = evt.label || friendlyToolLabel(name, params)
      const kind = evt.kind || toolKindFallback(name)
      openStep(activity, { phase: 'tool', label, tool: name, kind, input: params }, t)
      return
    }

    case 'tool_result': {
      const d = evt.data || evt
      const ok = d.success !== false
      const s = closeRunning(activity, t, ok ? 'done' : 'error', ok ? '' : extractErr(d))
      if (s) {
        // Capture the output for the transcript row (terminal stdout/stderr, file content, …).
        if (d.exit_code != null) s.exitCode = d.exit_code
        if (d.stdout != null) s.stdout = String(d.stdout)
        if (d.stderr != null) s.stderr = String(d.stderr)
        const out = (d.stdout != null || d.stderr != null)
          ? [d.stdout, d.stderr].filter((x) => x != null && x !== '').join('\n')
          : (typeof d.result === 'string' ? d.result : (d.result != null ? safeJson(d.result) : ''))
        s.output = out || ''
      }
      return
    }

    // Streamed model thinking (Claude extended thinking). Accumulates into a live
    // "Thinking…" step; reasoning_done collapses it to "Thought for Xs".
    case 'reasoning_delta': {
      let s = lastActive(activity)
      if (!s || s.phase !== 'thinking') s = openStep(activity, { phase: 'thinking', label: 'Thinking…' }, t)
      s.thinkingText = (s.thinkingText || '') + (evt.text || '')
      return
    }
    case 'reasoning_done': {
      const s = activity.steps.find((x) => x.id === evt.step_id && x.phase === 'thinking')
        || [...activity.steps].reverse().find((x) => x.phase === 'thinking' && ACTIVE_STATUSES.has(x.status))
      if (s) {
        s.status = 'done'
        s.endTs = t
        const ms = evt.duration_ms != null ? evt.duration_ms : (s.endTs - s.startTs)
        s.durationMs = ms
        s.label = `Thought for ${Math.max(1, Math.round(ms / 1000))}s`
      }
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

    // v3 Auto Mode: a gate (plan/progress/phase) was resolved autonomously — show the status.
    case 'auto_status': {
      const label = autoStatusLabel(evt.gate, evt.decision)
      if (!label) return
      const s = openStep(activity, { phase: 'auto', label }, t)
      s.status = ['stop', 'escalate', 'rejected'].includes(evt.decision) ? 'blocked' : 'done'
      s.endTs = t
      return
    }
    case 'work_summary': {
      const s = openStep(activity, { phase: 'auto', label: 'Auto Mode: verified & summarized' }, t)
      s.status = evt.decision === 'escalate' ? 'blocked' : 'done'
      s.endTs = t
      return
    }
    case 'plan_approval_required': {
      const s = openStep(activity, { phase: 'approval', label: 'Plan ready — awaiting approval' }, t)
      s.status = 'pending_approval'
      // Surface the plan's upcoming phases as pending (○) roadmap steps — the only honest source of
      // "forward" steps (general chat has no declared to-do list). Added once per turn.
      const phases = (evt.plan && (evt.plan.phases || evt.plan.steps)) || []
      if (Array.isArray(phases) && phases.length && !activity.steps.some((x) => x.phase === 'plan_pending')) {
        for (const ph of phases) {
          const label = (ph && (ph.title || ph.name || ph.description)) || 'Step'
          activity.steps.push({
            id: sid(), phase: 'plan_pending', label: String(label).slice(0, 120), tool: '',
            kind: '', input: null, output: null, exitCode: null, stdout: null, stderr: null,
            thinkingText: '', status: 'pending', error: '', startTs: t, endTs: 0,
          })
        }
      }
      return
    }

    // Explicit approval outcome (optional; backend may send it). Resolves a pending step.
    case 'hitl_resolved': {
      const approved = evt.approved !== false
      closeRunning(activity, t, approved ? 'approved' : 'rejected', approved ? '' : (evt.reason || 'Rejected'))
      return
    }

    // Live token metering: the running counter for the "Working" chip + Done summary. The latest
    // snapshot wins; an exact (non-estimated) tick is preferred over an estimate at the same total.
    case 'token_usage': {
      const prompt = evt.prompt_tokens != null ? evt.prompt_tokens : null
      const completion = evt.completion_tokens != null ? evt.completion_tokens : null
      const total = evt.total_tokens != null ? evt.total_tokens
        : ((prompt || 0) + (completion || 0)) || 0
      if (!total) return
      // Don't let an estimated tick regress a larger exact count already shown.
      const prev = activity.tokens
      if (prev && evt.estimated && !prev.estimated && total < prev.total) return
      activity.tokens = {
        total,
        prompt, completion,
        cached: evt.cached_tokens != null ? evt.cached_tokens : (prev ? prev.cached : null),
        cost: evt.cost_usd != null ? evt.cost_usd : (prev ? prev.cost : null),
        estimated: !!evt.estimated,
      }
      return
    }

    // Final, exact usage reconciles the live counter (and powers the Done-summary token count
    // even when live metering is off — `usage` is always present on completion).
    case 'assistant_message_complete': {
      const u = evt.usage
      if (u) {
        const prompt = u.prompt_tokens != null ? u.prompt_tokens : (u.input_tokens != null ? u.input_tokens : null)
        const completion = u.completion_tokens != null ? u.completion_tokens : (u.output_tokens != null ? u.output_tokens : null)
        const total = u.total_tokens != null ? u.total_tokens : (((prompt || 0) + (completion || 0)) || 0)
        if (total) {
          activity.tokens = {
            total, prompt, completion,
            cached: u.cached_tokens != null ? u.cached_tokens : null,
            cost: u.cost_usd != null ? u.cost_usd : null,
            estimated: false,
          }
        }
      }
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
