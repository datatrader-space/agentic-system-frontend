// The composer's context ring reads `contextUsage` from the shared chat store (owner, 2026-11-17). It comes from the
// conversation on load and from the run's `context_usage` / `run_compacted` frames of the open conversation; another
// conversation's frame never lands here. Each compaction the server saved on an answer shows after a reload.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const getConversation = vi.fn()
const compactConversation = vi.fn()
vi.mock('../services/api', () => ({
  default: {
    getConversation: (...a) => getConversation(...a),
    compactConversation: (...a) => compactConversation(...a),
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

describe("Compact now (the ring's menu)", () => {
  const answer = (id, steps = []) => ({ id: `m${id}`, serverId: id, role: 'assistant', content: 'done',
    timeline: { steps, isComplete: true } })

  it('asks the server for the open chat, and a refusal is shown in its words', async () => {
    const s = useChatStore()
    s.conversationId = '41'
    compactConversation.mockRejectedValueOnce({ response: { status: 400,
      data: { error: 'There is too little to compact.', code: 'too_little' } } })
    await s.compactNow()
    expect(compactConversation).toHaveBeenCalledWith('41')
    expect(s.compaction).toEqual({ status: 'failed', message: 'There is too little to compact.' })
  })

  it('stays running until the chat is told, and is never asked twice at once or during a reply', async () => {
    const s = useChatStore()
    s.conversationId = '41'
    compactConversation.mockResolvedValue({ status: 202, data: { status: 'compacting' } })
    await s.compactNow()
    expect(s.compaction.status).toBe('running')
    await s.compactNow()
    expect(compactConversation).toHaveBeenCalledTimes(1)
    s.compaction = { status: '', message: '' }
    s.isStreaming = true
    await s.compactNow()
    expect(compactConversation).toHaveBeenCalledTimes(1)
  })

  it('its row goes at the END of the last answer, the ring drops, and it says it is done', () => {
    const s = useChatStore()
    s.conversationId = '41'
    s.compaction = { status: 'running', message: '' }
    s.messages = [answer(5), { id: 'u6', role: 'user', content: 'next' },
      answer(7, [{ stepId: 'a', label: 'Reading files', status: 'ok' }])]
    s._onEvent({ type: 'run_compacted', conversation_id: 41, scope: 'manual', tokens_before: 120000,
      tokens_after: 30000, window_tokens: 200000, compact_at_percent: 80, messages_summarized: 12 })
    const steps = s.messages[2].timeline.steps
    expect(steps.map((x) => x.stepId)[0]).toBe('a')
    expect(steps[1].isManualCompaction).toBe(true)
    expect(steps[1].label).toBe('Conversation compacted on request (120k → 30k tokens)')
    expect(s.messages[0].timeline.steps).toHaveLength(0)
    expect(s.contextUsage).toEqual({ used: 30000, window: 200000, percent: 15, compactAt: 80 })
    expect(s.compaction.status).toBe('done')
  })

  it("a failure is said in words; another chat's failure never lands here", () => {
    const s = useChatStore()
    s.conversationId = '41'
    s._onEvent({ type: 'compaction_failed', conversation_id: 99, message: 'other' })
    expect(s.compaction.status).toBe('')
    s._onEvent({ type: 'compaction_failed', conversation_id: 41,
      message: 'Could not summarize the earlier conversation: no summary model is set.' })
    expect(s.compaction).toEqual({ status: 'failed',
      message: 'Could not summarize the earlier conversation: no summary model is set.' })
  })

  it("after a reload the manual row is at the end of the answer, the run's rows at the top", () => {
    const saved = [{ tokens_before: 90000, tokens_after: 20000 },
      { tokens_before: 120000, tokens_after: 30000, scope: 'manual' }]
    const tl = timelineWithCompactions({ steps: [{ stepId: 'a', label: 'Reading files' }], isComplete: true }, saved)
    expect(tl.steps.map((x) => x.stepId)).toEqual(['compact_saved_0', 'a', 'compact_manual_saved_0'])
    expect(timelineWithCompactions(tl, saved)).toBe(tl)                  // nothing added twice
  })
})
