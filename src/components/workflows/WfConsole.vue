<!--
  The builder's bottom console (plan §3.1): Log (live step ticks), Runs (history, paged by cursor, C5) and Timeline
  (every attempt of the run on screen). Collapsed, it is a 36 px strip with the last run's status and counts, which
  replaces the old run banner over the graph; L toggles it. It is resized from its top edge with the pointer or the
  arrow keys. Below 1024 px wide it opens as a bottom sheet instead.

  Run state comes only from useWorkflowRun. A waiting approval is decided here, on the live run, so it stays reachable
  after a reload (F10).
-->
<template>
  <section class="wfb-console" :class="{ 'is-open': open && !sheet, 'is-sheet': sheet }" :style="open && !sheet ? { height: `${height}px` } : null" aria-label="Console">
    <div
      v-if="open && !sheet"
      class="wfb-console__resize"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the console"
      :aria-valuenow="height"
      :aria-valuemin="MIN_H"
      :aria-valuemax="maxHeight"
      tabindex="0"
      @pointerdown="startResize"
      @keydown="onResizeKey"
    ></div>

    <div class="wfb-console__strip">
      <button type="button" class="wfb-console__toggle" :aria-expanded="sheet ? sheetOpen : open" aria-controls="wfb-console-body" @click="toggle">
        <Icon :icon="(sheet ? sheetOpen : open) ? 'lucide:chevron-down' : 'lucide:chevron-up'" aria-hidden="true" />
        <span>Console</span>
        <kbd aria-hidden="true">L</kbd>
      </button>
      <span class="wfb-console__summary" role="status">
        <template v-if="summary">
          <Icon :icon="summary.icon" :class="[`is-${summary.tone}`, { 'wf-spin': summary.spin }]" aria-hidden="true" />
          <span>{{ summary.text }}</span>
        </template>
        <span v-else class="is-muted">No runs yet</span>
      </span>
      <span v-if="counts.total" class="wfb-console__counts">
        <span v-for="c in countChips" :key="c.key" class="wfb-count" :class="`is-${c.key}`" :title="c.label">
          <Icon :icon="c.icon" aria-hidden="true" />{{ c.n }}<span class="wf-sr">{{ ` ${c.label}` }}</span>
        </span>
      </span>
      <span v-if="waitingSub" class="wfb-console__approve" role="status">
        <Icon icon="lucide:workflow" class="is-waiting" aria-hidden="true" />
        <span class="wfb-console__approve-text">Waiting for sub-workflow run {{ waitingSub.ids.map((id) => `#${id}`).join(', ') }}</span>
        <RouterLink v-for="id in waitingSub.ids" :key="id" class="wfb-link-btn" :to="{ name: 'dashboard-workflow-runs', query: { run: id } }">Open run #{{ id }}</RouterLink>
      </span>
      <span v-if="waitingApprovals.length" class="wfb-console__approve">
        <span class="wfb-console__approve-text">{{ titleOf(waitingApprovals[0]) }} needs your approval</span>
        <button type="button" class="wfb-btn is-small is-success" :disabled="run.deciding.value" @click="run.decide(waitingApprovals[0], 'approve')"><Icon icon="lucide:check" aria-hidden="true" />Approve</button>
        <button type="button" class="wfb-btn is-small is-danger" :disabled="run.deciding.value" @click="run.decide(waitingApprovals[0], 'reject')"><Icon icon="lucide:x" aria-hidden="true" />Reject</button>
      </span>
    </div>

    <div v-if="open && !sheet" id="wfb-console-body" class="wfb-console__body">
      <ConsoleBody />
    </div>
  </section>

  <AppSheet v-if="sheet" v-model:open="sheetOpen" title="Console" side="bottom" size="md">
    <div id="wfb-console-body" class="wfb-root wfb-layer wfb-console__body is-in-sheet">
      <ConsoleBody />
    </div>
  </AppSheet>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import AppSheet from '@/components/common/AppSheet.vue'
import StudioJobList from '@/components/studio/StudioJobList.vue'
import defaultApi from '@/services/api'
import { notify } from '@/composables/useNotify'
import { NODE_STATUS_ICONS, NODE_STATUS_LABELS } from '@/utils/wfNodeView'
import { runStopKind } from '@/utils/workflowRunPolling'
import { nodeTitle } from './wfNodeData'

const props = defineProps({
  run: { type: Object, required: true },
  doc: { type: Object, required: true },
  graphId: { type: [String, Number], required: true },
  open: { type: Boolean, default: false },
  height: { type: Number, default: 240 },
  sheet: { type: Boolean, default: false },
  api: { type: Object, default: () => defaultApi },
})
const emit = defineEmits(['update:open', 'update:height', 'focus-node', 'rerun'])

const MIN_H = 120
const PAGE = 50
const maxHeight = ref(Math.round(window.innerHeight * 0.7))
function onWindowResize() { maxHeight.value = Math.round(window.innerHeight * 0.7) }
window.addEventListener('resize', onWindowResize)
onBeforeUnmount(() => window.removeEventListener('resize', onWindowResize))

const tab = ref('log')
const sheetOpen = ref(false)
function toggle() {
  if (props.sheet) sheetOpen.value = !sheetOpen.value
  else emit('update:open', !props.open)
}
watch(() => props.open, (v) => { if (props.sheet) sheetOpen.value = v })
watch(sheetOpen, (v) => { if (props.sheet && v !== props.open) emit('update:open', v) })

// ── strip ──
const titleOf = (id) => {
  const n = props.doc.nodes.value.find((x) => x.id === id)
  return n ? nodeTitle(n.type, n.data) : id
}
const counts = computed(() => {
  const states = Object.values(props.run.nodeStates.value || {})
  const by = (s) => states.filter((x) => x.status === s).length
  return {
    total: states.length,
    succeeded: by('succeeded'), failed: by('failed'), running: by('running') + by('queued'),
    waiting: by('waiting'), skipped: by('skipped') + by('cancelled'),
  }
})
const COUNT_META = [
  ['succeeded', 'succeeded', NODE_STATUS_ICONS.succeeded],
  ['running', 'running or queued', NODE_STATUS_ICONS.running],
  ['waiting', 'waiting', NODE_STATUS_ICONS.waiting],
  ['failed', 'failed', NODE_STATUS_ICONS.failed],
  ['skipped', 'skipped or cancelled', NODE_STATUS_ICONS.skipped],
]
const countChips = computed(() => COUNT_META.map(([key, label, icon]) => ({ key, label, icon, n: counts.value[key] })).filter((c) => c.n))

const RUN_TONE = { success: 'succeeded', failed: 'failed', dead: 'failed', cancelled: 'muted', waiting: 'waiting', paused: 'waiting', blocked: 'waiting' }
const RUN_ICON = { success: NODE_STATUS_ICONS.succeeded, failed: NODE_STATUS_ICONS.failed, dead: NODE_STATUS_ICONS.failed, cancelled: NODE_STATUS_ICONS.cancelled, waiting: NODE_STATUS_ICONS.waiting, paused: 'lucide:pause', blocked: NODE_STATUS_ICONS.waiting }
const summary = computed(() => {
  const viewed = props.run.viewed.value
  const live = props.run.live.value
  const r = viewed || live || props.doc.meta.lastRun || runs.value[0]
  if (!r) return null
  const status = r.status || 'queued'
  const moving = !runStopKind(status)
  const prefix = viewed ? `Viewing run #${r.id}` : `Run #${r.id}`
  const test = (r.dryRun ?? r.dry_run) ? ' (test)' : ''
  return {
    text: `${prefix}${test}: ${moving ? 'running…' : status}`,
    icon: moving ? 'lucide:loader-circle' : (RUN_ICON[status] || 'lucide:circle'),
    tone: moving ? 'running' : (RUN_TONE[status] || 'muted'),
    spin: moving,
  }
})
// A decision is asked for only when the run really waits on one: a parent waiting on a sub-workflow run is not an
// approval (the engine's `run_waiting` says which), and gets a link to the child run instead (the runs page opens it).
const waitingApprovals = computed(() => {
  if (!props.run.live.value || props.run.viewingPast.value || !props.run.waitingOn.value?.approval) return []
  const states = props.run.nodeStates.value || {}
  return props.doc.nodes.value.filter((n) => n.type === 'logic.approval' && states[n.id]?.status === 'waiting').map((n) => n.id)
})
const waitingSub = computed(() => {
  const w = props.run.waitingOn.value
  if (props.run.viewingPast.value || !w?.subworkflow) return null
  return { ids: w.subRunIds }
})

// ── log ──
const errorsOnly = ref(false)
const logEl = ref(null)
const logRows = computed(() => (errorsOnly.value ? props.run.log.value.filter((e) => e.level === 'error') : props.run.log.value))
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const fmtTime = (iso) => { try { return iso ? timeFmt.format(new Date(iso)) : '' } catch { return '' } }
const fmtDate = (iso) => { try { return iso ? dateFmt.format(new Date(iso)) : '' } catch { return '' } }
function fmtDuration(ms) {
  if (ms == null) return ''
  if (ms < 1000) return `${ms} ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`
  return `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`
}
const costFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 })
const LOG_ICON = { success: 'lucide:circle-check', error: 'lucide:circle-alert', warn: 'lucide:triangle-alert', info: 'lucide:info' }
watch(() => props.run.log.value.length, () => nextTick(() => { const el = logEl.value; if (el) el.scrollTop = el.scrollHeight }))
async function copyLog() {
  const text = props.run.log.value.map((e) => `[${e.at}] ${e.level}: ${e.text}`).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    notify.success('Log copied')
  } catch {
    notify.error('The log was not copied: the browser did not allow clipboard access.')
  }
}

// ── runs (C5 cursor pages) ──
const runs = ref([])
const runsCursor = ref(null)
const runsMore = ref(false)
const runsLoading = ref(false)
const runsError = ref('')
const runsLoaded = ref(false)
const metrics = ref(null)

function readPage(data) {
  if (!data || !Array.isArray(data.results)) throw new Error('The server sent the run list in a shape this page does not read.')
  const more = !!data.has_more
  if (more && !data.next_cursor) throw new Error('The server said there are more runs but did not say where the next page starts.')
  return { rows: data.results, cursor: more ? data.next_cursor : null, more }
}
async function loadRuns({ more = false } = {}) {
  if (runsLoading.value) return
  runsLoading.value = true
  runsError.value = ''
  try {
    const params = { limit: PAGE, ...(more && runsCursor.value ? { cursor: runsCursor.value } : {}) }
    const { data } = await props.api.getWorkflowGraphRuns(props.graphId, params)
    const page = readPage(data)
    runs.value = more ? [...runs.value, ...page.rows] : page.rows
    runsCursor.value = page.cursor
    runsMore.value = page.more
    runsLoaded.value = true
  } catch (e) {
    const s = e?.response?.status
    runsError.value = e?.response ? `Could not load the run history (error ${s}).` : (e?.message || 'Could not load the run history.')
  } finally {
    runsLoading.value = false
  }
  if (!more) {
    try { metrics.value = (await props.api.getWorkflowGraphMetrics(props.graphId)).data } catch { metrics.value = null }
  }
}
watch(tab, (t) => { if (t === 'runs' && !runsLoaded.value) loadRuns() })
async function openRun(id) {
  if (await props.run.openRun(id)) tab.value = 'timeline'
}

// ── timeline ──
const shown = computed(() => props.run.shownRun.value)
const timelineRows = computed(() => {
  const r = shown.value
  if (!r) return []
  const attempts = Array.isArray(r.timeline) && r.timeline.length ? r.timeline : (r.node_runs || [])
  return attempts.map((a, i) => ({
    key: `${a.node_id}#${a.attempt || 1}#${i}`,
    nodeId: a.node_id,
    title: titleOf(a.node_id),
    status: a.status,
    icon: NODE_STATUS_ICONS[a.status] || 'lucide:circle',
    label: NODE_STATUS_LABELS[a.status] || a.status,
    attempt: a.attempt || 1,
    time: fmtTime(a.started_at),
    duration: fmtDuration(a.duration_ms),
    error: a.error || a.error_code || '',
    superseded: !!a.superseded,
  }))
})
const mediaJobs = computed(() => (shown.value?.node_runs || []).filter((n) => n.output?.awaiting_media_job && n.output.job_id))
const canRerun = computed(() => shown.value?.status === 'failed' && !props.run.running.value)

// ── resize ──
let drag = null
function setHeight(v) { emit('update:height', Math.min(maxHeight.value, Math.max(MIN_H, Math.round(v)))) }
function startResize(e) {
  drag = { y: e.clientY, h: props.height }
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', endDrag)
  e.preventDefault()
}
function onDrag(e) { if (drag) setHeight(drag.h + (drag.y - e.clientY)) }
function endDrag() {
  drag = null
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', endDrag)
}
onBeforeUnmount(endDrag)
function onResizeKey(e) {
  const step = e.shiftKey ? 64 : 16
  if (e.key === 'ArrowUp') setHeight(props.height + step)
  else if (e.key === 'ArrowDown') setHeight(props.height - step)
  else if (e.key === 'Home') setHeight(MIN_H)
  else if (e.key === 'End') setHeight(maxHeight.value)
  else return
  e.preventDefault()
}

// The body is one render function used in both places (inline and in the sheet), so the two never drift apart.
const TABS = [['log', 'Log'], ['runs', 'Runs'], ['timeline', 'Timeline']]
const ConsoleBody = defineComponent({
  name: 'WfConsoleBody',
  setup() {
    const btn = (label, onClick, extra = {}) => h('button', { type: 'button', class: 'wfb-btn is-small', onClick, ...extra }, label)
    return () => h('div', { class: 'wfb-console__inner' }, [
      h('div', { class: 'wfb-console__tabs', role: 'tablist', 'aria-label': 'Console views' }, TABS.map(([id, label]) => h('button', {
        type: 'button', role: 'tab', id: `wfb-tab-${id}`, class: 'wfb-tab', 'aria-selected': tab.value === id ? 'true' : 'false',
        'aria-controls': `wfb-panel-${id}`, tabindex: tab.value === id ? 0 : -1,
        onClick: () => { tab.value = id },
        onKeydown: (e) => {
          const i = TABS.findIndex(([t]) => t === tab.value)
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            tab.value = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0]
            nextTick(() => document.getElementById(`wfb-tab-${tab.value}`)?.focus())
          }
        },
      }, label))),
      h('div', { id: `wfb-panel-${tab.value}`, role: 'tabpanel', 'aria-labelledby': `wfb-tab-${tab.value}`, class: 'wfb-console__panel' }, [
        tab.value === 'log' ? logPanel() : tab.value === 'runs' ? runsPanel() : timelinePanel(),
      ]),
    ])

    function logPanel() {
      return [
        h('div', { class: 'wfb-console__tools' }, [
          h('button', { type: 'button', class: 'wfb-btn is-small', 'aria-pressed': errorsOnly.value ? 'true' : 'false', onClick: () => { errorsOnly.value = !errorsOnly.value } }, [h(Icon, { icon: 'lucide:filter', 'aria-hidden': 'true' }), 'Errors only']),
          btn('Copy log', copyLog, { disabled: !props.run.log.value.length }),
        ]),
        h('div', { ref: (el) => { logEl.value = el }, class: 'wfb-console__log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Run log' },
          logRows.value.length
            ? logRows.value.map((e) => h('div', { key: e.id, class: ['wfb-log-line', `is-${e.level}`] }, [
              h(Icon, { icon: LOG_ICON[e.level] || 'lucide:info', class: 'wfb-log-line__ic', 'aria-hidden': 'true' }),
              h('time', { class: 'wfb-log-line__t', datetime: e.at }, fmtTime(e.at)),
              h('span', { class: 'wfb-log-line__msg' }, e.text),
            ]))
            : [h('p', { class: 'wfb-console__empty' }, props.run.log.value.length ? 'No errors in this run.' : 'Nothing yet. Test or run the workflow to see each step here.')]),
      ]
    }

    function runsPanel() {
      const m = metrics.value
      return [
        m ? h('dl', { class: 'wfb-metrics' }, [
          ['Success', m.success_rate != null ? `${Math.round(m.success_rate * 100)}%` : 'None yet'],
          ['Average time', fmtDuration(m.avg_duration_ms) || 'None yet'],
          ['Total cost', costFmt.format(Number(m.total_cost || 0))],
          ['Runs', String(m.total_runs ?? 0)],
        ].map(([k, v]) => h('div', { class: 'wfb-metric' }, [h('dt', k), h('dd', v)]))) : null,
        runsError.value
          ? h('p', { class: 'wfb-console__error', role: 'alert' }, [runsError.value, ' ', btn('Try again', () => loadRuns())])
          : null,
        runsLoading.value && !runs.value.length ? h('p', { class: 'wfb-console__empty', role: 'status' }, 'Loading runs…') : null,
        runsLoaded.value && !runs.value.length && !runsError.value ? h('p', { class: 'wfb-console__empty' }, 'No runs yet. Test or run the workflow.') : null,
        runs.value.length ? h('ul', { class: 'wfb-run-list' }, runs.value.map((r) => h('li', { key: r.id }, [
          h('button', {
            type: 'button', class: ['wfb-run-row', { 'is-current': props.run.viewed.value?.id === r.id }],
            onClick: () => openRun(r.id),
          }, [
            h(Icon, { icon: RUN_ICON[r.status] || (runStopKind(r.status) ? 'lucide:circle' : 'lucide:loader-circle'), class: `is-${RUN_TONE[r.status] || 'running'}`, 'aria-hidden': 'true' }),
            h('span', { class: 'wfb-run-row__id' }, `Run #${r.id}`),
            r.dry_run ? h('span', { class: 'wfb-tag' }, 'test') : null,
            h('span', { class: 'wfb-run-row__status' }, r.status),
            h('span', { class: 'wfb-run-row__dur' }, fmtDuration(r.duration_ms)),
            h('time', { class: 'wfb-run-row__time', datetime: r.created_at }, fmtDate(r.created_at)),
          ]),
        ]))) : null,
        runsMore.value ? btn(runsLoading.value ? 'Loading…' : 'Load more runs', () => loadRuns({ more: true }), { disabled: runsLoading.value }) : null,
      ]
    }

    function timelinePanel() {
      const r = shown.value
      if (!r) return [h('p', { class: 'wfb-console__empty' }, 'Run the workflow, or open a run from the Runs tab, to see every attempt here.')]
      return [
        h('div', { class: 'wfb-console__tools' }, [
          h('span', { class: 'wfb-console__run-title' }, `Run #${r.id}: ${r.status}${r.duration_ms != null ? `, ${fmtDuration(r.duration_ms)}` : ''}`),
          props.run.viewingPast.value ? btn('Back to the live view', () => props.run.closeRun()) : null,
          canRerun.value ? btn('Re-run the failed steps', () => emit('rerun')) : null,
        ]),
        mediaJobs.value.length ? h(StudioJobList, { ids: mediaJobs.value.map((n) => n.output.job_id) }) : null,
        timelineRows.value.length ? h('ol', { class: 'wfb-timeline' }, timelineRows.value.map((row) => h('li', { key: row.key }, [
          h('button', { type: 'button', class: ['wfb-tl-row', { 'is-superseded': row.superseded }], onClick: () => emit('focus-node', row.nodeId) }, [
            h('time', { class: 'wfb-tl-row__t' }, row.time),
            h(Icon, { icon: row.icon, class: `is-${row.status}`, 'aria-hidden': 'true' }),
            h('span', { class: 'wfb-tl-row__title' }, row.title),
            h('span', { class: 'wfb-tl-row__status' }, row.attempt > 1 ? `${row.label}, try ${row.attempt}` : row.label),
            row.duration ? h('span', { class: 'wfb-tl-row__dur' }, row.duration) : null,
            row.error ? h('span', { class: 'wfb-tl-row__err' }, row.error) : null,
          ]),
        ]))) : h('p', { class: 'wfb-console__empty' }, 'No step has started yet.'),
      ]
    }
  },
})

defineExpose({
  refresh: () => { if (runsLoaded.value || tab.value === 'runs') loadRuns() },
  showTab: (t) => { tab.value = t },
})
</script>
