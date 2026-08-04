<template>
  <section class="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
    <!-- Header -->
    <header class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
      <div class="flex items-center gap-2.5">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <FlaskConical :size="18" :stroke-width="2" />
        </span>
        <div>
          <h3 class="text-[14px] font-semibold leading-tight text-[#0F172A]">Quick Test</h3>
          <p class="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
            <span class="h-1.5 w-1.5 rounded-full" :class="connDot" />
            {{ connLabel }}
          </p>
        </div>
      </div>
      <button
        v-if="events.length"
        @click="resetChat"
        title="Clear conversation"
        class="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <RotateCcw :size="15" :stroke-width="2.25" />
      </button>
    </header>

    <!-- Feed -->
    <div ref="feed" class="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      <div v-if="!events.length && !isTyping" class="flex h-full flex-col items-center justify-center gap-2 text-center">
        <Sparkles :size="26" class="text-slate-300" />
        <p class="text-[13px] font-medium text-[#64748B]">Test {{ agent?.name || 'this agent' }}</p>
        <p class="text-[12px] text-[#94A3B8]">Send a message to start a live session.</p>
      </div>

      <template v-for="ev in events" :key="ev.id">
        <!-- User -->
        <div v-if="ev.type === 'user'" class="flex justify-end">
          <div class="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#2563EB] px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
            {{ ev.content }}
          </div>
        </div>

        <!-- Assistant -->
        <div v-else-if="ev.type === 'assistant'" class="flex items-start gap-2.5">
          <span class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-[11px] font-semibold text-white">AI</span>
          <div
            class="prose prose-sm max-w-none flex-1 text-[13px] leading-relaxed text-[#334155] prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:text-blue-600"
            v-html="ev.renderedHtml || renderMd(ev.content)"
          />
        </div>

        <!-- Error -->
        <div v-else-if="ev.type === 'error'" class="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
          <AlertTriangle :size="14" class="mt-0.5 shrink-0" />
          <span>{{ ev.content }}</span>
        </div>
      </template>

      <!-- Typing -->
      <div v-if="isTyping" class="flex items-center gap-2 pl-9 text-[12px] text-slate-400">
        <span class="flex gap-1">
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" style="animation-delay:0ms" />
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" style="animation-delay:120ms" />
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" style="animation-delay:240ms" />
        </span>
        Thinking…
      </div>
    </div>

    <!-- Composer -->
    <footer class="border-t border-slate-100 p-3">
      <div class="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-1.5 focus-within:border-blue-300">
        <textarea
          v-model="draft"
          rows="1"
          :disabled="!agent?.id || busy"
          placeholder="Ask the agent something…"
          class="max-h-28 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-[13px] text-[#334155] placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
          @keydown.enter.exact.prevent="send"
          @input="autoGrow"
          ref="ta"
        />
        <button
          v-if="busy"
          @click="stop"
          class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100"
          title="Stop"
        >
          <Square :size="14" :stroke-width="2.5" />
        </button>
        <button
          v-else
          @click="send"
          :disabled="!draft.trim() || !agent?.id"
          class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#2563EB] text-white transition hover:bg-[#1D4ED8] disabled:opacity-40"
          title="Send"
        >
          <ArrowUp :size="15" :stroke-width="2.5" />
        </button>
      </div>
    </footer>
  </section>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { marked } from 'marked'
import { renderUntrustedMarkdown } from '../../utils/safeMarkdown'
import {
  FlaskConical, Sparkles, RotateCcw, ArrowUp, Square, AlertTriangle,
} from 'lucide-vue-next'
import api from '../../services/api'

const props = defineProps({
  agent: { type: Object, default: () => ({}) },
})

// Notify the parent when a test completes so "Last Test" can update.
const emit = defineEmits(['test-complete'])

const draft = ref('')
const events = ref([])
const isTyping = ref(false)
const isProcessing = ref(false)
const busy = computed(() => isTyping.value || isProcessing.value)

const ws = ref(null)
const conversationId = ref(null)
const connecting = ref(false)
const ignoring = ref(false)

const feed = ref(null)
const ta = ref(null)

// ---- connection display ----
const wsReady = computed(() => ws.value && ws.value.readyState === WebSocket.OPEN)
const connLabel = computed(() => {
  if (connecting.value) return 'Connecting…'
  if (wsReady.value) return 'Connected'
  return 'Idle'
})
const connDot = computed(() => {
  if (connecting.value) return 'bg-amber-400'
  if (wsReady.value) return 'bg-emerald-500'
  return 'bg-slate-300'
})

// ---- markdown ----
const renderMd = (t) => renderUntrustedMarkdown(t || '')

// ---- helpers ----
const scrollDown = () => {
  nextTick(() => {
    if (feed.value) feed.value.scrollTop = feed.value.scrollHeight
  })
}
const autoGrow = () => {
  const el = ta.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 112) + 'px'
}

// ---- WS transport (mirrors AgentPlayground) ----
const connectWebSocket = () => {
  const host = import.meta.env.VITE_WS_HOST || window.location.host
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // Free-agent chat uses the dedicated agent route (no repository).
  let wsUrl = `${protocol}//${host}/ws/chat/agent/`
  const wsId = localStorage.getItem('activeWorkspaceId')
  if (wsId) wsUrl += `?workspace_id=${wsId}`

  if (wsReady.value && ws.value.url === wsUrl) return Promise.resolve()
  if (ws.value) { try { ws.value.close() } catch {} }

  connecting.value = true
  return new Promise((resolve, reject) => {
    const sock = new WebSocket(wsUrl)
    ws.value = sock
    sock.onopen = () => { connecting.value = false; resolve() }
    sock.onerror = (e) => { connecting.value = false; reject(e) }
    sock.onclose = () => { connecting.value = false }
    sock.onmessage = onWsMessage
  })
}

const onWsMessage = (event) => {
  let data
  try { data = JSON.parse(event.data) } catch { return }

  if (ignoring.value && data.type !== 'stop_acknowledged') return

  if (data.type === 'assistant_typing') {
    isTyping.value = !!data.typing
    if (data.typing) scrollDown()
    return
  }

  if (data.type === 'assistant_message_chunk') {
    isProcessing.value = true
    isTyping.value = false
    const last = events.value[events.value.length - 1]
    if (last && last.type === 'assistant' && last.streaming) {
      last.content += data.chunk
      last.renderedHtml = renderMd(last.content)
    } else {
      events.value.push({
        id: Date.now() + Math.random(),
        type: 'assistant',
        content: data.chunk,
        streaming: true,
        renderedHtml: renderMd(data.chunk),
      })
    }
    scrollDown()
    return
  }

  if (data.type === 'assistant_message_complete') {
    const last = events.value.findLast((e) => e.type === 'assistant')
    if (last) {
      last.streaming = false
      last.renderedHtml = renderMd(last.content)
    }
    isTyping.value = false
    isProcessing.value = false
    emit('test-complete', { status: 'passed', at: new Date() })
    scrollDown()
    return
  }

  // Non-streaming assistant payloads
  if (data.type === 'chat_response' || data.type === 'assistant' || data.type === 'assistant_message') {
    const content = data.content || data.message
    if (content) {
      events.value.push({ id: Date.now() + Math.random(), type: 'assistant', content })
    }
    isTyping.value = false
    isProcessing.value = false
    emit('test-complete', { status: 'passed', at: new Date() })
    scrollDown()
    return
  }

  if (data.type === 'error') {
    events.value.push({
      id: Date.now() + Math.random(),
      type: 'error',
      content: data.message || data.error || 'An error occurred.',
    })
    isTyping.value = false
    isProcessing.value = false
    emit('test-complete', { status: 'failed', at: new Date() })
    scrollDown()
  }
}

// ---- send ----
const send = async () => {
  const content = draft.value.trim()
  if (!content || !props.agent?.id || busy.value) return

  draft.value = ''
  if (ta.value) ta.value.style.height = 'auto'
  ignoring.value = false
  events.value.push({ id: Date.now() + Math.random(), type: 'user', content })
  isTyping.value = true
  isProcessing.value = true
  scrollDown()

  try {
    // Start a conversation if we don't have one yet.
    if (!conversationId.value) {
      const res = await api.post(`/agents/${props.agent.id}/chat/`, {})
      conversationId.value = res.data.conversation_id || res.data.profile_id
    }
    await connectWebSocket()

    ws.value.send(JSON.stringify({
      type: 'chat_message',
      message: content,
      conversation_id: conversationId.value,
      agentId: props.agent.id,
      model_id: props.agent.default_model || null,
    }))
  } catch (e) {
    isTyping.value = false
    isProcessing.value = false
    events.value.push({
      id: Date.now() + Math.random(),
      type: 'error',
      content: 'Could not start a test session. Please try again.',
    })
    scrollDown()
  }
}

const stop = () => {
  ignoring.value = true
  isTyping.value = false
  isProcessing.value = false
  if (wsReady.value && conversationId.value) {
    try {
      ws.value.send(JSON.stringify({ type: 'stop_execution', conversation_id: conversationId.value }))
    } catch {}
  }
  setTimeout(() => { ignoring.value = false }, 1500)
}

const resetChat = () => {
  events.value = []
  conversationId.value = null
  isTyping.value = false
  isProcessing.value = false
}

onBeforeUnmount(() => {
  if (ws.value) { try { ws.value.close() } catch {} ws.value = null }
})
</script>
