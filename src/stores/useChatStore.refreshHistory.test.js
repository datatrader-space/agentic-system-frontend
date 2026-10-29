// Page-speed plan Phase 3: the chat's history refetches (the reconnect recovery loop, message_posted, the end of
// a turn, a cross-worker run_finished, plan-anchor reload) read the windowed messages endpoint
// (GET /conversations/<id>/messages/?limit=…), not the whole conversation (GET /conversations/<id>/), which
// they never needed. The recovery loop, which asks every 2.5 s, reads only the newest message until the
// answer has landed. Opening a conversation still reads the conversation: it needs its own fields.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const api = vi.hoisted(() => ({
  getConversation: vi.fn(),
  getConversationMessages: vi.fn(),
  get: vi.fn(() => Promise.resolve({ data: {} })),
  post: vi.fn(() => Promise.resolve({ data: {} })),
}))
vi.mock('../services/api', () => ({ default: api }))

import { useChatStore } from './useChatStore'

const USER_ROW = { id: 1, role: 'user', content: 'what is the title?' }
const ANSWER_ROW = { id: 2, role: 'assistant', content: 'The title is Tide.', model_info: {} }
const page = (results, has_more = false) => ({ data: { results, has_more } })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})
afterEach(() => vi.useRealTimers())

describe('_refreshHistory', () => {
  it('reads the latest window of messages, not the conversation, and merges it', async () => {
    api.getConversationMessages.mockResolvedValue(page([USER_ROW, ANSWER_ROW], true))
    const s = useChatStore()
    s.conversationId = '77'
    s.messages = [{ id: 'm1', role: 'user', content: 'what is the title?' }]
    s.messagesHasMore = false

    expect(await s._refreshHistory()).toBe(true)

    expect(api.getConversationMessages).toHaveBeenCalledTimes(1)
    expect(api.getConversationMessages).toHaveBeenCalledWith('77', { limit: 50 })
    expect(api.getConversation).not.toHaveBeenCalled()
    expect(s.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', 'what is the title?'], ['assistant', 'The title is Tide.'],
    ])
    expect(s.messages[0].id).toBe('m1')          // the same message keeps its identity
    expect(s.messages[1].serverId).toBe(2)
    expect(s.messagesHasMore).toBe(true)         // older pages exist again beyond this window
  })

  it('leaves the thread alone while the newest saved message is not an answer', async () => {
    api.getConversationMessages.mockResolvedValue(page([USER_ROW]))
    const s = useChatStore()
    s.conversationId = '77'
    const before = [{ id: 'm1', role: 'user', content: 'what is the title?' }, { id: 'm2', role: 'assistant', content: '' }]
    s.messages = before.slice()
    expect(await s._refreshHistory()).toBe(false)
    expect(s.messages).toEqual(before)
  })

  it('writes nothing when another chat was opened while the read was in flight', async () => {
    let release
    api.getConversationMessages.mockImplementation(() => new Promise((r) => { release = r }))
    const s = useChatStore()
    s.conversationId = '77'
    s.messages = []
    const p = s._refreshHistory()
    s.conversationId = '78'
    release(page([USER_ROW, ANSWER_ROW]))
    expect(await p).toBe(false)
    expect(s.messages).toEqual([])
  })

  it('probe: reads only the newest message until the answer lands, then the window once', async () => {
    const s = useChatStore()
    s.conversationId = '77'
    s.messages = [{ id: 'm1', role: 'user', content: 'what is the title?' }]
    api.getConversationMessages.mockResolvedValueOnce(page([USER_ROW], true))
    expect(await s._refreshHistory({ probe: true })).toBe(false)
    expect(api.getConversationMessages).toHaveBeenCalledTimes(1)
    expect(api.getConversationMessages).toHaveBeenLastCalledWith('77', { limit: 1 })

    api.getConversationMessages
      .mockResolvedValueOnce(page([ANSWER_ROW], true))
      .mockResolvedValueOnce(page([USER_ROW, ANSWER_ROW]))
    expect(await s._refreshHistory({ probe: true })).toBe(true)
    expect(api.getConversationMessages.mock.calls.slice(1)).toEqual([['77', { limit: 1 }], ['77', { limit: 50 }]])
    expect(s.messages.at(-1).content).toBe('The title is Tide.')
  })
})

describe('the recovery loop', () => {
  it('polls the newest message and settles on the saved answer without reading the conversation', async () => {
    vi.useFakeTimers()
    const s = useChatStore()
    s.conversationId = '77'
    s._conn = { sendIfOpen: vi.fn(), send: vi.fn() }
    s.messages = [{ id: 'm1', role: 'user', content: 'what is the title?' }]
    s._beginAssistant()
    api.getConversationMessages.mockResolvedValue(page([USER_ROW]))
    const done = s._recoverAfterReconnect()
    await vi.advanceTimersByTimeAsync(2600)
    expect(api.getConversationMessages.mock.calls.every(([, params]) => params.limit === 1)).toBe(true)

    api.getConversationMessages.mockImplementation((id, params) =>
      Promise.resolve(params.limit === 1 ? page([ANSWER_ROW]) : page([USER_ROW, ANSWER_ROW])))
    await vi.advanceTimersByTimeAsync(2600)
    await done
    expect(s.isStreaming).toBe(false)
    expect(s.messages.at(-1).content).toBe('The title is Tide.')
    expect(api.getConversation).not.toHaveBeenCalled()
  })
})

describe('_reloadHistoryForAnchors', () => {
  it('maps plan anchors from the latest window of messages, not the conversation', async () => {
    api.getConversationMessages.mockResolvedValue(page([
      USER_ROW, { ...ANSWER_ROW, plan_artifacts: [{ plan_id: 'p1', run_id: 'run_1' }] },
    ]))
    const s = useChatStore()
    s.conversationId = '77'
    s.messages = [
      { id: 'm1', role: 'user', content: 'what is the title?' },
      { id: 'm2', role: 'assistant', content: 'The title is Tide.', planArtifacts: [] },
    ]
    await s._reloadHistoryForAnchors('77')
    expect(api.getConversationMessages).toHaveBeenCalledWith('77', { limit: 50 })
    expect(api.getConversation).not.toHaveBeenCalled()
    expect(s.messages[1].planArtifacts).toEqual([{ plan_id: 'p1', run_id: 'run_1' }])
  })
})
