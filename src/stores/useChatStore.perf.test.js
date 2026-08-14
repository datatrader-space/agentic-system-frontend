import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'
import api from '../services/api'

// setAgent() prewarms the chat socket, which reaches for window.location — stub the transport so these
// store-level tests stay environment-free (the socket itself is covered by the chatService tests).
vi.mock('../services/chatService', () => ({
  ChatConnection: class {
    connect() {}
    prewarm() {}
    setConversation() {}
    close() {}
  },
}))

vi.mock('../services/api', () => ({
  default: {
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
    getConversations: vi.fn(() => Promise.resolve({ data: { results: [] } })),
    getConversation: vi.fn(() => Promise.resolve({ data: { messages: [] } })),
    getConversationMessages: vi.fn(() => Promise.resolve({ data: { results: [], has_more: false } })),
    getSuperAgentCard: vi.fn(() => Promise.resolve({ data: { id: 99, name: 'Super' } })),
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

const agent = (id, name) => ({ id, name })
const svrMsg = (id, content) => ({ id, role: 'user', content, model_info: {} })

// Defers resolution so we can observe what concurrent callers see WHILE a request is in flight.
function deferred() {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

describe('useChatStore — loadAgents request sharing', () => {
  it('concurrent callers share ONE request and all resolve with agents populated', async () => {
    const chat = useChatStore()
    const d = deferred()
    api.getAgents.mockReturnValueOnce(d.promise)

    // ChatWelcome (child) and ChatWorkspace (parent) both call this on mount.
    const first = chat.loadAgents()
    const second = chat.loadAgents()

    expect(api.getAgents).toHaveBeenCalledTimes(1)

    d.resolve({ data: [agent(1, 'A'), agent(2, 'B')] })
    await Promise.all([first, second])

    // The REGRESSION this guards: the old dedup was a bare `return`, so the second caller resolved
    // immediately against a still-empty list and _startNewChat() ran with no agents.
    expect(chat.agents).toHaveLength(2)
    expect(chat.agentsLoaded).toBe(true)
  })

  it('a second caller awaiting mid-flight does not see an empty agent list', async () => {
    const chat = useChatStore()
    const d = deferred()
    api.getAgents.mockReturnValueOnce(d.promise)

    chat.loadAgents()
    let seen = null
    const late = chat.loadAgents().then(() => { seen = chat.agents.length })

    d.resolve({ data: [agent(1, 'A')] })
    await late
    expect(seen).toBe(1)
  })

  it('skips the request entirely once loaded, unless forced', async () => {
    const chat = useChatStore()
    api.getAgents.mockResolvedValue({ data: [agent(1, 'A')] })

    await chat.loadAgents()
    await chat.loadAgents()
    expect(api.getAgents).toHaveBeenCalledTimes(1)

    await chat.loadAgents(true)
    expect(api.getAgents).toHaveBeenCalledTimes(2)
  })

  it('does NOT chain a conversations fetch (history is the drawer’s concern)', async () => {
    const chat = useChatStore()
    api.getAgents.mockResolvedValue({ data: [agent(1, 'A')] })
    await chat.loadAgents()
    expect(api.getConversations).not.toHaveBeenCalled()
  })

  it('setAgent does not prefetch history either — only prewarms the socket', () => {
    const chat = useChatStore()
    chat.setAgent('5')
    expect(chat.selectedAgentId).toBe('5')
    expect(api.getConversations).not.toHaveBeenCalled()
  })
})

describe('useChatStore — ensureSuperAgent uses the slim card', () => {
  it('requests the chat card, not the full super-agent payload', async () => {
    const chat = useChatStore()
    const sa = await chat.ensureSuperAgent()
    expect(api.getSuperAgentCard).toHaveBeenCalledTimes(1)
    expect(sa.id).toBe(99)
    expect(chat.agents.map((a) => a.id)).toContain(99)
  })
})

describe('useChatStore — message windowing', () => {
  it('records the server window flags on open', async () => {
    const chat = useChatStore()
    api.getConversation.mockResolvedValueOnce({
      data: { messages: [svrMsg(10, 'a'), svrMsg(11, 'b')], message_count: 120, has_more_messages: true },
    })
    await chat.openConversation('c1')
    expect(chat.messages).toHaveLength(2)
    expect(chat.messagesHasMore).toBe(true)
    expect(chat.messagesTotal).toBe(120)
  })

  it('treats a server without the window fields as "nothing more to load"', async () => {
    const chat = useChatStore()
    api.getConversation.mockResolvedValueOnce({ data: { messages: [svrMsg(1, 'only')] } })
    await chat.openConversation('c2')
    expect(chat.messagesHasMore).toBe(false)
  })

  it('loadOlderMessages PREPENDS using the oldest held id as an exclusive cursor', async () => {
    const chat = useChatStore()
    api.getConversation.mockResolvedValueOnce({
      data: { messages: [svrMsg(50, 'newer')], message_count: 60, has_more_messages: true },
    })
    await chat.openConversation('c3')

    api.getConversationMessages.mockResolvedValueOnce({
      data: { results: [svrMsg(48, 'older-1'), svrMsg(49, 'older-2')], has_more: false },
    })
    await chat.loadOlderMessages()

    expect(api.getConversationMessages).toHaveBeenCalledWith('c3', { before: 50, limit: 50 })
    // Order matters: older rows go ABOVE what we already hold.
    expect(chat.messages.map((m) => m.content)).toEqual(['older-1', 'older-2', 'newer'])
    expect(chat.messagesHasMore).toBe(false)
  })

  it('is a no-op when there is nothing older', async () => {
    const chat = useChatStore()
    api.getConversation.mockResolvedValueOnce({
      data: { messages: [svrMsg(1, 'x')], message_count: 1, has_more_messages: false },
    })
    await chat.openConversation('c4')
    await chat.loadOlderMessages()
    expect(api.getConversationMessages).not.toHaveBeenCalled()
  })

  it('restores per-message metadata on a prepended page exactly like the first page', async () => {
    const chat = useChatStore()
    api.getConversation.mockResolvedValueOnce({
      data: { messages: [svrMsg(9, 'newest')], message_count: 2, has_more_messages: true },
    })
    await chat.openConversation('c5')

    api.getConversationMessages.mockResolvedValueOnce({
      data: {
        results: [{
          id: 8, role: 'assistant', content: 'older',
          feedback: 'up',
          attachments: [{ id: 1, name: 'f.png' }],
          plan_artifacts: [{ plan_id: 'p1', run_id: 'r1', ordinal: 0 }],
          model_info: {
            usage: { total_tokens: 42 }, stop_reason: 'end_turn',
            answer_basis: { citations: [{ id: 'c' }] },
            timeline: [{ step: 1 }],
          },
        }],
        has_more: false,
      },
    })
    await chat.loadOlderMessages()

    const older = chat.messages[0]
    expect(older.role).toBe('assistant')
    expect(older.serverId).toBe(8)
    expect(older.feedback).toBe('up')
    expect(older.attachments).toHaveLength(1)
    expect(older.planArtifacts[0].plan_id).toBe('p1')
    expect(older.usage.total_tokens).toBe(42)
    expect(older.stopReason).toBe('end_turn')
    expect(older.citations).toHaveLength(1)
    expect(older.timeline).toEqual([{ step: 1 }])
  })

  it('resets window state when the conversation is reset', async () => {
    const chat = useChatStore()
    api.getConversation.mockResolvedValueOnce({
      data: { messages: [svrMsg(1, 'x')], message_count: 90, has_more_messages: true },
    })
    await chat.openConversation('c6')
    chat.reset()
    expect(chat.messagesHasMore).toBe(false)
    expect(chat.messagesTotal).toBe(0)
  })
})
