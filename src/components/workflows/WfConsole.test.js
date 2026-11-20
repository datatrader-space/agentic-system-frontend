// @vitest-environment jsdom
// The console strip: an approval prompt only for a real decision; a run waiting on a sub-workflow links to it
// (ADM-1333, run_waiting). Runs are read as C5 cursor pages.
import { describe, it, expect, vi } from 'vitest'
import { ref, shallowRef, reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/services/api', () => ({ default: {} }))
vi.mock('@/components/studio/StudioJobList.vue', () => ({ default: { template: '<div />' } }))
const { default: WfConsole } = await import('./WfConsole.vue')

function makeRun({ status = 'waiting', states = {}, waitingOn = null } = {}) {
  return {
    live: shallowRef({ id: 41, status }), viewed: shallowRef(null), viewingPast: ref(false), running: ref(true),
    nodeStates: ref(states), waitingOn: ref(waitingOn), log: ref([]), deciding: ref(false), shownRun: ref(null),
    decide: vi.fn(), openRun: vi.fn(), closeRun: vi.fn(),
  }
}
const doc = {
  nodes: ref([
    { id: 'ok', type: 'logic.approval', position: { x: 0, y: 0 }, data: { label: 'Manager OK', message: 'm' } },
    { id: 'child', type: 'action.subworkflow', position: { x: 0, y: 0 }, data: { graph_id: 12 } },
  ]),
  meta: reactive({ lastRun: null }),
}
function mountConsole(run, api = {}) {
  return mount(WfConsole, {
    props: { run, doc, graphId: 5, open: false, api },
    global: { stubs: { Icon: true, AppSheet: true, RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } },
  })
}

describe('WfConsole strip', () => {
  it('a run waiting on a sub-workflow shows the child run and a link, and no approval prompt', () => {
    const run = makeRun({ states: { child: { status: 'waiting' } }, waitingOn: { approval: false, subworkflow: true, subRunIds: [77], resumeAt: null } })
    const w = mountConsole(run)
    expect(w.text()).toContain('Waiting for sub-workflow run #77')
    expect(JSON.parse(w.find('a').attributes('data-to'))).toEqual({ name: 'dashboard-workflow-runs', query: { run: 77 } })
    expect(w.find('a').text()).toBe('Open run #77')
    expect(w.text()).not.toContain('Approve')
  })

  it('a waiting approval step gets Approve and Reject, acting on the live run', async () => {
    const run = makeRun({ states: { ok: { status: 'waiting' } }, waitingOn: { approval: true, subworkflow: false, subRunIds: [], resumeAt: null } })
    const w = mountConsole(run)
    expect(w.text()).toContain('Manager OK needs your approval')
    await w.findAll('button').find((b) => b.text() === 'Approve').trigger('click')
    expect(run.decide).toHaveBeenCalledWith('ok', 'approve')
  })

  it('no prompt when the run is not waiting on a decision', () => {
    const run = makeRun({ states: { ok: { status: 'waiting' } }, waitingOn: { approval: false, subworkflow: false, subRunIds: [], resumeAt: '2026-11-20T10:00:00Z' } })
    expect(mountConsole(run).text()).not.toContain('Approve')
  })

  it('shows the counts of the run on screen', () => {
    const run = makeRun({ status: 'running', states: { a: { status: 'succeeded' }, b: { status: 'failed' }, c: { status: 'running' } } })
    const counts = mountConsole(run).find('.wfb-console__counts').text()
    expect(counts).toContain('1 succeeded')
    expect(counts).toContain('1 failed')
  })
})

describe('WfConsole runs', () => {
  it('reads cursor pages and refuses a plain list', async () => {
    const api = {
      getWorkflowGraphRuns: vi.fn().mockResolvedValueOnce({ data: [{ id: 1 }] }),
      getWorkflowGraphMetrics: vi.fn().mockResolvedValue({ data: null }),
    }
    const run = makeRun({ status: 'success' })
    const w = mountConsole(run, api)
    await w.setProps({ open: true })
    await w.findAll('[role="tab"]').find((t) => t.text() === 'Runs').trigger('click')
    await flushPromises()
    expect(api.getWorkflowGraphRuns).toHaveBeenCalledWith(5, { limit: 50 })
    expect(w.find('[role="alert"]').text()).toContain('a shape this page does not read')
  })
})
