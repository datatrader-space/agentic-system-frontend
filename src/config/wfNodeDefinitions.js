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
  'media.generate': {
    category: 'media', icon: 'lucide:film', label: 'Generate media', sub: 'Review a Studio estimate before spending',
    defaults: { operation: 'image', route_id: '', prompt: '', params: {}, references: [], cinema: {} },
    outputSample: { attachment_id: '(attachment)', url: '(url)', extra_attachment_ids: [] },
    fields: [
      { key: 'operation', type: 'enum', title: 'Operation', options: ['image','video','edit_image','speech','sound','music','sfx','upscale','lipsync','motion','avatar','voice_change','transcribe'] },
      { key: 'route_id', type: 'media-route', title: 'Model' },
      { key: 'prompt', type: 'textarea', title: 'Prompt', insertable: true },
      { key: 'params_json', type: 'textarea', title: 'Parameters (JSON)', mono: true },
      { key: 'references_json', type: 'textarea', title: 'References (JSON array)', mono: true, help: '[{"attachment_id":"{{nodes.id.attachment_id}}","role":"subject"}]' },
      { key: 'cinema_json', type: 'textarea', title: 'Cinema (JSON)', mono: true, showIf: data => data.operation === 'video' },
    ],
    hint: 'The run waits on a job approval card. Generate authorizes only that job; Decline stops the run.',
  },
  'trigger.manual': {
    category: 'trigger', icon: 'lucide:square-play', label: 'Manual trigger', sub: 'Runs on demand',
    defaults: {},
    fields: [
      { type: 'note', text: 'Manual triggers run when you press Run. Declare inputs to be prompted at run time — reference them as {{vars.key}}.' },
      { key: 'inputs', type: 'kv', title: 'Inputs', addLabel: '+ Add input',
        cols: [{ key: 'key', ph: 'key', mono: true }, { key: 'default', ph: 'default (optional)' }] },
    ],
  },
  'trigger.schedule': {
    category: 'trigger', icon: 'lucide:clock-3', label: 'Schedule', sub: 'Cron trigger',
    defaults: { cron: '0 8 * * *' },
    fields: [{ key: 'cron', type: 'string', mono: true, title: 'Cron (m h dom mon dow)', placeholder: '0 8 * * *' }],
    hint: 'Save to register the schedule. A scheduler tick fires it when the cron matches.',
  },
  'trigger.webhook': {
    category: 'trigger', icon: 'lucide:webhook', label: 'Webhook', sub: 'Inbound HTTP',
    defaults: {}, custom: true,   // dynamic URL display
  },
  'trigger.connector': {
    category: 'trigger', icon: 'lucide:plug', label: 'Connector event', sub: 'A connected account fires',
    // `connection` is an ID, never a credential: it names WHICH connected account this binding
    // listens to. The backend refuses credential-shaped keys outright, so there is deliberately no
    // field here to type a token into.
    //
    // `filters` is what stops a chatty provider costing money — a connector fires far more often
    // than a workflow wants to run, and the backend enforces these BEFORE the run exists. A missing
    // key does NOT match, so an empty filter set means "every event of this type".
    defaults: { provider: '', connection: '', event_type: '', filters: {} },
    fields: [
      { key: 'provider', type: 'string', title: 'Provider', placeholder: 'github / highlevel' },
      { key: 'connection', type: 'string', title: 'Connection id',
        placeholder: 'which connected account to listen to' },
      { key: 'event_type', type: 'string', title: 'Event type',
        placeholder: "the provider's own name, e.g. push" },
      // `filters_json`, not `filters`, and not a `kv` grid. This follows the `*_json` convention
      // documented on `llm.call` above: hydrate() stringifies the dict and serialize() parses it
      // back. A `kv` grid saves a LIST of row objects, and the backend expects an OBJECT keyed by
      // dotted path — so the rows would have been stored in a shape `event_matches` reads as "no
      // filters", silently widening the binding to every event.
      { key: 'filters_json', type: 'textarea', mono: true, rows: 4,
        title: 'Resource filters (optional)',
        placeholder: '{ "repository.name": "salon-site" }' },
    ],
    customTail: 'connectorUrl',
  },
  // A camera's event (Training Data's Cloud Streaming, ADM-1106): a rule on what a model finds on a camera matched.
  // Usually made from the camera's page ("Build a workflow"), which fills the camera in. The ids name WHICH camera and
  // rule; they are not authority: the server starts the workflow only for a camera of the workflow's own workspace,
  // and only once the workflow is published.
  'trigger.training.stream_event': {
    category: 'trigger', icon: 'lucide:cctv', label: 'Camera event', sub: 'A camera rule matched',
    defaults: { source: null, rule: null, source_name: '' },
    fields: [
      { type: 'note', text: 'Starts when a rule on this camera matches what a model finds, at most once in the rule\'s cooldown. Read the event as {{trigger.source.name}}, {{trigger.matched}} and {{trigger.frame_time}}. A step opens the frame with {{trigger.snapshot_url}} (it works for 15 minutes after the run starts); {{trigger.snapshot_link}} is for a signed-in person.' },
      { key: 'source', type: 'number', min: 1, title: 'Camera id', placeholder: 'from the camera\'s page in Training Data' },
      { key: 'rule', type: 'number', min: 1, title: 'Rule id (optional)', placeholder: 'any rule of the camera' },
    ],
    hint: 'Publish the workflow to have it start. It starts only for a camera of this workflow\'s workspace.',
    outputSample: { event: 0, source: { id: 0, name: 'Camera' }, matched: { person: 1 }, frame_time: '2026-11-18T09:00:00+00:00', snapshot_link: '(link)', snapshot_url: '(15-minute link)' },
  },
  'trigger.channel': {
    category: 'trigger', icon: 'lucide:message-square', label: 'Channel message', sub: 'Inbound slack/telegram/email',
    defaults: { platform: 'slack', channel: '', keyword: '' },
    fields: [
      { key: 'platform', type: 'enum', title: 'Platform', options: [['slack', 'Slack'], ['telegram', 'Telegram'], ['email', 'Email']] },
      { key: 'channel', type: 'string', title: 'Channel (optional)', placeholder: '#general / chat id' },
      { key: 'keyword', type: 'string', title: 'Keyword filter (optional)', placeholder: 'only fire if message contains…' },
    ],
    customTail: 'channelUrl',
  },
  'agent.run': {
    category: 'agent', icon: 'lucide:bot', label: 'Run agent', sub: 'Run an AgentProfile',
    defaults: { prompt: '', agent_id: null, agent_name: '' }, custom: true,   // agent picker + output-mode + schema editor
    outputSample: { text: 'agent reply text', agent: 'Agent name' },   // JSON/schema mode adds the declared fields
  },
  // ONE structured model call — no tool loop, no planning. Separate from `agent.run` because the
  // difference is cost: a workflow whose steps are known in advance needs the model only where language
  // understanding is genuinely required, and paying for a planning loop there buys nothing. Every
  // shipped template is built around exactly one of these.
  'llm.call': {
    category: 'agent', icon: 'lucide:sparkles', label: 'Model call', sub: 'One structured LLM call',
    defaults: { prompt: '', system: '', model_id: null, output_mode: 'text', output_schema_json: '' },
    fields: [
      { key: 'prompt', type: 'textarea', rows: 6, insertable: true, title: 'Prompt',
        placeholder: 'Extract the decisions from {{nodes.fetch.output.text}}' },
      { key: 'system', type: 'textarea', rows: 2, insertable: true, title: 'System prompt (optional)',
        placeholder: 'You extract structured facts and never invent them.' },
      { key: 'model_id', type: 'string', mono: true, title: 'Model (optional)',
        placeholder: 'leave blank to use your default' },
      { key: 'output_mode', type: 'enum', title: 'Output',
        options: [['text', 'Text'], ['json', 'JSON object'], ['schema', 'JSON Schema']] },
      // `*_json` is the builder's convention for a dict edited as text: hydrate() stringifies it and
      // serialize() parses it back. There is no `json` field flag — the renderer would have shown a
      // plain textarea and the dict would have been saved as a STRING the executor cannot read.
      { key: 'output_schema_json', type: 'textarea', mono: true, rows: 6,
        title: 'Output schema (JSON Schema)',
        placeholder: '{ "type": "object", "properties": { "summary": { "type": "string" } }, "required": ["summary"] }' },
    ],
    hint: 'On JSON/Schema output a reply that does not parse, or that omits a required field, FAILS the '
        + 'step. Partial data would let a downstream condition read a missing field, evaluate false and '
        + 'take the wrong branch silently.',
    outputSample: { text: 'model reply', model: 'Model name' },   // schema mode adds the declared fields
  },
  'action.tool': {
    category: 'action', icon: 'lucide:wrench', label: 'Run tool', sub: 'Call a registered tool',
    defaults: { tool: '', params_json: '{}' },
    fields: [
      { key: 'tool', type: 'string', mono: true, list: 'tools', title: 'Tool name', placeholder: 'GITHUB_LIST_REPOSITORIES' },
      { key: 'params_json', type: 'textarea', mono: true, rows: 5, insertable: true, title: 'Params (JSON)', placeholder: '{ "owner": "me" }' },
    ],
    hint: 'Read-only tools run unattended; approval-required tools are blocked in workflows.',
    // B10: the tool's own structure is kept under `result` (a JSON string is parsed); `text` stays for old templates.
    outputSample: { text: 'tool result text', result: '(the tool result)', tool: 'TOOL_NAME' },
  },
  'action.mcp_tool': {
    category: 'action', icon: 'lucide:plug-zap', label: 'MCP tool', sub: 'Deterministic MCP call',
    paletteHidden: true,   // reached via the palette's MCP drill-in
    defaults: { agent_id: null, agent_name: '', server_id: null, server_name: '', tool_name: '', params_json: '{}' },
    custom: true,
    outputSample: { text: 'MCP tool result', result: '(the tool result)', tool: 'tool_name', server_id: 0 },
  },
  'action.script': {
    category: 'action', icon: 'lucide:scan-line', label: 'Run script', sub: 'Run a saved script',
    defaults: { script_id: null },
    fields: [{ key: 'script_id', type: 'enum', optionsKey: 'scripts', title: 'Saved script', placeholder: 'Select a script…' }],
    hint: 'Runs a SavedScript you own in the sandbox. Manage scripts on the Scripts page.',
  },
  'action.channel': {
    category: 'action', icon: 'lucide:send', label: 'Send to channel', sub: 'log / slack / webhook / telegram / email',
    defaults: { kind: 'log', message: '', slack_channel: '', url: '', chat_id: '', to: '', subject: '' },
    fields: [
      { key: 'kind', type: 'enum', title: 'Channel', options: [['log', 'Log (always works)'], ['slack', 'Slack'], ['webhook', 'Webhook'], ['telegram', 'Telegram'], ['email', 'Email']] },
      { key: 'slack_channel', type: 'string', title: 'Slack channel (id or #name)', placeholder: 'C0123… or #general', showIf: (d) => d.kind === 'slack' },
      { key: 'url', type: 'string', title: 'Webhook URL', placeholder: 'https://…', showIf: (d) => d.kind === 'webhook' },
      { key: 'chat_id', type: 'string', title: 'Telegram chat id', placeholder: '123456789', showIf: (d) => d.kind === 'telegram', help: 'Uses your connected Telegram bot, or set a bot token below.' },
      { key: 'bot_token', type: 'password', title: 'Bot token (optional)', placeholder: 'overrides the connected bot', showIf: (d) => d.kind === 'telegram' },
      { key: 'to', type: 'string', title: 'Recipient(s)', placeholder: 'to@example.com, other@…', showIf: (d) => d.kind === 'email' },
      { key: 'subject', type: 'string', title: 'Subject', placeholder: 'Workflow notification', showIf: (d) => d.kind === 'email' },
      { key: 'message', type: 'textarea', rows: 5, insertable: true, title: 'Message', placeholder: 'Message to send. Insert variables from upstream nodes.' },
    ],
    outputSample: { text: 'sent message', channel: 'log', delivered: true },
  },
  'action.http': {
    category: 'action', icon: 'lucide:earth', label: 'HTTP request', sub: 'GET/POST a URL',
    defaults: { method: 'GET', url: '', json_text: '' },
    fields: [
      { key: 'method', type: 'enum', title: 'Method', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'url', type: 'string', insertable: true, title: 'URL', placeholder: 'https://…' },
      { key: 'json_text', type: 'textarea', mono: true, rows: 4, insertable: true, title: 'JSON body (optional)', placeholder: '{ "key": "value" }' },
    ],
    outputSample: { status_code: 200, text: 'response body' },
  },
  'logic.condition': {
    category: 'logic', icon: 'lucide:split', label: 'Condition', sub: 'Branch true / false',
    defaults: { expression: '' },
    fields: [{ key: 'expression', type: 'string', mono: true, insertable: true, title: 'Expression', placeholder: '{{nodes.<id>.output.text}} contains ok' }],
    hint: 'Supports == != > < >= <= and "contains". The true / false handles route each branch.',
    outputSample: { result: true, text: 'True', expression: '… contains ok' },
  },
  'logic.approval': {
    category: 'logic', icon: 'lucide:badge-check', label: 'Approval', sub: 'Wait for human OK',
    defaults: { message: 'Approve to continue?' },
    fields: [
      // `approvers` (user ids; empty = the owner decides) is not a schema field: settings/ApproversField.vue picks
      // them from the people who can see the workflow, and the server enforces who may decide (ADM-1339).
      { key: 'message', type: 'textarea', rows: 3, title: 'Approval message', placeholder: 'What needs approval? Shown to the approver.' },
    ],
    hint: 'The run pauses here until approved. Connect the normal handle for approve, the on-error handle for reject.',
    customTail: 'approval',
  },
  'logic.foreach': {
    category: 'logic', icon: 'lucide:repeat-2', label: 'For-each', sub: 'Run per list item',
    defaults: { items_template: '', do: { type: 'action.channel', data: { kind: 'log', message: 'item {{item}}' } } },
    custom: true,
  },
  'logic.delay': {
    category: 'logic', icon: 'lucide:timer', label: 'Delay', sub: 'Wait (durable >60s)',
    defaults: { seconds: 5 },
    // No upper bound: up to 60 s the step waits in place; a longer delay parks the run and resumes it later.
    fields: [{ key: 'seconds', type: 'number', min: 0, title: 'Seconds to wait',
      help: 'Up to 60 seconds the step waits in place. A longer delay pauses the run and resumes it when the time is up.' }],
  },
  'action.subworkflow': {
    category: 'action', icon: 'lucide:workflow', label: 'Sub-workflow', sub: 'Run another graph',
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
  'media.generate',
  'trigger.manual', 'trigger.schedule', 'trigger.webhook', 'trigger.channel', 'trigger.connector',
  'trigger.training.stream_event',
  'agent.run', 'llm.call', 'action.tool', 'action.script', 'action.channel', 'action.http',
  'logic.condition', 'logic.approval', 'logic.foreach', 'logic.delay', 'action.subworkflow',
]

export const WF_TYPES = Object.keys(WF_NODE_DEFS)

export function wfDef(type) { return WF_NODE_DEFS[type] || null }

// THE category set (plan §3.2): one label, one Lucide icon and one colour token per category. The colours are the
// `--wf-cat-<id>` tokens in components/workflows/workflow-builder.css (light and dark, text contrast 4.5:1 or more).
// Every node type's category and icon come from WF_NODE_DEFS above; nothing else keeps its own map.
export const WF_CATEGORIES = {
  trigger: { label: 'Triggers', icon: 'lucide:zap', token: '--wf-cat-trigger' },
  agent: { label: 'AI', icon: 'lucide:bot', token: '--wf-cat-agent' },
  action: { label: 'Actions', icon: 'lucide:wrench', token: '--wf-cat-action' },
  logic: { label: 'Logic', icon: 'lucide:split', token: '--wf-cat-logic' },
  media: { label: 'Media', icon: 'lucide:film', token: '--wf-cat-media' },
}
export const WF_CATEGORY_ORDER = ['trigger', 'agent', 'action', 'logic', 'media']

/** The category id of a node type ('logic' for a type the registry does not know). */
export function wfCategory(type) { return WF_NODE_DEFS[type]?.category || 'logic' }

/** The Lucide icon of a node type, from the registry (its category's icon for an unknown type). */
export function wfIcon(type) { return WF_NODE_DEFS[type]?.icon || WF_CATEGORIES[wfCategory(type)].icon }

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
