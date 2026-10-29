// Page-speed plan Phase 3 (ADM-1075): the server sends ONE final `run_finished` frame on every turn end, to every
// socket of the user, with `status` = completed | stopped | error | empty and the turn's `turn_id`.
//
// The page used to ignore `status`: a stopped, failed or empty turn still raised the "X finished / The run is
// complete." browser notification while the person was looking elsewhere, and a page still showing the turn as
// running (a cross-worker resume) settled only once history had an answer. Now the turn settles at once for every
// status, and only a completed turn notifies. A frame with no status comes from an older backend, which sent one
// only for an answered turn: it is a completed turn.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const getConversationMessages = vi.fn()
vi.mock('../services/api', () => ({
  default: { getConversationMessages: (...a) => getConversationMessages(...a), get: vi.fn(), post: vi.fn() },
}))
const notifyRunFinished = vi.fn()
vi.mock('../composables/useRunNotifications', () => ({
  notifyRunFinished: (...a) => notifyRunFinished(...a),
  ensureNotifyPermission: vi.fn(),
}))

import { useChatStore } from './useChatStore'

const USER_ROW = { id: 1, role: 'user', content: 'what did the signal say?' }
const ANSWER_ROW = { id: 2, role: 'assistant', content: 'It reported 3 new orders.' }
const history = (rows) => ({ data: { results: rows, has_more: false } })

// A page showing a turn that runs on ANOTHER worker: resumed, nothing streamed here.
function resumed({ turnId = 'headless-1' } = {}) {
  const s = useChatStore()
  s.conversationId = 41
  s._conn = { sendIfOpen: vi.fn(), send: vi.fn() }
  s.messages = [{ id: 'u1', serverId: 1, role: 'user', content: USER_ROW.content }]
  s._onEvent({ type: 'turn_resumed', conversation_id: '41', turn_id: turnId, progress: {}, cross_worker: true })
  return s
}

const finished = (status, extra = {}) => ({
  type: 'run_finished', conversation_id: '41', turn_id: 'headless-1', agent_name: 'Helper', snippet: 'It reported', ...extra,
  ...(status === undefined ? {} : { status }),
})

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('run_finished settles the turn on screen, whatever the status', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getConversationMessages.mockReset()
    notifyRunFinished.mockReset()
  })

  it('completed: settles at once, notifies, and lands the saved answer', async () => {
    getConversationMessages.mockResolvedValue(history([USER_ROW, ANSWER_ROW]))
    const s = resumed()
    expect(s.isStreaming).toBe(true)
    s._onEvent(finished('completed'))
    expect(s.isStreaming).toBe(false)                 // before history answers
    expect(notifyRunFinished).toHaveBeenCalledTimes(1)
    expect(notifyRunFinished).toHaveBeenCalledWith({ agentName: 'Helper', snippet: 'It reported', conversationId: '41' })
    await flush()
    expect(s.messages[s.messages.length - 1].content).toBe(ANSWER_ROW.content)
  })

  it('a frame with no status (an older backend) is a completed turn', async () => {
    getConversationMessages.mockResolvedValue(history([USER_ROW, ANSWER_ROW]))
    const s = resumed()
    s._onEvent(finished(undefined))
    expect(s.isStreaming).toBe(false)
    expect(notifyRunFinished).toHaveBeenCalledTimes(1)
  })

  it('stopped: settles at once and shows no notification', async () => {
    getConversationMessages.mockResolvedValue(history([USER_ROW, { id: 2, role: 'assistant', content: 'Stopped. Partial work so far.' }]))
    const s = resumed()
    s._onEvent(finished('stopped', { snippet: '' }))
    expect(s.isStreaming).toBe(false)
    expect(s._recovering).toBe(false)
    expect(notifyRunFinished).not.toHaveBeenCalled()
    await flush()
    expect(s.messages[s.messages.length - 1].content).toBe('Stopped. Partial work so far.')
  })

  it('error: settles at once as a failed reply and shows no notification', () => {
    getConversationMessages.mockResolvedValue(history([USER_ROW]))
    const s = resumed()
    s._onEvent(finished('error', { snippet: '' }))
    expect(s.isStreaming).toBe(false)
    const last = s.messages[s.messages.length - 1]
    expect(last.status).toBe('error')
    expect(last.error).toBe('Something went wrong.')
    expect(notifyRunFinished).not.toHaveBeenCalled()
  })

  it('empty: settles at once and shows no notification', async () => {
    getConversationMessages.mockResolvedValue(history([USER_ROW]))
    const s = resumed()
    s._onEvent(finished('empty', { snippet: '' }))
    expect(s.isStreaming).toBe(false)
    expect(notifyRunFinished).not.toHaveBeenCalled()
    await flush()
    expect(getConversationMessages).toHaveBeenCalled()   // it still looks once for a saved answer
  })

  it('the end of a different turn of this chat leaves the one on screen running', () => {
    const s = resumed({ turnId: 'turn-b' })
    s._onEvent(finished('stopped', { turn_id: 'turn-a' }))
    expect(s.isStreaming).toBe(true)
  })

  it('a frame with no turn_id still settles the turn', () => {
    getConversationMessages.mockResolvedValue(history([USER_ROW]))
    const s = resumed()
    s._onEvent(finished('empty', { turn_id: undefined }))
    expect(s.isStreaming).toBe(false)
  })

  it('the turn id is read from the turn\'s own streamed frames too', () => {
    const s = useChatStore()
    s.conversationId = 41
    s._beginAssistant()
    s._onEvent({ type: 'assistant_message_chunk', chunk: 'Working', turn_id: 'turn-b', message_id: 9 })
    s._onEvent(finished('completed', { turn_id: 'turn-a' }))
    expect(s.isStreaming).toBe(true)
    s._onEvent(finished('completed', { turn_id: 'turn-b' }))
    expect(s.isStreaming).toBe(false)
  })

  it('another conversation\'s end notifies only when completed and touches nothing on screen', () => {
    const s = resumed()
    s._onEvent(finished('completed', { conversation_id: '999' }))
    s._onEvent(finished('error', { conversation_id: '998' }))
    expect(notifyRunFinished).toHaveBeenCalledTimes(1)
    expect(notifyRunFinished.mock.calls[0][0].conversationId).toBe('999')
    expect(s.isStreaming).toBe(true)
  })

  it('a turn that ended on this socket is not notified twice', () => {
    const s = useChatStore()
    s.conversationId = 41
    s._beginAssistant()
    s._onEvent({ type: 'assistant_message_complete', full_message: 'Done.' })
    expect(s.isStreaming).toBe(false)
    expect(notifyRunFinished).not.toHaveBeenCalled()   // the end of the stream does not notify
    s._onEvent(finished('completed', { snippet: 'Done.' }))
    expect(notifyRunFinished).toHaveBeenCalledTimes(1)
  })
})
