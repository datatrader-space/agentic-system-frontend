// ADM-1221: several chats run at once. Leaving a chat whose turn is running (New chat, or opening another chat) never
// stops it: its socket stays open with a small handler of its own, and the next chat gets a socket of its own, since
// one socket runs one turn at a time. Opening the chat again takes its socket back and asks the server to resume the
// live stream; the turn's end (`run_finished`, sent to every socket of the person) closes the parked socket.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const h = vi.hoisted(() => ({ conns: [] }))

vi.mock('../services/api', () => ({
  default: {
    getConversation: vi.fn((id) => Promise.resolve({ data: { id, repository: 7, messages: [] } })),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
    getAgent: vi.fn(() => Promise.resolve({ data: {} })),
    getAgentCard: vi.fn(() => Promise.resolve({ data: {} })),
    get: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

vi.mock('../services/chatService', () => ({
  ChatConnection: class {
    constructor(cid, handlers) {
      this.conversationId = cid; this.handlers = handlers; this.repoId = 7; this.sent = []; this.closed = false
      h.conns.push(this)
    }
    connect(repo) { this.repoId = repo }
    setConversation(c) { this.conversationId = c }
    prewarm() {}
    sendIfOpen(obj) { this.sent.push(obj) }
    stop() { this.stopped = true }
    close() { this.closed = true }
  },
  browserTimeZone: () => 'UTC',
}))

import { useChatStore } from './useChatStore'

const flush = () => new Promise((r) => setTimeout(r, 0))

function busyChat(id) {
  const chat = useChatStore()
  chat.repoId = 7
  chat.conversationId = String(id)
  chat._connect()
  chat.isStreaming = true            // a turn is running in this chat
  return chat
}

beforeEach(() => {
  setActivePinia(createPinia())
  h.conns.length = 0
  vi.clearAllMocks()
})

describe('a running chat keeps going when the person leaves it (ADM-1221)', () => {
  it('New chat parks the running chat on its own socket instead of stopping it', () => {
    const chat = busyChat(1)
    const first = chat._conn
    chat.reset()
    expect(first.stopped).toBeUndefined()
    expect(first.closed).toBe(false)
    expect(chat._parked['1']).toBe(first)
    expect(chat.parkedRuns['1']).toBe('working')
    expect(chat._conn).toBe(null)
    expect(chat.isBusy).toBe(false)
    chat._connect()
    expect(chat._conn).not.toBe(first)            // the new chat runs on a socket of its own
  })

  it('New chat on an idle chat keeps the one socket, as before', () => {
    const chat = useChatStore()
    chat.repoId = 7
    chat.conversationId = '1'
    chat._connect()
    const conn = chat._conn
    chat.reset()
    expect(chat._conn).toBe(conn)
    expect(Object.keys(chat._parked)).toEqual([])
  })

  it('opening the parked chat again takes its socket back and asks to resume its live stream', async () => {
    const chat = busyChat(1)
    const first = chat._conn
    chat.reset()                                   // leave chat 1 running
    chat.conversationId = '2'
    chat._connect()
    const second = chat._conn
    await chat.openConversation('1')
    await flush()
    expect(chat._conn).toBe(first)
    expect(second.closed).toBe(true)               // chat 2 was idle: its socket closes
    expect(chat._parked['1']).toBeUndefined()
    expect(chat.parkedRuns['1']).toBeUndefined()   // seen: no dot any more
    expect(first.sent).toContainEqual({ type: 'resume', conversation_id: '1' })
    expect(typeof first.handlers.onOpen).toBe('function')
  })

  it('opening another chat while one runs parks the running one too', async () => {
    const chat = busyChat(1)
    const first = chat._conn
    await chat.openConversation('2')
    expect(chat._parked['1']).toBe(first)
    expect(first.closed).toBe(false)
    expect(chat.conversationId).toBe('2')
  })

  it("the parked turn's end closes its socket and marks the chat finished", () => {
    const chat = busyChat(1)
    const first = chat._conn
    chat.reset()
    first.handlers.onEvent({ type: 'run_finished', conversation_id: '2', status: 'completed' })
    expect(chat._parked['1']).toBe(first)          // another chat's end is not this one's
    first.handlers.onEvent({ type: 'run_finished', conversation_id: '1', status: 'completed' })
    expect(first.closed).toBe(true)
    expect(chat._parked['1']).toBeUndefined()
    expect(chat.parkedRuns['1']).toBe('done')
  })

  it('a failed turn is marked failed, and a question or an approval marks the chat as waiting', () => {
    const chat = busyChat(1)
    const first = chat._conn
    chat.reset()
    first.handlers.onEvent({ type: 'hitl_request', conversation_id: '1', request_id: 'r1' })
    expect(chat.parkedRuns['1']).toBe('needs_input')
    expect(chat.hitlRequests).toEqual([])          // the card belongs to chat 1, not to the chat on screen
    first.handlers.onEvent({ type: 'run_finished', conversation_id: '1', status: 'error' })
    expect(chat.parkedRuns['1']).toBe('failed')
  })

  it("a surface sees the parked chat's frames (Let's Code reloads its files after a background turn)", () => {
    const chat = busyChat(1)
    const first = chat._conn
    const seen = []
    chat.parkedFrameHandler = (id, msg) => seen.push([id, msg.type])
    chat.reset()
    first.handlers.onEvent({ type: 'lets_code_changes', files: [] })
    expect(seen).toEqual([['1', 'lets_code_changes']])
  })
})
