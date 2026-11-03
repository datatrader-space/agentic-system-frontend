// @vitest-environment jsdom
// The retired Connections page's two jobs that landed here (ADM-1151): the agent editor's "Manage Vault" opens the
// credential vault (?panel=credentials), and only a platform admin is offered "Register OAuth Provider".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getConnectorsBundle: vi.fn(), getConnectorTools: vi.fn(),
  getConnectors: vi.fn(), updateConnectorPermissions: vi.fn() }))
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
const route = vi.hoisted(() => ({ path: '/dashboard/connectors', query: {} }))
vi.mock('../services/api', () => ({ default: api, clearApiCache: vi.fn(), isAbortError: () => false }))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => router }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/composables/useOAuthConnect', () => ({ connectOAuth: vi.fn() }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))
import ConnectorsPage from './ConnectorsPage.vue'

const blank = { template: '<div />' }
let wrapper
beforeEach(() => {
  vi.clearAllMocks()
  route.query = {}
  api.getConnectorsBundle.mockResolvedValue({ data: { agents: [], connectors: { connectors: [] }, workspaces: [] } })
  api.getConnectorTools.mockResolvedValue({ data: { readonly: [], write: [] } })
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

async function render({ admin = false } = {}) {
  api.getCurrentUser.mockResolvedValue({ data: { user: { is_platform_admin: admin } } })
  wrapper = mount(ConnectorsPage, { attachTo: document.body, global: { stubs: {
    Icon: blank, PageLoader: blank, CredentialManager: { template: '<div class="test-vault" />' }, MCPServerDetailModal: blank,
    MCPServerModal: blank, ServiceDetailModal: blank, ServiceRegistrationModal: blank, WorkspaceManageModal: blank,
    IntegrationHubModal: blank, ConnectorGettingStartedSidebar: blank, SecureEntryModal: blank,
  } } })
  await flushPromises()
  return wrapper
}

describe('the credential vault link', () => {
  it('opens the vault from ?panel=credentials', async () => {
    route.query = { panel: 'credentials' }
    const w = await render()
    expect(w.find('.test-vault').exists()).toBe(true)
    expect(w.text()).toContain('Credential vault')
  })

  it('stays closed without it', async () => {
    const w = await render()
    expect(w.find('.test-vault').exists()).toBe(false)
  })
})

describe('Register OAuth Provider', () => {
  async function menuLabels(admin) {
    const w = await render({ admin })
    await w.get('.add-btn').trigger('click')
    return w.findAll('.add-menu-title').map(n => n.text())
  }

  it('is offered to a platform admin, and opens the admin page', async () => {
    expect(await menuLabels(true)).toContain('Register OAuth Provider')
    const item = wrapper.findAll('.add-menu-item').find(b => b.text().includes('Register OAuth Provider'))
    await item.trigger('click')
    expect(router.push).toHaveBeenCalledWith('/admin-dashboard/oauth-providers/new')
  })

  it('is not offered to anyone else', async () => {
    expect(await menuLabels(false)).not.toContain('Register OAuth Provider')
  })
})
