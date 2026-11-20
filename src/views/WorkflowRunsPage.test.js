// @vitest-environment jsdom
// Workflow operations page (ADM-1333, F17 / F2 / F15): the control toasts read as English; Pause and Resume
// show only in the states the backend accepts (inspection.pause / inspection.resume); a run row is reachable
// by keyboard; the status filter has a label; and "Load more" pages by the cursor of contract C5.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { nextTick } from 'vue'
import source from './WorkflowRunsPage.vue?raw'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  controlWorkflowRun: vi.fn(() => Promise.resolve({ data: { status: 'paused' } })),
}))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }))
const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const route = vi.hoisted(() => ({ query: {} }))
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('../services/api', () => ({ default: api, isAbortError: (e) => e?.name === 'CanceledError' }))
vi.mock('../composables/useNotify', () => ({ useNotify: () => notify, notify }))
vi.mock('../composables/useConfirm', () => ({ useConfirm: () => confirmMock, confirm: confirmMock }))

import WorkflowRunsPage from './WorkflowRunsPage.vue'

const tick = async () => { await flushPromises(); await nextTick() }

const run = (id, status = 'running', over = {}) => ({
  id, workflow_name: `Flow ${id}`, status, trigger_kind: 'manual', version: 1, started_at: null, recovery_count: 0, ...over,
})

// The list answers from `lists` in order; the timeline answers with the run's status from `statuses`.
let lists
let statuses
function wire() {
  api.get.mockImplementation((url, config = {}) => {
    if (url === '/workflow-runs/') {
      const next = lists.length > 1 ? lists.shift() : lists[0]
      return Promise.resolve({ data: typeof next === 'function' ? next(config.params) : next })
    }
    const m = url.match(/^\/workflow-graph-runs\/(\d+)\/timeline\/$/)
    if (m) return Promise.resolve({ data: { status: statuses[m[1]], timeline: [], failed_node: null } })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

let wrapper
function mountPage() {
  wrapper = mount(WorkflowRunsPage, {
    attachTo: document.body,
    global: { stubs: { RouterLink: RouterLinkStub, StudioJobList: true } },
  })
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  route.query = {}
  statuses = {}
  lists = [{ results: [run(1)], next_cursor: null, has_more: false, attention: null }]
  wire()
})
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

const buttons = (w) => w.findAll('.wf-detail__actions button').map((b) => b.text())

describe('WorkflowRunsPage — controls by state (F17)', () => {
  const cases = [
    ['queued', true, false], ['running', true, false], ['waiting', true, true], ['blocked', true, false],
    ['paused', false, true], ['success', false, false], ['failed', false, false], ['cancelled', false, false],
    ['dead', false, false],
  ]
  for (const [status, pause, resume] of cases) {
    it(`a ${status} run shows Pause: ${pause}, Resume: ${resume}`, async () => {
      lists = [{ results: [run(1, status)], next_cursor: null, has_more: false }]
      statuses = { 1: status }
      const w = mountPage()
      await tick()
      await w.find('.wf-table__open').trigger('click')
      await tick()
      const shown = buttons(w)
      expect(shown.includes('Pause')).toBe(pause)
      expect(shown.includes('Resume')).toBe(resume)
      // Replay starts a new run from any state.
      expect(shown).toContain('Replay (same input)')
      expect(shown).toContain('Replay (fresh input)')
    })
  }

  it('follows the run detail, not the stale list row', async () => {
    lists = [{ results: [run(1, 'running')], next_cursor: null, has_more: false }]
    statuses = { 1: 'paused' }
    const w = mountPage()
    await tick()
    await w.find('.wf-table__open').trigger('click')
    await tick()
    expect(buttons(w)).toContain('Resume')
    expect(buttons(w)).not.toContain('Pause')
  })
})

describe('WorkflowRunsPage — toasts (F17)', () => {
  it('says "Run paused." / "Run resumed." / "Replay started.", never "Run replayd."', async () => {
    lists = [{ results: [run(1, 'waiting')], next_cursor: null, has_more: false }]
    statuses = { 1: 'waiting' }
    const w = mountPage()
    await tick()
    await w.find('.wf-table__open').trigger('click')
    await tick()
    const click = async (label) => {
      await w.findAll('.wf-detail__actions button').find((b) => b.text() === label).trigger('click')
      await tick()
    }
    await click('Pause')
    await click('Resume')
    await click('Replay (same input)')
    expect(notify.success.mock.calls.map((c) => c[0])).toEqual(['Run paused.', 'Run resumed.', 'Replay started.'])
    expect(api.controlWorkflowRun).toHaveBeenLastCalledWith(1, 'replay', { reuse_input: true })
    expect(source).not.toMatch(/\$\{action\}d\./)
  })
})

describe('WorkflowRunsPage — keyboard and labels (F17 / F15)', () => {
  it('each row opens from a real button in its first cell', async () => {
    const w = mountPage()
    await tick()
    const btn = w.find('tbody tr td:first-child button.wf-table__open')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('type')).toBe('button')
    expect(btn.attributes('aria-label')).toBe('Open the run of Flow 1, running')
    btn.element.focus()
    expect(document.activeElement).toBe(btn.element)
    await btn.trigger('click')
    await tick()
    expect(api.get).toHaveBeenCalledWith('/workflow-graph-runs/1/timeline/', expect.anything())
    expect(btn.attributes('aria-current')).toBe('true')
    // Opened once, not twice (the button's click does not also bubble into the row's).
    expect(api.get.mock.calls.filter((c) => String(c[0]).includes('/timeline/'))).toHaveLength(1)
  })

  it('the status filter has a label', async () => {
    const w = mountPage()
    await tick()
    const select = w.find('select')
    const label = w.find(`label[for="${select.attributes('id')}"]`)
    expect(label.exists()).toBe(true)
    expect(label.text()).toContain('Status')
  })

  it('uses Lucide icons, not glyphs, and only theme tokens for colour', () => {
    const template = source.slice(source.indexOf('<template>'), source.indexOf('<style'))
    expect(template).not.toMatch(/[←↻]/)
    const style = source.slice(source.indexOf('<style'))
    expect(style.match(/#[0-9a-fA-F]{3,8}\b/g) || []).toEqual([])
    // No fallback onto tokens that do not exist in style.css.
    expect(style).not.toMatch(/--vm-(?:text-muted|danger-bg|danger-border|ok-bg|ok-border|surface-hover)\b/)
  })
})

describe('WorkflowRunsPage — cursor pagination (contract C5)', () => {
  it('loads more from next_cursor and stops when has_more is false', async () => {
    lists = [
      { results: [run(1), run(2)], next_cursor: 'c2', has_more: true, attention: { dead: 0, blocked: 0 } },
      { results: [run(3)], next_cursor: null, has_more: false },
    ]
    const w = mountPage()
    await tick()
    expect(api.get.mock.calls[0][1].params).toEqual({ limit: 50 })
    const more = () => w.findAll('button').find((b) => b.text() === 'Load more')
    expect(more()).toBeTruthy()
    await more().trigger('click')
    await tick()
    expect(api.get.mock.calls[1][1].params).toEqual({ limit: 50, cursor: 'c2' })
    expect(w.findAll('.wf-table__open').map((b) => b.text())).toEqual(['Flow 1', 'Flow 2', 'Flow 3'])
    expect(more()).toBeUndefined()
  })

  it('keeps the filters on the next page', async () => {
    lists = [{ results: [run(1, 'dead')], next_cursor: 'c2', has_more: true }]
    const w = mountPage()
    await tick()
    await w.find('select').setValue('dead')
    await tick()
    expect(api.get.mock.calls.at(-1)[1].params).toEqual({ limit: 50, status: 'dead' })
    await w.findAll('button').find((b) => b.text() === 'Load more').trigger('click')
    await tick()
    expect(api.get.mock.calls.at(-1)[1].params).toEqual({ limit: 50, cursor: 'c2', status: 'dead' })
  })

  it('refuses a plain array, the pre-C5 shape, with a reason instead of reading it as a page', async () => {
    lists = [[run(1), run(2)]]
    const w = mountPage()
    await tick()
    expect(w.text()).toContain('The server sent the runs list in a shape this page does not read.')
    expect(w.findAll('.wf-table__open')).toHaveLength(0)
  })

  it('refuses an unknown shape with a reason instead of showing "no runs"', async () => {
    lists = [{ items: [run(1)], has_more: false }]
    const w = mountPage()
    await tick()
    expect(w.text()).toContain('The server sent the runs list in a shape this page does not read.')
    expect(w.text()).not.toContain('No runs match this filter.')
  })

  it('refuses has_more without a cursor rather than silently stopping', async () => {
    lists = [{ results: [run(1)], next_cursor: null, has_more: true }]
    const w = mountPage()
    await tick()
    expect(w.text()).toContain('did not say where the next page starts')
  })
})

describe('a link to one run (?run=<id>)', () => {
  it('opens the run named in the link on load', async () => {
    route.query = { run: '1' }
    statuses = { 1: 'running' }
    const w = mountPage()
    await tick()
    expect(api.get).toHaveBeenCalledWith('/workflow-graph-runs/1/timeline/', expect.anything())
    expect(w.find('.wf-detail__title').text()).toBe('Flow 1')
  })
  it('opens a run that is not on the first page by its id', async () => {
    route.query = { run: '77' }
    statuses = { 77: 'waiting' }
    const w = mountPage()
    await tick()
    expect(api.get).toHaveBeenCalledWith('/workflow-graph-runs/77/timeline/', expect.anything())
    expect(w.find('.wf-detail__title').text()).toBe('Run #77')
  })
  it('ignores a link that is not a run id', async () => {
    route.query = { run: 'abc' }
    mountPage()
    await tick()
    expect(api.get.mock.calls.some(([u]) => u.includes('/timeline/'))).toBe(false)
  })
})
