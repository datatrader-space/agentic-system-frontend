// Who may post an OAuth result to this window.
//
// The connect popups end on a page this app's own backend serves, which posts the result to its opener.
// Every listener used to act on ANY window's message of the right shape: a page the app had opened, or one
// that opened the app, could post `{type: 'mcp_oauth_result', ok: true, connection_id: X}` and the add-server
// form would submit itself with an attacker-chosen connection (security audit, frontend finding A7).
//
// A result is trusted only from this app's origin, or from the API origin configured for development when
// the API is served from another port (VITE_PUBLIC_API_BASE).
function _apiOrigin() {
  try {
    const base = import.meta.env && import.meta.env.VITE_PUBLIC_API_BASE
    return base ? new URL(base, window.location.origin).origin : ''
  } catch (e) {
    return ''
  }
}

export function isTrustedPopupMessage(event) {
  if (!event || typeof event.origin !== 'string') return false
  if (typeof window === 'undefined' || !window.location) return false
  return event.origin === window.location.origin || (!!_apiOrigin() && event.origin === _apiOrigin())
}

export default isTrustedPopupMessage
