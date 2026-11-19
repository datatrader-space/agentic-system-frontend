// @vitest-environment jsdom
//
// Video Studio's own dashboard (owner, 2026-10-19): its side navigation, the way back to AADML, and the
// grading-suite palette it puts on <body> while it is open (so drawers and dialogs it opens take it too).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../../services/api', () => ({ default: { checkAuth: vi.fn(() => Promise.resolve({ data: { user: { email: 'maker@example.com' } } })), getStudioFeatures: vi.fn(() => Promise.resolve({ data: { features: [] } })),
  get: vi.fn(path => Promise.resolve({ data: path === '/video/templates/' ? { templates: [{ id: 1, page: 'image', title: 'One', prompt: 'p' }, { id: 2, page: 'music', title: 'Two', prompt: 'q' }] } : { favorite_looks: ['image-look-1'] } })) } }))
import api from '../../services/api'

import VideoStudioShell from './VideoStudioShell.vue'
import { STUDIO_GROUPS, studioFeatures, featureLink } from '../../services/studioFeatures'
import { useChatStore } from '../../stores/useChatStore'

const Blank = { template: '<div />' }
async function mountAt(path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard/video-studio', component: VideoStudioShell, children: [
        { path: '', component: Blank }, { path: 'projects', component: Blank },
        { path: 'library', component: Blank }, { path: 'ingredients', component: Blank }, { path: 'help', component: Blank },
        { path: 'team-spend', component: Blank, meta: { studioFeature: 'team-spend' } },
        { path: 'projects/:projectId', component: Blank, meta: { studioFeature: 'projects' } }] },
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
  it("names Team spend and a project's room in the top bar, not Discover", async () => {
    for (const [path, title] of [['/dashboard/video-studio/team-spend', 'Team spend'], ['/dashboard/video-studio/projects/p1', 'Projects'],
                                 ['/dashboard/video-studio/library', 'Library'], ['/dashboard/video-studio', 'Discover']]) {
      const { w } = await mountAt(path)
      expect(w.findComponent({ name: 'StudioWorkspaceBar' }).props('title')).toBe(title)
      w.unmount()
    }
  })
  it('marks the current page in its navigation', async () => {
    const { w } = await mountAt('/dashboard/video-studio/library')
    expect(w.get('[data-test="vs-nav-library"]').attributes('aria-current')).toBe('page')
    expect(w.get('[data-test="vs-nav-home"]').attributes('aria-current')).toBeUndefined()
    expect(w.get('[data-test="vs-nav-help"]').attributes('href')).toBe('/dashboard/video-studio/help')
    w.unmount()
  })

  it('puts "Back to AADML Dashboard" first in its menu on every page, going to the main dashboard (CR-1)', async () => {
    const chat = useChatStore()
    chat.conversationId = 'c42'
    for (const path of ['/dashboard/video-studio', '/dashboard/video-studio/library', '/dashboard/video-studio/team-spend']) {
      const { w } = await mountAt(path)
      const back = w.get('[data-test="vs-back"]')
      expect(back.attributes('href')).toBe('/dashboard')
      expect(back.text()).toBe('Back to AADML Dashboard')
      expect(back.find('svg').attributes('aria-hidden')).toBe('true')
      // First in the side menu (on a phone, the first thing in the menu drawer), outside any dialog.
      expect(w.get('#vs-sidebar').element.querySelector('a')).toBe(back.element)
      expect(back.element.closest('dialog')).toBeNull()
      w.unmount()
    }
    chat.conversationId = null
  })

  it('shows people no internal design links (ISSUE-2)', async () => {
    const { w } = await mountAt('/dashboard/video-studio')
    expect(w.html()).not.toContain('chatgpt.site')
    expect(w.html()).not.toContain('Approved design reference')
    w.unmount()
    const src = (await import('./VideoStudioShell.vue?raw')).default
    expect(src).not.toContain('chatgpt.site')
  })

  it('puts its palette on <body> while open and removes it when left', async () => {
    const { w } = await mountAt('/dashboard/video-studio')
    expect(document.body.classList.contains('vs-theme')).toBe(true)
    w.unmount()
    expect(document.body.classList.contains('vs-theme')).toBe(false)
  })

  it('sets a dark color-scheme and theme-color while open, restores the light page after (plan section 3 item 7)', async () => {
    const meta = document.createElement('meta'); meta.name = 'theme-color'; meta.content = '#ffffff'; document.head.appendChild(meta)
    document.documentElement.style.colorScheme = ''
    const { w } = await mountAt('/dashboard/video-studio')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(meta.getAttribute('content')).toBe('#101216')
    w.unmount()
    expect(document.documentElement.style.colorScheme).toBe('')
    expect(meta.getAttribute('content')).toBe('#ffffff')
    meta.remove()
  })

  it('gives every reachable control in the Studio a visible keyboard focus ring (plan section 3 item 7)', async () => {
    const src = (await import('./VideoStudioShell.vue?raw')).default
    const rule = src.match(/body\.vs-theme :where\(([^)]*(?:\([^)]*\)[^)]*)*)\):focus-visible\{([^}]*)\}/)
    expect(rule).toBeTruthy()
    for (const target of ['button', 'a[href]', 'select', '[role="tab"]', '[role="switch"]', '[tabindex]:not([tabindex="-1"])']) expect(rule[1]).toContain(target)
    expect(rule[2]).toContain('outline:2px solid var(--vs-accent-ink)')
  })

  it('shows the signed-in account without arrows or taglines in its chrome', async () => {
    const { w } = await mountAt('/dashboard/video-studio')
    expect(w.find('.vs-workspace-switch').exists()).toBe(true)
    expect(w.get('.vs-foot').text()).not.toMatch(/[←→·]/)
    w.unmount()
  })
})


describe('F0 grouped navigation', () => {
  it('renders every feature and group from the one catalog, with honest status pills', async () => {
    const { w } = await mountAt('/dashboard/video-studio')
    for (const feature of studioFeatures.value) {
      const link = w.get(`[data-test="vs-nav-${feature.id}"]`)
      expect(link.attributes('href')).toBe(featureLink(feature))
      if (feature.status === 'soon') expect(link.text()).toContain('Soon')
      if (feature.status === 'beta') expect(link.text()).toContain('Beta')
    }
    for (const group of STUDIO_GROUPS.filter(group => !['Home','Workspace'].includes(group))) expect(w.findAll('.vs-group-toggle').some(button => button.text() === group)).toBe(true)
    w.unmount()
  })
  it('remembers group choices, and keeps working if localStorage is blocked', async () => {
    const { w } = await mountAt('/dashboard/video-studio')
    const create = w.findAll('.vs-group-toggle').find(button => button.text() === 'Create')
    await create.trigger('click')
    expect(JSON.parse(localStorage.getItem('aadml.studio.navigation.v8.groups')).Create).toBe(true)
    w.unmount()
    const read = vi.spyOn(Storage.prototype,'getItem').mockImplementation(() => { throw new Error('blocked') })
    const write = vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new Error('blocked') })
    const again = await mountAt('/dashboard/video-studio')
    expect(again.w.get('[data-test="vs-nav-image"]').attributes('href')).toBe('/dashboard/video-studio/image')
    await again.w.findAll('.vs-group-toggle')[0].trigger('click')
    again.w.unmount(); read.mockRestore(); write.mockRestore()
  })
})

it('matches the approved workspace-first hierarchy without duplicated destinations', async () => {
  const { w } = await mountAt('/dashboard/video-studio')
  expect(w.findAll('.vs-group-toggle').map(b => b.text())).toEqual(['Create','Edit & enhance','Characters','Video tools','Avatars & shorts','Story','Marketing'])
  expect(w.findAll('.vs-workspace-nav > a').map(a => a.text())).toEqual(['Dashboard','Discover','Saved templates','My templates','Projects','Library','Canvas','Publish','Community','Team spend'])
  expect(w.find('.vs-fixed-workspace').exists()).toBe(false)
  expect(w.findAll('.vs-foot > a').map(a => a.text())).toEqual(['Help & shortcuts'])
  expect(w.findAll('.vs-nav-item[data-test="vs-nav-projects"]')).toHaveLength(1)
  expect(w.findAll('.vs-group-toggle').every(b => b.attributes('aria-expanded') === 'false')).toBe(true)
  expect(w.findAll('.vs-group').find(g => g.text().includes('Characters')).findAll('.vs-nav-item').map(a => a.attributes('data-test'))).toEqual(['vs-nav-characters','vs-nav-identity-training','vs-nav-elements'])
  w.unmount()
})

it('shows no count for Saved templates or My templates until they are read, never a false 0 (ISSUE-14)', async () => {
  const usual = api.get.getMockImplementation(), close = HTMLDialogElement.prototype.close
  HTMLDialogElement.prototype.close = function () {}
  // The signed-in person is known, but their saved looks and templates have not been read yet.
  api.checkAuth.mockResolvedValueOnce({ data: { user: { id: 41, email: 'maker@example.com' } } })
  api.get.mockImplementation(path => ['/video/templates/', '/video/preferences/'].includes(path) ? new Promise(() => {}) : usual(path))
  try {
    const { w } = await mountAt('/dashboard/video-studio')
    expect(w.find('[data-test="vs-saved-count"]').exists()).toBe(false)
    expect(w.find('[data-test="vs-templates-count"]').exists()).toBe(false)
    expect(w.get('[data-test="vs-nav-saved"]').text()).toBe('Saved templates')
    expect(w.get('[data-test="vs-nav-my-templates"]').text()).toBe('My templates')
    w.unmount()
  } finally { api.get.mockImplementation(usual); HTMLDialogElement.prototype.close = close }
})

it('marks a page the server says cannot run yet as "Not available yet" in the menu, and keeps it reachable (ISSUE-8)', async () => {
  const before = studioFeatures.value
  studioFeatures.value = before.map(f => f.id === 'motion' ? { ...f, ready: false, code: 'no_proven_model', reason: 'No model for this page has been proven yet.' } : f.id === 'image' ? { ...f, ready: true } : f)
  const { w } = await mountAt('/dashboard/video-studio')
  const motion = w.get('[data-test="vs-nav-motion"]')
  expect(motion.text()).toContain('Not available yet')
  expect(motion.attributes('href')).toBe('/dashboard/video-studio/motion')
  expect(w.find('[data-test="vs-nav-unavailable-motion"]').exists()).toBe(true)
  expect(w.get('[data-test="vs-nav-image"]').text()).not.toContain('Not available yet')
  w.unmount()
  studioFeatures.value = before
})

it('counts My templates in the sidebar and links to them next to Saved templates', async () => {
  // jsdom has no dialog methods; a signed-in person makes the workspace bar close its dialogs.
  const close = HTMLDialogElement.prototype.close
  HTMLDialogElement.prototype.close = function () {}
  api.checkAuth.mockResolvedValueOnce({ data: { user: { id: 41, email: 'maker@example.com' } } })
  const { w } = await mountAt('/dashboard/video-studio?view=looks&saved=1#my-templates')
  expect(api.get).toHaveBeenCalledWith('/video/templates/')
  const mine = w.get('[data-test="vs-nav-my-templates"]')
  expect(mine.text()).toBe('My templates2'); expect(mine.attributes('href')).toBe('/dashboard/video-studio?view=looks&saved=1#my-templates')
  expect(mine.attributes('aria-current')).toBe('page')
  expect(w.get('[data-test="vs-nav-saved"]').text()).toBe('Saved templates1'); expect(w.get('[data-test="vs-nav-saved"]').attributes('aria-current')).toBeUndefined()
  w.unmount(); HTMLDialogElement.prototype.close = close
})
