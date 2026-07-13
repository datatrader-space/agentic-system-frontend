// Real chat transport — Phase 2 backend wiring.
//
// Wraps the backend chat WebSocket consumer (ws/chat/repository/<repoId>/).
// The conversation itself is created over REST (POST /agents/<id>/chat/) by the
// store; this class only carries the live message stream.
//
// Protocol (confirmed against agent/consumers.py + AgentPlayground.vue):
//   client → server:  { type:'subscribe', conversation_id }
//                     { type:'chat_message', message, conversation_id, agentId, model_id }
//                     { type:'stop_execution', conversation_id }
//   server → client:  assistant_message_chunk {chunk}
//                     assistant_message_complete {full_message}
//                     chat_response|assistant|assistant_message {content|message}
//                     tool_call {tool, params} / tool_result {tool_name, result, success}
//                     agent_session_complete | stop_acknowledged | error {error|message}

// Heartbeat / reconnect tuning. A backend reload kills the socket WITHOUT always delivering a
// close frame (half-open) — so we ping and treat silence as death, then reconnect automatically.
// Keepalive: an idle WebSocket through the Vite dev proxy gets cut (code 1006) — which is exactly
// what happens during a long, silent clarification-card wait. Ping OFTEN (and immediately on open)
// so the socket is never idle long enough to be dropped. STALE_MS stays a comfortable multiple of
// HEARTBEAT_MS so a single missed pong doesn't false-trip a reconnect.
const HEARTBEAT_MS = 10000   // send a ping this often (and once immediately on open)
const STALE_MS = 35000       // no message (incl. pong) for this long => socket is dead
const RECONNECT_MAX = 10     // give up after this many consecutive failed reconnects
const RECONNECT_CAP_MS = 10000

export class ChatConnection {
  constructor(conversationId, handlers = {}) {
    this.conversationId = conversationId
    this.handlers = handlers
    this.ws = null
    this.isOpen = false
    this.queue = []
    this.closedByUs = false
    this.repoId = 0
    this._hb = null
    this._lastActivity = 0
    this._reconnectAttempts = 0
    this._reconnectTimer = null
    this._prewarmAgentId = null   // agent to pre-build server-side before the first message
    this._wakeInstalled = false
    this._installWakeListeners()
  }

  // Recover a long-dead socket the INSTANT the environment comes back — network back online, tab
  // refocused, or visibility restored — without waiting out the backoff or forcing a manual refresh.
  // This is what makes a laptop that slept for an hour (or a phone that backgrounded the tab)
  // reconnect on wake instead of sitting on "Lost connection — please refresh".
  _installWakeListeners() {
    if (this._wakeInstalled || typeof window === 'undefined') return
    this._wake = () => {
      if (this.closedByUs) return
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
      this._reconnectAttempts = 0   // fresh reconnect budget on a real environment change
      if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null }
      this.connect(this.repoId)
    }
    this._onVisible = () => { if (!document.hidden) this._wake() }
    window.addEventListener('online', this._wake)
    window.addEventListener('focus', this._wake)
    document.addEventListener('visibilitychange', this._onVisible)
    this._wakeInstalled = true
  }

  _removeWakeListeners() {
    if (!this._wakeInstalled || typeof window === 'undefined') return
    window.removeEventListener('online', this._wake)
    window.removeEventListener('focus', this._wake)
    document.removeEventListener('visibilitychange', this._onVisible)
    this._wakeInstalled = false
  }

  // Pre-build the agent runtime on the server (runner + workspace + KB-exists) during the idle window
  // before the first message, so the first turn reuses it instead of paying the ~6.6s cold build.
  // Re-sent on every (re)open below. Best-effort; the backend no-ops if it can't.
  prewarm(agentId) {
    this._prewarmAgentId = agentId ? String(agentId) : null
    if (this._prewarmAgentId && this.isOpen) {
      try { this._raw({ type: 'agent_prewarm', agent_id: this._prewarmAgentId }) } catch (e) { /* noop */ }
    }
  }

  connect(repoId = 0) {
    this.repoId = repoId || 0
    this.closedByUs = false
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null }
    // Never orphan a live socket into a duplicate: if one is already open/connecting, keep it.
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    // Same-origin: the Vite dev server proxies /ws → the backend (see vite.config.js).
    // General agent chat (no repo) → dedicated /ws/chat/agent/ route; a real repo → repo-scoped route.
    const path = this.repoId ? `/ws/chat/repository/${this.repoId}/` : '/ws/chat/agent/'
    const url = `${proto}://${window.location.host}${path}`
    try {
      this.ws = new WebSocket(url)
    } catch (e) {
      this.handlers.onError?.('Could not open chat connection')
      this._scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.isOpen = true
      this._reconnectAttempts = 0
      this._lastActivity = Date.now()
      this._startHeartbeat()
      // No 'subscribe' handshake: the chat consumer routes by conversation_id on the
      // chat_message itself and rejects unknown types. Just flush anything queued
      // before the socket opened.
      const pending = this.queue.splice(0)
      pending.forEach((m) => this._raw(m))
      // Reopening an existing conversation: ask the server to resume any turn still running for it
      // (live re-stream after a refresh). No-op for a brand-new chat (no conversation id yet).
      if (this.conversationId) {
        try { this._raw({ type: 'resume', conversation_id: this.conversationId }) } catch (e) { /* noop */ }
      }
      // Prewarm the selected agent on (re)open so the first message reuses the runner.
      if (this._prewarmAgentId) {
        try { this._raw({ type: 'agent_prewarm', agent_id: this._prewarmAgentId }) } catch (e) { /* noop */ }
      }
      this.handlers.onOpen?.()
    }
    this.ws.onmessage = (e) => {
      this._lastActivity = Date.now()   // any inbound traffic proves the socket is alive
      let msg
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      if (msg.type === 'pong') return   // liveness only — don't surface to the UI
      this.handlers.onEvent?.(msg)
    }
    this.ws.onerror = () => this.handlers.onError?.('Chat connection error')
    this.ws.onclose = () => {
      this.isOpen = false
      this._stopHeartbeat()
      // Detach this dead socket's handlers so a half-open/late event can't drive reconnect churn.
      const dead = this.ws
      if (dead) { dead.onopen = dead.onmessage = dead.onerror = dead.onclose = null }
      this.ws = null
      // Notify (so the store can show "reconnecting") AND auto-reconnect for the next turn.
      if (!this.closedByUs) {
        this.handlers.onClose?.()
        this._scheduleReconnect()
      }
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat()
    this._raw({ type: 'ping' })   // ping immediately so the socket is never idle from t=0
    this._hb = setInterval(() => {
      // Dead socket detection: no inbound traffic for STALE_MS even though we keep pinging.
      if (Date.now() - this._lastActivity > STALE_MS) {
        try { this.ws?.close() } catch { /* ignore */ }   // triggers onclose -> reconnect
        return
      }
      this._raw({ type: 'ping' })
    }, HEARTBEAT_MS)
  }

  _stopHeartbeat() {
    if (this._hb) { clearInterval(this._hb); this._hb = null }
  }

  _scheduleReconnect() {
    if (this.closedByUs || this._reconnectTimer) return
    if (this._reconnectAttempts >= RECONNECT_MAX) {
      this.handlers.onError?.('Lost connection — please refresh.')
      return
    }
    // Exponential backoff with 50–100% jitter so many clients reconnecting after a backend redeploy
    // don't stampede in lockstep at the same 1/2/4/8/10s boundaries (thundering herd).
    const base = Math.min(1000 * 2 ** this._reconnectAttempts, RECONNECT_CAP_MS)
    const delay = Math.round(base * (0.5 + Math.random() * 0.5))
    this._reconnectAttempts += 1
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      this.connect(this.repoId)
    }, delay)
  }

  _raw(obj) {
    try {
      this.ws?.send(JSON.stringify(obj))
    } catch {
      /* ignore */
    }
  }

  _send(obj) {
    if (this.isOpen && this.ws?.readyState === WebSocket.OPEN) {
      this._raw(obj)
    } else {
      // Not connected: keep the message and (re)open the socket — it flushes on reopen.
      this.queue.push(obj)
      if (!this.closedByUs) this._scheduleReconnect()
    }
  }

  // The chat socket is keyed by repoId (stable); conversation_id travels PER-MESSAGE, so ONE socket
  // serves every conversation. Switch the active conversation without tearing down the connection.
  setConversation(conversationId) {
    this.conversationId = conversationId
  }

  sendMessage(text, agentId, modelId = null, opts = {}) {
    this._send({
      type: 'chat_message',
      message: text,
      conversation_id: this.conversationId,
      agentId: agentId || undefined,
      model_id: modelId || undefined,
      // Canvas mode: auto-expose GENERATE_STATIC_PAGE for this turn (backend gates on this flag).
      canvas_mode: opts.canvasMode || undefined,
      // Canvas click-to-select (Phase 5): the element the user clicked, so "change this" targets it.
      canvas_selection: opts.canvasSelection || undefined,
    })
  }

  stop() {
    this._send({ type: 'stop_execution', conversation_id: this.conversationId })
  }

  // Generic safe send (used for HITL approval responses, etc.). Queues if not yet open.
  send(obj) {
    this._send(obj)
  }

  // Send a human-in-the-loop approval/clarification response.
  sendHitlResponse(requestId, responseValue, feedback = '') {
    this._send({
      type: 'hitl_response',
      request_id: requestId,
      response_value: responseValue,
      feedback,
    })
  }

  // Manual Mode plan approval (v3 Layer 2). decision ∈ {'approve','reject','revise'}.
  // For 'revise', `feedback` carries the user's requested changes (handed back to the agent).
  sendPlanDecision(decision, feedback) {
    this._send({
      type: 'plan_approval_response',
      decision,
      feedback,
      conversation_id: this.conversationId,
    })
  }

  close() {
    this.closedByUs = true
    this._stopHeartbeat()
    this._removeWakeListeners()
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null }
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
    this.ws = null
    this.isOpen = false
  }
}
