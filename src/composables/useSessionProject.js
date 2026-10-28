import api from '../services/api'
import { useChatStore } from '../stores/useChatStore'
import { useVideoStore } from '../stores/useVideoStore'

// A Library file from another chat is used through a project (the Library's rule: a file is usable where it was made,
// in a project it is linked to, or anywhere when it is an Element). A Studio page links the files picked for it to
// its session's project WITHOUT pinning them, so they are not added to later video renders on their own.
export function useSessionProject() {
  const chat = useChatStore(), video = useVideoStore()
  async function sessionProject(title) {
    if (video.project?.project_id) return video.project
    const cid = await chat.ensureConversation()
    if (!cid) throw new Error('Could not start this Studio session.')
    const { data } = await api.get('/video/projects/', { params: { conversation_id: cid } })
    if (data?.project?.project_id) { video.project = data.project; return data.project }
    // brief.session: a page's own holder, kept out of the Project menus until it has scenes (live 2026-10-28).
    const created = await api.post('/video/projects/', { conversation_id: cid, title: String(title || 'Studio session').slice(0, 120), brief: { session: true } })
    video.project = created.data
    return created.data
  }
  async function linkFromLibrary(items, title) {
    const project = await sessionProject(title)
    for (const item of items) {
      const { data } = await api.post(`/video/projects/${project.project_id}/assets/`, { attachment_id: item.attachment_id, role: 'subject', source: 'library', pinned: false })
      video.project = data
    }
  }
  // What a job request adds so its files resolve: the session's chat, and its project when there is one.
  const session = cid => ({ conversation_id: cid, ...(video.project?.project_id ? { project_id: video.project.project_id } : {}) })
  return { sessionProject, linkFromLibrary, session }
}
