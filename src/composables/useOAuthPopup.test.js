// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const h = vi.hoisted(() => ({ clearApiCache: vi.fn() }))
vi.mock('@/services/api', () => ({ clearApiCache: h.clearApiCache }))

import { runOAuthPopup, useOAuthPopup, OAUTH_RESULT_KEY } from './useOAuthPopup'

function fakePopup() {
  return { closed: false, close: vi.fn(function () { this.closed = true }), location: { href: 'about:blank' } }
}
function post(data, origin = window.location.origin) {
  window.dispatchEvent(new MessageEvent('message', { data, origin }))
}
const tick = async (n = 5) => { for (let i = 0; i < n; i++) await Promise.resolve() }

let popup
beforeEach(() => {
  vi.useFakeTimers()
  h.clearApiCache.mockClear()
  localStorage.clear()
  popup = fakePopup()
  vi.spyOn(window, 'open').mockImplementation(() => popup)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('runOAuthPopup', () => {
  it('opens about:blank synchronously, before the authorize URL arrives, then navigates to it', async () => {
    let giveUrl
    const p = runOAuthPopup(() => new Promise((r) => { giveUrl = r }), { messageTypes: ['oauth_result'] })
    // Still inside the "click": the window is already open, on about:blank.
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(window.open.mock.calls[0][0]).toBe('about:blank')
    expect(popup.location.href).toBe('about:blank')
    giveUrl('https://provider.example/authorize?x=1')
    await tick()
    expect(popup.location.href).toBe('https://provider.example/authorize?x=1')
    post({ type: 'oauth_result', status: 'success' })
    const r = await p
    expect(r).toMatchObject({ ok: true, status: 'success' })
    expect(h.clearApiCache).toHaveBeenCalled()
  })

  it('ignores messages from another origin or of another type', async () => {
    const p = runOAuthPopup(() => 'https://provider.example/a', { messageTypes: ['oauth_result'], closeGraceMs: 0 })
    await tick()
    post({ type: 'oauth_result', status: 'success' }, 'https://evil.example')
    post({ type: 'something_else', status: 'success' })
    popup.closed = true
    await vi.advanceTimersByTimeAsync(600)
    const r = await p
    expect(r.status).toBe('closed')
    expect(r.ok).toBe(false)
  })

  it('reports a failure message as failed with its error', async () => {
    const p = runOAuthPopup(() => 'https://provider.example/a', { messageTypes: ['oauth_result'] })
    await tick()
    post({ type: 'oauth_result', status: 'error', error: 'access_denied' })
    const r = await p
    expect(r).toMatchObject({ ok: false, status: 'failed', error: 'access_denied' })
  })

  it('a closed popup asks the server (verify) before calling it a failure', async () => {
    const verify = vi.fn().mockResolvedValue(true)
    const p = runOAuthPopup(() => 'https://provider.example/a', { verify, closeGraceMs: 600 })
    await tick()
    popup.closed = true
    await vi.advanceTimersByTimeAsync(500)   // closed-popup check
    expect(verify).not.toHaveBeenCalled()    // waits the grace period first
    await vi.advanceTimersByTimeAsync(600)
    const r = await p
    expect(verify).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ ok: true, status: 'success' })
  })

  it('a closed popup with no connection on the server is reported as closed', async () => {
    const p = runOAuthPopup(() => 'https://provider.example/a', { verify: async () => false, closeGraceMs: 0 })
    await tick()
    popup.closed = true
    await vi.advanceTimersByTimeAsync(500)
    const r = await p
    expect(r.status).toBe('closed')
    expect(r.error).toMatch(/closed/)
  })

  it('reads the result the popup stored when its message was lost', async () => {
    const p = runOAuthPopup(() => 'https://provider.example/a', { closeGraceMs: 0 })
    await tick()
    localStorage.setItem(OAUTH_RESULT_KEY, JSON.stringify({ status: 'success' }))
    popup.closed = true
    await vi.advanceTimersByTimeAsync(500)
    const r = await p
    expect(r).toMatchObject({ ok: true, status: 'success' })
    expect(localStorage.getItem(OAUTH_RESULT_KEY)).toBeNull()
  })

  it('times out, closes the popup and settles', async () => {
    const p = runOAuthPopup(() => 'https://provider.example/a', { timeoutMs: 5000, closeGraceMs: 0 })
    await tick()
    await vi.advanceTimersByTimeAsync(5000)
    const r = await p
    expect(r.status).toBe('timeout')
    expect(popup.close).toHaveBeenCalled()
    expect(h.clearApiCache).toHaveBeenCalled()
  })

  it('reports a blocked popup without calling the server', async () => {
    window.open.mockImplementation(() => null)
    const getUrl = vi.fn()
    const r = await runOAuthPopup(getUrl)
    expect(r.status).toBe('blocked')
    expect(getUrl).not.toHaveBeenCalled()
  })

  it('closes the blank popup when the authorize URL cannot be obtained', async () => {
    const r = await runOAuthPopup(() => Promise.reject(new Error('no scopes configured')))
    expect(r).toMatchObject({ ok: false, status: 'error', error: 'no scopes configured' })
    expect(popup.close).toHaveBeenCalled()
  })
})

describe('useOAuthPopup', () => {
  it('resets busy in finally, also after an error', async () => {
    const scope = effectScope()
    const ctl = scope.run(() => useOAuthPopup())
    const p = ctl.run(() => Promise.reject(new Error('boom')))
    expect(ctl.busy.value).toBe(true)
    const r = await p
    expect(r.status).toBe('error')
    expect(ctl.busy.value).toBe(false)
    scope.stop()
  })

  it('settles as cancelled and removes its listeners when the component goes away', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const scope = effectScope()
    const ctl = scope.run(() => useOAuthPopup())
    const p = ctl.run(() => 'https://provider.example/a')
    await tick()
    scope.stop()
    const r = await p
    expect(r.status).toBe('cancelled')
    expect(ctl.busy.value).toBe(false)
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function))
    // No timer left behind: advancing far does not throw or call anything.
    await vi.advanceTimersByTimeAsync(200000)
    expect(popup.close).not.toHaveBeenCalled()
  })
})
