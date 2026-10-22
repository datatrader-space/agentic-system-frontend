// @vitest-environment jsdom
// SessionTrace refreshes every 10 s through the shared poller: through the shared api client, without
// flashing the loading state, and never after the component is gone (it used to be a bare setInterval that
// was never cleared and stacked up with every open).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/services/api', () => ({ default: { get }, isAbortError: () => false }))

import SessionTrace from './SessionTrace.vue'

beforeEach(() => {
  vi.useFakeTimers()
  get.mockReset()
  get.mockResolvedValue({ data: { results: [] } })
})
afterEach(() => vi.useRealTimers())

describe('SessionTrace polling', () => {
  it('uses the shared client, refreshes every 10 s, and stops on unmount', async () => {
    const w = mount(SessionTrace, { props: { repositoryId: 3 } })
    await flushPromises()
    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0][0]).toBe('/sessions/')
    await vi.advanceTimersByTimeAsync(10000)
    expect(get).toHaveBeenCalledTimes(2)
    w.unmount()
    await vi.advanceTimersByTimeAsync(60000)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('a background refresh does not show the loading state', async () => {
    const w = mount(SessionTrace, { props: { repositoryId: 3 } })
    await flushPromises()
    let release
    get.mockImplementationOnce(() => new Promise((r) => { release = r }))
    await vi.advanceTimersByTimeAsync(10000)
    expect(w.vm.$.setupState.loading).toBe(false)
    release({ data: { results: [] } })
    await flushPromises()
    w.unmount()
  })
})
