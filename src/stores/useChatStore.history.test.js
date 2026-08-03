import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: {
    getConversations: vi.fn(() => Promise.resolve({ data: { results: [] } })),
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

const conv = (id, agentId, agentName) => ({
  id, agent_profile: agentId, agent_profile_name: agentName, updated_at: '2026-08-03T10:00:00Z',
})

describe('useChatStore — chat history scoping', () => {
  it('loadSessions filters server-side by the selected agent', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = '7'
    api.getConversations.mockResolvedValueOnce({ data: { results: [conv(1, 7, 'Web Builder')] } })

    await chat.loadSessions()

    expect(api.getConversations).toHaveBeenCalledWith(
      expect.objectContaining({ agent_profile_id: '7' })
    )
    expect(chat.sessions.map((s) => s.id)).toEqual([1])
  })

  it('uses page/page_size (the backend paginator params), never the ignored `limit`', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = '7'
    await chat.loadSessions()
    const params = api.getConversations.mock.calls[0][0]
    expect(params.page).toBe(1)
    expect(params.page_size).toBe(25)
    expect(params.limit).toBeUndefined()
  })

  it('switching agents clears the previous agent’s rows before the new list arrives', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = '7'
    api.getConversations.mockResolvedValueOnce({ data: { results: [conv(1, 7, 'A')] } })
    await chat.loadSessions()
    expect(chat.sessions).toHaveLength(1)

    chat.selectedAgentId = '9'
    let resolve
    api.getConversations.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const pending = chat.loadSessions()
    expect(chat.sessions).toEqual([])            // no cross-agent leak while loading

    resolve({ data: { results: [conv(2, 9, 'B')] } })
    await pending
    expect(chat.sessions.map((s) => s.id)).toEqual([2])
  })

  it('discards a late response for an agent the user already switched away from', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = '7'
    let resolveSlow
    api.getConversations.mockReturnValueOnce(new Promise((r) => { resolveSlow = r }))
    const slow = chat.loadSessions()

    chat.selectedAgentId = '9'                   // user switched agents mid-flight
    resolveSlow({ data: { results: [conv(1, 7, 'A')] } })
    await slow

    expect(chat.sessions).toEqual([])
    expect(chat._sessionsAgentId).not.toBe('7')
  })

  it('caches per agent for 60s and refetches on force', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = '7'
    await chat.loadSessions()
    await chat.loadSessions()
    expect(api.getConversations).toHaveBeenCalledTimes(1)

    await chat.loadSessions(true)
    expect(api.getConversations).toHaveBeenCalledTimes(2)
  })

  it('loadSessions with no agent selected yields an empty list and no request', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = null
    await chat.loadSessions()
    expect(api.getConversations).not.toHaveBeenCalled()
    expect(chat.sessions).toEqual([])
  })

  it('loadAllSessions stays unfiltered — it backs the explicit cross-agent surfaces', async () => {
    const chat = useChatStore()
    await chat.loadAllSessions()
    const params = api.getConversations.mock.calls[0][0]
    expect(params.agent_profile_id).toBeUndefined()
    expect(params.page).toBe(1)
    expect(params.page_size).toBe(25)
  })
})

describe('useChatStore — chat history paging', () => {
  const page = (ids, count) => ({ data: { count, results: ids.map((i) => conv(i, 7, 'A')) } })

  it('loads only the first page and reports how many are left', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = '7'
    api.getConversations.mockResolvedValueOnce(page([1, 2, 3], 40))

    await chat.loadSessions()

    expect(chat.sessions).toHaveLength(3)
    expect(chat.sessionsTotal).toBe(40)
    expect(chat.hasMoreSessions).toBe(true)
  })

  it('loadMoreSessions appends the NEXT page instead of replacing page 1', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = '7'
    api.getConversations.mockResolvedValueOnce(page([1, 2], 4))
    await chat.loadSessions()

    api.getConversations.mockResolvedValueOnce(page([3, 4], 4))
    await chat.loadMoreSessions()

    expect(api.getConversations.mock.calls[1][0].page).toBe(2)
    expect(chat.sessions.map((s) => s.id)).toEqual([1, 2, 3, 4])
    expect(chat.hasMoreSessions).toBe(false)
  })

  it('de-dupes a row that moved between pages instead of showing it twice', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = '7'
    api.getConversations.mockResolvedValueOnce(page([1, 2], 4))
    await chat.loadSessions()

    api.getConversations.mockResolvedValueOnce(page([2, 3], 3))   // id 2 bumped into page 2
    await chat.loadMoreSessions()

    expect(chat.sessions.map((s) => s.id)).toEqual([1, 2, 3])
  })

  it('does not fetch past the end, nor while a page is already in flight', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = '7'
    api.getConversations.mockResolvedValueOnce(page([1, 2], 2))
    await chat.loadSessions()
    expect(chat.hasMoreSessions).toBe(false)

    await chat.loadMoreSessions()
    expect(api.getConversations).toHaveBeenCalledTimes(1)   // no request — nothing left

    chat.sessionsTotal = 10
    chat.sessionsLoadingMore = true
    await chat.loadMoreSessions()
    expect(api.getConversations).toHaveBeenCalledTimes(1)   // no double-fire
  })

  it('a refresh collapses back to page 1 rather than compounding pages', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = '7'
    api.getConversations.mockResolvedValueOnce(page([1, 2], 4))
    await chat.loadSessions()
    api.getConversations.mockResolvedValueOnce(page([3, 4], 4))
    await chat.loadMoreSessions()
    expect(chat.sessions).toHaveLength(4)

    api.getConversations.mockResolvedValueOnce(page([1, 2], 4))
    await chat.loadSessions(true)

    expect(chat.sessions.map((s) => s.id)).toEqual([1, 2])
    expect(chat.sessionsPage).toBe(1)
  })

  it('paginates the All-agents scope the same way', async () => {
    const chat = useChatStore()
    api.getConversations.mockResolvedValueOnce(page([1, 2], 5))
    await chat.loadAllSessions()
    expect(chat.hasMoreAllSessions).toBe(true)

    api.getConversations.mockResolvedValueOnce(page([3, 4], 5))
    await chat.loadMoreAllSessions()

    expect(api.getConversations.mock.calls[1][0].page).toBe(2)
    expect(chat.allSessions.map((s) => s.id)).toEqual([1, 2, 3, 4])
  })

  it('treats a bare-array (unpaginated) response as complete', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = '7'
    api.getConversations.mockResolvedValueOnce({ data: [conv(1, 7, 'A')] })
    await chat.loadSessions()
    expect(chat.sessionsTotal).toBe(1)
    expect(chat.hasMoreSessions).toBe(false)
  })
})
