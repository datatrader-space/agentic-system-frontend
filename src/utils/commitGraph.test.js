// The commit graph's lanes (ADM-1321): a merge opens a lane, lines join at their commit, and a page drawn later
// continues the lines of the page before it.
import { describe, it, expect } from 'vitest'
import { layoutGraph } from './commitGraph'

// M merges F into A; both start from B. S is a side branch from B, newest of all.
const S = { sha: 's', parents: ['b'] }
const M = { sha: 'm', parents: ['a', 'f'] }
const A = { sha: 'a', parents: ['b'] }
const F = { sha: 'f', parents: ['b'] }
const B = { sha: 'b', parents: [] }
const pick = (rows) => rows.map((r) => ({ sha: r.sha, lane: r.lane, edges: r.edges.map((e) => `${e.half}:${e.from}>${e.to}`) }))

describe('layoutGraph', () => {
  it('draws a merge: its second parent gets a lane, and the lanes join at the commit they wait for', () => {
    const { rows, lanes } = layoutGraph([M, A, F, B])
    expect(pick(rows)).toEqual([
      { sha: 'm', lane: 0, edges: ['bottom:0>0', 'bottom:0>1'] },
      { sha: 'a', lane: 0, edges: ['top:0>0', 'top:1>1', 'bottom:0>0', 'bottom:1>1'] },
      { sha: 'f', lane: 1, edges: ['top:0>0', 'top:1>1', 'bottom:1>0', 'bottom:0>0'] },
      { sha: 'b', lane: 0, edges: ['top:0>0'] },
    ])
    expect(rows.map((r) => r.width)).toEqual([2, 2, 2, 1])
    expect(rows[1].edges.find((e) => e.from === 1).color).not.toBe(rows[0].color)   // each line its own colour
    expect(lanes).toEqual([])                                                        // the root closes every lane
  })

  it('a branch tip that nothing above waits for starts in a free lane', () => {
    const { rows } = layoutGraph([S, M, A, F, B])
    expect(rows[0].lane).toBe(0)
    expect(rows[1].lane).toBe(1)                     // lane 0 is waiting for b (the side branch's parent)
    // a and f join the line already waiting for b: one lane reaches it, never three.
    expect(rows[2].edges.filter((e) => e.half === 'bottom' && e.from === 1).map((e) => e.to)).toEqual([0])
    expect(rows[rows.length - 1].edges.filter((e) => e.half === 'top').map((e) => e.to)).toEqual([0])
  })

  it('a later page continues the lines exactly as one long page would', () => {
    const whole = layoutGraph([S, M, A, F, B]).rows
    const first = layoutGraph([S, M])
    const second = layoutGraph([A, F, B], first.lanes, first.nextColor)
    expect([...first.rows, ...second.rows]).toEqual(whole)
  })
})
