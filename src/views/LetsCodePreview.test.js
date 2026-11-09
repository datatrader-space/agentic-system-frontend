// @vitest-environment jsdom
// AADML's Let's Code preview page (owner, 2026-11-09): every visit asks for a fresh link to the person's own
// project's app, waits while the sandbox wakes or the app starts again, then forwards to it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'

const route = { params: { repoId: '14', port: '3000' } }
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('@/services/api', () => ({ default: { getProjectPreview: vi.fn() } }))

import api from '@/services/api'
import LetsCodePreview from './LetsCodePreview.vue'

const fail = (status, data) => Object.assign(new Error(String(status)), { response: { status, data } })
const SIGNED = 'https://3000-k3j9x2signedtoken.proxy.sandbox.aadml.com'

function mountPage() {
  return mount(LetsCodePreview, { global: { stubs: { Icon: true, 'router-link': RouterLinkStub } } })
}

describe('LetsCodePreview', () => {
  let replace
  beforeEach(() => {
    vi.useFakeTimers()
    api.getProjectPreview.mockReset()
    route.params = { repoId: '14', port: '3000' }
    replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('forwards to the fresh link for that project and port', async () => {
    api.getProjectPreview.mockResolvedValue({ data: { url: SIGNED } })
    const w = mountPage()
    await flushPromises()
    expect(api.getProjectPreview).toHaveBeenCalledWith(14, 3000)
    expect(replace).toHaveBeenCalledWith(SIGNED)
    w.unmount()
  })

  it('waits while the sandbox wakes and the app starts again, saying which', async () => {
    api.getProjectPreview
      .mockRejectedValueOnce(fail(503, { code: 'RUNNER_STARTING', retry_after_seconds: 10 }))
      .mockRejectedValueOnce(fail(503, { code: 'APP_STARTING', retry_after_seconds: 5 }))
      .mockResolvedValueOnce({ data: { url: SIGNED } })
    const w = mountPage()
    await flushPromises()
    expect(w.text()).toContain('Waking your project')
    await vi.advanceTimersByTimeAsync(10000)
    await flushPromises()
    expect(w.text()).toContain('Starting the app again')
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(replace).toHaveBeenCalledWith(SIGNED)
    expect(api.getProjectPreview).toHaveBeenCalledTimes(3)
    w.unmount()
  })

  it('another person\'s project is not theirs, and is not retried', async () => {
    api.getProjectPreview.mockRejectedValue(fail(404, { error: 'Project not found.' }))
    const w = mountPage()
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain('not one of your projects')
    expect(w.find('.lcp-btn-primary').exists()).toBe(false)
    expect(replace).not.toHaveBeenCalled()
    w.unmount()
  })

  it('says what AADML said when the app cannot be started, and can try again', async () => {
    api.getProjectPreview.mockRejectedValueOnce(fail(409, { error: 'The app did not start again. Ask the Coding Agent to look at why it stops.' }))
    const w = mountPage()
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain('did not start again')
    api.getProjectPreview.mockResolvedValueOnce({ data: { url: SIGNED } })
    await w.find('.lcp-btn-primary').trigger('click')
    await flushPromises()
    expect(replace).toHaveBeenCalledWith(SIGNED)
    w.unmount()
  })

  it('an incomplete link asks for nothing', async () => {
    route.params = { repoId: '14', port: 'x' }
    const w = mountPage()
    await flushPromises()
    expect(api.getProjectPreview).not.toHaveBeenCalled()
    expect(w.text()).toContain('not complete')
    w.unmount()
  })
})
