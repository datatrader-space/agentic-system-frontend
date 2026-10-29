// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
const tenancy = vi.hoisted(() => ({ getOrgOverview: vi.fn(), getOrgActivity: vi.fn() }))
const api = vi.hoisted(() => ({ getBudgetsSummary: vi.fn() }))
vi.mock('../services/tenancyApi', () => ({ default: tenancy }))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
import OrganizationModulePage from './OrganizationModulePage.vue'
import { useOrganizationStore } from '../stores/useOrganizationStore'

let wrapper
async function render(module) {
  const pinia = createPinia(); setActivePinia(pinia)
  const store = useOrganizationStore()
  store.$patch({ loaded: true, orgSlug: 'test-team', org: { slug: 'test-team', name: 'Test team', role: 'owner' } })
  vi.spyOn(store, 'resolveOrgSlug').mockResolvedValue('test-team')
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/dashboard/organization', component: { template: '<div />' } },
    { path: '/dashboard/organization/:module', name: 'dashboard-organization-module', component: OrganizationModulePage },
  ] })
  router.push(`/dashboard/organization/${module}`); await router.isReady()
  wrapper = mount(OrganizationModulePage, { global: { plugins: [pinia, router], stubs: { Icon: { template: '<span />' } } } })
  await flushPromises()
  return wrapper
}
afterEach(() => { wrapper?.unmount(); vi.clearAllMocks() })

describe('organization modules with no backend yet', () => {
  it.each(['cloud-resources', 'sandboxes', 'procurement', 'policies-controls'])('%s shows an honest empty state, no invented rows', async (module) => {
    const w = await render(module)
    expect(w.get('.placeholder-card h2').text()).toBe('No data yet')
    expect(w.get('.placeholder-card p').text().length).toBeGreaterThan(20)
    expect(w.findAll('.metric-card')).toHaveLength(0)
    expect(w.findAll('table')).toHaveLength(0)
    expect(w.text()).not.toMatch(/\$\d|\b20\d\d\b|Ali Tahir|Rida Khan|1-8 of 32/)
    expect(tenancy.getOrgOverview).not.toHaveBeenCalled()
    expect(api.getBudgetsSummary).not.toHaveBeenCalled()
    expect(w.find('.module-actions button.primary').exists()).toBe(false)   // no button that does nothing
  })

  it('the header action shows only where it leads somewhere (Budgets)', async () => {
    api.getBudgetsSummary.mockResolvedValue({ data: {} })
    const w = await render('budgets-finance')
    expect(w.find('.module-actions button.primary').exists()).toBe(true)
  })

  it('a live module still shows what the backend returned, not the empty state', async () => {
    tenancy.getOrgOverview.mockResolvedValue({ data: { workspaces: [{ id: 3, name: 'Real workspace', owner: 'Owner', members: 2, agents: 1 }], metrics: { workspaces: 1 } } })
    const w = await render('workspaces')
    expect(w.find('.placeholder-card').exists()).toBe(false)
    expect(w.text()).toContain('Real workspace')
    expect(w.findAll('.metric-card')[0].text()).toContain('1')
  })
})
