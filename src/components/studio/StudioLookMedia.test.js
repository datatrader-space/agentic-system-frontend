// @vitest-environment jsdom
// A look shows the person's own newest result made with it, from the backend, never stock media; with none it shows
// a media-free empty state. Nothing plays by itself: a video starts only from Play, with controls and no loop.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))
import Media from './StudioLookMedia.vue'
import source from './StudioLookMedia.vue?raw'
let wrappers
const row = over => ({ attachment_id: 'a1', source: 'studio', media_type: 'video', title: 'Mine', url: '/media/a1.mp4', thumbnail_url: '/media/a1.jpg', studio_preset: 'video-look-1', ...over })
const answer = presets => api.get.mockResolvedValue({ data: { presets } })
const open = (look, controls = false) => { const w = mount(Media, { props: { look, controls } }); wrappers.push(w); return w }
beforeEach(() => {
  wrappers = []; api.get.mockReset()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => { wrappers.forEach(w => w.unmount()); vi.restoreAllMocks() })

it("asks once for every look shown together, and shows each look's own newest result", async () => {
  answer({ 'video-look-1': { count: 3, latest: row() }, 'image-look-1': { count: 0, latest: null } })
  const video = open({ id: 'video-look-1', title: 'Video look', previewUrl: '/studio/looks/video-1.mp4', poster: '/studio/looks/perfume.jpg' })
  const empty = open({ id: 'image-look-1', title: 'Image look' })
  await flushPromises()
  expect(api.get).toHaveBeenCalledTimes(1)
  expect(api.get).toHaveBeenCalledWith('/video/library/presets/', { params: { ids: 'video-look-1,image-look-1' } })
  expect(video.get('img').attributes('src')).toBe('/media/a1.jpg')
  expect(video.text()).toContain('Your latest result · 3 made')
  expect(video.html()).not.toContain('/studio/looks/')
  expect(empty.find('img').exists()).toBe(false); expect(empty.find('video').exists()).toBe(false)
  expect(empty.text()).toContain('Your results with this look appear here')
})

it('never autoplays or loops: a video plays only from its Play button, with controls', async () => {
  answer({ 'video-look-1': { count: 1, latest: row() } })
  const card = open({ id: 'video-look-1', title: 'Video look' })
  const preview = open({ id: 'video-look-1', title: 'Video look' }, true)
  await flushPromises()
  expect(card.find('video').exists()).toBe(false); expect(card.find('button').exists()).toBe(false)
  expect(preview.find('video').exists()).toBe(false)
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  await preview.get('.slm-control').trigger('click'); await flushPromises()
  const player = preview.get('video')
  expect(player.attributes('src')).toBe('/media/a1.mp4')
  expect(player.attributes('controls')).toBeDefined()
  expect(player.attributes('loop')).toBeUndefined(); expect(player.attributes('autoplay')).toBeUndefined()
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  expect(source).not.toMatch(/\s(autoplay|loop)[\s>=/]|IntersectionObserver/)
})

it('keeps unsafe media addresses out and says so honestly when loading fails', async () => {
  answer({ 'image-look-1': { count: 1, latest: row({ media_type: 'image', url: 'javascript:alert(1)', thumbnail_url: 'javascript:alert(1)' }) } })
  const unsafe = open({ id: 'image-look-1', title: 'Image look' })
  await flushPromises()
  expect(unsafe.find('img').exists()).toBe(false)
  api.get.mockRejectedValue(new Error('offline'))
  const failed = open({ id: 'image-look-2', title: 'Other look' })
  await flushPromises()
  expect(failed.text()).toContain('Your results could not be loaded.')
  expect(failed.find('img').exists()).toBe(false)
})

it('shows an image result from its own address when there is no thumbnail', async () => {
  answer({ 'image-look-3': { count: 1, latest: row({ media_type: 'image', url: '/media/b.png', thumbnail_url: '' }) } })
  const w = open({ id: 'image-look-3', title: 'Image look' }, true)
  await flushPromises()
  expect(w.get('img').attributes('src')).toBe('/media/b.png')
  expect(w.get('img').attributes('alt')).toBe('Your latest result with Image look')
})

it('asks nothing for an id the backend would not keep', async () => {
  const w = open({ id: 'Not A Look!', title: 'Bad' })
  await flushPromises()
  expect(api.get).not.toHaveBeenCalled()
  expect(w.text()).toContain('Your results with this look appear here')
})
