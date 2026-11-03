// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import Discover from './VideoStudioDiscover.vue'
import api from '../services/api'
vi.mock('../services/api', () => ({ default: { post: vi.fn(), getStudioFeatures: vi.fn() } }))
let wrapper
beforeEach(() => setActivePinia(createPinia()))
afterEach(() => wrapper?.unmount())
async function open() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/video-studio/:rest(.*)*', component: { template: '<div />' } }] })
  await router.push('/video-studio')
  wrapper = mount(Discover, { global: { plugins: [router], stubs: { StudioLookMedia: true } } })
  await flushPromises()
  return router
}
describe('Discover is the goal-first Studio landing', () => {
  it('offers each of the 26 existing tools exactly once, without a Start from scratch detour', async () => {
    await open()
    const links = wrapper.findAll('[data-test^="discover-tool-"]')
    expect(links).toHaveLength(26)
    expect(new Set(links.map(link => link.attributes('data-test'))).size).toBe(26)
    expect(links.find(link => link.attributes('data-test') === 'discover-tool-video').attributes('href')).toContain('mode=agent')
    expect(wrapper.text()).not.toContain('Start from scratch')
    expect(api.post).not.toHaveBeenCalled()
  })
  it('filters ready-made looks and links directly to an editable tool preset without requesting media', async () => {
    await open()
    await wrapper.findAll('.discover-views button')[1].trigger('click')
    expect(wrapper.findAll('[data-test^="discover-look-"]')).toHaveLength(69)
    await wrapper.get('input[type="search"]').setValue('Softbox product portrait')
    expect(wrapper.findAll('[data-test^="discover-look-"]')).toHaveLength(1)
    expect(wrapper.get('[data-test="discover-look-image-look-1"]').attributes('href')).toContain('/video-studio/image?preset=image-look-1&mode=agent')
    expect(api.post).not.toHaveBeenCalled()
  })
  it('preserves a legacy conversation bookmark by opening the existing Dashboard session path', async () => {
    const router = await open()
    await router.replace('/video-studio?conversation=owned-fixture')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/video-studio/dashboard')
    expect(router.currentRoute.value.query.conversation).toBe('owned-fixture')
    expect(api.post).not.toHaveBeenCalled()
  })
  it('opens the same creative tool in the chosen Manual mode without submitting anything', async () => {
    await open()
    await wrapper.get('[data-test="studio-mode-manual"]').trigger('click')
    expect(wrapper.get('[data-test="discover-tool-video"]').attributes('href')).toContain('mode=manual')
    expect(wrapper.get('[data-test="discover-tool-video"]').text()).toContain('Open in Manual')
    expect(api.post).not.toHaveBeenCalled()
  })
})
