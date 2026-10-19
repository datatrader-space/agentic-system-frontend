<template>
  <section class="studio" aria-label="Video Studio" data-test="video-studio">
    <header class="studio-header">
      <div class="studio-brand"><span class="studio-icon" aria-hidden="true">▶</span><div><p class="eyebrow">CREATE · REFINE · EXPORT</p><h1>Video Studio</h1></div></div>
      <div class="header-actions">
        <button type="button" class="button" :aria-expanded="libraryOpen" @click="libraryOpen = !libraryOpen">My projects</button>
        <button type="button" class="button" :disabled="loading || chat.isBusy || video.busy || refreshing" @click="newVideo">New video</button>
        <button type="button" class="button" @click="backToChat">Back to chat</button>
      </div>
    </header>

    <p v-if="loading" class="studio-status" role="status">Opening your video workspace…</p>
    <div v-else-if="error" class="studio-status" role="alert"><p>{{ error }}</p><button class="button" @click="initialize">Try again</button></div>
    <template v-else>
      <section v-if="libraryOpen" class="library" aria-label="Saved video projects">
        <div class="section-heading"><div><h2>My projects</h2><p>Pick up where you left off.</p></div><button class="button" @click="refreshLibrary">Refresh</button></div>
        <p v-if="libraryError" role="alert">{{ libraryError }}</p>
        <p v-else-if="!projects.length" class="muted">Your saved story projects will appear here.</p>
        <div class="project-list"><button v-for="p in projects" :key="p.project_id" type="button" class="project-card" :disabled="openingProject || chat.isBusy || video.busy || refreshing || !hasVideoAgent" @click="openProject(p)">
          <span class="project-symbol" aria-hidden="true">▤</span><strong>{{ p.title }}</strong><span>{{ p.aspect_ratio || 'Video project' }} · {{ dateLabel(p.updated_at) }}</span>
        </button></div>
      </section>

      <div class="studio-mobile-tabs" role="group" aria-label="Studio view">
        <button v-for="t in mobileTabs" :key="t.value" class="button" :class="{ selected: mobileTab === t.value }" :aria-pressed="mobileTab === t.value" @click="mobileTab = t.value">{{ t.label }}</button>
      </div>
      <div class="studio-grid" :class="{ 'assistant-open': assistantOpen }">
        <section class="create-pane" :class="{ 'mobile-hidden': mobileTab !== 'create' }" aria-label="Create a video">
          <div class="section-heading"><div><p class="eyebrow">YOUR NEXT VIDEO</p><h2>What will you create?</h2><p>Start with an idea, an image or footage.</p></div></div>
          <label class="agent-field"><span>Video agent</span><select :value="chat.selectedAgentId" :disabled="!!chat.conversationId || chat.isBusy || video.busy" @change="selectAgent($event.target.value)">
            <option value="" disabled>Choose a video agent</option><option v-for="a in videoAgents" :key="a.id" :value="String(a.id)">{{ a.name }}</option>
          </select></label>
          <p class="agent-note" v-if="chat.conversationId">This session uses {{ chat.currentAgent?.name || 'its original agent' }}. Start a new video to switch agents.</p>
          <div v-if="!hasVideoAgent" class="setup-note"><h3>Choose an agent with video generation</h3><p>Assign a video model to an agent to start creating. Saved projects remain available through your account.</p><router-link to="/dashboard/agents" class="button">Manage agents</router-link></div>
          <fieldset v-else class="create-controls" :disabled="chat.isBusy || video.busy || openingProject">
            <legend class="sr-only">Video creation controls</legend>
            <VideoComposerPanel :draft="video.studioDraft" ensure-project @done="created">
              <label class="prompt-field"><span>{{ video.task === 'story' ? 'Describe your story' : video.task === 'edit' ? 'What would you like to change?' : 'Describe your video' }}</span>
                <textarea v-model="video.studioDraft" rows="4" placeholder="A slow camera move around my product, with soft studio lighting…" data-test="studio-prompt"></textarea>
              </label>
            </VideoComposerPanel>
          </fieldset>
          <p v-if="chat.isBusy" class="agent-note" role="status">The assistant is preparing your request. Follow its response in Assistant.</p>
          <section class="render-jobs" v-if="sessionJobs.length" aria-label="Video estimates and renders">
            <h3>Estimates &amp; renders</h3><VideoJobCard v-for="j in sessionJobs" :key="j.job_id" :job="j" in-studio @open="mobileTab = 'workspace'" />
          </section>
        </section>

        <section class="workspace-pane" :class="{ 'mobile-hidden': mobileTab !== 'workspace' }" aria-label="Project workspace">
          <div class="workspace-toolbar"><span>PROJECT WORKSPACE</span><button type="button" class="button" :aria-expanded="assistantOpen" @click="assistantOpen = !assistantOpen">{{ assistantOpen ? 'Hide assistant' : 'Open assistant' }}</button></div>
          <VideoPanel />
        </section>

        <section v-show="assistantOpen || mobileTab === 'assistant'" class="assistant-pane" :class="{ 'mobile-hidden': mobileTab !== 'assistant' }" aria-label="Video assistant">
          <div class="section-heading"><div><h2>Assistant</h2><p>Direct the work. Keep the project in view.</p></div><button class="button" @click="assistantOpen = false; mobileTab = 'workspace'" aria-label="Close assistant">×</button></div>
          <div class="assistant-history"><ChatMessageList v-if="chat.messages.length" /><div v-else class="assistant-empty"><h3>Your creative partner</h3><p>Ask for a scene plan, refine a shot, or explain an edit. Your conversation stays with this session.</p></div></div>
          <p v-if="chat.error" class="assistant-error" role="alert">{{ chat.error }}</p>
          <form class="assistant-form" @submit.prevent="sendAssistant">
            <label class="sr-only" for="studio-assistant-prompt">Message the video assistant</label>
            <textarea id="studio-assistant-prompt" v-model="assistantDraft" rows="3" placeholder="Change only scene 2…" :disabled="!hasVideoAgent"></textarea>
            <button v-if="chat.isBusy" type="button" class="button" @click="chat.stop()">Stop assistant</button>
            <button v-else type="submit" class="button primary" :disabled="!assistantDraft.trim() || !hasVideoAgent">Send message</button>
          </form>
        </section>
      </div>
    </template>
    <HITLModal :requests="chat.hitlRequests" :show-stop="true" @respond="chat.respondHitl" @dismiss="chat.dismissHitl" @skip="chat.skipHitl" @stop="chat.stop" />
    <FullDocCostCard />
    <ProviderSwitchDialog />
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import { useChatStore } from '../stores/useChatStore'
import { useVideoStore } from '../stores/useVideoStore'
import { useCanvasStore } from '../stores/useCanvasStore'
import { notify } from '../composables/useNotify'
import VideoComposerPanel from '../components/video/VideoComposerPanel.vue'
import VideoJobCard from '../components/video/VideoJobCard.vue'
import VideoPanel from '../components/video/VideoPanel.vue'
import ChatMessageList from '../components/chat/ChatMessageList.vue'
import HITLModal from '../components/HITLModal.vue'
import FullDocCostCard from '../components/chat/FullDocCostCard.vue'
import ProviderSwitchDialog from '../components/chat/ProviderSwitchDialog.vue'

const route = useRoute()
const router = useRouter()
const chat = useChatStore()
const video = useVideoStore()
const canvas = useCanvasStore()
const previousModes = { image: chat.imageMode, canvas: canvas.mode }
const loading = ref(true)
const error = ref('')
const projects = ref([])
const libraryOpen = ref(false)
const libraryError = ref('')
const openingProject = ref(false)
const assistantOpen = ref(false)
const assistantDraft = ref('')
const mobileTab = ref('create')
const mobileTabs = [{ value: 'create', label: 'Create' }, { value: 'workspace', label: 'Workspace' }, { value: 'assistant', label: 'Assistant' }]
const videoAgents = computed(() => chat.agents.filter((a) => a.video_model))
const hasVideoAgent = computed(() => !!chat.currentAgent?.video_model)
const sessionJobs = computed(() => video.jobsFor(chat.conversationId).slice().reverse())
let pollTimer
const refreshing = ref(false)
let disposed = false

function dateLabel(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
async function refreshLibrary() {
  libraryError.value = ''
  try { projects.value = (await api.get('/video/projects/')).data.projects || [] }
  catch { libraryError.value = 'Could not load your projects. Try refreshing.' }
}
async function refreshSession() {
  if (!chat.conversationId || refreshing.value || disposed) return
  refreshing.value = true
  try {
    await video.loadJobs(chat.conversationId)
    await video.loadProject(chat.conversationId)
  } finally { refreshing.value = false }
}
async function initialize() {
  loading.value = true
  error.value = ''
  try {
    const cid = route.query.conversation || chat.conversationId
    const agentId = route.query.agent || chat.selectedAgentId
    chat.imageMode = false
    canvas.mode = false
    video.mode = false
    video.reset()
    await chat.loadAgents()
    if (disposed) return
    if (cid) {
      const alreadyLoaded = String(chat.conversationId) === String(cid) && (chat.messages.length || chat._conn)
      await chat.openConversation(String(cid))
      if (!alreadyLoaded && chat.error) throw new Error('This video session could not be opened. Return to chat or try again.')
    } else if (agentId) {
      if (!chat.agents.some((a) => String(a.id) === String(agentId))) {
        const { data } = await api.getAgent(agentId)
        if (data?.id) chat.agents.push(data)
      }
      chat.setAgent(String(agentId))
    } else if (videoAgents.value.length) chat.setAgent(String(videoAgents.value[0].id))
    if (disposed) return
    // Shared or hidden agents may be absent from the ordinary agent library. Fetch only the session's assigned agent.
    if (chat.selectedAgentId && !chat.agents.some((a) => String(a.id) === String(chat.selectedAgentId))) {
      const { data } = await api.getAgent(chat.selectedAgentId)
      if (data?.id) chat.agents.push(data)
    }
    if (disposed) return
    await refreshSession()
    if (!disposed) await refreshLibrary()
  } catch (e) { error.value = e.message || 'Could not open Video Studio.' }
  finally { loading.value = false }
}
function selectAgent(id) {
  if (chat.conversationId || chat.isBusy) return
  video.refs = []
  video.routeId = ''
  chat.setAgent(id)
  router.replace({ path: '/dashboard/video-studio', query: { agent: id } })
}
function created() {
  video.studioDraft = ''
  assistantOpen.value = true
  mobileTab.value = video.task === 'story' ? 'workspace' : 'create'
  refreshLibrary()
}
async function openProject(p) {
  if (!hasVideoAgent.value || chat.isBusy || video.busy || refreshing.value) return
  openingProject.value = true
  try {
    const cid = await chat.ensureConversation()
    if (!cid) throw new Error()
    const { data } = await api.post(`/video/projects/${p.project_id}/open/`, { conversation_id: cid })
    video.project = data
    await video.loadVersions()
    video.panelTab = 'preview'
    video.refs = []
    libraryOpen.value = false
    mobileTab.value = 'workspace'
  } catch { notify.error('Could not open that project. Your current work is unchanged.') }
  finally { openingProject.value = false }
}
function newVideo() {
  if (chat.isBusy || video.busy || refreshing.value) return
  const id = chat.selectedAgentId
  chat.reset()
  if (id) chat.setAgent(id)
  video.reset()
  video.studioDraft = ''
  video.task = 'quick'
  video.routeId = ''
  mobileTab.value = 'create'
  router.replace({ path: '/dashboard/video-studio', query: id ? { agent: id } : {} })
}
function backToChat() {
  router.push({ path: chat.conversationId ? `/dashboard/chat/${chat.conversationId}` : '/dashboard/chat/new', query: chat.selectedAgentId ? { agent: chat.selectedAgentId } : {} })
}
async function sendAssistant() {
  const text = assistantDraft.value.trim()
  if (!text || chat.isBusy || !hasVideoAgent.value) return
  const sent = await chat.sendMessage(text)
  if (sent) assistantDraft.value = ''
}
async function composeEdit(event) {
  assistantDraft.value = event.detail?.text || ''
  assistantOpen.value = true
  mobileTab.value = 'assistant'
  await nextTick()
  document.getElementById('studio-assistant-prompt')?.focus()
}
watch(() => chat.conversationId, async (cid) => {
  if (loading.value || !cid || disposed) return
  await router.replace({ path: '/dashboard/video-studio', query: { agent: chat.selectedAgentId || undefined, conversation: cid } })
  video.conversationId = cid
  await video.loadJobs(cid)
})
watch(() => chat.isBusy, (busy, was) => { if (was && !busy) { refreshSession(); refreshLibrary() } })
watch(() => route.query.conversation, (cid) => {
  if (!loading.value && cid && String(cid) !== String(chat.conversationId)) initialize()
})
onMounted(async () => {
  window.addEventListener('video-compose', composeEdit)
  await initialize()
  if (disposed) return
  if (chat.conversationId && !route.query.conversation) router.replace({ path: '/dashboard/video-studio', query: { agent: chat.selectedAgentId || undefined, conversation: chat.conversationId } })
  if (!disposed) pollTimer = setInterval(() => { if (!loading.value && !openingProject.value && !video.busy && !chat.isBusy) refreshSession() }, 8000)
})
onBeforeUnmount(() => {
  if (!chat.imageMode) chat.imageMode = previousModes.image
  if (!canvas.mode) canvas.mode = previousModes.canvas
  disposed = true; clearInterval(pollTimer); window.removeEventListener('video-compose', composeEdit) })
</script>

<style scoped>
.studio { min-height: 100%; box-sizing: border-box; padding: 24px; background: var(--vm-bg, #f7f9fc); color: var(--vm-ink, #0f172a); font-family: var(--vm-font-sans); }
.studio-header, .section-heading, .workspace-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.studio-header { margin-bottom: 24px; flex-wrap: wrap; }
.studio-brand { display: flex; gap: 14px; align-items: center; }
.studio-icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; background: var(--vm-violet-soft, #eef2ff); color: var(--vm-violet-d, #4f46e5); }
h1 { font-size: 26px; letter-spacing: -.035em; margin: 3px 0 0; } h2 { font-size: 18px; margin: 0; letter-spacing: -.02em; } h3 { font-size: 14px; }
.eyebrow { margin: 0; font-size: 10px; letter-spacing: .12em; font-weight: 700; color: var(--vm-violet-d, #4f46e5); }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 8px 14px; border: 1px solid var(--vm-line, #dce3ee); border-radius: 10px; background: var(--vm-surface, #fff); color: inherit; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: none; box-sizing: border-box; }
.button:hover:not(:disabled) { border-color: var(--vm-violet-d, #4f46e5); } .button:disabled, .project-card:disabled { opacity: .5; cursor: not-allowed; }
.primary, .selected { background: var(--vm-violet-d, #4f46e5); color: white; border-color: transparent; }
.studio-grid { display: grid; grid-template-columns: minmax(300px, 360px) minmax(0, 1fr); gap: 20px; align-items: start; }
.create-pane, .workspace-pane, .assistant-pane, .library { min-width: 0; border: 1px solid var(--vm-line-2, #e5e7eb); background: var(--vm-surface, #fff); border-radius: 18px; overflow: hidden; }
.create-pane { padding: 20px; } .section-heading p, .muted, .agent-note { font-size: 12px; line-height: 1.6; color: var(--vm-ink-soft, #64748b); margin: 6px 0 0; }
.agent-field, .prompt-field { display: grid; gap: 8px; font-size: 12px; font-weight: 600; margin-top: 20px; }
select, textarea { width: 100%; min-width: 0; box-sizing: border-box; padding: 12px; border-radius: 10px; border: 1px solid var(--vm-line, #dce3ee); background: var(--vm-surface, #fff); color: inherit; font: inherit; line-height: 1.6; } textarea { resize: vertical; } select { min-height: 44px; }
.create-controls { border: 0; padding: 0; margin: 20px 0 0; min-width: 0; } .prompt-field { margin: 0; }
.create-controls :deep(.vcp) { border-bottom: 0; padding: 2px; } .create-controls :deep(.vcp-tasks) { grid-template-columns: 1fr; } .create-controls :deep(.vcp-task) { min-height: 60px; }
.render-jobs { display: grid; gap: 12px; margin-top: 20px; } .render-jobs :deep(.vjc) { min-width: 0; max-width: 100%; }
.workspace-pane { position: sticky; top: 16px; height: min(900px, calc(100dvh - 150px)); min-height: 500px; display: flex; flex-direction: column; }
.workspace-toolbar { flex-shrink: 0; padding: 12px 16px; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); font-size: 10px; letter-spacing: .08em; font-weight: 700; }
.workspace-pane :deep(.vp) { flex: 1; min-height: 0; }
.assistant-pane { position: fixed; inset: 100px 28px 24px auto; width: min(440px, calc(100vw - 48px)); z-index: 70; display: flex; flex-direction: column; box-shadow: 0 20px 80px #0f172a30; }
.assistant-pane > .section-heading { padding: 16px; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); } .assistant-history { flex: 1; min-height: 0; overflow: hidden; } .assistant-history :deep(.msg-list-inner) { padding-inline: 16px; }
.assistant-empty { padding: 24px; font-size: 13px; line-height: 1.7; color: var(--vm-ink-soft, #64748b); } .assistant-form { padding: 16px; display: grid; gap: 10px; border-top: 1px solid var(--vm-line-2, #e5e7eb); } .assistant-error { padding: 0 16px; font-size: 12px; color: #b91c1c; }
.library { padding: 20px; margin-bottom: 20px; } .project-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-top: 16px; } .project-card { display: grid; gap: 8px; text-align: left; padding: 16px; border: 1px solid var(--vm-line, #dce3ee); border-radius: 12px; background: var(--vm-surface-2, #f8fafc); color: inherit; cursor: pointer; overflow-wrap: anywhere; } .project-card span { font-size: 11px; color: var(--vm-ink-soft, #64748b); } .project-card .project-symbol { font-size: 24px; color: var(--vm-violet-d, #4f46e5); }
.setup-note, .studio-status { padding: 24px; font-size: 13px; line-height: 1.6; } .studio-mobile-tabs { display: none; } .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
button:focus-visible, textarea:focus-visible, select:focus-visible, a:focus-visible { outline: 2px solid var(--vm-violet-d, #4f46e5); outline-offset: 3px; }
@media (min-width: 1600px) { .studio-grid.assistant-open { grid-template-columns: 340px minmax(0, 1fr) 360px; } .assistant-pane { position: sticky; inset: auto; top: 16px; width: auto; height: calc(100dvh - 150px); min-height: 500px; box-shadow: none; } }
@media (max-width: 1023px) { .studio { padding: 16px; } .studio-grid { display: block; } .studio-mobile-tabs { display: flex; gap: 8px; margin-bottom: 16px; } .studio-mobile-tabs .button { flex: 1; } .mobile-hidden { display: none !important; } .workspace-toolbar { display: none; } .workspace-pane { position: static; height: calc(100dvh - 230px); min-height: 400px; } .assistant-pane { position: static; width: auto; height: calc(100dvh - 230px); min-height: 400px; box-shadow: none; } select, textarea { font-size: 16px; } }
@media (max-width: 480px) { .studio { padding: 12px; } .studio-header { gap: 16px; } h1 { font-size: 22px; } .header-actions { width: 100%; } .header-actions .button { flex: 1; padding-inline: 8px; } .create-pane { padding: 16px; } }
</style>
