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

  it('clears the queued chip when the backend reports the steer was taken up', () => {
    const chat = useChatStore()
    chat.conversationId = 2163
    chat.messages.push({ id: 'u1', role: 'user', content: 'what you can do', queued: true })
    chat._onEvent({ type: 'steering_applied', message: 'what you can do' })
    expect(chat.messages.find((m) => m.id === 'u1').queued).toBe(false)
  })

  it('ignores a follow-up meant for a conversation the user is no longer looking at', () => {
    const chat = useChatStore()
    chat.conversationId = 2163
    const before = chat.messages.length
    chat._onEvent({ type: 'followup_turn_started', conversation_id: 9999 })
    expect(chat.messages.length).toBe(before)
  })
})
