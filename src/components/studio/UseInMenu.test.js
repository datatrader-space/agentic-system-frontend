// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
const state = vi.hoisted(() => ({ video: null, push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
import UseInMenu from './UseInMenu.vue'
const image = { attachment_id: 7, title: 'Synthetic image', media_type: 'image', url: '/owned.png' }
let wrapper
beforeEach(() => { vi.clearAllMocks(); state.video = { studioMode: 'manual', refs: [], addExistingRef: vi.fn(), createIngredient: vi.fn().mockResolvedValue({ ingredient_id: 'element-1' }), request: vi.fn(), start: vi.fn() } })
afterEach(() => wrapper?.unmount())
describe('UseInMenu', () => {
  it('hands an image to Video with its opening-shot role and never starts a paid run', async () => {
    wrapper = mount(UseInMenu, { props: { item: image, conversationId: 'owned-chat' } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.findAll('[role="menuitem"][disabled]')).toHaveLength(3)
    await wrapper.get('[role="menuitem"]').trigger('click')
    expect(state.video.addExistingRef).toHaveBeenCalledWith(image, 'first_frame')
    expect(state.push).toHaveBeenCalledWith({ path: '/video-studio/video', query: { conversation: 'owned-chat', useIn: '1', mode: 'manual' } })
    expect(state.video.start).not.toHaveBeenCalled(); expect(state.video.request).not.toHaveBeenCalled()
  })
  it('requires a name and an explicit save before creating an Element', async () => {
    wrapper = mount(UseInMenu, { props: { item: image } })
    await wrapper.get('button').trigger('click')
    await wrapper.findAll('[role="menuitem"]')[1].trigger('click')
    expect(state.video.createIngredient).not.toHaveBeenCalled()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('input').setValue('Studio prop')
    await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(state.video.createIngredient).toHaveBeenCalledWith({ name: 'Studio prop', kind: 'product', description: '', attachmentIds: [7] })
    expect(state.push).toHaveBeenCalledWith({ path: '/video-studio/elements', query: {} })
  })
  it('keeps an existing opening shot instead of silently replacing it', async () => {
    state.video.refs = [{ attachment_id: 9, role: 'first_frame' }]
    wrapper = mount(UseInMenu, { props: { item: image } })
    await wrapper.get('button').trigger('click'); await wrapper.get('[role="menuitem"]').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toContain('Remove the current opening shot')
    expect(state.video.addExistingRef).not.toHaveBeenCalled(); expect(state.push).not.toHaveBeenCalled()
  })
})
