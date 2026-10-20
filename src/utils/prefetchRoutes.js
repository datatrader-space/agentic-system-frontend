// Warm the dashboard pages' code once the app is idle, so a FIRST visit to a page does not wait on it.
//
// Every dashboard page is a lazy route chunk. Measured 2026-10-20 from Pakistan to the us-west-1 server
// (~280 ms round trip): the first visit to Connectors waited ~2.4 s, Schedules ~1.9 s, Budgets ~2.0 s for
// their chunks, while a second visit to the same page took ~0.16 s. Loading the chunks in the background
// after the current page has settled moves that wait off the click.
//
// Polite by construction: it starts only when the browser is idle, loads a few chunks at a time, skips a
// person who asked to save data or is on a 2G connection, and never throws — a chunk that fails here is
// simply loaded again, as before, when its page is opened.

const DEFAULT_BATCH = 3

function slowOrSaving(nav) {
  const c = nav && nav.connection
  if (!c) return false
  return !!c.saveData || /(^|-)2g$/.test(String(c.effectiveType || ''))
}

/** The lazy component loaders of the routes worth warming: signed-in pages under `prefix`. */
export function lazyLoaders(routes, prefix = '/dashboard') {
  const seen = new Set()
  const out = []
  for (const route of routes || []) {
    if (!String(route.path || '').startsWith(prefix)) continue
    if (route.meta && route.meta.requiresAuth === false) continue
    for (const comp of Object.values(route.components || {})) {
      // A lazy route component is a plain function returning import(); an eager one is an object.
      if (typeof comp === 'function' && !comp.__vccOpts && !seen.has(comp)) {
        seen.add(comp)
        out.push(comp)
      }
    }
  }
  return out
}

/** Load `loaders` a few at a time; resolves when all were tried. Failures are swallowed. */
export async function warm(loaders, batch = DEFAULT_BATCH) {
  for (let i = 0; i < loaders.length; i += batch) {
    await Promise.allSettled(loaders.slice(i, i + batch).map((load) => {
      try { return load() } catch (e) { return Promise.reject(e) }
    }))
  }
}

/** Start warming after the router is ready and the browser is idle. Returns false when it chose not to. */
export function prefetchRoutesWhenIdle(router, { win = globalThis.window, nav = globalThis.navigator } = {}) {
  if (!router || !win || slowOrSaving(nav)) return false
  const start = () => warm(lazyLoaders(router.getRoutes()))
  const whenIdle = (fn) => (typeof win.requestIdleCallback === 'function'
    ? win.requestIdleCallback(fn, { timeout: 4000 })
    : win.setTimeout(fn, 2500))
  Promise.resolve(router.isReady ? router.isReady() : undefined).then(() => whenIdle(start)).catch(() => {})
  return true
}
