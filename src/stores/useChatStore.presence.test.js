// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './useChatStore'

// Phase 8 run 3 (finding 41): "<agent> finished" was created for chat 1269 while it was open in a focused tab. The page
// tells the server which chat it shows and whether it is in front of the person (`chat_presence`); the server then
// skips the finished notification for that chat (backend agent/services/chat_presence.py).
vi.mock('../services/api', () => ({ default: { getConversation: vi.fn(), getConversationMessages: vi.fn(() => Promise.resolve({ data: { results: [] } })) } }))

let focused = true
let hidden = false
beforeEach(() => {
  setActivePinia(createPinia())
  focused = true
  hidden = false
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused)
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })
})
afterEach(() => vi.restoreAllMocks())

function store() {
  const chat = useChatStore()
  const sent = []
  chat._conn = { sendIfOpen: (f) => sent.push(f) }
  return { chat, sent: () => sent.filter((f) => f.type === 'chat_presence') }
}

describe('the page says which chat it shows to the person', () => {
  it('says it shows the open chat, once, and again only when that changes', () => {
    const { chat, sent } = store()
    chat.conversationId = '1269'
    chat._reportPresence()
    chat._reportPresence()
    expect(sent()).toEqual([{ type: 'chat_presence', conversation_id: '1269', viewing: true }])
    focused = false
    chat._reportPresence()
    expect(sent().at(-1)).toEqual({ type: 'chat_presence', conversation_id: '1269', viewing: false })
    focused = true
    hidden = true
    chat._reportPresence()
    expect(sent()).toHaveLength(2)   // still not in front of the person: nothing new to say
  })

  it('another chat opened is the one it shows; leaving every chat takes it back', () => {
    const { chat, sent } = store()
    chat.conversationId = '1'
    chat._reportPresence()
    chat.conversationId = '2'
    chat._reportPresence()
    chat.conversationId = null
    chat._reportPresence()
    expect(sent().map((f) => [f.conversation_id, f.viewing])).toEqual([['1', true], ['2', true], ['', false]])
  })

  it('a page that never showed a chat says nothing; a forced beat repeats what it shows', () => {
    const { chat, sent } = store()
    chat._reportPresence()
    expect(sent()).toEqual([])
    chat.conversationId = '7'
    chat._reportPresence()
    chat._reportPresence(true)
    expect(sent()).toHaveLength(2)
  })
})
