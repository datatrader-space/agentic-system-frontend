// Browser (OS) notification when an agent run FINISHES while the user is away from the chat.
//
// Fires only with granted permission and only when the person did NOT watch the run end (`seen`), so it never
// notifies someone who is looking at it. Clicking it focuses the window and
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

// True when this page is in front of the person: its tab visible and its window focused. Also what the chat store
// tells the server about the chat it shows (`chat_presence`), so a turn that ends on screen gets no bell notification.
export function pageIsFocused() {
  try {
    return typeof document !== 'undefined'
      && document.visibilityState === 'visible'
      && (typeof document.hasFocus !== 'function' || document.hasFocus())
  } catch {
    return false
  }
}

// Fire the browser notification for a finished run. `snippet` = the answer text (trimmed to a preview).
// `seen`: the person watched it end, on this page or another of theirs (the chat store's open chat in a focused page,
// or the server's `seen` from `chat_presence`). It used to be judged from this page's URL (`/chat/<id>`), so a Let's
// Code project chat on screen still raised one (phase 8 run 3, finding 41).
export function notifyRunFinished({ agentName, snippet, conversationId, seen = false }) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!conversationId || seen) return
    const title = `${agentName || 'Your agent'} finished`
    const body = String(snippet || '').replace(/\s+/g, ' ').trim().slice(0, 140) || 'The run is complete.'
    const n = new Notification(title, { body, tag: 'run-' + conversationId, icon: '/icon-192.png' })
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
