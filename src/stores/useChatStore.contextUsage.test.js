// The composer's context ring reads `contextUsage` from the shared chat store (owner, 2026-11-17). It comes from the
// conversation on load and from the run's `context_usage` / `run_compacted` frames of the open conversation; another
// conversation's frame never lands here, and a summary of the chat's history leaves it to the next run's measurement.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const getConversation = vi.fn()
vi.mock('../services/api', () => ({
  default: {
    getConversation: (...a) => getConversation(...a),
    getConversationMessages: vi.fn(() => Promise.resolve({ data: [] })),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
    getAgent: vi.fn(() => Promise.resolve({ data: {} })),
    getAgentCard: vi.fn(() => Promise.resolve({ data: {} })),
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))
vi.mock('../services/chatService', () => ({
  ChatConnection: class {
    constructor(cid) { this.conversationId = cid }
    connect() {}
    setConversation(c) { this.conversationId = c }
    prewarm() {}
    sendIfOpen() {}
    reconnectNow() {}
    close() {}
  },
  browserTimeZone: () => 'UTC',
}))

import { useChatStore } from './useChatStore'
import { useAgentTimeline } from '../composables/useAgentTimeline'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('the context measurement in the shared chat store', () => {
  it('takes the open conversation\'s context_usage frame', () => {
    const s = useChatStore()
    s.conversationId = '41'
    s._onEvent({ type: 'context_usage', conversation_id: 41, used_tokens: 50000, window_tokens: 200000,
      compact_at_percent: 85 })
    expect(s.contextUsage).toEqual({ used: 50000, window: 200000, percent: 25, compactAt: 85 })
  })

  it('never takes another conversation\'s frame', () => {
    const s = useChatStore()
    s.conversationId = '41'
    s._onEvent({ type: 'context_usage', conversation_id: 99, used_tokens: 50000, window_tokens: 200000 })
    expect(s.contextUsage).toBeNull()
  })

  it('a run summary drops the ring to what is left; a history summary leaves it', () => {
    const s = useChatStore()
    s.conversationId = '41'
    s._onEvent({ type: 'run_compacted', conversation_id: 41, scope: 'run', tokens_before: 172000,
      tokens_after: 30000, window_tokens: 200000, compact_at_percent: 85 })
    expect(s.contextUsage.percent).toBe(15)
    s._onEvent({ type: 'run_compacted', conversation_id: 41, scope: 'history', tokens_before: 40000,
      tokens_after: 2000, messages_summarized: 30 })
    expect(s.contextUsage.percent).toBe(15)
  })

  it('a reopened chat shows its last measurement, and a new chat clears it', async () => {
    getConversation.mockResolvedValue({ data: { id: 41, messages: [],
      context_usage: { used_tokens: 124000, window_tokens: 200000, compact_at_percent: 85 } } })
    const s = useChatStore()
    await s.openConversation('41')
    expect(s.contextUsage.percent).toBe(62)
    s.reset()
    expect(s.contextUsage).toBeNull()
  })
})

describe('the timeline row for a summary', () => {
  it('names what was summarized and the tokens before and after', () => {
    const tl = useAgentTimeline()
    tl.addCompaction({ scope: 'run', tokens_before: 172000, tokens_after: 30000 })
    tl.addCompaction({ scope: 'history', tokens_before: 40000, tokens_after: 2000 })
    const labels = tl.steps.value.map((s) => s.label)
    expect(labels).toEqual([
      'Earlier work summarized to fit the context window (172k → 30k tokens)',
      'Earlier messages in this chat summarized to fit the context window (40k → 2k tokens)',
    ])
    expect(tl.steps.value.every((s) => s.isCompaction)).toBe(true)
  })
})
