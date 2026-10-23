import { describe, expect, it } from 'vitest'
import { freeWorkflowPosition } from './workflowNodePlacement'
describe('workflow placement', () => {
  it('preserves an unoccupied preferred position', () => expect(freeWorkflowPosition([], { x: 20, y: 30 })).toEqual({ x: 20, y: 30 }))
  it('places added content outside an existing node without moving that node', () => {
    const nodes = [{ position: { x: 0, y: 0 }, dimensions: { width: 230, height: 110 } }]
    const position = freeWorkflowPosition(nodes, { x: 0, y: 0 })
    expect(position).toEqual({ x: 0, y: 138 })
    expect(nodes[0].position).toEqual({ x: 0, y: 0 })
  })
  it('reserves enough space for a multi-node pasted group', () => {
    const position = freeWorkflowPosition([{ position: { x: 0, y: 0 } }], { x: 48, y: 48 }, { width: 560, height: 250 })
    expect(position.y).toBeGreaterThanOrEqual(138)
  })
})
