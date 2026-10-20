// @vitest-environment jsdom
// Video Studio help: every section is there, "which model for which video" is computed from the models the person
// can use now (so it never goes stale), and Try it opens a fresh Create screen ready to go without sending anything.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), getVideoStudioAgent: vi.fn() }))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import VideoStudioHelp from './VideoStudioHelp.vue'
import { useVideoStore } from '../stores/useVideoStore'

const ROUTES = [
  { route_id: 1, name: 'Google: Veo 3.1 Fast', state: 'active', connections: [{ route_id: 1, connection: 'AADML' }],
    offered: ['text_to_video', 'image_to_video', 'first_last_frame'], outputs: { durations: [4, 6, 8], resolutions: ['720p', '4K'], aspect_ratios: ['16:9', '9:16'], audio: true } },
  { route_id: 2, name: 'Alibaba: Wan 3.0', state: 'active', connections: [{ route_id: 2, connection: 'my openrouter' }],
    offered: ['text_to_video', 'image_to_video'], outputs: { durations: [2, 30], resolutions: ['1080p'], aspect_ratios: ['16:9'], audio: false } },
  { route_id: 3, name: 'Runway: Aleph 2.0', state: 'active', connections: [{ route_id: 3, connection: 'AADML' }], offered: [], outputs: {} },
]
const stubs = { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

let video
beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  video = useVideoStore()
  video.routes = ROUTES
  video.defaultRouteId = 1
})

describe('VideoStudioHelp', () => {
  it('covers what you can make, the process, models, recipes, library, prompts, costs and trouble', async () => {
    const w = mount(VideoStudioHelp, { global: { stubs } })
    for (const id of ['kinds', 'process', 'models', 'recipes', 'library', 'prompts', 'costs', 'trouble']) {
      expect(w.find('#' + id).exists()).toBe(true)
    }
    expect(w.findAll('.toc-link')).toHaveLength(8)
    expect(w.findAll('.strip-step')).toHaveLength(6)
    expect(w.text()).toContain('An estimate is valid for 15 minutes')
    expect(w.text()).not.toMatch(/[→·]/)
  })

  it('lists the models that fit each goal from the person\'s own list, with the reason, and says when none does', async () => {
    const w = mount(VideoStudioHelp, { global: { stubs } })
    expect(w.text()).toContain('Auto uses Google Veo 3.1 Fast')
    expect(w.get('[data-test="help-goal-photo"]').text()).toContain('Veo 3.1 Fast')
    expect(w.get('[data-test="help-goal-photo"]').text()).toContain('Wan 3.0')
    expect(w.get('[data-test="help-goal-frames"]').text()).not.toContain('Wan 3.0')
    expect(w.get('[data-test="help-goal-long"]').text()).toContain('Wan 3.0, up to 30 s')
    expect(w.get('[data-test="help-goal-sharp"]').text()).toMatch(/Veo 3\.1 Fast, up to 4K[\s\S]*Wan 3\.0, up to 1080p/)
    expect(w.get('[data-test="help-goal-draft"]').text()).toContain('Veo 3.1 Fast')
    expect(w.get('[data-test="help-goal-long"]').text()).toContain('Your key')
    expect(w.get('[data-test="help-goal-edit"]').text()).toContain('None of your models does this yet.')
    expect(w.text()).not.toContain('Aleph 2.0')                          // offers nothing yet: never suggested
  })

  it('lists the models that do the most first, and shows the rest on request', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ route_id: 10 + i, name: `Maker: Plain ${i}`, state: 'active',
      connections: [{ route_id: 10 + i, connection: 'AADML' }], offered: ['text_to_video', 'image_to_video'], outputs: { durations: [5] } }))
    video.routes = [...many, ROUTES[0]]
    const w = mount(VideoStudioHelp, { global: { stubs } })
    const photo = w.get('[data-test="help-goal-photo"]')
    expect(photo.findAll('.chip').at(0).text()).toContain('Google Veo 3.1 Fast')   // frames, sound, 4K: first
    expect(photo.findAll('li.chip')).toHaveLength(6)
    await photo.get('[data-test="help-more-photo"]').trigger('click')
    expect(photo.findAll('li.chip')).toHaveLength(9)
    expect(photo.get('[data-test="help-more-photo"]').text()).toBe('Show fewer')
  })

  it('Try it fills Create with the task and the example prompt, on a fresh session, and sends nothing', async () => {
    const w = mount(VideoStudioHelp, { global: { stubs } })
    await w.get('[data-test="help-try-ad"]').trigger('click')
    expect(video.task).toBe('story')
    expect(video.studioDraft).toContain('30-second ad')
    expect(push).toHaveBeenCalledWith({ name: 'video-studio', query: { new: '1' } })
    expect(api.post).not.toHaveBeenCalled()
  })

  it('loads the models through the Video Studio agent when none are loaded yet', async () => {
    video.routes = []
    api.getVideoStudioAgent.mockResolvedValue({ data: { id: 900 } })
    api.get.mockResolvedValue({ data: { routes: ROUTES, default_route_id: 2 } })
    const w = mount(VideoStudioHelp, { global: { stubs } })
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/video/capabilities/', { params: { agent_id: 900 } })
    expect(w.text()).toContain('Auto uses Alibaba Wan 3.0')
  })
})
