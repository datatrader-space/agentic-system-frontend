<template>
  <div class="chat-split" ref="splitEl" :class="{ 'canvas-open': dockOpen, 'canvas-mobile': dockOpen && isMobile }">
   <div class="chat-workspace" :style="dockOpen && !isMobile ? { flex: `1 1 0`, minWidth: '360px' } : null">
    <!-- Chat / Work, centred at the top of the surface it governs. It is not a composer pill: those are
         per-message settings (which agent, which run mode, does this message make an image), and this
         chooses what KIND of thing the session does. A control at that altitude reads wrongly when it
         sits beside the attach button. -->
    <div v-if="showWelcome" class="turnmode-bar"><TurnModeSwitch /></div>

    <div v-if="showWelcome" class="floating-history" :class="{ tucked: historyOpen }">
      <button class="icon-btn" data-history-toggle title="Chat history" aria-label="Chat history"
              :aria-expanded="historyOpen" @click.stop="toggleHistory">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3v6h6" /><path d="M12 7v5l3 2" /></svg>
      </button>
    </div>

    <!-- Thread header (only once a conversation has started) -->
    <header v-if="!showWelcome" class="chat-header">
      <div class="chat-head-text">
        <h2 class="chat-title">{{ title }}</h2>
        <span v-if="chat.currentAgent" class="chat-agent">{{ chat.currentAgent.name }}</span>
      </div>
      <div class="chat-actions" :class="{ tucked: historyOpen }">
        <button class="icon-btn" data-history-toggle title="Chat history" aria-label="Chat history"
                :aria-expanded="historyOpen" @click.stop="toggleHistory">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3v6h6" /><path d="M12 7v5l3 2" /></svg>
        </button>
        <button v-if="workspaceAgent" class="icon-btn" title="Agent workspace files" aria-label="Agent workspace files"
                :aria-expanded="workspaceOpen" @click="workspaceOpen = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.7.9l.8 1.2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </button>
        <button class="icon-btn" title="Share this conversation" aria-label="Share this conversation"
                @click="chat.openShare()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
        </button>
        <button class="header-btn" title="New chat" @click="startNew">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14" stroke-linecap="round" /></svg>
          <span>New</span>
        </button>
        <!-- Overflow menu: actions that don't earn a permanent slot in the header. -->
        <div class="more-wrap" data-chat-more>
          <button class="icon-btn" title="More actions" aria-label="More actions" aria-haspopup="menu"
                  :aria-expanded="moreOpen" @click.stop="moreOpen = !moreOpen">
            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
          </button>
          <span v-if="artifacts.unseen && !artifacts.open" class="more-dot"
                :title="`${artifacts.unseen} new artifact(s)`"></span>
          <div v-if="moreOpen" class="more-menu" role="menu" @click.stop>
            <button role="menuitem" @click="openArtifacts">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>
              <span class="mi-text">
                Artifacts
                <span class="mi-sub">Files this chat produced</span>
              </span>
            </button>
            <button role="menuitem" :disabled="!chat.conversationId"
                    :title="chat.conversationId ? '' : 'Send a message first to start the chat'"
                    @click="openMedia">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              <span class="mi-text">
                Media gallery
                <span class="mi-sub">Reuse this chat's images &amp; files</span>
              </span>
            </button>
            <!-- File this chat in a project, or take it out (agentic-docs/CHAT_PROJECTS_PLAN.md). -->
            <button role="menuitem" data-test="move-to-project" :disabled="!chat.conversationId"
                    :title="chat.conversationId ? '' : 'Send a message first to start the chat'"
                    @click="toggleMovePicker">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.7.9l.8 1.2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              <span class="mi-text">
                Move to project
                <span class="mi-sub">{{ currentProjectName ? `In ${currentProjectName}` : 'File this chat in a project' }}</span>
              </span>
            </button>
            <div v-if="movePickerOpen" class="move-picker" role="group" aria-label="Projects">
              <button v-for="p in projects.projects" :key="p.id" role="menuitem" :data-test="`header-move-${p.id}`"
                      :disabled="String(p.id) === String(chat.conversationProjectId)" @click="moveTo(p.id)">
                {{ p.name }}
              </button>
              <button v-if="chat.conversationProjectId" role="menuitem" @click="moveTo(null)">Remove from project</button>
              <span v-if="!projects.projects.length" class="move-empty">Create a project in the sidebar first.</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- The browser the agent is using in this chat, when it is using one: a square preview of the page
         pinned in the top corner of the chat, which opens the browser view large (BrowserPanel in the
         dock, expanded). One per conversation; out of the way while the large view is up. -->
    <!-- Gone once the browser has ended: a preview headed "Ended" over a blank picture is a card for
         something that is no longer there. It comes back with the next browser the agent starts. -->
    <BrowserCard v-if="!showWelcome && browser.hasSession && !browser.ended && !browser.expanded" />

    <!-- Body -->
    <div class="chat-body" :class="{ 'welcome-scroll': showWelcome }">
      <ChatWelcome v-if="showWelcome" ref="welcomeRef" @submit="onSend" />
      <ChatMessageList v-else />
    </div>

    <!-- Composer (thread mode; welcome screen has its own) -->
    <div v-if="!showWelcome" class="chat-footer">
      <!-- Active-plan navigation chip: scrolls back to the inline plan card when it's out of view. -->
      <button v-if="activePlan" type="button" class="active-plan-chip" @click="scrollToActivePlan"
              aria-label="Jump to the active plan">
        <span class="apc-dot" aria-hidden="true"></span>
        <span class="apc-label">{{ activePlan.awaitingApproval ? 'Plan awaiting approval' : 'Active plan' }}</span>
        <span class="apc-count">{{ activePlan.done }}/{{ activePlan.total }}</span>
        <span class="apc-arrow" aria-hidden="true">↑</span>
      </button>
      <!-- The socket keeps retrying on its own and never gives up; after a few failures in a row the
           person can also make it try now (replaces the old "Lost connection — please refresh"). -->
      <div v-if="chat.connectionLost" class="conn-lost" role="status">
        <span class="conn-lost__dot" aria-hidden="true"></span>
        <span>Connection lost. Trying again…</span>
        <button type="button" class="conn-lost__btn" @click="chat.reconnectNow()">Reconnect now</button>
      </div>
      <!-- URL/YouTube import lives in the composer "+" menu (conversation-scoped DocumentSource →
           MarkItDown pipeline). Explicit action only; we never auto-ingest URLs typed in a message.
           agent-id comes from selectedAgentId (always set once a conversation loads), NOT
           currentAgent — the latter only resolves if the agent is in the workspace-scoped agents
           list, so it would hide the mode picker for cross-workspace/unloaded agents. -->
      <!-- `isBusy`, not `isStreaming`: a Work run keeps going across iteration boundaries, and between
           two iterations nothing is streaming at all while the backend verifies the goal and dispatches
           the next segment. Binding the Stop button to the bubble made it vanish mid-run and come back
           moments later, which read as the run finishing and then restarting. -->
      <!-- Video jobs of this chat: estimates waiting for Generate, renders in flight (Video mode). -->
      <VideoJobsTray :conversation-id="chat.conversationId" />
      <ChatComposer ref="composerRef" :streaming="chat.isBusy" :attachments="chat.pendingAttachments"
        :agent-id="chat.selectedAgentId"
        :conversation-id="chat.conversationId"
        :run-mode="chat.currentAgent && chat.currentAgent.agent_run_mode"
        :has-image-model="!!(chat.currentAgent && chat.currentAgent.image_model)"
        :is-shared-agent="chat.isSharedAgent"
        @send="onSend" @stop="chat.stop()" @mode-change="onModeChange"
        @attach="chat.addAttachments" @remove-attach="chat.removeAttachment" />
      <!-- Opens when a provider account refuses the turn (key limit / credits / rejected key). -->
      <ProviderSwitchDialog v-if="chat.providerSwitchOffer" />
      <!-- THE WHOLE CONVERSATION, AND IT HAS TO SAY SO. It read "Session 7993.6k · $11.35", which a person
           takes for what the reply above it cost; it is every run in this conversation added up (that one
           was a week of runs). The last reply's own cost is on its message. -->
      <div v-if="chat.sessionTokens" class="session-meter"
           title="Every run in this conversation so far, added up. It is not the cost of the last reply.">
        This conversation so far: {{ fmtTokens(chat.sessionTokens) }} tokens<span v-if="chat.sessionCost"> · {{ fmtCost(chat.sessionCost) }} total</span>
      </div>
    </div>

    <!-- Human-in-the-loop approval modal: appears when the backend gates a tool for approval, AND for the
         max-steps pause-and-ask (Stop / Continue / Continue-for-chat) — same hitl_request mechanism. -->
    <HITLModal
      :requests="chat.hitlRequests"
      :show-stop="true"
      @respond="chat.respondHitl"
      @dismiss="chat.dismissHitl"
      @skip="chat.skipHitl"
      @stop="chat.stop"
    />

    <!-- Full-document cost gate: appears when a complete-mode KB read overflows the model window (manual /
         plan-review only). Approve to read it all, keep it targeted, or ask something specific. -->
    <FullDocCostCard />

    <!-- Share sheet: publishes a FROZEN snapshot of the thread at a private link (read-only, or
         "anyone with the link can continue" — a continuation forks into the reader's own account). -->
    <ShareModal :open="chat.shareOpen" :conversation-id="chat.conversationId" :title="title"
                :up-to-message-id="chat.shareAnchorId" @close="chat.closeShare()" />

    <!-- Media gallery: browse this chat's (or the whole agent's) generated + uploaded media and attach
         selected items to the next message BY ID (no re-upload) so the agent can reference/edit them. -->
    <MediaGallery :open="mediaOpen" :conversation-id="chat.conversationId"
                  @close="mediaOpen = false" @attach="onAttachMedia" />

    <!-- Agent workspace: the SAME panel as /dashboard/agents/:id/workspace, opened here as a right drawer
         (embedded=false) so the files this agent reads & writes are one click away without leaving the
         thread. Only needs the agent's id, so it also works for agents absent from the loaded library. -->
    <AgentWorkspacePanel v-if="workspaceAgent" v-model="workspaceOpen" :agent="workspaceAgent" />

    <!-- Chat history: a collapsible right drawer over the chat column. ONE instance for both triggers
         (welcome screen + thread header) so it survives the empty→thread switch and slides instead of
         popping. Agent-scoped by default; auto-collapses on outside click / Esc / when a turn starts. -->
    <ChatHistoryDrawer :open="historyOpen" :active-id="route.params.sessionId"
                       @close="historyOpen = false" @select="openSession" @new-chat="startNewFromHistory" />
   </div>

    <!-- Right dock: Canvas live preview + the Artifacts panel, sharing ONE resizable pane so the two
         never fight for the same space. Opens when the agent produces a design or the user opens
         Artifacts. -->
    <div v-if="dockOpen && !isMobile" class="cv-resize" @mousedown="startResize" title="Drag to resize"></div>
    <ChatDock
      v-if="dockOpen"
      class="cv-pane"
      :style="isMobile ? null : { flex: `0 0 ${canvasWidth}px` }"
    />
  </div>
</template>

<script setup>
import { computed, watch, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectsStore } from '../../stores/useProjectsStore'
import { useChatStore } from '../../stores/useChatStore'
import { useCanvasStore } from '../../stores/useCanvasStore'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { usePlanStore } from '../../stores/usePlanStore'
import { useArtifactsStore } from '../../stores/useArtifactsStore'
import { useBrowserStore } from '../../stores/useBrowserStore'
import BrowserCard from '../browser/BrowserCard.vue'
import ChatWelcome from './ChatWelcome.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatComposer from './ChatComposer.vue'
import { lazyComponent } from '../../utils/lazyComponent'
// Loaded when a provider refuses a turn (it opens only then): 28 KB a chat no longer downloads up front.
const ProviderSwitchDialog = lazyComponent(() => import('./ProviderSwitchDialog.vue'), { showLoading: false })
import TurnModeSwitch from './TurnModeSwitch.vue'
import ChatHistoryDrawer from './ChatHistoryDrawer.vue'
import HITLModal from '../HITLModal.vue'
import FullDocCostCard from './FullDocCostCard.vue'
import MediaGallery from './MediaGallery.vue'
import ShareModal from './ShareModal.vue'
import AgentWorkspacePanel from '../AgentWorkspacePanel.vue'
import ChatDock from './ChatDock.vue'
import VideoJobsTray from '../video/VideoJobsTray.vue'
import { useVideoStore } from '../../stores/useVideoStore'
import { fmtTokens, fmtCost } from '../../composables/tokens'

const chat = useChatStore()
const video = useVideoStore()
// Video mode state follows the conversation: its jobs and the project it has open come from the server,
// so a reload or a later visit shows the same estimates, renders and storyboard.
//
// Only for a chat that can HAVE video work (page-speed plan Phase 5 item 3): video tools belong to the
// built-in Video Studio agent alone (backend agent/tools/studio_only.py), so a chat with any other agent
// has no jobs or project to fetch, and opening it no longer costs those calls. The video panel being opened
// also loads them. Live jobs still arrive as `video_job` frames for every chat.
const chatCanHaveVideo = computed(() => !!chat.currentAgent?.video_model || video.panelOpen)
let videoLoadedFor = null
async function loadVideoWork() {
  const cid = chat.conversationId
  if (!cid || !chatCanHaveVideo.value || String(videoLoadedFor) === String(cid)) return
  videoLoadedFor = cid
  // Independent reads: one round, not two. Saved video projects are opened in Video Studio, rather than
  // expanding the chat composer.
  await Promise.all([video.loadJobs(cid), video.loadProject(cid)])
}
watch(() => chat.conversationId, (cid, prev) => {
  if (String(cid || '') === String(prev || '')) return
  video.reset()
  videoLoadedFor = null
  loadVideoWork()
}, { immediate: true })
watch(chatCanHaveVideo, (can) => { if (can) loadVideoWork() })
// The welcome screen is for a chat with nothing in it. A video estimate made from the welcome composer
// creates the conversation and a job but no message, and the estimate card lives in the thread's jobs tray:
// keying the welcome on messages alone kept the card out of sight (live test 2026-10-16, conversation 2830).
const showWelcome = computed(() => chat.isEmpty && !video.jobsFor(chat.conversationId).length)
// After a turn, the assistant may have planned or changed the project: show the current records.
watch(() => chat.isBusy, (busy, was) => {
  if (was && !busy && chat.conversationId && video.project) video.loadProject(chat.conversationId)
})

// WHERE THE COMPOSER STARTS, as a CSS variable the docked approval / sign-in card positions itself by.
// The card used a fixed 104px gap, but the composer (input, controls, hint line) is ~150px and grows as
// the user types, so the card covered part of it (live test 2026-09-25, the "Connect GitHub" card).
// Measured as "viewport bottom minus the composer's top edge", so everything under it is included.
const composerRef = ref(null)
const welcomeRef = ref(null)   // the new-chat screen's own message box
let _composerRo = null
function _publishComposerHeight() {
  const el = composerRef.value && (composerRef.value.$el || composerRef.value)
  if (!el || !el.getBoundingClientRect) return
  const h = Math.max(0, Math.round(window.innerHeight - el.getBoundingClientRect().top))
  document.documentElement.style.setProperty('--chat-composer-h', `${h}px`)
}
onMounted(() => {
  _publishComposerHeight()
  window.addEventListener('resize', _publishComposerHeight)
  const el = composerRef.value && (composerRef.value.$el || composerRef.value)
  if (typeof ResizeObserver !== 'undefined' && el && el.nodeType === 1) {
    _composerRo = new ResizeObserver(_publishComposerHeight)
    _composerRo.observe(el)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', _publishComposerHeight)
  if (_composerRo) { _composerRo.disconnect(); _composerRo = null }
  document.documentElement.style.removeProperty('--chat-composer-h')
})
const canvas = useCanvasStore()
const layout = useLayoutStore()
const plan = usePlanStore()
const artifacts = useArtifactsStore()
const browser = useBrowserStore()
// This view takes the browser store as soon as it is set up. When a new chat gets its id the shell builds
// a fresh chat view and only then cleans up the old one; the old one's cleanup hands back a store it no
// longer owns, which does nothing, instead of stopping what the new view started.
const browserView = browser.attach()
const route = useRoute()
const router = useRouter()

// Active-plan navigation chip (inline plan artifact — approved wireframe §4). A nav aid only: it shows
// the live plan's progress near the composer and scrolls back to the anchored card. NOT a second card
// and NOT a second source of state. Shown on the durable-anchor path while a plan is still incomplete.
const activePlan = computed(() => {
  if (!chat.hasDurablePlanAnchors) return null
  const p = plan.progressForConversation(chat.conversationId)
  if (!p || p.ended || (p.total > 0 && p.done >= p.total)) return null   // hide once over / complete / no steps
  return p
})
function scrollToActivePlan() {
  const el = typeof document !== 'undefined' && document.querySelector('.msg-list .msg-plan')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
// Chat history drawer (collapsed by default; agent-scoped — see ChatHistoryDrawer.vue).
const historyOpen = ref(false)

// Workspace drawer (header "Workspace" button). currentAgent only resolves when the agent is in the
// workspace-scoped agents list, so fall back to a stub carrying just the id — that's all the panel
// needs to fetch routing + files, and it keeps the button working for cross-workspace agents.
const workspaceOpen = ref(false)
const workspaceAgent = computed(
  () => chat.currentAgent || (chat.selectedAgentId ? { id: chat.selectedAgentId, name: '' } : null)
)

// Header overflow ("…") menu → Artifacts, which opens the right dock's Artifacts tab.
const moreOpen = ref(false)

// "Move to project" in the header menu: the one place to file an existing chat in a project.
const projects = useProjectsStore()
const movePickerOpen = ref(false)
const currentProjectName = computed(() => {
  const p = chat.conversationProjectId ? projects.byId(chat.conversationProjectId) : null
  return p ? p.name : ''
})
const toggleMovePicker = async () => {
  movePickerOpen.value = !movePickerOpen.value
  if (movePickerOpen.value && !projects.loaded) await projects.load()
}
const moveTo = async (projectId) => {
  const from = chat.conversationProjectId
  const ok = await projects.moveChat(chat.conversationId, projectId, from)
  if (ok) chat.conversationProjectId = projectId
  movePickerOpen.value = false
  moreOpen.value = false
}
watch(moreOpen, (open) => { if (!open) movePickerOpen.value = false })
function openArtifacts() {
  moreOpen.value = false
  artifacts.openPanel(chat.conversationId)
}
// Moved here from the composer's "+" menu, which is for composing the NEXT message (attach, generate,
// import a link). Browsing what the chat already holds belongs beside Artifacts: one lists everything
// the chat produced, the other picks images out of it to reuse.
function openMedia() {
  moreOpen.value = false
  if (!chat.conversationId) return
  mediaOpen.value = true
}
function closeMoreOnOutside(e) {
  if (moreOpen.value && !(e.target.closest && e.target.closest('[data-chat-more]'))) moreOpen.value = false
}
function closeMoreOnEsc(e) { if (e.key === 'Escape') moreOpen.value = false }

// ── Canvas side panel (resizable) ────────────────────────────────────────────────────────────────
const canvasOpen = computed(() => canvas.open && canvas.hasCanvas)
const browserOpen = computed(() => browser.open && browser.hasSession)
const dockOpen = computed(() => canvasOpen.value || artifacts.open || browserOpen.value || video.panelOpen)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const isMobile = computed(() => viewportWidth.value < (video.panelOpen ? 1024 : 768))

// Auto-collapse the left side navigation while the Canvas panel is open (more room for the preview),
// then restore whatever the user had before. Transient — we don't persist this over their real
// sidebar preference.
let _prevSidebarCollapsed = null
watch(dockOpen, (open) => {
  if (open) {
    if (_prevSidebarCollapsed === null) _prevSidebarCollapsed = layout.sidebarCollapsed
    layout.sidebarCollapsed = true
  } else if (_prevSidebarCollapsed !== null) {
    layout.sidebarCollapsed = _prevSidebarCollapsed
    _prevSidebarCollapsed = null
  }
})
const splitEl = ref(null)
const canvasWidth = ref(Number(localStorage.getItem('cv.width')) || 620)
let _resizing = false
const onWinResize = () => { viewportWidth.value = window.innerWidth }

function startResize(e) {
  _resizing = true
  const startX = e.clientX
  const startW = canvasWidth.value
  const total = splitEl.value ? splitEl.value.clientWidth : window.innerWidth
  const onMove = (ev) => {
    if (!_resizing) return
    // dragging left grows the canvas (it's the right pane)
    const next = startW + (startX - ev.clientX)
    canvasWidth.value = Math.max(380, Math.min(total - 360, next))
  }
  const onUp = () => {
    _resizing = false
    localStorage.setItem('cv.width', String(canvasWidth.value))
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    document.body.style.userSelect = ''
  }
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

const title = computed(() => {
  const first = chat.messages.find((m) => m.role === 'user')
  return first ? first.content.slice(0, 60) : 'New Chat'
})

// The drawer fetches its own list for the active scope when it opens (and on agent change).
const toggleHistory = () => { historyOpen.value = !historyOpen.value }

const openSession = (id) => {
  historyOpen.value = false
  router.push(`/dashboard/chat/${id}`)
}

// "New chat" from inside the drawer — collapse it so the composer is what the user lands on.
const startNewFromHistory = () => {
  historyOpen.value = false
  startNew()
}

// Persist the mode change locally so the picker + any badges reflect it immediately.
const onModeChange = (patch) => {
  if (chat.currentAgent) {
    chat.currentAgent.agent_run_mode = patch.agent_run_mode
  }
}

// A message that was not sent goes back into the box: the composer clears itself on submit.
const onSend = async (text) => {
  const sent = await chat.sendMessage(text)
  if (sent === false) (welcomeRef.value || composerRef.value)?.restoreDraft?.(text)
}

// Media gallery open state + attach handler (bind chosen existing media to the next message BY ID).
const mediaOpen = ref(false)
const onAttachMedia = (items) => chat.addExistingMedia(items)

// "New" from INSIDE a thread means "another chat with THIS agent", not "back to the default".
// The agent must travel in the URL: /dashboard/chat/new with no ?agent= makes _startNewChat()
// fall through to the Platform Super Agent, which silently switched the user off their agent.
const startNew = () => {
  // Read the id BEFORE reset() so a future reset that clears the selection can't strand us.
  const agentId = chat.selectedAgentId || (chat.currentAgent && chat.currentAgent.id) || null
  chat.reset()
  if (!agentId) {
    if (route.path !== '/dashboard/chat/new') router.push('/dashboard/chat/new')
    return
  }
  // ?agent=<id> is the platform's "open a chat with THIS agent" convention (agent card, AgentSwitcher).
  const already = route.path === '/dashboard/chat/new'
    && String(route.query.agent || '') === String(agentId)
  if (!already) router.push({ path: '/dashboard/chat/new', query: { agent: agentId } })
}

onMounted(() => {
  window.addEventListener('resize', onWinResize)
  document.addEventListener('click', closeMoreOnOutside)
  document.addEventListener('keydown', closeMoreOnEsc)
  // PARALLEL, not serial. The agent library and the conversation/super-agent resolution are
  // independent (_startNewChat resolves its agent BY ID; openConversation loads by conversation id),
  // so awaiting the library first just added a round trip to every chat open.
  const sid = route.params.sessionId
  chat.loadAgents()
  if (sid) {
    chat.openConversation(sid)
    canvas.adoptConversation(sid)
  } else {
    if (chat.conversationId) chat.reset()
    canvas.close()
    _startNewChat()
  }
})

// New chat. If we arrived from an agent card (/dashboard/chat/new?agent=<id>) pre-select THAT agent so the
// user lands straight in its composer with no picker step; otherwise pre-build the (auto-)selected agent
// now, during the idle window before the first message, so it reuses the runner (no ~6.6s cold build).
async function _selectAgentById(id) {
  // The agent may not be in the loaded library list — a shared agent (Platform Super Agent, a built-in)
  // never is. ensureAgent resolves it from the chattable set, or any other agent by id.
  if (await chat.ensureAgent(id)) {
    chat.setAgent(String(id))   // sets selectedAgentId + prewarms
    return true
  }
  return false
}

async function _startNewChat() {
  // A new chat inside a project (sidebar "New chat in this project"): the project rides in the URL.
  chat.newChatProjectId = route.query.project || null
  const qAgent = route.query.agent
  if (qAgent && await _selectAgentById(qAgent)) return
  // No agent in the URL → the chat belongs to the Platform Super Agent (the product default).
  // There is NO agent picker in the chat UI — specific agents are opened from their card's Chat button.
  const sa = await chat.ensureSuperAgent()
  if (sa) { chat.setAgent(String(sa.id)); return }
  chat.prewarmAgent()
}

onBeforeUnmount(() => {
  artifacts.closePanel()
  browser.detach(browserView)
  window.removeEventListener('resize', onWinResize)
  document.removeEventListener('click', closeMoreOnOutside)
  document.removeEventListener('keydown', closeMoreOnEsc)
  // Don't leave the sidebar collapsed after navigating away with Canvas open.
  if (_prevSidebarCollapsed !== null) {
    layout.sidebarCollapsed = _prevSidebarCollapsed
    _prevSidebarCollapsed = null
  }
})

// Load a conversation by URL, or reset for a fresh "new chat".
watch(
  () => route.params.sessionId,
  (id) => {
    if (id) { chat.openConversation(id); canvas.adoptConversation(id) }
    else { chat.reset(); canvas.close(); _startNewChat() }
  }
)

// Clicking Chat on a DIFFERENT agent card while already on /dashboard/chat/new (path unchanged, only the
// ?agent query changes) — re-select the new agent so the composer switches without a manual pick.
// Skip when it's ALREADY the selected agent: leaving a thread via "New" changes sessionId and
// ?agent in the same navigation, so both watchers fire and the agent would be re-selected (and
// re-prewarmed) twice for what is one click.
watch(
  () => route.query.agent,
  (a) => {
    if (!a || route.params.sessionId) return
    if (String(a) === String(chat.selectedAgentId)) return
    _selectAgentById(a)
  }
)

// "New chat in this project" while already on /dashboard/chat/new: only ?project changes.
watch(
  () => route.query.project,
  (p) => { if (!route.params.sessionId) chat.newChatProjectId = p || null }
)

// Keep the Artifacts panel pointed at the open conversation. Artifacts are conversation-scoped, so
// carrying one chat's list into the next would read as a data leak; bind() resets on a real change and
// no-ops otherwise. A new chat has no id yet — the panel binds the moment the first turn creates one.
watch(
  () => chat.conversationId,
  (id) => { if (String(id || '') !== String(artifacts.conversationId || '')) artifacts.bind(id) },
  { immediate: true }
)

// The browser card follows the open conversation the same way, and for the same reason. It asks the
// backend which browser this chat is using only WHILE A TURN RUNS — the one time a browser can appear or
// move — so an idle chat asks nothing. A page that needs a person opens the live view by itself: the
// agent is blocked on them, and a card they have to notice is a run that sits waiting.
watch(() => chat.conversationId, (id) => browser.bind(id), { immediate: true })
watch(() => chat.isBusy, (busy) => browser.follow(busy), { immediate: true })
// AND WHENEVER A MESSAGE LANDS OR SETTLES. "Busy" is the chat's own account of its stream, and it can be
// wrong for the length of a turn: seen live on 2026-10-08 (conversation 2659), the sandbox took three and
// a half minutes to wake, the chat stopped calling itself busy after about a hundred seconds of silence,
// the asking stopped with it, and the browser that started two minutes later was never shown — the
// answer arrived with no card beside it. A message arriving or finishing is proof something happened in
// this chat, whatever the stream flag says, so that asks once too. The store drops an ask that is
// already out.
watch(() => {
  const all = chat.messages || []
  const last = all[all.length - 1]
  return `${all.length}:${last ? `${last.id || ''}:${last.status || ''}` : ''}`
}, () => { browser.refresh() })
watch(() => browser.needsPerson, (needs) => { if (needs) browser.show() })
// A LINK THAT SAYS "SHOW ME THE BROWSER" (`?browser=1`, what the MCP tool hands a person as the place to
// watch). The pane opens once this chat's browser is known — and once only: a person who then closes it
// has closed it, and a link in the address bar must not keep reopening it under them.
let openedFromLink = false
watch(() => [route.query.browser, browser.hasSession], ([asked, has]) => {
  if (!asked || !has || openedFromLink) return
  openedFromLink = true
  browser.show()
}, { immediate: true })

// Once a brand-new chat gets a conversation id, reflect it in the URL so the
// session is bookmarkable and highlighted in the sidebar. openConversation()
// no-ops for the already-active conversation, so this won't disrupt streaming.
watch(
  () => chat.conversationId,
  (id) => {
    if (id && String(route.params.sessionId) !== String(id)) {
      router.replace(`/dashboard/chat/${id}`)
    }
  }
)
</script>

<style scoped>
.chat-split {
  display: flex;
  flex-direction: row;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.chat-workspace {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--vm-font-sans);
}
.cv-resize {
  flex: 0 0 6px;
  cursor: col-resize;
  background: var(--vm-line, #e5e7eb);
  position: relative;
  z-index: 5;
}
.cv-resize:hover { background: #c4b5fd; }
.cv-pane { height: 100%; min-height: 0; }
/* Mobile: canvas takes over full screen. */
.chat-split.canvas-mobile .chat-workspace { display: none; }
.chat-split.canvas-mobile .cv-pane {
  position: fixed;
  inset: 0;
  z-index: 60;
  width: 100vw;
}
.chat-header {
  position: relative;
  /* THE HEADER MUST PAINT ABOVE THE CONVERSATION, or its dropdown cannot be clicked.
     `backdrop-filter` creates a STACKING CONTEXT, and with `z-index: auto` this context is painted in
     DOM order -- so `.chat-body`, which comes after it, painted on top. The overflow menu's own
     `z-index: 40` was then trapped inside a context that had already lost, and the message list
     swallowed every click. Playwright named it exactly: "element is visible, enabled and stable" and
     "<div class='msg-list-inner'> ... intercepts pointer events". Visible, and not clickable. */
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 22px;
  border-bottom: 1px solid var(--vm-line);
  background: var(--vm-glass-strong);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  flex-shrink: 0;
}
.chat-head-text { min-width: 0; }
.chat-title {
  font-family: var(--vm-font-display);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -.01em;
  color: var(--vm-ink);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-agent {
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--vm-g-brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.auto-badge { margin-left: 6px; padding: 1px 7px; border-radius: 9999px; background: #ccfbf1; color: #0f766e; font-size: 0.65rem; font-weight: 600; }
.chat-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  transition: opacity .18s var(--vm-ease2);
}
/* While the history drawer is expanded it covers this corner — fade the triggers out (keeping their
   space, so the header doesn't reflow) and let the drawer's own close button be the affordance. */
.chat-actions.tucked,
.floating-history.tucked { opacity: 0; pointer-events: none; }
.header-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 13px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vm-ink-soft);
  background: var(--vm-surface);
  border: 1px solid var(--vm-line-2);
  border-radius: 12px;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s var(--vm-ease), box-shadow 0.15s, color 0.15s;
}
.header-btn:hover { transform: translateY(-1px); box-shadow: var(--vm-shadow-s); color: var(--vm-violet-d); }
.header-btn svg { width: 15px; height: 15px; }
.icon-btn {
  width: 36px;
  height: 36px;
  display: inline-grid;
  place-items: center;
  color: var(--vm-ink-soft);
  background: var(--vm-surface);
  border: 1px solid var(--vm-line-2);
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.15s var(--vm-ease), box-shadow 0.15s, color 0.15s;
}
.icon-btn:hover { transform: translateY(-1px); box-shadow: var(--vm-shadow-s); color: var(--vm-violet-d); }
.icon-btn svg { width: 17px; height: 17px; }
.more-wrap { position: relative; display: inline-flex; }
/* Unread marker on the "…" button: artifacts produced while the panel was closed. */
.more-dot { position: absolute; top: 2px; right: 2px; width: 8px; height: 8px; border-radius: 9999px; background: var(--vm-violet-d, #4f46e5); box-shadow: 0 0 0 2px var(--vm-surface, #fff); pointer-events: none; }
.move-picker { display: flex; flex-direction: column; margin: 0 6px 6px 34px; padding-left: 8px; border-left: 2px solid var(--vm-line); }
.move-picker button { border: 0; background: transparent; text-align: left; padding: 6px 10px; border-radius: 8px; font: 500 12.5px var(--vm-font-sans); color: var(--vm-ink); cursor: pointer; }
.move-picker button:hover:not(:disabled) { background: var(--vm-glass-strong); }
.move-picker button:disabled { color: var(--vm-ink-faint, #8a8fa3); cursor: default; }
.move-empty { padding: 6px 10px; font-size: 12px; color: var(--vm-ink-faint, #8a8fa3); }
.more-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  min-width: 216px;
  padding: 5px;
  background: var(--vm-surface);
  border: 1px solid var(--vm-line-2);
  border-radius: 12px;
  box-shadow: var(--vm-shadow-m, 0 12px 30px rgba(15, 23, 42, .14));
}
.more-menu button {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 9px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vm-ink-soft);
  text-align: left;
  cursor: pointer;
}
.more-menu button:hover:not(:disabled) { background: var(--vm-surface-2, #f1f5f9); color: var(--vm-violet-d); }
.more-menu button:disabled { opacity: .45; cursor: not-allowed; }
.more-menu svg { width: 17px; height: 17px; flex-shrink: 0; }
.mi-text { display: flex; flex-direction: column; gap: 1px; line-height: 1.25; text-align: left; }
.mi-sub { font-size: 0.6875rem; font-weight: 500; color: var(--vm-ink-dim, #94a3b8); }
.floating-history {
  position: absolute;
  top: 16px;
  right: 18px;
  z-index: 35;
  transition: opacity .18s var(--vm-ease2);
}
/* Drawer styles live in ChatHistoryDrawer.vue. */

.chat-body { flex: 1; min-height: 0; }
/* The welcome composer grows with video settings and references. Give it its own scroll area:
   the outer split intentionally clips overflow, while the message list owns scrolling in a thread. */
.chat-body.welcome-scroll { overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; }
.chat-footer { flex-shrink: 0; background: linear-gradient(to top, var(--vm-bg) 55%, transparent); }
.session-meter {
  text-align: right; padding: 2px 20px 6px; font-size: 11px; color: var(--vm-text-3, #6b7280);
  font-variant-numeric: tabular-nums; user-select: none;
}
/* Active-plan navigation chip — a small pill centered above the composer (approved wireframe §4). */
.active-plan-chip {
  display: flex; align-items: center; gap: 8px; margin: 0 auto 8px; padding: 6px 13px;
  border: 1px solid var(--vm-border, #e4e8ee); border-radius: 999px;
  background: var(--vm-surface, #fff); color: var(--vm-text, #1a1d23); font-size: 12.5px;
  cursor: pointer; box-shadow: 0 3px 10px rgba(20, 24, 33, .08); font-family: inherit;
}
.active-plan-chip:hover { background: var(--vm-bg-soft, #f2f4f7); }
.active-plan-chip:focus-visible { outline: 2px solid var(--vm-accent, #3a5bd9); outline-offset: 2px; }
.active-plan-chip .apc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--vm-accent, #3a5bd9); flex: none; }
.active-plan-chip .apc-count { font-variant-numeric: tabular-nums; color: var(--vm-text-2, #5b6472); font-weight: 600; }
.active-plan-chip .apc-arrow { color: var(--vm-text-3, #8a92a0); }
.conn-lost {
  display: flex; align-items: center; justify-content: center; gap: 8px; width: fit-content; margin: 0 auto 8px;
  padding: 6px 8px 6px 13px; border: 1px solid var(--vm-border, #e4e8ee); border-radius: 999px;
  background: var(--vm-surface, #fff); color: var(--vm-text-2, #5b6472); font-size: 12.5px;
  box-shadow: 0 3px 10px rgba(20, 24, 33, .08);
}
.conn-lost__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--warning, #f59e0b); flex: none; }
.conn-lost__btn {
  padding: 3px 10px; border: 1px solid var(--vm-border, #e4e8ee); border-radius: 999px;
  background: transparent; color: var(--vm-text, #1a1d23); font: inherit; font-weight: 600; cursor: pointer;
}
.conn-lost__btn:hover { background: var(--vm-bg-soft, #f2f4f7); }
.conn-lost__btn:focus-visible { outline: 2px solid var(--vm-accent, #3a5bd9); outline-offset: 2px; }
/* The mode bar: centred, quiet, and clear of the thread header's own actions. */
.turnmode-bar { display: flex; justify-content: center; padding: 10px 0 2px; }

/* ── Phone (<=640px) ───────────────────────────────────────────────────────────────────────────
   The thread header spent 22px of side padding and a full-width title row on a screen 390px wide, and
   the session meter + mode bar added two more strips above the composer. Tighten the chrome; the
   conversation and the input keep the space. */
@media (max-width: 640px) {
  .chat-header { padding: 9px 12px; gap: 8px; }
  .chat-title { font-size: 0.9375rem; }
  .chat-agent { font-size: 0.6875rem; }
  .chat-actions { gap: 6px; }
  /* "New" becomes its own icon button: five controls plus a title do not fit across 390px. */
  .header-btn { padding: 7px; border-radius: 10px; }
  .header-btn span { display: none; }
  .icon-btn { width: 32px; height: 32px; }
  .session-meter { padding: 0 12px 4px; font-size: 10px; }
  .turnmode-bar { padding: 6px 0 0; }
  .active-plan-chip { font-size: 0.75rem; }
}
/* Touch targets of at least 44px (plan 4.4) without widening the header: the visible button keeps its
   size and an invisible hit area extends it. */
@media (pointer: coarse) {
  .icon-btn, .header-btn { position: relative; }
  .icon-btn::after, .header-btn::after { content: ''; position: absolute; left: 50%; top: 50%;
    width: max(100%, 44px); height: max(100%, 44px); transform: translate(-50%, -50%); }
}

</style>
