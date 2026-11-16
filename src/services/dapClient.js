// The debugger of a Let's Code project, through AADML (ADM-1205 phase F, item 17;
// agentic-docs/LETS_CODE_DEBUGGER_PLAN.md). The adapter runs in the project's sandbox behind AADML's bridge; the browser
// speaks to ws/lets-code/{repo}/dap/{python|node}/ only. Each frame is `{s, m}`: a session id and a Debug Adapter
// Protocol message. js-debug opens a child session for each process it launches (the reverse request
// `startDebugging`), so one connection carries several sessions, as VS Code's does. AADML's own status frames carry
// `type` ({type: 'status', state: installing | starting | ready | error | exited}).
import { projectSocketUrl } from './lspClient'

export function dapSocketUrl(repoId, adapter, loc = window.location, env = import.meta.env) {
  return projectSocketUrl(repoId, `dap/${adapter}`, loc, env)
}

/** One debug session on the connection: its requests (by `seq`), its events, and the adapter's requests to it. */
export class DapSession {
  constructor(conn, id) {
    this.conn = conn
    this.id = id
    this._seq = 0
    this._waiting = new Map()
    this.onEvent = () => {}
    this.onRequest = () => ({})
  }

  request(command, args) {
    if (!this.conn.ready) return Promise.reject(new Error('The debugger is not ready.'))
    const seq = ++this._seq
    return new Promise((resolve, reject) => {
      this._waiting.set(seq, { resolve, reject, command })
      this.conn._send(this.id, { type: 'request', seq, command, arguments: args || {} })
    })
  }

  _respond(req, body, error) {
    const m = { type: 'response', seq: ++this._seq, request_seq: req.seq, command: req.command, success: !error }
    if (error) m.message = error
    else if (body !== undefined) m.body = body
    this.conn._send(this.id, m)
  }

  async _onMessage(m) {
    if (m.type === 'response') {
      const w = this._waiting.get(m.request_seq)
      if (!w) return
      this._waiting.delete(m.request_seq)
      if (m.success) w.resolve(m.body || {})
      else w.reject(Object.assign(new Error(m.message || `${w.command} failed`), { body: m.body }))
      return
    }
    if (m.type === 'event') { try { this.onEvent(m.event, m.body || {}) } catch { /* a listener's error stays there */ } return }
    if (m.type === 'request') {
      try { this._respond(m, await this.onRequest(m.command, m.arguments || {})) } catch (e) { this._respond(m, undefined, String((e && e.message) || e)) }
    }
  }

  _fail(why) {
    for (const { reject } of this._waiting.values()) reject(new Error(why))
    this._waiting.clear()
  }

  /** Ask the bridge to end this session's adapter connection. */
  close() { this.conn._send(this.id, { type: 'aadml.close' }) }
}

export class DapConnection {
  /**
   * @param {object} o
   * @param {string} o.url
   * @param {(s: {state: string, error?: string, root?: string}) => void} [o.onStatus]
   * @param {typeof WebSocket} [o.WebSocketImpl]
   */
  constructor({ url, onStatus = () => {}, WebSocketImpl } = {}) {
    this.url = url
    this.onStatus = onStatus
    this.WS = WebSocketImpl || globalThis.WebSocket
    this.sock = null
    this.state = 'closed'
    this.sessions = new Map()
    this._next = 0
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
      this._failAll('The debugger connection closed.')
      if (this.state !== 'error') this._setState({ state: 'closed', code: ev && ev.code })
    }
    sock.onerror = () => {}
    return this
  }

  close() {
    const sock = this.sock
    this.sock = null
    this._failAll('The debugger connection closed.')
    if (sock) { try { sock.close() } catch { /* already closed */ } }
  }

  get ready() { return this.state === 'ready' && !!this.sock }

  /** A new session (a launch, or a child js-debug asked for). */
  session() {
    const s = new DapSession(this, ++this._next)
    this.sessions.set(s.id, s)
    return s
  }

  _send(id, m) {
    if (!this.sock) return
    try { this.sock.send(JSON.stringify({ s: id, m })) } catch { /* the close handler fails what waits */ }
  }

  _setState(s) {
    this.state = s.state
    try { this.onStatus(s) } catch { /* a listener's error never breaks the connection */ }
  }

  _failAll(why) { for (const s of this.sessions.values()) s._fail(why) }

  _onFrame(data) {
    let msg
    try { msg = JSON.parse(data) } catch { return }
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'status') { this._setState(msg); return }
    const s = this.sessions.get(msg.s)
    if (s && msg.m) return s._onMessage(msg.m)
  }
}
