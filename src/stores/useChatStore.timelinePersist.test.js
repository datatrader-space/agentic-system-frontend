import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

// A finished run's step timeline is saved onto THE ANSWER ROW BY ID. The answer frame reaches the page
// before the server saves the answer; sent then, without an id, the server put it on "the newest answer":
// lost when the save was late (production conv 2881, 2026-10-20) or written onto the previous answer.
vi.mock('../services/api', () => ({ default: { getConversation: vi.fn() } }))

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

const sent = (chat) => chat._conn.send.mock.calls.map((c) => c[0]).filter((f) => f.type === 'persist_turn_meta')

describe('the run timeline is saved onto its own answer', () => {
  it('waits for message_saved, then sends it with that row id', () => {
    const chat = useChatStore()
    chat.conversationId = 2881
    chat._conn = { send: vi.fn() }
    chat._beginAssistant()
    const answer = chat._cur()
    answer.timeline = { steps: [{ stepId: 'a', label: 'Searching' }] }
    chat._persistTurnMeta(answer)
    expect(sent(chat)).toEqual([])                       // no id yet: nothing goes out
    chat._onEvent({ type: 'message_saved', message_id: 13878, conversation_id: 2881 })
    expect(sent(chat)).toEqual([{ type: 'persist_turn_meta', conversation_id: 2881, message_id: 13878,
                                  timeline: { steps: [{ stepId: 'a', label: 'Searching' }] } }])
  })

  it('sends at once when the row id is already known, and only once', () => {
    const chat = useChatStore()
    chat.conversationId = 2882
    chat._conn = { send: vi.fn() }
    const answer = { role: 'assistant', serverId: 13881, timeline: { steps: [] } }
    chat.messages.push(answer)
    chat._persistTurnMeta(answer)
    chat._onEvent({ type: 'message_saved', message_id: 13881, conversation_id: 2882 })
    expect(sent(chat).map((f) => f.message_id)).toEqual([13881])
  })
})
