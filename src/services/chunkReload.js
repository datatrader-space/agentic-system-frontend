// Recover from a stale chunk after a deploy (page-speed plan F-C1).
//
// A tab opened before a deploy still runs the old index-*.js, which names route chunks by their old
// hashes. After the deploy those files are gone, so the next lazy route (or async component) fails
// with "Failed to fetch dynamically imported module" and the click does nothing until the person
// refreshes. We do that refresh for them, ONCE: a sessionStorage stamp stops a loop when the reload
// does not help (a real outage, an offline tab), and after RELOAD_WINDOW_MS a later deploy can
// recover the same tab again.

export const CHUNK_RELOAD_KEY = 'aadml:chunk-reload'
export const RELOAD_WINDOW_MS = 60_000

const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i

export function isChunkLoadError(err) {
  if (!err) return false
  const text = typeof err === 'string' ? err : `${err.message || ''} ${err.name || ''}`
  return CHUNK_ERROR.test(text)
}

function _storage() {
  try { return window.sessionStorage } catch { return null }
}

/**
 * Reload once to `target` (a same-app path). Returns true when a reload was started, false when the
 * guard says one already happened within RELOAD_WINDOW_MS (so the caller shows the error instead).
 */
export function reloadOnceForChunkError(target, { now = Date.now(), storage = _storage(), assign } = {}) {
  let last = null
  try { last = JSON.parse(storage?.getItem(CHUNK_RELOAD_KEY) || 'null') } catch { last = null }
  if (last && typeof last.at === 'number' && now - last.at < RELOAD_WINDOW_MS) return false
  // Only ever reload within this app: a path, never a full URL handed in from somewhere else.
  const path = typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : (window.location.pathname + window.location.search + window.location.hash)
  try { storage?.setItem(CHUNK_RELOAD_KEY, JSON.stringify({ at: now, path })) } catch { /* private mode: still reload once */ }
  const go = assign || ((p) => window.location.assign(p))
  go(path)
  return true
}

/** Wire both entry points: Vite's preload failure event and the router's lazy-route failure. */
export function installChunkReload(router) {
  window.addEventListener('vite:preloadError', (event) => {
    const here = window.location.pathname + window.location.search + window.location.hash
    if (reloadOnceForChunkError(here)) event.preventDefault()
  })
  router.onError((err, to) => {
    if (isChunkLoadError(err)) reloadOnceForChunkError(to?.fullPath)
  })
}
