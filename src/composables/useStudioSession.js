import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../stores/useChatStore'
import { useVideoStore } from '../stores/useVideoStore'
import api from '../services/api'
import { rememberStudioOrigin } from '../services/studioOrigins'

// Same built-in Studio agent and owner-scoped conversation path as Home. Never starts a job.
export function useStudioSession(kind, { needsModel = true, page = kind } = {}) {
  const route = useRoute(), router = useRouter(), chat = useChatStore(), video = useVideoStore()
  const user = inject('studioUser', ref(null))
  const ready = ref(false), loading = ref(true), error = ref('')
  let disposed = false, sequence = 0
  async function initialize() {
    const seq = ++sequence
    loading.value = true; ready.value = false; error.value = ''
    const cid = route.query.conversation ? String(route.query.conversation) : null
    if ((chat.isBusy || chat.hitlRequests.length || video.busy) && String(cid || '') !== String(chat.conversationId || '')) {
      error.value = 'Finish or stop the current request before opening a different session.'
      loading.value = false
      return
    }
    try {
      const [, response] = await Promise.all([chat.loadAgents(), api.getVideoStudioAgent()])
      if (disposed || seq !== sequence) return
      const card = response.data
      if (!card?.id) throw new Error('Video Studio is not available right now.')
      const index = chat.agents.findIndex(agent => String(agent.id) === String(card.id))
      if (index < 0) chat.agents.push(card); else chat.agents.splice(index, 1, { ...chat.agents[index], ...card })
      if (cid) {
        if (String(chat.conversationId || '') !== cid) {
          await chat.openConversation(cid)
          if (chat.error || String(chat.conversationId || '') !== cid) throw new Error('This session could not be opened. Check the link or try again.')
        }
      } else {
        chat.reset()
        chat.setAgent(String(card.id))
        video.project = null
        video.versions = []
      }
      if (disposed || seq !== sequence) return
      if (chat.selectedAgentId && !chat.agents.some(agent => String(agent.id) === String(chat.selectedAgentId))) {
        const { data } = await api.getAgent(chat.selectedAgentId)
        if (disposed || seq !== sequence) return
        if (data?.id) chat.agents.push(data)
      }
      chat.studioMode = video.studioMode
      video.setKind(kind)
      video.task = 'quick'
      if (String(video.conversationId || '') !== String(cid || '')) { video.project = null; video.versions = [] }
      video.conversationId = cid
      await Promise.all([video.loadCapabilities(chat.selectedAgentId), kind === 'image' ? video.loadImageCapabilities(chat.selectedAgentId) : Promise.resolve()])
      if (disposed || seq !== sequence) return
      if (needsModel && (kind === 'image' ? !video.image.models.length : !video.routes.length)) throw new Error(`No ${kind} model is available to this Studio session. Open Help or try again after a model is configured.`)
      ready.value = true
    } catch (cause) { if (!disposed && seq === sequence) error.value = cause.message || 'Could not open Video Studio. Try again.' }
    finally { if (!disposed && seq === sequence) loading.value = false }
  }
  watch(() => chat.conversationId, cid => {
    if (!ready.value || !cid || disposed) return
    video.conversationId = cid
    if (String(route.query.conversation || '') !== String(cid)) router.replace({ path: route.path, query: { ...route.query, conversation: String(cid) } })
  })
  watch(() => route.query.conversation, cid => { if (!loading.value && cid && String(cid) !== String(chat.conversationId || '')) initialize() })
  watch(() => [ready.value, user.value?.id, chat.conversationId], ([opened, person, cid]) => { if (opened && person && cid) rememberStudioOrigin(person, 'conversation', cid, page) })
  onMounted(initialize)
  onBeforeUnmount(() => { disposed = true; sequence++; chat.studioMode = '' })
  return { route, chat, video, ready, loading, error, initialize }
}
