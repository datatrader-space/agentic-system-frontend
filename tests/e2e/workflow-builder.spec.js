// The Workflow Builder in a real browser (ADM-1333). The harness mounts the production builder INSIDE the production
// AppShell, with synthetic API answers only (no user session, no worker, no outside network).
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { resolve } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

const SHOTS = process.env.WF_SHOT_DIR || ''
const AXE_OUT = process.env.WF_AXE_OUT || ''
const clone = (v) => JSON.parse(JSON.stringify(v))
// The server's step registry (ADM-1351, D4): the committed fixture of GET /api/workflow-graphs/step-types/.
const stepTypes = JSON.parse(readFileSync(resolve('src/config/__fixtures__/wfStepTypes.json'), 'utf8'))
// A 4 x 2 grey PNG: what an image's viewer link answers with (same origin; the harness never reaches outside).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGOYsngHHDEgcwDIEg95KuyVFwAAAABJRU5ErkJggg==', 'base64')
const baseGraph = {
  id: 86, public_id: 'wf_86', name: 'Customer intake', status: 'draft', version: 1, etag: 'initial', triggers: [], last_run: null,
  my_role: 'owner', owner: { id: 1, email: 'olga@example.test', name: 'Olga Owner' },
  graph: {
    nodes: [
      { id: 'start', type: 'trigger.manual', position: { x: 80, y: 160 }, data: { label: 'Receive request', inputs: [] } },
      { id: 'log', type: 'action.channel', position: { x: 410, y: 160 }, data: { label: 'Record result', kind: 'log', message: 'Received {{trigger.name}}' } },
    ],
    edges: [{ id: 'e_start_log', source: 'start', target: 'log' }],
    viewport: {},
  },
}
const html = '<!doctype html><html lang="en"><head><title>Workflow builder test</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#app,.workflow-test-root{height:100%;margin:0;min-width:0}</style></head><body><div id="app"></div><script type="module" src="/tests/e2e/workflow-harness.js"></script></body></html>'
const runPage = (n, start = 0) => Array.from({ length: n }, (_, i) => ({ id: 600 - start - i, status: i % 3 ? 'success' : 'failed', dry_run: i % 2 === 0, duration_ms: 1200, created_at: '2026-11-19T06:00:00Z' }))

// A cold dev server optimises its dependencies on the first page load and then reloads it, which can take longer
// than one test's time. One warm-up load first, with its own time.
test.beforeAll(async ({ browser }, testInfo) => {
  testInfo.setTimeout(300000)
  const page = await browser.newPage()
  await page.route('**/*', (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.origin !== 'http://127.0.0.1:5177') return route.abort()
    if (req.resourceType() === 'document') return route.fulfill({ contentType: 'text/html', body: html })
    if (url.pathname.startsWith('/api/')) {
      const body = url.pathname.endsWith('/bundle/') ? { graph: baseGraph, agents: [], all_graphs: [], scripts: [] } : url.pathname.endsWith('/step-types/') ? stepTypes : {}
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
    }
    return route.continue()
  })
  await page.goto('http://127.0.0.1:5177/dashboard/workflow-builder/86', { waitUntil: 'commit' })
  await page.locator('.wfb-name').waitFor({ timeout: 280000 })
  await page.close()
})

async function prepare(page, overrides = {}) {
  const state = {
    graph: clone(baseGraph), requests: [], failSave: false, failLoad: false, running: false, run: null,
    shares: [{ user_id: 7, email: 'ann@example.test', name: 'Ann Approver', role: 'viewer', added_by: 1, created_at: '2026-11-20T09:00:00Z' }],
    validation: { ok: true, warnings: [] }, ...overrides,
  }
  const errors = []
  const failSteps = !!state.failSteps   // counted down by the route as the reads fail
  page.on('pageerror', (e) => errors.push(e.message))
  if (process.env.WF_DEBUG) page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[browser ${m.type()}]`, m.text().slice(0, 400)) })
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:5177' })
  await page.addInitScript((theme) => {
    // A fresh browser for each test, kept across a reload within the test (remembered choices are tested).
    if (!sessionStorage.getItem('wf-e2e')) {
      localStorage.clear()
      localStorage.setItem('app-theme', theme)              // the app's own theme setting (useTheme)
      sessionStorage.setItem('wf-e2e', '1')
    }
    window.WebSocket = class extends EventTarget { close() {} send() {} }   // never a real socket
  }, state.theme || 'light')
  await page.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    if (url.origin !== 'http://127.0.0.1:5177') return route.abort()
    if (req.resourceType() === 'document' && path.startsWith('/dashboard')) return route.fulfill({ contentType: 'text/html', body: html })
    if (path.startsWith('/e2e-image/')) { state.imageLoads = (state.imageLoads || 0) + 1; return route.fulfill({ contentType: 'image/png', body: PNG }) }
    if (!path.startsWith('/api/')) return route.continue()
    const method = req.method()
    let body = null
    try { body = req.postDataJSON() } catch { body = null }
    state.requests.push({ path, method, body, query: Object.fromEntries(url.searchParams) })
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    // Vision workflows (ADM-1351): the step registry, the models, an uploaded photo and an image's 15-minute link.
    if (path === '/api/workflow-graphs/step-types/') {
      if (state.failSteps) { state.failSteps -= 1; return json({ error: 'The step list is not available right now.' }, 503) }
      return json(stepTypes)
    }
    if (/\/workflow-graphs\/\d+\/vision-models\/$/.test(path)) return json({ models: [{ value: 'sam3', label: 'SAM 3', kind: 'ready' }] })
    if (/\/workflow-graphs\/\d+\/images\/$/.test(path) && method === 'POST') {
      const type = req.headers()['content-type'] || ''
      if (!type.startsWith('multipart/form-data')) return json({ error: 'Send the photo as a file.', code: 'not_multipart' }, 400)
      state.uploads = (state.uploads || 0) + 1
      return json({ image: { kind: 'image', id: `img-${state.uploads}`, width: 2, height: 2 } }, 201)
    }
    if (/\/workflow-graphs\/images\/[^/]+\/$/.test(path)) return json({ url: `/e2e-image/${path.split('/')[4]}.png`, expires_in: 900 })
    if (path.endsWith('/last-run/')) return json(state.lastRun || {})
    if (/\/workflow-graphs\/\d+\/bundle\/$/.test(path)) {
      return state.failLoad ? json({ error: 'Unavailable' }, 503) : json({ graph: state.graph, agents: [{ id: 1, name: 'Fixture agent' }], all_graphs: [], scripts: [] })
    }
    if (/\/workflow-graphs\/\d+\/$/.test(path) && method === 'PUT') {
      if (state.failSave) return json({ error: 'Conflict: reload before saving.' }, 409)
      state.graph = { ...state.graph, ...body, etag: `saved-${state.requests.length}`, version: body.status === 'published' ? state.graph.version + 1 : state.graph.version }
      return json(state.graph)
    }
    if (/\/workflow-graphs\/\d+\/$/.test(path) && method === 'DELETE') return json({ archived: true })
    if (path === '/api/workflow-graphs/' && method === 'POST') return json({ id: 87, ...body })
    if (path.endsWith('/validate/')) return json(state.validation)
    if (path.endsWith('/run/')) {
      if (state.forbidRun) return json({ error: 'Your role on this workflow no longer allows running it.', code: 'forbidden_role', required: 'run' }, 403)
      state.run = { id: 501, status: state.running ? 'running' : 'success', dry_run: body.dry_run, node_runs: [], duration_ms: 50 }
      return json({ run_id: 501, status: state.run.status })
    }
    if (path === '/api/workflow-graph-runs/501/cancel/') { state.run.status = 'cancelled'; return json({ ok: true }) }
    if (path === '/api/workflow-graph-runs/501/') return json(state.run || { id: 501, status: 'success', node_runs: [] })
    if (/\/workflow-graph-runs\/\d+\/$/.test(path)) {
      const id = Number(path.split('/')[3])
      return json(state.runDetails?.[id] || { id, status: 'failed', node_runs: [{ node_id: 'log', status: 'failed', error: 'Channel refused', attempt: 1 }] })
    }
    if (/\/workflow-graphs\/\d+\/runs\/$/.test(path)) {
      const cursor = url.searchParams.get('cursor')
      return cursor ? json({ results: runPage(2, 50), next_cursor: null, prev_cursor: 'c0', has_more: false, limit: 50 })
        : json({ results: runPage(50), next_cursor: 'c1', prev_cursor: null, has_more: true, limit: 50 })
    }
    if (path.endsWith('/metrics/')) return json({ success_rate: 0.5, avg_duration_ms: 1200, total_cost: 0.0123, total_runs: 52 })
    if (path.endsWith('/versions/')) return json({ results: [{ id: 1, version: 1, label: 'First', created_at: '2026-11-19T06:00:00Z' }], next_cursor: null, has_more: false, limit: 50 })
    if (path.endsWith('/restore/')) return json({ ...state.graph, graph: clone(baseGraph.graph), etag: 'restored' })
    // Sharing (ADM-1339): the owner manages shares; the people list feeds the approvers picker.
    if (/\/workflow-graphs\/\d+\/shares\/$/.test(path) && method === 'GET') return json({ owner: state.graph.owner, results: state.shares })
    if (/\/workflow-graphs\/\d+\/shares\/$/.test(path) && method === 'POST') {
      if (!String(body.email).endsWith('@example.test')) return json({ error: `${body.email} is not a member of this workflow's workspace.`, code: 'not_workspace_member' }, 400)
      const row = { user_id: 100 + state.shares.length, email: body.email, name: '', role: body.role, added_by: 1, created_at: '2026-11-20T10:00:00Z' }
      state.shares = [...state.shares, row]
      return json(row, 201)
    }
    if (/\/workflow-graphs\/\d+\/shares\/\d+\/$/.test(path)) {
      const uid = Number(path.split('/')[5])
      if (method === 'DELETE') { state.shares = state.shares.filter((r) => r.user_id !== uid); return route.fulfill({ status: 204 }) }
      state.shares = state.shares.map((r) => (r.user_id === uid ? { ...r, role: body.role } : r))
      return json(state.shares.find((r) => r.user_id === uid))
    }
    if (/\/workflow-graphs\/\d+\/people\/$/.test(path)) {
      return json({ results: [{ user_id: 1, email: state.graph.owner.email, name: state.graph.owner.name, role: 'owner' }, ...state.shares.map(({ user_id, email, name, role }) => ({ user_id, email, name, role }))] })
    }
    if (path === '/api/tools/') return json({ tools: [{ name: 'FIXTURE_TOOL', description: 'Synthetic test tool', category: 'utility' }], total_count: 1 })
    if (path.includes('mcp-catalog')) return json({ enabled: true, servers: [{ id: 7, name: 'Fixture MCP', tools: [{ name: 'fixture_read', description: 'Read synthetic data' }] }] })
    return json({})
  })
  await page.goto(state.path || '/dashboard/workflow-builder/86', { waitUntil: 'commit' })
  if (!state.failLoad) await expect(page.locator('.wfb-name')).toContainText('Customer intake', { timeout: 60000 })
  if (!failSteps) await page.waitForFunction(() => document.querySelectorAll('.vue-flow__node').length >= 0 && !!document.querySelector('.vue-flow'))
  return { state, errors }
}
const node = (page, id) => page.locator(`.vue-flow__node[data-id="${id}"]`)
const mutations = (state, end) => state.requests.filter((r) => r.method !== 'GET' && r.path.endsWith(end))
const menu = async (page, name) => {
  await page.getByRole('button', { name: 'More workflow actions' }).click()
  await page.getByRole('menuitem', { name, exact: false }).click()
}
const picker = (page) => page.getByRole('dialog', { name: /Add a step|Add a connected step|Insert a step/ })
// Choose a step in the picker. The new step's window opens next (lane FE-4's WfNodeModal); it is closed again here.
async function choose(page, text) {
  const dlg = picker(page)
  await expect(dlg).toBeVisible()
  await dlg.getByRole('combobox').fill(text)
  await dlg.getByRole('option', { name: new RegExp(text, 'i') }).first().click()
  await expect(dlg).toHaveCount(0)
  await closeLayers(page)
}
async function closeLayers(page) {
  const layers = page.locator('[role="dialog"], [role="alertdialog"]')
  for (let i = 0; i < 4 && await layers.count(); i++) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
  }
  await expect(layers).toHaveCount(0)
}
const pageScrolls = (page) => page.evaluate(() => {
  const main = document.querySelector('.center-main')
  return { x: document.documentElement.scrollWidth > innerWidth, y: document.documentElement.scrollHeight > innerHeight, main: main ? main.scrollHeight > main.clientHeight + 1 : true }
})
// Every button on the page has an accessible name (a stand-in while axe is not installed; see the lane report).
const unnamedButtons = (page) => page.evaluate(() => [...document.querySelectorAll('.wfb-root button, .wfb-layer button')]
  .filter((b) => b.offsetParent !== null && !(b.getAttribute('aria-label') || b.textContent.trim() || b.getAttribute('aria-labelledby')))
  .map((b) => b.outerHTML.slice(0, 120)))

test('fills the shell: no breadcrumbs, no help button, sidebar collapsed, no page scroll (F1)', async ({ page }) => {
  const { errors } = await prepare(page)
  await expect(page.locator('.vue-flow__node')).toHaveCount(2)
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toHaveCount(0)
  await expect(page.locator('.gha-fab')).toHaveCount(0)
  expect(await pageScrolls(page)).toEqual({ x: false, y: false, main: false })
  const sidebar = await page.locator('.sidebar-desktop').boundingBox()
  expect(sidebar.width).toBeLessThan(120)
  await expect(page.locator('.wfb-pill')).toHaveText('Draft')
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  expect(await unnamedButtons(page)).toEqual([])
  // Leaving gives the shell back: breadcrumbs and the person's own (expanded) sidebar.
  await page.getByRole('button', { name: 'Back to workflows' }).click()
  await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible()
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toHaveCount(1)
  expect((await page.locator('.sidebar-desktop').boundingBox()).width).toBeGreaterThan(120)
  expect(errors).toEqual([])
})

test('the picker adds a step by mouse, from the toolbar', async ({ page }) => {
  const { state } = await prepare(page)
  await page.getByRole('button', { name: 'Add a step', exact: true }).click()
  await choose(page, 'Delay')
  await expect(page.locator('.vue-flow__node')).toHaveCount(3)
  await expect(page.getByRole('button', { name: /Unsaved changes/ })).toBeVisible()
  await page.keyboard.press('Control+s')
  await expect.poll(() => mutations(state, '/86/').length).toBe(1)
  expect(state.graph.graph.nodes.map((n) => n.type)).toContain('logic.delay')
  expect(state.graph.graph.nodes.every((n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n.id))).toBe(true)
})

test('the picker opens from the keyboard, and Ctrl+K never opens the shell palette too', async ({ page }) => {
  await prepare(page)
  await page.locator('.vue-flow__pane').click({ position: { x: 600, y: 500 } })
  await page.keyboard.press('n')
  await expect(picker(page)).toBeVisible()
  await page.keyboard.type('delay')
  await page.keyboard.press('Enter')
  await expect(picker(page)).toHaveCount(0)
  await expect(page.locator('.vue-flow__node')).toHaveCount(3)
  // The new step's window opens; Escape closes it (twice when the focus is in one of its fields).
  await closeLayers(page)
  await page.keyboard.press('Control+k')
  await expect(picker(page)).toBeVisible()
  await expect(page.locator('.cmdk-overlay')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(picker(page)).toHaveCount(0)
})

test('an output + adds a connected step, keeping the handle', async ({ page }) => {
  const graph = clone(baseGraph)
  graph.graph.nodes.push({ id: 'check', type: 'logic.condition', position: { x: 410, y: 400 }, data: { label: 'Check', expression: '1 == 1' } })
  const { state } = await prepare(page, { graph })
  await node(page, 'check').hover()
  await page.getByRole('button', { name: 'Add a step on the false branch of Check' }).click()
  await expect(page.getByRole('dialog', { name: 'Add a connected step' })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Triggers' })).toHaveCount(0)
  await choose(page, 'Delay')
  await page.keyboard.press('Control+s')
  await expect.poll(() => mutations(state, '/86/').length).toBe(1)
  const added = state.graph.graph.nodes.find((n) => n.type === 'logic.delay')
  expect(state.graph.graph.edges).toContainEqual(expect.objectContaining({ source: 'check', target: added.id, sourceHandle: 'false' }))
})

test('the + on a connection inserts a step between its ends', async ({ page }) => {
  const { state } = await prepare(page)
  const edge = page.locator('.vue-flow__edge[data-id="e_start_log"] .wf-edge-hit')
  await edge.hover({ force: true })
  await page.getByRole('button', { name: 'Insert a step between Receive request and Record result' }).click()
  await expect(page.getByRole('dialog', { name: 'Insert a step' })).toBeVisible()
  await choose(page, 'Delay')
  await page.keyboard.press('Control+s')
  await expect.poll(() => mutations(state, '/86/').length).toBe(1)
  const id = state.graph.graph.nodes.find((n) => n.type === 'logic.delay').id
  const pairs = state.graph.graph.edges.map((e) => `${e.source}>${e.target}`)
  expect(pairs).toEqual(expect.arrayContaining([`start>${id}`, `${id}>log`]))
  expect(pairs).not.toContain('start>log')
})

test('undo and redo, from the keyboard and the toolbar', async ({ page }) => {
  await prepare(page)
  await page.getByRole('button', { name: 'Add a step', exact: true }).click()
  await choose(page, 'Delay')
  await expect(page.locator('.vue-flow__node')).toHaveCount(3)
  await page.locator('.vue-flow__pane').click({ position: { x: 700, y: 520 } })
  await page.keyboard.press('Control+z')
  await expect(page.locator('.vue-flow__node')).toHaveCount(2)
  await page.keyboard.press('Control+Shift+Z')
  await expect(page.locator('.vue-flow__node')).toHaveCount(3)
  await page.getByRole('button', { name: /^Undo/ }).click()
  await expect(page.locator('.vue-flow__node')).toHaveCount(2)
  await page.getByRole('button', { name: /^Redo/ }).click()
  await expect(page.locator('.vue-flow__node')).toHaveCount(3)
})

test('Delete removes every selected item after one question, and undo brings them back', async ({ page }) => {
  const { state } = await prepare(page)
  await page.locator('.vue-flow__pane').click({ position: { x: 700, y: 520 } })
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  const ask = page.getByRole('alertdialog', { name: 'Delete 2 steps and 1 connection?' })
  await expect(ask).toBeVisible()
  await ask.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.locator('.vue-flow__node')).toHaveCount(0)
  await expect(page.locator('.vue-flow__edge')).toHaveCount(0)
  await expect(page.getByText('Build your first workflow')).toBeVisible()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(page.locator('.vue-flow__node')).toHaveCount(2)
  await expect(page.locator('.vue-flow__edge')).toHaveCount(1)
  expect(state.requests.filter((r) => r.method !== 'GET')).toHaveLength(0)
})

test('a large graph draws only what is on screen, yet Select all reaches every step (F18)', async ({ page }) => {
  const graph = clone(baseGraph)
  graph.graph.nodes = Array.from({ length: 200 }, (_, i) => ({ id: `s${i}`, type: 'logic.delay', position: { x: (i % 20) * 260, y: Math.floor(i / 20) * 120 }, data: { seconds: 1 } }))
  graph.graph.edges = []
  graph.graph.viewport = { x: 0, y: 0, zoom: 1 }
  await prepare(page, { graph })
  await page.locator('.vue-flow__pane').click({ position: { x: 700, y: 520 } })
  await page.keyboard.press('0')
  await expect.poll(() => page.locator('.vue-flow__node').count()).toBeLessThan(200)
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  await expect(page.getByRole('alertdialog', { name: 'Delete 200 steps?' })).toBeVisible()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
})

test('Escape in a field only leaves the field; the next Escape closes the dialog', async ({ page }) => {
  await prepare(page)
  await node(page, 'log').click()
  await page.keyboard.press('F2')
  const dlg = page.getByRole('dialog', { name: 'Rename step' })
  await expect(dlg).toBeVisible()
  const input = dlg.getByRole('textbox', { name: 'Name' })
  await input.fill('Write the log')
  await input.press('Escape')
  await expect(dlg).toBeVisible()
  await expect(input).not.toBeFocused()
  await expect(input).toHaveValue('Write the log')
  await page.keyboard.press('Escape')
  await expect(dlg).toHaveCount(0)
  await expect(node(page, 'log')).toContainText('Record result')
  // Rename for real, then undo it.
  await node(page, 'log').click()
  await page.keyboard.press('F2')
  await page.getByRole('dialog', { name: 'Rename step' }).getByRole('textbox').fill('Write the log')
  await page.keyboard.press('Enter')
  await expect(node(page, 'log')).toContainText('Write the log')
  await page.keyboard.press('Control+z')
  await expect(node(page, 'log')).toContainText('Record result')
})

test('double-click and Enter open the step window', async ({ page }) => {
  await prepare(page)
  await node(page, 'log').dblclick()
  await expect(page.getByRole('dialog')).toBeVisible()
  await closeLayers(page)
  await node(page, 'start').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await closeLayers(page)
  // The arrow keys go to the neighbouring step.
  await node(page, 'start').focus()
  await page.keyboard.press('ArrowRight')
  await expect(node(page, 'log')).toBeFocused()
})

test('a step turns off and on (ADM-1343): toolbar and D, Undo, the saved graph, the step window and the server message', async ({ page }) => {
  const offMsg = "Step 'Record result' reads the output of 'Receive request', which is turned off. Turn 'Receive request' on, or change 'Record result'."
  const { state, errors } = await prepare(page, { validation: { ok: false, errors: [{ node_id: 'log', path: 'data', code: 'node.disabled_output_referenced', message: offMsg }], warnings: [] } })
  const card = node(page, 'log').locator('.wf-node')
  await node(page, 'log').hover()
  await page.getByRole('button', { name: 'Turn step off: Record result' }).click()
  await expect(card).toHaveClass(/is-off/)
  await expect(card.locator('.wf-node__off')).toHaveText('Off')
  await expect(node(page, 'log')).toHaveAttribute('aria-label', /turned off$/)
  if (SHOTS) await page.screenshot({ path: resolve(SHOTS, 'step-off.png') })
  await page.keyboard.press('Control+z')
  await expect(card).not.toHaveClass(/is-off/)
  // D on the focused step turns it off and on again.
  await node(page, 'log').focus()
  await page.keyboard.press('d')
  await expect(card).toHaveClass(/is-off/)
  await page.keyboard.press('d')
  await expect(card).not.toHaveClass(/is-off/)
  await page.keyboard.press('d')
  await expect(card).toHaveClass(/is-off/)
  // A trigger cannot be off: D does nothing on it, and its toolbar has no such button.
  await node(page, 'start').focus()
  await page.keyboard.press('d')
  await expect(node(page, 'start').locator('.wf-node')).not.toHaveClass(/is-off/)
  await node(page, 'start').hover()
  await expect(page.getByRole('button', { name: /^Turn step/ })).toHaveCount(0)
  // The step window says it is off and turns it on.
  await node(page, 'log').dblclick()
  const win = page.getByRole('dialog')
  await expect(win).toContainText('This step is turned off.')
  await win.getByRole('button', { name: 'Turn step on' }).click()
  await expect(win).not.toContainText('This step is turned off.')
  await win.getByRole('button', { name: 'Turn step off' }).click()
  await closeLayers(page)
  // Saved as `data.disabled: true` on the step.
  await page.keyboard.press('Control+s')
  await expect.poll(() => mutations(state, '/86/').length).toBeGreaterThan(0)
  const saved = mutations(state, '/86/').at(-1).body.graph.nodes.find((n) => n.id === 'log')
  expect(saved.data.disabled).toBe(true)
  expect(mutations(state, '/86/').at(-1).body.graph.nodes.find((n) => n.id === 'start').data.disabled).toBeUndefined()
  // The server's validation message is shown as every other one is.
  await menu(page, 'Validate')
  const dlg = page.getByRole('dialog', { name: 'Validate' })
  await expect(dlg).toContainText(`log: ${offMsg}`)
  await dlg.getByRole('button', { name: 'Close' }).first().click()
  await expect(card).toHaveClass(/is-invalid/)
  expect(errors).toEqual([])
})

test('a run waiting on a sub-workflow links to it and asks for no approval', async ({ page }) => {
  const graph = clone(baseGraph)
  graph.last_run = { id: 900, status: 'waiting' }
  graph.graph.nodes.push({ id: 'child', type: 'action.subworkflow', position: { x: 740, y: 160 }, data: { label: 'Run billing', graph_id: 12, graph_name: 'Billing' } })
  graph.graph.edges.push({ id: 'e_log_child', source: 'log', target: 'child' })
  const runDetails = { 900: { id: 900, status: 'waiting', node_runs: [
    { node_id: 'start', status: 'succeeded', attempt: 1 }, { node_id: 'log', status: 'succeeded', attempt: 1 },
    { node_id: 'child', status: 'waiting', attempt: 1, output: { awaiting_subworkflow: true, sub_run_id: 77 } },
  ] } }
  await prepare(page, { graph, runDetails })
  await expect(page.getByText('Waiting for sub-workflow run #77')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open run #77' })).toHaveAttribute('href', '/dashboard/workflow-runs?run=77')
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  await expect(node(page, 'child').locator('.wf-node')).toHaveClass(/is-waiting/)
})

test('copy and paste go through the system clipboard; pasted steps get fresh ids', async ({ page }) => {
  const { state } = await prepare(page)
  await node(page, 'log').click()
  await page.keyboard.press('Control+C')                     // upper case too (F13)
  await page.keyboard.press('Control+V')
  await expect(page.locator('.vue-flow__node')).toHaveCount(3)
  await page.keyboard.press('Control+v')
  await expect(page.locator('.vue-flow__node')).toHaveCount(4)
  await page.keyboard.press('Control+s')
  await expect.poll(() => mutations(state, '/86/').length).toBe(1)
  const ids = state.graph.graph.nodes.map((n) => n.id)
  expect(new Set(ids).size).toBe(4)
})

test('Test, Run and Test up to here send the right modes; Stop cancels the live run', async ({ page }) => {
  const { state } = await prepare(page)
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await expect.poll(() => mutations(state, '/run/').length).toBe(1)
  expect(mutations(state, '/run/')[0].body).toMatchObject({ dry_run: true, until_node: null })
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled()
  await page.keyboard.press('Control+Enter')
  await expect.poll(() => mutations(state, '/run/').length).toBe(2)
  expect(mutations(state, '/run/')[1].body.dry_run).toBe(false)
  await node(page, 'log').hover()
  await page.getByRole('button', { name: 'Test up to Record result' }).click()
  await expect.poll(() => mutations(state, '/run/').length).toBe(3)
  expect(mutations(state, '/run/')[2].body).toMatchObject({ dry_run: true, until_node: 'log' })
  state.running = true
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await expect.poll(() => mutations(state, '/cancel/').length).toBe(1)
})

test('Publish, Pause and Resume', async ({ page }) => {
  const { state } = await prepare(page)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.locator('.wfb-pill')).toHaveText('Published v2')
  await menu(page, 'Pause triggers')
  await expect(page.locator('.wfb-pill')).toHaveText('Paused')
  await menu(page, 'Resume triggers')
  expect(state.requests.filter((r) => r.body?.status).map((r) => r.body.status)).toEqual(['published', 'paused', 'published'])
})

test('Validate shows the reason and the JSON, never hides them (F12)', async ({ page }) => {
  await prepare(page, { validation: { ok: false, errors: [{ node_id: 'log', message: 'Choose a supported destination' }], warnings: [] } })
  await menu(page, 'Validate')
  const dlg = page.getByRole('dialog', { name: 'Validate' })
  await expect(dlg).toContainText('log: Choose a supported destination')
  await dlg.getByText("The server's answer (JSON)").click()
  await expect(dlg.locator('pre').first()).toContainText('"Choose a supported destination"')
  await dlg.getByRole('button', { name: 'Close' }).first().click()
  await expect(node(page, 'log').locator('.wf-node')).toHaveClass(/is-invalid/)
})

test('a validation request that fails shows the server reason', async ({ page }) => {
  await prepare(page)
  await page.route('**/api/workflow-graphs/86/validate/', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'The validator is not available.' }) }))
  await menu(page, 'Validate')
  const dlg = page.getByRole('dialog', { name: 'Validate' })
  await expect(dlg.getByRole('alert')).toContainText('The validator is not available.')
  await dlg.getByText('The workflow that was checked (JSON)').click()
  await expect(dlg.locator('pre').last()).toContainText('"e_start_log"')
})

test('the console: L toggles it, Runs pages by cursor, a run opens in the Timeline', async ({ page }) => {
  const { state } = await prepare(page)
  await page.locator('.vue-flow__pane').click({ position: { x: 700, y: 520 } })
  await page.keyboard.press('l')
  await expect(page.getByRole('tablist', { name: 'Console views' })).toBeVisible()
  await page.getByRole('tab', { name: 'Runs' }).click()
  await expect(page.locator('.wfb-run-row')).toHaveCount(50)
  await page.getByRole('button', { name: 'Load more runs' }).click()
  await expect(page.locator('.wfb-run-row')).toHaveCount(52)
  const runs = state.requests.filter((r) => r.path.endsWith('/runs/'))
  expect(runs.map((r) => r.query)).toEqual([{ limit: '50' }, { limit: '50', cursor: 'c1' }])
  await page.locator('.wfb-run-row').nth(1).click()
  await expect(page.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.wfb-tl-row')).toContainText('Channel refused')
  await expect(node(page, 'log').locator('.wf-node')).toHaveClass(/is-failed/)
  await page.getByRole('button', { name: 'Back to the live view' }).click()
  await expect(node(page, 'log').locator('.wf-node')).not.toHaveClass(/is-failed/)
  await page.keyboard.press('l')
  await expect(page.getByRole('tablist', { name: 'Console views' })).toHaveCount(0)
})

test('the outline lists every step and moves with the arrow keys', async ({ page }) => {
  await prepare(page)
  await menu(page, 'Outline')
  const sheet = page.getByRole('dialog', { name: 'Outline' })
  const items = sheet.locator('.wfb-outline__open')
  await expect(items).toHaveCount(2)
  await expect(items.first()).toContainText('Receive request')
  await expect(items.first()).toContainText('leads to Record result')
  await items.first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(items.nth(1)).toBeFocused()
})

test('archive asks first; duplicate opens the copy', async ({ page }) => {
  const { state } = await prepare(page)
  await menu(page, 'Duplicate workflow')
  await expect(page).toHaveURL(/\/87$/)
  expect(state.requests.find((r) => r.method === 'POST' && r.path === '/api/workflow-graphs/').body.name).toBe('Customer intake (copy)')
  await expect(page.locator('.wfb-name')).toContainText('Customer intake')
  await menu(page, 'Archive workflow')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
  expect(state.requests.filter((r) => r.method === 'DELETE')).toHaveLength(0)
  await menu(page, 'Archive workflow')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(page).toHaveURL(/\/workflow-builder$/)
})

test('a failed load says so and retries', async ({ page }) => {
  const { state } = await prepare(page, { failLoad: true })
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load this workflow' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled()
  state.failLoad = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.vue-flow__node')).toHaveCount(2)
})

test('a step list that cannot be read says so and retries; nothing is drawn from a bundled copy (ADM-1351)', async ({ page }) => {
  const { state, errors } = await prepare(page, { failSteps: 1 })
  await expect(page.getByRole('alert').filter({ hasText: 'The step list is not available right now.' })).toBeVisible()
  await expect(page.locator('.vue-flow')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.vue-flow__node')).toHaveCount(2)
  expect(state.requests.filter((r) => r.path === '/api/workflow-graphs/step-types/')).toHaveLength(2)
  expect(errors).toEqual([])
})

test('a photo input: Run asks for a photo, uploads it and runs with its reference; the step shows the boxes (ADM-1351)', async ({ page }) => {
  const graph = clone(baseGraph)
  graph.graph.nodes = [
    { id: 'start', type: 'trigger.manual', position: { x: 80, y: 160 }, data: { label: 'Photo in', inputs: [{ key: 'note', type: 'text', default: 'shelf 4' }, { key: 'photo', type: 'image' }] } },
    { id: 'find', type: 'vision.model', position: { x: 410, y: 160 }, data: { image: '{{trigger.photo}}', model: 'sam3', classes: 'cat, dog', threshold: null } },
  ]
  graph.graph.edges = [{ id: 'e_start_find', source: 'start', target: 'find' }]
  const detections = { kind: 'detections', image: { kind: 'image', id: 'img-1' }, size: [200, 100], items: [
    { class: 'cat', score: 0.9, box: [10, 10, 80, 60], polygon: null }, { class: 'cat', score: 0.8, box: [100, 40, 190, 95], polygon: null },
    { class: 'dog', score: 0.7, box: [60, 50, 120, 90], polygon: null },
  ] }
  const lastRun = { run_id: 700, status: 'success', node_runs: [{ node_id: 'start', status: 'succeeded' }, { node_id: 'find', status: 'succeeded', output: { detections, count: 3, classes: { cat: 2, dog: 1 }, image: detections.image, cost_usd: 0.001 } }] }
  const { state, errors } = await prepare(page, { graph, lastRun })
  await expect(node(page, 'find')).toContainText('Find objects')

  await page.getByRole('button', { name: 'Run', exact: true }).click()
  const dlg = page.getByRole('dialog', { name: 'Run with inputs' })
  await expect(dlg).toBeVisible()
  await expect(dlg.getByLabel('note', { exact: true })).toHaveValue('shelf 4')
  const photo = dlg.getByLabel('photo (photo)')
  await expect(photo).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
  await dlg.getByRole('button', { name: 'Start run' }).click()
  await expect(dlg.getByRole('alert')).toContainText('Choose a photo for this input.')
  await photo.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') })
  await expect(dlg.getByRole('alert')).toContainText('Choose a JPEG, PNG or WebP photo.')
  await photo.setInputFiles({ name: 'shelf.png', mimeType: 'image/png', buffer: PNG })
  await expect(dlg.getByRole('alert')).toHaveCount(0)
  await dlg.getByRole('button', { name: 'Start run' }).click()
  await expect.poll(() => mutations(state, '/run/').length).toBe(1)
  expect(state.uploads).toBe(1)
  expect(mutations(state, '/run/')[0].body).toMatchObject({ dry_run: false, payload: { note: 'shelf 4', photo: { kind: 'image', id: 'img-1', width: 2, height: 2 } } })
  await expect(dlg).toHaveCount(0)

  // Test this step from the step window also asks for the photo (a photo has no default).
  await node(page, 'find').dblclick()
  const win = page.getByRole('dialog').filter({ hasText: 'Test this step' })
  await expect(win).toBeVisible()
  await expect(win.getByRole('combobox', { name: 'Model' })).toContainText('SAM 3')
  await win.getByRole('button', { name: 'Test this step' }).click()
  const ask = page.getByRole('dialog', { name: 'Run with inputs' })
  await expect(ask).toBeVisible()
  await expect(ask.getByRole('button', { name: 'Start test' })).toBeVisible()
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(ask).toHaveCount(0)
  expect(mutations(state, '/run/')).toHaveLength(1)

  // The last run's output: the photo with its boxes, and the count in words.
  await expect(win.getByRole('tab', { name: 'Output' })).toHaveAttribute('aria-selected', 'true')
  const figure = page.locator('figure.wip--det')
  await expect(figure).toBeVisible()
  await expect(figure).toContainText('3 objects: cat 2, dog 1')
  await expect(figure.locator('rect.wip-box')).toHaveCount(3)
  const link = figure.getByRole('link', { name: /Opens full size in a new tab/ })
  await expect(link).toHaveAttribute('href', '/e2e-image/img-1.png')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect.poll(() => figure.locator('img').evaluate((im) => im.complete && im.naturalWidth)).toBe(4)
  if (SHOTS) await page.screenshot({ path: resolve(SHOTS, 'vision-output.png') })
  expect(errors).toEqual([])
})

test('leaving with unsaved changes asks first', async ({ page }) => {
  await prepare(page)
  await page.getByRole('button', { name: 'Tidy up' }).click()
  await expect(page.getByRole('button', { name: /Unsaved changes/ })).toBeVisible()
  await page.getByRole('button', { name: 'Back to workflows' }).click()
  const ask = page.getByRole('alertdialog', { name: 'Leave with unsaved changes?' })
  await expect(ask).toBeVisible()
  await ask.getByRole('button', { name: 'Stay' }).click()
  await expect(page).toHaveURL(/\/86$/)
})

test('dark mode draws the builder from the dark tokens', async ({ page }) => {
  await prepare(page, { theme: 'dark' })
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))   // as useTheme does
  const style = (sel, prop) => node(page, 'start').locator(sel).evaluate((el, p) => getComputedStyle(el)[p], prop)
  await expect.poll(() => style('.wf-node', 'backgroundColor')).toBe('rgb(17, 24, 39)')     // --vm-surface in dark
  await expect.poll(() => style('.wf-node__title', 'color')).toBe('rgb(229, 231, 235)')     // --vm-ink in dark
  await expect.poll(() => style('.wf-node__badge', 'color')).toBe('rgb(148, 163, 184)')     // --vm-ink-faint in dark
  expect(await unnamedButtons(page)).toEqual([])
})

for (const width of [1440, 1024, 768, 375]) {
  test(`at ${width}px the canvas fills the screen with no page scroll and the toolbar keeps Run`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 641 ? 812 : 900 })
    const { errors } = await prepare(page)
    expect(await pageScrolls(page)).toEqual({ x: false, y: false, main: false })
    const bar = await page.locator('.wfb-toolbar').boundingBox()
    expect(bar.height).toBeLessThan(64)
    expect(bar.x + bar.width).toBeLessThanOrEqual(width)
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'More workflow actions' })).toBeInViewport()
    if (width < 640) await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0)
    // A workflow with no run starts with the console collapsed to its strip.
    await expect(page.getByRole('tablist', { name: 'Console views' })).toHaveCount(0)
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => { localStorage.setItem('app-theme', t); document.documentElement.setAttribute('data-theme', t) }, theme)
      await page.waitForTimeout(1200)                         // colour transitions settled, minimap faded
      if (SHOTS && (width === 1440 || width === 375)) await page.screenshot({ path: resolve(SHOTS, `workflow-builder-${width}-${theme}.png`) })
    }
    // Below 1024 px the console opens as a bottom sheet.
    await page.getByRole('button', { name: /^Console/ }).click()
    if (width < 1024) await expect(page.getByRole('dialog', { name: 'Console' })).toBeInViewport()
    else await expect(page.getByRole('tablist', { name: 'Console views' })).toBeInViewport()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+k')
    await expect(picker(page)).toBeInViewport()
    await page.keyboard.press('Escape')
    expect(await pageScrolls(page)).toEqual({ x: false, y: false, main: false })
    expect(errors).toEqual([])
  })
}

test('the console stays a strip until there is a run, then remembers the person’s choice', async ({ page }) => {
  const graph = clone(baseGraph)
  graph.last_run = { id: 450, status: 'success' }
  await prepare(page, { graph })
  await expect(page.getByRole('tablist', { name: 'Console views' })).toHaveCount(0)
  await page.getByRole('button', { name: /^Console/ }).click()
  await expect(page.getByRole('tablist', { name: 'Console views' })).toBeVisible()
  await page.reload()
  await expect(page.locator('.wfb-name')).toContainText('Customer intake', { timeout: 60000 })
  await expect(page.getByRole('tablist', { name: 'Console views' })).toBeVisible()      // opened, and remembered
  await page.getByRole('button', { name: /^Console/ }).click()
  await page.reload()
  await expect(page.locator('.wfb-name')).toContainText('Customer intake', { timeout: 60000 })
  await expect(page.getByRole('tablist', { name: 'Console views' })).toHaveCount(0)      // closed, and remembered
})

// ── axe (WCAG 2.2 AA rules): the builder's own parts must have no serious or critical finding ──
const BUILDER_PARTS = ['.wfb-root', '.wf-tokens', '.app-dialog', '.app-sheet', '.wfb-menu']
const axeFindings = []
async function axeScan(page, label) {
  const present = []
  for (const sel of BUILDER_PARTS) if (await page.locator(sel).count()) present.push(sel)
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  for (const sel of present) builder = builder.include(sel)
  const own = await builder.analyze()
  // The whole page too, so findings in the shell around the builder are reported (not failed: not this lane's code).
  const all = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const grave = (r) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  // The node window's content is lane FE-4's (its root carries `wf-tokens`): reported, not failed here.
  const inNodeWindow = (target) => page.evaluate((sel) => !!document.querySelector(sel)?.closest('.wf-tokens'), target.join(' '))
  const ownGrave = []
  const nodeWindow = []
  for (const v of grave(own)) {
    const mine = []
    const theirs = []
    for (const n of v.nodes) (await inNodeWindow(n.target) ? theirs : mine).push(n)
    if (mine.length) ownGrave.push({ ...v, nodes: mine })
    if (theirs.length) nodeWindow.push({ ...v, nodes: theirs })
  }
  const ownKeys = new Set(ownGrave.flatMap((v) => v.nodes.map((n) => `${v.id}|${n.target.join(' ')}`)))
  for (const v of nodeWindow) for (const n of v.nodes) ownKeys.add(`${v.id}|${n.target.join(' ')}`)
  const shell = grave(all).map((v) => ({ ...v, nodes: v.nodes.filter((n) => !ownKeys.has(`${v.id}|${n.target.join(' ')}`)) })).filter((v) => v.nodes.length)
  axeFindings.push({
    label,
    builder: ownGrave.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) })),
    nodeWindow: nodeWindow.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) })),
    outside: shell.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) })),
    counts: { builderViolations: own.violations.length, builderPasses: own.passes.length },
  })
  if (AXE_OUT) writeFileSync(AXE_OUT, JSON.stringify(axeFindings, null, 2))
  return ownGrave
}
const summary = (list) => list.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)

for (const width of [1440, 375]) {
  for (const theme of ['light', 'dark']) {
    test(`axe: no serious or critical finding at ${width}px in ${theme}, with the node window and the console`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 641 ? 812 : 900 })
      await prepare(page, { theme })
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
      await page.waitForTimeout(1200)
      expect(summary(await axeScan(page, `${width} ${theme} canvas`))).toEqual([])
      await node(page, 'log').dblclick()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.waitForTimeout(400)
      expect(summary(await axeScan(page, `${width} ${theme} node window`))).toEqual([])
      await closeLayers(page)
      await page.getByRole('button', { name: /^Console/ }).click()
      if (width < 1024) await expect(page.getByRole('dialog', { name: 'Console' })).toBeVisible()
      else await expect(page.getByRole('tablist', { name: 'Console views' })).toBeVisible()
      await page.waitForTimeout(400)
      expect(summary(await axeScan(page, `${width} ${theme} console`))).toEqual([])
      await closeLayers(page)
      await menu(page, 'Share')
      await expect(page.getByRole('dialog', { name: 'Share workflow' })).toContainText('Ann Approver')
      await page.waitForTimeout(400)
      expect(summary(await axeScan(page, `${width} ${theme} share dialog`))).toEqual([])
    })
  }
}


// ── sharing and roles (ADM-1339): the page follows the server's `my_role`; the server enforces it ──
const asRole = (role) => ({ ...clone(baseGraph), my_role: role })
const menuItems = async (page) => {
  await page.getByRole('button', { name: 'More workflow actions' }).click()
  const items = await page.getByRole('menuitem').allInnerTexts()
  await page.keyboard.press('Escape')
  return items.map((t) => t.replace(/\s+/g, ' ').replace(/ (Ctrl|⌘)\+S$| \?$/, '').trim())
}

test('a viewer sees the workflow read-only: no edit, add, Save, Publish, Test or Run, and nothing is sent', async ({ page }) => {
  const { state, errors } = await prepare(page, { graph: asRole('viewer') })
  await expect(page.locator('.wfb-pill.is-role')).toHaveText('Your role: Viewer')
  for (const name of ['Add a step', 'Test', 'Run', 'Publish', 'Tidy up']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Rename workflow' })).toHaveCount(0)
  expect(await menuItems(page)).toEqual(['Versions', 'Duplicate workflow', 'Outline', 'Shortcuts', 'Help'])
  // The canvas: no hover toolbar, no + to add, keyboard edits do nothing.
  await node(page, 'log').hover()
  await expect(page.getByRole('button', { name: 'Test up to Record result' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Turn step/ })).toHaveCount(0)
  await node(page, 'log').click()
  await page.keyboard.press('d')
  await expect(node(page, 'log').locator('.wf-node')).not.toHaveClass(/is-off/)
  await page.keyboard.press('Delete')
  await page.keyboard.press('Control+k')
  await page.keyboard.press('Control+Enter')
  await page.keyboard.press('F2')
  await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0)
  await expect(page.locator('.vue-flow__node')).toHaveCount(2)
  // The step window shows the settings, disabled, and no test.
  await node(page, 'log').dblclick()
  const win = page.getByRole('dialog')
  await expect(win).toContainText('Your role on this workflow lets you see this step, not change it.')
  await expect(win.getByRole('textbox', { name: 'Step name' })).toBeDisabled()
  await expect(win.getByRole('button', { name: 'Test this step' })).toHaveCount(0)
  await closeLayers(page)
  expect(state.requests.filter((r) => r.method !== 'GET')).toEqual([])
  expect(errors).toEqual([])
})

test('a runner may Test and Run but not edit; a refusal from the server shows its sentence', async ({ page }) => {
  const { state } = await prepare(page, { graph: asRole('runner') })
  await expect(page.locator('.wfb-pill.is-role')).toHaveText('Your role: Runner')
  await expect(page.getByRole('button', { name: 'Add a step', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0)
  expect(await menuItems(page)).toEqual(['Versions', 'Duplicate workflow', 'Outline', 'Shortcuts', 'Help'])
  await node(page, 'log').hover()
  await expect(page.getByRole('button', { name: 'Test up to Record result' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete Record result' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Test', exact: true }).click()
  await expect.poll(() => mutations(state, '/run/').length).toBe(1)
  expect(mutations(state, '/run/')[0].body).toMatchObject({ dry_run: true })
  state.forbidRun = true
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByText('Your role on this workflow no longer allows running it.')).toBeVisible()
  expect(state.requests.filter((r) => r.method === 'PUT')).toEqual([])
})

test('an editor edits but cannot share or archive', async ({ page }) => {
  await prepare(page, { graph: asRole('editor') })
  await expect(page.getByRole('button', { name: 'Add a step', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible()
  const items = await menuItems(page)
  expect(items).toEqual(expect.arrayContaining(['Save', 'Validate', 'Versions']))
  expect(items).not.toContain('Share')
  expect(items).not.toContain('Archive workflow')
})

test('the owner shares from the menu: add, a refused add, change a role, remove after asking', async ({ page }) => {
  const { state } = await prepare(page)
  await menu(page, 'Share')
  const dlg = page.getByRole('dialog', { name: 'Share workflow' })
  await expect(dlg).toContainText('Olga Owner')
  await expect(dlg.getByRole('combobox', { name: 'Role of Ann Approver' })).toHaveValue('viewer')
  // Someone outside the workspace: the server's sentence.
  await dlg.getByRole('textbox', { name: 'Email' }).fill('stranger@elsewhere.test')
  await dlg.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dlg.getByRole('alert')).toContainText("stranger@elsewhere.test is not a member of this workflow's workspace.")
  // A member, as an editor.
  await dlg.getByRole('textbox', { name: 'Email' }).fill('bo@example.test')
  await dlg.getByRole('combobox', { name: 'Role', exact: true }).selectOption('editor')
  await dlg.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dlg.getByRole('combobox', { name: 'Role of bo@example.test' })).toHaveValue('editor')
  await dlg.getByRole('combobox', { name: 'Role of Ann Approver' }).selectOption('runner')
  await expect.poll(() => state.shares.find((r) => r.user_id === 7).role).toBe('runner')
  await dlg.getByRole('button', { name: 'Remove bo@example.test' }).click()
  const ask = page.getByRole('alertdialog', { name: 'Remove bo@example.test?' })
  await ask.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(dlg.getByRole('combobox', { name: 'Role of bo@example.test' })).toHaveCount(0)
  expect(state.requests.filter((r) => r.path.includes('/shares/') && r.method !== 'GET').map((r) => r.method)).toEqual(['POST', 'POST', 'PATCH', 'DELETE'])
})

test('approvers are picked from the people; a waiting approval offers Approve only to who may decide', async ({ page }) => {
  const graph = clone(baseGraph)
  graph.last_run = { id: 910, status: 'waiting' }
  graph.graph.nodes.push({ id: 'ok', type: 'logic.approval', position: { x: 740, y: 160 }, data: { label: 'Manager OK', message: 'Go?' } })
  graph.graph.edges.push({ id: 'e_log_ok', source: 'log', target: 'ok' })
  const waitingOutput = { approvers: [{ user_id: 7, email: 'ann@example.test', name: 'Ann Approver' }], can_decide: false }
  const runDetails = { 910: { id: 910, status: 'waiting', node_runs: [
    { node_id: 'start', status: 'succeeded', attempt: 1 }, { node_id: 'log', status: 'succeeded', attempt: 1 },
    { node_id: 'ok', status: 'waiting', attempt: 1, output: waitingOutput },
  ] } }
  const { state } = await prepare(page, { graph, runDetails })
  await expect(page.getByText('Manager OK: Waiting for Ann Approver to decide.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  await node(page, 'ok').dblclick()
  const win = page.getByRole('dialog')
  await expect(win.getByRole('group', { name: 'Approval decision' })).toContainText('Waiting for Ann Approver to decide.')
  await expect(win.getByRole('checkbox')).toHaveCount(2)
  await win.getByRole('checkbox', { name: /Ann Approver/ }).check()
  await closeLayers(page)
  await page.keyboard.press('Control+s')
  await expect.poll(() => mutations(state, '/86/').length).toBe(1)
  expect(state.graph.graph.nodes.find((n) => n.id === 'ok').data.approvers).toEqual([7])
})

// The approval notification links to /dashboard/workflow-builder/<id>?run=<run id>: that run opens in the console.
test('a link with ?run= opens that run, live when it still waits', async ({ page }) => {
  const graph = clone(baseGraph)
  graph.graph.nodes.push({ id: 'ok', type: 'logic.approval', position: { x: 740, y: 160 }, data: { label: 'Manager OK', message: 'Go?' } })
  const runDetails = { 920: { id: 920, status: 'waiting', node_runs: [
    { node_id: 'start', status: 'succeeded', attempt: 1 },
    { node_id: 'ok', status: 'waiting', attempt: 1, output: { approvers: [{ user_id: 1, email: 'olga@example.test', name: 'Olga Owner' }], can_decide: true } },
  ] } }
  const { state } = await prepare(page, { graph, runDetails, path: '/dashboard/workflow-builder/86?run=920' })
  await expect(page.getByText('Manager OK needs your approval')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Approve', exact: true }).first().click()
  await expect.poll(() => mutations(state, '/approve/').map((r) => r.body)).toEqual([{ node_id: 'ok', decision: 'approve' }])
})

// The app's confirm asked from inside a sheet (Restore) can be clicked: the sheet underneath neither swallows the
// press nor closes under the question.
test('Restore in the Versions sheet asks with the app confirm, and its buttons work', async ({ page }) => {
  const { state } = await prepare(page)
  await menu(page, 'Versions')
  const sheet = page.getByRole('dialog', { name: 'Versions' })
  await sheet.getByRole('button', { name: 'Restore version 1' }).click()
  const ask = page.getByRole('alertdialog', { name: 'Restore version 1?' })
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(ask).toHaveCount(0)
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Restore version 1' }).click()
  await page.getByRole('alertdialog', { name: 'Restore version 1?' }).getByRole('button', { name: 'Restore', exact: true }).click()
  await expect.poll(() => mutations(state, '/restore/').length).toBe(1)
})
