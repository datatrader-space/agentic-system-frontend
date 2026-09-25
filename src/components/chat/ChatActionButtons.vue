<!-- Connector actions under an agent's reply — Connect / Sign in again / Assign to this agent.

     The backend's CONNECT_SERVICE decides WHICH action applies (agentic-docs/CONNECTOR_ACCESS_IN_CHAT_PLAN.md
     in the backend repo) and sends it as a typed `chat_action`; this only renders it. A click goes to
     POST /api/chat/connector-action/, which RE-CHECKS the state server-side, so a stale button in history
     answers "already done" instead of repeating an old decision.

     Non-blocking by design: the run has already finished its turn. When the action completes and this is the
     latest reply, a short continuation is sent so the agent picks the original request back up. -->
<template>
  <div v-if="actions.length" class="ca-list">
    <div v-for="a in actions" :key="a.id || `${a.kind}:${a.target_kind}:${a.target_id}`" class="ca-row">
      <!-- done -->
      <p v-if="stateOf(a).phase === 'done'" class="ca-done" role="status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        {{ stateOf(a).message }}
      </p>

      <!-- the user can't change this agent: point them at the owner, no button -->
      <p v-else-if="needsOwner(a)" class="ca-owner">
        Ask the owner of {{ a.agent_name || 'this agent' }} to assign {{ a.service }} to it.
        <router-link :to="a.connectors_url || '/dashboard/connectors'" class="ca-link">Open Connectors</router-link>
      </p>

      <template v-else>
        <button
          type="button"
          class="ca-btn"
          :class="{ primary: a.kind === 'connect' }"
          :disabled="busy(a)"
          @click="run(a)"
        >
          <span v-if="busy(a)" class="ca-spin" aria-hidden="true"></span>
          <svg v-else-if="a.kind === 'assign'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke-linecap="round" /></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke-linecap="round" stroke-linejoin="round" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke-linecap="round" stroke-linejoin="round" /></svg>
          {{ buttonLabel(a) }}
        </button>
        <span v-if="stateOf(a).phase === 'waiting'" class="ca-hint">
          Finish signing in to {{ a.service }} in the window that opened.
          <button type="button" class="ca-textbtn" @click="reopen(a)">Open it again</button>
        </span>
        <span v-else-if="stateOf(a).error" class="ca-err" role="alert">{{ stateOf(a).error }}</span>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, onMounted, onUnmounted } from 'vue'
import api from '../../services/api'
import { useChatStore } from '../../stores/useChatStore'

const props = defineProps({
  message: { type: Object, required: true },
})

const chat = useChatStore()
const actions = computed(() => (Array.isArray(props.message.chatActions) ? props.message.chatActions : [])
  .filter((a) => a && (a.kind === 'assign' || a.kind === 'connect')))

// Per-action UI state, keyed by action id: phase idle | starting | waiting | done, plus message/error.
const ui = reactive({})
const timers = {}
const popupUrls = {}

const POLL_MS = 2000
const POLL_LIMIT_MS = 10 * 60 * 1000   // the OAuth state itself expires in 10 minutes

const keyOf = (a) => a.id || `${a.kind}:${a.target_kind}:${a.target_id}`
function stateOf(a) {
  const k = keyOf(a)
  if (!ui[k]) ui[k] = { phase: 'idle', message: '', error: '' }
  return ui[k]
}
const busy = (a) => ['starting', 'waiting'].includes(stateOf(a).phase)

// Assigning — directly, or as the auto-assign a connect promises — needs edit rights on the agent.
const needsOwner = (a) => a.can_edit === false && (a.kind === 'assign' || !!a.auto_assign)

function buttonLabel(a) {
  const s = stateOf(a)
  if (s.phase === 'starting') return a.kind === 'assign' ? 'Assigning…' : 'Opening sign-in…'
  if (s.phase === 'waiting') return `Waiting for ${a.service}…`
  return a.label || (a.kind === 'assign' ? `Assign ${a.service} to this agent` : `Connect ${a.service}`)
}

const params = (a) => ({
  agent_id: a.agent_id, target_kind: a.target_kind, target_id: a.target_id,
  conversation_id: a.conversation_id || props.message.conversationId || chat.conversationId || '',
})

function doneText(a, st) {
  const agent = a.agent_name || 'this agent'
  if (a.kind === 'assign') return `${a.service} is assigned to ${agent}.`
  return st && st.assigned && a.auto_assign
    ? `${a.service} is connected and assigned to ${agent}.`
    : `${a.service} is connected.`
}

function finish(a, st) {
  const s = stateOf(a)
  stopPoll(a)
  s.phase = 'done'
  s.error = ''
  s.message = doneText(a, st)
  continueConversation(a)
}

// Resume the original request — only from the LATEST reply, and never on top of a running turn. An old
// button clicked from history just shows its ✓.
function continueConversation(a) {
  const last = [...chat.messages].reverse().find((m) => m.role === 'assistant')
  if (!last || last.id !== props.message.id || chat.isStreaming) return
  const what = a.kind === 'assign'
    ? `I've assigned ${a.service} to this agent.`
    : `I've connected ${a.service}.`
  chat.sendMessage(`${what} Please continue.`)
}

async function run(a) {
  const s = stateOf(a)
  s.error = ''
  // Open the popup INSIDE the click, before any await — a window opened after a network round-trip is
  // blocked as an unsolicited popup. It is pointed at the provider once the backend returns the URL.
  const popup = a.kind === 'connect' ? window.open('', 'aadml_connect', 'width=600,height=720,scrollbars=yes') : null
  s.phase = 'starting'
  try {
    const { data } = await api.connectorAction({ action: a.kind, ...params(a) })
    if (data.status === 'done') {
      if (popup) popup.close()
      finish(a, data)
      return
    }
    if (data.status === 'needs_assign') {
      // Connected meanwhile (another tab, the Connectors page) — only the assignment is missing.
      if (popup) popup.close()
      s.phase = 'idle'
      s.error = `${a.service} is already connected — assign it to this agent instead.`
      return
    }
    if (data.status === 'authorize' && data.authorize_url) {
      popupUrls[keyOf(a)] = data.authorize_url
      if (popup && !popup.closed) popup.location.href = data.authorize_url
      else if (!window.open(data.authorize_url, '_blank')) {
        s.phase = 'idle'
        s.error = 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
        return
      }
      s.phase = 'waiting'
      startPoll(a)
      return
    }
    if (popup) popup.close()
    s.phase = 'idle'
    s.error = data.error || 'Something went wrong. Try again.'
  } catch (e) {
    if (popup) popup.close()
    s.phase = 'idle'
    const d = e?.response?.data || {}
    s.error = d.error || d.detail || (a.kind === 'assign'
      ? `Couldn't assign ${a.service}. Try again, or assign it from the agent's settings.`
      : `Couldn't start signing in to ${a.service}. Try again.`)
  }
}

function reopen(a) {
  const url = popupUrls[keyOf(a)]
  if (url) window.open(url, 'aadml_connect', 'width=600,height=720,scrollbars=yes')
}

function startPoll(a) {
  stopPoll(a)
  const k = keyOf(a)
  const began = Date.now()
  const tick = async () => {
    const s = stateOf(a)
    if (s.phase !== 'waiting') return
    if (Date.now() - began > POLL_LIMIT_MS) {
      s.phase = 'idle'
      s.error = `Signing in to ${a.service} timed out. Try again.`
      return
    }
    try {
      const { data } = await api.connectorActionStatus(params(a))
      // Connected is enough when the agent already held the connector; a promised auto-assign must land
      // too (it runs after the MCP tool sync, a few seconds after the provider redirects back).
      if (data.connected && (data.assigned || !a.auto_assign)) { finish(a, data); return }
    } catch { /* transient — keep waiting */ }
    timers[k] = setTimeout(tick, POLL_MS)
  }
  timers[k] = setTimeout(tick, POLL_MS)
}

function stopPoll(a) {
  const k = keyOf(a)
  if (timers[k]) { clearTimeout(timers[k]); delete timers[k] }
}

// A reloaded thread: a button whose job is already done shows its ✓ instead of inviting a repeat click.
onMounted(async () => {
  for (const a of actions.value) {
    if (needsOwner(a)) continue
    try {
      const { data } = await api.connectorActionStatus(params(a))
      const s = stateOf(a)
      if (s.phase === 'idle' && data.connected && data.assigned) {
        s.phase = 'done'
        s.message = doneText({ ...a, auto_assign: true }, data)
      }
    } catch { /* the button stays; a click re-checks server-side anyway */ }
  }
})

onUnmounted(() => { for (const k of Object.keys(timers)) clearTimeout(timers[k]) })
</script>

<style scoped>
.ca-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.ca-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }

.ca-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 14px; border-radius: 10px;
  border: 1px solid #c7d2fe; background: #eef2ff; color: #4338ca;
  font-size: .82rem; font-weight: 600; line-height: 1.2; cursor: pointer;
  transition: background .15s, border-color .15s, box-shadow .15s;
}
.ca-btn:hover:not(:disabled) { background: #e0e7ff; border-color: #a5b4fc; }
.ca-btn.primary { background: var(--vm-violet-d, #4f46e5); border-color: var(--vm-violet-d, #4f46e5); color: #fff; }
.ca-btn.primary:hover:not(:disabled) { background: #4338ca; border-color: #4338ca; }
.ca-btn:disabled { opacity: .75; cursor: default; }
.ca-btn:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; }
.ca-btn svg { width: 15px; height: 15px; flex: none; }

.ca-spin {
  width: 13px; height: 13px; border-radius: 50%; flex: none;
  border: 2px solid currentColor; border-right-color: transparent;
  animation: ca-rot .8s linear infinite;
}
@keyframes ca-rot { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ca-spin { animation: none; } }

.ca-hint { font-size: .78rem; color: var(--vm-text-muted, #6b7280); }
.ca-textbtn {
  border: 0; background: none; padding: 0; margin-left: 4px;
  color: var(--vm-violet-d, #4f46e5); font: inherit; font-weight: 600; cursor: pointer;
}
.ca-textbtn:hover { text-decoration: underline; }
.ca-err { font-size: .78rem; color: #b91c1c; }

.ca-done {
  display: inline-flex; align-items: center; gap: 6px; margin: 0;
  font-size: .82rem; font-weight: 600; color: #047857;
}
.ca-done svg { width: 15px; height: 15px; }

.ca-owner { margin: 0; font-size: .82rem; color: var(--vm-text-muted, #6b7280); }
.ca-link { margin-left: 6px; color: var(--vm-violet-d, #4f46e5); font-weight: 600; text-decoration: none; }
.ca-link:hover { text-decoration: underline; }
</style>
