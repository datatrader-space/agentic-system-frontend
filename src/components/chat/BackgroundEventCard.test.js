// @vitest-environment jsdom
// A background task ended (ADM-1360 release): the server's `system_event` message is drawn as one compact event card
// per task (`metadata.background_tasks`), in history and live, never as the person's own message.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@iconify/vue', () => ({ Icon: { props: ['icon'], template: '<i class="ic" :data-icon="icon" />' } }))
vi.mock('../../services/api', () => ({ default: { getConversationMessages: vi.fn() } }))

import BackgroundEventCard from './BackgroundEventCard.vue'
import ChatMessageList from './ChatMessageList.vue'
import { useChatStore } from '../../stores/useChatStore'
import { BACKGROUND_TASKS, createBackgroundTasks } from '@/stores/useBackgroundTasks'

class FakeResizeObserver { observe() {} disconnect() {} }
const ID = '9a1e5c7d-1111-4aaa-8bbb-000000000001'
const ID2 = '9a1e5c7d-1111-4aaa-8bbb-000000000002'
const failedCmd = { id: ID, kind: 'command', name: 'npm test', state: 'finished', status: 'failed', exit_code: 1, elapsed_s: 12,
  output_tail: 'Tests: 3 passed, 1 failed\nFAIL src/a.test.js\n', open: { type: 'output', handle: 'h1' } }
const doneAgent = { id: ID2, kind: 'subagent', name: 'Explore', state: 'finished', status: 'succeeded',
  output_tail: '', open: { type: 'conversation', conversation_id: '901' } }

beforeEach(() => { setActivePinia(createPinia()); vi.stubGlobal('ResizeObserver', FakeResizeObserver) })

describe('the background event card', () => {
  it('says what ended, its outcome and the last lines, styled as an event', () => {
    const w = mount(BackgroundEventCard, { props: { task: failedCmd } })
    expect(w.find('.bge-text').text()).toBe('Background command finished · npm test · failed (exit 1)')
    expect(w.classes()).toContain('failed')
    expect(w.find('.bge-tail').text()).toBe('Tests: 3 passed, 1 failed\nFAIL src/a.test.js')
    expect(w.find('.ic').attributes('data-icon')).toBe('lucide:square-terminal')
    expect(w.find('[data-test="bg-event-open"]').exists()).toBe(false)   // no panel outside Let's Code
  })

  it.each([
    [{ ...doneAgent }, 'Background agent finished · Explore · completed'],
    [{ id: 'm', kind: 'monitor', name: 'Wait for ready', state: 'finished', status: 'matched' }, 'Background monitor finished · Wait for ready · condition met'],
    [{ id: 'w', kind: 'wakeup', name: 'Check the deploy', state: 'finished', status: 'fired' }, 'Background wake-up fired · Check the deploy'],
    [{ id: 's', kind: 'server', name: 'Dev server', state: 'stopped', status: 'cancelled' }, 'Background server stopped · Dev server'],
    [{ id: 't', kind: 'command', name: 'build', state: 'finished', status: 'timed_out' }, 'Background command finished · build · timed out'],
  ])('%o reads "%s"', (task, title) => {
    const w = mount(BackgroundEventCard, { props: { task } })
    expect(w.find('.bge-text').text()).toBe(title)
  })

  it('Open on the Let\'s Code page opens the task in the drawer (its newest copy); a workflow run is a link', async () => {
    const ctl = createBackgroundTasks({ api: { list: () => Promise.resolve({ data: { tasks: [{ ...failedCmd, output_tail: 'newer' }] } }), stop: vi.fn() } })
    ctl.setConversation('77')
    await flushPromises()
    const w = mount(BackgroundEventCard, { props: { task: failedCmd }, global: { provide: { [BACKGROUND_TASKS]: ctl } } })
    await w.find('[data-test="bg-event-open"]').trigger('click')
    expect(ctl.opened.output_tail).toBe('newer')
    const wf = mount(BackgroundEventCard, {
      props: { task: { id: 'x', kind: 'workflow', name: 'Nightly', state: 'finished', status: 'succeeded', open: { type: 'workflow_run', workflow_run_id: 41 } } },
      global: { provide: { [BACKGROUND_TASKS]: ctl } } })
    expect(wf.find('a[data-test="bg-event-open"]').attributes('href')).toBe('/dashboard/workflow-runs?run=41')
  })
})

describe('the chat draws a system_event as event cards, in history and live', () => {
  it('maps metadata.background_tasks (every task of one wake) from a saved message', () => {
    const chat = useChatStore()
    const m = chat._mapServerMessage({ id: 5, role: 'user', kind: 'system_event', content: 'Background command finished',
      model_info: { authored_by: 'system' }, metadata: { background_task: failedCmd, background_tasks: [failedCmd, doneAgent] } }, 77)
    expect(m.kind).toBe('system_event')
    expect(m.backgroundTasks.map((t) => t.id)).toEqual([ID, ID2])
    const single = chat._mapServerMessage({ id: 6, role: 'user', kind: 'system_event', metadata: { background_task: failedCmd } }, 77)
    expect(single.backgroundTasks.map((t) => t.id)).toEqual([ID])
    expect(chat._mapServerMessage({ id: 7, role: 'user', content: 'hi' }, 77).backgroundTasks).toEqual([])
  })

  it('one card per task, never the person\'s bubble, although the server wrote the row', async () => {
    const chat = useChatStore()
    chat.messages = [
      { id: 'u1', role: 'user', content: 'run the tests in the background', status: 'done' },
      { id: 'e1', role: 'user', kind: 'system_event', authoredBy: 'system', content: 'Background command finished', status: 'done',
        backgroundTasks: [failedCmd, doneAgent] },
      { id: 'a1', role: 'assistant', content: 'One test fails; fixing it.', status: 'done' },
    ]
    const w = mount(ChatMessageList, { global: { stubs: { ChatMessage: true } } })
    await flushPromises()
    await flushPromises()
    const cards = w.findAll('[data-test="bg-event-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('npm test')
    expect(cards[1].text()).toContain('Explore')
    expect(w.findAllComponents({ name: 'ChatMessage' }).map((c) => c.props('message').id)).toEqual(['u1', 'a1'])
  })

  it('a woken turn\'s turn_started frame shows its event at once', () => {
    const chat = useChatStore()
    chat.conversationId = '77'
    chat._onEvent({ type: 'turn_started', conversation_id: 77, kind: 'system_event', message: 'Background command finished',
      message_id: 900, metadata: { background_tasks: [failedCmd] } })
    const ev = chat.messages.find((m) => m.kind === 'system_event')
    expect(ev).toMatchObject({ role: 'user', authoredBy: 'system', serverId: 900 })
    expect(ev.backgroundTasks.map((t) => t.id)).toEqual([ID])
    expect(chat.messages.filter((m) => m.role === 'user' && m.kind !== 'system_event')).toHaveLength(0)
  })
})
