// Monaco's inline-completions provider for the Let's Code editor (ADM-1316): ghost text from the platform's
// inline-suggestion model (Codestral fill-in-the-middle, on the server). Tab accepts it and Esc dismisses it (Monaco's
// own keys), and Monaco announces a shown suggestion to a screen reader.
//
// - Asks only after a pause in typing (DEBOUNCE_MS), and only one request at a time: a new keystroke cancels the
//   pause and aborts the request in flight (Monaco's cancellation token + an AbortController).
// - Never asks while the completion list is open, while suggestions are off or stopped, in a read-only editor or a
//   diff, or in a protected file (.env, keys): the server refuses those too, and sends nothing of them to the model.
// - Sends the text the editor already holds (no sandbox wake), bounded like the server's own caps.
// - A refusal stops suggestions and the editor's status line says why (useInlineSuggestions); a rate-limit answer only
//   pauses them for the time the server asks.
import { STOP_CODES } from '@/composables/useInlineSuggestions'

export const DEBOUNCE_MS = 300
export const MAX_PREFIX_CHARS = 6000
export const MAX_SUFFIX_CHARS = 2000

// The same rule as the server (workspace_ledger.is_protected_path), by file name: a guard so nothing is sent.
const PROTECTED_EXACT = new Set(['.env', 'id_rsa', 'id_ed25519', '.npmrc', '.pypirc', 'credentials', '.netrc',
  '.git-credentials', '.dockercfg', 'secrets.json', 'credentials.json', 'secrets.yml', 'secrets.yaml', 'kubeconfig'])
const PROTECTED_EXCLUDE = new Set(['.env.example', '.env.sample', '.env.template', '.env.dist', '.env.defaults'])
const PROTECTED_RE = [/^\.env\..+/, /\.pem$/, /\.key$/, /\.keystore$/, /\.p12$/, /\.pfx$/, /^service-account.*\.json$/,
  /^firebase-adminsdk.*\.json$/, /\.tfvars$/, /\.tfvars\.json$/, /\.kubeconfig$/]

export function isProtectedPath(path) {
  const base = String(path || '').split(/[\\/]/).pop().toLowerCase()
  if (!base || PROTECTED_EXCLUDE.has(base)) return false
  return PROTECTED_EXACT.has(base) || PROTECTED_RE.some((re) => re.test(base))
}

// The text before and after the cursor, cut to the caps (the prefix keeps its end, the suffix its start).
export function contextAround(model, position) {
  const lines = model.getLineCount()
  const last = model.getLineMaxColumn(lines)
  const prefix = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber,
    endColumn: position.column })
  const suffix = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: position.column,
    endLineNumber: lines, endColumn: last })
  return { prefix: prefix.slice(-MAX_PREFIX_CHARS), suffix: suffix.slice(0, MAX_SUFFIX_CHARS) }
}

// In the middle of a word (a letter, digit or _ right after the cursor) a suggestion would split it: none is asked.
export function midWord(model, position) {
  const line = model.getLineContent(position.lineNumber)
  return /[\w$]/.test(line.charAt(position.column - 1))
}

function wait(ms, token) {
  return new Promise((resolve) => {
    if (token?.isCancellationRequested) { resolve(false); return }
    let sub = null
    const t = setTimeout(() => { sub?.dispose?.(); resolve(true) }, ms)
    sub = token?.onCancellationRequested?.(() => { clearTimeout(t); resolve(false) }) || null
  })
}

function isCancel(e) {
  return e?.name === 'CanceledError' || e?.name === 'AbortError' || e?.code === 'ERR_CANCELED'
}

// deps:
//   request(body, { signal }) -> Promise<axios response>   the server call (api.requestInlineCompletion bound to a project)
//   fileOf(model) -> { path, language } | null            the editable file this Monaco model is showing, or null
//   active() -> bool                                      suggestions on and not stopped
//   stop(code, message)                                   suggestions stop and the status line says why
//   spent(data)                                           today's spend, from an answer
//   debounceMs, now                                       tests
export function createInlineCompletionProvider(deps) {
  const debounceMs = deps.debounceMs ?? DEBOUNCE_MS
  const now = deps.now || (() => Date.now())
  let current = null           // the AbortController of the request in flight
  let pausedUntil = 0          // a rate-limit answer: no request before this time

  async function provideInlineCompletions(model, position, context, token) {
    if (!deps.active() || context?.selectedSuggestionInfo || now() < pausedUntil) return null
    const file = deps.fileOf(model)
    if (!file || !file.path || isProtectedPath(file.path) || midWord(model, position)) return null
    if (current) current.abort()                       // a newer keystroke wins
    const mine = new AbortController()
    current = mine
    const sub = token?.onCancellationRequested?.(() => mine.abort())
    try {
      if (!(await wait(debounceMs, token)) || mine.signal.aborted || !deps.active()) return null
      const { prefix, suffix } = contextAround(model, position)
      if (!prefix.trim() && !suffix.trim()) return null
      const { data } = await deps.request({ path: file.path, language: file.language || '', prefix, suffix },
        { signal: mine.signal })
      if (mine.signal.aborted || token?.isCancellationRequested) return null
      deps.spent?.(data)
      const text = data?.suggestion || ''
      if (!text) return { items: [] }
      const at = { startLineNumber: position.lineNumber, startColumn: position.column,
        endLineNumber: position.lineNumber, endColumn: position.column }
      return { items: [{ insertText: text, range: at }] }
    } catch (e) {
      if (isCancel(e) || mine.signal.aborted) return null
      const res = e?.response
      const code = res?.data?.code
      if (res?.status === 429 && !code) {
        // The rate limit: a short pause, never a stop.
        const after = Number(res.headers?.['retry-after'])
        pausedUntil = now() + (Number.isFinite(after) && after > 0 ? after * 1000 : 10000)
        return null
      }
      if (STOP_CODES.includes(code)) {
        deps.stop(code, res.data.error)
      } else {
        deps.stop('model_failed', res?.data?.error || 'Inline suggestions could not be reached.')
      }
      return null
    } finally {
      sub?.dispose?.()
      if (current === mine) current = null
    }
  }

  return {
    displayName: 'AADML inline suggestions',
    provideInlineCompletions,
    disposeInlineCompletions() { /* nothing is held per list */ },
    // Tests and the page: abort the request in flight (a project closes, the setting is turned off).
    cancel() { if (current) current.abort(); current = null },
  }
}
