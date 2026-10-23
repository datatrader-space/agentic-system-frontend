import { test, expect } from '@playwright/test'
import { wfPaletteItems } from '../../src/config/wfNodeDefinitions.js'

const clone = value => JSON.parse(JSON.stringify(value))
const baseGraph = {
  id: 86, name: 'Customer intake', status: 'draft', version: 1, etag: 'initial', triggers: [],
  graph: {
    nodes: [
      { id: 'start', type: 'trigger.manual', position: { x: 80, y: 160 }, data: { label: 'Receive request', inputs: [] } },
      { id: 'log', type: 'action.channel', position: { x: 410, y: 160 }, data: { label: 'Record result', kind: 'log', message: 'Received {{trigger.name}}' } },
    ], edges: [{ id: 'start-log', source: 'start', target: 'log' }], viewport: {},
  },
}
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#app,.workflow-test-root{height:100%;margin:0;min-width:0}.workflow-test-root{height:100dvh}</style></head><body><div id="app"></div><script type="module" src="/tests/e2e/workflow-harness.js"></script></body></html>'

async function prepare(page, overrides = {}) {
  const state = { graph: clone(baseGraph), requests: [], failSave: false, failLoad: false, failHistory: false, failVersions: false, running: false, run: null, ...overrides }
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.clear()
    // Never connect this test harness to a workflow worker.
    window.WebSocket = class extends EventTarget { close() {} send() {} }
  })
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (url.origin !== 'http://127.0.0.1:5177') return route.abort()
    if (req.resourceType() === 'document' && path.startsWith('/dashboard/workflow-builder')) return route.fulfill({ contentType: 'text/html', body: html })
    if (!path.startsWith('/api/')) return route.continue()
    const method = req.method(), body = req.postDataJSON()
    state.requests.push({ path, method, body })
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (/\/bundle\/$/.test(path)) return state.failLoad ? json({ error: 'Unavailable' }, 503) : json({ graph: state.graph, agents: [{ id: 1, name: 'Fixture agent' }], all_graphs: [], scripts: [{ id: 2, name: 'Fixture script' }] })
    if (/\/workflow-graphs\/\d+\/$/.test(path) && method === 'GET') return state.failLoad ? json({ error: 'Unavailable' }, 503) : json(state.graph)
    if (/\/workflow-graphs\/\d+\/$/.test(path) && method === 'PUT') {
      if (state.failSave) return json({ error: 'Conflict: reload before saving.' }, 409)
      state.graph = { ...state.graph, ...body, etag: `saved-${state.requests.length}`, version: body.status === 'published' ? state.graph.version + 1 : state.graph.version }
      return json(state.graph)
    }
    if (/\/workflow-graphs\/\d+\/$/.test(path) && method === 'DELETE') return json({ archived: true })
    if (path === '/api/workflow-graphs/' && method === 'POST') return json({ id: 87, ...body })
    if (path.endsWith('/validate/')) return json(state.validation || { ok: true, warnings: [] })
    if (path.endsWith('/run/')) {
      state.run = { id: 501, status: state.running ? 'running' : 'success', dry_run: body.dry_run, node_runs: [], duration_ms: 50 }
      return json({ run_id: 501 })
    }
    if (path === '/api/workflow-graph-runs/501/cancel/') { state.run.status = 'cancelled'; return json({ ok: true }) }
    if (path === '/api/workflow-graph-runs/501/rerun/') { state.run.status = 'success'; return json({ run_id: 501 }) }
    if (path === '/api/workflow-graph-runs/501/') return json(state.run || { id: 501, status: 'success', node_runs: [], duration_ms: 300, created_at: '2026-10-23T06:00:00Z' })
    if (path.endsWith('/runs/')) return state.failHistory ? json({}, 503) : json([{ id: 501, status: 'success', duration_ms: 300, created_at: '2026-10-23T06:00:00Z' }])
    if (path.endsWith('/metrics/')) return json({ success_rate: 1, avg_duration_ms: 300, total_cost: 0, total_runs: 1 })
    if (path.endsWith('/versions/')) return state.failVersions ? json({}, 503) : json([{ id: 1, version: 1, label: 'Initial version', created_at: '2026-10-23T06:00:00Z' }])
    if (path.endsWith('/restore/')) return json({ ...state.graph, graph: clone(baseGraph.graph), etag: 'restored' })
    if (path === '/api/tools/') return json({ tools: [{ name: 'FIXTURE_TOOL', description: 'Synthetic test tool', category: 'utility' }] })
    if (path.includes('/mcp-catalog/')) return json({ enabled: true, servers: [{ id: 7, name: 'Fixture MCP', tools: [{ name: 'fixture_read', description: 'Read synthetic data' }] }] })
    if (path === '/api/video/media/routes/') return json({ routes: [{ route_id: 'image-proven', name: 'Fixture model', ready: true }] })
    if (path === '/api/workflow-graphs/' || path === '/api/agents/' || path === '/api/scripts/') return json([])
    return json({})
  })
  await page.goto('/dashboard/workflow-builder/86', { waitUntil: 'commit' })
  if (!state.failLoad) await expect(page.locator('.name-display')).toHaveText('Customer intake', { timeout: 60000 })
  return { state, errors }
}
const more = async (page, name) => { await page.getByRole('button', { name: 'More workflow actions' }).click(); await page.getByRole('button', { name, exact: true }).click() }
const mutation = (state, end) => state.requests.filter(r => r.method !== 'GET' && r.path.endsWith(end))
const selectNode = async (page, id) => { await page.locator(`.vue-flow__node[data-id="${id}"]`).click(); await expect(page.locator('.ins-node-title')).toBeVisible() }

test('shows the real workflow, accurate lifecycle and compact editor controls', async ({ page }) => {
  const { state, errors } = await prepare(page)
  await expect(page.locator('.vue-flow__node')).toHaveCount(2)
  await expect(page.locator('.wf-status').first()).toHaveText('draft')
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expect(page.locator('.wfb-guide')).toHaveCount(0)
  expect(state.requests.every(r => r.method === 'GET')).toBe(true)
  expect(errors).toEqual([])
})

test('does not replace empty or single-node workflows with a demo', async ({ page }) => {
  const graph = clone(baseGraph); graph.graph.nodes = []; graph.graph.edges = []
  const { state } = await prepare(page, { graph })
  await expect(page.getByText('Build your first workflow', { exact: true })).toBeVisible()
  await expect(page.locator('.vue-flow__node')).toHaveCount(0)
  await page.getByRole('button', { name: 'Manual Trigger', exact: false }).last().click()
  await expect(page.locator('.vue-flow__node')).toHaveCount(1)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect(state.graph.graph.nodes).toHaveLength(1)
  await page.reload(); await expect(page.locator('.vue-flow__node')).toHaveCount(1)
})

test('load failure blocks mutation and offers a working retry', async ({ page }) => {
  const { state } = await prepare(page, { failLoad: true })
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load this workflow' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled()
  expect(state.requests.every(r => r.method === 'GET')).toBe(true)
  state.failLoad = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('.vue-flow__node')).toHaveCount(2)
})

test('rename, save, discard and leave protection preserve the saved graph', async ({ page }) => {
  const { state } = await prepare(page)
  await page.locator('.name-display').click()
  await page.getByRole('textbox', { name: 'Workflow name' }).fill('Updated intake')
  await page.getByRole('textbox', { name: 'Workflow name' }).press('Enter')
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  expect(state.graph.name).toBe('Updated intake')
  await page.locator('.name-display').click(); await page.getByRole('textbox', { name: 'Workflow name' }).fill('Discard me'); await page.getByRole('textbox', { name: 'Workflow name' }).press('Enter')
  await more(page, 'Discard changes')
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(page.locator('.name-display')).toHaveText('Updated intake')
  await selectNode(page, 'start')
  await page.locator('.inspector textarea').first().fill('Unsaved description')
  await page.getByRole('button', { name: 'Back to workflows' }).click()
  await expect(page.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL(/\/86$/)
})

test('a conflicting save blocks Run and Publish', async ({ page }) => {
  const { state } = await prepare(page, { failSave: true })
  await selectNode(page, 'start'); await page.locator('.inspector textarea').first().fill('Changed')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByText('Conflict: reload before saving.')).toBeVisible()
  expect(mutation(state, '/run/')).toHaveLength(0)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  expect(state.requests.filter(r => r.body?.status === 'published')).toHaveLength(0)
})

test('Test, Run and Test up to here send the correct execution modes', async ({ page }) => {
  const { state, errors } = await prepare(page)
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await expect.poll(() => mutation(state, '/run/').length).toBe(1)
  expect(mutation(state, '/run/')[0].body.dry_run).toBe(true)
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect.poll(() => mutation(state, '/run/').length).toBe(2)
  expect(mutation(state, '/run/')[1].body.dry_run).toBe(false)
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible()
  await selectNode(page, 'log')
  await page.getByRole('button', { name: 'Test up to here', exact: false }).click()
  await expect.poll(() => mutation(state, '/run/').length).toBe(3)
  expect(mutation(state, '/run/')[2].body).toMatchObject({ dry_run: true, until_node: 'log' })
  expect(errors).toEqual([])
})

test('manual inputs can be added, passed to a dry run and removed', async ({ page }) => {
  const { state } = await prepare(page)
  await selectNode(page, 'start'); await page.getByRole('button', { name: '+ Add input', exact: true }).click()
  await page.getByPlaceholder('key', { exact: true }).fill('customer')
  await page.getByPlaceholder('default value', { exact: true }).fill('Example')
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Run with inputs' })
  await dialog.getByPlaceholder('customer', { exact: true }).fill('Synthetic customer')
  await dialog.locator('.rf-foot button').last().click()
  await expect.poll(() => mutation(state, '/run/').length).toBe(1)
  expect(mutation(state, '/run/')[0].body).toMatchObject({ dry_run: true, payload: { customer: 'Synthetic customer' } })
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Test up to here', exact: false }).click()
  await expect(dialog).toBeVisible()
  await dialog.locator('.rf-foot button').last().click()
  await expect.poll(() => mutation(state, '/run/').length).toBe(2)
  expect(mutation(state, '/run/')[1].body).toMatchObject({ dry_run: true, until_node: 'start', payload: { customer: 'Example' } })
  await page.getByRole('button', { name: 'Remove input', exact: true }).click()
  await expect(page.getByText('No inputs yet', { exact: true })).toBeVisible()
})

test('Stop requests cancellation and keeps logs available while running', async ({ page }) => {
  const { state } = await prepare(page, { running: true })
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
  await expect(page.locator('.log-console')).toBeVisible()
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await expect.poll(() => mutation(state, '/cancel/').length).toBe(1)
})

test('Publish, Pause and Resume use explicit lifecycle requests', async ({ page }) => {
  const { state } = await prepare(page)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.locator('.wf-status').first()).toHaveText('published')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.locator('.wf-status').first()).toHaveText('paused')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.locator('.wf-status').first()).toHaveText('published')
  expect(state.requests.filter(r => r.body?.status).map(r => r.body.status)).toEqual(['published', 'paused', 'published'])
})

test('history and versions show failures, retry, details and restore', async ({ page }) => {
  const { state } = await prepare(page, { failHistory: true, failVersions: true })
  await page.getByRole('button', { name: 'Runs', exact: true }).click()
  await expect(page.getByText('Could not load run history.')).toBeVisible()
  state.failHistory = false; await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.locator('.run-row').first().click(); await expect(page.locator('.run-detail')).toContainText('Run #501')
  await page.keyboard.press('Escape')
  await more(page, 'Version history')
  await expect(page.getByText('Could not load version history.')).toBeVisible()
  state.failVersions = false; await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Version history' })).toHaveCount(0)
})

test('palette is searchable, nodes are removable, and Escape never deletes from a select', async ({ page }) => {
  await prepare(page)
  await page.getByRole('textbox', { name: 'Filter node library' }).fill('nonsense')
  await expect(page.getByText('No nodes match', { exact: false })).toBeVisible()
  await page.getByRole('textbox', { name: 'Filter node library' }).fill('')
  await page.keyboard.press('Control+k')
  await page.getByRole('searchbox', { name: 'Search nodes', exact: true }).fill('delay')
  await page.locator('.cmd-item').filter({ hasText: 'Delay' }).first().click()
  await expect(page.locator('.vue-flow__node')).toHaveCount(3)
  await page.getByRole('button', { name: 'Delete node', exact: true }).click()
  await expect(page.locator('.vue-flow__node')).toHaveCount(2)
  await selectNode(page, 'log'); await page.locator('.inspector select').first().focus(); await page.keyboard.press('Backspace')
  await expect(page.locator('.vue-flow__node')).toHaveCount(2)
  await page.getByRole('button', { name: 'Workflow help and keyboard shortcuts' }).click()
  await expect(page.getByRole('dialog', { name: 'Workflow help' })).toBeVisible()
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0)
})

for (const node of wfPaletteItems()) {
  test(`node palette config: ${node.type}`, async ({ page }) => {
    const { errors } = await prepare(page)
    await page.getByRole('textbox', { name: 'Filter node library' }).fill(node.label)
    await page.locator('.pal-card').filter({ has: page.getByText(node.label, { exact: true }) }).click()
    await expect(page.locator('.vue-flow__node')).toHaveCount(3)
    await expect(page.locator('.ins-node-title strong')).toHaveText(node.label)
    await expect(page.locator('.inspector')).toBeVisible()
    if (node.type !== 'trigger.webhook') await expect(page.getByRole('button', { name: 'Test up to here', exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Delete node', exact: true }).click()
    await expect(page.locator('.vue-flow__node')).toHaveCount(2)
    expect(errors).toEqual([])
  })
}

test('MCP catalog selection exposes its confirmation action and preserves the chosen identity', async ({ page }) => {
  const { state, errors } = await prepare(page)
  await page.keyboard.press('Control+k')
  await page.getByRole('searchbox', { name: 'Search nodes', exact: true }).fill('fixture_read')
  const group = page.locator('.cmd-grp').filter({ hasText: 'Fixture MCP' })
  if (await group.locator('.cmd-item').count() === 0) await group.locator('.cmd-grp-toggle').click()
  await group.locator('.cmd-item').filter({ hasText: 'fixture_read' }).click()
  const confirmation = page.getByRole('button', { name: 'Add MCP tool node', exact: true })
  await expect(confirmation).toBeVisible(); await expect(confirmation).toBeDisabled()
  await page.locator('.cmd-ctx select').selectOption('1')
  await confirmation.click()
  await expect(page.locator('.vue-flow__node')).toHaveCount(3)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const added = state.graph.graph.nodes.find(node => node.type === 'action.mcp_tool')
  expect(added.data).toMatchObject({ server_id: 7, tool_name: 'fixture_read', agent_id: 1 })
  expect(errors).toEqual([])
})

test('panel toggles, layout reset, zoom and help are usable', async ({ page }) => {
  await prepare(page)
  const library = page.getByRole('complementary', { name: 'Node library' })
  await page.getByRole('button', { name: 'Nodes', exact: true }).click(); await expect(library).toBeHidden()
  await page.getByRole('button', { name: 'Nodes', exact: true }).click(); await expect(library).toBeVisible()
  await page.getByRole('button', { name: 'Inspector', exact: true }).click(); await expect(page.locator('.inspector')).toBeVisible()
  await page.getByRole('button', { name: 'Inspector', exact: true }).click(); await expect(page.locator('.inspector')).toHaveCount(0)
  const before = await page.locator('.vue-flow__transformationpane').getAttribute('style')
  await page.locator('.vue-flow__controls-zoomin').click()
  await expect(page.locator('.vue-flow__transformationpane')).not.toHaveAttribute('style', before)
  await page.locator('.vue-flow__controls-zoomout').click(); await page.locator('.vue-flow__controls-fitview').click()
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click()
  await page.getByRole('button', { name: 'Shortcuts', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Workflow help' }); await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Done', exact: true }).click(); await expect(dialog).toHaveCount(0)
})

test('copy/paste creates independent nodes, and connection labels and deletion persist', async ({ page }) => {
  const { state } = await prepare(page)
  await selectNode(page, 'log'); await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v')
  await expect(page.locator('.vue-flow__node')).toHaveCount(3)
  await page.locator('.vue-flow__edge-path').first().click({ force: true })
  await page.getByPlaceholder('e.g. on success').fill('Accepted')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect(state.graph.graph.edges[0].label).toBe('Accepted')
  await page.locator('[title="Delete connection"]').click()
  await expect(page.locator('.vue-flow__edge')).toHaveCount(0)
})

test('validation highlights errors, log filtering, clear and hide keep the canvas accessible', async ({ page }) => {
  await prepare(page, { validation: { ok: false, errors: [{ node_id: 'log', message: 'Choose a supported destination' }] } })
  await more(page, 'Validate workflow')
  await expect(page.locator('.log-console')).toBeVisible()
  await expect(page.locator('.log-body')).toContainText('Choose a supported destination')
  await expect(page.locator('.vue-flow__node[data-id="log"]')).toContainText('Choose a supported destination')
  await page.getByRole('button', { name: 'Errors only' }).click()
  await page.locator('.log-console').getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(page.getByText('No activity yet', { exact: false })).toBeVisible()
  await page.locator('.log-console').getByRole('button', { name: 'Hide', exact: true }).click()
  await expect(page.locator('.log-console')).toHaveCount(0)
  await page.locator('.log-reopen').click(); await expect(page.locator('.log-console')).toBeVisible()
})

test('duplicate and archive require explicit actions and leave the correct workflow', async ({ page }) => {
  const { state } = await prepare(page)
  await more(page, 'Duplicate workflow')
  await expect(page).toHaveURL(/\/87$/)
  expect(state.requests.find(r => r.method === 'POST' && r.path === '/api/workflow-graphs/').body.name).toBe('Customer intake (copy)')
  await expect(page.locator('.name-display')).toHaveText('Customer intake')
  await more(page, 'Archive workflow')
  const dialog = page.getByRole('alertdialog', { name: 'Archive workflow?' })
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(state.requests.filter(r => r.method === 'DELETE')).toHaveLength(0)
  await more(page, 'Archive workflow')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(page).toHaveURL(/\/workflow-builder$/)
  expect(state.requests.filter(r => r.method === 'DELETE').at(-1).path).toBe('/api/workflow-graphs/87/')
})

test('edits made while saving remain dirty and discard returns to the actual saved snapshot', async ({ page }) => {
  await prepare(page)
  let pending, submitted
  await page.route('**/api/workflow-graphs/86/', async route => {
    if (route.request().method() !== 'PUT') return route.fallback()
    submitted = route.request().postDataJSON()
    await new Promise(resolve => { pending = resolve })
    await route.fulfill({ json: { ...baseGraph, ...submitted, etag: 'saved-during-edit' } })
  })
  await selectNode(page, 'start'); await page.getByRole('button', { name: '+ Add input', exact: true }).click()
  await page.getByPlaceholder('key', { exact: true }).fill('saved-key')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => !!pending).toBe(true)
  await page.getByPlaceholder('key', { exact: true }).fill('later-key')
  pending()
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await more(page, 'Discard changes'); await page.getByRole('alertdialog').getByRole('button', { name: 'Discard', exact: true }).click()
  await selectNode(page, 'start')
  await expect(page.getByPlaceholder('key', { exact: true })).toHaveValue('saved-key')
})

test('editing during publication retains the unsaved indicator', async ({ page }) => {
  await prepare(page)
  let complete
  await page.route('**/api/workflow-graphs/86/', async route => {
    if (route.request().method() !== 'PUT') return route.fallback()
    await new Promise(resolve => { complete = resolve })
    await route.fulfill({ json: { ...baseGraph, status: 'published', version: 2 } })
  })
  await selectNode(page, 'start')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect.poll(() => !!complete).toBe(true)
  await page.getByRole('button', { name: '+ Add input', exact: true }).click()
  complete()
  await expect(page.locator('.wf-status').first()).toHaveText('published')
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
})

test('repeated paste creates independent nested configuration', async ({ page }) => {
  const graph = clone(baseGraph); graph.graph.nodes[0].data.inputs = [{ key: 'original', default: 'one' }]
  const { state } = await prepare(page, { graph })
  await selectNode(page, 'start'); await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v'); await page.keyboard.press('Control+v')
  await expect(page.locator('.vue-flow__node')).toHaveCount(4)
  const copies = page.locator('.vue-flow__node').filter({ hasText: 'Receive request' })
  await copies.last().click()
  await page.getByPlaceholder('key', { exact: true }).fill('changed-copy')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const keys = state.graph.graph.nodes.filter(node => node.type === 'trigger.manual').map(node => node.data.inputs[0].key)
  expect(keys.filter(key => key === 'changed-copy')).toHaveLength(1)
  expect(keys.filter(key => key === 'original')).toHaveLength(2)
})

test('invalid JSON blocks saving and execution without replacing saved parameters', async ({ page }) => {
  const graph = clone(baseGraph)
  graph.graph.nodes[1] = { ...graph.graph.nodes[1], type: 'action.tool', data: { tool: 'FIXTURE_TOOL', params: { query: 'saved' } } }
  const { state } = await prepare(page, { graph })
  await selectNode(page, 'log')
  await page.getByLabel('Params (JSON)', { exact: true }).fill('{ invalid')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.ins-err')).toContainText('Enter valid JSON')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.locator('.ins-err')).toBeVisible()
  expect(state.requests.filter(r => r.method !== 'GET')).toHaveLength(0)
  expect(state.graph.graph.nodes[1].data.params).toEqual({ query: 'saved' })
  await page.getByLabel('Params (JSON)', { exact: true }).fill('{ "query": "updated" }')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => state.graph.graph.nodes[1].data.params.query).toBe('updated')
})

test('clearing an HTTP JSON body removes the saved body', async ({ page }) => {
  const graph = clone(baseGraph)
  graph.graph.nodes[1] = { ...graph.graph.nodes[1], type: 'action.http', data: { method: 'POST', url: 'https://example.invalid', json: { previous: true } } }
  const { state } = await prepare(page, { graph })
  await selectNode(page, 'log')
  await page.getByLabel('JSON body (optional)', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => state.requests.filter(r => r.method === 'PUT').length).toBe(1)
  expect(state.graph.graph.nodes[1].data).not.toHaveProperty('json')
})

test('dragging and quick-add connect real nodes and mark the layout unsaved', async ({ page }) => {
  const { state } = await prepare(page)
  const start = page.locator('.vue-flow__node[data-id="start"]')
  const box = await start.boundingBox()
  await page.mouse.move(box.x + 50, box.y + 20); await page.mouse.down(); await page.mouse.move(box.x + 90, box.y + 100, { steps: 10 }); await page.mouse.up()
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await start.hover(); await start.getByRole('button', { name: 'Add next node' }).click()
  await page.getByRole('searchbox', { name: 'Search nodes', exact: true }).fill('Delay')
  await page.locator('.cmd-item').filter({ hasText: 'Delay' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect(state.graph.graph.nodes).toHaveLength(3); expect(state.graph.graph.edges).toHaveLength(2)
  expect(state.graph.graph.nodes.find(node => node.id === 'start').position.y).not.toBe(160)
  const next = state.graph.graph.nodes.find(node => node.type === 'logic.delay')
  expect(state.graph.graph.edges).toContainEqual(expect.objectContaining({ source: 'start', target: next.id }))
})

test('condition rows, advanced settings and variable insertion persist edited values', async ({ page }) => {
  const { state } = await prepare(page)
  await page.getByRole('textbox', { name: 'Filter node library' }).fill('Condition')
  await page.locator('.pal-card').click()
  await page.getByRole('button', { name: 'Add condition', exact: true }).click()
  const fields = page.locator('.condition-row input')
  await fields.nth(0).fill('score'); await fields.nth(1).fill('80')
  await page.locator('.condition-row select').first().selectOption('>')
  await page.locator('.condition-join').selectOption('OR')
  await page.getByRole('button', { name: 'Remove condition' }).last().click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const condition = state.graph.graph.nodes.find(node => node.type === 'logic.condition')
  expect(condition.data.conditions).toHaveLength(1)
  expect(condition.data.conditions[0]).toMatchObject({ field: 'score', operator: '>', value: '80' })
  await selectNode(page, 'log')
  await page.getByRole('button', { name: 'Advanced', exact: false }).click()
  await page.getByLabel('Retries', { exact: true }).fill('2')
  const insert = page.locator('.inspector').getByRole('button', { name: 'Insert variable', exact: false }).first()
  await insert.click(); await expect(page.getByRole('dialog', { name: 'Insert variable' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect(state.graph.graph.nodes.find(node => node.id === 'log').data.retries).toBe(2)
})

test('dialogs trap focus and return it to their opener, without triggering graph shortcuts', async ({ page }) => {
  await prepare(page)
  const help = page.getByRole('button', { name: 'Workflow help and keyboard shortcuts' })
  await help.click()
  const dialog = page.getByRole('dialog', { name: 'Workflow help' })
  await dialog.getByRole('button', { name: 'Done', exact: true }).focus(); await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close workflow help' })).toBeFocused()
  await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', { name: 'Done', exact: true })).toBeFocused()
  await page.keyboard.press('Control+k'); await expect(page.getByRole('dialog', { name: 'Add a node' })).toHaveCount(0)
  await page.keyboard.press('Escape'); await expect(help).toBeFocused()
})

for (const width of [1440, 1024, 768, 375]) {
  test(`responsive editor at ${width}px keeps actions and dialogs inside the viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const { errors } = await prepare(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const toolbar = await page.locator('.wfb-bar').boundingBox(); expect(toolbar.height).toBeLessThan(width < 641 ? 130 : 75)
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath(`editor-${width}.png`) })
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog', { name: 'Add a node' })).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath(`palette-${width}.png`) })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Workflow help and keyboard shortcuts' }).click()
    await expect(page.getByRole('dialog', { name: 'Workflow help' })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
}
