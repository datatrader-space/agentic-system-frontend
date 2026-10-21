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
const open = async (query = {}, props = {}) => {
  routeBox.route = reactive({ query })
  api.getAadmlMcpInfo.mockResolvedValue({ data: { enabled: true, url: 'https://aadml.com/api/mcp/v1' } })
  api.getAadmlMcpConnections.mockResolvedValue({ data: { connections: [{ id: 1, is_active: true, client_name: 'Claude' }] } })
  const w = mount(IntegrationsPage, { props, global: { stubs: { AgentIntegrationsList } } })
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

describe('IntegrationsPage inside settings', () => {
  it('keeps tabs local and preserves the page underneath the settings modal', async () => {
    const w = await open({ tab: 'unrelated', search: 'keep-this' }, { compact: true })
    await w.findAll('nav[aria-label="Integrations"] button').find(b => b.text().includes('MCP server')).trigger('click')
    expect(w.find('.compact-client-list').exists()).toBe(true)
    expect(w.find('table').exists()).toBe(false)
    expect(w.text()).toContain('Claude')
    expect(router.replace).not.toHaveBeenCalled()
    expect(routeBox.route.query).toEqual({ tab: 'unrelated', search: 'keep-this' })
    expect(api.revokeAadmlMcpConnection).not.toHaveBeenCalled()
    w.unmount()
  })

  it('retains confirmation before disconnecting from a compact client card', async () => {
    const { confirm } = await import('@/composables/useConfirm')
    const w = await open({}, { compact: true })
    await w.findAll('nav[aria-label="Integrations"] button').find(b => b.text().includes('MCP server')).trigger('click')
    confirm.mockResolvedValueOnce(false)
    await w.get('.compact-disconnect').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ danger: true, confirmText: 'Disconnect' }))
    expect(api.revokeAadmlMcpConnection).not.toHaveBeenCalled()
    api.revokeAadmlMcpConnection.mockResolvedValueOnce({ data: { connection: { id: 1, client_name: 'Claude', is_active: false } } })
    confirm.mockResolvedValueOnce(true)
    await w.get('.compact-disconnect').trigger('click')
    await flushPromises()
    expect(api.revokeAadmlMcpConnection).toHaveBeenCalledWith(1)
    expect(w.find('.compact-disconnect').exists()).toBe(false)
    w.unmount()
  })
})
