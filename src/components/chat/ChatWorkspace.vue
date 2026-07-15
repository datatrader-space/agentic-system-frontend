<template>
  <div class="chat-split" ref="splitEl" :class="{ 'canvas-open': canvasOpen, 'canvas-mobile': canvasOpen && isMobile }">
   <div class="chat-workspace" :style="canvasOpen && !isMobile ? { flex: `1 1 0`, minWidth: '360px' } : null">
    <div v-if="chat.isEmpty" class="floating-history">
      <button class="icon-btn" title="Chat history" aria-label="Chat history" @click.stop="toggleHistory">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3v6h6" /><path d="M12 7v5l3 2" /></svg>
      </button>
      <div v-if="historyOpen" class="history-popover">
        <div class="history-head">
          <strong>Chat history</strong>
          <button aria-label="Close history" @click="historyOpen = false">×</button>
        </div>
        <div class="history-tabs">
          <button class="active">Local</button>
          <button disabled>Web</button>
        </div>
        <label class="history-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          <input v-model="historyQuery" placeholder="Search sessions..." />
        </label>
        <div class="history-list">
          <p v-if="!filteredGroups.length" class="history-empty">No chats found.</p>
          <section v-for="grp in filteredGroups" :key="grp.label">
            <h4>{{ grp.label }}</h4>
            <button
              v-for="s in grp.items"
              :key="s.id"
              class="history-row"
              :class="{ active: String(route.params.sessionId) === String(s.id) }"
              @click="openSession(s.id)"
            >
              <span>{{ previewOf(s) }}</span>
              <small>{{ relTime(s) }}</small>
            </button>
          </section>
        </div>
      </div>
    </div>

    <!-- Thread header (only once a conversation has started) -->
    <header v-if="!chat.isEmpty" class="chat-header">
      <div class="chat-head-text">
        <h2 class="chat-title">{{ title }}</h2>
        <span v-if="chat.currentAgent" class="chat-agent">{{ chat.currentAgent.name }}</span>
      </div>
      <div class="chat-actions">
        <button class="icon-btn" title="Chat history" aria-label="Chat history" @click.stop="toggleHistory">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3v6h6" /><path d="M12 7v5l3 2" /></svg>
        </button>
        <button class="header-btn" title="New chat" @click="startNew">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14" stroke-linecap="round" /></svg>
          <span>New</span>
        </button>
      </div>
      <div v-if="historyOpen" class="history-popover in-header">
        <div class="history-head">
          <strong>Chat history</strong>
          <button aria-label="Close history" @click="historyOpen = false">×</button>
        </div>
        <div class="history-tabs">
          <button class="active">Local</button>
          <button disabled>Web</button>
        </div>
        <label class="history-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          <input v-model="historyQuery" placeholder="Search sessions..." />
        </label>
        <div class="history-list">
          <p v-if="!filteredGroups.length" class="history-empty">No chats found.</p>
          <section v-for="grp in filteredGroups" :key="grp.label">
            <h4>{{ grp.label }}</h4>
            <button
              v-for="s in grp.items"
              :key="s.id"
              class="history-row"
              :class="{ active: String(route.params.sessionId) === String(s.id) }"
              @click="openSession(s.id)"
            >
              <span>{{ previewOf(s) }}</span>
              <small>{{ relTime(s) }}</small>
            </button>
          </section>
        </div>
      </div>
    </header>

    <!-- Body -->
    <div class="chat-body">
      <ChatWelcome v-if="chat.isEmpty" @submit="onSend" />
      <ChatMessageList v-else />
    </div>

    <!-- Composer (thread mode; welcome screen has its own) -->
    <div v-if="!chat.isEmpty" class="chat-footer">
      <!-- Active-plan navigation chip: scrolls back to the inline plan card when it's out of view. -->
      <button v-if="activePlan" type="button" class="active-plan-chip" @click="scrollToActivePlan"
              aria-label="Jump to the active plan">
        <span class="apc-dot" aria-hidden="true"></span>
        <span class="apc-label">Active plan</span>
        <span class="apc-count">{{ activePlan.done }}/{{ activePlan.total }}</span>
        <span class="apc-arrow" aria-hidden="true">↑</span>
      </button>
      <!-- URL/YouTube import lives in the composer "+" menu (conversation-scoped DocumentSource →
           MarkItDown pipeline). Explicit action only; we never auto-ingest URLs typed in a message.
           agent-id comes from selectedAgentId (always set once a conversation loads), NOT
           currentAgent — the latter only resolves if the agent is in the workspace-scoped agents
           list, so it would hide the mode picker for cross-workspace/unloaded agents. -->
      <ChatComposer :streaming="chat.isStreaming" :attachments="chat.pendingAttachments"
        :agent-id="chat.selectedAgentId"
        :conversation-id="chat.conversationId"
        :run-mode="chat.currentAgent && chat.currentAgent.agent_run_mode"
        @send="onSend" @stop="chat.stop()" @mode-change="onModeChange"
        @attach="chat.addAttachments" @remove-attach="chat.removeAttachment"
        @open-media="mediaOpen = true" />
      <div v-if="chat.sessionTokens" class="session-meter" :title="`Total tokens used in this chat`">
        Session {{ fmtTokens(chat.sessionTokens) }}<span v-if="chat.sessionCost"> · {{ fmtCost(chat.sessionCost) }}</span>
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

    <!-- Media gallery: browse this chat's (or the whole agent's) generated + uploaded media and attach
         selected items to the next message BY ID (no re-upload) so the agent can reference/edit them. -->
    <MediaGallery :open="mediaOpen" :conversation-id="chat.conversationId"
                  @close="mediaOpen = false" @attach="onAttachMedia" />
   </div>

    <!-- Canvas + Live Preview side panel (opens when the agent produces a design). -->
    <div v-if="canvasOpen && !isMobile" class="cv-resize" @mousedown="startResize" title="Drag to resize"></div>
    <CanvasShell
      v-if="canvasOpen"
      class="cv-pane"
      :style="isMobile ? null : { flex: `0 0 ${canvasWidth}px` }"
    />
  </div>
</template>

<script setup>
import { computed, watch, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../../stores/useChatStore'
import { useCanvasStore } from '../../stores/useCanvasStore'
import { useLayoutStore } from '../../stores/useLayoutStore'
import { usePlanStore } from '../../stores/usePlanStore'
import ChatWelcome from './ChatWelcome.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatComposer from './ChatComposer.vue'
import CanvasShell from '../canvas/CanvasShell.vue'
import HITLModal from '../HITLModal.vue'
import MediaGallery from './MediaGallery.vue'
import { fmtTokens, fmtCost } from '../../composables/tokens'
import { previewOf, relTime, groupSessions } from '../../composables/useChatHistory'

const chat = useChatStore()
const canvas = useCanvasStore()
const layout = useLayoutStore()
const plan = usePlanStore()
const route = useRoute()
const router = useRouter()

// Active-plan navigation chip (inline plan artifact — approved wireframe §4). A nav aid only: it shows
// the live plan's progress near the composer and scrolls back to the anchored card. NOT a second card
// and NOT a second source of state. Shown on the durable-anchor path while a plan is still incomplete.
const activePlan = computed(() => {
  if (!chat.hasDurablePlanAnchors) return null
  const p = plan.progressForConversation(chat.conversationId)
  if (!p || (p.total > 0 && p.done >= p.total)) return null   // hide once complete / no steps
  return p
})
function scrollToActivePlan() {
  const el = typeof document !== 'undefined' && document.querySelector('.msg-list .msg-plan')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
const historyOpen = ref(false)
const historyQuery = ref('')

// ── Canvas side panel (resizable) ────────────────────────────────────────────────────────────────
const canvasOpen = computed(() => canvas.open && canvas.hasCanvas)
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth < 768)

// Auto-collapse the left side navigation while the Canvas panel is open (more room for the preview),
// then restore whatever the user had before. Transient — we don't persist this over their real
// sidebar preference.
let _prevSidebarCollapsed = null
watch(canvasOpen, (open) => {
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
const onWinResize = () => { isMobile.value = window.innerWidth < 768 }

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

const filteredGroups = computed(() => {
  const q = historyQuery.value.trim().toLowerCase()
  return groupSessions(chat.allSessions)
    .map((grp) => ({
      ...grp,
      items: grp.items
        .filter((s) => {
          if (!q) return true
          return `${previewOf(s)} ${s.agent_profile_name || s.agent_name || ''}`.toLowerCase().includes(q)
        })
        .slice(0, 12),
    }))
    .filter((grp) => grp.items.length)
})

const toggleHistory = async () => {
  historyOpen.value = !historyOpen.value
  if (historyOpen.value) await chat.loadAllSessions()
}

const openSession = (id) => {
  historyOpen.value = false
  router.push(`/dashboard/chat/${id}`)
}

// Persist the mode change locally so the picker + any badges reflect it immediately.
const onModeChange = (patch) => {
  if (chat.currentAgent) {
    chat.currentAgent.agent_run_mode = patch.agent_run_mode
  }
}

const onSend = (text) => chat.sendMessage(text)

// Media gallery open state + attach handler (bind chosen existing media to the next message BY ID).
const mediaOpen = ref(false)
const onAttachMedia = (items) => chat.addExistingMedia(items)

const startNew = () => {
  chat.reset()
  if (route.path !== '/dashboard/chat/new') router.push('/dashboard/chat/new')
}

onMounted(async () => {
  window.addEventListener('resize', onWinResize)
  await chat.loadAgents()
  chat.loadAllSessions()
  const sid = route.params.sessionId
  if (sid) {
    chat.openConversation(sid)
    canvas.adoptConversation(sid)
  } else {
    if (chat.conversationId) chat.reset()
    canvas.close()
    // New chat: open the socket + pre-build the (auto-)selected agent now, during the idle window
    // before the user sends — so the first message reuses the runner (no ~6.6s cold build).
    chat.prewarmAgent()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWinResize)
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
    else { chat.reset(); canvas.close() }
  }
)

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
}
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
.floating-history {
  position: absolute;
  top: 16px;
  right: 18px;
  z-index: 35;
}
.history-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 344px;
  max-height: min(520px, calc(100vh - 96px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #d7d7d7;
  background: #1f1f1f;
  border: 1px solid #363636;
  border-radius: 8px;
  box-shadow: 0 22px 55px rgba(0, 0, 0, .35);
}
.history-popover.in-header {
  top: 52px;
  right: 22px;
}
.history-head {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 12px;
  border-bottom: 1px solid #303030;
}
.history-head strong {
  color: #f4f4f5;
  font-size: 12.5px;
  font-weight: 700;
}
.history-head button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  font-size: 18px;
}
.history-head button:hover { background: #2b2b2b; color: #fff; }
.history-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 6px;
  background: #292929;
}
.history-tabs button {
  height: 30px;
  border: 0;
  border-radius: 5px;
  color: #b8b8b8;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
}
.history-tabs button.active {
  color: #f4f4f5;
  background: #1b1b1b;
}
.history-tabs button:disabled {
  opacity: .7;
}
.history-search {
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 7px 8px 4px;
  padding: 0 9px;
  color: #888;
  background: #181818;
  border: 1px solid #2b2b2b;
  border-radius: 6px;
}
.history-search svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}
.history-search input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  color: #e5e7eb;
  background: transparent;
  font-size: 12px;
}
.history-search input::placeholder { color: #858585; }
.history-list {
  overflow-y: auto;
  padding: 4px 4px 8px;
}
.history-list section + section {
  margin-top: 7px;
}
.history-list h4 {
  margin: 8px 4px 4px;
  color: #8b949e;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .02em;
}
.history-row {
  width: 100%;
  min-height: 30px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: 0;
  border-radius: 5px;
  color: #d0d0d0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.history-row:hover,
.history-row.active {
  background: #24383b;
  color: #fff;
}
.history-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.history-row small {
  color: #a3a3a3;
  font-size: 11px;
}
.history-empty {
  margin: 22px 0;
  color: #9ca3af;
  text-align: center;
  font-size: 12px;
}

.chat-body { flex: 1; min-height: 0; }
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
</style>
