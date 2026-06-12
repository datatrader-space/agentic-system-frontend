<template>
  <div class="msg" :class="message.role">
    <!-- Assistant -->
    <template v-if="message.role === 'assistant'">
      <div class="avatar assistant-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
      </div>
      <div class="bubble-wrap">
        <!-- Live activity timeline: Thinking → tools → Generating → Done (collapses to a summary) -->
        <ActivityStream :activity="message.activity" />

        <!-- Rendered markdown content (full answer if rehydrated, else stored stub) -->
        <div v-if="displayContent" class="bubble assistant" v-html="rendered"></div>

        <!-- Private reasoning — collapsed by default, separate from the answer -->
        <ReasoningPanel v-if="message.status !== 'streaming'" :activity="message.activity" />

        <!-- Why the run ended (backend-determined stop reason + confidence) -->
        <div v-if="message.status !== 'streaming' && stopBadge" class="mt-1.5">
          <span class="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1"
                :class="[stopBadge.tone.bg, stopBadge.tone.text, stopBadge.tone.ring]" :title="stopBadge.title">
            <span class="w-1.5 h-1.5 rounded-full" :class="stopBadge.tone.dot"></span>
            {{ stopBadge.label }}
            <span class="opacity-60">· {{ stopBadge.confidence }}</span>
          </span>
        </div>

        <!-- Per-response token usage -->
        <TokenUsage v-if="message.status !== 'streaming'" :usage="message.usage" />

        <!-- Long-answer rehydrate: the stored content is a bounded stub; fetch the full answer on demand -->
        <div v-if="canShowFull" class="longanswer-row">
          <button class="longanswer-btn" :disabled="loadingFull" @click="showFullAnswer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            {{ loadingFull ? 'Loading full answer…' : 'Show full answer' }}
          </button>
          <span v-if="fullError" class="longanswer-err">{{ fullError }}</span>
        </div>

        <!-- Error + retry -->
        <div v-if="message.status === 'error'" class="error-row">
          <span class="error-text">⚠ {{ message.error || 'Something went wrong.' }}</span>
          <button class="retry-btn" @click="$emit('retry')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6" stroke-linecap="round" stroke-linejoin="round" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke-linecap="round" stroke-linejoin="round" /></svg>
            Retry
          </button>
        </div>

        <!-- Hover actions: feedback · copy · share · regenerate -->
        <div v-if="message.content && message.status !== 'streaming'" class="msg-actions">
          <button class="msg-action" :class="{ active: message.feedback === 'up' }" title="Good response" @click="$emit('feedback', 'up')">
            <svg viewBox="0 0 24 24" :fill="message.feedback === 'up' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="msg-action" :class="{ active: message.feedback === 'down' }" title="Bad response" @click="$emit('feedback', 'down')">
            <svg viewBox="0 0 24 24" :fill="message.feedback === 'down' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="msg-action" :title="copied ? 'Copied' : 'Copy'" @click="copy">
            <svg v-if="!copied" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <button class="msg-action" title="Share" @click="share">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>
          </button>
          <button class="msg-action" title="Regenerate" @click="$emit('regenerate')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
        </div>
      </div>
    </template>

    <!-- User -->
    <template v-else>
      <div class="user-col">
        <!-- Edit mode -->
        <div v-if="editing" class="user-edit">
          <textarea ref="editArea" v-model="editText" class="user-edit-area" rows="2"
                    @keydown="onEditKey" @input="autoGrowEdit"></textarea>
          <div class="user-edit-actions">
            <button class="ue-cancel" @click="cancelEdit">Cancel</button>
            <button class="ue-save" :disabled="!editText.trim()" @click="saveEdit">Save &amp; submit</button>
          </div>
        </div>

        <!-- Normal bubble -->
        <div v-else class="bubble user" :class="{ collapsed: isLong && !expanded }">
          <div v-if="message.attachments && message.attachments.length" class="user-attach">
            <template v-for="(a, i) in message.attachments" :key="i">
              <img v-if="a.isImage && a.url" :src="a.url" class="user-attach-thumb" :alt="a.name" />
              <span v-else class="user-attach-file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>{{ a.name }}</span>
            </template>
          </div>
          <span v-if="message.content">{{ message.content }}</span>
        </div>

        <!-- Show more/less for long messages -->
        <button v-if="isLong && !editing" class="showmore" @click="expanded = !expanded">
          {{ expanded ? 'Show less' : 'Show more' }}
        </button>

        <!-- User actions: edit · copy -->
        <div v-if="!editing && message.content" class="msg-actions user-actions">
          <button class="msg-action" title="Edit" @click="startEdit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
          </button>
          <button class="msg-action" :title="copied ? 'Copied' : 'Copy'" @click="copy">
            <svg v-if="!copied" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, nextTick } from 'vue'
import { marked } from 'marked'
import { enhanceChatMedia } from '../../utils/chatMedia'
import api from '../../services/api'
import ActivityStream from '../activity/ActivityStream.vue'
import TokenUsage from '../activity/TokenUsage.vue'
import ReasoningPanel from '../activity/ReasoningPanel.vue'
import { stopReasonBadge } from '../../composables/stopReason'

const props = defineProps({
  message: { type: Object, required: true },
})
const emit = defineEmits(['retry', 'regenerate', 'edit', 'feedback'])

marked.setOptions({ breaks: true, gfm: true })

// ── Long user-message collapse (Show more / Show less) ──
const LONG_CHARS = 500
const isLong = computed(() =>
  props.message.role === 'user' && (props.message.content || '').length > LONG_CHARS)
const expanded = ref(false)

// ── Edit a user message + re-submit ──
const editing = ref(false)
const editText = ref('')
const editArea = ref(null)
const startEdit = async () => {
  editText.value = props.message.content || ''
  editing.value = true
  await nextTick()
  editArea.value?.focus()
  autoGrowEdit()
}
const cancelEdit = () => { editing.value = false }
const saveEdit = () => {
  const t = editText.value.trim()
  if (!t) return
  editing.value = false
  emit('edit', t)
}
const onEditKey = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
  else if (e.key === 'Escape') { cancelEdit() }
}
const autoGrowEdit = () => {
  const el = editArea.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 240) + 'px'
}

// ── Share (native share sheet where available, else copy) ──
const share = async () => {
  const text = displayContent.value
  try {
    if (navigator.share) await navigator.share({ text })
    else {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => (copied.value = false), 1500)
    }
  } catch { /* user dismissed the share sheet — ignore */ }
}

const isStreaming = computed(() => props.message.status === 'streaming')
const stopBadge = computed(() => stopReasonBadge(props.message.stopReason, props.message.confidence))

// Long-answer rehydration: stored content is a bounded stub; the full answer is
// fetched on demand from the long-answer endpoint and shown in place.
const fullContent = ref('')
const loadingFull = ref(false)
const fullError = ref('')
const displayContent = computed(() => fullContent.value || props.message.content || '')
const rendered = computed(() => enhanceChatMedia(marked.parse(displayContent.value)))
const canShowFull = computed(
  () =>
    !isStreaming.value &&
    props.message.isLongResponse &&
    props.message.longAnswerRef &&
    !fullContent.value,
)

const showFullAnswer = async () => {
  if (loadingFull.value) return
  loadingFull.value = true
  fullError.value = ''
  try {
    const res = await api.get(
      `/conversations/${props.message.conversationId}/long-answer/`,
      { params: { ref: props.message.longAnswerRef } },
    )
    fullContent.value = res.data?.content || ''
    if (!fullContent.value) fullError.value = 'Full answer is empty.'
  } catch (e) {
    fullError.value = e?.response?.data?.error || 'Could not load the full answer.'
  } finally {
    loadingFull.value = false
  }
}

const copied = ref(false)
const copy = async () => {
  try {
    await navigator.clipboard.writeText(displayContent.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* ignore */
  }
}
</script>

<style scoped>
.msg {
  display: flex;
  gap: 12px;
  max-width: 760px;
  margin: 0 auto 22px;
  padding: 0 8px;
}
.msg.user { justify-content: flex-end; }

.avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  margin-top: 2px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vm-g-brand);
  box-shadow: var(--vm-glow-v);
}
.assistant-avatar svg { width: 18px; height: 18px; }

.bubble-wrap { min-width: 0; flex: 1; }
.tool-calls { display: flex; flex-direction: column; align-items: flex-start; }

.bubble {
  border-radius: 16px;
  font-size: 0.9375rem;
  line-height: 1.6;
  word-wrap: break-word;
}
.bubble.assistant { color: var(--vm-ink); }
.bubble.user {
  /* Width is capped by .user-col (max-width:80%). Using a % here too made the
     bubble's width depend on its auto-width parent (circular) → collapsed to ~1 char. */
  max-width: 100%;
  width: fit-content;
  padding: 11px 15px;
  color: #fff;
  background: var(--vm-g-brand);
  border-radius: 18px 18px 5px 18px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  box-shadow: var(--vm-glow-v);
}
.user-attach { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.user-attach-thumb { max-width: 160px; max-height: 160px; border-radius: 8px; border: 1px solid rgba(255,255,255,.5); }
.user-attach-file { display: inline-flex; align-items: center; gap: 5px; font-size: 0.8125rem; color: #fff; opacity: .95; }
.user-attach-file svg { width: 14px; height: 14px; }

.error-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}
.error-text { font-size: 0.8125rem; color: #dc2626; }
.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #475569;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.retry-btn:hover { border-color: #c7d2fe; color: #4f46e5; }
.retry-btn svg { width: 14px; height: 14px; }

.longanswer-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.longanswer-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #4f46e5;
  background: #eef2ff;
  border: 1px solid #e0e7ff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.longanswer-btn:hover:not(:disabled) { border-color: #c7d2fe; background: #e0e7ff; }
.longanswer-btn:disabled { opacity: 0.6; cursor: default; }
.longanswer-btn svg { width: 14px; height: 14px; }
.longanswer-err { font-size: 0.8125rem; color: #dc2626; }

/* AI response actions stay visible (not hover-only). User-message actions remain hover-only below. */
.msg-actions { margin-top: 6px; opacity: 1; transition: opacity 0.15s; }
.user-actions { opacity: 0; }
.msg.user:hover .user-actions { opacity: 1; }
.msg-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #94a3b8;
  background: transparent;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
}
.msg-action:hover { background: #f1f5f9; color: #475569; }
.msg-action svg { width: 15px; height: 15px; }
.msg-action.active { color: var(--vm-violet-d, #4f46e5); }

/* User column: bubble + actions, right-aligned. margin-left:auto pushes it to the
   right; max-width caps it; children size by their own intrinsic width (fit-content). */
.user-col { display: flex; flex-direction: column; align-items: flex-end; min-width: 0; max-width: 80%; margin-left: auto; }
.user-actions { margin-top: 4px; }
.bubble.user.collapsed {
  max-height: 132px;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, #000 64%, transparent);
  mask-image: linear-gradient(to bottom, #000 64%, transparent);
}
.showmore {
  margin-top: 5px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--vm-violet-d, #4f46e5);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
}
.showmore:hover { text-decoration: underline; }

/* User edit mode — viewport-based width (not %-of-auto-parent, which would collapse). */
.user-edit { width: min(520px, 70vw); }
.user-edit-area {
  width: 100%;
  border: 1.5px solid var(--vm-sky, #0ea5e9);
  border-radius: 14px;
  padding: 10px 13px;
  font-size: 0.9375rem;
  font-family: inherit;
  line-height: 1.5;
  color: var(--vm-ink, #0f172a);
  background: #fff;
  outline: none;
  resize: none;
  box-shadow: 0 0 0 4px rgba(14, 165, 233, .12);
}
.user-edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.ue-cancel, .ue-save {
  font-size: 0.8125rem; font-weight: 600; padding: 6px 14px; border-radius: 9px; cursor: pointer;
  border: 1px solid var(--vm-line, #e2e8f0);
}
.ue-cancel { background: #fff; color: #475569; }
.ue-cancel:hover { background: #f8fafc; }
.ue-save { background: var(--vm-g-brand); color: #fff; border-color: transparent; }
.ue-save:disabled { opacity: .5; cursor: not-allowed; }

/* Markdown content styling */
.bubble.assistant :deep(p) { margin: 0 0 10px; }
.bubble.assistant :deep(p:last-child) { margin-bottom: 0; }
.bubble.assistant :deep(ul),
.bubble.assistant :deep(ol) { margin: 0 0 10px; padding-left: 22px; }
.bubble.assistant :deep(li) { margin: 3px 0; }
.bubble.assistant :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  background: rgba(15, 23, 42, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
}
.bubble.assistant :deep(pre) {
  background: #0f172a;
  color: #e2e8f0;
  padding: 12px 14px;
  border-radius: 10px;
  overflow-x: auto;
  margin: 0 0 10px;
}
.bubble.assistant :deep(pre code) { background: none; padding: 0; color: inherit; }
.bubble.assistant :deep(strong) { font-weight: 600; color: #0f172a; }
.bubble.assistant :deep(a) { color: #4f46e5; text-decoration: underline; }

/* Tables (GFM) */
.bubble.assistant :deep(table) {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 4px 0 12px;
  font-size: 0.9em;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  display: table;
}
.bubble.assistant :deep(thead th) {
  background: #f8fafc;
  color: #0f172a;
  font-weight: 600;
  text-align: left;
}
.bubble.assistant :deep(th),
.bubble.assistant :deep(td) {
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  vertical-align: top;
}
.bubble.assistant :deep(th:last-child),
.bubble.assistant :deep(td:last-child) { border-right: none; }
.bubble.assistant :deep(tbody tr:last-child td) { border-bottom: none; }
.bubble.assistant :deep(tbody tr:nth-child(even)) { background: #fafbfc; }
.bubble.assistant :deep(table code) { background: rgba(15, 23, 42, 0.06); }
</style>
