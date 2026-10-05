// @vitest-environment jsdom
// The usage line under the composer. It read "Session 7993.6k · $11.35" and was taken for what the reply
// above it had cost. It is every run in the conversation added up — in that case a week of runs — so the
// line has to say that it is the conversation's total so far.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ path: '/dashboard/chat/2118', params: { sessionId: '2118' }, query: {} }),
}))
vi.mock('../../services/api', () => ({ default: { getAgent: vi.fn() } }))

import ChatWorkspace from './ChatWorkspace.vue'
import { useChatStore } from '../../stores/useChatStore'

const mountWith = (messages) => {
  setActivePinia(createPinia())
  const chat = useChatStore()
  chat.agents = [{ id: 42, name: 'tester' }]
  chat.selectedAgentId = '42'
  chat.conversationId = '2118'
  chat.messages = messages
  chat.loadAgents = vi.fn().mockResolvedValue(undefined)
  chat.openConversation = vi.fn().mockResolvedValue(undefined)
  chat.ensureSuperAgent = vi.fn().mockResolvedValue(null)
  chat.prewarmAgent = vi.fn()
  chat.setAgent = vi.fn()
  chat.reset = vi.fn()
  return mount(ChatWorkspace, { shallow: true, attachTo: document.body })
}

describe('ChatWorkspace usage line', () => {
  it('says it is the whole conversation so far, not the last reply', () => {
    const w = mountWith([
      { id: 'a1', role: 'assistant', content: 'one', status: 'done', usage: { total_tokens: 366900, cost_usd: 0.49 } },
      { id: 'a2', role: 'assistant', content: 'two', status: 'done', usage: { total_tokens: 7626700, cost_usd: 10.86 } },
    ])
    const meter = w.find('.session-meter')
    expect(meter.exists()).toBe(true)
    const text = meter.text().replace(/\s+/g, ' ')
    expect(text).toMatch(/^This conversation so far: .+ tokens · \$11\.35 total$/)
    expect(text).not.toMatch(/^Session/)
    expect(meter.attributes('title')).toContain('not the cost of the last reply')
  })

  it('shows nothing before anything was spent', () => {
    const w = mountWith([{ id: 'u1', role: 'user', content: 'hi', status: 'done' }])
    expect(w.find('.session-meter').exists()).toBe(false)
  })
})
