// @vitest-environment jsdom
// The browser card's polling asks nothing while the tab is hidden, and asks once when it is shown again.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }))

import api from '../services/api'
import { useBrowserStore, POLL_MS } from './useBrowserStore'

let hidden = false
beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useFakeTimers()
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
})
afterEach(() => { vi.useRealTimers(); delete document.hidden })

describe('polling in a hidden tab', () => {
  it('pauses while hidden, asks once when shown, and listens no more once stopped', async () => {
    api.get.mockResolvedValue({ data: { session: null } })
    const browser = useBrowserStore()
    browser.bind(42)
    browser.follow(true)
    await vi.advanceTimersByTimeAsync(50)
    api.get.mockClear()

    hidden = true
    await vi.advanceTimersByTimeAsync(POLL_MS * 5)
    expect(api.get).not.toHaveBeenCalled()

    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(api.get).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(POLL_MS + 50)
    expect(api.get).toHaveBeenCalledTimes(2)            // the normal pace again

    browser.follow(false)                               // one last look, then quiet
    await vi.advanceTimersByTimeAsync(50)
    const afterEnd = api.get.mock.calls.length
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(api.get).toHaveBeenCalledTimes(afterEnd)
  })
})
