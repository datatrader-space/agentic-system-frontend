// @vitest-environment jsdom
//
// CONNECTOR BUTTONS UNDER AN AGENT REPLY.
//
// CONNECT_SERVICE no longer blocks the run on a modal card: it returns a typed `chat_action` and the chat
// renders it as ONE button under the answer — Connect, Sign in again, or Assign to this agent. These pin
// what the user sees for each kind, that a click goes through the re-checking endpoint (never a URL the
// model wrote), that a finished connect resumes the conversation, and that someone who can't edit the agent
// is sent to its owner instead of being given a button that would fail.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({
  default: {
    connectorAction: vi.fn(),
    connectorActionStatus: vi.fn(),
  },
}))

import api from '../../services/api'
import ChatActionButtons from './ChatActionButtons.vue'
import { useChatStore } from '../../stores/useChatStore'

const action = (extra = {}) => ({
  id: 'a1', kind: 'connect', service: 'GitHub', target_kind: 'svc', target_id: 7, agent_id: 3163,
  agent_name: 'Store Agent', conversation_id: '42', auto_assign: false, reconnect: false, can_edit: true,
  label: 'Connect GitHub', connectors_url: '/dashboard/connectors', ...extra,
})

function reply (actions) {
  return { id: 'm2', role: 'assistant', status: 'done', content: 'GitHub is not connected.', chatActions: actions }
}

function mountIt (message) {
  const chat = useChatStore()
  chat.conversationId = '42'
  chat.messages = [{ id: 'm1', role: 'user', content: 'connect github' }, message]
  chat.sendMessage = vi.fn()
  return {
    chat,
    w: mount(ChatActionButtons, { props: { message }, global: { stubs: { RouterLink: RouterLinkStub } } }),
  }
}

describe('ChatActionButtons', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    api.connectorAction.mockReset()
    api.connectorActionStatus.mockReset()
    // On mount a reloaded button checks whether its job is already done — by default it is not.
    api.connectorActionStatus.mockResolvedValue({ data: { connected: false, assigned: false } })
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('renders the label the backend chose, one button per action', async () => {
    const { w } = mountIt(reply([action(), action({ id: 'a2', kind: 'assign', service: 'Jira',
      target_id: 8, label: 'Assign Jira to this agent' })]))
    await flushPromises()
    const labels = w.findAll('button.ca-btn').map((b) => b.text())
    expect(labels).toEqual(['Connect GitHub', 'Assign Jira to this agent'])
  })

  it('assign: one click assigns through the endpoint, shows the result and continues the conversation', async () => {
    api.connectorAction.mockResolvedValue({ data: { status: 'done', connected: true, assigned: true } })
    const { w, chat } = mountIt(reply([action({ kind: 'assign', label: 'Assign GitHub to this agent' })]))
    await flushPromises()
    await w.find('button.ca-btn').trigger('click')
    await flushPromises()
    expect(api.connectorAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'assign', agent_id: 3163, target_kind: 'svc', target_id: 7, conversation_id: '42' }))
    expect(w.find('.ca-done').text()).toContain('GitHub is assigned to Store Agent')
    expect(chat.sendMessage).toHaveBeenCalledWith("I've assigned GitHub to this agent. Please continue.")
  })

  it('connect: opens the provider, waits for the connection, then continues', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    vi.spyOn(window, 'open').mockReturnValue(popup)
    api.connectorAction.mockResolvedValue({ data: { status: 'authorize',
      authorize_url: 'https://github.com/login/oauth/authorize?x=1', auto_assign: true } })
    const { w, chat } = mountIt(reply([action({ auto_assign: true })]))
    await flushPromises()
    await w.find('button.ca-btn').trigger('click')
    await flushPromises()
    expect(window.open).toHaveBeenCalledTimes(1)                    // opened inside the click
    expect(popup.location.href).toBe('https://github.com/login/oauth/authorize?x=1')
    expect(w.find('.ca-hint').text()).toContain('Finish signing in to GitHub')

    // Connected but the promised assignment has not landed yet — keep waiting.
    api.connectorActionStatus.mockResolvedValueOnce({ data: { connected: true, assigned: false } })
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.find('.ca-done').exists()).toBe(false)

    api.connectorActionStatus.mockResolvedValueOnce({ data: { connected: true, assigned: true } })
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.find('.ca-done').text()).toContain('GitHub is connected and assigned to Store Agent')
    expect(chat.sendMessage).toHaveBeenCalledWith("I've connected GitHub. Please continue.")
  })

  it('a stale button answers "already done" without opening anything', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    vi.spyOn(window, 'open').mockReturnValue(popup)
    api.connectorAction.mockResolvedValue({ data: { status: 'done', connected: true, assigned: true } })
    const { w } = mountIt(reply([action()]))
    await flushPromises()
    await w.find('button.ca-btn').trigger('click')
    await flushPromises()
    expect(popup.close).toHaveBeenCalled()
    expect(w.find('.ca-done').exists()).toBe(true)
  })

  it('an old reply never resends — only the latest reply continues the conversation', async () => {
    api.connectorAction.mockResolvedValue({ data: { status: 'done', connected: true, assigned: true } })
    const msg = reply([action({ kind: 'assign' })])
    const { w, chat } = mountIt(msg)
    chat.messages.push({ id: 'm3', role: 'user', content: 'later' }, { id: 'm4', role: 'assistant', content: 'x' })
    await flushPromises()
    await w.find('button.ca-btn').trigger('click')
    await flushPromises()
    expect(w.find('.ca-done').exists()).toBe(true)
    expect(chat.sendMessage).not.toHaveBeenCalled()
  })

  it('without edit rights: no button, ask the owner, link to Connectors', async () => {
    const { w } = mountIt(reply([action({ kind: 'assign', can_edit: false })]))
    await flushPromises()
    expect(w.find('button.ca-btn').exists()).toBe(false)
    expect(w.find('.ca-owner').text()).toContain('Ask the owner of Store Agent to assign GitHub')
    expect(w.findComponent(RouterLinkStub).props('to')).toBe('/dashboard/connectors')
  })

  it('a reload shows ✓ for a job already done', async () => {
    api.connectorActionStatus.mockResolvedValue({ data: { connected: true, assigned: true } })
    const { w } = mountIt(reply([action({ kind: 'assign' })]))
    await flushPromises()
    expect(w.find('button.ca-btn').exists()).toBe(false)
    expect(w.find('.ca-done').exists()).toBe(true)
  })

  it('setup: a link to the Connectors page, never a key field in chat', async () => {
    const { w } = mountIt(reply([action({ kind: 'setup', service: 'Stripe', label: 'Set up Stripe' })]))
    await flushPromises()
    expect(w.find('button.ca-btn').exists()).toBe(false)
    const link = w.findComponent(RouterLinkStub)
    expect(link.props('to')).toBe('/dashboard/connectors')
    expect(link.text()).toContain('Set up Stripe')
    expect(w.find('input').exists()).toBe(false)
  })

  it('custom MCP by address: the click adds it, then waits on the server it created', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    vi.spyOn(window, 'open').mockReturnValue(popup)
    api.connectorAction.mockResolvedValue({ data: { status: 'authorize', authorize_url: 'https://mcp.acme.io/authorize?x=1',
      auto_assign: true, target_kind: 'mcp', target_id: 91, since: '2026-09-25T10:00:00+00:00' } })
    const { w, chat } = mountIt(reply([action({ target_kind: 'mcp_url', target_id: null, url: 'https://mcp.acme.io/mcp',
      service: 'mcp.acme.io', label: 'Connect mcp.acme.io', auto_assign: true })]))
    await flushPromises()
    expect(api.connectorActionStatus).not.toHaveBeenCalled()          // nothing to ask about before the click
    await w.find('button.ca-btn').trigger('click')
    await flushPromises()
    expect(api.connectorAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'connect', target_kind: 'mcp_url', url: 'https://mcp.acme.io/mcp' }))
    api.connectorActionStatus.mockResolvedValueOnce({ data: { connected: true, assigned: true } })
    await vi.advanceTimersByTimeAsync(2000)
    expect(api.connectorActionStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      target_kind: 'mcp', target_id: 91 }))
    expect(w.find('.ca-done').text()).toContain('mcp.acme.io is connected and assigned')
    expect(chat.sendMessage).toHaveBeenCalledWith("I've connected mcp.acme.io. Please continue.")
  })

  it('sign in again: waits for a sign-in NEWER than the click, not just "connected"', async () => {
    const popup = { closed: false, close: vi.fn(), location: { href: '' } }
    vi.spyOn(window, 'open').mockReturnValue(popup)
    api.connectorAction.mockResolvedValue({ data: { status: 'authorize', authorize_url: 'https://github.com/login/oauth/authorize',
      auto_assign: false, since: '2026-09-25T10:00:00+00:00' } })
    const { w, chat } = mountIt(reply([action({ reauthorize: true, label: 'Sign in to GitHub again' })]))
    await flushPromises()
    await w.find('button.ca-btn').trigger('click')
    await flushPromises()
    expect(api.connectorAction).toHaveBeenCalledWith(expect.objectContaining({ reauthorize: true }))
    api.connectorActionStatus.mockResolvedValueOnce({ data: { connected: true, assigned: true, renewed: false } })
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.find('.ca-done').exists()).toBe(false)                  // still the OLD sign-in
    expect(api.connectorActionStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      since: '2026-09-25T10:00:00+00:00' }))
    api.connectorActionStatus.mockResolvedValueOnce({ data: { connected: true, assigned: true, renewed: true } })
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.find('.ca-done').text()).toContain("signed in to GitHub again")
    expect(chat.sendMessage).toHaveBeenCalledWith("I've signed in to GitHub again. Please continue.")
  })

  it('an assign blocked server-side says why', async () => {
    api.connectorAction.mockRejectedValue({ response: { data: { error: "You can't change which connectors 'Store Agent' uses." } } })
    const { w } = mountIt(reply([action({ kind: 'assign' })]))
    await flushPromises()
    await w.find('button.ca-btn').trigger('click')
    await flushPromises()
    expect(w.find('.ca-err').text()).toContain("You can't change which connectors")
  })
})
