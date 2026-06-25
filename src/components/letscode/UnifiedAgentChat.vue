<!--
  UnifiedAgentChat — the single Cursor-style coding chat (unified-coding-agent-plan.md Phase 3).
  Replaces the Code | Ask split when UNIFIED_CODING_AGENT_ENABLED is on. One WS
  (ws/chat/repository/<id>/), one stream: text + tool results + HITL (useHitl/HITLModal) + reviewable
  diffs (ProposedChangesCard). Diff actions go back over the same socket (diff_accept/discard/
  revert_file/revert_hunk/export). No native dialogs — useNotify only.
-->
<template>
  <div class="uac">
    <!-- Top bar — Claude-style: title + chat history + new chat -->
    <div class="uac-head">
      <span class="uac-title"><Icon icon="lucide:sparkles" /> Agent</span>
      <div class="uac-head-actions">
        <div class="uac-modes" role="tablist" aria-label="Coding mode">
          <button
            v-for="md in CODING_MODES" :key="md.id" type="button" :title="md.hint"
            class="uac-mode" :class="{ on: codingMode === md.id }" @click="codingMode = md.id"
          >{{ md.label }}</button>
        </div>
        <div class="uac-hwrap">
          <button class="uac-hbtn" :class="{ on: historyOpen }" title="Chat history" @click="toggleHistory">
            <Icon icon="lucide:history" />
          </button>
          <div v-if="historyOpen" class="uac-hbackdrop" @click="historyOpen = false"></div>
          <div v-if="historyOpen" class="uac-hmenu">
            <div class="uac-hmenu-head">Chat history</div>
            <div v-if="loadingHistory" class="uac-hmenu-empty">Loading…</div>
            <template v-else>
              <button
                v-for="c in conversations" :key="c.id"
                class="uac-hitem" :class="{ active: c.id === conversationId }"
                @click="openConversation(c)"
              >
                <span class="uac-hitem-title">{{ convTitle(c) }}</span>
                <span class="uac-hitem-meta">{{ relTime(c.updated_at) }} · {{ c.message_count || 0 }} msg</span>
              </button>
              <div v-if="!conversations.length" class="uac-hmenu-empty">No previous chats yet.</div>
            </template>
          </div>
        </div>
        <button class="uac-hbtn" title="New chat" @click="newChat">
          <Icon icon="lucide:square-pen" />
        </button>
      </div>
    </div>

    <div ref="scrollEl" class="uac-stream">
      <div v-if="messages.length === 0" class="uac-empty">
        <Icon icon="lucide:sparkles" />
        <p>Ask a question, or describe a change — the agent answers, asks if unclear, or proposes a reviewable diff.</p>
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
            <span v-if="tr.ok === false" class="terr">failed</span>
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
      <!-- Staged attachments (visual shell — transmission to the agent is a follow-up) -->
      <div v-if="attachments.length" class="uac-attach-strip">
        <div v-for="(a, i) in attachments" :key="i" class="uac-attach-chip">
          <img v-if="a.isImage && a.url" :src="a.url" class="uac-attach-thumb" :alt="a.name" />
          <Icon v-else icon="lucide:file" class="uac-attach-ic" />
          <span class="uac-attach-name">{{ a.name }}</span>
          <button class="uac-attach-x" title="Remove" @click="removeAttach(i)">×</button>
        </div>
      </div>

      <!-- Single rounded container: input on top, action toolbar on the bottom (Claude-style) -->
      <div class="uac-box" :class="{ focused }">
        <input ref="fileEl" type="file" multiple class="uac-file-hidden" @change="onFiles" />

        <div class="uac-box-top">
          <textarea
            ref="inputEl" v-model="input" :disabled="!crsReady"
            :placeholder="crsReady ? 'Message the coding agent…' : 'Preparing the project…'"
            rows="1" @input="autoGrow" @keydown="onKeydown" @focus="focused = true" @blur="focused = false"
          ></textarea>
          <button
            v-if="speech.supported" class="uac-mic" :class="{ live: speech.listening.value }"
            :title="speech.listening.value ? 'Stop dictation' : 'Voice input'" @click="speech.toggle()"
          >
            <Icon icon="lucide:mic" />
          </button>
        </div>

        <div class="uac-box-bar">
          <div class="uac-bar-left">
            <!-- + menu -->
            <div class="uac-plus-wrap">
              <button class="uac-plus" :class="{ on: plusOpen }" title="Add" @click="plusOpen = !plusOpen">
                <Icon icon="lucide:plus" />
              </button>
              <div v-if="plusOpen" class="uac-plus-backdrop" @click="plusOpen = false"></div>
              <div v-if="plusOpen" class="uac-plus-menu">
                <button class="uac-plus-item" @click="pickFile"><Icon icon="lucide:upload" /> Upload from computer</button>
                <button class="uac-plus-item" @click="addContext"><Icon icon="lucide:file-text" /> Add context</button>
                <button class="uac-plus-item" @click="browseWeb"><Icon icon="lucide:globe" /> Browse the web</button>
              </div>
            </div>
            <AgentModePicker
              v-if="agentId" :agent-id="agentId"
              :execution-mode="agentMeta.execution_mode" :plan-mode="agentMeta.plan_mode_enabled"
              placement="up" @change="onModeChange"
            />
            <select v-model="modelId" class="uac-sel" title="Model">
              <option value="">Auto model</option>
              <option v-for="md in models" :key="md.id" :value="md.id">{{ md.label || md.name }}</option>
            </select>
          </div>

          <button v-if="sending" class="uac-circle stop" title="Stop" @click="stop">
            <Icon icon="lucide:square" />
          </button>
          <button
            v-else class="uac-circle send" title="Send"
            :disabled="!input.trim() || !crsReady" @click="send()"
          >
            <Icon icon="lucide:arrow-up" />
          </button>
        </div>
      </div>

      <div class="uac-hint">
        <span class="uac-conn" :class="{ on: connected }">{{ connected ? 'connected' : 'connecting…' }}</span>
        <span>Enter to send · Shift+Enter for new line</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'
import { enhanceChatMedia } from '@/utils/chatMedia'
import { useSpeech } from '@/composables/useSpeech'
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

// Same markdown pipeline the rest of the chat surfaces use: GFM (tables/strikethrough),
// soft line breaks, and syntax-highlighted fenced code blocks.
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  }),
)
marked.setOptions({ breaks: true, gfm: true })

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
  crsReady: { type: Boolean, default: false },
  exportEnabled: { type: Boolean, default: false },
})
const emit = defineEmits(['changed', 'proposal', 'activity'])

const messages = ref([])
const input = ref('')
const modelId = ref('')
const models = ref([])
const codingMode = ref('agent')   // agent (iterative, default) | patch (legacy one-shot) | ask (read-only)
const CODING_MODES = [
  { id: 'agent', label: 'Agent', hint: 'Iterative — reads, edits, runs, verifies' },
  { id: 'ask', label: 'Ask', hint: 'Read-only — answers, never edits' },
  { id: 'patch', label: 'Patch', hint: 'Legacy one-shot diff' },
]
const agentId = ref('')           // the project's coding agent (the Modes target); from unified-config
const agentMeta = ref({ execution_mode: 'manual', plan_mode_enabled: false })
const sending = ref(false)
const connected = ref(false)
const conversationId = ref(null)
const scrollEl = ref(null)
const inputEl = ref(null)

// Chat history (session list) + new chat
const historyOpen = ref(false)
const loadingHistory = ref(false)
const conversations = ref([])

// Composer (Claude-style): focus ring, + menu, staged attachments, voice input
const focused = ref(false)
const plusOpen = ref(false)
const attachments = ref([])
const fileEl = ref(null)
const speech = useSpeech({
  onResult: (text) => { input.value = input.value ? `${input.value} ${text}` : text; nextTick(autoGrow) },
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
      diff_summary: d.diff_summary || {}, export_enabled: !!d.can_export && props.exportEnabled,
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
  attachments.value = []
  plusOpen.value = false
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
function pickFile() { plusOpen.value = false; fileEl.value && fileEl.value.click() }
function onFiles(e) {
  const files = Array.from(e.target.files || [])
  for (const f of files) {
    const isImage = /^image\//.test(f.type)
    attachments.value.push({ name: f.name, isImage, url: isImage ? URL.createObjectURL(f) : '', file: f })
  }
  e.target.value = ''   // allow re-selecting the same file
}
function removeAttach(i) {
  const a = attachments.value[i]
  if (a && a.url) { try { URL.revokeObjectURL(a.url) } catch (e) { /* noop */ } }
  attachments.value.splice(i, 1)
}
// Deferred (visual shell — backend wiring is the agreed follow-up).
function addContext() { plusOpen.value = false; notify.info('Repo context attachments are coming soon.') }
function browseWeb() { plusOpen.value = false; notify.info('Web browsing is coming soon.') }

// ── Chat history + new chat (wired end-to-end to /conversations/ + the repo socket) ──
function newChat() {
  if (sending.value) stop()
  messages.value = []
  conversationId.value = null      // next send → backend creates a fresh conversation (emits conversation_created)
  historyOpen.value = false
  attachments.value = []
  plusOpen.value = false
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
  if (!props.exportEnabled) { notify.info('GitHub export is disabled on the server'); return }
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
  return enhanceChatMedia(marked.parse(clean))
}
function resolvedLabel(m) {
  return { accepted: 'Kept locally', discarded: 'Discarded', exported: 'PR opened', error: 'Action failed' }[m.resolved] || m.resolved
}

async function loadModels() {
  try {
    const { data } = await api.getLLMModels()
    const list = data?.results || data || []
    models.value = list.filter(m => !m.is_embedding).map(m => ({ id: m.id, label: m.name || m.model_id }))
  } catch (e) { models.value = [] }
}

async function loadAgentForProject() {
  // The project's coding agent is the Modes target (AgentModePicker persists Manual/Auto/Plan/Plan+Auto
  // to it; the backend reads execution_mode/plan_mode during the turn). The picker self-syncs the exact
  // mode via getAgent() on mount, so defaults here are fine.
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
  agentMeta.value = { execution_mode: patch.execution_mode, plan_mode_enabled: patch.plan_mode_enabled }
}

onMounted(() => { connect(); loadModels(); loadAgentForProject() })
onBeforeUnmount(() => {
  autoReconnect = false; clearTimeout(reconnectTimer)
  try { ws && ws.close() } catch (e) { /* noop */ }
  attachments.value.forEach(a => { if (a.url) { try { URL.revokeObjectURL(a.url) } catch (e) { /* noop */ } } })
})

defineExpose({ send })
</script>

<style scoped>
.uac { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--vm-surface, #fff); }

/* ── Top bar ── */
.uac-head { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-bottom: 1px solid var(--vm-line, #e2e8f0); background: var(--vm-surface, #fff); }
.uac-title { display: inline-flex; align-items: center; gap: 7px; font: 700 12.5px var(--vm-font-sans, inherit); color: var(--vm-violet-d, #4f46e5); }
.uac-title :deep(svg) { width: 15px; height: 15px; }
.uac-head-actions { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.uac-modes { display: inline-flex; gap: 2px; padding: 2px; margin-right: 4px; background: var(--vm-surface-soft, #f1f5f9); border-radius: 9px; }
.uac-mode { border: none; background: transparent; cursor: pointer; font: 700 11px var(--vm-font-sans); color: var(--vm-ink-faint, #64748b); padding: 4px 9px; border-radius: 7px; transition: .15s; }
.uac-mode:hover { color: var(--vm-ink, #0f172a); }
.uac-mode.on { background: var(--vm-surface, #fff); color: var(--vm-violet-d, #4f46e5); box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.uac-hwrap { position: relative; }
.uac-hbtn { display: grid; place-items: center; width: 30px; height: 30px; border: none; background: transparent; color: var(--vm-ink-faint, #64748b); border-radius: 8px; cursor: pointer; transition: .15s; }
.uac-hbtn:hover { background: var(--vm-surface-soft, #f1f5f9); color: var(--vm-ink, #0f172a); }
.uac-hbtn.on { background: var(--vm-violet-soft, #eef2ff); color: var(--vm-violet-d, #4f46e5); }
.uac-hbtn :deep(svg) { width: 16px; height: 16px; }
.uac-hbackdrop { position: fixed; inset: 0; z-index: 40; }
.uac-hmenu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 41; width: 300px; max-height: 360px; overflow-y: auto;
  background: var(--vm-surface, #fff); border: 1px solid var(--vm-line, #e2e8f0); border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, .16); padding: 6px;
}
.uac-hmenu-head { font: 700 11px var(--vm-font-sans, inherit); text-transform: uppercase; letter-spacing: .06em; color: var(--vm-ink-faint, #94a3b8); padding: 6px 8px 8px; }
.uac-hmenu-empty { font-size: 12.5px; color: var(--vm-ink-faint, #94a3b8); padding: 12px 8px; text-align: center; }
.uac-hitem { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; border: none; background: transparent; padding: 8px 9px; border-radius: 9px; cursor: pointer; transition: .12s; }
.uac-hitem:hover { background: var(--vm-surface-soft, #f1f5f9); }
.uac-hitem.active { background: var(--vm-violet-soft, #eef2ff); }
.uac-hitem-title { font: 600 12.5px var(--vm-font-sans, inherit); color: var(--vm-ink, #0f172a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.uac-hitem-meta { font-size: 11px; color: var(--vm-ink-faint, #94a3b8); }

.uac-stream { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.uac-empty { margin: auto; text-align: center; color: var(--vm-ink-faint, #94a3b8); max-width: 320px; font-size: 13px; }
.uac-empty :deep(svg) { width: 26px; height: 26px; margin-bottom: 8px; }
.uac-msg { display: flex; }
.uac-msg.user { justify-content: flex-end; }
.bubble { max-width: 92%; border-radius: 12px; padding: 9px 12px; font-size: 13px; line-height: 1.55; }
.bubble.user { background: var(--vm-primary, #2563eb); color: #fff; }
.bubble.assistant { background: var(--vm-surface-soft, #f8fafc); border: 1px solid var(--vm-line, #e2e8f0); color: var(--vm-ink, #0f172a); width: 100%; }
.ai-text { word-break: break-word; }
.ai-text .md-body { display: block; }
.ai-text .caret { display: inline-block; margin-left: 1px; }

/* ── Markdown rendering (ChatGPT/Claude-style: tight, organized, smaller headings) ── */
.ai-text :deep(p) { margin: 0 0 8px; }
.ai-text :deep(.md-body > *:last-child) { margin-bottom: 0; }
.ai-text :deep(h1),
.ai-text :deep(h2),
.ai-text :deep(h3),
.ai-text :deep(h4),
.ai-text :deep(h5),
.ai-text :deep(h6) {
  font-weight: 600; line-height: 1.3; color: var(--vm-ink, #0f172a);
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
.ai-text :deep(h6) { font-size: 0.92em; color: var(--vm-ink-soft, #475569); }
.ai-text :deep(ul),
.ai-text :deep(ol) { margin: 0 0 8px; padding-left: 20px; }
.ai-text :deep(li) { margin: 2px 0; }
.ai-text :deep(li > ul),
.ai-text :deep(li > ol) { margin: 2px 0; }
.ai-text :deep(strong) { font-weight: 600; color: var(--vm-ink, #0f172a); }
.ai-text :deep(a) { color: var(--vm-primary, #2563eb); text-decoration: underline; }
.ai-text :deep(hr) { border: none; border-top: 1px solid var(--vm-line, #e2e8f0); margin: 12px 0; }
.ai-text :deep(blockquote) {
  margin: 0 0 8px; padding: 2px 12px; color: var(--vm-ink-soft, #475569);
  border-left: 3px solid var(--vm-line-2, #cbd5e1);
}
/* Inline code */
.ai-text :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em; background: rgba(15, 23, 42, 0.06);
  padding: 1px 5px; border-radius: 4px;
}
/* Fenced code blocks (highlight.js atom-one-dark) */
.ai-text :deep(pre) {
  background: #0f172a; color: #e2e8f0; padding: 11px 13px;
  border-radius: 10px; overflow-x: auto; margin: 0 0 10px; line-height: 1.5;
}
.ai-text :deep(pre code) { background: none; padding: 0; color: inherit; font-size: 0.85em; }
/* Tables (GFM) */
.ai-text :deep(table) {
  width: 100%; border-collapse: separate; border-spacing: 0;
  margin: 4px 0 12px; font-size: 0.9em; border: 1px solid var(--vm-line, #e2e8f0);
  border-radius: 10px; overflow: hidden; display: table;
}
.ai-text :deep(thead th) { background: var(--vm-surface-soft, #f8fafc); color: var(--vm-ink, #0f172a); font-weight: 600; text-align: left; }
.ai-text :deep(th),
.ai-text :deep(td) {
  padding: 7px 11px; border-bottom: 1px solid var(--vm-line, #e2e8f0);
  border-right: 1px solid var(--vm-line, #e2e8f0); vertical-align: top;
}
.ai-text :deep(th:last-child),
.ai-text :deep(td:last-child) { border-right: none; }
.ai-text :deep(tbody tr:last-child td) { border-bottom: none; }
.ai-text :deep(tbody tr:nth-child(even)) { background: rgba(15, 23, 42, 0.02); }
.ai-text :deep(table code) { background: rgba(15, 23, 42, 0.06); }
.ai-text :deep(img) { max-width: 100%; border-radius: 8px; }
.ai-steps { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.ai-step { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--vm-ink-faint, #64748b); }
.ai-step .sdot { width: 6px; height: 6px; border-radius: 50%; background: var(--vm-primary, #2563eb); flex: 0 0 auto; opacity: .5; }
.ai-step .sdot.active { opacity: 1; animation: vmpulse 1s ease-in-out infinite; }
@keyframes vmpulse { 50% { opacity: .3; } }
.ai-working { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--vm-ink-faint, #64748b); }
.vm-spin { width: 13px; height: 13px; border: 2px solid var(--vm-line-2, #cbd5e1); border-top-color: var(--vm-primary, #2563eb); border-radius: 50%; display: inline-block; animation: vmspin .7s linear infinite; }
@keyframes vmspin { to { transform: rotate(360deg); } }
.caret { animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.ai-tool { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--vm-ink-faint, #64748b); margin-top: 6px; }
.ai-tool :deep(svg) { width: 13px; height: 13px; }
.ai-tool .terr { color: #dc2626; }
.ai-resolved { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--vm-ink-soft, #475569); margin-top: 8px; }
.ai-resolved :deep(svg) { width: 14px; height: 14px; }
.ai-resolved a { color: var(--vm-primary, #2563eb); margin-left: 6px; }
.ai-usage { margin-top: 8px; }
/* ── Composer (Claude-style single container) ── */
.uac-composer { border-top: 1px solid var(--vm-line, #e2e8f0); padding: 10px; display: flex; flex-direction: column; gap: 6px; }

/* Staged attachment chips */
.uac-attach-strip { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 2px 2px; }
.uac-attach-chip { display: inline-flex; align-items: center; gap: 6px; max-width: 220px; padding: 4px 6px 4px 4px; background: var(--vm-surface-soft, #f1f5f9); border: 1px solid var(--vm-line, #e2e8f0); border-radius: 10px; }
.uac-attach-thumb { width: 30px; height: 30px; object-fit: cover; border-radius: 6px; flex: 0 0 auto; }
.uac-attach-ic { width: 18px; height: 18px; color: var(--vm-ink-soft, #475569); flex: 0 0 auto; }
.uac-attach-name { font-size: 12px; color: var(--vm-ink-soft, #475569); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.uac-attach-x { flex: 0 0 auto; width: 18px; height: 18px; line-height: 1; border: none; border-radius: 50%; background: var(--vm-line-2, #cbd5e1); color: var(--vm-ink-soft, #475569); font-size: 13px; cursor: pointer; }
.uac-attach-x:hover { background: var(--vm-danger, #ef4444); color: #fff; }

.uac-box { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; background: var(--vm-surface, #fff); border: 1.5px solid var(--vm-line-2, #cbd5e1); border-radius: 16px; transition: border-color .18s var(--vm-ease2, ease), box-shadow .18s; }
.uac-box.focused { border-color: var(--vm-sky, #3b82f6); box-shadow: 0 0 0 4px rgba(59, 130, 246, .14); }
.uac-file-hidden { display: none; }

.uac-box-top { display: flex; align-items: flex-start; gap: 6px; }
.uac-box-top textarea { flex: 1; min-width: 0; resize: none; border: none; outline: none; background: transparent; padding: 5px 2px; font: inherit; font-size: 13.5px; line-height: 1.5; color: var(--vm-ink, #0f172a); max-height: 200px; }
.uac-box-top textarea::placeholder { color: var(--vm-ink-faint, #94a3b8); }
.uac-box-top textarea:disabled { color: var(--vm-ink-faint, #94a3b8); }

.uac-mic { flex: 0 0 auto; display: grid; place-items: center; width: 30px; height: 30px; border: none; border-radius: 50%; background: transparent; color: var(--vm-ink-faint, #94a3b8); cursor: pointer; transition: .15s; }
.uac-mic:hover { color: var(--vm-primary, #2563eb); background: var(--vm-primary-soft, #eff6ff); }
.uac-mic.live { color: #fff; background: #ef4444; animation: uacmic 1.3s ease-in-out infinite; }
.uac-mic :deep(svg) { width: 16px; height: 16px; }
@keyframes uacmic { 50% { opacity: .55; } }

.uac-box-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.uac-bar-left { display: flex; align-items: center; gap: 6px; min-width: 0; }
.uac-sel { font-size: 12px; padding: 4px 8px; border: 1px solid var(--vm-line-2, #cbd5e1); border-radius: 8px; background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a); max-width: 130px; }

/* + menu */
.uac-plus-wrap { position: relative; }
.uac-plus { display: grid; place-items: center; width: 30px; height: 30px; border: none; border-radius: 8px; background: transparent; color: var(--vm-ink-soft, #475569); cursor: pointer; transition: .15s; }
.uac-plus:hover, .uac-plus.on { color: var(--vm-primary, #2563eb); background: var(--vm-primary-soft, #eff6ff); }
.uac-plus :deep(svg) { width: 18px; height: 18px; }
.uac-plus-backdrop { position: fixed; inset: 0; z-index: 40; }
.uac-plus-menu { position: absolute; bottom: calc(100% + 8px); left: 0; z-index: 41; width: 210px; background: var(--vm-surface, #fff); border: 1px solid var(--vm-line, #e2e8f0); border-radius: 12px; box-shadow: 0 12px 32px rgba(15, 23, 42, .16); padding: 6px; }
.uac-plus-item { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; border: none; background: transparent; padding: 8px 9px; border-radius: 9px; font: 600 12.5px var(--vm-font-sans, inherit); color: var(--vm-ink, #0f172a); cursor: pointer; transition: .12s; }
.uac-plus-item:hover { background: var(--vm-surface-soft, #f1f5f9); }
.uac-plus-item :deep(svg) { width: 15px; height: 15px; color: var(--vm-ink-soft, #475569); flex: 0 0 auto; }

.uac-circle { flex: 0 0 auto; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; color: #fff; transition: transform .15s var(--vm-ease, ease), filter .15s, opacity .15s; }
.uac-circle :deep(svg) { width: 16px; height: 16px; }
.uac-circle.send { background: var(--vm-ink, #0f172a); }
.uac-circle.send:hover:not(:disabled) { transform: scale(1.06); }
.uac-circle.send:disabled { opacity: .4; cursor: not-allowed; }
.uac-circle.stop { background: #ef4444; }
.uac-circle.stop:hover { filter: brightness(1.1); }

.uac-hint { display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 11px; color: var(--vm-ink-faint, #94a3b8); }
.uac-conn { color: var(--vm-ink-faint, #94a3b8); }
.uac-conn.on { color: #16a34a; }
.uac-hint > span:last-child { margin-left: auto; }
</style>
