// @vitest-environment jsdom
// SchemaForm in the node window (ADM-1333): every change is a history operation, one entry per field edit;
// F5: an enum keeps its declared type, and a number's min/max are enforced with an inline error.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import SchemaForm from './SchemaForm.vue'
import { wfFields } from '@/config/wfNodeDefinitions'
import { editorHarness } from './wfNodeModal.testHarness'

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), getMediaRoutes: vi.fn() } }))

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null })

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
    expect(data(ctx).inputs).toEqual([{ key: '', default: '' }])
    const key = wrapper.get('input[aria-label="Inputs 1: key"]')
    await key.trigger('focus')
    key.element.value = 'city'
    await key.trigger('input')
    await key.trigger('blur')
    expect(data(ctx).inputs).toEqual([{ key: 'city', default: '' }])
    await wrapper.get('button[aria-label="Remove Inputs 1"]').trigger('click')
    expect(data(ctx).inputs).toEqual([])
    expect(ctx.history.past.value).toHaveLength(3)
  })
})
