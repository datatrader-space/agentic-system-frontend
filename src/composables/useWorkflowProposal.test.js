// useWorkflowProposal (ADM-1333, plan §3.4): the agent's proposal as hunks the person accepts or rejects. Runs on the
// real operation engine (applyWorkflowOps) and the real undo history; no server.
import { describe, it, expect, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import { applyWorkflowOps } from './useWorkflowDoc'
import { useWorkflowHistory } from './useWorkflowHistory'
import { useWorkflowProposal, REDACTED } from './useWorkflowProposal'

const clone = (v) => JSON.parse(JSON.stringify(v))

// Like the builder: an action.tool node keeps its params as JSON text while it is edited.
function hydrate(type, data) {
  if (type === 'action.tool') return { ...data, params_json: JSON.stringify(data.params || {}) }
  return data
}

function fakeDoc({ nodes = [], edges = [], vars = {} } = {}) {
  const name = ref('W')
  const n = shallowRef(clone(nodes).map((x) => ({ ...x, data: hydrate(x.type, x.data || {}) })))
  const e = shallowRef(clone(edges))
  const v = shallowRef(clone(vars))
  return {
    name, nodes: n, edges: e, vars: v,
    applyOps(ops) {
      const r = applyWorkflowOps({ name: name.value, nodes: n.value, edges: e.value, vars: v.value }, ops)
      name.value = r.state.name; n.value = r.state.nodes; e.value = r.state.edges; v.value = r.state.vars
      return r.inverse
    },
    onReset() {},
    toEditableNode(node) {
      return { id: node.id, type: node.type, position: { ...(node.position || { x: 0, y: 0 }) }, data: hydrate(node.type, clone(node.data || {})) }
    },
  }
}

const BASE = {
  nodes: [
    { id: 'a', type: 'trigger.manual', position: { x: 0, y: 0 }, data: { label: 'A', token: 'secret', auth: { key: 'k', user: 'u' } } },
    { id: 'c', type: 'logic.condition', position: { x: 300, y: 0 }, data: { label: 'C' } },
    { id: 'd', type: 'action.tool', position: { x: 600, y: 0 }, data: { tool: 'SEARCH', params: { q: 'old' } } },
  ],
  edges: [{ id: 'e1', source: 'a', target: 'c' }, { id: 'e2', source: 'c', target: 'd' }],
  vars: { api: { type: 'secret', value: 'S' }, old: { type: 'string', value: 'x' } },
}

function setup(opts = {}) {
  const doc = fakeDoc(opts.state || BASE)
  const history = useWorkflowHistory(doc)
  const notify = { error: vi.fn(), warning: vi.fn() }
  const confirm = opts.confirm || vi.fn(async () => true)
  const proposal = useWorkflowProposal(doc, history, { confirm, notify })
  return { doc, history, notify, confirm, proposal }
}
const frame = (operations, errors = [], id = 'wfp_1') => ({ type: 'workflow_proposal', graph_id: 5, proposal_id: id, operations, errors })
const node = (doc, id) => doc.nodes.value.find((x) => x.id === id)
const docText = (doc) => JSON.stringify({ n: doc.nodes.value, e: doc.edges.value })

describe('useWorkflowProposal', () => {
  it('builds hunks, marks and ghosts from the frame', async () => {
    const { proposal } = setup()
    expect(await proposal.receive(frame([
      { op: 'add_node', node: { id: 'b', type: 'action.http', data: { url: 'https://x.test' } } },
      { op: 'add_edge', edge: { id: 'e_a_b', source: 'a', target: 'b' } },
      { op: 'update_node', id: 'a', data: { label: 'A2' } },
      { op: 'remove_edge', id: 'e1' },
      { op: 'remove_node', id: 'c' },
      { op: 'set_vars', vars: { region: { type: 'string', value: 'eu' } } },
    ]))).toBe(true)
    const h = proposal.hunks.value
    expect(h.map((x) => [x.index, x.op.op, x.target.kind, x.target.id, x.mark, x.state])).toEqual([
      [0, 'add_node', 'node', 'b', 'add', 'pending'],
      [1, 'add_edge', 'edge', 'e_a_b', 'add', 'pending'],
      [2, 'update_node', 'node', 'a', 'change', 'pending'],
      [3, 'remove_edge', 'edge', 'e1', 'remove', 'pending'],
      [4, 'remove_node', 'node', 'c', 'remove', 'pending'],
      [5, 'set_vars', 'vars', 'region', 'add', 'pending'],
    ])
    expect(h.every((x) => x.error === null)).toBe(true)
    expect(proposal.nodeMarks.value).toEqual({ b: 'add', a: 'change', c: 'remove' })
    // c's connections go with it.
    expect(proposal.edgeMarks.value).toEqual({ e_a_b: 'add', e1: 'remove', e2: 'remove' })
    expect(proposal.ghostNodes.value.map((g) => g.id)).toEqual(['b'])
    const ghost = proposal.ghostNodes.value[0]
    expect(Number.isFinite(ghost.position.x) && Number.isFinite(ghost.position.y)).toBe(true)
    expect(ghost.position.x).toBeGreaterThan(0)   // placed after "a", which connects to it
    expect(proposal.ghostEdges.value.map((g) => g.id)).toEqual(['e_a_b'])
    expect(proposal.pendingCount.value).toBe(6)
  })

  // Live check 2026-11-20: the agent put a delay "between" two steps 300 px apart (x 150); accepted, it covered both.
  it('a step the agent places on top of others lands in free space; the existing steps never move', async () => {
    const { doc, proposal } = setup()
    const before = doc.nodes.value.map((n) => ({ id: n.id, ...n.position }))
    await proposal.receive(frame([
      { op: 'add_node', node: { id: 'wait', type: 'logic.delay', position: { x: 150, y: 0 }, data: { seconds: 1 } } },
    ]))
    const ghost = proposal.ghostNodes.value[0]
    const W = 230, H = 110   // the room an unmeasured step is given (workflowNodePlacement.js)
    const overlaps = (p, q) => p.x < q.x + W && q.x < p.x + W && p.y < q.y + H && q.y < p.y + H
    expect(doc.nodes.value.some((n) => overlaps(ghost.position, n.position))).toBe(false)
    expect(proposal.acceptAll()).toBe(1)
    expect(node(doc, 'wait').position).toEqual(ghost.position)
    expect(doc.nodes.value.filter((n) => n.id !== 'wait').map((n) => ({ id: n.id, ...n.position }))).toEqual(before)
  })

  it('a position the agent gives in free space is kept exactly', async () => {
    const { doc, proposal } = setup()
    await proposal.receive(frame([
      { op: 'add_node', node: { id: 'far', type: 'logic.delay', position: { x: 0, y: 600 }, data: { seconds: 1 } } },
    ]))
    expect(proposal.ghostNodes.value[0].position).toEqual({ x: 0, y: 600 })
    proposal.acceptAll()
    expect(node(doc, 'far').position).toEqual({ x: 0, y: 600 })
  })

  it('keeps hidden values: an exact __redacted__ keeps what is stored and is never written', async () => {
    const { doc, proposal } = setup()
    await proposal.receive(frame([
      { op: 'update_node', id: 'a', data: { token: REDACTED, label: 'B', auth: { key: REDACTED, user: 'v' } } },
      { op: 'set_vars', vars: { api: { type: 'secret', value: REDACTED }, region: { type: 'string', value: 'eu' }, old: null } },
    ]))
    expect(proposal.acceptAll()).toBe(2)
    expect(node(doc, 'a').data).toEqual({ label: 'B', token: 'secret', auth: { key: 'k', user: 'v' } })
    expect(doc.vars.value).toEqual({ api: { type: 'secret', value: 'S' }, region: { type: 'string', value: 'eu' } })
    expect(JSON.stringify(doc.vars.value) + docText(doc)).not.toContain(REDACTED)
  })

  it('refuses a marker it cannot resolve instead of writing it', async () => {
    const { doc, proposal, notify } = setup()
    const before = docText(doc)
    await proposal.receive(frame([
      { op: 'update_node', id: 'c', data: { secret: { nested: REDACTED } } },   // nothing stored to keep
      { op: 'add_node', node: { id: 'z', type: 't', data: { k: REDACTED } } },     // a new node has nothing to keep
    ]))
    expect(proposal.hunks.value[1].state).toBe('refused')
    expect(proposal.hunks.value[1].error.code).toBe('redaction_marker')
    expect(proposal.accept(0)).toBe(false)
    expect(proposal.hunks.value[0].state).toBe('refused')
    expect(proposal.hunks.value[0].error.code).toBe('redaction_marker')
    expect(notify.error).toHaveBeenCalled()
    expect(docText(doc)).toBe(before)
  })

  it('skips operations the server refused and lists the other errors as issues', async () => {
    const { doc, proposal } = setup()
    await proposal.receive(frame([
      { op: 'update_node', id: 'a', data: { label: 'A2' } },
      { op: 'update_node', id: 'c', data: { label: '[redacted:api]' } },
      { op: 'remove_edge', id: 'e2' },
    ], [
      { node_id: 'c', path: 'operations[1]', code: 'redaction_marker', message: 'contains a redaction marker' },
      { node_id: 'd', path: 'nodes.d.data.tool', code: 'tool.unknown', message: 'Unknown tool' },
    ]))
    const [h0, h1, h2] = proposal.hunks.value
    expect(h1.state).toBe('refused')
    expect(h1.error).toMatchObject({ code: 'redaction_marker', message: 'contains a redaction marker' })
    expect(proposal.issues.value).toEqual([{ node_id: 'd', path: 'nodes.d.data.tool', code: 'tool.unknown', message: 'Unknown tool' }])
    expect(proposal.nodeMarks.value).toEqual({ a: 'change' })   // refused hunks are not drawn
    expect(proposal.accept(1)).toBe(false)
    expect(proposal.acceptAll()).toBe(2)
    expect([h0.state, h1.state, h2.state]).toEqual(['accepted', 'refused', 'accepted'])
    expect(node(doc, 'c').data.label).toBe('C')
    expect(doc.edges.value.map((e) => e.id)).toEqual(['e1'])
  })

  it('accept goes through the history, and undo restores the document', async () => {
    const { doc, history, proposal } = setup()
    await proposal.receive(frame([{ op: 'remove_node', id: 'c' }, { op: 'update_node', id: 'a', data: { label: 'A2' } }]))
    expect(proposal.accept(0)).toBe(true)
    expect(node(doc, 'c')).toBeUndefined()
    expect(doc.edges.value).toEqual([])
    expect(history.undoLabel.value).toBe('Agent change')
    expect(proposal.hunks.value[0].state).toBe('accepted')
    expect(proposal.nodeMarks.value).toEqual({ a: 'change' })
    history.undo()
    expect(node(doc, 'c').data.label).toBe('C')
    expect(doc.edges.value.map((e) => e.id)).toEqual(['e1', 'e2'])
  })

  it('acceptAll applies every pending hunk as ONE history entry', async () => {
    const { doc, history, proposal } = setup()
    await proposal.receive(frame([
      { op: 'add_node', node: { id: 'b', type: 'action.http', data: {} } },
      { op: 'add_edge', edge: { id: 'e_a_b', source: 'a', target: 'b' } },
      { op: 'update_node', id: 'a', data: { label: 'A2' } },
    ]))
    expect(proposal.reject(2)).toBe(true)
    expect(proposal.acceptAll()).toBe(2)
    expect(history.past.value.length).toBe(1)
    expect(node(doc, 'b')).toBeTruthy()
    expect(Number.isFinite(node(doc, 'b').position.x)).toBe(true)
    expect(doc.edges.value.map((e) => e.id)).toContain('e_a_b')
    expect(node(doc, 'a').data.label).toBe('A')   // rejected
    expect(proposal.ghostNodes.value).toEqual([])
    history.undo()
    expect(node(doc, 'b')).toBeUndefined()
    expect(doc.edges.value.map((e) => e.id)).toEqual(['e1', 'e2'])
  })

  it('refuses a hunk whose target changed since the proposal', async () => {
    const { history, proposal, notify } = setup()
    await proposal.receive(frame([
      { op: 'update_node', id: 'c', data: { label: 'C2' } },
      { op: 'add_edge', edge: { id: 'e_c_a', source: 'c', target: 'a' } },
      { op: 'remove_edge', id: 'e2' },
    ]))
    history.run('Delete', [{ op: 'remove_node', id: 'c' }])   // the person removed c meanwhile
    expect(proposal.accept(0)).toBe(false)
    expect(proposal.hunks.value[0].state).toBe('refused')
    expect(proposal.hunks.value[0].error.message).toMatch(/no longer in the workflow/)
    expect(notify.error).toHaveBeenCalledWith(expect.stringMatching(/cannot be applied/))
    expect(proposal.accept(1)).toBe(false)
    expect(proposal.hunks.value[1].error.message).toMatch(/needs the step “c”/)
    expect(proposal.accept(2)).toBe(false)   // e2 went with c
    expect(history.past.value.length).toBe(1)
  })

  it('asks for the new step first when a connection needs a step still waiting', async () => {
    const { doc, proposal, notify } = setup()
    await proposal.receive(frame([
      { op: 'add_node', node: { id: 'b', type: 'action.http', data: {} } },
      { op: 'add_edge', edge: { id: 'e_a_b', source: 'a', target: 'b' } },
    ]))
    expect(proposal.accept(1)).toBe(false)
    expect(notify.warning).toHaveBeenCalledWith('Accept the new step “b” first.')
    expect(proposal.hunks.value[1].state).toBe('pending')
    expect(proposal.accept(0)).toBe(true)
    expect(proposal.accept(1)).toBe(true)
    expect(doc.edges.value.map((e) => e.id)).toContain('e_a_b')
  })

  it('carries the edited fields derived from a changed key, and leaves the others as the person typed them', async () => {
    const { doc, proposal } = setup()
    doc.nodes.value = doc.nodes.value.map((n) => (n.id === 'd' ? { ...n, data: { ...n.data, params_json: '{"q": "typed"}' } } : n))
    await proposal.receive(frame([{ op: 'update_node', id: 'd', data: { tool: 'FETCH' } }]))
    expect(proposal.accept(0)).toBe(true)
    expect(node(doc, 'd').data).toMatchObject({ tool: 'FETCH', params_json: '{"q": "typed"}' })
    await proposal.receive(frame([{ op: 'update_node', id: 'd', data: { params: { q: 'new' } } }], [], 'wfp_2'))
    expect(proposal.accept(0)).toBe(true)
    expect(node(doc, 'd').data).toMatchObject({ params: { q: 'new' }, params_json: '{"q":"new"}' })
  })

  it('a new proposal replaces the pending one only when the person agrees', async () => {
    const confirm = vi.fn(async () => false)
    const { proposal } = setup({ confirm })
    await proposal.receive(frame([{ op: 'update_node', id: 'a', data: { label: 'one' } }], [], 'wfp_1'))
    expect(confirm).not.toHaveBeenCalled()
    expect(await proposal.receive(frame([{ op: 'remove_node', id: 'c' }], [], 'wfp_2'))).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0][0].message).toMatch(/1 change from the earlier one is still waiting/)
    expect(proposal.proposalId.value).toBe('wfp_1')
    confirm.mockResolvedValueOnce(true)
    expect(await proposal.receive(frame([{ op: 'remove_node', id: 'c' }], [], 'wfp_2'))).toBe(true)
    expect(proposal.proposalId.value).toBe('wfp_2')
    expect(proposal.hunks.value.map((h) => h.op.op)).toEqual(['remove_node'])
    // The same proposal again is ignored; with nothing pending a new one replaces it without asking.
    expect(await proposal.receive(frame([], [], 'wfp_2'))).toBe(false)
    proposal.rejectAll()
    expect(await proposal.receive(frame([{ op: 'remove_edge', id: 'e1' }], [], 'wfp_3'))).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(2)
    proposal.clear()
    expect(proposal.hunks.value).toEqual([])
    expect(proposal.proposalId.value).toBe(null)
  })
})
