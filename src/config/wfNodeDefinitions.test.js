// The Workflow Builder's step registry comes from the server (ADM-1351, D4): it is taken into the exported objects in
// place, with only icons and categories kept here; it is read once per page session, and a failed read is not kept.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import fixture from './__fixtures__/wfStepTypes.json'
import {
  WF_NODE_DEFS, WF_TYPES, WF_PALETTE_ORDER, WF_ICONS, WF_CATEGORIES, WF_KINDS, setStepRegistry, resetStepRegistry,
  stepRegistryReady, wfDef, wfIcon, wfFields, wfDefaultData, wfOutputSample, wfPaletteItems, wfFieldShown, wfForeachInner, wfForeachInnerTypes,
} from './wfNodeDefinitions'

const apiMock = vi.hoisted(() => ({ getWorkflowStepTypes: vi.fn() }))
vi.mock('@/services/api', () => ({ default: apiMock }))
const { loadStepRegistry, resetStepRegistryLoad } = await import('./wfStepRegistry')

const lucide = createRequire(import.meta.url)('@iconify-json/lucide/icons.json')
const hasLucide = (name) => name.startsWith('lucide:') && !!(lucide.icons[name.slice(7)] || lucide.aliases?.[name.slice(7)])
const fresh = () => JSON.parse(JSON.stringify(fixture))

afterEach(() => { setStepRegistry(fresh()) })

describe('the registry taken from the server', () => {
  it('fills the exported objects in place, mapping the server names', () => {
    const defs = WF_NODE_DEFS
    const types = WF_TYPES
    resetStepRegistry()
    expect(stepRegistryReady()).toBe(false)
    expect(Object.keys(WF_NODE_DEFS)).toHaveLength(0)
    setStepRegistry(fresh())
    expect(WF_NODE_DEFS).toBe(defs)
    expect(WF_TYPES).toBe(types)
    expect(stepRegistryReady()).toBe(true)
    expect(WF_TYPES).toEqual(fixture.steps.map((s) => s.type))
    expect(WF_KINDS).toContain('detections')
    expect(wfDef('action.mcp_tool').paletteHidden).toBe(true)
    expect(WF_PALETTE_ORDER).not.toContain('action.mcp_tool')
    expect(wfDef('logic.approval').customTail).toBe('approval')
    expect(wfDef('trigger.schedule').customTail).toBeUndefined()
    expect(wfDef('action.http').outputSample).toEqual({ status_code: 200, text: 'response body' })
    expect(wfOutputSample('trigger.webhook')).toBeNull()
    expect(wfFields('trigger.webhook')).toBeNull()
    expect(wfDef('vision.model').billable).toBe(true)
    expect(wfDef('vision.model').outputs.detections.kind).toBe('detections')
    expect(wfDef('vision.model').inputs).toEqual({ image: ['image'] })
  })

  it('carries the 19 existing step types and the four vision steps', () => {
    for (const type of ['media.generate', 'trigger.manual', 'trigger.schedule', 'trigger.webhook', 'trigger.channel', 'trigger.connector',
      'trigger.training.stream_event', 'agent.run', 'llm.call', 'action.tool', 'action.mcp_tool', 'action.script', 'action.channel',
      'action.http', 'logic.condition', 'logic.approval', 'logic.foreach', 'logic.delay', 'action.subworkflow']) {
      expect(wfDef(type), type).toBeTruthy()
    }
    expect(wfDefaultData('vision.model')).toEqual({ image: '', model: '', classes: '', threshold: null })
    expect(wfDefaultData('vision.filter')).toEqual({ detections: '', classes: '', min_score: null, zone: null })
    expect(wfDefaultData('vision.crop')).toEqual({ detections: '', padding: 0, max: 20 })
    expect(wfDefaultData('vision.draw')).toEqual({ detections: '', labels: true })
    expect(wfPaletteItems().map((i) => i.type)).toEqual(expect.arrayContaining(['vision.model', 'vision.filter', 'vision.crop', 'vision.draw']))
    const inputs = wfFields('trigger.manual').find((f) => f.key === 'inputs')
    expect(inputs.cols.map((c) => c.key)).toEqual(['key', 'type', 'default'])
    expect(inputs.cols[1].options).toEqual([['text', 'Text'], ['image', 'Image']])
  })

  it('maps frame_mode: the frame trigger, the vision steps, Condition and For-each may run on a camera frame (phase 2)', () => {
    expect(wfDef('trigger.frame')).toMatchObject({ trigger: true, frameMode: true, label: 'Each camera frame', icon: 'lucide:aperture' })
    expect(wfOutputSample('trigger.frame')).toMatchObject({ image: { kind: 'image' }, frame: 0, source: { name: 'Camera' } })
    const frame = WF_TYPES.filter((t) => wfDef(t).frameMode).sort()
    expect(frame).toEqual(['logic.condition', 'logic.foreach', 'trigger.frame', 'vision.crop', 'vision.draw', 'vision.filter', 'vision.model'])
    const json = fresh()
    delete json.steps.find((s) => s.type === 'vision.draw').frame_mode
    setStepRegistry(json)
    expect(wfDef('vision.draw').frameMode).toBe(false)
  })

  it('keeps the For-each inner-step rule in one place: the five actions and every vision step; a frame only its own', () => {
    expect(wfForeachInnerTypes().map((t) => t.value).sort()).toEqual(['action.channel', 'action.http', 'action.subworkflow', 'action.tool',
      'agent.run', 'vision.crop', 'vision.draw', 'vision.filter', 'vision.model'])
    expect(wfForeachInnerTypes({ frame: true }).map((t) => t.value)).toEqual(['vision.model', 'vision.filter', 'vision.crop', 'vision.draw'])
    expect(wfForeachInnerTypes()[0]).toEqual({ value: 'agent.run', label: 'Run agent' })   // the registry's order and names
    expect(wfForeachInner('llm.call')).toBe(false)
    expect(wfForeachInner('logic.condition', { frame: true })).toBe(false)
    expect(wfForeachInner('no.such_step')).toBe(false)
    // A vision step the server adds is offered with no change here.
    const json = fresh()
    json.steps.push({ ...json.steps.find((s) => s.type === 'vision.draw'), type: 'vision.blur', label: 'Blur objects' })
    setStepRegistry(json)
    expect(wfForeachInner('vision.blur', { frame: true })).toBe(true)
  })

  it('every step type of the server has its own Lucide icon written here, so the icon is bundled (ADM-1342)', () => {
    const source = readFileSync(fileURLToPath(new URL('./wfNodeDefinitions.js', import.meta.url)), 'utf8')
    for (const s of fixture.steps) {
      expect(WF_ICONS[s.type], s.type).toBeTruthy()
      expect(hasLucide(wfIcon(s.type)), `${s.type}: ${wfIcon(s.type)}`).toBe(true)
      expect(source.includes(`'${WF_ICONS[s.type]}'`), s.type).toBe(true)
    }
    for (const c of Object.values(WF_CATEGORIES)) expect(hasLucide(c.icon)).toBe(true)
  })

  it('a type the server adds without an icon here is drawn with its category\'s icon', () => {
    const json = fresh()
    json.steps.push({ ...json.steps.find((s) => s.type === 'vision.draw'), type: 'vision.new_thing' })
    setStepRegistry(json)
    expect(wfIcon('vision.new_thing')).toBe(WF_CATEGORIES.vision.icon)
  })

  it('refuses an answer it cannot read, and keeps what it had', () => {
    for (const bad of [null, {}, { steps: [] }, { steps: [{ category: 'logic' }] }, { steps: [{ type: 'x.y', category: 'unknown' }] }]) {
      expect(() => setStepRegistry(bad)).toThrow()
      expect(wfDef('logic.delay')).toBeTruthy()
      expect(stepRegistryReady()).toBe(true)
    }
  })
})

describe('showIf is data', () => {
  it('shows a field while the data field equals the value, or one of the values', () => {
    expect(wfFieldShown({ key: 'a' }, {})).toBe(true)
    expect(wfFieldShown({ key: 'a', showIf: null }, {})).toBe(true)
    expect(wfFieldShown({ key: 'a', showIf: { kind: 'slack' } }, { kind: 'slack' })).toBe(true)
    expect(wfFieldShown({ key: 'a', showIf: { kind: 'slack' } }, { kind: 'email' })).toBe(false)
    expect(wfFieldShown({ key: 'a', showIf: { kind: ['slack', 'email'] } }, { kind: 'email' })).toBe(true)
    expect(wfFieldShown({ key: 'a', showIf: { kind: ['slack', 'email'] } }, {})).toBe(false)
    const channel = wfFields('action.channel').find((f) => f.key === 'slack_channel')
    expect(wfFieldShown(channel, { kind: 'slack' })).toBe(true)
    expect(wfFieldShown(channel, { kind: 'log' })).toBe(false)
  })
})

describe('loading it once per page session', () => {
  beforeEach(() => { resetStepRegistry(); resetStepRegistryLoad(); apiMock.getWorkflowStepTypes.mockReset() })

  it('reads it once, and every caller shares the one read', async () => {
    apiMock.getWorkflowStepTypes.mockResolvedValue({ data: fresh() })
    await Promise.all([loadStepRegistry(), loadStepRegistry()])
    await loadStepRegistry()
    expect(apiMock.getWorkflowStepTypes).toHaveBeenCalledTimes(1)
    expect(wfDef('vision.model').label).toBe('Find objects')
  })

  it('a failed read is said in words and not kept: the next call asks again (no bundled copy)', async () => {
    apiMock.getWorkflowStepTypes.mockRejectedValueOnce({ response: { status: 503, data: { error: 'The step list is not available.' } } })
    await expect(loadStepRegistry()).rejects.toThrow('The step list is not available.')
    expect(stepRegistryReady()).toBe(false)
    expect(WF_TYPES).toHaveLength(0)
    apiMock.getWorkflowStepTypes.mockRejectedValueOnce(new Error('Network Error'))
    await expect(loadStepRegistry()).rejects.toThrow('Check your connection')
    apiMock.getWorkflowStepTypes.mockResolvedValueOnce({ data: { steps: 'nope' } })
    await expect(loadStepRegistry()).rejects.toThrow('a shape this page does not read')
    apiMock.getWorkflowStepTypes.mockResolvedValueOnce({ data: fresh() })
    await expect(loadStepRegistry()).resolves.toBe(true)
    expect(apiMock.getWorkflowStepTypes).toHaveBeenCalledTimes(4)
  })
})
