// @vitest-environment jsdom
// The bottom panel's Background tab (ADM-1360 release): the Coding Agent's background tasks of the chat on screen, where
// the Let's Code page provides them (the top bar's own "Tasks" are pull-request tasks). It counts what still runs and
// draws the list (a lazy chunk) when first opened.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('@iconify/vue', () => ({ Icon: { props: ['icon'], template: '<i class="ic" :data-icon="icon" />' } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(), confirmState: { open: false } }))
vi.mock('@/composables/useNotify', () => ({ notify: { info: vi.fn(), error: vi.fn() } }))
import BottomPanel from './BottomPanel.vue'
import { BACKGROUND_TASKS, createBackgroundTasks } from '@/stores/useBackgroundTasks'

const stubs = { TerminalPanel: true, PreviewPanel: true, ProblemsPanel: true, DebugConsole: true }
const tasks = [
  { id: 'a', kind: 'command', name: 'npm test', state: 'running', open: { type: 'output' } },
  { id: 'b', kind: 'server', name: 'Dev server', state: 'running', open: { type: 'output' } },
  { id: 'c', kind: 'wakeup', name: 'Later', state: 'running', open: { type: 'schedule' } },
  { id: 'd', kind: 'command', name: 'lint', state: 'finished', status: 'succeeded', open: { type: 'output' } },
]

describe('the Background tab', () => {
  it('is not there when the page gives no background tasks', () => {
    const w = mount(BottomPanel, { props: { repoId: 16, ready: true }, global: { stubs } })
    expect(w.findAll('.bp-tab-t').map((t) => t.text()).some((x) => x.startsWith('Background'))).toBe(false)
    w.unmount()
  })

  it('counts what runs, and shows the list when opened', { timeout: 60000 }, async () => {
    const ctl = createBackgroundTasks({ api: { list: () => Promise.resolve({ data: { tasks } }), stop: vi.fn() } })
    ctl.setConversation('77')
    await flushPromises()
    const w = mount(BottomPanel, { props: { repoId: 16, ready: true }, global: { stubs, provide: { [BACKGROUND_TASKS]: ctl } } })
    const tab = w.findAll('.bp-tab').find((t) => t.find('.bp-tab-t').text().startsWith('Background'))
    expect(tab.find('.bp-tab-t').text()).toBe('Background (2 running)')
    expect(w.findAll('.bp-tab-t').map((t) => t.text())).not.toContain('Tasks')
    expect(tab.find('.bp-tab-n').text()).toBe('2')
    expect(tab.find('.ic').attributes('data-icon')).toBe('lucide:list-todo')
    await tab.trigger('click')
    // Running holds the three that run or wait; Finished 1 is closed until opened.
    await vi.waitFor(() => expect(w.findAll('[role="list"] li')).toHaveLength(3), { timeout: 20000 })
    expect(w.find('[data-test="bgt-finished-toggle"]').text()).toBe('Finished 1')
    expect(tab.attributes('aria-selected')).toBe('true')
    w.unmount()
  })
})
