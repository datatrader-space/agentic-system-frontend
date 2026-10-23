// The ONE OAuth popup flow (page-speed plan F-H7). Every "Connect your account" button uses this, in
// place of the five hand-written copies that each got a different part wrong.
//
// What it guarantees:
//   - The popup is opened SYNCHRONOUSLY, as `about:blank`, inside the click. Browsers only allow a popup
//     that is opened in the same task as the user's click; the old code awaited the server for the
//     authorize URL first and then called window.open, which a popup blocker treats as unsolicited — the
//     click "did nothing". Once the URL arrives the blank popup is sent there.
//   - It always settles: a trusted postMessage, the popup closing (checked every 500 ms), a timeout, or
//     the owning component going away. Nothing can leave a button stuck on "Connecting…".
//   - A closed popup is not a failure by itself: the callback page also writes its result to
//     localStorage, and the caller can pass `verify()` to ask the server (the only authority) whether the
//     connection landed. See the note in useOAuthConnect.js on Cross-Origin-Opener-Policy.
//   - A completed connect changes server state that no SPA write touched (the provider redirected the
//     popup to the backend), so it ends with clearApiCache(); the caller then re-reads status with
//     { noCache: true }.
//   - The `busy` flag of useOAuthPopup() is reset in `finally`, whatever happened.
//
// Usage inside a click handler (call run() BEFORE any await, or the popup is no longer "in the click"):
//   const { busy, run } = useOAuthPopup()
//   async function connect() {
//     const result = await run(() => api.startOAuth(id).then((r) => r.data?.redirect_url), {
//       messageTypes: ['oauth_result'],
//       verify: async () => (await api.get(`/oauth/status/${id}/`, { noCache: true })).data?.connected,
//     })
//     if (result.ok) ... else if (result.status !== 'cancelled') notify.error(result.error)
//   }
import { ref, getCurrentScope, onScopeDispose } from 'vue'
import { clearApiCache } from '@/services/api'
import { isTrustedPopupMessage } from '@/utils/popupMessages'

// Written by the popup page as a second channel. Kept in sync with `_STORAGE_KEY` in
// agent/services/oauth_popup.py.
export const OAUTH_RESULT_KEY = 'aadml:oauth-result'
export const DEFAULT_POPUP_FEATURES = 'width=600,height=700,left=200,top=100,scrollbars=yes'
export const POPUP_BLOCKED_MESSAGE = 'Popup blocked — please allow popups for this site'

const defaultIsSuccess = (d) => !!d && (d.status === 'success' || d.ok === true || d.success === true)
const errorOf = (d, fallback) => (d && (d.error || d.message || d.detail)) || fallback

export function readStoredOAuthResult() {
  try {
    const raw = localStorage.getItem(OAUTH_RESULT_KEY)
    if (!raw) return null
    localStorage.removeItem(OAUTH_RESULT_KEY) // consume it, so a stale result cannot satisfy a later attempt
    return JSON.parse(raw)
  } catch {
    return null // partitioned or blocked storage throws rather than returning null
  }
}

function safeClearCache() {
  try { clearApiCache() } catch { /* a cache that will not clear must not fail the connect */ }
}

function messageOfError(err, fallback) {
  return err?.response?.data?.error || err?.response?.data?.detail || err?.message || fallback
}

/**
 * Open the OAuth popup and wait for its outcome. Never rejects.
 *
 * @param {() => (string|Promise<string>)} getUrl  returns the authorize URL (usually from the server)
 * @param {object} [opts]
 * @param {string[]} [opts.messageTypes]  postMessage `type` values that carry this flow's result
 * @param {(data:object) => boolean} [opts.isSuccess]
 * @param {() => Promise<boolean>} [opts.verify]  asked when the popup closes or times out without a message
 * @param {number} [opts.timeoutMs=120000]
 * @param {number} [opts.closeGraceMs=600]  wait after the popup closes before asking the server
 * @param {string} [opts.name='oauth-connection']
 * @param {string} [opts.features]
 * @param {AbortSignal} [opts.signal]  settles the flow as 'cancelled' (the popup is left alone)
 * @returns {Promise<{ok:boolean, status:'success'|'failed'|'closed'|'timeout'|'blocked'|'error'|'cancelled', data?:object, error?:string}>}
 */
export async function runOAuthPopup(getUrl, opts = {}) {
  const {
    messageTypes = ['oauth-connection-result', 'oauth_result', 'mcp_oauth_result'],
    isSuccess = defaultIsSuccess,
    verify = null,
    timeoutMs = 120000,
    closeGraceMs = 600,
    name = 'oauth-connection',
    features = DEFAULT_POPUP_FEATURES,
    signal = null,
  } = opts

  // A result left by an earlier attempt must not satisfy this one.
  readStoredOAuthResult()

  // SYNCHRONOUS: this line must run inside the click's task. Nothing above it awaits.
  let popup = null
  try { popup = window.open('about:blank', name, features) } catch { popup = null }
  if (!popup) return { ok: false, status: 'blocked', error: POPUP_BLOCKED_MESSAGE }

  const closePopup = () => { try { if (!popup.closed) popup.close() } catch { /* already gone */ } }

  try {
    let url
    try {
      url = await getUrl()
    } catch (err) {
      closePopup()
      return { ok: false, status: 'error', error: messageOfError(err, 'Failed to start the connection') }
    }
    if (signal?.aborted) { closePopup(); return { ok: false, status: 'cancelled' } }
    if (!url) {
      closePopup()
      return { ok: false, status: 'error', error: 'No redirect URL received' }
    }
    if (!popup.closed) {
      try {
        popup.location.href = url
      } catch (err) {
        closePopup()
        return { ok: false, status: 'error', error: messageOfError(err, 'Could not open the sign-in page') }
      }
    }

    const outcome = await new Promise((resolve) => {
      let done = false
      let poll = null
      let timer = null
      const finish = (value) => {
        if (done) return
        done = true
        window.removeEventListener('message', onMessage)
        if (poll) clearInterval(poll)
        if (timer) clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onAbort)
        resolve(value)
      }
      const onMessage = (event) => {
        if (!isTrustedPopupMessage(event)) return
        const data = event.data
        if (!data || !messageTypes.includes(data.type)) return
        finish({ kind: 'message', data })
      }
      const onAbort = () => finish({ kind: 'cancelled' })
      window.addEventListener('message', onMessage)
      if (signal) {
        if (signal.aborted) { finish({ kind: 'cancelled' }); return }
        signal.addEventListener('abort', onAbort)
      }
      const checkClosed = () => {
        let closed = false
        try { closed = popup.closed } catch { closed = false }
        if (closed) finish({ kind: 'closed' })
      }
      poll = setInterval(checkClosed, 500)
      timer = setTimeout(() => { closePopup(); finish({ kind: 'timeout' }) }, timeoutMs)
      checkClosed()
    })

    if (outcome.kind === 'cancelled') return { ok: false, status: 'cancelled' }
    if (outcome.kind === 'message') {
      const ok = !!isSuccess(outcome.data)
      return ok
        ? { ok: true, status: 'success', data: outcome.data }
        : { ok: false, status: 'failed', data: outcome.data, error: errorOf(outcome.data, 'Connection failed') }
    }

    // Closed or timed out with no message. The popup can close a beat before the server has committed,
    // so wait a moment, then read the second channel, then ask the server.
    if (closeGraceMs > 0) await new Promise((r) => setTimeout(r, closeGraceMs))
    const stored = readStoredOAuthResult()
    if (stored) {
      return isSuccess(stored)
        ? { ok: true, status: 'success', data: stored }
        : { ok: false, status: 'failed', data: stored, error: errorOf(stored, 'Connection failed') }
    }
    if (verify) {
      safeClearCache() // the status read must not be answered from a pre-connect cache entry
      let connected = false
      try { connected = !!(await verify()) } catch { connected = false }
      if (connected) return { ok: true, status: 'success' }
    }
    return outcome.kind === 'timeout'
      ? { ok: false, status: 'timeout', error: 'Connection timed out' }
      : { ok: false, status: 'closed', error: 'Connection window was closed before it finished' }
  } finally {
    safeClearCache()
  }
}

/**
 * Component-bound wrapper: a `busy` ref reset in `finally`, and any flow still waiting is settled as
 * 'cancelled' when the component unmounts (its listeners and timers are removed).
 */
export function useOAuthPopup() {
  const busy = ref(false)
  const controllers = new Set()

  async function run(getUrl, opts = {}) {
    const ctrl = new AbortController()
    controllers.add(ctrl)
    busy.value = true
    try {
      // runOAuthPopup opens the popup before its first await, so this is still inside the click.
      return await runOAuthPopup(getUrl, { ...opts, signal: ctrl.signal })
    } finally {
      controllers.delete(ctrl)
      busy.value = controllers.size > 0
    }
  }

  if (getCurrentScope()) {
    onScopeDispose(() => { for (const c of controllers) c.abort(); controllers.clear() })
  }

  return { busy, run }
}

export default useOAuthPopup
