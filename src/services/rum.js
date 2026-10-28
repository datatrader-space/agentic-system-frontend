// Real-user page-speed numbers (page-speed plan Phase 0 item 5).
//
// Reports Core Web Vitals (LCP, INP, CLS) plus FCP and TTFB, per route name, to POST /api/rum/ when the
// tab is hidden or closed — the moment the browser lets a page send its last data. Lab numbers (our
// own laptop, one tab) say little about what a person on a slow line sees; these do.
//
// What is sent: the route NAME (e.g. "dashboard-chat"), never the path (paths carry ids), the metric
// name/value/rating/id and the navigation type. No user data, no URLs.
//
// Sending: fetch with keepalive (it survives the tab closing, like sendBeacon) because a session-
// authenticated Django POST needs the X-CSRFToken header, which sendBeacon cannot set. sendBeacon is
// the fallback where keepalive fetch is missing.
//
// web-vitals is loaded by this module, and this module is imported lazily after the app has mounted,
// so none of it is in the entry bundle.
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'

// Share of page loads that report (1 = all). One constant so it can be lowered when traffic grows.
export const RUM_SAMPLE_RATE = 1
export const RUM_ENDPOINT = '/api/rum/'
// A browser that should not be counted sets this in its own localStorage (our live-test window does).
export const RUM_OFF_KEY = 'aadml:rum-off'

/**
 * Whether this browser's page loads are left out: an automated browser (`navigator.webdriver`) or one whose
 * owner turned reporting off for testing. Those run in windows the screen does not draw, and reported first
 * paints of 10 to 145 s on 2026-10-27, which a person never sees.
 */
export function rumDisabled({ nav = globalThis.navigator, storage = globalThis.localStorage } = {}) {
  if (nav && nav.webdriver === true) return true
  try { return !!storage && storage.getItem(RUM_OFF_KEY) === '1' } catch { return false }
}

/**
 * The most a person can be taken to have waited, per metric, in ms. A larger value comes from a window the screen does
 * not draw (a test browser that is not automated): on 2026-10-28 such windows reported first paints of 90 to 205 s and
 * an interaction of 589 s, which would hide every real number. Such a value is not sent.
 */
export const RUM_CEILING_MS = { FCP: 60000, LCP: 60000, INP: 30000 }

/** Whether a metric's value is one a person could have seen. Exported for tests. */
export function believable(metric) {
  const ceiling = RUM_CEILING_MS[metric && metric.name]
  return !(ceiling && Number(metric.value) > ceiling)
}

function getCookie(name) {
  const parts = (typeof document !== 'undefined' && document.cookie ? document.cookie.split(';') : [])
  for (const part of parts) {
    const c = part.trim()
    if (c.startsWith(name + '=')) return decodeURIComponent(c.substring(name.length + 1))
  }
  return null
}

/** Group buffered metrics into one body per route. Exported for tests. */
export function buildPayloads(buffer) {
  const byRoute = new Map()
  for (const m of buffer) {
    const key = `${m.route}::${m.navType}`
    if (!byRoute.has(key)) byRoute.set(key, { route: m.route, metrics: [], nav_type: m.navType })
    byRoute.get(key).metrics.push({ name: m.name, value: m.value, rating: m.rating, id: m.id })
  }
  return [...byRoute.values()]
}

export function sendPayload(body, { fetchImpl = globalThis.fetch, beacon = globalThis.navigator?.sendBeacon?.bind(globalThis.navigator) } = {}) {
  const json = JSON.stringify(body)
  if (typeof fetchImpl === 'function') {
    const headers = { 'Content-Type': 'application/json' }
    const csrf = getCookie('csrftoken')
    if (csrf) headers['X-CSRFToken'] = csrf
    try {
      const p = fetchImpl(RUM_ENDPOINT, { method: 'POST', body: json, headers, credentials: 'same-origin', keepalive: true })
      if (p && typeof p.catch === 'function') p.catch(() => {})
      return true
    } catch { /* fall through to the beacon */ }
  }
  if (typeof beacon === 'function') {
    try { return beacon(RUM_ENDPOINT, new Blob([json], { type: 'application/json' })) } catch { return false }
  }
  return false
}

/**
 * Start collecting. `routeName()` returns the current route's name at the moment a metric is final.
 * Returns a flush() function (also run on visibilitychange→hidden and pagehide).
 */
export function startRum(routeName, { random = Math.random, send = sendPayload, disabled = rumDisabled } = {}) {
  if (disabled() || random() >= RUM_SAMPLE_RATE) return () => {}
  let buffer = []

  const record = (metric) => {
    if (!believable(metric)) return
    let route = 'unknown'
    try { route = String(routeName() || 'unknown') } catch { /* keep unknown */ }
    buffer.push({
      route,
      name: metric.name,
      value: Math.round(metric.value * 1000) / 1000,
      rating: metric.rating,
      id: metric.id,
      navType: metric.navigationType || 'navigate',
    })
  }

  const flush = () => {
    if (!buffer.length) return
    const payloads = buildPayloads(buffer)
    buffer = []
    for (const body of payloads) send(body)
  }

  onLCP(record)
  onINP(record)
  onCLS(record)
  onFCP(record)
  onTTFB(record)

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
  }
  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush)
  return flush
}
