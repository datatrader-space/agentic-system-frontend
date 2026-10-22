// The shared 1 s clock runs only while a component uses it (page-speed plan Phase 5).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { useClock, _clockState } from './useClock'

afterEach(() => vi.useRealTimers())

describe('useClock', () => {
  it('ticks while a scope holds it and stops when the last one is disposed', () => {
    vi.useFakeTimers()
    const a = effectScope(); const b = effectScope()
    const now = a.run(() => useClock())
    b.run(() => useClock())
    expect(_clockState()).toEqual({ users: 2, ticking: true })
    const before = now.value
    vi.advanceTimersByTime(3000)
    expect(now.value).toBeGreaterThan(before)
    a.stop()
    expect(_clockState()).toEqual({ users: 1, ticking: true })
    b.stop()
    expect(_clockState()).toEqual({ users: 0, ticking: false })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start an interval nobody can stop for a caller outside any scope', () => {
    vi.useFakeTimers()
    useClock()
    expect(_clockState().ticking).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
