// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore, PLAN_APPROVED_CONTINUE } from './useChatStore'

// Phase 8 run 2 (ADM-1221), conversation 1268: what a chat tab shows of a run's state.
vi.mock('../services/api', () => ({ default: { getConversation: vi.fn() } }))

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('useChatStore — a turn another tab started (finding 14)', () => {
  it('shows the person\'s message and follows the turn from its first frame', () => {
    const chat = useChatStore()
    chat.conversationId = 1268
    chat._onEvent({ type: 'turn_started', conversation_id: '1268', message_id: 4783, message: 'Add a wishlist',
                    kind: 'message', via_user_group: true })
    const user = chat.messages.find((m) => m.role === 'user')
    expect(user.content).toBe('Add a wishlist')
    expect(user.serverId).toBe(4783)
    expect(chat.isStreaming).toBe(true)
    chat._onEvent({ type: 'assistant_message_chunk', chunk: 'Planning', conversation_id: '1268', via_user_group: true })
    expect(chat._cur().content).toBe('Planning')
  })

  it('the tab that sent the message already follows it: nothing is added twice', () => {
    const chat = useChatStore()
    chat.conversationId = 1268
    chat.messages.push({ id: 'u1', role: 'user', content: 'Add a wishlist', serverId: 4783 })
    chat._beginAssistant()
    const before = chat.messages.length
    chat._onEvent({ type: 'turn_started', conversation_id: '1268', message_id: 4783, message: 'Add a wishlist' })
    expect(chat.messages.length).toBe(before)
  })

  it('a turn of another chat is not shown here', () => {
    const chat = useChatStore()
    chat.conversationId = 1268
    chat._onEvent({ type: 'turn_started', conversation_id: '9', message_id: 1, message: 'other', via_user_group: true })
    expect(chat.messages.length).toBe(0)
    expect(chat.isStreaming).toBe(false)
  })

  it('an approval that started the turn shows as the approval, never as the person\'s words', () => {
    const chat = useChatStore()
    chat.conversationId = 1268
    chat._onEvent({ type: 'turn_started', conversation_id: '1268', message_id: 5, message: PLAN_APPROVED_CONTINUE,
                    kind: 'plan_approval' })
    expect(chat.messages[0].kind).toBe('plan_approval')
  })
})

describe('useChatStore — a plan answered in its own run (finding 3)', () => {
  it('sends nothing: the run that waited on the card carries the plan out', () => {
    const chat = useChatStore()
    chat.conversationId = 1268
    chat._beginAssistant()
    const sendMessage = vi.fn()
    chat._conn = { sendMessage, send: vi.fn(), sendIfOpen: vi.fn() }
    const before = chat.messages.length
    chat._onEvent({ type: 'plan_event', conversation_id: '1268', change_type: 'approved', answered_in_run: true,
                    event_id: 'e1', plan_id: 'p', run_id: 'r' })
    chat._onEvent({ type: 'plan_event', conversation_id: '1268', change_type: 'changes_requested',
                    answered_in_run: true, feedback: 'add a contact page', event_id: 'e2', plan_id: 'p', run_id: 'r' })
    expect(sendMessage).not.toHaveBeenCalled()
    expect(chat.messages.length).toBe(before)
    expect(chat.messages.some((m) => m.kind === 'plan_approval')).toBe(false)
    expect(chat.isStreaming).toBe(true)
  })

  it('an approval from another surface still starts the turn that carries the plan out', () => {
    const chat = useChatStore()
    chat.conversationId = 1268
    chat.messages.push({ id: 'u1', role: 'user', content: 'Build the store' })
    const sendMessage = vi.fn()
    chat._conn = { sendMessage, send: vi.fn(), sendIfOpen: vi.fn() }
    chat._onEvent({ type: 'plan_event', conversation_id: '1268', change_type: 'approved', event_id: 'e3',
                    plan_id: 'p', run_id: 'r' })
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(chat.messages.find((m) => m.kind === 'plan_approval')).toBeTruthy()
  })
})
