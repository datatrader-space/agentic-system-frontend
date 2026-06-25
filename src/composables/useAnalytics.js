/**
 * First-party analytics collector (Track D). Privacy-first:
 *  - fires only after explicit cookie consent (and never if Do-Not-Track is on),
 *  - sends to the backend beacon /api/analytics/collect/ (which masks IP + flags bots),
 *  - keeps a fallback visitor_id in localStorage for environments where the
 *    httponly cookie can't round-trip (the server cookie is still authoritative).
 *
 * Exported as plain functions so the router afterEach hook can use it outside setup.
 */
const CONSENT_KEY = 'aadml_consent'   // 'granted' | 'denied' | null
const VID_KEY = 'aadml_vid_client'

function dntOn() {
  try {
    const v = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack
    return v === '1' || v === 'yes'
  } catch { return false }
}

export function consentState() {
  try { return localStorage.getItem(CONSENT_KEY) } catch { return null }
}
export function hasConsent() { return consentState() === 'granted' }
export function setConsent(granted) {
  try { localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied') } catch { /* ignore */ }
}
export function analyticsEnabled() { return hasConsent() && !dntOn() }

function visitorId() {
  try {
    let v = localStorage.getItem(VID_KEY)
    if (!v) {
      v = (crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)))
      localStorage.setItem(VID_KEY, v)
    }
    return v
  } catch { return undefined }
}

function utmFromUrl() {
  const out = {}
  try {
    const p = new URLSearchParams(window.location.search)
    for (const k of ['source', 'medium', 'campaign', 'term', 'content']) {
      const val = p.get('utm_' + k)
      if (val) out['utm_' + k] = val.slice(0, 120)
    }
  } catch { /* ignore */ }
  return out
}

function send(payload) {
  const body = JSON.stringify({ visitor_id: visitorId(), ...payload })
  const url = '/api/analytics/collect/'
  // Prefer keepalive fetch (sends cookies, lets us hit the proxied /api path); fall back to sendBeacon.
  try {
    if (typeof fetch === 'function') {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                   body, credentials: 'include', keepalive: true }).catch(() => {})
      return
    }
  } catch { /* fall through */ }
  try {
    navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))
  } catch { /* ignore */ }
}

/** Record a pageview. Pass the resolved route (vue-router `to`) or nothing for current location. */
export function trackPageview(to) {
  if (!analyticsEnabled()) return
  const path = to?.path || window.location.pathname
  send({
    path: path.slice(0, 500),
    title: (document.title || '').slice(0, 300),
    referrer: (document.referrer || '').slice(0, 1000),
    ...utmFromUrl(),
  })
}

/** Record a named funnel/interaction event. */
export function track(name, props = {}) {
  if (!analyticsEnabled() || !name) return
  send({ event: String(name).slice(0, 100), props })
}

/** Link this visitor to the authenticated user (call right after login/signup). */
export function identify() {
  if (!analyticsEnabled()) return
  send({ event: 'identify' })
}

export function useAnalytics() {
  return { trackPageview, track, identify, hasConsent, setConsent, consentState, analyticsEnabled }
}
