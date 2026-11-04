<template>
  <!-- Create, in two stages (owner's prototype, 2026-10-19). Before a video session exists: "What would you like
       to create?" with the task cards, one large box and every setting. Once the first request starts it: the
       workspace, the canvas (monitor, storyboard, assets, versions) beside the navigation and the conversation with
       the Video Studio agent on the right (plan D9). Below 1024px the workspace is two tabs, the agent first. -->
  <section class="studio" aria-labelledby="studio-title" data-test="video-studio">
    <header class="bar">
      <div class="bar-text">
        <h1 id="studio-title">{{ title }}</h1>
        <p v-if="summary" class="bar-sub">{{ summary }}</p>
      </div>
      <div class="bar-actions">
        <button type="button" class="btn" data-test="studio-open-library" @click="video.libraryOpen = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 4h16v16H4z" /><path d="M4 15l5-5 4 4 3-3 4 4" /></svg>
          <span>Add from Library</span>
        </button>
        <!-- Only once a chat is open: before that the page already is a new video (owner, 2026-10-20: "nothing
             happening when click"). -->
        <button v-if="phase === 'workspace'" type="button" class="btn" data-test="studio-new" :disabled="loading || chat.isBusy || video.busy || refreshing" @click="newVideo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span>New</span>
        </button>
      </div>
    </header>

    <p v-if="loading" class="status" role="status">Opening Video Studio…</p>
    <div v-else-if="error" class="status" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="btn" @click="initialize">Try again</button>
    </div>
    <div v-else-if="phase === 'create'" class="create" data-test="studio-create">
      <div class="create-inner">
        <div class="dashboard-context"><span>Start with your agent</span><button type="button" :disabled="loading || chat.isBusy || video.busy || refreshing || !!chat.hitlRequests?.length" @click="newVideo">＋ New chat</button></div>
        <div class="create-heading"><p class="create-eyebrow">YOUR CREATIVE WORKSPACE</p><h1 class="create-title">What do you want to make?</h1><p class="create-description">{{ agentMode ? 'Start with your idea. Your agent will help shape the rest.' : 'Choose a workflow, shape your brief, and set the details yourself.' }}</p></div>
        <div v-if="!hasVideoAgent" class="setup" data-test="studio-not-ready">
          <h2>Video Studio can’t render yet</h2>
          <p>No video model is set for the Video Studio agent. A platform admin sets it once, for everyone.</p>
        </div>
        <template v-else>
          <fieldset class="composer" :disabled="openingProject">
            <legend class="sr-only">Describe your video</legend>
            <VideoComposerPanel ref="composerEl" variant="create" :draft="video.studioDraft" ensure-project @done="created">
              <label class="prompt" for="studio-prompt">
                <span class="sr-only">{{ promptLabel }}</span>
                <textarea id="studio-prompt" v-model="video.studioDraft" rows="3" :placeholder="placeholder" data-test="studio-prompt"
                          @keydown="onPromptKey"></textarea>
              </label>
              <!-- Send works in both modes (owner, 2026-10-20): in Agent mode it is the only action; in Manual it asks
                   the agent a question beside "Get estimate". -->
              <template #actions>
                <button v-if="chat.isBusy" type="button" class="btn" data-test="studio-stop" @click="chat.stop()">Stop</button>
                <button v-else type="button" class="btn send" :class="{ quiet: !agentMode && phase === 'create' }" data-test="studio-send-message"
                        :disabled="!video.studioDraft.trim() && !(agentMode && video.refs.length)" @click="sendMessage">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M4 12l16-8-6 16-2.5-6.5z" /></svg>
                  <span>Send</span>
                </button>
              </template>
            </VideoComposerPanel>
          </fieldset>
          <div class="dashboard-meta"><span>▱ Your creative workspace</span><span>Ctrl + Enter to send</span></div>
        </template>

      </div>
    </div>

    <template v-else>
      <div class="switch" role="tablist" aria-label="Studio view">
        <button v-for="t in views" :key="t.value" type="button" role="tab" class="switch-tab" :class="{ on: mobileTab === t.value }"
                :aria-selected="mobileTab === t.value ? 'true' : 'false'" @click="mobileTab = t.value">{{ t.label }}</button>
      </div>

      <div class="stage">
        <section class="canvas" :class="{ 'm-hide': mobileTab !== 'canvas' }" aria-label="Preview and edit">
          <VideoPanel bare />
        </section>
        <section class="agent" :class="{ 'm-hide': mobileTab !== 'agent' }" aria-label="Video agent">
          <header class="agent-head">
            <span class="agent-mark" aria-hidden="true"></span>
            <h2 class="agent-name">{{ chat.currentAgent?.name || 'Video Studio' }}</h2>
          </header>
          <div class="agent-log">
            <ChatMessageList v-if="chat.messages.length" />
            <p v-else class="agent-wait">Ask the agent for an image, a video or a change. The conversation shows here.</p>
          </div>

          <VideoJobsTray class="tray" :conversation-id="chat.conversationId" in-studio @open="mobileTab = 'canvas'" />
          <p v-if="chat.error" class="agent-error" role="alert">{{ chat.error }}</p>

          <fieldset v-if="hasVideoAgent" class="composer" :disabled="openingProject">
            <legend class="sr-only">Message the video agent</legend>
            <VideoComposerPanel ref="composerEl" variant="chat" :draft="video.studioDraft" ensure-project @done="created">
              <label class="prompt" for="studio-prompt">
                <span class="sr-only">Message the video agent</span>
                <textarea id="studio-prompt" v-model="video.studioDraft" rows="2" :placeholder="agentMode ? 'Message the agent…' : video.kind === 'image' ? 'Describe the image…' : 'Describe your next change…'" data-test="studio-prompt"
                          @keydown="onPromptKey"></textarea>
              </label>
              <template #actions>
                <button v-if="chat.isBusy" type="button" class="btn" data-test="studio-stop" @click="chat.stop()">Stop</button>
                <button v-else type="button" class="btn send" :class="{ quiet: !agentMode && phase === 'create' }" data-test="studio-send-message"
                        :disabled="!video.studioDraft.trim() && !(agentMode && video.refs.length)" @click="sendMessage">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M4 12l16-8-6 16-2.5-6.5z" /></svg>
                  <span>Send</span>
                </button>
              </template>
            </VideoComposerPanel>
          </fieldset>
        </section>
      </div>
    </template>
    <!-- The Library opens from the page bar in both stages, so it lives here, not in the canvas (absent before the
         first message). -->
    <VideoLibrary v-if="video.libraryOpen" />
    <HITLModal :requests="chat.hitlRequests" :show-stop="true" @respond="chat.respondHitl" @dismiss="chat.dismissHitl" @skip="chat.skipHitl" @stop="chat.stop" />
    <FullDocCostCard />
  </section>
</template>

<script setup>
import { useStudioExperience } from '../composables/useStudioExperience'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import { useChatStore } from '../stores/useChatStore'
import { useVideoStore } from '../stores/useVideoStore'
import { useCanvasStore } from '../stores/useCanvasStore'
import { notify } from '../composables/useNotify'
import { usePoller } from '../composables/usePoller'
import VideoComposerPanel from '../components/video/VideoComposerPanel.vue'

import VideoJobsTray from '../components/video/VideoJobsTray.vue'
import VideoPanel from '../components/video/VideoPanel.vue'
import VideoLibrary from '../components/video/VideoLibrary.vue'
import ChatMessageList from '../components/chat/ChatMessageList.vue'
import HITLModal from '../components/HITLModal.vue'
import FullDocCostCard from '../components/chat/FullDocCostCard.vue'

const route = useRoute()
const router = useRouter()
const chat = useChatStore()
const video = useVideoStore()
const canvas = useCanvasStore()
const previousModes = { image: chat.imageMode, canvas: canvas.mode }
const loading = ref(true)
const error = ref('')
const openingProject = ref(false)
const composerEl = ref(null)
const mobileTab = ref('agent')
const views = [{ value: 'agent', label: 'Agent' }, { value: 'canvas', label: 'Preview and edit' }]
// The create screen until a video session exists; the workspace from the first request on.
const phase = computed(() => (chat.conversationId ? 'workspace' : 'create'))
// Video Studio always talks to the one built-in Video Studio agent (plan D12): nobody sets up or picks one.
const hasVideoAgent = computed(() => !!chat.currentAgent?.video_model)
const refreshing = ref(false)
let sessionInFlight = false
let disposed = false

const scenes = computed(() => (video.project && video.project.scenes) || [])
const title = computed(() => (video.project ? video.project.title || 'Untitled video' : 'Dashboard'))
const summary = computed(() => {
  if (!video.project) return ''
  const n = scenes.value.length
  const secs = Math.round(scenes.value.reduce((t, s) => t + (s.planned_ms || 0), 0) / 1000)
  return [n ? `${n} scene${n === 1 ? '' : 's'}` : '', secs ? `${secs} s planned` : '', video.project.aspect_ratio || ''].filter(Boolean).join(', ')
})
// Agent or Manual (D15), sent with every message while the Studio is open.
// Home keeps the same Agent / Manual choice as the shared composer.
const { isAgent: agentMode } = useStudioExperience('home')
const promptLabel = computed(() => (agentMode.value ? 'Message the Video Studio agent' : video.kind === 'image' ? 'Describe your image'
  : video.task === 'story' ? 'Describe your story' : video.task === 'edit' ? 'What would you like to change?' : 'Describe your video'))
const placeholder = computed(() => (agentMode.value
  ? 'What do you want to make?'
  : video.kind === 'image'
  ? 'My candle on a wet black stone, soft rim light, seen from slightly above'
  : video.task === 'story'
    ? 'A 30-second ad for my café: the espresso pour, a regular saying hello, the logo at the end'
    : video.task === 'edit' ? 'Make it slower and warmer, and remove the person on the left'
      : 'A slow camera move around my product, with soft studio light'))
// `background`: the 8 s refresh. It never sets `refreshing`, which disables New and opening a project, so a
// background poll can no longer make those buttons flicker off under the person's pointer.
async function refreshSession({ background = false } = {}) {
  if (!chat.conversationId || sessionInFlight || disposed) return
  sessionInFlight = true
  if (!background) refreshing.value = true
  try {
    // Independent reads: one round, not two.
    // A background beat reads the newest page only (ADM-1170: it re-read every page every 8 s).
    await Promise.all([(background ? video.loadJobs(chat.conversationId, { pages: 1 }) : video.loadJobs(chat.conversationId)), video.loadProject(chat.conversationId)])
  } finally {
    sessionInFlight = false
    if (!background) refreshing.value = false
  }
}
// One poller: paused while the tab is hidden, cancelled on leave; skips a beat while something else runs.
const sessionPoller = usePoller(() => {
  if (loading.value || openingProject.value || video.busy || chat.isBusy) return
  return refreshSession({ background: true })
}, { interval: 8000 })
async function initialize() {
  loading.value = true
  error.value = ''
  try {
    // ?new=1 (Projects page, "New video") and ?project= (a project never opened in a chat): a fresh session, not the
    // last chat, so a project is never put into whichever chat happened to be open.
    const fresh = !!(route.query.new || route.query.project)
    if (fresh) chat.reset()
    const cid = fresh ? null : (route.query.conversation || chat.conversationId)
    chat.imageMode = false
    canvas.mode = false
    video.reset()
    // Only the Studio's own agent (and, below, a session's agent by id). The whole agent library was walked here
    // too: 3 requests of 100 agents, about a second each on production, and nothing in the Studio reads it.
    const card = await loadStudioAgent()
    if (disposed) return
    if (cid) {
      // An existing video session reopens with the agent it was made with.
      const alreadyLoaded = String(chat.conversationId) === String(cid) && (chat.messages.length || chat._conn)
      await chat.openConversation(String(cid))
      if (!alreadyLoaded && chat.error) throw new Error('This video session could not be opened. Go back to AADML or try again.')
    } else {
      chat.setAgent(String(card.id))
    }
    if (disposed) return
    // Shared or hidden agents may be absent from the ordinary agent library. Fetch only the session's assigned
    // agent — in the same round as the session's jobs and project, which do not depend on it.
    const missingAgent = chat.selectedAgentId && !chat.agents.some((a) => String(a.id) === String(chat.selectedAgentId))
    const [agentResp] = await Promise.all([
      missingAgent ? api.getAgent(chat.selectedAgentId) : null,
      refreshSession(),
    ])
    if (disposed) return
    if (agentResp?.data?.id && !chat.agents.some((a) => String(a.id) === String(agentResp.data.id))) chat.agents.push(agentResp.data)
  } catch (e) { error.value = e.message || 'Could not open Video Studio.' }
  finally { loading.value = false }
  if (disposed || error.value) return
  // ?project=<id> (Projects page): open that project here. Then add what the Library pages queued.
  if (route.query.project && hasVideoAgent.value) await openProject({ project_id: route.query.project })
  if (hasVideoAgent.value && video.queuedUse.length) await video.applyQueuedUse({ chat })
  if (route.query.new || route.query.project) {
    router.replace({ path: '/video-studio/dashboard', query: chat.conversationId ? { conversation: chat.conversationId } : {} })
  }
}
// The built-in agent's card, kept in the chat store's agent list so a new chat opens with it.
let studioAgentId = null
async function loadStudioAgent() {
  let data
  try { ({ data } = await api.getVideoStudioAgent()) } catch {
    throw new Error('Video Studio is not available right now. Try again in a moment.')
  }
  const i = chat.agents.findIndex((a) => String(a.id) === String(data.id))
  if (i >= 0) chat.agents.splice(i, 1, { ...chat.agents[i], ...data })
  else chat.agents.push(data)
  studioAgentId = String(data.id)
  return data
}
function created() {
  video.studioDraft = ''
  if (video.task === 'story') mobileTab.value = 'canvas'
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
    mobileTab.value = 'canvas'
  } catch { notify.error('Could not open that project. Your current work is unchanged.') }
  finally { openingProject.value = false }
}
function newVideo() {
  if (chat.isBusy || video.busy || refreshing.value || chat.hitlRequests?.length) return
  chat.reset()
  if (studioAgentId) chat.setAgent(studioAgentId)
  video.reset()
  video.studioDraft = ''
  video.task = 'quick'
  video.routeId = ''
  mobileTab.value = 'agent'
  router.replace({ path: '/video-studio/dashboard', query: {} })
}
async function focusPrompt() {
  mobileTab.value = 'agent'
  await nextTick()
  document.getElementById('studio-prompt')?.focus()
}
// A plain message to the agent (a question, or a change in words); the composer's own button asks for an estimate.
async function sendMessage() {
  const text = video.studioDraft.trim()
  if (chat.isBusy || !hasVideoAgent.value) return
  // Agent mode: the files added with "+" go with the message; the agent decides how each is used.
  if (agentMode.value) {
    if (!text && !video.refs.length) return
    if (await video.sendAgentMessage({ prompt: text, chat })) video.studioDraft = ''
    return
  }
  if (!text) return
  const sent = await chat.sendMessage(text)
  if (sent) video.studioDraft = ''
}
// Create: Ctrl+Enter (Cmd+Enter) gets the estimate; Enter is a new line in a prompt. Workspace: like a chat,
// Enter sends to the agent and Shift+Enter is a new line.
function onPromptKey(e) {
  if (e.key !== 'Enter' || e.isComposing) return
  // Keep phone Return consistent with the tool chats; submission stays on Send.
  if (phase.value === 'create' && !agentMode.value) {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); composerEl.value?.submit() }
    return
  }
  const touchKeyboard = window.matchMedia?.('(pointer: coarse)').matches
  if (!e.shiftKey && (!touchKeyboard || e.ctrlKey || e.metaKey)) { e.preventDefault(); sendMessage() }
}
// "Edit scene" on the canvas starts the request in the composer.
function composeEdit(event) {
  video.studioDraft = event.detail?.text || ''
  focusPrompt()
}
watch(() => chat.conversationId, async (cid) => {
  if (loading.value || !cid || disposed) return
  await router.replace({ path: '/video-studio/dashboard', query: { conversation: cid } })
  video.conversationId = cid
  await video.loadJobs(cid)
})
watch(() => chat.isBusy, (busy, was) => { if (was && !busy) refreshSession() })
// Every message sent while the Studio is open carries its mode (cleared when the Studio closes).
watch(() => video.studioMode, (mode) => { chat.studioMode = mode; chat.studioContext = { page: 'home' } }, { immediate: true })
// The canvas follows what is being made: the Images tab for Image, the monitor for Video.
watch(() => video.kind, (kind) => { if (phase.value === 'workspace') video.panelTab = kind === 'image' ? 'images' : 'preview' })
// A file queued in the Library is added as soon as a video agent is chosen.
watch(hasVideoAgent, (ok) => { if (ok && !loading.value && video.queuedUse.length) video.applyQueuedUse({ chat }) })
watch(() => route.query.conversation, (cid) => {
  if (!loading.value && cid && String(cid) !== String(chat.conversationId)) initialize()
})
onMounted(async () => {
  window.addEventListener('video-compose', composeEdit)
  await initialize()
  if (disposed) return
  if (chat.conversationId && !route.query.conversation) router.replace({ path: '/video-studio/dashboard', query: { conversation: chat.conversationId } })
  if (!disposed) sessionPoller.start({ immediate: false })
})
onBeforeUnmount(() => {
  chat.studioMode = ''
  chat.studioContext = null
  if (!chat.imageMode) chat.imageMode = previousModes.image
  if (!canvas.mode) canvas.mode = previousModes.canvas
  disposed = true; sessionPoller.stop(); window.removeEventListener('video-compose', composeEdit) })
</script>

<style scoped>
.studio { display: flex; flex-direction: column; height: 100%; min-height: 0; box-sizing: border-box; background: var(--vm-bg); color: var(--vm-ink);
  font-family: var(--vm-font-sans); }

/* Page bar: the project is the title; the two page actions are quiet (the composer holds the main action). */
.bar { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 60px; padding: 8px 20px;
  box-sizing: border-box; border-bottom: 1px solid var(--vm-line-2); }
.bar-text { min-width: 0; }
.bar h1 { margin: 0; font-size: 18px; line-height: 1.3; font-weight: 600; letter-spacing: -.015em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--vm-ink-soft); font-variant-numeric: tabular-nums; }
.bar-actions { display: flex; gap: 8px; flex-shrink: 0; }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 0 14px; box-sizing: border-box;
  border: 1px solid var(--vm-line); border-radius: 6px; background: transparent; color: var(--vm-ink); font: inherit; font-size: 13px;
  font-weight: 500; text-decoration: none; cursor: pointer; transition: background-color .15s, border-color .15s; }
.btn svg { width: 16px; height: 16px; flex-shrink: 0; }
.btn:hover:not(:disabled) { background: var(--vm-surface-2); }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.send { border-color: transparent; background: var(--vm-violet-d); color: #fff; font-weight: 600; }
.btn.send:hover:not(:disabled) { background: var(--vm-violet); }
/* Manual mode's first screen: Send asks the agent a question; "Get estimate" stays the main action. */
.btn.send.quiet { border-color: var(--vm-line); background: transparent; color: var(--vm-ink); font-weight: 500; }
.btn.send.quiet:hover:not(:disabled) { background: var(--vm-surface-2); }

.status { padding: 24px 20px; font-size: 14px; color: var(--vm-ink-soft); }
.status p { margin: 0 0 12px; }

.switch { display: none; }
.stage { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, 440px); }

/* Agent column (right): the conversation is the record of the work; the composer sits at its foot. */
.agent { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--vm-surface); border-left: 1px solid var(--vm-line-2); }
.agent-log { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.agent-log :deep(.msg-list-inner) { padding: 16px 16px 12px; }
/* The create screen: one centred column (the owner's prototype), the box the widest thing on it. */
.create { flex: 1; min-height: 0; overflow-y: auto; display: flex; }
.create-inner { display: flex; flex-direction: column; gap: 18px; width: min(1000px, 100%); min-height: 100%; margin: 0 auto; padding: 36px 24px 0;
  box-sizing: border-box; }
.create-inner > .composer { flex: 0 0 auto; display: flex; flex-direction: column; padding: 0 0 16px; }
.create-title { margin: 0; text-align: center; font-size: 28px; line-height: 1.2; font-weight: 600; letter-spacing: -.02em; }
.setup { padding: 20px; border: 1px solid var(--vm-line-2); border-radius: 10px; }
.setup h2 { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
.setup p { margin: 0; max-width: 34em; font-size: 14px; line-height: 1.6; color: var(--vm-ink-soft); }
.agent-head { flex-shrink: 0; display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 16px; border-bottom: 1px solid var(--vm-line-2); }
.agent-mark { width: 8px; height: 8px; border-radius: 999px; background: var(--vs-ok-ink, #12b76a); }
.agent-name { margin: 0; font-size: 14px; font-weight: 600; }
.agent-wait { margin: 0; padding: 20px 16px; font-size: 13.5px; color: var(--vm-ink-soft); }
.tray { flex-shrink: 0; max-height: 45%; overflow-y: auto; padding: 0 12px 8px; display: grid; gap: 8px; }
.agent-error { flex-shrink: 0; margin: 0 16px 8px; font-size: 13px; color: var(--vs-bad-ink, #b91c1c); }
.composer { flex-shrink: 0; min-width: 0; margin: 0; padding: 0 12px 12px; border: 0; }
.prompt { display: block; }
.prompt textarea { display: block; width: 100%; min-height: 64px; max-height: 40vh; box-sizing: border-box; padding: 12px 14px 4px; resize: none;
  border: 0; border-radius: 8px; background: transparent; color: var(--vm-ink); font: inherit; font-size: 14.5px; line-height: 1.55; }
/* The composer's input box shows focus for the whole box (its border and ring), so the textarea needs none. */
.prompt textarea:focus-visible { outline: none; }
.prompt textarea::placeholder { color: var(--vm-ink-faint); }

/* Canvas: the darkest neutral, so the monitor is what you look at. */
.canvas { min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; background: var(--vm-bg); }
.canvas :deep(.vp) { flex: 1; min-height: 0; }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.btn:focus-visible, .switch-tab:focus-visible {
  outline: 2px solid var(--vm-violet); outline-offset: 2px; }

@media (max-width: 1023px) {
  .bar { padding: 8px 16px 8px calc(12px + var(--vs-bar-inset, 0px)); min-height: 56px; }
  .bar-actions .btn span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .bar-actions .btn { width: 44px; height: 44px; padding: 0; }
  .switch { flex-shrink: 0; display: flex; gap: 4px; padding: 0 12px; border-bottom: 1px solid var(--vm-line-2); }
  .switch-tab { flex: 1; min-height: 44px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--vm-ink-soft);
    font: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer; }
  .switch-tab.on { color: var(--vm-ink); border-bottom-color: var(--vm-violet); }
  .stage { display: block; position: relative; }
  .agent, .canvas { position: absolute; inset: 0; border-left: 0; }
  .m-hide { display: none !important; }
  .prompt textarea { font-size: 16px; }
}
@media (max-width: 640px) {
  .create-inner { padding: 22px 16px 0; gap: 14px; }
  .create-title { font-size: 22px; }
}
@media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
</style>

<style scoped>.create-inner{width:min(1100px,100%);padding:44px 34px 30px;gap:26px;min-height:0}.create-title{text-align:left;font-size:36px;font-weight:550;letter-spacing:-.045em}.create-heading{padding-bottom:2px}.create-eyebrow{font-size:10px;letter-spacing:.15em;color:var(--vm-ink-faint);margin:0 0 13px}.create-description{color:var(--vm-ink-soft);font-size:13px;line-height:1.8;margin:13px 0 0}.create :deep(.vcp-mode){max-width:270px}.create :deep(.vcp-cards){gap:14px}.create :deep(.vcp-card){border-radius:10px}.create :deep(.vcp-box){border-radius:11px}.create :deep(.vcp-textarea){min-height:120px}.create :deep(.vcp-hint){font-size:12px;line-height:1.8}.create .prompt textarea{min-height:128px;padding:20px;font-size:15px}.studio .bar{padding:14px 30px;min-height:65px}.studio .bar h1{font-size:23px}.studio .bar{display:none}.studio:has(.stage) .bar{display:flex}@media(max-width:1023px){.create-inner{padding:26px 20px;gap:20px}.create-title{font-size:30px}.create-description{font-size:12px}.studio .bar{padding-left:20px}}@media(max-width:480px){.create-inner{padding:24px 15px}.create-title{font-size:27px}.create-eyebrow{font-size:9px}.create .prompt textarea{min-height:120px;font-size:16px;padding:15px}}
</style>

<style scoped>
.create-inner{width:100%;max-width:1348px;padding:34px 34px 30px;gap:0;margin:0 auto}
.dashboard-context{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;font-size:10px;color:#8ea7bd;min-height:32px}.dashboard-context button{min-height:36px;padding:8px 0;border:0;background:none;color:#bdd2ed;font:500 11px var(--vm-font-sans);cursor:pointer}
.create-heading{text-align:center;margin-bottom:34px;padding:0}.create-title{text-align:center;font-size:38px;line-height:1.25;letter-spacing:-1.5px;font-weight:600}.create-eyebrow{font-size:9px;color:#7e92b7;letter-spacing:1.6px;margin-bottom:13px}.create-description{font-size:13px;line-height:1.8;color:#8d9fbc;margin-top:12px}
.create .composer{padding:0}.create :deep(.vcp-mode-row){margin-bottom:23px}.create :deep(.vcp-hint){color:#8fa4c3;margin-bottom:18px}.create :deep(.vcp-box){border:1px solid #506b94;border-radius:12px;padding:17px 20px 18px;background:linear-gradient(135deg,#202e45,#1b2941);box-shadow:0 10px 40px #0002}.create :deep(.vcp-box:focus-within){border-color:#9abbf4;box-shadow:0 0 0 3px #7da7eb15,0 10px 40px #0002}
.create .prompt textarea{min-height:165px;max-height:500px;resize:vertical;background:none;padding:5px 2px 22px;font-size:15px;line-height:1.8;color:#e0eaff}.create :deep(.vcp-bar){padding:0;gap:12px}.create :deep(.vcp-go){margin-left:auto}.create .send{min-height:40px;padding:10px 18px;background:#a6bce4;border-color:#a6bce4;color:#16263e;font-size:12px}.create .send:disabled{opacity:.45}.dashboard-meta{display:flex;justify-content:space-between;gap:20px;padding:12px 4px 0;font-size:10px;color:#6983a9}
@media(max-width:1100px){.create-inner{padding:28px 28px 24px}.create-title{font-size:35px}}
@media(max-width:680px){.create-inner{padding:20px 16px 24px}.dashboard-context{margin-bottom:16px}.create-title{font-size:29px;letter-spacing:-1.1px}.create-description{font-size:12px}.create-heading{margin-bottom:27px}.create :deep(.vcp-box){padding:14px}.create .prompt textarea{min-height:145px;font-size:16px}.dashboard-meta{font-size:9px}.dashboard-meta>span:last-child{display:none}}
</style>

<style scoped>.create :deep(.vcp-create){gap:0}.create :deep(.vcp-create>.vcp-hint){margin-top:0;padding-top:0;margin-bottom:16px;font-size:12px;line-height:1.9}.create :deep(.vcp-create>.vcp-cards){margin-bottom:23px}.create :deep(.vcp-create>.vcp-box){position:relative;bottom:auto}</style>

<style scoped>
@media(max-width:680px){
 .create-inner{min-height:0;padding:14px 14px 22px}
 .dashboard-context{margin-bottom:8px;min-height:44px}
 .dashboard-context button{min-height:44px}
 .create-heading{text-align:left;margin-bottom:18px}
 .create-eyebrow{display:none}
 .create-title{text-align:left;font-size:25px;letter-spacing:-.8px}
 .create-description{margin-top:8px;font-size:12px;line-height:1.6}
 .create :deep(.vcp-mode-row){margin-bottom:12px;gap:6px}
 .create :deep(.vcp-preserved){display:none}
 .create :deep(.vcp-create>.vcp-hint){font-size:12px;line-height:1.6;margin-bottom:12px}
 .create :deep(.vcp-box){padding:12px}
 .create .prompt textarea{min-height:100px;padding-bottom:12px;resize:none}
 .create :deep(.vcp-reference-hint){display:none}
 .create :deep(.vcp-bar){flex-wrap:nowrap;gap:8px}
 .create .send{min-height:44px}
 .dashboard-meta{padding-top:10px}
}
</style>
