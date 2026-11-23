// The node picker's items and what choosing one does to the document (ADM-1333 plan §3.1, F13).
import { describe, it, expect } from 'vitest'
import { pickerItems, pickerGroups, createNode, connectOps, placeFor, needsInput, loadRecent, pushRecent, RECENT_SIZE, FRAME_BADGE } from './wfPickerItems'
import { applyWorkflowOps } from '@/composables/useWorkflowDoc'

const tools = [{ name: 'GITHUB_LIST_REPOSITORIES', description: 'List repos', category: 'github' }, { name: 'SLACK_POST', description: 'Post', category: 'slack' }]
const mcp = { enabled: true, servers: [{ id: 7, name: 'Fixture MCP', slug: 'fixture', tools: [{ name: 'fixture_read', description: 'Read' }] }] }
const nodes = [
  { id: 'start', type: 'trigger.manual', position: { x: 0, y: 0 }, data: {} },
  { id: 'check', type: 'logic.condition', position: { x: 300, y: 0 }, data: { expression: '1 == 1' } },
  { id: 'log', type: 'action.channel', position: { x: 600, y: 0 }, data: { kind: 'log', message: 'x' } },
]
const edges = [{ id: 'e_start_check', source: 'start', target: 'check' }, { id: 'e_check_true_log', source: 'check', target: 'log', sourceHandle: 'true' }]
const state = () => ({ name: 'W', nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), vars: {} })

describe('pickerItems', () => {
  it('lists the step types under their categories, and tools only while searching', () => {
    const first = pickerItems({ tools, mcp })
    expect(first.some((i) => i.id === 'node:agent.run' && i.group === 'agent')).toBe(true)
    expect(first.some((i) => i.kind === 'tool')).toBe(false)
    const searching = pickerItems({ tools, mcp, searching: true })
    expect(searching.filter((i) => i.kind === 'tool')).toHaveLength(2)
    expect(searching.some((i) => i.id === 'mcptool:7:fixture_read')).toBe(true)
  })

  it('in a frame workflow, lists the steps a stream cannot run on a frame as disabled, with the reason (ADM-1351)', () => {
    const items = pickerItems({ tools, mcp, searching: true, frame: true })
    const byType = (t) => items.find((i) => i.nodeType === t)
    for (const t of ['vision.model', 'vision.filter', 'vision.crop', 'vision.draw', 'logic.condition', 'logic.foreach']) {
      expect(byType(t).disabled, t).toBeFalsy()
      expect(byType(t).badge, t).toBeUndefined()
    }
    expect(byType('agent.run')).toMatchObject({ disabled: true, badge: FRAME_BADGE, description: 'A stream cannot run this step on a camera frame.' })
    expect(byType('trigger.manual')).toMatchObject({ disabled: true, description: 'This workflow already starts on each camera frame.' })
    expect(items.filter((i) => i.kind === 'tool').every((i) => i.disabled && i.badge === FRAME_BADGE)).toBe(true)
    expect(items.filter((i) => i.kind.startsWith('mcp')).every((i) => i.disabled)).toBe(true)
    // Not a frame workflow: nothing is marked.
    expect(pickerItems({ tools, mcp, searching: true }).some((i) => i.disabled)).toBe(false)
    // The categories with frame steps come first; nothing is lost.
    expect(pickerGroups(mcp, { frame: true }).map((g) => g.id).slice(0, 3)).toEqual(['recent', 'vision', 'logic'])
    expect(pickerGroups(mcp, { frame: true })).toHaveLength(pickerGroups(mcp).length)
    expect(pickerGroups(mcp)[1].id).toBe('trigger')
  })

  it('lists every tool, never a cut list (F11)', () => {
    const many = Array.from({ length: 1800 }, (_, i) => ({ name: `TOOL_${i}`, category: 'x' }))
    expect(pickerItems({ tools: many, tab: 'tools' })).toHaveLength(1800)
  })

  it('leaves triggers out when the new step gets a connection into it', () => {
    const from = pickerItems({ ctx: { mode: 'from', source: { nodeId: 'log' } } })
    expect(from.some((i) => i.nodeType?.startsWith('trigger.'))).toBe(false)
    const insert = pickerItems({ ctx: { mode: 'insert', edgeId: 'x' } })
    expect(insert.some((i) => i.nodeType?.startsWith('trigger.'))).toBe(false)
    expect(pickerItems({ ctx: { mode: 'free' } }).some((i) => i.nodeType === 'trigger.manual')).toBe(true)
    expect(needsInput({ mode: 'into' })).toBe(false)
  })

  it('shows recent items first, under Recent, with ids of their own', () => {
    const items = pickerItems({ tools, mcp, recent: ['node:logic.delay', 'gone:thing'] })
    expect(items[0]).toMatchObject({ id: 'recent:node:logic.delay', sourceId: 'node:logic.delay', group: 'recent' })
    expect(items.filter((i) => i.group === 'recent')).toHaveLength(1)
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
  })

  it('narrows to one tab', () => {
    expect(pickerItems({ tab: 'logic' }).every((i) => i.group === 'logic')).toBe(true)
    expect(pickerItems({ tools, mcp, tab: 'mcp' }).map((i) => i.kind)).toEqual(['mcp-server', 'mcp-tool'])
    expect(pickerGroups(mcp).at(-1)).toEqual({ id: 'mcp:7', label: 'MCP · Fixture MCP' })
  })
})

describe('createNode', () => {
  it('makes a step with a condition-grammar id and the type defaults', () => {
    const n = createNode({ kind: 'node', nodeType: 'logic.delay' }, { existingIds: ['logic_delay'], position: { x: 10.4, y: 20.6 } })
    expect(n).toMatchObject({ id: 'logic_delay_2', type: 'logic.delay', position: { x: 10, y: 21 }, data: { seconds: 5 } })
  })
  it('makes a tool step named after the tool', () => {
    expect(createNode({ kind: 'tool', toolName: 'SLACK_POST' }).data).toMatchObject({ tool: 'SLACK_POST', label: 'SLACK_POST', params_json: '{}' })
  })
  it('refuses an MCP tool without the agent it runs with', () => {
    expect(() => createNode({ kind: 'mcp-tool', serverId: 7, serverName: 'Fixture MCP', toolName: 'fixture_read' })).toThrow(/agent/)
    const n = createNode({ kind: 'mcp-tool', serverId: 7, serverName: 'Fixture MCP', toolName: 'fixture_read' }, { agent: { id: 1, name: 'A' } })
    expect(n.data).toMatchObject({ agent_id: 1, server_id: 7, tool_name: 'fixture_read' })
  })
})

describe('connectOps', () => {
  const added = (type, id) => ({ id, type, position: { x: 900, y: 0 }, data: {} })

  it('connects from an output and keeps its handle (F13: the quick-add edge had no sourceHandle)', () => {
    const ops = connectOps({ mode: 'from', source: { nodeId: 'check', handle: 'false' } }, added('logic.delay', 'wait'), edges)
    expect(ops[1]).toEqual({ op: 'add_edge', edge: { id: 'e_check_false_wait', source: 'check', target: 'wait', sourceHandle: 'false' } })
    const { state: next } = applyWorkflowOps(state(), ops)
    expect(next.edges.at(-1)).toMatchObject({ source: 'check', target: 'wait', sourceHandle: 'false' })
  })

  it('gives every new connection an id of its own, never one already taken', () => {
    const taken = [...edges, { id: 'e_log_wait', source: 'x', target: 'y' }]
    const ops = connectOps({ mode: 'from', source: { nodeId: 'log', handle: null } }, added('logic.delay', 'wait'), taken)
    expect(ops[1].edge.id).toBe('e_log_wait_2')
  })

  it('inserts a step into a connection: the old one goes, two new ones keep its handles', () => {
    const ops = connectOps({ mode: 'insert', edgeId: 'e_check_true_log' }, added('logic.delay', 'wait'), edges)
    expect(ops.map((o) => o.op)).toEqual(['remove_edge', 'add_node', 'add_edge', 'add_edge'])
    const { state: next } = applyWorkflowOps(state(), ops)
    expect(next.edges.find((e) => e.id === 'e_check_true_log')).toBeUndefined()
    expect(next.edges).toContainEqual({ id: 'e_check_true_wait', source: 'check', target: 'wait', sourceHandle: 'true' })
    expect(next.edges).toContainEqual({ id: 'e_wait_log', source: 'wait', target: 'log' })
  })

  it('a condition inserted into a connection leaves on its true output', () => {
    const ops = connectOps({ mode: 'insert', edgeId: 'e_start_check' }, added('logic.condition', 'gate'), edges)
    expect(ops.at(-1).edge).toMatchObject({ source: 'gate', target: 'check', sourceHandle: 'true' })
  })

  it('connects backwards into an input', () => {
    const ops = connectOps({ mode: 'into', target: { nodeId: 'log', handle: null } }, added('action.http', 'fetch'), edges)
    expect(ops[1].edge).toEqual({ id: 'e_fetch_log', source: 'fetch', target: 'log' })
  })

  it('refuses a trigger as a target, and a connection that is gone', () => {
    expect(() => connectOps({ mode: 'from', source: { nodeId: 'log' } }, added('trigger.webhook', 'hook'), edges)).toThrow(/trigger/)
    expect(() => connectOps({ mode: 'insert', edgeId: 'nope' }, added('logic.delay', 'wait'), edges)).toThrow(/gone/)
  })

  it('a free step is only added', () => {
    expect(connectOps({ mode: 'free' }, added('logic.delay', 'wait'), edges)).toHaveLength(1)
  })
})

describe('placeFor', () => {
  it('puts a step after its source, below it for the false branch, and never on top of another step', () => {
    const after = placeFor({ mode: 'from', source: { nodeId: 'start', handle: null } }, nodes, edges)
    expect(after.x).toBeGreaterThan(0)
    const p = placeFor({ mode: 'from', source: { nodeId: 'check', handle: 'false' } }, nodes, edges)
    expect(p.y).toBeGreaterThan(0)
    const atDrop = placeFor({ mode: 'free', position: { x: 2000, y: 2000 } }, nodes, edges)
    expect(atDrop).toEqual({ x: 2000, y: 2000 })
  })
})

describe('recent items', () => {
  function memory() { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }
  it('keeps the latest first, without repeats', () => {
    const s = memory()
    for (let i = 0; i < RECENT_SIZE + 2; i++) pushRecent(`node:${i}`, s)
    pushRecent('node:3', s)
    const list = loadRecent(s)
    expect(list[0]).toBe('node:3')
    expect(list).toHaveLength(RECENT_SIZE)
    expect(new Set(list).size).toBe(list.length)
  })
  it('reads nothing from broken storage', () => {
    expect(loadRecent({ getItem: () => '{bad' })).toEqual([])
    expect(loadRecent({ getItem: () => { throw new Error('blocked') } })).toEqual([])
  })
})
