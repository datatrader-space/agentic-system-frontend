// @vitest-environment jsdom
// The workflow sharing calls (ADM-1339) as they leave the browser, per the WF_1339 contract.
import { describe, it, expect, beforeEach, vi } from 'vitest'

// api.js wraps the instance methods (caching, cache invalidation), so the spies are held apart from the instance.
const h = vi.hoisted(() => ({ instance: null, get: null, post: null, patch: null, del: null }))
vi.mock('axios', () => {
  h.get = vi.fn(() => Promise.resolve({ data: {} }))
  h.post = vi.fn(() => Promise.resolve({ data: {} }))
  h.patch = vi.fn(() => Promise.resolve({ data: {} }))
  h.del = vi.fn(() => Promise.resolve({ data: null }))
  h.instance = {
    get: h.get,
    post: h.post,
    put: vi.fn(), patch: h.patch, delete: h.del,
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { withCredentials: true },
  }
  return { default: { create: () => h.instance, defaults: {} } }
})

import api, { clearApiCache } from './api'

beforeEach(() => { clearApiCache(); vi.clearAllMocks() })

describe('workflow shares', () => {
  it('lists, adds, changes and removes shares, and lists the people', async () => {
    await api.getWorkflowShares(86)
    expect(h.get.mock.calls[0][0]).toBe('/workflow-graphs/86/shares/')
    await api.addWorkflowShare(86, { email: 'ann@x.test', role: 'runner' })
    expect(h.post).toHaveBeenCalledWith('/workflow-graphs/86/shares/', { email: 'ann@x.test', role: 'runner' })
    await api.updateWorkflowShare(86, 7, 'editor')
    expect(h.patch).toHaveBeenCalledWith('/workflow-graphs/86/shares/7/', { role: 'editor' })
    await api.removeWorkflowShare(86, 7)
    expect(h.del).toHaveBeenCalledWith('/workflow-graphs/86/shares/7/')
    await api.getWorkflowPeople(86)
    expect(h.get.mock.calls.at(-1)[0]).toBe('/workflow-graphs/86/people/')
  })

  it('the list can be narrowed to shared-with-me', async () => {
    await api.getWorkflowGraphs({ limit: 30, offset: 0, shared: 'me' })
    expect(h.get.mock.calls[0][0]).toBe('/workflow-graphs/')
    expect(h.get.mock.calls[0][1].params).toEqual({ limit: 30, offset: 0, shared: 'me' })
  })
})

describe('what uses a workflow (ADM-1351 phase 4)', () => {
  it('reads the impact fresh every time: never served from the cache', async () => {
    await api.getWorkflowGraphImpact(86)
    await api.getWorkflowGraphImpact(86)
    expect(h.get).toHaveBeenCalledTimes(2)
    expect(h.get.mock.calls.map((c) => c[0])).toEqual(['/workflow-graphs/86/impact/', '/workflow-graphs/86/impact/'])
  })
})
