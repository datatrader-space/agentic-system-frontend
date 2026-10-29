// @vitest-environment jsdom
// Agent Library: only the latest filter/page load may write the grid (page-speed plan Phase 5 item 2),
// and Duplicate is ONE call to POST /agents/<id>/duplicate/ that opens the copy without waiting for the whole
// list to reload first (Phase 5 item 8).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => {
  const a = { get: vi.fn(), post: vi.fn(), getAgents: vi.fn(), unpauseAgent: vi.fn() }
  a.duplicateAgent = (id) => a.post(`/agents/${id}/duplicate/`, {})
  // The page calls the service helpers; they are thin wrappers over `get`, as in services/api.js.
  a.getAgentsPage = (params = {}, config = {}) => a.get('/agents/', { ...config, params })
  a.getAgentStats = (params = {}, config = {}) => a.get('/agents/stats/', { ...config, params })
  return a
})
const router = vi.hoisted(() => ({ push: vi.fn() }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))

vi.mock('../services/api', () => ({ default: api, isAbortError: (e) => !!e && e.name === 'CanceledError' }))
vi.mock('vue-router', () => ({ useRouter: () => router }))
vi.mock('@/composables/useNotify', () => ({ notify }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import AgentLibrary from './AgentLibrary.vue'

const stubs = { Icon: true, OwnerFilter: true }
const page = (names) => ({ data: { count: names.length, results: names.map((n, i) => ({ id: i + 1, name: n })) } })

// A GET that answers only when the test says so, and rejects like axios when its signal aborts.
function controllableGet() {
  const calls = []
  api.get.mockImplementation((url, config = {}) => new Promise((resolve, reject) => {
    const call = { url, config, resolve }
    calls.push(call)
    config.signal?.addEventListener('abort', () => reject(Object.assign(new Error('canceled'), { name: 'CanceledError' })))
  }))
  return calls
}

beforeEach(() => { vi.clearAllMocks() })

describe('AgentLibrary — stale responses', () => {
  it('a slow answer for an older search never replaces the newer one', async () => {
    vi.useFakeTimers()
    const calls = controllableGet()
    const w = mount(AgentLibrary, { global: { stubs } })
    await flushPromises()
    const first = calls.filter(c => c.url === '/agents/')
    expect(first).toHaveLength(1)

    await w.find('.search input').setValue('beta')
    await vi.advanceTimersByTimeAsync(350)                 // the search debounce
    const lists = calls.filter(c => c.url === '/agents/')
    expect(lists).toHaveLength(2)
    expect(first[0].config.signal.aborted).toBe(true)      // the older load was cancelled
    expect(lists[1].config.params.search).toBe('beta')

    // The newer answer lands, then the older one arrives late — it must not win.
    lists[1].resolve(page(['Beta']))
    calls.filter(c => c.url === '/agents/stats/').forEach(c => c.resolve({ data: { total: 1 } }))
    await flushPromises()
    first[0].resolve(page(['Alpha (stale)']))
    await flushPromises()
    expect(w.text()).toContain('Beta')
    expect(w.text()).not.toContain('Alpha (stale)')
    expect(w.text()).not.toMatch(/Couldn't load your agents/)
    vi.useRealTimers()
  })
})

describe('AgentLibrary — Duplicate', () => {
  it('is one call to the duplicate route, opens the copy straight away, and only once per click', async () => {
    api.get.mockImplementation((url) => Promise.resolve(
      url === '/agents/' ? page(['Lead Intake']) : url === '/agents/stats/' ? { data: {} } : { data: {} }))
    let release
    api.post.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mount(AgentLibrary, { global: { stubs } })
    await flushPromises()
    const listLoads = () => api.get.mock.calls.filter(c => c[0] === '/agents/').length
    expect(listLoads()).toBe(1)

    // Open the card menu and press Duplicate twice.
    w.vm.toggleMenu(1)
    await flushPromises()
    const dup = () => w.findAll('button').find(b => /Duplicat/.test(b.text()))
    await dup().trigger('click')
    await flushPromises()
    await dup().trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/agents/1/duplicate/', {})
    // The agent is no longer read first to build a copy in the browser.
    expect(api.get.mock.calls.filter(c => c[0] === '/agents/1/')).toHaveLength(0)
    expect(dup().text()).toContain('Duplicating')

    release({ data: { id: 42 } })
    await flushPromises()
    expect(router.push).toHaveBeenCalledWith('/dashboard/agents/42/editor')
    expect(listLoads()).toBe(1)                             // no full reload before leaving
  })

  it('a refused copy says why, frees the button and opens nothing', async () => {
    api.get.mockImplementation((url) => Promise.resolve(
      url === '/agents/' ? page(['Lead Intake']) : { data: {} }))
    api.post.mockRejectedValue({ response: { status: 404, data: { detail: 'Not found.' } } })
    const w = mount(AgentLibrary, { global: { stubs } })
    await flushPromises()
    w.vm.toggleMenu(1)
    await flushPromises()
    await w.findAll('button').find(b => /Duplicat/.test(b.text())).trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('Failed to duplicate agent: Not found.')
    expect(router.push).not.toHaveBeenCalled()
    expect(w.vm.duplicatingId).toBe(null)
  })
})
