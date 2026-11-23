// @vitest-environment jsdom
// Let's Code on a phone (ADM-1330): a project opens in the light view on a narrow screen, the editor elsewhere; the
// person's own choice is kept on the device, and `?view=` names one for a visit.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const route = reactive({ query: {}, params: {} })
const replace = vi.fn((to) => { route.query = to.query || {} })
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ replace, push: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}))
vi.mock('../services/api', () => {
  const calls = {}
  const api = new Proxy(calls, {
    get(t, k) {
      if (k === 'listProjects') {
        return (t[k] ||= vi.fn(() => Promise.resolve({ data: { projects: [{ repo_id: 14, system_id: 5, name: 'shop', phase: 'ready' }] } })))
      }
      return (t[k] ||= vi.fn(() => Promise.resolve({ data: {} })))
    },
  })
  return { default: api }
})

import LetsCode from './LetsCode.vue'
import { setActivePinia, createPinia } from 'pinia'

let narrow = false
beforeEach(() => {
  setActivePinia(createPinia())
  route.query = { project: '14' }
  replace.mockClear()
  try { localStorage.clear() } catch { /* */ }
  window.matchMedia = vi.fn((q) => ({ matches: narrow && q.includes('640'), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(() => { delete window.matchMedia; narrow = false })

const LetsCodeLight = { name: 'LetsCodeLight', props: ['project', 'ready', 'chatId', 'theme'], emits: ['full-editor', 'back', 'chat-opened'],
  template: '<div class="light-stub" @click="$emit(\'full-editor\')" />' }
function mountPage() {
  return mount(LetsCode, { global: { stubs: {
    Icon: true, LetsCodeLight,
    CodeBrowser: true, UnifiedAgentChat: true, BottomPanel: true, DeployButton: true, ProjectCommands: true,
    ProjectEnv: true, PipelineStepper: true, StatusPill: true, 'router-link': true,
  } } })
}

describe('the phone view or the full editor', () => {
  it('a narrow screen opens the project in the light view', async () => {
    narrow = true
    const w = mountPage()
    await flushPromises()
    expect(w.find('.light-stub').exists()).toBe(true)
    expect(w.find('.lc-ide').exists()).toBe(false)
    w.unmount()
  })

  it('a wide screen opens the editor', async () => {
    const w = mountPage()
    await flushPromises()
    expect(w.find('.lc-ide').exists()).toBe(true)
    expect(w.find('.light-stub').exists()).toBe(false)
    w.unmount()
  })

  it('"Full editor" switches to the editor and is remembered on the device', async () => {
    narrow = true
    const w = mountPage()
    await flushPromises()
    await w.find('.light-stub').trigger('click')
    await flushPromises()
    expect(w.find('.lc-ide').exists()).toBe(true)
    expect(localStorage.getItem('lc.view')).toBe('editor')
    w.unmount()
  })

  it('the editor\'s Phone view switches back', async () => {
    narrow = true
    localStorage.setItem('lc.view', 'editor')
    const w = mountPage()
    await flushPromises()
    expect(w.find('.lc-ide').exists()).toBe(true)
    await w.find('[data-test="ide-phone-view"]').trigger('click')
    await flushPromises()
    expect(w.find('.light-stub').exists()).toBe(true)
    expect(localStorage.getItem('lc.view')).toBe('light')
    w.unmount()
  })

  it('?view=light names the light view for a visit, on any screen', async () => {
    route.query = { project: '14', view: 'light' }
    const w = mountPage()
    await flushPromises()
    expect(w.find('.light-stub').exists()).toBe(true)
    w.unmount()
  })
})
