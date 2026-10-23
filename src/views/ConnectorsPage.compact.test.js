// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

const api = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getConnectorsBundle: vi.fn(), getConnectorTools: vi.fn(), getConnectors: vi.fn(), updateConnectorPermissions: vi.fn() }))
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('../services/api', () => ({ default: api, clearApiCache: vi.fn(), isAbortError: () => false }))
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/dashboard/chat/new', query: { tab: 'skills', scope: 'agent:99', secure_entry: 'unrelated' } }), useRouter: () => router }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/composables/useOAuthConnect', () => ({ connectOAuth: vi.fn() }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))
import ConnectorsPage from './ConnectorsPage.vue'
let wrapper
const blank = { template: '<div />' }
const server = { id: 1, kind: 'mcp', name: 'Synthetic tools', connected: true, tool_count_total: 0, auth_kind: 'none' }
beforeEach(() => {
  vi.clearAllMocks()
  api.getCurrentUser.mockResolvedValue({ data: { user: { is_platform_admin: false } } })
  api.getConnectorsBundle.mockResolvedValue({ data: { agents: [], connectors: { connectors: [server] }, workspaces: [] } })
  api.getConnectorTools.mockResolvedValue({ data: { readonly: [], write: [] } })
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
function render(provide = {}) {
  wrapper = mount(ConnectorsPage, { props: { compact: true }, attachTo: document.body, global: { provide, stubs: {
    Icon: blank, PageLoader: blank, CredentialManager: blank, MCPServerDetailModal: blank,
    MCPServerModal: { template: '<div class="test-server-setup"><button @click="$emit(\'close\')">Close setup</button></div>' },
    ServiceDetailModal: blank, ServiceRegistrationModal: blank, WorkspaceManageModal: blank,
    IntegrationHubModal: blank, ConnectorGettingStartedSidebar: blank, SecureEntryModal: blank,
  } } })
  return wrapper
}
describe('compact connector settings', () => {
  it('starts with a list, drills into details, and ignores unrelated page queries without changing permissions', async () => {
    const w = render()
    await flushPromises()
    expect(api.getConnectorsBundle).toHaveBeenCalledWith('global')
    expect(w.find('[data-settings-owned-dialog]').exists()).toBe(false)
    await w.get('.conn-row').trigger('click')
    await flushPromises()
    expect(w.get('.list-pane').isVisible()).toBe(false)
    expect(w.get('.detail-pane').isVisible()).toBe(true)
    await w.get('.compact-back').trigger('click')
    expect(w.get('.list-pane').isVisible()).toBe(true)
    expect(api.updateConnectorPermissions).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('portals setup above settings and closes it with Escape', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const active = vi.fn()
    const w = render({ settingsDialogHost: ref(host), settingsOverlayActive: active })
    await flushPromises()
    await w.get('.add-btn').trigger('click')
    await w.findAll('.add-menu-item').find(button => button.text().includes('Custom MCP')).trigger('click')
    await flushPromises()
    const dialog = host.querySelector('[data-settings-owned-dialog]')
    expect(dialog).toBeTruthy()
    expect(active).toHaveBeenCalledWith(true)
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(host.querySelector('[data-settings-owned-dialog]')).toBeNull()
    expect(active).toHaveBeenLastCalledWith(false)
  })
})

describe('connector tools: a fast A->B click', () => {
  it("never shows A's late tools under B, and never writes A's tools to B", async () => {
    const a = { id: 1, kind: 'mcp', name: 'Alpha', connected: true, tool_count_total: 1, auth_kind: 'none' }
    const b = { id: 2, kind: 'mcp', name: 'Beta', connected: true, tool_count_total: 1, auth_kind: 'none' }
    api.getConnectorsBundle.mockResolvedValue({ data: { agents: [], connectors: { connectors: [a, b] }, workspaces: [] } })
    let resolveA
    api.getConnectorTools.mockImplementation((kind, id) => id === 1
      ? new Promise((r) => { resolveA = r })
      : Promise.resolve({ data: { readonly: [{ name: 'beta_read', permission: 'allow' }], write: [] } }))
    api.updateConnectorPermissions.mockResolvedValue({ data: {} })
    const w = render()
    await flushPromises()
    const rows = w.findAll('.conn-row')
    await rows[0].trigger('click')     // A: its tools are slow
    await rows[1].trigger('click')     // B: answers at once
    await flushPromises()
    resolveA({ data: { readonly: [{ name: 'alpha_read', permission: 'allow' }], write: [] } })
    await flushPromises()
    expect(w.text()).toContain('beta_read')
    expect(w.text()).not.toContain('alpha_read')
    const ask = w.findAll('.perm-btn').find((btn) => btn.text() === 'ask')
    await ask.trigger('click')
    await flushPromises()
    expect(api.updateConnectorPermissions).toHaveBeenCalledTimes(1)
    expect(api.updateConnectorPermissions).toHaveBeenCalledWith('mcp', 2, 'global', { beta_read: 'ask' })
  })
})
