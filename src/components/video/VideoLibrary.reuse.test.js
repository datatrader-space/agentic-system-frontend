// @vitest-environment jsdom
// "Use again" and "Edit" on a Library file: the prompt and settings that made it go back into the composer, or the
// file becomes an edit's base. Neither runs, prices or spends anything by itself.
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => ({ conversationId: 'c1', ensureConversation: vi.fn() }) }))

import api from '../../services/api'
import VideoLibrary from './VideoLibrary.vue'
import { useVideoStore } from '../../stores/useVideoStore'

const generation = { job_id: 'j9', operation: 'image', modality: 'image', route_id: null, model: 'img-model', model_name: 'Img',
  prompt: 'A brass lamp on a desk', settings: { aspect_ratio: '4:3', n: 2 }, references: [], base_attachment_id: null, created_at: '2026-11-01T10:00:00Z' }
const ITEMS = [
  { attachment_id: 'gen-1', source: 'generated', media_type: 'image', title: 'lamp', url: '/lamp.png', thumbnail_url: '/api/library/gen-1/thumbnail/', created_at: '2026-11-01T10:00:00Z', ingredients: [], generation },
  { attachment_id: 'up-1', source: 'uploaded', media_type: 'video', title: 'clip', url: '/clip.mp4', thumbnail_url: '/api/library/up-1/thumbnail/', created_at: '2026-11-01T09:00:00Z', ingredients: [], generation: null },
]
const flush = () => new Promise((r) => setTimeout(r, 0))
let video
beforeEach(() => {
  setActivePinia(createPinia()); vi.clearAllMocks()
  video = useVideoStore()
  video.image.models = [{ model_id: 'img-model', name: 'Img', shapes: ['1:1', '4:3'] }]
  api.get.mockImplementation((url) => Promise.resolve({ data: url === '/video/library/' ? { items: ITEMS, page: 1, has_more: false } : { ingredients: [], projects: [] } }))
})

it('shows each file by its server thumbnail, and Use again only on a generated one', async () => {
  const w = mount(VideoLibrary, { props: { mode: 'page' }, global: { stubs: { RouterLink: true } } })
  await flush()
  expect(w.findAll('[data-test="lib-thumbnail"]').map((i) => i.attributes('src'))).toEqual(['/api/library/gen-1/thumbnail/', '/api/library/up-1/thumbnail/'])
  expect(w.findAll('[data-test="lib-use-again"]')).toHaveLength(1)
  expect(w.findAll('[data-test="lib-edit"]')).toHaveLength(2)
  w.unmount()
})

it('Use again puts the prompt and settings back and opens the composer, without any request', async () => {
  const heard = []
  const onCompose = (e) => heard.push(e.detail.text)
  window.addEventListener('video-compose', onCompose)
  const w = mount(VideoLibrary, { props: { mode: 'page' }, global: { stubs: { RouterLink: true } } })
  await flush()
  await w.get('[data-test="lib-use-again"]').trigger('click')
  window.removeEventListener('video-compose', onCompose)
  expect(video.studioDraft).toBe('A brass lamp on a desk')
  expect(video.kind).toBe('image')
  expect(video.image).toMatchObject({ modelId: 'img-model', aspect_ratio: '4:3', n: 2 })
  expect(heard).toEqual(['A brass lamp on a desk'])
  expect(push).toHaveBeenCalledWith({ name: 'video-studio-dashboard' })
  expect(api.post).not.toHaveBeenCalled()
  w.unmount()
})

it('Edit opens the edit flow with this file as the base', async () => {
  const w = mount(VideoLibrary, { props: { mode: 'page' }, global: { stubs: { RouterLink: true } } })
  await flush()
  const [image, clip] = w.findAll('[data-test="lib-edit"]')
  await image.trigger('click')
  expect(push).toHaveBeenLastCalledWith({ path: '/video-studio/edit', query: { useIn: '1', mode: video.studioMode } })
  expect(video.refs).toHaveLength(1)
  expect(video.refs[0]).toMatchObject({ attachment_id: 'gen-1', role: 'edit_source', base_attachment_id: 'gen-1' })
  await clip.trigger('click')
  expect(push).toHaveBeenLastCalledWith({ path: '/video-studio/enhance', query: { useIn: '1', mode: video.studioMode } })
  expect(video.refs.map((r) => [r.attachment_id, r.role])).toEqual([['up-1', 'edit_source']])
  expect(api.post).not.toHaveBeenCalled()
  w.unmount()
})

it('puts Select on the picture and keeps the buttons in one row at the bottom of each card', async () => {
  const w = mount(VideoLibrary, { props: { mode: 'page' }, global: { stubs: { RouterLink: true } } })
  await flush()
  const card = w.findAll('[data-test="lib-item"]')[0]
  const pick = card.get('.lib-pick')
  expect(pick.element.parentElement).toBe(card.element)
  expect(card.get('.lib-actions').find('.lib-pick').exists()).toBe(false)
  await pick.get('input').setValue(true)
  expect(card.classes()).toContain('picked')
  w.unmount()
})
