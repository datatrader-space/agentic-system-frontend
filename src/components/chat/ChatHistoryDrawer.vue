<template>
  <!-- Scrim: mobile only. On desktop the drawer is non-modal (the chat stays readable) and an
       outside click still collapses it — the ChatGPT/Notion side-panel convention. -->
  <div v-if="open" class="chd-scrim" aria-hidden="true" @click="$emit('close')"></div>

  <aside
    ref="rootEl"
    class="chd"
    :class="{ open }"
    role="complementary"
    aria-label="Chat history"
    :aria-hidden="!open"
    :inert="!open || undefined"
  >
    <header class="chd-head">
      <div class="chd-head-text">
        <h3>Chat history</h3>
        <!-- Always name the scope: the list is agent-scoped by default, so whose history this is
             must be readable at a glance, never inferred from the rows. -->
        <span v-if="scope === 'agent'" class="chd-chip" :title="agentLabel">
          <span class="chd-chip-dot" aria-hidden="true"></span>{{ agentLabel }}
        </span>
        <span v-else class="chd-chip all">All agents</span>
      </div>
      <button class="chd-x" type="button" aria-label="Close chat history" @click="$emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" /></svg>
      </button>
    </header>

    <div class="chd-controls">
      <!-- Scope switch. Agent-scoped by default; "All agents" is an explicit, remembered widening. -->
      <div class="chd-seg" role="tablist" aria-label="History scope">
        <button type="button" role="tab" :aria-selected="scope === 'agent'"
                :class="{ on: scope === 'agent' }" :disabled="!chat.selectedAgentId"
                @click="setScope('agent')">This agent</button>
        <button type="button" role="tab" :aria-selected="scope === 'all'"
                :class="{ on: scope === 'all' }" @click="setScope('all')">All agents</button>
      </div>

      <label class="chd-search">
        <span class="sr-only">Search chats</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" stroke-linecap="round" /></svg>
        <input ref="searchEl" v-model="query" type="search"
               :placeholder="scope === 'agent' ? 'Search this agent’s chats…' : 'Search all chats…'" />
        <button v-if="query" class="chd-clear" type="button" aria-label="Clear search" @click="query = ''">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" /></svg>
        </button>
      </label>

      <button class="chd-new" type="button" @click="$emit('new-chat')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14m-7-7h14" stroke-linecap="round" /></svg>
        New chat
      </button>
    </div>

    <div class="chd-list">
      <!-- Skeletons rather than a blank panel: the list is the whole point of the drawer. -->
      <div v-if="loading" class="chd-skel" aria-live="polite" aria-busy="true">
        <span class="sr-only">Loading chats…</span>
        <div v-for="i in 5" :key="i" class="chd-skel-row"><i></i><i class="short"></i></div>
      </div>

      <p v-else-if="!groups.length" class="chd-empty">{{ emptyText }}</p>

      <section v-for="grp in groups" :key="grp.label">
        <h4>{{ grp.label }}</h4>
        <button
          v-for="s in grp.items"
          :key="s.id"
          type="button"
          class="chd-row"
          :class="{ on: String(activeId) === String(s.id) }"
          :aria-current="String(activeId) === String(s.id) ? 'true' : undefined"
          @click="$emit('select', s.id)"
        >
          <span class="chd-row-text">
            <span class="chd-row-title">{{ previewOf(s) }}</span>
            <!-- Only meaningful across agents — inside one agent it's the same name on every row. -->
            <small v-if="scope === 'all'" class="chd-row-agent">{{ agentOf(s) }}</small>
          </span>
          <small class="chd-row-time">{{ relTime(s) }}</small>
        </button>
      </section>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useChatStore } from '../../stores/useChatStore'
import { previewOf, agentOf, relTime, groupSessions } from '../../composables/useChatHistory'

const props = defineProps({
  open: { type: Boolean, default: false },
  activeId: { type: [String, Number], default: null },
})
const emit = defineEmits(['close', 'select', 'new-chat'])

const chat = useChatStore()
const rootEl = ref(null)
const searchEl = ref(null)
const query = ref('')

// Scope preference is sticky per browser — someone who deliberately widened to "All agents"
// shouldn't have to re-pick it every time they open the drawer.
const SCOPE_KEY = 'chat.historyScope'
const scope = ref(localStorage.getItem(SCOPE_KEY) === 'all' ? 'all' : 'agent')

const agentLabel = computed(() => {
  // currentAgent only resolves for agents in the workspace-scoped list; fall back to the name the
  // conversation rows carry so cross-workspace agents still get a real label.
  const fromStore = chat.currentAgent && chat.currentAgent.name
  const fromRow = chat.sessions.length && (chat.sessions[0].agent_profile_name || chat.sessions[0].agent_name)
  return fromStore || fromRow || 'This agent'
})

const sourceList = computed(() => (scope.value === 'agent' ? chat.sessions : chat.allSessions))
const loading = computed(() =>
  scope.value === 'agent'
    ? chat.sessionsLoading && !chat.sessions.length
    : chat.allSessionsLoading && !chat.allSessions.length
)
const emptyText = computed(() => {
  if (query.value.trim()) return 'No chats match your search.'
  if (scope.value === 'agent') return `No chats with ${agentLabel.value} yet.`
  return 'No chats yet.'
})

const groups = computed(() => {
  const q = query.value.trim().toLowerCase()
  return groupSessions(sourceList.value)
    .map((grp) => ({
      ...grp,
      items: grp.items.filter((s) => (q ? `${previewOf(s)} ${agentOf(s)}`.toLowerCase().includes(q) : true)),
    }))
    .filter((grp) => grp.items.length)
})

function load() {
  if (scope.value === 'agent') chat.loadSessions()
  else chat.loadAllSessions()
}

function setScope(next) {
  if (scope.value === next) return
  scope.value = next
  localStorage.setItem(SCOPE_KEY, next)
  load()
}

// ── Open / close ────────────────────────────────────────────────────────────────────────────────
// The drawer stays mounted (it slides, it doesn't pop), so opening is what triggers a fetch.
let _restoreFocus = null
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    _restoreFocus = document.activeElement
    query.value = ''
    // No agent resolved yet (brand-new session before agents load) → fall back to the global list.
    if (scope.value === 'agent' && !chat.selectedAgentId) scope.value = 'all'
    load()
    nextTick(() => searchEl.value && searchEl.value.focus())
  } else if (_restoreFocus && typeof _restoreFocus.focus === 'function') {
    _restoreFocus.focus()          // hand focus back to the trigger, not to <body>
    _restoreFocus = null
  }
}, { immediate: true })

// Re-fetch when the agent changes while open (switching agent on the welcome screen, or opening a
// conversation that belongs to a different agent).
watch(() => chat.selectedAgentId, () => { if (props.open) load() })

// ── Auto-collapse ───────────────────────────────────────────────────────────────────────────────
// 1) A chat starts / a turn begins — the drawer is a navigation aid, so it gets out of the way the
//    moment the user is actually talking to the agent.
watch(() => chat.isStreaming, (streaming) => { if (streaming && props.open) emit('close') })
watch(() => chat.conversationId, (id, prev) => { if (props.open && id && id !== prev) emit('close') })
// 2) Outside click. mousedown (not click) so it closes before the click lands underneath.
function onDocDown(e) {
  if (!props.open) return
  if (e.target.closest && e.target.closest('[data-history-toggle]')) return  // trigger owns its toggle
  if (rootEl.value && !rootEl.value.contains(e.target)) emit('close')
}
// 3) Escape.
function onKey(e) { if (e.key === 'Escape' && props.open) emit('close') }

onMounted(() => {
  document.addEventListener('mousedown', onDocDown)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocDown)
  document.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

/* ── Shell ───────────────────────────────────────────────────────────────────────────────────── */
.chd {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 45;
  width: 332px;
  max-width: 88vw;
  display: flex;
  flex-direction: column;
  font-family: var(--vm-font-sans);
  background: var(--vm-glass-strong);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-left: 1px solid var(--vm-line);
  box-shadow: var(--vm-shadow-l);
  /* Collapsed: parked off-canvas and non-interactive, so it can animate instead of popping. */
  transform: translateX(100%);
  opacity: 0;
  visibility: hidden;
  transition: transform .22s var(--vm-ease2), opacity .18s var(--vm-ease2), visibility .22s;
}
.chd.open {
  transform: translateX(0);
  opacity: 1;
  visibility: visible;
}
.chd-scrim {
  position: absolute;
  inset: 0;
  z-index: 44;
  background: rgba(15, 23, 42, .28);
  animation: chd-fade .18s var(--vm-ease2);
}
@keyframes chd-fade { from { opacity: 0 } to { opacity: 1 } }
/* Desktop: non-modal panel — no scrim, the conversation stays legible next to it. */
@media (min-width: 769px) { .chd-scrim { display: none } }

/* ── Header ──────────────────────────────────────────────────────────────────────────────────── */
.chd-head {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 12px 12px 16px;
  border-bottom: 1px solid var(--vm-line);
}
.chd-head-text { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.chd-head h3 {
  margin: 0;
  font-family: var(--vm-font-display);
  font-size: .875rem;
  font-weight: 700;
  letter-spacing: -.01em;
  color: var(--vm-ink);
}
.chd-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 2px 9px;
  border-radius: 9999px;
  background: var(--vm-violet-soft);
  color: var(--vm-violet-d);
  font-size: .6875rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chd-chip.all { background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.chd-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }
.chd-x {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--vm-ink-faint);
  cursor: pointer;
  transition: background .15s var(--vm-ease2), color .15s var(--vm-ease2);
}
.chd-x:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.chd-x svg { width: 16px; height: 16px; }

/* ── Controls ────────────────────────────────────────────────────────────────────────────────── */
.chd-controls { flex: 0 0 auto; padding: 10px 12px 8px; display: flex; flex-direction: column; gap: 8px; }
.chd-seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  padding: 3px;
  border-radius: var(--vm-r);
  background: var(--vm-surface-soft);
}
.chd-seg button {
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--vm-ink-soft);
  font: 600 .75rem var(--vm-font-sans);
  cursor: pointer;
  transition: background .15s var(--vm-ease2), color .15s var(--vm-ease2), box-shadow .15s;
}
.chd-seg button:hover:not(:disabled):not(.on) { color: var(--vm-ink); }
.chd-seg button.on { background: var(--vm-surface); color: var(--vm-ink); box-shadow: var(--vm-shadow-s); }
.chd-seg button:disabled { opacity: .45; cursor: not-allowed; }

.chd-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 8px 0 10px;
  border: 1px solid var(--vm-line-2);
  border-radius: var(--vm-r);
  background: var(--vm-surface);
  color: var(--vm-ink-faint);
  transition: border-color .15s var(--vm-ease2), box-shadow .15s var(--vm-ease2);
}
.chd-search:focus-within { border-color: var(--vm-focus); box-shadow: 0 0 0 3px rgba(46, 144, 250, .16); }
.chd-search svg { width: 15px; height: 15px; flex: 0 0 auto; }
.chd-search input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--vm-ink);
  font: 500 .8125rem var(--vm-font-sans);
}
.chd-search input::placeholder { color: var(--vm-ink-faint); }
.chd-search input::-webkit-search-cancel-button { display: none; }
.chd-clear {
  width: 20px; height: 20px; flex: 0 0 auto;
  display: grid; place-items: center;
  border: 0; border-radius: 6px; background: transparent;
  color: var(--vm-ink-faint); cursor: pointer;
}
.chd-clear:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.chd-clear svg { width: 12px; height: 12px; }

.chd-new {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  border: 1px dashed var(--vm-line-2);
  border-radius: var(--vm-r);
  background: transparent;
  color: var(--vm-violet-d);
  font: 600 .8125rem var(--vm-font-sans);
  cursor: pointer;
  transition: background .15s var(--vm-ease2), border-color .15s var(--vm-ease2);
}
.chd-new:hover { background: var(--vm-violet-soft); border-color: var(--vm-violet); }
.chd-new svg { width: 15px; height: 15px; }

/* ── List ────────────────────────────────────────────────────────────────────────────────────── */
.chd-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 2px 8px 14px; }
.chd-list section + section { margin-top: 10px; }
.chd-list h4 {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0 0 2px;
  padding: 8px 6px 5px;
  /* Opaque (not the panel's glass) so rows scrolling underneath don't bleed through the label. */
  background: var(--vm-surface);
  color: var(--vm-ink-faint);
  font-size: .625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
}
.chd-row {
  position: relative;
  width: 100%;
  min-height: 40px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--vm-ink-soft);
  text-align: left;
  cursor: pointer;
  transition: background .15s var(--vm-ease2), color .15s var(--vm-ease2);
}
.chd-row:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
/* Selected row keeps FULL-STRENGTH ink on the tint: --vm-violet-d as a foreground is ~2.5:1 on the
   dark theme's surfaces. The tint + accent bar carry the selection, not the text colour. */
.chd-row.on { background: var(--vm-violet-soft); color: var(--vm-ink); font-weight: 600; }
/* Selection is marked by a bar as well as colour — colour alone is not an indicator. */
.chd-row.on::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 9px;
  bottom: 9px;
  width: 2px;
  border-radius: 2px;
  background: var(--vm-violet);
}
.chd-row-text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.chd-row-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: .8125rem;
  font-weight: 500;
}
.chd-row-agent {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: .6875rem;
  color: var(--vm-ink-faint);
}
.chd-row-time { flex: 0 0 auto; font-size: .6875rem; color: var(--vm-ink-faint); font-variant-numeric: tabular-nums; }
.chd-empty { margin: 28px 10px; text-align: center; font-size: .8125rem; color: var(--vm-ink-faint); }

.chd-skel { padding: 10px 6px; display: flex; flex-direction: column; gap: 14px; }
.chd-skel-row { display: flex; flex-direction: column; gap: 6px; }
.chd-skel-row i {
  height: 9px;
  border-radius: 5px;
  background: var(--vm-surface-soft);
  animation: chd-pulse 1.4s var(--vm-ease2) infinite;
}
.chd-skel-row i.short { width: 45%; }
@keyframes chd-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .5 } }

/* ── A11y / motion ───────────────────────────────────────────────────────────────────────────── */
.chd :focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; border-radius: 6px; }

/* The dark theme remaps surfaces but keeps the brand blue, and #1D4ED8 as a FOREGROUND is ~2.5:1 on
   #0B1220 — below the 4.5:1 floor. Lift the two accent-coloured labels on dark only. */
[data-theme="dark"] .chd-chip:not(.all),
[data-theme="dark"] .chd-new { color: #93C5FD; }
[data-theme="dark"] .chd-new:hover { border-color: #93C5FD; }

@media (max-width: 768px) {
  .chd { width: 320px; }
  /* Comfortable touch targets on small screens. */
  .chd-row { min-height: 44px; }
  .chd-seg button, .chd-search, .chd-new { height: 40px; }
}
@media (prefers-reduced-motion: reduce) {
  .chd { transition: opacity .01ms, visibility .01ms; transform: none; }
  .chd:not(.open) { transform: translateX(100%); }
  .chd-scrim { animation: none; }
  .chd-skel-row i { animation: none; }
}
</style>
