// Browser (OS) notification when an agent run FINISHES while the user is away from the chat.
//
// Fires only with granted permission and only when the user is NOT actively looking at this chat in a
// focused tab (so it never double-notifies someone who's watching). Clicking it focuses the window and
// lands on the agent chat. Everything is best-effort + guarded — a browser without the Notification API,
// or a denied permission, silently no-ops.

let _permAsked = false

// Ask for permission ONCE, from a user gesture (call this from the send action). Never throws.
export function ensureNotifyPermission() {
  try {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default' && !_permAsked) {
      _permAsked = true
      const r = Notification.requestPermission()
      if (r && typeof r.catch === 'function') r.catch(() => {})
    }
  } catch { /* no-op */ }
}

// True when the user is actively viewing THIS chat (visible, focused, on its URL) — suppress then.
function _activelyViewing(conversationId) {
  try {
    const onThisChat = typeof window !== 'undefined'
      && window.location.pathname.includes('/chat/' + conversationId)
    const focused = typeof document !== 'undefined'
      && document.visibilityState === 'visible'
      && (typeof document.hasFocus !== 'function' || document.hasFocus())
    return onThisChat && focused
  } catch {
    return false
  }
}

// Fire the browser notification for a finished run. `snippet` = the answer text (trimmed to a preview).
export function notifyRunFinished({ agentName, snippet, conversationId }) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!conversationId || _activelyViewing(conversationId)) return
    const title = `${agentName || 'Your agent'} finished`
    const body = String(snippet || '').replace(/\s+/g, ' ').trim().slice(0, 140) || 'The run is complete.'
    const n = new Notification(title, { body, tag: 'run-' + conversationId, icon: '/favicon.ico' })
    n.onclick = () => {
      try { window.focus() } catch { /* */ }
      try {
        const target = '/dashboard/chat/' + conversationId
        if (window.location.pathname !== target) window.location.assign(target)
      } catch { /* */ }
      try { n.close() } catch { /* */ }
    }
  } catch { /* no-op */ }
}
