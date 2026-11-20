// @vitest-environment jsdom
// The media model of a media.generate step (ADM-1333, F4): loading the route list never changes the saved route;
// only the person's choice does, and changing the operation clears it in the same history entry.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import SchemaForm from './SchemaForm.vue'
import { wfFields } from '../../config/wfNodeDefinitions'
import api from '../../services/api'
import { editorHarness } from './wfNodeModal.testHarness'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), getMediaRoutes: vi.fn() } }))

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null })
beforeEach(() => vi.resetAllMocks())

function mountMedia(data) {
  const ctx = editorHarness({
    nodeId: 'gen', nodes: [{ id: 'gen', type: 'media.generate', data }],
    render: () => h(SchemaForm, { fields: wfFields('media.generate') }),
  })
  wrapper = mount(ctx.Host)
  return ctx
}
const node = (ctx) => ctx.doc.nodes.value[0].data
const model = () => wrapper.get('[aria-label="Media model"]')
const options = () => model().findAll('option').map((o) => o.element.value)

describe('Canvas media model selection', () => {
  it('offers only proven routes and saves the chosen route with its own type, as one history entry', async () => {
    api.getMediaRoutes.mockResolvedValue({ data: { routes: [
      { route_id: 7, name: 'Proven image', ready: true },
      { route_id: 8, name: 'Unproven image', ready: false },
      { route_id: 9, name: 'Unspecified readiness' },
    ] } })
    const ctx = mountMedia({ operation: 'image', route_id: '' })
    await flushPromises()
    expect(api.getMediaRoutes).toHaveBeenCalledExactlyOnceWith('image')
    expect(options()).toEqual(['', '7'])
    await model().setValue('7')
    expect(node(ctx).route_id).toBe(7)
    expect(ctx.history.past.value.map((e) => e.label)).toEqual(['Edit Model'])
    expect(wfFields('media.generate').find((f) => f.key === 'operation').options).not.toContain('train')
  })

  it('F4: a failed load KEEPS the saved route, says so, and Retry loads again', async () => {
    api.getMediaRoutes.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({ data: { routes: [{ route_id: 'r', ready: true }] } })
    const ctx = mountMedia({ operation: 'image', route_id: 'old' })
    await flushPromises()
    expect(node(ctx).route_id).toBe('old')
    expect(ctx.history.past.value).toHaveLength(0)
    expect(wrapper.get('[role="alert"]').text()).toContain('Could not load the proven models')
    expect(wrapper.get('[role="alert"]').text()).toContain('saved model is kept')
    expect(model().element.value).toBe('old')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(options()).toEqual(['', 'old', 'r'])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(node(ctx).route_id).toBe('old')
  })

  it('F4: a list that does not offer the saved route keeps it selected and marked', async () => {
    api.getMediaRoutes.mockResolvedValue({ data: { routes: [{ route_id: 'other', name: 'Other', ready: true }] } })
    const ctx = mountMedia({ operation: 'image', route_id: 'saved-one' })
    await flushPromises()
    expect(node(ctx).route_id).toBe('saved-one')
    expect(model().element.value).toBe('saved-one')
    expect(model().text()).toContain('not offered right now')
    expect(wrapper.text()).toContain('It is kept')
  })

  it('changing the operation clears the route in the SAME change and ignores a late answer for the old one', async () => {
    let finishMusic
    api.getMediaRoutes.mockImplementation((operation) => (operation === 'music'
      ? new Promise((resolve) => { finishMusic = resolve })
      : Promise.resolve({ data: { routes: [{ route_id: operation, name: operation, ready: true }] } })))
    const ctx = mountMedia({ operation: 'image', route_id: 'image' })
    await flushPromises()
    const operation = wrapper.findAll('select')[0]
    const index = (op) => String(wfFields('media.generate').find((f) => f.key === 'operation').options.indexOf(op))
    await operation.setValue(index('music'))
    expect(node(ctx)).toMatchObject({ operation: 'music', route_id: '' })
    expect(ctx.history.past.value).toHaveLength(1)
    expect(ctx.history.past.value[0].ops[0].data).toEqual({ operation: 'music', route_id: '' })
    await operation.setValue(index('speech'))
    await flushPromises()
    expect(options()).toEqual(['', 'speech'])
    finishMusic({ data: { routes: [{ route_id: 'late-music', ready: true }] } })
    await flushPromises()
    expect(options()).toEqual(['', 'speech'])
  })

  it('loads video models from the proven text-to-video endpoint', async () => {
    api.get.mockResolvedValue({ data: { routes: [{ route_id: 'v', name: 'Video' }, { route_id: 'blocked', ready: false }] } })
    mountMedia({ operation: 'video', route_id: '' })
    await flushPromises()
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/video/routes/', { params: { task: 'text_to_video' } })
    expect(api.getMediaRoutes).not.toHaveBeenCalled()
    expect(options()).toEqual(['', 'v'])
  })
})
