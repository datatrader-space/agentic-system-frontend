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

describe('useChatStore — a plan decision is acted on only in its own chat (release check F13, 2026-11-23)', () => {
  // One plan-mode reply became three new chats: every OTHER open tab of the person with no chat open took the plan
  // event and resumed the plan on its own socket, which created a new chat with the reply in it.
  const event = (extra) => ({ type: 'plan_event', conversation_id: '3391', plan_id: 'p', run_id: 'r', ...extra })
  const tab = (conversationId, withUserMessage = true) => {
    const chat = useChatStore()
    chat.conversationId = conversationId
    if (withUserMessage) chat.messages.push({ id: 'u1', role: 'user', content: 'Build the store' })
    const sendMessage = vi.fn()
    chat._conn = { sendMessage, send: vi.fn(), sendIfOpen: vi.fn() }
    return { chat, sendMessage }
  }

  it('a tab with no chat open sends nothing for a change request or an approval', () => {
    const { sendMessage } = tab(null)
    useChatStore()._onEvent(event({ change_type: 'changes_requested', feedback: 'Also add a usage section', event_id: 'a' }))
    useChatStore()._onEvent(event({ change_type: 'approved', event_id: 'b' }))
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('a tab on another chat sends nothing', () => {
    const { sendMessage } = tab(3392)
    useChatStore()._onEvent(event({ change_type: 'changes_requested', feedback: 'Also add a usage section', event_id: 'c' }))
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('a decision with no conversation named is acted on nowhere', () => {
    const { sendMessage } = tab(3391)
    useChatStore()._onEvent({ type: 'plan_event', change_type: 'approved', event_id: 'd', plan_id: 'p', run_id: 'r' })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('the chat the plan belongs to still resumes it', () => {
    const { sendMessage } = tab(3391)
    useChatStore()._onEvent(event({ change_type: 'changes_requested', feedback: 'Also add a usage section', event_id: 'e' }))
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage.mock.calls[0][0]).toBe('Also add a usage section')
  })

  it('a resume asked of a tab with no chat of its own sends nothing', () => {
    const { chat, sendMessage } = tab(null)
    chat._resumeAfterPlan()
    chat._resumeAfterRevise('anything')
    expect(sendMessage).not.toHaveBeenCalled()
  })
})

describe('useChatStore — a resumed turn does not show the message twice (release check F14, 2026-11-23)', () => {
  it("the tab's own bubble takes the server id instead of a second bubble", () => {
    const chat = useChatStore()
    chat.conversationId = 3408
    chat.messages.push({ id: 'mine', role: 'user', content: 'Remember: my store ships only within Pakistan.',
                         serverId: null, status: 'done' })
    chat._onEvent({ type: 'turn_started', conversation_id: '3408', message_id: 16768,
                    message: 'Remember: my store ships only within Pakistan.' })
    const users = chat.messages.filter((m) => m.role === 'user')
    expect(users.length).toBe(1)
    expect(users[0].serverId).toBe(16768)
  })

  it('another tab without the bubble still shows the message once', () => {
    const chat = useChatStore()
    chat.conversationId = 3408
    chat._onEvent({ type: 'turn_started', conversation_id: '3408', message_id: 16768, message: 'hello' })
    chat._onEvent({ type: 'turn_started', conversation_id: '3408', message_id: 16768, message: 'hello' })
    expect(chat.messages.filter((m) => m.role === 'user').length).toBe(1)
  })
})
