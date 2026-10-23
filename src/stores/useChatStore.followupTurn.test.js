// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

// A turn the SERVER starts has no bubble on the client, because this tab never sent a `chat_message`
// for it. The user typed while the agent was working, the turn ended before draining the steering
// queue, and the backend ran that message as its own follow-up turn.
//
// With no bubble open, `assistant_message_chunk` does `if (m) m.content += …` and silently drops every
// streamed token, and `assistant_message_complete` then falls back to `_lastAssistantOfTurn()` and
// OVERWRITES the previous turn's answer with this one's.
//
// Production conv 2163 (2026-09-30): 'hi' was answered (id 12219, "Hi! How can I help with your store
// today?") and 'what you can do' was queued and answered (id 12221). On screen the second answer had
// replaced the first, id 12219 rendered nowhere, and the "Queued · steering the running agent" chip was
// still spinning minutes later. Every row was correct in the database; only the render was wrong — which
// is precisely what made this read as "the queue is broken".
vi.mock('../services/api', () => ({ default: { getConversation: vi.fn() } }))

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('useChatStore — a turn the server started', () => {
  it('opens a NEW bubble so the answer does not overwrite the previous turn', () => {
    const chat = useChatStore()
    chat.conversationId = 2163
    // Turn 1 completed and its answer is on screen.
    chat._beginAssistant()
    chat._cur().content = 'Hi! How can I help with your store today?'
    chat._endAssistant()
    const firstAnswer = chat.messages.filter((m) => m.role === 'assistant').slice(-1)[0]

    chat._onEvent({ type: 'followup_turn_started', conversation_id: 2163 })
    chat._onEvent({ type: 'assistant_message_complete', full_message: 'I can help manage your store…' })

    expect(firstAnswer.content).toBe('Hi! How can I help with your store today?')
    const answers = chat.messages.filter((m) => m.role === 'assistant')
    expect(answers.length).toBe(2)
    expect(answers[1].content).toContain('I can help manage your store')
  })

  it('keeps the streamed tokens instead of dropping them on the floor', () => {
    const chat = useChatStore()
    chat.conversationId = 2163
    chat._onEvent({ type: 'followup_turn_started', conversation_id: 2163 })
    chat._onEvent({ type: 'assistant_message_chunk', chunk: 'streamed ' })
    chat._onEvent({ type: 'assistant_message_chunk', chunk: 'text' })
    expect(chat._cur().content).toBe('streamed text')
  })

  it('moves a taken-in steer INTO the running turn instead of leaving it below the answer', () => {
    // 2026-10-20: the steer stayed at the bottom of the thread (below the working run, so below the answer
    // it changed), and jumped above the answer on reload. It now becomes a line in the run's step list.
    const chat = useChatStore()
    chat.conversationId = 2163
    chat._beginAssistant()
    chat.messages.push({ id: 'u1', role: 'user', content: 'end with PINEAPPLE', queued: true })
    chat._onEvent({ type: 'steering_applied', message: 'end with PINEAPPLE' })
    expect(chat.messages.find((m) => m.id === 'u1')).toBeUndefined()
    const steer = chat.liveSteps.find((s) => s.isSteer)
    expect(steer && steer.label).toBe('end with PINEAPPLE')
  })

  it('keeps a SEPARATE request as its own waiting bubble, then answers it as its own turn', () => {
    // 2026-10-21, the owner's rule: only a message about the running work is taken in; a different request
    // waits for the run to finish and is answered on its own.
    const chat = useChatStore()
    chat.conversationId = 2163
    chat._beginAssistant()
    chat.messages.push({ id: 'u2', role: 'user', content: 'weather in Lahore?', queued: true })
    chat._onEvent({ type: 'steering_deferred', message: 'weather in Lahore?' })
    const bubble = chat.messages.find((m) => m.id === 'u2')
    expect(bubble).toMatchObject({ queued: true, queuedAfter: true })
    expect(chat.liveSteps.some((s) => s.isSteer)).toBe(false)

    chat._onEvent({ type: 'assistant_message_complete', full_message: 'Go releases …' })
    chat._onEvent({ type: 'followup_turn_started', conversation_id: 2163, messages: ['weather in Lahore?'] })
    expect(bubble).toMatchObject({ queued: false, queuedAfter: false })
    const roles = chat.messages.map((m) => m.role)
    expect(roles.slice(-2)).toEqual(['user', 'assistant'])   // its own answer opens below it
  })

  it('acts on the exact saved message, not on another with the same words', () => {
    // 2026-10-21 (P0-B): every frame now carries the saved row's id; two equal messages stay distinct.
    const chat = useChatStore()
    chat.conversationId = 2163
    chat._beginAssistant()
    chat.messages.push({ id: 'a', role: 'user', content: 'again', queued: true, clientMessageId: 'c-a' })
    chat.messages.push({ id: 'b', role: 'user', content: 'again', queued: true, clientMessageId: 'c-b' })
    chat._onEvent({ type: 'message_queued', conversation_id: '2163', message: 'again', message_id: 11, client_message_id: 'c-a' })
    chat._onEvent({ type: 'message_queued', conversation_id: '2163', message: 'again', message_id: 12, client_message_id: 'c-b' })
    chat._onEvent({ type: 'steering_deferred', message: 'again', message_id: 11 })
    expect(chat.messages.find((m) => m.id === 'a').queuedAfter).toBe(true)
    expect(chat.messages.find((m) => m.id === 'b').queuedAfter).toBeFalsy()
    chat._onEvent({ type: 'steering_applied', message: 'again', message_id: 12 })
    expect(chat.messages.find((m) => m.id === 'b')).toBeUndefined()
    expect(chat.messages.find((m) => m.id === 'a')).toBeTruthy()
  })

  it('gives the text of messages a Stop cancelled back to the message box', () => {
    const chat = useChatStore()
    chat.conversationId = 2163
    chat.messages.push({ id: 'w', role: 'user', content: 'weather in Lahore?', queued: true, serverId: 21 })
    const seen = []
    const onRestore = (e) => seen.push(e.detail.text)
    window.addEventListener('composer-restore', onRestore)
    chat._onEvent({ type: 'queued_messages_cancelled', conversation_id: '2163',
                    messages: [{ message_id: 21, text: 'weather in Lahore?' }] })
    window.removeEventListener('composer-restore', onRestore)
    expect(chat.messages.find((m) => m.id === 'w')).toBeUndefined()
    expect(seen).toEqual(['weather in Lahore?'])
  })

  it('ignores a follow-up meant for a conversation the user is no longer looking at', () => {
    const chat = useChatStore()
    chat.conversationId = 2163
    const before = chat.messages.length
    chat._onEvent({ type: 'followup_turn_started', conversation_id: 9999 })
    expect(chat.messages.length).toBe(before)
  })
})
