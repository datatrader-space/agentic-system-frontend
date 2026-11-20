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

// An event exactly as the server sends it (`run_coordinator.services.run_events.entry`): `type` is the stored type,
// `frame` the frame's type, `payload` the frame as the page drew it.
const chunk = (seq, text, replace = false) => ({
  seq, type: 'runtime.assistant_message_chunk', plan_version: 1, ts: null, frame: 'assistant_message_chunk',
  payload: { type: 'assistant_message_chunk', chunk: text, ...(replace ? { replace: true } : {}) },
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

  it('a followed run\'s live copy of text that already streamed here is not drawn twice (phase 8 run 5)', () => {
    const { chat } = resumed()
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', last_seq: 1, events: [chunk(1, 'Plan:', true)] })
    // The next round streams here as it is typed (work_stream), then its stored, joined copy arrives on the follow.
    chat._onEvent({ type: 'assistant_message_chunk', conversation_id: '41', chunk: 'Got', replace: true })
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', live: true, last_seq: 2,
                    events: [chunk(2, 'Got it, building in the root.', true)] })
    chat._onEvent({ type: 'assistant_message_chunk', conversation_id: '41', chunk: ' it, building in the root.' })
    expect(chat._cur().content).toBe('Got it, building in the root.')
    expect(chat._runSeq['41']).toBe(2)                       // the cursor still moves past it
    // A card from the follow is still drawn: only the typed text is the page's own already.
    const card = { seq: 3, type: 'runtime.hitl_request', frame: 'hitl_request',
                   payload: { type: 'hitl_request', request_id: 'h9', summary: 'Run npx?', conversation_id: '41' } }
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', live: true, last_seq: 3, events: [card] })
    expect(chat.hitlRequests.map((r) => r.request_id)).toEqual(['h9'])
  })

  it('a page that opens on a running turn counts its time from the turn\'s start, through the catch-up (phase 8 run 5)', () => {
    const chat = useChatStore()
    chat._conn = { send: vi.fn(), sendIfOpen: vi.fn() }
    chat.conversationId = '41'
    chat._startProgressPolling = vi.fn()
    const t0 = Date.now()
    chat._onEvent({ type: 'turn_resumed', conversation_id: '41', turn_id: 't1', progress: { elapsed_seconds: 300 } })
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', last_seq: 1, events: [chunk(1, 'Working', true)] })
    const ran = t0 - chat.liveStartedAt
    expect(ran).toBeGreaterThanOrEqual(299000)
    expect(ran).toBeLessThan(302000)
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
    const ev = { seq: 1, type: 'runtime.hitl_request', frame: 'hitl_request', payload: card }
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', events: [ev] })
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', live: true, events: [ev] })
    expect(chat.hitlRequests.map((r) => r.request_id)).toEqual(['h1'])
  })

  it('a reload rebuilds the whole turn from the server-shaped log: every step, nothing doubled (finding 30)', () => {
    const { chat } = resumed()
    const call = (seq, id, tool) => ({ seq, type: 'runtime.tool_call', frame: 'tool_call',
                                      payload: { type: 'tool_call', tool, tool_call_id: id } })
    const result = (seq, id, tool) => ({ seq, type: 'runtime.tool_result', frame: 'tool_result',
                                        payload: { type: 'tool_result', tool, tool_call_id: id, success: true } })
    const lifecycle = { seq: 3, type: 'plan_created', payload: { plan_id: 'p' } }
    const events = [call(1, 'a', 'CODE_READ_FILE'), result(2, 'a', 'CODE_READ_FILE'), lifecycle,
                    call(4, 'b', 'CODE_CREATE_FILE'), result(5, 'b', 'CODE_CREATE_FILE'), chunk(6, 'Working on it', true)]
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', last_seq: 6, events })
    expect(chat._cur().toolCalls.map((t) => t.name)).toEqual(['CODE_READ_FILE', 'CODE_CREATE_FILE'])
    expect(chat._cur().content).toBe('Working on it')
    // The same events again, live (the follow overlaps the read): nothing is drawn twice.
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', live: true, last_seq: 6, events })
    expect(chat._cur().toolCalls).toHaveLength(2)
    expect(chat._runSeq['41']).toBe(6)
  })

  it('a reload redraws an open card from the log and drops an answered one (finding 30)', () => {
    const { chat } = resumed()
    const card = (seq, id) => ({ seq, type: 'runtime.hitl_request', frame: 'hitl_request',
                                 payload: { type: 'hitl_request', request_id: id, summary: 'Run npm install?',
                                            payload: { kind: 'tool_approval' }, conversation_id: '41' } })
    const done = { seq: 2, type: 'runtime.hitl_resolved', frame: 'hitl_resolved',
                   payload: { type: 'hitl_resolved', request_id: 'h1', status: 'completed' } }
    chat._onEvent({ type: 'run_events_replay', conversation_id: '41', last_seq: 3, events: [card(1, 'h1'), done, card(3, 'h2')] })
    expect(chat.hitlRequests.map((r) => r.request_id)).toEqual(['h2'])
  })

  it('opening a conversation from history forgets its cursor, so the next catch-up starts from the beginning', () => {
    const chat = useChatStore()
    chat._runSeq = { 41: 12 }
    chat._forgetRunSeq('41')
    expect(chat._runSeq['41']).toBeUndefined()
  })
})
