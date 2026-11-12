// One language server of a Let's Code project, through AADML (ADM-1205 phase F, item 16;
// agentic-docs/LETS_CODE_LANGUAGE_SERVERS_PLAN.md). The server runs in the project's sandbox; the browser speaks to
// ws/lets-code/{repo}/lsp/{typescript|python}/ only. Each text frame is one JSON-RPC 2.0 message, except AADML's own
// status frames, which carry `type` ({type: 'status', state: installing | starting | ready | error | exited}).
//
// Our own small client (plan D6): requests and their replies, notifications both ways, and the server's requests
// answered by `onRequest`. A closed socket fails every request still waiting, so no caller waits for ever.

export function lspSocketUrl(repoId, lang, loc = window.location, env = import.meta.env) {
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = (env && env.VITE_WS_HOST) || loc.host
  return `${proto}//${host}/ws/lets-code/${repoId}/lsp/${lang}/`
}

export class LspConnection {
  /**
   * @param {object} o
   * @param {string} o.url
   * @param {(s: {state: string, error?: string, root?: string}) => void} [o.onStatus]
   * @param {(method: string, params: any) => void} [o.onNotification]
   * @param {(method: string, params: any) => any} [o.onRequest]  the server's requests; the value (or promise) answers
   * @param {typeof WebSocket} [o.WebSocketImpl]
   */
  constructor({ url, onStatus = () => {}, onNotification = () => {}, onRequest = () => null, WebSocketImpl } = {}) {
    this.url = url
    this.onStatus = onStatus
    this.onNotification = onNotification
    this.onRequest = onRequest
    this.WS = WebSocketImpl || globalThis.WebSocket
    this.sock = null
    this.state = 'closed'
    this._seq = 0
    this._waiting = new Map()
  }

  open() {
    this.close()
    this._setState({ state: 'connecting' })
    const sock = new this.WS(this.url)
    this.sock = sock
    sock.onmessage = (ev) => this._onFrame(ev.data)
    sock.onclose = (ev) => {
      if (this.sock !== sock) return
      this.sock = null
      this._failAll('The language server connection closed.')
      if (this.state !== 'error') this._setState({ state: 'closed', code: ev && ev.code })
    }
    sock.onerror = () => {}
    return this
  }

  close() {
    const sock = this.sock
    this.sock = null
    this._failAll('The language server connection closed.')
    if (sock) { try { sock.close() } catch { /* already closed */ } }
  }

  get ready() { return this.state === 'ready' }

  request(method, params) {
    if (!this.sock || this.state !== 'ready') return Promise.reject(new Error('The language server is not ready.'))
    const id = ++this._seq
    return new Promise((resolve, reject) => {
      this._waiting.set(id, { resolve, reject })
      this._send({ jsonrpc: '2.0', id, method, params })
    })
  }

  notify(method, params) {
    if (!this.sock || this.state !== 'ready') return false
    this._send({ jsonrpc: '2.0', method, params })
    return true
  }

  _send(msg) {
    try { this.sock.send(JSON.stringify(msg)) } catch { /* the close handler fails what waits */ }
  }

  _setState(s) {
    this.state = s.state
    try { this.onStatus(s) } catch { /* a listener's error never breaks the connection */ }
  }

  _failAll(why) {
    for (const { reject } of this._waiting.values()) reject(new Error(why))
    this._waiting.clear()
  }

  async _onFrame(data) {
    let msg
    try { msg = JSON.parse(data) } catch { return }
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'status') { this._setState(msg); return }
    const hasId = msg.id !== undefined && msg.id !== null
    if (hasId && msg.method) {                       // the server asks us
      let result = null
      let error
      try { result = await this.onRequest(msg.method, msg.params) } catch (e) {
        error = { code: -32603, message: String((e && e.message) || e) }
      }
      if (this.sock) this._send(error ? { jsonrpc: '2.0', id: msg.id, error } : { jsonrpc: '2.0', id: msg.id, result: result ?? null })
      return
    }
    if (hasId) {                                     // a reply to our request
      const w = this._waiting.get(msg.id)
      if (!w) return
      this._waiting.delete(msg.id)
      if (msg.error) w.reject(Object.assign(new Error(msg.error.message || 'The language server refused.'), { code: msg.error.code }))
      else w.resolve(msg.result)
      return
    }
    if (msg.method) {
      try { this.onNotification(msg.method, msg.params) } catch { /* a listener's error never breaks the connection */ }
    }
  }
}
