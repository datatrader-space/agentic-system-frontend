// Reviewing the Coding Agent's edits one change at a time (ADM-1314) and commenting on them (ADM-1329).
//
// A CHANGE ("hunk") is one run of lines that differ between the file before the turn and the file now:
// { oStart, oCount, mStart, mCount }, 1-based line numbers. `oCount` lines of the BEFORE text from `oStart` were
// replaced by `mCount` lines of the AFTER text from `mStart`. A count of 0 is an insertion (nothing before) or a
// deletion (nothing now); its start is the line the change sits in front of. Lines are the text split on '\n', so a
// file joined back is byte for byte the same (its '\r' and its last newline stay).
//
// The editor's own diff (Monaco's getLineChanges) gives the changes it highlights; `fromMonaco` turns them into this
// form. `diffLines` is the same diff done here, for a file the editor has not compared yet.

export function splitLines(text) {
  return String(text ?? '').split('\n')
}

// Monaco's ILineChange -> a change. An end line of 0 means that side has no lines; its start is the line before.
export function fromMonaco(changes) {
  return (changes || []).map((c) => {
    const oCount = c.originalEndLineNumber === 0 ? 0 : c.originalEndLineNumber - c.originalStartLineNumber + 1
    const mCount = c.modifiedEndLineNumber === 0 ? 0 : c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1
    return {
      oStart: oCount === 0 ? c.originalStartLineNumber + 1 : c.originalStartLineNumber,
      oCount,
      mStart: mCount === 0 ? c.modifiedStartLineNumber + 1 : c.modifiedStartLineNumber,
      mCount,
    }
  })
}

// The edit script's size beyond which the middle of a file that is almost all different is one change: the trace a
// shortest edit script needs grows with (differences x lines), and a whole rewritten file is one change anyway.
const TRACE_LIMIT = 20_000_000

// The changes between two texts (Myers' shortest edit script, after the lines both ends share).
export function diffLines(beforeText, afterText) {
  const a = splitLines(beforeText)
  const b = splitLines(afterText)
  if (beforeText == null || beforeText === '') a.length = 0
  if (afterText == null || afterText === '') b.length = 0
  let pre = 0
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++
  let suf = 0
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++
  const A = a.slice(pre, a.length - suf)
  const B = b.slice(pre, b.length - suf)
  const N = A.length
  const M = B.length
  if (!N && !M) return []
  if (!N || !M) return [{ oStart: pre + 1, oCount: N, mStart: pre + 1, mCount: M }]

  const max = N + M
  const off = max
  let v = new Int32Array(2 * max + 2)
  const trace = []
  let found = false
  for (let d = 0; d <= max && !found; d++) {
    if ((d + 1) * v.length > TRACE_LIMIT) return [{ oStart: pre + 1, oCount: N, mStart: pre + 1, mCount: M }]
    trace.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1
      let y = x - k
      while (x < N && y < M && A[x] === B[y]) { x++; y++ }
      v[off + k] = x
      if (x >= N && y >= M) { found = true; break }
    }
  }
  // Back from the end: '=' a line both share, '-' a line only before has, '+' a line only now has.
  const ops = []
  let x = N
  let y = M
  for (let d = trace.length - 1; d >= 0; d--) {
    v = trace[d]
    const k = x - y
    const prevK = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? k + 1 : k - 1
    const prevX = v[off + prevK]
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) { ops.push('='); x--; y-- }
    if (d > 0) {
      if (x === prevX) { ops.push('+'); y-- } else { ops.push('-'); x-- }
    }
  }
  ops.reverse()
  const hunks = []
  let i = 0
  let j = 0
  let cur = null
  for (const op of ops) {
    if (op === '=') {
      if (cur) { hunks.push(cur); cur = null }
      i++; j++
      continue
    }
    if (!cur) cur = { oStart: pre + i + 1, oCount: 0, mStart: pre + j + 1, mCount: 0 }
    if (op === '-') { cur.oCount++; i++ } else { cur.mCount++; j++ }
  }
  if (cur) hunks.push(cur)
  return hunks
}

// The file as it is now with ONE change put back: that change's lines now are replaced by its lines before.
export function revertHunk(afterText, beforeText, hunk) {
  const m = afterText ? splitLines(afterText) : []
  const o = beforeText ? splitLines(beforeText) : []
  const back = o.slice(hunk.oStart - 1, hunk.oStart - 1 + hunk.oCount)
  return [...m.slice(0, hunk.mStart - 1), ...back, ...m.slice(hunk.mStart - 1 + hunk.mCount)].join('\n')
}

// The lines a change holds on each side.
export function hunkLines(beforeText, afterText, hunk) {
  const o = beforeText ? splitLines(beforeText) : []
  const m = afterText ? splitLines(afterText) : []
  return {
    before: o.slice(hunk.oStart - 1, hunk.oStart - 1 + hunk.oCount),
    after: m.slice(hunk.mStart - 1, hunk.mStart - 1 + hunk.mCount),
  }
}

// FNV-1a: a short, stable name for a change's text, so "kept" survives a reload that moves the change's lines.
function fnv(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}
// A change is named by its file and its text on both sides (not its line numbers): undoing another change of the
// file moves its lines, never its name.
export function hunkKey(path, beforeText, afterText, hunk) {
  const { before, after } = hunkLines(beforeText, afterText, hunk)
  return `h|${path}|${fnv(before.join('\n') + '\u0000' + after.join('\n'))}`
}
// A file with no text to compare (a binary file, or one that holds secrets) is kept as a whole, at its version now.
export function fileKey(file) {
  return `f|${file.path}|${file.sha || file.status || ''}`
}

// Lines `line - 2` to `line + 2` of a text, numbered: what a comment shows of the code around it.
export function snippetAround(text, line, around = 2) {
  const lines = text ? splitLines(text) : []
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()      // the file's last newline is no line
  if (!lines.length) return ''
  const from = Math.max(1, line - around)
  const to = Math.min(lines.length, line + around)
  const width = String(to).length
  const out = []
  for (let n = from; n <= to; n++) out.push(`${String(n).padStart(width, ' ')} | ${lines[n - 1].replace(/\r$/, '')}`)
  return out.join('\n')
}

// A fence longer than any run of backticks in the code, so a snippet holding ``` stays inside its block.
function fenceFor(code) {
  const runs = String(code).match(/`{3,}/g) || []
  const longest = runs.reduce((n, r) => Math.max(n, r.length), 2)
  return '`'.repeat(longest + 1)
}

// The one message the review's comments become: an intro line, then for each comment its place, its words and the
// code around it. Plain text: it is read by the Coding Agent like anything the person types.
export function reviewMessage(comments) {
  const list = (comments || []).filter((c) => c && String(c.text || '').trim())
  if (!list.length) return ''
  const intro = list.length === 1
    ? 'I reviewed your changes and left 1 comment. Please address it:'
    : `I reviewed your changes and left ${list.length} comments. Please address them:`
  const blocks = list.map((c) => {
    const where = `${c.path}:${c.line}${c.side === 'before' ? ' (in the file before your change)' : ''}`
    const parts = [where, String(c.text).trim()]
    if (c.snippet) {
      const fence = fenceFor(c.snippet)
      parts.push(`${fence}\n${c.snippet}\n${fence}`)
    }
    return parts.join('\n')
  })
  return [intro, ...blocks].join('\n\n')
}
