// @vitest-environment jsdom
// The browser card in a NEW chat. When a new chat gets its id the address changes from /chat/new to
// /chat/<id>, and the app shell — which keys the chat view on the address — builds a fresh chat view and
// only then cleans up the old one. Seen live on 2026-10-07 (conversations 2636 and 2638): the old view's
// cleanup stopped the asking the new view had just started, so the agent browsed for a minute and the
// card appeared only after a reload.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const { route } = vi.hoisted(() => ({ route: { path: '/dashboard/chat/new', params: {}, query: {} } }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => route,
}))
vi.mock('../../services/api', () => ({
  default: { getAgent: vi.fn(), get: vi.fn(), post: vi.fn() },
}))

import api from '../../services/api'
import ChatWorkspace from './ChatWorkspace.vue'
import { useChatStore } from '../../stores/useChatStore'
import { useBrowserStore, POLL_MS } from '../../stores/useBrowserStore'

const SESSION = {
  session_id: 'bs_1', state: 'ACTIVE', site: 'en.wikipedia.org', address: 'https://en.wikipedia.org/wiki/Internet',
  watchable: true, action_count: 2, control: { holder: 'agent', epoch: 1, mine: false },
}
const asksAboutTheBrowser = () =>
  api.get.mock.calls.filter(([url]) => url === '/browser/sessions/current/').length

let chat, browser
const view = () => mount(ChatWorkspace, { shallow: true, attachTo: document.body })

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  api.get.mockReset()
  api.get.mockResolvedValue({ data: { session: null } })
  chat = useChatStore()
  browser = useBrowserStore()
  chat.agents = [{ id: 42, name: 'tester' }]
  chat.selectedAgentId = '42'
  chat.loadAgents = vi.fn().mockResolvedValue(undefined)
  chat.openConversation = vi.fn().mockResolvedValue(undefined)
  chat.ensureSuperAgent = vi.fn().mockResolvedValue(null)
  chat.prewarmAgent = vi.fn()
  chat.setAgent = vi.fn()
  chat.reset = vi.fn()
  route.path = '/dashboard/chat/new'
  route.params = {}
})
afterEach(() => { vi.useRealTimers() })

describe('the browser card in a new chat', () => {
  it('keeps being asked for after the chat view is re-created for the new address', async () => {
    const first = view()                               // /chat/new
    chat.messages = [{ id: 'm1', role: 'user', content: 'open three pages', status: 'done' }]
    chat.isStreaming = true                            // the turn begins; the chat has no id yet
    await first.vm.$nextTick()
    chat.conversationId = '2638'                       // the id arrives
    await first.vm.$nextTick()

    route.path = '/dashboard/chat/2638'                // the shell builds the new view first…
    route.params = { sessionId: '2638' }
    const second = view()
    first.unmount()                                    // …and only then cleans up the old one
    await vi.advanceTimersByTimeAsync(50)

    const before = asksAboutTheBrowser()
    api.get.mockResolvedValue({ data: { session: SESSION } })   // the agent opens its browser
    await vi.advanceTimersByTimeAsync(POLL_MS * 2 + 50)
    expect(asksAboutTheBrowser()).toBeGreaterThanOrEqual(before + 2)
    expect(browser.hasSession).toBe(true)
    second.unmount()
  })

  it('stops being asked for when the person leaves the chat', async () => {
    chat.conversationId = '2638'
    chat.isStreaming = true
    route.path = '/dashboard/chat/2638'
    route.params = { sessionId: '2638' }
    const only = view()
    await vi.advanceTimersByTimeAsync(POLL_MS + 50)
    expect(asksAboutTheBrowser()).toBeGreaterThanOrEqual(2)
    only.unmount()                                     // to another page: nothing replaced this view
    const settled = asksAboutTheBrowser()
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(asksAboutTheBrowser()).toBe(settled)
  })
})

// The place a person is sent to watch (`viewer.url` from the MCP tool): the chat, with `?browser=1`.
describe('a link that asks for the browser', () => {
  const arrive = async (query) => {
    chat.conversationId = '2638'
    route.path = '/dashboard/chat/2638'
    route.params = { sessionId: '2638' }
    route.query = query
    api.get.mockImplementation((url) => Promise.resolve(
      url.endsWith('/timeline/') ? { data: { actions: [] } } : { data: { session: SESSION } }))
    const w = view()
    await vi.advanceTimersByTimeAsync(50)
    return w
  }

  it('opens the pane once the chat\'s browser is known', async () => {
    const w = await arrive({ browser: '1' })
    expect(browser.hasSession).toBe(true)
    expect(browser.open).toBe(true)
    w.unmount()
  })

  it('does not reopen it after the person closes it', async () => {
    const w = await arrive({ browser: '1' })
    browser.close()
    browser.applySession({ ...SESSION, action_count: 9 })      // the browser moves on
    await vi.advanceTimersByTimeAsync(50)
    expect(browser.open).toBe(false)
    w.unmount()
  })

  it('an ordinary link to the chat leaves the pane closed', async () => {
    const w = await arrive({})
    expect(browser.hasSession).toBe(true)
    expect(browser.open).toBe(false)
    w.unmount()
  })
})
