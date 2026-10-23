// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/video-studio/elements', meta: { libraryTab: 'ingredients' } }) }))
import VideoStudioLibrary from './VideoStudioLibrary.vue'
describe('Elements page', () => {
  it('uses the existing Ingredients view in page mode', () => {
    const w = mount(VideoStudioLibrary, { global: { stubs: { VideoLibrary: { name: 'VideoLibrary', props: ['initialTab','mode'], template: '<div>Elements</div>' } } } })
    expect(w.findComponent({ name: 'VideoLibrary' }).props()).toMatchObject({ initialTab: 'ingredients', mode: 'page' }); w.unmount()
  })
})
