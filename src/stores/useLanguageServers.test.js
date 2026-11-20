// The editor's language servers (ADM-1205 phase F item 16): the LSP <-> Monaco conversions, and the store's flow
// with a stand-in connection: a server per language when its file is shown, initialize then didOpen, typing sent as
// didChange (and flushed before a request), save and close, diagnostics into Problems and the editor's markers,
// pyright asked for the whole project, Check project, and a new project starting from nothing.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

vi.mock('@/services/api', () => ({ default: { checkProjectProblems: vi.fn(), getFileContent: vi.fn(),
  saveFileContent: vi.fn(), formatRepositoryFile: vi.fn() } }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { useEditorSettings } from '@/composables/useEditorSettings'
import {
  createLanguageServers, serverFor, languageIdOf, toUri, pathOfUri, problemOf, rangeOf, positionOf,
  hoverContents, locationsOf, completionsOf, applyTextEdits, endOf, workspaceEditFiles, inlayHintsOf, lspRangeOf,
  leaveEditingToServers, RESOURCE_OPERATIONS_REFUSED, PROJECT_LOADING_WAIT_MS, RENAME_WAITING, RENAME_NOT_LOADED,
  RENAME_DONE_HERE, RENAME_NOTHING,
} from './useLanguageServers'

const ROOT = '/home/northrays/workspace/repo-4'

describe('conversions', () => {
  it('a file belongs to a server by its extension', () => {
    expect([serverFor('a.tsx'), serverFor('b.py'), serverFor('c.css'), languageIdOf('x.jsx'), languageIdOf('y.ts')])
      .toEqual(['typescript', 'python', null, 'javascriptreact', 'typescript'])
  })
  it('paths and file URIs, spaces included, and nothing outside the project', () => {
    const uri = toUri(ROOT, 'app/my page.tsx')
    expect(uri).toBe('file:///home/northrays/workspace/repo-4/app/my%20page.tsx')
    expect(pathOfUri(ROOT, uri)).toBe('app/my page.tsx')
    expect(pathOfUri(ROOT, 'file:///usr/lib/x.d.ts')).toBeNull()
  })
  it('positions and ranges are 0-based in LSP and 1-based in Monaco', () => {
    expect(positionOf({ lineNumber: 3, column: 5 })).toEqual({ line: 2, character: 4 })
    expect(rangeOf({ start: { line: 0, character: 0 }, end: { line: 1, character: 2 } }))
      .toEqual({ startLineNumber: 1, startColumn: 1, endLineNumber: 2, endColumn: 3 })
    expect(problemOf('a.ts', { range: { start: { line: 4, character: 2 }, end: { line: 4, character: 9 } },
      severity: 2, message: 'm', code: 6133, source: 'ts' })).toMatchObject({ line: 5, column: 3, severity: 'warning', code: '6133' })
  })
  it('hover contents of every shape', () => {
    expect(hoverContents({ kind: 'markdown', value: '**x**' })).toEqual([{ value: '**x**' }])
    expect(hoverContents([{ language: 'ts', value: 'const a: number' }, 'doc'])).toEqual([{ value: '```ts\nconst a: number\n```' }, { value: 'doc' }])
    expect(hoverContents(null)).toEqual([])
  })
  it('locations and location links', () => {
    const r = { start: { line: 1, character: 0 }, end: { line: 1, character: 3 } }
    expect(locationsOf({ uri: 'u', range: r })).toEqual([{ uri: 'u', range: r }])
    expect(locationsOf([{ targetUri: 'v', targetRange: r, targetSelectionRange: r }])).toEqual([{ uri: 'v', range: r }])
    expect(locationsOf(null)).toEqual([])
  })
  it('completion items keep their edit range, or take the word', () => {
    const word = { startLineNumber: 1, endLineNumber: 1, startColumn: 3, endColumn: 5 }
    const [a, b] = completionsOf({ items: [{ label: 'map', kind: 2 },
      { label: 'x', kind: 6, textEdit: { newText: 'xy', range: { start: { line: 0, character: 1 }, end: { line: 0, character: 2 } } } }] }, word)
    expect(a).toMatchObject({ label: 'map', kind: 0, insertText: 'map', range: word })
    expect(b).toMatchObject({ insertText: 'xy', kind: 4, range: { startLineNumber: 1, startColumn: 2 } })
  })
})

// A stand-in for LspConnection: records what is sent, answers initialize at once.
class FakeConnection {
  constructor(o) { Object.assign(this, o); this.state = 'closed'; this.sent = []; FakeConnection.made.push(this) }
  open() { this.state = 'connecting'; return this }
  close() { this.state = 'closed'; this.closed = true }
  ready() { this.state = 'ready'; this.onStatus({ state: 'ready', root: ROOT }) }
  request(method, params) { this.sent.push(['request', method, params]); return Promise.resolve(method === 'initialize' ? { capabilities: FakeConnection.caps } : null) }
  notify(method, params) { this.sent.push(['notify', method, params]); return true }
  methods() { return this.sent.map((x) => x[1]) }
}
FakeConnection.made = []
FakeConnection.caps = {}

function editorCtx() {
  const tabs = ref([{ id: 1, type: 'file', path: 'app/page.tsx', content: 'const a = 1', original: 'const a = 1' }])
  const activeId = ref(1)
  const activeTab = { get value() { return tabs.value.find((t) => t.id === activeId.value) } }
  // The editor's one model shows the active tab's text.
  const model = { uri: { toString: () => 'inmemory://1' }, getValue: () => activeTab.value.content,
    getOptions: () => ({ tabSize: 4, insertSpaces: true }),
    getWordAtPosition: () => ({ word: 'a', startColumn: 7, endColumn: 8 }),
    getValueInRange: (r) => activeTab.value.content.split(/\n/)[r.startLineNumber - 1].slice(r.startColumn - 1, r.endColumn - 1) }
  const providers = {}
  const reg = (kind) => vi.fn((lang, p) => { (providers[kind] ||= {})[lang] = p; return { dispose: vi.fn() } })
  const commands = {}
  const monaco = { MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
    Uri: { parse: (u) => ({ toString: () => u }) },
    editor: { setModelMarkers: vi.fn(), registerEditorOpener: vi.fn((o) => { providers.opener = o; return { dispose: vi.fn() } }),
      registerCommand: vi.fn((id, fn) => { commands[id] = fn; return { dispose: vi.fn() } }) },
    languages: { registerHoverProvider: reg('hover'), registerCompletionItemProvider: reg('completion'),
      registerSignatureHelpProvider: reg('signature'), registerDefinitionProvider: reg('definition'),
      registerRenameProvider: reg('rename'), registerCodeActionProvider: reg('codeAction'),
      registerInlayHintsProvider: reg('inlay'), registerDocumentFormattingEditProvider: reg('formatting'),
      registerDocumentRangeFormattingEditProvider: reg('rangeFormatting') } }
  // As CodeBrowser's editOpenFile: a file open in a tab takes the edits in its text; null when it is not open.
  const editOpenFile = vi.fn((path, edits) => {
    const tab = tabs.value.find((t) => t.type === 'file' && t.path === path)
    if (!tab) return null
    tab.content = applyTextEdits(tab.content, edits)
    return tab.content
  })
  return { model, monaco, providers, commands, tabs, activeId, ctx: { monaco: () => monaco, editor: () => ({ getModel: () => model }),
    activeTab, openTabs: tabs, openAt: vi.fn(), editOpenFile } }
}

describe('the store', () => {
  beforeEach(() => { FakeConnection.made = []; FakeConnection.caps = {}; vi.useRealTimers() })

  it('starts the server of the file shown, initialises it, then opens the files in tabs', async () => {
    const e = editorCtx()
    const s = createLanguageServers({ systemId: 5, repoId: 4, Connection: FakeConnection, urlFor: (r, l) => `${r}/${l}` })
    s.bind(e.ctx)
    expect(FakeConnection.made.map((c) => c.url)).toEqual(['4/typescript'])
    const c = FakeConnection.made[0]
    c.ready()
    await Promise.resolve(); await Promise.resolve()
    expect(c.methods()).toEqual(['initialize', 'initialized', 'workspace/didChangeConfiguration', 'textDocument/didOpen'])
    expect(c.sent[2][2]).toEqual({ settings: {} })
    expect(c.sent[0][2].rootUri).toBe('file:///home/northrays/workspace/repo-4')
    expect(c.sent[3][2].textDocument).toMatchObject({ uri: toUri(ROOT, 'app/page.tsx'), languageId: 'typescriptreact', version: 1 })
    expect(s.servers.typescript.state).toBe('ready')
  })

  it('typing is sent as didChange, saving as didSave, closing the tab as didClose', async () => {
    vi.useFakeTimers()
    const e = editorCtx()
    const s = createLanguageServers({ repoId: 4, Connection: FakeConnection, urlFor: () => 'u' })
    s.bind(e.ctx)
    const c = FakeConnection.made[0]
    c.ready()
    await vi.runAllTimersAsync()
    e.tabs.value[0].content = 'const a = 2'
    await nextTick()
    await vi.advanceTimersByTimeAsync(200)
    const change = c.sent.find((x) => x[1] === 'textDocument/didChange')[2]
    expect(change).toMatchObject({ textDocument: { version: 2 }, contentChanges: [{ text: 'const a = 2' }] })
    e.tabs.value[0].original = 'const a = 2'
    await nextTick()
    expect(c.methods()).toContain('textDocument/didSave')
    e.tabs.value = []
    await nextTick()
    expect(c.methods().at(-1)).toBe('textDocument/didClose')
  })

  it("diagnostics fill Problems and the open file's markers; node_modules is left out", async () => {
    const e = editorCtx()
    const s = createLanguageServers({ repoId: 4, Connection: FakeConnection, urlFor: () => 'u' })
    s.bind(e.ctx)
    const c = FakeConnection.made[0]
    c.ready()
    await Promise.resolve(); await Promise.resolve()
    const d = { range: { start: { line: 0, character: 6 }, end: { line: 0, character: 7 } }, severity: 1, message: 'bad', source: 'ts', code: 2322 }
    c.onNotification('textDocument/publishDiagnostics', { uri: toUri(ROOT, 'app/page.tsx'), diagnostics: [d] })
    c.onNotification('textDocument/publishDiagnostics', { uri: toUri(ROOT, 'node_modules/x/i.d.ts'), diagnostics: [d] })
    expect(s.problems.value.map((p) => [p.path, p.line, p.column, p.severity])).toEqual([['app/page.tsx', 1, 7, 'error']])
    expect(s.counts.value).toEqual({ errors: 1, warnings: 0 })
    const markers = e.monaco.editor.setModelMarkers.mock.calls.at(-1)
    expect(markers[0]).toBe(e.model)
    expect(markers[2]).toEqual([expect.objectContaining({ startLineNumber: 1, startColumn: 7, message: 'bad', severity: 8 })])
    c.onNotification('textDocument/publishDiagnostics', { uri: toUri(ROOT, 'app/page.tsx'), diagnostics: [] })
    expect(s.problems.value).toEqual([])
  })

  it('pyright is asked to report the whole project', () => {
    const e = editorCtx()
    e.tabs.value = [{ id: 1, type: 'file', path: 'main.py', content: 'x = 1' }]
    const s = createLanguageServers({ repoId: 4, Connection: FakeConnection, urlFor: (r, l) => l })
    s.bind(e.ctx)
    const c = FakeConnection.made[0]
    expect(c.url).toBe('python')
    expect(c.onRequest('workspace/configuration', { items: [{ section: 'python.analysis' }, { section: 'other' }] }))
      .toEqual([{ diagnosticMode: 'workspace' }, null])
    expect(c.onRequest('client/registerCapability', {})).toBeNull()
  })

  it("pyright is told its settings after initialized (it does nothing until then)", async () => {
    const e = editorCtx()
    e.tabs.value = [{ id: 1, type: 'file', path: 'main.py', content: 'x = 1' }]
    const s = createLanguageServers({ repoId: 4, Connection: FakeConnection, urlFor: (r, l) => l })
    s.bind(e.ctx)
    const c = FakeConnection.made[0]
    c.ready()
    await Promise.resolve(); await Promise.resolve()
    const i = c.methods().indexOf('workspace/didChangeConfiguration')
    expect(i).toBe(c.methods().indexOf('initialized') + 1)
    expect(c.sent[i][2]).toEqual({ settings: { python: { analysis: { diagnosticMode: 'workspace' } } } })
  })

  it("Check project adds tsc's problems, and says when there is no compiler", async () => {
    const s = createLanguageServers({ systemId: 5, repoId: () => 4, Connection: FakeConnection, urlFor: () => 'u' })
    api.checkProjectProblems.mockResolvedValueOnce({ data: { ran: true, problems: [
      { path: 'src/a.ts', line: 3, column: 5, severity: 'error', code: 'TS2322', message: 'm', source: 'tsc' }] } })
    await s.check()
    expect(api.checkProjectProblems).toHaveBeenCalledWith(5, 4)
    expect(s.problems.value).toHaveLength(1)
    api.checkProjectProblems.mockResolvedValueOnce({ data: { ran: false, problems: [], error: 'Install its packages' } })
    await s.check()
    expect(s.checkError.value).toBe('Install its packages')
  })

  it('a row opens its place; another project starts from nothing and its servers end', async () => {
    const e = editorCtx()
    const s = createLanguageServers({ repoId: 4, Connection: FakeConnection, urlFor: () => 'u' })
    s.bind(e.ctx)
    s.open({ path: 'src/a.ts', line: 3, column: 5 })
    expect(e.ctx.openAt).toHaveBeenCalledWith({ path: 'src/a.ts', line: 3, column: 5 })
    s.reset()
    expect(FakeConnection.made[0].closed).toBe(true)
    expect(Object.keys(s.servers)).toEqual([])
  })

  it('hover asks the server about the active file; another file named by definition opens through openAt', async () => {
    const e = editorCtx()
    const s = createLanguageServers({ repoId: 4, Connection: FakeConnection, urlFor: () => 'u' })
    s.bind(e.ctx)
    const c = FakeConnection.made[0]
    c.ready()
    await Promise.resolve(); await Promise.resolve()
    c.request = vi.fn(async (m) => (m === 'textDocument/hover' ? { contents: { kind: 'markdown', value: 'const a: 1' } }
      : [{ uri: toUri(ROOT, 'lib/util.ts'), range: { start: { line: 9, character: 2 }, end: { line: 9, character: 6 } } }]))
    const hover = await e.providers.hover.typescript.provideHover(e.model, { lineNumber: 1, column: 7 })
    expect(c.request).toHaveBeenCalledWith('textDocument/hover', { textDocument: { uri: toUri(ROOT, 'app/page.tsx') },
      position: { line: 0, character: 6 } })
    expect(hover.contents).toEqual([{ value: 'const a: 1' }])
    const [loc] = await e.providers.definition.typescript.provideDefinition(e.model, { lineNumber: 1, column: 7 })
    expect(loc.range.startLineNumber).toBe(10)
    expect(e.providers.opener.openCodeEditor(null, { toString: () => toUri(ROOT, 'lib/util.ts') },
      { startLineNumber: 10, startColumn: 3 })).toBe(true)
    expect(e.ctx.openAt).toHaveBeenCalledWith({ path: 'lib/util.ts', line: 10, column: 3 })
    // Another model (a diff's side) is not the editor's file: nothing is asked.
    expect(await e.providers.hover.typescript.provideHover({}, { lineNumber: 1, column: 1 })).toBeNull()
  })

  it("typing reaches the server from the editor's own change event, even when bound inside a component that goes", async () => {
    vi.useFakeTimers()
    const { effectScope } = await import('vue')
    const e = editorCtx()
    let listener = null
    const model = { uri: e.model.uri, getValue: () => 'const a = 3' }
    e.ctx.editor = () => ({ getModel: () => model, onDidChangeModelContent: (fn) => { listener = fn; return { dispose: vi.fn() } } })
    const s = createLanguageServers({ repoId: 4, Connection: FakeConnection, urlFor: () => 'u' })
    const mounting = effectScope()
    mounting.run(() => s.bind(e.ctx))       // as from the editor component's mount hook
    mounting.stop()                          // that component goes: the binding stays
    const c = FakeConnection.made[0]
    c.ready()
    await vi.runAllTimersAsync()
    listener()
    await vi.advanceTimersByTimeAsync(200)
    expect(c.sent.find((x) => x[1] === 'textDocument/didChange')[2].contentChanges).toEqual([{ text: 'const a = 3' }])
    e.tabs.value[0].original = 'const a = 3'
    await nextTick()
    expect(c.methods()).toContain('textDocument/didSave')
  })

  it("Monaco's own TypeScript features are switched off where Monaco 0.57 keeps them", async () => {
    const e = editorCtx()
    const defaults = () => ({ setDiagnosticsOptions: vi.fn(), setModeConfiguration: vi.fn() })
    e.monaco.typescript = { typescriptDefaults: defaults(), javascriptDefaults: defaults() }
    e.monaco.languages.typescript = { deprecated: true }
    const s = createLanguageServers({ repoId: 4, Connection: FakeConnection, urlFor: () => 'u' })
    s.bind(e.ctx)
    FakeConnection.made[0].ready()
    await Promise.resolve(); await Promise.resolve()
    expect(e.monaco.typescript.typescriptDefaults.setModeConfiguration).toHaveBeenCalledWith(expect.objectContaining({ hovers: false, diagnostics: false }))
    expect(e.monaco.typescript.javascriptDefaults.setDiagnosticsOptions).toHaveBeenCalledWith(expect.objectContaining({ noSemanticValidation: true }))
  })

  it("an old editor's release never tears down a newer editor's binding", async () => {
    const a = editorCtx()
    const b = editorCtx()
    const s = createLanguageServers({ repoId: 4, Connection: FakeConnection, urlFor: () => 'u' })
    const releaseA = s.bind(a.ctx)
    s.bind(b.ctx)                 // the re-created editor binds first ...
    releaseA()                    // ... then the old one unmounts
    s.open({ path: 'x.ts', line: 1, column: 1 })
    expect(b.ctx.openAt).toHaveBeenCalled()
    expect(a.ctx.openAt).not.toHaveBeenCalled()
  })
})

describe('text edits and workspace edits (ADM-1319)', () => {
  const r = (l1, c1, l2, c2) => ({ start: { line: l1, character: c1 }, end: { line: l2, character: c2 } })
  it('edits are read in the text as it was, across LF and CRLF lines, and inserts at one place keep their order', () => {
    expect(applyTextEdits('let a = 1\nlet b = a\n', [{ range: r(0, 4, 0, 5), newText: 'total' },
      { range: r(1, 8, 1, 9), newText: 'total' }])).toBe('let total = 1\nlet b = total\n')
    expect(applyTextEdits('one\r\ntwo', [{ range: r(1, 0, 1, 3), newText: 'TWO' }, { range: r(0, 3, 0, 99), newText: '!' }]))
      .toBe('one!\r\nTWO')
    expect(applyTextEdits('x', [{ range: r(0, 0, 0, 0), newText: 'a' }, { range: r(0, 0, 0, 0), newText: 'b' }])).toBe('abx')
    expect(endOf('a\nbc')).toEqual({ line: 1, character: 2 })
    expect(lspRangeOf({ startLineNumber: 2, startColumn: 3, endLineNumber: 2, endColumn: 5 })).toEqual(r(1, 2, 1, 4))
  })
  it('a workspace edit names its files; one that creates, renames or deletes a file is refused whole', () => {
    expect(workspaceEditFiles({ changes: { u1: [{ range: r(0, 0, 0, 1), newText: 'x' }] } }).files)
      .toEqual([{ uri: 'u1', version: null, steps: [[{ range: r(0, 0, 0, 1), newText: 'x' }]] }])
    expect(workspaceEditFiles({ documentChanges: [{ textDocument: { uri: 'u1', version: 3 }, edits: [] },
      { kind: 'rename', oldUri: 'u1', newUri: 'u2' }] })).toEqual({ files: [], refused: RESOURCE_OPERATIONS_REFUSED })
  })
  it('inlay hints become Monaco hints', () => {
    expect(inlayHintsOf([{ position: { line: 2, character: 5 }, label: ': number', kind: 1, paddingLeft: true },
      { position: { line: 0, character: 0 }, label: [{ value: 'x:', tooltip: { kind: 'markdown', value: 'the x' } }], kind: 2 }]))
      .toEqual([
        { label: ': number', position: { lineNumber: 3, column: 6 }, kind: 1, paddingLeft: true, paddingRight: false, tooltip: undefined },
        { label: [{ label: 'x:', tooltip: { value: 'the x' } }], position: { lineNumber: 1, column: 1 }, kind: 2,
          paddingLeft: false, paddingRight: false, tooltip: undefined },
      ])
  })
  it("Monaco's own TypeScript rename, code actions, inlay hints and formatting are never registered", () => {
    const d = () => ({ modeConfiguration: { hovers: true, rename: true }, setModeConfiguration: vi.fn() })
    const monaco = { typescript: { typescriptDefaults: d(), javascriptDefaults: d() } }
    leaveEditingToServers(monaco)
    expect(monaco.typescript.typescriptDefaults.setModeConfiguration).toHaveBeenCalledWith({ hovers: true, rename: false,
      codeActions: false, inlayHints: false, documentRangeFormattingEdits: false })
  })
})

describe('editing through the language servers (ADM-1319)', () => {
  const SHA = 'a'.repeat(64)
  const r = (l1, c1, l2, c2) => ({ start: { line: l1, character: c1 }, end: { line: l2, character: c2 } })
  const PAGE = toUri(ROOT, 'app/page.tsx')
  const UTIL = toUri(ROOT, 'lib/util.ts')
  const CHANGED = { response: { status: 409, data: { code: 'CHANGED_ON_DISK', error: 'changed' } } }

  beforeEach(() => {
    FakeConnection.made = []
    FakeConnection.caps = { renameProvider: { prepareProvider: true }, codeActionProvider: { resolveProvider: true },
      inlayHintProvider: true, documentFormattingProvider: true, documentRangeFormattingProvider: true }
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  async function ready(e = editorCtx()) {
    const s = createLanguageServers({ systemId: 5, repoId: 4, Connection: FakeConnection, urlFor: () => 'u' })
    s.bind(e.ctx)
    const c = FakeConnection.made[0]
    c.ready()
    await Promise.resolve(); await Promise.resolve()
    return { e, s, c }
  }
  // The server's answers by method.
  const answers = (c, map) => { c.request = vi.fn(async (m, p) => (typeof map[m] === 'function' ? map[m](p) : map[m] ?? null)) }

  it('F2 asks prepareRename for the name and its place', async () => {
    const { e, c } = await ready()
    answers(c, { 'textDocument/prepareRename': r(0, 6, 0, 7) })
    const loc = await e.providers.rename.typescript.resolveRenameLocation(e.model, { lineNumber: 1, column: 7 })
    expect(c.request).toHaveBeenCalledWith('textDocument/prepareRename', { textDocument: { uri: PAGE }, position: { line: 0, character: 6 } })
    expect(loc).toEqual({ range: { startLineNumber: 1, startColumn: 7, endLineNumber: 1, endColumn: 8 }, text: 'a' })
    answers(c, { 'textDocument/prepareRename': null })
    expect((await e.providers.rename.typescript.resolveRenameLocation(e.model, { lineNumber: 1, column: 7 })).rejectReason)
      .toBe('This cannot be renamed.')
  })

  it('a rename in two files changes the open tab in place and writes the closed file with the sha it was read at', async () => {
    const { e, c } = await ready()
    answers(c, { 'textDocument/rename': { documentChanges: [
      { textDocument: { uri: PAGE, version: 1 }, edits: [{ range: r(0, 6, 0, 7), newText: 'total' }] },
      { textDocument: { uri: UTIL, version: null }, edits: [{ range: r(1, 9, 1, 10), newText: 'total' }] }] } })
    api.getFileContent.mockResolvedValueOnce({ data: { content: 'import { a } from "../app/page"\nexport { a }\n', sha: SHA } })
    api.saveFileContent.mockResolvedValueOnce({ data: { sha: 'b'.repeat(64) } })
    const out = await e.providers.rename.typescript.provideRenameEdits(e.model, { lineNumber: 1, column: 7 }, 'total')
    expect(c.request).toHaveBeenCalledWith('textDocument/rename', { textDocument: { uri: PAGE }, position: { line: 0, character: 6 }, newName: 'total' })
    // applied here, not by Monaco; the rejectReason keeps Monaco from announcing "Made 0 edits in 0 files"
    expect(out).toEqual({ edits: [], rejectReason: RENAME_DONE_HERE })
    expect(e.tabs.value[0].content).toBe('const total = 1')
    expect(e.tabs.value[0].original).toBe('const a = 1')                     // unsaved: the person saves it
    expect(api.getFileContent).toHaveBeenCalledWith(5, 4, 'lib/util.ts')
    expect(api.saveFileContent).toHaveBeenCalledWith(5, 4, 'lib/util.ts', 'import { a } from "../app/page"\nexport { total }\n', SHA)
    expect(notify.success).toHaveBeenCalledWith('Renamed in 2 files')
  })

  // ADM-1335: while tsserver loads the project, the server answers a rename from its syntax-only server (open files
  // only). It reports the load as progress; a rename waits for it and is never applied from a load's half-answer.
  const TWO_FILES = { changes: { [PAGE]: [{ range: r(0, 6, 0, 7), newText: 'total' }],
    [UTIL]: [{ range: r(1, 9, 1, 10), newText: 'total' }] } }
  const ONLY_OPEN = { changes: { [PAGE]: [{ range: r(0, 6, 0, 7), newText: 'total' }] } }
  const loadStarts = (c, token) => c.onRequest('window/workDoneProgress/create', { token })
  const loadEnds = (c, token) => c.onNotification('$/progress', { token, value: { kind: 'end' } })

  it('says it understands progress, so the TypeScript server reports a project load', async () => {
    const { c } = await ready()
    const init = FakeConnection.made[0].sent.find(([, m]) => m === 'initialize')
    expect(init[2].capabilities.window).toEqual({ workDoneProgress: true })
    expect(loadStarts(c, 't1')).toBeNull()                                  // the server's create is answered
  })

  it('a rename pressed while the project loads waits for the load, then reaches every file', async () => {
    const { e, c } = await ready()
    answers(c, { 'textDocument/rename': TWO_FILES })
    api.getFileContent.mockResolvedValueOnce({ data: { content: 'x\nexport { a }\n', sha: SHA } })
    api.saveFileContent.mockResolvedValueOnce({ data: { sha: 'b'.repeat(64) } })
    loadStarts(c, 'load-1')
    c.onNotification('$/progress', { token: 'load-1', value: { kind: 'begin', title: 'Initializing JS/TS language features…' } })
    const pending = e.providers.rename.typescript.provideRenameEdits(e.model, { lineNumber: 1, column: 7 }, 'total')
    await Promise.resolve(); await Promise.resolve()
    expect(notify.info).toHaveBeenCalledWith(RENAME_WAITING)
    expect(c.request).not.toHaveBeenCalledWith('textDocument/rename', expect.anything())   // nothing asked mid-load
    loadEnds(c, 'load-1')
    await pending
    expect(c.request).toHaveBeenCalledTimes(1)
    expect(api.saveFileContent).toHaveBeenCalledWith(5, 4, 'lib/util.ts', 'x\nexport { total }\n', SHA)
    expect(notify.success).toHaveBeenCalledWith('Renamed in 2 files')
  })

  it('a load that begins while the rename is asked: its answer is dropped and the rename is asked again after', async () => {
    const { e, c } = await ready()
    api.getFileContent.mockResolvedValueOnce({ data: { content: 'x\nexport { a }\n', sha: SHA } })
    api.saveFileContent.mockResolvedValueOnce({ data: { sha: 'b'.repeat(64) } })
    let n = 0
    answers(c, { 'textDocument/rename': () => {
      n += 1
      if (n === 1) { loadStarts(c, 'load-2'); setTimeout(() => loadEnds(c, 'load-2'), 0); return ONLY_OPEN }
      return TWO_FILES
    } })
    await e.providers.rename.typescript.provideRenameEdits(e.model, { lineNumber: 1, column: 7 }, 'total')
    expect(n).toBe(2)
    expect(api.saveFileContent).toHaveBeenCalledTimes(1)                    // lib/util.ts too: the whole answer
    expect(notify.success).toHaveBeenCalledWith('Renamed in 2 files')
  })

  it('a load that never ends renames nothing and says so', async () => {
    vi.useFakeTimers()
    const { e, c } = await ready()
    answers(c, { 'textDocument/rename': TWO_FILES })
    loadStarts(c, 'stuck')
    const pending = e.providers.rename.typescript.provideRenameEdits(e.model, { lineNumber: 1, column: 7 }, 'total')
    await vi.advanceTimersByTimeAsync(PROJECT_LOADING_WAIT_MS + 1)
    await pending
    expect(c.request).not.toHaveBeenCalledWith('textDocument/rename', expect.anything())
    expect(notify.warning).toHaveBeenCalledWith(RENAME_NOT_LOADED)
    expect(e.tabs.value[0].content).toBe('const a = 1')                     // nothing changed
    vi.useRealTimers()
  })

  it('no rename answer leaves Monaco an edit to announce: each says what happened as its rejectReason (live, 2026-11-20)', async () => {
    const { e, c } = await ready()
    const at = { lineNumber: 1, column: 7 }
    answers(c, { 'textDocument/rename': null })
    expect(await e.providers.rename.typescript.provideRenameEdits(e.model, at, 'total')).toEqual({ edits: [], rejectReason: RENAME_NOTHING })
    c.request = vi.fn(async () => { throw new Error('server gone') })
    expect(await e.providers.rename.typescript.provideRenameEdits(e.model, at, 'total'))
      .toEqual({ edits: [], rejectReason: 'Nothing was renamed: server gone' })
    expect(notify.error).toHaveBeenCalledWith('Nothing was renamed: server gone')   // the person's notification
  })

  it('a closed file changed on disk meanwhile is reported and never overwritten', async () => {
    const { e, c } = await ready()
    answers(c, { 'textDocument/rename': { changes: {
      [PAGE]: [{ range: r(0, 6, 0, 7), newText: 'total' }], [UTIL]: [{ range: r(0, 0, 0, 1), newText: 'total' }] } } })
    api.getFileContent.mockResolvedValueOnce({ data: { content: 'a', sha: SHA } })
    api.saveFileContent.mockRejectedValueOnce(CHANGED)
    await e.providers.rename.typescript.provideRenameEdits(e.model, { lineNumber: 1, column: 7 }, 'total')
    expect(api.saveFileContent).toHaveBeenCalledTimes(1)
    expect(api.saveFileContent.mock.calls[0][4]).toBe(SHA)
    expect(notify.error).toHaveBeenCalledWith('Renamed in 1 file. This file was not changed: '
      + 'lib/util.ts (it changed in the project meanwhile, so it was not overwritten).')
    expect(notify.success).not.toHaveBeenCalled()
  })

  it('code actions are asked for the range with its problems; an edit is applied, a command is run, resolve when needed', async () => {
    const { e, c } = await ready()
    const d = { range: r(0, 6, 0, 7), severity: 1, message: 'unused', code: 6133, source: 'typescript' }
    c.onNotification('textDocument/publishDiagnostics', { uri: PAGE, diagnostics: [d, { ...d, range: r(5, 0, 5, 1) }] })
    const fix = { title: 'Rename to b', kind: 'quickfix', edit: { changes: { [PAGE]: [{ range: r(0, 6, 0, 7), newText: 'b' }] } } }
    const organize = { title: 'Organize imports', command: '_typescript.organizeImports', arguments: ['x'] }
    const lazy = { title: 'Extract constant', kind: 'refactor.extract', data: { id: 1 } }
    answers(c, { 'textDocument/codeAction': [fix, organize, lazy],
      'codeAction/resolve': (a) => ({ ...a, edit: { changes: { [PAGE]: [{ range: r(0, 10, 0, 11), newText: 'ONE' }] } } }) })
    const range = { startLineNumber: 1, startColumn: 7, endLineNumber: 1, endColumn: 7 }
    const { actions } = await e.providers.codeAction.typescript.provideCodeActions(e.model, range, { trigger: 1 })
    expect(c.request).toHaveBeenCalledWith('textDocument/codeAction', { textDocument: { uri: PAGE },
      range: r(0, 6, 0, 6), context: { diagnostics: [d], triggerKind: 1 } })
    expect(actions.map((a) => [a.title, a.kind])).toEqual([['Rename to b', 'quickfix'], ['Organize imports', undefined],
      ['Extract constant', 'refactor.extract']])
    const run = (a) => e.commands[a.command.id](null, ...a.command.arguments)

    await run(actions[0])
    expect(e.tabs.value[0].content).toBe('const b = 1')
    await run(actions[1])
    expect(c.request).toHaveBeenCalledWith('workspace/executeCommand', { command: '_typescript.organizeImports', arguments: ['x'] })
    await run(actions[2])
    expect(c.request).toHaveBeenCalledWith('codeAction/resolve', lazy)
    expect(e.tabs.value[0].content).toBe('const b = ONE')
    expect(notify.error).not.toHaveBeenCalled()
  })

  it("the server's workspace/applyEdit is applied and answered; a file operation is refused and changes nothing", async () => {
    const { e, c } = await ready()
    expect(await c.onRequest('workspace/applyEdit', { edit: { changes: { [PAGE]: [{ range: r(0, 0, 0, 5), newText: 'let' }] } } }))
      .toEqual({ applied: true })
    expect(e.tabs.value[0].content).toBe('let a = 1')
    const refused = await c.onRequest('workspace/applyEdit', { edit: { documentChanges: [
      { textDocument: { uri: PAGE, version: null }, edits: [{ range: r(0, 0, 0, 3), newText: 'var' }] },
      { kind: 'create', uri: toUri(ROOT, 'new.ts') }] } })
    expect(refused).toEqual({ applied: false, failureReason: RESOURCE_OPERATIONS_REFUSED })
    expect(e.tabs.value[0].content).toBe('let a = 1')
    expect(api.getFileContent).not.toHaveBeenCalled()
    expect(api.saveFileContent).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith(RESOURCE_OPERATIONS_REFUSED)
  })

  it('inlay hints are asked for the range shown and mapped', async () => {
    const { e, c } = await ready()
    answers(c, { 'textDocument/inlayHint': [{ position: { line: 0, character: 7 }, label: ': 1', kind: 1 }] })
    const { hints } = await e.providers.inlay.typescript.provideInlayHints(e.model,
      { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 12 })
    expect(c.request).toHaveBeenCalledWith('textDocument/inlayHint', { textDocument: { uri: PAGE }, range: r(0, 0, 0, 11) })
    expect(hints).toEqual([expect.objectContaining({ label: ': 1', position: { lineNumber: 1, column: 8 }, kind: 1 })])
  })

  it('TypeScript is formatted by its server with the editor tab size', async () => {
    const { e, c } = await ready()
    const { settings } = useEditorSettings()
    settings.tabSize = 2
    answers(c, { 'textDocument/formatting': [{ range: r(0, 5, 0, 6), newText: ' ' }] })
    const edits = await e.providers.formatting.typescript.provideDocumentFormattingEdits(e.model)
    expect(c.request).toHaveBeenCalledWith('textDocument/formatting', { textDocument: { uri: PAGE }, options: { tabSize: 2, insertSpaces: true } })
    expect(edits).toEqual([{ range: { startLineNumber: 1, startColumn: 6, endLineNumber: 1, endColumn: 7 }, text: ' ' }])
    settings.tabSize = 'auto'
  })

  it('Python is formatted by the project formatter: the text is replaced only when it changed; a refusal keeps it', async () => {
    const e = editorCtx()
    e.tabs.value = [{ id: 1, type: 'file', path: 'main.py', content: 'x=1\n', original: 'x=1\n' }]
    const s = createLanguageServers({ systemId: 5, repoId: 4, Connection: FakeConnection, urlFor: () => 'u' })
    s.bind(e.ctx)                                                            // pyright need not be ready
    const format = e.providers.formatting.python
    api.formatRepositoryFile.mockResolvedValueOnce({ data: { content: 'x = 1\n', formatter: 'ruff', changed: true } })
    expect(await format.provideDocumentFormattingEdits(e.model)).toEqual([{
      range: { startLineNumber: 1, startColumn: 1, endLineNumber: 2, endColumn: 1 }, text: 'x = 1\n' }])
    expect(api.formatRepositoryFile).toHaveBeenCalledWith(5, 4, 'main.py', 'x=1\n')
    api.formatRepositoryFile.mockResolvedValueOnce({ data: { content: 'x=1\n', formatter: 'ruff', changed: false } })
    expect(await format.provideDocumentFormattingEdits(e.model)).toEqual([])
    api.formatRepositoryFile.mockRejectedValueOnce({ response: { status: 422,
      data: { error: 'The formatter could not read main.py.', code: 'FORMAT_FAILED', detail: 'error: line 1: invalid syntax' } } })
    expect(await format.provideDocumentFormattingEdits(e.model)).toEqual([])
    expect(notify.error).toHaveBeenCalledWith('The file was not formatted: The formatter could not read main.py. error: line 1: invalid syntax')
    expect(e.tabs.value[0].content).toBe('x=1\n')
    expect(s.canFormat('main.py')).toBe(true)
    expect(s.canFormat('README.md')).toBe(false)
  })

  function pythonFormat(project = { systemId: 5, repoId: 4 }) {
    const e = editorCtx()
    e.tabs.value = [{ id: 1, type: 'file', path: 'main.py', content: 'x=1\n', original: 'x=1\n' }]
    const s = createLanguageServers({ ...project, Connection: FakeConnection, urlFor: () => 'u' })
    s.bind(e.ctx)
    return { e, s, format: e.providers.formatting.python }
  }
  const PREPARING = 'Python formatting is being set up in your project (first time only). Try again in a minute.'
  const preparing = () => ({ response: { status: 503,
    data: { error: PREPARING, code: 'FORMATTER_PREPARING', retry_after_seconds: 30 } } })

  it('Python formatting being set up: one info notification with the server words, the text kept, no retry', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-11-19T10:00:00Z'))
      const { e, format } = pythonFormat()
      const timers = vi.getTimerCount()
      api.formatRepositoryFile.mockRejectedValueOnce(preparing())
      expect(await format.provideDocumentFormattingEdits(e.model)).toEqual([])
      expect(api.formatRepositoryFile).toHaveBeenCalledTimes(1)                   // whileSandboxStarts did not wait
      expect(notify.info).toHaveBeenCalledTimes(1)
      expect(notify.info).toHaveBeenCalledWith(PREPARING)
      expect(notify.error).not.toHaveBeenCalled()
      expect(e.tabs.value[0].content).toBe('x=1\n')
      expect(vi.getTimerCount()).toBe(timers)                                     // nothing scheduled to try again
      // Pressed again within the server's 30 s: the server is asked (setup may be done) but nothing new is said.
      vi.setSystemTime(new Date('2026-11-19T10:00:20Z'))
      api.formatRepositoryFile.mockRejectedValueOnce(preparing())
      expect(await format.provideDocumentFormattingEdits(e.model)).toEqual([])
      expect(api.formatRepositoryFile).toHaveBeenCalledTimes(2)
      expect(notify.info).toHaveBeenCalledTimes(1)
      // After the window it is said again.
      vi.setSystemTime(new Date('2026-11-19T10:00:31Z'))
      api.formatRepositoryFile.mockRejectedValueOnce(preparing())
      await format.provideDocumentFormattingEdits(e.model)
      expect(notify.info).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('the quiet window is per project: another project is told at once', async () => {
    const a = pythonFormat({ systemId: 5, repoId: 4 })
    api.formatRepositoryFile.mockRejectedValueOnce(preparing())
    await a.format.provideDocumentFormattingEdits(a.e.model)
    let repo = 4
    const b = pythonFormat({ systemId: 5, repoId: () => repo })
    api.formatRepositoryFile.mockRejectedValueOnce(preparing())
    await b.format.provideDocumentFormattingEdits(b.e.model)
    expect(notify.info).toHaveBeenCalledTimes(2)                                 // two stores, each says it once
    api.formatRepositoryFile.mockRejectedValueOnce(preparing())
    await b.format.provideDocumentFormattingEdits(b.e.model)
    expect(notify.info).toHaveBeenCalledTimes(2)
    repo = 9                                                                     // the page swapped projects
    api.formatRepositoryFile.mockRejectedValueOnce(preparing())
    await b.format.provideDocumentFormattingEdits(b.e.model)
    expect(notify.info).toHaveBeenCalledTimes(3)
  })

  it('Python formatting that could not be set up: an error notification, and a click copies the whole setup log', async () => {
    const { e, format } = pythonFormat()
    const log = 'Collecting ruff\nERROR: Could not find a version that satisfies the requirement ruff\n'
    api.formatRepositoryFile.mockRejectedValueOnce({ response: { status: 502, data: {
      error: "Python formatting could not be set up in your project's sandbox.", code: 'FORMATTER_UNAVAILABLE', detail: log } } })
    expect(await format.provideDocumentFormattingEdits(e.model)).toEqual([])
    expect(api.formatRepositoryFile).toHaveBeenCalledTimes(1)
    expect(e.tabs.value[0].content).toBe('x=1\n')
    expect(notify.error).toHaveBeenCalledTimes(1)
    const [message, options] = notify.error.mock.calls[0]
    expect(message).toBe("The file was not formatted: Python formatting could not be set up in your project's sandbox. "
      + 'Click this notification to copy the setup log.')
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    try {
      options.onClick()
      await Promise.resolve(); await Promise.resolve()
      expect(writeText).toHaveBeenCalledWith(log)
      expect(notify.success).toHaveBeenCalledWith('The setup log was copied.')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('a sandbox that did not answer in time: an info notification, the text kept, no retry', async () => {
    const { e, format } = pythonFormat()
    api.formatRepositoryFile.mockRejectedValueOnce({ response: { status: 503, data: {
      error: "The project's sandbox did not answer in time.", code: 'SANDBOX_NOT_ANSWERING', retry_after_seconds: 10 } } })
    expect(await format.provideDocumentFormattingEdits(e.model)).toEqual([])
    expect(api.formatRepositoryFile).toHaveBeenCalledTimes(1)
    expect(notify.info).toHaveBeenCalledWith("The project's sandbox did not answer in time. The file was not formatted.")
    expect(e.tabs.value[0].content).toBe('x=1\n')
  })
})
