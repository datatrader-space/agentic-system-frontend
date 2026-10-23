// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { wsId: '7', tab: 'agents' } }),
  useRouter: () => ({ push: vi.fn() }),
}))
const api = vi.hoisted(() => ({ get: vi.fn(), getGlobalAgentPolicy: vi.fn(async () => ({ data: {} })) }))
vi.mock('../services/api', () => ({ default: api }))
const tenancy = vi.hoisted(() => ({
  getWorkspace: vi.fn(), listWSAgents: vi.fn(), listWSServices: vi.fn(), listWSMCP: vi.fn(), getWSMembers: vi.fn(),
}))
vi.mock('../services/tenancyApi', () => ({ default: tenancy }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import WorkspaceDashboard from './WorkspaceDashboard.vue'

const stubs = { PlatformLlmPolicy: true, 'router-link': true }
beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: { results: [] } })
})

describe("WorkspaceDashboard — never the user's global resources in place of the workspace's", () => {
  it('a failed workspace load shows an error with Retry and never lists global agents', async () => {
    tenancy.getWorkspace.mockRejectedValueOnce(new Error('offline'))
    api.get.mockResolvedValue({ data: { results: [{ id: 1, name: 'My PRIVATE agent' }] } })
    const w = mount(WorkspaceDashboard, { global: { stubs } })
    await flushPromises()
    expect(w.text()).toContain("Couldn't load this workspace")
    expect(w.text()).not.toContain('My PRIVATE agent')
    expect(api.get).not.toHaveBeenCalledWith('/agents/')
    w.unmount()
  })

  it("lists the workspace's own agents when the load works", async () => {
    tenancy.getWorkspace.mockResolvedValue({ data: { id: 7, name: 'Team', slug: 'team', organization_slug: 'acme' } })
    tenancy.listWSAgents.mockResolvedValue({ data: [{ id: 3, name: 'Team agent' }] })
    tenancy.listWSServices.mockResolvedValue({ data: [] })
    tenancy.listWSMCP.mockResolvedValue({ data: [] })
    tenancy.getWSMembers.mockResolvedValue({ data: [] })
    const w = mount(WorkspaceDashboard, { global: { stubs } })
    await flushPromises()
    expect(w.text()).toContain('Agents 1')
    expect(w.find('.resource-card').exists()).toBe(true)
    expect(w.text()).not.toContain("Couldn't load")
    w.unmount()
  })
})
