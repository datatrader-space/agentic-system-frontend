// @vitest-environment jsdom
// The shared reconnecting socket (page-speed plan Phase 3): full-jitter backoff capped at 30 s, never gives
// up, reconnects at once when the network or the tab comes back, and never reconnects after an intentional
// close or after its component's scope is gone.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { reconnectingSocket, reconnectDelay, RECONNECT_CAP_MS } from './reconnectingSocket'
import { chatAuthProtocols, CHAT_PROTOCOL } from './wsAuth'

class FakeSocket {
  static instances = []
  static OPEN = 1
  constructor(url, protocols) { this.url = url; this.protocols = protocols; this.readyState = 0; this.sent = []; FakeSocket.instances.push(this) }
  send(d) { this.sent.push(d) }
  close() { this.readyState = 3 }
  open() { this.readyState = 1; this.onopen?.() }
  drop() { this.readyState = 3; this.onclose?.({ code: 1006 }) }
}

let hidden = false
beforeEach(() => {
  vi.useFakeTimers()
  FakeSocket.instances = []
  globalThis.WebSocket = FakeSocket
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }
const last = () => FakeSocket.instances[FakeSocket.instances.length - 1]

describe('reconnectDelay', () => {
  it('is full jitter over a doubling ceiling, at least 250 ms, capped at 30 s', () => {
    expect(reconnectDelay(0, () => 0)).toBe(250)
    expect(reconnectDelay(0, () => 1)).toBe(1000)
    expect(reconnectDelay(3, () => 1)).toBe(8000)
    expect(reconnectDelay(3, () => 0.5)).toBe(4000)
    expect(RECONNECT_CAP_MS).toBe(30000)
    expect(reconnectDelay(50, () => 1)).toBe(30000)
  })
})

describe('reconnectingSocket', () => {
  it('reconnects after a drop with a growing backoff, and resets it once open', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const onMessage = vi.fn()
    const s = reconnectingSocket({ onMessage })
    s.connect(() => 'ws://h/ws/x/')
    await flush()
    expect(FakeSocket.instances).toHaveLength(1)
    last().open()
    expect(s.isOpen).toBe(true)
    last().onmessage({ data: '{"a":1}' })
    expect(onMessage).toHaveBeenCalledTimes(1)

    last().drop()                                   // attempt 0: up to 1 s
    await vi.advanceTimersByTimeAsync(999)
    expect(FakeSocket.instances).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(FakeSocket.instances).toHaveLength(2)
    last().drop()                                   // never opened, attempt 1: up to 2 s
    await vi.advanceTimersByTimeAsync(1999)
    expect(FakeSocket.instances).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(FakeSocket.instances).toHaveLength(3)
    last().open()                                   // healthy: backoff back to attempt 0
    last().drop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(FakeSocket.instances).toHaveLength(4)
    s.close()
  })

  it('never waits more than 30 s however many attempts fail', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const s = reconnectingSocket()
    s.connect(() => 'ws://h/ws/x/')
    await flush()
    for (let i = 0; i < 12; i++) { last().drop(); await vi.advanceTimersByTimeAsync(30000) }
    expect(FakeSocket.instances).toHaveLength(13)
    s.close()
  })

  it('does not reconnect after an intentional close', async () => {
    const onClose = vi.fn()
    const s = reconnectingSocket({ onClose })
    s.connect(() => 'ws://h/ws/x/')
    await flush()
    const sock = last()
    sock.open()
    s.close()
    sock.onclose?.({ code: 1000 })                  // the browser's close event for our own close
    await vi.advanceTimersByTimeAsync(120000)
    expect(FakeSocket.instances).toHaveLength(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(s.active).toBe(false)
  })

  it('does not reconnect once its scope is disposed (component unmounted)', async () => {
    const scope = effectScope()
    const s = scope.run(() => reconnectingSocket())
    s.connect(() => 'ws://h/ws/x/')
    await flush()
    last().open()
    scope.stop()
    last().onclose?.({ code: 1006 })
    await vi.advanceTimersByTimeAsync(120000)
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('opens nothing when closed while an async target (a token fetch) is still pending', async () => {
    let release
    const s = reconnectingSocket()
    s.connect(() => new Promise((r) => { release = r }))
    await flush()
    s.close()
    release('ws://h/ws/x/')
    await flush()
    expect(FakeSocket.instances).toHaveLength(0)
  })

  it('reconnects at once when the network comes back or the tab is visible again', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const s = reconnectingSocket()
    s.connect(() => 'ws://h/ws/x/')
    await flush()
    last().open()
    for (let i = 0; i < 5; i++) { last().drop(); await vi.advanceTimersByTimeAsync(30000) }
    const before = FakeSocket.instances.length
    last().drop()                                   // now waiting up to 30 s
    window.dispatchEvent(new Event('online'))
    await flush()
    expect(FakeSocket.instances).toHaveLength(before + 1)
    last().drop()
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(FakeSocket.instances).toHaveLength(before + 2)
    s.close()
    window.dispatchEvent(new Event('online'))
    await flush()
    expect(FakeSocket.instances).toHaveLength(before + 2)
  })

  it('a failing target is retried with the same backoff, and fresh each time', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const target = vi.fn().mockRejectedValueOnce(new Error('no token')).mockResolvedValue({ url: 'ws://h/ws/x/', protocols: ['p'] })
    const s = reconnectingSocket()
    s.connect(target)
    await flush()
    expect(FakeSocket.instances).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(target).toHaveBeenCalledTimes(2)
    expect(last().protocols).toEqual(['p'])
    s.close()
  })

  it('whenOpen resolves on open and rejects on a failed attempt or a timeout', async () => {
    const s = reconnectingSocket()
    s.connect(() => 'ws://h/ws/x/')
    await flush()
    const opened = s.whenOpen(15000)
    last().open()
    await expect(opened).resolves.toBe(last())
    last().drop()
    const failed = s.whenOpen(15000)
    await vi.advanceTimersByTimeAsync(1000)
    last().drop()                                   // the reconnect attempt fails before opening
    await expect(failed).rejects.toThrow()
    const timedOut = s.whenOpen(100)
    const assertion = expect(timedOut).rejects.toThrow('open-timeout')
    await vi.advanceTimersByTimeAsync(100)
    await assertion
    s.close()
  })

  it('send() writes only to an open socket', async () => {
    const s = reconnectingSocket()
    s.connect(() => 'ws://h/ws/x/')
    await flush()
    expect(s.send('x')).toBe(false)
    last().open()
    expect(s.send('y')).toBe(true)
    expect(last().sent).toEqual(['y'])
    s.close()
  })
})

describe('chatAuthProtocols', () => {
  it('carries the token as base64url in a subprotocol, beside the chat protocol', () => {
    const token = 'eyJhIjoxfQ:1tA2bC:sig-_x'
    const [chat, auth] = chatAuthProtocols(token)
    expect(chat).toBe(CHAT_PROTOCOL)
    expect(auth.startsWith('aadml.auth.')).toBe(true)
    const encoded = auth.slice('aadml.auth.'.length)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)      // a valid subprotocol token: no ':' '=' '/' '+'
    const decoded = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
    expect(decoded).toBe(token)
  })
})
