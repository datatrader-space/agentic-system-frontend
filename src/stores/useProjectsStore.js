// Chat projects — folders of chats, private to their owner (agentic-docs/CHAT_PROJECTS_PLAN.md).
//
// The sidebar's Projects section reads from here. Every write goes to the server,
// which checks ownership in the query itself; this store only mirrors what the server returned, and
// refreshes the affected lists after a change rather than guessing at them.
import { defineStore } from 'pinia'
import api from '../services/api'
import { notify } from '../composables/useNotify'

const rowsOf = (data) => (Array.isArray(data) ? data : (data && data.results) || [])

//: How many chats a project shows when opened.
export const PROJECT_CHATS_SHOWN = 5

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    projects: [],
    loaded: false,
    chatsByProject: {},   // project id -> { items: [{ id, title, last_message, ... }], count }
  }),
  getters: {
    byId: (s) => (id) => s.projects.find((p) => String(p.id) === String(id)) || null,
  },
  actions: {
    async load() {
      try {
        const { data } = await api.getChatProjects()
        this.projects = rowsOf(data)
        this.loaded = true
      } catch (_e) {
        // The section stays empty; it never blocks the sidebar.
      }
    },
    // The project's newest chats, `limit` of them ("Show more" asks for more), and how many it has.
    async loadChats(projectId, limit = PROJECT_CHATS_SHOWN) {
      try {
        const { data } = await api.getConversations({ project: projectId, ordering: '-updated_at',
                                                       page_size: limit })
        const items = rowsOf(data).slice(0, limit)
        const count = (data && typeof data.count === 'number') ? data.count : items.length
        this.chatsByProject = { ...this.chatsByProject, [projectId]: { items, count } }
      } catch (_e) { /* keep the last list */ }
    },
    async create(name) {
      try {
        const { data } = await api.createChatProject({ name })
        this.projects = [data, ...this.projects]
        return data
      } catch (e) {
        notify.error(firstError(e) || 'Could not create the project.')
        return null
      }
    },
    async rename(id, name) {
      try {
        const { data } = await api.updateChatProject(id, { name })
        this.projects = this.projects.map((p) => (String(p.id) === String(id) ? { ...p, ...data } : p))
        return true
      } catch (e) {
        notify.error(firstError(e) || 'Could not rename the project.')
        return false
      }
    },
    async remove(id, deleteChats = false) {
      try {
        await api.deleteChatProject(id, deleteChats)
        this.projects = this.projects.filter((p) => String(p.id) !== String(id))
        const { [id]: _gone, ...rest } = this.chatsByProject
        this.chatsByProject = rest
        return true
      } catch (e) {
        notify.error('Could not delete the project.')
        return false
      }
    },
    // File a chat in a project (or take it out with null), then refresh every list it could appear in.
    async moveChat(conversationId, projectId, fromProjectId = null) {
      try {
        await api.moveConversation(conversationId, projectId)
        const refresh = [this.load()]
        if (projectId) refresh.push(this.loadChats(projectId))
        if (fromProjectId) refresh.push(this.loadChats(fromProjectId))
        await Promise.all(refresh)
        const to = projectId ? this.byId(projectId) : null
        notify.success(to ? `Moved to ${to.name}` : 'Removed from the project')
        return true
      } catch (_e) {
        notify.error('Could not move the chat.')
        return false
      }
    },
    async renameChat(conversationId, title, projectId = null) {
      try {
        await api.updateConversation(conversationId, { title })
        if (projectId) await this.loadChats(projectId)
        return true
      } catch (_e) {
        notify.error('Could not rename the chat.')
        return false
      }
    },
    async deleteChat(conversationId, projectId = null) {
      try {
        await api.deleteConversation(conversationId)
        await Promise.all([projectId ? this.loadChats(projectId) : null, this.load()])
        return true
      } catch (_e) {
        notify.error('Could not delete the chat.')
        return false
      }
    },
  },
})

function firstError(e) {
  const d = e && e.response && e.response.data
  if (!d || typeof d !== 'object') return ''
  const v = d.name || d.detail || d.error
  return Array.isArray(v) ? String(v[0] || '') : String(v || '')
}
