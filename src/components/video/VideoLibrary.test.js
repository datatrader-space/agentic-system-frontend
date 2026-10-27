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

  it('cleans the Library and viewer From chat names', async () => {
    api.get.mockResolvedValue({data:{items:[{...ITEMS[0],conversation_id:9,conversation_name:'I am on the Image page. My chosen preset is Quiet tabletop.'}],ingredients:[]}})
    const w=mount(VideoLibrary,{props:{mode:'page'},attachTo:document.body,global:{stubs:{RouterLink:{props:['to'],template:'<a><slot /></a>'}}}})
    await flush()
    expect(document.querySelector('[data-test="lib-chat"]').textContent).toBe('From Image chat '+String.fromCharCode(183)+' Quiet tabletop')
    // Open the original file through the existing preview control.
    document.querySelector('[data-test="lib-preview"]').click()
    await flush()
    expect(document.querySelector('[data-test="media-viewer-chat"]').textContent).toBe('Image chat '+String.fromCharCode(183)+' Quiet tabletop')
    w.unmount()
  })

  it('the picker names an audio file "Audio", never "Image"', async () => {
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/video/library/'
      ? { items: [{ attachment_id: 'aud-1', source: 'generated', media_type: 'audio', title: 'a door creaking', url: '/d.mp3',
                    created_at: '2026-10-27T10:00:00Z', ingredients: [] }], page: 1, has_more: false } : { ingredients: [] } }))
    const w = mount(VideoLibrary, { attachTo: document.body })
    await flush()
    expect(document.querySelector('[data-test="lib-item"] .lib-thumb').textContent).toBe('Audio')
    w.unmount()
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
    document.querySelector('[data-test="lib-role"]').click()
    await flush()
    Array.from(document.querySelectorAll('[data-test="lib-role-panel"] .vch-opt')).find((o) => o.textContent.includes('Style')).click()
    await flush()
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

  it('lists documents to open, never to use in a video', async () => {
    api.get.mockImplementation((url) => Promise.resolve(url === '/video/library/'
      ? { data: { items: [...ITEMS, { attachment_id: 'doc-1', source: 'uploaded', media_type: 'document', title: 'ad script.pdf',
          url: '/files/script.pdf', ext: 'pdf', size_bytes: 2202009, created_at: '2026-10-17T10:00:00Z', ingredients: [] }], has_more: false } }
      : url === '/video/projects/' ? { data: { projects: [] } } : { data: { ingredients: [] } }))
    const w = mount(VideoLibrary, { attachTo: document.body })
    await flush()
    const cards = Array.from(document.querySelectorAll('[data-test="lib-item"]'))
    const doc = cards.find((c) => c.textContent.includes('ad script.pdf'))
    expect(doc.textContent).toContain('PDF')
    expect(doc.textContent).toContain('2.1 MB')
    expect(doc.querySelector('[data-test="lib-open"]').getAttribute('href')).toBe('/files/script.pdf')
    expect(doc.querySelector('[data-test="lib-open"]').getAttribute('rel')).toContain('noopener')
    expect(doc.querySelector('[data-test="lib-use"]')).toBeNull()
    expect(doc.querySelector('input[type="checkbox"]')).toBeNull()
    expect(Array.from(document.querySelectorAll('.lib-chip')).map((b) => b.textContent.trim())).toContain('Documents')
    w.unmount()
  })

  it('filters by project when the person has projects', async () => {
    api.get.mockImplementation((url) => Promise.resolve(url === '/video/projects/'
      ? { data: { projects: [{ project_id: 'p9', title: 'Boat ad' }] } }
      : url === '/video/library/' ? { data: { items: ITEMS, has_more: false } } : { data: { ingredients: [] } }))
    const w = mount(VideoLibrary, { attachTo: document.body })
    await flush()
    document.querySelector('[data-test="lib-project"]').click()
    await flush()
    Array.from(document.querySelectorAll('[data-test="lib-project-panel"] .vch-opt')).find((o) => o.textContent.includes('Boat ad')).click()
    await flush()
    expect(api.get).toHaveBeenCalledWith('/video/library/', { params: expect.objectContaining({ project_id: 'p9' }) })
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

// Owner, 2026-10-20: a file can be previewed (image whole, video and sound played), and each card says which chat it
// came from and opens it (a Studio chat in the Studio, any other in the main chat).
describe('VideoLibrary preview and source chat', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    const video = useVideoStore()
    video.libraryOpen = true
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/video/library/'
      ? { items: [
        { ...ITEMS[0], conversation_id: 2874, conversation_name: 'Candle reel', conversation_in_studio: true },
        { ...ITEMS[1], conversation_id: 15, conversation_name: 'Old chat', conversation_in_studio: false },
        { attachment_id: 'doc-1', source: 'uploaded', media_type: 'document', title: 'notes.txt', url: '/n.txt', ext: 'txt' },
      ], page: 1, has_more: false } : { ingredients: [] } }))
  })
  const stubs = { global: { stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } } }

  it('opens the chat a file came from: the Studio for a Studio chat, the main chat otherwise', async () => {
    const w = mount(VideoLibrary, { attachTo: document.body, ...stubs })
    await flush()
    const links = Array.from(document.querySelectorAll('[data-test="lib-chat"]'))
    expect(links.map((a) => a.textContent.trim())).toEqual(['From Candle reel', 'From Old chat'])
    expect(JSON.parse(links[0].dataset.to)).toEqual({ path: '/video-studio', query: { conversation: '2874' } })
    expect(JSON.parse(links[1].dataset.to)).toBe('/dashboard/chat/15')
    links[0].click()                                    // following it leaves the Library
    expect(useVideoStore().libraryOpen).toBe(false)
    w.unmount()
  })

  it('previews an image and plays a video, moving between them; a document has no preview', async () => {
    const w = mount(VideoLibrary, { attachTo: document.body, ...stubs })
    await flush()
    const previews = document.querySelectorAll('[data-test="lib-preview"]')
    expect(previews.length).toBe(2)                                     // not the document
    previews[0].click()
    await flush()
    expect(document.querySelector('[data-test="media-viewer-image"]')).not.toBeNull()
    document.querySelector('[aria-label="Next file"]').click()
    await flush()
    expect(document.querySelector('[data-test="media-viewer-video"]')).not.toBeNull()
    document.querySelector('[data-test="media-viewer-close"]').click()
    await flush()
    expect(document.querySelector('[data-test="media-viewer"]')).toBeNull()
    w.unmount()
  })
})

// Owner, 2026-10-20: a card shows the server's small picture, not the whole file; when it cannot load, the file.
describe('VideoLibrary thumbnails', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useVideoStore().libraryOpen = true
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/video/library/'
      ? { items: [{ ...ITEMS[1], thumbnail_url: '/api/video/library/vid-1/thumbnail/' }], page: 1, has_more: false }
      : { ingredients: [] } }))
  })

  it('shows the thumbnail of a video, and the video itself when the thumbnail fails', async () => {
    const w = mount(VideoLibrary, { attachTo: document.body })
    await flush()
    const thumb = document.querySelector('[data-test="lib-thumbnail"]')
    expect(thumb.getAttribute('src')).toBe('/api/video/library/vid-1/thumbnail/')
    expect(document.querySelector('[data-test="lib-preview"] video')).toBeNull()
    thumb.dispatchEvent(new Event('error'))
    await flush()
    expect(document.querySelector('[data-test="lib-thumbnail"]')).toBeNull()
    expect(document.querySelector('[data-test="lib-preview"] video')).not.toBeNull()
    w.unmount()
  })
  it('picks only accepted Library kinds without creating a project or starting a job', async () => {
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/video/library/'
      ? { items: ITEMS, page: 1, has_more: false } : { ingredients: [] } }))
    const w = mount(VideoLibrary, { global: { stubs: { RouterLink: true } }, props: { mode: 'picker', allowedKinds: ['image'] }, attachTo: document.body })
    await flush()
    expect(document.querySelectorAll('[data-test="lib-item"]')).toHaveLength(1)
    document.querySelector('[data-test="lib-use"]').click(); await flush()
    expect(w.emitted('pick')[0][0].attachment_id).toBe('img-1')
    expect(api.post).not.toHaveBeenCalled()
    expect(document.querySelector('[data-test="lib-preview"] img')).toBeNull()
    w.unmount()
  })
  it('shows a retry when Elements cannot load and clears stale items', async () => {
    useVideoStore().ingredients = [{ ingredient_id: 'stale', name: 'Old item', kind: 'product', files: [] }]
    api.get.mockImplementation(url => url === '/video/ingredients/' ? Promise.reject(new Error('Unavailable')) : Promise.resolve({ data: { items: [], projects: [] } }))
    const w = mount(VideoLibrary, { props: { mode: 'page', initialTab: 'ingredients' } })
    await flush()
    expect(w.get('[role="alert"]').text()).toContain('Could not load your Elements')
    expect(w.findAll('[data-test="lib-ingredient"]')).toHaveLength(0)
    api.get.mockResolvedValueOnce({ data: { ingredients: [] } })
    await w.get('[role="alert"] button').trigger('click'); await flush()
    expect(w.find('[role="alert"]').exists()).toBe(false)
    expect(w.text()).toContain('An Element is a named')
    w.unmount()
  })
  it('labels the existing Ingredients page as Elements', async () => {
    const w = mount(VideoLibrary, { props: { mode: 'page', initialTab: 'ingredients' } })
    await flush()
    expect(w.get('h1').text()).toBe('Elements')
    w.unmount()
  })

})
