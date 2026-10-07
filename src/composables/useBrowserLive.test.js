// @vitest-environment jsdom
// The live view's socket, against a fake WebSocket.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createBrowserLive, liveUrl } from './useBrowserLive'

class FakeSocket {
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.sent = []
    FakeSocket.all.push(this)
  }
  send(text) { this.sent.push(JSON.parse(text)) }
  close() { this.readyState = 3 }
  // test helpers
  opens() { this.readyState = 1; this.onopen && this.onopen() }
  says(obj) { this.onmessage({ data: JSON.stringify(obj) }) }
  shows(header, body = [0xff, 0xd8, 0xff]) {
    const head = new TextEncoder().encode(JSON.stringify(header))
    const out = new Uint8Array(4 + head.length + body.length)
    new DataView(out.buffer).setUint32(0, head.length)
    out.set(head, 4); out.set(body, 4 + head.length)
    this.onmessage({ data: out.buffer })
  }
  drops(code = 1006) { this.readyState = 3; this.onclose({ code }) }
}
FakeSocket.all = []

const make = () => {
  const seen = { frames: [], status: [], sessions: [], ends: [] }
  const live = createBrowserLive({
    onFrame: (header, jpeg) => seen.frames.push([header, jpeg.byteLength]),
    onStatus: (phase, code) => seen.status.push(code ? `${phase}:${code}` : phase),
    onSession: (card) => seen.sessions.push(card),
    onEnd: (reason) => seen.ends.push(reason),
  }, { WebSocketImpl: FakeSocket })
  return { live, seen }
}

beforeEach(() => { FakeSocket.all = []; vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('the address', () => {
  it('is same-origin, secure when the page is, and carries no token', () => {
    expect(liveUrl('bs_1', { protocol: 'https:', host: 'aadml.com' })).toBe('wss://aadml.com/ws/browser/bs_1/live/')
    expect(liveUrl('a/b', { protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173/ws/browser/a%2Fb/live/')
  })
})

describe('what arrives', () => {
  it('a hello and every state change carry the card', () => {
    const { live, seen } = make()
    live.connect('bs_1')
    const ws = FakeSocket.all[0]
    ws.opens()
    ws.says({ t: 'hello', v: 1, session: { session_id: 'bs_1', state: 'ACTIVE' } })
    ws.says({ t: 'state', session: { session_id: 'bs_1', state: 'WAITING_HUMAN' } })
    expect(seen.sessions.map((s) => s.state)).toEqual(['ACTIVE', 'WAITING_HUMAN'])
  })

  it('a frame is handed on and acknowledged', () => {
    const { live, seen } = make()
    live.connect('bs_1')
    const ws = FakeSocket.all[0]
    ws.opens()
    ws.shows({ t: 'frame', seq: 1, w: 1440, h: 900 })
    expect(seen.frames).toEqual([[{ t: 'frame', seq: 1, w: 1440, h: 900 }, 3]])
    expect(ws.sent).toEqual([{ t: 'ack' }])
  })

  it('a message that is not a frame is still acknowledged, so the next one is not held back', () => {
    const { live, seen } = make()
    live.connect('bs_1')
    const ws = FakeSocket.all[0]
    ws.opens()
    ws.onmessage({ data: new ArrayBuffer(2) })
    expect(seen.frames).toEqual([])
    expect(ws.sent).toEqual([{ t: 'ack' }])
  })

  it('status is passed through with its reason', () => {
    const { live, seen } = make()
    live.connect('bs_1')
    const ws = FakeSocket.all[0]
    ws.opens()
    ws.says({ t: 'status', phase: 'live' })
    ws.says({ t: 'status', phase: 'unavailable', code: 'NOT_RUNNING' })
    expect(seen.status).toEqual(['connecting', 'live', 'unavailable:NOT_RUNNING'])
  })

  it('a handler that throws does not take the socket down', () => {
    const live = createBrowserLive({ onSession: () => { throw new Error('boom') } }, { WebSocketImpl: FakeSocket })
    live.connect('bs_1')
    const ws = FakeSocket.all[0]
    ws.opens()
    expect(() => ws.says({ t: 'hello', session: {} })).not.toThrow()
  })
})

describe('when the connection ends', () => {
  it('a drop is retried, a little later each time', () => {
    const { live, seen } = make()
    live.connect('bs_1')
    FakeSocket.all[0].opens()
    FakeSocket.all[0].drops()
    expect(seen.status.at(-1)).toBe('reconnecting')
    vi.advanceTimersByTime(999)
    expect(FakeSocket.all).toHaveLength(1)
    vi.advanceTimersByTime(2)
    expect(FakeSocket.all).toHaveLength(2)
    FakeSocket.all[1].drops()                         // never opened: the delay keeps growing
    vi.advanceTimersByTime(1500)
    expect(FakeSocket.all).toHaveLength(2)
    vi.advanceTimersByTime(600)
    expect(FakeSocket.all).toHaveLength(3)
  })

  it('a session that ended says so once and is not retried', () => {
    const { live, seen } = make()
    live.connect('bs_1')
    const ws = FakeSocket.all[0]
    ws.opens()
    ws.says({ t: 'bye', reason: 'ended' })
    ws.drops(1000)
    vi.advanceTimersByTime(60000)
    expect(seen.ends).toEqual(['ended'])
    expect(FakeSocket.all).toHaveLength(1)
  })

  it.each([4401, 4403, 4404])('a refusal (%i) is final', (code) => {
    const { live, seen } = make()
    live.connect('bs_1')
    FakeSocket.all[0].drops(code)
    vi.advanceTimersByTime(60000)
    expect(seen.ends).toEqual(['denied'])
    expect(FakeSocket.all).toHaveLength(1)
  })

  it('closing it ourselves stops everything, including a pending retry', () => {
    const { live } = make()
    live.connect('bs_1')
    FakeSocket.all[0].opens()
    FakeSocket.all[0].drops()
    live.close()
    vi.advanceTimersByTime(60000)
    expect(FakeSocket.all).toHaveLength(1)
  })

  it('a late message from a socket we have left is ignored', () => {
    const { live, seen } = make()
    live.connect('bs_1')
    const first = FakeSocket.all[0]
    first.opens()
    live.connect('bs_2')
    first.says({ t: 'hello', session: { session_id: 'bs_1' } })
    expect(seen.sessions).toEqual([])
  })
})

describe('input', () => {
  it('goes out in batches, with a run of pointer moves collapsed to the last', () => {
    const { live } = make()
    live.connect('bs_1')
    const ws = FakeSocket.all[0]
    ws.opens()
    live.input({ t: 'pointer', k: 'move', x: 1, y: 1 })
    live.input({ t: 'pointer', k: 'move', x: 2, y: 2 })
    live.input({ t: 'pointer', k: 'move', x: 3, y: 3 })
    live.input({ t: 'pointer', k: 'down', x: 3, y: 3, b: 'left', c: 1 })
    live.input({ t: 'pointer', k: 'move', x: 4, y: 4 })
    live.input(null)
    vi.advanceTimersByTime(40)
    expect(ws.sent).toEqual([{ t: 'input', events: [
      { t: 'pointer', k: 'move', x: 3, y: 3 },
      { t: 'pointer', k: 'down', x: 3, y: 3, b: 'left', c: 1 },
      { t: 'pointer', k: 'move', x: 4, y: 4 },
    ] }])
  })

  it('typed while disconnected is dropped, not replayed later onto another page', () => {
    const { live } = make()
    live.connect('bs_1')
    const ws = FakeSocket.all[0]
    live.input({ t: 'text', text: 'too early' })
    vi.advanceTimersByTime(40)
    ws.opens()
    vi.advanceTimersByTime(40)
    expect(ws.sent).toEqual([])
  })

  it('asks the relay to re-read who is driving', () => {
    const { live } = make()
    live.connect('bs_1')
    const ws = FakeSocket.all[0]
    ws.opens()
    live.sync()
    expect(ws.sent).toEqual([{ t: 'sync' }])
  })
})

describe('a pane nobody can see', () => {
  it('tells the relay, and tells it again after a reconnect', () => {
    const { live } = make()
    live.connect('bs_1')
    const ws = FakeSocket.all[0]
    ws.opens()
    live.setHidden(true)
    expect(ws.sent).toEqual([{ t: 'visible', hidden: true }])
    ws.drops()
    vi.advanceTimersByTime(1100)
    FakeSocket.all[1].opens()
    expect(FakeSocket.all[1].sent).toEqual([{ t: 'visible', hidden: true }])
    live.setHidden(false)
    expect(FakeSocket.all[1].sent.at(-1)).toEqual({ t: 'visible', hidden: false })
  })
})
