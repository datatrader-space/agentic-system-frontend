// @vitest-environment jsdom
// One background task as a card, as Claude Code's sheet draws it (ADM-1360 release): kind icon (a blue dot for a
// running workflow or agent), the name that opens it, the kind word with the live time or the result word, a round
// Stop only while it runs, "Needs you", agents and tokens, the description, the last output line, and the Phases with
// their squares and agent tables. The compact chat variant has one row of squares.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@iconify/vue', () => ({ Icon: { props: ['icon'], template: '<i class="ic" :data-icon="icon" />' } }))
const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/composables/useConfirm', () => ({ confirm: confirmMock, confirmState: { open: false } }))
const notifyMock = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotify', () => ({ notify: notifyMock }))

import BackgroundTaskCard from './BackgroundTaskCard.vue'
import { BACKGROUND_TASKS, createBackgroundTasks } from '@/stores/useBackgroundTasks'
import { duration, phaseSummary, resultWord, statusText, tokens } from './backgroundTaskText'

const NOW = Date.parse('2026-11-24T11:43:26Z')
const base = { state: 'running', status: '', started_at: '2026-11-24T10:00:00Z', open: { type: 'output' } }
const shell = { ...base, id: 's1', kind: 'command', name: 'Final full track + regression run', output_tail: 'a\nPASS 412 tests\n' }
const workflow = {
  ...base, id: 'w1', kind: 'workflow', name: 'wave7-reopened-phases', agents: 10, tokens: 1_900_000,
  description: 'Phases 0/1/3/4/5 reopened by production truth.', open: { type: 'workflow_run', workflow_run_id: 88 },
  progress: { phases: [
    { title: 'Build', done: 5, total: 5, items: [
      { label: 'build:prefix-drift', state: 'done', tokens: 231000, seconds: 1834 },
      { label: 'build:canonical-decision', state: 'done', tokens: 258000, seconds: 1501 },
      { label: 'build:capability-scopes', state: 'done', tokens: 254000, seconds: 1516 },
      { label: 'build:relevance-objective', state: 'done', tokens: 227000, seconds: 1267 },
      { label: 'build:audit-residue', state: 'done', tokens: 266000, seconds: 2342 }] },
    { title: 'Verify', done: 2, total: 5, items: [
      { label: 'verify:canonical-decision', state: 'done', tokens: 172000, seconds: 968 },
      { label: 'verify:prefix-drift', state: 'done', tokens: 194000, seconds: 1248 },
      { label: 'verify:capability-scopes', state: 'running', tokens: 177000, seconds: 300 },
      { label: 'verify:relevance-objective', state: 'running', tokens: 156000 },
      { label: 'verify:audit-residue', state: 'pending' }] },
    { title: 'Synthesize', done: 0, total: 0, items: [] },
  ] },
}

let ctl
let api
function card(task, { variant = 'panel', provide = true } = {}) {
  api = { list: vi.fn(() => Promise.resolve({ data: { tasks: [task] } })), stop: vi.fn((_c, tid) => Promise.resolve({ data: { task: { id: tid, state: 'stopped', status: 'cancelled' } } })) }
  ctl = createBackgroundTasks({ api })
  ctl.setConversation('77')
  return mount(BackgroundTaskCard, { props: { task, variant }, global: { provide: provide ? { [BACKGROUND_TASKS]: ctl } : {} } })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  confirmMock.mockImplementation(() => Promise.resolve(true))
})

describe('the words of a card', () => {
  it('formats time and tokens as Claude Code does', () => {
    expect(duration(9)).toBe('9s')
    expect(duration(82)).toBe('1m 22s')
    expect(duration(6206)).toBe('103m 26s')
    expect(tokens(950)).toBe('950')
    expect(tokens(231_400)).toBe('231K')
    expect(tokens(1_900_000)).toBe('1.9M')
    expect(tokens(2_000_000)).toBe('2M')
  })

  it.each([
    [{ state: 'finished', status: 'succeeded', exit_code: 0 }, 'Completed'],
    [{ state: 'finished', status: 'failed', exit_code: 1 }, 'Failed (exit 1)'],
    [{ state: 'finished', status: 'failed' }, 'Failed'],
    [{ state: 'finished', status: 'succeeded', exit_code: 2 }, 'Failed (exit 2)'],
    [{ state: 'finished', status: 'timed_out' }, 'Timed out'],
    [{ state: 'finished', status: 'lost' }, 'Lost'],
    [{ state: 'finished', status: 'sandbox_stopped' }, 'Sandbox stopped'],
    [{ state: 'stopped', status: 'cancelled' }, 'Stopped'],
    [{ state: 'finished', status: 'matched' }, 'Condition met'],
    [{ state: 'finished', status: 'fired', finished_at: '2026-11-24T11:30:00Z' }, /^Ran at /],
    [{ state: 'some_new_state', status: 'succeeded' }, 'Completed'],
  ])('an ended task %o reads %s', (over, word) => {
    const w = resultWord({ ...shell, ...over }, NOW)
    if (word instanceof RegExp) expect(w).toMatch(word)
    else expect(w).toBe(word)
  })

  it('a running task shows its live time; a waiting wake-up its time, a schedule its words', () => {
    expect(statusText(shell, NOW)).toBe('103m 26s')
    expect(statusText({ ...base, kind: 'wakeup', due_at: '2026-11-24T14:30:00Z' }, NOW)).toMatch(/^at /)
    expect(statusText({ ...base, kind: 'schedule', schedule_text: 'Every day at 09:00' }, NOW)).toBe('Every day at 09:00')
    expect(statusText({ ...base, kind: 'schedule' }, NOW)).toBe('Waiting')
  })

  it('tells the squares in words', () => {
    expect(phaseSummary(workflow.progress.phases[1])).toBe('Verify: 2 of 5 done, 2 running')
    expect(phaseSummary({ title: 'Fix', items: [{ state: 'failed' }, { state: 'done' }] })).toBe('Fix: 1 of 2 done, 1 failed')
  })
})

describe('the panel card', () => {
  it('a running shell: icon, name that opens it, "Shell" and the live time, the last line, a round Stop', async () => {
    const w = card(shell)
    expect(w.find('.bgc-ic .ic').attributes('data-icon')).toBe('lucide:square-terminal')
    expect(w.find('.bgc-dot').exists()).toBe(false)
    expect(w.find('[data-test="bgc-open"]').text()).toBe('Final full track + regression run')
    expect(w.find('[data-test="bgc-meta"]').text()).toBe('Shell 103m 26s')
    expect(w.find('[data-test="bgc-tail"]').text()).toBe('PASS 412 tests')
    const stop = w.find('[data-test="bgc-stop"]')
    expect(stop.attributes('aria-label')).toBe('Stop Final full track + regression run')
    expect(w.findAll('button').map((b) => b.text()).filter(Boolean)).toEqual(['Final full track + regression run'])   // no Open / Stop words
    expect(w.text()).not.toMatch(/Running|Done/)                                                             // no state chip
    await w.find('[data-test="bgc-open"]').trigger('click')
    expect(ctl.opened.id).toBe('s1')
    expect(w.emitted('opened')).toHaveLength(1)
  })

  it('a finished one has its result word and no Stop', () => {
    const w = card({ ...shell, state: 'finished', status: 'failed', exit_code: 1 })
    expect(w.find('[data-test="bgc-meta"]').text()).toBe('Shell Failed (exit 1)')
    expect(w.find('[data-test="bgc-stop"]').exists()).toBe(false)
    expect(w.classes()).toContain('failed')
  })

  it.each([
    ['command', 'Shell'], ['server', 'Server'], ['monitor', 'Monitor'], ['subagent', 'Agent'], ['workflow', 'Workflow'],
    ['wakeup', 'Wake-up'], ['schedule', 'Schedule'],
  ])('kind %s reads %s', (kind, word) => {
    const w = card({ ...shell, kind, state: 'finished', status: 'succeeded', open: { type: kind === 'workflow' ? 'workflow_run' : 'output', workflow_run_id: 3 } })
    expect(w.find('.bgc-kind').text()).toBe(word)
  })

  it('a workflow: blue dot, agents and tokens, its description and its phases with squares and agent tables', async () => {
    const w = card(workflow)
    expect(w.find('.bgc-dot').exists()).toBe(true)
    expect(w.find('[data-test="bgc-meta"]').text()).toBe('Workflow 103m 26s')
    expect(w.find('[data-test="bgc-stats"]').text()).toBe('10 agents 1.9M tokens')
    expect(w.find('[data-test="bgc-desc"]').text()).toBe('Phases 0/1/3/4/5 reopened by production truth.')
    expect(w.find('[data-test="bgc-tail"]').exists()).toBe(false)
    const open = w.find('a[data-test="bgc-open"]')
    expect(open.attributes('href')).toBe('/dashboard/workflow-runs?run=88')
    expect(open.attributes('target')).toBe('_blank')

    const [build, verify, synth] = [0, 1, 2].map((i) => w.find(`[data-test="bgc-phase-${i}"]`))
    expect(build.find('.bgc-ph-t').text()).toBe('Build')
    expect(build.find('[data-test="bgc-phase-count"]').text()).toBe('5/5')
    expect(verify.find('[data-test="bgc-phase-count"]').text()).toBe('2/5')
    const sq = verify.find('[data-test="bgc-phase-squares"]')
    expect(sq.attributes('role')).toBe('img')
    expect(sq.attributes('aria-label')).toBe('Verify: 2 of 5 done, 2 running')
    expect(sq.findAll('.sq').map((s) => s.classes()[1])).toEqual(['done', 'done', 'running', 'running', 'pending'])

    // The tables are open, as in Claude Code; time is empty while an agent runs; tokens 231K.
    const rows = verify.findAll('[data-test="bgc-phase-table"] tbody tr').map((r) => r.findAll('td').map((c) => c.text()))
    expect(rows).toEqual([
      ['verify:canonical-decision', '172K', '16m 8s'], ['verify:prefix-drift', '194K', '20m 48s'],
      ['verify:capability-scopes', '177K', ''], ['verify:relevance-objective', '156K', ''], ['verify:audit-residue', '', '']])
    expect(build.find('tbody tr td').text()).toBe('build:prefix-drift')
    expect(build.findAll('tbody tr')[0].findAll('td')[1].text()).toBe('231K')
    expect(build.find('thead').text()).toBe('AgentTokensTime')

    const tg = verify.find('[data-test="bgc-phase-toggle"]')
    expect(tg.attributes('aria-expanded')).toBe('true')
    expect(tg.attributes('aria-controls')).toBe(verify.find('table').attributes('id'))
    await tg.trigger('click')
    expect(tg.attributes('aria-expanded')).toBe('false')
    expect(verify.find('table').exists()).toBe(false)
    expect(tg.attributes('aria-label')).toBe('Show the agents of Verify')
    // A phase with no agents yet: 0/0, nothing to open.
    expect(synth.find('[data-test="bgc-phase-count"]').text()).toBe('0/0')
    expect(synth.find('[data-test="bgc-phase-toggle"]').attributes('disabled')).toBeDefined()
    expect(synth.find('[data-test="bgc-phase-squares"]').exists()).toBe(false)
  })

  it('tokens grow live from a progress frame', async () => {
    const w = card(workflow)
    const next = JSON.parse(JSON.stringify(workflow))
    next.tokens = 2_080_000
    next.progress.phases[1].items[2].tokens = 199_000
    ctl.handleFrame({ type: 'background_task', conversation_id: 77, event: 'progress', task: next })
    await w.setProps({ task: ctl.listFor('77').find((t) => t.id === 'w1') })
    expect(w.find('[data-test="bgc-stats"]').text()).toBe('10 agents 2.1M tokens')
    expect(w.find('[data-test="bgc-phase-1"] tbody tr:nth-child(3)').findAll('td')[1].text()).toBe('199K')
  })

  it('an agent waiting on the person says Needs you, and opens its chat', async () => {
    const w = card({ ...base, id: 'a1', kind: 'subagent', name: 'Explore', status: 'needs_approval', open: { type: 'conversation', conversation_id: '901' } })
    expect(w.find('[data-test="bgc-needs"]').text()).toBe('Needs you')
    expect(w.find('[data-test="bgc-open"]').attributes('aria-label')).toBe("Open the agent's chat, where it waits for you: Explore")
    await w.find('[data-test="bgc-open"]').trigger('click')
    expect(ctl.opened.open.conversation_id).toBe('901')
  })

  it('Stop asks in the app dialog, spins while sent; a 409 shows its error and Stop works again', async () => {
    const w = card(shell)
    let release
    api.stop.mockImplementationOnce(() => new Promise((r) => { release = () => r({ data: { task: { ...shell, state: 'stopped', status: 'cancelled' } } }) }))
    await w.find('[data-test="bgc-stop"]').trigger('click')
    await flushPromises()
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Stop this background command?', danger: true }))
    expect(w.find('[data-test="bgc-stop"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="bgc-stop"] .ic').attributes('data-icon')).toBe('lucide:loader-2')
    release()
    await flushPromises()
    expect(api.stop).toHaveBeenCalledWith('77', 's1')

    api.stop.mockImplementationOnce(() => Promise.reject({ response: { status: 409, data: { error: 'It has already ended.' } } }))
    await w.find('[data-test="bgc-stop"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="bgc-stop-err"]').text()).toBe('It has already ended.')
    expect(w.find('[data-test="bgc-stop"]').attributes('disabled')).toBeUndefined()

    api.stop.mockImplementationOnce(() => Promise.resolve({ data: { task: shell, needs_approval: true } }))
    await w.find('[data-test="bgc-stop"]').trigger('click')
    await flushPromises()
    expect(notifyMock.info).toHaveBeenCalledWith('An approval card was sent to the chat. Allow it there to stop “Final full track + regression run”.')
  })

  it('Stop cancelled in the dialog sends nothing', async () => {
    confirmMock.mockImplementationOnce(() => Promise.resolve(false))
    const w = card(shell)
    await w.find('[data-test="bgc-stop"]').trigger('click')
    await flushPromises()
    expect(api.stop).not.toHaveBeenCalled()
  })
})

describe('the chat card', () => {
  it('name with a chevron, kind, agents and time, and one row of squares across the phases', () => {
    const w = card(workflow, { variant: 'chat' })
    expect(w.find('.bgc-chev').exists()).toBe(true)
    expect(w.find('[data-test="bgc-stop"]').exists()).toBe(false)
    expect(w.find('[data-test="bgc-meta"]').text()).toBe('Workflow 10 agents 103m 26s')
    const sq = w.find('[data-test="bgc-squares"]')
    expect(sq.findAll('.sq')).toHaveLength(10)
    expect(sq.attributes('aria-label')).toBe('Progress: 7 of 10 done, 2 running')
    expect(w.find('[data-test="bgc-phases"]').exists()).toBe(false)
    expect(w.find('[data-test="bgc-desc"]').exists()).toBe(false)
  })
})
