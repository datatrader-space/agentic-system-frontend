<!--
  UnifiedAgentChat: the Let's Code coding chat. It is the SAME chat as the main agent chat, the Super Agent and
  Video Studio (owner, 2026-11-06): the shared chat store streams the turn and ChatMessageList draws it (the step
  timeline, the answer, tokens, approvals). What is Let's Code's own stays here: the chat history of this project, and the cards a project turn adds under its answer (the proposed diff, a permission ask,
  the running app's preview). The agent is the one shared Coding Agent; the socket is the project's
  (ws/chat/repository/<id>/, the store's `repoId`). No native dialogs: useNotify only.
-->
<template>
  <div class="uac">
    <div class="uac-head">
      <span class="uac-title"><Icon icon="lucide:sparkles" aria-hidden="true" /> Coding agent</span>
      <div class="uac-head-actions">
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
                type="button" class="uac-hitem" :class="{ active: String(c.id) === String(chat.conversationId) }"
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

    <div ref="scrollEl" class="uac-stream" role="log" aria-label="Coding agent conversation" aria-live="polite" aria-relevant="additions">
      <div v-if="!chat.messages.length" class="uac-empty">
        <Icon icon="lucide:sparkles" aria-hidden="true" />
        <p>Describe a change or ask about the code. The agent reads, edits and runs it in the project's sandbox, and shows every change as a diff for you to keep or discard.</p>
      </div>
      <ChatMessageList v-else>
        <template #after-message="{ message }">
          <div v-if="cards[message.id]" class="uac-cards">
            <ProposedChangesCard
              v-if="cards[message.id].task && (cards[message.id].task.diff_text || (cards[message.id].task.diff_summary && cards[message.id].task.diff_summary.files))"
              :task="cards[message.id].task" :busy="cards[message.id].busy" :exporting="cards[message.id].exporting"
              @accept="onExport(cards[message.id])" @keep="onKeep(cards[message.id])" @discard="onDiscard(cards[message.id])"
              @copy="onCopy(cards[message.id])"
              @revert-file="onRevertFile(cards[message.id], $event)" @revert-hunk="onRevertHunk(cards[message.id], $event)"
            />
            <div v-if="cards[message.id].resolved" class="ai-resolved">
              <Icon :icon="cards[message.id].resolved === 'exported' ? 'lucide:git-pull-request' : (cards[message.id].resolved === 'discarded' ? 'lucide:trash-2' : 'lucide:check')" />
              {{ resolvedLabel(cards[message.id]) }}
              <a v-if="cards[message.id].task && cards[message.id].task.pr_url" :href="cards[message.id].task.pr_url" target="_blank" rel="noopener">View PR</a>
            </div>
            <div v-if="cards[message.id].preview" class="ai-preview">
              <Icon icon="lucide:monitor-play" aria-hidden="true" />
              <span class="ai-preview-text">The app is running on port {{ cards[message.id].preview.port }}</span>
              <button type="button" class="ai-preview-open" :disabled="cards[message.id].preview.opening" @click="openPreview(cards[message.id])">
                {{ cards[message.id].preview.opening ? 'Opening…' : 'Open preview' }}
              </button>
              <span v-if="cards[message.id].preview.error" class="ai-preview-err" role="alert">{{ cards[message.id].preview.error }}</span>
            </div>
          </div>
        </template>
      </ChatMessageList>
      <HITLModal v-if="chat.hitlRequests.length" inline :requests="chat.hitlRequests" show-stop
                 @respond="chat.respondHitl" @dismiss="chat.dismissHitl" @skip="chat.skipHitl" @stop="chat.stop" />
    </div>

    <PermissionCard :requests="permissionRequests" @respond="onPermissionRespond" />

    <div class="uac-composer">
      <div class="uac-box" :class="{ focused }">
        <div class="uac-box-top">
          <label class="sr-only" for="uac-input">Message the coding agent</label>
          <textarea
            id="uac-input" ref="inputEl" v-model="input" :disabled="!crsReady"
            :placeholder="crsReady ? 'Describe a change or ask about the code' : 'Preparing the project'"
            rows="1" @input="autoGrow" @keydown="onKeydown" @focus="focused = true" @blur="focused = false"
          ></textarea>
          <!-- Mic: needs an Audio-transcription model; dimmed otherwise, click explains. -->
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
            <!-- The same pick as the main chat for a shared agent: the person's own model for the Coding Agent. -->
            <AgentModelPicker v-if="agentId" :agent-id="agentId" />
          </div>
          <button v-if="chat.isBusy" type="button" class="uac-circle stop" title="Stop" aria-label="Stop" @click="chat.stop()">
            <Icon icon="lucide:square" />
          </button>
          <button
            v-else type="button" class="uac-circle send" title="Send" aria-label="Send"
            :disabled="!input.trim() || !crsReady || !agentId" @click="send()"
          >
            <Icon icon="lucide:arrow-up" />
          </button>
        </div>
      </div>
      <div class="uac-hint">
        <span class="uac-conn" :class="{ on: !chat.connectionLost }"><span class="uac-conn-dot" aria-hidden="true"></span>{{ chat.connectionLost ? 'Reconnecting' : 'Connected' }}</span>
        <span>Enter to send, Shift+Enter for a new line</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useVoiceInput } from '@/composables/useVoiceInput'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { usePermission } from '@/composables/usePermission'
import { useChatStore } from '@/stores/useChatStore'
import ChatMessageList from '@/components/chat/ChatMessageList.vue'
import HITLModal from '@/components/HITLModal.vue'
import PermissionCard from '@/components/letscode/PermissionCard.vue'
import ProposedChangesCard from '@/components/letscode/ProposedChangesCard.vue'
import AgentModelPicker from '@/components/agent/AgentModelPicker.vue'

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
  crsReady: { type: Boolean, default: false },
})
const emit = defineEmits(['changed', 'proposal', 'activity'])

const chat = useChatStore()
const input = ref('')
const agentId = ref('')           // the shared Coding Agent (from unified-config)
const scrollEl = ref(null)
const inputEl = ref(null)
const focused = ref(false)
const historyOpen = ref(false)
const loadingHistory = ref(false)
const conversations = ref([])
// Let's Code's cards, by the assistant message they belong to: { task, busy, exporting, resolved, preview }.
const cards = reactive({})
const activity = []
const lastUserPrompt = ref('')

// What the main chat held before this page took the shared chat over; given back when the page closes.
let previous = null

const voice = useVoiceInput({
  agentId: () => agentId.value || null,
  conversationId: () => chat.conversationId,
  getDraft: () => input.value,
  onTranscript: (text) => { input.value = text; nextTick(() => { autoGrow(); send() }) },
})

const { permissionRequests, handlePermissionEvent, respondPermission } =
  usePermission((obj) => chat.sendRaw(obj), () => chat.conversationId)

function lastAssistantId() {
  for (let i = chat.messages.length - 1; i >= 0; i--) if (chat.messages[i].role === 'assistant') return chat.messages[i].id
  return null
}
function cardFor(id) {
  if (id == null) return null
  if (!cards[id]) cards[id] = { task: null, busy: false, exporting: false, resolved: '', preview: null }
  return cards[id]
}
function cardByDiff(diffId) {
  return Object.values(cards).find((c) => c.task && c.task.proposed_diff_id === diffId) || null
}

// Frames only a project turn sends. Everything else (the stream, the steps, approvals) is the shared chat's.
function onProjectFrame(d) {
  const t = d?.type
  if (handlePermissionEvent(d)) { scrollDown(); return true }
  if (t === 'tool_result') {
    // The Activity tab beside the editor lists the turn's steps in words; the chat still draws the frame.
    if (d.label) { activity.push(d.label); emit('activity', activity.slice()) }
    return false
  }
  if (t === 'lets_code_preview') {
    const c = cardFor(lastAssistantId())
    if (c) c.preview = { port: d.port, opening: false, error: '' }
    scrollDown(); return true
  }
  if (t === 'proposed_diff') {
    const c = cardFor(lastAssistantId())
    if (c) {
      c.task = { proposed_diff_id: d.proposed_diff_id, diff_text: d.diff_text || '', diff_summary: d.diff_summary || {},
                 export_enabled: d.can_export !== false, pr_url: '' }
      emit('proposal', c.task)
    }
    scrollDown(); return true
  }
  if (t === 'proposed_diff_updated') {
    const c = cardByDiff(d.proposed_diff_id)
    if (c) { c.task.diff_text = d.diff_text || ''; c.task.diff_summary = d.diff_summary || {}; c.busy = false; emit('proposal', c.task) }
    emit('changed'); return true
  }
  if (t === 'proposed_diff_resolved') {
    const c = cardByDiff(d.proposed_diff_id)
    if (c) {
      c.busy = false; c.exporting = false; c.resolved = d.outcome
      if (d.pr_url) c.task.pr_url = d.pr_url
      if (d.outcome === 'discarded') c.task = { ...c.task, diff_text: '', diff_summary: {} }
    }
    if (d.outcome === 'error') notify.error(d.error || 'Diff action failed')
    else notify.success(`Change ${d.outcome}`)
    emit('proposal', null); emit('changed'); return true
  }
  return false
}

async function send(text) {
  const msg = (text != null ? text : input.value).trim()
  if (!msg || !props.crsReady || !agentId.value) return
  lastUserPrompt.value = msg
  activity.length = 0
  input.value = ''
  nextTick(autoGrow)
  if (!(await chat.sendMessage(msg))) input.value = msg      // not sent: the words stay in the box
  scrollDown()
}

function onPermissionRespond({ card, choice }) {
  const decided = respondPermission(card, choice)
  // A reveal_secret card is answered inline by the backend; re-sending would ask again or answer twice.
  if (card?.capability === 'reveal_secret') return
  if (String(decided).startsWith('allow') && lastUserPrompt.value) chat.sendMessage(lastUserPrompt.value)
}

function scrollDown() { nextTick(() => { const el = scrollEl.value; if (el) el.scrollTop = el.scrollHeight }) }
watch(() => [chat.messages.length, chat.messages.at(-1)?.content, chat.hitlRequests.length], scrollDown)

function autoGrow() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}
function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send() }
}

function newChat() {
  if (chat.isBusy) chat.stop()
  chat.reset()
  for (const k of Object.keys(cards)) delete cards[k]
  historyOpen.value = false
  nextTick(() => inputEl.value && inputEl.value.focus())
}
async function loadHistory() {
  loadingHistory.value = true
  try {
    const { data } = await api.getConversations({ repository: props.repoId })
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
  if (String(c.id) === String(chat.conversationId)) return
  for (const k of Object.keys(cards)) delete cards[k]
  await chat.openConversation(c.id)
  chat.repoId = Number(props.repoId)                     // a chat of this project stays on this project's socket
  if (agentId.value) chat.selectedAgentId = String(agentId.value)
  scrollDown()
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

// ── diff card actions → the project socket ──
function onKeep(c) { c.busy = true; chat.sendRaw({ type: 'diff_accept', proposed_diff_id: c.task.proposed_diff_id }) }
function onDiscard(c) { c.busy = true; chat.sendRaw({ type: 'diff_discard', proposed_diff_id: c.task.proposed_diff_id }) }
function onRevertFile(c, path) { c.busy = true; chat.sendRaw({ type: 'diff_revert_file', proposed_diff_id: c.task.proposed_diff_id, path }) }
function onRevertHunk(c, payload) {
  c.busy = true
  chat.sendRaw({ type: 'diff_revert_hunk', proposed_diff_id: c.task.proposed_diff_id, path: payload.path, hunk: payload.h ?? payload.hunk })
}
function onExport(c) { c.exporting = true; chat.sendRaw({ type: 'diff_export', proposed_diff_id: c.task.proposed_diff_id }) }
async function onCopy(c) {
  try { await navigator.clipboard.writeText(c.task.diff_text || ''); notify.success('Patch copied') }
  catch { notify.error('Could not copy') }
}
function resolvedLabel(c) {
  return { accepted: 'Kept locally', discarded: 'Discarded', exported: 'PR opened', error: 'Action failed' }[c.resolved] || c.resolved
}

async function openPreview(c) {
  // Opened before the request so the browser treats it as the click's own window, not a popup.
  const win = window.open('', '_blank')
  if (win) win.opener = null
  c.preview.opening = true; c.preview.error = ''
  try {
    const { data } = await api.getProjectPreview(props.repoId, c.preview.port)
    if (win) win.location.href = data.url
    else window.open(data.url, '_blank', 'noopener')
  } catch (e) {
    if (win) win.close()
    c.preview.error = e?.response?.data?.error || 'The preview could not be opened. Try again.'
  } finally {
    c.preview.opening = false
  }
}

async function loadAgent() {
  try {
    const { data } = await api.unifiedConfig(props.systemId)
    if (data?.agent_id) {
      agentId.value = String(data.agent_id)
      chat.setAgent(agentId.value)          // also warms the agent on the project's socket
    }
  } catch (e) { /* Send stays disabled until the agent is known */ }
}

onMounted(() => {
  previous = { repoId: chat.repoId, agentId: chat.selectedAgentId }
  chat.reset()
  chat.repoId = Number(props.repoId)
  chat.newChatRepoId = Number(props.repoId)
  chat.surfaceHandler = onProjectFrame
  loadAgent()
})
onBeforeUnmount(() => {
  if (chat.surfaceHandler === onProjectFrame) chat.surfaceHandler = null
  chat.newChatRepoId = null
  chat.reset()
  // Give the main chat back what it had: its own socket endpoint and agent.
  if (previous) { chat.repoId = previous.repoId || 0; if (previous.agentId) chat.selectedAgentId = previous.agentId }
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
.uac-hbtn:focus-visible, .uac-circle:focus-visible, .uac-mic:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
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

/* ── The conversation: the shared transcript, fitted to this narrow side panel (as Video Studio does) ── */
.uac-stream { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 12px; display: flex; flex-direction: column; gap: 12px; overflow-wrap: anywhere; }
.uac-empty { margin: auto; text-align: center; color: var(--vm-ink-soft); max-width: 320px; font-size: 13.5px; line-height: 1.5; }
.uac-empty :deep(svg) { width: 24px; height: 24px; margin-bottom: 8px; color: var(--vm-violet); }
.uac-stream :deep(.msg-list-inner) { padding: 0 0 8px; }
.uac-stream :deep(.msg) { max-width: none; margin: 0 0 14px; padding: 0; gap: 8px; }
.uac-stream :deep(.avatar) { width: 22px; height: 22px; }
.uac-stream :deep(.user-col) { max-width: 92%; }
.uac-stream :deep(.bubble.user) { padding: 9px 12px; font-size: 13px; line-height: 1.6; }
.uac-stream :deep(.bubble.assistant) { font-size: 13.5px; line-height: 1.6; }
.uac-stream :deep(.hitl-overlay--inline) { position: static; display: block; padding: 0; background: transparent; }
.uac-stream :deep(.hitl-modal) { width: 100%; min-width: 0; max-height: none; }

.uac-cards { display: flex; flex-direction: column; gap: 8px; margin: -6px 0 14px 30px; }
.ai-resolved { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--vm-ink-soft); }
.ai-resolved :deep(svg) { width: 14px; height: 14px; }
.ai-resolved a { color: var(--vm-violet); margin-left: 6px; }
.ai-preview { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--vm-line); border-radius: 10px; background: var(--vm-surface); font-size: 12.5px; color: var(--vm-ink-soft); }
.ai-preview :deep(svg) { width: 15px; height: 15px; color: var(--vm-violet); flex: 0 0 auto; }
.ai-preview-text { flex: 1 1 auto; min-width: 0; }
.ai-preview-open { min-height: 32px; padding: 0 12px; border: none; border-radius: 8px; background: var(--vm-violet); color: var(--uac-on-solid); font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: filter .15s; }
.ai-preview-open:hover:not(:disabled) { filter: brightness(1.08); }
.ai-preview-open:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.ai-preview-open:disabled { opacity: .6; cursor: progress; }
.ai-preview-err { flex-basis: 100%; color: var(--vm-red-ink); }

/* ── Composer ── */
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
  .uac-hint > span:last-child { display: none; }
  .uac-box-top textarea { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .uac-mic.live, .uac-mic.busy { animation: none; }
}
</style>
