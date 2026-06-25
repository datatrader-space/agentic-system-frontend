// Smoke check: the schema-driven node registry must produce IDENTICAL defaults + palette to the
// old hand-coded inspector, so existing workflows still save/load unchanged (Phase 1 parity).
// Run: node scripts/wf_node_defs_smoke.mjs
import { WF_TYPES, wfDefaultData, wfPaletteItems, wfFields, wfDef } from '../src/config/wfNodeDefinitions.js'

let failures = 0
const ok = (cond, msg) => { if (!cond) { console.error('  ✗', msg); failures++ } else { console.log('  ✓', msg) } }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// 1) defaultData parity — these are the EXACT shapes the previous defaultData() returned.
const EXPECTED_DEFAULTS = {
  'trigger.manual': {},
  'trigger.schedule': { cron: '0 8 * * *' },
  'trigger.webhook': {},
  'trigger.channel': { platform: 'slack', channel: '', keyword: '' },
  'agent.run': { prompt: '', agent_id: null, agent_name: '' },
  'action.tool': { tool: '', params_json: '{}' },
  'action.mcp_tool': { agent_id: null, agent_name: '', server_id: null, server_name: '', tool_name: '', params_json: '{}' },
  'action.script': { script_id: null },
  'action.channel': { kind: 'log', message: '', slack_channel: '', url: '' },
  'action.http': { method: 'GET', url: '', json_text: '' },
  'logic.condition': { expression: '' },
  'logic.approval': { message: 'Approve to continue?' },
  'logic.foreach': { items_template: '', do: { type: 'action.channel', data: { kind: 'log', message: 'item {{item}}' } } },
  'logic.delay': { seconds: 5 },
  'action.subworkflow': { graph_id: null, graph_name: '' },
}
console.log('defaultData parity:')
for (const [type, exp] of Object.entries(EXPECTED_DEFAULTS)) {
  ok(eq(wfDefaultData(type), exp), `${type} defaults match`)
}

// 2) deep clone — foreach.do must be a fresh object per node (no shared reference)
console.log('default deep-clone:')
const a = wfDefaultData('logic.foreach'), b = wfDefaultData('logic.foreach')
a.do.data.message = 'mutated'
ok(b.do.data.message === 'item {{item}}', 'foreach defaults are deep-cloned (not shared)')

// 3) palette — 14 items, ordered, excludes the hidden action.mcp_tool
console.log('palette:')
const pal = wfPaletteItems()
ok(pal.length === 14, `palette has 14 items (got ${pal.length})`)
ok(!pal.some(p => p.type === 'action.mcp_tool'), 'palette excludes action.mcp_tool (hidden)')
ok(pal[0].type === 'trigger.manual' && pal[0].icon === '▶', 'palette[0] = manual trigger with icon')

// 4) every registry type is known + has icon/label; schema vs custom split is coherent
console.log('registry integrity:')
ok(WF_TYPES.length === Object.keys(EXPECTED_DEFAULTS).length, 'WF_TYPES count matches expected set')
for (const t of WF_TYPES) {
  const d = wfDef(t)
  ok(!!d && !!d.icon && !!d.label, `${t} has icon + label`)
}

// 5) schema-driven types expose fields; custom types expose none (so the bespoke template renders)
console.log('schema vs custom:')
const SCHEMA_TYPES = ['trigger.manual', 'trigger.schedule', 'trigger.channel', 'action.tool', 'action.script', 'action.channel', 'action.http', 'logic.condition', 'logic.delay', 'logic.approval', 'action.subworkflow']
const CUSTOM_TYPES = ['trigger.webhook', 'agent.run', 'action.mcp_tool', 'logic.foreach']
for (const t of SCHEMA_TYPES) ok(Array.isArray(wfFields(t)) && wfFields(t).length > 0, `${t} has schema fields`)
for (const t of CUSTOM_TYPES) ok(wfFields(t) === null, `${t} is custom (no auto-fields)`)

// 6) schema field keys must be present in (or compatible with) the node's default data keys
console.log('field/default key coherence:')
const KEYLESS_OK = ['approvers', 'inputs']   // optional fields with no entry in defaults
for (const t of SCHEMA_TYPES) {
  const defaults = wfDefaultData(t)
  for (const f of wfFields(t)) {
    if (!f.key) continue                       // 'note' display fields have no data key
    const allowed = f.key in defaults || KEYLESS_OK.includes(f.key)
    ok(allowed, `${t}.${f.key} maps to a known data key`)
  }
}

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exit(failures ? 1 : 0)
