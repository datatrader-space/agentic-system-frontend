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

// Image mode (D14): the same picker lists the image models a person may use, with their shapes in plain words.
describe('VideoModelPicker for images', () => {
  beforeEach(() => {
    video.image.models = [
      { model_id: 21, model: 'google/gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', maker: 'Google',
        shapes: ['1:1', '2:3', '3:2', '9:16', '16:9'], max_references: 4, price_per_image: 0.039, platform: true, own_key: false },
      { model_id: 22, model: 'gpt-image-1', name: 'GPT Image 1', maker: 'OpenAI', shapes: ['1:1', '2:3', '3:2'],
        max_references: 0, price_per_image: null, platform: false, own_key: true },
    ]
    video.image.defaultModelId = 21
  })

  it('shows Auto with the agent\'s image model, then each model by maker with its shapes', async () => {
    const w = mount(VideoModelPicker, { props: { kind: 'image' }, attachTo: document.body })
    expect(w.find('[data-test="video-route"]').exists()).toBe(false)
    await w.get('[data-test="image-model"]').trigger('click')
    expect(w.get('[data-test="image-model"]').text()).toContain('Auto (Gemini 2.5 Flash Image)')
    expect(w.get('[data-test="image-model-auto"]').text()).toContain("The agent's image model, Gemini 2.5 Flash Image")
    const google = w.get('[data-test="image-model-21"]').text()
    expect(google).toContain('5 shapes, including 16:9 and 9:16')
    expect(google).toContain('up to 4 reference images')
    expect(google).toContain('$0.039 an image')
    const openai = w.get('[data-test="image-model-22"]').text()
    expect(openai).toContain('from words only')
    expect(openai).toContain('Your key')
    expect(w.findAll('.vmp-group').map((g) => g.text())).toEqual(['Google', 'OpenAI'])
    w.unmount()
  })

  it('picking goes through pickImageModel', async () => {
    const pick = vi.spyOn(video, 'pickImageModel')
    const w = mount(VideoModelPicker, { props: { kind: 'image' }, attachTo: document.body })
    await w.get('[data-test="image-model"]').trigger('click')
    await w.get('[data-test="image-model-22"]').trigger('click')
    expect(pick).toHaveBeenCalledWith('22')
    expect(video.image.modelId).toBe('22')
    w.unmount()
  })
})


it('shows Auto and the resolved image model on separate lines without nesting brackets', () => {
  video.image.models = [{ model_id: 21, name: 'Nano Banana (Gemini 2.5 Flash Image)' }]
  video.image.defaultModelId = 21
  const w = mount(VideoModelPicker, { props: { kind: 'image', twoLine: true } })
  expect(w.get('.vmp-pill-primary').text()).toBe('Auto')
  const model = w.get('.vmp-pill-secondary')
  expect(model.text()).toBe('Nano Banana (Gemini 2.5 Flash Image)')
  expect(model.attributes('title')).toBe(model.text())
  expect(w.get('[data-test="image-model"]').attributes('title')).toBe(model.text())
  expect(w.text()).not.toContain('Auto (')
  w.unmount()
})
