// @vitest-environment jsdom
// Recent Video Studio chats in the Studio's navigation (owner, 2026-10-20): newest first, each opens in the Studio.
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: { conversation: '2874' } }) }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => ({ conversationId: '2874', isBusy: false }) }))

import api from '../../services/api'
import StudioRecentChats from './StudioRecentChats.vue'

const flush = () => new Promise((r) => setTimeout(r, 0))
const stubs = { global: { stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } } }

describe('StudioRecentChats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists the Studio agent\'s chats newest first, marks the open one, and pages older ones', async () => {
    api.get.mockResolvedValueOnce({ data: { count: 3, results: [
      { id: 2874, name: 'Candle reel', updated_at: '2026-10-20T12:30:00Z' }, { id: 2873, name: 'Make a lavender candle reel', updated_at: '2026-10-20T11:58:00Z' }] } })
    const w = mount(StudioRecentChats, stubs)
    await flush()
    expect(api.get).toHaveBeenCalledWith('/video/chats/', { params: { page: 1, page_size: 15 } })
    const links = w.findAll('[data-test="studio-recent-chat"]')
    expect(links.map((a) => a.find('.vrc-name').text())).toEqual(['Candle reel', 'Make a lavender candle reel'])   // the server names a chat by what was asked
    expect(JSON.parse(links[0].attributes('data-to'))).toEqual({ path: '/video-studio', query: { conversation: '2874' } })
    expect(links[0].classes()).toContain('active')
    api.get.mockResolvedValueOnce({ data: { count: 3, results: [{ id: 2600, name: 'Older', updated_at: '2026-10-16T10:00:00Z' }] } })
    await w.get('[data-test="studio-recent-more"]').trigger('click')
    await flush()
    expect(w.findAll('[data-test="studio-recent-chat"]')).toHaveLength(3)
    expect(w.find('[data-test="studio-recent-more"]').exists()).toBe(false)
  })

  it('opens each chat on its own page and names an unnamed one after that page', async () => {
    api.get.mockResolvedValueOnce({ data: { count: 2, results: [
      { id: 31, name: 'Untitled chat', page: 'edit', updated_at: '2026-10-27T10:00:00Z' },
      { id: 32, name: 'A jingle for the shop', page: 'audio', updated_at: '2026-10-27T09:00:00Z' }] } })
    const w = mount(StudioRecentChats, stubs)
    await flush()
    const links = w.findAll('[data-test="studio-recent-chat"]')
    expect(links.map((a) => a.find('.vrc-name').text())).toEqual(['Image edit chat', 'A jingle for the shop'])
    expect(JSON.parse(links[0].attributes('data-to'))).toEqual({ path: '/video-studio/edit', query: { conversation: '31' } })
    expect(JSON.parse(links[1].attributes('data-to'))).toEqual({ path: '/video-studio/audio', query: { conversation: '32' } })
  })

  it('shows nothing when there is no chat yet', async () => {
    api.get.mockResolvedValueOnce({ data: { count: 0, results: [] } })
    const w = mount(StudioRecentChats, stubs)
    await flush()
    expect(w.find('[data-test="studio-recent-chats"]').exists()).toBe(false)
  })
})

it('cleans recent names and uses a page fallback for hidden instructions', async () => {
  api.get.mockResolvedValueOnce({data:{count:3,results:[{id:1,name:'I am on the Image page. My chosen preset is Quiet tabletop.'},{id:2,name:'I am on the Video page. My chosen preset is A measured reveal.\n\nA bottle reveal'},{id:3,name:'I am on the Enhance page in Manual mode. Write an editable creative prompt.'}]}})
  const w = mount(StudioRecentChats,stubs); await flush()
  expect(w.findAll('.vrc-name').map(n=>n.text())).toEqual(['Image chat '+String.fromCharCode(183)+' Quiet tabletop','A bottle reveal','Enhance chat'])
  w.unmount()
})
