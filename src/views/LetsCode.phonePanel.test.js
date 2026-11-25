// @vitest-environment jsdom
// The full editor at phone width, one pane at a time (ADM-1330; live at 375 px 2026-11-25): the bottom panel open from a
// wide screen covered the Coding Agent chat's message box. At phone width the page opens with the panel closed to its
// tab row; a tab opens it as its own pane in place of the editor, and its Back row returns to the chat. A wide screen
// keeps the panel beside the editor, resizable, as before.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const route = reactive({ query: {}, params: {} })
const replace = vi.fn((to) => { route.query = to.query || {} })
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ replace, push: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}))
vi.mock('../services/api', () => {
  const calls = {}
  const api = new Proxy(calls, {
    get(t, k) {
      if (k === 'listProjects') {
        return (t[k] ||= vi.fn(() => Promise.resolve({ data: { projects: [{ repo_id: 14, system_id: 5, name: 'shop', phase: 'ready', clone_ready: true }] } })))
      }
      return (t[k] ||= vi.fn(() => Promise.resolve({ data: {} })))
    },
  })
  return { default: api }
})

import LetsCode from './LetsCode.vue'
import { useLayoutStore } from '@/stores/useLayoutStore'
import { setActivePinia, createPinia } from 'pinia'

let narrow = false
let listeners = []
beforeEach(() => {
  setActivePinia(createPinia())
  route.query = { project: '14', view: 'editor' }      // the full editor, on any screen
  replace.mockClear()
  listeners = []
  try { localStorage.clear() } catch { /* */ }
  window.matchMedia = vi.fn((q) => ({
    matches: narrow && q.includes('640'),
    addEventListener: (_e, f) => { if (q.includes('640')) listeners.push(f) },
    removeEventListener: vi.fn(),
  }))
})
afterEach(() => { delete window.matchMedia; narrow = false })

// The panel's own behaviour is BottomPanel's test; here only what the page gives it and does with its `toggle`.
const selectTab = vi.fn()
const showSide = vi.fn()
const showEditor = vi.fn()
const BottomPanel = {
  name: 'BottomPanel', props: ['collapsed', 'maximized', 'pane', 'backLabel', 'pipelineLog', 'activity', 'repoId', 'ready', 'agentCommands'],
  emits: ['toggle', 'maximize', 'ask-agent', 'open-file'],
  setup(props, { emit, expose }) {
    expose({ tabs: [{ id: 'log', label: 'Log', icon: 'lucide:scroll-text' }],
      selectTab: (id) => { selectTab(id); if (props.collapsed) emit('toggle') } })
  },
  template: '<div class="bp-stub" :data-collapsed="String(collapsed)"><button class="tab-stub" @click="$emit(\'toggle\')">tab</button></div>',
}
function mountPage() {
  return mount(LetsCode, { global: { stubs: {
    Icon: true, LetsCodeLight: true, BottomPanel,
    CodeBrowser: { name: 'CodeBrowser', setup(_p, { expose }) { expose({ showSide, showEditor }) }, template: '<div class="cb-stub" />' },
    UnifiedAgentChat: true, DeployButton: true,
    ProjectCommands: true, ProjectEnv: true, ProjectTasks: true, PipelineStepper: true, StatusPill: true, 'router-link': true,
  } } })
}
const panel = (w) => w.findComponent({ name: 'BottomPanel' })
const left = (w) => w.find('.ide-left')
const bottom = (w) => w.find('.ide-bottom')
const resizeTo = async (isNarrow) => { narrow = isNarrow; listeners.forEach((f) => f({ matches: isNarrow })); await flushPromises() }

describe('the full editor at phone width', () => {
  it('opens with the panel closed to its tab row, so the chat and its message box have the whole pane', async () => {
    narrow = true
    const w = mountPage()
    await flushPromises()
    expect(w.find('.lc-ide').exists()).toBe(true)
    expect(panel(w).props('collapsed')).toBe(true)
    expect(bottom(w).classes()).toEqual(expect.arrayContaining(['collapsed', 'pane']))
    expect(left(w).classes()).not.toContain('bottom-max')      // the editor (its chat) is shown
    expect(w.find('.bp-resize').exists()).toBe(false)
    expect(panel(w).props('pane')).toBe(true)
    w.unmount()
  })

  it('a panel left open on a wide screen closes when the screen turns phone-width, and is open again when wide', async () => {
    const w = mountPage()
    await flushPromises()
    expect(panel(w).props('collapsed')).toBe(false)              // a wide screen: open beside the editor
    await resizeTo(true)
    expect(panel(w).props('collapsed')).toBe(true)
    expect(left(w).classes()).not.toContain('bottom-max')
    await resizeTo(false)
    expect(panel(w).props('collapsed')).toBe(false)
    expect(left(w).classes()).not.toContain('bottom-max')
    w.unmount()
  })

  it('a tab opens the panel as its own pane in place of the editor; its Back closes it and the chat shows again', async () => {
    narrow = true
    const w = mountPage()
    await flushPromises()
    await w.find('.tab-stub').trigger('click')                   // BottomPanel asks to open (a tab, or its Expand)
    expect(panel(w).props('collapsed')).toBe(false)
    expect(left(w).classes()).toContain('bottom-max')            // one pane: the editor's column is the panel's
    expect(bottom(w).classes()).toContain('max')
    expect(w.find('.bp-resize').exists()).toBe(false)            // nothing to share, nothing to resize
    expect(panel(w).props('maximized')).toBe(true)
    expect(panel(w).props('backLabel')).toBe('Back to the editor')
    panel(w).vm.$emit('toggle')                                  // its Back row
    await flushPromises()
    expect(panel(w).props('collapsed')).toBe(true)
    expect(left(w).classes()).not.toContain('bottom-max')
    w.unmount()
  })

  it("the pane's Restore (the terminal's and the preview's) goes back to the editor too", async () => {
    narrow = true
    const w = mountPage()
    await flushPromises()
    panel(w).vm.$emit('toggle')
    await flushPromises()
    panel(w).vm.$emit('maximize')
    await flushPromises()
    expect(panel(w).props('collapsed')).toBe(true)
    expect(left(w).classes()).not.toContain('bottom-max')
    w.unmount()
  })
})

describe('a wide screen is unchanged', () => {
  it('the panel opens beside the editor, resizable, and only Maximize gives it the column', async () => {
    const w = mountPage()
    await flushPromises()
    expect(panel(w).props('collapsed')).toBe(false)
    expect(panel(w).props('pane')).toBe(false)
    expect(panel(w).props('maximized')).toBe(false)
    expect(left(w).classes()).not.toContain('bottom-max')
    expect(bottom(w).classes()).not.toContain('pane')
    expect(w.find('.bp-resize').exists()).toBe(true)
    panel(w).vm.$emit('maximize')
    await flushPromises()
    expect(left(w).classes()).toContain('bottom-max')
    expect(panel(w).props('maximized')).toBe(true)
    panel(w).vm.$emit('maximize')
    await flushPromises()
    expect(left(w).classes()).not.toContain('bottom-max')
    panel(w).vm.$emit('toggle')                                  // Collapse: the tab row only, beside the editor
    await flushPromises()
    expect(panel(w).props('collapsed')).toBe(true)
    expect(left(w).classes()).not.toContain('bottom-max')
    w.unmount()
  })
})

// ONE header row on a phone (ADM-1330): the chat pane is the conversation and its message box; the files and the editor,
// and the bottom panel, are their own panes reached from the header, each with Back. The app's own bar is not drawn.
describe('the one header row and its panes', () => {
  const phoneBar = (w) => w.findComponent({ name: 'LetsCodePhoneBar' })
  const tabsOf = (w) => w.vm.$.provides.codingChatTabs
  async function phonePage() {
    narrow = true
    const w = mountPage()
    await flushPromises()
    tabsOf(w).front = true                                         // the chat panel opens on its chat
    await flushPromises()
    return w
  }
  beforeEach(() => { selectTab.mockClear(); showSide.mockClear(); showEditor.mockClear() })

  it("shows the project in one row and hides the app's own bar while the editor is open on a phone", async () => {
    const w = await phonePage()
    expect(phoneBar(w).exists()).toBe(true)
    expect(phoneBar(w).props('project').name).toBe('shop')
    expect(phoneBar(w).props('view')).toBe('chat')
    expect(useLayoutStore().immersive).toBe(true)
    expect(w.find('.ide-editor').classes()).toContain('phone-chat')
    expect(w.find('[data-test="ide-files-head"]').exists()).toBe(false)
    await phoneBar(w).vm.$emit('back')
    await flushPromises()
    expect(w.find('.lc-ide').exists()).toBe(false)                   // the projects, with the app's bar again
    expect(useLayoutStore().immersive).toBe(false)
    w.unmount()
  })

  it("a wide screen keeps the app's bar and the editor's own bar (the row is hidden by its CSS there)", async () => {
    const w = mountPage()
    await flushPromises()
    expect(useLayoutStore().immersive).toBe(false)
    expect(w.find('.ide-bar').exists()).toBe(true)
    expect(w.find('.ide-editor').classes()).not.toContain('phone-chat')
    w.unmount()
  })

  it('leaving the page gives the app its bar back', async () => {
    const w = await phonePage()
    expect(useLayoutStore().immersive).toBe(true)
    w.unmount()
    expect(useLayoutStore().immersive).toBe(false)
  })

  it('Files opens the files and the editor as their own pane, with Back to the chat', async () => {
    const w = await phonePage()
    await phoneBar(w).vm.$emit('files')
    await flushPromises()
    expect(showSide).toHaveBeenCalledWith('files')
    expect(phoneBar(w).props('view')).toBe('files')
    expect(w.find('.ide-editor').classes()).not.toContain('phone-chat')
    const back = w.find('[data-test="ide-files-back"]')
    expect(back.text()).toBe('Back to the chat')
    await back.trigger('click')
    await flushPromises()
    expect(showEditor).toHaveBeenCalled()
    expect(phoneBar(w).props('view')).toBe('chat')
    expect(w.find('.ide-editor').classes()).toContain('phone-chat')
    // Files again from the files pane goes back too: the button is a switch.
    await phoneBar(w).vm.$emit('files')
    await flushPromises()
    await phoneBar(w).vm.$emit('files')
    await flushPromises()
    expect(phoneBar(w).props('view')).toBe('chat')
    w.unmount()
  })

  it('a file brought to the front (from the chat, a diff, a review) shows the files pane; a chat shows the chat', async () => {
    const w = await phonePage()
    tabsOf(w).front = false
    await flushPromises()
    expect(phoneBar(w).props('view')).toBe('files')
    tabsOf(w).front = true
    await flushPromises()
    expect(phoneBar(w).props('view')).toBe('chat')
    w.unmount()
  })

  it("a bottom panel tab from the header's More opens as its own pane; its Back returns to the chat", async () => {
    const w = await phonePage()
    expect(phoneBar(w).props('panelTabs').map((p) => p.id)).toEqual(['log'])
    await phoneBar(w).vm.$emit('panel', 'log')
    await flushPromises()
    expect(selectTab).toHaveBeenCalledWith('log')
    expect(phoneBar(w).props('view')).toBe('panel')
    expect(left(w).classes()).toContain('bottom-max')
    panel(w).vm.$emit('toggle')                                     // the panel's Back row
    await flushPromises()
    expect(phoneBar(w).props('view')).toBe('chat')
    expect(left(w).classes()).not.toContain('bottom-max')
    w.unmount()
  })

  it("the header's simple phone view switches to the light view and is remembered", async () => {
    const w = await phonePage()
    await phoneBar(w).vm.$emit('phone-view')
    await flushPromises()
    expect(localStorage.getItem('lc.view')).toBe('light')
    w.unmount()
  })
})

// The layout itself is CSS, which jsdom does not lay out (the screenshots at 375×812 and 375×667 show it). These pin the
// rules that keep the message box in view, so a later edit cannot drop one unnoticed.
describe('the phone layout rules', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const phoneCss = (file) => {
    const src = readFileSync(join(here, file), 'utf8')
    const style = src.slice(src.indexOf('<style'))
    return style.split('@media (max-width: 640px)').slice(1).join('\n')
  }
  it("the editor's column is the screen's height at phone width: no page scroll that hides the chat's foot", () => {
    const css = phoneCss('LetsCode.vue')
    expect(css).toMatch(/\.lc-ide \{ height: 100%; min-height: 0; \}/)
    expect(css).toMatch(/\.ide-left \{ min-height: 0; \}/)
  })
  it('the chat pane on a phone is the conversation and its message box: no bar, tab row, tab strip or chat head', () => {
    const css = phoneCss('LetsCode.vue')
    expect(css).toMatch(/\.ide-bar \{ display: none; \}/)
    expect(css).toMatch(/\.ide-editor\.phone-chat :deep\(\.cb-sidebar\), \.ide-editor\.phone-chat :deep\(\.editor-group > \.tab-bar\) \{ display: none; \}/)
    expect(css).toMatch(/\.ide-editor :deep\(\.uac-head\) \{ display: none; \}/)
    expect(css).toMatch(/\.ide-bottom\.pane\.collapsed \{ display: none; \}/)
  })
  it('the task list is one line when closed on a phone', () => {
    expect(phoneCss('../components/letscode/UnifiedAgentChat.vue')).toMatch(/\.uac-tasks :deep\(\.ctl:not\(\.open\) \.ctl-rail\) \{ display: none; \}/)
  })
  it('the message box never shrinks; the task list, a permission card and the branch bar scroll instead', () => {
    const css = phoneCss('../components/letscode/UnifiedAgentChat.vue')
    expect(css).toMatch(/\.uac-composer \{ flex: 0 0 auto; \}/)
    expect(css).toMatch(/\.uac-tasks \{ flex: 0 1 auto; min-height: 0;[^}]*overflow-y: auto;/)
    expect(css).toMatch(/\.uac > :deep\(\.pc\), \.uac > :deep\(\.cbb\) \{ flex-shrink: 1; min-height: 0; overflow-y: auto;/)
    expect(css).toMatch(/\.uac-box-top textarea \{ max-height: min\(200px, 15dvh\); \}/)
  })
})

describe("the phone header reads the wide bar's own state", () => {
  it('passes the pull request tasks waiting and the deploy state from those buttons, not a copy', async () => {
    narrow = true
    const status = { state: 'BUILDING', active: true, label: 'Building', tone: 'run' }
    const w = mount(LetsCode, { global: { stubs: {
      Icon: true, LetsCodeLight: true, BottomPanel,
      CodeBrowser: { name: 'CodeBrowser', setup(_p, { expose }) { expose({ showSide, showEditor }) }, template: '<div class="cb-stub" />' },
      UnifiedAgentChat: true, ProjectCommands: true, ProjectEnv: true, PipelineStepper: true, StatusPill: true, 'router-link': true,
      DeployButton: { name: 'DeployButton', setup(_p, { expose }) { expose({ status, openPanel: vi.fn() }) }, template: '<i />' },
      ProjectTasks: { name: 'ProjectTasks', setup(_p, { expose }) { expose({ waitingCount: 2, openPanel: vi.fn() }) }, template: '<i />' },
    } } })
    await flushPromises()
    const bar = w.findComponent({ name: 'LetsCodePhoneBar' })
    expect(bar.props('tasksWaiting')).toBe(2)
    expect(bar.props('deploy')).toEqual(status)
    w.unmount()
  })
})
