// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ getOrgAgentPolicy: vi.fn(), updateOrgAgentPolicy: vi.fn() }))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))

import OrgGuardrails from './OrgGuardrails.vue'

describe('OrgGuardrails — a failed load is not shown as a saved policy', () => {
  it('shows an error with Retry and none of the built-in defaults', async () => {
    api.getOrgAgentPolicy.mockRejectedValueOnce(new Error('offline'))
    const w = mount(OrgGuardrails, { global: { stubs: { OrgLlmDefaults: true } } })
    await flushPromises()
    expect(w.text()).toContain("Couldn't load the organization policy")
    expect(w.text()).not.toContain('Policy enabled')
    expect(w.find('.ag-grid').exists()).toBe(false)

    api.getOrgAgentPolicy.mockResolvedValueOnce({ data: { enabled: true, can_edit: true, organization_name: 'Acme' } })
    await w.find('.load-error__retry').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Policy enabled')
    expect(w.find('.ag-grid').exists()).toBe(true)
    w.unmount()
  })
})
