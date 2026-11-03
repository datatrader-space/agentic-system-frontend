// @vitest-environment jsdom
// A sign-in that expired with nothing to renew it (production chat 3066, ADM-1121: Google issued no refresh
// token, so Search Console died an hour after connecting while it showed as connected). The panel offers the
// one thing that brings it back, signing in again, and never "Enable", which would revive the dead token.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ getConnectorCatalog: vi.fn(), getConnectorServices: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api, clearApiCache: vi.fn(), isAbortError: () => false }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), useRoute: () => ({ query: {} }) }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useOAuthConnect', () => ({ connectOAuth: vi.fn() }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))
import IntegrationHubModal from './IntegrationHubModal.vue'

const blank = { template: '<div />' }
const ITEM = { id: 'google-search-console', name: 'Google Search Console', desc: 'Search performance',
  category: 'Marketing & Email', icon: 'lucide:search', author: 'Google', version: '1', kind: 'service' }

function service(status) {
  return { key: ITEM.id, name: ITEM.name, connected: true, status, enabled: status === 'connected',
    oauth_configured: true, is_registered_service: true, service_id: 50, auth_methods: ['oauth2'],
    auth_method: 'oauth2', requested_scopes: [], scopes_granted: [], capabilities: [] }
}

let wrapper
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
beforeEach(() => {
  vi.clearAllMocks()
  api.getConnectorCatalog.mockResolvedValue({ data: { items: [ITEM] } })
})

async function openWith(status) {
  api.getConnectorServices.mockResolvedValue({ data: { services: [service(status)] } })
  wrapper = mount(IntegrationHubModal, { attachTo: document.body,
    global: { stubs: { Icon: blank, SkillsLibraryPanel: blank } } })
  await flushPromises()
  await wrapper.get('.catalog-connect').trigger('click')
  await flushPromises()
  return wrapper
}

describe('an expired sign-in', () => {
  it('says so, offers "Sign in again", and hides Enable', async () => {
    const w = await openWith('expired')
    const alert = w.get('[role="alert"]')
    expect(alert.text()).toContain('Your sign-in to Google Search Console has expired')
    expect(alert.text()).toContain('Sign in again')
    const labels = w.findAll('button').map(b => b.text().trim())
    expect(labels).not.toContain('Enable')
    expect(labels).not.toContain('Disable')
    expect(labels).toContain('Disconnect')
    expect(w.text()).not.toContain('Connected to Google Search Console')
  })

  it('a sign-in that works still shows as connected, with Disable', async () => {
    const w = await openWith('connected')
    expect(w.find('[role="alert"]').exists()).toBe(false)
    expect(w.text()).toContain('Connected to Google Search Console')
    expect(w.findAll('button').map(b => b.text().trim())).toContain('Disable')
  })
})
