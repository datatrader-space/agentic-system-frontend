// Start downloading a route's code when the person points at its link (page-speed plan Phase 5 item 14).
//
// Route components are lazy loaders (`() => import('./views/X.vue')`). Calling the loader on hover or
// keyboard focus fetches the chunk ~100-300 ms before the click, so the click renders at once. The
// browser keeps the module, so the router's own call later is instant. A failed prefetch is forgotten
// (the click then loads, or recovers, as it always did).
const started = new WeakSet()

export function prefetchRoute(router, to) {
  let resolved
  try { resolved = router.resolve(to) } catch { return }
  for (const record of resolved.matched || []) {
    const loader = record.components && record.components.default
    if (typeof loader !== 'function' || started.has(loader)) continue
    started.add(loader)
    try {
      const p = loader()
      if (p && typeof p.catch === 'function') p.catch(() => started.delete(loader))
    } catch {
      started.delete(loader)
    }
  }
}

// Delegated handler for a whole nav: <nav @mouseover="onNavIntent" @focusin="onNavIntent">.
export function prefetchFromEvent(router, event) {
  const link = event && event.target && event.target.closest ? event.target.closest('a[href]') : null
  if (!link) return
  const href = link.getAttribute('href')
  if (!href || !href.startsWith('/') || href.startsWith('//')) return
  prefetchRoute(router, href)
}

// The sidebar's main routes, fetched while the browser has nothing else to do, so even a first click
// that was never hovered (touch, a fast pointer) renders at once (ADM-1069). Once per browser session,
// one route per idle period, and never when the person asked to save data or the connection is 2G:
// there the bytes cost more than the wait.
const IDLE_KEY = 'aadml.idleRoutePrefetch'
let idleStarted = false

const slowConnection = () => {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null
  return !!(c && (c.saveData || ['slow-2g', '2g'].includes(c.effectiveType)))
}

const whenIdle = (cb) => (typeof window.requestIdleCallback === 'function'
  ? window.requestIdleCallback(cb, { timeout: 10000 })
  : setTimeout(cb, 2000))

export function prefetchRoutesWhenIdle(router, paths) {
  if (idleStarted || typeof window === 'undefined' || slowConnection()) return
  idleStarted = true
  try {
    if (window.sessionStorage.getItem(IDLE_KEY)) return
    window.sessionStorage.setItem(IDLE_KEY, '1')
  } catch { /* no storage: once per page load */ }
  const queue = [...paths]
  const next = () => {
    const path = queue.shift()
    if (!path) return
    prefetchRoute(router, path)
    whenIdle(next)
  }
  whenIdle(next)
}
