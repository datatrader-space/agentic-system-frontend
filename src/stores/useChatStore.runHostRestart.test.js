// Run-host restart (backend phase 1d) and parked approvals (backend phase 2b), store level.
//
// Restart: `agent_status` reason RUN_HOST_RESTART keeps the turn running (bubble open, Stop stays) and nothing settles
// or errors it during the gap; RESUMED_AFTER_RESTART / `turn_resumed` with `after_restart` continue the SAME bubble.
// Parked: a `hitl_request` with `payload.parked` is an ordinary card for its conversation, with no clock, that never
// makes the chat claim a turn runs; answering it opens the bubble of the turn that continues the run.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

vi.mock('../services/api', () => ({
  default: {
    getConversationMessages: vi.fn(() => Promise.resolve({ data: { results: [{ role: 'user', content: 'go' }] } })),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
  },
}))

const RESTART = {
  type: 'agent_status', phase: 'restarting', reason: 'RUN_HOST_RESTART',
  label: 'The service is restarting. This run continues from here in a moment.',
  conversation_id: '41', via_user_group: true,
}

function streaming() {
  const chat = useChatStore()
  chat._conn = { send: vi.fn(), sendIfOpen: vi.fn(), sendHitlResponse: vi.fn() }
  chat.conversationId = '41'
  chat._beginAssistant()
  chat._onEvent({ type: 'assistant_message_chunk', chunk: 'Working on it. ' })
  return chat
}

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => { vi.useRealTimers() })

describe('run host restart', () => {
  it('keeps the turn running and shows the restart line', () => {
    const chat = streaming()
    const bubble = chat._cur()
    chat._onEvent(RESTART)
    expect(chat.runHostRestarting).toBe(true)
    expect(chat.isStreaming).toBe(true)
    expect(chat._cur()).toBe(bubble)
    expect(bubble.status).toBe('streaming')
    expect(chat.liveStatus.reason).toBe('RUN_HOST_RESTART')
    const row = chat.liveSteps[chat.liveSteps.length - 1]
    expect(row.label).toContain('The service is restarting')
    expect(row.status).toBe('running')
  })

  it('a "nothing runs" answer during the restart neither errors nor settles the turn', () => {
    const chat = streaming()
    chat._onEvent(RESTART)
    chat._onEvent({ type: 'turn_not_running', conversation_id: '41', interrupted: true })
    expect(chat.isStreaming).toBe(true)
    expect(chat._cur().status).toBe('streaming')
    chat._progressTimer = 1
    chat._onEvent({ type: 'turn_progress', conversation_id: '41', progress: {}, interrupted: true })
    expect(chat.isStreaming).toBe(true)
    expect(chat._cur().error).toBe('')
  })

  it('the silence watchdog waits through the restart gap', () => {
    vi.useFakeTimers()
    const chat = streaming()
    chat._onEvent(RESTART)
    const recover = vi.spyOn(chat, '_recoverAfterReconnect').mockImplementation(() => {})
    vi.advanceTimersByTime(5 * 60 * 1000)          // five minutes of silence: a healthy restart
    expect(recover).not.toHaveBeenCalled()
    expect(chat.isStreaming).toBe(true)
    vi.advanceTimersByTime(6 * 60 * 1000)          // past the restart backstop: it goes and looks
    expect(recover).toHaveBeenCalled()
  })

  it('recovery never settles a turn whose run host is restarting', async () => {
    vi.useFakeTimers()
    const chat = streaming()
    chat._onEvent(RESTART)
    const p = chat._recover()
    await vi.advanceTimersByTimeAsync(100000)     // longer than the 90 s the loop waits for an answer
    await p
    chat._stopDeafWatchdog()
    expect(chat.isStreaming).toBe(true)
    expect(chat._cur().status).toBe('streaming')
  })

  it('resumes into the same bubble on RESUMED_AFTER_RESTART and turn_resumed after_restart', () => {
    const chat = streaming()
    const bubble = chat._cur()
    chat._onEvent(RESTART)
    chat._onEvent({ type: 'turn_resumed', conversation_id: '41', turn_id: '', status: 'Continuing after the restart',
                    after_restart: true, via_user_group: true })
    expect(chat.runHostRestarting).toBe(false)
    expect(chat._cur()).toBe(bubble)
    expect(chat._progressTimer).toBe(null)        // nothing to poll: the host sends every frame
    chat._onEvent({ type: 'agent_status', phase: 'resuming', reason: 'RESUMED_AFTER_RESTART',
                    label: 'Continuing after the restart, from where the run stopped', conversation_id: '41',
                    via_user_group: true })
    chat._onEvent({ type: 'assistant_message_chunk', chunk: 'Done.', conversation_id: '41', via_user_group: true })
    expect(bubble.content).toBe('Working on it. Done.')
    expect(chat.isStreaming).toBe(true)
  })

  it('a page that was idle when the restart status arrives gets a running bubble', () => {
    const chat = useChatStore()
    chat._conn = { send: vi.fn(), sendIfOpen: vi.fn() }
    chat.conversationId = '41'
    chat._onEvent(RESTART)
    expect(chat.isStreaming).toBe(true)
    expect(chat._cur().status).toBe('streaming')
  })

  it("another conversation's restart status never reaches the open chat", () => {
    const chat = streaming()
    chat._onEvent({ ...RESTART, conversation_id: '99' })
    expect(chat.runHostRestarting).toBe(false)
  })

  it('the restart flag clears when the turn ends', () => {
    const chat = streaming()
    chat._onEvent(RESTART)
    chat._endAssistant()
    expect(chat.runHostRestarting).toBe(false)
  })
})

const PARKED = {
  type: 'hitl_request', request_id: 'r1', interaction_type: 'approval', response_type: 'binary',
  summary: 'Send the report', urgency: 'high', timeout_at: null, conversation_id: '41', agent_id: 3,
  payload: { kind: 'tool_approval', tool_name: 'EMAIL_SEND', tool_label: 'Sending an email', parked: true,
             session_approval: false, conversation_id: '41' },
}

describe('parked approvals', () => {
  it('shows the card for its conversation with no clock, without claiming a turn runs', () => {
    const chat = useChatStore()
    chat._conn = { send: vi.fn(), sendIfOpen: vi.fn(), sendHitlResponse: vi.fn() }
    chat.conversationId = '41'
    chat._onEvent(PARKED)
    expect(chat.hitlRequests).toHaveLength(1)
    expect(chat.hitlRequests[0].parked).toBe(true)
    expect(chat.hitlRequests[0].timeout_at).toBe(null)
    expect(chat.hitlRequests[0].payload.session_approval).toBe(false)
    expect(chat.isStreaming).toBe(false)
    expect(chat.awaitingApproval).toBe(false)
  })

  it("a parked card for another conversation is not rendered into the open chat", () => {
    const chat = useChatStore()
    chat.conversationId = '41'
    chat._onEvent({ ...PARKED, conversation_id: '77', payload: { ...PARKED.payload, conversation_id: '77' } })
    expect(chat.hitlRequests).toHaveLength(0)
  })

  it("an MCP client's approval (conversation 'mcp:<session>') is never rendered into a chat", () => {
    const chat = useChatStore()
    chat._conn = { send: vi.fn(), sendIfOpen: vi.fn() }
    const mcp = { ...PARKED, request_id: 'm1', conversation_id: 'mcp:abc', via_user_group: true,
                  payload: { kind: 'tool_approval', tool_name: 'X', conversation_id: 'mcp:abc' } }
    chat.conversationId = '41'
    chat._onEvent(mcp)
    expect(chat.hitlRequests).toHaveLength(0)
    chat.conversationId = null                        // a new chat, before its first message
    chat._onEvent({ ...mcp, via_user_group: false })
    expect(chat.hitlRequests).toHaveLength(0)
    expect(chat.isStreaming).toBe(false)
  })

  it('does not hold a turn on screen open', () => {
    const chat = streaming()
    chat._onEvent(PARKED)
    chat._endAssistant()
    expect(chat.isStreaming).toBe(false)
    expect(chat.hitlRequests).toHaveLength(1)   // the card stays until answered
  })

  it('is answered with the usual hitl_response, and the continuing turn gets its own bubble', () => {
    const chat = useChatStore()
    chat._conn = { send: vi.fn(), sendIfOpen: vi.fn(), sendHitlResponse: vi.fn() }
    chat.conversationId = '41'
    chat.messages.push({ id: 'a0', role: 'assistant', content: 'Earlier answer', status: 'done' })
    chat._onEvent(PARKED)
    chat.respondHitl({ request_id: 'r1', response_value: true, feedback: '' })
    expect(chat._conn.sendHitlResponse).toHaveBeenCalledWith('r1', true, '')
    expect(chat.hitlRequests).toHaveLength(0)
    expect(chat.isStreaming).toBe(true)
    chat._onEvent({ type: 'assistant_message_chunk', chunk: 'Sent.', conversation_id: '41', via_user_group: true })
    expect(chat._cur().content).toBe('Sent.')
    expect(chat.messages[0].content).toBe('Earlier answer')
  })

  it('an ordinary (hosted) card still keeps the turn alive', () => {
    const chat = streaming()
    chat._onEvent({ ...PARKED, request_id: 'r2', payload: { kind: 'tool_approval', tool_name: 'X', session_approval: true } })
    expect(chat.awaitingApproval).toBe(true)
    chat._endAssistant()
    expect(chat.isStreaming).toBe(true)
  })
})
