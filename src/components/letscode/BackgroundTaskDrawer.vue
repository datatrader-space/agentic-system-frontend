<!--
  BackgroundTaskDrawer: what Open shows for a background task (ADM-1360 release, CODING_AGENT_BACKGROUND_WORK_PLAN.md
  section 3), in a side drawer beside the editor:
    - a command, server or watcher (`open.type` output): its output as the server keeps it (masked), with Refresh,
      which reads the chat's task list again. Nothing else on the page shows a command's output by its handle.
    - a subagent (conversation): its transcript, drawn by the chat's own message component, and "Open as a chat tab".
    - a wake-up or schedule (schedule): its time and its prompt.
  A workflow run is a link to its own page instead (the rows and the event card render it). Teleported to the page's
  body with the editor's theme; Esc and Close shut it; the focus stays inside while it is open. Lazy.
-->
<template>
  <Teleport to="body">
    <div class="bgd-overlay" :data-theme="ideTheme" @pointerdown.self="close">
      <aside ref="panelEl" class="bgd" role="dialog" aria-modal="true" aria-labelledby="bgd-title" data-test="bgd"
             @keydown.tab="trapTab">
        <header class="bgd-head">
          <span class="bgd-kind" aria-hidden="true"><Icon :icon="kindIcon(task.kind)" /></span>
          <div class="bgd-head-t">
            <h2 id="bgd-title" class="bgd-title">{{ task.name || 'Background task' }}</h2>
            <p class="bgd-meta">
              <span class="bgd-kindw">{{ kindWord(task.kind) }}</span>
              <span data-test="bgd-status">{{ statusText(task, now) }}</span>
              <span v-if="needsPerson(task)" class="bgd-needs-l">Needs you</span>
            </p>
          </div>
          <button ref="closeEl" type="button" class="bgd-ibtn" aria-label="Close" title="Close" data-test="bgd-close" @click="close">
            <Icon icon="lucide:x" aria-hidden="true" />
          </button>
        </header>

        <div class="bgd-body vm-scroll">
          <!-- A command, server or watcher: its output. -->
          <template v-if="type === 'output'">
            <h3 class="bgd-h3">Output</h3>
            <pre v-if="task.output_tail" ref="outEl" class="bgd-out" translate="no" tabindex="0" aria-label="Output" data-test="bgd-output">{{ task.output_tail }}</pre>
            <p v-else class="bgd-empty">No output yet.</p>
            <p class="bgd-hint">The newest part of the output, as the server keeps it (secrets hidden).</p>
          </template>

          <!-- A subagent: its own chat's transcript. -->
          <template v-else-if="type === 'conversation'">
            <h3 class="bgd-h3">Transcript</h3>
            <p v-if="task.status === 'needs_approval'" class="bgd-needs" role="note" data-test="bgd-needs">
              The subagent is waiting for you: its approval card is in its chat. Open it as a chat tab to answer.
            </p>
            <div v-if="transcriptLoading && !transcript.length" class="bgd-skel" aria-busy="true" aria-label="Loading the transcript"><span v-for="n in 3" :key="n"></span></div>
            <p v-else-if="transcriptError" class="bgd-err" role="alert">{{ transcriptError }}</p>
            <p v-else-if="!transcript.length" class="bgd-empty">The subagent has not written anything yet.</p>
            <div v-else class="bgd-transcript" data-test="bgd-transcript">
              <ChatMessage v-for="m in transcript" :key="m.id" :message="m" />
            </div>
          </template>

          <!-- A wake-up or a schedule: when and what. -->
          <template v-else-if="type === 'schedule'">
            <dl class="bgd-dl" data-test="bgd-schedule">
              <dt>{{ task.kind === 'schedule' ? 'Runs' : 'Continues this chat' }}</dt>
              <dd>{{ whenText }}</dd>
              <dt>Prompt</dt>
              <dd class="bgd-prompt">{{ task.prompt || task.name || 'No prompt was given.' }}</dd>
            </dl>
          </template>
        </div>

        <footer class="bgd-foot">
          <p v-if="ctl && ctl.stopErrors[String(task.id)]" class="bgd-stop-err" role="alert" data-test="bgd-stop-err">{{ ctl.stopErrors[String(task.id)] }}</p>
          <button v-if="type === 'output' || type === 'conversation'" type="button" class="bgd-btn" data-test="bgd-refresh"
                  :disabled="refreshing" :aria-busy="refreshing ? 'true' : 'false'" @click="refresh">
            <Icon icon="lucide:refresh-cw" :class="{ spin: refreshing }" aria-hidden="true" /> {{ refreshing ? 'Refreshing…' : 'Refresh' }}
          </button>
          <button v-if="type === 'conversation' && childId" type="button" class="bgd-btn" data-test="bgd-open-chat" @click="openAsTab">
            <Icon icon="lucide:message-square" aria-hidden="true" /> Open as a chat tab
          </button>
          <button v-if="isActive(task)" type="button" class="bgd-btn danger" data-test="bgd-stop" :disabled="!!ctl.stopping"
                  :aria-busy="stoppingThis ? 'true' : 'false'" @click="stop">
            <Icon :icon="stoppingThis ? 'lucide:loader-2' : 'lucide:square'" :class="{ spin: stoppingThis }" aria-hidden="true" />
            {{ stoppingThis ? 'Stopping…' : 'Stop' }}
          </button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import { useChatStore } from '@/stores/useChatStore'
import { useIdeTheme } from '@/composables/useIdeTheme'
import { useClock } from '@/composables/useClock'
import { confirmState } from '@/composables/useConfirm'
import { BACKGROUND_TASKS, isActive } from '@/stores/useBackgroundTasks'
import { clockTime, dueOf, kindIcon, kindWord, needsPerson, openType, resultWord, statusText } from './backgroundTaskText'
import { stopWithConfirm } from './backgroundTaskActions'

const emit = defineEmits(['open-chat'])
const ctl = inject(BACKGROUND_TASKS, null)
const chat = useChatStore()
const { theme: ideTheme } = useIdeTheme()
const now = useClock()
const panelEl = ref(null)
const closeEl = ref(null)
const outEl = ref(null)

const task = computed(() => (ctl && ctl.opened) || {})
const type = computed(() => openType(task.value))
const stoppingThis = computed(() => !!ctl && ctl.stopping === String(task.value.id))
const childId = computed(() => (task.value.open && task.value.open.conversation_id) || '')
const whenText = computed(() => {
  const t = task.value
  const due = dueOf(t)
  const at = due ? clockTime(due, now.value) : ''
  const repeat = t.schedule_text || ''
  if (t.state !== 'running') return resultWord(t, now.value)
  if (at && repeat) return `${repeat}; next ${at}`
  return at || repeat || 'Waiting for its time'
})

// ── The subagent's transcript: its chat's saved messages, mapped as the chat maps them. ──
const transcript = ref([])
const transcriptLoading = ref(false)
const transcriptError = ref('')
let seq = 0
async function loadTranscript() {
  const cid = childId.value
  if (type.value !== 'conversation' || !cid) return
  const mine = ++seq
  transcriptLoading.value = true
  try {
    const { data } = await api.getConversationMessages(cid)
    if (mine !== seq) return
    const rows = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : [])
    transcript.value = rows.map((m) => chat._mapServerMessage(m, cid))
    transcriptError.value = ''
  } catch (e) {
    if (mine === seq) transcriptError.value = e?.response?.status === 404 ? "This transcript is not available: the subagent's chat was removed or is not yours." : 'The transcript could not be loaded. Press Refresh to try again.'
  } finally {
    if (mine === seq) transcriptLoading.value = false
  }
}

const refreshing = ref(false)
async function refresh() {
  if (refreshing.value || !ctl) return
  refreshing.value = true
  try {
    await Promise.all([ctl.load(), type.value === 'conversation' ? loadTranscript() : null])
  } finally {
    refreshing.value = false
  }
}
function scrollOutputDown() { nextTick(() => { const el = outEl.value; if (el) el.scrollTop = el.scrollHeight }) }
watch(() => task.value.output_tail, scrollOutputDown)
watch(childId, () => { transcript.value = []; loadTranscript() })

function stop() { return stopWithConfirm(ctl, task.value) }
function openAsTab() {
  emit('open-chat', childId.value)
  close()
}

let returnFocus = null
function close() { ctl?.closeOpened() }
function onKey(e) {
  if (e.key !== 'Escape' || e.defaultPrevented || confirmState.open) return
  e.preventDefault()
  close()
}
function trapTab(e) {
  const items = [...(panelEl.value?.querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]') || [])]
    .filter((el) => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
onMounted(() => {
  returnFocus = document.activeElement
  window.addEventListener('keydown', onKey)
  nextTick(() => closeEl.value?.focus())
  loadTranscript()
  scrollOutputDown()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (returnFocus && typeof returnFocus.focus === 'function' && document.contains(returnFocus)) returnFocus.focus()
})
</script>

<style scoped>
.bgd-overlay { position: fixed; inset: 0; z-index: 60; display: flex; justify-content: flex-end; background: color-mix(in srgb, #000 35%, transparent); overscroll-behavior: contain; }
.bgd {
  width: min(560px, 100%); height: 100%; display: flex; flex-direction: column; background: var(--vm-surface); color: var(--vm-ink);
  border-left: 1px solid var(--vm-line-2); box-shadow: var(--vm-shadow-l, 0 12px 32px rgba(0, 0, 0, .2)); font: 13px/1.5 var(--vm-font-sans);
}
.bgd-head { display: flex; align-items: flex-start; gap: 10px; padding: 14px 14px 12px 16px; border-bottom: 1px solid var(--vm-line); }
.bgd-kind { flex: 0 0 auto; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.bgd-kind :deep(svg) { width: 18px; height: 18px; }
.bgd-head-t { flex: 1; min-width: 0; }
.bgd-title { margin: 0; font: 700 15px/1.3 var(--vm-font-sans); overflow-wrap: anywhere; text-wrap: balance; }
.bgd-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 4px 0 0; font-size: 12px; color: var(--vm-ink-soft); font-variant-numeric: tabular-nums; }
.bgd-meta { column-gap: 12px; }
.bgd-kindw { color: var(--vm-ink); }
.bgd-needs-l { padding: 0 7px; border: 1px solid var(--vm-amber); border-radius: 999px; background: var(--vm-amber-soft); color: var(--vm-amber-ink); font: 600 11.5px/18px var(--vm-font-sans); }
.bgd-ibtn { flex: 0 0 auto; display: grid; place-items: center; width: 32px; height: 32px; border: none; border-radius: 8px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s; touch-action: manipulation; }
.bgd-ibtn:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.bgd-ibtn :deep(svg) { width: 16px; height: 16px; }
.bgd-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 12px 16px; }
.bgd-h3 { margin: 0 0 8px; font: 700 12.5px var(--vm-font-sans); color: var(--vm-ink-soft); }
.bgd-out { margin: 0; max-height: none; padding: 10px 12px; border: 1px solid var(--vm-line); border-radius: 8px; background: var(--vm-bg); font: 12px/1.55 var(--vm-font-mono); color: var(--vm-ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.bgd-hint { margin: 8px 0 0; font-size: 12px; color: var(--vm-ink-faint); }
.bgd-empty { margin: 0; color: var(--vm-ink-soft); }
.bgd-err { margin: 0; color: var(--vm-red-ink); }
.bgd-skel { display: flex; flex-direction: column; gap: 8px; }
.bgd-skel span { display: block; height: 48px; border-radius: 8px; background: var(--vm-surface-soft); animation: bgdpulse 1.4s ease-in-out infinite; }
@keyframes bgdpulse { 50% { opacity: .55; } }
.bgd-needs { margin: 0 0 10px; padding: 8px 10px; border: 1px solid var(--vm-amber); border-radius: 8px; background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.bgd-transcript { display: flex; flex-direction: column; gap: 4px; }
/* A read-only transcript: the chat's own message rows without their actions (thumbs, regenerate, edit). */
.bgd-transcript :deep(.msg-actions) { display: none; }
.bgd-transcript :deep(.msg) { max-width: none; margin: 0 0 12px; }
.bgd-dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; margin: 0; }
.bgd-dl dt { font-weight: 600; color: var(--vm-ink-soft); }
.bgd-dl dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.bgd-prompt { white-space: pre-wrap; }
.bgd-foot { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--vm-line); }
.bgd-stop-err { flex-basis: 100%; margin: 0; font-size: 12px; color: var(--vm-red-ink); text-align: right; overflow-wrap: anywhere; }
.bgd-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s, border-color .15s; touch-action: manipulation; }
.bgd-btn :deep(svg) { width: 14px; height: 14px; }
.bgd-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.bgd-btn.danger { color: var(--vm-red-ink); }
.bgd-btn.danger:hover:not(:disabled) { border-color: var(--vm-danger); background: var(--vm-red-soft); }
.bgd-btn:disabled { opacity: .55; cursor: not-allowed; }
.bgd-btn:focus-visible, .bgd-ibtn:focus-visible, .bgd-out:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 2px; }
.spin { animation: bgdspin 1s linear infinite; }
@keyframes bgdspin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .bgd { width: 100%; border-left: none; }
  .bgd-ibtn { width: 44px; height: 44px; }
  .bgd-btn { min-height: 44px; }
  .bgd-dl { grid-template-columns: 1fr; gap: 2px; }
  .bgd-dl dd { margin-bottom: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .spin, .bgd-skel span { animation: none; }
}
</style>
