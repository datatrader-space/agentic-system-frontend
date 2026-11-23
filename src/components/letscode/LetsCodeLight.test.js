// @vitest-environment jsdom
// Let's Code's light project view for a phone (ADM-1330): the project's chats and what each is doing, Stop, the
// chat itself (the editor's own chat panel, so its approval card, Stop, task list and reply are the editor's), the
// preview link, and a notification when a chat starts waiting for the person while the page is in the background.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const chat = reactive({
  conversationId: null, isBusy: false, hitlRequests: [], parkedRuns: {},
  stop: vi.fn(), sendRaw: vi.fn(),
})
vi.mock('@/stores/useChatStore', () => ({ useChatStore: () => chat }))

const sessions = { needs_input: [], working: [] }
vi.mock('@/services/api', () => ({
  default: {
    getConversations: vi.fn(() => Promise.resolve({ data: [
      { id: 501, title: 'Add the cart' }, { id: 502, title: 'Fix the footer' }, { id: 503, title: 'New Conversation',
        last_message: { content: 'Write the tests' } }] })),
    getSessions: vi.fn(({ state }) => Promise.resolve({ data: { sessions: sessions[state] || [], next_cursor: null } })),
    getProjectPorts: vi.fn(() => Promise.resolve({ data: { ports: [{ port: 3000, listening: true }, { port: 5173, listening: false }] } })),
  },
}))
const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/composables/useConfirm', () => ({ confirm: confirmMock }))

import api from '@/services/api'
import LetsCodeLight from './LetsCodeLight.vue'
import { CODING_CHAT_TABS, createCodingChatTabs } from '@/stores/useCodingChatTabs'

const row = (cid, state, over = {}) => ({ run_id: `r${cid}`, conversation_id: cid, state, title: `Chat ${cid}`,
  summary: state === 'needs_input' ? 'Wants to run npm install' : 'Editing app.js', chat_url: '/dashboard/lets-code?project=14', ...over })

// v-show: the screen not shown has `display: none` (the view keeps the chat panel mounted under the list).
const shown = (w, sel) => !String(w.find(sel).attributes('style') || '').includes('display: none')

let ctl
function mountView(props = {}) {
  ctl = createCodingChatTabs()
  ctl.bind({ select: vi.fn(), newChat: vi.fn(), close: vi.fn(), title: () => 'Chat', state: () => 'idle',
    stateLabel: () => 'Idle', isActive: () => false })
  return mount(LetsCodeLight, {
    props: { project: { repo_id: 14, system_id: 5, name: 'shop', phase: 'ready' }, ready: true, ...props },
    global: { stubs: { Icon: true, StatusPill: true, UnifiedAgentChat: { template: '<div class="uac-stub" />' } },
              provide: { [CODING_CHAT_TABS]: ctl } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  chat.conversationId = null; chat.isBusy = false; chat.hitlRequests = []; chat.parkedRuns = {}
  sessions.needs_input = []; sessions.working = []
})
afterEach(() => { delete globalThis.Notification; vi.useRealTimers() })

describe('the light view', () => {
  it('lists the project chats, the ones that need the person first, with what each is doing', async () => {
    sessions.needs_input = [row(502, 'needs_input')]
    sessions.working = [row(501, 'working'), row(900, 'working', { chat_url: '/dashboard/lets-code?project=99' })]
    const w = mountView()
    await flushPromises()
    const rows = w.findAll('[data-test^="lcl-chat-"]')
    expect(rows.map((r) => r.attributes('data-test'))).toEqual(['lcl-chat-502', 'lcl-chat-501', 'lcl-chat-503'])
    expect(rows[0].text()).toContain('Needs you')
    expect(rows[0].text()).toContain('Wants to run npm install')
    expect(rows[1].text()).toContain('Working')
    expect(rows[2].text()).toContain('Write the tests')            // a chat with no title is named by its last message
    expect(w.find('[data-test="lcl-need-you"]').text()).toBe('1 chat needs you')
    // Only a running chat can be stopped; only a waiting one is answered.
    expect(rows[0].find('[data-test="lcl-answer"]').exists()).toBe(true)
    expect(rows[1].find('[data-test="lcl-answer"]').exists()).toBe(false)
    expect(rows[1].find('[data-test="lcl-stop"]').exists()).toBe(true)
    expect(rows[2].find('[data-test="lcl-stop"]').exists()).toBe(false)
    expect(w.find('[data-test="lcl-chat-900"]').exists()).toBe(false)  // another project's run is not listed
    w.unmount()
  })

  it('Answer opens that chat in the editor chat panel, on its tab', async () => {
    sessions.needs_input = [row(502, 'needs_input')]
    const w = mountView()
    await flushPromises()
    const select = vi.spyOn(ctl, 'select')
    await w.find('[data-test="lcl-chat-502"] [data-test="lcl-answer"]').trigger('click')
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: '502' }))
    expect(ctl.tabs.some((t) => t.id === '502')).toBe(true)
    expect(shown(w, '[data-test="lcl-chat"]')).toBe(true)
    expect(shown(w, '[data-test="lcl-list"]')).toBe(false)
    expect(w.find('.uac-stub').exists()).toBe(true)
    await w.find('[data-test="lcl-back-to-chats"]').trigger('click')
    expect(shown(w, '[data-test="lcl-list"]')).toBe(true)
    w.unmount()
  })

  it('stops the chat on screen with its own Stop, and another chat with stop_execution for it, after asking', async () => {
    vi.useFakeTimers()
    sessions.working = [row(501, 'working')]
    chat.conversationId = 502; chat.isBusy = true
    const w = mountView()
    await flushPromises()
    await w.find('[data-test="lcl-chat-502"] [data-test="lcl-stop"]').trigger('click')
    await flushPromises()
    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(chat.stop).toHaveBeenCalledTimes(1)
    await w.find('[data-test="lcl-chat-501"] [data-test="lcl-stop"]').trigger('click')
    await flushPromises()
    expect(chat.sendRaw).toHaveBeenCalledWith({ type: 'stop_execution', conversation_id: '501' })
    w.unmount()
  })

  it('does not stop when the person cancels the question', async () => {
    sessions.working = [row(501, 'working')]
    confirmMock.mockResolvedValueOnce(false)
    const w = mountView()
    await flushPromises()
    await w.find('[data-test="lcl-chat-501"] [data-test="lcl-stop"]').trigger('click')
    await flushPromises()
    expect(chat.sendRaw).not.toHaveBeenCalled()
    expect(chat.stop).not.toHaveBeenCalled()
    w.unmount()
  })

  it('links each running port to the preview page, and only those', async () => {
    const w = mountView()
    await flushPromises()
    const links = w.findAll('[data-test="lcl-preview-link"]')
    expect(links).toHaveLength(1)
    expect(links[0].attributes('href')).toBe('/preview/lets-code/14/3000')
    expect(links[0].attributes('target')).toBe('_blank')
    expect(links[0].text()).toContain('Open port 3000')
    w.unmount()
  })

  it('asks for no ports and says why while the project is not ready', async () => {
    const w = mountView({ ready: false })
    await flushPromises()
    expect(api.getProjectPorts).not.toHaveBeenCalled()
    expect(w.text()).toContain('The running app shows here once the project is ready.')
    expect(w.find('[data-test="lcl-new-chat"]').attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it('opens on the chat the address names', async () => {
    const w = mountView({ chatId: '501' })
    await flushPromises()
    expect(shown(w, '[data-test="lcl-chat"]')).toBe(true)
    w.unmount()
  })

  it('Full editor and Projects are the page\'s to do', async () => {
    const w = mountView()
    await flushPromises()
    await w.find('[data-test="lcl-full-editor"]').trigger('click')
    await w.find('[data-test="lcl-projects"]').trigger('click')
    expect(w.emitted('full-editor')).toHaveLength(1)
    expect(w.emitted('back')).toHaveLength(1)
    w.unmount()
  })

  it('raises a browser notification when a chat starts waiting while the page is in the background', async () => {
    const made = []
    globalThis.Notification = class { constructor(title, opts) { made.push({ title, ...opts }) } }
    globalThis.Notification.permission = 'granted'
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    const w = mountView()
    await flushPromises()
    expect(made).toEqual([])                                         // nothing waited when the page opened
    chat.conversationId = 501
    chat.hitlRequests = [{ request_id: 'h1' }]                        // the chat on screen now asks
    await flushPromises()
    expect(made).toHaveLength(1)
    expect(made[0].title).toBe('The Coding Agent needs you')
    expect(made[0].tag).toBe('needs-501')
    w.unmount()
  })

  it('does not notify what already waited when the page opened', async () => {
    const made = []
    globalThis.Notification = class { constructor(title, opts) { made.push({ title, ...opts }) } }
    globalThis.Notification.permission = 'granted'
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    sessions.needs_input = [row(502, 'needs_input')]
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-test="lcl-need-you"]').exists()).toBe(true)
    expect(made).toEqual([])
    w.unmount()
  })

  it('offers to turn notifications on only while the browser has not been asked', async () => {
    globalThis.Notification = class {}
    globalThis.Notification.permission = 'default'
    globalThis.Notification.requestPermission = vi.fn(() => {
      globalThis.Notification.permission = 'granted'
      return Promise.resolve('granted')
    })
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-test="lcl-notify"]').exists()).toBe(true)
    await w.find('[data-test="lcl-notify"] button').trigger('click')
    await flushPromises()
    expect(globalThis.Notification.requestPermission).toHaveBeenCalled()
    expect(w.find('[data-test="lcl-notify"]').exists()).toBe(false)
    w.unmount()
  })
})
