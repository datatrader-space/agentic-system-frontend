// GitHub connects through the GitHub SERVICE's sign-in, like the Connectors page, never the old provider flow
// whose connection the GitHub resolver does not read (live, 2026-11-10, ADM-1202).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const popup = { result: { ok: true, status: 'success' } }
vi.mock('@/composables/useOAuthPopup', () => ({
  runOAuthPopup: vi.fn(async (getUrl, opts) => {
    try { popup.url = await getUrl() } catch (e) { return { ok: false, status: 'error', error: e.message } }
    popup.opts = opts
    popup.verified = await opts.verify()
    return popup.result
  }),
}))

import { connectGithubService, findGithubService } from './useGithubConnect'

const rows = [
  { kind: 'mcp', id: 3, slug: 'github' },
  { kind: 'service', id: 40, slug: 'github', is_builtin: false },
  { kind: 'service', id: 21, slug: 'github', is_builtin: true },
  { kind: 'service', id: 9, slug: 'notion', is_builtin: true },
]
const apiWith = (list) => ({
  getConnectors: vi.fn(async () => ({ data: { connectors: list } })),
  startOAuth: vi.fn(async (id) => ({ data: { redirect_url: `https://github.com/login/oauth/authorize?s=${id}` } })),
  getOAuthStatus: vi.fn(async () => ({ data: { connected: true } })),
  startConnection: vi.fn(),
})

beforeEach(() => { popup.result = { ok: true, status: 'success' }; popup.url = null })

describe('connectGithubService', () => {
  it('starts the built-in GitHub service sign-in and checks that service, never the old provider flow', async () => {
    const api = apiWith(rows)
    await expect(connectGithubService(api)).resolves.toBe(true)
    expect(api.startOAuth).toHaveBeenCalledWith(21)
    expect(popup.url).toContain('s=21')
    expect(popup.opts.messageTypes).toEqual(['oauth_result'])
    expect(popup.verified).toBe(true)
    expect(api.getOAuthStatus).toHaveBeenCalledWith(21)
    expect(api.startConnection).not.toHaveBeenCalled()
  })

  it('says GitHub is not set up when there is no GitHub service, and starts nothing', async () => {
    const api = apiWith([{ kind: 'service', id: 9, slug: 'notion' }])
    await expect(connectGithubService(api)).rejects.toThrow('GitHub is not set up on this platform')
    expect(api.startOAuth).not.toHaveBeenCalled()
    expect(api.startConnection).not.toHaveBeenCalled()
  })

  it('reports a failed or cancelled sign-in as an error', async () => {
    popup.result = { ok: false, status: 'failed', error: 'access_denied' }
    await expect(connectGithubService(apiWith(rows))).rejects.toThrow('access_denied')
    popup.result = { ok: false, status: 'cancelled' }
    await expect(connectGithubService(apiWith(rows))).rejects.toThrow('cancelled')
  })

  it('finds the service in a plain list too', async () => {
    const api = { getConnectors: vi.fn(async () => ({ data: rows })) }
    expect((await findGithubService(api)).id).toBe(21)
  })
})
