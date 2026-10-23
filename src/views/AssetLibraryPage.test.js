// @vitest-environment jsdom
// The AADML Asset Library: the files of the person's AADML chats only (origin "aadml" of the one shared Library,
// backend ASSET_LIBRARY_ORIGINS_PLAN.md); each file opens its chat and downloads from this site.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }))

import api from '../services/api'
import AssetLibraryPage from './AssetLibraryPage.vue'

const photo = {
  attachment_id: 'a1', source: 'uploaded', media_type: 'image', title: 'kitchen.jpg', ext: 'jpg', size_bytes: 2048,
  url: 'https://aadml.com/media/context_files/2026/10/20/kitchen.jpg', conversation_id: 41, created_at: '2026-10-20T10:00:00Z',
}
const made = {
  attachment_id: 'a2', source: 'generated', media_type: 'document', title: 'Launch plan', ext: 'pdf', size_bytes: 0,
  url: 'https://evil.example/plan.pdf', conversation_id: null, created_at: '2026-10-19T10:00:00Z',
}

let wrapper
async function mountPage(items, hasMore = false) {
  api.get.mockResolvedValue({ data: { items, page: 1, has_more: hasMore, origin: 'aadml' } })
  wrapper = mount(AssetLibraryPage, { global: { stubs: { 'router-link': { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
  await flushPromises()
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => wrapper?.unmount())

describe('AssetLibraryPage', () => {
  it('asks the one Library for AADML files only, 15 at a time', async () => {
    await mountPage([photo])
    expect(api.get).toHaveBeenCalledWith('/library/', expect.objectContaining({ params: expect.objectContaining({ origin: 'aadml', type: 'all', source: 'all', page: 1, limit: 15 }) }))
    expect(wrapper.find('.pager').exists()).toBe(false)              // one page only: no pager
  })

  it('pages with Previous and Next', async () => {
    await mountPage([photo], true)
    const [previous, next] = wrapper.findAll('.pager button')
    expect(previous.attributes('disabled')).toBeDefined()
    api.get.mockResolvedValue({ data: { items: [made], page: 2, has_more: false } })
    await next.trigger('click')
    await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/library/', expect.objectContaining({ params: expect.objectContaining({ origin: 'aadml', page: 2, limit: 15 }) }))
    expect(wrapper.find('.page-no').text()).toBe('Page 2')
    expect(wrapper.findAll('.card')).toHaveLength(1)                 // the page is replaced, not appended
    expect(wrapper.findAll('.pager button')[1].attributes('disabled')).toBeDefined()
  })

  it('shows a cropped thumbnail, and the whole file only in the preview on click', async () => {
    await mountPage([photo])
    expect(document.querySelector('[data-test="asset-preview"]')).toBeNull()
    await wrapper.find('.card .thumb').trigger('click')
    const dialog = document.querySelector('[data-test="asset-preview"]')
    expect(dialog).not.toBeNull()
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.querySelector('.viewer-media img').getAttribute('src')).toBe('/media/context_files/2026/10/20/kitchen.jpg')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(document.querySelector('[data-test="asset-preview"]')).toBeNull()
  })

  it('shows each file with its chat, and downloads from this site only', async () => {
    await mountPage([photo, made])
    const cards = wrapper.findAll('.card')
    expect(cards).toHaveLength(2)
    expect(cards[0].find('img').attributes('src')).toBe('/media/context_files/2026/10/20/kitchen.jpg')
    expect(cards[0].find('a[href="/dashboard/chat/41"]').exists()).toBe(true)
    expect(cards[0].find('a[aria-label="Download kitchen.jpg"]').attributes('href')).toBe('/media-dl/context_files/2026/10/20/kitchen.jpg')
    expect(cards[1].text()).toContain('Made by an agent')
    expect(cards[1].find('a[aria-label^="Download"]').exists()).toBe(false)   // another site's address is never used
  })

  it('filters by type and says when nothing is there', async () => {
    await mountPage([])
    expect(wrapper.text()).toContain('Nothing here yet')
    api.get.mockResolvedValue({ data: { items: [], page: 1, has_more: false } })
    await wrapper.findAll('[role="tab"]').find(b => b.text() === 'Videos').trigger('click')
    await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/library/', expect.objectContaining({ params: expect.objectContaining({ origin: 'aadml', type: 'video' }) }))
  })
})

describe('AssetLibraryPage — failures and fast filter changes', () => {
  it('shows an error with Retry, not "Nothing here yet", when the library fails to load', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'))
    wrapper = mount(AssetLibraryPage, { global: { stubs: { 'router-link': true } } })
    await flushPromises()
    expect(wrapper.text()).toContain('Your Asset Library could not be loaded')
    expect(wrapper.text()).not.toContain('Nothing here yet')
    api.get.mockResolvedValueOnce({ data: { items: [photo], page: 1, has_more: false } })
    await wrapper.find('.load-error__retry').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('kitchen.jpg')
  })

  it('aborts the older request and ignores its late answer', async () => {
    const calls = []
    api.get.mockImplementation((url, cfg) => new Promise((resolve) => calls.push({ cfg, resolve })))
    wrapper = mount(AssetLibraryPage, { global: { stubs: { 'router-link': true } } })
    await flushPromises()
    await wrapper.findAll('[role="tab"]').find(b => b.text() === 'Videos').trigger('click')
    await flushPromises()
    expect(calls.length).toBe(2)
    expect(calls[0].cfg.signal.aborted).toBe(true)
    calls[1].resolve({ data: { items: [{ ...photo, attachment_id: 'v', title: 'clip.mp4', media_type: 'video' }], page: 1, has_more: false } })
    await flushPromises()
    calls[0].resolve({ data: { items: [photo], page: 1, has_more: false } })
    await flushPromises()
    expect(wrapper.text()).toContain('clip.mp4')
    expect(wrapper.text()).not.toContain('kitchen.jpg')
  })
})
