// The editor's inline blame (ADM-1321).
import { describe, it, expect } from 'vitest'
import { blameRuns, blameLabel, blameDecorations, blameHover } from './blame'

class Range { constructor(a, b, c, d) { Object.assign(this, { a, b, c, d }) } }
const NOW = Date.parse('2026-11-20T12:00:00Z')
const data = {
  lines: ['c1', 'c1', 'c2', 'c1', '0'.repeat(40)],
  commits: {
    c1: { short: 'c1aaaaa', author: 'Ada', date: '2026-11-17T12:00:00Z', subject: 'First', uncommitted: false },
    c2: { short: 'c2bbbbb', author: 'Bo *bold*', date: '2026-11-20T11:00:00Z', subject: 'Second [x](y)', uncommitted: false },
    ['0'.repeat(40)]: { short: '0000000', author: 'Not Committed Yet', date: '', subject: '', uncommitted: true },
  },
}

describe('blame', () => {
  it('groups lines from one commit and labels the first line of each run', () => {
    expect(blameRuns(data.lines).map((r) => [r.start, r.end])).toEqual([[1, 2], [3, 3], [4, 4], [5, 5]])
    const deco = blameDecorations(Range, data, NOW)
    expect(deco).toHaveLength(5)                                    // every line has its hover
    expect(deco.filter((d) => d.options.after).map((d) => d.range.a)).toEqual([1, 3, 4, 5])
    expect(deco[0].options.after.content.trim()).toBe('Ada, 3 days ago · First')
    expect(deco[1].options.after).toBeUndefined()
    expect(deco[4].options.after.content.trim()).toBe('Not committed yet')
  })

  it('the hover is plain text: an author or subject cannot inject markdown', () => {
    const h = blameHover(data.commits.c2)
    expect(h.value).toContain('Bo \\*bold\\*')
    expect(h.value).toContain('Second \\[x\\]\\(y\\)')
    expect(h.isTrusted).toBeUndefined()
    expect(blameLabel(data.commits.c2, NOW)).toBe('Bo *bold*, 1 hour ago · Second [x](y)')
  })
})
