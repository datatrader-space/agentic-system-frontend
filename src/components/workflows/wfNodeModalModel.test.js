// The node window's pure logic (ADM-1333): engine paths, the schema view, the Input pane's sources and number checks.
import { describe, expect, it } from 'vitest'
import {
  buildSources, mergeNodeStates, numberProblem, pickerItems, prettyPathToEngine, resolvePath, schemaOf,
  schemaPaths, secretVarNames, tokenResolves, varsValue,
} from './wfNodeModalModel'
import { checkTemplateTokens } from '@/utils/wfVarExpr'

const nodes = [
  { id: 'start', type: 'trigger.manual', data: { inputs: [{ key: 'city', default: 'Oslo' }] } },
  { id: 'fetch', type: 'action.tool', data: { label: 'Fetch' } },
  { id: 'think', type: 'llm.call', data: {} },
  { id: 'side', type: 'action.http', data: {} },
  { id: 'loop', type: 'logic.foreach', data: {} },
]
const edges = [
  { id: 'e1', source: 'start', target: 'fetch' },
  { id: 'e2', source: 'fetch', target: 'think' },
  { id: 'e3', source: 'start', target: 'side' },
  { id: 'e4', source: 'think', target: 'loop' },
]

describe('engine paths', () => {
  it('resolves keys and indexes the way the engine does', () => {
    const v = { result: { items: [{ sku: 'a' }, { sku: 'b' }] }, 'x-y': 3 }
    expect(resolvePath(v, 'result.items[1].sku')).toBe('b')
    expect(resolvePath(v, 'x-y')).toBe(3)
    expect(resolvePath(v, 'result.items[5].sku')).toBeUndefined()
    expect(resolvePath(v, 'result.missing')).toBeUndefined()
  })

  it("turns vue-json-pretty's paths into engine paths, and refuses keys the engine cannot address", () => {
    expect(prettyPathToEngine('root')).toBe('')
    expect(prettyPathToEngine('root.result.items[0].sku')).toBe('result.items[0].sku')
    expect(prettyPathToEngine('root["x-y"]')).toBe('x-y')
    expect(prettyPathToEngine('root[3]')).toBe('[3]')
    expect(prettyPathToEngine('root["a.b"]')).toBeNull()
    expect(prettyPathToEngine('root["}"]')).toBeNull()
  })
})

describe('schema view', () => {
  it('reads every item of a list and merges their keys', () => {
    expect(schemaOf({ items: [{ a: 1 }, { b: 'x' }, { a: 'y' }] })).toEqual({ items: [{ a: 'number | string', b: 'string' }] })
    expect(schemaPaths({ items: [{ a: 1 }] }).map((p) => p.path)).toEqual(['items', 'items[0]', 'items[0].a'])
  })
})

describe('the Input pane', () => {
  it('lists only ANCESTORS, plus the trigger and the variables; a secret value is never shown', () => {
    const vars = { api_key: { secret: true, default: 'sk-live' }, region: { default: 'eu' } }
    const sources = buildSources({ nodeId: 'think', nodes, edges, vars, states: {} })
    expect(sources.map((s) => s.id)).toEqual(['trigger', 'vars', 'node:fetch'])
    expect(sources.find((s) => s.id === 'vars').value).toEqual({ api_key: '(secret)', region: 'eu', city: 'Oslo' })
    expect(JSON.stringify(sources)).not.toContain('sk-live')
    expect(secretVarNames(vars)).toEqual(['api_key'])
    expect(varsValue({}, nodes)).toEqual({ city: 'Oslo' })
  })

  it('shows real tool output with its structure ({ text, result }) and the fired trigger payload', () => {
    const states = mergeNodeStates(
      { start: { status: 'succeeded', output: { text: '', trigger: { city: 'Bergen' } } } },
      { fetch: { status: 'succeeded', output: { text: '2 rows', result: { rows: [1, 2] } } } },
    )
    const sources = buildSources({ nodeId: 'think', nodes, edges, states })
    expect(sources.find((s) => s.id === 'trigger')).toMatchObject({ real: true, value: { city: 'Bergen' } })
    expect(sources.find((s) => s.id === 'node:fetch')).toMatchObject({ real: true, value: { result: { rows: [1, 2] } } })
    const items = pickerItems(sources).map((i) => i.id)
    expect(items).toContain('{{nodes.fetch.output.result.rows}}')
    expect(items).toContain('{{trigger.city}}')
  })

  it('before a run, a trigger that declares its payload shows it: the frame of "Each camera frame" (ADM-1351)', () => {
    const frameNodes = [{ id: 'frame', type: 'trigger.frame', data: {} }, { id: 'find', type: 'vision.model', data: {} }]
    const sources = buildSources({ nodeId: 'find', nodes: frameNodes, edges: [{ id: 'e1', source: 'frame', target: 'find' }] })
    const trigger = sources.find((s) => s.id === 'trigger')
    expect(trigger).toMatchObject({ real: false, value: { image: { kind: 'image' }, frame: 0, t: 0, source: { name: 'Camera' } } })
    const items = pickerItems(sources).map((i) => i.id)
    expect(items).toContain('{{trigger.image}}')
    expect(items).toContain('{{trigger.source.name}}')
    // A manual trigger declares none: its inputs alone, as before.
    expect(buildSources({ nodeId: 'fetch', nodes, edges }).find((s) => s.id === 'trigger').value).toEqual({ city: 'Oslo' })
  })

  it('before a run, a Run script step offers the image it may leave as {{nodes.<id>.output.image}} (ADM-1351 phase 4)', () => {
    const scriptNodes = [
      { id: 'start', type: 'trigger.manual', data: { inputs: [{ key: 'photo', type: 'image' }] } },
      { id: 'blur', type: 'action.script', data: { script_id: 3, image: '{{trigger.photo}}' } },
      { id: 'find', type: 'vision.model', data: {} },
    ]
    const scriptEdges = [{ id: 'e1', source: 'start', target: 'blur' }, { id: 'e2', source: 'blur', target: 'find' }]
    const sources = buildSources({ nodeId: 'find', nodes: scriptNodes, edges: scriptEdges })
    expect(sources.find((s) => s.id === 'node:blur')).toMatchObject({ real: false, value: { image: { kind: 'image' } } })
    const items = pickerItems(sources).map((i) => i.id)
    expect(items).toContain('{{nodes.blur.output.image}}')
    expect(items).toContain('{{nodes.blur.output.text}}')
  })

  it("a manual trigger's image input is an image in Variables too: a sample before a run, the real one after (ADM-1351)", () => {
    const imgNodes = [
      { id: 'start', type: 'trigger.manual', data: { inputs: [{ key: 'photo', type: 'image' }, { key: 'city', default: 'Oslo' }] } },
      { id: 'find', type: 'vision.model', data: {} },
    ]
    const imgEdges = [{ id: 'e1', source: 'start', target: 'find' }]
    const before = buildSources({ nodeId: 'find', nodes: imgNodes, edges: imgEdges })
    expect(before.find((s) => s.id === 'vars').value).toEqual({ photo: { kind: 'image', id: '(image)' }, city: 'Oslo' })
    const items = pickerItems(before)
    expect(items.find((i) => i.id === '{{vars.photo}}')).toMatchObject({ description: 'object' })
    expect(items.map((i) => i.id)).toContain('{{vars.photo.kind}}')

    const photo = { kind: 'image', id: 'asset-42', url: 'https://example.test/p.png' }
    const states = { start: { status: 'succeeded', output: { text: '', trigger: { photo, city: 'Bergen' } } } }
    const after = buildSources({ nodeId: 'find', nodes: imgNodes, edges: imgEdges, states })
    // The image is the payload's; a text input still shows its declared default, as before.
    expect(after.find((s) => s.id === 'vars').value).toEqual({ photo, city: 'Oslo' })
    // A run whose payload has no image leaves it empty, never a sample presented as real.
    expect(varsValue({}, imgNodes, { city: 'Bergen' })).toEqual({ photo: '', city: 'Oslo' })
    // A secret variable of the same name stays hidden.
    expect(varsValue({ photo: { secret: true, default: 'x' } }, imgNodes, { photo })).toMatchObject({ photo: '(secret)' })
  })

  it('offers {{item}} on a for-each step only', () => {
    expect(buildSources({ nodeId: 'loop', nodes, edges }).some((s) => s.base === 'item')).toBe(true)
    expect(buildSources({ nodeId: 'think', nodes, edges }).some((s) => s.base === 'item')).toBe(false)
  })

  it('a token is "found" only when the last run has a value at its path', () => {
    const states = { fetch: { status: 'succeeded', output: { result: { n: 1 } } } }
    const [ok, missing] = checkTemplateTokens('{{nodes.fetch.output.result.n}} {{nodes.fetch.output.result.z}}',
      { nodeId: 'think', nodeIds: nodes.map((n) => n.id), edges })
    expect(tokenResolves(ok, { states })).toBe(true)
    expect(tokenResolves(missing, { states })).toBe(false)
  })
})

describe('number settings (F5)', () => {
  const opts = { min: 0, max: 5, integer: true, optional: true, label: 'Retries' }
  it('accepts a number in range and an empty optional field', () => {
    expect(numberProblem('3', opts)).toBeNull()
    expect(numberProblem('', opts)).toBeNull()
  })
  it('says why a value is refused', () => {
    expect(numberProblem('9', opts)).toBe('Retries must be 5 or less.')
    expect(numberProblem('-1', opts)).toBe('Retries must be 0 or more.')
    expect(numberProblem('1.5', opts)).toBe('Retries must be a whole number.')
    expect(numberProblem(NaN, opts)).toBe('Retries must be a number.')
    expect(numberProblem('0', { min: 0, minExclusive: true, label: 'Timeout' })).toBe('Timeout must be more than 0.')
  })
})
