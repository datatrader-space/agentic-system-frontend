// @vitest-environment jsdom
// The thread header's "New" button. Starting a new chat from INSIDE a thread must stay on the agent
// the user is already talking to — /dashboard/chat/new with no ?agent= makes the workspace fall
// through to the Platform Super Agent, which silently switched the user off their agent.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const { push, replace, route } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  route: { path: '/dashboard/chat/1308', params: { sessionId: '1308' }, query: {} },
}))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push, replace }),
  useRoute: () => route,
}))
vi.mock('../../services/api', () => ({ default: { getAgent: vi.fn() } }))

import ChatWorkspace from './ChatWorkspace.vue'
import { useChatStore } from '../../stores/useChatStore'

const AGENT = { id: 42, name: 'kurumera mcp agent' }
const SUPER = { id: 1, name: 'Platform Super Agent', is_platform_super_agent: true }

let chat
const setup = ({ selected = 42, agents = [AGENT, SUPER] } = {}) => {
  setActivePinia(createPinia())
  chat = useChatStore()
  chat.agents = agents
  chat.selectedAgentId = selected === null ? null : String(selected)
  chat.conversationId = '1308'
  chat.messages = [{ id: 'm1', role: 'user', content: 'run the registered script', status: 'done' }]
  // Network / socket surfaces the header test has no business touching.
  chat.loadAgents = vi.fn().mockResolvedValue(undefined)
  chat.openConversation = vi.fn().mockResolvedValue(undefined)
  chat.ensureSuperAgent = vi.fn().mockResolvedValue(SUPER)
  chat.prewarmAgent = vi.fn()
  chat.setAgent = vi.fn()
  chat.reset = vi.fn()
  // shallow: this component's own template renders; every child is stubbed.
  return mount(ChatWorkspace, { shallow: true, attachTo: document.body })
}

const clickNew = async (w) => {
  await w.find('.chat-actions .header-btn').trigger('click')
  await w.vm.$nextTick()
}

beforeEach(() => {
  push.mockClear()
  replace.mockClear()
  route.path = '/dashboard/chat/1308'
  route.params = { sessionId: '1308' }
  route.query = {}
})

describe('ChatWorkspace header "New"', () => {
  it('carries the current agent into the new chat', async () => {
    const w = setup()
    await clickNew(w)
    expect(chat.reset).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ path: '/dashboard/chat/new', query: { agent: '42' } })
  })

  it('keeps the plain new-chat route when no agent is selected', async () => {
    // currentAgent resolves THROUGH selectedAgentId, so with it unset there is nothing to carry
    // and the naked route (Platform Super Agent default) is the right destination.
    const w = setup({ selected: null })
    await clickNew(w)
    expect(push).toHaveBeenCalledWith('/dashboard/chat/new')
  })

  it('does not re-push when already on that agent\'s new chat', async () => {
    route.path = '/dashboard/chat/new'
    route.params = {}
    route.query = { agent: '42' }
    const w = setup()
    await clickNew(w)
    expect(chat.reset).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('pushes when the new-chat route carries a DIFFERENT agent', async () => {
    route.path = '/dashboard/chat/new'
    route.params = {}
    route.query = { agent: '1' }
    const w = setup()
    await clickNew(w)
    expect(push).toHaveBeenCalledWith({ path: '/dashboard/chat/new', query: { agent: '42' } })
  })
})
