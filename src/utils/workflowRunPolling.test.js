// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { usePoller } from '@/composables/usePoller'
import { RUN_STOP_STATUSES, RUN_FINAL_STATUSES, RUN_HELD_STATUSES, runStopKind, fetchAllAgents } from './workflowRunPolling'

describe('workflow run stop states', () => {
  it('stops on every final state, including dead', () => {
    for (const s of ['success', 'failed', 'cancelled', 'dead']) expect(runStopKind(s)).toBe('final')
  })
  it('stops on the states that wait on a person or a delay', () => {
    for (const s of ['waiting', 'paused', 'blocked']) expect(runStopKind(s)).toBe('held')
  })
  it('keeps polling while the run is moving', () => {
    for (const s of ['queued', 'running', undefined, '']) expect(runStopKind(s)).toBe(null)
  })
  it('the stop list is final + held', () => {
    expect(RUN_STOP_STATUSES.sort()).toEqual([...RUN_FINAL_STATUSES, ...RUN_HELD_STATUSES].sort())
  })
})

describe('the builder run poller (usePoller + the stop states)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function makePoller(fn) {
    const scope = effectScope()
    const poller = scope.run(() => usePoller(fn, {
      interval: 1200, maxInterval: 15000,
      stopWhen: (d) => !!d && RUN_STOP_STATUSES.includes(d.status),
    }))
    return { poller, scope }
  }

  it.each(['dead', 'waiting', 'blocked', 'paused', 'success'])('stops when the run is %s', async (status) => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({ status })
      .mockResolvedValue({ status: 'running' })
    const { poller, scope } = makePoller(fn)
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1200)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(poller.active.value).toBe(false)
    await vi.advanceTimersByTimeAsync(20000)
    expect(fn).toHaveBeenCalledTimes(2)   // no poll after the stop state
    scope.stop()
  })

  it('one failed poll does not stop updates: it backs off and recovers', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({ status: 'success' })
    const { poller, scope } = makePoller(fn)
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(poller.active.value).toBe(true)
    await vi.advanceTimersByTimeAsync(1200)        // backed off: not yet
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1200)        // 2400 ms after the failure
    expect(fn).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1200)        // normal pace again after a success
    expect(fn).toHaveBeenCalledTimes(3)
    expect(poller.active.value).toBe(false)
    scope.stop()
  })

  it('never runs two polls at once, so end-of-run side effects cannot repeat', async () => {
    let resolve
    const fn = vi.fn(() => new Promise((r) => { resolve = r }))
    const { poller, scope } = makePoller(fn)
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    poller.refresh()                               // a second trigger while the first is in flight
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(1)
    resolve({ status: 'success' })
    await vi.advanceTimersByTimeAsync(0)
    expect(poller.active.value).toBe(false)
    scope.stop()
  })

  it('is cancelled when its scope is disposed (leaving the page)', async () => {
    const fn = vi.fn().mockResolvedValue({ status: 'running' })
    const { poller, scope } = makePoller(fn)
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    scope.stop()
    await vi.advanceTimersByTimeAsync(10000)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(poller.active.value).toBe(false)
  })
})

describe('fetchAllAgents', () => {
  it('returns the full list from the picker endpoint', async () => {
    const api = { getAgentPicker: vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] }) }
    expect(await fetchAllAgents(api)).toEqual([{ id: 1 }, { id: 2 }])
  })
  it('accepts a paginated shape', async () => {
    const api = { getAgentPicker: vi.fn().mockResolvedValue({ data: { results: [{ id: 3 }] } }) }
    expect(await fetchAllAgents(api)).toEqual([{ id: 3 }])
  })
})
