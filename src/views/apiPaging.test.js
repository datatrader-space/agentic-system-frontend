// @vitest-environment jsdom
// Page-speed plan Phase 4 (ADM-1076): lists the server now pages — workflows and schedules — ask for one page,
// offer Load more while the server says there is a next one, and ask for the page AFTER the rows on screen
// (offset), so a row removed meanwhile never makes another one get skipped.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  getWorkflowGraphs: vi.fn(),
  getAgentPicker: vi.fn(),
  getLlmModels: vi.fn(),
  listSchedules: vi.fn(),
  getSystems: vi.fn(),
}))
vi.mock('../services/api', () => ({
  default: api,
  isAbortError: (e) => !!e && (e.name === 'CanceledError' || e.name === 'AbortError'),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), useRoute: () => ({ params: {}, query: {} }) }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import WorkflowsList from './WorkflowsList.vue'
import SchedulesPage from './SchedulesPage.vue'

const stubs = { Icon: true, PageLoader: true, RouterLink: true, 'router-link': true }
const more = (w) => w.findAll('button').find((b) => b.text() === 'Load more')

beforeEach(() => {
  vi.clearAllMocks()
  api.getAgentPicker.mockResolvedValue({ data: [] })
  api.getLlmModels.mockResolvedValue({ data: [] })
  api.getSystems.mockResolvedValue({ data: [] })
})

describe('WorkflowsList', () => {
  it('asks for one page, and Load more asks for the rows after those on screen', async () => {
    api.getWorkflowGraphs
      .mockResolvedValueOnce({ data: { count: 3, next: 'n', results: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] } })
      .mockResolvedValueOnce({ data: { count: 3, next: null, results: [{ id: 2, name: 'B' }, { id: 3, name: 'C' }] } })
    const w = mount(WorkflowsList, { global: { stubs } })
    await flushPromises()
    expect(api.getWorkflowGraphs).toHaveBeenLastCalledWith({ limit: 30, offset: 0 })
    expect(w.text()).toContain('Showing 2 of 3')
    await more(w).trigger('click')
    await flushPromises()
    expect(api.getWorkflowGraphs).toHaveBeenLastCalledWith({ limit: 30, offset: 2 })
    expect(w.text()).toContain('C')
    expect(w.text()).toContain('Showing 3 of 3')       // B, answered twice, is listed once
    expect(more(w)).toBeUndefined()
  })

  it('still reads a server that answers a plain list', async () => {
    api.getWorkflowGraphs.mockResolvedValueOnce({ data: [{ id: 1, name: 'Only' }] })
    const w = mount(WorkflowsList, { global: { stubs } })
    await flushPromises()
    expect(w.text()).toContain('Only')
    expect(more(w)).toBeUndefined()
  })
})

describe('SchedulesPage', () => {
  const row = (id) => ({ id: `as_${id}`, template_name: `S${id}`, schedule: '0 * * * *', active: true,
                         source: 'agent_tool', run_count: 0 })

  it('asks for the agent schedules a page at a time and appends the next page', async () => {
    api.listSchedules
      .mockResolvedValueOnce({ data: { count: 2, next: 'n', results: [row(1)] } })
      .mockResolvedValueOnce({ data: { count: 2, next: null, results: [row(2)] } })
    const w = mount(SchedulesPage, { global: { stubs } })
    await flushPromises()
    expect(api.listSchedules).toHaveBeenLastCalledWith({ source: 'agent_tool', limit: 50, offset: 0 })
    expect(w.text()).toContain('Showing 1 of 2 schedules')
    await more(w).trigger('click')
    await flushPromises()
    expect(api.listSchedules).toHaveBeenLastCalledWith({ source: 'agent_tool', limit: 50, offset: 1 })
    expect(w.text()).toContain('S2')
    expect(w.text()).toContain('Showing 2 of 2 schedules')
    expect(more(w)).toBeUndefined()
  })
})
