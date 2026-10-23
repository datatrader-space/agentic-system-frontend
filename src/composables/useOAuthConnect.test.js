// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/api', () => ({ clearApiCache: vi.fn() }))
import { connectOAuth } from './useOAuthConnect'

let popup
beforeEach(() => {
  popup = { closed: false, close: vi.fn(), location: { href: 'about:blank' } }
  vi.spyOn(window, 'open').mockImplementation(() => popup)
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('connectOAuth (on the shared popup flow)', () => {
  it('opens the popup before the start call returns and resolves on a success message', async () => {
    let answer
    const api = {
      startConnection: vi.fn(() => new Promise((r) => { answer = r })),
      getConnections: vi.fn(),
    }
    const p = connectOAuth(api, 'google', { owner: 'org' })
    expect(window.open).toHaveBeenCalledWith('about:blank', 'oauth-connection', expect.any(String))
    answer({ data: { redirect_url: 'https://accounts.example/o' } })
    await new Promise((r) => setTimeout(r, 0))
    expect(popup.location.href).toBe('https://accounts.example/o')
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'oauth-connection-result', status: 'success' }, origin: window.location.origin }))
    await expect(p).resolves.toBe(true)
    expect(api.startConnection).toHaveBeenCalledWith('google', { owner: 'org' })
  })

  it('rejects with the server error when the connection cannot start, and closes the blank popup', async () => {
    const api = { startConnection: vi.fn().mockRejectedValue({ response: { data: { error: 'Provider not available' } } }) }
    await expect(connectOAuth(api, 'x')).rejects.toThrow('Provider not available')
    expect(popup.close).toHaveBeenCalled()
  })

  it('a closed popup is a success when the server shows the connection', async () => {
    vi.useFakeTimers()
    const api = {
      startConnection: vi.fn().mockResolvedValue({ data: { redirect_url: 'https://accounts.example/o' } }),
      getConnections: vi.fn().mockResolvedValue({ data: [{ provider_slug: 'google', status: 'active' }] }),
    }
    const p = connectOAuth(api, 'google')
    await vi.advanceTimersByTimeAsync(0)
    popup.closed = true
    await vi.advanceTimersByTimeAsync(1200)
    await expect(p).resolves.toBe(true)
  })
})
