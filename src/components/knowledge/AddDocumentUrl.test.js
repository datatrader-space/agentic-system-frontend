// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { notify, addDocumentUrl, getDocumentSource } = vi.hoisted(() => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  addDocumentUrl: vi.fn(() => Promise.resolve({ data: { id: 1, source_name: 'x', source_type: 'url', status: 'queued' } })),
  getDocumentSource: vi.fn(() => Promise.resolve({ data: { id: 1, status: 'ready', source_name: 'x' } })),
}))
vi.mock('@/composables/useNotify', () => ({ notify }))
vi.mock('../../services/api', () => ({ default: { addDocumentUrl, getDocumentSource } }))

import AddDocumentUrl from './AddDocumentUrl.vue'

const stubs = { IndexStatusBadge: { template: '<span />' } }

beforeEach(() => { addDocumentUrl.mockClear(); notify.success.mockClear(); notify.error.mockClear(); notify.warning.mockClear() })

describe('AddDocumentUrl', () => {
  it('renders the URL input and submit button', () => {
    const w = mount(AddDocumentUrl, { global: { stubs } })
    expect(w.find('[data-test="adu-input"]').exists()).toBe(true)
    expect(w.find('[data-test="adu-submit"]').exists()).toBe(true)
  })

  it('submits a valid URL with scope + agent id', async () => {
    const w = mount(AddDocumentUrl, { props: { agentId: 42, scope: 'agent_knowledge' }, global: { stubs } })
    await w.find('[data-test="adu-input"]').setValue('https://example.com/doc.pdf')
    await w.find('[data-test="adu-submit"]').trigger('click')
    await flushPromises()
    expect(addDocumentUrl).toHaveBeenCalledWith({ url: 'https://example.com/doc.pdf', scope: 'agent_knowledge', agent_id: 42 })
    expect(w.emitted('added')).toBeTruthy()
  })

  it('labels the button "Add YouTube" for a youtube link', async () => {
    const w = mount(AddDocumentUrl, { global: { stubs } })
    await w.find('[data-test="adu-input"]').setValue('https://www.youtube.com/watch?v=abc')
    expect(w.find('[data-test="adu-submit"]').text()).toContain('YouTube')
  })

  it('rejects a non-http value without calling the API', async () => {
    const w = mount(AddDocumentUrl, { global: { stubs } })
    await w.find('[data-test="adu-input"]').setValue('not-a-url')
    // button is disabled for invalid input
    expect(w.find('[data-test="adu-submit"]').element.disabled).toBe(true)
    expect(addDocumentUrl).not.toHaveBeenCalled()
  })

  it('shows a clear error when the backend blocks the URL (SSRF)', async () => {
    addDocumentUrl.mockRejectedValueOnce({ response: { data: { error: 'localhost blocked', error_code: 'URL_BLOCKED' } } })
    const w = mount(AddDocumentUrl, { global: { stubs } })
    await w.find('[data-test="adu-input"]').setValue('http://localhost/x'.replace('http://', 'https://'))
    await w.find('[data-test="adu-submit"]').trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('localhost blocked')
  })
})
