// @vitest-environment jsdom
// The sidebar's routes are fetched ahead while the browser is idle: once per session, one route per idle
// period, and not at all when the person saves data or is on 2G.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const loaders = {}
const router = { resolve: (path) => ({ matched: [{ components: { default: (loaders[path] ||= vi.fn(() => Promise.resolve({}))) } }] }) }
const PATHS = ['/dashboard', '/dashboard/agents', '/video-studio']
const called = () => PATHS.filter((p) => loaders[p] && loaders[p].mock.calls.length)

let idle
async function fresh() {
  vi.resetModules()
  return (await import('./prefetchRoute')).prefetchRoutesWhenIdle
}
function setConnection(value) {
  Object.defineProperty(navigator, 'connection', { configurable: true, get: () => value })
}
beforeEach(() => {
  for (const k of Object.keys(loaders)) delete loaders[k]
  window.sessionStorage.clear()
  idle = []
  window.requestIdleCallback = vi.fn((cb) => { idle.push(cb); return idle.length })
  setConnection(undefined)
})
afterEach(() => { delete window.requestIdleCallback; delete navigator.connection; vi.useRealTimers() })
const runIdle = () => { const cbs = idle; idle = []; cbs.forEach((cb) => cb()) }

describe('prefetchRoutesWhenIdle', () => {
  it('fetches one route per idle period, in order, and only once per session', async () => {
    let prefetch = await fresh()
    prefetch(router, PATHS)
    expect(called()).toEqual([])                      // nothing before the browser is idle
    runIdle(); expect(called()).toEqual(['/dashboard'])
    runIdle(); expect(called()).toEqual(['/dashboard', '/dashboard/agents'])
    runIdle(); runIdle(); expect(called()).toEqual(PATHS)
    expect(idle).toEqual([])                          // and then it stops
    prefetch(router, PATHS)                           // a second sidebar (the mobile drawer)
    expect(idle).toEqual([])
    prefetch = await fresh()                          // a reload in the same tab session
    prefetch(router, PATHS)
    expect(idle).toEqual([])
  })

  it.each([{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }])('does nothing on %o', async (connection) => {
    setConnection(connection)
    const prefetch = await fresh()
    prefetch(router, PATHS)
    expect(window.requestIdleCallback).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem('aadml.idleRoutePrefetch')).toBe(null)   // a faster connection later may
  })

  it('runs on a 4G connection, and falls back to a timer without requestIdleCallback', async () => {
    setConnection({ effectiveType: '4g', saveData: false })
    delete window.requestIdleCallback
    vi.useFakeTimers()
    const prefetch = await fresh()
    prefetch(router, PATHS)
    expect(called()).toEqual([])
    await vi.advanceTimersByTimeAsync(2000)
    expect(called()).toEqual(['/dashboard'])
    await vi.advanceTimersByTimeAsync(4000)
    expect(called()).toEqual(PATHS)
  })
})
