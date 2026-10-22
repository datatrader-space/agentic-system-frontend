// @vitest-environment jsdom
// The coding task view polls through the shared poller: it keeps going after a failed poll (it used to stop
// for good, leaving a running task looking stuck), emits `changed` once when the task finishes, and stops on
// unmount (page-speed plan Phase 5).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ getCodingTask: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import CodingSession from './CodingSession.vue'

beforeEach(() => { vi.useFakeTimers(); api.getCodingTask.mockReset() })
afterEach(() => vi.useRealTimers())

describe('CodingSession polling', () => {
  it('survives a failed poll, emits changed once when done, then stops', async () => {
    api.getCodingTask
      .mockResolvedValueOnce({ data: { id: 1, status: 'editing', steps: [] } })
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ data: { id: 1, status: 'awaiting_review', steps: [] } })
    const w = mount(CodingSession, { props: { systemId: 1, repoId: 2, taskId: 1 }, shallow: true })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1600)     // fails
    await vi.advanceTimersByTimeAsync(3200)     // backed off, succeeds: done
    expect(w.emitted('changed')).toHaveLength(1)
    const calls = api.getCodingTask.mock.calls.length
    await vi.advanceTimersByTimeAsync(30000)
    expect(api.getCodingTask.mock.calls.length).toBe(calls)
    w.unmount()
  })

  it('stops on unmount', async () => {
    api.getCodingTask.mockResolvedValue({ data: { id: 1, status: 'editing', steps: [] } })
    const w = mount(CodingSession, { props: { systemId: 1, repoId: 2, taskId: 1 }, shallow: true })
    await flushPromises()
    w.unmount()
    const calls = api.getCodingTask.mock.calls.length
    await vi.advanceTimersByTimeAsync(30000)
    expect(api.getCodingTask.mock.calls.length).toBe(calls)
  })
})
