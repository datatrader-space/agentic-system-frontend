// The Let's Code editor's debugger (ADM-1205 phase F, item 17; agentic-docs/LETS_CODE_DEBUGGER_PLAN.md): Python
// (debugpy) and Node (js-debug) in the project's sandbox, through AADML's bridge. VS Code's model:
//   * breakpoints in the editor's gutter, each with an optional condition, hit count or log message, kept per project in
//     this browser;
//   * a configuration to start: the file shown, an npm script, or one of the project's .vscode/launch.json;
//   * a session: initialize -> launch -> on "initialized" the breakpoints and configurationDone; js-debug asks for a
//     child session per process it starts (startDebugging), which is where the program stops;
//   * when stopped: the call stack, each frame's scopes and variables (opened on demand), the watch expressions, the
//     paused line shown in the editor; Continue / Step over / Step into / Step out / Pause / Restart / Stop;
//   * the Debug Console: what the program prints, and expressions evaluated in the selected frame.
// One store per open project, provided by the Let's Code page (DEBUGGER), like the language servers.
import { reactive, ref, computed, watch, effectScope } from 'vue'
import api from '@/services/api'
import { DapConnection, dapSocketUrl } from '@/services/dapClient'

export const DEBUGGER = Symbol('lets-code-debugger')

// ── pure helpers (tested on their own) ────────────────────────────────────────────────────────────────────────
const NODE_EXT = ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts']
const TS_EXT = ['ts', 'mts', 'cts']
const extOf = (p) => { const m = /\.([^./]+)$/.exec(String(p || '')); return m ? m[1].toLowerCase() : '' }

/** The adapter that runs a file: python | node | null. */
export function adapterFor(path) {
  const e = extOf(path)
  if (e === 'py') return 'python'
  if (NODE_EXT.includes(e)) return 'node'
  return null
}

/** JSON with comments and trailing commas (VS Code's launch.json), parsed; null when it is not JSON. */
export function parseJsonc(text) {
  let out = ''
  let inStr = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inStr) { out += c; if (c === '\\') { out += text[++i] || '' } else if (c === '"') inStr = false; continue }
    if (c === '"') { inStr = true; out += c; continue }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue }
    if (c === '/' && text[i + 1] === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; continue }
    out += c
  }
  try { return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1')) } catch { return null }
}

const ADAPTER_OF_TYPE = { node: 'node', 'pwa-node': 'node', python: 'python', debugpy: 'python' }

/** ${workspaceFolder}, ${file} and ${fileDirname} in a launch.json value, as VS Code fills them. */
function substitute(v, vars) {
  if (typeof v === 'string') return v.replace(/\$\{(workspaceFolder|workspaceRoot|file|fileDirname|relativeFile)\}/g, (_, k) => vars[k] ?? '')
  if (Array.isArray(v)) return v.map((x) => substitute(x, vars))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, substitute(x, vars)]))
  return v
}

/**
 * What can be started: [{id, label, adapter, config}]. `root` is the project's folder in the sandbox; `activePath`
 * the file shown; `scripts` package.json's scripts; `launch` the parsed .vscode/launch.json.
 */
export function configurations({ root, activePath, scripts, launch }) {
  const abs = (p) => `${String(root).replace(/\/+$/, '')}/${String(p).replace(/^\/+/, '')}`
  // Where js-debug looks for source maps: VS Code's default, the project outside node_modules. Without it js-debug
  // tried every file npm and tsx load and filled the Debug Console with "Could not read source map" lines (live
  // check, 2026-11-17).
  const maps = { resolveSourceMapLocations: [abs('**'), '!**/node_modules/**'] }
  const out = []
  const a = adapterFor(activePath)
  if (a === 'python') {
    out.push({ id: 'file', label: `Python: ${activePath}`, adapter: 'python', config: { type: 'python', request: 'launch',
      name: activePath, program: abs(activePath), cwd: root, console: 'internalConsole', justMyCode: true } })
  } else if (a === 'node') {
    const ts = TS_EXT.includes(extOf(activePath))
    out.push({ id: 'file', label: `Node: ${activePath}`, adapter: 'node', config: { type: 'pwa-node', request: 'launch',
      name: activePath, program: abs(activePath), cwd: root, console: 'internalConsole', skipFiles: ['<node_internals>/**'],
      ...maps, ...(ts ? { runtimeExecutable: 'npx', runtimeArgs: ['--yes', 'tsx'] } : {}) } })
  }
  for (const name of Object.keys(scripts || {})) {
    out.push({ id: `npm:${name}`, label: `npm run ${name}`, adapter: 'node', config: { type: 'pwa-node', request: 'launch',
      name: `npm run ${name}`, runtimeExecutable: 'npm', runtimeArgs: ['run', name], cwd: root, console: 'internalConsole',
      skipFiles: ['<node_internals>/**'], ...maps } })
  }
  const vars = { workspaceFolder: root, workspaceRoot: root, file: activePath ? abs(activePath) : '',
    fileDirname: activePath ? abs(activePath).replace(/\/[^/]*$/, '') : root, relativeFile: activePath || '' }
  for (const [i, c] of ((launch && launch.configurations) || []).entries()) {
    const adapter = ADAPTER_OF_TYPE[c && c.type]
    if (!adapter) continue
    const config = substitute({ ...c, type: adapter === 'node' ? 'pwa-node' : c.type, console: 'internalConsole' }, vars)
    if (!config.cwd) config.cwd = root
    if (adapter === 'node' && !config.resolveSourceMapLocations) Object.assign(config, maps)
    out.push({ id: `launch:${i}`, label: `${c.name || 'Configuration'} (launch.json)`, adapter, config })
  }
  return out
}

/** A DAP SourceBreakpoint from ours. */
export function sourceBreakpoint(bp) {
  const b = { line: bp.line }
  if (bp.condition) b.condition = bp.condition
  if (bp.hitCondition) b.hitCondition = bp.hitCondition
  if (bp.logMessage) b.logMessage = bp.logMessage
  return b
}

const STORE_KEY = (repoId) => `lc-breakpoints:${repoId}`
const val = (x) => (typeof x === 'function' ? x() : x)

// ── the store ─────────────────────────────────────────────────────────────────────────────────────────────────
export function createDebugger({ systemId, repoId, Connection = DapConnection, urlFor = dapSocketUrl, storage } = {}) {
  const store = storage === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : storage
  const breakpoints = reactive({})               // path -> [{line, condition, hitCondition, logMessage, verified}]
  const state = ref('idle')                      // idle | starting | running | paused | ended | error
  const error = ref('')
  const adapterState = ref('')                   // the socket's status: installing | starting | ready ...
  const configs = ref([])
  const selectedConfig = ref('')
  const frames = ref([])                         // [{id, name, path, line, column}]
  const selectedFrame = ref(null)
  const scopes = ref([])                         // [{name, ref, children, open}]
  const watches = ref([])                        // [{expr, value, error}]
  const consoleLines = ref([])                   // [{kind: out | err | in | result | info, text}]
  const panel = ref({ tab: '', at: 0 })
  let conn = null
  let root = ''
  let parent = null
  let active = null                              // the session that stopped (a js-debug child, or the only one)
  let stoppedThread = null
  let lastConfig = null
  let ctx = null
  let scope = null
  const disposables = []
  let decorations = null
  let painted = { path: null, n: 0 }
  let syncTimer = null
  const configured = new Set()

  function loadBreakpoints() {
    for (const k of Object.keys(breakpoints)) delete breakpoints[k]
    try { Object.assign(breakpoints, JSON.parse((store && store.getItem(STORE_KEY(val(repoId)))) || '{}')) } catch { /* none kept */ }
  }
  function saveBreakpoints() {
    // What a session said about a breakpoint belongs to that session, not to the next visit.
    const kept = (k, v) => (['ids', 'placed', 'verified'].includes(k) ? undefined : v)
    try { store && store.setItem(STORE_KEY(val(repoId)), JSON.stringify(breakpoints, kept)) } catch { /* kept for this visit */ }
  }
  loadBreakpoints()

  const abs = (p) => `${root.replace(/\/+$/, '')}/${String(p).replace(/^\/+/, '')}`
  const rel = (p) => { const base = root.replace(/\/+$/, '') + '/'; return p && p.startsWith(base) ? p.slice(base.length) : null }
  const say = (kind, text) => { consoleLines.value = [...consoleLines.value, { kind, text: String(text) }] }

  // ── breakpoints ──
  function toggleBreakpoint(path, line) {
    const list = [...(breakpoints[path] || [])]
    const i = list.findIndex((b) => b.line === line)
    if (i >= 0) list.splice(i, 1)
    else list.push({ line, condition: '', hitCondition: '', logMessage: '', verified: null })
    list.sort((a, b) => a.line - b.line)
    if (list.length) breakpoints[path] = list
    else delete breakpoints[path]
    saveBreakpoints()
    pushBreakpoints(path)
  }
  function updateBreakpoint(path, line, patch) {
    const b = (breakpoints[path] || []).find((x) => x.line === line)
    if (!b) return
    Object.assign(b, patch)
    saveBreakpoints()
    pushBreakpoints(path)
  }
  // A breakpoint is verified when any session placed it. js-debug's parent session never does; its child answers
  // "provisional" and confirms later with a `breakpoint` event, matched by the id its reply gave.
  function mark(b, sid, v) {
    b.ids = { ...b.ids, [sid]: v.id }
    b.placed = { ...b.placed, [sid]: !!v.verified }
    b.verified = Object.values(b.placed).some(Boolean)
  }
  let pushing = Promise.resolve()                // breakpoint changes the adapters have not answered yet
  async function pushBreakpoints(path, sessions) {
    paint()
    if (!conn || !root) return
    const list = breakpoints[path] || []
    // Every session's request is written now, in one go, so a Continue pressed after a change reaches the program
    // after it. Awaiting the parent's reply first once let a quick Continue hit a removed breakpoint again in the
    // child, where js-debug's program runs (ADM-1205 live check 2026-11-16).
    const done = Promise.all((sessions || [...conn.sessions.values()].filter((x) => configured.has(x.id))).map(async (s) => {
      try {
        const r = await s.request('setBreakpoints', { source: { path: abs(path) }, breakpoints: list.map(sourceBreakpoint) })
        ;(r.breakpoints || []).forEach((v, i) => { if (list[i]) mark(list[i], s.id, v) })
      } catch { /* a session that has ended */ }
    }))
    pushing = Promise.all([pushing, done])
    await done
    paint()
  }

  // ── configurations ──
  async function loadConfigs(activePath = ctx?.activeTab.value?.path || '') {
    const read = async (p) => { try { return (await api.getFileContent(val(systemId), val(repoId), p)).data?.content ?? null } catch { return null } }
    const [pkg, launch] = await Promise.all([read('package.json'), read('.vscode/launch.json')])
    const scripts = (pkg && (parseJsonc(pkg) || {}).scripts) || {}
    configs.value = configurations({ root: root || '${workspaceFolder}', activePath, scripts, launch: launch ? parseJsonc(launch) : null })
    if (!configs.value.find((c) => c.id === selectedConfig.value)) selectedConfig.value = configs.value[0]?.id || ''
  }

  // ── a debug session ──
  function start(id = selectedConfig.value) {
    const item = configs.value.find((c) => c.id === id)
    if (!item) { error.value = 'Choose what to run.'; return }
    stop({ quiet: true })
    // Session ids start again from 1 on a new connection: the last session's ids and answers would match wrongly.
    for (const list of Object.values(breakpoints)) for (const b of list) { delete b.ids; delete b.placed; b.verified = null }
    pushing = Promise.resolve()
    lastConfig = item
    state.value = 'starting'
    error.value = ''
    consoleLines.value = []
    panel.value = { tab: 'debug-console', at: Date.now() }
    const c = new Connection({ url: urlFor(val(repoId), item.adapter), onStatus: (s) => onStatus(c, item, s) })
    conn = c
    c.open()
  }

  function onStatus(c, item, s) {
    if (c !== conn) return
    adapterState.value = s.state
    if (s.state === 'installing') say('info', 'Installing the debugger in the project\'s sandbox (the first time takes a minute)…')
    if (s.state === 'ready') {
      root = s.root || root
      const config = JSON.parse(JSON.stringify(item.config).split('${workspaceFolder}').join(root))
      parent = c.session()
      runSession(parent, config, item.adapter)
    }
    if (s.state === 'error') { state.value = 'error'; error.value = s.error || 'The debugger could not start.' }
    if (['closed', 'exited'].includes(s.state)) {
      // The debugger's process ending while a session starts or runs is a failure, said as one; never a quiet "ended"
      // (it once hid that every Python session died at its start, ADM-1205 live check 2026-11-16).
      if (['starting', 'running', 'paused'].includes(state.value)) {
        fail(new Error(state.value === 'starting'
          ? 'The debugger stopped while it was starting. Try again; if it happens again, the Debug Console shows what it said.'
          : 'The debugger stopped before the program ended.'))
        frames.value = []; selectedFrame.value = null; scopes.value = []; configured.clear(); paint()
      } else if (state.value !== 'error') end()
    }
  }

  // Only the sessions of the connection in use count: after Restart, the old one's late events change nothing.
  const current = (s) => !!conn && s.conn === conn

  async function runSession(s, config, adapter, request = config.request) {
    s.onEvent = (ev, body) => { if (current(s)) onEvent(s, ev, body) }
    s.onRequest = (command, args) => {
      if (!current(s)) throw new Error('This debug session has ended.')
      // js-debug's child session for the process it started; its `request` says launch or attach.
      if (command === 'startDebugging') { runSession(conn.session(), args.configuration || {}, adapter, args.request); return {} }
      throw new Error(`${command} is not supported`)
    }
    try {
      await s.request('initialize', { clientID: 'aadml', clientName: 'AADML', adapterID: adapter === 'python' ? 'debugpy' : 'pwa-node',
        locale: 'en', linesStartAt1: true, columnsStartAt1: true, pathFormat: 'path', supportsVariableType: true,
        supportsStartDebuggingRequest: true, supportsRunInTerminalRequest: false })
    } catch (e) { if (current(s)) fail(e); return }
    // The launch answers after configurationDone (debugpy waits for it), so it is not awaited before.
    s.request(request === 'attach' ? 'attach' : 'launch', config).then(() => {
      if (current(s) && state.value === 'starting') state.value = 'running'
    }).catch((e) => { if (current(s)) fail(e) })
  }

  async function onEvent(s, ev, body) {
    if (ev === 'initialized') {
      configured.add(s.id)
      await Promise.all(Object.keys(breakpoints).map((p) => pushBreakpoints(p, [s])))
      await s.request('setExceptionBreakpoints', { filters: [] }).catch(() => {})
      await s.request('configurationDone', {}).catch(() => {})
      if (state.value === 'starting') state.value = 'running'
    } else if (ev === 'stopped') {
      active = s
      stoppedThread = body.threadId ?? null
      state.value = 'paused'
      await loadStack()
    } else if (ev === 'breakpoint') {
      const v = body.breakpoint || {}
      if (body.reason !== 'changed' || v.id == null) return
      for (const list of Object.values(breakpoints)) for (const b of list) if (b.ids && b.ids[s.id] === v.id) mark(b, s.id, v)
      paint()
    } else if (ev === 'continued') {
      if (s === active) clearPause()
    } else if (ev === 'output') {
      if (body.category === 'telemetry') return
      say(body.category === 'stderr' ? 'err' : 'out', String(body.output || '').replace(/\n$/, ''))
    } else if (ev === 'exited') {
      say('info', `The program ended with exit code ${body.exitCode}.`)
    } else if (ev === 'terminated' || ev === 'aadml.ended') {
      // AADML's bridge says why it stopped (its words are already in the console, as an output event).
      if (ev === 'aadml.ended' && body.error && state.value !== 'ended') {
        state.value = 'error'
        error.value = `The debugger stopped: ${body.error}`
      }
      configured.delete(s.id)
      if (s === parent || ![...configured].length) end()
    }
  }

  function fail(e) {
    if (state.value === 'ended') return
    state.value = 'error'
    error.value = (e && e.message) || 'The debugger stopped.'
    say('err', error.value)
  }

  function clearPause() {
    frames.value = []
    selectedFrame.value = null
    scopes.value = []
    state.value = state.value === 'paused' ? 'running' : state.value
    paint()
  }

  function end() {
    if (state.value !== 'error') state.value = 'ended'
    frames.value = []
    selectedFrame.value = null
    scopes.value = []
    configured.clear()
    paint()
  }

  async function loadStack() {
    if (!active) return
    try {
      const r = await active.request('stackTrace', { threadId: stoppedThread, startFrame: 0 })
      frames.value = (r.stackFrames || []).map((f) => ({ id: f.id, name: f.name, line: f.line, column: f.column,
        path: rel(f.source && f.source.path), source: f.source && (f.source.name || f.source.path) }))
      await selectFrame(frames.value.find((f) => f.path) || frames.value[0])
    } catch (e) { say('err', e.message) }
  }

  async function selectFrame(f) {
    selectedFrame.value = f || null
    scopes.value = []
    if (!f || !active) return
    if (f.path && ctx) ctx.openAt({ path: f.path, line: f.line, column: f.column || 1 })
    paint()
    try {
      const r = await active.request('scopes', { frameId: f.id })
      scopes.value = (r.scopes || []).map((sc) => ({ name: sc.name, ref: sc.variablesReference, expensive: !!sc.expensive, children: null, open: false }))
      const first = scopes.value.find((x) => !x.expensive)
      if (first) await expand(first)
    } catch (e) { say('err', e.message) }
    await refreshWatches()
  }

  /** The children of a scope or a variable, read when it is opened. */
  async function expand(node) {
    node.open = !node.open || node.children === null
    if (!node.open || node.children !== null || !active || !node.ref) return
    try {
      const r = await active.request('variables', { variablesReference: node.ref })
      node.children = (r.variables || []).map((v) => ({ name: v.name, value: v.value, type: v.type || '', ref: v.variablesReference || 0, children: null, open: false }))
    } catch (e) { node.children = []; say('err', e.message) }
    scopes.value = [...scopes.value]
  }

  async function evaluate(expression, context) {
    if (!active || !selectedFrame.value) throw new Error('The program is not paused.')
    const r = await active.request('evaluate', { expression, frameId: selectedFrame.value.id, context })
    return r.result
  }

  async function refreshWatches() {
    for (const w of watches.value) {
      try { w.value = await evaluate(w.expr, 'watch'); w.error = '' } catch (e) { w.value = ''; w.error = e.message }
    }
    watches.value = [...watches.value]
  }
  function addWatch(expr) { if (expr && expr.trim()) { watches.value = [...watches.value, { expr: expr.trim(), value: '', error: '' }]; refreshWatches() } }
  function removeWatch(i) { watches.value = watches.value.filter((_, j) => j !== i) }

  async function repl(expr) {
    if (!expr || !expr.trim()) return
    say('in', expr)
    try { say('result', await evaluate(expr, 'repl')) } catch (e) { say('err', e.message) }
  }

  // ── the controls ──
  async function step(command) {
    const s = active || parent
    if (!s) return
    if (command === 'pause') {
      const t = await s.request('threads', {}).catch(() => ({ threads: [] }))
      await s.request('pause', { threadId: (t.threads[0] && t.threads[0].id) || 0 }).catch((e) => say('err', e.message))
      return
    }
    clearPause()
    await pushing                                   // a breakpoint just removed is gone before the program moves
    await s.request(command, { threadId: stoppedThread ?? 0 }).catch((e) => say('err', e.message))
  }

  function stop({ quiet = false } = {}) {
    const c = conn
    if (!c) return
    for (const s of c.sessions.values()) s.request('disconnect', { terminateDebuggee: true }).catch(() => {})
    setTimeout(() => c.close(), 300)
    conn = null
    parent = null
    active = null
    configured.clear()
    if (!quiet) end()
  }

  function restart() { if (lastConfig) start(lastConfig.id) }

  async function startFromEditor() {
    if (!configs.value.length) await loadConfigs()
    if (configs.value.length) start()
  }

  /** While a session runs, VS Code's keys anywhere on the page: F5 continue, Shift+F5 stop, Ctrl+Shift+F5 restart,
   *  F6 pause, F10 step over, F11 step into, Shift+F11 step out. */
  function onKey(e) {
    if (!running.value || e.altKey || e.metaKey) return
    const k = e.key
    let act = null
    if (k === 'F5' && e.shiftKey) act = e.ctrlKey ? () => restart() : () => stop()
    else if (k === 'F5' && !e.ctrlKey) act = state.value === 'paused' ? () => step('continue') : () => {}
    else if (k === 'F6' && state.value === 'running') act = () => step('pause')
    else if (k === 'F10' && state.value === 'paused') act = () => step('next')
    else if (k === 'F11' && state.value === 'paused') act = () => step(e.shiftKey ? 'stepOut' : 'stepIn')
    if (!act) return
    e.preventDefault()
    e.stopPropagation()
    act()
  }

  // ── the editor: gutter breakpoints and the paused line ──
  function paint() {
    if (!ctx) return
    const monaco = ctx.monaco()
    const ed = ctx.editor()
    const tab = ctx.activeTab.value
    if (!monaco || !ed || !ed.createDecorationsCollection) return
    const path = tab && tab.type === 'file' ? tab.path : null
    const deco = []
    const list = (path && breakpoints[path]) || []
    painted = { path, n: list.length }
    for (const b of list) {
      const cls = b.logMessage ? 'lc-bp-log' : (b.condition || b.hitCondition) ? 'lc-bp-cond' : 'lc-bp'
      deco.push({ range: new monaco.Range(b.line, 1, b.line, 1), options: { glyphMarginClassName: `${cls}${b.verified === false ? ' lc-bp-unverified' : ''}`,
        glyphMarginHoverMessage: { value: b.logMessage ? `Logpoint: ${b.logMessage}` : b.condition ? `Breakpoint when ${b.condition}` : 'Breakpoint' } } })
    }
    const f = selectedFrame.value
    if (f && f.path === path) {
      deco.push({ range: new monaco.Range(f.line, 1, f.line, 1), options: { isWholeLine: true, className: 'lc-paused-line',
        glyphMarginClassName: 'lc-paused-arrow' } })
    }
    try {
      if (!decorations) decorations = ed.createDecorationsCollection(deco)
      else decorations.set(deco)
    } catch { /* the editor went away */ }
  }

  /** An edit above a breakpoint moves it with its line, as in VS Code: the decorations moved, so the lines follow. */
  function syncLines() {
    if (!decorations || !painted.path || typeof decorations.getRanges !== 'function') return
    const list = breakpoints[painted.path]
    const ranges = decorations.getRanges()
    if (!list || list.length !== painted.n || ranges.length < list.length) return
    let changed = false
    list.forEach((b, i) => { const line = ranges[i].startLineNumber; if (line !== b.line) { b.line = line; changed = true } })
    if (!changed) return
    const seen = new Set()
    breakpoints[painted.path] = list.filter((b) => !seen.has(b.line) && seen.add(b.line)).sort((a, b) => a.line - b.line)
    saveBreakpoints()
    pushBreakpoints(painted.path)
  }

  function bind(editorCtx) {
    unbind()
    ctx = editorCtx
    const monaco = ctx.monaco()
    const ed = ctx.editor()
    decorations = null
    if (ed && monaco) {
      try { ed.updateOptions({ glyphMargin: true }) } catch { /* noop */ }
      if (typeof ed.onMouseDown === 'function') {
        disposables.push(ed.onMouseDown((e) => {
          const t = e && e.target
          if (!t || t.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || !t.position) return
          const tab = ctx.activeTab.value
          if (tab && tab.type === 'file') toggleBreakpoint(tab.path, t.position.lineNumber)
        }))
      }
      if (typeof ed.addAction === 'function') {
        try {
          disposables.push(ed.addAction({ id: 'lets-code.toggle-breakpoint', label: 'Toggle Breakpoint',
            keybindings: [monaco.KeyCode.F9], contextMenuGroupId: 'debug', contextMenuOrder: 1,
            run: (e2) => { const tab = ctx.activeTab.value; if (tab && tab.type === 'file') toggleBreakpoint(tab.path, e2.getPosition().lineNumber) } }))
          // F5 in the editor starts the file's debugging (outside the editor F5 stays the browser's reload).
          disposables.push(ed.addAction({ id: 'lets-code.start-debugging', label: 'Start Debugging',
            keybindings: [monaco.KeyCode.F5], contextMenuGroupId: 'debug', contextMenuOrder: 2,
            run: () => { if (state.value === 'paused') step('continue'); else if (!running.value) startFromEditor() } }))
        } catch { /* an editor that cannot take actions keeps working without it */ }
      }
    }
    if (ed && typeof ed.onDidChangeModelContent === 'function') {
      // One model for every tab: another file's text replaces it whole (a flush), and the marks are drawn again.
      disposables.push(ed.onDidChangeModelContent((e) => {
        if (e && e.isFlush) { painted = { path: null, n: 0 }; paint(); return }
        clearTimeout(syncTimer)
        syncTimer = setTimeout(syncLines, 300)
      }))
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey, true)
      disposables.push({ dispose: () => window.removeEventListener('keydown', onKey, true) })
    }
    scope = effectScope(true)
    scope.run(() => {
      watch(() => ctx.activeTab.value && ctx.activeTab.value.path, (p) => { paint(); if (state.value === 'idle' || state.value === 'ended') loadConfigs(p) }, { immediate: true })
    })
    paint()
    const mine = editorCtx
    return () => { if (ctx === mine) unbind() }
  }

  function unbind() {
    clearTimeout(syncTimer)
    if (scope) { scope.stop(); scope = null }
    while (disposables.length) { try { disposables.pop().dispose() } catch { /* gone */ } }
    try { decorations && decorations.clear() } catch { /* gone */ }
    decorations = null
    ctx = null
  }

  function reset() {
    stop({ quiet: true })
    state.value = 'idle'
    error.value = ''
    consoleLines.value = []
    watches.value = []
    frames.value = []
    scopes.value = []
    configs.value = []
    root = ''
    loadBreakpoints()
    paint()
  }

  function dispose() { stop({ quiet: true }); unbind() }

  const breakpointList = computed(() => Object.entries(breakpoints).flatMap(([path, list]) => list.map((b) => ({ path, ...b }))))
  const running = computed(() => ['starting', 'running', 'paused'].includes(state.value))

  return { breakpoints, breakpointList, state, error, adapterState, configs, selectedConfig, frames, selectedFrame, scopes,
    watches, consoleLines, panel, running, toggleBreakpoint, updateBreakpoint, loadConfigs, start, stop, restart, step,
    selectFrame, expand, addWatch, removeWatch, repl, open: (b) => ctx && ctx.openAt({ path: b.path, line: b.line, column: 1 }),
    bind, unbind, reset, dispose }
}
