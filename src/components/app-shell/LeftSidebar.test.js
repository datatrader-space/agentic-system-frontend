// @vitest-environment jsdom
//
// Video Studio is its own dashboard inside the app, reached from the main side navigation (owner, 2026-10-19).
// The chat composer has no video mode, so this link is the one way in.
import { describe, it, expect } from 'vitest'
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

async function mountAt(path) {
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
  return mount(LeftSidebar, { props: { forceExpanded: true }, global: { plugins: [router], stubs } })
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
