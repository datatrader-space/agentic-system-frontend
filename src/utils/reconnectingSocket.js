// One reconnecting WebSocket for the pages that keep a live socket beside a poller (page-speed plan Phase 3):
// knowledge indexing, Let's Code, a workflow run and the Help assistant. Each used to open one socket and
// never reopen it, so a deploy or a dropped network left the page on its slow poller until a refresh.
//
// Modelled on the main chat's reconnect (services/chatService.js), which uses the same backoff:
//   - a dropped socket reconnects after a capped exponential delay with FULL jitter, so many tabs coming
//     back after a redeploy spread out instead of arriving at once; it never gives up
//   - network back online, or the tab visible again, reconnects at once with a fresh backoff
//   - close() is intentional: no reconnect after it, and none after the component's scope is disposed
//
// Usage:
//   const live = reconnectingSocket({ onMessage: (e) => handle(JSON.parse(e.data)) })
//   live.connect(() => `${scheme}://${host}/ws/thing/${id}/`)   // re-run on every (re)connect
//   live.close()
// The target function may return a URL, `{ url, protocols }`, or a promise of either (so a caller can
// fetch a fresh short-lived token before each attempt); a target that throws or returns nothing counts as a
// failed attempt and is retried with the same backoff.
import { getCurrentScope, onScopeDispose } from 'vue'

export const RECONNECT_BASE_MS = 1000
export const RECONNECT_CAP_MS = 30000
const RECONNECT_MIN_MS = 250

/** Delay before reconnect attempt `attempt` (0-based): random in [250ms, min(cap, base*2^attempt)]. */
export function reconnectDelay(attempt, random = Math.random) {
  const ceiling = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_CAP_MS)
  return Math.max(RECONNECT_MIN_MS, Math.round(random() * ceiling))
}

export function reconnectingSocket(handlers = {}) {
  let target = null        // the current connect() target; null = closed on purpose
  let ws = null
  let pending = false      // resolving the target (e.g. fetching a token)
  let timer = null
  let attempts = 0
  let epoch = 0            // bumped by connect()/close(): a stale attempt never installs its socket
  let waiters = []         // whenOpen() promises

  const hasWindow = typeof window !== 'undefined'

  function clearTimer() { if (timer) { clearTimeout(timer); timer = null } }

  function settleWaiters(sock, error) {
    const list = waiters
    waiters = []
    for (const w of list) { clearTimeout(w.timer); if (error) w.reject(error); else w.resolve(sock) }
  }

  async function open() {
    if (!target || ws || pending) return
    const mine = epoch
    const resolveTarget = target
    pending = true
    let resolved = null
    try { resolved = await resolveTarget() } catch { resolved = null }
    if (mine !== epoch) return
    pending = false
    const { url, protocols } = typeof resolved === 'string' ? { url: resolved } : (resolved || {})
    if (!url) { schedule(); return }
    let sock
    try { sock = protocols ? new WebSocket(url, protocols) : new WebSocket(url) } catch { schedule(); return }
    ws = sock
    sock.onopen = () => {
      if (ws !== sock) return
      attempts = 0
      handlers.onOpen?.(sock)
      settleWaiters(sock)
    }
    sock.onmessage = (event) => { if (ws === sock) handlers.onMessage?.(event, sock) }
    sock.onerror = () => { /* onclose follows */ }
    sock.onclose = (event) => {
      if (ws !== sock) return
      ws = null
      handlers.onClose?.(event)
      schedule()
    }
  }

  function schedule() {
    settleWaiters(null, new Error('ws-failed'))   // a whenOpen() waits on one attempt, not on the retries
    if (!target || timer) return
    timer = setTimeout(() => { timer = null; open() }, reconnectDelay(attempts))
    attempts += 1
  }

  // The environment came back: reconnect now instead of waiting out the backoff.
  function wake() {
    if (!target || ws || pending) return
    clearTimer()
    attempts = 0
    open()
  }
  function onVisibility() { if (!document.hidden) wake() }

  function listen(on) {
    if (!hasWindow) return
    const method = on ? 'addEventListener' : 'removeEventListener'
    window[method]('online', wake)
    document[method]('visibilitychange', onVisibility)
  }

  function drop() {
    clearTimer()
    const sock = ws
    ws = null
    pending = false
    if (sock) { try { sock.close() } catch { /* already closed */ } }
  }

  /** (Re)connect to `nextTarget`, replacing any current socket, with a fresh backoff. */
  function connect(nextTarget) {
    epoch += 1
    drop()
    if (!target) listen(true)
    target = nextTarget
    attempts = 0
    open()
  }

  /** Close on purpose: no reconnect until connect() is called again. */
  function close() {
    epoch += 1
    if (target) listen(false)
    target = null
    drop()
    settleWaiters(null, new Error('closed'))
  }

  /** Resolves with the socket once it is open; rejects when the attempt fails, after `timeoutMs`, or on close(). */
  function whenOpen(timeoutMs) {
    if (ws && ws.readyState === WebSocket.OPEN) return Promise.resolve(ws)
    return new Promise((resolve, reject) => {
      const w = { resolve, reject, timer: null }
      if (timeoutMs) {
        w.timer = setTimeout(() => {
          waiters = waiters.filter(x => x !== w)
          reject(new Error('open-timeout'))
        }, timeoutMs)
      }
      waiters.push(w)
    })
  }

  function send(data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(data)
    return true
  }

  if (getCurrentScope()) onScopeDispose(close)

  return {
    connect,
    close,
    whenOpen,
    send,
    /** True while a target is set: open, connecting, or waiting to reconnect. */
    get active() { return !!target },
    get isOpen() { return !!ws && ws.readyState === WebSocket.OPEN },
    get socket() { return ws },
  }
}
