// The parts of a search result's line, with the matches marked, for the Let's Code Search panel (ADM-1205).
//
// The server says WHICH lines match (git grep); this finds WHERE on the line, with the same options, to mark them.
// Plain text is matched as text, `regex` as a JavaScript regular expression (git's extended syntax reads the same for
// what people type: classes, groups, alternation, anchors). A pattern JavaScript cannot read leaves the line
// unmarked, never broken.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function matcher(q, { matchCase = false, wholeWord = false, regex = false } = {}) {
  if (!q) return null
  let src = regex ? q : escape(q)
  if (wholeWord) src = `(?<![\\w])(?:${src})(?![\\w])`
  try {
    return new RegExp(src, matchCase ? 'g' : 'gi')
  } catch {
    return null
  }
}

// [{ text, hit }] covering the whole line, in order.
export function highlight(line, q, opts = {}) {
  const text = line || ''
  const re = matcher(q, opts)
  if (!re) return [{ text, hit: false }]
  const parts = []
  let last = 0
  for (const m of text.matchAll(re)) {
    if (!m[0]) continue                                   // an empty match marks nothing
    if (m.index > last) parts.push({ text: text.slice(last, m.index), hit: false })
    parts.push({ text: m[0], hit: true })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false })
  return parts.length ? parts : [{ text, hit: false }]
}

// A long line (minified code) is shown from a little before its first match, so the match is in view in a narrow
// panel. Only the VIEW starts later: the whole line is in the row's title and in the file it opens.
export const LEAD = 32

export function inView(parts) {
  const first = parts.findIndex((p) => p.hit)
  if (first < 0) return parts
  const before = parts.slice(0, first).reduce((n, p) => n + p.text.length, 0)
  if (before <= LEAD) return parts
  let skip = before - LEAD
  const out = [{ text: '…', hit: false, ellipsis: true }]
  for (const p of parts) {
    if (skip >= p.text.length) { skip -= p.text.length; continue }
    out.push({ ...p, text: p.text.slice(skip) })
    skip = 0
  }
  return out
}

// Matches grouped by file, in the server's order: [{ path, matches: [...] }].
export function byFile(matches) {
  const groups = new Map()
  for (const m of matches || []) {
    if (!groups.has(m.path)) groups.set(m.path, { path: m.path, matches: [] })
    groups.get(m.path).matches.push(m)
  }
  return [...groups.values()]
}
