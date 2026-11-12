// @vitest-environment jsdom
// The Coding Agent's chats are EDITOR tabs, as Claude Code's are in VS Code (ADM-1221, owner 2026-11-12: "want claude
// code chats as editor tabs"). The Let's Code page provides a chat-tab controller; the editor draws its tabs before the
// files, shows the chat (the page's "chat" slot) while a chat tab is in front, and keeps it mounted while a file is.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { CODING_CHAT_TABS, createCodingChatTabs } from '@/stores/useCodingChatTabs'

vi.mock('@/utils/lazyComponent', () => ({
  lazyComponent: () => ({ props: ['value', 'language'], template: '<div class="monaco-stub">{{ value }}</div>' }),
}))
vi.mock('../services/api', () => ({
  default: {
    getRepositoryFiles: vi.fn(() => Promise.resolve({ data: { entries: [] } })),
    getFileContent: vi.fn(() => Promise.resolve({ data: { content: 'print(1)\n' } })),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

function boundController() {
  const ctl = createCodingChatTabs()
  const handlers = {
    select: vi.fn(), newChat: vi.fn(), close: vi.fn(),
    title: (t) => t.label || 'New chat',
    state: (t) => t.state || 'idle',
    stateLabel: (t) => (t.state === 'working' ? 'Working' : 'Idle'),
    isActive: (t) => t.key === 'a',
  }
  ctl.bind(handlers)
  ctl.tabs.push({ key: 'a', id: '91', label: 'Add the cart', state: 'idle' })
  ctl.tabs.push({ key: 'b', id: '92', label: 'Fix the footer', state: 'working' })
  ctl.front = true
  return { ctl, handlers }
}

async function browser(ctl) {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  const w = mount(CodeBrowser, {
    props: { repositoryId: 4, systemId: 5, editable: true },
    slots: { chat: '<div class="fake-chat">the chat</div>' },
    global: {
      stubs: { Icon: true, SourceControlPanel: { template: '<div />', emits: ['open-diff', 'count'] } },
      provide: ctl ? { [CODING_CHAT_TABS]: ctl } : {},
    },
  })
  await flushPromises()
  return w
}

describe('CodeBrowser: the Coding Agent chats are editor tabs (ADM-1221)', () => {
  it('draws the chat tabs in the tab bar with their titles and what each is doing, the chat in front', async () => {
    const { ctl } = boundController()
    const w = await browser(ctl)
    const tabs = w.findAll('[data-test="cb-chat-tab"]')
    expect(tabs.map((t) => t.find('.tab-name').text())).toEqual(['Add the cart', 'Fix the footer'])
    expect(tabs[0].classes()).toContain('active')
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(tabs[0].find('[data-test="cb-chat-dot"]').exists()).toBe(false)         // idle: no dot
    expect(tabs[1].find('[data-test="cb-chat-dot"]').classes()).toContain('working')
    expect(w.find('[data-test="cb-chat-host"]').isVisible()).toBe(true)
    expect(w.find('.fake-chat').exists()).toBe(true)
    w.unmount()
  })

  it('a file opened comes in front; the chat stays mounted behind it; its tab brings it back', async () => {
    const { ctl, handlers } = boundController()
    const w = await browser(ctl)
    await w.vm.$.setupState.openFile('app.py')
    await flushPromises()
    expect(ctl.front).toBe(false)
    expect(w.find('.monaco-stub').exists()).toBe(true)
    expect(w.find('.fake-chat').exists()).toBe(true)                               // never unmounted: never stopped
    expect(w.find('[data-test="cb-chat-host"]').isVisible()).toBe(false)
    expect(w.findAll('[data-test="cb-chat-tab"]')[0].classes()).not.toContain('active')
    await w.findAll('[data-test="cb-chat-tab"]')[1].trigger('click')
    expect(handlers.select).toHaveBeenCalledWith(ctl.tabs[1])
    expect(ctl.front).toBe(true)
    w.unmount()
  })

  it('New chat and the close button go to the chat; closing never touches the file tabs', async () => {
    const { ctl, handlers } = boundController()
    const w = await browser(ctl)
    await w.find('[data-test="cb-new-chat"]').trigger('click')
    expect(handlers.newChat).toHaveBeenCalled()
    await w.findAll('[data-test="cb-chat-close"]')[0].trigger('click')
    expect(handlers.close).toHaveBeenCalledWith(ctl.tabs[0])
    expect(handlers.select).not.toHaveBeenCalled()                                 // the × does not open the tab
    w.unmount()
  })

  it('anywhere the page provides no chat (other uses of the editor), there are no chat tabs', async () => {
    const w = await browser(null)
    expect(w.find('[data-test="cb-chat-tab"]').exists()).toBe(false)
    expect(w.find('[data-test="cb-new-chat"]').exists()).toBe(false)
    expect(w.find('[data-test="cb-chat-host"]').isVisible()).toBe(false)
    w.unmount()
  })
})
