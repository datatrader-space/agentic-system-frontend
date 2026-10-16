// @vitest-environment jsdom
//
// A project's own page (agentic-docs/CHAT_PROJECTS_PLAN.md, phase 3): its name, the instructions every chat in
// it is given, and its chats. Another person's project reads as one that does not exist.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const { notify } = vi.hoisted(() => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('../composables/useNotify', () => ({ notify }))

const { api } = vi.hoisted(() => ({
  api: {
    getChatProject: vi.fn(),
    getConversations: vi.fn(),
    updateChatProject: vi.fn(),
  },
}))
vi.mock('../services/api', () => ({ default: api }))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ params: { id: '7' }, query: {} }),
}))

import ProjectPage from './ProjectPage.vue'
import { useChatStore } from '../stores/useChatStore'

const mountP = async () => {
  const w = mount(ProjectPage, { global: { stubs: { RouterLink: RouterLinkStub, 'router-link': RouterLinkStub } } })
  await flushPromises()
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(api).forEach((fn) => fn.mockReset())
  push.mockClear()
  api.getChatProject.mockResolvedValue({ data: { id: 7, name: 'Amsal Foods', instructions: 'Quote in PKR.' } })
  api.getConversations.mockResolvedValue({ data: { results: [{ id: 41, title: 'Price list', agent_profile_name: 'Sales' }], count: 1 } })
})

describe('ProjectPage', () => {
  it('shows the name, the instructions and the chats', async () => {
    const w = await mountP()
    expect(w.find('[data-test="project-name"]').text()).toBe('Amsal Foods')
    expect(w.find('[data-test="project-instructions"]').element.value).toBe('Quote in PKR.')
    expect(w.findAll('[data-test="project-chat"]')).toHaveLength(1)
    expect(api.getConversations).toHaveBeenCalledWith(expect.objectContaining({ project: '7' }))
  })

  it('saves edited instructions', async () => {
    api.updateChatProject.mockResolvedValue({ data: { id: 7, name: 'Amsal Foods', instructions: 'Quote in USD.' } })
    const w = await mountP()
    await w.find('[data-test="project-instructions"]').setValue('Quote in USD.')
    await w.find('[data-test="save-instructions"]').trigger('click')
    await flushPromises()
    expect(api.updateChatProject).toHaveBeenCalledWith(7, { instructions: 'Quote in USD.' })
    expect(w.text()).toContain('Saved')
  })

  it('a project that is not the person\'s reads as one that does not exist', async () => {
    api.getChatProject.mockRejectedValue({ response: { status: 404 } })
    const w = await mountP()
    expect(w.text()).toContain('does not exist, or it is not yours')
  })

  it('New chat starts a chat inside this project, keeping the selected agent', async () => {
    const w = await mountP()
    useChatStore().selectedAgentId = '3163'
    await w.find('[data-test="project-new-chat"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/dashboard/chat/new', query: { project: 7, agent: '3163' } })
  })
})
