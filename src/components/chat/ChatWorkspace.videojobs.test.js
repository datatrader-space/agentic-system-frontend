// @vitest-environment jsdom
// A video estimate made from the WELCOME composer creates the conversation and a job, but no message. The
// estimate card lives in the thread's jobs tray, so the welcome screen must give way to the thread once the
// chat has a video job — keyed on messages alone the card stayed out of sight (live test 2026-10-16).
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ path: '/dashboard/chat/2830', params: { sessionId: '2830' }, query: {} }),
}))
vi.mock('../../services/api', () => ({ default: { getAgent: vi.fn(), get: vi.fn(() => Promise.resolve({ data: {} })) } }))

import ChatWorkspace from './ChatWorkspace.vue'
import { useChatStore } from '../../stores/useChatStore'
import { useVideoStore } from '../../stores/useVideoStore'

function setup() {
  setActivePinia(createPinia())
  const chat = useChatStore()
  chat.agents = [{ id: 3449, name: 'Video Gen Expert agent', video_model: 86 }]
  chat.selectedAgentId = '3449'
  chat.conversationId = '2830'
  chat.messages = []
  chat.loadAgents = vi.fn().mockResolvedValue(undefined)
  chat.openConversation = vi.fn().mockResolvedValue(undefined)
  chat.ensureSuperAgent = vi.fn().mockResolvedValue(null)
  chat.prewarmAgent = vi.fn()
  chat.setAgent = vi.fn()
  const video = useVideoStore()
  video.loadJobs = vi.fn().mockResolvedValue(undefined)
  video.loadProject = vi.fn().mockResolvedValue(null)
  const w = mount(ChatWorkspace, { shallow: true, attachTo: document.body })
  return { w, chat, video }
}

describe('ChatWorkspace — a chat with a video job is not empty', () => {
  it('shows the welcome screen for a chat with no messages and no jobs', async () => {
    const { w } = setup()
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'ChatWelcome' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'VideoJobsTray' }).exists()).toBe(false)
  })

  it('shows the thread, with the jobs tray, once the chat has an estimate', async () => {
    const { w, video } = setup()
    await w.vm.$nextTick()
    video._put({ job_id: 'j1', conversation_id: '2830', state: 'awaiting_authorization',
                 quote: { estimate_usd: '0.12', max_usd: '0.12', pricing_status: 'exact', adjustments: [] } })
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'ChatWelcome' }).exists()).toBe(false)
    expect(w.findComponent({ name: 'VideoJobsTray' }).exists()).toBe(true)
  })
})
