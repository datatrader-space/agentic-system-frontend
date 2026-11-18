// The Let's Code editor's long buttons as background jobs (ADM-1269): a press answers 202 with a job, and the caller
// gets the job's own answer as if the request had given it.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { runProjectJob, waitForJob, notifyProjectJob, isFollowed, answerOf } from './projectJobs'

const job = (state, extra = {}) => ({ id: 'j1', kind: 'push', state, ...extra })

afterEach(() => vi.useRealTimers())

describe('runProjectJob', () => {
  it('passes an answer that is not a job straight through', async () => {
    const res = { status: 200, data: { ok: true } }
    expect(await runProjectJob(async () => res, vi.fn())).toBe(res)
  })

  it('asks until the job ends and gives its answer', async () => {
    vi.useFakeTimers()
    const read = vi.fn()
      .mockResolvedValueOnce({ data: { job: job('running') } })
      .mockResolvedValueOnce({ data: { job: job('done', { status_code: 200, result: { pushed: 'main' } }) } })
    const seen = []
    const p = runProjectJob(async () => ({ status: 202, data: { job: job('queued') } }), read,
      { onUpdate: (j) => seen.push(j.state) })
    await vi.advanceTimersByTimeAsync(1000)
    expect(isFollowed('j1')).toBe(true)
    await vi.advanceTimersByTimeAsync(2000)
    const res = await p
    expect(res.data).toEqual({ pushed: 'main' })
    expect(res.status).toBe(200)
    expect(read).toHaveBeenCalledTimes(2)
    expect(seen).toEqual(['queued', 'running', 'done'])
    expect(isFollowed('j1')).toBe(false)
  })

  it("the project's socket ends the wait at once", async () => {
    vi.useFakeTimers()
    const read = vi.fn()
    const p = runProjectJob(async () => ({ status: 202, data: { job: job('queued') } }), read)
    await vi.advanceTimersByTimeAsync(10)
    notifyProjectJob(job('done', { status_code: 201, result: { committed: 'abc' } }))
    const res = await p
    expect(res).toMatchObject({ status: 201, data: { committed: 'abc' } })
    expect(read).not.toHaveBeenCalled()
  })

  it('a failed job rejects like an axios error, with its status and body', async () => {
    const failed = job('failed', { status_code: 409, result: { error: 'Pull first.', code: 'BEHIND' } })
    await expect(runProjectJob(async () => ({ status: 202, data: { job: failed } }), vi.fn())).rejects
      .toMatchObject({ response: { status: 409, data: { error: 'Pull first.', code: 'BEHIND' } } })
  })

  it('a job the server no longer has is said; a network that keeps failing is said, not waited on forever', async () => {
    vi.useFakeTimers()
    const gone = waitForJob(job('queued'), vi.fn().mockRejectedValue({ response: { status: 404 } }))
    const goneSeen = expect(gone).rejects.toMatchObject({ response: { status: 404 } })
    await vi.advanceTimersByTimeAsync(1000)
    await goneSeen
    const down = waitForJob(job('queued'), vi.fn().mockRejectedValue(new Error('Network Error')))
    const downSeen = expect(down).rejects.toThrow('Network Error')
    await vi.advanceTimersByTimeAsync(20000)
    await downSeen
  })

  it('stops when the caller has gone', async () => {
    await expect(waitForJob(job('running'), vi.fn(), { isCancelled: () => true })).rejects
      .toMatchObject({ name: 'AbortError' })
  })
})

describe('answerOf', () => {
  it('a job that broke without a status is a server error', () => {
    expect(() => answerOf(job('failed', { result: { error: 'This did not finish. Try again.' } })))
      .toThrow('This did not finish. Try again.')
  })
})
