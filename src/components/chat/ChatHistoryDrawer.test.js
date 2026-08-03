// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({
  default: { getConversations: vi.fn(() => Promise.resolve({ data: { results: [] } })) },
}))

import api from '../../services/api'
import ChatHistoryDrawer from './ChatHistoryDrawer.vue'
import { useChatStore } from '../../stores/useChatStore'

const now = new Date().toISOString()
const conv = (id, agentId, agentName, text) => ({
  id,
  agent_profile: agentId,
  agent_profile_name: agentName,
  updated_at: now,
  last_message: { content: text, created_at: now },
})

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
})

async function openDrawer(props = {}) {
  const chat = useChatStore()
  chat.agents = [{ id: 7, name: 'Web Builder' }, { id: 9, name: 'Research Bot' }]
  chat.selectedAgentId = '7'
  const wrapper = mount(ChatHistoryDrawer, {
    props: { open: true, ...props },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, chat }
}

describe('ChatHistoryDrawer — scoping', () => {
  it('defaults to the selected agent and requests only that agent’s chats', async () => {
    api.getConversations.mockResolvedValue({
      data: { results: [conv(1, 7, 'Web Builder', 'build me a landing page')] },
    })
    const { wrapper } = await openDrawer()

    expect(api.getConversations).toHaveBeenCalledWith(
      expect.objectContaining({ agent_profile_id: '7' })
    )
    expect(wrapper.find('.chd-chip').text()).toBe('Web Builder')
    expect(wrapper.findAll('.chd-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('build me a landing page')
  })

  it('re-fetches for the new agent when the selection changes while open', async () => {
    const { chat } = await openDrawer()
    api.getConversations.mockClear()

    chat.selectedAgentId = '9'
    await flushPromises()

    expect(api.getConversations).toHaveBeenCalledWith(
      expect.objectContaining({ agent_profile_id: '9' })
    )
  })

  it('widening to "All agents" drops the filter, shows agent names, and is remembered', async () => {
    const { wrapper } = await openDrawer()
    api.getConversations.mockResolvedValue({
      data: { results: [conv(2, 9, 'Research Bot', 'summarize this paper')] },
    })

    await wrapper.findAll('.chd-seg button')[1].trigger('click')
    await flushPromises()

    expect(api.getConversations.mock.calls.at(-1)[0].agent_profile_id).toBeUndefined()
    expect(wrapper.find('.chd-row-agent').text()).toBe('Research Bot')
    expect(localStorage.getItem('chat.historyScope')).toBe('all')
  })

  it('falls back to the global list when no agent is resolved yet', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = null
    mount(ChatHistoryDrawer, { props: { open: true } })
    await flushPromises()

    expect(api.getConversations.mock.calls[0][0].agent_profile_id).toBeUndefined()
  })
})

describe('ChatHistoryDrawer — paging', () => {
  it('shows a Load-more button with the remaining count when older pages exist', async () => {
    api.getConversations.mockResolvedValue({
      data: { count: 40, results: [conv(1, 7, 'Web Builder', 'hi')] },
    })
    const { wrapper } = await openDrawer()

    const more = wrapper.find('.chd-more')
    expect(more.exists()).toBe(true)
    expect(more.text()).toContain('Load 39 older')
  })

  it('hides the button once everything is loaded', async () => {
    api.getConversations.mockResolvedValue({
      data: { count: 1, results: [conv(1, 7, 'Web Builder', 'hi')] },
    })
    const { wrapper } = await openDrawer()
    expect(wrapper.find('.chd-more').exists()).toBe(false)
  })

  it('clicking it appends the next page and disables while in flight', async () => {
    api.getConversations.mockResolvedValueOnce({
      data: { count: 3, results: [conv(1, 7, 'Web Builder', 'one')] },
    })
    const { wrapper } = await openDrawer()
    expect(wrapper.findAll('.chd-row')).toHaveLength(1)

    let resolve
    api.getConversations.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    await wrapper.find('.chd-more').trigger('click')
    expect(wrapper.find('.chd-more').attributes('disabled')).toBeDefined()

    resolve({ data: { count: 3, results: [conv(2, 7, 'Web Builder', 'two')] } })
    await flushPromises()
    expect(wrapper.findAll('.chd-row')).toHaveLength(2)
    expect(api.getConversations.mock.calls.at(-1)[0].page).toBe(2)
  })

  it('while searching, says so instead of implying the whole archive was searched', async () => {
    api.getConversations.mockResolvedValue({
      data: { count: 40, results: [conv(1, 7, 'Web Builder', 'landing page')] },
    })
    const { wrapper } = await openDrawer()

    await wrapper.find('.chd-search input').setValue('zzz-no-match')
    expect(wrapper.find('.chd-empty').text()).toBe('No matches in the chats loaded so far.')
    expect(wrapper.find('.chd-more').text()).toContain('Load more to keep searching')
  })
})

describe('ChatHistoryDrawer — collapse behaviour', () => {
  it('is rendered but collapsed (and inert) when closed', async () => {
    const wrapper = mount(ChatHistoryDrawer, { props: { open: false } })
    await flushPromises()
    const aside = wrapper.find('aside')
    expect(aside.classes()).not.toContain('open')
    expect(aside.attributes('aria-hidden')).toBe('true')
    expect(api.getConversations).not.toHaveBeenCalled()   // no fetch while collapsed
  })

  it('collapses on outside click, but not on clicks inside it', async () => {
    const { wrapper } = await openDrawer()

    wrapper.find('.chd-search').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(wrapper.emitted('close')).toBeUndefined()

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('ignores mousedown on the trigger button — the trigger owns its own toggle', async () => {
    const { wrapper } = await openDrawer()
    const trigger = document.createElement('button')
    trigger.setAttribute('data-history-toggle', '')
    document.body.appendChild(trigger)

    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(wrapper.emitted('close')).toBeUndefined()
    trigger.remove()
  })

  it('collapses on Escape', async () => {
    const { wrapper } = await openDrawer()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('collapses when a turn starts streaming', async () => {
    const { wrapper, chat } = await openDrawer()
    chat.isStreaming = true
    await flushPromises()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('collapses when a new conversation starts', async () => {
    const { wrapper, chat } = await openDrawer()
    chat.conversationId = '42'
    await flushPromises()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits select with the conversation id and new-chat from the drawer button', async () => {
    api.getConversations.mockResolvedValue({ data: { results: [conv(1, 7, 'Web Builder', 'hi')] } })
    const { wrapper } = await openDrawer()

    await wrapper.find('.chd-row').trigger('click')
    expect(wrapper.emitted('select')[0]).toEqual([1])

    await wrapper.find('.chd-new').trigger('click')
    expect(wrapper.emitted('new-chat')).toHaveLength(1)
  })
})
