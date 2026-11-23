// @vitest-environment jsdom
// F6 (ADM-1333): the for-each step shows the engine's syntax ({{nodes.<id>.output.items}}) or JSON text, never the
// legacy {{node.<id>.text}}; its inner step is written whole through the history.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import ForeachSettings from './ForeachSettings.vue'
import { editorHarness } from '../wfNodeModal.testHarness'

const visionApi = vi.hoisted(() => vi.fn(async () => ({ data: { models: [{ value: 'sam3', label: 'SAM 3' }] } })))
vi.mock('@/services/api', () => ({ default: { get: vi.fn(), getWorkflowVisionModels: visionApi } }))

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null })

function mountForeach(data, { before = [] } = {}) {
  const ctx = editorHarness({ nodeId: 'loop', nodes: [...before, { id: 'loop', type: 'logic.foreach', data }], render: () => h(ForeachSettings) })
  wrapper = mount(ctx.Host, { attachTo: document.body })
  return ctx
}
const data = (ctx) => ctx.doc.nodes.value.find((n) => n.id === 'loop').data
const typeSelect = () => wrapper.findAll('select')[0]
const offered = () => typeSelect().findAll('option').filter((o) => !o.element.disabled).map((o) => [o.element.value, o.text()])

describe('ForeachSettings (F6)', () => {
  it("shows the engine's token syntax or JSON text as the list placeholder and help", () => {
    mountForeach({ items_template: '', do: { type: 'action.channel', data: { kind: 'log', message: '' } } })
    const items = wrapper.get('input[placeholder]')
    expect(items.attributes('placeholder')).toBe('{{nodes.<id>.output.items}}')
    expect(wrapper.text()).toContain('["a", "b"]')
    expect(wrapper.html()).not.toContain('{{node.&lt;id&gt;.text}}')
    expect(wrapper.text()).not.toContain('node.<id>.text')
    expect(wrapper.text()).not.toContain('comma')
  })

  it('changing the inner step type writes a fresh inner step as one change, undoable', async () => {
    const ctx = mountForeach({ items_template: '[1]', do: { type: 'action.channel', data: { kind: 'slack', message: 'x' } } })
    await wrapper.findAll('select')[0].setValue('action.http')
    expect(data(ctx).do).toEqual({ type: 'action.http', data: { method: 'GET', url: '' } })
    expect(ctx.history.past.value).toHaveLength(1)
    ctx.history.undo()
    expect(data(ctx).do).toEqual({ type: 'action.channel', data: { kind: 'slack', message: 'x' } })
  })

  it('an inner field edit replaces `do` whole, never in place', async () => {
    const inner = { kind: 'log', message: '' }
    const ctx = mountForeach({ items_template: '[1]', do: { type: 'action.channel', data: inner } })
    const msg = wrapper.findAll('textarea').at(-1)
    await msg.trigger('focus')
    msg.element.value = 'Hello {{item}}'
    await msg.trigger('input')
    await msg.trigger('blur')
    expect(data(ctx).do.data.message).toBe('Hello {{item}}')
    expect(inner.message).toBe('')
    expect(ctx.history.past.value).toHaveLength(1)
  })

  it('offers the engine’s inner steps from the registry: the five actions and the four vision steps (ADM-1351)', () => {
    mountForeach({ items_template: '[1]', do: { type: 'action.channel', data: { kind: 'log', message: '' } } })
    const types = offered().map(([v]) => v)
    expect(types.sort()).toEqual(['action.channel', 'action.http', 'action.subworkflow', 'action.tool', 'agent.run',
      'vision.crop', 'vision.draw', 'vision.filter', 'vision.model'])
    expect(offered()).toContainEqual(['vision.model', 'Find objects'])
    expect(wrapper.find('.fe-warn').exists()).toBe(false)
  })

  it('a vision inner step starts from its registry defaults and is drawn from its registry fields; an edit writes `do` whole', async () => {
    const ctx = mountForeach({ items_template: '{{nodes.crop.output.images}}', do: { type: 'action.channel', data: { kind: 'log', message: '' } } })
    await typeSelect().setValue('vision.model')
    expect(data(ctx).do).toEqual({ type: 'vision.model', data: { image: '', model: '', classes: '', threshold: null } })
    expect(ctx.history.past.value).toHaveLength(1)
    await flushPromises()
    const labels = wrapper.findAll('.sf-label').map((l) => l.text())
    expect(labels).toEqual(expect.arrayContaining(['Image', 'Model', 'What to find', 'Least confidence (optional)']))
    // The model list the workflow offers is loaded for the inner step too.
    expect(visionApi).toHaveBeenCalledWith(1)
    const model = wrapper.findAll('select').find((sel) => sel.findAll('option').some((o) => o.text() === 'SAM 3'))
    await model.setValue(model.findAll('option').find((o) => o.text() === 'SAM 3').element.value)
    expect(data(ctx).do).toEqual({ type: 'vision.model', data: { image: '', model: 'sam3', classes: '', threshold: null } })
    const image = wrapper.findAll('input').find((i) => i.attributes('placeholder') === '{{trigger.photo}}')
    await image.trigger('focus')
    image.element.value = '{{item}}'
    await image.trigger('input')
    await image.trigger('blur')
    expect(data(ctx).do).toEqual({ type: 'vision.model', data: { image: '{{item}}', model: 'sam3', classes: '', threshold: null } })
    expect(ctx.history.past.value).toHaveLength(3)
    ctx.history.undo()
    expect(data(ctx).do.data.image).toBe('')
  })

  it('in a frame workflow offers only the steps a frame can run, and marks an inner step saved before that', async () => {
    const before = [{ id: 'frame', type: 'trigger.frame', data: {} }]
    const ctx = mountForeach({ items_template: '[1]', do: { type: 'action.channel', data: { kind: 'log', message: '' } } }, { before })
    expect(offered().map(([v]) => v).sort()).toEqual(['vision.crop', 'vision.draw', 'vision.filter', 'vision.model'])
    const saved = typeSelect().find('option[disabled]')
    expect(saved.text()).toBe('Send to channel (not on a camera frame)')
    expect(typeSelect().attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('.fe-warn').text()).toBe('A stream cannot run Send to channel on a camera frame. Choose one of: Find objects, Filter objects, Crop objects, Draw objects.')
    await typeSelect().setValue('vision.crop')
    expect(data(ctx).do).toEqual({ type: 'vision.crop', data: { detections: '', padding: 0, max: 20 } })
    expect(wrapper.find('.fe-warn').exists()).toBe(false)
  })
})
