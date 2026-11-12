// The editor's language-server connection (ADM-1205 phase F item 16): AADML's status frames, our requests and their
// replies, the server's requests answered, and a closed socket failing what still waits.
import { describe, it, expect, vi } from 'vitest'
import { LspConnection, lspSocketUrl } from './lspClient'

class FakeSocket {
  constructor(url) { this.url = url; this.sent = []; FakeSocket.last = this }
  send(t) { this.sent.push(JSON.parse(t)) }
  close() { this.onclose && this.onclose({ code: 1000 }) }
  frame(obj) { return this.onmessage({ data: JSON.stringify(obj) }) }
}

function open() {
  const statuses = []
  const notes = []
  const c = new LspConnection({ url: 'ws://x/ws/lets-code/4/lsp/typescript/', WebSocketImpl: FakeSocket,
    onStatus: (s) => statuses.push(s.state), onNotification: (m, p) => notes.push([m, p]),
    onRequest: (m) => (m === 'workspace/configuration' ? [{ a: 1 }] : null) }).open()
  return { c, s: FakeSocket.last, statuses, notes }
}

describe('lspSocketUrl', () => {
  it("is AADML's own address for the project and the language", () => {
    expect(lspSocketUrl(4, 'python', { protocol: 'https:', host: 'aadml.com' }, {}))
      .toBe('wss://aadml.com/ws/lets-code/4/lsp/python/')
  })
})

describe('LspConnection', () => {
  it('follows the status frames and answers a request only when ready', async () => {
    const { c, s, statuses } = open()
    await expect(c.request('initialize', {})).rejects.toThrow('not ready')
    await s.frame({ type: 'status', state: 'installing' })
    await s.frame({ type: 'status', state: 'ready', root: '/w/repo-4' })
    expect(statuses).toEqual(['connecting', 'installing', 'ready'])
    const p = c.request('textDocument/hover', { a: 1 })
    expect(s.sent[0]).toMatchObject({ jsonrpc: '2.0', id: 1, method: 'textDocument/hover', params: { a: 1 } })
    await s.frame({ jsonrpc: '2.0', id: 1, result: { contents: 'x' } })
    await expect(p).resolves.toEqual({ contents: 'x' })
  })

  it("an error reply rejects with the server's words; notifications reach the listener", async () => {
    const { c, s, notes } = open()
    await s.frame({ type: 'status', state: 'ready' })
    const p = c.request('textDocument/definition', {})
    await s.frame({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Unhandled method' } })
    await expect(p).rejects.toThrow('Unhandled method')
    await s.frame({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: { uri: 'u', diagnostics: [] } })
    expect(notes).toEqual([['textDocument/publishDiagnostics', { uri: 'u', diagnostics: [] }]])
  })

  it("answers the server's own requests, and a closed socket fails what still waits", async () => {
    const { c, s } = open()
    await s.frame({ type: 'status', state: 'ready' })
    await s.frame({ jsonrpc: '2.0', id: 9, method: 'workspace/configuration', params: { items: [{}] } })
    expect(s.sent.at(-1)).toEqual({ jsonrpc: '2.0', id: 9, result: [{ a: 1 }] })
    await s.frame({ jsonrpc: '2.0', id: 10, method: 'window/workDoneProgress/create', params: {} })
    expect(s.sent.at(-1)).toEqual({ jsonrpc: '2.0', id: 10, result: null })
    const p = c.request('textDocument/references', {})
    s.close()
    await expect(p).rejects.toThrow('closed')
    expect(c.notify('initialized', {})).toBe(false)
  })

  it('a frame that is not JSON is ignored', async () => {
    const { s, statuses } = open()
    await s.onmessage({ data: 'not json' })
    expect(statuses).toEqual(['connecting'])
    expect(vi.isMockFunction(s.send)).toBe(false)
  })
})
