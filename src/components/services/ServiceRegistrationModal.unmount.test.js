// @vitest-environment jsdom
// Closing the service wizard stops everything it runs (page-speed plan Phase 5): a close while its opening
// requests were pending must not arm the 20 s autosave afterwards, and the enrichment progress poll (a loop
// that ran up to 30 minutes after close and kept saving the draft) is cancelled.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listDrafts: vi.fn(),
  getLatestEnrichment: vi.fn(),
  saveDraft: vi.fn(),
  getEnrichmentJobStatus: vi.fn(),
}))
vi.mock('../../services/api', () => ({ default: new Proxy(api, { get: (t, k) => t[k] || vi.fn(() => Promise.resolve({ data: {} })) }) }))
vi.mock('@/composables/useNotify', () => ({ notify: { show: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(false)) }))

import ServiceRegistrationModal from './ServiceRegistrationModal.vue'

beforeEach(() => {
  vi.useFakeTimers()
  Object.values(api).forEach((f) => f.mockReset())
  api.getCurrentUser.mockResolvedValue({ data: { user: { is_platform_admin: false } } })
  api.listDrafts.mockResolvedValue({ data: { drafts: [] } })
  api.getLatestEnrichment.mockResolvedValue({ data: {} })
  api.saveDraft.mockResolvedValue({ data: {} })
})
afterEach(() => vi.useRealTimers())

describe('ServiceRegistrationModal teardown', () => {
  it('arms no autosave when closed while its opening requests were pending', async () => {
    let release
    api.listDrafts.mockImplementationOnce(() => new Promise((r) => { release = r }))
    const w = mount(ServiceRegistrationModal, { shallow: true })
    await flushPromises()
    w.unmount()
    release({ data: { drafts: [] } })
    await flushPromises()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops the enrichment poll and never saves a draft after close', async () => {
    api.startEnrichmentJob = vi.fn().mockResolvedValue({ data: { job_id: 'job-1', model: 'm' } })
    api.getEnrichmentJobStatus.mockResolvedValue({ data: { state: 'running', done: 1, total: 5 } })
    const w = mount(ServiceRegistrationModal, { shallow: true })
    await flushPromises()
    w.vm.formData.name = 'Jira'
    w.vm.selectedActions = { Issues: [{ name: 'get_issue', method: 'GET', path: '/issue' }] }
    const run = w.vm.enrichWithAI()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1500)
    expect(api.getEnrichmentJobStatus).toHaveBeenCalled()
    const polls = api.getEnrichmentJobStatus.mock.calls.length
    const saves = api.saveDraft.mock.calls.length
    w.unmount()
    await run   // resolves on close instead of hanging
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    expect(api.getEnrichmentJobStatus.mock.calls.length).toBe(polls)
    expect(api.saveDraft.mock.calls.length).toBe(saves)
  })
})
