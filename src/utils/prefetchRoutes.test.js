import { describe, it, expect, vi } from 'vitest'
import { lazyLoaders, warm, prefetchRoutesWhenIdle } from './prefetchRoutes'

const lazy = (name) => Object.assign(vi.fn(() => Promise.resolve({ default: name })), { label: name })

describe('lazyLoaders', () => {
  it('takes the lazy components of signed-in dashboard pages, once each', () => {
    const a = lazy('Agents'), b = lazy('Connectors')
    const eager = { name: 'Landing', __vccOpts: {} }
    const routes = [
      { path: '/', components: { default: eager } },
      { path: '/dashboard/agents', meta: { requiresAuth: true }, components: { default: a } },
      { path: '/dashboard/connectors', components: { default: b } },
      { path: '/dashboard/agents/:id', components: { default: a } },
      { path: '/dashboard/public', meta: { requiresAuth: false }, components: { default: lazy('Public') } },
      { path: '/login', components: { default: lazy('Login') } },
    ]
    expect(lazyLoaders(routes)).toEqual([a, b])
  })
})

describe('warm', () => {
  it('calls every loader and survives one that fails', async () => {
    const ok = lazy('ok'), bad = vi.fn(() => Promise.reject(new Error('offline'))), thrower = vi.fn(() => { throw new Error('x') })
    await warm([ok, bad, thrower, lazy('z')], 2)
    expect(ok).toHaveBeenCalledTimes(1)
    expect(bad).toHaveBeenCalledTimes(1)
    expect(thrower).toHaveBeenCalledTimes(1)
  })
})

describe('prefetchRoutesWhenIdle', () => {
  const router = (loaders) => ({ isReady: () => Promise.resolve(), getRoutes: () => loaders.map((c, i) => ({ path: `/dashboard/p${i}`, components: { default: c } })) })

  it('waits for idle, then warms', async () => {
    const a = lazy('A')
    let idle
    const win = { requestIdleCallback: (fn) => { idle = fn } }
    expect(prefetchRoutesWhenIdle(router([a]), { win, nav: {} })).toBe(true)
    await Promise.resolve(); await Promise.resolve()
    expect(a).not.toHaveBeenCalled()
    await idle()
    expect(a).toHaveBeenCalledTimes(1)
  })

  it('does nothing for a person saving data or on 2G', () => {
    const a = lazy('A')
    expect(prefetchRoutesWhenIdle(router([a]), { win: {}, nav: { connection: { saveData: true } } })).toBe(false)
    expect(prefetchRoutesWhenIdle(router([a]), { win: {}, nav: { connection: { effectiveType: 'slow-2g' } } })).toBe(false)
    expect(a).not.toHaveBeenCalled()
  })
})
