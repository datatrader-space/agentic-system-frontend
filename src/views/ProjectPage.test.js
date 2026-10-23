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
    getChatProjectFiles: vi.fn(),
    uploadChatProjectFile: vi.fn(),
    deleteGenericFile: vi.fn(),
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
  api.getChatProjectFiles.mockResolvedValue({ data: [{ id: 5, name: 'rates.pdf', status: 'ready' }] })
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

  it('lists the project files with whether each is searchable', async () => {
    const w = await mountP()
    const rows = w.findAll('[data-test="project-file"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('rates.pdf')
    expect(rows[0].text()).toContain('Searchable')
  })

  it('uploads picked files to this project and refreshes the list', async () => {
    api.uploadChatProjectFile.mockResolvedValue({ data: { id: 6 } })
    const w = await mountP()
    api.getChatProjectFiles.mockResolvedValue({ data: [{ id: 6, name: 'menu.md', status: 'ready' }, { id: 5, name: 'rates.pdf', status: 'ready' }] })
    const input = w.find('[data-test="project-file-input"]')
    const file = new File(['# Menu'], 'menu.md', { type: 'text/markdown' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()
    expect(api.uploadChatProjectFile).toHaveBeenCalledWith(7, file)
    expect(w.findAll('[data-test="project-file"]')).toHaveLength(2)
  })

  it('removes a file only after the second, explicit click', async () => {
    api.deleteGenericFile.mockResolvedValue({})
    const w = await mountP()
    await w.find('[data-test="remove-file"]').trigger('click')
    expect(api.deleteGenericFile).not.toHaveBeenCalled()
    await w.find('[data-test="confirm-remove-file"]').trigger('click')
    await flushPromises()
    expect(api.deleteGenericFile).toHaveBeenCalledWith(5)
    expect(w.findAll('[data-test="project-file"]')).toHaveLength(0)
  })
  it('polls a file that is still being read, stops when it is searchable, and never after leaving', async () => {
    vi.useFakeTimers()
    try {
      api.getChatProjectFiles
        .mockResolvedValueOnce({ data: [{ id: 5, name: 'rates.pdf', status: 'processing' }] })
        .mockResolvedValueOnce({ data: [{ id: 5, name: 'rates.pdf', status: 'ready' }] })
      const w = await mountP()
      expect(api.getChatProjectFiles).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(4000)
      expect(api.getChatProjectFiles).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(20000)
      expect(api.getChatProjectFiles).toHaveBeenCalledTimes(2)   // ready: polling stopped

      api.getChatProjectFiles.mockResolvedValue({ data: [{ id: 5, name: 'rates.pdf', status: 'processing' }] })
      const w2 = await mountP()
      const before = api.getChatProjectFiles.mock.calls.length
      w2.unmount()
      w.unmount()
      await vi.advanceTimersByTimeAsync(30000)
      expect(api.getChatProjectFiles.mock.calls.length).toBe(before)  // nothing after leaving
    } finally {
      vi.useRealTimers()
    }
  })
})
