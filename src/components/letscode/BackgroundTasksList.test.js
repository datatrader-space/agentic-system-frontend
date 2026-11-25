// @vitest-environment jsdom
// The background-tasks list, as Claude Code's sheet (ADM-1360 release, CODING_AGENT_BACKGROUND_WORK_PLAN.md section 3):
// Running (open, waiting wake-ups and schedules included) and Finished N (closed until opened, newest first, never
// capped), each task a card. The HTTP client is the mocked contract.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@iconify/vue', () => ({ Icon: { props: ['icon'], template: '<i class="ic" :data-icon="icon" />' } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)), confirmState: { open: false } }))
vi.mock('@/composables/useNotify', () => ({ notify: { info: vi.fn(), error: vi.fn() } }))

import BackgroundTasksList from './BackgroundTasksList.vue'
import { BACKGROUND_TASKS, createBackgroundTasks } from '@/stores/useBackgroundTasks'

const id = (n) => `5d7c1b0e-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`
const run = (n, over = {}) => ({ id: id(n), kind: 'command', name: `run ${n}`, state: 'running', status: '', started_at: '2026-11-24T10:00:00Z', open: { type: 'output' }, ...over })
const fin = (n, at, over = {}) => ({ id: id(n), kind: 'command', name: `done ${n}`, state: 'finished', status: 'succeeded', started_at: '2026-11-24T09:00:00Z', finished_at: at, open: { type: 'output' }, ...over })

let ctl
function mountList(tasks) {
  ctl = createBackgroundTasks({ api: { list: vi.fn(() => Promise.resolve({ data: { tasks } })), stop: vi.fn() } })
  ctl.setConversation('77')
  return mount(BackgroundTasksList, { global: { provide: { [BACKGROUND_TASKS]: ctl } } })
}
const names = (ul) => ul.findAll('li [data-test="bgc-open"]').map((b) => b.text())

beforeEach(() => vi.clearAllMocks())

describe('the background-tasks list', () => {
  it('Running holds running and waiting tasks, open; Finished N is closed until opened, newest first', async () => {
    const finished = [fin(10, '2026-11-24T10:01:00Z'), fin(11, '2026-11-24T10:05:00Z'), fin(12, '2026-11-24T10:03:00Z', { state: 'stopped', status: 'cancelled' })]
    const w = mountList([run(1), run(2, { kind: 'wakeup', name: 'later', open: { type: 'schedule' } }), ...finished])
    await flushPromises()
    const running = w.find('[data-test="bgt-running"]')
    expect(running.find('[data-test="bgt-running-toggle"]').text()).toBe('Running')
    expect(running.find('[data-test="bgt-running-toggle"]').attributes('aria-expanded')).toBe('true')
    expect(running.find('ul').attributes('role')).toBe('list')
    expect(names(running)).toEqual(['run 1', 'later'])
    const toggle = w.find('[data-test="bgt-finished-toggle"]')
    expect(toggle.text()).toBe('Finished 3')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(w.find('[data-test="bgt-finished"] ul').exists()).toBe(false)
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(names(w.find('[data-test="bgt-finished"]'))).toEqual(['done 11', 'done 12', 'done 10'])
    await w.find('[data-test="bgt-running-toggle"]').trigger('click')
    expect(w.find('[data-test="bgt-running"] ul').isVisible()).toBe(false)
    w.unmount()
  })

  it('never caps the finished list', async () => {
    const many = Array.from({ length: 64 }, (_, i) => fin(i + 10, `2026-11-24T10:${String(i % 60).padStart(2, '0')}:00Z`))
    const w = mountList(many)
    await flushPromises()
    expect(w.find('[data-test="bgt-running"]').exists()).toBe(false)
    await w.find('[data-test="bgt-finished-toggle"]').trigger('click')
    expect(w.findAll('[data-test="bgt-finished"] li')).toHaveLength(64)
    w.unmount()
  })

  it('a card opened from the list is told upward (the sheet closes)', async () => {
    const w = mountList([run(1)])
    await flushPromises()
    await w.find('[data-test="bgc-open"]').trigger('click')
    expect(ctl.opened.id).toBe(id(1))
    expect(w.emitted('opened')).toHaveLength(1)
    w.unmount()
  })

  it('says when there is nothing, and offers Try again when the list could not be read', async () => {
    const w = mountList([])
    await flushPromises()
    expect(w.find('[data-test="bgt-empty"]').text()).toContain('No background tasks in this chat yet')
    w.unmount()
    const api = { list: vi.fn(() => Promise.reject(new Error('down'))), stop: vi.fn() }
    ctl = createBackgroundTasks({ api })
    ctl.setConversation('9')
    const w2 = mount(BackgroundTasksList, { global: { provide: { [BACKGROUND_TASKS]: ctl } } })
    await flushPromises()
    expect(w2.find('[role="alert"]').text()).toContain('could not be loaded')
    await w2.find('[data-test="bgt-retry"]').trigger('click')
    expect(api.list).toHaveBeenCalledTimes(2)
    w2.unmount()
  })
})
