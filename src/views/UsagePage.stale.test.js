// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ get: vi.fn(), getAgentPicker: vi.fn(), getConversations: vi.fn(), getLlmCostByConversation: vi.fn() }))
vi.mock('../services/api', () => ({ default: api, isAbortError: () => false }))

import UsagePage from './UsagePage.vue'

let wrapper
beforeEach(() => vi.clearAllMocks())
afterEach(() => wrapper?.unmount())

describe('UsagePage — filters', () => {
  it('does not wait for the agent walk, and applies only the newest filter answer', async () => {
    api.getAgentPicker.mockReturnValue(new Promise(() => {}))   // never answers
    const requests = []
    api.get.mockImplementation((url, cfg) => {
      if (url !== '/llm/requests/') return Promise.resolve({ data: {} })
      return new Promise((resolve) => requests.push({ cfg, resolve }))
    })
    wrapper = mount(UsagePage, { global: { stubs: { Icon: true, PageLoader: true } } })
    await flushPromises()
    expect(requests.length).toBe(1)               // the data load started without the agent list

    // Change the period while the first load is still out: the first is aborted and its answer dropped.
    await wrapper.findAll('select')[1].setValue(30)
    await flushPromises()
    expect(requests.length).toBe(2)
    expect(requests[0].cfg.signal.aborted).toBe(true)
    expect(requests[1].cfg.params.days).toBe(30)

    requests[1].resolve({ data: { results: [{ id: 2, model: 'model-newest', status: 'success' }], count: 1 } })
    await flushPromises()
    requests[0].resolve({ data: { results: [{ id: 1, model: 'model-stale', status: 'success' }], count: 1 } })
    await flushPromises()
    expect(wrapper.text()).toContain('model-newest')
    expect(wrapper.text()).not.toContain('model-stale')
  })
})
