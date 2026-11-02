<!--
  UnifiedAgentChat — the Let's Code coding chat. Modes: Agent (edits, runs, verifies) and Ask (read-only). One WS
  (ws/chat/repository/<id>/), one stream: text + tool results + HITL (useHitl/HITLModal) + reviewable
  diffs (ProposedChangesCard). Diff actions go back over the same socket (diff_accept/discard/
  revert_file/revert_hunk/export). No native dialogs — useNotify only.
-->
<template>
  <div class="uac">
    <!-- Top bar — Claude-style: title + chat history + new chat -->
    <div class="uac-head">
      <span class="uac-title"><Icon icon="lucide:sparkles" aria-hidden="true" /> Coding agent</span>
      <div class="uac-head-actions">
        <div class="uac-modes" role="group" aria-label="Coding mode">
          <button
            v-for="md in CODING_MODES" :key="md.id" type="button" :title="md.hint"
            class="uac-mode" :class="{ on: codingMode === md.id }" :aria-pressed="codingMode === md.id ? 'true' : 'false'"
            @click="codingMode = md.id"
          >{{ md.label }}</button>
        </div>
        <div class="uac-hwrap">
          <button type="button" class="uac-hbtn" :class="{ on: historyOpen }" title="Chat history" aria-label="Chat history" :aria-expanded="historyOpen ? 'true' : 'false'" @click="toggleHistory">
            <Icon icon="lucide:history" />
          </button>
          <div v-if="historyOpen" class="uac-hbackdrop" @click="historyOpen = false"></div>
          <div v-if="historyOpen" class="uac-hmenu">
            <div class="uac-hmenu-head">Chat history</div>
            <div v-if="loadingHistory" class="uac-hmenu-empty">Loading…</div>
            <template v-else>
              <button
                v-for="c in conversations" :key="c.id"
                type="button" class="uac-hitem" :class="{ active: c.id === conversationId }"
                @click="openConversation(c)"
              >
                <span class="uac-hitem-title">{{ convTitle(c) }}</span>
                <span class="uac-hitem-meta">{{ relTime(c.updated_at) }}, {{ c.message_count || 0 }} {{ (c.message_count || 0) === 1 ? 'message' : 'messages' }}</span>
              </button>
              <div v-if="!conversations.length" class="uac-hmenu-empty">No previous chats yet.</div>
            </template>
          </div>
        </div>
        <button type="button" class="uac-hbtn" title="New chat" aria-label="New chat" @click="newChat">
          <Icon icon="lucide:square-pen" />
        </button>
      </div>
    </div>

    <div ref="scrollEl" class="uac-stream">
      <div v-if="messages.length === 0" class="uac-empty">
        <Icon icon="lucide:sparkles" aria-hidden="true" />
        <p v-if="codingMode === 'ask'">Ask about this repository. In Ask mode the agent reads the code and answers; it never edits.</p>
        <p v-else>Describe a change. The agent edits the code, runs it, checks the result and shows you the diff to review.</p>
      </div>

      <div v-for="(m, i) in messages" :key="i" class="uac-msg" :class="m.role">
        <div v-if="m.role === 'user'" class="bubble user">{{ m.text }}</div>

        <div v-else class="bubble assistant">
          <div v-if="m.steps && m.steps.length" class="ai-steps">
            <div v-for="(s, k) in m.steps" :key="k" class="ai-step">
              <span class="sdot" :class="{ active: m.streaming && k === m.steps.length - 1 }"></span>{{ s }}
            </div>
          </div>
          <div v-if="displayText(m.text)" class="ai-text md">
            <div class="md-body" v-html="renderMarkdown(m.text)"></div><span v-if="m.streaming" class="caret">▍</span>
          </div>
          <div v-else-if="m.streaming && !(m.steps && m.steps.length)" class="ai-working"><span class="vm-spin"></span> Working…</div>

          <div v-for="(tr, j) in (m.tools || [])" :key="j" class="ai-tool">
            <Icon icon="lucide:wrench" /> <span class="tn">{{ tr.name }}</span>
            <span v-if="tr.ok === false" class="terr">Failed</span>
          </div>

          <ProposedChangesCard
            v-if="m.task && (m.task.diff_text || (m.task.diff_summary && m.task.diff_summary.files))"
            :task="m.task" :busy="m.busy" :exporting="m.exporting"
            @accept="onExport(m)" @keep="onKeep(m)" @discard="onDiscard(m)" @copy="onCopy(m)"
            @revert-file="onRevertFile(m, $event)" @revert-hunk="onRevertHunk(m, $event)"
          />
          <div v-if="m.resolved" class="ai-resolved">
            <Icon :icon="m.resolved === 'exported' ? 'lucide:git-pull-request' : (m.resolved === 'discarded' ? 'lucide:trash-2' : 'lucide:check')" />
            {{ resolvedLabel(m) }}
            <a v-if="m.task && m.task.pr_url" :href="m.task.pr_url" target="_blank" rel="noopener">View PR</a>
          </div>

          <TokenUsage v-if="!m.streaming && m.usage" :usage="m.usage" class="ai-usage" />
        </div>
      </div>
    </div>

    <HITLModal :requests="hitlRequests" @respond="respondHitl" @dismiss="dismissHitl" @skip="skipHitl" />
    <PermissionCard :requests="permissionRequests" @respond="onPermissionRespond" />

    <div class="uac-composer">
      <!-- Single rounded container: input on top, action toolbar on the bottom -->
      <div class="uac-box" :class="{ focused }">
        <div class="uac-box-top">
          <label class="sr-only" for="uac-input">Message the coding agent</label>
          <textarea
            id="uac-input" ref="inputEl" v-model="input" :disabled="!crsReady"
            :placeholder="crsReady ? (codingMode === 'ask' ? 'Ask about this repository' : 'Describe the change you want') : 'Preparing the project'"
            rows="1" @input="autoGrow" @keydown="onKeydown" @focus="focused = true" @blur="focused = false"
          ></textarea>
          <!-- Mic: needs an Audio-transcription model on the coding agent; dimmed otherwise, click explains. -->
          <button
            type="button" class="uac-mic" data-test="uac-mic"
            :class="{ live: voice.recording.value, busy: voice.transcribing.value, off: !voice.enabled.value }"
            :aria-disabled="voice.enabled.value ? 'false' : 'true'"
            :aria-label="voice.recording.value ? 'Stop and send' : 'Voice input'"
            :title="voice.enabled.value
              ? (voice.recording.value ? `Stop and send (${voice.elapsed.value}s)` : 'Voice input')
              : voice.disabledMessage.value"
            @click="voice.toggle()"
          >
            <Icon icon="lucide:mic" />
          </button>
        </div>

        <div class="uac-box-bar">
          <div class="uac-bar-left">
            <AgentModePicker
              v-if="agentId" :agent-id="agentId"
              :run-mode="agentMeta.agent_run_mode"
              placement="up" @change="onModeChange"
            />
            <label class="sr-only" for="uac-model">Model</label>
            <select id="uac-model" v-model="modelId" class="uac-sel" title="Model">
              <option value="">Default model</option>
              <option v-for="md in models" :key="md.id" :value="md.id">{{ md.label || md.name }}</option>
            </select>
          </div>

          <button v-if="sending" type="button" class="uac-circle stop" title="Stop" aria-label="Stop" @click="stop">
            <Icon icon="lucide:square" />
          </button>
          <button
            v-else type="button" class="uac-circle send" title="Send" aria-label="Send"
            :disabled="!input.trim() || !crsReady" @click="send()"
          >
            <Icon icon="lucide:arrow-up" />
          </button>
        </div>
      </div>

      <div class="uac-hint">
        <span class="uac-conn" :class="{ on: connected }"><span class="uac-conn-dot" aria-hidden="true"></span>{{ connected ? 'Connected' : 'Connecting' }}</span>
        <span>Enter to send, Shift+Enter for a new line</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { renderUntrustedMarkdown } from '../../utils/safeMarkdown'
import { enhanceChatMedia } from '@/utils/chatMedia'
import { useVoiceInput } from '@/composables/useVoiceInput'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { showMemorySavedToast } from '@/composables/useMemoryToast'
import { useHitl } from '@/composables/useHitl'
import { usePermission } from '@/composables/usePermission'
import HITLModal from '@/components/HITLModal.vue'
import PermissionCard from '@/components/letscode/PermissionCard.vue'
import ProposedChangesCard from '@/components/letscode/ProposedChangesCard.vue'
import AgentModePicker from '@/components/agent/AgentModePicker.vue'
import TokenUsage from '@/components/activity/TokenUsage.vue'

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
  crsReady: { type: Boolean, default: false },
})
const emit = defineEmits(['changed', 'proposal', 'activity'])

const messages = ref([])
const input = ref('')
const modelId = ref('')
const models = ref([])
const codingMode = ref('agent')   // agent (edits, runs, verifies; default) | ask (read-only)
const CODING_MODES = [
  { id: 'agent', label: 'Agent', hint: 'Edits, runs and verifies' },
  { id: 'ask', label: 'Ask', hint: 'Read-only: answers, never edits' },
]
const agentId = ref('')           // the project's coding agent (the Modes target); from unified-config
const agentMeta = ref({ agent_run_mode: 'manual' })
const sending = ref(false)
const connected = ref(false)
const conversationId = ref(null)
const scrollEl = ref(null)
const inputEl = ref(null)

// Chat history (session list) + new chat
const historyOpen = ref(false)
const loadingHistory = ref(false)
const conversations = ref([])

// Composer: focus ring, voice input
const focused = ref(false)
// Voice input — transcribed by the coding agent's own Audio-transcription model, then sent through the
// normal send() so the WS payload (model, coding mode, conversation) is identical to a typed message.
const voice = useVoiceInput({
  agentId: () => agentId.value || null,
  conversationId: () => conversationId.value,
  getDraft: () => input.value,
  onTranscript: (text) => { input.value = text; nextTick(() => { autoGrow(); send() }) },
})

let ws = null
let autoReconnect = true
let reconnectTimer = null

function wsSend(obj) {
  try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)) } catch (e) { /* noop */ }
}

// HITL (approval / ask_user) — only show cards for THIS conversation.
const { hitlRequests, handleHitlEvent, respondHitl, dismissHitl, skipHitl } =
  useHitl((obj) => wsSend(obj), () => conversationId.value)

// Coding-agent permission cards (protected/risky action gating). On allow, auto-continue the task by
// re-sending the original prompt (the backend now remembers the decision so it won't ask again).
const { permissionRequests, handlePermissionEvent, respondPermission } =
  usePermission((obj) => wsSend(obj), () => conversationId.value)
const lastUserPrompt = ref('')
function onPermissionRespond({ card, choice }) {
  const decided = respondPermission(card, choice)
  // reveal_secret cards are answered INLINE by the backend (it re-runs the inspect and reveals only the
  // approved key). Don't auto-re-send the prompt — that would re-prompt (once) or double-answer (always).
  if (card?.capability === 'reveal_secret') return
  if (String(decided).startsWith('allow') && lastUserPrompt.value) {
    sending.value = true
    wsSend({ type: 'chat_message', message: lastUserPrompt.value, conversation_id: conversationId.value,
             model_id: modelId.value || null, agentId: agentId.value || null, coding_mode: codingMode.value })
  }
}

function scrollDown() { nextTick(() => { const el = scrollEl.value; if (el) el.scrollTop = el.scrollHeight }) }

function lastAssistant() {
  for (let i = messages.value.length - 1; i >= 0; i--) if (messages.value[i].role === 'assistant') return messages.value[i]
  return null
}
function ensureStreamingAssistant() {
  let m = lastAssistant()
  if (!m || !m.streaming) { m = { role: 'assistant', text: '', streaming: true, tools: [] }; messages.value.push(m) }
  return m
}
function diffCardById(id) {
  return messages.value.find(m => m.task && m.task.proposed_diff_id === id)
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  autoReconnect = true
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = import.meta.env.VITE_WS_HOST || window.location.host
  ws = new WebSocket(`${proto}//${host}/ws/chat/repository/${props.repoId}/`)
  ws.onopen = () => {
    connected.value = true
    // Prewarm the agent runtime before the first message (no ~6.6s cold build on turn 1). agentId may
    // still be loading here; the unifiedConfig fetch also fires a prewarm once it resolves.
    if (agentId.value) wsSend({ type: 'agent_prewarm', agent_id: agentId.value })
    if (conversationId.value) wsSend({ type: 'resume', conversation_id: conversationId.value })
  }
  ws.onclose = () => {
    connected.value = false; ws = null
    if (autoReconnect) { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 2000) }
  }
  ws.onerror = () => { try { ws && ws.close() } catch (e) { /* noop */ } }
  ws.onmessage = (e) => { try { onEvent(JSON.parse(e.data)) } catch (err) { /* noop */ } }
}

function onEvent(d) {
  const t = d.type
  if (handleHitlEvent && handleHitlEvent(d)) return   // hitl_request / hitl_response_ack
  if (handlePermissionEvent && handlePermissionEvent(d)) { sending.value = false; scrollDown(); return }  // permission_request

  if (t === 'conversation_created') { conversationId.value = d.conversation_id; return }
  if (t === 'assistant_typing') { ensureStreamingAssistant(); return }
  if (t === 'memory_saved') { showMemorySavedToast(d); return }
  if (t === 'agent_progress') {
    const m = ensureStreamingAssistant(); (m.steps = m.steps || []).push(d.label || d.phase || '…'); scrollDown(); return
  }
  if (t === 'assistant_message_chunk') { const m = ensureStreamingAssistant(); m.text += (d.chunk || ''); scrollDown(); return }
  if (t === 'token_usage') { const m = ensureStreamingAssistant(); m.usage = d; return }
  if (t === 'assistant_message_complete') {
    const m = ensureStreamingAssistant(); if (d.full_message) m.text = d.full_message
    if (d.usage) m.usage = d.usage
    m.streaming = false; sending.value = false; scrollDown(); return
  }
  if (t === 'tool_result') {
    const m = ensureStreamingAssistant(); (m.tools = m.tools || []).push({ name: d.tool_name || d.tool || 'tool', ok: d.status !== 'error' })
    emit('activity', [`tool: ${d.tool_name || d.tool || ''}`]); scrollDown(); return
  }
  if (t === 'tool_call') { return }

  // ── Proposed-diff lifecycle ──
  if (t === 'proposed_diff') {
    const task = {
      proposed_diff_id: d.proposed_diff_id, diff_text: d.diff_text || '',
      diff_summary: d.diff_summary || {}, export_enabled: d.can_export !== false,
      pr_url: '',
    }
    const m = lastAssistant() || { role: 'assistant', text: '', tools: [] }
    if (!messages.value.includes(m)) messages.value.push(m)
    m.streaming = false; m.task = task; sending.value = false
    emit('proposal', task); scrollDown(); return
  }
  if (t === 'proposed_diff_updated') {
    const m = diffCardById(d.proposed_diff_id)
    if (m) { m.task.diff_text = d.diff_text || ''; m.task.diff_summary = d.diff_summary || {}; m.busy = false; emit('proposal', m.task) }
    emit('changed'); return
  }
  if (t === 'proposed_diff_resolved') {
    const m = diffCardById(d.proposed_diff_id)
    if (m) {
      m.busy = false; m.exporting = false; m.resolved = d.outcome
      if (d.pr_url) m.task.pr_url = d.pr_url
      if (d.outcome === 'discarded') m.task = { ...m.task, diff_text: '', diff_summary: {} }
    }
    if (d.outcome === 'error') notify.error(d.error || 'Diff action failed')
    else notify.success(`Change ${d.outcome}`)
    emit('proposal', null); emit('changed'); return
  }
  if (t === 'error') { notify.error(d.error || 'Error'); sending.value = false }
}

function send(text) {
  const msg = (text != null ? text : input.value).trim()
  if (!msg || !props.crsReady) return
  lastUserPrompt.value = msg                    // remembered so a permission 'allow' can auto-continue
  messages.value.push({ role: 'user', text: msg })
  input.value = ''
  sending.value = true
  wsSend({ type: 'chat_message', message: msg, conversation_id: conversationId.value,
           model_id: modelId.value || null, agentId: agentId.value || null, coding_mode: codingMode.value })
  nextTick(autoGrow)
  scrollDown()
}
function stop() { wsSend({ type: 'stop_execution' }); sending.value = false }

// ── Composer behaviours ──
function autoGrow() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}
function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}
// ── Chat history + new chat (wired end-to-end to /conversations/ + the repo socket) ──
function newChat() {
  if (sending.value) stop()
  messages.value = []
  conversationId.value = null      // next send → backend creates a fresh conversation (emits conversation_created)
  historyOpen.value = false
  nextTick(() => inputEl.value && inputEl.value.focus())
}
async function loadHistory() {
  loadingHistory.value = true
  try {
    const { data } = await api.getConversations({ repository: props.repoId, type: 'repository' })
    conversations.value = data?.results || data || []
  } catch (e) { conversations.value = [] }
  finally { loadingHistory.value = false }
}
function toggleHistory() {
  historyOpen.value = !historyOpen.value
  if (historyOpen.value) loadHistory()
}
async function openConversation(c) {
  historyOpen.value = false
  if (c.id === conversationId.value) return
  if (sending.value) stop()
  try {
    const { data } = await api.getConversation(c.id)
    const msgs = data?.messages || []
    messages.value = msgs
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => m.role === 'user'
        ? { role: 'user', text: m.content || '' }
        : { role: 'assistant', text: m.content || '', streaming: false, tools: [] })
    conversationId.value = c.id
    wsSend({ type: 'resume', conversation_id: c.id })   // re-attach if a turn is still running
    scrollDown()
  } catch (e) { notify.error('Could not load that conversation') }
}
function convTitle(c) {
  if (c.title && c.title.trim()) return c.title.trim()
  const lm = c.last_message && c.last_message.content
  return lm ? lm.slice(0, 60) : 'Untitled chat'
}
function relTime(ts) {
  if (!ts) return ''
  const d = (Date.now() - new Date(ts).getTime()) / 1000
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`
  return new Date(ts).toLocaleDateString()
}

// ── diff card actions → WS ──
function onKeep(m) { m.busy = true; wsSend({ type: 'diff_accept', proposed_diff_id: m.task.proposed_diff_id }) }
function onDiscard(m) { m.busy = true; wsSend({ type: 'diff_discard', proposed_diff_id: m.task.proposed_diff_id }) }
function onRevertFile(m, path) { m.busy = true; wsSend({ type: 'diff_revert_file', proposed_diff_id: m.task.proposed_diff_id, path }) }
function onRevertHunk(m, payload) {
  m.busy = true
  wsSend({ type: 'diff_revert_hunk', proposed_diff_id: m.task.proposed_diff_id, path: payload.path, hunk: payload.h ?? payload.hunk })
}
function onExport(m) {
  m.exporting = true; wsSend({ type: 'diff_export', proposed_diff_id: m.task.proposed_diff_id })
}
async function onCopy(m) {
  try { await navigator.clipboard.writeText(m.task.diff_text || ''); notify.success('Patch copied') }
  catch { notify.error('Could not copy') }
}

function displayText(t) {
  // The agent's text protocol emits tool calls as ```json {"name":...}``` blocks — never show those raw.
  if (!t) return ''
  let s = String(t)
  s = s.replace(/```[a-zA-Z]*\s*\{[\s\S]*?\}\s*```/g, '')   // fenced tool-call blocks
  s = s.replace(/^\s*\{[\s\S]*?"name"\s*:[\s\S]*?\}\s*$/gm, '')  // bare tool-call JSON
  s = s.replace(/```\s*$/g, '').replace(/\n{3,}/g, '\n\n')
  return s.trim()
}
function renderMarkdown(t) {
  const clean = displayText(t)
  if (!clean) return ''
  return enhanceChatMedia(renderUntrustedMarkdown(clean))
}
function resolvedLabel(m) {
  return { accepted: 'Kept locally', discarded: 'Discarded', exported: 'PR opened', error: 'Action failed' }[m.resolved] || m.resolved
}

async function loadModels() {
  try {
    const { data } = await api.getLlmModels({ fields: 'picker' })   // ?fields=picker: every row, without the heavy metadata (not read here)
    const list = data?.results || data || []
    models.value = list.filter(m => !m.is_embedding).map(m => ({ id: m.id, label: m.name || m.model_id }))
  } catch (e) { models.value = [] }
}

async function loadAgentForProject() {
  // The project's coding agent is the Modes target (AgentModePicker persists the canonical
  // agent_run_mode to it). The picker self-syncs the exact mode via getAgent() on mount, so defaults
  // here are fine.
  try {
    const { data } = await api.unifiedConfig(props.systemId)
    if (data?.agent_id) {
      agentId.value = data.agent_id
      // agentId resolved after the socket opened → prewarm now (wsSend no-ops if the WS isn't open).
      wsSend({ type: 'agent_prewarm', agent_id: agentId.value })
    }
  } catch (e) { /* picker just stays hidden until an agent exists */ }
}
function onModeChange(patch) {
  agentMeta.value = { agent_run_mode: patch.agent_run_mode }
}

onMounted(() => { connect(); loadModels(); loadAgentForProject() })
onBeforeUnmount(() => {
  autoReconnect = false; clearTimeout(reconnectTimer)
  try { ws && ws.close() } catch (e) { /* noop */ }
})

defineExpose({ send })
</script>

<style scoped>
.uac {
  --uac-on-solid: white;   /* text on a solid primary/danger fill: the same in both themes */
  display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--vm-surface); color: var(--vm-ink);
}
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

/* ── Top bar ── */
.uac-head { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-bottom: 1px solid var(--vm-line); background: var(--vm-surface); }
.uac-title { display: inline-flex; align-items: center; gap: 7px; font: 700 13px var(--vm-font-sans); color: var(--vm-ink); white-space: nowrap; }
.uac-title :deep(svg) { width: 15px; height: 15px; color: var(--vm-violet); }
.uac-head-actions { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.uac-modes { display: inline-flex; gap: 2px; padding: 2px; margin-right: 4px; background: var(--vm-surface-soft); border-radius: 9px; }
.uac-mode { border: none; background: transparent; cursor: pointer; font: 600 12px var(--vm-font-sans); color: var(--vm-ink-soft); padding: 5px 11px; border-radius: 7px; transition: color .15s, background-color .15s; }
.uac-mode:hover { color: var(--vm-ink); }
.uac-mode.on { background: var(--vm-surface); color: var(--vm-ink); box-shadow: var(--vm-shadow-s); }
.uac-hwrap { position: relative; }
.uac-hbtn { display: grid; place-items: center; width: 32px; height: 32px; border: none; background: transparent; color: var(--vm-ink-soft); border-radius: 8px; cursor: pointer; transition: color .15s, background-color .15s; }
.uac-hbtn:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.uac-hbtn.on { background: var(--vm-violet-soft); color: var(--vm-violet); }
.uac-hbtn :deep(svg) { width: 16px; height: 16px; }
.uac-hbackdrop { position: fixed; inset: 0; z-index: 40; }
.uac-hmenu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 41; width: min(300px, calc(100vw - 32px)); max-height: 360px; overflow-y: auto;
  background: var(--vm-surface); border: 1px solid var(--vm-line); border-radius: 12px;
  box-shadow: var(--vm-shadow-l); padding: 6px;
}
.uac-hmenu-head { font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink-soft); padding: 6px 8px 8px; }
.uac-hmenu-empty { font-size: 13px; color: var(--vm-ink-faint); padding: 12px 8px; text-align: center; }
.uac-hitem { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; border: none; background: transparent; padding: 8px 9px; border-radius: 9px; cursor: pointer; transition: background-color .12s; }
.uac-hitem:hover { background: var(--vm-surface-soft); }
.uac-hitem.active { background: var(--vm-violet-soft); }
.uac-hitem-title { font: 600 13px var(--vm-font-sans); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.uac-hitem-meta { font-size: 11.5px; color: var(--vm-ink-faint); }

.uac-stream { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.uac-empty { margin: auto; text-align: center; color: var(--vm-ink-soft); max-width: 320px; font-size: 13.5px; line-height: 1.5; }
.uac-empty :deep(svg) { width: 24px; height: 24px; margin-bottom: 8px; color: var(--vm-violet); }
.uac-msg { display: flex; }
.uac-msg.user { justify-content: flex-end; }
.bubble { max-width: 92%; border-radius: 12px; padding: 9px 12px; font-size: 13.5px; line-height: 1.55; }
.bubble.user { background: var(--vm-violet); color: var(--uac-on-solid); white-space: pre-wrap; overflow-wrap: anywhere; }
.bubble.assistant { background: var(--vm-surface-soft); border: 1px solid var(--vm-line); color: var(--vm-ink); width: 100%; }
.ai-text { word-break: break-word; }
.ai-text .md-body { display: block; }
.ai-text .caret { display: inline-block; margin-left: 1px; }

/* ── Markdown rendering (tight, smaller headings) ── */
.ai-text :deep(p) { margin: 0 0 8px; }
.ai-text :deep(.md-body > *:last-child) { margin-bottom: 0; }
.ai-text :deep(h1),
.ai-text :deep(h2),
.ai-text :deep(h3),
.ai-text :deep(h4),
.ai-text :deep(h5),
.ai-text :deep(h6) {
  font-weight: 600; line-height: 1.3; color: var(--vm-ink);
  margin: 14px 0 6px;
}
.ai-text :deep(.md-body > h1:first-child),
.ai-text :deep(.md-body > h2:first-child),
.ai-text :deep(.md-body > h3:first-child) { margin-top: 0; }
.ai-text :deep(h1) { font-size: 1.15em; }
.ai-text :deep(h2) { font-size: 1.08em; }
.ai-text :deep(h3) { font-size: 1em; }
.ai-text :deep(h4),
.ai-text :deep(h5),
.ai-text :deep(h6) { font-size: 0.92em; color: var(--vm-ink-soft); }
.ai-text :deep(ul),
.ai-text :deep(ol) { margin: 0 0 8px; padding-left: 20px; }
.ai-text :deep(li) { margin: 2px 0; }
.ai-text :deep(li > ul),
.ai-text :deep(li > ol) { margin: 2px 0; }
.ai-text :deep(strong) { font-weight: 600; color: var(--vm-ink); }
.ai-text :deep(a) { color: var(--vm-violet); text-decoration: underline; text-underline-offset: 2px; }
.ai-text :deep(hr) { border: none; border-top: 1px solid var(--vm-line); margin: 12px 0; }
.ai-text :deep(blockquote) {
  margin: 0 0 8px; padding: 2px 12px; color: var(--vm-ink-soft);
  border-left: 3px solid var(--vm-line-2);
}
/* Inline code */
.ai-text :deep(code) {
  font-family: var(--vm-font-mono);
  font-size: 0.85em; background: color-mix(in srgb, var(--vm-ink) 7%, transparent);
  padding: 1px 5px; border-radius: 4px;
}
/* Fenced code blocks */
.ai-text :deep(pre) {
  background: var(--vm-surface); color: var(--vm-ink); border: 1px solid var(--vm-line); padding: 11px 13px;
  border-radius: 10px; overflow-x: auto; margin: 0 0 10px; line-height: 1.5;
}
.ai-text :deep(pre code) { background: none; padding: 0; color: inherit; font-size: 0.85em; }
/* Tables (GFM) */
.ai-text :deep(table) {
  width: 100%; border-collapse: separate; border-spacing: 0;
  margin: 4px 0 12px; font-size: 0.9em; border: 1px solid var(--vm-line);
  border-radius: 10px; overflow: hidden; display: table;
}
.ai-text :deep(thead th) { background: var(--vm-surface); color: var(--vm-ink); font-weight: 600; text-align: left; }
.ai-text :deep(th),
.ai-text :deep(td) {
  padding: 7px 11px; border-bottom: 1px solid var(--vm-line);
  border-right: 1px solid var(--vm-line); vertical-align: top;
}
.ai-text :deep(th:last-child),
.ai-text :deep(td:last-child) { border-right: none; }
.ai-text :deep(tbody tr:last-child td) { border-bottom: none; }
.ai-text :deep(tbody tr:nth-child(even)) { background: color-mix(in srgb, var(--vm-ink) 3%, transparent); }
.ai-text :deep(table code) { background: color-mix(in srgb, var(--vm-ink) 7%, transparent); }
.ai-text :deep(img) { max-width: 100%; border-radius: 8px; }
.ai-steps { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.ai-step { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--vm-ink-soft); }
.ai-step .sdot { width: 6px; height: 6px; border-radius: 50%; background: var(--vm-violet); flex: 0 0 auto; opacity: .5; }
.ai-step .sdot.active { opacity: 1; animation: vmpulse 1s ease-in-out infinite; }
@keyframes vmpulse { 50% { opacity: .3; } }
.ai-working { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--vm-ink-soft); }
.vm-spin { width: 13px; height: 13px; border: 2px solid var(--vm-line-2); border-top-color: var(--vm-violet); border-radius: 50%; display: inline-block; animation: vmspin .7s linear infinite; }
@keyframes vmspin { to { transform: rotate(360deg); } }
.caret { animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.ai-tool { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--vm-ink-soft); margin-top: 6px; }
.ai-tool :deep(svg) { width: 13px; height: 13px; }
.ai-tool .terr { color: var(--vm-danger); font-weight: 600; }
.ai-resolved { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--vm-ink-soft); margin-top: 8px; }
.ai-resolved :deep(svg) { width: 14px; height: 14px; }
.ai-resolved a { color: var(--vm-violet); margin-left: 6px; }
.ai-usage { margin-top: 8px; }

/* ── Composer (single container) ── */
.uac-composer { border-top: 1px solid var(--vm-line); padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.uac-box { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; background: var(--vm-surface); border: 1.5px solid var(--vm-line-2); border-radius: 16px; transition: border-color .18s var(--vm-ease2), box-shadow .18s; }
.uac-box.focused { border-color: var(--vm-focus); box-shadow: 0 0 0 4px color-mix(in srgb, var(--vm-focus) 18%, transparent); }

.uac-box-top { display: flex; align-items: flex-start; gap: 6px; }
.uac-box-top textarea { flex: 1; min-width: 0; resize: none; border: none; outline: none; background: transparent; padding: 5px 2px; font: inherit; font-size: 14px; line-height: 1.5; color: var(--vm-ink); max-height: 200px; }
.uac-box-top textarea::placeholder { color: var(--vm-ink-faint); }
.uac-box-top textarea:disabled { color: var(--vm-ink-faint); cursor: not-allowed; }

.uac-mic { flex: 0 0 auto; display: grid; place-items: center; width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; color: var(--vm-ink-soft); cursor: pointer; transition: color .15s, background-color .15s; }
.uac-mic:hover { color: var(--vm-violet); background: var(--vm-violet-soft); }
.uac-mic.live { color: var(--uac-on-solid); background: var(--vm-danger); animation: uacmic 1.3s ease-in-out infinite; }
.uac-mic.off { color: var(--vm-ink-faint); opacity: .55; cursor: help; }
.uac-mic.off:hover { background: transparent; color: var(--vm-ink-faint); }
.uac-mic.busy { color: var(--vm-violet); animation: uacmic 1s linear infinite; }
.uac-mic :deep(svg) { width: 16px; height: 16px; }
@keyframes uacmic { 50% { opacity: .55; } }

.uac-box-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.uac-bar-left { display: flex; align-items: center; gap: 6px; min-width: 0; }
.uac-sel { font: 12.5px var(--vm-font-sans); min-height: 30px; padding: 4px 8px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); max-width: 160px; cursor: pointer; }
.uac-sel option { background: var(--vm-surface); color: var(--vm-ink); }

.uac-circle { flex: 0 0 auto; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; color: var(--uac-on-solid); transition: background-color .15s, opacity .15s; }
.uac-circle :deep(svg) { width: 16px; height: 16px; }
.uac-circle.send { background: var(--vm-violet); }
.uac-circle.send:hover:not(:disabled) { background: var(--vm-violet-d); }
.uac-circle.send:disabled { opacity: .4; cursor: not-allowed; }
.uac-circle.stop { background: var(--vm-danger); }
.uac-circle.stop:hover { opacity: .88; }

.uac-hint { display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 11.5px; color: var(--vm-ink-faint); }
.uac-conn { display: inline-flex; align-items: center; gap: 5px; color: var(--vm-ink-faint); }
.uac-conn-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--vm-amber); }
.uac-conn.on .uac-conn-dot { background: var(--vm-green); }
.uac-hint > span:last-child { margin-left: auto; text-align: right; }

@media (max-width: 640px) {
  .uac-hbtn, .uac-mic { width: 44px; height: 44px; }
  .uac-circle { width: 44px; height: 44px; }
  .uac-mode { min-height: 40px; }
  .uac-sel { min-height: 44px; }
  .uac-hint > span:last-child { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .ai-step .sdot.active, .vm-spin, .caret, .uac-mic.live, .uac-mic.busy { animation: none; }
}
</style>
