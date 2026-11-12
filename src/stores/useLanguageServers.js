// The Let's Code editor's language servers (ADM-1205 phase F, item 16; agentic-docs/LETS_CODE_LANGUAGE_SERVERS_PLAN.md):
// TypeScript / JavaScript and Python, each a real language server in the project's sandbox, reached through AADML.
//
// One store per open project, provided by the Let's Code page (LANGUAGE_SERVERS) like the chat tabs:
//   * the editor (CodeBrowser) `bind`s its Monaco, its editor, its tabs and `openAt`: the files open in tabs are
//     synced to the servers (didOpen / didChange / didSave / didClose), and Monaco gets hover, completion, signature
//     help, go to definition (another file opens through `openAt`) and find all references (Shift+F12);
//   * the bottom panel's Problems tab reads `problems` (what the servers report, and Check project's tsc run) and its
//     References tab reads `references`; a click opens the place through the same `openAt`.
// A server starts the first time a file of its language is shown. While none is ready, Monaco's own TypeScript
// support keeps working; once one is, Monaco's own hover, completion, definitions and diagnostics are switched off
// so nothing is shown twice.
import { reactive, ref, computed, watch, effectScope } from 'vue'
import api from '@/services/api'
import { LspConnection, lspSocketUrl } from '@/services/lspClient'

export const LANGUAGE_SERVERS = Symbol('lets-code-language-servers')

// ── pure helpers (tested on their own) ────────────────────────────────────────────────────────────────────────
const EXT_LANG = { ts: 'typescript', tsx: 'typescript', js: 'typescript', jsx: 'typescript', mjs: 'typescript',
  cjs: 'typescript', mts: 'typescript', cts: 'typescript', py: 'python', pyi: 'python' }
const EXT_ID = { ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescriptreact', js: 'javascript',
  mjs: 'javascript', cjs: 'javascript', jsx: 'javascriptreact', py: 'python', pyi: 'python' }

function extOf(path) { const m = /\.([^./]+)$/.exec(String(path || '')); return m ? m[1].toLowerCase() : '' }
/** The language server a file belongs to (typescript | python), or null. */
export function serverFor(path) { return EXT_LANG[extOf(path)] || null }
/** The LSP languageId of a file. */
export function languageIdOf(path) { return EXT_ID[extOf(path)] || 'plaintext' }

/** file:// URI of a project file. `root` is the project's folder in the sandbox (absolute). */
export function toUri(root, path) {
  const abs = `${String(root).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`
  return 'file://' + abs.split('/').map(encodeURIComponent).join('/')
}
/** The project path of a file:// URI, or null when it is outside the project (a library in node_modules is kept:
 *  it is still a file of the project's folder). */
export function pathOfUri(root, uri) {
  if (!String(uri || '').startsWith('file://')) return null
  const abs = decodeURIComponent(String(uri).slice('file://'.length))
  const base = String(root).replace(/\/+$/, '') + '/'
  return abs.startsWith(base) ? abs.slice(base.length) : null
}

const SEVERITY = { 1: 'error', 2: 'warning', 3: 'info', 4: 'hint' }
/** An LSP diagnostic of `path` as a problem row. Lines and columns 1-based, as shown. */
export function problemOf(path, d, source = '') {
  return { path, line: d.range.start.line + 1, column: d.range.start.character + 1,
    endLine: d.range.end.line + 1, endColumn: d.range.end.character + 1,
    severity: SEVERITY[d.severity] || 'error', message: String(d.message || ''),
    code: d.code == null ? '' : String(d.code), source: d.source || source }
}

/** Monaco's range from an LSP range. */
export function rangeOf(r) {
  return { startLineNumber: r.start.line + 1, startColumn: r.start.character + 1,
    endLineNumber: r.end.line + 1, endColumn: r.end.character + 1 }
}
/** An LSP position from Monaco's. */
export function positionOf(p) { return { line: p.lineNumber - 1, character: p.column - 1 } }

/** An LSP hover's contents as Monaco markdown strings. */
export function hoverContents(contents) {
  const one = (c) => {
    if (c == null) return null
    if (typeof c === 'string') return { value: c }
    if (c.kind) return { value: c.kind === 'markdown' ? c.value : '```\n' + c.value + '\n```' }
    if (c.language) return { value: '```' + c.language + '\n' + c.value + '\n```' }
    return null
  }
  return (Array.isArray(contents) ? contents : [contents]).map(one).filter((x) => x && x.value)
}

/** Every location an LSP answer names: Location, Location[] or LocationLink[]; `{uri, range}` each. */
export function locationsOf(result) {
  if (!result) return []
  return (Array.isArray(result) ? result : [result]).map((l) => (l.targetUri
    ? { uri: l.targetUri, range: l.targetSelectionRange || l.targetRange }
    : { uri: l.uri, range: l.range })).filter((l) => l.uri && l.range)
}

/** LSP CompletionItemKind → Monaco's (they are numbered differently). */
const KIND = { 1: 18, 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 7, 9: 8, 10: 9, 11: 12, 12: 13, 13: 15, 14: 17, 15: 27,
  16: 19, 17: 20, 18: 21, 19: 23, 20: 16, 21: 14, 22: 6, 23: 10, 24: 11, 25: 24 }
export function completionsOf(result, wordRange) {
  const items = Array.isArray(result) ? result : (result && result.items) || []
  return items.map((it) => {
    const edit = it.textEdit
    const range = edit ? rangeOf(edit.range || edit.replace) : wordRange
    const doc = it.documentation
    return { label: it.label, kind: KIND[it.kind] ?? 18, detail: it.detail || '',
      documentation: doc ? (typeof doc === 'string' ? doc : { value: doc.value }) : undefined,
      insertText: (edit && edit.newText) || it.insertText || it.label, range,
      sortText: it.sortText, filterText: it.filterText }
  })
}

// ── the store ─────────────────────────────────────────────────────────────────────────────────────────────────
const MONACO_LANGS = ['typescript', 'javascript', 'python']
const val = (x) => (typeof x === 'function' ? x() : x)

// `systemId` / `repoId`: values, or functions giving the open project's (the page keeps one store and swaps projects).
export function createLanguageServers({ systemId, repoId, Connection = LspConnection, urlFor = lspSocketUrl } = {}) {
  const servers = reactive({})           // lang -> { state, error, root }
  const conns = {}                        // lang -> { conn, root, opened: Map(path -> version), ready }
  const diagnostics = reactive({})        // `${lang}\n${path}` -> problem rows
  const checked = ref([])                 // Check project (tsc) rows
  const checking = ref(false)
  const checkError = ref('')
  const references = ref({ query: '', items: [], loading: false, error: '' })
  const panel = ref({ tab: '', at: 0 })   // the bottom panel is asked to show a tab (Problems / References)
  let ctx = null
  let scope = null
  const disposables = []

  const problems = computed(() => {
    const rows = [...Object.values(diagnostics).flat(), ...checked.value]
    const seen = new Set()
    return rows.filter((p) => {
      const k = `${p.path}|${p.line}|${p.column}|${p.message}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    }).sort((a, b) => (a.path === b.path ? a.line - b.line || a.column - b.column : a.path < b.path ? -1 : 1))
  })
  const counts = computed(() => ({
    errors: problems.value.filter((p) => p.severity === 'error').length,
    warnings: problems.value.filter((p) => p.severity === 'warning').length,
  }))

  function tabFiles() {
    if (!ctx) return []
    return (ctx.openTabs.value || []).filter((t) => t.type === 'file' && serverFor(t.path) && t.content != null)
  }

  // ── a server ──
  function ensure(lang) {
    const have = conns[lang]
    if (have && !['closed', 'error'].includes(have.conn.state)) return have
    const entry = { conn: null, root: '', opened: new Map(), ready: false, pending: new Map(), timer: null }
    servers[lang] = { state: 'connecting', error: '', root: '' }
    entry.conn = new Connection({
      url: urlFor(val(repoId), lang),
      onStatus: (s) => {
        servers[lang] = { state: s.state === 'ready' ? 'initializing' : s.state, error: s.error || '', root: s.root || '' }
        if (s.state === 'ready') { entry.root = s.root || ''; initialize(lang, entry) }
        if (s.state === 'closed' || s.state === 'error' || s.state === 'exited') {
          entry.ready = false
          clearDiagnostics(lang)
        }
      },
      onNotification: (method, params) => onNotification(lang, entry, method, params),
      onRequest: (method, params) => onRequest(entry, method, params),
    })
    conns[lang] = entry
    entry.conn.open()
    return entry
  }

  async function initialize(lang, entry) {
    const rootUri = toUri(entry.root, '').replace(/\/$/, '')
    try {
      await entry.conn.request('initialize', {
        processId: null, rootUri, rootPath: entry.root,
        workspaceFolders: [{ uri: rootUri, name: entry.root.split('/').pop() || 'project' }],
        capabilities: {
          textDocument: {
            synchronization: { didSave: true, dynamicRegistration: false },
            hover: { contentFormat: ['markdown', 'plaintext'] },
            completion: { completionItem: { snippetSupport: false, documentationFormat: ['markdown', 'plaintext'] } },
            signatureHelp: { signatureInformation: { documentationFormat: ['markdown', 'plaintext'] } },
            definition: { linkSupport: true }, references: {},
            publishDiagnostics: { relatedInformation: false },
          },
          workspace: { configuration: true, workspaceFolders: true },
        },
      })
      entry.conn.notify('initialized', {})
      entry.ready = true
      servers[lang] = { ...servers[lang], state: 'ready' }
      quietBuiltins()
      syncDocs()
    } catch (e) {
      servers[lang] = { ...servers[lang], state: 'error', error: e.message }
    }
  }

  function onRequest(entry, method, params) {
    if (method === 'workspace/configuration') {
      // pyright: report the whole project (workspace mode), not only the open files (plan D8).
      return (params?.items || []).map((it) => (it.section === 'python.analysis' ? { diagnosticMode: 'workspace' }
        : it.section === 'python' ? { analysis: { diagnosticMode: 'workspace' } } : null))
    }
    if (method === 'workspace/workspaceFolders') {
      const uri = toUri(entry.root, '').replace(/\/$/, '')
      return [{ uri, name: entry.root.split('/').pop() || 'project' }]
    }
    return null      // window/workDoneProgress/create, client/registerCapability, ...: accepted
  }

  function onNotification(lang, entry, method, params) {
    if (method !== 'textDocument/publishDiagnostics' || !params) return
    const path = pathOfUri(entry.root, params.uri)
    if (path == null || path.startsWith('node_modules/')) return
    const key = `${lang}\n${path}`
    const rows = (params.diagnostics || []).map((d) => problemOf(path, d, lang))
    if (rows.length) diagnostics[key] = rows
    else delete diagnostics[key]
    applyMarkers()
  }

  function clearDiagnostics(lang) {
    for (const k of Object.keys(diagnostics)) if (k.startsWith(`${lang}\n`)) delete diagnostics[k]
    applyMarkers()
  }

  // ── documents ──
  function syncDocs() {
    const files = tabFiles()
    const want = new Set(files.map((t) => t.path))
    for (const [lang, entry] of Object.entries(conns)) {
      if (!entry.ready) continue
      for (const t of files) {
        if (serverFor(t.path) !== lang || entry.opened.has(t.path)) continue
        entry.opened.set(t.path, { version: 1, text: t.content })
        entry.conn.notify('textDocument/didOpen', { textDocument: { uri: toUri(entry.root, t.path),
          languageId: languageIdOf(t.path), version: 1, text: t.content } })
      }
      for (const path of [...entry.opened.keys()]) {
        if (want.has(path)) continue
        entry.opened.delete(path)
        entry.conn.notify('textDocument/didClose', { textDocument: { uri: toUri(entry.root, path) } })
      }
    }
  }

  function changed(tab) {
    const entry = conns[serverFor(tab?.path)]
    const doc = entry && entry.ready && entry.opened.get(tab.path)
    if (!doc || doc.text === tab.content) return
    entry.pending.set(tab.path, tab.content)
    clearTimeout(entry.timer)
    entry.timer = setTimeout(() => flush(entry), 150)
  }

  // Every change waiting is sent before a request, so the server answers about the text on screen.
  function flush(entry) {
    clearTimeout(entry.timer)
    for (const [path, text] of entry.pending) {
      const doc = entry.opened.get(path)
      if (!doc) continue
      doc.version += 1
      doc.text = text
      entry.conn.notify('textDocument/didChange', { textDocument: { uri: toUri(entry.root, path), version: doc.version },
        contentChanges: [{ text }] })
    }
    entry.pending.clear()
  }

  function saved(path) {
    const entry = conns[serverFor(path)]
    if (!entry || !entry.ready || !entry.opened.has(path)) return
    flush(entry)
    entry.conn.notify('textDocument/didSave', { textDocument: { uri: toUri(entry.root, path) } })
  }

  // ── Monaco ──
  // The file a provider is asked about: the active tab, when the model is the editor's and its server is ready.
  function current(model) {
    if (!ctx) return null
    const tab = ctx.activeTab.value
    const ed = ctx.editor()
    if (!tab || tab.type !== 'file' || !ed || ed.getModel() !== model) return null
    const entry = conns[serverFor(tab.path)]
    if (!entry || !entry.ready || !entry.opened.has(tab.path)) return null
    flush(entry)
    return { entry, path: tab.path, uri: toUri(entry.root, tab.path) }
  }

  function applyMarkers() {
    if (!ctx) return
    const monaco = ctx.monaco()
    const ed = ctx.editor()
    const model = ed && ed.getModel && ed.getModel()
    if (!monaco || !model) return
    const tab = ctx.activeTab.value
    const rows = tab && tab.type === 'file' ? problems.value.filter((p) => p.path === tab.path && p.source !== 'tsc') : []
    const sev = { error: monaco.MarkerSeverity.Error, warning: monaco.MarkerSeverity.Warning,
      info: monaco.MarkerSeverity.Info, hint: monaco.MarkerSeverity.Hint }
    try {
      monaco.editor.setModelMarkers(model, 'aadml-lsp', rows.map((p) => ({ startLineNumber: p.line,
        startColumn: p.column, endLineNumber: p.endLine || p.line, endColumn: p.endColumn || p.column + 1,
        message: p.message, severity: sev[p.severity] ?? sev.error, source: p.source, code: p.code })))
    } catch { /* the model went away */ }
  }

  let quieted = false
  function quietBuiltins() {
    const monaco = ctx && ctx.monaco()
    // `monaco.typescript` in Monaco 0.53 and later; `monaco.languages.typescript` before.
    const ts = monaco && ((monaco.typescript && monaco.typescript.typescriptDefaults ? monaco.typescript : null)
      || (monaco.languages && monaco.languages.typescript))
    if (!ts || quieted) return
    quieted = true
    for (const d of [ts.typescriptDefaults, ts.javascriptDefaults]) {
      try {
        d.setDiagnosticsOptions?.({ noSemanticValidation: true, noSyntaxValidation: true, noSuggestionDiagnostics: true })
        d.setModeConfiguration?.({ completionItems: false, hovers: false, definitions: false, references: false,
          signatureHelp: false, diagnostics: false, rename: false, codeActions: false, inlayHints: false,
          documentSymbols: true, documentHighlights: true, documentRangeFormattingEdits: true,
          onTypeFormattingEdits: true })
      } catch { /* an older Monaco: its own features stay on */ }
    }
  }

  function registerProviders(monaco) {
    const L = monaco.languages
    for (const lang of MONACO_LANGS) {
      disposables.push(L.registerHoverProvider(lang, {
        async provideHover(model, position) {
          const f = current(model)
          if (!f) return null
          const r = await f.entry.conn.request('textDocument/hover', { textDocument: { uri: f.uri },
            position: positionOf(position) }).catch(() => null)
          if (!r || !r.contents) return null
          const contents = hoverContents(r.contents)
          return contents.length ? { contents, range: r.range ? rangeOf(r.range) : undefined } : null
        },
      }))
      disposables.push(L.registerCompletionItemProvider(lang, {
        triggerCharacters: ['.', '"', "'", '/', '@', '<'],
        async provideCompletionItems(model, position) {
          const f = current(model)
          if (!f) return { suggestions: [] }
          const r = await f.entry.conn.request('textDocument/completion', { textDocument: { uri: f.uri },
            position: positionOf(position) }).catch(() => null)
          const w = model.getWordUntilPosition(position)
          const wordRange = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: w.startColumn, endColumn: w.endColumn }
          return { suggestions: completionsOf(r, wordRange), incomplete: !!(r && r.isIncomplete) }
        },
      }))
      disposables.push(L.registerSignatureHelpProvider(lang, {
        signatureHelpTriggerCharacters: ['(', ','],
        async provideSignatureHelp(model, position) {
          const f = current(model)
          if (!f) return null
          const r = await f.entry.conn.request('textDocument/signatureHelp', { textDocument: { uri: f.uri },
            position: positionOf(position) }).catch(() => null)
          if (!r || !r.signatures || !r.signatures.length) return null
          const doc = (d) => (d == null ? undefined : typeof d === 'string' ? d : { value: d.value })
          return { value: { activeSignature: r.activeSignature || 0, activeParameter: r.activeParameter || 0,
            signatures: r.signatures.map((s) => ({ label: s.label, documentation: doc(s.documentation),
              parameters: (s.parameters || []).map((p) => ({ label: p.label, documentation: doc(p.documentation) })) })) },
          dispose() {} }
        },
      }))
      disposables.push(L.registerDefinitionProvider(lang, {
        async provideDefinition(model, position) {
          const f = current(model)
          if (!f) return null
          const r = await f.entry.conn.request('textDocument/definition', { textDocument: { uri: f.uri },
            position: positionOf(position) }).catch(() => null)
          // The editor's own file keeps its model's uri (Monaco moves the cursor); another file opens via the opener.
          return locationsOf(r).map((l) => ({ uri: l.uri === f.uri ? model.uri : monaco.Uri.parse(l.uri),
            range: rangeOf(l.range) }))
        },
      }))
    }
    // Another file named by go to definition opens in the editor's own tabs, at the place.
    if (monaco.editor.registerEditorOpener) {
      disposables.push(monaco.editor.registerEditorOpener({
        openCodeEditor(_source, resource, where) {
          const uri = resource && resource.toString(true)
          const entry = Object.values(conns).find((e) => e.root && pathOfUri(e.root, uri) != null)
          if (!entry || !ctx) return false
          const path = pathOfUri(entry.root, uri)
          const pos = where && (where.startLineNumber ? { line: where.startLineNumber, column: where.startColumn }
            : where.lineNumber ? { line: where.lineNumber, column: where.column } : { line: 1, column: 1 })
          ctx.openAt({ path, ...(pos || { line: 1, column: 1 }) })
          return true
        },
      }))
    }
  }

  function addActions(editor, monaco) {
    if (!editor || typeof editor.addAction !== 'function') return
    try {
      disposables.push(editor.addAction({
        id: 'lets-code.find-references', label: 'Find All References',
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
        contextMenuGroupId: 'navigation', contextMenuOrder: 1.6,
        run: (ed) => findReferences(ed),
      }))
    } catch { /* an editor that cannot take actions keeps working without it */ }
  }

  async function findReferences(editor) {
    const model = editor.getModel()
    const f = current(model)
    if (!f) return
    const pos = editor.getPosition()
    const word = model.getWordAtPosition(pos)
    references.value = { query: word ? word.word : '', items: [], loading: true, error: '' }
    panel.value = { tab: 'references', at: Date.now() }
    try {
      const r = await f.entry.conn.request('textDocument/references', { textDocument: { uri: f.uri },
        position: positionOf(pos), context: { includeDeclaration: true } })
      const items = locationsOf(r).map((l) => ({ path: pathOfUri(f.entry.root, l.uri), line: l.range.start.line + 1,
        column: l.range.start.character + 1 })).filter((x) => x.path != null)
      references.value = { ...references.value, items, loading: false }
    } catch (e) {
      references.value = { ...references.value, loading: false, error: e.message }
    }
  }

  // ── the editor binds itself ──
  function bind(editorCtx) {
    unbind()
    ctx = editorCtx
    const monaco = ctx.monaco()
    if (monaco) registerProviders(monaco)
    addActions(ctx.editor(), monaco)
    // Typing reaches the server from the editor's own change event, the way an LSP client listens to its document
    // (a Vue watcher on the tab's text, made while the editor component mounted, was stopped with that component and
    // sent nothing: live 2026-11-12).
    const ed = ctx.editor()
    if (ed && typeof ed.onDidChangeModelContent === 'function') {
      disposables.push(ed.onDidChangeModelContent(() => {
        const tab = ctx && ctx.activeTab.value
        if (tab && tab.type === 'file') changed({ path: tab.path, content: ed.getModel().getValue() })
      }))
    }
    // Detached: the watchers below belong to this binding only, never to the component mounting at that moment.
    scope = effectScope(true)
    scope.run(() => {
      watch(() => ctx.activeTab.value && ctx.activeTab.value.path, (path) => {
        const lang = serverFor(path)
        if (lang) ensure(lang)
        syncDocs()
        applyMarkers()
      }, { immediate: true })
      watch(() => tabFiles().map((t) => t.path).join('\n'), () => syncDocs())
      watch(() => ctx.activeTab.value && ctx.activeTab.value.content, () => changed(ctx.activeTab.value))
      watch(() => ctx.activeTab.value && ctx.activeTab.value.original, (now, before) => {
        if (before !== undefined && now !== before && ctx.activeTab.value) saved(ctx.activeTab.value.path)
      })
    })
    return unbind
  }

  function unbind() {
    if (scope) { scope.stop(); scope = null }
    while (disposables.length) { try { disposables.pop().dispose() } catch { /* already gone */ } }
    ctx = null
  }

  // ── the bottom panel ──
  async function check() {
    checking.value = true
    checkError.value = ''
    try {
      const { data } = await api.checkProjectProblems(val(systemId), val(repoId))
      checked.value = (data.problems || []).map((p) => ({ ...p, severity: p.severity === 'message' ? 'info' : p.severity }))
      if (!data.ran) checkError.value = data.error || 'The project could not be checked.'
    } catch (e) {
      checkError.value = e?.response?.data?.error || 'The project could not be checked. Try again.'
    } finally {
      checking.value = false
    }
  }

  function open(item) {
    if (ctx && item && item.path) ctx.openAt({ path: item.path, line: item.line || 1, column: item.column || 1 })
  }

  // Another project opened (or none): its servers end and nothing of the last project is shown.
  function reset() {
    for (const [lang, e] of Object.entries(conns)) { clearTimeout(e.timer); e.conn.close(); delete conns[lang] }
    for (const k of Object.keys(servers)) delete servers[k]
    for (const k of Object.keys(diagnostics)) delete diagnostics[k]
    checked.value = []
    checkError.value = ''
    references.value = { query: '', items: [], loading: false, error: '' }
    applyMarkers()
  }

  function dispose() {
    unbind()
    reset()
  }

  return { servers, problems, counts, references, panel, checking, checkError, check, open, bind, unbind, reset, dispose,
    // for tests
    _conns: conns, _diagnostics: diagnostics, _changed: changed, _flush: flush, _syncDocs: syncDocs }
}
