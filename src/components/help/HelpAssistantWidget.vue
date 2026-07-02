<template>
  <transition name="hw">
    <section v-if="open" class="hw" role="dialog" aria-label="Help Assistant">
      <header class="hw-head">
        <div class="hw-title">
          <span class="hw-spark"><Icon icon="lucide:sparkles" /></span>
          <div><strong>Help Assistant</strong><small>Answers from the Help Center, with sources</small></div>
        </div>
        <button class="hw-x" @click="close" aria-label="Close"><Icon icon="lucide:x" /></button>
      </header>

      <div ref="threadEl" class="hw-thread">
        <div v-if="!turns.length" class="hw-hint">
          <p>Ask anything about agents, knowledge bases, integrations, workflows, or billing.</p>
          <div class="hw-examples">
            <button v-for="ex in examples" :key="ex" @click="send(ex)">{{ ex }}</button>
          </div>
        </div>

        <template v-for="(t, i) in turns" :key="i">
          <!-- user -->
          <div v-if="t.role === 'user'" class="msg user"><p>{{ t.content }}</p></div>
          <!-- assistant -->
          <div v-else class="msg bot">
            <div v-if="!t.payload?.no_answer" class="bot-answer">
              <div class="answer md" v-html="renderMd(t.payload?.answer)"></div>
              <div v-if="t.payload?.sources?.length" class="cites">
                <button v-for="(s, j) in t.payload.sources" :key="j" class="cite" @click="openSource(s)">
                  <span class="c-num">{{ j + 1 }}</span>
                  <span class="c-text">{{ s.content_title }} › {{ s.section_heading }}</span>
                  <Icon icon="lucide:arrow-up-right" />
                </button>
              </div>
              <div v-if="t.payload?.suggested_actions?.length" class="acts">
                <button v-for="(a, k) in t.payload.suggested_actions" :key="k" class="act" @click="doAction(a)">{{ a.label }}</button>
              </div>
            </div>
            <div v-else class="bot-noanswer">
              <div class="md" v-html="renderMd(t.payload.fallback_message)"></div>
              <div class="acts">
                <button v-for="(a, k) in t.payload.suggested_actions" :key="k" class="act" @click="doAction(a)">{{ a.label }}</button>
              </div>
            </div>
          </div>
        </template>

        <div v-if="loading" class="msg bot"><div class="typing"><span /><span /><span /></div></div>
        <div v-if="error" class="msg bot err"><p>Something went wrong. Try again.</p></div>
      </div>

      <form class="hw-input" @submit.prevent="send()">
        <textarea ref="inputEl" v-model="input" rows="1" placeholder="Ask a question…"
                  @keydown.enter.exact.prevent="send()"></textarea>
        <button type="submit" class="hw-send" :disabled="loading || !input.trim()">
          <Icon :icon="loading ? 'lucide:loader-2' : 'lucide:arrow-up'" :class="{ spin: loading }" />
        </button>
      </form>
    </section>
  </transition>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { marked } from 'marked'
import api from '../../services/api'
import { useGuidedTour } from '../../composables/useGuidedTour'
import { applyAssistantWsEvent } from '../../utils/assistantStream'

marked.setOptions({ breaks: true, gfm: true })
// Render the (possibly still-streaming) markdown answer to HTML. Same engine + markdown
// as New Chat; the widget just parses it instead of showing raw text.
function renderMd(text) {
  if (!text) return ''
  try { return marked.parse(String(text)) } catch (e) { return String(text) }
}

const props = defineProps({
  open: { type: Boolean, default: false },
  initialQuestion: { type: String, default: '' },
  currentPage: { type: String, default: '' },
  productArea: { type: String, default: '' },
})
const emit = defineEmits(['update:open'])

const router = useRouter()
const { launch: launchTour } = useGuidedTour()

const turns = ref([])            // {role:'user'|'assistant', content?, payload?}
const input = ref('')
const loading = ref(false)
const error = ref(false)
const conversational = ref(true) // true → multi-turn /chat; false → one-shot fallback
const threadEl = ref(null)
const inputEl = ref(null)

// Phase F — WebSocket streaming transport (grounded). When the built-in detail endpoint
// returns transport:{mode:'websocket', token}, we stream; if WS errors/closes before a
// done event, we permanently fall back to the request/response /chat path for the session.
const transport = ref(null)      // {mode, ws_url, token, expires_in} | null
const wsBroken = ref(false)      // sticky: a WS failure → use HTTP for the rest of the session
let socket = null
let streamCtx = null             // { turn, resolve, reject } for the in-flight WS answer
let lastTurn = null              // last assistant turn (so a late suggested_actions event can attach)
let engineConvId = null          // generic-engine path: conversation id for multi-turn

// Which protocol the current transport speaks. 'agent' = the shared chat engine
// (/ws/chat/agent/, assistant_message_chunk/_complete); else the dedicated Help Assistant.
function isEnginePath() { return transport.value?.engine === 'agent' }

const examples = ['How do I connect GitHub?', 'How do I add a knowledge base?', 'How does billing work?']

function close() { emit('update:open', false) }
function scrollDown() { nextTick(() => { if (threadEl.value) threadEl.value.scrollTop = threadEl.value.scrollHeight }) }

function canStream() {
  return conversational.value && !wsBroken.value &&
    transport.value && transport.value.mode === 'websocket' && transport.value.token
}

function closeSocket() {
  if (socket) { try { socket.close() } catch (e) { /* noop */ } }
  socket = null
}

function wsUrl() {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const path = transport.value?.ws_url || '/ws/chat/agent/'
  return `${scheme}://${window.location.host}${path}?token=${encodeURIComponent(transport.value.token)}`
}

// Open (or reuse) the grounded WS. Refreshes the short-lived token before a new socket
// so a 5-min-expired token doesn't cause a needless failure. Resolves once OPEN.
async function ensureSocket() {
  if (socket && socket.readyState === WebSocket.OPEN) return socket
  closeSocket()
  // Re-fetch a fresh transport token (the previous one may have expired).
  let fresh = null
  try { const { data } = await api.getAssistantConfig(); if (data?.available) fresh = data.transport } catch (e) { /* try built-in */ }
  if (!fresh) { const { data } = await api.getBuiltinHelpAssistant(); fresh = data?.transport }
  if (fresh?.mode === 'websocket' && fresh.token) transport.value = fresh
  else throw new Error('no-transport')

  return await new Promise((resolve, reject) => {
    let settled = false
    const sock = new WebSocket(wsUrl())
    sock.onopen = () => { settled = true; socket = sock; resolve(sock) }
    sock.onmessage = (e) => handleWsEvent(e.data)
    sock.onerror = () => { if (!settled) { settled = true; reject(new Error('ws-error')) } }
    sock.onclose = () => {
      if (!settled) { settled = true; reject(new Error('ws-closed')) }
      // A close mid-answer rejects the in-flight turn so send() can fall back.
      if (streamCtx) { const r = streamCtx.reject; streamCtx = null; r(new Error('ws-closed')) }
      if (socket === sock) socket = null
    }
  })
}

function handleWsEvent(raw) {
  let ev
  try { ev = JSON.parse(raw) } catch (e) { return }
  if (!ev || ev.type === 'ping') return
  const ctx = streamCtx
  // Late events (e.g. suggested_actions after completion) attach to the last bubble.
  const turn = ctx?.turn || lastTurn
  if (!turn) return
  const res = applyAssistantWsEvent(turn.payload, ev)
  if (res.convId) engineConvId = res.convId
  if (res.done && ctx) { const r = ctx.resolve; streamCtx = null; r(true) }
  else if (res.error && ctx) { const r = ctx.reject; streamCtx = null; r(new Error(res.error)) }
  scrollDown()
}

// Stream one user message over WS into a fresh assistant bubble. Rejects on any WS
// failure so the caller can fall back to HTTP without leaving a half-rendered bubble.
async function sendViaWs(text, assistantTurn) {
  const sock = await ensureSocket()
  return await new Promise((resolve, reject) => {
    streamCtx = { turn: assistantTurn, resolve, reject }
    lastTurn = assistantTurn
    try {
      const payload = isEnginePath()
        ? { type: 'chat_message', message: text, ...(engineConvId ? { conversation_id: engineConvId } : {}) }
        : { type: 'user_message', message: text, current_page: props.currentPage, product_area: props.productArea }
      sock.send(JSON.stringify(payload))
    } catch (e) { streamCtx = null; reject(e) }
  })
}

async function send(preset) {
  const text = (preset || input.value).trim()
  if (!text || loading.value) return
  input.value = ''
  turns.value.push({ role: 'user', content: text })
  loading.value = true; error.value = false
  scrollDown()

  // 1) Grounded WS streaming (preferred when available).
  if (canStream()) {
    // reactive() so per-chunk mutations of payload.answer actually re-render (Vue 3 won't
    // react to mutating a raw object we hold a reference to — that made it look non-streaming).
    const assistantTurn = reactive({ role: 'assistant', payload: { answer: '', sources: [], suggested_actions: [], no_answer: false, fallback_message: '', confidence: 0 } })
    turns.value.push(assistantTurn)
    try {
      await sendViaWs(text, assistantTurn)
      loading.value = false; scrollDown()
      return
    } catch (e) {
      // WS failed → drop the half-streamed bubble and fall back to HTTP for this session.
      wsBroken.value = true; closeSocket()
      const idx = turns.value.indexOf(assistantTurn)
      if (idx !== -1 && !assistantTurn.payload.answer && !assistantTurn.payload.no_answer) turns.value.splice(idx, 1)
    }
  }

  // 2) Request/response fallback — conversational /chat, else one-shot /assistant.
  try {
    let payload
    if (conversational.value) {
      const messages = turns.value
        .filter(t => t.role === 'user' || t.role === 'assistant')
        .map(t => ({ role: t.role, content: t.role === 'user' ? t.content : (t.payload?.answer || '') }))
      const { data } = await api.chatHelpAssistant({ messages, current_page: props.currentPage, product_area: props.productArea })
      payload = data
    } else {
      const { data } = await api.askHelpAssistant({ question: text, current_page: props.currentPage, product_area: props.productArea })
      payload = data
    }
    turns.value.push({ role: 'assistant', payload })
  } catch (e) { error.value = true } finally { loading.value = false; scrollDown() }
}

function openSource(s) { close(); if (s.url) router.push(s.url) }
function doAction(a) {
  close()
  if (a.type === 'start_tour' && a.tour_slug) { launchTour(a.tour_slug); return }
  if (a.url) router.push(a.url)
}

// Detect availability + transport. Built-in available → conversational; transport present
// → enable WS streaming. Flag OFF / not scoped (404) → one-shot fallback, no transport.
async function detectMode() {
  // Prefer the AI-Assistant slot (/assistant/config): the widget runs whichever agent an
  // admin assigned, and the transport auto-points at the shared chat engine once the
  // ASSISTANT_AGENT_ENGINE_ENABLED flag is on. Falls back to the built-in help-assistant.
  try {
    const { data } = await api.getAssistantConfig()
    if (data?.available) {
      conversational.value = true
      transport.value = (data?.transport?.mode === 'websocket' && data.transport.token) ? data.transport : null
      return
    }
  } catch (e) { /* fall through to the built-in lookup */ }
  try {
    const { data } = await api.getBuiltinHelpAssistant()
    conversational.value = true
    transport.value = (data?.transport?.mode === 'websocket' && data.transport.token) ? data.transport : null
  } catch (e) {
    conversational.value = false; transport.value = null
  }
}

const lastAsked = ref('')
watch(() => props.open, async (v) => {
  if (v) {
    await detectMode()
    await nextTick(); inputEl.value?.focus()
    // Seed question on open (global panel stays mounted, so guard on last-asked rather
    // than an empty thread — a new question still sends, a repeat/blank open does not).
    if (props.initialQuestion && props.initialQuestion !== lastAsked.value) {
      lastAsked.value = props.initialQuestion
      send(props.initialQuestion)
    }
  } else {
    closeSocket()
  }
})
onMounted(() => { if (props.open) detectMode() })
onBeforeUnmount(() => closeSocket())

// Imperative entry for the global launcher: open (if needed) and ask a question now,
// regardless of the open-transition timing.
async function ask(q) {
  const text = (q || '').trim()
  if (!text) return
  await detectMode()
  send(text)
}
defineExpose({ ask })
</script>

<style scoped>
.hw {
  position: fixed; right: 22px; bottom: 92px; z-index: 90;
  width: 380px; max-width: calc(100vw - 32px); height: min(620px, calc(100vh - 130px));
  display: flex; flex-direction: column; background: #fff; border: 1px solid #e5ebf3;
  border-radius: 16px; box-shadow: 0 24px 60px rgba(15, 23, 42, .26); overflow: hidden;
}
.hw-head { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #eef2f7; }
.hw-title { display: flex; align-items: center; gap: 11px; }
.hw-spark { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
.hw-spark svg { width: 17px; height: 17px; }
.hw-title strong { display: block; font-size: 14px; font-weight: 850; }
.hw-title small { color: #94a3b8; font-size: 11px; }
.hw-x { border: 0; background: transparent; color: #64748b; cursor: pointer; } .hw-x svg { width: 18px; height: 18px; }
.hw-thread { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.hw-hint { color: #64748b; font-size: 13px; } .hw-hint p { margin: 0 0 12px; }
.hw-examples { display: flex; flex-direction: column; gap: 8px; }
.hw-examples button { text-align: left; border: 1px solid #e5ebf3; border-radius: 10px; background: #fbfcff; padding: 10px 12px; font-size: 12.5px; font-weight: 600; color: #334155; cursor: pointer; }
.hw-examples button:hover { border-color: #c7d2fe; color: #4f46e5; }
.msg { max-width: 86%; }
.msg.user { align-self: flex-end; background: #4f46e5; color: #fff; border-radius: 14px 14px 4px 14px; padding: 9px 13px; }
.msg.user p { margin: 0; font-size: 13.5px; line-height: 1.45; }
.msg.bot { align-self: flex-start; background: #f6f8fc; border-radius: 14px 14px 14px 4px; padding: 12px 14px; max-width: 92%; }
.msg.bot.err { background: #fef2f2; color: #b91c1c; } .msg.bot.err p { margin: 0; font-size: 13px; }
.answer { margin: 0; font-size: 13.5px; line-height: 1.6; color: #0f172a; }
/* Markdown inside the answer bubble */
.md :first-child { margin-top: 0; } .md :last-child { margin-bottom: 0; }
.md p { margin: 0 0 8px; font-size: 13.5px; line-height: 1.6; }
.md h1, .md h2, .md h3, .md h4 { margin: 12px 0 6px; font-size: 14px; font-weight: 800; line-height: 1.35; }
.md ul, .md ol { margin: 6px 0 8px; padding-left: 20px; } .md li { margin: 3px 0; font-size: 13.5px; line-height: 1.5; }
.md a { color: #4f46e5; font-weight: 600; text-decoration: underline; }
.md strong { font-weight: 800; }
.md code { background: #eef2f7; border-radius: 4px; padding: 1px 5px; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.md pre { background: #0f172a; color: #e2e8f0; border-radius: 9px; padding: 10px 12px; overflow-x: auto; margin: 8px 0; }
.md pre code { background: transparent; color: inherit; padding: 0; }
.md blockquote { margin: 8px 0; padding: 2px 12px; border-left: 3px solid #c7d2fe; color: #475569; }
.md table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12.5px; }
.md th, .md td { border: 1px solid #e5ebf3; padding: 5px 8px; text-align: left; }
.cites { margin-top: 10px; display: grid; gap: 6px; }
.cite { display: flex; align-items: center; gap: 8px; width: 100%; border: 1px solid #e5ebf3; border-radius: 9px; background: #fff; padding: 7px 9px; text-align: left; cursor: pointer; }
.cite:hover { border-color: #c7d2fe; }
.c-num { display: grid; width: 18px; height: 18px; flex-shrink: 0; place-items: center; border-radius: 5px; background: #eef2ff; color: #4f46e5; font-size: 10px; font-weight: 850; }
.c-text { flex: 1; min-width: 0; font-size: 11.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cite svg { width: 13px; height: 13px; color: #94a3b8; }
.acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.act { border: 1px solid #dbe4f0; border-radius: 8px; background: #fff; padding: 6px 11px; font-size: 11.5px; font-weight: 700; color: #4f46e5; cursor: pointer; }
.act:hover { background: #f5f3ff; }
.bot-noanswer p { margin: 0; font-size: 13px; color: #475569; }
.typing { display: flex; gap: 4px; padding: 2px 0; }
.typing span { width: 7px; height: 7px; border-radius: 50%; background: #c7d2fe; animation: b 1.2s infinite; }
.typing span:nth-child(2) { animation-delay: .15s; } .typing span:nth-child(3) { animation-delay: .3s; }
@keyframes b { 0%,80%,100% { transform: scale(.6); opacity: .5; } 40% { transform: scale(1); opacity: 1; } }
.hw-input { flex-shrink: 0; display: flex; align-items: flex-end; gap: 8px; padding: 12px; border-top: 1px solid #eef2f7; }
.hw-input textarea { flex: 1; border: 1px solid #d8e2f0; border-radius: 11px; padding: 9px 12px; font-size: 13.5px; font-family: inherit; resize: none; max-height: 110px; outline: none; }
.hw-input textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, .12); }
.hw-send { display: grid; place-items: center; width: 38px; height: 38px; flex-shrink: 0; border: 0; border-radius: 10px; background: #4f46e5; color: #fff; cursor: pointer; }
.hw-send:disabled { opacity: .5; } .hw-send svg { width: 17px; height: 17px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.hw-enter-active, .hw-leave-active { transition: opacity .18s ease, transform .18s ease; }
.hw-enter-from, .hw-leave-to { opacity: 0; transform: translateY(12px); }
@media (max-width: 520px) { .hw { right: 12px; left: 12px; bottom: 80px; width: auto; height: min(70vh, 560px); } }
</style>
