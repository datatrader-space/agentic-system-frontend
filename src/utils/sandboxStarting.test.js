import { describe, it, expect, vi, afterEach } from 'vitest'
import { isStarting, whileSandboxStarts } from './sandboxStarting'

const starting = (headers = {}, body = {}) => ({ response: { status: 503, headers, data: { code: 'RUNNER_STARTING', ...body } } })

afterEach(() => vi.useRealTimers())

describe('whileSandboxStarts', () => {
  it('knows a starting sandbox only by 503 + RUNNER_STARTING', () => {
    expect(isStarting(starting())).toBe(true)
    expect(isStarting({ response: { status: 503, data: { sandbox_unavailable: true } } })).toBe(false)
    expect(isStarting({ response: { status: 500, data: { code: 'RUNNER_STARTING' } } })).toBe(false)
    expect(isStarting(new Error('network'))).toBe(false)
  })

  it('waits the Retry-After the server gave, then returns the answer', async () => {
    vi.useFakeTimers()
    const call = vi.fn().mockRejectedValueOnce(starting({ 'retry-after': '7' })).mockResolvedValueOnce({ data: 1 })
    const waits = []
    const p = whileSandboxStarts(call, { onWaiting: (s) => waits.push(s) })
    await vi.advanceTimersByTimeAsync(6999)
    expect(call).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(p).resolves.toEqual({ data: 1 })
    expect(waits).toEqual([7, 0])
  })

  it('uses the body hint without a header and keeps the wait between 2 and 60 seconds', async () => {
    vi.useFakeTimers()
    const call = vi.fn()
      .mockRejectedValueOnce(starting({}, { retry_after_seconds: 600 }))
      .mockRejectedValueOnce(starting({ 'retry-after': '0.5' }))
      .mockResolvedValueOnce({ data: 2 })
    const waits = []
    const p = whileSandboxStarts(call, { onWaiting: (s) => waits.push(s) })
    await vi.advanceTimersByTimeAsync(62000)
    await expect(p).resolves.toEqual({ data: 2 })
    expect(waits).toEqual([60, 2, 0])
  })

  it('passes a real error straight through', async () => {
    const err = { response: { status: 404, data: { error: 'Not found' } } }
    const call = vi.fn().mockRejectedValue(err)
    await expect(whileSandboxStarts(call)).rejects.toBe(err)
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('stops waiting when the caller is gone', async () => {
    vi.useFakeTimers()
    let gone = false
    const call = vi.fn().mockRejectedValue(starting({ 'retry-after': '3' }))
    const p = whileSandboxStarts(call, { isCancelled: () => gone })
    const settled = expect(p).rejects.toBeTruthy()
    gone = true
    await vi.advanceTimersByTimeAsync(3000)
    await settled
    expect(call).toHaveBeenCalledTimes(1)
  })
})
