// @vitest-environment jsdom
//
// The sidebar's Projects (agentic-docs/CHAT_PROJECTS_PLAN.md), as the owner laid it out on 2026-10-16: a
// "Projects" header that opens and closes; inside it "New project" first, then the projects; a project opens
// to its chats; a chat opens its conversation. No Recent chats list and no "No chats yet" lines. Every change
// goes to the server; no native dialog is ever opened.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const { notify } = vi.hoisted(() => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('../../composables/useNotify', () => ({ notify }))

const { api } = vi.hoisted(() => ({
  api: {
    getChatProjects: vi.fn(),
    createChatProject: vi.fn(),
    updateChatProject: vi.fn(),
    deleteChatProject: vi.fn(),
    getConversations: vi.fn(),
    moveConversation: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversation: vi.fn(),
  },
}))
vi.mock('../../services/api', () => ({ default: api }))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ params: {}, query: {} }),
}))

import SidebarProjects from './SidebarProjects.vue'
import { useChatStore } from '../../stores/useChatStore'

const LAUNCH = { id: 7, name: 'Launch', chat_count: 1 }
const OATS = { id: 9, name: 'Oats', chat_count: 0 }
const INSIDE = { id: 41, title: 'Chat with Jira agent', last_message: { content: 'ADM has 965 issues' } }

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(api).forEach((fn) => fn.mockReset())
  Object.values(notify).forEach((fn) => fn.mockClear())
  push.mockClear()
  api.getChatProjects.mockResolvedValue({ data: [LAUNCH, OATS] })
  api.getConversations.mockResolvedValue({ data: { results: [INSIDE], count: 1 } })
  try { localStorage.removeItem('sidebar.projectsOpen') } catch (_e) { /* jsdom */ }
  vi.spyOn(window, 'prompt').mockImplementation(() => { throw new Error('no native dialogs') })
  vi.spyOn(window, 'confirm').mockImplementation(() => { throw new Error('no native dialogs') })
})

const mountS = async ({ open = true } = {}) => {
  const w = mount(SidebarProjects, { props: { collapsed: false }, attachTo: document.body })
  await flushPromises()
  if (open) {
    await w.find('[data-test="projects-toggle"]').trigger('click')
    await flushPromises()
  }
  return w
}

describe('SidebarProjects', () => {
  it('starts closed: one "Projects" header, nothing listed and nothing fetched', async () => {
    const w = await mountS({ open: false })
    expect(w.find('[data-test="projects-toggle"]').attributes('aria-expanded')).toBe('false')
    expect(w.text()).not.toContain('Launch')
    expect(w.text()).not.toContain('Recent chats')
    expect(w.text()).not.toContain('No chats yet')
    expect(api.getConversations).not.toHaveBeenCalled()
  })

  it('opened: "Create project" first, then the projects; nothing else on the header row', async () => {
    const w = await mountS()
    const text = w.text()
    expect(text.indexOf('Create project')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('Create project')).toBeLessThan(text.indexOf('Launch'))
    expect(text).toContain('Oats')
    expect(w.find('[data-test="projects-menu"]').exists()).toBe(false)
    expect(w.find('.sp-head [data-test="new-project"]').exists()).toBe(false)
    expect(text).not.toContain('Recent chats')
  })

  it('a project with more chats than shown offers "Show more", which loads the next five', async () => {
    api.getConversations.mockResolvedValue({
      data: { results: [1, 2, 3, 4, 5].map((i) => ({ id: 100 + i, title: `Chat ${i}` })), count: 8 } })
    const w = await mountS()
    await w.find('[data-test="project-7"] .sp-main').trigger('click')
    await flushPromises()
    expect(api.getConversations).toHaveBeenLastCalledWith(expect.objectContaining({ project: 7, page_size: 5 }))
    await w.find('[data-test="more-chats"]').trigger('click')
    await flushPromises()
    expect(api.getConversations).toHaveBeenLastCalledWith(expect.objectContaining({ project: 7, page_size: 10 }))
  })

  it('a project opens to its chats, labelled by what the person recognises, and a chat opens', async () => {
    const w = await mountS()
    await w.find('[data-test="project-7"] .sp-main').trigger('click')
    await flushPromises()
    expect(api.getConversations).toHaveBeenCalledWith(expect.objectContaining({ project: 7 }))
    expect(w.text()).toContain('ADM has 965 issues')     // not "Chat with Jira agent"
    await w.find('.sp-chats .sp-main').trigger('click')
    expect(push).toHaveBeenCalledWith('/dashboard/chat/41')
  })

  it('an empty project says nothing', async () => {
    api.getConversations.mockResolvedValue({ data: { results: [], count: 0 } })
    const w = await mountS()
    await w.find('[data-test="project-9"] .sp-main').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('No chats yet')
    expect(w.find('[data-test="more-chats"]').exists()).toBe(false)
  })

  it('creates a project in place, with no native dialog', async () => {
    api.createChatProject.mockResolvedValue({ data: { id: 8, name: 'Oats Labels', chat_count: 0 } })
    const w = await mountS()
    await w.find('[data-test="new-project"]').trigger('click')
    const input = w.find('[data-test="new-project-name"]')
    await input.setValue('Oats Labels')
    await input.element.form.dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(api.createChatProject).toHaveBeenCalledWith({ name: 'Oats Labels' })
    expect(w.text()).toContain('Oats Labels')
  })

  it('a chat in a project moves to another project from its menu', async () => {
    api.moveConversation.mockResolvedValue({ data: { id: 41, project: 9 } })
    const w = await mountS()
    await w.find('[data-test="project-7"] .sp-main').trigger('click')
    await flushPromises()
    await w.find('[data-test="chat-menu"]').trigger('click')
    await w.find('[data-test="move-to-9"]').trigger('click')
    await flushPromises()
    expect(api.moveConversation).toHaveBeenCalledWith(41, 9)
    expect(notify.success).toHaveBeenCalledWith('Moved to Oats')
  })

  it('a new chat in a project carries the project in the URL and keeps the selected agent', async () => {
    const w = await mountS()
    useChatStore().selectedAgentId = '3163'
    await w.find('[data-test="project-7"] [data-test="project-menu"]').trigger('click')
    const item = w.findAll('[role="menuitem"]').find((b) => b.text() === 'New chat in this project')
    await item.trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/dashboard/chat/new', query: { project: 7, agent: '3163' } })
  })

  it('deleting a project asks in place and moves its chats out by default', async () => {
    api.deleteChatProject.mockResolvedValue({ data: { archived: true } })
    const w = await mountS()
    await w.find('[data-test="project-7"] [data-test="project-menu"]').trigger('click')
    await w.findAll('[role="menuitem"]').find((b) => b.text() === 'Delete').trigger('click')
    await w.find('[data-test="confirm-delete-project"]').trigger('click')
    await flushPromises()
    expect(api.deleteChatProject).toHaveBeenCalledWith(7, false)
    expect(w.text()).not.toContain('Launch')
  })

  it('a new chat started from a project page is created inside that project', async () => {
    const chat = useChatStore()
    chat.selectedAgentId = 5
    chat.newChatProjectId = '7'
    const startAgentChat = vi.fn().mockResolvedValue({ data: { conversation_id: 99 } })
    const apiModule = (await import('../../services/api')).default
    apiModule.startAgentChat = startAgentChat
    chat._connect = vi.fn()
    chat.loadSessions = vi.fn()
    chat.loadAllSessions = vi.fn()
    await chat.ensureConversation()
    expect(startAgentChat).toHaveBeenCalledWith(5, null, '7')
  })

  it('a reset clears the project of the next new chat', () => {
    const chat = useChatStore()
    chat.newChatProjectId = '7'
    chat.reset()
    expect(chat.newChatProjectId).toBeNull()
  })
})
