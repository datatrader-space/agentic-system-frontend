// @vitest-environment jsdom
// Opening a chat loads its video jobs and project only when the chat can have video work: video tools belong
// to the built-in Video Studio agent alone, so any other chat skips those calls (page-speed plan Phase 5
// item 3). Opening the video panel loads them too.
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ path: '/dashboard/chat/2830', params: { sessionId: '2830' }, query: {} }),
}))
vi.mock('../../services/api', () => ({ default: { getAgent: vi.fn(), get: vi.fn(() => Promise.resolve({ data: {} })) } }))

import ChatWorkspace from './ChatWorkspace.vue'
import { useChatStore } from '../../stores/useChatStore'
import { useVideoStore } from '../../stores/useVideoStore'

function setup(agent) {
  setActivePinia(createPinia())
  const chat = useChatStore()
  chat.agents = [agent]
  chat.selectedAgentId = String(agent.id)
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

describe('ChatWorkspace — video work loads only where it can exist', () => {
  it('a chat with the Video Studio agent loads its jobs and project, in one round', async () => {
    const { w, video } = setup({ id: 900, name: 'Video Studio', video_model: 86 })
    await flushPromises()
    expect(video.loadJobs).toHaveBeenCalledWith('2830')
    expect(video.loadProject).toHaveBeenCalledWith('2830')
    w.unmount()
  })

  it('a chat with any other agent makes no video calls, until the video panel opens', async () => {
    const { w, video } = setup({ id: 5, name: 'Sales' })
    await flushPromises()
    expect(video.loadJobs).not.toHaveBeenCalled()
    expect(video.loadProject).not.toHaveBeenCalled()
    video.panelOpen = true
    await flushPromises()
    expect(video.loadJobs).toHaveBeenCalledTimes(1)
    expect(video.loadProject).toHaveBeenCalledTimes(1)
    w.unmount()
  })
})
