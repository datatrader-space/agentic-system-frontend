// @vitest-environment jsdom
// In-chat agent picker: the default stays the Platform Super Agent, other agents are searchable, and
// switching mid-thread opens a NEW chat rather than re-pointing a conversation that already ran.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const { push, replace, route } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  route: { path: '/dashboard/chat/new', query: {} },
}))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push, replace }),
  useRoute: () => route,
}))

import AgentSwitcher from './AgentSwitcher.vue'
import { useChatStore } from '../../stores/useChatStore'

const SUPER = { id: 1, name: 'Platform Super Agent', description: 'Does everything',
                is_platform_super_agent: true }
const MINE = { id: 2, name: 'Research Agent', description: 'Reads papers' }
const MINE2 = { id: 3, name: 'Billing Bot', description: 'Invoices' }
const BUILTIN = { id: 4, name: 'Help Assistant', description: 'Product help', is_builtin_agent: true }

let chat
const setup = ({ agents = [SUPER, MINE, MINE2, BUILTIN], selected = 1, conversationId = null,
                 messages = [] } = {}) => {
  setActivePinia(createPinia())
  chat = useChatStore()
  chat.agents = agents
  chat.selectedAgentId = String(selected)
  chat.conversationId = conversationId
  chat.messages = messages
  chat.loadChattableAgents = vi.fn().mockResolvedValue(undefined)
  chat.setAgent = vi.fn()
  return mount(AgentSwitcher, { attachTo: document.body })
}

const openMenu = async (w) => {
  await w.find('[data-test="agent-switcher"]').trigger('click')
  await w.vm.$nextTick()
}
const rows = (w) => w.findAll('.as-item')
const rowNames = (w) => rows(w).map((r) => r.find('.as-item-name').text())

beforeEach(() => {
  push.mockClear()
  replace.mockClear()
  route.path = '/dashboard/chat/new'
  route.query = {}
})

describe('AgentSwitcher', () => {
  it('shows the selected agent, defaulting to the Super Agent', () => {
    const w = setup()
    expect(w.find('.as-name').text()).toBe('Platform Super Agent')
    expect(w.find('.as-chip').classes()).toContain('super')
  })

  it('is closed until clicked', async () => {
    const w = setup()
    expect(w.find('.as-menu').exists()).toBe(false)
    await openMenu(w)
    expect(w.find('.as-menu').exists()).toBe(true)
  })

  it('loads built-ins only when opened, not on mount', async () => {
    const w = setup()
    expect(chat.loadChattableAgents).not.toHaveBeenCalled()
    await openMenu(w)
    expect(chat.loadChattableAgents).toHaveBeenCalled()
  })

  it('groups the default apart from own and built-in agents', async () => {
    const w = setup()
    await openMenu(w)
    expect(w.findAll('.as-group').map((g) => g.text()))
      .toEqual(['Default', 'Your agents', 'Built-in'])
    expect(rowNames(w)).toEqual(['Platform Super Agent', 'Research Agent', 'Billing Bot', 'Help Assistant'])
  })

  it('marks the current agent as selected', async () => {
    const w = setup({ selected: 2 })
    await openMenu(w)
    const on = rows(w).filter((r) => r.classes().includes('on'))
    expect(on).toHaveLength(1)
    expect(on[0].find('.as-item-name').text()).toBe('Research Agent')
  })

  it('searches by name and by description', async () => {
    const w = setup()
    await openMenu(w)
    await w.find('.as-search input').setValue('research')
    expect(rowNames(w)).toEqual(['Research Agent'])
    await w.find('.as-search input').setValue('invoices')      // description match
    expect(rowNames(w)).toEqual(['Billing Bot'])
    await w.find('.as-search input').setValue('zzz')
    expect(rows(w)).toHaveLength(0)
    expect(w.find('.as-note').text()).toContain('No agent matches')
  })

  it('selects an agent in place when the chat has not started', async () => {
    const w = setup({ conversationId: null, messages: [] })
    await openMenu(w)
    await rows(w)[1].trigger('click')                          // Research Agent
    expect(chat.setAgent).toHaveBeenCalledWith('2')
    expect(push).not.toHaveBeenCalled()                        // no navigation: nothing to preserve yet
    // the choice is reflected in the URL so a refresh keeps it
    expect(replace).toHaveBeenCalledWith({ path: '/dashboard/chat/new', query: { agent: 2 } })
    expect(w.find('.as-menu').exists()).toBe(false)            // and the menu closes
  })

  it('opens a NEW chat when switching a thread that already has messages', async () => {
    const w = setup({ conversationId: 'c99', messages: [{ role: 'user', content: 'hi' }] })
    await openMenu(w)
    expect(w.find('.as-foot').text()).toContain('starts a new chat')   // said before the click
    await rows(w)[1].trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/dashboard/chat/new', query: { agent: 2 } })
    expect(chat.setAgent).not.toHaveBeenCalled()               // the live thread keeps its own agent
  })

  it('does not warn about a new chat before the first message', async () => {
    const w = setup({ conversationId: null, messages: [] })
    await openMenu(w)
    expect(w.find('.as-foot').exists()).toBe(false)
  })

  it('picking the already-selected agent is a no-op', async () => {
    const w = setup({ selected: 1, conversationId: 'c99', messages: [{ role: 'user' }] })
    await openMenu(w)
    await rows(w)[0].trigger('click')                          // the Super Agent, already current
    expect(push).not.toHaveBeenCalled()
    expect(chat.setAgent).not.toHaveBeenCalled()
  })

  it('closes on Escape and on an outside click', async () => {
    const w = setup()
    await openMenu(w)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('.as-menu').exists()).toBe(false)

    await openMenu(w)
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.as-menu').exists()).toBe(false)
  })

  it('keyboard navigation moves a cursor and Enter picks the highlighted row', async () => {
    const w = setup({ selected: 1 })
    await openMenu(w)
    const input = w.find('.as-search input')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(chat.setAgent).toHaveBeenCalledWith('2')            // second row: Research Agent
  })
})
