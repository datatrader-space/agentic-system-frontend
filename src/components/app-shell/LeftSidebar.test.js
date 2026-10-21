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

const Blank = { template: '<div />' }
const stubs = {
  BrandMark: Blank,
  SidebarProjects: Blank,
  NotificationBell: Blank,
  WorkspaceSwitcher: Blank,
}

async function mountAt(path, provide = {}) {
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
  return mount(LeftSidebar, { props: { forceExpanded: true }, global: { plugins: [router], stubs, provide } })
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

describe('LeftSidebar: compact connection settings', () => {
  it('opens Connectors and Integrations from navigation without leaving the current page', async () => {
    const openSettings = vi.fn()
    const w = await mountAt('/dashboard/chat/new', { openSettings })
    for (const section of ['connectors', 'integrations']) {
      await w.get(`nav[aria-label="Primary"] a[href="/dashboard/${section}"]`).trigger('click', { button: 0 })
      expect(openSettings).toHaveBeenLastCalledWith(section)
      expect(w.vm.$router.currentRoute.value.path).toBe('/dashboard/chat/new')
    }
    openSettings.mockClear()
    await w.get('nav[aria-label="Primary"] a[href="/dashboard/connectors"]').trigger('click', { button: 0, ctrlKey: true })
    expect(openSettings).not.toHaveBeenCalled()
    w.unmount()
  })
})
