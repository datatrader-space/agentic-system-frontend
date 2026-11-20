// The Let's Code editor's language servers (ADM-1205 phase F, item 16; agentic-docs/LETS_CODE_LANGUAGE_SERVERS_PLAN.md):
// TypeScript / JavaScript and Python, each a real language server in the project's sandbox, reached through AADML.
//
// One store per open project, provided by the Let's Code page (LANGUAGE_SERVERS) like the chat tabs:
//   * the editor (CodeBrowser) `bind`s its Monaco, its editor, its tabs, `openAt` and `editOpenFile(path, textEdits)`
//     (a server's change to a file open in a tab goes into the tab's text; null when it is not open): the files open
//     in tabs are
//     synced to the servers (didOpen / didChange / didSave / didClose), and Monaco gets hover, completion, signature
//     help, go to definition (another file opens through `openAt`) and find all references (Shift+F12);
//   * the bottom panel's Problems tab reads `problems` (what the servers report, and Check project's tsc run) and its
//     References tab reads `references`; a click opens the place through the same `openAt`.
// A server starts the first time a file of its language is shown. While none is ready, Monaco's own TypeScript
// support keeps working; once one is, Monaco's own hover, completion, definitions and diagnostics are switched off
// so nothing is shown twice.
//
// Editing through the servers (ADM-1319): rename (F2), quick fixes and refactors (Ctrl+.), inlay hints and Format
// Document (Shift+Alt+F) for TypeScript, JavaScript and Python. These come from the servers only: Monaco's own are
// never registered (`leaveEditingToServers`, called when Monaco loads). Python is formatted by the project's own
// formatter through AADML (api.formatRepositoryFile); pyright has none. A change to several files (a rename, a quick
// fix, the server's own workspace/applyEdit) goes through ONE helper, `applyWorkspaceEdit`: a file open in a tab
// changes in the tab (unsaved; the person saves it), any other file is read, changed and written with the version it
// was read at, so a file changed meanwhile is never overwritten.
import { reactive, ref, computed, watch, effectScope } from 'vue'
import api from '@/services/api'
import { LspConnection, lspSocketUrl } from '@/services/lspClient'
import { notify } from '@/composables/useNotify'
import { useEditorSettings } from '@/composables/useEditorSettings'
import { whileSandboxStarts, retryAfterSeconds } from '@/utils/sandboxStarting'
import { projectCache } from '@/services/projectCache'

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
/** An LSP range from Monaco's. */
export function lspRangeOf(r) {
  return { start: { line: r.startLineNumber - 1, character: r.startColumn - 1 },
    end: { line: r.endLineNumber - 1, character: r.endColumn - 1 } }
}

// ── text edits (LSP positions are UTF-16 code units, as JavaScript strings and Monaco's columns are) ──
// Where each line starts; a line ends at \n, \r\n or \r.
function lineStarts(text) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 13) { if (text.charCodeAt(i + 1) === 10) i++; starts.push(i + 1) } else if (c === 10) starts.push(i + 1)
  }
  return starts
}
// The offset of an LSP position. A character past its line's end is the line's end (the LSP rule); a line past the
// text's end is the text's end.
function offsetAt(text, starts, pos) {
  if (pos.line < 0) return 0
  if (pos.line >= starts.length) return text.length
  const start = starts[pos.line]
  let end = text.length
  if (pos.line + 1 < starts.length) {
    end = starts[pos.line + 1] - 1
    if (text[end] === '\n' && end > start && text[end - 1] === '\r') end -= 1
  }
  return start + Math.min(Math.max(pos.character || 0, 0), end - start)
}
/** The end of a text, as an LSP position. */
export function endOf(text) {
  const starts = lineStarts(text)
  return { line: starts.length - 1, character: text.length - starts[starts.length - 1] }
}
/** `text` with LSP TextEdits applied. Ranges are read in the text as it was before any edit (the LSP rule), and edits
 *  at the same place go in in the order given. */
export function applyTextEdits(text, edits) {
  const starts = lineStarts(text)
  const list = (edits || []).map((e, i) => ({ i, from: offsetAt(text, starts, e.range.start),
    to: offsetAt(text, starts, e.range.end), text: e.newText ?? '' }))
  list.sort((a, b) => a.from - b.from || a.i - b.i)
  let out = ''
  let at = 0
  for (const e of list) {
    out += text.slice(at, Math.max(at, e.from)) + e.text
    at = Math.max(at, e.to)
  }
  return out + text.slice(at)
}

export const RESOURCE_OPERATIONS_REFUSED = 'This change creates, renames or deletes files. The editor does not do that, '
  + 'so nothing was changed.'

// ── a TypeScript project loading (ADM-1335) ──
// While tsserver loads a project, typescript-language-server sends `rename` (and references, definitions, ...) to its
// syntax-only server, which knows the open files alone (SyntaxRoutingTsServer.syntaxAllowedCommands, 4.3.3), so a
// rename then changed the open file only. The server reports the load as progress: window/workDoneProgress/create,
// then $/progress begin ... end ("Initializing JS/TS language features…"). A rename waits for it to end, and is asked
// again when a load began while it was being asked (the server's create reaches us before that answer).
export const PROJECT_LOADING_WAIT_MS = 60000
export const RENAME_WAITING = 'The project is still loading. The rename runs as soon as it has loaded, so it reaches every file.'
export const RENAME_NOT_LOADED = 'Nothing was renamed: the project is still loading, and a rename now could miss files. '
  + 'Try again in a moment.'
function loadingBegan(entry, token) {
  entry.loading.add(String(token))
  entry.loadingEpoch += 1
}
function loadingEnded(entry, token) {
  entry.loading.delete(String(token))
  if (!entry.loading.size) for (const done of entry.loadingWaiters.splice(0)) done(true)
}
function loadingStopped(entry) {                     // the connection closed: nothing will end the loads it reported
  entry.loading.clear()
  for (const done of entry.loadingWaiters.splice(0)) done(false)
}
/** Resolves true once no load is going on, false after `ms` or when the connection closes. */
function whenLoaded(entry, ms) {
  if (!entry.loading.size) return Promise.resolve(true)
  return new Promise((resolve) => {
    const done = (ok) => { clearTimeout(timer); resolve(ok) }
    const timer = setTimeout(() => {
      const i = entry.loadingWaiters.indexOf(done)
      if (i >= 0) entry.loadingWaiters.splice(i, 1)
      resolve(false)
    }, ms)
    entry.loadingWaiters.push(done)
  })
}
/** The files a WorkspaceEdit changes, in order: `{uri, version, steps: [TextEdit[], ...]}` (a file named twice in
 *  documentChanges gets the second set of edits on the result of the first). A change that creates, renames or deletes
 *  a file is refused whole: `{files: [], refused}`. */
export function workspaceEditFiles(edit) {
  const files = new Map()
  const add = (uri, version, edits) => {
    const f = files.get(uri) || { uri, version: null, steps: [] }
    if (f.version == null && typeof version === 'number') f.version = version
    f.steps.push(edits || [])
    files.set(uri, f)
  }
  if (Array.isArray(edit && edit.documentChanges)) {
    if (edit.documentChanges.some((c) => !c || c.kind || !c.textDocument)) return { files: [], refused: RESOURCE_OPERATIONS_REFUSED }
    for (const c of edit.documentChanges) add(c.textDocument.uri, c.textDocument.version, c.edits)
  } else {
    for (const [uri, edits] of Object.entries((edit && edit.changes) || {})) add(uri, null, edits)
  }
  return { files: [...files.values()], refused: null }
}

/** An LSP inlay hint's answer as Monaco's hints. */
export function inlayHintsOf(result) {
  const tip = (t) => (t == null ? undefined : typeof t === 'string' ? t : { value: t.value })
  return (Array.isArray(result) ? result : []).map((h) => ({
    label: typeof h.label === 'string' ? h.label : (h.label || []).map((p) => ({ label: p.value, tooltip: tip(p.tooltip) })),
    position: { lineNumber: h.position.line + 1, column: h.position.character + 1 },
    kind: h.kind, paddingLeft: !!h.paddingLeft, paddingRight: !!h.paddingRight, tooltip: tip(h.tooltip),
  }))
}

// Whether two LSP ranges touch (a cursor inside a problem's range asks about that problem).
const before = (a, b) => a.line - b.line || a.character - b.character
const touches = (a, b) => before(a.end, b.start) >= 0 && before(a.start, b.end) <= 0

// Monaco's TypeScript support (`monaco.typescript` in Monaco 0.53 and later; `monaco.languages.typescript` before).
function monacoTs(monaco) {
  try {
    return monaco && ((monaco.typescript && monaco.typescript.typescriptDefaults ? monaco.typescript : null)
      || (monaco.languages && monaco.languages.typescript)) || null
  } catch {
    return null        // a namespace without a TypeScript part (a strict module mock throws on a missing export)
  }
}

/** Called once Monaco has loaded, before it holds a TypeScript file: rename, code actions, inlay hints and formatting
 *  of TypeScript and JavaScript are the language server's only, so Monaco's own are never registered. Monaco 0.57
 *  registers its own TypeScript features once, when the first TypeScript file appears, and a later
 *  setModeConfiguration changes nothing; two sources would show every quick fix twice and pick a formatter at random. */
export function leaveEditingToServers(monaco) {
  const ts = monacoTs(monaco)
  if (!ts) return
  for (const d of [ts.typescriptDefaults, ts.javascriptDefaults]) {
    try {
      d.setModeConfiguration?.({ ...(d.modeConfiguration || {}), rename: false, codeActions: false, inlayHints: false,
        documentRangeFormattingEdits: false })
    } catch { /* an older Monaco: its own features stay on */ }
  }
}

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
// Each server's settings: pyright reports the whole project (plan D8), the TypeScript server its defaults.
const SETTINGS = { python: { python: { analysis: { diagnosticMode: 'workspace' } } } }
const val = (x) => (typeof x === 'function' ? x() : x)
const CODE_ACTION_KINDS = ['', 'quickfix', 'refactor', 'refactor.extract', 'refactor.inline', 'refactor.rewrite',
  'source', 'source.organizeImports', 'source.fixAll']
// The Monaco command a code action runs: the action is applied here (resolved, its edit, its command), never by
// Monaco's own edit service, which only knows the one file open in the editor.
const CODE_ACTION_COMMAND = 'lets-code.lsp.code-action'
const STARTING = 'The language server is still starting. Try again in a moment.'
const notReady = (why) => Object.assign(new Error(why), { notReady: true })
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The arguments of a notification about a formatting error. One carrying the formatter's setup log (code
 *  FORMATTER_UNAVAILABLE: the install log, whole) stays short: it says a click copies the log, and the click does. */
export function setupLogNotification(message, error) {
  const log = error && error.setupLog
  if (!log) return [message]
  const copy = () => {
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : null
    const done = clip && clip.writeText ? clip.writeText(log) : Promise.reject(new Error('no clipboard'))
    done.then(() => notify.success('The setup log was copied.'), () => notify.error('The setup log could not be copied.'))
  }
  return [`${message} Click this notification to copy the setup log.`, { timeout: 15000, onClick: copy }]
}

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
  const { settings: editorSettings } = useEditorSettings()
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
    // `caps`: what the server said it does (initialize); `raw`: its diagnostics of each file as sent, for code actions.
    // `loading`: the TypeScript server's project loads in progress, by token (ADM-1335).
    const entry = { conn: null, root: '', opened: new Map(), ready: false, pending: new Map(), timer: null, caps: {},
      raw: new Map(), lang, loading: new Set(), loadingEpoch: 0, loadingWaiters: [] }
    servers[lang] = { state: 'connecting', error: '', root: '' }
    entry.conn = new Connection({
      url: urlFor(val(repoId), lang),
      onStatus: (s) => {
        servers[lang] = { state: s.state === 'ready' ? 'initializing' : s.state, error: s.error || '', root: s.root || '' }
        if (s.state === 'ready') { entry.root = s.root || ''; initialize(lang, entry) }
        if (s.state === 'closed' || s.state === 'error' || s.state === 'exited') {
          entry.ready = false
          loadingStopped(entry)
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
      const init = await entry.conn.request('initialize', {
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
            rename: { dynamicRegistration: false, prepareSupport: true },
            codeAction: { dynamicRegistration: false, isPreferredSupport: true, disabledSupport: true, dataSupport: true,
              codeActionLiteralSupport: { codeActionKind: { valueSet: CODE_ACTION_KINDS } },
              resolveSupport: { properties: ['edit'] } },
            inlayHint: { dynamicRegistration: false },
            formatting: { dynamicRegistration: false },
            rangeFormatting: { dynamicRegistration: false },
          },
          workspace: { configuration: true, workspaceFolders: true, applyEdit: true,
            // Text edits only: creating, renaming or deleting a file is refused (applyWorkspaceEdit).
            workspaceEdit: { documentChanges: true, resourceOperations: [] },
            executeCommand: { dynamicRegistration: false } },
          // The TypeScript server then reports a project load, during which a rename would miss files (ADM-1335).
          window: { workDoneProgress: true },
        },
      })
      entry.caps = (init && init.capabilities) || {}
      entry.conn.notify('initialized', {})
      // The settings, pushed once, as VS Code's client does: pyright does no work at all until it is told its
      // configuration changed (live 2026-11-16: "ready", then no diagnostics and no hover reply).
      entry.conn.notify('workspace/didChangeConfiguration', { settings: SETTINGS[lang] || {} })
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
    if (method === 'workspace/applyEdit') {
      // The server's own change (a command it ran, e.g. organize imports): applied like a rename, and answered.
      return applyWorkspaceEdit(entry, params && params.edit).then((r) => (r.applied ? { applied: true }
        : { applied: false, failureReason: r.failureReason }))
    }
    if (method === 'window/workDoneProgress/create') {
      // Only the TypeScript server routes requests elsewhere while it loads; pyright's progress changes nothing.
      if (entry.lang === 'typescript' && params && params.token != null) loadingBegan(entry, params.token)
      return null
    }
    return null      // client/registerCapability, ...: accepted
  }

  function onNotification(lang, entry, method, params) {
    if (method === '$/progress') {
      if (entry.lang === 'typescript' && params && params.value && params.value.kind === 'end') loadingEnded(entry, params.token)
      return
    }
    if (method !== 'textDocument/publishDiagnostics' || !params) return
    const path = pathOfUri(entry.root, params.uri)
    if (path == null || path.startsWith('node_modules/')) return
    const key = `${lang}\n${path}`
    const rows = (params.diagnostics || []).map((d) => problemOf(path, d, lang))
    if (rows.length) { diagnostics[key] = rows; entry.raw.set(path, params.diagnostics) }
    else { delete diagnostics[key]; entry.raw.delete(path) }
    applyMarkers()
  }

  function clearDiagnostics(lang) {
    for (const k of Object.keys(diagnostics)) if (k.startsWith(`${lang}\n`)) delete diagnostics[k]
    if (conns[lang]) conns[lang].raw.clear()
    applyMarkers()
  }

  // ── a change to files (rename, a code action, the server's workspace/applyEdit) ──
  // A file open in a tab changes there, through the editor (`ctx.editOpenFile`: the tab becomes unsaved and the
  // person saves it). Any other file is read, changed and written back with the sha it was read at: a file changed
  // meanwhile answers 409 CHANGED_ON_DISK and is left as it is.
  async function editFile(path, steps) {
    let text = null
    if (ctx && typeof ctx.editOpenFile === 'function') {
      for (const edits of steps) {
        const now = ctx.editOpenFile(path, edits)
        if (now == null) break
        text = now
      }
    }
    if (text != null) { changed({ path, content: text }); return }
    const sys = val(systemId)
    const repo = val(repoId)
    let data
    try {
      ({ data } = await whileSandboxStarts(() => api.getFileContent(sys, repo, path)))
    } catch (e) {
      throw new Error(e?.response?.data?.error || 'it could not be read', { cause: e })
    }
    if (!data || typeof data.content !== 'string' || data.redacted) throw new Error('it could not be read as text')
    const next = steps.reduce((t, edits) => applyTextEdits(t, edits), data.content)
    if (next === data.content) return
    try {
      await whileSandboxStarts(() => api.saveFileContent(sys, repo, path, next, data.sha || undefined))
    } catch (e) {
      if (e?.response?.status === 409 && e.response.data?.code === 'CHANGED_ON_DISK') {
        throw new Error('it changed in the project meanwhile, so it was not overwritten', { cause: e })
      }
      throw new Error(e?.response?.data?.error || 'it could not be saved', { cause: e })
    }
    projectCache.file.set(repo, path, next)
  }

  /** Apply an LSP WorkspaceEdit (`changes` or `documentChanges`). `rename`: the notification says "Renamed".
   *  -> { applied, failureReason, changed: [path], failed: [{path, why}] }; one notification for a change to several
   *  files or one that failed. */
  async function applyWorkspaceEdit(entry, edit, { rename = false } = {}) {
    const { files, refused } = workspaceEditFiles(edit)
    if (refused) {
      notify.error(refused)
      return { applied: false, failureReason: refused, changed: [], failed: [] }
    }
    flush(entry)
    const done = []
    const failed = []
    for (const f of files) {
      const path = pathOfUri(entry.root, f.uri)
      if (path == null) { failed.push({ path: f.uri, why: 'it is outside the project' }); continue }
      const doc = entry.opened.get(path)
      if (f.version != null && doc && doc.version !== f.version) {
        failed.push({ path, why: 'it changed while the change was being worked out' })
        continue
      }
      try {
        await editFile(path, f.steps)
        done.push(path)
      } catch (e) {
        failed.push({ path, why: e.message })
      }
    }
    const did = done.length ? `${rename ? 'Renamed in' : 'Changed'} ${plural(done.length, 'file')}` : ''
    if (failed.length) {
      const list = failed.map((x) => `${x.path} (${x.why})`).join('; ')
      notify.error(`${did ? `${did}. ` : ''}${failed.length === 1 ? 'This file was' : 'These files were'} not changed: ${list}.`)
    } else if (done.length > 1) {
      notify.success(did)
    }
    const failureReason = failed.length ? failed.map((x) => `${x.path}: ${x.why}`).join('; ') : undefined
    return { applied: !failed.length, failureReason, changed: done, failed }
  }

  // ── formatting ──
  // The editor's tab size and spaces (its settings; "the file's own" reads the open file's).
  function formattingOptions() {
    const size = editorSettings.tabSize
    if (size !== 'auto') return { tabSize: size, insertSpaces: true }
    const ed = ctx && ctx.editor()
    const model = ed && ed.getModel && ed.getModel()
    const o = (model && typeof model.getOptions === 'function' && model.getOptions()) || {}
    return { tabSize: o.tabSize || 4, insertSpaces: o.insertSpaces !== false }
  }

  /** Whether a file has a formatter (TypeScript / JavaScript through its server, Python through the project's). */
  function canFormat(path) { return serverFor(path) != null }

  /** The LSP TextEdits that format `text`, the file `path`'s text now (`range`: only that part, an LSP range).
   *  Throws an Error saying why it could not be formatted; `notReady` when its server is still starting. */
  async function formatEdits(path, text, range = null) {
    const lang = serverFor(path)
    if (lang === 'python') {
      if (range) return []
      let data
      try {
        ({ data } = await whileSandboxStarts(() => api.formatRepositoryFile(val(systemId), val(repoId), path, text)))
      } catch (e) {
        const d = e?.response?.data
        if (d && d.code === 'FORMAT_FAILED') {
          throw new Error([d.error || 'The formatter refused this file.', d.detail].filter(Boolean).join(' '), { cause: e })
        }
        // The project's first format: the formatter is being installed in the sandbox, in the background. Nothing waits
        // or retries here (whileSandboxStarts retries only RUNNER_STARTING); the person tries again later.
        if (d && d.code === 'FORMATTER_PREPARING') {
          throw Object.assign(new Error(d.error || 'Python formatting is being set up in your project. Try again in a minute.',
            { cause: e }), { preparing: true, retryAfter: retryAfterSeconds(e) })
        }
        // The install failed: its log (whole) goes with the error, for setupLogNotification.
        if (d && d.code === 'FORMATTER_UNAVAILABLE') {
          throw Object.assign(new Error(d.error || "Python formatting could not be set up in your project's sandbox.",
            { cause: e }), { setupLog: typeof d.detail === 'string' && d.detail ? d.detail : '' })
        }
        // The sandbox did not answer within the request's budget: a passing state, said like a server still starting.
        if (d && d.code === 'SANDBOX_NOT_ANSWERING') {
          throw Object.assign(notReady(d.error || "The project's sandbox did not answer in time. Try again."), { cause: e })
        }
        throw new Error(d?.error || 'The file could not be formatted. Try again.', { cause: e })
      }
      if (!data || !data.changed || typeof data.content !== 'string' || data.content === text) return []
      return [{ range: { start: { line: 0, character: 0 }, end: endOf(text) }, newText: data.content }]
    }
    if (lang !== 'typescript') throw new Error('This kind of file has no formatter.')
    const entry = conns.typescript
    if (!entry || !entry.ready) throw notReady('The TypeScript language server is still starting.')
    const cap = range ? entry.caps.documentRangeFormattingProvider : entry.caps.documentFormattingProvider
    if (!cap) throw new Error('The TypeScript language server does not format files.')
    if (!entry.opened.has(path)) throw notReady('The TypeScript language server has not opened this file yet.')
    // The server formats the text it holds: it is given this text first.
    changed({ path, content: text })
    flush(entry)
    const params = { textDocument: { uri: toUri(entry.root, path) }, options: formattingOptions() }
    const edits = await entry.conn.request(range ? 'textDocument/rangeFormatting' : 'textDocument/formatting',
      range ? { ...params, range } : params)
    return Array.isArray(edits) ? edits : []
  }

  // Monaco's Format Document / Format Selection: the edits, or a notification saying why there are none. While Python
  // formatting is being set up in a project, its notification is shown once per the server's retry window: pressing
  // again within it still asks the server (setup may have finished) but says nothing new.
  const preparingQuietUntil = new Map()      // `${systemId}/${repoId}` -> time (ms) until which it is not said again
  async function monacoFormat(model, range) {
    const path = activeFile(model)
    if (!path) return []
    try {
      const edits = await formatEdits(path, model.getValue(), range ? lspRangeOf(range) : null)
      return edits.map((e) => ({ range: rangeOf(e.range), text: e.newText ?? '' }))
    } catch (e) {
      if (e.preparing) {
        const project = `${val(systemId)}/${val(repoId)}`
        if (Date.now() >= (preparingQuietUntil.get(project) || 0)) {
          preparingQuietUntil.set(project, Date.now() + e.retryAfter * 1000)
          notify.info(e.message)
        }
      } else if (e.notReady) notify.info(`${e.message} The file was not formatted.`)
      else notify.error(...setupLogNotification(`The file was not formatted: ${e.message}`, e))
      return []
    }
  }

  // ── code actions ──
  async function runCodeAction(lang, action) {
    const entry = conns[lang]
    if (!entry || !entry.ready || !action) { notify.error('The language server is not running, so nothing was changed.'); return }
    if (typeof action.command === 'string') { await executeCommand(entry, action); return }   // a plain Command
    let a = action
    const resolvable = entry.caps.codeActionProvider && typeof entry.caps.codeActionProvider === 'object'
      && entry.caps.codeActionProvider.resolveProvider
    if (!a.edit && resolvable) {
      try {
        a = (await entry.conn.request('codeAction/resolve', action)) || action
      } catch (e) {
        notify.error(`${action.title} could not be worked out: ${e.message}`)
        return
      }
    }
    if (a.edit) {
      const r = await applyWorkspaceEdit(entry, a.edit)
      if (!r.applied) return
    }
    if (a.command) await executeCommand(entry, a.command)
  }

  async function executeCommand(entry, cmd) {
    try {
      await entry.conn.request('workspace/executeCommand', { command: cmd.command, arguments: cmd.arguments })
    } catch (e) {
      notify.error(`${cmd.title || 'The action'} did not work: ${e.message}`)
    }
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
  function activeFile(model) {
    if (!ctx) return null
    const tab = ctx.activeTab.value
    const ed = ctx.editor()
    if (!tab || tab.type !== 'file' || !ed || ed.getModel() !== model) return null
    return tab.path
  }
  function current(model) {
    const path = activeFile(model)
    const lang = serverFor(path)
    const entry = conns[lang]
    if (!path || !entry || !entry.ready || !entry.opened.has(path)) return null
    flush(entry)
    return { entry, lang, path, uri: toUri(entry.root, path) }
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
    const ts = monacoTs(ctx && ctx.monaco())
    if (!ts || quieted) return
    quieted = true
    for (const d of [ts.typescriptDefaults, ts.javascriptDefaults]) {
      try {
        d.setDiagnosticsOptions?.({ noSemanticValidation: true, noSyntaxValidation: true, noSuggestionDiagnostics: true })
        d.setModeConfiguration?.({ completionItems: false, hovers: false, definitions: false, references: false,
          signatureHelp: false, diagnostics: false, rename: false, codeActions: false, inlayHints: false,
          documentSymbols: true, documentHighlights: true, documentRangeFormattingEdits: false,
          onTypeFormattingEdits: true })
      } catch { /* an older Monaco: its own features stay on */ }
    }
  }

  // Rename, code actions, inlay hints and formatting of one Monaco language (ADM-1319).
  function registerEditing(monaco, lang) {
    const L = monaco.languages
    const add = (fn, ...args) => { if (typeof L[fn] === 'function') disposables.push(L[fn](lang, ...args)) }
    const wordAt = (model, position) => {
      const w = model.getWordAtPosition(position)
      return w ? { range: { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: w.startColumn, endColumn: w.endColumn }, text: w.word } : null
    }
    add('registerRenameProvider', {
      // F2: the name to rename and its place. A reason shown at the cursor when there is none.
      async resolveRenameLocation(model, position) {
        const f = current(model)
        if (!f) return { range: wordAt(model, position)?.range, text: '', rejectReason: STARTING }
        const cap = f.entry.caps.renameProvider
        if (!cap) return { range: wordAt(model, position)?.range, text: '', rejectReason: 'This language server cannot rename.' }
        if (typeof cap === 'object' && cap.prepareProvider) {
          let r
          try {
            r = await f.entry.conn.request('textDocument/prepareRename', { textDocument: { uri: f.uri },
              position: positionOf(position) })
          } catch (e) {
            return { range: wordAt(model, position)?.range, text: '', rejectReason: e.message }
          }
          if (!r) return { range: wordAt(model, position)?.range, text: '', rejectReason: 'This cannot be renamed.' }
          if (r.defaultBehavior) return wordAt(model, position)
          if (r.start) return { range: rangeOf(r), text: model.getValueInRange(rangeOf(r)) }
          return { range: rangeOf(r.range), text: r.placeholder ?? model.getValueInRange(rangeOf(r.range)) }
        }
        return wordAt(model, position)
      },
      // The edits are applied here, in every file (see applyWorkspaceEdit); Monaco is given none to apply, as its own
      // edit service knows only the file shown.
      async provideRenameEdits(model, position, newName) {
        const f = current(model)
        if (!f) { notify.info(STARTING); return { edits: [] } }
        let edit
        // ADM-1335: never while the project loads (the answer would cover the open files only). Asked again, at most
        // twice, when a load began while it was being asked; never applied from a load's half-answer.
        for (let attempt = 0; ; attempt++) {
          if (f.entry.loading.size) {
            if (attempt === 0) notify.info(RENAME_WAITING)
            if (!(await whenLoaded(f.entry, PROJECT_LOADING_WAIT_MS))) { notify.warning(RENAME_NOT_LOADED); return { edits: [] } }
          }
          const epoch = f.entry.loadingEpoch
          try {
            edit = await f.entry.conn.request('textDocument/rename', { textDocument: { uri: f.uri },
              position: positionOf(position), newName })
          } catch (e) {
            notify.error(`Nothing was renamed: ${e.message}`)
            return { edits: [] }
          }
          if (f.entry.loadingEpoch === epoch) break
          if (attempt >= 2) { notify.warning(RENAME_NOT_LOADED); return { edits: [] } }
        }
        if (!edit) { notify.info('Nothing was renamed: the language server found nothing to change.'); return { edits: [] } }
        await applyWorkspaceEdit(f.entry, edit, { rename: true })
        return { edits: [] }
      },
    })
    add('registerCodeActionProvider', {
      // Ctrl+. and the light bulb: the server's actions for the place, given the problems reported there.
      async provideCodeActions(model, range, context) {
        const none = { actions: [], dispose() {} }
        const f = current(model)
        if (!f || !f.entry.caps.codeActionProvider) return none
        const where = lspRangeOf(range)
        const diagnostics = (f.entry.raw.get(f.path) || []).filter((d) => d && d.range && touches(d.range, where))
        let r
        try {
          r = await f.entry.conn.request('textDocument/codeAction', { textDocument: { uri: f.uri }, range: where,
            context: { diagnostics, ...(context && context.only ? { only: [context.only] } : {}),
              triggerKind: context && context.trigger === 2 ? 2 : 1 } })
        } catch {
          return none
        }
        const actions = (Array.isArray(r) ? r : []).filter((a) => a && a.title).map((a) => ({
          title: a.title,
          kind: typeof a.command === 'string' ? undefined : a.kind,
          isPreferred: !!a.isPreferred,
          disabled: a.disabled ? a.disabled.reason : undefined,
          command: { id: CODE_ACTION_COMMAND, title: a.title, arguments: [f.lang, a] },
        }))
        return { actions, dispose() {} }
      },
    }, { providedCodeActionKinds: CODE_ACTION_KINDS.filter(Boolean) })
    add('registerInlayHintsProvider', {
      async provideInlayHints(model, range) {
        const none = { hints: [], dispose() {} }
        const f = current(model)
        if (!f || !f.entry.caps.inlayHintProvider) return none
        const r = await f.entry.conn.request('textDocument/inlayHint', { textDocument: { uri: f.uri },
          range: lspRangeOf(range) }).catch(() => null)
        return { hints: inlayHintsOf(r), dispose() {} }
      },
    })
    add('registerDocumentFormattingEditProvider', {
      displayName: lang === 'python' ? "The project's Python formatter" : 'The TypeScript language server',
      provideDocumentFormattingEdits: (model) => monacoFormat(model, null),
    })
    if (lang !== 'python') {
      add('registerDocumentRangeFormattingEditProvider', {
        displayName: 'The TypeScript language server',
        provideDocumentRangeFormattingEdits: (model, range) => monacoFormat(model, range),
      })
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
      registerEditing(monaco, lang)
    }
    // A code action chosen in the editor's menu runs here (see CODE_ACTION_COMMAND).
    if (typeof monaco.editor.registerCommand === 'function') {
      disposables.push(monaco.editor.registerCommand(CODE_ACTION_COMMAND, (_accessor, lang, action) => runCodeAction(lang, action)))
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
    // The release of THIS binding only. The editor is re-created when a project turns ready (CodeBrowser's key), and
    // the old one's unmount came after the new one had bound: a plain unbind() tore down the new binding (no didChange,
    // no markers, Monaco's own TypeScript left on; live 2026-11-12).
    const mine = editorCtx
    return () => { if (ctx === mine) unbind() }
  }

  function unbind() {
    if (scope) { scope.stop(); scope = null }
    while (disposables.length) { try { disposables.pop().dispose() } catch { /* already gone */ } }
    ctx = null
  }

  // ── the bottom panel ──
  // `running`: a Check project job found still running when the page opened again (ADM-1269); its answer lands here.
  async function check(running = null) {
    checking.value = true
    checkError.value = ''
    try {
      const { data } = running
        ? await api.waitForProjectJob(val(systemId), val(repoId), running)
        : await api.checkProjectProblems(val(systemId), val(repoId))
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
    canFormat, formatEdits,
    // for tests
    _conns: conns, _diagnostics: diagnostics, _changed: changed, _flush: flush, _syncDocs: syncDocs,
    _applyWorkspaceEdit: applyWorkspaceEdit }
}
