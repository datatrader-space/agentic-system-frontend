// @vitest-environment jsdom
// The Library drawer (VIDEO_STUDIO_AGENT_FLOW_PLAN.md D4): every chat's files, used in this video with a role,
// and saved as named ingredients.
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('../../stores/useChatStore', () => ({
  useChatStore: () => ({ conversationId: 'c1', ensureConversation: vi.fn(() => Promise.resolve('c1')) }),
}))

import api from '../../services/api'
import VideoLibrary from './VideoLibrary.vue'
import { useVideoStore } from '../../stores/useVideoStore'

const ITEMS = [
  { attachment_id: 'img-1', source: 'uploaded', media_type: 'image', title: 'sneaker.png', url: '/s.png', created_at: '2026-10-19T10:00:00Z', ingredients: [] },
  { attachment_id: 'vid-1', source: 'generated', media_type: 'video', title: 'boat', url: '/b.mp4', created_at: '2026-10-18T10:00:00Z', ingredients: ['Boat'] },
]
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('VideoLibrary', () => {
  let video
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    video = useVideoStore()
    video.project = { project_id: 'p1', scenes: [] }
    video.libraryOpen = true
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/video/library/'
      ? { items: ITEMS, page: 1, has_more: false } : { ingredients: [] } }))
  })

  it('lists files from every chat and uses one with a role', async () => {
    const w = mount(VideoLibrary, { attachTo: document.body })
    await flush()
    const dialog = document.querySelector('[data-test="video-library"]')
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(document.querySelectorAll('[data-test="lib-item"]').length).toBe(2)
    expect(dialog.textContent).toContain('Boat')                          // ingredient membership is shown
    api.post.mockResolvedValueOnce({ data: { project_id: 'p1', scenes: [], assets: [] } })
    document.querySelector('[data-test="lib-use"]').click()
    await flush()
    const role = document.querySelector('[data-test="lib-role"]')
    role.value = 'style'
    role.dispatchEvent(new Event('change'))
    document.querySelector('[data-test="lib-use-confirm"]').click()
    await flush()
    expect(api.post).toHaveBeenCalledWith('/video/projects/p1/assets/', { attachment_id: 'img-1', role: 'style', source: 'library' })
    expect(video.refs[0]).toMatchObject({ attachment_id: 'img-1', role: 'style' })
    w.unmount()
  })

  it('saves selected files as a named ingredient', async () => {
    const w = mount(VideoLibrary, { attachTo: document.body })
    await flush()
    document.querySelector('[aria-label="Select sneaker.png"]').click()
    await flush()
    const name = document.querySelector('[data-test="lib-ing-name"]')
    name.value = 'Red sneaker'
    name.dispatchEvent(new Event('input'))
    await flush()
    api.post.mockResolvedValueOnce({ data: { ingredient_id: 'i1', name: 'Red sneaker', kind: 'product', role: 'subject', files: [] } })
    document.querySelector('[data-test="lib-save-ingredient"]').dispatchEvent(new Event('submit'))
    await flush()
    expect(api.post).toHaveBeenCalledWith('/video/ingredients/', { kind: 'product', name: 'Red sneaker', description: '', attachment_ids: ['img-1'] })
    expect(document.querySelector('[data-test="lib-tab-ingredients"]').getAttribute('aria-selected')).toBe('true')
    w.unmount()
  })

  it('closes on Escape', async () => {
    const w = mount(VideoLibrary, { attachTo: document.body })
    await flush()
    document.querySelector('[data-test="video-library"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(video.libraryOpen).toBe(false)
    w.unmount()
  })
})
