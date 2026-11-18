// @vitest-environment jsdom
// Let's Code's "Clone by address" button (ADM-1128, 2026-11-17): idle with the box empty it said "Cloning" with a
// spinner (it compared two empty strings). It now follows the form's own clone.
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, params: {} }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}))
// Every API call answers an empty success, except creating a project, which the test holds open.
let releaseCreate = null
vi.mock('../services/api', () => {
  const calls = {}
  const api = new Proxy(calls, {
    get(t, k) {
      if (k === 'githubListRepos') {      // a connected GitHub account: the clone form is shown
        return (t[k] ||= vi.fn(() => Promise.resolve({ data: { success: true, repositories: [], account: 'ana' } })))
      }
      if (k === 'createProject') {
        return (t[k] ||= vi.fn(() => new Promise((resolve, reject) => {
          releaseCreate = (ok) => (ok ? resolve({ data: { repo_id: 99, name: 'shop' } })
            : reject(Object.assign(new Error('409'), { response: { data: { error: 'That repository is already a project.' } } })))
        })))
      }
      return (t[k] ||= vi.fn(() => Promise.resolve({ data: {} })))
    },
  })
  return { default: api }
})

import api from '../services/api'
import LetsCode from './LetsCode.vue'

function mountPage() {
  return mount(LetsCode, { global: { stubs: {
    Icon: true,
    CodeBrowser: true, UnifiedAgentChat: true, BottomPanel: true, DeployButton: true, ProjectCommands: true,
    ProjectEnv: true, PipelineStepper: true, StatusPill: true, 'router-link': true,
  } } })
}
const button = (w) => w.find('form.lc-byurl button[type="submit"]')

describe('Clone by address', () => {
  it('idle with the box empty, it says Clone, not Cloning', async () => {
    const w = mountPage()
    await flushPromises()
    expect(button(w).text()).toBe('Clone')
    expect(button(w).attributes('disabled')).toBeDefined()           // nothing typed yet
    w.unmount()
  })

  it('says Cloning while its clone runs, and Clone again when it ends without a project', async () => {
    const w = mountPage()
    await flushPromises()
    await w.find('#lc-url').setValue('https://github.com/acme/shop')
    expect(button(w).text()).toBe('Clone')
    await w.find('form.lc-byurl').trigger('submit')
    await flushPromises()
    expect(api.createProject).toHaveBeenCalledTimes(1)
    expect(button(w).text()).toBe('Cloning')
    releaseCreate(false)
    await flushPromises()
    expect(button(w).text()).toBe('Clone')
    expect(w.find('.lc-byurl-err').text()).toBe('That repository is already a project.')
    w.unmount()
  })

  it('a clone that succeeds opens the new project', async () => {
    const w = mountPage()
    await flushPromises()
    await w.find('#lc-url').setValue('https://github.com/acme/shop')
    await w.find('form.lc-byurl').trigger('submit')
    await flushPromises()
    releaseCreate(true)
    await flushPromises()
    expect(w.find('form.lc-byurl').exists()).toBe(false)              // the landing gave way to the project
    w.unmount()
  })
})
