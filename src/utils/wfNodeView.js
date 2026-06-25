// Workflow Builder — pure node-presentation logic (Phase 2B), extracted from WfNode.vue so it's
// unit-testable. No DOM, no Vue. Purely derives a node's config preview, configured-ness, and
// visual status state from its type + data. Does NOT change data shapes or execution.

// A node is "configured" when its key fields are set (drives the idle vs configured indicator).
const CONFIGURED = {
  'trigger.manual': () => true,
  'trigger.schedule': (d) => !!d.cron,
  'trigger.webhook': () => true,
  'trigger.channel': (d) => !!d.platform,
  'agent.run': (d) => !!(d.agent_id && (d.prompt || '').trim()),
  'action.tool': (d) => !!d.tool,
  'action.mcp_tool': (d) => !!(d.agent_id && d.server_id && d.tool_name),
  'action.script': (d) => !!d.script_id,
  'action.channel': (d) => !!(d.message || '').trim(),
  'action.http': (d) => !!(d.url || '').trim(),
  'logic.condition': (d) => !!(d.expression || '').trim(),
  'logic.delay': (d) => d.seconds != null,
  'logic.approval': (d) => !!(d.message || '').trim(),
  'logic.foreach': (d) => !!(d.items_template || '').trim() || Array.isArray(d.items),
  'action.subworkflow': (d) => !!d.graph_id,
}

export function nodeIsConfigured(type, data) {
  const f = CONFIGURED[type]
  return f ? !!f(data || {}) : true
}

const RUN_STATES = ['running', 'success', 'failed', 'skipped', 'waiting', 'pending']

// Visual status: live run status > invalid (validation error) > configured / idle.
export function nodeStatusState(type, data) {
  const d = data || {}
  if (d.__status && RUN_STATES.includes(d.__status)) return d.__status
  if (d.__error) return 'invalid'
  return nodeIsConfigured(type, d) ? 'configured' : 'idle'
}

export const NODE_STATUS_LABELS = {
  idle: 'Not configured', configured: 'Ready', pending: 'Pending', running: 'Running',
  waiting: 'Waiting / approval', success: 'Success', failed: 'Failed', skipped: 'Skipped', invalid: 'Invalid config',
}

// Compact one-line config preview shown on the node (truncated by CSS).
export function nodeConfigPreview(type, data) {
  const d = data || {}
  try {
    if (type === 'trigger.schedule') return d.cron ? `cron ${d.cron}` : ''
    if (type === 'trigger.channel') return [d.platform, d.channel].filter(Boolean).join(' · ')
    if (type === 'trigger.webhook') return 'inbound HTTP'
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
    if (type === 'logic.condition') return d.expression || ''
    if (type === 'logic.delay') return d.seconds != null ? `wait ${d.seconds}s` : ''
    if (type === 'logic.foreach') return d.items_template || (Array.isArray(d.items) ? `${d.items.length} items` : '')
    if (type === 'action.subworkflow') return d.graph_name || (d.graph_id ? `graph #${d.graph_id}` : '')
    if (type === 'logic.approval') return d.approvers || ''
  } catch { /* defensive */ }
  return ''
}

export const NODE_CATEGORY_ACCENTS = { trigger: '#0d9488', agent: '#4f46e5', action: '#7c3aed', logic: '#64748b' }
export function nodeAccent(type) {
  return NODE_CATEGORY_ACCENTS[(type || '').split('.')[0]] || '#64748b'
}
