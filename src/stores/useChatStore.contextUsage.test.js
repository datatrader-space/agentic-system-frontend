// The composer's context ring reads `contextUsage` from the shared chat store (owner, 2026-11-17). It comes from the
// conversation on load and from the run's `context_usage` / `run_compacted` frames of the open conversation; another
// conversation's frame never lands here. Each compaction the server saved on an answer shows after a reload.
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

import { useChatStore, timelineWithCompactions } from './useChatStore'
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

  it('a summary drops the ring to what is left', () => {
    const s = useChatStore()
    s.conversationId = '41'
    s._onEvent({ type: 'run_compacted', conversation_id: 41, tokens_before: 172000,
      tokens_after: 30000, window_tokens: 200000, compact_at_percent: 79 })
    expect(s.contextUsage).toEqual({ used: 30000, window: 200000, percent: 15, compactAt: 79 })
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
    tl.addCompaction({ tokens_before: 172000, tokens_after: 30000 })
    expect(tl.steps.value.map((s) => s.label)).toEqual([
      'Earlier conversation summarized to fit the context window (172k → 30k tokens)',
    ])
    expect(tl.steps.value.every((s) => s.isCompaction)).toBe(true)
  })
})

describe('a reload keeps every compaction the server saved on the answer', () => {
  const saved = [{ tokens_before: 172000, tokens_after: 30000, window_tokens: 200000, compact_at_percent: 79,
    messages_summarized: 40 }]

  it('an answer with no saved timeline gets a finished one holding the row', () => {
    const tl = timelineWithCompactions(null, saved)
    expect(tl.isComplete).toBe(true)
    expect(tl.steps.map((s) => [s.isCompaction, s.label])).toEqual([
      [true, 'Earlier conversation summarized to fit the context window (172k → 30k tokens)']])
  })

  it('a snapshot that already holds it is left as it is; one that lacks it gets it at the top', () => {
    const step = { stepId: 'a', phase: 'using_tools', label: 'Reading files', status: 'ok' }
    const withRow = { steps: [step, { stepId: 'c', isCompaction: true, label: 'x' }], isComplete: true }
    expect(timelineWithCompactions(withRow, saved)).toBe(withRow)
    const without = { steps: [step], isComplete: true }
    expect(timelineWithCompactions(without, saved).steps.map((s) => s.stepId)).toEqual(['compact_saved_0', 'a'])
    expect(timelineWithCompactions(without, undefined)).toBe(without)
  })

  it('the loaded answer carries it', async () => {
    getConversation.mockResolvedValue({ data: { id: 41, messages: [
      { id: 7, role: 'assistant', content: 'done', model_info: { compactions: saved } }] } })
    const s = useChatStore()
    await s.openConversation('41')
    const answer = s.messages.find((m) => m.serverId === 7)
    expect(answer.timeline.steps.filter((st) => st.isCompaction)).toHaveLength(1)
  })
})
