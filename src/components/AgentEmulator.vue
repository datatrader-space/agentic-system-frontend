<template>
  <div class="flex flex-col h-full bg-slate-50">
    <!-- tabs -->
    <div class="px-4 pt-3 shrink-0">
      <div class="flex items-center justify-end gap-5 text-sm">
        <span class="text-gray-400 font-medium">Inspector</span>
        <span class="text-indigo-600 font-semibold border-b-2 border-indigo-600 pb-1">Emulator</span>
      </div>
    </div>
    <!-- subheader -->
    <div class="px-4 py-2 flex items-center justify-between shrink-0">
      <span class="text-sm font-bold text-gray-900">Emulator</span>
      <div class="flex items-center gap-3 text-gray-400">
        <button @click="restart" title="Restart chat" class="hover:text-gray-600 text-base leading-none">↻</button>
        <span class="text-base leading-none">⋯</span>
      </div>
    </div>

    <!-- not-saved state -->
    <div v-if="!agentId" class="flex-1 flex items-center justify-center text-center p-6">
      <div>
        <div class="text-3xl mb-2">💾</div>
        <p class="text-sm text-gray-600 font-medium">Save the agent to test it live</p>
        <p class="text-xs text-gray-400 mt-1">The preview chats with the saved agent.</p>
      </div>
    </div>

    <template v-else>
      <div class="flex-1 min-h-0 px-3 pb-3">
        <div ref="scroller" class="h-full overflow-y-auto bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div v-if="messages.length === 0" class="text-center text-xs text-gray-400 py-8">
            Send a message to test this agent.
          </div>

          <div v-for="(m, i) in messages" :key="i"
               :class="m.role === 'user' ? 'flex justify-end' : 'flex justify-start'">

            <!-- user bubble -->
            <div v-if="m.role === 'user'"
                 class="max-w-[85%] px-3 py-2 rounded-2xl text-sm bg-indigo-100 text-indigo-900 whitespace-pre-wrap break-words">
              {{ m.content }}
            </div>

            <!-- assistant: live activity timeline + markdown answer + token usage -->
            <div v-else class="max-w-[92%] w-full">
              <ActivityStream :activity="m.activity" />
              <div v-if="m.content"
                   class="emu-prose text-sm text-gray-800 break-words mt-1"
                   v-html="renderMarkdown(m.content)"></div>
              <TokenUsage v-if="!m.streaming" :usage="m.usage" />
            </div>
          </div>
        </div>
      </div>

      <div class="px-3 pb-3 shrink-0">
        <div class="flex gap-2 items-center">
          <input
            v-model="input"
            @keydown.enter="send"
            :disabled="busy"
            placeholder="Type a message…"
            class="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-50"
          />
          <button v-if="busy" @click="stop" title="Stop"
                  class="w-10 h-10 flex items-center justify-center bg-red-500 text-white rounded-xl text-base shrink-0 hover:bg-red-600">■</button>
          <button v-else @click="send" :disabled="!input.trim()"
                  class="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-xl text-base disabled:opacity-50 shrink-0">▸</button>
        </div>
        <div v-if="error" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 mt-2">{{ error }}</div>
        <div class="flex items-center justify-between mt-2 text-[11px]">
          <span class="text-gray-500">Model ▸ {{ modelName || 'default' }}</span>
          <span :class="connected ? 'text-green-600' : 'text-gray-400'">● {{ connected ? 'Connected' : (reconnecting ? 'Reconnecting…' : 'Offline') }}</span>
        </div>
      </div>
    </template>

    <!-- Human-in-the-loop approval modal (shared handler): appears when a tool is gated. -->
    <HITLModal
      :requests="hitlRequests"
      @respond="respondHitl"
      @dismiss="dismissHitl"
      @skip="skipHitl"
    />
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { marked } from 'marked'
import ActivityStream from './activity/ActivityStream.vue'
import TokenUsage from './activity/TokenUsage.vue'
import HITLModal from './HITLModal.vue'
import { useHitl } from '../composables/useHitl'
import { createActivity, start as startActivity, ingest as ingestActivity, finish as finishActivity } from '../composables/activityStream'

const props = defineProps({
  agentId: { type: [Number, String], default: null },
  modelName: { type: String, default: '' },
})

const ws = ref(null)
const connected = ref(false)
const reconnecting = ref(false)
const messages = ref([])
const input = ref('')
const busy = ref(false)
const error = ref('')
const conversationId = ref(null)
const scroller = ref(null)

// Shared HITL approval handling (same as New Chat / Playground).
const { hitlRequests, handleHitlEvent, respondHitl, dismissHitl, skipHitl } = useHitl((obj) => {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) ws.value.send(JSON.stringify(obj))
})

let intentionalClose = false
let reconnectAttempts = 0
let reconnectTimer = null

marked.setOptions({ breaks: true, gfm: true })
function renderMarkdown(text) {
  try { return marked.parse(text || '') } catch { return text || '' }
}

function wsUrl() {
  // Same-origin (dev: Vite proxies /ws -> backend). Session cookie authenticates;
  // agentId pins the agent server-side.
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${window.location.host}/ws/chat/repository/0/`
}

function closeSocket() {
  intentionalClose = true
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  if (ws.value) { try { ws.value.close() } catch (e) { /* noop */ } ws.value = null }
  connected.value = false
  reconnecting.value = false
}

function connect() {
  if (!props.agentId) return
  intentionalClose = false
  if (ws.value) { try { ws.value.close() } catch (e) { /* noop */ } ws.value = null }
  try {
    const sock = new WebSocket(wsUrl())
    ws.value = sock
    sock.onopen = () => { connected.value = true; reconnecting.value = false; reconnectAttempts = 0 }
    sock.onclose = () => {
      connected.value = false
      if (!intentionalClose) scheduleReconnect()
    }
    sock.onerror = () => { connected.value = false }
    sock.onmessage = (e) => handleEvent(e.data)
  } catch (err) {
    error.value = 'Connection failed'
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (intentionalClose || !props.agentId) return
  if (reconnectAttempts >= 6) { reconnecting.value = false; return }
  reconnecting.value = true
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000)
  reconnectAttempts++
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => connect(), delay)
}

async function scrollToBottom() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

// The active (streaming) assistant message, or null. Progress events use this so they
// never spawn a new bubble after a turn has finished (which showed a stray, stuck
// "Thinking" block under the completed answer).
function streamingAssistant() {
  const last = messages.value[messages.value.length - 1]
  return (last && last.role === 'assistant' && last.streaming) ? last : null
}

// The active assistant, or a new one for UNSOLICITED content (e.g. a greeting the
// backend pushes). No seeded "Thinking" here — send() seeds it for real turns, so an
// unsolicited message doesn't render a stray timeline.
function currentAssistant() {
  const existing = streamingAssistant()
  if (existing) return existing
  const m = { role: 'assistant', content: '', streaming: true, activity: createActivity() }
  messages.value.push(m)
  return m
}

function handleEvent(raw) {
  let evt
  try { evt = JSON.parse(raw) } catch (e) { return }
  // HITL approval events are handled by the shared composable (queue + modal).
  if (handleHitlEvent(evt)) return
  switch (evt.type) {
    case 'conversation_created':
      conversationId.value = evt.conversation_id
      break
    // Progress-bearing events update the ACTIVE turn only — never spawn a new bubble
    // (a stray one after completion is what caused the stuck "Thinking" block).
    case 'assistant_typing':
    case 'tool_call':
    case 'tool_result':
    case 'agent_progress': {
      const m = streamingAssistant()
      if (m) { ingestActivity(m.activity, evt); scrollToBottom() }
      break
    }
    case 'assistant_message_chunk': {
      const m = currentAssistant() // real content — create if needed (streamed answer)
      ingestActivity(m.activity, evt)
      m.content += (evt.chunk || '')
      scrollToBottom()
      break
    }
    case 'assistant_message_complete': {
      const m = streamingAssistant()
      if (m) {
        if (evt.full_message) m.content = evt.full_message
        if (evt.usage) m.usage = evt.usage
        finishActivity(m.activity)
        m.streaming = false
      }
      busy.value = false
      scrollToBottom()
      break
    }
    case 'chat_response':
    case 'assistant_message':
    case 'assistant': {
      // Non-streaming complete responses (legacy / media / greeting). Only act on real
      // text so an empty stray event can't create a blank bubble.
      const text = evt.full_message || evt.content || evt.message || ''
      if (text) {
        const m = streamingAssistant() || currentAssistant()
        m.content = text
        finishActivity(m.activity)
        m.streaming = false
      }
      busy.value = false
      scrollToBottom()
      break
    }
    case 'error': {
      const em = evt.error || evt.message || 'Error'
      // Benign control-message rejections must not fail the turn.
      if (/unknown message type/i.test(em)) break
      const m = streamingAssistant()
      if (m) { ingestActivity(m.activity, evt); finishActivity(m.activity); m.streaming = false }
      error.value = em
      busy.value = false
      break
    }
    case 'stop_acknowledged': {
      const m = streamingAssistant()
      if (m) { finishActivity(m.activity); m.streaming = false }
      busy.value = false
      break
    }
  }
}

function send() {
  const text = input.value.trim()
  if (busy.value || !text || !props.agentId) return
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) connect()

  messages.value.push({ role: 'user', content: text })
  // Create the assistant message up-front with a live activity timeline ("Thinking…").
  const a = { role: 'assistant', content: '', streaming: true, activity: createActivity() }
  startActivity(a.activity)
  messages.value.push(a)
  input.value = ''
  error.value = ''
  busy.value = true
  scrollToBottom()

  const payload = { type: 'chat_message', message: text, agentId: props.agentId }
  if (conversationId.value) payload.conversation_id = conversationId.value

  let tries = 0
  const trySend = () => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(payload))
    } else if (tries++ < 25) {
      setTimeout(trySend, 200)
    } else {
      finishActivity(a.activity)
      a.streaming = false
      busy.value = false
      error.value = 'Could not connect to the chat server.'
    }
  }
  trySend()
}

function stop() {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    try { ws.value.send(JSON.stringify({ type: 'stop_execution', conversation_id: conversationId.value })) } catch (e) { /* noop */ }
  }
  const m = messages.value[messages.value.length - 1]
  if (m && m.role === 'assistant' && m.streaming) { finishActivity(m.activity); m.streaming = false }
  busy.value = false
}

function restart() {
  conversationId.value = null
  messages.value = []
  error.value = ''
  busy.value = false
  connect()
}

watch(() => props.agentId, () => restart())
onMounted(connect)
onBeforeUnmount(closeSocket)
</script>

<style scoped>
/* Lightweight prose styling for rendered markdown in the compact emulator. */
.emu-prose :deep(p) { margin: 0.25rem 0; }
.emu-prose :deep(ul), .emu-prose :deep(ol) { margin: 0.25rem 0; padding-left: 1.1rem; }
.emu-prose :deep(li) { margin: 0.1rem 0; }
.emu-prose :deep(h1), .emu-prose :deep(h2), .emu-prose :deep(h3) { font-weight: 700; margin: 0.4rem 0 0.2rem; }
.emu-prose :deep(code) { background: #f1f5f9; padding: 0.05rem 0.3rem; border-radius: 0.25rem; font-size: 0.8em; }
.emu-prose :deep(pre) { background: #0f172a; color: #e2e8f0; padding: 0.6rem; border-radius: 0.5rem; overflow-x: auto; margin: 0.4rem 0; }
.emu-prose :deep(pre code) { background: transparent; color: inherit; padding: 0; }
.emu-prose :deep(a) { color: #4f46e5; text-decoration: underline; }
.emu-prose :deep(table) { border-collapse: collapse; font-size: 0.8em; }
.emu-prose :deep(th), .emu-prose :deep(td) { border: 1px solid #e2e8f0; padding: 0.2rem 0.4rem; }
.emu-prose :deep(blockquote) { border-left: 3px solid #c7d2fe; padding-left: 0.5rem; color: #64748b; margin: 0.3rem 0; }
</style>
