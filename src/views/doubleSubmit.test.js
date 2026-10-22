// @vitest-environment jsdom
// Page-speed plan F-M13: a second click while the first request is in flight must not send a second one.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  // WorkflowsList
  getWorkflowGraphs: vi.fn(), getWorkflowGraph: vi.fn(), createWorkflowGraph: vi.fn(), importWorkflowGraph: vi.fn(),
  // SchedulesPage
  getAgentPicker: vi.fn(), getLlmModels: vi.fn(), listSchedules: vi.fn(), runSchedule: vi.fn(),
  // SystemDetail
  getSystem: vi.fn(), runCrs: vi.fn(), enrichCrs: vi.fn(),
}))
const router = vi.hoisted(() => ({ push: vi.fn(() => Promise.resolve()) }))
vi.mock('../services/api', () => ({ default: api, isAbortError: () => false }))
vi.mock('vue-router', () => ({ useRouter: () => router, useRoute: () => ({ params: { id: '7' }, query: {} }) }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))
vi.mock('@/composables/useOAuthConnect', () => ({ connectOAuth: vi.fn() }))
// SystemDetail's heavy children are irrelevant here (and pull Monaco / pdf.js).
for (const c of ['CRSPipelineDashboard', 'RepositoryChat', 'PlannerChat', 'ArtifactViewer', 'BlueprintViewer',
  'RelationshipViewer', 'SessionTrace', 'RepositoryDocs', 'CodeBrowser']) {
  vi.doMock(`../components/${c}.vue`, () => ({ default: { name: c, render: () => null } }))
}

const stubs = { Icon: true, PageLoader: true, RouterLink: true, 'router-link': true }

function deferred() {
  let resolve
  const p = new Promise((r) => { resolve = r })
  return { p, resolve }
}

beforeEach(() => { vi.clearAllMocks() })

describe('WorkflowsList', () => {
  it('Duplicate clicked twice creates ONE copy', async () => {
    const WorkflowsList = (await import('./WorkflowsList.vue')).default
    api.getWorkflowGraphs.mockResolvedValue({ data: [{ id: 1, name: 'Flow' }] })
    const d = deferred()
    api.getWorkflowGraph.mockReturnValue(d.p)
    api.createWorkflowGraph.mockResolvedValue({ data: { id: 2 } })
    const w = mount(WorkflowsList, { global: { stubs } })
    await flushPromises()
    const dup = w.findAll('span').find((s) => s.text() === 'Duplicate')
    await dup.trigger('click')
    await dup.trigger('click')
    d.resolve({ data: { graph: {} } })
    await flushPromises()
    expect(api.getWorkflowGraph).toHaveBeenCalledTimes(1)
    expect(api.createWorkflowGraph).toHaveBeenCalledTimes(1)
  })

  it('Import is disabled while a create is in flight', async () => {
    const WorkflowsList = (await import('./WorkflowsList.vue')).default
    api.getWorkflowGraphs.mockResolvedValue({ data: [{ id: 1, name: 'Flow' }] })
    const d = deferred()
    api.getWorkflowGraph.mockReturnValue(d.p)
    const w = mount(WorkflowsList, { global: { stubs } })
    await flushPromises()
    await w.findAll('span').find((s) => s.text() === 'Duplicate').trigger('click')
    const importBtn = w.findAll('button').find((b) => b.text().includes('Import'))
    expect(importBtn.attributes('disabled')).toBeDefined()
    d.resolve({ data: { graph: {} } })
    await flushPromises()
  })
})

describe('SchedulesPage', () => {
  const row = { id: 'as_1', name: 'Nightly', source: 'agent_tool', is_active: true }

  it('"Run now" clicked twice dispatches ONE run', async () => {
    const SchedulesPage = (await import('./SchedulesPage.vue')).default
    api.getAgentPicker.mockResolvedValue({ data: [] })
    api.getLlmModels.mockResolvedValue({ data: [] })
    api.listSchedules.mockResolvedValue({ data: [row] })
    const d = deferred()
    api.runSchedule.mockReturnValue(d.p)
    const w = mount(SchedulesPage, { global: { stubs } })
    await flushPromises()
    const run = w.find('button[title="Run now"]')
    await run.trigger('click')
    await run.trigger('click')
    expect(api.runSchedule).toHaveBeenCalledTimes(1)
    expect(w.find('button[title="Run now"]').attributes('disabled')).toBeDefined()
    d.resolve({ data: {} })
    await flushPromises()
    expect(w.find('button[title="Run now"]').attributes('disabled')).toBeUndefined()
  })

  it('a failed load shows an error with Retry, not "No schedules yet"', async () => {
    const SchedulesPage = (await import('./SchedulesPage.vue')).default
    api.getAgentPicker.mockResolvedValue({ data: [] })
    api.getLlmModels.mockResolvedValue({ data: [] })
    api.listSchedules.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ data: [row] })
    const w = mount(SchedulesPage, { global: { stubs } })
    await flushPromises()
    expect(w.text()).toContain("Couldn't load schedules")
    expect(w.text()).not.toContain('No schedules yet')
    await w.find('.load-error__retry').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Nightly')
  })
})

describe('SystemDetail CRS', () => {
  it('"Run CRS Analysis" clicked twice starts ONE pipeline', async () => {
    const SystemDetail = (await import('./SystemDetail.vue')).default
    api.getSystem.mockResolvedValue({ data: { id: 7, name: 'S', repositories: [{ id: 3, name: 'r', crs_status: 'not_started' }] } })
    const d = deferred()
    api.runCrs.mockReturnValue(d.p)
    const w = mount(SystemDetail, { global: { stubs, provide: { notify: vi.fn() } } })
    await flushPromises()
    const btn = w.findAll('button').find((b) => b.text().includes('Run CRS Analysis'))
    await btn.trigger('click')
    await btn.trigger('click')
    expect(api.runCrs).toHaveBeenCalledTimes(1)
    d.resolve({ data: {} })
    await flushPromises()
  })
})
