// @vitest-environment jsdom
// The bottom panel's tabs on a narrow screen (ADM-1267, 2026-11-17): at 375 px the seven names did not fit and the row
// scrolled sideways inside itself. Each tab now carries an icon, its name (kept for screen readers and in the title)
// and, for Problems, a count; the CSS shows the icons at 640 px and less and the names above.
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
// The panel imports Icon itself, so a global stub does not reach it: the module is replaced.
vi.mock('@iconify/vue', () => ({ Icon: { props: ['icon'], template: '<i class="ic" :data-icon="icon" />' } }))
import BottomPanel from './BottomPanel.vue'
import { LANGUAGE_SERVERS } from '@/stores/useLanguageServers'
import { DEBUGGER } from '@/stores/useDebugger'

function panel(problems = []) {
  return mount(BottomPanel, {
    props: { repoId: 16, ready: true },
    global: {
      stubs: { TerminalPanel: true, PreviewPanel: true, ProblemsPanel: true, DebugConsole: true },
      provide: { [LANGUAGE_SERVERS]: { problems: ref(problems), panel: ref({}) }, [DEBUGGER]: { panel: ref({}) } },
    },
  })
}

describe('the bottom panel tabs', () => {
  it('every tab has an icon, its name as text and as the title', () => {
    const w = panel()
    const tabs = w.findAll('.bp-tab')
    expect(tabs.map((t) => t.find('.bp-tab-t').text())).toEqual(
      ['Problems', 'References', 'Debug Console', 'Log', 'Activity', 'Terminal', 'Preview'])
    expect(tabs.map((t) => t.attributes('title'))).toEqual(
      ['Problems', 'References', 'Debug Console', 'Log', 'Activity', 'Terminal', 'Preview'])
    expect(tabs.every((t) => t.find('.ic').attributes('data-icon')?.startsWith('lucide:'))).toBe(true)
    expect(new Set(tabs.map((t) => t.find('.ic').attributes('data-icon'))).size).toBe(7)        // no two alike
    expect(tabs.every((t) => t.find('.ic').attributes('aria-hidden') === 'true')).toBe(true)
    w.unmount()
  })

  it('Problems shows its count beside the icon, and in its name', () => {
    const w = panel([{ path: 'a.ts', severity: 'error' }, { path: 'b.ts', severity: 'warning' }, { path: 'c.ts', severity: 'error' }])
    const problems = w.findAll('.bp-tab')[0]
    expect(problems.find('.bp-tab-t').text()).toBe('Problems (3)')
    expect(problems.find('.bp-tab-n').text()).toBe('3')
    expect(problems.find('.bp-tab-n').attributes('aria-hidden')).toBe('true')   // the name already says it
    expect(w.findAll('.bp-tab-n')).toHaveLength(1)
    w.unmount()
  })
})

// A phone (ADM-1330, live at 375 px 2026-11-25): the open panel is its own pane in place of the editor, one pane at a
// time, and its first row goes back to the editor (the chat). A wide screen has no such row.
describe('the panel as a phone pane', () => {
  function phonePanel(props = {}) {
    return mount(BottomPanel, {
      attachTo: document.body,
      props: { repoId: 16, ready: true, pane: true, collapsed: false, backLabel: 'Back to the chat', ...props },
      global: {
        stubs: { TerminalPanel: true, PreviewPanel: true, ProblemsPanel: true, DebugConsole: true },
        provide: { [LANGUAGE_SERVERS]: { problems: ref([]), panel: ref({}) }, [DEBUGGER]: { panel: ref({}) } },
      },
    })
  }

  it('open, its first row is Back with the label it is given and the tab it shows; Collapse is not offered twice', async () => {
    const w = phonePanel()
    await w.findAll('.bp-tab').find((t) => t.attributes('title') === 'Log').trigger('click')
    const back = w.find('[data-test="bp-back"]')
    expect(back.exists()).toBe(true)
    expect(back.text()).toBe('Back to the chat')
    expect(back.element.tagName).toBe('BUTTON')
    expect(w.find('.bp-pane-t').text()).toBe('Log')
    expect(w.find('.bp-collapse').exists()).toBe(false)
    expect(w.find('.bp').classes()).toContain('bp-pane')
    w.unmount()
  })

  it('Back asks to close the panel and keeps the focus on the tab that was open', async () => {
    const w = phonePanel()
    await w.findAll('.bp-tab').find((t) => t.attributes('title') === 'Activity').trigger('click')
    await w.find('[data-test="bp-back"]').trigger('click')
    expect(w.emitted('toggle')).toHaveLength(1)
    await w.setProps({ collapsed: true })
    expect(w.find('[data-test="bp-back"]').exists()).toBe(false)
    expect(w.find('.bp-collapse').exists()).toBe(true)                       // closed: the tab row and Expand
    expect(document.activeElement?.getAttribute('title')).toBe('Activity')
    w.unmount()
  })

  it('closed to its tab row, a tab asks to open it (as its own pane)', async () => {
    const w = phonePanel({ collapsed: true })
    expect(w.find('[data-test="bp-back"]').exists()).toBe(false)
    await w.findAll('.bp-tab').find((t) => t.attributes('title') === 'Problems').trigger('click')
    expect(w.emitted('toggle')).toHaveLength(1)
    w.unmount()
  })

  it('a wide screen (no pane) has no Back row, and keeps Collapse', () => {
    const w = phonePanel({ pane: false })
    expect(w.find('[data-test="bp-back"]').exists()).toBe(false)
    expect(w.find('.bp-collapse').exists()).toBe(true)
    expect(w.find('.bp').classes()).not.toContain('bp-pane')
    w.unmount()
  })
})
