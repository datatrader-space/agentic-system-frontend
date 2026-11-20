import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import {
  toFlowPosition, visibleCenter, nodeSize, findNode, fitView, updateNodeData, replaceNodeData, updateNode,
  setNodes, setEdges, selectedIds, deletionSet, deleteSelection,
} from './wfFlow'

function fakeFlow({ nodes = [], edges = [] } = {}) {
  return {
    screenToFlowCoordinate: vi.fn((p) => ({ x: p.x / 2, y: p.y / 2 })),
    vueFlowRef: ref({ getBoundingClientRect: () => ({ left: 100, top: 50, width: 400, height: 200 }) }),
    findNode: vi.fn((id) => nodes.find((n) => n.id === id)),
    fitView: vi.fn(),
    updateNodeData: vi.fn(),
    updateNode: vi.fn(),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    getSelectedNodes: ref(nodes.filter((n) => n.selected)),
    getSelectedEdges: ref(edges.filter((e) => e.selected)),
    getEdges: ref(edges),
  }
}

describe('wfFlow adapter', () => {
  it('converts screen points and finds the visible centre', () => {
    const flow = fakeFlow()
    expect(toFlowPosition(flow, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 })
    expect(visibleCenter(flow)).toEqual({ x: 150, y: 75 })
  })
  it('visibleCenter fails with a reason while the canvas is not mounted', () => {
    const flow = fakeFlow()
    flow.vueFlowRef.value = null
    expect(() => visibleCenter(flow)).toThrow(/not on screen/)
  })
  it('reads a measured size, null before measuring', () => {
    expect(nodeSize({ dimensions: { width: 200, height: 64 } })).toEqual({ width: 200, height: 64 })
    expect(nodeSize({ dimensions: { width: 0, height: 0 } })).toBeNull()
    expect(nodeSize({})).toBeNull()
    expect(nodeSize(null)).toBeNull()
  })
  it('forwards lookups and immutable updates', () => {
    const flow = fakeFlow({ nodes: [{ id: 'a' }] })
    expect(findNode(flow, 'a')).toEqual({ id: 'a' })
    fitView(flow, { nodes: ['a'] })
    expect(flow.fitView).toHaveBeenCalledWith({ padding: 0.2, maxZoom: 1, nodes: ['a'] })
    updateNodeData(flow, 'a', { label: 'x' })
    expect(flow.updateNodeData).toHaveBeenCalledWith('a', { label: 'x' })
    replaceNodeData(flow, 'a', { only: 1 })
    expect(flow.updateNodeData).toHaveBeenLastCalledWith('a', { only: 1 }, { replace: true })
    updateNode(flow, 'a', { position: { x: 1, y: 2 } })
    expect(flow.updateNode).toHaveBeenCalledWith('a', { position: { x: 1, y: 2 } })
    setNodes(flow, [])
    setEdges(flow, [])
    expect(flow.setNodes).toHaveBeenCalledWith([])
    expect(flow.setEdges).toHaveBeenCalledWith([])
  })
  it('reads the selection', () => {
    const flow = fakeFlow({ nodes: [{ id: 'a', selected: true }, { id: 'b' }], edges: [{ id: 'e1', selected: true }] })
    expect(selectedIds(flow)).toEqual({ nodeIds: ['a'], edgeIds: ['e1'] })
  })
})

describe('deleting', () => {
  const edges = [
    { id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'b', target: 'c' },
    { id: 'e3', source: 'x', target: 'y' },
  ]
  it('takes every edge connected to a deleted node', () => {
    expect(deletionSet(edges, { nodeIds: ['b'], edgeIds: ['e3', 'e1'] })).toEqual({
      nodeIds: ['b'], edgeIds: ['e3'], connectedEdgeIds: ['e1', 'e2'],
    })
  })

  it('asks first, then hands remove ops to the history', async () => {
    const flow = fakeFlow({ nodes: [{ id: 'b', selected: true }], edges: [...edges.slice(0, 2), { ...edges[2], selected: true }] })
    const confirm = vi.fn().mockResolvedValue(true)
    const apply = vi.fn()
    const set = await deleteSelection(flow, { apply, confirm })
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete 1 step and 3 connections?', danger: true }))
    expect(apply).toHaveBeenCalledWith([{ op: 'remove_edge', id: 'e3' }, { op: 'remove_node', id: 'b' }])
    expect(set.connectedEdgeIds).toEqual(['e1', 'e2'])
  })

  it('does nothing when the person says no', async () => {
    const flow = fakeFlow({ nodes: [{ id: 'a', selected: true }], edges })
    const apply = vi.fn()
    expect(await deleteSelection(flow, { apply, confirm: vi.fn().mockResolvedValue(false) })).toBeNull()
    expect(apply).not.toHaveBeenCalled()
  })

  it('does not ask when nothing is selected', async () => {
    const flow = fakeFlow({ nodes: [{ id: 'a' }], edges })
    const confirm = vi.fn()
    expect(await deleteSelection(flow, { apply: vi.fn(), confirm })).toBeNull()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('deletes an explicit target instead of the selection', async () => {
    const flow = fakeFlow({ nodes: [], edges })
    const apply = vi.fn()
    await deleteSelection(flow, { apply, target: { edgeIds: ['e2'] }, confirm: vi.fn().mockResolvedValue(true) })
    expect(apply).toHaveBeenCalledWith([{ op: 'remove_edge', id: 'e2' }])
  })

  it('refuses to delete without a way to record it', async () => {
    await expect(deleteSelection(fakeFlow(), {})).rejects.toThrow(/apply/)
  })
})
