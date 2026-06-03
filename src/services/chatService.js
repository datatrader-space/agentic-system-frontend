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

export class ChatConnection {
  constructor(conversationId, handlers = {}) {
    this.conversationId = conversationId
    this.handlers = handlers
    this.ws = null
    this.isOpen = false
    this.queue = []
    this.closedByUs = false
  }

  connect(repoId = 0) {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    // Same-origin: the Vite dev server proxies /ws → the backend (see vite.config.js).
    const url = `${proto}://${window.location.host}/ws/chat/repository/${repoId || 0}/`
    try {
      this.ws = new WebSocket(url)
    } catch (e) {
      this.handlers.onError?.('Could not open chat connection')
      return
    }

    this.ws.onopen = () => {
      this.isOpen = true
      // No 'subscribe' handshake: the chat consumer routes by conversation_id on the
      // chat_message itself and rejects unknown types. Just flush anything queued
      // before the socket opened.
      const pending = this.queue.splice(0)
      pending.forEach((m) => this._raw(m))
      this.handlers.onOpen?.()
    }
    this.ws.onmessage = (e) => {
      let msg
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      this.handlers.onEvent?.(msg)
    }
    this.ws.onerror = () => this.handlers.onError?.('Chat connection error')
    this.ws.onclose = () => {
      this.isOpen = false
      if (!this.closedByUs) this.handlers.onClose?.()
    }
  }

  _raw(obj) {
    try {
      this.ws?.send(JSON.stringify(obj))
    } catch {
      /* ignore */
    }
  }

  _send(obj) {
    if (this.isOpen && this.ws?.readyState === WebSocket.OPEN) this._raw(obj)
    else this.queue.push(obj)
  }

  sendMessage(text, agentId, modelId = null) {
    this._send({
      type: 'chat_message',
      message: text,
      conversation_id: this.conversationId,
      agentId: agentId || undefined,
      model_id: modelId || undefined,
    })
  }

  stop() {
    this._send({ type: 'stop_execution', conversation_id: this.conversationId })
  }

  close() {
    this.closedByUs = true
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
    this.ws = null
    this.isOpen = false
  }
}
