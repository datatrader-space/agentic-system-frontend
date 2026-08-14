// @vitest-environment jsdom
// (the 401 interceptor reads window.location; the suite's default environment is node)
import { describe, it, expect, beforeEach, vi } from 'vitest'

// axios is stubbed at the module boundary so we can count REAL network calls and drive the response
// interceptor directly. `vi.hoisted` gives the test access to the same instance api.js wraps.
const h = vi.hoisted(() => ({
  calls: { get: 0 },
  instance: null,
  // api.js REPLACES instance.get with its dedup/cache wrapper, so the spy must be held separately —
  // instance.get is the wrapper by the time the tests run.
  rawGet: null,
  responseErrorHandler: null,
}))

vi.mock('axios', () => {
  h.rawGet = vi.fn((url, config) => { h.calls.get += 1; return Promise.resolve({ data: { ok: true } }) })
  h.instance = {
    get: h.rawGet,
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn((_ok, err) => { h.responseErrorHandler = err }) },
    },
    defaults: { withCredentials: true },
  }
  return { default: { create: () => h.instance, defaults: {} } }
})

import api, { clearApiCache } from './api'

beforeEach(() => {
  clearApiCache()          // the real reset the login/logout flows use
  h.calls.get = 0
  h.rawGet.mockClear()
})

describe('api GET cache — auth entries survive unrelated writes', () => {
  it('serves /auth/check from cache on the second call', async () => {
    await api.checkAuth()
    await api.checkAuth()
    expect(h.calls.get).toBe(1)
  })

  it('an unrelated write does NOT evict the cached auth check', async () => {
    await api.checkAuth()
    expect(h.calls.get).toBe(1)

    // Saving an agent used to call _cache.clear(), which wiped /auth/check too — so the very next
    // navigation paid a blocking round trip in the router guard. THAT is the hang this guards.
    await api.post('/agents/1/pause/', {})
    await api.checkAuth()
    expect(h.calls.get).toBe(1)
  })

  it('an unrelated write DOES evict other cached reference data', async () => {
    await api.get('/llm/providers/')
    expect(h.calls.get).toBe(1)
    await api.post('/agents/1/pause/', {})
    await api.get('/llm/providers/')
    expect(h.calls.get).toBe(2)
  })

  it('an AUTH write clears everything, auth entries included', async () => {
    await api.checkAuth()
    await api.get('/llm/providers/')
    expect(h.calls.get).toBe(2)

    // Login/logout genuinely change who the caller is — nothing may survive.
    await api.post('/auth/logout')
    await api.checkAuth()
    await api.get('/llm/providers/')
    expect(h.calls.get).toBe(4)
  })
})

describe('api GET cache — super agent card', () => {
  it('caches the super-agent read and drops it after a per-user write', async () => {
    await api.getSuperAgentCard()
    await api.getSuperAgentCard()
    expect(h.calls.get).toBe(1)

    await api.post('/agents/9/select-run-mode/', { agent_run_mode: 'autonomous' })
    await api.getSuperAgentCard()
    expect(h.calls.get).toBe(2)
  })

  it('requests the slim variant', async () => {
    await api.getSuperAgentCard()
    expect(h.rawGet).toHaveBeenCalledWith('/agents/super-agent/', { params: { slim: 1 } })
  })
})

describe('api 401 handling', () => {
  it('redirects to /login and clears storage when a session dies', async () => {
    const assign = vi.fn()
    // jsdom's window.location is read-only; replace it for the assertion.
    delete window.location
    window.location = { pathname: '/dashboard/chat/new', assign }
    const clear = vi.spyOn(Storage.prototype, 'clear')

    await expect(h.responseErrorHandler({ response: { status: 401, data: {} } })).rejects.toBeTruthy()

    expect(assign).toHaveBeenCalledWith('/login')
    expect(clear).toHaveBeenCalled()
    clear.mockRestore()
  })

  it('does not redirect when already on a public page', async () => {
    const assign = vi.fn()
    delete window.location
    window.location = { pathname: '/login', assign }

    await expect(h.responseErrorHandler({ response: { status: 401, data: {} } })).rejects.toBeTruthy()

    expect(assign).not.toHaveBeenCalled()
  })
})
