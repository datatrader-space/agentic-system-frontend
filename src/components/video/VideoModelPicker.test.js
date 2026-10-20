// @vitest-environment jsdom
// The video model picker (owner, 2026-10-19): grouped by maker, each model described in plain words, searchable;
// picking goes through pickRoute (so a switch that changes settings is shown first).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import VideoModelPicker from './VideoModelPicker.vue'
import { useVideoStore } from '../../stores/useVideoStore'

const AADML = [{ route_id: 0, connection: 'AADML' }]
const routes = [
  { route_id: 1, name: 'Google: Veo 3.1', creator: 'google', state: 'active', connections: [{ ...AADML[0], route_id: 1 }],
    offered: ['text_to_video', 'image_to_video', 'first_last_frame'], outputs: { durations: [4, 6, 8], resolutions: ['720p', '4K', '1080p'], audio: true } },
  { route_id: 2, name: 'Kling: Video v3.0 Pro', creator: 'kwaivgi', state: 'active', connections: [{ route_id: 2, connection: 'my openrouter' }],
    offered: ['text_to_video', 'image_to_video'], outputs: { durations: [3, 15], resolutions: ['720p'], audio: false } },
  { route_id: 3, name: 'Runway: Aleph 2.0', creator: 'runway', state: 'active', connections: [{ ...AADML[0], route_id: 3 }], offered: [], outputs: {} },
]

let video
beforeEach(() => {
  setActivePinia(createPinia())
  video = useVideoStore()
  video.routes = routes
  video.defaultRouteId = 1
})

const opened = async () => {
  const w = mount(VideoModelPicker, { attachTo: document.body })
  await w.get('[data-test="video-route"]').trigger('click')
  return w
}

describe('VideoModelPicker', () => {
  it('shows Auto with the agent\'s model, then every model grouped by maker in plain words', async () => {
    const w = await opened()
    expect(w.get('[data-test="video-route"]').text()).toContain('Auto (Veo 3.1)')
    expect(w.findAll('.vmp-group').map((g) => g.text())).toEqual(['Google', 'Kling', 'Runway'])
    expect(w.get('[data-test="video-model-1"]').text()).toContain('From text or an image, opening and closing shots, 4–8 s, up to 4K, sound')
    expect(w.get('[data-test="video-model-2"]').text()).toContain('Your key')
    expect(w.get('[data-test="video-model-1"]').text()).not.toContain('Your key')
    w.unmount()
  })

  it('names the default even when it is a second connection of a model (the person\'s own key)', async () => {
    video.routes = [{ ...routes[1], connections: [{ route_id: 2, connection: 'AADML' }, { route_id: 152, connection: 'my openrouter' }] }]
    video.defaultRouteId = 152
    const w = await opened()
    expect(w.get('[data-test="video-route"]').text()).toContain('Auto (Video v3.0 Pro)')
    expect(w.get('[data-test="video-model-auto"]').text()).toContain('The agent picks Video v3.0 Pro')
    w.unmount()
  })

  it('a model that offers nothing yet is shown, but cannot be picked', async () => {
    const w = await opened()
    const pick = vi.spyOn(video, 'pickRoute')
    const aleph = w.get('[data-test="video-model-3"]')
    expect(aleph.attributes('aria-disabled')).toBe('true')
    expect(aleph.text()).toContain('Not available for new videos yet')
    await aleph.trigger('click')
    expect(pick).not.toHaveBeenCalled()
    w.unmount()
  })

  it('picking a model goes through pickRoute and closes the panel', async () => {
    const w = await opened()
    const pick = vi.spyOn(video, 'pickRoute')
    await w.get('[data-test="video-model-2"]').trigger('click')
    expect(pick).toHaveBeenCalledWith('2')
    expect(w.find('[data-test="video-model-panel"]').exists()).toBe(false)
    w.unmount()
  })

  it('search narrows the list; Escape closes it', async () => {
    const w = await opened()
    await w.get('.vmp-search input').setValue('kling')
    expect(w.findAll('.vmp-opt').map((o) => o.attributes('data-test'))).toEqual(['video-model-2'])
    await w.get('.vmp-search input').setValue('nothing like this')
    expect(w.text()).toContain('No model matches')
    await w.get('.vmp').trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-test="video-model-panel"]').exists()).toBe(false)
    w.unmount()
  })
})
