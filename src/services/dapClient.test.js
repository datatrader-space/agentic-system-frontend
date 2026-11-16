// The debugger's socket client (ADM-1205 phase F item 17): `{s, m}` frames, requests answered by request_seq per
// session, events and the adapter's reverse requests, AADML's status frames, and a closed socket failing what waits.
import { describe, it, expect } from 'vitest'
import { DapConnection, dapSocketUrl } from './dapClient'

class FakeWS {
  constructor(url) { this.url = url; this.sent = []; FakeWS.last = this }
  send(t) { this.sent.push(JSON.parse(t)) }
  close() { this.closed = true; this.onclose && this.onclose({ code: 1000 }) }
  frame(o) { return this.onmessage({ data: JSON.stringify(o) }) }
}

function open() {
  const states = []
  const c = new DapConnection({ url: 'wss://x/ws/lets-code/4/dap/python/', WebSocketImpl: FakeWS, onStatus: (s) => states.push(s.state) })
  c.open()
  return { c, ws: FakeWS.last, states }
}

describe('dapClient', () => {
  it('the socket address is this site\'s, for the adapter', () => {
    expect(dapSocketUrl(4, 'node', { protocol: 'https:', host: 'aadml.com' }, {})).toBe('wss://aadml.com/ws/lets-code/4/dap/node/')
    expect(dapSocketUrl(4, 'python', { protocol: 'http:', host: 'localhost:5173' }, { VITE_WS_HOST: 'localhost:8001' }))
      .toBe('ws://localhost:8001/ws/lets-code/4/dap/python/')
  })

  it('nothing is sent before ready; a request then goes as {s, m} and its response answers it', async () => {
    const { c, ws, states } = open()
    const s = c.session()
    await expect(s.request('initialize', {})).rejects.toThrow('not ready')
    ws.frame({ type: 'status', state: 'ready', root: '/w/repo-4' })
    expect(states).toEqual(['connecting', 'ready'])
    const p = s.request('threads')
    expect(ws.sent).toEqual([{ s: 1, m: { type: 'request', seq: 1, command: 'threads', arguments: {} } }])
    await ws.frame({ s: 1, m: { type: 'response', request_seq: 1, command: 'threads', success: true, body: { threads: [{ id: 7 }] } } })
    await expect(p).resolves.toEqual({ threads: [{ id: 7 }] })
  })

  it('a refused request rejects with the adapter\'s words; sessions keep their own sequence', async () => {
    const { c, ws } = open()
    ws.frame({ type: 'status', state: 'ready' })
    const a = c.session()
    const b = c.session()
    const pa = a.request('evaluate', { expression: 'x' })
    const pb = b.request('evaluate', { expression: 'y' })
    expect(ws.sent.map((f) => [f.s, f.m.seq])).toEqual([[1, 1], [2, 1]])
    await ws.frame({ s: 2, m: { type: 'response', request_seq: 1, success: false, message: 'name y is not defined' } })
    await ws.frame({ s: 1, m: { type: 'response', request_seq: 1, success: true, body: { result: '3' } } })
    await expect(pb).rejects.toThrow('name y is not defined')
    await expect(pa).resolves.toEqual({ result: '3' })
  })

  it('events reach the session; the adapter\'s requests are answered, an error as success false', async () => {
    const { c, ws } = open()
    ws.frame({ type: 'status', state: 'ready' })
    const s = c.session()
    const events = []
    s.onEvent = (e, body) => events.push([e, body])
    s.onRequest = (command) => { if (command === 'startDebugging') return {}; throw new Error('no') }
    await ws.frame({ s: 1, m: { type: 'event', event: 'stopped', body: { threadId: 1 } } })
    await ws.frame({ s: 1, m: { type: 'request', seq: 9, command: 'startDebugging', arguments: {} } })
    await ws.frame({ s: 1, m: { type: 'request', seq: 10, command: 'runInTerminal', arguments: {} } })
    expect(events).toEqual([['stopped', { threadId: 1 }]])
    expect(ws.sent.map((f) => f.m)).toEqual([
      { type: 'response', seq: 1, request_seq: 9, command: 'startDebugging', success: true, body: {} },
      { type: 'response', seq: 2, request_seq: 10, command: 'runInTerminal', success: false, message: 'no' }])
  })

  it('a closed socket fails every request still waiting; close() of a session asks the bridge to end it', async () => {
    const { c, ws, states } = open()
    ws.frame({ type: 'status', state: 'ready' })
    const s = c.session()
    s.close()
    expect(ws.sent[0]).toEqual({ s: 1, m: { type: 'aadml.close' } })
    const p = s.request('continue', { threadId: 1 })
    ws.onclose({ code: 1006 })
    await expect(p).rejects.toThrow('closed')
    expect(states.at(-1)).toBe('closed')
  })
})
