// @vitest-environment jsdom
// A page with its own one header row on a phone (Let's Code's editor, ADM-1330) asks the shell not to draw the app's top
// bar (`layout.immersive`); the page's back control returns to where the bar is drawn again. Every other page, and
// the same page on a wide screen, keep the bar.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const route = reactive({ name: 'dashboard-lets-code', path: '/dashboard/lets-code', fullPath: '/dashboard/lets-code', meta: {}, query: {} })
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('../../composables/useHelpAssistant', () => ({ useHelpAssistant: () => ({ state: { open: false } }) }))
import AppShell from './AppShell.vue'
import { useLayoutStore } from '../../stores/useLayoutStore'

const stubs = {
  LeftSidebar: true, MobileSidebarDrawer: true, MeshBackground: true, CommandPalette: true, FeatureTour: true,
  GuidedTourOverlay: true, GlobalHelpAssistant: true, AppBreadcrumbs: { name: 'AppBreadcrumbs', template: '<nav class="crumbs" />' },
  BrandMark: true, RouterView: true, 'router-view': true, SettingsModal: true,
}
beforeEach(() => {
  setActivePinia(createPinia())
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

describe("the app's top bar", () => {
  it('is drawn by default, and not while a page asks for its own header row', async () => {
    const w = mount(AppShell, { global: { stubs } })
    expect(w.find('.compact-bar').exists()).toBe(true)
    expect(w.findComponent({ name: 'AppBreadcrumbs' }).exists()).toBe(true)
    useLayoutStore().setImmersive(true)
    await nextTick()
    expect(w.find('.compact-bar').exists()).toBe(false)
    expect(w.findComponent({ name: 'AppBreadcrumbs' }).exists()).toBe(false)
    useLayoutStore().setImmersive(false)
    await nextTick()
    expect(w.find('.compact-bar').exists()).toBe(true)
    w.unmount()
  })
})
