// @vitest-environment jsdom
// The main chat shows the agent's task list (TODO_WRITE) just above the composer, from the shared store, and only
// when there is one.
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
  chat.agents = [{ id: 3449, name: 'Helper' }]
  chat.selectedAgentId = '3449'
  chat.conversationId = '2830'
  chat.messages = [{ id: 'u1', role: 'user', content: 'plan the release', status: 'done' }]
  chat.loadAgents = vi.fn().mockResolvedValue(undefined)
  chat.openConversation = vi.fn().mockResolvedValue(undefined)
  chat.ensureSuperAgent = vi.fn().mockResolvedValue(null)
  chat.prewarmAgent = vi.fn()
  chat.setAgent = vi.fn()
  const video = useVideoStore()
  video.loadJobs = vi.fn().mockResolvedValue(undefined)
  video.loadProject = vi.fn().mockResolvedValue(null)
  const w = mount(ChatWorkspace, { shallow: true, attachTo: document.body })
  return { w, chat }
}

describe('ChatWorkspace: the task list', () => {
  it('is hidden until the agent writes one, then shows the store\'s list above the composer', async () => {
    const { w, chat } = setup()
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'ChatTaskList' }).exists()).toBe(false)
    chat._onEvent({ type: 'todo_update', conversation_id: 2830, todos: [{ content: 'Draft the notes', status: 'in_progress' }] })
    await w.vm.$nextTick()
    const list = w.findComponent({ name: 'ChatTaskList' })
    expect(list.exists()).toBe(true)
    expect(list.props('todos')).toEqual([{ content: 'Draft the notes', status: 'in_progress', activeForm: '' }])
    const footer = w.get('.chat-footer').element
    const tasksAt = [...footer.children].indexOf(w.get('.chat-tasks').element)
    const composerAt = [...footer.children].findIndex((el) => el.tagName.toLowerCase().includes('chat-composer'))
    expect(tasksAt).toBeGreaterThan(-1)
    expect(tasksAt).toBeLessThan(composerAt)
    w.unmount()
  })

  it('spins only while the chat\'s turn is live, and takes the settled list from the turn\'s final frame', async () => {
    const { w, chat } = setup()
    chat._onEvent({ type: 'todo_update', conversation_id: 2830, todos: [{ content: 'Draft the notes', status: 'in_progress' }] })
    chat.isStreaming = true
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'ChatTaskList' }).props('running')).toBe(true)
    chat.isStreaming = false
    chat._onEvent({ type: 'run_finished', conversation_id: '2830', status: 'completed',
      todos: [{ content: 'Draft the notes', status: 'stopped', reason: 'Stopped by you' }] })
    await w.vm.$nextTick()
    const list = w.findComponent({ name: 'ChatTaskList' })
    expect(list.props('running')).toBe(false)
    expect(list.props('todos')).toEqual([{ content: 'Draft the notes', status: 'stopped', activeForm: '', reason: 'Stopped by you' }])
    chat._onEvent({ type: 'run_finished', conversation_id: '9999', status: 'completed', todos: [] })
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'ChatTaskList' }).props('todos')).toHaveLength(1)   // another chat's list never lands here
    w.unmount()
  })
})
