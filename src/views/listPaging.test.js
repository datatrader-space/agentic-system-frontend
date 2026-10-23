// @vitest-environment jsdom
// Page-speed plan Phase 5 items 2 and 9: lists that stopped at the first page now offer the rest, a
// newer filter's request cannot be overwritten by an older one, and a failed load shows an error with
// Retry instead of "nothing here".
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  adminHelpEmbeddingsStatus: vi.fn(),
  adminHelpContentMeta: vi.fn(),
  adminGuidedTourMeta: vi.fn(),
}))
vi.mock('../services/api', () => ({
  default: api,
  isAbortError: (e) => !!e && (e.name === 'CanceledError' || e.name === 'AbortError'),
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() }, useNotify: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(), useConfirm: () => vi.fn() }))
vi.mock('marked', () => ({ marked: { parse: (s) => s } }))

import DelegationsPage from './DelegationsPage.vue'
import WorkflowRunsPage from './WorkflowRunsPage.vue'
import AdminHelpContent from './admin/AdminHelpContent.vue'
import AdminGuidedTours from './admin/AdminGuidedTours.vue'

const stubs = { RouterLink: { template: '<a><slot /></a>' }, 'router-link': { template: '<a><slot /></a>' }, Icon: true, VerificationBadge: true }

// A GET that resolves only when the test says so, and rejects like axios when its signal aborts.
function deferredGet() {
  const pending = []
  api.get.mockImplementation((url, config = {}) => new Promise((resolve, reject) => {
    const entry = { url, config, resolve }
    pending.push(entry)
    config.signal?.addEventListener('abort', () => reject(Object.assign(new Error('canceled'), { name: 'CanceledError' })))
  }))
  return pending
}

beforeEach(() => {
  vi.clearAllMocks()
  api.adminHelpEmbeddingsStatus.mockResolvedValue({ data: { state: 'idle' } })
  api.adminHelpContentMeta.mockResolvedValue({ data: {} })
  api.adminGuidedTourMeta.mockResolvedValue({ data: {} })
})

describe('DelegationsPage', () => {
  it('offers Load more while the server has a next page, and appends page 2', async () => {
    api.get
      .mockResolvedValueOnce({ data: { count: 3, next: 'p2', results: [{ id: 1 }, { id: 2 }] } })
      .mockResolvedValueOnce({ data: { count: 3, next: null, results: [{ id: 3 }] } })
    const w = mount(DelegationsPage, { global: { stubs } })
    await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/delegations/', expect.objectContaining({ params: { page: 1 } }))
    const more = w.findAll('button').find((b) => b.text() === 'Load more')
    expect(more).toBeTruthy()
    await more.trigger('click')
    await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/delegations/', expect.objectContaining({ params: { page: 2 } }))
    expect(w.findAll('tbody tr').length).toBe(3)
    expect(w.findAll('button').some((b) => b.text() === 'Load more')).toBe(false)
  })

  it('a slower earlier filter cannot replace the rows of the filter clicked after it', async () => {
    const pending = deferredGet()
    const w = mount(DelegationsPage, { global: { stubs } })
    await flushPromises()
    const failedBtn = w.findAll('button').find((b) => b.text() === 'Failed')
    await failedBtn.trigger('click')
    expect(pending).toHaveLength(2)
    expect(pending[0].config.signal.aborted).toBe(true)          // the first request was aborted
    pending[1].resolve({ data: { results: [{ id: 9, task: 'failed one' }], next: null } })
    pending[0].resolve({ data: { results: [{ id: 1, task: 'stale' }], next: null } })
    await flushPromises()
    expect(w.text()).toContain('failed one')
    expect(w.text()).not.toContain('stale')
  })

  it('a failed load shows an error with Retry, not "No delegations yet"', async () => {
    api.get.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ data: { results: [], next: null } })
    const w = mount(DelegationsPage, { global: { stubs } })
    await flushPromises()
    expect(w.text()).toContain("Couldn't load delegations")
    expect(w.text()).not.toContain('No delegations yet')
    await w.find('.load-error__retry').trigger('click')
    await flushPromises()
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(w.text()).toContain('No delegations yet')
  })
})

describe('WorkflowRunsPage', () => {
  it('pages with offset while has_more is true', async () => {
    api.get
      .mockResolvedValueOnce({ data: { items: [{ id: 1, status: 'success' }], has_more: true, attention: {} } })
      .mockResolvedValueOnce({ data: { items: [{ id: 2, status: 'dead' }], has_more: false } })
    const w = mount(WorkflowRunsPage, { global: { stubs } })
    await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/workflow-runs/', expect.objectContaining({ params: { limit: 50, offset: 0 } }))
    const more = w.findAll('button').find((b) => b.text() === 'Load more')
    await more.trigger('click')
    await flushPromises()
    expect(api.get).toHaveBeenLastCalledWith('/workflow-runs/', expect.objectContaining({ params: { limit: 50, offset: 1 } }))
    expect(w.findAll('tbody tr').filter((r) => r.find('.pill').exists()).length).toBe(2)
    expect(w.findAll('button').some((b) => b.text() === 'Load more')).toBe(false)
  })

  it('a failed load shows an error with Retry, not "No runs match this filter"', async () => {
    api.get.mockRejectedValueOnce(new Error('boom'))
    const w = mount(WorkflowRunsPage, { global: { stubs } })
    await flushPromises()
    expect(w.text()).toContain("Couldn't load workflow runs")
    expect(w.text()).not.toContain('No runs match')
  })

  it('a click on run B drops the late timeline of run A', async () => {
    api.get.mockResolvedValueOnce({ data: { items: [{ id: 1, status: 'success', workflow_name: 'A' }, { id: 2, status: 'success', workflow_name: 'B' }], has_more: false } })
    const w = mount(WorkflowRunsPage, { global: { stubs } })
    await flushPromises()
    const pending = deferredGet()
    const rows = w.findAll('tbody tr')
    await rows[0].trigger('click')
    await rows[1].trigger('click')
    expect(pending[0].config.signal.aborted).toBe(true)
    expect(pending[1].url).toBe('/workflow-graph-runs/2/timeline/')
  })
})

describe('Admin Help content and Guided tours', () => {
  it.each([
    ['AdminHelpContent', AdminHelpContent, '/admin/helpcenter/content/'],
    ['AdminGuidedTours', AdminGuidedTours, '/admin/helpcenter/guided-tours/'],
  ])('%s offers the pages past the first 20', async (_n, Comp, url) => {
    const first = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `t${i + 1}`, slug: `s${i + 1}`, status: 'draft' }))
    api.get.mockImplementation((u, config) => {
      if (u !== url) return Promise.resolve({ data: {} })
      return Promise.resolve(config.params.page === 1
        ? { data: { count: 21, next: 'p2', results: first } }
        : { data: { count: 21, next: null, results: [{ id: 21, title: 't21', slug: 's21', status: 'draft' }] } })
    })
    const w = mount(Comp, { global: { stubs, provide: { notify: vi.fn() } } })
    await flushPromises()
    expect(w.findAll('tbody tr').length).toBe(20)
    const more = w.findAll('button').find((b) => b.text().startsWith('Load more'))
    expect(more.text()).toContain('20 of 21')
    await more.trigger('click')
    await flushPromises()
    expect(w.findAll('tbody tr').length).toBe(21)
    expect(w.findAll('button').some((b) => b.text().startsWith('Load more'))).toBe(false)
  })
})
