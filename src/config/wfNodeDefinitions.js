// Workflow Builder: the step registry the page reads (ADM-1351, D4).
//
// THE STEPS COME FROM THE SERVER. `GET /api/workflow-graphs/step-types/` (agent/services/workflow_graph/steps.py) is
// the one list of step types: their category, label, defaults, settings fields, hints, output sample, outputs and
// inputs. The builder loads it once per page session (src/config/wfStepRegistry.js) BEFORE the canvas and the picker
// draw, and `setStepRegistry` fills the objects exported here IN PLACE, so every importer keeps reading WF_NODE_DEFS,
// WF_TYPES, wfDef() and the rest unchanged. There is no bundled copy: until the registry is read the lists are empty,
// and a failed read is shown by the builder as an error with a retry.
//
// Only PRESENTATION stays here: each type's Lucide icon and each category's label, icon and colour token. Icon names
// are written out in this file on purpose: icons are bundled at build time from the names the frontend source
// contains (scripts/vite-icon-subset.js, ADM-1342), so a name only the server sent would never be drawn.
//
// Field schema (per entry in `fields`, as the server sends it):
//   key         data key written into node.data
//   type        'string' | 'textarea' | 'number' | 'enum' | 'boolean' | 'password' | 'kv' | 'note' | 'media-route'
//   title       label shown above the control
//   placeholder optional placeholder
//   help        optional hint shown under the field (plain text)
//   options     enum options: array of strings OR [value, label] pairs
//   optionsKey  key into the node editor's lists for an enum's options (graphs, scripts, visionModels)
//   list        key into SchemaForm's `lists` prop for a datalist (e.g. 'tools')
//   mono        monospace input
//   rows        textarea rows
//   min/max     number bounds
//   insertable  show an "Insert variable" button (emits insert(key) → Data Picker)
//   text        a note's text
//   cols        a kv field's columns: { key, ph, mono, options } (a column with `options` is a select)
//   addLabel    a kv field's add button
//   showIf      DATA, not code: { "<field>": <value> | [<values>] }, shown while the step's data field equals the value
//               (or one of the values); null or absent = always shown
//
// Entry flags (mapped from the server's names):
//   custom        inspector renders a bespoke template (NOT auto-rendered from `fields`)
//   paletteHidden not shown in the main palette list (server `palette: false`; reached another way, e.g. MCP drill-in)
//   hint          def-level hint rendered after the schema form
//   customTail    marker the inspector uses to append extra UI after the schema form (server `custom_tail`)
//   outputSample  design-time sample for the Data Picker (server `output_sample`)
//   branches      the named outputs a deciding step routes by (server `branches`, ADM-1363): a Data table step's
//                 ["exists", "missing"], drawn while its operation is Exists (see wfBranchHandles)
//   frameMode     the step may run on a camera frame, in a workflow that starts with "Each camera frame" (server
//                 `frame_mode`; ADM-1351 phase 2): a stream refuses a frame workflow with any other step

import { browserTimeZone } from '@/utils/timeZone'

// Each step type's icon (Lucide). A type the server adds without an entry here is drawn with its category's icon.
export const WF_ICONS = Object.freeze({
  'media.generate': 'lucide:film',
  'trigger.manual': 'lucide:square-play',
  'trigger.schedule': 'lucide:clock-3',
  'trigger.webhook': 'lucide:webhook',
  'trigger.connector': 'lucide:plug',
  'trigger.training.stream_event': 'lucide:cctv',
  'trigger.frame': 'lucide:aperture',
  'trigger.channel': 'lucide:message-square',
  'agent.run': 'lucide:bot',
  'llm.call': 'lucide:sparkles',
  'vision.model': 'lucide:scan-search',
  'vision.filter': 'lucide:filter',
  'vision.crop': 'lucide:crop',
  'vision.draw': 'lucide:pen-tool',
  'action.tool': 'lucide:wrench',
  'action.mcp_tool': 'lucide:plug-zap',
  'action.script': 'lucide:scan-line',
  'action.channel': 'lucide:send',
  'action.http': 'lucide:earth',
  'logic.condition': 'lucide:split',
  'logic.approval': 'lucide:badge-check',
  'logic.foreach': 'lucide:repeat-2',
  'logic.delay': 'lucide:timer',
  'action.subworkflow': 'lucide:workflow',
  // Data (ADM-1363): the workspace's own tables and external databases.
  'data.table': 'lucide:table-2',
  'trigger.table': 'lucide:table-properties',
  'data.sql': 'lucide:database',
  'data.mongo': 'lucide:leaf',
  'data.redis': 'lucide:layers',
  'trigger.database': 'lucide:database-zap',
})

// THE category set (plan §3.2): one label, one Lucide icon and one colour token per category. The colours are the
// `--wf-cat-<id>` tokens in components/workflows/workflow-builder.css (light and dark, text contrast 4.5:1 or more).
export const WF_CATEGORIES = {
  trigger: { label: 'Triggers', icon: 'lucide:zap', token: '--wf-cat-trigger' },
  agent: { label: 'AI', icon: 'lucide:bot', token: '--wf-cat-agent' },
  action: { label: 'Actions', icon: 'lucide:wrench', token: '--wf-cat-action' },
  logic: { label: 'Logic', icon: 'lucide:split', token: '--wf-cat-logic' },
  media: { label: 'Media', icon: 'lucide:film', token: '--wf-cat-media' },
  vision: { label: 'Vision', icon: 'lucide:eye', token: '--wf-cat-vision' },
  data: { label: 'Data', icon: 'lucide:database', token: '--wf-cat-data' },
}
export const WF_CATEGORY_ORDER = ['trigger', 'agent', 'action', 'logic', 'media', 'vision', 'data']

// Filled in place by setStepRegistry (never reassigned, so importers keep their reference).
export const WF_NODE_DEFS = {}
// Palette order, from the server's order (excludes palette-hidden entries like action.mcp_tool).
export const WF_PALETTE_ORDER = []
export const WF_TYPES = []
// The value kinds the server's step outputs and inputs are typed with (text, image, detections, ...).
export const WF_KINDS = []

let ready = false

/** True once the server's registry has been taken in (the builder draws nothing before). */
export function stepRegistryReady() { return ready }

/**
 * Take the server's registry ({ steps, kinds, categories }) into the exported objects, in place. Throws, and changes
 * nothing, when the answer is not in the shape this page reads: a half-read registry would draw a wrong builder.
 */
export function setStepRegistry(json) {
  const steps = json && Array.isArray(json.steps) ? json.steps : null
  if (!steps || !steps.length) throw new Error('The server sent the step list in a shape this page does not read.')
  const defs = {}
  for (const s of steps) {
    if (!s || typeof s.type !== 'string' || !s.type) throw new Error('The server sent a step without a type.')
    if (!WF_CATEGORIES[s.category]) throw new Error(`The server sent a step category this page cannot show (${s.category}).`)
    defs[s.type] = {
      category: s.category,
      icon: WF_ICONS[s.type] || WF_CATEGORIES[s.category].icon,
      label: s.label || s.type,
      sub: s.sub || '',
      order: s.order,
      trigger: !!s.trigger,
      executable: s.executable !== false,
      billable: !!s.billable,
      frameMode: !!s.frame_mode,
      custom: !!s.custom,
      paletteHidden: s.palette === false,
      customTail: s.custom_tail || undefined,
      defaults: s.defaults && typeof s.defaults === 'object' ? s.defaults : {},
      fields: Array.isArray(s.fields) ? s.fields : [],
      hint: s.hint || undefined,
      outputSample: s.output_sample ?? undefined,
      outputs: s.outputs && typeof s.outputs === 'object' ? s.outputs : {},
      inputs: s.inputs && typeof s.inputs === 'object' ? s.inputs : {},
      branches: Array.isArray(s.branches) ? s.branches.filter((b) => typeof b === 'string' && b) : [],
    }
  }
  for (const k of Object.keys(WF_NODE_DEFS)) delete WF_NODE_DEFS[k]
  Object.assign(WF_NODE_DEFS, defs)
  WF_TYPES.splice(0, WF_TYPES.length, ...steps.map((s) => s.type))
  WF_PALETTE_ORDER.splice(0, WF_PALETTE_ORDER.length, ...steps.filter((s) => s.palette !== false).map((s) => s.type))
  WF_KINDS.splice(0, WF_KINDS.length, ...(Array.isArray(json.kinds) ? json.kinds : []))
  ready = true
}

/** For tests: forget the registry. */
export function resetStepRegistry() {
  for (const k of Object.keys(WF_NODE_DEFS)) delete WF_NODE_DEFS[k]
  WF_TYPES.length = 0
  WF_PALETTE_ORDER.length = 0
  WF_KINDS.length = 0
  ready = false
}

export function wfDef(type) { return WF_NODE_DEFS[type] || null }

// A condition's two outputs: the engine routes it by true / false (executor `_BRANCH_HANDLES`).
const CONDITION_BRANCHES = Object.freeze(['true', 'false'])

/**
 * The named outputs a step routes by, for its data ([] for a step with one plain output). A condition always has
 * true / false. A step whose registry entry declares `branches` (a Data table step: exists / missing, ADM-1363) has
 * them only while its operation is the deciding one, Exists: every other operation has one plain output, as the
 * engine routes it (executor `_branch_handle`).
 */
export function wfBranchHandles(type, data) {
  if (type === 'logic.condition') return CONDITION_BRANCHES
  const branches = WF_NODE_DEFS[type]?.branches || []
  if (!branches.length) return []
  return (data || {}).operation === 'exists' ? branches : []
}

/** The category id of a node type ('logic' for a type the registry does not know). */
export function wfCategory(type) { return WF_NODE_DEFS[type]?.category || 'logic' }

/** The Lucide icon of a node type (its category's icon for an unknown type). */
export function wfIcon(type) { return WF_NODE_DEFS[type]?.icon || WF_ICONS[type] || WF_CATEGORIES[wfCategory(type)].icon }

// Palette items (drag/click metadata) derived from the registry — single source, no duplication.
export function wfPaletteItems() {
  return WF_PALETTE_ORDER.filter((t) => WF_NODE_DEFS[t] && !WF_NODE_DEFS[t].paletteHidden)
    .map((t) => ({ type: t, icon: WF_NODE_DEFS[t].icon, label: WF_NODE_DEFS[t].label, sub: WF_NODE_DEFS[t].sub }))
}

// Default node `data` for a freshly-dropped node (deep clone so nested defaults aren't shared).
export function wfDefaultData(type) {
  const def = WF_NODE_DEFS[type]
  const d = def && def.defaults ? def.defaults : {}
  let data
  try { data = JSON.parse(JSON.stringify(d)) } catch { data = { ...d } }
  // A new schedule runs in the person's own timezone (ADM-1354): "every day at 08:00" means their 08:00. The server
  // cannot know it, so it is filled here, where the step is made.
  if (type === 'trigger.schedule' && !data.timezone) data.timezone = browserTimeZone()
  return data
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

/** Whether a field is shown for this data: `showIf` is { field: value | [values] } (every entry must match). */
export function wfFieldShown(field, data) {
  const cond = field && field.showIf
  if (!cond || typeof cond !== 'object') return true
  const d = data || {}
  return Object.entries(cond).every(([k, want]) => (Array.isArray(want) ? want.includes(d[k]) : d[k] === want))
}

// The steps a For-each may run for each item: the engine's rule (executor `_FOREACH_INNER`): these five actions and
// every vision step. Kept here, in one place; their order and names come from the server's registry.
const FOREACH_INNER_ACTIONS = ['action.channel', 'action.tool', 'action.http', 'agent.run', 'action.subworkflow']

/** Whether a For-each may run `type` for each item (in a frame workflow, only a step a frame can run: `frameMode`). */
export function wfForeachInner(type, { frame = false } = {}) {
  const def = WF_NODE_DEFS[type]
  if (!def || !(FOREACH_INNER_ACTIONS.includes(type) || def.category === 'vision')) return false
  return !frame || def.frameMode
}

/** The step types a For-each offers, in the registry's order: [{ value, label }]. */
export function wfForeachInnerTypes({ frame = false } = {}) {
  return WF_TYPES.filter((t) => wfForeachInner(t, { frame })).map((t) => ({ value: t, label: WF_NODE_DEFS[t].label }))
}
