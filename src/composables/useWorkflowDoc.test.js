// @vitest-environment jsdom
// useWorkflowDoc (ADM-1333): load, atomic operations with inverses, dirty, save with the etag, conflicts,
// discard, publish and the shared unsaved guard.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }))
vi.mock('@/services/api', () => ({ default: {} }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ notify }))
const confirmMock = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useConfirm', () => ({ confirm: confirmMock }))
const guardSpy = vi.hoisted(() => vi.fn(() => ({ mayLeave: vi.fn() })))
vi.mock('@/composables/useUnsavedGuard', () => ({ useUnsavedGuard: guardSpy }))

import { useWorkflowDoc, applyWorkflowOps, WORKFLOW_LEAVE_QUESTION } from './useWorkflowDoc'
import { WorkflowInputError } from '@/utils/workflowInput'

const GRAPH = {
  id: 7, public_id: 'p-7', name: 'Leads', version: 3, etag: 'etag-1', status: 'draft', triggers: [{ node_id: 'trig' }],
  last_run: { id: 41, status: 'running' }, published_version_id: null,
  graph: {
    nodes: [
      { id: 'trig', type: 'trigger.manual', position: { x: 0, y: 0 }, data: {} },
      { id: 'fetch', type: 'action.http', position: { x: 300, y: 0 }, data: { url: 'https://a', json: { q: 1 } } },
      { id: 'loose', type: 'logic.delay', data: { seconds: 3 } },
    ],
    edges: [{ id: 'e1', source: 'trig', target: 'fetch' }],
    vars: { region: 'eu' }, viewport: { x: 1, y: 2, zoom: 0.8 }, input_schema: { type: 'object' },
  },
}

function makeApi(overrides = {}) {
  return {
    getWorkflowGraphBundle: vi.fn().mockResolvedValue({ data: { graph: structuredClone(GRAPH), agents: [{ id: 1 }], all_graphs: [], scripts: [] } }),
    getWorkflowGraph: vi.fn(),
    getAgentPicker: vi.fn(),
    saveWorkflowGraph: vi.fn().mockResolvedValue({ data: { version: 4, etag: 'etag-2', status: 'draft' } }),
    restoreWorkflowGraphVersion: vi.fn(),
    ...overrides,
  }
}

// hydrate/serialize like the builder: the http body is edited as JSON text.
const hydrateNode = (type, data) => (type === 'action.http' ? { ...data, json_text: JSON.stringify(data.json || {}) } : data)
const serializeNode = (type, data) => {
  if (type !== 'action.http') return data
  const { json_text, ...rest } = data
  try { return { ...rest, json: JSON.parse(json_text) } } catch { throw new WorkflowInputError('Enter valid JSON for JSON body.') }
}

function setup(api = makeApi()) {
  let doc
  const C = defineComponent({ setup() { doc = useWorkflowDoc('7', { api, hydrateNode, serializeNode }); return () => h('div') } })
  const wrapper = mount(C)
  return { doc, api, wrapper }
}

beforeEach(() => { vi.clearAllMocks() })

describe('applyWorkflowOps', () => {
  const base = () => ({
    name: 'W',
    nodes: [{ id: 'a', type: 't', position: { x: 0, y: 0 }, data: { k: 1 } }, { id: 'b', type: 't', position: { x: 1, y: 1 }, data: {} }],
    edges: [{ id: 'e1', source: 'a', target: 'b' }],
    vars: {},
  })

  it('never changes the state it was given, and the inverse restores it exactly', () => {
    const s0 = base()
    const frozen = JSON.stringify(s0)
    const ops = [
      { op: 'add_node', node: { id: 'c', type: 't', position: { x: 5, y: 5 }, data: {} } },
      { op: 'add_edge', edge: { id: 'e2', source: 'b', target: 'c' } },
      { op: 'update_node', id: 'a', data: { k: 2, extra: true } },
      { op: 'move_node', id: 'b', position: { x: 9, y: 9 } },
      { op: 'update_edge', id: 'e1', patch: { label: 'yes' } },
      { op: 'set_vars', vars: { x: 1 } },
      { op: 'set_name', name: 'Renamed' },
      { op: 'remove_node', id: 'a' },
    ]
    const { state, inverse } = applyWorkflowOps(s0, ops)
    expect(JSON.stringify(s0)).toBe(frozen)
    expect(state.nodes.map((n) => n.id)).toEqual(['b', 'c'])
    expect(state.edges.map((e) => e.id)).toEqual(['e2'])      // e1 went with node a
    expect(state.name).toBe('Renamed')
    const back = applyWorkflowOps(state, inverse).state
    expect(back).toEqual(s0)
  })

  it('update_node with an undefined value removes the key, and its inverse puts it back', () => {
    const { state, inverse } = applyWorkflowOps(base(), [{ op: 'update_node', id: 'a', data: { k: undefined } }])
    expect(state.nodes[0].data).toEqual({})
    expect(applyWorkflowOps(state, inverse).state.nodes[0].data).toEqual({ k: 1 })
  })

  it('fails the whole batch with a reason and changes nothing', () => {
    const s0 = base()
    expect(() => applyWorkflowOps(s0, [
      { op: 'update_node', id: 'a', data: { k: 5 } },
      { op: 'add_edge', edge: { id: 'e9', source: 'a', target: 'ghost' } },
    ])).toThrow('There is no step "ghost" in this workflow.')
    expect(s0.nodes[0].data.k).toBe(1)
  })

  it('refuses ids the condition grammar cannot reference, duplicates, rewiring an edge and unknown ops', () => {
    expect(() => applyWorkflowOps(base(), [{ op: 'add_node', node: { id: '1-bad', type: 't' } }])).toThrow(/cannot be a step id/)
    expect(() => applyWorkflowOps(base(), [{ op: 'add_node', node: { id: 'a', type: 't' } }])).toThrow(/already exists/)
    expect(() => applyWorkflowOps(base(), [{ op: 'update_edge', id: 'e1', patch: { target: 'a' } }])).toThrow(/Reconnect/)
    expect(() => applyWorkflowOps(base(), [{ op: 'explode' }])).toThrow(/Unknown change/)
    expect(() => applyWorkflowOps(base(), [{ op: 'set_name', name: '  ' }])).toThrow(/needs a name/)
  })
})

describe('useWorkflowDoc', () => {
  it('loads the bundle: hydrated nodes, unplaced nodes laid out, meta, not dirty', async () => {
    const { doc, api } = setup()
    expect(await doc.load()).toBe(true)
    expect(api.getWorkflowGraphBundle).toHaveBeenCalledWith('7')
    expect(doc.name.value).toBe('Leads')
    expect(doc.nodes.value.find((n) => n.id === 'fetch').data.json_text).toBe('{"q":1}')
    expect(doc.nodes.value.find((n) => n.id === 'loose').position).toEqual({ x: 520, y: 120 })
    expect(doc.meta).toMatchObject({ etag: 'etag-1', version: 3, lastRun: { id: 41, status: 'running' } })
    expect(doc.viewport.value).toEqual({ x: 1, y: 2, zoom: 0.8 })
    expect(doc.dirty.value).toBe(false)
  })

  it('a failed load says so and does not try other endpoints', async () => {
    const api = makeApi({ getWorkflowGraphBundle: vi.fn().mockRejectedValue(new Error('down')) })
    const { doc } = setup(api)
    expect(await doc.load()).toBe(false)
    expect(doc.loadError.value).toMatch(/Could not load this workflow/)
    expect(api.getWorkflowGraph).not.toHaveBeenCalled()
  })

  it('reads every agent when the bundle has only the first page, and says so when that fails', async () => {
    const paged = { results: [{ id: 1 }], next: '/agents/?page=2' }
    const api = makeApi({
      getWorkflowGraphBundle: vi.fn().mockResolvedValue({ data: { graph: structuredClone(GRAPH), agents: paged } }),
      getAgentPicker: vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] }),
    })
    const { doc } = setup(api)
    await doc.load()
    expect(doc.agents.value.map((a) => a.id)).toEqual([1, 2])
    api.getAgentPicker.mockRejectedValueOnce(new Error('x'))
    await doc.load()
    expect(doc.agentsError.value).toMatch(/Only some of your agents/)
  })

  it('is dirty after a change and clean again when the change is undone', async () => {
    const { doc } = setup()
    await doc.load()
    const inverse = doc.applyOps([{ op: 'update_node', id: 'fetch', data: { url: 'https://b' } }])
    expect(doc.dirty.value).toBe(true)
    doc.applyOps(inverse)
    expect(doc.dirty.value).toBe(false)
  })

  it('a viewport change alone is not an unsaved change', async () => {
    const { doc } = setup()
    await doc.load()
    doc.setViewport({ x: 5, y: 5, zoom: 2 })
    expect(doc.dirty.value).toBe(false)
  })

  it('saves the stored shape with the etag, keeps other graph keys, adopts the new etag', async () => {
    const { doc, api } = setup()
    await doc.load()
    doc.applyOps([{ op: 'update_node', id: 'fetch', data: { json_text: '{"q":2}' } }])
    expect(await doc.save()).toBe(true)
    const [id, body] = api.saveWorkflowGraph.mock.calls[0]
    expect(id).toBe('7')
    expect(body.etag).toBe('etag-1')
    const fetch = body.graph.nodes.find((n) => n.id === 'fetch')
    expect(fetch.data).toEqual({ url: 'https://a', json: { q: 2 } })
    expect(body.graph.input_schema).toEqual({ type: 'object' })
    expect(body.graph.vars).toEqual({ region: 'eu' })
    expect(doc.meta.etag).toBe('etag-2')
    expect(doc.dirty.value).toBe(false)
  })

  it('an edit made while the save is in flight stays unsaved', async () => {
    let resolve
    const api = makeApi({ saveWorkflowGraph: vi.fn(() => new Promise((r) => { resolve = r })) })
    const { doc } = setup(api)
    await doc.load()
    doc.applyOps([{ op: 'set_name', name: 'One' }])
    const p = doc.save()
    doc.applyOps([{ op: 'set_name', name: 'Two' }])
    resolve({ data: { etag: 'etag-2' } })
    await p
    expect(doc.dirty.value).toBe(true)
  })

  it('a second save while one is in flight joins it: one PUT', async () => {
    let resolve
    const api = makeApi({ saveWorkflowGraph: vi.fn(() => new Promise((r) => { resolve = r })) })
    const { doc } = setup(api)
    await doc.load()
    doc.applyOps([{ op: 'set_name', name: 'One' }])
    const a = doc.save()
    const b = doc.save()
    resolve({ data: { etag: 'etag-2' } })
    expect(await a).toBe(true)
    expect(await b).toBe(true)
    expect(api.saveWorkflowGraph).toHaveBeenCalledTimes(1)
  })

  it('a conflict is reported and its etag is NOT adopted', async () => {
    const err = Object.assign(new Error('409'), { response: { status: 409, data: { error: 'Changed in another tab.', etag: 'etag-9' } } })
    const api = makeApi({ saveWorkflowGraph: vi.fn().mockRejectedValue(err) })
    const { doc } = setup(api)
    await doc.load()
    doc.applyOps([{ op: 'set_name', name: 'One' }])
    expect(await doc.save()).toBe(false)
    expect(doc.conflict.value).toBe('Changed in another tab.')
    expect(doc.meta.etag).toBe('etag-1')
    expect(doc.dirty.value).toBe(true)
    expect(notify.error).toHaveBeenCalledWith('Changed in another tab.')
  })

  it('bad JSON in a step is recorded on that step and nothing is sent', async () => {
    const { doc, api } = setup()
    await doc.load()
    doc.applyOps([{ op: 'update_node', id: 'fetch', data: { json_text: '{oops' } }])
    expect(await doc.save()).toBe(false)
    expect(api.saveWorkflowGraph).not.toHaveBeenCalled()
    expect(doc.issues.value).toEqual({ fetch: 'Enter valid JSON for JSON body.' })
  })

  it('server validation errors land on their steps', async () => {
    const err = { response: { status: 400, data: { error: 'Invalid', errors: [{ node_id: 'fetch', message: 'URL required' }] } } }
    const { doc } = setup(makeApi({ saveWorkflowGraph: vi.fn().mockRejectedValue(err) }))
    await doc.load()
    doc.applyOps([{ op: 'set_name', name: 'X' }])
    await doc.save()
    expect(doc.issues.value).toEqual({ fetch: 'URL required' })
  })

  it('saveIfDirty does nothing when clean and saves when dirty', async () => {
    const { doc, api } = setup()
    await doc.load()
    expect(await doc.saveIfDirty()).toBe(true)
    expect(api.saveWorkflowGraph).not.toHaveBeenCalled()
    doc.applyOps([{ op: 'set_name', name: 'X' }])
    expect(await doc.saveIfDirty()).toBe(true)
    expect(api.saveWorkflowGraph).toHaveBeenCalledTimes(1)
  })

  it('publish saves the draft first, then publishes', async () => {
    const { doc, api } = setup()
    await doc.load()
    doc.applyOps([{ op: 'set_name', name: 'X' }])
    api.saveWorkflowGraph
      .mockResolvedValueOnce({ data: { etag: 'etag-2' } })
      .mockResolvedValueOnce({ data: { status: 'published', version: 5 } })
    expect(await doc.publish()).toBe(true)
    expect(api.saveWorkflowGraph.mock.calls[1][1]).toEqual({ status: 'published' })
    expect(doc.meta.status).toBe('published')
    expect(notify.success).toHaveBeenLastCalledWith('Published (v5)')
  })

  it('publish adds the note of what uses the workflow to its message; the request is the same (ADM-1351 phase 4)', async () => {
    const { doc, api } = setup()
    await doc.load()
    api.saveWorkflowGraph.mockResolvedValueOnce({ data: { status: 'published', version: 6 } })
    expect(await doc.publish({ note: 'Used by 2 triggers.' })).toBe(true)
    expect(api.saveWorkflowGraph).toHaveBeenCalledTimes(1)
    expect(api.saveWorkflowGraph.mock.calls[0][1]).toEqual({ status: 'published' })
    expect(notify.success).toHaveBeenLastCalledWith('Published (v6). Used by 2 triggers.', { timeout: 9000 })
  })

  it('discard asks, restores the saved state and tells listeners (the history) to reset', async () => {
    const { doc } = setup()
    await doc.load()
    const reset = vi.fn()
    doc.onReset(reset)
    doc.applyOps([{ op: 'remove_node', id: 'fetch' }])
    confirmMock.mockResolvedValueOnce(false)
    expect(await doc.discard()).toBe(false)
    expect(doc.nodes.value).toHaveLength(2)
    confirmMock.mockResolvedValueOnce(true)
    expect(await doc.discard()).toBe(true)
    expect(doc.nodes.value.map((n) => n.id)).toEqual(['trig', 'fetch', 'loose'])
    expect(doc.edges.value).toHaveLength(1)
    expect(doc.dirty.value).toBe(false)
    expect(reset).toHaveBeenCalled()
  })

  it('uses the shared unsaved guard, counting one unsaved workflow, with workflow wording', async () => {
    const { doc } = setup()
    await doc.load()
    expect(guardSpy).toHaveBeenCalledTimes(1)
    const [count, question] = guardSpy.mock.calls[0]
    expect(question).toBe(WORKFLOW_LEAVE_QUESTION)
    expect(count()).toBe(0)
    doc.applyOps([{ op: 'set_name', name: 'X' }])
    expect(count()).toBe(1)
  })
})

describe('useWorkflowDoc: the role the server sends (ADM-1339)', () => {
  const withGraph = (extra) => makeApi({
    getWorkflowGraphBundle: vi.fn().mockResolvedValue({ data: { graph: { ...structuredClone(GRAPH), ...extra }, agents: [], all_graphs: [], scripts: [] } }),
  })

  it('keeps my_role and the owner from the load', async () => {
    const { doc } = setup(withGraph({ my_role: 'runner', owner: { id: 3, email: 'o@x.test', name: 'Olga' } }))
    await doc.load()
    expect(doc.meta.myRole).toBe('runner')
    expect(doc.meta.owner).toEqual({ id: 3, email: 'o@x.test', name: 'Olga' })
  })

  it('reads a missing or unknown role as viewer (fail closed: the page offers less, never more)', async () => {
    for (const extra of [{}, { my_role: 'admin' }]) {
      const { doc } = setup(withGraph(extra))
      await doc.load()
      expect(doc.meta.myRole).toBe('viewer')
    }
  })

  it('a save the server refuses for the role shows the server sentence', async () => {
    const api = withGraph({ my_role: 'editor' })
    api.saveWorkflowGraph = vi.fn().mockRejectedValue({ response: { status: 403, data: { error: 'Only editors and the owner can change this workflow.', code: 'forbidden_role', required: 'edit' } } })
    const { doc } = setup(api)
    await doc.load()
    doc.applyOps([{ op: 'set_name', name: 'Renamed' }])
    expect(await doc.save()).toBe(false)
    expect(notify.error).toHaveBeenCalledWith('Only editors and the owner can change this workflow.')
  })
})
