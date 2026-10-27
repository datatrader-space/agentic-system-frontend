// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ get: vi.fn(), getAgentPicker: vi.fn() }))
vi.mock('../services/api', () => ({ default: api, isAbortError: () => false }))

import LLMDashboard from './LLMDashboard.vue'

let wrapper
beforeEach(() => {
  vi.clearAllMocks()
  api.getAgentPicker.mockResolvedValue({ data: [{ id: 1, name: 'Writer' }] })
})
afterEach(() => wrapper?.unmount())

const mountPage = async () => {
  wrapper = mount(LLMDashboard, { global: { stubs: { Icon: true, PageLoader: true } } })
  await flushPromises()
}

describe('Activity (LLMDashboard) — no invented data', () => {
  it('shows an error with Retry when the request log fails, never the May-2025 demo rows', async () => {
    api.get.mockImplementation((url) => url === '/llm/requests/'
      ? Promise.reject(new Error('500'))
      : Promise.resolve({ data: { results: [] } }))
    await mountPage()
    expect(wrapper.text()).toContain("Couldn't load the request log")
    expect(wrapper.text()).not.toContain('2025')
    expect(wrapper.text()).not.toContain('Content Writer')

    api.get.mockImplementation(() => Promise.resolve({ data: { results: [{ id: 5, agent_name: 'Writer', status: 'success', created_at: '2026-10-01T10:00:00Z' }], count: 1 } }))
    await wrapper.find('.load-error__retry').trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain("Couldn't load the request log")
    expect(wrapper.text()).toContain('Writer')
  })

  it('shows "No runs yet" for a real empty log, and no demo audit events', async () => {
    api.get.mockResolvedValue({ data: { results: [], count: 0 } })
    await mountPage()
    expect(wrapper.text()).toContain('No runs yet.')
    await wrapper.findAll('.activity-tabs button')[1].trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('No audit events yet.')
    expect(wrapper.text()).not.toContain('Credential rotated')
  })

  it('does not wait for the agent walk before loading runs', async () => {
    api.getAgentPicker.mockReturnValue(new Promise(() => {}))   // never answers
    api.get.mockResolvedValue({ data: { results: [], count: 0 } })
    await mountPage()
    expect(api.get).toHaveBeenCalledWith('/llm/requests/', expect.anything())
    expect(wrapper.text()).toContain('No runs yet.')
  })

  it('applies only the newest filter answer', async () => {
    const pending = []
    api.get.mockImplementation((url, cfg) => {
      if (url === '/llm/audit/') return Promise.resolve({ data: { results: [] } })
      return new Promise((resolve) => pending.push({ cfg, resolve }))
    })
    wrapper = mount(LLMDashboard, { global: { stubs: { Icon: true, PageLoader: true } } })
    await flushPromises()
    pending[0].resolve({ data: { results: [], count: 0 } })
    await flushPromises()
    // Two filter changes in a row (agent, then status): the first answer arrives LAST.
    await wrapper.findAll('select')[0].setValue('')
    await wrapper.findAll('select')[1].setValue('error')
    await flushPromises()
    const reqs = pending.slice(1)
    expect(reqs.length).toBeGreaterThanOrEqual(2)
    const newest = reqs[reqs.length - 1]
    const older = reqs[0]
    expect(older.cfg.signal.aborted).toBe(true)
    newest.resolve({ data: { results: [{ id: 2, agent_name: 'Newest', status: 'error' }], count: 1 } })
    await flushPromises()
    older.resolve({ data: { results: [{ id: 1, agent_name: 'Stale', status: 'success' }], count: 1 } })
    await flushPromises()
    expect(wrapper.text()).toContain('Newest')
    expect(wrapper.text()).not.toContain('Stale')
  })
})

describe('Activity (LLMDashboard) — what it asks for', () => {
  const calls = (url) => api.get.mock.calls.filter(([u]) => u === url)

  it('reads the audit trail only when its tab is opened, and once', async () => {
    api.get.mockResolvedValue({ data: { results: [], count: 0 } })
    await mountPage()
    expect(calls('/llm/audit/')).toHaveLength(0)
    const tabs = wrapper.findAll('.activity-tabs button')
    await tabs[1].trigger('click')
    await flushPromises()
    await tabs[0].trigger('click')
    await tabs[1].trigger('click')
    await flushPromises()
    expect(calls('/llm/audit/')).toHaveLength(1)
  })

  it('sends the date range it shows: the last 7 days first, nothing for all time', async () => {
    api.get.mockResolvedValue({ data: { results: [], count: 0 } })
    const before = Date.now()
    await mountPage()
    const since = new Date(calls('/llm/requests/')[0][1].params.since).getTime()
    expect(Math.abs(before - 7 * 86400000 - since)).toBeLessThan(60000)
    await wrapper.findAll('select')[2].setValue('all')
    await flushPromises()
    const last = calls('/llm/requests/').at(-1)[1].params
    expect(last.since).toBeUndefined()
    expect(last.page).toBe(1)
  })
})
