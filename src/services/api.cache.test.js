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
  it('redirects to /login, back to where the user was, and clears storage when a session dies', async () => {
    const assign = vi.fn()
    // jsdom's window.location is read-only; replace it for the assertion.
    delete window.location
    window.location = { pathname: '/dashboard/connectors', search: '?secure_entry=abc', assign }
    const clear = vi.spyOn(Storage.prototype, 'clear')

    await expect(h.responseErrorHandler({ response: { status: 401, data: {} } })).rejects.toBeTruthy()

    // The destination survives sign-in: a secure entry link opened with an expired session still lands on
    // its form.
    expect(assign).toHaveBeenCalledWith('/login?next=%2Fdashboard%2Fconnectors%3Fsecure_entry%3Dabc')
    expect(clear).toHaveBeenCalled()
    clear.mockRestore()
  })

  it('never writes "undefined" into the return path when there is no query string', async () => {
    const assign = vi.fn()
    delete window.location
    window.location = { pathname: '/dashboard/chat/new', assign }

    await expect(h.responseErrorHandler({ response: { status: 401, data: {} } })).rejects.toBeTruthy()

    expect(assign).toHaveBeenCalledWith('/login?next=%2Fdashboard%2Fchat%2Fnew')
  })

  it('does not redirect when already on a public page', async () => {
    const assign = vi.fn()
    delete window.location
    window.location = { pathname: '/login', assign }

    await expect(h.responseErrorHandler({ response: { status: 401, data: {} } })).rejects.toBeTruthy()

    expect(assign).not.toHaveBeenCalled()
  })
})

// ── Page-speed plan F-H1 / F-H2 / F-H3 ─────────────────────────────────────────────────────────────
import { _ttlFor, _isLongOperation, _key, isAbortError } from './api'

describe('api GET cache — workspace in the key (F-H1)', () => {
  beforeEach(() => { try { localStorage.removeItem('activeWorkspaceId') } catch { /* node env */ } })

  it('a different active workspace is a different cache entry', async () => {
    localStorage.setItem('activeWorkspaceId', '1')
    await api.get('/llm/providers/')
    await api.get('/llm/providers/')
    expect(h.calls.get).toBe(1)
    localStorage.setItem('activeWorkspaceId', '2')
    await api.get('/llm/providers/')
    expect(h.calls.get).toBe(2)
    expect(_key('/x/', {})).toContain('ws:2|')
  })
})

describe('api GET cache — exact-path TTL rules (F-H2)', () => {
  it.each([
    ['/connectors/', 30_000],
    ['/connectors/bundle/', 30_000],
    ['/llm/models/', 60_000],
    ['/services/', 60_000],
    ['/services/12/', 60_000],
    ['/mcp/servers/', 60_000],
    ['/workspaces/', 60_000],
    ['/v2/orgs/', 60_000],
    ['/agents/', 30_000],
    ['/agents/super-agent/', 30_000],
    ['/tools/', 60_000],
    ['/auth/me/', 60_000],
  ])('caches %s', (url, ttl) => { expect(_ttlFor(url)).toBe(ttl) })

  it.each([
    '/connectors/svc/github/status',
    '/connectors/mcp/4/tools/',
    '/services/12/repair-schemas/',
    '/services/12/auth/',
    '/services/enrich-schemas/latest/',
    '/mcp/servers/4/credentials/',
    '/workspaces/3/activity/',
    '/v2/orgs/acme/members/',
    '/agents/5/signals/',
    '/oauth/status/9/',
    '/llm/providers/3/status/',
  ])('never caches %s', (url) => { expect(_ttlFor(url)).toBe(0) })
})

describe('api GET cache — generation counter and in-flight entries (F-H2)', () => {
  it('a GET in flight across a clear does not store its stale response', async () => {
    let resolveOld
    h.rawGet.mockImplementationOnce(() => { h.calls.get += 1; return new Promise((r) => { resolveOld = r }) })
    const old = api.get('/llm/providers/')
    clearApiCache()
    resolveOld({ data: { stale: true } })
    await old
    await api.get('/llm/providers/')
    expect(h.calls.get).toBe(2)                // the stale response was not cached
  })

  it('a caller after a clear never joins the request that was in flight before it', async () => {
    let resolveOld
    h.rawGet.mockImplementationOnce(() => { h.calls.get += 1; return new Promise((r) => { resolveOld = r }) })
    const old = api.get('/agents/')
    clearApiCache()
    const fresh = api.get('/agents/')
    expect(fresh).not.toBe(old)
    resolveOld({ data: [] })
    await Promise.all([old, fresh])
    expect(h.calls.get).toBe(2)
  })

  it('a write drops in-flight reads too, so a later read cannot get pre-write data', async () => {
    let resolveOld
    h.rawGet.mockImplementationOnce(() => { h.calls.get += 1; return new Promise((r) => { resolveOld = r }) })
    const old = api.get('/mcp/servers/')
    await api.post('/mcp/servers/create/', {})
    const fresh = api.get('/mcp/servers/')
    expect(fresh).not.toBe(old)
    resolveOld({ data: [] })
    await Promise.all([old, fresh])
  })

  it('a request with an AbortSignal is never shared with another caller', async () => {
    const ctrl = new AbortController()
    const a = api.get('/agents/', { signal: ctrl.signal })
    const b = api.get('/agents/')
    expect(a).not.toBe(b)
    await Promise.all([a, b])
    expect(h.calls.get).toBe(2)
  })

  it('isAbortError recognises a cancelled request', () => {
    expect(isAbortError({ name: 'CanceledError' })).toBe(true)
    expect(isAbortError({ code: 'ERR_CANCELED' })).toBe(true)
    expect(isAbortError({ name: 'AbortError' })).toBe(true)
    expect(isAbortError(new Error('boom'))).toBe(false)
  })
})

describe('api GET cache — what a write clears (F-H3)', () => {
  it('PATCH /auth/me/onboarding refreshes the user but keeps reference data', async () => {
    await api.get('/llm/providers/')
    await api.get('/auth/me/')
    expect(h.calls.get).toBe(2)
    await api.patch('/auth/me/onboarding', { dismissed: true })
    await api.get('/llm/providers/')
    expect(h.calls.get).toBe(2)                // reference data survived
    await api.get('/auth/me/')
    expect(h.calls.get).toBe(3)                // the user itself was refreshed
  })

  it.each([
    ['patch', '/notifications/4/read/'],
    ['post', '/notifications/read-all/'],
    ['post', '/help/search-log'],
    ['post', '/guided-tours/intro/progress/'],
    ['post', '/services/save-draft/'],
  ])('%s %s does not wipe cached reference data', async (method, url) => {
    await api.get('/llm/providers/')
    await api[method](url, {})
    await api.get('/llm/providers/')
    expect(h.calls.get).toBe(1)
  })

  it('an admin help-center write still invalidates (it is not the help-assistant log)', async () => {
    await api.get('/llm/providers/')
    await api.post('/admin/helpcenter/content/', {})
    await api.get('/llm/providers/')
    expect(h.calls.get).toBe(2)
  })

  it.each(['/auth/login', '/auth/2fa/confirm', '/auth/change-password'])('%s clears everything', async (url) => {
    await api.checkAuth()
    await api.post(url, {})
    await api.checkAuth()
    expect(h.calls.get).toBe(2)
  })
})

describe('api long-operation timeout', () => {
  it.each([
    '/systems/1/repositories/2/crs/run/',
    '/knowledge/5/export/',
    '/services/discover/',
  ])('%s gets the long timeout', (url) => { expect(_isLongOperation({ url })).toBe(true) })

  it('any upload (FormData body) gets the long timeout', () => {
    expect(_isLongOperation({ url: '/conversations/1/files/', data: new FormData() })).toBe(true)
  })

  it('a plain read does not', () => {
    expect(_isLongOperation({ url: '/agents/' })).toBe(false)
  })
})
