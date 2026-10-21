// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
const state = vi.hoisted(() => ({}))
const actions = vi.hoisted(() => ({ switchWorkspace: vi.fn(), clearWorkspace: vi.fn(), loadMyOrgs: vi.fn(), push: vi.fn(), createWorkspace: vi.fn(), createOrg: vi.fn() }))
vi.mock('../../composables/useWorkspace', async () => {
  const { ref, computed } = await import('vue')
  Object.assign(state, { activeWorkspace: ref(null), activeOrg: ref(null), myOrgs: ref([]), loading: ref(false), error: ref(null), tenancyDisabled: ref(false) })
  return { useWorkspace: () => ({ ...state, ...actions, activeWorkspaceName: computed(() => state.activeWorkspace.value?.name || '') }) }
})
vi.mock('vue-router', () => ({ useRouter: () => ({ push: actions.push }) }))
vi.mock('../../services/tenancyApi', () => ({ default: actions }))
vi.mock('../../composables/useNotify', () => ({ notify: { error: vi.fn() } }))
import WorkspaceSwitcher from './WorkspaceSwitcher.vue'
let wrapper
const popup = () => document.querySelector('.ws-dropdown')
const button = label => [...popup().querySelectorAll('button')].find(el => el.textContent.trim().includes(label))
async function render(rect = { left: 16, right: 212, top: 72, bottom: 118, width: 196, height: 46 }) {
  wrapper = mount(WorkspaceSwitcher, { attachTo: document.body, global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
  wrapper.element.getBoundingClientRect = () => rect
  await wrapper.get('.ws-trigger').trigger('click')
  await flushPromises()
  return wrapper
}
beforeEach(() => {
  vi.stubGlobal('requestIdleCallback', vi.fn(() => 1))
  state.activeWorkspace.value = null; state.activeOrg.value = null; state.loading.value = false; state.error.value = null; state.tenancyDisabled.value = false
  state.myOrgs.value = [{ id: 1, slug: 'example-team', name: 'team-administrator@example.test', is_personal: true, workspaces: [{ id: 10, name: 'Default', member_count: 1 }, { id: 11, name: 'Customer support workspace', member_count: 12 }] }]
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('workspace switcher popover', () => {
  it('uses a readable popover width outside the narrow sidebar and exposes the current personal context', async () => {
    const w = await render()
    expect(w.get('.ws-trigger').text()).toContain('Personal mode')
    expect(w.get('.ws-trigger').attributes('aria-expanded')).toBe('true')
    expect(popup().style.width).toBe('304px')
    expect(popup().querySelector('.ws-org-name').textContent).toBe('team-administrator@example.test')
    expect(popup().querySelector('.ws-item--personal').getAttribute('aria-current')).toBe('true')
    expect(actions.switchWorkspace).not.toHaveBeenCalled()
    expect(actions.createWorkspace).not.toHaveBeenCalled()
    expect(actions.createOrg).not.toHaveBeenCalled()
  })

  it('filters workspaces while preserving the original organization and selected workspace', async () => {
    await render()
    const input = popup().querySelector('input')
    input.value = 'customer support'; input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect([...popup().querySelectorAll('.ws-org-group .ws-item')]).toHaveLength(1)
    button('Customer support workspace').click()
    await flushPromises()
    expect(actions.switchWorkspace).toHaveBeenCalledWith(state.myOrgs.value[0].workspaces[1], state.myOrgs.value[0])
    expect(actions.push).toHaveBeenCalledWith('/workspace/11')
    expect(popup()).toBeNull()
    expect(state.myOrgs.value[0].workspaces).toHaveLength(2)
  })

  it('supports keyboard selection, Escape focus restoration, and dismissal when focus leaves', async () => {
    const w = await render()
    const input = popup().querySelector('input')
    expect(document.activeElement).toBe(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(button('Personal mode'))
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(popup()).toBeNull()
    expect(document.activeElement).toBe(w.get('.ws-trigger').element)
    await w.get('.ws-trigger').trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(document.activeElement).toBe(button('Personal mode'))
    const outside = document.createElement('button'); document.body.append(outside); outside.focus()
    await flushPromises()
    expect(popup()).toBeNull()
  })

  it('stays inside the mobile viewport and opens above a low trigger', async () => {
    vi.stubGlobal('innerWidth', 360); vi.stubGlobal('innerHeight', 700)
    await render({ left: 300, right: 344, top: 620, bottom: 666, width: 44, height: 46 })
    expect(popup().style.left).toBe('44px')
    expect(popup().style.bottom).toBe('88px')
    expect(popup().style.top).toBe('')
    expect(popup().style.maxHeight).toBe('560px')
  })

  it('retains personal mode and creation actions, and shows a retry instead of a false empty state on failure', async () => {
    state.activeWorkspace.value = state.myOrgs.value[0].workspaces[0]
    state.activeOrg.value = state.myOrgs.value[0]
    await render()
    expect(popup().querySelector('.ws-footer a').getAttribute('href')).toBe('/org/example-team/settings')
    button('New workspace').click(); await flushPromises()
    expect(document.querySelector('.ws-modal-title').textContent).toBe('New Workspace')
    expect(actions.createWorkspace).not.toHaveBeenCalled()
    document.querySelector('.ws-btn-cancel').click(); await flushPromises()
    await wrapper.get('.ws-trigger').trigger('click'); await flushPromises()
    button('Personal mode').click(); await flushPromises()
    expect(actions.clearWorkspace).toHaveBeenCalledOnce()
    expect(actions.push).toHaveBeenCalledWith('/')
    state.error.value = 'request failed'
    await wrapper.get('.ws-trigger').trigger('click'); await flushPromises()
    expect(popup().querySelector('[role="alert"]').textContent).toContain('Could not load')
    expect(popup().textContent).not.toContain('Create an organization to get started')
    button('Try again').click(); await flushPromises()
    expect(actions.loadMyOrgs).toHaveBeenCalledOnce()
  })
})
