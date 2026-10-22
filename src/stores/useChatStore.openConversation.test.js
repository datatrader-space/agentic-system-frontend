// F-C3: fast chat switching must never show the wrong chat; re-opening a chat whose load failed loads it
// again; the reconnect recovery loop stops when the person opens another chat.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const h = vi.hoisted(() => ({ pending: new Map() }))

vi.mock('../services/api', () => ({
  default: {
    getConversation: vi.fn((id) => new Promise((resolve, reject) => { h.pending.set(String(id), { resolve, reject }) })),
    getAgents: vi.fn(() => Promise.resolve({ data: [] })),
    getAgent: vi.fn(() => Promise.resolve({ data: {} })),
    getAgentCard: vi.fn(() => Promise.resolve({ data: {} })),
    get: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

vi.mock('../services/chatService', () => ({
  ChatConnection: class {
    constructor(cid) { this.conversationId = cid; this.repoId = 0 }
    connect() {}
    setConversation(c) { this.conversationId = c }
    prewarm() {}
    sendIfOpen() {}
    reconnectNow() { this.reconnected = true }
    close() {}
  },
  browserTimeZone: () => 'UTC',
}))

import { useChatStore } from './useChatStore'
import api from '../services/api'

const conv = (id, text) => ({ data: { id, messages: [{ id: Number(id) * 10, role: 'assistant', content: text }] } })
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  setActivePinia(createPinia())
  h.pending.clear()
  vi.clearAllMocks()
})

describe('openConversation — stale responses (F-C3)', () => {
  it('a slow response for chat A never lands in chat B', async () => {
    const chat = useChatStore()
    const a = chat.openConversation('1')
    const b = chat.openConversation('2')
    h.pending.get('2').resolve(conv('2', 'from B'))
    await b
    h.pending.get('1').resolve(conv('1', 'from A'))
    await a
    expect(chat.conversationId).toBe('2')
    expect(chat.messages.map((m) => m.content)).toEqual(['from B'])
    expect(chat.loadingHistory).toBe(false)
  })

  it('a failed load of chat A does not put an error on chat B', async () => {
    const chat = useChatStore()
    const a = chat.openConversation('1')
    const b = chat.openConversation('2')
    h.pending.get('1').reject(new Error('boom'))
    await a
    expect(chat.error).toBe('')
    expect(chat.loadingHistory).toBe(true)        // B is still loading
    h.pending.get('2').resolve(conv('2', 'B'))
    await b
    expect(chat.loadingHistory).toBe(false)
  })
})

describe('openConversation — retry after a failed load (F-C3)', () => {
  it('re-opening the same chat after a failure loads it again, even with a socket open', async () => {
    const chat = useChatStore()
    chat._conn = { setConversation() {}, connect() {}, prewarm() {}, repoId: 0 }
    const first = chat.openConversation('7')
    h.pending.get('7').reject(new Error('network'))
    await first
    expect(chat.error).toBe('Failed to load conversation')
    expect(api.getConversation).toHaveBeenCalledTimes(1)

    const second = chat.openConversation('7')
    expect(api.getConversation).toHaveBeenCalledTimes(2)
    h.pending.get('7').resolve(conv('7', 'loaded'))
    await second
    expect(chat.messages.map((m) => m.content)).toEqual(['loaded'])
    expect(chat.error).toBe('')
  })

  it('a successfully loaded chat is not reloaded when opened again', async () => {
    const chat = useChatStore()
    const p = chat.openConversation('8')
    h.pending.get('8').resolve(conv('8', 'x'))
    await p
    await chat.openConversation('8')
    expect(api.getConversation).toHaveBeenCalledTimes(1)
  })

  it('a second open while the first is still loading does not start another request', async () => {
    const chat = useChatStore()
    const p = chat.openConversation('9')
    chat.openConversation('9')
    expect(api.getConversation).toHaveBeenCalledTimes(1)
    h.pending.get('9').resolve(conv('9', 'x'))
    await p
  })
})

describe('reconnect recovery stops on a chat switch (F-C3)', () => {
  it('stops polling history for the old chat once another is open', async () => {
    const chat = useChatStore()
    chat.conversationId = '3'
    chat.isStreaming = true
    const run = chat._recover()
    await flush()
    expect(api.getConversation).toHaveBeenCalledWith('3')
    chat.conversationId = '4'                     // the person opened another chat
    h.pending.get('3').resolve({ data: { messages: [] } })
    await run
    expect(api.getConversation).toHaveBeenCalledTimes(1)   // no further reads for chat 3
  })
})

describe('Reconnect now', () => {
  it('asks the socket to connect immediately', () => {
    const chat = useChatStore()
    const conn = { reconnectNow: vi.fn() }
    chat._conn = conn
    chat.reconnectNow()
    expect(conn.reconnectNow).toHaveBeenCalled()
  })

  it('connectionLost follows the socket state', () => {
    const chat = useChatStore()
    const handlers = chat._connectionHandlers()
    handlers.onConnectionState('lost')
    expect(chat.connectionLost).toBe(true)
    handlers.onConnectionState('open')
    expect(chat.connectionLost).toBe(false)
  })
})
