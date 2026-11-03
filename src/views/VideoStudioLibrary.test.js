// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
const state = vi.hoisted(() => ({ route: null, replace: null }))
vi.mock('vue-router', () => ({ useRoute: () => state.route, useRouter: () => ({ replace: state.replace }) }))
import VideoStudioLibrary from './VideoStudioLibrary.vue'
const stubs = { VideoLibrary: { name: 'VideoLibrary', props: ['initialTab','mode','preset'], emits: ['clear-preset'], template: '<div>Elements</div>' } }
beforeEach(() => { state.replace = vi.fn(); state.route = { path: '/video-studio/elements', meta: { libraryTab: 'ingredients' }, query: {} } })
describe('Elements page', () => {
  it('uses the existing Ingredients view in page mode', () => {
    const w = mount(VideoStudioLibrary, { global: { stubs } })
    expect(w.findComponent({ name: 'VideoLibrary' }).props()).toMatchObject({ initialTab: 'ingredients', mode: 'page', preset: '' }); w.unmount()
  })
})
describe('Library filtered by a look', () => {
  it('passes ?preset= to the Library, and clearing it drops it from the address', async () => {
    state.route = { path: '/video-studio/library', meta: { libraryTab: 'files' }, query: { preset: 'neon-noir', mode: 'agent' } }
    const w = mount(VideoStudioLibrary, { global: { stubs } })
    const lib = w.findComponent({ name: 'VideoLibrary' })
    expect(lib.props('preset')).toBe('neon-noir')
    await lib.vm.$emit('clear-preset')
    expect(state.replace).toHaveBeenCalledWith({ path: '/video-studio/library', query: { preset: undefined, mode: 'agent' } }); w.unmount()
  })
  it('never passes an id the backend would refuse', () => {
    state.route = { path: '/video-studio/library', meta: { libraryTab: 'files' }, query: { preset: '<script>' } }
    const w = mount(VideoStudioLibrary, { global: { stubs } })
    expect(w.findComponent({ name: 'VideoLibrary' }).props('preset')).toBe(''); w.unmount()
  })
})
