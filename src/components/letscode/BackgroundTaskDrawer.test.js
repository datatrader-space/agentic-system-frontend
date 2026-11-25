// @vitest-environment jsdom
// Open on a background task (ADM-1360 release): a command's output (with Refresh, which reads the list again), a
// subagent's transcript (the chat's own message rows, and "Open as a chat tab"), a schedule's time and prompt. Esc and
// Close shut the drawer.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@iconify/vue', () => ({ Icon: { props: ['icon'], template: '<i class="ic" :data-icon="icon" />' } }))
const apiMock = vi.hoisted(() => ({ getConversationMessages: vi.fn() }))
vi.mock('@/services/api', () => ({ default: apiMock }))
const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/composables/useConfirm', () => ({ confirm: confirmMock, confirmState: { open: false } }))
vi.mock('@/composables/useNotify', () => ({ notify: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))

import BackgroundTaskDrawer from './BackgroundTaskDrawer.vue'
import { BACKGROUND_TASKS, createBackgroundTasks } from '@/stores/useBackgroundTasks'

const cmd = { id: 'c1', kind: 'command', name: 'npm test', state: 'running', status: '', started_at: '2026-11-24T10:00:00Z',
  output_tail: 'PASS a\n', open: { type: 'output', handle: 'h1' } }
const sub = { id: 's1', kind: 'subagent', name: 'Explore', state: 'running', status: 'needs_approval',
  open: { type: 'conversation', conversation_id: '901' } }
const wake = { id: 'w1', kind: 'wakeup', name: 'Check the deploy', prompt: 'See if the deploy finished and report.', state: 'running',
  due_at: '2026-11-24T14:30:00', open: { type: 'schedule', schedule_id: 3 } }

let ctl
let listApi
function mountDrawer(task, tasks = [task]) {
  listApi = { list: vi.fn(() => Promise.resolve({ data: { tasks } })), stop: vi.fn() }
  ctl = createBackgroundTasks({ api: listApi })
  ctl.setConversation('77')
  ctl.open(task)
  return mount(BackgroundTaskDrawer, { global: { provide: { [BACKGROUND_TASKS]: ctl }, stubs: { teleport: true, ChatMessage: { props: ['message'], template: '<div class="cm">{{ message.content }}</div>' } } } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('the background-task drawer', () => {
  it('a command: its output, and Refresh reads the list again and shows the newer output', async () => {
    const w = mountDrawer(cmd)
    await flushPromises()
    expect(w.find('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(w.find('#bgd-title').text()).toBe('npm test')
    expect(w.find('[data-test="bgd-output"]').text()).toBe('PASS a')
    listApi.list.mockImplementationOnce(() => Promise.resolve({ data: { tasks: [{ ...cmd, output_tail: 'PASS a\nPASS b\n' }] } }))
    await w.find('[data-test="bgd-refresh"]').trigger('click')
    await flushPromises()
    expect(listApi.list).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="bgd-output"]').text()).toBe('PASS a\nPASS b')
    expect(w.find('[data-test="bgd-stop"]').exists()).toBe(true)
    w.unmount()
  })

  it('a subagent: its transcript, a note that it waits for you, and Open as a chat tab', async () => {
    apiMock.getConversationMessages.mockResolvedValueOnce({ data: { results: [
      { id: 1, role: 'user', content: 'Find where auth is checked' }, { id: 2, role: 'assistant', content: 'In middleware.py.' }] } })
    const w = mountDrawer(sub)
    await flushPromises()
    expect(apiMock.getConversationMessages).toHaveBeenCalledWith('901')
    expect(w.findAll('.cm').map((x) => x.text())).toEqual(['Find where auth is checked', 'In middleware.py.'])
    expect(w.find('[data-test="bgd-needs"]').text()).toContain('waiting for you')
    await w.find('[data-test="bgd-open-chat"]').trigger('click')
    expect(w.emitted('open-chat')).toEqual([['901']])
    expect(ctl.opened).toBe(null)
    w.unmount()
  })

  it('a wake-up: when it continues the chat and its prompt', async () => {
    const w = mountDrawer(wake)
    await flushPromises()
    const dl = w.find('[data-test="bgd-schedule"]')
    expect(dl.text()).toContain('Continues this chat')
    expect(dl.text()).toContain('See if the deploy finished and report.')
    expect(w.find('[data-test="bgd-refresh"]').exists()).toBe(false)
    w.unmount()
  })

  it('a refused Stop shows its error in the drawer', async () => {
    const w = mountDrawer(cmd)
    await flushPromises()
    listApi.stop.mockImplementationOnce(() => Promise.reject({ response: { status: 409, data: { error: 'Already ended.' } } }))
    await w.find('[data-test="bgd-stop"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="bgd-stop-err"]').text()).toBe('Already ended.')
    expect(w.find('[data-test="bgd-stop"]').attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('Esc and Close shut it', async () => {
    const w = mountDrawer(cmd)
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(ctl.opened).toBe(null)
    ctl.open(cmd)
    await w.find('[data-test="bgd-close"]').trigger('click')
    expect(ctl.opened).toBe(null)
    w.unmount()
  })
})
