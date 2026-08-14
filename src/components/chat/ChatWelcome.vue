<template>
  <div class="welcome">
    <div class="welcome-inner">
      <div class="welcome-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
      </div>
      <h1 class="welcome-title">What would you like your <span class="vm-grad-text">agent</span> to do?</h1>
      <p class="welcome-sub">Ask about repositories, run tools, inspect system state, or generate a plan.</p>

      <!-- No agents yet: prominent, unmissable call to action. The composer below is disabled
           so the user understands chatting isn't available until an agent exists.
           Setup has an order: an agent needs a model, a model needs a configured AI provider —
           so if no models exist yet we point to providers FIRST, otherwise to agent creation. -->
      <div v-if="chat.needsAgent" class="no-agent-card">
        <div class="nac-icon">
          <svg v-if="needsProvider" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 1 5 5v1a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"/><path d="M4 22a8 8 0 0 1 16 0"/></svg>
        </div>
        <template v-if="needsProvider">
          <h2 class="nac-title">Connect an AI provider to get started</h2>
          <p class="nac-sub">Your agents run on AI models. First connect a provider (OpenAI, Anthropic, OpenRouter…) and activate a model — then you can create an agent and chat.</p>
          <div class="nac-actions">
            <button type="button" class="nac-cta" @click="goProviders">Set up AI provider</button>
            <router-link to="/dashboard/agents" class="nac-ghost">Skip to agents</router-link>
          </div>
        </template>
        <template v-else>
          <h2 class="nac-title">Create an agent to start chatting</h2>
          <p class="nac-sub">Agents are the AI workers that answer your messages. You need at least one before you can chat.</p>
          <div class="nac-actions">
            <button type="button" class="nac-cta" @click="goCreateAgent">Create your first agent</button>
            <router-link to="/dashboard/agents" class="nac-ghost">Browse agents</router-link>
          </div>
        </template>
      </div>

      <!-- Suggestion chips (hidden when there's no agent to act on them) -->
      <div v-if="!chat.needsAgent" class="chips">
        <button v-for="s in suggestions" :key="s" class="chip" @click="useSuggestion(s)">{{ s }}</button>
      </div>

      <!-- Composer -->
      <form class="composer" :class="{ 'composer-disabled': chat.needsAgent }" @submit.prevent="submit">
        <!-- Staged attachments -->
        <div v-if="chat.pendingAttachments.length" class="attach-strip">
          <div v-for="(a, i) in chat.pendingAttachments" :key="i" class="attach-chip">
            <img v-if="a.isImage && a.url" :src="a.url" class="attach-thumb" :alt="a.name" />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="attach-fileicon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
            <span class="attach-name">{{ a.name }}</span>
            <button type="button" class="attach-x" title="Remove" @click="chat.removeAttachment(i)">×</button>
          </div>
        </div>
        <!-- Accept everything: images (native vision) + documents/PDF/sheets/audio (MarkItDown RAG). -->
        <input ref="fileEl" type="file" multiple class="file-hidden" @change="onFiles" />
        <div class="composer-top">
          <textarea
            ref="inputEl"
            v-model="draft"
            class="composer-input"
            data-tour="composer-input"
            rows="1"
            :disabled="chat.needsAgent"
            :placeholder="chat.needsAgent ? 'Create an agent to start chatting…' : 'Message your agent…'"
            @input="autoGrow"
            @keydown="onKeydown"
            @paste="onPaste"
          ></textarea>
          <button v-if="speech.supported" type="button" class="composer-mic" :class="{ live: speech.listening.value }"
                  :title="speech.listening.value ? 'Stop dictation' : 'Voice input'" @click="speech.toggle()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
          </button>
        </div>
        <!-- Bottom toolbar: + attach + mode pill (left), send (right) -->
        <div class="composer-actions">
          <div class="composer-bar-left" data-tour="chat-controls">
            <!-- ChatGPT-style "+" menu: add files, or (once the chat exists) ask about a link. -->
            <div ref="plusRootEl" class="plus-wrap">
              <button type="button" class="composer-attach" :class="{ active: menuOpen }" title="Add photos & files"
                      aria-haspopup="menu" :aria-expanded="menuOpen ? 'true' : 'false'" aria-label="Add attachment"
                      data-test="welcome-plus" @click.stop="toggleMenu">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14" stroke-linecap="round" /></svg>
              </button>
              <div v-if="menuOpen" class="plus-menu" role="menu" data-test="welcome-plus-menu" @click.stop>
                <div class="plus-list">
                  <button type="button" class="plus-item" role="menuitem" data-test="welcome-plus-files"
                          v-show="pShow('add photos files upload computer documents pdf')" @click="pickFiles">
                    <span class="plus-ic plus-ic--files">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                    <span class="plus-body"><span class="plus-title">Add photos &amp; files</span>
                      <span class="plus-desc">Upload from your computer</span></span>
                  </button>

                  <button type="button" class="plus-item" role="menuitem" data-test="welcome-plus-image-mode"
                          :class="{ 'is-on': imageMode }" :disabled="!hasImageModel && !imageMode"
                          v-show="pShow('create image generate edit visualize picture')"
                          @click="toggleImageModeFromMenu">
                    <span class="plus-ic plus-ic--image">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" stroke-linejoin="round"/><path d="M19 15l.6 1.7 1.7.6-1.7.6L19 20l-.6-1.7-1.7-.6 1.7-.6L19 15z" stroke-linejoin="round"/></svg>
                    </span>
                    <span class="plus-body"><span class="plus-title">Create image</span>
                      <span class="plus-desc">{{ hasImageModel ? 'Generate &amp; edit images' : 'Assign an image model first' }}</span></span>
                    <span v-if="imageMode" class="plus-badge">On</span>
                  </button>

                  <button type="button" class="plus-item" role="menuitem" data-test="welcome-plus-link"
                          :disabled="chat.needsAgent || urlBusy" v-show="pShow('ask link youtube webpage url paste video')"
                          @click="openUrl">
                    <span class="plus-ic plus-ic--link">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                    <span class="plus-body"><span class="plus-title">Ask about a link</span>
                      <span class="plus-desc">{{ urlBusy ? 'Starting chat…' : 'Paste a webpage or YouTube link' }}</span></span>
                  </button>

                  <button type="button" class="plus-item" role="menuitem" data-test="welcome-plus-canvas"
                          :class="{ 'is-on': canvasMode }" v-show="pShow('design canvas web page live preview build')"
                          @click="toggleCanvasFromMenu">
                    <span class="plus-ic plus-ic--canvas">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9" stroke-linecap="round"/></svg>
                    </span>
                    <span class="plus-body"><span class="plus-title">Design in Canvas</span>
                      <span class="plus-desc">Build a live web page in a side panel</span></span>
                    <span v-if="canvasMode" class="plus-badge">On</span>
                  </button>
                </div>

                <div class="plus-search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>
                  <input v-model="plusQuery" type="text" class="plus-search-input"
                         placeholder="Type to search plugins, files, folders &amp; skills"
                         data-test="welcome-plus-search" @click.stop @keydown.stop />
                </div>
              </div>
              <!-- URL/YouTube importer — starts the chat on demand so a conversation-scoped source can
                   be created even from the brand-new screen (ChatGPT-style). -->
              <div v-if="urlOpen" class="plus-url" data-test="welcome-url-panel" @click.stop>
                <AddDocumentUrl :conversation-id="chat.conversationId" scope="conversation" @added="() => {}" />
              </div>
            </div>
            <!-- The agent is FIXED — there is NO agent picker in the chat UI. A naked New Chat is the
                 Platform Super Agent; a specific agent arrives from its card's Chat button (?agent=…). -->
            <span v-if="chat.currentAgent" class="agent-chip" :class="{ super: chat.isSharedAgent }"
                  :title="chat.currentAgent.description || chat.currentAgent.name">
              <svg v-if="chat.isSharedAgent" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 5.4 5.6.6-4.2 3.9 1.2 5.6L12 14.9 7 17.5l1.2-5.6L4 8l5.6-.6L12 2z"/></svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="8" width="14" height="10" rx="2"/><path d="M12 8V5M9 5h6M9 13h.01M15 13h.01"/></svg>
              <span class="agent-chip-name">{{ chat.currentAgent.name }}</span>
            </span>
            <AgentModelPicker v-if="chat.currentAgent && chat.isSharedAgent"
              :agent-id="chat.currentAgent.id" />
            <AgentModePicker v-else-if="chat.currentAgent"
              :key="chat.currentAgent.id"
              :agent-id="chat.currentAgent.id"
              :run-mode="chat.currentAgent.agent_run_mode"
              placement="up" @change="onModeChange" />
            <!-- Sticky Canvas-mode chip (toggle lives in the "+" menu; × turns it off). -->
            <span v-if="canvasMode" class="canvas-chip" title="Canvas mode on — designs open in the live preview">
              <span class="canvas-chip-body" title="Open the live preview" @click="canvas.show()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9" stroke-linecap="round"/></svg>
                <span>Canvas</span>
              </span>
              <button type="button" class="canvas-chip-x" title="Turn off Canvas mode" aria-label="Turn off Canvas mode"
                      @click.stop="canvas.setMode(false)">×</button>
            </span>
            <!-- Sticky Create-Image chip (toggle lives in the "+" menu; × turns it off). -->
            <span v-if="imageMode" class="canvas-chip image-chip" title="Create-Image mode on — the agent focuses on images">
              <span class="canvas-chip-body">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" stroke-linejoin="round"/></svg>
                <span>Create Image</span>
              </span>
              <button type="button" class="canvas-chip-x" title="Turn off Create-Image mode" aria-label="Turn off Create-Image mode"
                      @click.stop="chat.imageMode = false">×</button>
            </span>
          </div>
          <button type="submit" class="composer-send" :disabled="chat.needsAgent || (!draft.trim() && !chat.pendingAttachments.length)" title="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../../stores/useChatStore'
import { useCanvasStore } from '../../stores/useCanvasStore'
import api from '../../services/api'
import AgentModePicker from '../agent/AgentModePicker.vue'
import AgentModelPicker from '../agent/AgentModelPicker.vue'
import AddDocumentUrl from '../knowledge/AddDocumentUrl.vue'
import { useSpeech } from '../../composables/useSpeech'
import { notify } from '../../composables/useNotify'

// Long pasted text becomes a .txt attachment instead of a giant inline blob (matches ChatComposer).
const LONG_PASTE_CHAR_LIMIT = 8000
const LONG_PASTE_LINE_LIMIT = 150

const emit = defineEmits(['submit'])
const chat = useChatStore()
const router = useRouter()

const goCreateAgent = () => router.push('/dashboard/agents/new')
const goProviders = () => router.push('/dashboard/settings/providers')

// Setup order: an agent needs an active model, a model needs a configured provider. Only
// checked when the user has no agents (the empty-state branch) so we point them to the
// genuine first step. Best-effort — defaults to the agent CTA if the check fails.
const needsProvider = ref(false)
const checkModels = async () => {
  try {
    const res = await api.getLlmModels()
    const models = res.data?.results || res.data || []
    needsProvider.value = Array.isArray(models) && models.length === 0
  } catch {
    needsProvider.value = false
  }
}

const draft = ref('')
const inputEl = ref(null)
const fileEl = ref(null)

// Auto-grow the textarea with its content: reset to measure the natural height, then
// match scrollHeight. CSS caps it at max-height and turns on scrolling past that point.
const autoGrow = () => {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
// Run after the DOM reflects a programmatic draft change (suggestion click, voice input, clear).
const resizeSoon = () => nextTick(autoGrow)

// Voice input (mic) — appends the transcript to the draft. Hidden when the browser can't transcribe.
const speech = useSpeech({ onResult: (text) => { draft.value = draft.value ? `${draft.value} ${text}` : text; resizeSoon() } })

const onFiles = (e) => {
  const files = e.target.files
  if (files && files.length) chat.addAttachments(files)
  e.target.value = ''
}

// ── "+" menu (toggle · outside-click · Escape) ──
const menuOpen = ref(false)
const urlOpen = ref(false)
const urlBusy = ref(false)
const plusRootEl = ref(null)
// "+" menu search: filter the visible items by a free-text query (ChatGPT-style footer). Reset on close.
const plusQuery = ref('')
const pShow = (keywords) => {
  const q = plusQuery.value.trim().toLowerCase()
  return !q || keywords.toLowerCase().includes(q)
}
const closeMenu = () => { menuOpen.value = false; urlOpen.value = false; plusQuery.value = '' }
const toggleMenu = () => {
  if (menuOpen.value || urlOpen.value) { closeMenu(); return }
  menuOpen.value = true
}
const pickFiles = () => { menuOpen.value = false; fileEl.value?.click() }
// Canvas mode (single source of truth in the canvas store; read by the chat store when sending).
const canvas = useCanvasStore()
const canvasMode = computed(() => canvas.mode)
const toggleCanvasFromMenu = () => {
  canvas.setMode(!canvas.mode)
  closeMenu()
  notify.info(canvas.mode
    ? 'Canvas mode on — the agent will design in a live preview panel.'
    : 'Canvas mode off.')
}
// Create-Image mode (sticky in the chat store; sent as the `image_mode` flag). Gated on the selected
// agent having an image model — the "+" item is disabled otherwise (backend also blocks it).
const imageMode = computed(() => chat.imageMode)
const hasImageModel = computed(() => !!(chat.currentAgent && chat.currentAgent.image_model))
const toggleImageModeFromMenu = () => {
  if (!hasImageModel.value && !chat.imageMode) {
    notify.info('Assign an image model to this agent first, then Create-Image mode becomes available.')
    return
  }
  chat.imageMode = !chat.imageMode
  closeMenu()
  notify.info(chat.imageMode
    ? 'Create-Image mode on — the agent will focus on generating and editing images.'
    : 'Create-Image mode off.')
}
// Ask-about-a-link on a brand-new chat: quietly start the conversation first so the URL can become a
// conversation-scoped DocumentSource (ChatGPT-style — the chat starts the moment you attach).
const openUrl = async () => {
  if (chat.needsAgent || urlBusy.value) return
  if (!chat.conversationId) {
    urlBusy.value = true
    const cid = await chat.ensureConversation()
    urlBusy.value = false
    if (!cid) return
  }
  menuOpen.value = false
  urlOpen.value = true
}
const onDocClick = (e) => {
  if (!menuOpen.value && !urlOpen.value) return
  if (plusRootEl.value && !plusRootEl.value.contains(e.target)) closeMenu()
}
const onDocKey = (e) => { if (e.key === 'Escape' && (menuOpen.value || urlOpen.value)) closeMenu() }
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKey)
})

// ── Paste handling (clipboard image → attach; long text → .txt; else normal) ──
const stamp = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
const clipboardImages = (cd) => {
  const out = []
  for (const item of Array.from(cd.items || [])) {
    if (item.kind === 'file' && /^image\//.test(item.type || '')) {
      const f = item.getAsFile()
      if (!f) continue
      const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
      out.push(new File([f], `pasted-image-${stamp()}.${ext}`, { type: f.type || 'image/png' }))
    }
  }
  return out
}
const insertTextAtCursor = (text) => {
  const el = inputEl.value
  if (!el) { draft.value += text; return }
  const start = el.selectionStart ?? draft.value.length
  const end = el.selectionEnd ?? draft.value.length
  draft.value = draft.value.slice(0, start) + text + draft.value.slice(end)
  resizeSoon()
}
const attachLongText = (text) => {
  chat.addAttachments([new File([text], `pasted-text-${stamp()}.txt`, { type: 'text/plain' })])
  notify.info('Long pasted text was attached as a text file.')
}
const isLongText = (text) =>
  text.length > LONG_PASTE_CHAR_LIMIT || text.split('\n').length > LONG_PASTE_LINE_LIMIT
const onPaste = (e) => {
  if (chat.needsAgent) return   // composer is disabled until an agent exists
  const cd = e.clipboardData || window.clipboardData
  if (!cd) return
  let images = []
  try { images = clipboardImages(cd) } catch { images = [] }
  const text = (() => { try { return cd.getData('text/plain') || '' } catch { return '' } })()
  const longText = text && isLongText(text)
  if (images.length) {
    e.preventDefault()
    chat.addAttachments(images)
    if (longText) attachLongText(text)
    else if (text) insertTextAtCursor(text)
    return
  }
  if (longText) {
    e.preventDefault()
    attachLongText(text)
  }
}

onMounted(async () => {
  // Ensure the agent list is present (mode / image-model wiring reads currentAgent). NOT force=true
  // and NOT a second request: this joins the shared in-flight promise ChatWorkspace already started.
  // Freshness after an agent create/edit is already covered — any agent write clears the api layer's
  // 30s /agents/ cache entry, so the next load refetches.
  await chat.loadAgents()
  // Only the zero-agent path needs the provider/model check (to order the CTA correctly).
  if (chat.needsAgent) checkModels()
})

// Reflect a mode change immediately on the selected agent (the picker also PATCHes the backend).
const onModeChange = (patch) => {
  if (chat.currentAgent) {
    chat.currentAgent.agent_run_mode = patch.agent_run_mode
  }
}

const suggestions = [
  'Analyze my repository structure',
  'List available tools',
  'Summarize recent activity',
  'Draft an implementation plan',
]

const useSuggestion = async (text) => {
  draft.value = text
  await nextTick()
  autoGrow()
  inputEl.value?.focus()
}

const onKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

const submit = () => {
  // No agent yet → route to the genuine next setup step instead of sending into the void:
  // a provider (if no models exist) or agent creation.
  if (chat.needsAgent) {
    needsProvider.value ? goProviders() : goCreateAgent()
    return
  }
  const text = draft.value.trim()
  if (!text && !chat.pendingAttachments.length) return
  emit('submit', text)
  draft.value = ''
  resizeSoon()
}
</script>

<style scoped>
.welcome {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 32px 20px;
  font-family: var(--vm-font-sans);
}
.welcome-inner {
  width: 100%;
  max-width: 680px;
  text-align: center;
}
.welcome-mark {
  width: 56px;
  height: 56px;
  margin: 0 auto 22px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vm-g-brand);
  box-shadow: var(--vm-glow-v);
  animation: vmPop .7s var(--vm-ease) both, vmFloat 5s ease-in-out infinite;
}
.welcome-mark svg { width: 28px; height: 28px; }
.welcome-title {
  font-family: var(--vm-font-display);
  font-size: 1.875rem;
  font-weight: 700;
  letter-spacing: -.025em;
  color: var(--vm-ink);
  margin: 0 0 8px;
  line-height: 1.2;
}
.welcome-sub {
  font-size: 0.9375rem;
  color: var(--vm-ink-soft);
  margin: 0 0 18px;
}
.agent-pick { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 22px; }
.agent-pick-label { font-size: 0.8125rem; color: var(--vm-ink-faint); font-weight: 600; }
.agent-select {
  padding: 8px 12px; font-size: 0.8125rem; font-weight: 600; color: var(--vm-ink);
  border: 1px solid var(--vm-line-2); border-radius: 12px; background: var(--vm-surface); cursor: pointer;
}
.agent-select:focus { outline: none; border-color: var(--vm-sky); box-shadow: 0 0 0 4px rgba(14,165,233,.16); }
.no-agent { font-size: 0.875rem; color: var(--vm-ink-faint); margin: 0 0 22px; }
.no-agent-link { color: var(--vm-violet-d); font-weight: 600; }

/* Prominent "create an agent first" empty state */
.no-agent-card {
  margin: 6px auto 24px;
  max-width: 460px;
  padding: 26px 24px;
  text-align: center;
  background: var(--vm-surface);
  border: 1.5px solid var(--vm-line);
  border-radius: 18px;
  box-shadow: var(--vm-shadow-m);
  animation: vmPop .5s var(--vm-ease) both;
}
.nac-icon {
  width: 48px; height: 48px; margin: 0 auto 14px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 14px; color: #fff; background: var(--vm-g-brand); box-shadow: var(--vm-glow-v);
}
.nac-icon svg { width: 24px; height: 24px; }
.nac-title {
  font-family: var(--vm-font-display);
  font-size: 1.125rem; font-weight: 700; color: var(--vm-ink); margin: 0 0 6px;
}
.nac-sub { font-size: 0.875rem; color: var(--vm-ink-soft); margin: 0 0 18px; line-height: 1.5; }
.nac-actions { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; }
.nac-cta {
  padding: 10px 18px; font-size: 0.875rem; font-weight: 700; color: #fff; cursor: pointer;
  background: var(--vm-g-cool); border: none; border-radius: 12px; box-shadow: var(--vm-glow-v);
  transition: transform 0.18s var(--vm-ease);
}
.nac-cta:hover { transform: translateY(-2px); }
.nac-ghost { font-size: 0.875rem; font-weight: 600; color: var(--vm-violet-d); }
.nac-ghost:hover { text-decoration: underline; }

/* Composer is visually muted + non-interactive until an agent exists */
.composer-disabled { opacity: 0.55; }
.composer-disabled:focus-within { border-color: var(--vm-line); box-shadow: var(--vm-shadow-m); }
.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}
.chip {
  padding: 9px 15px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--vm-ink-soft);
  background: var(--vm-glass-strong);
  border: 1px solid var(--vm-line);
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.18s var(--vm-ease), box-shadow 0.18s, color 0.18s, border-color 0.18s;
}
.chip:hover {
  transform: translateY(-2px);
  border-color: transparent;
  color: var(--vm-violet-d);
  background: var(--vm-violet-soft);
  box-shadow: var(--vm-shadow-s);
}
.composer {
  background: var(--vm-surface);
  border: 1.5px solid var(--vm-line);
  border-radius: 18px;
  padding: 12px 14px;
  box-shadow: var(--vm-shadow-m);
  text-align: left;
  transition: border-color .2s var(--vm-ease2), box-shadow .2s;
}
.composer:focus-within {
  border-color: var(--vm-sky);
  box-shadow: 0 0 0 4px rgba(14, 165, 233, .16);
}
.composer-input {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  font-size: 0.9375rem;
  line-height: 1.5;
  font-family: inherit;
  color: var(--vm-ink);
  background: transparent;
  box-sizing: border-box;
  max-height: 160px;
  overflow-y: auto;
}
.composer-input::placeholder { color: var(--vm-ink-faint); }
.composer-top { display: flex; align-items: flex-start; gap: 6px; }
.composer-mic {
  display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex-shrink: 0;
  border: none; border-radius: 9999px; background: transparent; color: #94a3b8; cursor: pointer; transition: .15s var(--vm-ease);
}
.composer-mic:hover { color: var(--vm-violet); background: var(--vm-violet-soft); }
.composer-mic.live { color: #fff; background: #ef4444; animation: vmMicPulse 1.3s ease-in-out infinite; }
.composer-mic svg { width: 16px; height: 16px; }
@keyframes vmMicPulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
.composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.composer-bar-left { display: flex; align-items: center; gap: 6px; }
.composer-attach {
  display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px;
  border: none; border-radius: 9px; background: transparent; color: #94a3b8; cursor: pointer;
}
.composer-attach:hover { color: var(--vm-violet); background: var(--vm-violet-soft); }
.composer-attach.active { color: var(--vm-violet); background: var(--vm-violet-soft); }
.composer-attach.active svg { transform: rotate(45deg); }
.composer-attach svg { width: 18px; height: 18px; transition: transform .15s var(--vm-ease); }

/* "+" menu — ChatGPT-style: clean list (icon + inline label/desc) + a search footer. */
.plus-wrap { position: relative; }
.plus-menu {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  width: 430px;
  max-width: min(430px, calc(100vw - 32px));
  padding: 8px;
  background: var(--vm-surface);
  border: 1px solid var(--vm-line);
  border-radius: 18px;
  box-shadow: var(--vm-shadow-l, 0 24px 56px rgba(15, 23, 42, .20));
  z-index: 40;
  animation: plus-in .14s var(--vm-ease2, cubic-bezier(.2,.8,.2,1));
}
@keyframes plus-in { from { opacity: 0; transform: translateY(6px) scale(.985); } to { opacity: 1; transform: none; } }
.plus-list { display: flex; flex-direction: column; }
.plus-item {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 9px 10px; border: none; border-radius: 12px;
  background: transparent; text-align: left; cursor: pointer;
  transition: background .12s var(--vm-ease);
}
.plus-item:hover:not(:disabled) { background: var(--vm-bg); }
.plus-item:disabled { opacity: .45; cursor: not-allowed; }
.plus-item.is-on { background: var(--vm-violet-soft); }
.plus-ic { display: grid; place-items: center; flex-shrink: 0; width: 26px; height: 26px; color: var(--vm-ink-soft, #475569); }
.plus-ic svg { width: 21px; height: 21px; }
.plus-ic--files  { color: #2563eb; }
.plus-ic--image  { color: var(--vm-violet, #7c3aed); }
.plus-ic--link   { color: #0284c7; }
.plus-ic--canvas { color: #d97706; }
.plus-item:disabled .plus-ic { color: var(--vm-ink-faint); }
.plus-body { display: flex; align-items: baseline; gap: 8px; min-width: 0; flex: 1; }
.plus-title { font-size: 0.875rem; font-weight: 600; color: var(--vm-ink); white-space: nowrap; }
.plus-desc { font-size: 0.8125rem; color: var(--vm-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.plus-badge { margin-left: auto; flex-shrink: 0; padding: 1px 8px; border-radius: 9999px; background: var(--vm-violet, #6d28d9); color: #fff; font-size: 0.625rem; font-weight: 700; letter-spacing: .02em; }
.plus-search { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 9px 11px; border-top: 1px solid var(--vm-line); }
.plus-search svg { width: 16px; height: 16px; color: var(--vm-ink-faint); flex-shrink: 0; }
.plus-search-input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-family: inherit; font-size: 0.8125rem; color: var(--vm-ink); }
.plus-search-input::placeholder { color: var(--vm-ink-faint); }
.plus-on-tag { margin-left: 6px; padding: 0 6px; border-radius: 9999px; background: var(--vm-violet); color: #fff; font-size: 0.6rem; font-weight: 700; vertical-align: middle; }
/* Fixed agent identity chip — replaces the removed agent picker (the chat's agent is not a choice). */
.agent-chip {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 1; min-width: 0;
  height: 32px; padding: 0 11px;
  background: var(--vm-bg, #f8fafc); border: 1px solid var(--vm-line, #e2e8f0); border-radius: 9999px;
  color: var(--vm-ink-soft, #475569); font-size: 0.78rem; font-weight: 700;
}
.agent-chip svg { width: 14px; height: 14px; flex-shrink: 0; }
.agent-chip.super { background: var(--vm-violet-soft, #f5f3ff); border-color: #ddd6fe; color: var(--vm-violet, #6d28d9); }
.agent-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }

.canvas-chip {
  display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0;
  height: 32px; padding: 0 4px 0 10px;
  background: var(--vm-violet-soft); border: 1px solid var(--vm-violet); border-radius: 10px;
  color: var(--vm-violet); font-size: 0.78rem; font-weight: 600;
}
.canvas-chip-body { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.canvas-chip-body:hover { filter: brightness(0.96); }
.canvas-chip svg { width: 15px; height: 15px; }
.canvas-chip-x {
  display: inline-grid; place-items: center; width: 20px; height: 20px; margin-left: 2px;
  border: 0; border-radius: 6px; background: transparent; color: var(--vm-violet);
  font-size: 16px; line-height: 1; cursor: pointer;
}
.canvas-chip-x:hover { background: rgba(109, 40, 217, .14); }
.plus-ic {
  display: grid; place-items: center; flex-shrink: 0;
  width: 34px; height: 34px; border-radius: 9px;
  background: var(--vm-violet-soft); color: var(--vm-violet);
}
.plus-ic svg { width: 18px; height: 18px; }
.plus-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.plus-txt strong { font-size: 0.8125rem; font-weight: 650; color: var(--vm-ink); }
.plus-txt small { font-size: 0.6875rem; line-height: 1.35; color: var(--vm-ink-faint); }
.plus-url {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  width: 430px;
  max-width: min(430px, calc(100vw - 32px));
  padding: 12px;
  background: var(--vm-surface);
  border: 1px solid var(--vm-line);
  border-radius: 14px;
  box-shadow: var(--vm-shadow-l, 0 20px 48px rgba(15, 23, 42, .18));
  z-index: 40;
  animation: plus-in .12s var(--vm-ease);
}
@media (max-width: 560px) { .plus-menu, .plus-url { width: calc(100vw - 40px); } }

.file-hidden { display: none; }
.attach-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.attach-chip {
  display: inline-flex; align-items: center; gap: 6px; max-width: 220px;
  padding: 4px 6px 4px 4px; background: var(--vm-bg); border: 1px solid var(--vm-line); border-radius: 10px;
}
.attach-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.attach-fileicon { width: 22px; height: 22px; color: var(--vm-ink-soft); flex-shrink: 0; }
.attach-name { font-size: 0.75rem; color: var(--vm-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attach-x {
  flex-shrink: 0; width: 18px; height: 18px; line-height: 1; border: none; border-radius: 9999px;
  background: var(--vm-line-2); color: var(--vm-ink-soft); font-size: 14px; cursor: pointer;
}
.attach-x:hover { background: #cbd5e1; }
.composer-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  color: #fff;
  background: var(--vm-g-cool);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: var(--vm-glow-v);
  transition: transform 0.18s var(--vm-ease);
}
.composer-send:hover:not(:disabled) { transform: scale(1.08) rotate(-8deg); }
.composer-send:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
.composer-send svg { width: 17px; height: 17px; }
.phase-note {
  margin-top: 14px;
  font-size: 0.75rem;
  color: #b0b8c4;
}
</style>
