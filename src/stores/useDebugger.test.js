// The editor's debugger (ADM-1205 phase F item 17): what can be started (the file shown, npm scripts, launch.json),
// breakpoints kept per project and sent as the adapter expects, and a whole session through the real socket client
// with a stand-in adapter: initialize -> launch -> initialized -> setBreakpoints -> configurationDone; stopped -> the
// stack, scopes and variables; stepping; js-debug's child session; Restart ignoring the old session; the gutter.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

vi.mock('@/services/api', () => ({ default: { getFileContent: vi.fn() } }))
import api from '@/services/api'
import { DapConnection } from '@/services/dapClient'
import { createDebugger, adapterFor, parseJsonc, configurations, sourceBreakpoint } from './useDebugger'

const ROOT = '/home/northrays/workspace/repo-4'
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); await nextTick() }

describe('what can be started', () => {
  it('a file is run by its adapter', () => {
    expect(['a.py', 'b.js', 'c.mjs', 'd.ts', 'e.css', ''].map(adapterFor)).toEqual(['python', 'node', 'node', 'node', null, null])
  })
  it('launch.json is JSON with comments and trailing commas', () => {
    expect(parseJsonc('{ // c\n "a": "http://x", /* b */ "l": [1, 2,], }')).toEqual({ a: 'http://x', l: [1, 2] })
    expect(parseJsonc('{ "s": "a \\" // not a comment" }')).toEqual({ s: 'a " // not a comment' })
    expect(parseJsonc('not json')).toBeNull()
  })
  it('the file shown, npm scripts, and launch.json with its variables filled in', () => {
    const out = configurations({ root: ROOT, activePath: 'src/app.ts', scripts: { dev: 'vite' }, launch: { configurations: [
      { type: 'node', request: 'launch', name: 'Server', program: '${workspaceFolder}/server.js', args: ['${file}'] },
      { type: 'python', request: 'launch', name: 'Tool', program: '${fileDirname}/tool.py' },
      { type: 'chrome', name: 'Browser' }] } })
    expect(out.map((c) => [c.id, c.adapter])).toEqual([['file', 'node'], ['npm:dev', 'node'], ['launch:0', 'node'], ['launch:1', 'python']])
    expect(out[0].config).toMatchObject({ type: 'pwa-node', program: `${ROOT}/src/app.ts`, runtimeExecutable: 'npx', runtimeArgs: ['--yes', 'tsx'], console: 'internalConsole' })
    expect(out[1].config).toMatchObject({ runtimeExecutable: 'npm', runtimeArgs: ['run', 'dev'], cwd: ROOT })
    expect(out[2].config).toMatchObject({ type: 'pwa-node', program: `${ROOT}/server.js`, args: [`${ROOT}/src/app.ts`], cwd: ROOT, console: 'internalConsole' })
    expect(out[3].config.program).toBe(`${ROOT}/src/tool.py`)
  })
  it("js-debug reads source maps only from the project, outside node_modules, as VS Code does", () => {
    // Live check, 2026-11-17: without it, npm and tsx filled the Debug Console with "Could not read source map".
    const maps = [`${ROOT}/**`, '!**/node_modules/**']
    const out = configurations({ root: ROOT, activePath: 'a.js', scripts: { dev: 'vite' }, launch: { configurations: [
      { type: 'node', request: 'launch', name: 'Mine' },
      { type: 'node', request: 'launch', name: 'Own maps', resolveSourceMapLocations: ['${workspaceFolder}/dist/**'] },
      { type: 'debugpy', request: 'launch', name: 'Py' }] } })
    expect(out.map((c) => c.config.resolveSourceMapLocations)).toEqual([maps, maps, maps, [`${ROOT}/dist/**`], undefined])
  })
  it('a Python file', () => {
    const [c] = configurations({ root: ROOT, activePath: 'calc.py', scripts: {}, launch: null })
    expect(c.config).toEqual({ type: 'python', request: 'launch', name: 'calc.py', program: `${ROOT}/calc.py`, cwd: ROOT, console: 'internalConsole', justMyCode: true })
  })
  it('a breakpoint is sent with only what it has', () => {
    expect(sourceBreakpoint({ line: 4, condition: '', hitCondition: '', logMessage: '' })).toEqual({ line: 4 })
    expect(sourceBreakpoint({ line: 4, condition: 'p > 2', hitCondition: '3', logMessage: 'p={p}' })).toEqual({ line: 4, condition: 'p > 2', hitCondition: '3', logMessage: 'p={p}' })
  })
})

// The socket under the real DapConnection, with a stand-in adapter that answers each request.
class FakeWS {
  constructor(url) { this.url = url; this.sent = []; FakeWS.made.push(this) }
  send(t) {
    const f = JSON.parse(t)
    this.sent.push(f)
    if (f.m.type === 'request' && FakeWS.adapter) {
      // As debugpy and js-debug: launch / attach are answered only after configurationDone.
      if (['launch', 'attach'].includes(f.m.command)) { (this.held ||= {})[f.s] = f.m; return }
      const body = FakeWS.adapter(f.m, f.s, this)
      if (body !== undefined) queueMicrotask(() => this.reply(f.s, f.m, body))
      const held = this.held && this.held[f.s]
      if (f.m.command === 'configurationDone' && held) { delete this.held[f.s]; queueMicrotask(() => this.reply(f.s, held, {})) }
    }
  }
  reply(s, m, body) { this.onmessage({ data: JSON.stringify({ s, m: { type: 'response', request_seq: m.seq, command: m.command, success: true, body } }) }) }
  event(s, event, body = {}) { this.onmessage({ data: JSON.stringify({ s, m: { type: 'event', event, body } }) }) }
  status(o) { this.onmessage({ data: JSON.stringify({ type: 'status', ...o }) }) }
  close() { this.closed = true }
  commands(s) { return this.sent.filter((f) => f.m.type === 'request' && (s === undefined || f.s === s)).map((f) => f.m.command) }
  args(command) { return this.sent.filter((f) => f.m.command === command).map((f) => f.m.arguments) }
}
FakeWS.made = []

const ANSWERS = {
  initialize: {}, launch: {}, setBreakpoints: null, setExceptionBreakpoints: {}, configurationDone: {}, threads: { threads: [{ id: 1 }] },
  stackTrace: { stackFrames: [{ id: 11, name: 'total', line: 4, column: 1, source: { path: `${ROOT}/calc.py` } },
    { id: 12, name: '<module>', line: 9, column: 1, source: { path: '/usr/lib/python3/runpy.py', name: 'runpy.py' } }] },
  scopes: { scopes: [{ name: 'Locals', variablesReference: 21 }, { name: 'Globals', variablesReference: 22, expensive: true }] },
  variables: { variables: [{ name: 'p', value: '3', type: 'int' }, { name: 'prices', value: '[3, 4, 5]', type: 'list', variablesReference: 31 }] },
  next: {}, continue: {}, evaluate: { result: '12' }, disconnect: {},
}
const answer = (m) => (m.command === 'setBreakpoints' ? { breakpoints: m.arguments.breakpoints.map(() => ({ verified: true })) } : ANSWERS[m.command])

function memory() { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m } }

function editor() {
  const listeners = {}
  const collection = { set: vi.fn(), clear: vi.fn(), getRanges: vi.fn(() => []) }
  const ed = { updateOptions: vi.fn(), createDecorationsCollection: vi.fn(() => collection),
    onMouseDown: (f) => { listeners.mouse = f; return { dispose: vi.fn() } },
    onDidChangeModelContent: (f) => { listeners.change = f; return { dispose: vi.fn() } },
    addAction: vi.fn(() => ({ dispose: vi.fn() })) }
  class Range { constructor(a, b, c, d) { Object.assign(this, { a, b, c, d }) } }
  const monaco = { Range, KeyCode: { F9: 67, F5: 63 }, editor: { MouseTargetType: { GUTTER_GLYPH_MARGIN: 2 } } }
  const tab = ref({ id: 1, type: 'file', path: 'calc.py' })
  const openAt = vi.fn()
  return { ed, monaco, collection, listeners, tab, openAt,
    ctx: { monaco: () => monaco, editor: () => ed, activeTab: tab, openAt } }
}

function make(storage = memory()) {
  const dbg = createDebugger({ systemId: 2, repoId: 4, storage, urlFor: (repo, adapter) => `wss://aadml.test/ws/lets-code/${repo}/dap/${adapter}/`,
    Connection: class extends DapConnection { constructor(o) { super({ ...o, WebSocketImpl: FakeWS }) } } })
  return { dbg, storage }
}

beforeEach(() => {
  FakeWS.made = []
  FakeWS.adapter = answer
  api.getFileContent.mockReset()
  api.getFileContent.mockRejectedValue(new Error('404'))
})

describe('breakpoints', () => {
  it('the gutter and F9 toggle a breakpoint; they are kept for the project in this browser', async () => {
    const { dbg, storage } = make()
    const e = editor()
    dbg.bind(e.ctx)
    expect(e.ed.updateOptions).toHaveBeenCalledWith({ glyphMargin: true })
    expect(e.ed.addAction.mock.calls.map((c) => [c[0].id, c[0].keybindings])).toEqual([
      ['lets-code.toggle-breakpoint', [67]], ['lets-code.start-debugging', [63]]])
    e.listeners.mouse({ target: { type: 2, position: { lineNumber: 4 } } })
    e.listeners.mouse({ target: { type: 6, position: { lineNumber: 5 } } })       // the text, not the gutter
    expect(dbg.breakpointList.value).toEqual([{ path: 'calc.py', line: 4, condition: '', hitCondition: '', logMessage: '', verified: null }])
    // What a session said about it (verified, its ids) is not kept for the next visit.
    expect(JSON.parse(storage.m.get('lc-breakpoints:4'))).toEqual({ 'calc.py': [{ line: 4, condition: '', hitCondition: '', logMessage: '' }] })
    const deco = e.collection.set.mock.calls.at(-1)?.[0] || e.ed.createDecorationsCollection.mock.calls.at(-1)[0]
    expect(deco.map((d) => d.options.glyphMarginClassName)).toEqual(['lc-bp'])
    dbg.updateBreakpoint('calc.py', 4, { condition: 'p > 2' })
    expect(e.collection.set.mock.calls.at(-1)[0][0].options.glyphMarginClassName).toBe('lc-bp-cond')
    // Another visit to the project finds them.
    expect(make(storage).dbg.breakpointList.value[0]).toMatchObject({ path: 'calc.py', line: 4, condition: 'p > 2' })
    e.listeners.mouse({ target: { type: 2, position: { lineNumber: 4 } } })
    expect(dbg.breakpointList.value).toEqual([])
  })

  it('an edit above a breakpoint moves it with its line', async () => {
    vi.useFakeTimers()
    const { dbg } = make()
    const e = editor()
    dbg.bind(e.ctx)
    dbg.toggleBreakpoint('calc.py', 4)
    e.collection.getRanges.mockReturnValue([{ startLineNumber: 6 }])
    e.listeners.change({ isFlush: false })
    vi.advanceTimersByTime(300)
    vi.useRealTimers()
    expect(dbg.breakpointList.value.map((b) => b.line)).toEqual([6])
  })
})

describe('a debug session', () => {
  async function started(dbg, e) {
    dbg.bind(e.ctx)
    await flush()                                    // the configurations of the file shown
    expect(dbg.configs.value.map((c) => c.id)).toEqual(['file'])
    dbg.start()
    const ws = FakeWS.made.at(-1)
    expect(ws.url).toMatch(/\/ws\/lets-code\/4\/dap\/python\/$/)
    ws.status({ state: 'ready', root: ROOT })
    await flush()
    return ws
  }

  it('initialize, launch, then on initialized the breakpoints and configurationDone; stopped shows where', async () => {
    const { dbg } = make()
    const e = editor()
    dbg.toggleBreakpoint('calc.py', 4)
    const ws = await started(dbg, e)
    expect(ws.commands()).toEqual(['initialize', 'launch'])
    expect(ws.args('launch')[0]).toMatchObject({ program: `${ROOT}/calc.py`, cwd: ROOT })
    expect(dbg.panel.value.tab).toBe('debug-console')
    ws.event(1, 'initialized')
    await flush()
    expect(ws.commands()).toEqual(['initialize', 'launch', 'setBreakpoints', 'setExceptionBreakpoints', 'configurationDone'])
    expect(ws.args('setBreakpoints')[0]).toEqual({ source: { path: `${ROOT}/calc.py` }, breakpoints: [{ line: 4 }] })
    expect(dbg.breakpointList.value[0].verified).toBe(true)
    ws.event(1, 'output', { category: 'stdout', output: 'hello\n' })
    ws.event(1, 'stopped', { reason: 'breakpoint', threadId: 1 })
    await flush()
    expect(dbg.state.value).toBe('paused')
    expect(dbg.frames.value.map((f) => [f.name, f.path, f.line])).toEqual([['total', 'calc.py', 4], ['<module>', null, 9]])
    expect(e.openAt).toHaveBeenCalledWith({ path: 'calc.py', line: 4, column: 1 })
    expect(dbg.scopes.value[0]).toMatchObject({ name: 'Locals', open: true })
    expect(dbg.scopes.value[0].children.map((v) => [v.name, v.value])).toEqual([['p', '3'], ['prices', '[3, 4, 5]']])
    expect(dbg.scopes.value[1].children).toBeNull()                  // an expensive scope waits to be opened
    expect(dbg.consoleLines.value).toEqual([{ kind: 'out', text: 'hello' }])
    // The paused line is marked in the editor.
    expect(e.collection.set.mock.calls.at(-1)[0].map((d) => d.options.className || d.options.glyphMarginClassName)).toEqual(['lc-bp', 'lc-paused-line'])

    dbg.addWatch('sum(prices)')
    await dbg.repl('p * 4')
    expect(dbg.watches.value[0]).toMatchObject({ expr: 'sum(prices)', value: '12' })
    expect(dbg.consoleLines.value.slice(-2)).toEqual([{ kind: 'in', text: 'p * 4' }, { kind: 'result', text: '12' }])
    expect(ws.args('evaluate').at(-1)).toEqual({ expression: 'p * 4', frameId: 11, context: 'repl' })

    await dbg.step('next')
    expect(ws.args('next')).toEqual([{ threadId: 1 }])
    expect(dbg.state.value).toBe('running')
    expect(dbg.frames.value).toEqual([])
    ws.event(1, 'exited', { exitCode: 0 })
    ws.event(1, 'terminated')
    await flush()
    expect(dbg.state.value).toBe('ended')
    expect(dbg.consoleLines.value.at(-1)).toEqual({ kind: 'info', text: 'The program ended with exit code 0.' })
  })

  it('js-debug\'s child session is started with its own request and is where the program stops', async () => {
    const { dbg } = make()
    const e = editor()
    e.tab.value = { id: 1, type: 'file', path: 'app.js' }
    dbg.bind(e.ctx)
    await flush()
    dbg.start('file')
    const ws = FakeWS.made.at(-1)
    expect(ws.url).toMatch(/dap\/node\/$/)
    ws.status({ state: 'ready', root: ROOT })
    await flush()
    ws.onmessage({ data: JSON.stringify({ s: 1, m: { type: 'request', seq: 5, command: 'startDebugging',
      arguments: { request: 'attach', configuration: { type: 'pwa-node', __pendingTargetId: 't1' } } } }) })
    await flush()
    expect(ws.sent.find((f) => f.m.type === 'response')).toMatchObject({ s: 1, m: { request_seq: 5, success: true } })
    expect(ws.commands(2)).toEqual(['initialize', 'attach'])
    expect(ws.args('attach')[0]).toEqual({ type: 'pwa-node', __pendingTargetId: 't1' })
    ws.event(1, 'initialized')
    ws.event(2, 'initialized')
    await flush()
    ws.event(2, 'stopped', { threadId: 3 })
    await flush()
    expect(ws.commands(2)).toContain('stackTrace')
    expect(ws.args('stackTrace').at(-1)).toEqual({ threadId: 3, startFrame: 0 })
    ws.event(2, 'terminated')                         // the child ends; the parent still runs
    await flush()
    expect(dbg.state.value).not.toBe('ended')
  })

  // js-debug: a parent session, and the child (startDebugging) where the program runs.
  async function nodeSessions(dbg, e) {
    e.tab.value = { id: 1, type: 'file', path: 'app.js' }
    dbg.bind(e.ctx)
    await flush()
    dbg.start('file')
    const ws = FakeWS.made.at(-1)
    ws.status({ state: 'ready', root: ROOT })
    await flush()
    ws.onmessage({ data: JSON.stringify({ s: 1, m: { type: 'request', seq: 5, command: 'startDebugging',
      arguments: { request: 'attach', configuration: { type: 'pwa-node', __pendingTargetId: 't1' } } } }) })
    await flush()
    ws.event(1, 'initialized')
    ws.event(2, 'initialized')
    await flush()
    return ws
  }

  it('a breakpoint removed while paused reaches the child before Continue does (live check 2026-11-16)', async () => {
    const { dbg } = make()
    const e = editor()
    dbg.toggleBreakpoint('app.js', 4)
    const ws = await nodeSessions(dbg, e)
    ws.event(2, 'stopped', { reason: 'breakpoint', threadId: 0 })
    await flush()
    // The parent's answer takes a round trip through the server; the removal must not wait for it.
    const late = []
    FakeWS.adapter = (m, s) => (m.command === 'setBreakpoints' && s === 1 ? (late.push(m), undefined) : answer(m))
    dbg.toggleBreakpoint('app.js', 4)                // removed
    const going = dbg.step('continue')               // and Continue pressed at once
    await flush()
    const childRemoval = ws.sent.findIndex((f) => f.s === 2 && f.m.command === 'setBreakpoints' && !f.m.arguments.breakpoints.length)
    expect(childRemoval).toBeGreaterThan(-1)
    expect(ws.commands(2)).not.toContain('continue')  // not before every session has answered the change
    ws.reply(1, late[0], { breakpoints: [] })
    await going
    const cont = ws.sent.findIndex((f) => f.s === 2 && f.m.command === 'continue')
    expect(cont).toBeGreaterThan(childRemoval)
    expect(ws.args('continue').at(-1)).toEqual({ threadId: 0 })
  })

  it("js-debug's provisional breakpoint turns verified when its child session places it", async () => {
    FakeWS.adapter = (m) => (m.command === 'setBreakpoints'
      ? { breakpoints: m.arguments.breakpoints.map(() => ({ id: 1, verified: false, message: 'breakpoint.provisionalBreakpoint' })) }
      : answer(m))
    const { dbg, storage } = make()
    const e = editor()
    dbg.toggleBreakpoint('app.js', 4)
    const ws = await nodeSessions(dbg, e)
    expect(dbg.breakpointList.value[0].verified).toBe(false)
    expect(e.collection.set.mock.calls.at(-1)[0][0].options.glyphMarginClassName).toBe('lc-bp lc-bp-unverified')
    ws.event(2, 'breakpoint', { reason: 'changed', breakpoint: { id: 99, verified: true } })   // not ours
    expect(dbg.breakpointList.value[0].verified).toBe(false)
    ws.event(2, 'breakpoint', { reason: 'changed', breakpoint: { id: 1, verified: true, line: 4 } })
    await flush()
    expect(dbg.breakpointList.value[0].verified).toBe(true)
    expect(e.collection.set.mock.calls.at(-1)[0][0].options.glyphMarginClassName).toBe('lc-bp')
    ws.event(1, 'breakpoint', { reason: 'changed', breakpoint: { id: 1, verified: false } })  // the parent: still placed
    expect(dbg.breakpointList.value[0].verified).toBe(true)
    expect(storage.m.get('lc-breakpoints:4')).not.toMatch(/verified|placed|ids/)
    // A new session starts from nothing known: its ids start again from 1.
    dbg.restart()
    expect(dbg.breakpointList.value[0].verified).toBeNull()
  })

  it('Restart starts a new connection; the old session\'s late events change nothing', async () => {
    const { dbg } = make()
    const e = editor()
    const old = await started(dbg, e)
    old.event(1, 'initialized')
    await flush()
    dbg.restart()
    const now = FakeWS.made.at(-1)
    expect(now).not.toBe(old)
    expect(old.commands()).toContain('disconnect')
    expect(old.args('disconnect')[0]).toEqual({ terminateDebuggee: true })
    now.status({ state: 'ready', root: ROOT })
    await flush()
    old.event(1, 'terminated')
    await flush()
    expect(dbg.state.value).toBe('starting')
    now.event(1, 'initialized')
    await flush()
    expect(dbg.state.value).toBe('running')
  })

  it('an install failure is shown in words', async () => {
    const { dbg } = make()
    const e = editor()
    dbg.bind(e.ctx)
    await flush()
    dbg.start()
    FakeWS.made.at(-1).status({ state: 'error', error: "The debugger could not be installed in the project's sandbox: js-debug did not match its checksum" })
    expect(dbg.state.value).toBe('error')
    expect(dbg.error.value).toMatch(/checksum/)
  })

  it('npm scripts and launch.json come from the project\'s files', async () => {
    api.getFileContent.mockImplementation((s, r, p) => (p === 'package.json'
      ? Promise.resolve({ data: { content: '{"scripts": {"dev": "vite", "test": "vitest"}}' } })
      : Promise.resolve({ data: { content: '{ // mine\n "configurations": [{ "type": "node", "name": "Server", "program": "${workspaceFolder}/s.js" },] }' } })))
    const { dbg } = make()
    await dbg.loadConfigs('README.md')
    expect(api.getFileContent.mock.calls.map((c) => c.slice(0, 3))).toEqual([[2, 4, 'package.json'], [2, 4, '.vscode/launch.json']])
    expect(dbg.configs.value.map((c) => c.label)).toEqual(['npm run dev', 'npm run test', 'Server (launch.json)'])
    expect(dbg.selectedConfig.value).toBe('npm:dev')
  })
})

describe('the debugger stopping on its own', () => {
  async function running() {
    const { dbg } = make()
    const e = editor()
    dbg.bind(e.ctx)
    await flush()
    dbg.start()
    const ws = FakeWS.made.at(-1)
    ws.status({ state: 'ready', root: ROOT })
    await flush()
    return { dbg, ws }
  }

  it('its process ending while the session starts is an error, never a quiet "ended"', async () => {
    const { dbg, ws } = await running()
    expect(dbg.state.value).toBe('starting')
    ws.status({ state: 'exited' })
    await flush()
    expect(dbg.state.value).toBe('error')
    expect(dbg.error.value).toMatch(/stopped while it was starting/)
  })

  it('while the program runs, likewise', async () => {
    const { dbg, ws } = await running()
    ws.event(1, 'initialized')
    await flush()
    expect(dbg.state.value).toBe('running')
    ws.status({ state: 'closed' })
    await flush()
    expect(dbg.state.value).toBe('error')
    expect(dbg.error.value).toBe('The debugger stopped before the program ended.')
  })

  it("the bridge's own reason is shown, and the console has its words", async () => {
    const { dbg, ws } = await running()
    ws.event(1, 'output', { category: 'stderr', output: "AADML's debug bridge stopped: its input failed (EIO)\n" })
    ws.event(1, 'aadml.ended', { error: 'its input failed (EIO)' })
    await flush()
    expect(dbg.state.value).toBe('error')
    expect(dbg.error.value).toBe('The debugger stopped: its input failed (EIO)')
    expect(dbg.consoleLines.value.at(-1)).toEqual({ kind: 'err', text: "AADML's debug bridge stopped: its input failed (EIO)" })
  })

  it('after the program ended, the socket closing is not an error', async () => {
    const { dbg, ws } = await running()
    ws.event(1, 'initialized')
    ws.event(1, 'terminated')
    await flush()
    ws.status({ state: 'closed' })
    await flush()
    expect(dbg.state.value).toBe('ended')
    expect(dbg.error.value).toBe('')
  })
})
