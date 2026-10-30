// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AdminShell from './AdminShell.vue'
import { adminItems, adminGroups, adminSection } from './adminNavigation'
const api = vi.hoisted(() => ({ getCurrentUser: vi.fn(), checkAuth: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))
let wrapper
beforeEach(() => { localStorage.clear(); api.getCurrentUser.mockResolvedValue({ data: { user: { email: 'admin@example.test' } } }); vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))) })
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })
async function render(path='/admin-dashboard/billing') { const router=createRouter({ history:createMemoryHistory(), routes:[{path:'/:pathMatch(.*)*',component:{template:'<div class="admin-page"><h1>Test page</h1></div>'}}] }); await router.push(path); await router.isReady(); wrapper=mount(AdminShell,{attachTo:document.body,global:{plugins:[router]}}); await flushPromises(); return router }
describe('Admin workspace navigation', () => {
  it('places every navigation page in exactly one group and retains nested route context', () => {
    const grouped=adminGroups.flatMap(g=>g.paths)
    expect(new Set(grouped).size).toBe(adminItems.length)
    expect(grouped.sort()).toEqual(adminItems.map(i=>i.key).sort())
    expect(adminSection('/admin-dashboard/agents/7/editor').key).toBe('builtin-agents')
    expect(adminSection('/admin-dashboard/partner-keys/guide').key).toBe('partner-keys')
    expect(adminSection('/admin-dashboard/help-content').key).toBe('help-center')
  })
  it('searches descriptions and keeps direct links', async () => {
    await render()
    await wrapper.get('input[type=search]').setValue('prepaid')
    const links=wrapper.findAll('.admin-nav a')
    expect(links).toHaveLength(1)
    expect(links[0].attributes('href')).toBe('/admin-dashboard/billing')
    await wrapper.get('input[type=search]').setValue('does-not-exist')
    expect(wrapper.find('.admin-nav-empty').exists()).toBe(true)
    await wrapper.get('.admin-nav-empty button').trigger('click')
    expect(wrapper.findAll('.admin-nav a')).toHaveLength(adminItems.length)
  })
  it('remembers local theme and sidebar preferences without an API write', async () => {
    await render()
    await wrapper.get('[aria-label="Collapse sidebar"]').trigger('click')
    expect(wrapper.classes()).toContain('is-collapsed')
    expect(localStorage.getItem('aadml-admin-sidebar')).toBe('collapsed')
    await wrapper.get('[aria-label="Use dark theme"]').trigger('click')
    expect(wrapper.attributes('data-admin-theme')).toBe('dark')
    expect(localStorage.getItem('aadml-admin-theme')).toBe('dark')
    expect(api.checkAuth).not.toHaveBeenCalled()
  })
  it('opens the mobile drawer, focuses search, and closes on Escape or navigation', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    const router=await render()
    expect(wrapper.get('aside').attributes('inert')).toBeDefined()
    await wrapper.get('[aria-label="Open navigation"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('aside').classes()).toContain('open')
    expect(document.activeElement).toBe(wrapper.get('input[type=search]').element)
    await wrapper.trigger('keydown', { key:'Escape' })
    expect(wrapper.find('.admin-backdrop').exists()).toBe(false)
    await wrapper.get('[aria-label="Open navigation"]').trigger('click')
    await router.push('/admin-dashboard/operations'); await flushPromises()
    expect(wrapper.find('.admin-backdrop').exists()).toBe(false)
    expect(wrapper.get('.admin-location strong').text()).toBe('Operations')
  })
})
