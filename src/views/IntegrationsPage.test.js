// @vitest-environment jsdom
// Integrations: two tabs, Agents (default) and AADML as an MCP server; the tab is kept in the address.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

const api = vi.hoisted(() => ({ getAadmlMcpInfo: vi.fn(), getAadmlMcpConnections: vi.fn(), revokeAadmlMcpConnection: vi.fn() }))
const router = vi.hoisted(() => ({ replace: vi.fn() }))
const routeBox = vi.hoisted(() => ({ route: null }))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => routeBox.route, useRouter: () => router }))

import IntegrationsPage from './IntegrationsPage.vue'

const AgentIntegrationsList = { name: 'AgentIntegrationsList', template: '<div class="agents-stub" />' }
const open = async (query = {}) => {
  routeBox.route = reactive({ query })
  api.getAadmlMcpInfo.mockResolvedValue({ data: { enabled: true, url: 'https://aadml.com/api/mcp/v1' } })
  api.getAadmlMcpConnections.mockResolvedValue({ data: { connections: [{ id: 1, is_active: true, client_name: 'Claude' }] } })
  const w = mount(IntegrationsPage, { global: { stubs: { AgentIntegrationsList } } })
  await flushPromises()
  return w
}

beforeEach(() => { vi.clearAllMocks() })

describe('IntegrationsPage tabs', () => {
  it('opens on Agents, with the MCP section out of the way', async () => {
    const w = await open()
    expect(w.find('.agents-stub').exists()).toBe(true)
    expect(w.text()).not.toContain('Connect ChatGPT or Claude')
  })

  it('?tab=mcp shows the MCP section, and the tab shows how many clients are connected', async () => {
    const w = await open({ tab: 'mcp' })
    expect(w.find('.agents-stub').exists()).toBe(false)
    expect(w.text()).toContain('Connect ChatGPT or Claude')
    const mcpTab = w.findAll('nav[aria-label="Integrations"] button').find(b => b.text().includes('MCP server'))
    expect(mcpTab.text()).toContain('1')
  })

  it('choosing a tab puts it in the address', async () => {
    const w = await open()
    await w.findAll('nav[aria-label="Integrations"] button').find(b => b.text().includes('MCP server')).trigger('click')
    expect(router.replace).toHaveBeenCalledWith({ query: { tab: 'mcp' } })
  })
})
