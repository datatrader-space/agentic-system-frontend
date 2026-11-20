// A file's symbols for the Outline view and the breadcrumbs (ADM-1322), from the language server's
// textDocument/documentSymbol answer. A server answers either a tree (DocumentSymbol[]: each with its whole `range`,
// the name's `selectionRange` and `children`) or a flat list (SymbolInformation[]: each with a `location` and the name
// of its container). Both become one tree here, with 1-based lines and columns as Monaco counts them.

// LSP SymbolKind (1 File … 26 TypeParameter): a word for screen readers and an icon for the row.
const KINDS = {
  1: ['file', 'lucide:file'], 2: ['module', 'lucide:package'], 3: ['namespace', 'lucide:braces'],
  4: ['package', 'lucide:package'], 5: ['class', 'lucide:box'], 6: ['method', 'lucide:square-function'],
  7: ['property', 'lucide:wrench'], 8: ['field', 'lucide:tag'], 9: ['constructor', 'lucide:hammer'],
  10: ['enum', 'lucide:list-ordered'], 11: ['interface', 'lucide:component'], 12: ['function', 'lucide:square-function'],
  13: ['variable', 'lucide:variable'], 14: ['constant', 'lucide:pi'], 15: ['string', 'lucide:quote'],
  16: ['number', 'lucide:hash'], 17: ['boolean', 'lucide:toggle-left'], 18: ['array', 'lucide:brackets'],
  19: ['object', 'lucide:braces'], 20: ['key', 'lucide:key-round'], 21: ['null', 'lucide:circle-slash'],
  22: ['enum member', 'lucide:list'], 23: ['struct', 'lucide:box'], 24: ['event', 'lucide:zap'],
  25: ['operator', 'lucide:plus'], 26: ['type parameter', 'lucide:type'],
}
export const symbolKind = (kind) => (KINDS[kind] || ['symbol'])[0]
export const symbolIcon = (kind) => (KINDS[kind] || [null, 'lucide:shapes'])[1]

const range = (r) => (r && r.start && r.end ? {
  startLine: r.start.line + 1, startColumn: r.start.character + 1, endLine: r.end.line + 1, endColumn: r.end.character + 1,
} : null)

const contains = (r, line, column) => !!r
  && (line > r.startLine || (line === r.startLine && column >= r.startColumn))
  && (line < r.endLine || (line === r.endLine && column <= r.endColumn))
const byPlace = (a, b) => a.range.startLine - b.range.startLine || a.range.startColumn - b.range.startColumn

/** The server's answer as one tree: [{ key, name, detail, kind, range, selection, children }], in file order. */
export function symbolsOf(result) {
  if (!Array.isArray(result)) return []
  let n = 0
  const node = (name, detail, kind, r, sel) => ({ key: `s${n++}`, name: String(name ?? ''), detail: detail ? String(detail) : '',
    kind: kind || 0, range: r, selection: sel || r, children: [] })
  const tree = (items) => items.filter((s) => s && s.name != null && range(s.range)).map((s) => {
    const out = node(s.name, s.detail, s.kind, range(s.range), range(s.selectionRange))
    out.children = tree(Array.isArray(s.children) ? s.children : []).sort(byPlace)
    return out
  }).sort(byPlace)
  if (result.some((s) => s && s.location)) {
    // A flat list: each symbol goes inside the innermost earlier symbol whose range holds it.
    const flat = result.filter((s) => s && s.name != null && s.location && range(s.location.range))
      .map((s) => node(s.name, s.containerName, s.kind, range(s.location.range))).sort(byPlace)
    const roots = []
    const open = []
    for (const s of flat) {
      while (open.length && !contains(open[open.length - 1].range, s.range.startLine, s.range.startColumn)) open.pop()
      ;(open.length ? open[open.length - 1].children : roots).push(s)
      open.push(s)
    }
    return roots
  }
  return tree(result)
}

/** The symbols the cursor is in, the outermost first (the breadcrumbs after the file's name). */
export function symbolChainAt(symbols, line, column) {
  const chain = []
  let level = symbols || []
  for (;;) {
    const hit = level.find((s) => contains(s.range, line, column))
    if (!hit) return chain
    chain.push(hit)
    level = hit.children
  }
}

/** Every symbol, in the order the Outline lists them (a parent before its children). */
export function flattenSymbols(symbols, depth = 0, out = []) {
  for (const s of symbols || []) {
    out.push({ symbol: s, depth })
    flattenSymbols(s.children, depth + 1, out)
  }
  return out
}
