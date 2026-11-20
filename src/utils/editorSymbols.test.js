// A file's symbols for the Outline and the breadcrumbs (ADM-1322): the language server's documentSymbol answer, a tree
// or a flat list, as one tree with Monaco's 1-based places; the symbols the cursor is in.
import { describe, it, expect } from 'vitest'
import { symbolsOf, symbolChainAt, flattenSymbols, symbolKind, symbolIcon } from './editorSymbols'

const r = (sl, sc, el, ec) => ({ start: { line: sl, character: sc }, end: { line: el, character: ec } })

// As typescript-language-server answers for:  class Cart { add(item) { … } total() { … } }  function main() { … }
const TREE = [
  { name: 'main', kind: 12, range: r(10, 0, 12, 1), selectionRange: r(10, 9, 10, 13), children: [] },
  { name: 'Cart', kind: 5, detail: '', range: r(0, 0, 8, 1), selectionRange: r(0, 6, 0, 10), children: [
    { name: 'total', kind: 6, range: r(5, 2, 7, 3), selectionRange: r(5, 2, 5, 7) },
    { name: 'add', kind: 6, range: r(1, 2, 3, 3), selectionRange: r(1, 2, 1, 5) },
  ] },
]

describe('symbolsOf', () => {
  it('a tree keeps its nesting, in file order, with 1-based places and the name as the selection', () => {
    const s = symbolsOf(TREE)
    expect(s.map((x) => x.name)).toEqual(['Cart', 'main'])
    expect(s[0].children.map((x) => x.name)).toEqual(['add', 'total'])
    expect(s[0].range).toEqual({ startLine: 1, startColumn: 1, endLine: 9, endColumn: 2 })
    expect(s[0].selection).toEqual({ startLine: 1, startColumn: 7, endLine: 1, endColumn: 11 })
    expect(new Set(flattenSymbols(s).map((x) => x.symbol.key)).size).toBe(4)     // every symbol has its own key
  })

  it('a flat list (SymbolInformation, as pyright answers) is nested by where each symbol is', () => {
    const flat = [
      { name: 'Cart', kind: 5, location: { uri: 'u', range: r(0, 0, 8, 0) } },
      { name: 'add', kind: 6, containerName: 'Cart', location: { uri: 'u', range: r(1, 4, 3, 0) } },
      { name: 'main', kind: 12, location: { uri: 'u', range: r(10, 0, 12, 0) } },
    ]
    const s = symbolsOf(flat)
    expect(s.map((x) => x.name)).toEqual(['Cart', 'main'])
    expect(s[0].children.map((x) => [x.name, x.detail])).toEqual([['add', 'Cart']])
  })

  it('no answer, or broken items, give no symbols (never an error)', () => {
    expect(symbolsOf(null)).toEqual([])
    expect(symbolsOf([{ name: 'x' }, null, { kind: 5, range: r(0, 0, 1, 0) }])).toEqual([])
  })
})

describe('the symbols at the cursor', () => {
  it('outermost first; nothing outside every symbol', () => {
    const s = symbolsOf(TREE)
    expect(symbolChainAt(s, 2, 5).map((x) => x.name)).toEqual(['Cart', 'add'])
    expect(symbolChainAt(s, 5, 1).map((x) => x.name)).toEqual(['Cart'])
    expect(symbolChainAt(s, 10, 1)).toEqual([])
    expect(symbolChainAt(null, 1, 1)).toEqual([])
  })

  it('every kind has a word and an icon', () => {
    expect([symbolKind(5), symbolKind(12), symbolKind(99)]).toEqual(['class', 'function', 'symbol'])
    expect(symbolIcon(5)).toBe('lucide:box')
    expect(symbolIcon(99)).toBe('lucide:shapes')
  })
})
