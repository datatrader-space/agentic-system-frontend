// useWorkflowHistory (ADM-1333, D1 rule 6): our own command history over the document.
import { describe, it, expect } from 'vitest'
import { shallowRef } from 'vue'
import { applyWorkflowOps } from './useWorkflowDoc'
import { useWorkflowHistory } from './useWorkflowHistory'

// A document with the real operation engine and no server.
function fakeDoc() {
  const state = shallowRef({
    name: 'W',
    nodes: [{ id: 'a', type: 't', position: { x: 0, y: 0 }, data: { label: 'A' } }],
    edges: [],
    vars: {},
  })
  const listeners = new Set()
  return {
    state,
    applyOps(ops) { const r = applyWorkflowOps(state.value, ops); state.value = r.state; return r.inverse },
    onReset(fn) { listeners.add(fn) },
    reset() { for (const fn of listeners) fn() },
  }
}
const node = (doc, id) => doc.state.value.nodes.find((n) => n.id === id)

describe('useWorkflowHistory', () => {
  it('undoes and redoes a step', () => {
    const doc = fakeDoc()
    const h = useWorkflowHistory(doc)
    h.run('Rename', [{ op: 'update_node', id: 'a', data: { label: 'B' } }])
    expect(node(doc, 'a').data.label).toBe('B')
    expect(h.canUndo.value).toBe(true)
    expect(h.undoLabel.value).toBe('Rename')
    h.undo()
    expect(node(doc, 'a').data.label).toBe('A')
    expect(h.canRedo.value).toBe(true)
    h.redo()
    expect(node(doc, 'a').data.label).toBe('B')
  })

  it('a new step clears what could be redone', () => {
    const doc = fakeDoc()
    const h = useWorkflowHistory(doc)
    h.run('One', [{ op: 'set_name', name: 'One' }])
    h.undo()
    h.run('Two', [{ op: 'set_name', name: 'Two' }])
    expect(h.canRedo.value).toBe(false)
  })

  it('a drag is one step: repeated moves keep the first position for undo and the last for redo', () => {
    const doc = fakeDoc()
    const h = useWorkflowHistory(doc)
    h.begin('Move')
    for (let x = 1; x <= 30; x++) h.run('Move', [{ op: 'move_node', id: 'a', position: { x, y: x } }])
    h.end()
    expect(h.past.value).toHaveLength(1)
    expect(h.past.value[0].ops).toHaveLength(1)
    h.undo()
    expect(node(doc, 'a').position).toEqual({ x: 0, y: 0 })
    h.redo()
    expect(node(doc, 'a').position).toEqual({ x: 30, y: 30 })
  })

  it('a batch of different changes undoes in reverse order', () => {
    const doc = fakeDoc()
    const h = useWorkflowHistory(doc)
    h.begin('Paste')
    h.run('Paste', [{ op: 'add_node', node: { id: 'b', type: 't', position: { x: 1, y: 1 }, data: {} } }])
    h.run('Paste', [{ op: 'add_edge', edge: { id: 'e1', source: 'a', target: 'b' } }])
    h.end()
    h.undo()
    expect(doc.state.value.nodes.map((n) => n.id)).toEqual(['a'])
    expect(doc.state.value.edges).toEqual([])
  })

  it('bounds the number of ENTRIES, never the operations inside one', () => {
    const doc = fakeDoc()
    const h = useWorkflowHistory(doc, { limit: 3 })
    const big = Array.from({ length: 50 }, (_, i) => ({ op: 'add_node', node: { id: `n${i}`, type: 't', position: { x: i, y: 0 }, data: {} } }))
    h.run('Big', big)
    for (let i = 0; i < 4; i++) h.run(`Name ${i}`, [{ op: 'set_name', name: `N${i}` }])
    expect(h.past.value).toHaveLength(3)
    expect(h.past.value.map((e) => e.label)).toEqual(['Name 1', 'Name 2', 'Name 3'])
    const h2 = useWorkflowHistory(fakeDoc(), { limit: 3 })
    h2.run('Big', big)
    expect(h2.past.value[0].ops).toHaveLength(50)
  })

  it('a change that cannot apply records nothing and leaves the document as it was', () => {
    const doc = fakeDoc()
    const h = useWorkflowHistory(doc)
    expect(() => h.run('Bad', [{ op: 'update_node', id: 'a', data: { label: 'X' } }, { op: 'remove_node', id: 'ghost' }])).toThrow(/ghost/)
    expect(h.canUndo.value).toBe(false)
    expect(node(doc, 'a').data.label).toBe('A')
  })

  it('is cleared when the document is reloaded, restored or discarded', () => {
    const doc = fakeDoc()
    const h = useWorkflowHistory(doc)
    h.run('Rename', [{ op: 'set_name', name: 'X' }])
    doc.reset()
    expect(h.canUndo.value).toBe(false)
    expect(h.canRedo.value).toBe(false)
  })

  it('undo with nothing to undo is a no-op', () => {
    const h = useWorkflowHistory(fakeDoc())
    expect(h.undo()).toBe(false)
    expect(h.redo()).toBe(false)
  })
})
