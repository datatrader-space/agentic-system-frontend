// F-H4: the chat socket never gives up, backs off with full jitter capped at 30 s, and a send on a dead
// socket connects at once.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ChatConnection, reconnectDelay, RECONNECT_CAP_MS, RECONNECT_LOST_AFTER } from './chatService'

const sockets = []
class FakeWS {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  constructor(url) { this.url = url; this.readyState = 0; this.sent = []; sockets.push(this) }
  send(p) { this.sent.push(JSON.parse(p)) }
  close() { this.readyState = 3; this.onclose?.() }
  open() { this.readyState = 1; this.onopen?.() }
  fail() { this.readyState = 3; this.onclose?.() }
}

beforeEach(() => {
  sockets.length = 0
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', FakeWS)
  vi.stubGlobal('window', { location: { protocol: 'http:', host: 'localhost' }, addEventListener() {}, removeEventListener() {} })
  vi.stubGlobal('document', { hidden: false, addEventListener() {}, removeEventListener() {} })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('reconnectDelay', () => {
  it('is full jitter: anywhere between the floor and the exponential ceiling', () => {
    expect(reconnectDelay(0, () => 0)).toBe(250)
    expect(reconnectDelay(3, () => 1)).toBe(8000)
    expect(reconnectDelay(3, () => 0.5)).toBe(4000)
  })
  it('is capped at 30 s however many attempts have failed', () => {
    expect(RECONNECT_CAP_MS).toBe(30000)
    expect(reconnectDelay(50, () => 1)).toBe(30000)
  })
})

describe('ChatConnection reconnect', () => {
  it('never gives up and never tells the person to refresh', () => {
    const onError = vi.fn()
    const conn = new ChatConnection(null, { onError })
    conn.connect(0)
    for (let i = 0; i < 25; i++) {
      sockets[sockets.length - 1].fail()
      vi.advanceTimersByTime(RECONNECT_CAP_MS)
    }
    expect(sockets.length).toBe(26)               // still trying after 25 failures
    expect(onError.mock.calls.flat().some((m) => /refresh/i.test(String(m)))).toBe(false)
  })

  it('reports "lost" after a few failures in a row, and "open" when it is back', () => {
    const onConnectionState = vi.fn()
    const conn = new ChatConnection(null, { onConnectionState })
    conn.connect(0)
    for (let i = 0; i < RECONNECT_LOST_AFTER; i++) {
      sockets[sockets.length - 1].fail()
      vi.advanceTimersByTime(RECONNECT_CAP_MS)
    }
    expect(onConnectionState).toHaveBeenCalledWith('lost')
    sockets[sockets.length - 1].open()
    expect(onConnectionState).toHaveBeenLastCalledWith('open')
  })

  it('a send on a dead socket connects at once with a fresh budget, and the message goes out on open', () => {
    const conn = new ChatConnection('5', {})
    conn.connect(0)
    sockets[0].fail()                             // backoff timer now pending
    for (let i = 0; i < 4; i++) { vi.advanceTimersByTime(RECONNECT_CAP_MS); sockets[sockets.length - 1].fail() }
    const before = sockets.length
    conn.sendMessage('hello', 7)
    expect(sockets.length).toBe(before + 1)       // connected now, not after the backoff
    expect(conn._reconnectAttempts).toBe(0)
    sockets[sockets.length - 1].open()
    expect(sockets[sockets.length - 1].sent.some((m) => m.type === 'chat_message' && m.message === 'hello')).toBe(true)
  })

  it('a send while the socket is still connecting just queues: no attempt is counted, no second socket', () => {
    const conn = new ChatConnection('5', {})
    conn.connect(0)
    conn.sendMessage('one', 7)
    conn.sendMessage('two', 7)
    expect(sockets.length).toBe(1)
    expect(conn._reconnectAttempts).toBe(0)
    sockets[0].open()
    expect(sockets[0].sent.filter((m) => m.type === 'chat_message').map((m) => m.message)).toEqual(['one', 'two'])
  })

  it('reconnectNow skips the pending backoff', () => {
    const conn = new ChatConnection(null, {})
    conn.connect(0)
    sockets[0].fail()
    expect(sockets.length).toBe(1)
    conn.reconnectNow()
    expect(sockets.length).toBe(2)
  })
})
