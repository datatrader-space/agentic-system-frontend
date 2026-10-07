// The live view's socket: frames in, a person's input out.
//
//   wss://<host>/ws/browser/<session_id>/live/      same origin, session cookie, owner only
//
// One connection per open Browser pane. It reconnects by itself with a growing delay, stops asking for
// frames while the tab is hidden (the backend stops the browser's screencast when nobody is looking), and
// acknowledges every frame it draws — the relay keeps at most two unacknowledged frames in flight, so a
// slow connection is one picture behind rather than a queue behind.
//
// What comes back is handed to the caller as plain callbacks. Nothing here touches the DOM or a store, so
// it can be tested with a fake WebSocket.
import { parseFrame } from '../utils/browserLive'

const RETRY_FIRST_MS = 1000
const RETRY_MAX_MS = 15000
const INPUT_FLUSH_MS = 33          // about thirty batches a second
const INPUT_BATCH_MAX = 48

// Close codes the relay sends on purpose. None of them is worth retrying.
const FINAL_CODES = new Set([4401, 4403, 4404])

export function liveUrl(sessionId, loc = window.location) {
  const proto = loc.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${loc.host}/ws/browser/${encodeURIComponent(sessionId)}/live/`
}

/**
 * @param {object} handlers
 *   onFrame(header, jpegBytes)  a picture to draw
 *   onStatus(phase, code)       'connecting' | 'live' | 'reconnecting' | 'unavailable' | 'closed'
 *   onSession(card)             the session card, on hello and on every change
 *   onEnd(reason)               the session is over, or this socket may not be used ('ended' | 'denied')
 */
export function createBrowserLive(handlers = {}, { WebSocketImpl } = {}) {
  const WS = WebSocketImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null)
  let socket = null
  let sessionId = null
  let closedByUs = false
  let retryMs = RETRY_FIRST_MS
  let retryTimer = null
  let flushTimer = null
  let pending = []
  let hidden = false

  const emit = (name, ...args) => { try { handlers[name] && handlers[name](...args) } catch (e) { /* a handler's bug must not kill the socket */ } }
  const isOpen = () => !!socket && socket.readyState === 1

  function send(obj) {
    if (isOpen()) socket.send(JSON.stringify(obj))
  }

  function open() {
    if (!WS || !sessionId || closedByUs) return
    emit('onStatus', 'connecting')
    const ws = new WS(liveUrl(sessionId))
    ws.binaryType = 'arraybuffer'
    socket = ws
    ws.onopen = () => {
      retryMs = RETRY_FIRST_MS
      if (hidden) send({ t: 'visible', hidden: true })
    }
    ws.onmessage = (ev) => {
      if (ws !== socket) return
      if (typeof ev.data !== 'string') {
        const frame = parseFrame(ev.data)
        // Acknowledged whether or not it could be drawn: an unacknowledged frame holds back the next.
        send({ t: 'ack' })
        if (frame) emit('onFrame', frame.header, frame.jpeg)
        return
      }
      let msg
      try { msg = JSON.parse(ev.data) } catch (e) { return }
      if (!msg || typeof msg !== 'object') return
      if (msg.t === 'hello' || msg.t === 'state') emit('onSession', msg.session)
      else if (msg.t === 'status') emit('onStatus', msg.phase, msg.code)
      else if (msg.t === 'bye') { closedByUs = true; emit('onEnd', msg.reason || 'ended') }
    }
    ws.onclose = (ev) => {
      if (ws !== socket) return
      socket = null
      if (closedByUs) { emit('onStatus', 'closed'); return }
      if (FINAL_CODES.has(ev && ev.code)) { closedByUs = true; emit('onEnd', 'denied'); return }
      emit('onStatus', 'reconnecting')
      retryTimer = setTimeout(open, retryMs)
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS)
    }
    ws.onerror = () => { /* onclose follows and decides */ }
  }

  function flush() {
    if (!pending.length) return
    if (!isOpen()) { pending = []; return }
    const batch = pending.slice(0, INPUT_BATCH_MAX)
    pending = pending.slice(INPUT_BATCH_MAX)
    send({ t: 'input', events: batch })
  }

  return {
    connect(id) {
      this.close()
      sessionId = id
      closedByUs = false
      retryMs = RETRY_FIRST_MS
      pending = []
      flushTimer = setInterval(flush, INPUT_FLUSH_MS)
      open()
    },

    close() {
      closedByUs = true
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
      if (flushTimer) { clearInterval(flushTimer); flushTimer = null }
      pending = []
      const ws = socket
      socket = null
      if (ws) { try { ws.close() } catch (e) { /* already closed */ } }
    },

    // Queue one input event. A run of pointer moves collapses to where the pointer ended up: the page
    // only needs the last position before the next press, and thirty batches a second is plenty.
    input(event) {
      if (!event) return
      const last = pending[pending.length - 1]
      if (event.t === 'pointer' && event.k === 'move' && last && last.t === 'pointer' && last.k === 'move') {
        pending[pending.length - 1] = event
      } else if (pending.length < 256) {
        pending.push(event)
      }
    },

    // Ask the relay to re-read who is driving, right after a take or a hand-back.
    sync() { send({ t: 'sync' }) },

    // Stop paying for frames nobody can see.
    setHidden(isHidden) {
      hidden = !!isHidden
      send({ t: 'visible', hidden })
    },

    get connected() { return isOpen() },
  }
}
