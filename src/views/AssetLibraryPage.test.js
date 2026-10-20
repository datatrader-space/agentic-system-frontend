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
  it('asks the one Library for AADML files only', async () => {
    await mountPage([photo])
    expect(api.get).toHaveBeenCalledWith('/library/', { params: expect.objectContaining({ origin: 'aadml', type: 'all', source: 'all', page: 1 }) })
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
    expect(api.get).toHaveBeenLastCalledWith('/library/', { params: expect.objectContaining({ origin: 'aadml', type: 'video' }) })
  })
})
