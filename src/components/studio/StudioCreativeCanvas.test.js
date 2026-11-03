// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))
import api from '../../services/api'
import StudioCreativeCanvas from './StudioCreativeCanvas.vue'
import canvasSource from './StudioCreativeCanvas.vue?raw'
const stubs = { MediaViewer: { name: 'MediaViewer', props: ['items', 'index'], emits: ['close'], template: '<div data-test="viewer" />' } }
beforeEach(() => vi.clearAllMocks())
describe('Creative canvas', () => {
  it('shows the person’s own newest result and opens it in the app viewer, never a native dialog', async () => {
    api.get.mockResolvedValue({ data: { items: [{ attachment_id: 'a1', media_type: 'image', title: 'beach.png', url: '/media/a1.png', thumbnail_url: '/media/a1-small.png' }] } })
    const w = mount(StudioCreativeCanvas, { global: { stubs } }); await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/video/library/', { params: { source: 'generated', type: 'all', page: 1, limit: 1 } })
    expect(w.get('[data-test="creative-canvas-picture"]').attributes('src')).toBe('/media/a1-small.png')
    expect(w.find('dialog').exists()).toBe(false)
    expect(w.html()).not.toContain('/studio/looks/')
    await w.get('[data-test="creative-canvas-preview"]').trigger('click')
    expect(w.getComponent({ name: 'MediaViewer' }).props('items')[0]).toMatchObject({ attachment_id: 'a1', url: '/media/a1.png' })
    await w.getComponent({ name: 'MediaViewer' }).vm.$emit('close')
    expect(w.find('[data-test="viewer"]').exists()).toBe(false); w.unmount()
  })
  it('with nothing made yet it is a media-free empty state', async () => {
    api.get.mockResolvedValue({ data: { items: [] } })
    const w = mount(StudioCreativeCanvas, { global: { stubs } }); await flushPromises()
    expect(w.find('[data-test="creative-canvas-empty"]').exists()).toBe(true)
    expect(w.find('img').exists()).toBe(false); expect(w.find('[data-test="creative-canvas-preview"]').exists()).toBe(false); w.unmount()
  })
  it('an unsafe address or a failed read shows no media', async () => {
    api.get.mockResolvedValue({ data: { items: [{ attachment_id: 'a1', media_type: 'image', title: 'x', url: 'javascript:alert(1)' }] } })
    let w = mount(StudioCreativeCanvas, { global: { stubs } }); await flushPromises()
    expect(w.find('img').exists()).toBe(false); w.unmount()
    api.get.mockRejectedValue(new Error('down'))
    w = mount(StudioCreativeCanvas, { global: { stubs } }); await flushPromises()
    expect(w.get('[data-test="creative-canvas-empty"]').text()).toContain('could not be loaded'); w.unmount()
  })
  it('has no pan or zoom animation', () => {
    expect(canvasSource).not.toMatch(/@keyframes|transform\s*:|animation\s*:/)
  })
})
