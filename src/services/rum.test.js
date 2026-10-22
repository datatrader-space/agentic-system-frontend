// @vitest-environment jsdom
// Phase 0 item 5: web-vitals reported per route name, flushed when the tab is hidden.
import { describe, it, expect, beforeEach, vi } from 'vitest'

const cbs = vi.hoisted(() => ({}))
vi.mock('web-vitals', () => ({
  onLCP: (cb) => { cbs.LCP = cb },
  onINP: (cb) => { cbs.INP = cb },
  onCLS: (cb) => { cbs.CLS = cb },
  onFCP: (cb) => { cbs.FCP = cb },
  onTTFB: (cb) => { cbs.TTFB = cb },
}))

import { startRum, buildPayloads, sendPayload, RUM_ENDPOINT } from './rum'

const metric = (name, value, extra = {}) => ({ name, value, rating: 'good', id: `v1-${name}`, navigationType: 'navigate', ...extra })
let visibility = 'visible'
beforeEach(() => {
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})

describe('rum', () => {
  it('groups metrics into one body per route, in the agreed shape', () => {
    const bodies = buildPayloads([
      { route: 'dashboard-chat', name: 'LCP', value: 1234.5, rating: 'good', id: 'a', navType: 'navigate' },
      { route: 'dashboard-chat', name: 'CLS', value: 0.01, rating: 'good', id: 'b', navType: 'navigate' },
      { route: 'agent-library', name: 'INP', value: 80, rating: 'good', id: 'c', navType: 'navigate' },
    ])
    expect(bodies).toEqual([
      { route: 'dashboard-chat', nav_type: 'navigate', metrics: [
        { name: 'LCP', value: 1234.5, rating: 'good', id: 'a' },
        { name: 'CLS', value: 0.01, rating: 'good', id: 'b' },
      ] },
      { route: 'agent-library', nav_type: 'navigate', metrics: [{ name: 'INP', value: 80, rating: 'good', id: 'c' }] },
    ])
  })

  it('sends on visibilitychange→hidden with the route name current at report time, then nothing twice', () => {
    const send = vi.fn()
    let route = 'dashboard-chat'
    startRum(() => route, { random: () => 0, send })
    cbs.LCP(metric('LCP', 1500))
    route = 'agent-library'
    cbs.INP(metric('INP', 96))
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls.map((c) => c[0].route)).toEqual(['dashboard-chat', 'agent-library'])
    document.dispatchEvent(new Event('visibilitychange'))
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('posts with keepalive, same-origin credentials and the CSRF header', () => {
    document.cookie = 'csrftoken=tok123'
    const fetchImpl = vi.fn(() => Promise.resolve({}))
    sendPayload({ route: 'r', metrics: [], nav_type: 'navigate' }, { fetchImpl })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(RUM_ENDPOINT)
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'same-origin' })
    expect(init.headers['X-CSRFToken']).toBe('tok123')
    expect(JSON.parse(init.body)).toEqual({ route: 'r', metrics: [], nav_type: 'navigate' })
  })

  it('falls back to sendBeacon when fetch is missing', () => {
    const beacon = vi.fn(() => true)
    expect(sendPayload({ route: 'r', metrics: [] }, { fetchImpl: null, beacon })).toBe(true)
    expect(beacon).toHaveBeenCalledWith(RUM_ENDPOINT, expect.any(Blob))
  })
})
