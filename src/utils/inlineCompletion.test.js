// Inline suggestions in the Let's Code editor (ADM-1316): Monaco's provider asks after a pause in typing, cancels a
// stale request, never asks with the completion list open, in a protected file or while suggestions are off or
// stopped, sends bounded text, and a refusal stops suggestions with the server's reason (a rate limit only pauses).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInlineCompletionProvider, contextAround, isProtectedPath, midWord, MAX_PREFIX_CHARS, MAX_SUFFIX_CHARS }
  from './inlineCompletion'

// A Monaco text model over plain text (1-based lines and columns, as Monaco's).
function textModel(text) {
  const lines = text.split('\n')
  const offset = (l, c) => lines.slice(0, l - 1).reduce((n, s) => n + s.length + 1, 0) + (c - 1)
  return {
    getLineCount: () => lines.length,
    getLineMaxColumn: (l) => lines[l - 1].length + 1,
    getLineContent: (l) => lines[l - 1],
    getValueInRange: (r) => text.slice(offset(r.startLineNumber, r.startColumn), offset(r.endLineNumber, r.endColumn)),
  }
}

function token() {
  const subs = []
  return {
    isCancellationRequested: false,
    onCancellationRequested(fn) { subs.push(fn); return { dispose() {} } },
    cancel() { this.isCancellationRequested = true; subs.forEach((f) => f()) },
  }
}

const MODEL = textModel('function add(a, b) {\n  \n}\n')
const AT = { lineNumber: 2, column: 3 }

let deps
beforeEach(() => {
  deps = {
    request: vi.fn(async () => ({ data: { suggestion: 'return a + b', spent_today_usd: '0.0004' } })),
    fileOf: vi.fn(() => ({ path: 'src/math.ts', language: 'typescript' })),
    active: vi.fn(() => true),
    stop: vi.fn(),
    spent: vi.fn(),
    debounceMs: 5,
  }
})

describe('the inline-completions provider', () => {
  it('asks once after the pause with the text around the cursor and returns ghost text at the cursor', async () => {
    const p = createInlineCompletionProvider(deps)
    const out = await p.provideInlineCompletions(MODEL, AT, {}, token())
    expect(deps.request).toHaveBeenCalledTimes(1)
    const [body, opts] = deps.request.mock.calls[0]
    expect(body).toEqual({ path: 'src/math.ts', language: 'typescript', prefix: 'function add(a, b) {\n  ', suffix: '\n}\n' })
    expect(opts.signal).toBeInstanceOf(AbortSignal)
    expect(out.items).toEqual([{ insertText: 'return a + b',
      range: { startLineNumber: 2, startColumn: 3, endLineNumber: 2, endColumn: 3 } }])
    expect(deps.spent).toHaveBeenCalledWith({ suggestion: 'return a + b', spent_today_usd: '0.0004' })
  })

  it('a keystroke during the pause cancels it: nothing is asked', async () => {
    const p = createInlineCompletionProvider({ ...deps, debounceMs: 50 })
    const t = token()
    const pending = p.provideInlineCompletions(MODEL, AT, {}, t)
    t.cancel()
    expect(await pending).toBeNull()
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('a newer request aborts the one in flight', async () => {
    let first
    deps.request.mockImplementationOnce((_b, { signal }) => new Promise((_res, rej) => {
      first = signal
      signal.addEventListener('abort', () => rej(Object.assign(new Error('canceled'), { name: 'CanceledError' })))
    }))
    const p = createInlineCompletionProvider(deps)
    const a = p.provideInlineCompletions(MODEL, AT, {}, token())
    await new Promise((r) => setTimeout(r, 20))
    const b = p.provideInlineCompletions(MODEL, AT, {}, token())
    expect(first.aborted).toBe(true)
    expect(await a).toBeNull()
    expect((await b).items[0].insertText).toBe('return a + b')
    expect(deps.stop).not.toHaveBeenCalled()                 // a cancel is never a failure
  })

  it('never asks with the completion list open, when off or stopped, outside an editable file, or mid-word', async () => {
    const p = createInlineCompletionProvider(deps)
    expect(await p.provideInlineCompletions(MODEL, AT, { selectedSuggestionInfo: { text: 'x' } }, token())).toBeNull()
    deps.active.mockReturnValueOnce(false)
    expect(await p.provideInlineCompletions(MODEL, AT, {}, token())).toBeNull()
    deps.fileOf.mockReturnValueOnce(null)
    expect(await p.provideInlineCompletions(MODEL, AT, {}, token())).toBeNull()
    expect(await p.provideInlineCompletions(textModel('const name = 1'), { lineNumber: 1, column: 9 }, {}, token())).toBeNull()
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('never sends anything of a protected file', async () => {
    const p = createInlineCompletionProvider(deps)
    for (const path of ['.env', 'config/.env.production', 'keys/server.pem', 'id_rsa', 'credentials.json', 'prod.tfvars']) {
      deps.fileOf.mockReturnValueOnce({ path, language: 'plaintext' })
      expect(await p.provideInlineCompletions(MODEL, AT, {}, token())).toBeNull()
    }
    expect(deps.request).not.toHaveBeenCalled()
    expect(isProtectedPath('.env.example')).toBe(false)
    expect(isProtectedPath('src/env.ts')).toBe(false)
  })

  it('a refusal stops suggestions with the server\'s reason', async () => {
    for (const [status, code] of [[403, 'off'], [429, 'daily_limit'], [402, 'balance'], [503, 'no_model'], [502, 'model_failed']]) {
      deps.stop.mockClear()
      deps.request.mockRejectedValueOnce({ response: { status, data: { code, error: `why ${code}` } } })
      const p = createInlineCompletionProvider(deps)
      expect(await p.provideInlineCompletions(MODEL, AT, {}, token())).toBeNull()
      expect(deps.stop).toHaveBeenCalledWith(code, `why ${code}`)
    }
  })

  it('a network failure stops suggestions and says so; nothing else is tried', async () => {
    deps.request.mockRejectedValueOnce(new Error('Network Error'))
    const p = createInlineCompletionProvider(deps)
    expect(await p.provideInlineCompletions(MODEL, AT, {}, token())).toBeNull()
    expect(deps.request).toHaveBeenCalledTimes(1)
    expect(deps.stop).toHaveBeenCalledWith('model_failed', expect.stringContaining('could not be reached'))
  })

  it('the rate limit pauses for the time asked, never stops', async () => {
    let clock = 1000
    deps.request.mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '7' }, data: { detail: 'throttled' } } })
    const p = createInlineCompletionProvider({ ...deps, now: () => clock })
    expect(await p.provideInlineCompletions(MODEL, AT, {}, token())).toBeNull()
    expect(deps.stop).not.toHaveBeenCalled()
    clock += 6000
    expect(await p.provideInlineCompletions(MODEL, AT, {}, token())).toBeNull()
    expect(deps.request).toHaveBeenCalledTimes(1)
    clock += 2000
    expect((await p.provideInlineCompletions(MODEL, AT, {}, token())).items).toHaveLength(1)
  })

  it('an empty answer shows nothing', async () => {
    deps.request.mockResolvedValueOnce({ data: { suggestion: '', skipped: 'protected_file' } })
    const p = createInlineCompletionProvider(deps)
    expect(await p.provideInlineCompletions(MODEL, AT, {}, token())).toEqual({ items: [] })
  })
})

describe('the text sent', () => {
  it('is bounded: the prefix keeps its end, the suffix its start', () => {
    const big = 'a'.repeat(9000) + 'NEAR\n' + 'AFTER' + 'b'.repeat(9000)
    const m = textModel(big)
    const { prefix, suffix } = contextAround(m, { lineNumber: 2, column: 1 })
    expect(prefix.length).toBe(MAX_PREFIX_CHARS)
    expect(prefix.endsWith('NEAR\n')).toBe(true)
    expect(suffix.length).toBe(MAX_SUFFIX_CHARS)
    expect(suffix.startsWith('AFTER')).toBe(true)
  })

  it('mid-word is a letter, digit, _ or $ right after the cursor', () => {
    const m = textModel('foo(bar) $x')
    expect(midWord(m, { lineNumber: 1, column: 2 })).toBe(true)
    expect(midWord(m, { lineNumber: 1, column: 4 })).toBe(false)
    expect(midWord(m, { lineNumber: 1, column: 10 })).toBe(true)
    expect(midWord(m, { lineNumber: 1, column: 12 })).toBe(false)
  })
})
