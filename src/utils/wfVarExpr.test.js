import { describe, it, expect } from 'vitest'
import {
  parseTemplateTokens, ancestorIds, checkTemplateTokens, TEMPLATE_ROOTS,
  NODE_ID_RE, isValidNodeId, newNodeId, newEdgeId, insertAt, insertListItem,
} from './wfVarExpr'

describe('parseTemplateTokens', () => {
  it('reads node, trigger, vars and item tokens with their positions', () => {
    const text = 'Hi {{trigger.body.name}}, {{ nodes.fetch.output.items[0].sku }} {{vars.key}} {{item}}'
    const t = parseTemplateTokens(text)
    expect(t.map((x) => x.root)).toEqual(['trigger', 'nodes', 'vars', 'item'])
    expect(t[0]).toMatchObject({ path: 'body.name', nodeId: null, raw: '{{trigger.body.name}}' })
    expect(text.slice(t[0].start, t[0].end)).toBe('{{trigger.body.name}}')
    expect(t[1]).toMatchObject({ expr: 'nodes.fetch.output.items[0].sku', nodeId: 'fetch', field: 'output', path: 'items[0].sku' })
    expect(t[3]).toMatchObject({ root: 'item', path: '' })
  })
  it('reads nodes.<id>.status and a bare nodes.<id>', () => {
    expect(parseTemplateTokens('{{nodes.a.status}}')[0]).toMatchObject({ nodeId: 'a', field: 'status', path: '' })
    expect(parseTemplateTokens('{{nodes.a}}')[0]).toMatchObject({ nodeId: 'a', field: null })
  })
  it('returns nothing for text without tokens or for non-text', () => {
    expect(parseTemplateTokens('no braces { here }')).toEqual([])
    expect(parseTemplateTokens(null)).toEqual([])
    expect(parseTemplateTokens(42)).toEqual([])
  })
  it('accepts exactly the engine roots', () => {
    expect(TEMPLATE_ROOTS).toEqual(['nodes', 'node', 'trigger', 'vars', 'inputs', 'item', 'run'])
  })
  it('insertAt splices a token at the caret, or appends when the caret is unknown', () => {
    expect(insertAt('ab', 1, 1, '{{item}}')).toBe('a{{item}}b')
    expect(insertAt('a-b', 1, 2, '{{item}}')).toBe('a{{item}}b')
    expect(parseTemplateTokens(insertAt('x ', null, null, '{{nodes.fetch.output.text}}'))[0]).toMatchObject({ nodeId: 'fetch', field: 'output', path: 'text' })
  })
})

describe('ancestorIds', () => {
  const edges = [
    { source: 'trig', target: 'a' }, { source: 'a', target: 'b' }, { source: 'a', target: 'c' },
    { source: 'b', target: 'd' }, { source: 'c', target: 'd' }, { source: 'x', target: 'y' },
  ]
  it('walks every path upstream', () => {
    expect([...ancestorIds('d', edges)].sort()).toEqual(['a', 'b', 'c', 'trig'])
  })
  it('a trigger or an isolated node has none', () => {
    expect(ancestorIds('trig', edges).size).toBe(0)
    expect(ancestorIds('zz', edges).size).toBe(0)
  })
  it('does not loop on a cycle', () => {
    expect([...ancestorIds('a', [{ source: 'a', target: 'b' }, { source: 'b', target: 'a' }])]).toEqual(['b'])
  })
})

describe('checkTemplateTokens', () => {
  const nodeIds = ['trig', 'fetch', 'sum', 'other']
  const edges = [{ source: 'trig', target: 'fetch' }, { source: 'fetch', target: 'sum' }, { source: 'trig', target: 'other' }]
  const check = (text) => checkTemplateTokens(text, { nodeId: 'sum', nodeIds, edges })

  it('passes ancestors, trigger, vars, item, inputs and run', () => {
    const t = check('{{nodes.fetch.output.text}} {{nodes.trig.output}} {{trigger.x}} {{vars.k}} {{item.a}} {{inputs.q}} {{run.id}}')
    expect(t.every((x) => x.problem === null)).toBe(true)
  })
  it('marks a node that does not run before this one', () => {
    const [t] = check('{{nodes.other.output.text}}')
    expect(t.problem).toBe('not_upstream')
    expect(t.message).toContain('other')
  })
  it('marks an unknown node, the node itself, a missing id and an unknown root', () => {
    expect(check('{{nodes.ghost.output}}')[0].problem).toBe('unknown_node')
    expect(check('{{nodes.sum.output}}')[0].problem).toBe('self')
    expect(check('{{nodes.}}')[0].problem).toBe('missing_node')
    expect(check('{{steps.fetch.output}}')[0].problem).toBe('unknown_root')
  })
})

describe('node and edge ids', () => {
  it('a new node id matches the condition grammar and reads like its type', () => {
    expect(newNodeId('agent.run', [])).toBe('agent_run')
    expect(newNodeId('agent.run', ['agent_run'])).toBe('agent_run_2')
    expect(newNodeId('agent.run', ['agent_run', 'agent_run_2'])).toBe('agent_run_3')
    for (const type of ['llm.call', 'action.mcp_tool', '9lives', '', null, 'a-b c']) {
      expect(newNodeId(type, [])).toMatch(NODE_ID_RE)
    }
  })
  it('isValidNodeId follows ^[A-Za-z_][A-Za-z0-9_]*$', () => {
    expect(isValidNodeId('fetch_1')).toBe(true)
    expect(isValidNodeId('_x')).toBe(true)
    expect(isValidNodeId('1x')).toBe(false)
    expect(isValidNodeId('n-1')).toBe(false)
    expect(isValidNodeId('')).toBe(false)
  })
  it('edge ids are ours, carry the handle, and never collide', () => {
    expect(newEdgeId('a', 'b')).toBe('e_a_b')
    expect(newEdgeId('cond', 'b', [], 'true')).toBe('e_cond_true_b')
    expect(newEdgeId('a', 'b', ['e_a_b'])).toBe('e_a_b_2')
  })
})

describe('insertListItem (a list of references, ADM-1351 phase 3)', () => {
  it('sets a token apart from the one before it and the one after it, and keeps the caret after the token', () => {
    expect(insertListItem('', 0, 0, '{{trigger.photo}}')).toEqual({ text: '{{trigger.photo}}', caret: 17 })
    expect(insertListItem('{{trigger.photo}}', null, null, '{{nodes.crop.output.images}}'))
      .toEqual({ text: '{{trigger.photo}}, {{nodes.crop.output.images}}', caret: 47 })
    expect(insertListItem('{{a}}  ', 7, 7, '{{b}}').text).toBe('{{a}}, {{b}}')
    expect(insertListItem('{{a}}{{c}}', 5, 5, '{{b}}')).toEqual({ text: '{{a}}, {{b}}, {{c}}', caret: 12 })
  })
  it('adds no second separator where one is already typed', () => {
    expect(insertListItem('{{a}}, ', 7, 7, '{{b}}').text).toBe('{{a}}, {{b}}')
    expect(insertListItem('{{a}},', 6, 6, '{{b}}').text).toBe('{{a}},{{b}}')
    expect(insertListItem(', {{c}}', 0, 0, '{{b}}').text).toBe('{{b}}, {{c}}')
  })
  it('replaces a selection the same way', () => {
    expect(insertListItem('{{a}}, {{old}}', 7, 14, '{{b}}').text).toBe('{{a}}, {{b}}')
  })
})
