// "Tidy up" with dagre, left to right on the 16 px grid (ADM-1333 plan §3.1).
import { describe, it, expect } from 'vitest'
import { tidyOps, isBackwards, loopPath, GRID } from './wfLayout'
import { applyWorkflowOps } from '@/composables/useWorkflowDoc'

const n = (id, x, y) => ({ id, type: 'logic.delay', position: { x, y }, data: {} })

describe('tidyOps', () => {
  it('lays a chain out left to right, on the grid, from the old top-left corner', () => {
    const nodes = [n('a', 500, 300), n('b', 100, 100), n('c', 40, 700)]
    const edges = [{ id: '1', source: 'a', target: 'b' }, { id: '2', source: 'b', target: 'c' }]
    const ops = tidyOps(nodes, edges)
    const { state } = applyWorkflowOps({ name: 'W', nodes, edges, vars: {} }, ops)
    const pos = Object.fromEntries(state.nodes.map((x) => [x.id, x.position]))
    expect(pos.a.x).toBeLessThan(pos.b.x)
    expect(pos.b.x).toBeLessThan(pos.c.x)
    for (const p of Object.values(pos)) {
      expect(p.x % GRID).toBe(0)
      expect(p.y % GRID).toBe(0)
    }
    expect(Math.min(...Object.values(pos).map((p) => p.x))).toBe(48)   // the old left edge, 40, on the grid
  })
  it('returns no change for a layout that is already tidy, and nothing for an empty graph', () => {
    const nodes = [n('a', 0, 0), n('b', 100, 100)]
    const edges = [{ id: '1', source: 'a', target: 'b' }]
    const { state } = applyWorkflowOps({ name: 'W', nodes, edges, vars: {} }, tidyOps(nodes, edges))
    expect(tidyOps(state.nodes, edges)).toEqual([])
    expect(tidyOps([], [])).toEqual([])
  })
})

describe('backwards connections', () => {
  it('loop under the source', () => {
    expect(isBackwards(500, 100)).toBe(true)
    expect(isBackwards(100, 500)).toBe(false)
    const [d, , labelY] = loopPath(500, 100, 100, 120)
    expect(d.startsWith('M 500 100')).toBe(true)
    expect(labelY).toBe(192)
  })
})
