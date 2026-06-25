// Workflow Builder — central node definition registry (Flow Weaver-style, Phase 1).
//
// ONE source of truth for: palette metadata (icon/label/sub/category), default node data,
// and — for schema-driven nodes — the config form fields (rendered by SchemaForm.vue).
//
// This is a FRONTEND architecture refactor only. The graph-JSON `data` shapes produced here are
// IDENTICAL to the previous hand-coded inspector + defaultData(), so existing workflows still
// save/load unchanged. The Django backend (compile/executor) is the validator/runtime and is
// untouched.
//
// Field schema (per entry in `fields`):
//   key         data key written into node.data
//   type        'string' | 'textarea' | 'number' | 'enum' | 'boolean' | 'password'
//   title       label shown above the control
//   placeholder optional placeholder
//   help        optional hint shown under the field (plain text)
//   options     enum options — array of strings OR [value, label] pairs
//   list        key into SchemaForm's `lists` prop for a datalist (e.g. 'tools')
//   mono        monospace input
//   rows        textarea rows
//   min/max     number bounds
//   insertable  show an "Insert variable" button (emits insert(key) → Data Picker)
//   showIf      (data) => boolean — conditional visibility
//   group/groupOrder/fieldOrder  optional grouping + ordering (Flow Weaver-style)
//
// Entry flags:
//   custom: true       inspector renders a bespoke template (NOT auto-rendered from `fields`)
//   paletteHidden:true not shown in the main palette list (reached another way, e.g. MCP drill-in)
//   hint               def-level hint rendered after the schema form
//   customTail         marker the inspector uses to append extra UI after the schema form

export const WF_NODE_DEFS = {
  'trigger.manual': {
    category: 'trigger', icon: '▶', label: 'Manual trigger', sub: 'Runs on demand',
    defaults: {},
    fields: [
      { type: 'note', text: 'Manual triggers run when you press Run. Declare inputs to be prompted at run time — reference them as {{vars.key}}.' },
      { key: 'inputs', type: 'kv', title: 'Inputs', addLabel: '+ Add input',
        cols: [{ key: 'key', ph: 'key', mono: true }, { key: 'default', ph: 'default (optional)' }] },
    ],
  },
  'trigger.schedule': {
    category: 'trigger', icon: '⏰', label: 'Schedule', sub: 'Cron trigger',
    defaults: { cron: '0 8 * * *' },
    fields: [{ key: 'cron', type: 'string', mono: true, title: 'Cron (m h dom mon dow)', placeholder: '0 8 * * *' }],
    hint: 'Save to register the schedule. A scheduler tick fires it when the cron matches.',
  },
  'trigger.webhook': {
    category: 'trigger', icon: '🔗', label: 'Webhook', sub: 'Inbound HTTP',
    defaults: {}, custom: true,   // dynamic URL display
  },
  'trigger.channel': {
    category: 'trigger', icon: '💬', label: 'Channel message', sub: 'Inbound slack/telegram/email',
    defaults: { platform: 'slack', channel: '', keyword: '' },
    fields: [
      { key: 'platform', type: 'enum', title: 'Platform', options: [['slack', 'Slack'], ['telegram', 'Telegram'], ['email', 'Email']] },
      { key: 'channel', type: 'string', title: 'Channel (optional)', placeholder: '#general / chat id' },
      { key: 'keyword', type: 'string', title: 'Keyword filter (optional)', placeholder: 'only fire if message contains…' },
    ],
    customTail: 'channelUrl',
  },
  'agent.run': {
    category: 'agent', icon: '🤖', label: 'Run agent', sub: 'Run an AgentProfile',
    defaults: { prompt: '', agent_id: null, agent_name: '' }, custom: true,   // agent picker + output-mode + schema editor
    outputSample: { text: 'agent reply text', agent: 'Agent name' },   // JSON/schema mode adds the declared fields
  },
  'action.tool': {
    category: 'action', icon: '🛠️', label: 'Run tool', sub: 'Call a registered tool',
    defaults: { tool: '', params_json: '{}' },
    fields: [
      { key: 'tool', type: 'string', mono: true, list: 'tools', title: 'Tool name', placeholder: 'GITHUB_LIST_REPOSITORIES' },
      { key: 'params_json', type: 'textarea', mono: true, rows: 5, insertable: true, title: 'Params (JSON)', placeholder: '{ "owner": "me" }' },
    ],
    hint: 'Read-only tools run unattended; approval-required tools are blocked in workflows.',
    outputSample: { text: 'tool result text', tool: 'TOOL_NAME' },
  },
  'action.mcp_tool': {
    category: 'action', icon: '🔧', label: 'MCP tool', sub: 'Deterministic MCP call',
    paletteHidden: true,   // reached via the palette's MCP drill-in
    defaults: { agent_id: null, agent_name: '', server_id: null, server_name: '', tool_name: '', params_json: '{}' },
    custom: true,
    outputSample: { text: 'MCP tool result', tool: 'tool_name', server_id: 0 },
  },
  'action.script': {
    category: 'action', icon: '📜', label: 'Run script', sub: 'Run a saved script',
    defaults: { script_id: null },
    fields: [{ key: 'script_id', type: 'number', title: 'Saved script id', placeholder: 'e.g. 12' }],
    hint: 'Runs a SavedScript you own in the sandbox. Find the id on the Scripts page.',
  },
  'action.channel': {
    category: 'action', icon: '📣', label: 'Send to channel', sub: 'log / slack / webhook',
    defaults: { kind: 'log', message: '', slack_channel: '', url: '' },
    fields: [
      { key: 'kind', type: 'enum', title: 'Channel', options: [['log', 'Log (always works)'], ['slack', 'Slack'], ['webhook', 'Webhook']] },
      { key: 'slack_channel', type: 'string', title: 'Slack channel (id or #name)', placeholder: 'C0123… or #general', showIf: (d) => d.kind === 'slack' },
      { key: 'url', type: 'string', title: 'Webhook URL', placeholder: 'https://…', showIf: (d) => d.kind === 'webhook' },
      { key: 'message', type: 'textarea', rows: 5, insertable: true, title: 'Message', placeholder: 'Message to send. Insert variables from upstream nodes.' },
    ],
    outputSample: { text: 'sent message', channel: 'log', delivered: true },
  },
  'action.http': {
    category: 'action', icon: '🌐', label: 'HTTP request', sub: 'GET/POST a URL',
    defaults: { method: 'GET', url: '', json_text: '' },
    fields: [
      { key: 'method', type: 'enum', title: 'Method', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'url', type: 'string', insertable: true, title: 'URL', placeholder: 'https://…' },
      { key: 'json_text', type: 'textarea', mono: true, rows: 4, insertable: true, title: 'JSON body (optional)', placeholder: '{ "key": "value" }' },
    ],
    outputSample: { status_code: 200, text: 'response body' },
  },
  'logic.condition': {
    category: 'logic', icon: '🔀', label: 'Condition', sub: 'Branch true / false',
    defaults: { expression: '' },
    fields: [{ key: 'expression', type: 'string', mono: true, insertable: true, title: 'Expression', placeholder: '{{nodes.<id>.output.text}} contains ok' }],
    hint: 'Supports == != > < >= <= and "contains". The true / false handles route each branch.',
    outputSample: { result: true, text: 'True', expression: '… contains ok' },
  },
  'logic.approval': {
    category: 'logic', icon: '✋', label: 'Approval', sub: 'Wait for human OK',
    defaults: { message: 'Approve to continue?' },
    fields: [
      { key: 'message', type: 'textarea', rows: 3, title: 'Approval message', placeholder: 'What needs approval? Shown to the approver.' },
      { key: 'approvers', type: 'string', title: 'Approvers (optional)', placeholder: 'emails, comma-separated' },
    ],
    hint: 'The run pauses here until approved. Connect the normal handle for approve, the on-error handle for reject.',
    customTail: 'approval',
  },
  'logic.foreach': {
    category: 'logic', icon: '🔁', label: 'For-each', sub: 'Run per list item',
    defaults: { items_template: '', do: { type: 'action.channel', data: { kind: 'log', message: 'item {{item}}' } } },
    custom: true,
  },
  'logic.delay': {
    category: 'logic', icon: '⏳', label: 'Delay', sub: 'Wait (durable >60s)',
    defaults: { seconds: 5 },
    fields: [{ key: 'seconds', type: 'number', min: 0, max: 60, title: 'Seconds (max 60)' }],
  },
  'action.subworkflow': {
    category: 'action', icon: '🧩', label: 'Sub-workflow', sub: 'Run another graph',
    defaults: { graph_id: null, graph_name: '' },
    fields: [
      { key: 'graph_id', type: 'enum', optionsKey: 'graphs', title: 'Workflow to run', placeholder: 'Select a workflow…' },
    ],
    hint: 'Runs another graph you own and waits for it (max depth 3). Its trigger payload receives this run\'s context.',
    outputSample: { sub_run_id: 0, text: 'sub-workflow ok' },
  },
}

// Palette order (excludes paletteHidden entries like action.mcp_tool).
export const WF_PALETTE_ORDER = [
  'trigger.manual', 'trigger.schedule', 'trigger.webhook', 'trigger.channel',
  'agent.run', 'action.tool', 'action.script', 'action.channel', 'action.http',
  'logic.condition', 'logic.approval', 'logic.foreach', 'logic.delay', 'action.subworkflow',
]

export const WF_TYPES = Object.keys(WF_NODE_DEFS)

export function wfDef(type) { return WF_NODE_DEFS[type] || null }

// Palette items (drag/click metadata) derived from the registry — single source, no duplication.
export function wfPaletteItems() {
  return WF_PALETTE_ORDER.filter((t) => WF_NODE_DEFS[t] && !WF_NODE_DEFS[t].paletteHidden)
    .map((t) => ({ type: t, icon: WF_NODE_DEFS[t].icon, label: WF_NODE_DEFS[t].label, sub: WF_NODE_DEFS[t].sub }))
}

// Default node `data` for a freshly-dropped node (deep clone so nested defaults aren't shared).
export function wfDefaultData(type) {
  const def = WF_NODE_DEFS[type]
  const d = def && def.defaults ? def.defaults : {}
  try { return JSON.parse(JSON.stringify(d)) } catch { return { ...d } }
}

// Schema fields for SchemaForm — null when the node uses a bespoke (custom) inspector template.
export function wfFields(type) {
  const def = WF_NODE_DEFS[type]
  return def && !def.custom && def.fields ? def.fields : null
}

// Design-time output sample for the Data Picker tree (used when no live run sample exists).
// Deep-cloned so the tree can't mutate the registry. Returns null when none is declared.
export function wfOutputSample(type) {
  const s = WF_NODE_DEFS[type]?.outputSample
  if (!s) return null
  try { return JSON.parse(JSON.stringify(s)) } catch { return { ...s } }
}
