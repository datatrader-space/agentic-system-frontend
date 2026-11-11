// `@` file mentions in the Let's Code chat (ADM-1205 phase E): where the `@word` being typed is, and which picked
// files the message still mentions when it is sent.

// The mention being typed at `caret`: an `@` at the start or after a space, then no space. { start, query } or null.
export function mentionAt(text, caret) {
  const before = String(text || '').slice(0, caret ?? String(text || '').length)
  const m = /(^|\s)@([^\s@]*)$/.exec(before)
  if (!m) return null
  return { start: before.length - m[2].length - 1, query: m[2] }
}

// The picked paths the text still mentions as `@path` (a mention the person deleted is not sent), in pick order.
export function mentionedPaths(text, picked) {
  const t = String(text || '')
  return [...new Set(picked || [])].filter((p) => {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|\\s)@${esc}(?=$|\\s|[,.;:!?)])`).test(t)
  })
}

// What "Ask the Coding Agent about this" sends from the editor: the selected lines, or the line the cursor is on,
// with the file and the line numbers. Only for a file tab (a diff has no single file). Null when there is no text.
export function codeSelection(model, sel, tab) {
  if (!model || !sel || !tab || tab.type !== 'file' || !tab.path) return null
  const start = sel.startLineNumber
  let end = sel.endLineNumber
  if (end > start && sel.endColumn === 1) end -= 1          // a selection ending at a line's start does not take it
  const empty = sel.startLineNumber === sel.endLineNumber && sel.startColumn === sel.endColumn
  const text = empty
    ? model.getLineContent(start)
    : model.getValueInRange({ startLineNumber: start, startColumn: 1, endLineNumber: end, endColumn: model.getLineMaxColumn(end) })
  if (!String(text).trim()) return null
  return { path: tab.path, start_line: start, end_line: end, text }
}
