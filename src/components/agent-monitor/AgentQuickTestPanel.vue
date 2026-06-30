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
        <div
          class="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed"
          :class="m.role === 'user'
            ? 'bg-[#2563EB] text-white'
            : (m.error ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-[#0F172A]')"
        >{{ m.content }}</div>
      </div>

      <!-- streaming bubble -->
      <div v-if="streaming" class="flex justify-start">
        <div class="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-slate-100 px-3.5 py-2 text-[13px] leading-relaxed text-[#0F172A]">
          {{ streamBuf || '…' }}<span class="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-slate-400 align-middle" />
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
import { ChatConnection } from '../../services/chatService'

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
