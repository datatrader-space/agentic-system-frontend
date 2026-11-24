// A node's stored data <-> the edited shape, and the card's badge line (ADM-1333).
import { describe, it, expect } from 'vitest'
import { hydrateNode, serializeNode, nodeBadge, nodeTitle, hasReliability, WF_RELIABILITY_TYPES, secretKeys, nodeIsOff, canTurnOff, toggleOffOps, offButtonTitle } from './wfNodeData'
import { applyWorkflowOps } from '@/composables/useWorkflowDoc'
import { WorkflowInputError } from '@/utils/workflowInput'

describe('hydrateNode / serializeNode', () => {
  it('round-trips the JSON fields', () => {
    const cases = [
      ['action.tool', { tool: 'T', params: { q: 1 } }],
      ['action.http', { method: 'POST', url: 'https://x', json: { a: 1 } }],
      ['llm.call', { prompt: 'p', output_schema: { type: 'object' } }],
      ['trigger.connector', { provider: 'github', connection: 'c', filters: { 'repository.name': 'x' } }],
      ['logic.foreach', { items_template: '{{trigger.items}}', do: { type: 'action.tool', data: { tool: 'T', params: { a: 2 } } } }],
    ]
    for (const [type, data] of cases) expect(serializeNode(type, hydrateNode(type, data))).toEqual(data)
  })
  it('keeps "no schema" and "no filters" empty instead of {}', () => {
    expect(hydrateNode('llm.call', { prompt: 'p' }).output_schema_json).toBe('')
    expect(hydrateNode('trigger.connector', { filters: {} }).filters_json).toBe('')
  })
  it('removes a cleared HTTP body', () => {
    const d = hydrateNode('action.http', { url: 'u', json: { a: 1 } })
    expect(serializeNode('action.http', { ...d, json_text: '' })).not.toHaveProperty('json')
  })
  it('refuses JSON that does not parse, naming the field', () => {
    expect(() => serializeNode('action.tool', { tool: 'T', params_json: '{ bad' })).toThrow(WorkflowInputError)
  })
  it('does not share nested objects with the stored data', () => {
    const stored = { do: { type: 'action.channel', data: { message: 'm' } } }
    const d = hydrateNode('logic.foreach', stored)
    expect(d.do).not.toBe(stored.do)
    expect(d.do.data).not.toBe(stored.do.data)
  })
})

describe('nodeBadge', () => {
  it('says "Needs setup" until the key fields are set', () => {
    expect(nodeBadge('agent.run', {})).toEqual({ text: 'Needs setup', needsSetup: true })
    expect(nodeBadge('logic.condition', { expression: '' })).toEqual({ text: 'Needs setup', needsSetup: true })
  })
  it('shows the model, the trigger kind or the tool', () => {
    expect(nodeBadge('llm.call', { prompt: 'p', model_id: 'gpt-x' }).text).toBe('gpt-x')
    expect(nodeBadge('llm.call', { prompt: 'p' }).text).toBe('Default model')
    expect(nodeBadge('trigger.webhook', {}).text).toBe('Webhook')
    expect(nodeBadge('trigger.schedule', { cron: '0 8 * * *' }).text).toBe('Schedule · cron 0 8 * * * · UTC')
    expect(nodeBadge('trigger.schedule', { mode: 'days', every: 3, at: '02:00', start_date: '2026-11-29', timezone: 'Asia/Karachi' }).text)
      .toBe('Schedule · Every 3 days 02:00 · Asia/Karachi')
    expect(nodeBadge('action.tool', { tool: 'SLACK_POST' }).text).toBe('SLACK_POST')
    expect(nodeBadge('logic.condition', { expression: 'a == b' }).text).toBe('true / false')
  })
  it('the title is the label, else the type name', () => {
    expect(nodeTitle('agent.run', { label: 'Summarise' })).toBe('Summarise')
    expect(nodeTitle('agent.run', {})).toBe('Run agent')
  })
})

describe('reliability types', () => {
  it('are the types that retry, so the error output shows only on them', () => {
    expect(hasReliability('action.http')).toBe(true)
    expect(hasReliability('logic.condition')).toBe(false)
    expect(hasReliability('trigger.manual')).toBe(false)
    expect(WF_RELIABILITY_TYPES).toContain('logic.approval')
  })
  it('knows the password fields', () => {
    expect(secretKeys('action.channel')).toEqual(['bot_token'])
    expect(secretKeys('logic.delay')).toEqual([])
  })
})

describe('turning a step off (ADM-1343)', () => {
  const nodes = [
    { id: 't', type: 'trigger.manual', position: { x: 0, y: 0 }, data: {} },
    { id: 'a', type: 'action.http', position: { x: 1, y: 0 }, data: { url: 'x' } },
    { id: 'b', type: 'logic.approval', position: { x: 2, y: 0 }, data: { message: 'ok?', disabled: true } },
  ]
  it('reads only exactly true as off, and never offers it on a trigger', () => {
    expect(nodeIsOff({ disabled: true })).toBe(true)
    expect(nodeIsOff({ disabled: 'true' })).toBe(false)
    expect(nodeIsOff(undefined)).toBe(false)
    expect(canTurnOff('trigger.webhook')).toBe(false)
    expect(canTurnOff('logic.approval')).toBe(true)
  })
  it('turns one step off and back on, the key removed so the data is as before', () => {
    const offOps = toggleOffOps([nodes[1]])
    expect(offOps).toEqual({ off: true, ops: [{ op: 'update_node', id: 'a', data: { disabled: true } }] })
    const { state, inverse } = applyWorkflowOps({ name: 'w', nodes, edges: [], vars: {} }, offOps.ops)
    expect(state.nodes[1].data).toEqual({ url: 'x', disabled: true })
    const onOps = toggleOffOps([state.nodes[1]])
    expect(onOps.off).toBe(false)
    expect(applyWorkflowOps(state, onOps.ops).state.nodes[1].data).toEqual({ url: 'x' })
    // Undo (the inverse) gives back the step as it was.
    expect(applyWorkflowOps(state, inverse).state.nodes[1].data).toEqual({ url: 'x' })
  })
  it('a mixed selection is all turned off; the trigger is left out', () => {
    const { ops, off } = toggleOffOps(nodes)
    expect(off).toBe(true)
    expect(ops).toEqual([{ op: 'update_node', id: 'a', data: { disabled: true } }])
    expect(toggleOffOps([nodes[0]]).ops).toEqual([])
  })
  it('the control says what it does, and an approval step says nobody is asked', () => {
    expect(offButtonTitle('action.http', false)).toBe('Turn step off (D)')
    expect(offButtonTitle('action.http', true)).toBe('Turn step on (D)')
    expect(offButtonTitle('logic.approval', false)).toMatch(/without asking for approval/)
  })
})
