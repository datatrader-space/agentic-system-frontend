// Smoke: node visual logic (Phase 2B) — config preview + configured-ness + status state.
// Pure-logic checks; the actual border/glow/handle CSS is verified via VISUAL_CHECKLIST below.
// Run: node scripts/wf_node_view_smoke.mjs
import { nodeIsConfigured, nodeStatusState, nodeConfigPreview, nodeAccent } from '../src/utils/wfNodeView.js'

let failures = 0
const ok = (c, m) => { if (!c) { console.error('  ✗', m); failures++ } else { console.log('  ✓', m) } }
const eq = (a, b) => a === b

console.log('configured-ness:')
ok(nodeIsConfigured('trigger.manual', {}) === true, 'manual trigger always configured')
ok(nodeIsConfigured('action.http', {}) === false, 'http unconfigured without url')
ok(nodeIsConfigured('action.http', { url: 'https://x' }) === true, 'http configured with url')
ok(nodeIsConfigured('agent.run', { agent_id: 1 }) === false, 'agent needs prompt too')
ok(nodeIsConfigured('agent.run', { agent_id: 1, prompt: 'go' }) === true, 'agent configured')
ok(nodeIsConfigured('action.mcp_tool', { agent_id: 1, server_id: 2, tool_name: 't' }) === true, 'mcp configured')
ok(nodeIsConfigured('logic.delay', { seconds: 5 }) === true, 'delay configured by default seconds')

console.log('status state (run status > invalid > configured/idle):')
ok(eq(nodeStatusState('action.http', {}), 'idle'), 'idle when unconfigured')
ok(eq(nodeStatusState('action.http', { url: 'https://x' }), 'configured'), 'configured when set, no run')
ok(eq(nodeStatusState('action.http', { url: 'x', __error: 'bad' }), 'invalid'), 'invalid on validation error')
for (const s of ['running', 'success', 'failed', 'skipped', 'waiting', 'pending']) {
  ok(eq(nodeStatusState('action.http', { url: 'x', __status: s }), s), `run status passes through: ${s}`)
}
ok(eq(nodeStatusState('action.http', { __status: 'running' }), 'running'), 'run status wins over unconfigured')

console.log('config preview:')
ok(eq(nodeConfigPreview('trigger.schedule', { cron: '0 8 * * *' }), 'cron 0 8 * * *'), 'schedule cron')
ok(eq(nodeConfigPreview('action.http', { method: 'POST', url: 'https://api.x.com/v1/send?z=1' }), 'POST api.x.com/v1/send'), 'http method + host/path (no query)')
ok(eq(nodeConfigPreview('action.http', { url: '{{nodes.a.output.url}}' }), 'GET {{nodes.a.output.url}}'), 'http templated url falls back to raw')
ok(eq(nodeConfigPreview('action.tool', { tool: 'GITHUB_X' }), 'GITHUB_X'), 'tool name')
ok(eq(nodeConfigPreview('action.mcp_tool', { server_name: 'notion', tool_name: 'search' }), 'notion.search'), 'mcp server.tool')
ok(eq(nodeConfigPreview('logic.delay', { seconds: 30 }), 'wait 30s'), 'delay duration')
ok(eq(nodeConfigPreview('logic.condition', { expression: '{{x}} == 1' }), '{{x}} == 1'), 'condition expr')
ok(eq(nodeConfigPreview('logic.foreach', { items_template: '{{trigger.items}}' }), '{{trigger.items}}'), 'foreach source')
ok(eq(nodeConfigPreview('action.subworkflow', { graph_name: 'Sub A' }), 'Sub A'), 'subworkflow graph')
ok(eq(nodeConfigPreview('trigger.channel', { platform: 'slack', channel: '#ops' }), 'slack · #ops'), 'channel summary')
ok(eq(nodeConfigPreview('logic.delay', {}), ''), 'empty preview when no config')

console.log('category accent:')
ok(eq(nodeAccent('trigger.manual'), '#0d9488'), 'trigger accent')
ok(eq(nodeAccent('agent.run'), '#4f46e5'), 'agent accent')
ok(eq(nodeAccent('action.http'), '#7c3aed'), 'action accent')
ok(eq(nodeAccent('logic.delay'), '#64748b'), 'logic accent')

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exit(failures ? 1 : 0)
