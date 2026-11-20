// @vitest-environment jsdom
// F6 (ADM-1333): the for-each step shows the engine's syntax ({{nodes.<id>.output.items}}) or JSON text, never the
// legacy {{node.<id>.text}}; its inner step is written whole through the history.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import ForeachSettings from './ForeachSettings.vue'
import { editorHarness } from '../wfNodeModal.testHarness'

vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }))

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null })

function mountForeach(data) {
  const ctx = editorHarness({ nodeId: 'loop', nodes: [{ id: 'loop', type: 'logic.foreach', data }], render: () => h(ForeachSettings) })
  wrapper = mount(ctx.Host, { attachTo: document.body })
  return ctx
}
const data = (ctx) => ctx.doc.nodes.value[0].data

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
})
