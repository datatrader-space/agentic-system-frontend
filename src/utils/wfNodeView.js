// Workflow Builder — pure node-presentation logic, unit-testable: no DOM, no Vue. Derives a node's config preview,
// configured-ness, visual state, colour and accessible name from its type, its data and its RUN STATE.
//
// The run state is never read from the node's data (D1 rule 1): the caller passes the status from useWorkflowRun's
// `nodeStates`, in the engine's own words (contract C2), and whether validation marked the node invalid.
import { WF_CATEGORIES, wfCategory, wfDef } from '../config/wfNodeDefinitions'

// A node is "configured" when its key fields are set (drives the idle vs configured indicator).
const CONFIGURED = {
  'media.generate': d => !!(d.operation && d.route_id),
  'trigger.manual': () => true,
  'trigger.schedule': (d) => !!d.cron,
  'trigger.webhook': () => true,
  'trigger.channel': (d) => !!d.platform,
  // A connector binding is only useful once it knows WHICH provider and WHICH account;
  // filters are genuinely optional (no filters = every event of this type).
  'trigger.connector': (d) => !!(d.provider && d.connection),
  // A camera event knows which camera; a rule is optional (no rule = any rule of the camera).
  'trigger.training.stream_event': (d) => Number(d.source) > 0,
  'agent.run': (d) => !!(d.agent_id && (d.prompt || '').trim()),
  'action.tool': (d) => !!d.tool,
  'action.mcp_tool': (d) => !!(d.agent_id && d.server_id && d.tool_name),
  'action.script': (d) => !!d.script_id,
  'action.channel': (d) => !!(d.message || '').trim(),
  'action.http': (d) => !!(d.url || '').trim(),
  // The engine reads rules (`conditions`) first, else one `expression` (executor.py `_run_condition`). F3: the
  // check read only `expression`, so a step built from rules always showed "Needs setup".
  'logic.condition': (d) => conditionRules(d).length > 0 || !!(d.expression || '').trim(),
  'logic.delay': (d) => d.seconds != null,
  'logic.approval': (d) => !!(d.message || '').trim(),
  'logic.foreach': (d) => !!(d.items_template || '').trim() || Array.isArray(d.items),
  'action.subworkflow': (d) => !!d.graph_id,
}

// A condition's rules that name something to test.
function conditionRules(d) {
  return (Array.isArray(d?.conditions) ? d.conditions : []).filter((c) => String(c?.field || '').trim())
}

export function nodeIsConfigured(type, data) {
  const f = CONFIGURED[type]
  return f ? !!f(data || {}) : true
}

// Contract C2: the engine's node statuses, used as they arrive.
const RUN_STATES = ['queued', 'running', 'waiting', 'succeeded', 'failed', 'skipped', 'cancelled']

// Visual state: run status > invalid (validation problem) > configured / idle.
//   status   the node's status from useWorkflowRun().nodeStates (or null)
//   invalid  true when validation or a save marked the node (useWorkflowDoc().issues)
export function nodeStatusState(type, data, { status = null, invalid = false } = {}) {
  if (status && RUN_STATES.includes(status)) return status
  if (invalid) return 'invalid'
  return nodeIsConfigured(type, data || {}) ? 'configured' : 'idle'
}

export const NODE_STATUS_LABELS = {
  idle: 'Needs setup', configured: 'Ready', queued: 'Queued', running: 'Running', waiting: 'Waiting',
  succeeded: 'Succeeded', failed: 'Failed', skipped: 'Skipped', cancelled: 'Cancelled', invalid: 'Invalid settings',
}
// Colour is never the only signal (plan §3.2): every state also has an icon.
export const NODE_STATUS_ICONS = {
  idle: 'lucide:circle-dashed', configured: 'lucide:circle', queued: 'lucide:clock', running: 'lucide:loader-circle',
  waiting: 'lucide:hand', succeeded: 'lucide:circle-check', failed: 'lucide:circle-alert', skipped: 'lucide:circle-slash',
  cancelled: 'lucide:ban', invalid: 'lucide:circle-alert',
}

// "Agent node, Summarise, succeeded" (plan §3.6).
export function nodeAriaLabel(type, data, state) {
  const category = WF_CATEGORIES[wfCategory(type)]
  const kind = category ? category.label.replace(/s$/, '') : 'Workflow'
  const title = (data && data.label) || wfDef(type)?.label || type
  return `${kind} step, ${title}, ${(NODE_STATUS_LABELS[state] || state || '').toLowerCase()}`
}

// Compact one-line config preview shown on the node (truncated by CSS).
export function nodeConfigPreview(type, data) {
  const d = data || {}
  try {
    if (type === 'trigger.schedule') return d.cron ? `cron ${d.cron}` : ''
    if (type === 'trigger.channel') return [d.platform, d.channel].filter(Boolean).join(' · ')
    if (type === 'trigger.webhook') return 'inbound HTTP'
    if (type === 'trigger.training.stream_event') {
      return [d.source_name || (d.source ? `camera ${d.source}` : ''), d.rule ? `rule ${d.rule}` : ''].filter(Boolean).join(' · ')
    }
    if (type === 'trigger.connector') {
      const n = Object.keys(d.filters || {}).length
      return [d.provider, d.event_type, n ? `${n} filter${n > 1 ? 's' : ''}` : '']
        .filter(Boolean).join(' · ')
    }
    if (type === 'agent.run') return d.output_mode && d.output_mode !== 'text' ? `output: ${d.output_mode}` : ''
    if (type === 'action.http') {
      if (!d.url) return ''
      let u = d.url
      try { const x = new URL(d.url); u = x.host + (x.pathname === '/' ? '' : x.pathname) } catch { /* templated */ }
      return `${d.method || 'GET'} ${u}`
    }
    if (type === 'action.tool') return d.tool || ''
    if (type === 'action.mcp_tool') return d.tool_name ? `${d.server_name || '?'}.${d.tool_name}` : ''
    if (type === 'action.script') return d.script_id ? `script #${d.script_id}` : ''
    if (type === 'action.channel') return [d.kind, d.slack_channel || d.url].filter(Boolean).join(' · ')
    if (type === 'logic.condition') {
      const rules = conditionRules(d)
      if (!rules.length) return d.expression || ''
      const join = String(d.join || 'AND').toUpperCase() === 'OR' ? ' or ' : ' and '
      return rules.map((r) => `${r.field} ${r.operator || '='} ${r.value ?? ''}`.trim()).join(join)
    }
    if (type === 'logic.delay') return d.seconds != null ? `wait ${d.seconds}s` : ''
    if (type === 'logic.foreach') return d.items_template || (Array.isArray(d.items) ? `${d.items.length} items` : '')
    if (type === 'action.subworkflow') return d.graph_name || (d.graph_id ? `graph #${d.graph_id}` : '')
    if (type === 'logic.approval') return d.message || ''
  } catch { /* defensive */ }
  return ''
}

// The node's category colour as a CSS value: the `--wf-cat-<category>` token (light and dark), from the registry's
// category, so `llm.call` is an AI node and `media.generate` a media node without any alias table.
export function nodeAccent(type) {
  return `var(${WF_CATEGORIES[wfCategory(type)].token})`
}
