<!--
  PublicChat — the standalone, no-login chat for a shared/published agent. Loads the
  secret-free public config by share token (or slug), connects the chat WS authenticated by
  the public token (ws_auth pins the agent), and reuses the live ActivityStream transcript.
  Routes: /a/:token (full page · Preview/Share) and /embed/:token (embed · widget iframe).
  Branded from share_settings (name, avatar, theme color, greeting).
-->
<template>
  <div class="pc-root" :style="themeVars">
    <div v-if="offline" class="pc-offline">
      <div class="pc-offline-card">
        <div class="pc-offline-ico">🚫</div>
        <p>This assistant isn’t available right now.</p>
      </div>
    </div>

    <template v-else>
      <!-- top bar -->
      <header class="pc-top">
        <div class="pc-id">
          <span class="pc-av" :style="avatarStyle"><img v-if="cfg.avatar_url" :src="cfg.avatar_url" alt="" /><span v-else>🤖</span></span>
          <span class="pc-name">{{ cfg.name || 'Assistant' }}</span>
          <span class="pc-dot"></span>
        </div>
        <button v-if="messages.length" class="pc-reset" @click="reset" title="New chat">⟲</button>
      </header>

      <!-- conversation -->
      <main ref="scroller" class="pc-scroll">
        <div class="pc-wrap">
          <!-- welcome (empty) -->
          <div v-if="messages.length === 0" class="pc-welcome">
            <span class="pc-av-lg" :style="avatarStyle"><img v-if="cfg.avatar_url" :src="cfg.avatar_url" alt="" /><span v-else>🤖</span></span>
            <h1 class="pc-wtitle">{{ cfg.name || 'Assistant' }}</h1>
            <p class="pc-wgreet">{{ cfg.greeting || 'How can I help you today?' }}</p>
          </div>

          <div v-for="(m, i) in messages" :key="i" class="pc-msg" :class="m.role === 'user' ? 'is-user' : 'is-asst'">
            <template v-if="m.role === 'user'">
              <div class="pc-bubble">{{ m.content }}</div>
            </template>
            <template v-else>
              <span class="pc-msg-av" :style="avatarStyle"><img v-if="cfg.avatar_url" :src="cfg.avatar_url" alt="" /><span v-else>🤖</span></span>
              <div class="pc-asst">
                <ActivityStream :activity="m.activity" />
                <div v-if="m.content" class="pc-md" v-html="md(m.content)"></div>
              </div>
            </template>
          </div>
          <div v-if="error" class="pc-err">{{ error }}</div>
        </div>
      </main>

      <!-- input -->
      <footer class="pc-foot">
        <div class="pc-inwrap">
          <input v-model="input" @keydown.enter="send" :disabled="busy" placeholder="Type your message…" />
          <button v-if="busy" class="pc-ib pc-stop" @click="stop" title="Stop">■</button>
          <button v-else class="pc-ib pc-send" :disabled="!input.trim()" @click="send" title="Send">↑</button>
        </div>
        <div v-if="cfg.show_branding !== false" class="pc-brand">⚡ Powered by Agentic</div>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import api from '../services/api'
import ActivityStream from '../components/activity/ActivityStream.vue'
import { createActivity, start as startActivity, ingest as ingestActivity, finish as finishActivity } from '../composables/activityStream'
import { enhanceChatMedia } from '../utils/chatMedia'

const route = useRoute()
const embed = computed(() => String(route.path || '').startsWith('/embed'))
const routeToken = computed(() => route.params.token)

const cfg = ref({})
const offline = ref(false)
const wsToken = ref('')
const ws = ref(null)
const messages = ref([])
const input = ref('')
const busy = ref(false)
const error = ref('')
const conversationId = ref(null)
const scroller = ref(null)
let intentionalClose = false
let reconnectAttempts = 0
let reconnectTimer = null

marked.setOptions({ breaks: true, gfm: true })
const md = (t) => { try { return enhanceChatMedia(marked.parse(t || '')) } catch { return t || '' } }
const accent = computed(() => cfg.value.theme_color || '#4f46e5')
const themeVars = computed(() => ({ '--pc-accent': accent.value }))
const avatarStyle = computed(() => (cfg.value.avatar_url ? {} : { background: accent.value }))

async function scrollToBottom() { await nextTick(); if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight }

function wsUrl() {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${window.location.host}/ws/chat/repository/0/?token=${encodeURIComponent(wsToken.value)}`
}
function connect() {
  if (!wsToken.value) return
  intentionalClose = false
  if (ws.value) { try { ws.value.close() } catch (e) { /* noop */ } }
  try {
    const sock = new WebSocket(wsUrl())
    ws.value = sock
    sock.onopen = () => { reconnectAttempts = 0 }      // healthy — clear backoff
    sock.onmessage = (e) => handleEvent(e.data)
    // Bounded reconnect: exponential backoff (1s,2s,4s… cap 10s) then a slow 30s self-heal retry, so a
    // rejecting/closing socket can't be hammered every 1.5s (reconnect-storm guard).
    sock.onclose = () => {
      if (intentionalClose) return
      const delay = reconnectAttempts < 6 ? Math.min(1000 * Math.pow(2, reconnectAttempts++), 10000) : 30000
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(connect, delay)
    }
  } catch (e) { /* noop */ }
}

function streamingAssistant() {
  const last = messages.value[messages.value.length - 1]
  return (last && last.role === 'assistant' && last.streaming) ? last : null
}
function currentAssistant() {
  return streamingAssistant() || (() => {
    const m = { role: 'assistant', content: '', streaming: true, activity: createActivity() }
    messages.value.push(m); return m
  })()
}

function handleEvent(raw) {
  let evt; try { evt = JSON.parse(raw) } catch (e) { return }
  switch (evt.type) {
    case 'conversation_created': conversationId.value = evt.conversation_id; break
    case 'assistant_typing':
    case 'tool_call':
    case 'tool_result':
    case 'agent_progress': { const m = streamingAssistant(); if (m) { ingestActivity(m.activity, evt); scrollToBottom() } break }
    case 'assistant_message_chunk': { const m = currentAssistant(); ingestActivity(m.activity, evt); m.content += (evt.chunk || ''); scrollToBottom(); break }
    case 'assistant_message_complete': {
      const m = streamingAssistant()
      if (m) { if (evt.full_message) m.content = evt.full_message; finishActivity(m.activity); m.streaming = false }
      busy.value = false; scrollToBottom(); break
    }
    case 'chat_response':
    case 'assistant_message':
    case 'assistant': {
      const text = evt.full_message || evt.content || evt.message || ''
      if (text) { const m = streamingAssistant() || currentAssistant(); m.content = text; finishActivity(m.activity); m.streaming = false }
      busy.value = false; scrollToBottom(); break
    }
    case 'error': {
      const em = evt.error || evt.message || 'Error'
      if (/unknown message type/i.test(em)) break
      const m = streamingAssistant(); if (m) { finishActivity(m.activity); m.streaming = false }
      error.value = em; busy.value = false; break
    }
    case 'stop_acknowledged': { const m = streamingAssistant(); if (m) { finishActivity(m.activity); m.streaming = false }; busy.value = false; break }
  }
}

function send() {
  const text = input.value.trim()
  if (busy.value || !text || !wsToken.value) return
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) connect()
  messages.value.push({ role: 'user', content: text })
  const a = { role: 'assistant', content: '', streaming: true, activity: createActivity() }
  startActivity(a.activity); messages.value.push(a)
  input.value = ''; error.value = ''; busy.value = true; scrollToBottom()
  const payload = { type: 'chat_message', message: text }
  if (conversationId.value) payload.conversation_id = conversationId.value
  let tries = 0
  const trySend = () => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) ws.value.send(JSON.stringify(payload))
    else if (tries++ < 25) setTimeout(trySend, 200)
    else { finishActivity(a.activity); a.streaming = false; busy.value = false; error.value = 'Could not connect.' }
  }
  trySend()
}
function stop() {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    try { ws.value.send(JSON.stringify({ type: 'stop_execution', conversation_id: conversationId.value })) } catch (e) { /* noop */ }
  }
  const m = streamingAssistant(); if (m) { finishActivity(m.activity); m.streaming = false }; busy.value = false
}
function reset() { messages.value = []; conversationId.value = null; error.value = ''; busy.value = false }

onMounted(async () => {
  try {
    const res = await api.getPublicAgentConfig(routeToken.value)
    if (res.data && res.data.offline) { offline.value = true; return }
    cfg.value = res.data || {}
    wsToken.value = cfg.value.token || routeToken.value
    document.title = cfg.value.name || 'Chat'
    connect()
  } catch (e) { offline.value = true }
})
onBeforeUnmount(() => { intentionalClose = true; if (reconnectTimer) clearTimeout(reconnectTimer); if (ws.value) { try { ws.value.close() } catch (e) { /* noop */ } } })
</script>

<style scoped>
.pc-root {
  --pc-accent: #4f46e5;
  display: flex; flex-direction: column; height: 100vh; background: #fff; color: #0f172a;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
/* top bar */
.pc-top { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px;
  border-bottom: 1px solid #f1f5f9; background: rgba(255,255,255,.85); backdrop-filter: blur(6px); position: sticky; top: 0; z-index: 5; }
.pc-id { display: flex; align-items: center; gap: 10px; }
.pc-av, .pc-msg-av { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; }
.pc-av img, .pc-msg-av img, .pc-av-lg img { width: 100%; height: 100%; object-fit: cover; }
.pc-name { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }
.pc-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.15); }
.pc-reset { border: none; background: transparent; color: #94a3b8; font-size: 18px; cursor: pointer; line-height: 1; }
.pc-reset:hover { color: #475569; }

/* conversation */
.pc-scroll { flex: 1; overflow-y: auto; }
.pc-wrap { max-width: 720px; margin: 0 auto; padding: 24px 18px 12px; }

/* welcome */
.pc-welcome { text-align: center; padding: 8vh 0 4vh; }
.pc-av-lg { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; display: inline-flex;
  align-items: center; justify-content: center; color: #fff; font-size: 30px; box-shadow: 0 8px 24px rgba(0,0,0,.12); }
.pc-wtitle { font-size: 24px; font-weight: 800; margin: 16px 0 6px; letter-spacing: -0.02em; }
.pc-wgreet { color: #64748b; font-size: 15px; max-width: 460px; margin: 0 auto; line-height: 1.5; }

/* messages */
.pc-msg { display: flex; margin-bottom: 18px; }
.pc-msg.is-user { justify-content: flex-end; }
.pc-bubble { max-width: 82%; background: var(--pc-accent); color: #fff; border-radius: 18px 18px 5px 18px;
  padding: 10px 15px; font-size: 14.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
  box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.pc-msg.is-asst { gap: 10px; }
.pc-asst { min-width: 0; flex: 1; }
.pc-md { font-size: 14.5px; line-height: 1.6; word-break: break-word; }
.pc-md :deep(p) { margin: 0 0 10px; } .pc-md :deep(p:last-child) { margin-bottom: 0; }
.pc-md :deep(ul), .pc-md :deep(ol) { margin: 0 0 10px; padding-left: 22px; } .pc-md :deep(li) { margin: 3px 0; }
.pc-md :deep(pre) { background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 10px; overflow-x: auto; margin: 0 0 10px; }
.pc-md :deep(code) { background: rgba(15,23,42,.06); padding: 1px 5px; border-radius: 4px; font-size: 0.85em; }
.pc-md :deep(pre code) { background: none; padding: 0; color: inherit; }
.pc-md :deep(strong) { font-weight: 600; } .pc-md :deep(a) { color: var(--pc-accent); text-decoration: underline; }
.pc-err { color: #dc2626; font-size: 13px; padding: 4px 2px; }

/* input */
.pc-foot { padding: 10px 18px 16px; }
.pc-inwrap { max-width: 720px; margin: 0 auto; display: flex; align-items: center; gap: 8px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 6px 6px 6px 16px;
  box-shadow: 0 4px 20px rgba(15,23,42,.06); transition: border-color .15s, box-shadow .15s; }
.pc-inwrap:focus-within { border-color: var(--pc-accent); box-shadow: 0 4px 20px color-mix(in srgb, var(--pc-accent) 18%, transparent); }
.pc-inwrap input { flex: 1; border: none; outline: none; font-size: 15px; background: transparent; padding: 8px 0; color: #0f172a; }
.pc-ib { width: 38px; height: 38px; border: none; border-radius: 12px; color: #fff; font-size: 17px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pc-send { background: var(--pc-accent); } .pc-send:disabled { opacity: .4; cursor: default; }
.pc-stop { background: #ef4444; }
.pc-brand { text-align: center; font-size: 11px; color: #cbd5e1; margin-top: 8px; }

/* offline */
.pc-offline { flex: 1; display: flex; align-items: center; justify-content: center; }
.pc-offline-card { text-align: center; color: #64748b; }
.pc-offline-ico { font-size: 34px; margin-bottom: 8px; }
</style>
