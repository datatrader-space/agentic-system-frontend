<template>
  <div ref="rootEl" class="composer-shell">
    <!-- Canvas click-to-select: the element your next message will edit. -->
    <div v-if="canvas.selectedElement" class="cv-sel-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7 18 2-7 7-2z" stroke-linejoin="round"/></svg>
      <span v-if="canvas.selectedElement.provider === 'web_builder'">Editing <strong>{{ canvas.selectedElement.tag ? '<' + canvas.selectedElement.tag + '>' : canvas.selectedElement.element_id }}</strong>
        <em v-if="canvas.selectedElement.label">{{ canvas.selectedElement.label }}</em></span>
      <span v-else>Editing <strong>&lt;{{ canvas.selectedElement.tag }}&gt;</strong>
        <em v-if="canvas.selectedElement.label">{{ canvas.selectedElement.label }}</em></span>
      <button type="button" class="cv-sel-banner-x" title="Clear selection" @click="canvas.clearSelection()">×</button>
    </div>

    <!-- Staged attachments (images/files) to send with the next message -->
    <div v-if="attachments.length" class="attach-strip">
      <div v-for="(a, i) in attachments" :key="i" class="attach-chip">
        <img v-if="a.isImage && a.url" :src="a.url" class="attach-thumb" :alt="a.name" />
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="attach-fileicon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
        <span class="attach-name">{{ a.name }}</span>
        <button type="button" class="attach-x" title="Remove" @click="$emit('remove-attach', i)">×</button>
      </div>
    </div>

    <!-- Single unified container: text area on top, action toolbar on the bottom. -->
    <form class="composer" :class="{ focused }" @submit.prevent="onSubmit">
      <!-- Accept everything: images (native vision) + documents/PDF/sheets/audio (MarkItDown RAG). -->
      <input ref="fileEl" type="file" multiple class="file-hidden" @change="onFiles" />

      <div class="composer-top">
        <textarea
          ref="inputEl"
          v-model="draft"
          class="composer-input"
          rows="1"
          :placeholder="placeholder"
          aria-label="Message your agent"
          @input="autoGrow"
          @keydown="onKeydown"
          @paste="onPaste"
          @focus="focused = true"
          @blur="focused = false"
        ></textarea>
        <!-- Mic (top-right) — only when the browser can actually transcribe -->
        <button v-if="speech.supported" type="button" class="mic-btn" :class="{ live: speech.listening.value }"
                :title="speech.listening.value ? 'Stop dictation' : 'Voice input'" aria-label="Voice input"
                @click="speech.toggle()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
        </button>
      </div>

      <!-- Bottom toolbar: "+" attach menu + mode pill (left), send/stop (right) -->
      <div class="composer-bar">
        <div class="bar-left">
          <!-- ChatGPT-style "+" menu: add files, or ask about a link / YouTube. -->
          <div class="plus-wrap">
            <button type="button" class="ghost-btn" :class="{ active: menuOpen }" title="Add photos & files"
                    aria-haspopup="menu" :aria-expanded="menuOpen ? 'true' : 'false'" aria-label="Add attachment"
                    data-test="composer-plus" @click.stop="toggleMenu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14m-7-7h14" stroke-linecap="round"/></svg>
            </button>

            <!-- Floating options card (opens above the composer) — ChatGPT-style list + search footer. -->
            <div v-if="menuOpen" class="plus-menu" role="menu" data-test="composer-plus-menu" @click.stop>
              <div class="plus-list">
                <button type="button" class="plus-item" role="menuitem" data-test="plus-add-files"
                        v-show="pShow('add photos files upload computer documents pdf')" @click="pickFiles">
                  <span class="plus-ic plus-ic--files">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                  <span class="plus-body"><span class="plus-title">Add photos &amp; files</span>
                    <span class="plus-desc">Upload from your computer</span></span>
                </button>

                <button type="button" class="plus-item" role="menuitem" data-test="plus-image-mode"
                        :class="{ 'is-on': imageMode }" :disabled="!hasImageModel && !imageMode"
                        v-show="pShow('create image generate edit visualize picture')"
                        @click="toggleImageModeFromMenu">
                  <span class="plus-ic plus-ic--image">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" stroke-linejoin="round"/><path d="M19 15l.6 1.7 1.7.6-1.7.6L19 20l-.6-1.7-1.7-.6 1.7-.6L19 15z" stroke-linejoin="round"/></svg>
                  </span>
                  <span class="plus-body"><span class="plus-title">Create image</span>
                    <span class="plus-desc">{{ hasImageModel ? 'Generate &amp; edit images' : 'Assign an image model first' }}</span></span>
                  <span v-if="imageMode" class="plus-badge">On</span>
                </button>

                <button type="button" class="plus-item" role="menuitem" data-test="plus-add-link"
                        :disabled="!conversationId" :title="conversationId ? '' : 'Send a message first to start the chat'"
                        v-show="pShow('ask link youtube webpage url paste video')" @click="openUrl">
                  <span class="plus-ic plus-ic--link">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </span>
                  <span class="plus-body"><span class="plus-title">Ask about a link</span>
                    <span class="plus-desc">Paste a webpage or YouTube link</span></span>
                </button>

                <button type="button" class="plus-item" role="menuitem" data-test="plus-canvas"
                        :class="{ 'is-on': canvasMode }" v-show="pShow('design canvas web page live preview build')"
                        @click="toggleCanvasFromMenu">
                  <span class="plus-ic plus-ic--canvas">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9" stroke-linecap="round"/></svg>
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
                       data-test="plus-search" @click.stop @keydown.stop />
              </div>
            </div>

            <!-- URL/YouTube importer (conversation-scoped DocumentSource → MarkItDown pipeline). -->
            <div v-if="urlOpen" class="plus-url" data-test="composer-url-panel" @click.stop>
              <AddDocumentUrl :conversation-id="conversationId" scope="conversation" @added="onUrlAdded" />
            </div>
          </div>

          <!-- Sticky Create-Image chip (toggle lives in the "+" menu; × turns it off). -->
          <span v-if="imageMode" class="canvas-chip image-chip" title="Create-Image mode on — the agent focuses on images">
            <span class="canvas-chip-body">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" stroke-linejoin="round"/></svg>
              <span>Create Image</span>
            </span>
            <button type="button" class="canvas-chip-x" title="Turn off Create-Image mode" aria-label="Turn off Create-Image mode"
                    @click.stop="chat.imageMode = false">×</button>
          </span>

          <!-- Shared (system-owned) agents: run mode is admin-set globally → the pill becomes the MODEL
               picker (each user runs the shared agent on their own provider). Own agents keep the mode pill. -->
          <!-- Shared (system-owned) agents run on ONE row for every user, so mode, model and effort are all
               per-user settings resolved inside this one picker. Own agents keep the mode pill. -->
          <!-- Agent picker: same control as the welcome screen. Mid-thread it opens a NEW chat with the
               chosen agent (a conversation belongs to the agent that ran it). -->
          <AgentSwitcher v-if="agentId" />
          <AgentModelPicker v-if="agentId && isSharedAgent" :agent-id="agentId" />
          <AgentModePicker v-else-if="agentId" :agent-id="agentId" :run-mode="runMode"
                           placement="up" @change="$emit('mode-change', $event)" />

          <!-- Sticky Canvas-mode chip (toggle lives in the "+" menu; × turns it off). -->
          <span v-if="canvasMode" class="canvas-chip" title="Canvas mode on — designs open in the live preview">
            <span class="canvas-chip-body" title="Open the live preview" @click="canvas.show()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9" stroke-linecap="round"/></svg>
              <span>Canvas</span>
            </span>
            <button type="button" class="canvas-chip-x" title="Turn off Canvas mode" aria-label="Turn off Canvas mode"
                    @click.stop="canvas.setMode(false)">×</button>
          </span>
        </div>

        <!-- While the agent runs: empty input → Stop; typed input → Send (queues as mid-run steering). -->
        <button v-if="streaming && !draft.trim()" type="button" class="action-btn stop" title="Stop generating"
                aria-label="Stop generating" @click="$emit('stop')">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
        </button>
        <button v-else type="submit" class="action-btn send"
                :disabled="!draft.trim() && attachments.length === 0"
                :title="streaming ? 'Send to the running agent' : 'Send'" aria-label="Send message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </form>
    <p class="composer-hint">Enter to send · Shift+Enter for new line</p>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import AgentModePicker from '../agent/AgentModePicker.vue'
import AgentModelPicker from '../agent/AgentModelPicker.vue'
import AgentSwitcher from './AgentSwitcher.vue'
import AddDocumentUrl from '../knowledge/AddDocumentUrl.vue'
import { useSpeech } from '../../composables/useSpeech'
import { notify } from '../../composables/useNotify'
import { useCanvasStore } from '../../stores/useCanvasStore'
import { useChatStore } from '../../stores/useChatStore'

const canvas = useCanvasStore()
const chat = useChatStore()
// Create-Image mode lives in the chat store (single source of truth, read at send time to set the
// `image_mode` WS flag). Sticky across turns until turned off. The composer only lets it turn on when the
// agent has an image model (hasImageModel prop) — the backend also blocks it, this is the UX guard.
// Per-turn REASONING EFFORT. '' means 'no choice' — the agent's own setting is left alone; that is why
// the first pill is Auto and not Off. 'off' is a real instruction that switches reasoning off even on an
// agent configured to use it, which is the whole point of having it in the composer. Sticky across turns.
const effortOptions = [
  { value: '',        label: 'Auto',    hint: "Use this agent's own setting" },
  { value: 'off',     label: 'Off',     hint: 'No reasoning — fastest and cheapest' },
  { value: 'minimal', label: 'Minimal', hint: 'The least the model will do' },
  { value: 'low',     label: 'Low',     hint: 'A little thinking' },
  { value: 'medium',  label: 'Medium',  hint: 'Balanced' },
  { value: 'high',    label: 'High',    hint: 'Think hard — slower and more expensive' },
]
const reasoningEffort = computed(() => chat.reasoningEffort)
const setEffort = (value) => {
  chat.reasoningEffort = value
  const opt = effortOptions.find(o => o.value === value)
  notify.info(value
    ? `Thinking effort: ${opt.label} — ${opt.hint.toLowerCase()}.`
    : "Thinking effort: Auto — using this agent's own setting.")
}

const imageMode = computed(() => chat.imageMode)
const toggleImageMode = () => {
  if (!props.hasImageModel && !chat.imageMode) {
    notify.info('Assign an image model to this agent first, then Create-Image mode becomes available.')
    return
  }
  chat.imageMode = !chat.imageMode
  notify.info(chat.imageMode
    ? 'Create-Image mode on — the agent will focus on generating and editing images.'
    : 'Create-Image mode off.')
}
const toggleImageModeFromMenu = () => {
  toggleImageMode()
  closeMenu()
}
// Canvas mode lives in the canvas store (single source of truth so the chat store can read it when
// sending). When on, the agent renders designs into the live preview and the backend auto-exposes
// GENERATE_STATIC_PAGE for the turn.
const canvasMode = computed(() => canvas.mode)
const toggleCanvas = () => { canvas.setMode(!canvas.mode) }
const toggleCanvasFromMenu = () => {
  toggleCanvas()
  closeMenu()
  notify.info(canvas.mode
    ? 'Canvas mode on — the agent will design in a live preview panel.'
    : 'Canvas mode off.')
}

// Long pasted text becomes a .txt attachment instead of a giant inline blob (which would bloat the
// prompt and can't be retrieved/cited). Threshold is intentionally generous — normal messages,
// short snippets, and small code blocks paste normally.
const LONG_PASTE_CHAR_LIMIT = 8000
const LONG_PASTE_LINE_LIMIT = 150

const props = defineProps({
  streaming: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Message your agent…' },
  attachments: { type: Array, default: () => [] },
  // Agent + mode (so the mode pill lives inside the composer, Claude-style).
  agentId: { type: [Number, String], default: null },
  runMode: { type: String, default: 'manual' },
  // Conversation id — required to attach a URL/YouTube link (conversation-scoped DocumentSource).
  conversationId: { type: [Number, String], default: null },
  // Whether the current agent has an image model — gates the Create-Image toggle (disabled otherwise).
  hasImageModel: { type: Boolean, default: false },
  // SHARED system-owned agent (built-in / Platform Super Agent) → model pill instead of the mode pill.
  isSharedAgent: { type: Boolean, default: false },
})
const emit = defineEmits(['send', 'stop', 'attach', 'remove-attach', 'mode-change'])

const draft = ref('')
const inputEl = ref(null)
const fileEl = ref(null)
const rootEl = ref(null)
const focused = ref(false)
const menuOpen = ref(false)
// "+" menu search: filter the visible items by a free-text query (ChatGPT-style footer). Reset on close.
const plusQuery = ref('')
const pShow = (keywords) => {
  const q = plusQuery.value.trim().toLowerCase()
  return !q || keywords.toLowerCase().includes(q)
}
const urlOpen = ref(false)

// Voice input appends the transcript to whatever's already typed.
const speech = useSpeech({
  onResult: (text) => {
    draft.value = draft.value ? `${draft.value} ${text}` : text
    nextTick(autoGrow)
  },
})

// ── "+" menu open/close (toggle · outside-click · Escape) ──
const closeMenu = () => { menuOpen.value = false; urlOpen.value = false; plusQuery.value = '' }
const toggleMenu = () => {
  if (menuOpen.value || urlOpen.value) { closeMenu(); return }
  menuOpen.value = true
}
const pickFiles = () => { menuOpen.value = false; fileEl.value?.click() }
const openUrl = () => {
  if (!props.conversationId) return
  menuOpen.value = false
  urlOpen.value = true
}
const onUrlAdded = () => { /* keep the panel open so the user still sees the status badge */ }

const onDocClick = (e) => {
  if (!menuOpen.value && !urlOpen.value) return
  if (rootEl.value && !rootEl.value.contains(e.target)) closeMenu()
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

const onFiles = (e) => {
  const files = e.target.files
  if (files && files.length) emit('attach', files)
  e.target.value = '' // allow re-selecting the same file
}

// ── Paste handling ──
// Priority: clipboard image → attach as image file (native vision path, no base64 in the box).
// Long pasted text → attach as a .txt file (enters the RAG pipeline). Everything else pastes normally.
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
      // Screenshots arrive as a generic "image.png" — give them a stable, human name.
      const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
      const named = new File([f], `pasted-image-${stamp()}.${ext}`, { type: f.type || 'image/png' })
      out.push(named)
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
  nextTick(() => {
    autoGrow()
    const pos = start + text.length
    try { el.selectionStart = el.selectionEnd = pos } catch { /* ignore */ }
  })
}

const attachLongText = (text) => {
  const file = new File([text], `pasted-text-${stamp()}.txt`, { type: 'text/plain' })
  emit('attach', [file])
  notify.info('Long pasted text was attached as a text file.')
}

const isLongText = (text) =>
  text.length > LONG_PASTE_CHAR_LIMIT || text.split('\n').length > LONG_PASTE_LINE_LIMIT

const onPaste = (e) => {
  const cd = e.clipboardData || window.clipboardData
  if (!cd) return
  let images = []
  try { images = clipboardImages(cd) } catch { images = [] }
  const text = (() => { try { return cd.getData('text/plain') || '' } catch { return '' } })()
  const longText = text && isLongText(text)

  // Image present → never dump base64 into the box. Attach the image; preserve any accompanying text.
  if (images.length) {
    e.preventDefault()
    emit('attach', images)
    if (longText) attachLongText(text)
    else if (text) insertTextAtCursor(text)
    return
  }

  // No image, but a long text blob → attach as .txt instead of inlining it.
  if (longText) {
    e.preventDefault()
    attachLongText(text)
    return
  }
  // Otherwise: ordinary paste — let the browser insert the text as usual.
}

const autoGrow = () => {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

const reset = async () => {
  draft.value = ''
  await nextTick()
  autoGrow()
}

const onSubmit = () => {
  const text = draft.value.trim()
  if (!text && props.attachments.length === 0) return
  // While the agent is running, only TEXT is accepted (queued as steering) — no attachment-only sends.
  if (props.streaming && !text) return
  // Canvas mode is signalled to the backend via the `canvas_mode` flag on the WS message (which
  // auto-exposes GENERATE_STATIC_PAGE + injects the render nudge server-side) — NOT by mangling the
  // user's visible text.
  emit('send', text)
  reset()
}

const onKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSubmit()
  }
}
</script>

<style scoped>
.composer-shell {
  position: relative;
  max-width: 760px;
  margin: 0 auto;
  padding: 8px 16px 14px;
  font-family: var(--vm-font-sans);
}
.composer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: var(--vm-surface);
  border: 1.5px solid var(--vm-line);
  border-radius: 18px;
  box-shadow: var(--vm-shadow-m);
  transition: border-color 0.18s var(--vm-ease2), box-shadow 0.18s;
}
.composer.focused {
  border-color: var(--vm-sky);
  box-shadow: 0 0 0 4px rgba(14, 165, 233, .16);
}
.composer-top { display: flex; align-items: flex-start; gap: 6px; }
.composer-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  resize: none;
  padding: 6px 2px;
  font-size: 0.9375rem;
  font-family: inherit;
  line-height: 1.5;
  color: var(--vm-ink);
  background: transparent;
  max-height: 200px;
}
.composer-input::placeholder { color: var(--vm-ink-faint); }

/* bottom toolbar */
.composer-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cv-sel-banner { display: flex; align-items: center; gap: 7px; margin: 0 auto 6px; max-width: 760px; padding: 6px 12px; border: 1px solid var(--vm-violet, #c4b5fd); background: var(--vm-violet-soft, #f5f3ff); color: var(--vm-violet, #6d28d9); border-radius: 10px; font-size: 0.78rem; font-weight: 600; }
.cv-sel-banner svg { width: 14px; height: 14px; flex: 0 0 auto; }
.cv-sel-banner em { font-style: normal; font-weight: 500; opacity: .8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-sel-banner-x { margin-left: auto; width: 20px; height: 20px; display: inline-grid; place-items: center; border: 0; border-radius: 6px; background: transparent; color: var(--vm-violet, #6d28d9); font-size: 15px; cursor: pointer; flex: 0 0 auto; }
.cv-sel-banner-x:hover { background: rgba(109,40,217,.14); }

.bar-left { display: flex; align-items: center; gap: 6px; }

.canvas-chip {
  display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0;
  height: 32px; padding: 0 4px 0 10px;
  background: var(--vm-violet-soft, #f5f3ff); border: 1px solid var(--vm-violet, #c4b5fd); border-radius: 10px;
  color: var(--vm-violet, #6d28d9); font-size: 0.78rem; font-weight: 600;
}
.canvas-chip-body { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.canvas-chip-body:hover { filter: brightness(0.96); }
.canvas-chip svg { width: 15px; height: 15px; }
.canvas-chip-x {
  display: inline-grid; place-items: center; width: 20px; height: 20px; margin-left: 2px;
  border: 0; border-radius: 6px; background: transparent; color: var(--vm-violet, #6d28d9);
  font-size: 16px; line-height: 1; cursor: pointer;
}
.canvas-chip-x:hover { background: rgba(109, 40, 217, .14); }
/* "+" menu Canvas item on-state */
.plus-item.is-on { background: var(--vm-violet-soft, #f5f3ff); }
.plus-on-tag { margin-left: 6px; padding: 0 6px; border-radius: 9999px; background: var(--vm-violet, #6d28d9); color: #fff; font-size: 0.6rem; font-weight: 700; vertical-align: middle; }

.ghost-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; flex-shrink: 0;
  background: transparent; border: none; border-radius: 10px;
  color: var(--vm-ink-faint); cursor: pointer; transition: .15s var(--vm-ease);
}
.ghost-btn:hover { color: var(--vm-violet); background: var(--vm-violet-soft); }
.ghost-btn.active { color: var(--vm-violet); background: var(--vm-violet-soft); }
.ghost-btn.active svg { transform: rotate(45deg); }
.ghost-btn:disabled { opacity: 0.5; cursor: default; }
.ghost-btn svg { width: 18px; height: 18px; transition: transform .15s var(--vm-ease); }
/* Media button: icon + label, auto width (the "+" stays icon-only). */
.media-btn { width: auto; gap: 5px; padding: 0 10px; font-size: 13px; font-weight: 600; }
.media-btn .media-btn-txt { line-height: 1; }


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
.plus-item.is-on { background: var(--vm-violet-soft, #f5f3ff); }
.plus-ic {
  display: grid; place-items: center; flex-shrink: 0;
  width: 26px; height: 26px; color: var(--vm-ink-soft, #475569);
}
.plus-ic svg { width: 21px; height: 21px; }
/* Colorful per-item icon tints — ChatGPT-like, but drawn from the app palette. */
.plus-ic--files  { color: #2563eb; }
.plus-ic--image  { color: var(--vm-violet, #7c3aed); }
.plus-ic--link   { color: #0284c7; }
.plus-ic--canvas { color: #d97706; }
.plus-item:disabled .plus-ic { color: var(--vm-ink-faint); }
.plus-body { display: flex; align-items: baseline; gap: 8px; min-width: 0; flex: 1; }
.plus-title { font-size: 0.875rem; font-weight: 600; color: var(--vm-ink); white-space: nowrap; }
.plus-desc {
  font-size: 0.8125rem; color: var(--vm-ink-faint);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
.plus-badge {
  margin-left: auto; flex-shrink: 0; padding: 1px 8px; border-radius: 9999px;
  background: var(--vm-violet, #6d28d9); color: #fff; font-size: 0.625rem; font-weight: 700;
  letter-spacing: .02em;
}
/* Thinking-effort row — a static (non-clickable) plus-item whose body holds the choices. */
.plus-item--static { cursor: default; }
.plus-item--static:hover { background: transparent; }
.effort-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.effort-pill {
  padding: 2px 9px; border-radius: 9999px; cursor: pointer;
  border: 1px solid var(--vm-line, #e5e7eb); background: transparent;
  color: var(--vm-ink-faint); font-size: 0.6875rem; font-weight: 600; line-height: 1.6;
  transition: background .12s ease, color .12s ease, border-color .12s ease;
}
.effort-pill:hover { border-color: var(--vm-violet, #6d28d9); color: var(--vm-ink, inherit); }
.effort-pill:focus-visible { outline: 2px solid var(--vm-violet, #6d28d9); outline-offset: 1px; }
.effort-pill.is-on {
  background: var(--vm-violet, #6d28d9); border-color: var(--vm-violet, #6d28d9);
  color: #fff;
}

/* Search footer */
.plus-search {
  display: flex; align-items: center; gap: 8px;
  margin-top: 6px; padding: 9px 11px;
  border-top: 1px solid var(--vm-line);
}
.plus-search svg { width: 16px; height: 16px; color: var(--vm-ink-faint); flex-shrink: 0; }
.plus-search-input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-family: inherit; font-size: 0.8125rem; color: var(--vm-ink);
}
.plus-search-input::placeholder { color: var(--vm-ink-faint); }

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

.mic-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; flex-shrink: 0;
  background: transparent; border: none; border-radius: 9999px;
  color: var(--vm-ink-faint); cursor: pointer; transition: .15s var(--vm-ease);
}
.mic-btn:hover { color: var(--vm-violet); background: var(--vm-violet-soft); }
.mic-btn.live { color: #fff; background: #ef4444; animation: micpulse 1.3s ease-in-out infinite; }
.mic-btn svg { width: 16px; height: 16px; }
@keyframes micpulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }

.file-hidden { display: none; }

.attach-strip { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 4px 8px; }
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

.action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; flex-shrink: 0;
  border: none; border-radius: 12px; cursor: pointer;
  transition: transform 0.18s var(--vm-ease), opacity 0.15s;
}
.action-btn svg { width: 17px; height: 17px; }
.action-btn.send { color: #fff; background: var(--vm-g-cool); box-shadow: var(--vm-glow-v); }
.action-btn.send:hover:not(:disabled) { transform: scale(1.08) rotate(-8deg); }
.action-btn.send:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
.action-btn.stop { color: #fff; background: var(--vm-ink); }
.action-btn.stop:hover { filter: brightness(1.15); }

.composer-hint {
  margin: 8px 0 0;
  text-align: center;
  font-size: 0.6875rem;
  color: var(--vm-ink-faint);
}

@media (max-width: 560px) {
  .plus-menu, .plus-url { width: calc(100vw - 40px); }
}
</style>
