// Reload / reconnect catch-up (backend phase 1b): a resumed turn asks for the run's events after the last one this
// page applied (`run_events_since`), applies `run_events_replay` events in `seq` order through the normal frame
// handling, never applies a `seq` twice, starts a new draft on `replace`, pages with `has_more`, and only logs
// `events_missing`.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

vi.mock('../services/api', () => ({
  default: { getConversationMessages: vi.fn(() => Promise.resolve({ data: { results: [] } })), getAgents: vi.fn(() => Promise.resolve({ data: [] })) },
}))

const chunk = (seq, text, replace = false) => ({
  seq, type: 'assistant_message_chunk', payload: {}, plan_version: 1, ts: null,
  frame: { type: 'assistant_message_chunk', chunk: text, ...(replace ? { replace: true } : {}) },
})

function resumed() {
  const chat = useChatStore()
  const send = vi.fn()
  chat._conn = { send, sendIfOpen: vi.fn() }
  chat.conversationId = '41'
  chat._startProgressPolling = vi.fn()
  chat._onEvent({ type: 'turn_resumed', conversation_id: '41', turn_id: 't1', progress: {} })
  return { chat, send }
}

beforeEach(() => setActivePinia(createPinia()))

describe('reload catch-up from the run log', () => {
  it('a resumed turn asks for the events after the last one applied (from 0 on a reload)', () => {
    const { send } = resumed()
    expect(send).toHaveBeenCalledWith({ type: 'run_events_since', conversation_id: '41', since_seq: 0 })
  })

  it('applies the events in seq order through the normal frame handling, dropping a seq already applied', () => {
    const { chat } = resumed()
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', last_seq: 3,
                    events: [chunk(2, ' world'), chunk(1, 'Hello', true), chunk(3, '!')] })
    expect(chat._cur().content).toBe('Hello world!')
    // The same events again (replay overlapping live): nothing is shown twice.
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', live: true, last_seq: 3,
                    events: [chunk(3, '!'), chunk(2, ' world')] })
    expect(chat._cur().content).toBe('Hello world!')
    // A live one after them is applied.
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', live: true, last_seq: 4, events: [chunk(4, ' Bye')] })
    expect(chat._cur().content).toBe('Hello world! Bye')
    expect(chat._runSeq['41']).toBe(4)
  })

  it('assistant_message_chunk with replace starts a new draft', () => {
    const { chat } = resumed()
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41',
                    events: [chunk(1, 'Draft one', true), chunk(2, 'Draft two', true)] })
    expect(chat._cur().content).toBe('Draft two')
  })

  it('a reconnect asks from the last applied seq, and a page from the start rebuilds the bubble', () => {
    const { chat, send } = resumed()
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', events: [chunk(1, 'Hi', true), chunk(2, ' there')] })
    send.mockClear()
    chat._onEvent({ type: 'turn_resumed', conversation_id: '41', turn_id: 't1', progress: {} })
    expect(send).toHaveBeenCalledWith({ type: 'run_events_since', conversation_id: '41', since_seq: 2 })
  })

  it('a dropped socket the page lived through (nothing applied from the log yet) is rebuilt, not doubled', () => {
    const { chat } = resumed()
    chat._cur().content = 'Hello'          // streamed live before the drop
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', events: [chunk(1, 'Hello', true), chunk(2, ' again')] })
    expect(chat._cur().content).toBe('Hello again')
  })

  it('has_more asks for the next page from the last seq received', () => {
    const { chat, send } = resumed()
    send.mockClear()
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', has_more: true, events: [chunk(1, 'a', true), chunk(2, 'b')] })
    expect(send).toHaveBeenCalledWith({ type: 'run_events_since', conversation_id: '41', since_seq: 2 })
  })

  it('events_missing shows nothing alarming: it is logged and the cursor moves past it', () => {
    const { chat } = resumed()
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41',
                    events: [chunk(1, 'ok', true), { seq: 2, type: 'events_missing', payload: { from: 2, to: 5 } }, chunk(6, '!')] })
    expect(chat._cur().content).toBe('ok!')
    expect(chat._cur().error || '').toBe('')
    expect(chat.error || '').toBe('')
    expect(info).toHaveBeenCalled()
    expect(chat._runSeq['41']).toBe(6)
    info.mockRestore()
  })

  it('a replay for another conversation is ignored', () => {
    const { chat } = resumed()
    chat._onEvent({ type: 'run_events_replay', conversation_id: '99', events: [chunk(1, 'not mine', true)] })
    expect(chat._cur().content).toBe('')
    expect(chat._runSeq['99']).toBeUndefined()
  })

  it('a replayed batch for a turn no longer on screen only moves the cursor (the history already shows it)', () => {
    const chat = useChatStore()
    chat.conversationId = '41'
    chat.messages = [{ id: 'a', role: 'assistant', content: 'Saved answer', status: 'done' }]
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', events: [chunk(1, 'Saved answer', true)] })
    expect(chat.messages).toHaveLength(1)
    expect(chat.messages[0].content).toBe('Saved answer')
    expect(chat._runSeq['41']).toBe(1)
  })

  it('a replayed frame that is a card (an approval) goes through the normal handling, once', () => {
    const { chat } = resumed()
    const card = { type: 'hitl_request', request_id: 'h1', summary: 'Approve?' }
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', events: [{ seq: 1, type: 'hitl_request', frame: card, payload: {} }] })
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', live: true, events: [{ seq: 1, type: 'hitl_request', frame: card, payload: {} }] })
    expect(chat.hitlRequests.map((r) => r.request_id)).toEqual(['h1'])
  })

  it('opening a conversation from history forgets its cursor, so the next catch-up starts from the beginning', () => {
    const chat = useChatStore()
    chat._runSeq = { 41: 12 }
    chat._forgetRunSeq('41')
    expect(chat._runSeq['41']).toBeUndefined()
  })
})
