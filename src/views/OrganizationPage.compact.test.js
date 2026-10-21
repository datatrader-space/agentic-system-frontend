// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
const api = vi.hoisted(() => ({ inviteOrgMember: vi.fn(), createWorkspace: vi.fn(), getWSMembers: vi.fn(), getOrgMembers: vi.fn() }))
vi.mock('../services/tenancyApi', () => ({ default: api }))
vi.mock('../services/api', () => ({ default: {} }))
vi.mock('../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
import OrganizationPage from './OrganizationPage.vue'
import { useOrganizationStore } from '../stores/useOrganizationStore'
let wrapper
async function render(role, provide = {}) {
  const pinia = createPinia(); setActivePinia(pinia)
  const store = useOrganizationStore()
  store.$patch({ loaded: true, orgSlug: 'test-team', org: { slug: 'test-team', name: 'Test team', role },
    workspaces: [{ id: 12, name: 'Team workspace', owner: 'Owner', members: 8, agents: 2 }],
    members: Array.from({ length: 8 }, (_, i) => ({ user: i + 1, username: `Member ${i + 1}`, email: `member${i + 1}@example.test`, role: i ? 'member' : 'owner' })),
  })
  vi.spyOn(store, 'loadMembers').mockResolvedValue(undefined)
  wrapper = mount(OrganizationPage, { props: { compact: true }, attachTo: document.body, global: { plugins: [pinia], provide,
    stubs: { Icon: { template: '<span />' }, RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
  await flushPromises()
  return { w: wrapper, store }
}
const tab = (w, label) => w.findAll('nav[aria-label="Organization sections"] button').find(button => button.text() === label)
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.clearAllMocks() })
describe('compact organization settings', () => {
  it('retains read-only access, all members, and links to larger management screens', async () => {
    const { w } = await render('viewer')
    expect(w.findAll('.head-actions button')).toHaveLength(0)
    await tab(w, 'Workspaces').trigger('click')
    expect(w.text()).toContain('Team workspace')
    await tab(w, 'Members').trigger('click')
    expect(w.findAll('.members-panel tbody tr')).toHaveLength(8)
    expect(w.get('.compact-org-manage a').attributes('href')).toBe('/dashboard/org/test-team/settings/members')
    await tab(w, 'More').trigger('click')
    expect(w.findAll('.module-list a')).toHaveLength(8)
    expect(w.text()).toContain('coming soon')
    expect(api.inviteOrgMember).not.toHaveBeenCalled()
    expect(api.createWorkspace).not.toHaveBeenCalled()
  })

  it('keeps the existing scoped invitation flow inside settings, with no send when merely opened', async () => {
    const host = document.createElement('div'); document.body.append(host)
    const active = vi.fn()
    const { w } = await render('owner', { settingsDialogHost: ref(host), settingsOverlayActive: active })
    await w.findAll('.head-actions button').find(button => button.text().includes('Invite Member')).trigger('click')
    await flushPromises()
    const dialog = host.querySelector('[data-settings-owned-dialog]')
    expect(dialog).toBeTruthy()
    expect(active).toHaveBeenCalledWith(true)
    expect(api.inviteOrgMember).not.toHaveBeenCalled()
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(active).toHaveBeenLastCalledWith(false)
    expect(api.inviteOrgMember).not.toHaveBeenCalled()
  })
})
