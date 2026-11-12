// The editor's language servers (ADM-1205 phase F item 16): the LSP <-> Monaco conversions, and the store's flow
// with a stand-in connection: a server per language when its file is shown, initialize then didOpen, typing sent as
// didChange (and flushed before a request), save and close, diagnostics into Problems and the editor's markers,
// pyright asked for the whole project, Check project, and a new project starting from nothing.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

vi.mock('@/services/api', () => ({ default: { checkProjectProblems: vi.fn() } }))
import api from '@/services/api'
import {
  createLanguageServers, serverFor, languageIdOf, toUri, pathOfUri, problemOf, rangeOf, positionOf,
  hoverContents, locationsOf, completionsOf,
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
  request(method, params) { this.sent.push(['request', method, params]); return Promise.resolve(method === 'initialize' ? { capabilities: {} } : null) }
  notify(method, params) { this.sent.push(['notify', method, params]); return true }
  methods() { return this.sent.map((x) => x[1]) }
}
FakeConnection.made = []

function editorCtx() {
  const model = { uri: { toString: () => 'inmemory://1' } }
  const providers = {}
  const reg = (kind) => vi.fn((lang, p) => { (providers[kind] ||= {})[lang] = p; return { dispose: vi.fn() } })
  const monaco = { MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
    Uri: { parse: (u) => ({ toString: () => u }) },
    editor: { setModelMarkers: vi.fn(), registerEditorOpener: vi.fn((o) => { providers.opener = o; return { dispose: vi.fn() } }) },
    languages: { registerHoverProvider: reg('hover'), registerCompletionItemProvider: reg('completion'),
      registerSignatureHelpProvider: reg('signature'), registerDefinitionProvider: reg('definition') } }
  const tabs = ref([{ id: 1, type: 'file', path: 'app/page.tsx', content: 'const a = 1', original: 'const a = 1' }])
  const activeId = ref(1)
  const activeTab = { get value() { return tabs.value.find((t) => t.id === activeId.value) } }
  return { model, monaco, providers, tabs, activeId, ctx: { monaco: () => monaco, editor: () => ({ getModel: () => model }),
    activeTab, openTabs: tabs, openAt: vi.fn() } }
}

describe('the store', () => {
  beforeEach(() => { FakeConnection.made = []; vi.useRealTimers() })

  it('starts the server of the file shown, initialises it, then opens the files in tabs', async () => {
    const e = editorCtx()
    const s = createLanguageServers({ systemId: 5, repoId: 4, Connection: FakeConnection, urlFor: (r, l) => `${r}/${l}` })
    s.bind(e.ctx)
    expect(FakeConnection.made.map((c) => c.url)).toEqual(['4/typescript'])
    const c = FakeConnection.made[0]
    c.ready()
    await Promise.resolve(); await Promise.resolve()
    expect(c.methods()).toEqual(['initialize', 'initialized', 'textDocument/didOpen'])
    expect(c.sent[0][2].rootUri).toBe('file:///home/northrays/workspace/repo-4')
    expect(c.sent[2][2].textDocument).toMatchObject({ uri: toUri(ROOT, 'app/page.tsx'), languageId: 'typescriptreact', version: 1 })
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
})
