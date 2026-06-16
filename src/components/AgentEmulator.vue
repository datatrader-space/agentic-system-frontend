<template>
  <div class="flex flex-col h-full bg-slate-50">
    <!-- tabs -->
    <div class="px-4 pt-3 shrink-0">
      <div class="flex items-center justify-end gap-5 text-sm">
        <button @click="view = 'inspector'"
                :class="view === 'inspector' ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600 pb-1' : 'text-gray-400 font-medium hover:text-gray-600'">Inspector</button>
        <button @click="view = 'emulator'"
                :class="view === 'emulator' ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600 pb-1' : 'text-gray-400 font-medium hover:text-gray-600'">Emulator</button>
      </div>
    </div>
    <!-- subheader (emulator view only) -->
    <div v-if="view === 'emulator'" class="px-4 py-2 flex items-center justify-between shrink-0">
      <span class="text-sm font-bold text-gray-900">Emulator</span>
      <div class="flex items-center gap-3 text-gray-400">
        <button @click="restart" title="Restart chat" class="hover:text-violet-600 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
        </button>
        <!-- options (⋯) menu -->
        <div class="relative">
          <button @click="optionsOpen = !optionsOpen" title="Options" class="hover:text-violet-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
          <div v-if="optionsOpen" class="absolute right-0 top-full mt-1.5 z-50 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-sm text-gray-700" @click.stop>
            <button class="w-full text-left px-3 py-1.5 hover:bg-slate-50" @click="restart(); optionsOpen = false">Restart chat</button>
            <button class="w-full text-left px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40" :disabled="!messages.length" @click="clearTranscript(); optionsOpen = false">Clear transcript</button>
            <button class="w-full text-left px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40" :disabled="!messages.length" @click="copyTranscript(); optionsOpen = false">{{ copied ? 'Copied ✓' : 'Copy transcript' }}</button>
          </div>
          <div v-if="optionsOpen" class="fixed inset-0 z-40" @click="optionsOpen = false"></div>
        </div>
      </div>
    </div>

    <!-- not-saved state -->
    <div v-if="!agentId" class="flex-1 flex items-center justify-center text-center p-6">
      <div>
        <div class="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center text-white shadow-lg" style="background:linear-gradient(120deg,#2563EB,#1E40AF)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
        </div>
        <p class="text-sm text-gray-600 font-medium">Save the agent to test it live</p>
        <p class="text-xs text-gray-400 mt-1">The preview chats with the saved agent.</p>
      </div>
    </div>

    <!-- Inspector view -->
    <EmulatorInspector v-else-if="view === 'inspector'"
      :agent-id="agentId"
      :conversation-id="conversationId"
      :model-name="modelName"
      :turns="inspectorTurns" />

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
              <ReasoningPanel v-if="!m.streaming" :activity="m.activity" />
              <div v-if="!m.streaming && stopBadge(m)" class="mt-1.5">
                <span class="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1"
                      :class="[stopBadge(m).tone.bg, stopBadge(m).tone.text, stopBadge(m).tone.ring]"
                      :title="stopBadge(m).title">
                  <span class="w-1.5 h-1.5 rounded-full" :class="stopBadge(m).tone.dot"></span>
                  {{ stopBadge(m).label }}
                  <span class="opacity-60">· {{ stopBadge(m).confidence }}</span>
                </span>
              </div>
              <TokenUsage v-if="!m.streaming" :usage="m.usage" />
            </div>
          </div>
        </div>
      </div>

      <!-- Manual Mode plan approval card (Planning Mode ON + Manual): approve resumes the run. -->
      <div v-if="pendingPlan" class="px-3 pb-2 shrink-0">
        <PlanApprovalCard :plan="pendingPlan" :busy="busy" @approve="approvePlan" @reject="rejectPlan" @revise="revisePlan" />
      </div>

      <div class="px-3 pb-3 shrink-0">
        <!-- Unified composer: input on top, + attach + mode pill (upward) + send on the bottom toolbar -->
        <div class="border rounded-xl bg-white px-2.5 py-2 transition"
             :class="inputFocused ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'">
          <!-- staged attachments -->
          <div v-if="emuAttachments.length" class="flex flex-wrap gap-2 mb-1.5">
            <div v-for="(a, i) in emuAttachments" :key="i" class="inline-flex items-center gap-1.5 max-w-[200px] pl-1 pr-1.5 py-1 bg-slate-50 border border-gray-200 rounded-lg">
              <img v-if="a.isImage && a.url" :src="a.url" class="w-7 h-7 object-cover rounded" :alt="a.name" />
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5 text-gray-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              <span class="text-[11px] text-gray-600 truncate">{{ a.name }}</span>
              <button type="button" class="text-gray-400 hover:text-red-500 text-sm leading-none" title="Remove" @click="removeEmuAttachment(i)">×</button>
            </div>
          </div>
          <div class="flex items-start gap-1.5">
            <input
              v-model="input"
              @keydown.enter="send"
              @focus="inputFocused = true"
              @blur="inputFocused = false"
              :disabled="busy"
              placeholder="Type a message…"
              class="flex-1 min-w-0 bg-transparent text-sm px-1 py-1 focus:outline-none disabled:opacity-50"
            />
            <button v-if="speech.supported" type="button" @click="speech.toggle()"
                    :class="speech.listening.value ? 'text-white bg-red-500 animate-pulse' : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'"
                    class="w-7 h-7 flex items-center justify-center rounded-full shrink-0 transition"
                    :title="speech.listening.value ? 'Stop dictation' : 'Voice input'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
            </button>
          </div>
          <div class="flex items-center justify-between gap-2 mt-1.5">
            <div class="flex items-center gap-1.5">
              <input ref="emuFileEl" type="file" accept="image/*" multiple class="hidden" @change="onEmuFiles" />
              <button type="button" @click="emuFileEl?.click()" title="Attach image"
                      class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-4 h-4"><path d="M12 5v14m-7-7h14"/></svg>
              </button>
              <AgentModePicker v-if="agentId" :agent-id="agentId" placement="up" />
            </div>
            <button v-if="busy" @click="stop" title="Stop"
                    class="w-9 h-9 flex items-center justify-center bg-slate-900 text-white rounded-xl shrink-0 hover:brightness-125 transition">
              <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
            </button>
            <button v-else @click="send" :disabled="!input.trim()"
                    class="w-9 h-9 flex items-center justify-center text-white rounded-xl disabled:opacity-40 shrink-0 transition hover:scale-105"
                    style="background:linear-gradient(120deg,#2563EB,#0EA5E9)" title="Send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
            </button>
          </div>
        </div>
        <div v-if="error" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 mt-2">{{ error }}</div>
        <div class="flex items-center justify-between mt-2 text-[11px]">
          <span class="text-gray-500">Model ▸ {{ modelName || 'default' }}</span>
          <span v-if="sessionTokens" class="text-gray-600 tabular-nums" :title="'Total tokens used in this session'">
            Session {{ fmtTokens(sessionTokens) }}<span v-if="sessionCost"> · {{ fmtCost(sessionCost) }}</span>
          </span>
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
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { marked } from 'marked'
import ActivityStream from './activity/ActivityStream.vue'
import ReasoningPanel from './activity/ReasoningPanel.vue'
import TokenUsage from './activity/TokenUsage.vue'
import EmulatorInspector from './activity/EmulatorInspector.vue'
import HITLModal from './HITLModal.vue'
import AgentModePicker from './agent/AgentModePicker.vue'
import PlanApprovalCard from './agent/PlanApprovalCard.vue'
import { useHitl } from '../composables/useHitl'
import api from '../services/api'
import { createActivity, start as startActivity, ingest as ingestActivity, finish as finishActivity, interrupt as interruptActivity } from '../composables/activityStream'
import { fmtTokens, fmtCost } from '../composables/tokens'
import { useSpeech } from '../composables/useSpeech'
import { stopReasonBadge } from '../composables/stopReason'
import { enhanceChatMedia } from '../utils/chatMedia'

const props = defineProps({
  agentId: { type: [Number, String], default: null },
  modelName: { type: String, default: '' },
})

const ws = ref(null)
const connected = ref(false)
const reconnecting = ref(false)
const messages = ref([])
const input = ref('')
const inputFocused = ref(false)
const optionsOpen = ref(false)
const copied = ref(false)

// Voice input (mic) — appends the transcript to whatever's typed. Hidden when unsupported.
const speech = useSpeech({ onResult: (text) => { input.value = input.value ? `${input.value} ${text}` : text } })

// ── Attachments (images) staged for the next message ──
const emuFileEl = ref(null)
const emuAttachments = ref([])   // { file, name, isImage, url }
function onEmuFiles(e) {
  const files = e.target.files
  for (const file of Array.from(files || [])) {
    if (!file) continue
    const isImage = /^image\//.test(file.type)
    emuAttachments.value.push({ file, name: file.name, isImage, url: isImage ? URL.createObjectURL(file) : '' })
  }
  e.target.value = ''
}
function removeEmuAttachment(i) {
  const a = emuAttachments.value[i]
  if (a && a.url) { try { URL.revokeObjectURL(a.url) } catch { /* ignore */ } }
  emuAttachments.value.splice(i, 1)
}
// Upload staged files to the current conversation (the backend auto-attaches recent images to the
// vision model). Returns true once they're uploaded + cleared. No-op without a conversation yet.
async function uploadEmuAttachments() {
  if (!emuAttachments.value.length || !conversationId.value) return false
  const items = emuAttachments.value.slice()
  try {
    for (const a of items) await api.uploadConversationFile(conversationId.value, a.file)
  } catch {
    error.value = 'Failed to upload an attachment.'
    return false
  }
  for (const a of items) { if (a.url) { try { URL.revokeObjectURL(a.url) } catch { /* ignore */ } } }
  emuAttachments.value = []
  return true
}

// ⋯ options
function clearTranscript() {
  messages.value = []
  error.value = ''
}
async function copyTranscript() {
  const text = messages.value
    .map((m) => `${m.role === 'user' ? 'You' : 'Agent'}: ${m.content || ''}`)
    .join('\n\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* clipboard blocked — non-fatal */ }
}
const busy = ref(false)
const error = ref('')
const conversationId = ref(null)
const scroller = ref(null)
const view = ref('emulator') // 'emulator' | 'inspector'

// Manual Mode plan approval (v3 Layer 2): the pending plan awaiting a human, and the last user
// message so we can resume (re-send it) once the plan is approved server-side.
const pendingPlan = ref(null)
const lastUserMessage = ref('')

// One assistant turn's data, including the Inspector capture buffers.
function newAssistantMessage() {
  return {
    role: 'assistant', content: '', streaming: true,
    activity: createActivity(), usage: null,
    events: [], toolIO: [], knowledge: [],
  }
}

// Running session totals (this emulator session). Prefer a turn's exact completed usage; while a
// turn streams, fall back to its live activity-token counter so the footer ticks up and finalises exactly.
const sessionTokens = computed(() => messages.value.reduce((a, m) =>
  a + ((m.usage && m.usage.total_tokens) || (m.activity && m.activity.tokens && m.activity.tokens.total) || 0), 0))
const sessionCost = computed(() => messages.value.reduce((a, m) =>
  a + ((m.usage && m.usage.cost_usd) || (m.activity && m.activity.tokens && m.activity.tokens.cost) || 0), 0))

// Inspector view: one entry per assistant turn (with the preceding user prompt).
const inspectorTurns = computed(() => {
  const out = []
  const msgs = messages.value
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].role !== 'assistant') continue
    let prompt = ''
    for (let j = i - 1; j >= 0; j--) { if (msgs[j].role === 'user') { prompt = msgs[j].content; break } }
    const m = msgs[i]
    out.push({ prompt, content: m.content, activity: m.activity, usage: m.usage, toolIO: m.toolIO, knowledge: m.knowledge, events: m.events })
  }
  return out
})

// Capture raw events + tool I/O + retrieved knowledge for the Inspector (active turn).
function captureForInspector(m, evt) {
  if (!m) return
  if (m.events) { m.events.push(evt); if (m.events.length > 400) m.events.shift() }
  if (evt.type === 'tool_call' && m.toolIO) {
    m.toolIO.push({
      name: evt.tool_name || (evt.data && evt.data.tool) || evt.tool || 'tool',
      input: evt.tool_input || (evt.data && evt.data.params) || evt.parameters || null,
      output: null, ok: null, startTs: Date.now(), endTs: 0,
    })
  } else if (evt.type === 'tool_result' && m.toolIO) {
    const d = evt.data || evt
    const openIO = [...m.toolIO].reverse().find((x) => x.output === null)
    if (openIO) {
      openIO.output = d.result != null ? d.result : (d.document || '')
      openIO.ok = d.success !== false
      openIO.endTs = Date.now()
    }
  } else if (evt.type === 'knowledge_retrieved') {
    m.knowledge = evt.chunks || []
  }
}

// Shared HITL approval handling (same as New Chat / Playground).
const { hitlRequests, handleHitlEvent, respondHitl, dismissHitl, skipHitl } = useHitl((obj) => {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) ws.value.send(JSON.stringify(obj))
}, () => conversationId.value)

let intentionalClose = false
let reconnectAttempts = 0
let reconnectTimer = null
// The agentId the live socket belongs to, and a debounce timer for agentId changes. The host
// (AgentBuilderCanvas) briefly flips :agent-id to null whenever the form's dirty/publish state
// flickers; without debouncing, every flip tore down + reopened the chat socket — a connect/
// disconnect storm. We collapse rapid flips and only act on the settled value.
let connectedAgentId = null
let agentIdDebounce = null

marked.setOptions({ breaks: true, gfm: true })
function stopBadge(m) {
  return stopReasonBadge(m && m.stopReason, m && m.confidence)
}

function renderMarkdown(text) {
  try { return enhanceChatMedia(marked.parse(text || '')) } catch { return text || '' }
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
    sock.onopen = () => {
      connected.value = true; reconnecting.value = false; reconnectAttempts = 0
      if (conversationId.value) {
        try { sock.send(JSON.stringify({ type: 'resume', conversation_id: conversationId.value })) } catch (e) { /* noop */ }
      }
    }
    sock.onclose = () => {
      connected.value = false
      // The in-flight turn (if any) is gone the moment the socket drops — the backend won't
      // resume it after a reload/crash. Finalize the streaming bubble so it can't spin
      // "Thinking…" forever; reconnecting only restores the socket for the NEXT message.
      if (!intentionalClose) {
        interruptStreaming('Connection lost — the server restarted or dropped mid-response.')
        scheduleReconnect()
      }
    }
    sock.onerror = () => {
      connected.value = false
      interruptStreaming('Connection error — the response was interrupted.')
    }
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

// Socket dropped mid-stream (dev-server reload / crash): collapse the live timeline to an
// "Interrupted" summary and stop the spinner. No-op when nothing is streaming, and idempotent
// (onerror + onclose may both fire). busy is cleared so the composer re-enables.
function interruptStreaming(note) {
  const m = streamingAssistant()
  if (!m) { busy.value = false; return }
  interruptActivity(m.activity, note)
  m.streaming = false
  if (!m.content) m.content = '_⚠️ ' + note + '_'
  busy.value = false
}

// The active assistant, or a new one for UNSOLICITED content (e.g. a greeting the
// backend pushes). No seeded "Thinking" here — send() seeds it for real turns, so an
// unsolicited message doesn't render a stray timeline.
function currentAssistant() {
  const existing = streamingAssistant()
  if (existing) return existing
  const m = newAssistantMessage()
  messages.value.push(m)
  return m
}

function handleEvent(raw) {
  let evt
  try { evt = JSON.parse(raw) } catch (e) { return }
  if (evt.type === 'ping') return   // server keepalive heartbeat
  // HITL approval events are handled by the shared composable (queue + modal).
  if (handleHitlEvent(evt)) return
  // Inspector capture for the active turn (raw events, tool I/O, retrieved knowledge).
  captureForInspector(streamingAssistant(), evt)
  switch (evt.type) {
    case 'conversation_created':
      conversationId.value = evt.conversation_id
      saveConv()   // remember this conversation so a page refresh restores its history
      if (emuAttachments.value.length) uploadEmuAttachments()  // flush images staged before the conv existed
      break

    case 'turn_resumed': {
      // Returned mid-generation — open a streaming assistant bubble so the resumed live tokens/timeline
      // land; assistant_message_complete finalizes it. Guard against double-starting.
      if (!streamingAssistant()) {
        const a = newAssistantMessage()
        startActivity(a.activity)
        messages.value.push(a)
      }
      busy.value = true
      scrollToBottom()
      break
    }
    case 'turn_not_running':
      break   // nothing running — saved history already loaded
    // Progress-bearing events update the ACTIVE turn only — never spawn a new bubble
    // (a stray one after completion is what caused the stuck "Thinking" block).
    case 'assistant_typing':
    case 'tool_call':
    case 'tool_result':
    case 'tool_progress':   // per-command live progress inside a multi-step tool (SSH_EXEC etc.)
    case 'agent_progress':
    // Live token metering + streamed thinking feed the timeline (token chip / "Thought for Xs").
    case 'token_usage':
    case 'reasoning_delta':
    case 'reasoning_done':
    // v3 Auto Mode gate statuses + work summary + tool-blocked all render as timeline labels.
    case 'auto_status':
    case 'work_summary':
    case 'tool_blocked': {
      const m = streamingAssistant()
      if (m) { ingestActivity(m.activity, evt); scrollToBottom() }
      break
    }
    // v3 Plan Gate (Manual Mode): a plan is ready and awaits a human. Show the timeline label AND
    // surface the approval card with the plan content.
    case 'plan_approval_required': {
      const m = streamingAssistant()
      if (m) ingestActivity(m.activity, evt)
      pendingPlan.value = evt.plan || {}
      scrollToBottom()
      break
    }
    // Human approved the plan server-side -> resume by re-sending the original instruction (it now
    // executes because the plan is approved). Rejection just clears the card.
    case 'plan_approved': {
      pendingPlan.value = null
      if (lastUserMessage.value) dispatch(lastUserMessage.value, { resume: true })
      break
    }
    case 'plan_rejected': {
      pendingPlan.value = null
      busy.value = false
      break
    }
    // Human requested changes: the feedback becomes the next instruction and the agent re-plans
    // (a fresh plan card will follow). Shown as a user message — it's the user's input.
    case 'plan_revise': {
      pendingPlan.value = null
      if (evt.feedback) dispatch(evt.feedback)
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
        if (evt.stop_reason) { m.stopReason = evt.stop_reason; m.confidence = evt.confidence }
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

async function send() {
  const text = input.value.trim()
  const hasAtt = emuAttachments.value.length > 0
  if (busy.value || (!text && !hasAtt) || !props.agentId) return
  input.value = ''
  lastUserMessage.value = text
  // Upload staged images first (when a conversation exists) so the backend attaches them to the
  // vision model. On the very first message there's no conversation yet — they upload on
  // conversation_created and apply to the next turn.
  if (hasAtt && conversationId.value) await uploadEmuAttachments()
  dispatch(text || 'Please look at the attached image.')
}

// Send a chat_message turn. `resume` re-sends the original instruction after a plan approval and so
// does not add a second user bubble (the original is already shown).
function dispatch(text, { resume = false } = {}) {
  if (!text || !props.agentId) return
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) connect()

  if (!resume) messages.value.push({ role: 'user', content: text })
  // Create the assistant message up-front with a live activity timeline ("Thinking…").
  const a = newAssistantMessage()
  startActivity(a.activity)
  messages.value.push(a)
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

// Plan approval (Manual Mode): tell the server, then wait for plan_approved/plan_rejected/plan_revise.
function sendPlanDecision(decision, feedback) {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    ws.value.send(JSON.stringify({ type: 'plan_approval_response', decision, feedback, conversation_id: conversationId.value }))
  }
}
function approvePlan() { pendingPlan.value = null; sendPlanDecision('approve') }
function rejectPlan() { pendingPlan.value = null; sendPlanDecision('reject') }
// Request changes: send feedback to the agent; it re-plans and asks again (revise-and-re-approve).
function revisePlan(feedback) { pendingPlan.value = null; sendPlanDecision('revise', feedback) }

// ── Session persistence across page refresh ──
// The emulator conversation id is remembered per agent (localStorage) so a refresh reloads the
// same thread instead of starting blank. The ↻ button explicitly starts a fresh conversation.
function convKey() { return props.agentId ? `emu:conv:${props.agentId}` : null }
function saveConv() {
  const k = convKey()
  if (k && conversationId.value) { try { localStorage.setItem(k, String(conversationId.value)) } catch { /* ignore */ } }
}
function clearSavedConv() {
  const k = convKey()
  if (k) { try { localStorage.removeItem(k) } catch { /* ignore */ } }
}

async function loadHistory(id) {
  try {
    const res = await api.getConversation(id)
    const data = res.data || {}
    const raw = Array.isArray(data.messages) ? data.messages : (data.messages && data.messages.results) || []
    messages.value = raw.map((m) => {
      if (m.role === 'assistant' || m.role === 'agent') {
        const a = newAssistantMessage()
        a.content = m.content || ''
        a.streaming = false
        finishActivity(a.activity)   // historical turn — no live timeline
        return a
      }
      return { role: 'user', content: m.content || '' }
    })
    return raw.length > 0
  } catch {
    return false
  }
}

// Restore this agent's saved conversation (if any), else start a fresh connection.
async function restore() {
  closeSocket()
  messages.value = []
  pendingPlan.value = null
  error.value = ''
  busy.value = false
  const k = convKey()
  const savedId = k ? localStorage.getItem(k) : null
  if (savedId) {
    conversationId.value = savedId
    const ok = await loadHistory(savedId)
    if (!ok) { conversationId.value = null; clearSavedConv() }  // stale/deleted -> fresh
  } else {
    conversationId.value = null
  }
  connect()
  connectedAgentId = props.agentId
  scrollToBottom()
}

function restart() {
  clearSavedConv()
  conversationId.value = null
  messages.value = []
  error.value = ''
  busy.value = false
  pendingPlan.value = null
  lastUserMessage.value = ''
  for (const a of emuAttachments.value) { if (a.url) { try { URL.revokeObjectURL(a.url) } catch { /* ignore */ } } }
  emuAttachments.value = []
  connect()
  connectedAgentId = props.agentId
}

// Debounced reaction to an agent-id change: collapse the host's transient null↔id flips (dirty /
// publish flicker) into a single settled action. If we're already connected to the same agent, keep
// the socket; otherwise restore. This is what prevents the connect/disconnect storm.
function onAgentIdChanged() {
  if (agentIdDebounce) clearTimeout(agentIdDebounce)
  agentIdDebounce = setTimeout(() => {
    agentIdDebounce = null
    if (props.agentId === connectedAgentId && ws.value && ws.value.readyState === WebSocket.OPEN) return
    restore()
  }, 300)
}

watch(() => props.agentId, onAgentIdChanged)
onMounted(() => { restore() })
onBeforeUnmount(() => { if (agentIdDebounce) clearTimeout(agentIdDebounce); closeSocket() })
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
