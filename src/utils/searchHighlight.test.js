import { describe, it, expect } from 'vitest'
import { highlight, inView, byFile, matcher, LEAD, replaceBatches, BATCH_FILES, BATCH_CHARS } from './searchHighlight'

const hits = (parts) => parts.filter((p) => p.hit).map((p) => p.text)
const whole = (parts) => parts.map((p) => p.text).join('')

describe('highlight', () => {
  it('marks every match of plain text, ignoring case unless asked', () => {
    const parts = highlight('Price = price * PRICE', 'price')
    expect(hits(parts)).toEqual(['Price', 'price', 'PRICE'])
    expect(whole(parts)).toBe('Price = price * PRICE')
    expect(hits(highlight('Price = price', 'price', { matchCase: true }))).toEqual(['price'])
  })

  it('reads regex characters as text unless regex is on', () => {
    expect(hits(highlight('x = a.b(c) + axb(c)', 'a.b(c)'))).toEqual(['a.b(c)'])
    expect(hits(highlight('x = a.b(c) + axb(c)', 'a.b\\(c\\)', { regex: true }))).toEqual(['a.b(c)', 'axb(c)'])
  })

  it('whole word does not mark a part of a word', () => {
    expect(hits(highlight('price_total = price', 'price', { wholeWord: true }))).toEqual(['price'])
  })

  it('a pattern JavaScript cannot read leaves the line whole and unmarked', () => {
    expect(matcher('price(', { regex: true })).toBeNull()
    expect(highlight('price(', 'price(', { regex: true })).toEqual([{ text: 'price(', hit: false }])
  })

  it('an empty match marks nothing and never loops', () => {
    expect(hits(highlight('abc', 'x*', { regex: true }))).toEqual([])
  })
})

describe('inView', () => {
  it('starts a long line shortly before its first match, the rest of the line kept', () => {
    const line = `${'a'.repeat(200)}NEEDLE tail`
    const parts = inView(highlight(line, 'needle'))
    expect(parts[0]).toMatchObject({ text: '…', ellipsis: true })
    expect(whole(parts.slice(1))).toBe(`${'a'.repeat(LEAD)}NEEDLE tail`)
    expect(hits(parts)).toEqual(['NEEDLE'])
  })

  it('a short lead is shown as it is', () => {
    const parts = highlight('let price = 1', 'price')
    expect(inView(parts)).toEqual(parts)
  })
})

describe('byFile', () => {
  it('groups in the order the server sent', () => {
    const g = byFile([{ path: 'b.py', line: 1 }, { path: 'a.py', line: 3 }, { path: 'b.py', line: 9 }])
    expect(g.map((x) => [x.path, x.matches.map((m) => m.line)])).toEqual([['b.py', [1, 9]], ['a.py', [3]]])
  })
})

describe('replaceBatches', () => {
  const file = (path, chars) => ({ path, sha: 'x', lines: [{ line: 1, text: 'a'.repeat(chars) }] })
  it('keeps every file, in order, never more than BATCH_FILES or about BATCH_CHARS a batch', () => {
    const files = Array.from({ length: 60 }, (_, i) => file(`f${i}`, 10))
    const batches = replaceBatches(files)
    expect(batches.map((b) => b.length)).toEqual([BATCH_FILES, BATCH_FILES, 10])
    expect(batches.flat()).toEqual(files)
    const big = replaceBatches([file('a', BATCH_CHARS - 5), file('b', 10), file('c', BATCH_CHARS * 3)])
    expect(big.map((b) => b.map((f) => f.path))).toEqual([['a'], ['b'], ['c']])
    expect(replaceBatches([])).toEqual([])
  })
})
