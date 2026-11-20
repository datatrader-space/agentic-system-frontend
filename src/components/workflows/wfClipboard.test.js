// Copy, paste and duplicate as system-clipboard JSON (ADM-1333 plan §3.5, F13).
import { describe, it, expect } from 'vitest'
import { copyText, parseClip, pasteOps, CLIP_KIND } from './wfClipboard'
import { applyWorkflowOps } from '@/composables/useWorkflowDoc'

const nodes = [
  { id: 'start', type: 'trigger.manual', position: { x: 0, y: 0 }, data: { inputs: [{ key: 'a', default: '1' }] } },
  { id: 'send', type: 'action.channel', position: { x: 300, y: 0 }, data: { kind: 'telegram', chat_id: '1', bot_token: 'secret-token', message: 'hi' } },
  { id: 'other', type: 'logic.delay', position: { x: 600, y: 0 }, data: { seconds: 1 } },
]
const edges = [{ id: 'e_start_send', source: 'start', target: 'send' }, { id: 'e_send_other', source: 'send', target: 'other' }]

describe('copyText', () => {
  it('copies the chosen steps and only the connections between them', () => {
    const clip = JSON.parse(copyText(nodes, edges, ['start', 'send']))
    expect(clip.kind).toBe(CLIP_KIND)
    expect(clip.nodes.map((n) => n.id)).toEqual(['start', 'send'])
    expect(clip.edges.map((e) => e.id)).toEqual(['e_start_send'])
  })
  it('never puts a password field on the system clipboard', () => {
    const text = copyText(nodes, edges, ['send'])
    expect(text).not.toContain('secret-token')
    expect(JSON.parse(text).nodes[0].data).not.toHaveProperty('bot_token')
  })
  it('keeps it for Duplicate, whose text never leaves the page', () => {
    expect(copyText(nodes, edges, ['send'], { keepSecrets: true })).toContain('secret-token')
  })
  it('returns null when nothing is chosen', () => {
    expect(copyText(nodes, edges, [])).toBeNull()
  })
})

describe('parseClip', () => {
  it('refuses text that is not copied steps, with the reason', () => {
    expect(() => parseClip('hello')).toThrow('The clipboard does not hold workflow steps.')
    expect(() => parseClip('{"kind":"other"}')).toThrow('The clipboard does not hold workflow steps.')
    expect(() => parseClip(JSON.stringify({ kind: CLIP_KIND, version: 9, nodes: [], edges: [] }))).toThrow(/different version/)
  })
})

describe('pasteOps', () => {
  it('adds fresh ids, remaps the internal connections and moves the steps', () => {
    const clip = parseClip(copyText(nodes, edges, ['start', 'send']))
    const { ops, nodeIds } = pasteOps(clip, { nodeIds: nodes.map((n) => n.id), edgeIds: edges.map((e) => e.id), offset: { x: 32, y: 48 } })
    expect(nodeIds).toEqual(['trigger_manual', 'action_channel'])
    const { state } = applyWorkflowOps({ name: 'W', nodes, edges, vars: {} }, ops)
    expect(state.nodes).toHaveLength(5)
    expect(state.nodes.find((n) => n.id === 'trigger_manual').position).toEqual({ x: 32, y: 48 })
    expect(state.edges.at(-1)).toMatchObject({ id: 'e_trigger_manual_action_channel', source: 'trigger_manual', target: 'action_channel' })
  })
  it('pastes twice without an id collision, and the copies do not share their data', () => {
    const clip = parseClip(copyText(nodes, edges, ['start']))
    const first = pasteOps(clip, { nodeIds: nodes.map((n) => n.id) })
    const s1 = applyWorkflowOps({ name: 'W', nodes, edges, vars: {} }, first.ops).state
    const second = pasteOps(clip, { nodeIds: s1.nodes.map((n) => n.id) })
    const s2 = applyWorkflowOps(s1, second.ops).state
    expect(new Set(s2.nodes.map((n) => n.id)).size).toBe(s2.nodes.length)
    const [a, b] = s2.nodes.filter((n) => n.type === 'trigger.manual' && n.id !== 'start')
    expect(a.data.inputs).not.toBe(b.data.inputs)
  })
})
