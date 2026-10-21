// @vitest-environment jsdom
//
// Video Studio is its own dashboard inside the app, reached from the main side navigation (owner, 2026-10-19).
// The chat composer has no video mode, so this link is the one way in.
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import LeftSidebar from './LeftSidebar.vue'
import { useLayoutStore } from '../../stores/useLayoutStore'

const Blank = { template: '<div />' }
const stubs = {
  BrandMark: Blank,
  SidebarProjects: Blank,
  NotificationBell: Blank,
  WorkspaceSwitcher: Blank,
}

async function mountAt(path, provide = {}, props = { forceExpanded: true }) {
  setActivePinia(createPinia())
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard/:rest(.*)*', component: Blank },
      { path: '/video-studio/:rest(.*)*', component: Blank },
      { path: '/admin-dashboard', component: Blank },
    ],
  })
  router.push(path)
  await router.isReady()
  return mount(LeftSidebar, { props, global: { plugins: [router], stubs, provide } })
}

const videoLink = (w) => w.findAll('nav[aria-label="Primary"] a').find((a) => a.text().includes('Video Studio'))

describe('LeftSidebar: Video Studio', () => {
  it('links to the Video Studio dashboard', async () => {
    const w = await mountAt('/dashboard')
    const a = videoLink(w)
    expect(a).toBeTruthy()
    expect(a.attributes('href')).toBe('/video-studio')
    expect(a.classes()).not.toContain('active')
    w.unmount()
  })

  it('is active on every Video Studio page', async () => {
    for (const path of ['/video-studio', '/video-studio/projects', '/video-studio/library', '/video-studio/ingredients']) {
      const w = await mountAt(path)
      expect(videoLink(w).classes()).toContain('active')
      w.unmount()
    }
  })
})

// The dropdown must reuse the injected, backend-connected logout; opening it never signs out.
describe('LeftSidebar: account', () => {
  it('shows the signed-in email and forwards explicit sign-out to the existing handler', async () => {
    const logout = vi.fn()
    const w = await mountAt('/dashboard', { currentUser: ref({ username: 'Reviewer', email: 'reviewer@example.test' }), logout })
    const trigger = w.get('[aria-haspopup="menu"]')
    expect(trigger.text()).toContain('reviewer@example.test')
    await trigger.trigger('click')
    expect(logout).not.toHaveBeenCalled()
    const button = [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.trim() === 'Log out')
    button.click()
    expect(logout).toHaveBeenCalledTimes(1)
    w.unmount()
  })
})

describe('LeftSidebar: settings modal', () => {
  it('opens compact settings over the current page instead of navigating away', async () => {
    const openSettings = vi.fn()
    const w = await mountAt('/dashboard/chat/new', { openSettings })
    await w.get('[aria-haspopup="menu"]').trigger('click')
    const button = [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.trim() === 'Settings')
    button.click()
    expect(openSettings).toHaveBeenCalledWith('general')
    expect(w.vm.$router.currentRoute.value.path).toBe('/dashboard/chat/new')
    w.unmount()
  })
})

describe('LeftSidebar: compact navigation', () => {
  it('keeps everyday destinations and removes settings duplicates from the primary sidebar', async () => {
    const w = await mountAt('/dashboard/chat/new')
    const links = w.findAll('nav[aria-label="Primary"] a').map(link => link.attributes('href'))
    for (const path of ['connectors', 'integrations', 'budgets', 'organization', 'settings/general', 'help-center']) expect(links).not.toContain(`/dashboard/${path}`)
    for (const path of ['agents', 'assets', 'knowledge', 'workflow-builder', 'schedules', 'activity']) expect(links).toContain(`/dashboard/${path}`)
    expect(w.find('[aria-label="Take a tour"]').exists()).toBe(false)
    await w.get('[aria-haspopup="menu"]').trigger('click')
    const plans = [...document.querySelectorAll('[role="menuitem"]')].find(item => item.textContent.trim() === 'Plans & billing')
    expect(plans).toBeTruthy()
    w.unmount()
  })

  it('keeps Admin restricted after the navigation cleanup', async () => {
    const w = await mountAt('/dashboard', { currentUser: ref({ username: 'Member', is_staff: false }) })
    expect(w.find('a[href="/admin-dashboard"]').exists()).toBe(false)
    w.unmount()
  })
})


describe('LeftSidebar: refreshed navigation modes', () => {
  it('preserves accessible navigation and profile access in collapsed mode', async () => {
    const w = await mountAt('/dashboard/agents', {}, { forceExpanded: false })
    const layout = useLayoutStore()
    layout.sidebarCollapsed = true
    await w.vm.$nextTick()
    expect(w.classes()).toContain('collapsed')
    const agents = w.get('a[aria-label="Agents"]')
    expect(agents.attributes('aria-current')).toBe('page')
    expect(agents.find('svg.lucide-bot').exists()).toBe(true)
    expect(w.get('a[aria-label="Training Data"]').attributes('href')).toBe('/dashboard/training-data/')
    expect(w.find('[aria-haspopup="menu"]').exists()).toBe(true)
    expect(w.find('.nav-label').exists()).toBe(false)
    w.unmount()
  })

  it('keeps the mobile drawer expanded and staff-only Admin reachable', async () => {
    const w = await mountAt('/dashboard', { currentUser: ref({ is_staff: true }) })
    useLayoutStore().sidebarCollapsed = true
    await w.vm.$nextTick()
    expect(w.classes()).not.toContain('collapsed')
    expect(w.get('a[href="/admin-dashboard"]').text()).toContain('Admin')
    expect(w.find('[aria-label="Collapse sidebar"]').exists()).toBe(false)
    w.unmount()
  })
})
