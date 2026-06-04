<template>
  <div class="msg" :class="message.role">
    <!-- Assistant -->
    <template v-if="message.role === 'assistant'">
      <div class="avatar assistant-avatar">
        <svg viewBox="0 0 32 32" fill="none"><rect x="3" y="3" width="26" height="26" rx="8" stroke="url(#ag)" stroke-width="2.5" /><path d="M10 16l4 4 8-8" stroke="url(#ag)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /><defs><linearGradient id="ag" x1="0" y1="0" x2="32" y2="32"><stop stop-color="#6366f1" /><stop offset="1" stop-color="#d946ef" /></linearGradient></defs></svg>
      </div>
      <div class="bubble-wrap">
        <!-- Tool calls -->
        <div v-if="message.toolCalls && message.toolCalls.length" class="tool-calls">
          <ToolCallCard v-for="tc in message.toolCalls" :key="tc.name" :name="tc.name" :status="tc.status" />
        </div>

        <!-- Streaming with no text yet -->
        <StreamingIndicator v-if="isStreaming && !message.content" />

        <!-- Rendered markdown content (full answer if rehydrated, else stored stub) -->
        <div v-if="displayContent" class="bubble assistant" v-html="rendered"></div>

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

        <!-- Hover actions -->
        <div v-if="message.content && message.status !== 'streaming'" class="msg-actions">
          <button class="msg-action" :title="copied ? 'Copied' : 'Copy'" @click="copy">
            <svg v-if="!copied" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </div>
      </div>
    </template>

    <!-- User -->
    <template v-else>
      <div class="bubble user">{{ message.content }}</div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { marked } from 'marked'
import api from '../../services/api'
import ToolCallCard from './ToolCallCard.vue'
import StreamingIndicator from './StreamingIndicator.vue'

const props = defineProps({
  message: { type: Object, required: true },
})
defineEmits(['retry'])

marked.setOptions({ breaks: true, gfm: true })

const isStreaming = computed(() => props.message.status === 'streaming')

// Long-answer rehydration: stored content is a bounded stub; the full answer is
// fetched on demand from the long-answer endpoint and shown in place.
const fullContent = ref('')
const loadingFull = ref(false)
const fullError = ref('')
const displayContent = computed(() => fullContent.value || props.message.content || '')
const rendered = computed(() => marked.parse(displayContent.value))
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
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  margin-top: 2px;
}
.assistant-avatar svg { width: 100%; height: 100%; }

.bubble-wrap { min-width: 0; flex: 1; }
.tool-calls { display: flex; flex-direction: column; align-items: flex-start; }

.bubble {
  border-radius: 14px;
  font-size: 0.9375rem;
  line-height: 1.6;
  word-wrap: break-word;
}
.bubble.assistant { color: #1e293b; }
.bubble.user {
  max-width: 75%;
  padding: 11px 15px;
  color: #0f172a;
  background: #eef2ff;
  border: 1px solid #e0e7ff;
  border-radius: 14px;
  white-space: pre-wrap;
}

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

.msg-actions { margin-top: 6px; opacity: 0; transition: opacity 0.15s; }
.msg:hover .msg-actions { opacity: 1; }
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
</style>
