// @vitest-environment jsdom
// SchemaForm in the node window (ADM-1333): every change is a history operation, one entry per field edit;
// F5: an enum keeps its declared type, and a number's min/max are enforced with an inline error.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { resetVisionModels } from './settings/visionModels'
import { h } from 'vue'
import SchemaForm from './SchemaForm.vue'
import { wfFields } from '@/config/wfNodeDefinitions'
import { editorHarness } from './wfNodeModal.testHarness'

const apiMock = vi.hoisted(() => ({ get: vi.fn(), getMediaRoutes: vi.fn(), getWorkflowVisionModels: vi.fn() }))
vi.mock('@/services/api', () => ({ default: apiMock }))

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null; resetVisionModels(); apiMock.getWorkflowVisionModels.mockReset() })

function mountForm(node, options = {}) {
  const ctx = editorHarness({
    nodeId: node.id, nodes: [node], ...options,
    render: () => h(SchemaForm, { fields: options.fields || wfFields(node.type), derive: options.derive || null }),
  })
  wrapper = mount(ctx.Host, { attachTo: document.body })
  return ctx
}
const data = (ctx) => ctx.doc.nodes.value[0].data

describe('SchemaForm', () => {
  it('typing in one field is ONE history entry, and the node is never changed in place', async () => {
    const original = { method: 'GET', url: '' }
    const ctx = mountForm({ id: 'call', type: 'action.http', data: original })
    const url = wrapper.findAll('input').find((i) => i.attributes('placeholder') === 'https://…')
    await url.trigger('focus')
    for (const v of ['h', 'ht', 'https://a.example']) { url.element.value = v; await url.trigger('input') }
    await url.trigger('blur')
    expect(data(ctx).url).toBe('https://a.example')
    expect(original.url).toBe('')
    expect(ctx.history.past.value).toHaveLength(1)
    expect(ctx.history.past.value[0].label).toBe('Edit URL')
    expect(ctx.history.past.value[0].ops.every((op) => op.op === 'update_node' && op.id === 'call')).toBe(true)
    ctx.history.undo()
    expect(data(ctx).url).toBe('')
  })

  it('every field has a label tied to its control', () => {
    mountForm({ id: 'call', type: 'action.http', data: { method: 'GET', url: '' } })
    for (const label of wrapper.findAll('label.sf-label')) {
      expect(document.getElementById(label.attributes('for'))).not.toBeNull()
    }
  })

  it('F5: an enum saves its DECLARED value, so a number id stays a number', async () => {
    const ctx = mountForm(
      { id: 'sub', type: 'action.subworkflow', data: { graph_id: null } },
      { graphs: [{ id: 41, name: 'Billing' }, { id: 42, name: 'Reports' }], derive: (key, value) => (key === 'graph_id' ? { graph_name: value === 42 ? 'Reports' : '' } : null) },
    )
    const select = wrapper.get('select')
    await select.setValue('1')
    expect(data(ctx).graph_id).toBe(42)
    expect(typeof data(ctx).graph_id).toBe('number')
    expect(data(ctx).graph_name).toBe('Reports')
    expect(ctx.history.past.value).toHaveLength(1)
  })

  it('F5: a saved enum value the list no longer offers stays selected and is marked', () => {
    mountForm({ id: 'sub', type: 'action.subworkflow', data: { graph_id: 99 } }, { graphs: [{ id: 41, name: 'Billing' }] })
    expect(wrapper.get('select').element.value).toBe('saved')
    expect(wrapper.get('select').text()).toContain('Saved: 99 (no longer in the list)')
  })

  it('F5: a number is saved as a number; a value past max is refused with an inline error and not saved', async () => {
    const fields = [{ key: 'retries', type: 'number', min: 0, max: 60, title: 'Attempts' }]
    const ctx = mountForm({ id: 'wait', type: 'logic.delay', data: { retries: 5 } }, { fields })
    const input = wrapper.get('input[type="number"]')
    input.element.value = '30'
    await input.trigger('input')
    expect(data(ctx).retries).toBe(30)
    input.element.value = '600'
    await input.trigger('input')
    expect(data(ctx).retries).toBe(30)
    expect(wrapper.get('[role="alert"]').text()).toBe('Attempts must be 60 or less.')
    expect(input.attributes('aria-invalid')).toBe('true')
    input.element.value = '-2'
    await input.trigger('input')
    expect(wrapper.get('[role="alert"]').text()).toContain('must be 0 or more')
    expect(data(ctx).retries).toBe(30)
  })

  it('a delay has no upper bound: the engine waits a long delay durably', async () => {
    const ctx = mountForm({ id: 'wait', type: 'logic.delay', data: { seconds: 5 } })
    const input = wrapper.get('input[type="number"]')
    input.element.value = '3600'
    await input.trigger('input')
    expect(data(ctx).seconds).toBe(3600)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('A longer delay pauses the run')
  })

  it('key/value rows are added, edited and removed through history operations', async () => {
    const ctx = mountForm({ id: 'start', type: 'trigger.manual', data: {} })
    await wrapper.get('.sf-add').trigger('click')
    expect(data(ctx).inputs).toEqual([{ key: '', type: 'text', default: '' }])
    const key = wrapper.get('input[aria-label="Inputs 1: key"]')
    await key.trigger('focus')
    key.element.value = 'city'
    await key.trigger('input')
    await key.trigger('blur')
    expect(data(ctx).inputs).toEqual([{ key: 'city', type: 'text', default: '' }])
    await wrapper.get('button[aria-label="Remove Inputs 1"]').trigger('click')
    expect(data(ctx).inputs).toEqual([])
    expect(ctx.history.past.value).toHaveLength(3)
  })

  it("a manual input's type is a select (Text or Image); a row saved before it reads as Text (ADM-1351)", async () => {
    const ctx = mountForm({ id: 'start', type: 'trigger.manual', data: { inputs: [{ key: 'city', default: 'Oslo' }] } })
    const type = wrapper.get('select[aria-label="Inputs 1: type"]')
    expect(type.findAll('option').map((o) => o.text())).toEqual(['Text', 'Image'])
    expect(type.element.value).toBe('text')
    await type.setValue('image')
    expect(data(ctx).inputs).toEqual([{ key: 'city', type: 'image', default: 'Oslo' }])
    expect(ctx.history.past.value).toHaveLength(1)
  })

  it("showIf is data: a field shows while the step's field has the value (ADM-1351)", async () => {
    const ctx = mountForm({ id: 'send', type: 'action.channel', data: { kind: 'log', message: '' } })
    expect(wrapper.text()).not.toContain('Slack channel')
    ctx.history.run('kind', [{ op: 'update_node', id: 'send', data: { kind: 'slack' } }])
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Slack channel')
    expect(wrapper.text()).not.toContain('Telegram chat id')
  })

  it("Find objects offers the workflow's vision models, read once per workflow (ADM-1351)", async () => {
    apiMock.getWorkflowVisionModels.mockResolvedValue({ data: { models: [{ value: 'sam3', label: 'SAM 3', kind: 'ready' }, { value: 'p:4', label: 'Shelf model', kind: 'project' }] } })
    const ctx = mountForm({ id: 'find', type: 'vision.model', data: { image: '', model: '', classes: '', threshold: null } })
    await flushPromises()
    expect(apiMock.getWorkflowVisionModels).toHaveBeenCalledWith(1)
    const select = wrapper.findAll('select').find((s) => s.text().includes('SAM 3'))
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Select a model…', 'SAM 3', 'Shelf model'])
    await select.setValue('1')
    expect(data(ctx).model).toBe('p:4')
    wrapper.unmount()
    mountForm({ id: 'find', type: 'vision.model', data: { model: 'p:4' } })
    await flushPromises()
    expect(apiMock.getWorkflowVisionModels).toHaveBeenCalledTimes(1)
  })

  it('a model list that failed to load says why and Retry asks again; the saved model is kept', async () => {
    apiMock.getWorkflowVisionModels.mockRejectedValueOnce({ response: { status: 503, data: { error: 'Training Data is not answering.' } } })
    const ctx = mountForm({ id: 'find', type: 'vision.model', data: { image: '{{trigger.photo}}', model: 'sam3' } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Training Data is not answering.')
    expect(wrapper.text()).toContain('Saved: sam3 (no longer in the list)')
    apiMock.getWorkflowVisionModels.mockResolvedValueOnce({ data: { models: [{ value: 'sam3', label: 'SAM 3', kind: 'ready' }] } })
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(data(ctx).model).toBe('sam3')
    expect(apiMock.getWorkflowVisionModels).toHaveBeenCalledTimes(2)
  })
})
