// @vitest-environment jsdom
// F-C2: the service modal's OAuth Connect used to never finish — onMounted called an undefined function,
// which threw before the result listener was added. These tests pin the fixed flow and the repair poller.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  getService: vi.fn(),
  getServiceRepairStatus: vi.fn(),
  getOAuthStatus: vi.fn(),
  startOAuth: vi.fn(),
  repairServiceSchemas: vi.fn(),
  getEnrichmentJobStatus: vi.fn(),
}))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api, clearApiCache: vi.fn() }))
vi.mock('@/services/api', () => ({ default: api, clearApiCache: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ notify }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import ServiceDetailModal from './ServiceDetailModal.vue'

const blank = { template: '<div />' }
let wrapper
let popup
beforeEach(() => {
  vi.clearAllMocks()
  popup = { closed: false, close: vi.fn(), location: { href: 'about:blank' } }
  vi.spyOn(window, 'open').mockImplementation(() => popup)
  api.getService.mockResolvedValue({ data: { id: 7, name: 'Svc', slug: 'svc', auth_type: 'oauth2', category: 'developer_tools', status: 'active', created_at: '2026-01-01T00:00:00Z', base_url: 'https://api.example', description: 'd', actions_by_group: {} } })
  api.getServiceRepairStatus.mockResolvedValue({ data: { pending: 0 } })
  api.getOAuthStatus.mockResolvedValue({ data: { connected: false } })
  api.startOAuth.mockResolvedValue({ data: { redirect_url: 'https://provider.example/authorize' } })
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.useRealTimers() })

function render(service = { id: 7, name: 'Svc' }) {
  wrapper = mount(ServiceDetailModal, {
    props: { service },
    global: { stubs: { Icon: blank, ServiceEditModal: blank, ServiceShareModal: blank } },
  })
  return wrapper
}

describe('ServiceDetailModal OAuth connect (F-C2)', () => {
  it('mounts without throwing and loads the service itself from just an id + name', async () => {
    const w = render()
    expect(w.text()).toContain('Svc')        // the header shows the row's name while loading
    await flushPromises()
    expect(api.getService).toHaveBeenCalledWith(7)
    expect(api.getServiceRepairStatus).toHaveBeenCalledWith(7)
    expect(w.text()).toContain('Connect Your Account')
  })

  it('opens the popup inside the click and finishes when the result message arrives', async () => {
    const w = render()
    await flushPromises()
    const btn = w.findAll('button').find((b) => b.text().includes('Connect Your Account'))
    await btn.trigger('click')
    expect(window.open).toHaveBeenCalledWith('about:blank', 'oauth_popup', expect.any(String))
    await flushPromises()
    expect(popup.location.href).toBe('https://provider.example/authorize')
    expect(w.text()).toContain('Connecting...')

    api.getOAuthStatus.mockResolvedValue({ data: { connected: true } })
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'oauth_result', status: 'success' }, origin: window.location.origin }))
    await flushPromises()
    expect(w.text()).not.toContain('Connecting...')
    expect(w.text()).toContain('Connected')
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('a closed popup ends the busy state (server says not connected)', async () => {
    vi.useFakeTimers()
    const w = render()
    await flushPromises()
    const btn = w.findAll('button').find((b) => b.text().includes('Connect Your Account'))
    await btn.trigger('click')
    await flushPromises()
    popup.closed = true
    await vi.advanceTimersByTimeAsync(1200)
    await flushPromises()
    expect(w.text()).not.toContain('Connecting...')
    expect(notify.error).toHaveBeenCalledWith(expect.stringMatching(/closed/))
  })
})

describe('ServiceDetailModal schema repair poller', () => {
  it('keeps polling after one failed read and stops on done (one toast)', async () => {
    vi.useFakeTimers()
    api.getServiceRepairStatus.mockResolvedValue({ data: { pending: 3 } })
    api.repairServiceSchemas.mockResolvedValue({ data: { job_id: 'j1', pending: 3 } })
    api.getEnrichmentJobStatus
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: { state: 'running', done: 1, total: 3, percent: 33 } })
      .mockResolvedValue({ data: { state: 'done', done: 3, total: 3, enriched_by_llm: 3 } })
    const w = render()
    await flushPromises()
    const btn = w.findAll('button').find((b) => /Enrich|Write/i.test(b.text()) && !b.text().includes('Connect'))
    await btn.trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)   // first read fails
    await vi.advanceTimersByTimeAsync(4000)   // backed-off retry: running
    await vi.advanceTimersByTimeAsync(2000)   // done
    await flushPromises()
    expect(api.getEnrichmentJobStatus).toHaveBeenCalledTimes(3)
    expect(notify.success).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(20000)
    expect(api.getEnrichmentJobStatus).toHaveBeenCalledTimes(3)
  })

  it('stops polling when the modal closes', async () => {
    vi.useFakeTimers()
    api.getServiceRepairStatus.mockResolvedValue({ data: { pending: 3 } })
    api.repairServiceSchemas.mockResolvedValue({ data: { job_id: 'j1', pending: 3 } })
    api.getEnrichmentJobStatus.mockResolvedValue({ data: { state: 'running', done: 1, total: 3 } })
    const w = render()
    await flushPromises()
    const btn = w.findAll('button').find((b) => /Enrich|Write/i.test(b.text()) && !b.text().includes('Connect'))
    await btn.trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)
    const calls = api.getEnrichmentJobStatus.mock.calls.length
    w.unmount(); wrapper = null
    await vi.advanceTimersByTimeAsync(20000)
    expect(api.getEnrichmentJobStatus.mock.calls.length).toBe(calls)
  })
})
