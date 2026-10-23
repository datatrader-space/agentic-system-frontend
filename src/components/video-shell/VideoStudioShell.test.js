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
import { STUDIO_GROUPS, studioFeatures, featureLink } from '../../services/studioFeatures'
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

beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); document.body.classList.remove('vs-theme') })

describe('VideoStudioShell', () => {
  it('marks the current page in its navigation', async () => {
    const { w } = await mountAt('/video-studio/library')
    expect(w.get('[data-test="vs-nav-library"]').attributes('aria-current')).toBe('page')
    expect(w.get('[data-test="vs-nav-home"]').attributes('aria-current')).toBeUndefined()
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


describe('F0 grouped navigation', () => {
  it('renders every feature and group from the one catalog, with honest status pills', async () => {
    const { w } = await mountAt('/video-studio')
    for (const feature of studioFeatures.value) {
      const link = w.get(`[data-test="vs-nav-${feature.id}"]`)
      expect(link.attributes('href')).toBe(featureLink(feature))
      if (feature.status === 'soon') expect(link.text()).toContain('Soon')
      if (feature.status === 'beta') expect(link.text()).toContain('Beta')
    }
    for (const group of STUDIO_GROUPS.filter(group => group !== 'Home')) expect(w.findAll('.vs-group-toggle').some(button => button.text() === group)).toBe(true)
    w.unmount()
  })
  it('remembers group choices, and keeps working if localStorage is blocked', async () => {
    const { w } = await mountAt('/video-studio')
    const create = w.findAll('.vs-group-toggle').find(button => button.text() === 'Create')
    await create.trigger('click')
    expect(JSON.parse(localStorage.getItem('aadml.studio.navigation.groups')).Create).toBe(false)
    w.unmount()
    const read = vi.spyOn(Storage.prototype,'getItem').mockImplementation(() => { throw new Error('blocked') })
    const write = vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new Error('blocked') })
    const again = await mountAt('/video-studio')
    expect(again.w.get('[data-test="vs-nav-image"]').attributes('href')).toBe('/video-studio/image')
    await again.w.findAll('.vs-group-toggle')[0].trigger('click')
    again.w.unmount(); read.mockRestore(); write.mockRestore()
  })
})

it('keeps ordered tool groups above a fixed Library, Projects, Help and Recent chats block', async () => {
  const { w } = await mountAt('/video-studio')
  expect(w.findAll('.vs-group-toggle').map(b => b.text())).toEqual(['Create','Edit & enhance','Characters','Video tools','Avatars & shorts','Story','Marketing','Workspace'])
  expect(w.findAll('.vs-fixed-workspace > a').map(a => a.text())).toEqual(['Library','Projects','Help'])
  expect(w.findAll('.vs-group').find(g => g.text().includes('Characters')).findAll('.vs-nav-item').map(a => a.attributes('data-test'))).toEqual(['vs-nav-elements','vs-nav-characters','vs-nav-identity-training'])
  w.unmount()
})
