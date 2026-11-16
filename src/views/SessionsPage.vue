<template>
  <div class="ss">
    <div class="ss-wrap">
      <header class="ss-head">
        <div class="ss-head-text">
          <h1 class="ss-title">Sessions</h1>
          <p class="ss-sub">Your agents' runs across every chat: what each is doing, and what it is waiting for.</p>
        </div>
        <span class="ss-live" :class="{ on: store.live }" role="status">
          <span class="ss-live-dot" aria-hidden="true" />{{ store.live ? 'Live' : 'Connecting…' }}
        </span>
      </header>

      <!-- WAITING FOR YOU: approvals raised for the person by a run they are not watching (an MCP client's call, a
           scheduled or background run that parked), answered here. Shown only when there is at least one. -->
      <section v-if="store.approvals.length" class="ss-wait" aria-labelledby="ss-wait-title" data-test="waiting">
        <h2 id="ss-wait-title" class="ss-wait-title">
          <Hand :size="18" :stroke-width="2" aria-hidden="true" />Waiting for you
          <span class="ss-filter-count">{{ store.approvals.length }}</span>
        </h2>
        <ul class="ss-list" aria-label="Approvals waiting for you">
          <li v-for="a in store.approvals" :key="a.id" class="ss-row is-needs_input" :data-test="`approval-${a.id}`">
            <div class="ss-row-top">
              <span class="ss-pill pill-needs_input">
                <ShieldCheck v-if="a.kind === 'tool'" :size="14" :stroke-width="2" aria-hidden="true" />
                <MessageCircleQuestion v-else :size="14" :stroke-width="2" aria-hidden="true" />
                {{ kindLabel(a) }}
              </span>
              <span class="ss-meta">
                <span class="ss-agent">{{ a.agent_name }}</span>
                <span aria-hidden="true">·</span>
                <span data-test="approval-source">{{ sourceLabel(a.source) }}</span>
                <span aria-hidden="true">·</span>
                <time :datetime="a.created_at" :title="fullTime(a.created_at)">{{ relativeTime(a.created_at) }}</time>
              </span>
            </div>
            <p class="ss-wait-summary" data-test="approval-summary">{{ a.summary }}</p>
            <p v-if="a.timeout_at" class="ss-wait-clock" data-test="approval-time-left">
              <Clock :size="14" aria-hidden="true" />{{ timeLeft(a.timeout_at) }}
            </p>
            <p v-if="store.approvalErrors[a.id]" class="ss-wait-error" role="alert" data-test="approval-error">
              <CircleAlert :size="16" aria-hidden="true" />{{ store.approvalErrors[a.id] }}
            </p>
            <div v-if="canAnswerHere(a) || a.conversation_id" class="ss-actions">
              <template v-if="canAnswerHere(a)">
                <button type="button" class="ss-btn ss-btn-primary" :disabled="!!store.approvalBusy[a.id]"
                        :aria-busy="store.approvalBusy[a.id] === 'approve'" data-test="approval-approve"
                        @click="store.answerApproval(a, true)">
                  <Check :size="16" aria-hidden="true" />
                  {{ store.approvalBusy[a.id] === 'approve' ? 'Approving…' : 'Approve' }}
                </button>
                <button type="button" class="ss-btn" :disabled="!!store.approvalBusy[a.id]"
                        :aria-busy="store.approvalBusy[a.id] === 'decline'" data-test="approval-decline"
                        @click="store.answerApproval(a, false)">
                  {{ store.approvalBusy[a.id] === 'decline' ? 'Declining…' : 'Decline' }}
                </button>
              </template>
              <router-link v-if="a.conversation_id" :to="`/dashboard/chat/${a.conversation_id}`" class="ss-btn"
                           data-test="approval-open">
                <ArrowUpRight :size="16" aria-hidden="true" />Open the chat
              </router-link>
            </div>
          </li>
        </ul>
      </section>

      <!-- The filter is in the URL (?state=), so a link or a reload opens the same view. -->
      <nav class="ss-filters" aria-label="Filter sessions by state">
        <button v-for="f in filters" :key="f.key" type="button" class="ss-filter"
                :class="{ active: store.filter === f.key }" :aria-pressed="store.filter === f.key"
                :data-test="`filter-${f.key || 'all'}`" @click="pick(f.key)">
          {{ f.label }}
          <span v-if="f.key === 'needs_input' && store.needsInputCount" class="ss-filter-count"
                :aria-label="`${store.needsInputCount} need you`">{{ store.needsInputCount }}</span>
        </button>
      </nav>

      <p v-if="store.actionError" class="ss-action-error" role="alert" data-test="action-error">
        <CircleAlert :size="16" aria-hidden="true" />{{ store.actionError }}
        <button type="button" class="ss-link" @click="store.actionError = ''">Dismiss</button>
      </p>

      <!-- Loading: rows the shape of the real ones, so nothing jumps when they arrive. -->
      <ul v-if="store.loading && !store.items.length" class="ss-list" aria-busy="true" aria-label="Loading sessions"
          data-test="loading">
        <li v-for="n in 4" :key="n" class="ss-row ss-skel" aria-hidden="true">
          <span class="sk sk-pill" /><span class="sk sk-title" /><span class="sk sk-line" />
        </li>
      </ul>

      <LoadError v-else-if="store.loadError && !store.items.length" title="Couldn't load your sessions"
                 message="Your runs are not affected. Try again." :retrying="store.loading" @retry="store.load()" />

      <div v-else-if="!store.items.length" class="ss-empty" data-test="empty">
        <component :is="emptyIcon" :size="28" :stroke-width="1.6" aria-hidden="true" />
        <p class="ss-empty-title">{{ emptyText.title }}</p>
        <p class="ss-empty-text">{{ emptyText.text }}</p>
        <router-link v-if="!store.filter" to="/dashboard/chat/new" class="ss-btn ss-btn-primary">Start a chat</router-link>
        <button v-else type="button" class="ss-btn" @click="pick('')">Show every session</button>
      </div>

      <ul v-else class="ss-list" aria-label="Sessions">
        <li v-for="row in store.items" :key="row.conversation_id" class="ss-row" :class="`is-${row.state}`"
            :data-test="`session-${row.conversation_id}`">
          <div class="ss-row-top">
            <span class="ss-pill" :class="`pill-${row.state}`" data-test="state-pill">
              <component :is="stateIcon[row.state]" :size="14" :stroke-width="2"
                         :class="{ 'ss-spin': row.state === 'working' && !row.stalled }" aria-hidden="true" />
              {{ row.state_label }}
            </span>
            <span class="ss-meta">
              <span class="ss-agent">{{ row.agent_name }}</span>
              <span aria-hidden="true">·</span>
              <time :datetime="row.updated_at" :title="fullTime(row.updated_at)">{{ relativeTime(row.updated_at) }}</time>
              <template v-if="row.price_usd">
                <span aria-hidden="true">·</span><span class="ss-price" title="Paid from your balance">${{ row.price_usd }}</span>
              </template>
            </span>
          </div>
          <h2 class="ss-row-title">{{ row.title }}</h2>
          <p class="ss-summary" :class="{ warn: row.stalled }" data-test="summary">{{ row.summary }}</p>

          <!-- The open card, answered here with the chat's own card and its own `hitl_response`. -->
          <div v-if="open[row.conversation_id] && row.request" class="ss-card" data-test="inline-card">
            <HITLModal inline show-stop :requests="[row.request]"
                       @respond="(e) => answer(row, e)" @stop="() => stopRow(row)"
                       @dismiss="() => toggle(row)" @skip="() => {}" />
          </div>

          <div class="ss-actions">
            <button v-if="row.state === 'needs_input' && row.request" type="button" class="ss-btn ss-btn-primary"
                    :aria-expanded="!!open[row.conversation_id]" :disabled="!!store.busy[row.conversation_id]"
                    data-test="answer" @click="toggle(row)">
              <MessageCircleQuestion :size="16" aria-hidden="true" />
              {{ store.busy[row.conversation_id] === 'answer' ? 'Sending…' : (open[row.conversation_id] ? 'Hide' : 'Answer') }}
            </button>
            <button v-if="row.state === 'working' || row.state === 'needs_input'" type="button" class="ss-btn"
                    :disabled="!!store.busy[row.conversation_id]" data-test="stop" @click="stopRow(row)">
              <SquareStop :size="16" aria-hidden="true" />
              {{ store.busy[row.conversation_id] === 'stop' ? 'Stopping…' : 'Stop' }}
            </button>
            <router-link v-if="row.chat_url" :to="row.chat_url" class="ss-btn" data-test="open">
              <ArrowUpRight :size="16" aria-hidden="true" />Open chat
            </router-link>
          </div>
        </li>
      </ul>

      <div v-if="store.nextCursor && store.items.length" class="ss-more">
        <button type="button" class="ss-btn" :disabled="store.loadingMore" data-test="load-more" @click="store.loadMore()">
          {{ store.loadingMore ? 'Loading…' : 'Load more' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowUpRight, Check, CircleAlert, CircleCheck, CircleStop, CircleX, Clock, Hand, Inbox, LoaderCircle,
  MessageCircleQuestion, ShieldCheck, SquareStop,
} from 'lucide-vue-next'
import HITLModal from '../components/HITLModal.vue'
import LoadError from '../components/common/LoadError.vue'
import { useRelativeTime } from '../composables/useRelativeTime'
import { confirm } from '../composables/useConfirm'
import { SESSION_STATES, useSessionsStore } from '../stores/useSessionsStore'

const store = useSessionsStore()
const route = useRoute()
const router = useRouter()
const { relativeTime } = useRelativeTime()

const filters = [
  { key: '', label: 'All' },
  { key: 'needs_input', label: 'Needs input' },
  { key: 'working', label: 'Working' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
  { key: 'stopped', label: 'Stopped' },
]
// The state is said in words AND with an icon AND a colour, never by colour alone.
const stateIcon = { working: LoaderCircle, needs_input: MessageCircleQuestion, done: CircleCheck,
  failed: CircleX, stopped: CircleStop }

const EMPTY = {
  '': { title: 'No sessions yet', text: 'When an agent works on something for you, it shows here with what it is doing.' },
  needs_input: { title: 'Nothing needs you', text: 'No run is waiting for an answer or an approval.' },
  working: { title: 'Nothing is running', text: 'No agent is working on anything right now.' },
  done: { title: 'No finished sessions', text: 'Runs that finish show here.' },
  failed: { title: 'No failed sessions', text: 'None of your runs has failed.' },
  stopped: { title: 'No stopped sessions', text: 'Runs you stop show here.' },
}
const emptyText = computed(() => EMPTY[store.filter] || EMPTY[''])
const emptyIcon = computed(() => (store.filter === 'needs_input' ? CircleCheck : Inbox))

// Which rows show their card.
const open = reactive({})
function toggle(row) { open[row.conversation_id] = !open[row.conversation_id] }

function answer(row, e) {
  store.respond(row, e)
  open[row.conversation_id] = false
}
async function stopRow(row) {
  const ok = await confirm({
    title: 'Stop this run?',
    message: `${row.agent_name} stops in “${row.title}”. What it has done so far is kept.`,
    confirmText: 'Stop',
    danger: true,
  })
  if (ok) store.stop(row)
}

// "Waiting for you" rows. A tool step is approved or declined here; a plan or a question needs its chat, where its
// full card is (and with no chat to open, the row shows only what it asks).
const SOURCE_LABEL = { mcp: 'From an MCP client', parked: 'From a scheduled or background run', chat: 'From a chat' }
function sourceLabel(src) { return SOURCE_LABEL[src] || SOURCE_LABEL.chat }
function kindLabel(a) { return a.kind === 'plan' ? 'Plan to approve' : a.kind === 'question' ? 'Question' : 'Step to approve' }
function canAnswerHere(a) { return a.kind === 'tool' }
// The countdown, only for an approval with a clock (`timeout_at`); most have none.
const now = ref(Date.now())
function timeLeft(iso) {
  const left = Date.parse(iso || '') - now.value
  if (Number.isNaN(left)) return ''
  if (left <= 0) return 'Time is up'
  const m = Math.floor(left / 60000)
  if (m >= 60) return `Answer within ${Math.floor(m / 60)} h ${m % 60} min`
  return m >= 1 ? `Answer within ${m} min` : `Answer within ${Math.ceil(left / 1000)} s`
}
let clock = null
const hasClock = computed(() => store.approvals.some((a) => a.timeout_at))
watch(hasClock, (on) => {
  if (on && !clock) clock = setInterval(() => { now.value = Date.now() }, 1000)
  else if (!on && clock) { clearInterval(clock); clock = null }
}, { immediate: true })
// Every approval raised for the person (a chat's, an MCP client's, a parked run's) arrives as a `hitl_request` frame,
// which the store reads the list again on. Coming back to the page reads it once too: frames sent while the socket
// was away are not replayed.
function onFocus() { store.loadApprovals() }

// The exact time on hover, in the person's own locale.
const _fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
function fullTime(iso) {
  const t = Date.parse(iso || '')
  return Number.isNaN(t) ? '' : _fmt.format(t)
}

function stateFromRoute() {
  const s = String(route.query.state || '')
  return SESSION_STATES.includes(s) ? s : ''
}
function pick(key) {
  router.replace({ query: { ...route.query, state: key || undefined } })
}
watch(() => route.query.state, () => store.setFilter(stateFromRoute()))

onMounted(() => {
  store.connect()
  store.setFilter(stateFromRoute())
  if (store.filter === stateFromRoute() && store.items.length) store.load()
  store.refreshCount()
  store.loadApprovals()
  window.addEventListener('focus', onFocus)
})
onBeforeUnmount(() => {
  window.removeEventListener('focus', onFocus)
  if (clock) clearInterval(clock)
  store.disconnect()
})
</script>

<style scoped>
.ss { height: 100%; overflow-y: auto; background: var(--vm-bg); color: var(--vm-ink); font-family: var(--vm-font-sans); }
.ss-wrap { max-width: 920px; margin: 0 auto; padding: 32px 32px 64px; }
.ss-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px 24px; flex-wrap: wrap;
  padding-bottom: 20px; border-bottom: 1px solid var(--vm-line); }
.ss-head-text { min-width: 0; }
.ss-title { margin: 0; font: 700 30px/1.15 var(--vm-font-display); letter-spacing: -.02em; }
.ss-sub { margin: 6px 0 0; font-size: 15px; line-height: 1.5; color: var(--vm-ink-soft); }
.ss-live { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--vm-ink-soft); }
.ss-live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--vm-ink-faint); }
.ss-live.on .ss-live-dot { background: var(--vm-green); }

.ss-filters { display: flex; gap: 6px; margin: 18px 0 16px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.ss-filters::-webkit-scrollbar { display: none; }
.ss-filter { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 6px 14px;
  border: 1px solid var(--vm-line); border-radius: 999px; background: var(--vm-surface); color: var(--vm-ink-soft);
  font: 500 13.5px/1 var(--vm-font-sans); cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
.ss-filter:hover { color: var(--vm-ink); border-color: var(--vm-line-2); }
.ss-filter.active { background: var(--vm-primary-soft); border-color: var(--vm-primary-line); color: var(--vm-link); font-weight: 600; }
.ss-filter-count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
  background: var(--vm-amber-soft); color: var(--vm-amber-ink); font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums; }

.ss-action-error { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; padding: 10px 12px; border-radius: var(--vm-r);
  background: var(--vm-red-soft); color: var(--vm-red-ink); font-size: 14px; line-height: 1.4; }
.ss-link { margin-left: auto; border: 0; background: none; color: inherit; font: 600 13px var(--vm-font-sans); text-decoration: underline; cursor: pointer; min-height: 32px; }

.ss-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ss-row { content-visibility: auto; contain-intrinsic-size: auto 150px; padding: 14px 16px; border: 1px solid var(--vm-line); border-left: 3px solid var(--vm-line-2); border-radius: var(--vm-r);
  background: var(--vm-surface); min-width: 0; }
.ss-row.is-needs_input { border-left-color: var(--vm-amber); }
.ss-row.is-working { border-left-color: var(--vm-primary); }
.ss-row.is-failed { border-left-color: var(--vm-danger); }
.ss-row.is-done { border-left-color: var(--vm-green); }
.ss-row-top { display: flex; align-items: center; justify-content: space-between; gap: 8px 12px; flex-wrap: wrap; }
.ss-pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 8px; border-radius: 999px;
  font: 600 12.5px/1.4 var(--vm-font-sans); border: 1px solid transparent; }
.pill-working { background: var(--vm-blue-soft); color: var(--vm-link); }
.pill-needs_input { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.pill-done { background: var(--vm-green-soft); color: var(--vm-green-ink); }
.pill-failed { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.pill-stopped { background: var(--vm-surface-soft); color: var(--vm-ink-soft); border-color: var(--vm-line); }
.ss-meta { display: inline-flex; align-items: center; gap: 6px; min-width: 0; font-size: 12.5px; color: var(--vm-ink-soft); }
.ss-agent { font-weight: 600; color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.ss-row-title { margin: 10px 0 2px; font: 650 15.5px/1.35 var(--vm-font-sans); overflow-wrap: anywhere; }
.ss-summary { margin: 0; font-size: 14px; line-height: 1.5; color: var(--vm-ink-soft); overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ss-summary.warn { color: var(--vm-amber-ink); }
.ss-card { margin-top: 12px; }
.ss-price { font-variant-numeric: tabular-nums; }
.ss-btn, .ss-filter { touch-action: manipulation; }
.ss-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.ss-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; padding: 8px 14px;
  border: 1px solid var(--vm-line-2); border-radius: 9px; background: var(--vm-surface); color: var(--vm-ink);
  font: 550 13.5px/1 var(--vm-font-sans); text-decoration: none; cursor: pointer; transition: background .15s, border-color .15s; }
.ss-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.ss-btn:disabled { opacity: .6; cursor: not-allowed; }
.ss-btn-primary { background: var(--vm-primary); border-color: var(--vm-primary); color: white; }
.ss-btn-primary:hover:not(:disabled) { background: var(--vm-primary-d); }
.ss-btn:focus-visible, .ss-filter:focus-visible, .ss-link:focus-visible { outline: 2px solid var(--vm-focus, #2563eb); outline-offset: 2px; }
.ss-wait { margin: 20px 0 4px; }
.ss-wait-title { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font: 650 16px/1.3 var(--vm-font-sans); color: var(--vm-ink); }
.ss-wait-title svg { color: var(--vm-amber-ink); }
.ss-wait-summary { margin: 10px 0 0; font-size: 14.5px; line-height: 1.5; color: var(--vm-ink); overflow-wrap: anywhere; }
.ss-wait-clock { display: inline-flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: 12.5px; color: var(--vm-amber-ink); font-variant-numeric: tabular-nums; }
.ss-wait-error { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; padding: 8px 10px; border-radius: var(--vm-r);
  background: var(--vm-red-soft); color: var(--vm-red-ink); font-size: 13.5px; line-height: 1.4; overflow-wrap: anywhere; }
.ss-more { display: flex; justify-content: center; margin-top: 16px; }

.ss-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px 16px; text-align: center;
  border: 1px dashed var(--vm-line-2); border-radius: var(--vm-r); color: var(--vm-ink-faint); }
.ss-empty-title { margin: 4px 0 0; font: 650 16px/1.3 var(--vm-font-sans); color: var(--vm-ink); }
.ss-empty-text { margin: 0 0 8px; max-width: 420px; font-size: 14px; line-height: 1.5; color: var(--vm-ink-soft); }

.ss-skel { display: flex; flex-direction: column; gap: 10px; }
.sk { display: block; border-radius: 6px; background: var(--vm-surface-soft); animation: ss-pulse 1.4s ease-in-out infinite; }
.sk-pill { width: 96px; height: 22px; border-radius: 999px; }
.sk-title { width: 55%; height: 16px; }
.sk-line { width: 80%; height: 14px; }
.ss-spin { animation: ss-rot 1.1s linear infinite; }
@keyframes ss-rot { to { transform: rotate(360deg); } }
@keyframes ss-pulse { 50% { opacity: .55; } }
@media (prefers-reduced-motion: reduce) { .ss-spin, .sk { animation: none; } .ss-filter, .ss-btn { transition: none; } }

@media (max-width: 640px) {
  .ss-wrap { padding: 20px 16px 48px; }
  .ss-title { font-size: 24px; }
  .ss-sub { font-size: 14px; }
  .ss-actions .ss-btn { flex: 1 1 auto; min-height: 44px; }
  .ss-agent { max-width: 140px; }
}
</style>
