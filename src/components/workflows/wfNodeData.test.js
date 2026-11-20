// A node's stored data <-> the edited shape, and the card's badge line (ADM-1333).
import { describe, it, expect } from 'vitest'
import { hydrateNode, serializeNode, nodeBadge, nodeTitle, hasReliability, WF_RELIABILITY_TYPES, secretKeys } from './wfNodeData'
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
    expect(nodeBadge('trigger.schedule', { cron: '0 8 * * *' }).text).toBe('Schedule · 0 8 * * *')
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
