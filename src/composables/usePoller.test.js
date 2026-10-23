// @vitest-environment jsdom
// The one poller (Phase 5 item 1): pause when hidden, stop on a final state, back off on error and
// recover, never overlap, stop with its scope.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope, defineComponent, h, KeepAlive, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { usePoller } from './usePoller'

let hidden = false
beforeEach(() => {
  vi.useFakeTimers()
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
})
afterEach(() => { vi.useRealTimers() })

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

describe('usePoller', () => {
  it('polls now and then every interval', async () => {
    const fn = vi.fn(async () => ({}))
    const p = usePoller(fn, { interval: 1000 })
    p.start()
    await flush()
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(2)
    p.stop()
  })

  it('stops for good on a final state', async () => {
    let n = 0
    const fn = vi.fn(async () => ({ status: ++n >= 2 ? 'done' : 'running' }))
    const p = usePoller(fn, { interval: 1000, stopWhen: (r) => r.status === 'done' })
    p.start()
    await flush()
    await vi.advanceTimersByTimeAsync(1000)
    expect(p.active.value).toBe(false)
    await vi.advanceTimersByTimeAsync(10000)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('backs off after errors and returns to its pace after a success', async () => {
    let fail = true
    const fn = vi.fn(async () => { if (fail) throw new Error('x'); return {} })
    const p = usePoller(fn, { interval: 1000, maxInterval: 8000 })
    p.start()
    await flush()                                 // fail #1 → next in 2000
    await vi.advanceTimersByTimeAsync(1999)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)          // fail #2 → next in 4000
    expect(fn).toHaveBeenCalledTimes(2)
    fail = false
    await vi.advanceTimersByTimeAsync(4000)       // success → back to 1000
    expect(fn).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(4)
    expect(p.active.value).toBe(true)             // an error never stopped it
    p.stop()
  })

  it('never runs two polls at once', async () => {
    let release
    const fn = vi.fn(() => new Promise((r) => { release = r }))
    const p = usePoller(fn, { interval: 100 })
    p.start()
    await flush()
    p.refresh()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(1)
    release({})
    await flush()
    p.stop()
  })

  it('pauses while the tab is hidden and polls once on return', async () => {
    const fn = vi.fn(async () => ({}))
    const p = usePoller(fn, { interval: 1000 })
    p.start()
    await flush()
    hidden = true
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(1)
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(fn).toHaveBeenCalledTimes(2)
    p.stop()
  })

  it('stops and aborts its request when its scope is disposed (unmount)', async () => {
    let signal
    const fn = vi.fn(({ signal: s }) => { signal = s; return new Promise(() => {}) })
    const scope = effectScope()
    const p = scope.run(() => usePoller(fn, { interval: 1000 }))
    p.start()
    await flush()
    scope.stop()
    expect(p.active.value).toBe(false)
    expect(signal.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('pauses while its <KeepAlive> view is hidden and polls once when it is shown again', async () => {
    const fn = vi.fn(async () => ({}))
    const Poll = defineComponent({
      name: 'Poll',
      setup() { usePoller(fn, { interval: 1000 }).start(); return () => h('div', 'poll') },
    })
    const Other = defineComponent({ name: 'Other', render: () => h('div', 'other') })
    const show = ref('poll')
    const Host = defineComponent({
      setup: () => () => h(KeepAlive, null, [show.value === 'poll' ? h(Poll) : h(Other)]),
    })
    const w = mount(Host)
    await flush()
    expect(fn).toHaveBeenCalledTimes(1)
    show.value = 'other'
    await nextTick(); await flush()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(1)          // hidden: no polls
    show.value = 'poll'
    await nextTick(); await flush()
    expect(fn).toHaveBeenCalledTimes(2)          // shown again: one poll at once
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(3)          // and back on its pace
    w.unmount()
  })
})
