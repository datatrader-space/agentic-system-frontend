// @vitest-environment jsdom
// Recent Video Studio chats in the Studio's navigation (owner, 2026-10-20): newest first, each opens in the Studio.
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/api', () => ({ default: { getVideoStudioAgent: vi.fn(), getConversations: vi.fn() } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: { conversation: '2874' } }) }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => ({ conversationId: '2874', isBusy: false }) }))

import api from '../../services/api'
import StudioRecentChats from './StudioRecentChats.vue'

const flush = () => new Promise((r) => setTimeout(r, 0))
const stubs = { global: { stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } } }

describe('StudioRecentChats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getVideoStudioAgent.mockResolvedValue({ data: { id: 3462 } })
  })

  it('lists the Studio agent\'s chats newest first, marks the open one, and pages older ones', async () => {
    api.getConversations.mockResolvedValueOnce({ data: { count: 3, results: [
      { id: 2874, title: 'Candle reel', updated_at: '2026-10-20T12:30:00Z' }, { id: 2873, title: '', updated_at: '2026-10-20T11:58:00Z' }] } })
    const w = mount(StudioRecentChats, stubs)
    await flush()
    expect(api.getConversations).toHaveBeenCalledWith({ agent_profile_id: 3462, ordering: '-updated_at', page: 1, page_size: 15 })
    const links = w.findAll('[data-test="studio-recent-chat"]')
    expect(links.map((a) => a.find('.vrc-name').text())).toEqual(['Candle reel', 'Untitled chat'])
    expect(JSON.parse(links[0].attributes('data-to'))).toEqual({ path: '/video-studio', query: { conversation: '2874' } })
    expect(links[0].classes()).toContain('active')
    api.getConversations.mockResolvedValueOnce({ data: { count: 3, results: [{ id: 2600, title: 'Older', updated_at: '2026-10-16T10:00:00Z' }] } })
    await w.get('[data-test="studio-recent-more"]').trigger('click')
    await flush()
    expect(w.findAll('[data-test="studio-recent-chat"]')).toHaveLength(3)
    expect(w.find('[data-test="studio-recent-more"]').exists()).toBe(false)
  })

  it('shows nothing when there is no chat yet', async () => {
    api.getConversations.mockResolvedValueOnce({ data: { count: 0, results: [] } })
    const w = mount(StudioRecentChats, stubs)
    await flush()
    expect(w.find('[data-test="studio-recent-chats"]').exists()).toBe(false)
  })
})
