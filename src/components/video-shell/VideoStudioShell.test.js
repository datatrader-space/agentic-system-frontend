// @vitest-environment jsdom
//
// Video Studio's own dashboard (owner, 2026-10-19): its side navigation, the way back to AADML, and the
// grading-suite palette it puts on <body> while it is open (so drawers and dialogs it opens take it too).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../../services/api', () => ({ default: { checkAuth: vi.fn(() => Promise.resolve({ data: { user: { email: 'maker@example.com' } } })) } }))

import VideoStudioShell from './VideoStudioShell.vue'
import { useChatStore } from '../../stores/useChatStore'

const Blank = { template: '<div />' }
async function mountAt(path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/video-studio', component: VideoStudioShell, children: [
        { path: '', component: Blank }, { path: 'projects', component: Blank },
        { path: 'library', component: Blank }, { path: 'ingredients', component: Blank }, { path: 'help', component: Blank }] },
      { path: '/dashboard/:rest(.*)*', component: Blank },
    ],
  })
  router.push(path)
  await router.isReady()
  const w = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => { setActivePinia(createPinia()); document.body.classList.remove('vs-theme') })

describe('VideoStudioShell', () => {
  it('marks the current page in its navigation', async () => {
    const { w } = await mountAt('/video-studio/library')
    expect(w.get('[data-test="vs-nav-library"]').attributes('aria-current')).toBe('page')
    expect(w.get('[data-test="vs-nav-create"]').attributes('aria-current')).toBeUndefined()
    expect(w.get('[data-test="vs-nav-help"]').attributes('href')).toBe('/video-studio/help')
    w.unmount()
  })

  it('goes back to the conversation the video belongs to, else to a new chat', async () => {
    const chat = useChatStore()
    chat.conversationId = 'c42'
    const { w } = await mountAt('/video-studio')
    expect(w.get('[data-test="vs-back"]').attributes('href')).toBe('/dashboard/chat/c42')
    w.unmount()
    chat.conversationId = null
    const again = await mountAt('/video-studio')
    expect(again.w.get('[data-test="vs-back"]').attributes('href')).toBe('/dashboard/chat/new')
    again.w.unmount()
  })

  it('puts its palette on <body> while open and removes it when left', async () => {
    const { w } = await mountAt('/video-studio')
    expect(document.body.classList.contains('vs-theme')).toBe(true)
    w.unmount()
    expect(document.body.classList.contains('vs-theme')).toBe(false)
  })

  it('shows the signed-in account without arrows or taglines in its chrome', async () => {
    const { w } = await mountAt('/video-studio')
    expect(w.text()).toContain('maker@example.com')
    expect(w.text()).not.toMatch(/[←→·]/)
    w.unmount()
  })
})
