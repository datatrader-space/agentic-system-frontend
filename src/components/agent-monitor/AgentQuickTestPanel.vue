<template>
  <div class="flex h-full flex-col rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <!-- header -->
    <div class="flex items-center justify-between gap-2 border-b border-[#F2F4F7] px-4 py-3">
      <div class="flex items-center gap-2">
        <span class="grid h-8 w-8 place-items-center rounded-[10px] bg-blue-50 text-[#2563EB]">
          <FlaskConical :size="17" :stroke-width="2.1" />
        </span>
        <div>
          <h2 class="text-[14px] font-semibold leading-tight text-[#0F172A]">Quick Test</h2>
          <p class="text-[11px] leading-tight text-[#64748B]">
            <span class="inline-flex items-center gap-1">
              <span class="h-1.5 w-1.5 rounded-full" :class="connected ? 'bg-emerald-500' : 'bg-slate-300'" />
              {{ connected ? 'Connected' : 'Connecting…' }}
            </span>
          </p>
        </div>
      </div>
      <button
        class="rounded-lg px-2 py-1 text-[12px] font-medium text-[#64748B] hover:bg-slate-50"
        :disabled="!messages.length && !streaming"
        @click="clearChat"
      >
        Clear
      </button>
    </div>

    <!-- messages -->
    <div ref="scrollEl" class="flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
      <div v-if="!messages.length && !streaming" class="py-10 text-center text-[13px] text-[#64748B]">
        Send a message to test this agent live.
      </div>

      <div v-for="(m, i) in messages" :key="i" class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
        <!-- user: plain text -->
        <div
          v-if="m.role === 'user'"
          class="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-[#2563EB] px-3.5 py-2 text-[13px] leading-relaxed text-white"
        >{{ m.content }}</div>
        <!-- assistant: rendered markdown -->
        <div
          v-else
          class="qt-md max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed"
          :class="m.error ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-[#0F172A]'"
          v-html="render(m.content)"
        />
      </div>

      <!-- streaming bubble -->
      <div v-if="streaming" class="flex justify-start">
        <div class="qt-md max-w-[85%] rounded-2xl bg-slate-100 px-3.5 py-2 text-[13px] leading-relaxed text-[#0F172A]">
          <!-- typing indicator until the first chunk lands, then streamed markdown -->
          <span v-if="!streamBuf" class="flex items-center gap-1 py-0.5">
            <span class="qt-dot" />
            <span class="qt-dot" style="animation-delay:0.15s" />
            <span class="qt-dot" style="animation-delay:0.3s" />
          </span>
          <template v-else>
            <span v-html="render(streamBuf)" /><span class="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-slate-400 align-middle" />
          </template>
        </div>
      </div>
    </div>

    <!-- composer -->
    <div class="border-t border-[#F2F4F7] p-3">
      <div class="flex items-end gap-2">
        <textarea
          v-model="draft"
          rows="1"
          placeholder="Message the agent…"
          class="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB]"
          @keydown.enter.exact.prevent="send"
        />
        <button
          v-if="!streaming"
          :disabled="!draft.trim()"
          class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-40"
          @click="send"
        >
          <Send :size="16" :stroke-width="2.2" />
        </button>
        <button
          v-else
          class="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#E5E7EB] bg-white text-red-500 hover:bg-red-50"
          @click="stop"
        >
          <Square :size="15" :stroke-width="2.4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { FlaskConical, Send, Square } from 'lucide-vue-next'
import { marked } from 'marked'
import { enhanceChatMedia } from '../../utils/chatMedia'
import { ChatConnection } from '../../services/chatService'

marked.setOptions({ breaks: true, gfm: true })
function render(text) {
  return enhanceChatMedia(marked.parse(text || ''))
}

const props = defineProps({
  agentId: { type: [String, Number], required: true },
})
const emit = defineEmits(['ran'])   // fired after a turn completes so the parent can refresh

const draft = ref('')
const messages = ref([])            // { role:'user'|'assistant', content, error? }
const streaming = ref(false)
const streamBuf = ref('')
const connected = ref(false)
const conversationId = ref(null)
const scrollEl = ref(null)

let conn = null

function scrollDown() {
  nextTick(() => {
    const el = scrollEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function onEvent(msg) {
  if (!msg || !msg.type) return
  if (msg.conversation_id) conversationId.value = msg.conversation_id

  switch (msg.type) {
    case 'assistant_message_chunk':
      streamBuf.value += (msg.chunk || '')
      scrollDown()
      break
    case 'assistant_message_complete': {
      const full = msg.full_message ?? streamBuf.value
      if (full) messages.value.push({ role: 'assistant', content: full })
      finishTurn()
      break
    }
    // Some turns emit a one-shot assistant message instead of streamed chunks.
    case 'chat_response':
    case 'assistant':
    case 'assistant_message': {
      const content = msg.content ?? msg.message ?? ''
      if (content && !streamBuf.value) messages.value.push({ role: 'assistant', content })
      break
    }
    case 'agent_session_complete':
      finishTurn()
      break
    case 'stop_acknowledged':
      finishTurn(true)
      break
    case 'error':
      messages.value.push({ role: 'assistant', content: msg.error || msg.message || 'Something went wrong.', error: true })
      finishTurn()
      break
    default:
      break
  }
}

function finishTurn(stopped = false) {
  if (!streaming.value) return
  // If chunks streamed but no explicit complete delivered the text, flush the buffer.
  if (streamBuf.value && !messages.value.some((m) => m.role === 'assistant' && m.content === streamBuf.value)) {
    const last = messages.value[messages.value.length - 1]
    if (!last || last.role !== 'assistant' || last.content !== streamBuf.value) {
      messages.value.push({ role: 'assistant', content: streamBuf.value })
    }
  }
  streaming.value = false
  streamBuf.value = ''
  scrollDown()
  emit('ran')
}

function ensureConn() {
  if (conn) return
  conn = new ChatConnection(conversationId.value, {
    onOpen: () => { connected.value = true },
    onClose: () => { connected.value = false },
    onError: () => { connected.value = false },
    onEvent,
  })
  conn.prewarm(props.agentId)
  conn.connect(0)
}

function send() {
  const text = draft.value.trim()
  if (!text || streaming.value) return
  ensureConn()
  conn.setConversation(conversationId.value)
  messages.value.push({ role: 'user', content: text })
  draft.value = ''
  streamBuf.value = ''
  streaming.value = true
  scrollDown()
  conn.sendMessage(text, props.agentId)
}

function stop() {
  try { conn?.stop() } catch (e) { /* noop */ }
  finishTurn(true)
}

function clearChat() {
  messages.value = []
  streamBuf.value = ''
  streaming.value = false
  conversationId.value = null
  conn?.setConversation(null)
}

onMounted(ensureConn)
onBeforeUnmount(() => { try { conn?.close() } catch (e) { /* noop */ } })
</script>

<style scoped>
/* Typing indicator dots */
.qt-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #94a3b8;
  animation: qt-bounce 1.2s infinite ease-in-out;
}
@keyframes qt-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* Rendered markdown inside assistant bubbles */
.qt-md :deep(p) { margin: 0 0 8px; }
.qt-md :deep(p:last-child) { margin-bottom: 0; }
.qt-md :deep(ul),
.qt-md :deep(ol) { margin: 0 0 8px; padding-left: 20px; }
.qt-md :deep(li) { margin: 2px 0; }
.qt-md :deep(h1),
.qt-md :deep(h2),
.qt-md :deep(h3) { font-weight: 600; margin: 6px 0 6px; line-height: 1.3; }
.qt-md :deep(h1) { font-size: 1.15em; }
.qt-md :deep(h2) { font-size: 1.08em; }
.qt-md :deep(h3) { font-size: 1em; }
.qt-md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  background: rgba(15, 23, 42, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
}
.qt-md :deep(pre) {
  background: #0f172a;
  color: #e2e8f0;
  padding: 10px 12px;
  border-radius: 10px;
  overflow-x: auto;
  margin: 0 0 8px;
}
.qt-md :deep(pre code) { background: none; padding: 0; color: inherit; }
.qt-md :deep(strong) { font-weight: 600; }
.qt-md :deep(a) { color: #2563eb; text-decoration: underline; }
.qt-md :deep(blockquote) {
  margin: 0 0 8px;
  padding-left: 10px;
  border-left: 3px solid #cbd5e1;
  color: #475569;
}

/* Tables (GFM) — scroll horizontally rather than overflow the panel */
.qt-md :deep(table) {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 4px 0 10px;
  font-size: 0.92em;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  display: table;
}
.qt-md :deep(thead th) {
  background: #f8fafc;
  color: #0f172a;
  font-weight: 600;
  text-align: left;
}
.qt-md :deep(th),
.qt-md :deep(td) {
  padding: 6px 10px;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  vertical-align: top;
}
.qt-md :deep(th:last-child),
.qt-md :deep(td:last-child) { border-right: none; }
.qt-md :deep(tbody tr:last-child td) { border-bottom: none; }
.qt-md :deep(tbody tr:nth-child(even)) { background: #fafbfc; }
</style>
