<!-- Connector actions under an agent's reply — Connect / Sign in again / Assign to this agent / Set up.

     The backend's CONNECT_SERVICE decides WHICH action applies (agentic-docs/CONNECTOR_ACCESS_IN_CHAT_PLAN.md
     in the backend repo) and sends it as a typed `chat_action`; this only renders it. A click goes to
     POST /api/chat/connector-action/, which RE-CHECKS the state server-side, so a stale button in history
     answers "already done" instead of repeating an old decision. "Set up" is a plain link to the Connectors
     page — a connector that needs a key is never set up in chat.

     Non-blocking by design: the run has already finished its turn. When the action completes and this is the
     latest reply, a short continuation is sent so the agent picks the original request back up — also after a
     reload, a switch to another chat, or a phone unloading the tab while the provider's page was open: a
     started sign-in is remembered in this browser until it lands (or expires), and exactly one open page
     continues the chat. -->
<template>
  <div v-if="actions.length" class="ca-list">
    <!-- One card per connector: its logo and name, what it is for, and the one thing to do (owner, 2026-10-26:
         "show nicely with connector name, logo and connect button" instead of a bare button). -->
    <section v-for="a in actions" :key="keyOf(a)" class="ca-card" :class="{ 'is-done': stateOf(a).phase === 'done' }"
             :aria-label="`${a.service} connector`">
      <div class="ca-main">
        <span class="ca-logo" aria-hidden="true">
          <Icon v-if="isIconify(a.icon)" :icon="a.icon" class="ca-logo-icon" />
          <template v-else>{{ initialOf(a) }}</template>
        </span>
        <div class="ca-text">
          <p class="ca-name">{{ a.service }}</p>
          <p class="ca-desc">{{ captionOf(a) }}</p>
        </div>

        <!-- done -->
        <span v-if="stateOf(a).phase === 'done'" class="ca-done-pill" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" /></svg>
          {{ a.kind === 'assign' ? 'Assigned' : 'Connected' }}
        </span>

        <!-- a key or headers are needed: the Connectors page, never the chat -->
        <router-link v-else-if="a.kind === 'setup'" :to="a.connectors_url || '/dashboard/connectors'" class="ca-btn">
          Set up
        </router-link>

        <!-- the user can't change this agent: no button, the owner does it (said below) -->
        <template v-else-if="needsOwner(a)" />

        <button
          v-else
          type="button"
          class="ca-btn primary"
          :disabled="busy(a)"
          :aria-label="a.label || buttonLabel(a)"
          @click="run(a)"
        >
          <span v-if="busy(a)" class="ca-spin" aria-hidden="true"></span>
          {{ shortLabel(a) }}
        </button>
      </div>

      <p v-if="stateOf(a).phase === 'done'" class="ca-foot ok ca-done" role="status">{{ stateOf(a).message }}</p>
      <p v-else-if="a.kind === 'setup'" class="ca-foot ca-hint">Add it on the Connectors page, then ask again.</p>
      <p v-else-if="needsOwner(a)" class="ca-foot ca-owner">
        Ask the owner of {{ a.agent_name || 'this agent' }} to assign {{ a.service }} to it.
        <router-link :to="a.connectors_url || '/dashboard/connectors'" class="ca-link">Open Connectors</router-link>
      </p>
      <p v-else-if="stateOf(a).phase === 'waiting'" class="ca-foot ca-hint">
        Finish signing in to {{ a.service }} in the window that opened.
        <button type="button" class="ca-textbtn" @click="reopen(a)">Open it again</button>
      </p>
      <p v-else-if="stateOf(a).error" class="ca-foot err ca-err" role="alert">{{ stateOf(a).error }}</p>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'
import { useChatStore } from '../../stores/useChatStore'

const props = defineProps({
  message: { type: Object, required: true },
})

const chat = useChatStore()
const KINDS = ['assign', 'connect', 'setup']
const actions = computed(() => (Array.isArray(props.message.chatActions) ? props.message.chatActions : [])
  .filter((a) => a && KINDS.includes(a.kind)))

// Per-action UI state, keyed by action id: phase idle | starting | waiting | done, plus message/error, and —
// once a sign-in has started — `since` (when) and `target` (the real connector: a custom MCP server only
// gets one when the click adds it).
const ui = reactive({})
const timers = {}
const ticks = {}
const popupUrls = {}

const POLL_MS = 2000
// From the CLICK, not from when this page started watching: the OAuth state expires after 10 minutes and an
// MCP server syncs its tools after that, so a sign-in finished in time can take a little longer to land.
const POLL_LIMIT_MS = 15 * 60 * 1000

// A STARTED SIGN-IN SURVIVES THE PAGE. The chat continues once the sign-in lands — but a reload, switching
// chats, or a phone unloading the chat tab while the provider's page is open used to lose the waiting, and the
// user had to type "continue" themselves. The click is remembered in this browser (per viewer, never
// authoritative — the server re-checks everything), so a returning page resumes waiting and continues.
const PENDING_PREFIX = 'aadml:connect:'

const keyOf = (a) => a.id || `${a.kind}:${a.target_kind}:${a.target_id}:${a.url || ''}`
function stateOf(a) {
  const k = keyOf(a)
  if (!ui[k]) ui[k] = { phase: 'idle', message: '', error: '', since: '', target: null }
  return ui[k]
}
const busy = (a) => ['starting', 'waiting'].includes(stateOf(a).phase)

function savePending(a, rec) {
  try { localStorage.setItem(PENDING_PREFIX + keyOf(a), JSON.stringify(rec)) } catch { /* storage off */ }
}
function loadPending(a) {
  try {
    const raw = localStorage.getItem(PENDING_PREFIX + keyOf(a))
    if (!raw) return null
    const rec = JSON.parse(raw)
    if (!rec || !rec.startedAt || Date.now() - rec.startedAt > POLL_LIMIT_MS) {
      localStorage.removeItem(PENDING_PREFIX + keyOf(a))
      return null
    }
    return rec
  } catch { return null }
}
// Read-and-remove: whichever open page gets here first continues the chat, so two tabs on one conversation
// never both send the continuation.
function takePending(a) {
  const rec = loadPending(a)
  if (rec) { try { localStorage.removeItem(PENDING_PREFIX + keyOf(a)) } catch { /* storage off */ } }
  return rec
}

// Assigning — directly, or as the auto-assign a connect promises — needs edit rights on the agent.
const needsOwner = (a) => a.can_edit === false && (a.kind === 'assign' || !!a.auto_assign)

// The connector's own icon, as the Connectors page draws it (an Iconify name like `logos:google-drive`);
// anything else gets the first letter of its name.
const isIconify = (icon) => typeof icon === 'string' && icon.includes(':')
const initialOf = (a) => (a.service || '?').trim().charAt(0).toUpperCase()

// The line under the name: why the card is here when that is not plain "connect", else the connector's
// own description.
function captionOf(a) {
  if (a.kind === 'assign') return `Connected, but not assigned to ${a.agent_name || 'this agent'}.`
  if (a.kind === 'setup') return 'Needs a key or settings before it can be used.'
  if (a.reauthorize || a.reconnect) return 'Your sign-in has expired.'
  return a.description || 'Connect your account to continue.'
}

// The card already names the connector, so the button says only what it does.
function shortLabel(a) {
  const s = stateOf(a)
  if (s.phase === 'starting') return a.kind === 'assign' ? 'Assigning…' : 'Opening…'
  if (s.phase === 'waiting') return 'Waiting…'
  if (a.kind === 'assign') return 'Assign'
  if (a.reauthorize || a.reconnect) return 'Sign in again'
  return 'Connect'
}

function buttonLabel(a) {
  const s = stateOf(a)
  if (s.phase === 'starting') return a.kind === 'assign' ? 'Assigning…' : 'Opening sign-in…'
  if (s.phase === 'waiting') return `Waiting for ${a.service}…`
  return a.label || (a.kind === 'assign' ? `Assign ${a.service} to this agent` : `Connect ${a.service}`)
}

// Identifies the connector for the endpoint. A custom MCP server is named by its address until the click
// adds it; after that the server-side connector the response named is used.
function params(a) {
  const t = stateOf(a).target
  const base = {
    agent_id: a.agent_id,
    conversation_id: a.conversation_id || props.message.conversationId || chat.conversationId || '',
  }
  if (t) return { ...base, target_kind: t.target_kind, target_id: t.target_id }
  if (a.target_kind === 'mcp_url') return { ...base, target_kind: 'mcp_url', url: a.url }
  return { ...base, target_kind: a.target_kind, target_id: a.target_id }
}

function doneText(a, st) {
  const agent = a.agent_name || 'this agent'
  if (a.kind === 'assign') return `${a.service} is assigned to ${agent}.`
  if (a.reauthorize) return `You're signed in to ${a.service} again.`
  return st && st.assigned && a.auto_assign
    ? `${a.service} is connected and assigned to ${agent}.`
    : `${a.service} is connected.`
}

// `viaSignIn`: the sign-in this button started has landed. Only the page that claims the remembered sign-in
// continues the chat (see takePending); a direct result (an assign, an "already done") continues at once.
function finish(a, st, { viaSignIn = false } = {}) {
  const s = stateOf(a)
  stopPoll(a)
  s.phase = 'done'
  s.error = ''
  s.message = doneText(a, st)
  if (viaSignIn && !takePending(a)) return
  continueConversation(a)
}

// Resume the original request — only from the LATEST reply, and never on top of a running turn. An old
// button clicked from history just shows its ✓. A page that has just loaded may still be rejoining a turn,
// so a busy chat is waited out briefly rather than skipped.
let unmounted = false
function continueConversation(a, attempt = 0) {
  if (unmounted) return
  const last = [...chat.messages].reverse().find((m) => m.role === 'assistant')
  if (!last || last.id !== props.message.id) return
  if (chat.isStreaming) {
    if (attempt < 15) setTimeout(() => continueConversation(a, attempt + 1), POLL_MS)
    return
  }
  const what = a.kind === 'assign' ? `I've assigned ${a.service} to this agent.`
    : a.reauthorize ? `I've signed in to ${a.service} again.`
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
    const body = { action: a.kind, ...params(a) }
    if (a.reauthorize) body.reauthorize = true
    const { data } = await api.connectorAction(body)
    if (data.target_kind && data.target_id != null) {
      s.target = { target_kind: data.target_kind, target_id: data.target_id }
    }
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
      s.since = data.since || ''
      if (popup && !popup.closed) popup.location.href = data.authorize_url
      else if (!window.open(data.authorize_url, '_blank')) {
        s.phase = 'idle'
        s.error = 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
        return
      }
      const startedAt = Date.now()
      savePending(a, { startedAt, since: s.since, target: s.target, autoAssign: !!data.auto_assign,
                       authorizeUrl: data.authorize_url })
      s.phase = 'waiting'
      startPoll(a, !!data.auto_assign, startedAt)
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

function startPoll(a, autoAssign, startedAt = Date.now(), { now = false } = {}) {
  stopPoll(a)
  const k = keyOf(a)
  const tick = async () => {
    const s = stateOf(a)
    if (s.phase !== 'waiting') return
    if (Date.now() - startedAt > POLL_LIMIT_MS) {
      s.phase = 'idle'
      s.error = `Signing in to ${a.service} timed out. Try again.`
      stopPoll(a)
      takePending(a)
      return
    }
    try {
      const q = { ...params(a) }
      if (s.since) q.since = s.since
      const { data } = await api.connectorActionStatus(q)
      // Signing in AGAIN: the connector was connected all along, so only a sign-in newer than the click
      // counts. Otherwise connected is enough when the agent already held the connector; a promised
      // auto-assign must land too (it runs after the MCP tool sync, a few seconds after the redirect).
      const ok = a.reauthorize ? !!data.renewed : (data.connected && (data.assigned || !autoAssign))
      if (ok) { finish(a, data, { viaSignIn: true }); return }
    } catch { /* transient — keep waiting */ }
    if (stateOf(a).phase === 'waiting' && ticks[k]) timers[k] = setTimeout(tick, POLL_MS)
  }
  ticks[k] = tick
  timers[k] = setTimeout(tick, now ? 0 : POLL_MS)
}

function stopPoll(a) {
  const k = keyOf(a)
  if (timers[k]) { clearTimeout(timers[k]); delete timers[k] }
  delete ticks[k]
}

// Back from the provider's tab: look now instead of up to two seconds later (a phone also throttles timers
// in a hidden tab, so the next scheduled look may be much later than that).
function onVisible() {
  if (document.visibilityState !== 'visible') return
  for (const [k, tick] of Object.entries(ticks)) {
    if (timers[k]) clearTimeout(timers[k])
    timers[k] = setTimeout(tick, 0)
  }
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisible)
  for (const a of actions.value) {
    // A sign-in this browser started from this button and has not seen land: keep waiting for it, and
    // continue the chat when it does — whether it landed while the page was gone or lands now.
    const rec = loadPending(a)
    if (rec) {
      const s = stateOf(a)
      s.since = rec.since || ''
      s.target = rec.target || null
      s.phase = 'waiting'
      if (rec.authorizeUrl) popupUrls[keyOf(a)] = rec.authorizeUrl
      startPoll(a, !!rec.autoAssign, rec.startedAt, { now: true })
      continue
    }
    // A reloaded thread: a button whose job is already done shows its ✓ instead of inviting a repeat
    // click. Not for "sign in again" (its connector is connected by definition) nor a custom MCP server
    // the click has not added yet (there is nothing to ask about).
    if (needsOwner(a) || a.reauthorize || a.target_kind === 'mcp_url') continue
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

onUnmounted(() => {
  unmounted = true
  document.removeEventListener('visibilitychange', onVisible)
  for (const k of Object.keys(timers)) clearTimeout(timers[k])
})
</script>

<style scoped>
/* A connector card, in the Connectors page's language: white surface, slate border, violet action. */
.ca-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; max-width: 520px; }

.ca-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 12px 12px 12px 14px; border-radius: 14px;
  background: #fff; border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
.ca-card.is-done { border-color: #bbf7d0; background: #f0fdf4; }

.ca-main { display: flex; align-items: center; gap: 12px; min-width: 0; }

.ca-logo {
  width: 40px; height: 40px; flex: none; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  background: #f8fafc; border: 1px solid #e2e8f0;
  font-size: 1rem; font-weight: 700; color: #475569;
}
.ca-logo-icon { width: 22px; height: 22px; }

.ca-text { flex: 1; min-width: 0; }
.ca-name { margin: 0; font-size: .875rem; font-weight: 600; color: #0f172a; line-height: 1.35; }
.ca-desc {
  margin: 2px 0 0; font-size: .78rem; color: #475569; line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.ca-btn {
  flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  min-height: 36px; padding: 0 16px; border-radius: 10px;
  border: 1px solid #c7d2fe; background: #eef2ff; color: #4338ca;
  font-size: .82rem; font-weight: 600; line-height: 1; white-space: nowrap;
  cursor: pointer; text-decoration: none;
  transition: background-color .15s, border-color .15s, box-shadow .15s;
}
.ca-btn:hover:not(:disabled) { background: #e0e7ff; border-color: #a5b4fc; }
.ca-btn.primary { background: var(--vm-violet-d, #4f46e5); border-color: var(--vm-violet-d, #4f46e5); color: #fff; }
.ca-btn.primary:hover:not(:disabled) { background: #4338ca; border-color: #4338ca; box-shadow: 0 2px 8px rgba(79, 70, 229, .25); }
.ca-btn:disabled { opacity: .8; cursor: default; }
.ca-btn:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; }

.ca-spin {
  width: 13px; height: 13px; border-radius: 50%; flex: none;
  border: 2px solid currentColor; border-right-color: transparent;
  animation: ca-rot .8s linear infinite;
}
@keyframes ca-rot { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ca-spin { animation: none; } }

.ca-done-pill {
  flex: none; display: inline-flex; align-items: center; gap: 5px;
  min-height: 30px; padding: 0 12px; border-radius: 999px;
  background: #dcfce7; color: #047857; font-size: .78rem; font-weight: 600;
}
.ca-done-pill svg { width: 14px; height: 14px; }

.ca-foot { margin: 0; padding-left: 52px; font-size: .78rem; color: #475569; line-height: 1.45; }
.ca-foot.ok { color: #047857; }
.ca-foot.err { color: #b91c1c; }
.ca-textbtn {
  border: 0; background: none; padding: 0; margin-left: 4px;
  color: var(--vm-violet-d, #4f46e5); font: inherit; font-weight: 600; cursor: pointer;
}
.ca-textbtn:hover { text-decoration: underline; }
.ca-textbtn:focus-visible, .ca-link:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; border-radius: 4px; }
.ca-link { margin-left: 6px; color: var(--vm-violet-d, #4f46e5); font-weight: 600; text-decoration: none; }
.ca-link:hover { text-decoration: underline; }

/* Phone width: the action moves under the text, full width and a comfortable tap target. */
@media (max-width: 480px) {
  .ca-main { flex-wrap: wrap; }
  .ca-text { flex-basis: calc(100% - 52px); }
  .ca-btn { width: 100%; min-height: 44px; }
  .ca-foot { padding-left: 0; }
}
</style>
