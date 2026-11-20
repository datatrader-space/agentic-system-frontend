<script setup>
/**
 * Workflow operations — ADM-278 / P7.
 *
 * The page answers ONE question first: what needs a human right now. "Nothing happened" is this
 * domain's failure mode — a dead-lettered run produces no error anybody sees, so a page that merely
 * listed runs would let one sit unnoticed indefinitely. The attention row is therefore above the list,
 * not a filter inside it.
 *
 * Distinct from the builder's per-workflow run list: the run an operator needs to find is on whichever
 * workflow they were not looking at.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, RefreshCw, RotateCw } from 'lucide-vue-next'
import api from '../services/api'
import { useNotify } from '../composables/useNotify'
import { useConfirm } from '../composables/useConfirm'
import { useRequestScope, isAbortError } from '../composables/useRequestScope'
import LoadError from '../components/common/LoadError.vue'
import StudioJobList from '../components/studio/StudioJobList.vue'

const notify = useNotify()
const confirm = useConfirm()

const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const hasMore = ref(false)
const nextCursor = ref(null)
const runs = ref([])
const PAGE = 50
// One scope for the list (a filter change aborts the previous filter's request, so its late answer
// cannot replace the new filter's rows) and one for the timeline (a click on run B drops run A's).
const listScope = useRequestScope()
const timelineScope = useRequestScope()
const attention = ref(null)
const statusFilter = ref('')
const attentionOnly = ref(false)

const selected = ref(null)
const timeline = ref(null)
const timelineLoading = ref(false)

const STATUS_TONE = {
  success: 'ok', running: 'busy', queued: 'busy', waiting: 'wait', paused: 'wait',
  failed: 'bad', cancelled: 'muted', blocked: 'bad', dead: 'bad',
}

// `dead` is not `failed`. Failed says it did not work; dead says it stopped, why, and what to do.
const STATUS_HINT = {
  dead: 'Retries exhausted — this needs a person.',
  blocked: 'Cannot proceed without a decision.',
  waiting: 'Waiting on a timer or an approval.',
  paused: 'An operator paused this.',
}

// The run statuses the filter offers: the run model's own list (WorkflowGraphRun.STATUS_CHOICES).
const RUN_STATUSES = ['queued', 'running', 'waiting', 'paused', 'success', 'failed', 'cancelled', 'blocked', 'dead']

// Which control applies in which state, as the backend decides it (agent/services/workflow_graph/inspection.py):
// - `pause` refuses a terminal run (WorkflowGraphRun.TERMINAL_STATUSES: success, failed, cancelled, dead). A run
//   that is already paused is left out too: pausing it again changes nothing.
// - `resume` accepts only a `paused` or `waiting` run.
// A button for a state the server refuses is a button that can only ever answer with an error.
const PAUSABLE = new Set(['queued', 'running', 'waiting', 'blocked'])
const RESUMABLE = new Set(['paused', 'waiting'])

const CONTROL_DONE = { pause: 'Run paused.', resume: 'Run resumed.', replay: 'Replay started.' }

const needsAction = computed(() =>
  (attention.value?.dead || 0) + (attention.value?.blocked || 0))

// The run detail is the newest word on the run's state; the list row is what was true when the list loaded.
const selectedStatus = computed(() => timeline.value?.status || selected.value?.status || '')
const canPause = computed(() => PAUSABLE.has(selectedStatus.value))
const canResume = computed(() => RESUMABLE.has(selectedStatus.value))

function listParams(cursor) {
  const params = { limit: PAGE }
  if (cursor) params.cursor = cursor
  if (statusFilter.value) params.status = statusFilter.value
  if (attentionOnly.value) params.needs_attention = 'true'
  return params
}

class RunsShapeError extends Error {}

/**
 * One page of the runs list, in the cursor shape of contract C5: `{results, next_cursor, has_more}`.
 * Any other shape is refused with a reason, never read as "no runs".
 */
function readPage(data) {
  if (data && Array.isArray(data.results)) {
    const more = !!data.has_more
    if (more && !data.next_cursor) {
      throw new RunsShapeError('The server said there are more runs but did not say where the next page starts.')
    }
    return { rows: data.results, cursor: more ? data.next_cursor : null, more }
  }
  throw new RunsShapeError('The server sent the runs list in a shape this page does not read.')
}

async function load() {
  const signal = listScope.next()
  loading.value = true
  loadingMore.value = false
  loadError.value = ''
  try {
    const { data } = await api.get('/workflow-runs/', { params: listParams(null), signal })
    if (signal.aborted) return
    const page = readPage(data)
    runs.value = page.rows
    nextCursor.value = page.cursor
    hasMore.value = page.more
    if (data?.attention) attention.value = data.attention
    // Keep the open run on its fresh row, so the detail does not show a status the list has moved past.
    if (selected.value) selected.value = runs.value.find((r) => r.id === selected.value.id) || selected.value
  } catch (e) {
    if (isAbortError(e) || signal.aborted) return
    runs.value = []
    hasMore.value = false
    nextCursor.value = null
    loadError.value = e instanceof RunsShapeError ? e.message : 'Check your connection and try again.'
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

// The next page starts at the server's cursor, so a run that starts meanwhile does not shift the pages.
async function loadMore() {
  if (loadingMore.value || !hasMore.value || !nextCursor.value) return
  const signal = listScope.next()
  loadingMore.value = true
  try {
    const { data } = await api.get('/workflow-runs/', { params: listParams(nextCursor.value), signal })
    if (signal.aborted) return
    const page = readPage(data)
    const seen = new Set(runs.value.map((r) => r.id))
    runs.value = runs.value.concat(page.rows.filter((r) => !seen.has(r.id)))
    nextCursor.value = page.cursor
    hasMore.value = page.more
  } catch (e) {
    if (isAbortError(e) || signal.aborted) return
    notify.error(e instanceof RunsShapeError ? e.message : 'Could not load more runs.')
  } finally {
    if (!signal.aborted) loadingMore.value = false
  }
}

async function openRun(run) {
  const signal = timelineScope.next()
  selected.value = run
  timeline.value = null
  timelineLoading.value = true
  try {
    const { data } = await api.get(`/workflow-graph-runs/${run.id}/timeline/`, { signal })
    if (signal.aborted) return
    timeline.value = data
  } catch (e) {
    if (isAbortError(e) || signal.aborted) return
    notify.error('Could not load the run timeline.')
  } finally {
    if (!signal.aborted) timelineLoading.value = false
  }
}

// One control at a time: a second press while the first is in flight would act on a state already gone.
const controlBusy = ref(false)

async function control(action, extra = {}) {
  if (!selected.value || controlBusy.value) return
  controlBusy.value = true
  try {
    await api.controlWorkflowRun(selected.value.id, action, extra)
    notify.success(CONTROL_DONE[action])
    await load()
    await openRun(selected.value)
  } catch (e) {
    notify.error(e?.response?.data?.error || `Could not ${action} the run.`)
  } finally {
    controlBusy.value = false
  }
}

/**
 * `reuse_input` is chosen by WHICH BUTTON was pressed, never by a binary confirm.
 *
 * `confirm()` resolves false for "cancel" AND for a dismissal (escape, backdrop). Mapping false to
 * "start fresh" would mean pressing Escape silently starts a run — one that spends budget and writes to
 * the customer's systems. A dismissal must decide nothing, so the two replay modes are two buttons and
 * the confirm is a plain yes/no on the mode the operator already picked.
 */
async function replay(reuseInput) {
  if (!selected.value) return
  const ok = await confirm({
    title: reuseInput ? 'Replay with the original input?' : 'Replay with fresh input?',
    message: reuseInput
      ? 'This re-runs the workflow against the SAME trigger data as the original run. Nodes that '
        + 'already succeeded are not re-executed, so their external effects are not repeated.'
      : 'This re-runs the workflow with an EMPTY trigger payload, against whatever is current. '
        + 'Nodes that already succeeded are not re-executed.',
    confirmText: 'Start replay',
    cancelText: 'Cancel',
  })
  if (!ok) return
  await control('replay', { reuse_input: reuseInput })
}

// A link to one run (a sub-workflow run from the builder: {name: 'dashboard-workflow-runs', query: {run: <id>}})
// opens it on load. A run that is not on the first page is opened by its id; its timeline brings its status.
const route = useRoute()
function openFromQuery() {
  const id = Number(route?.query?.run)
  if (!Number.isInteger(id) || id <= 0 || selected.value?.id === id) return
  openRun(runs.value.find((r) => r.id === id) || { id, workflow_name: `Run #${id}` })
}
onMounted(async () => {
  await load()
  openFromQuery()
})
watch(() => route?.query?.run, openFromQuery)
</script>

<template>
  <div class="wf-ops">
    <header class="wf-ops__head">
      <div>
        <!-- This page has no sidebar entry of its own — it is reached from the Workflow Builder page.
             The way back has to be ON the page, or the only route out is the browser's back button. -->
        <router-link to="/dashboard/workflow-builder" class="wf-ops__back">
          <ArrowLeft :size="14" :stroke-width="2" aria-hidden="true" /> Workflow Builder
        </router-link>
        <h1 class="wf-ops__title">Workflow operations</h1>
        <p class="wf-ops__sub">Every workflow run, newest first — across all your workflows.</p>
      </div>
      <button class="btn" :disabled="loading" @click="load">
        <RefreshCw :size="14" :stroke-width="2" aria-hidden="true" /> Refresh
      </button>
    </header>

    <!-- Attention first. A dead run produces no error anybody sees; burying it in a filter is how it
         sits unnoticed for a week. -->
    <section v-if="attention" class="wf-attn" :class="{ 'wf-attn--clear': !needsAction }">
      <template v-if="needsAction">
        <strong>{{ needsAction }} run{{ needsAction === 1 ? '' : 's' }} need attention</strong>
        <span v-if="attention.dead">{{ attention.dead }} dead</span>
        <span v-if="attention.blocked">{{ attention.blocked }} blocked</span>
        <button class="btn btn--link" @click="attentionOnly = true; load()">Show only these</button>
      </template>
      <template v-else>
        <strong>Nothing needs attention.</strong>
      </template>
      <span v-if="attention.waiting_on_a_human" class="wf-attn__soft">
        {{ attention.waiting_on_a_human }} waiting on a human
      </span>
      <!-- A `running` row whose lease lapsed is a run whose worker died. `status` alone cannot tell
           that apart from healthy progress, so it is surfaced separately rather than folded in. -->
      <span v-if="attention.abandoned_pending_recovery" class="wf-attn__soft">
        {{ attention.abandoned_pending_recovery }} abandoned, awaiting recovery
      </span>
    </section>

    <div class="wf-ops__filters">
      <label class="wf-ops__field" for="wf-ops-status">
        <span>Status</span>
        <select id="wf-ops-status" v-model="statusFilter" class="wf-ops__select" @change="load">
          <option value="">All statuses</option>
          <option v-for="s in RUN_STATUSES" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <label class="wf-ops__check">
        <input type="checkbox" v-model="attentionOnly" @change="load" />
        Needs attention only
      </label>
    </div>

    <div class="wf-ops__body">
      <table class="wf-table">
        <thead>
          <tr><th>Workflow</th><th>Status</th><th>Trigger</th><th>Version</th><th>Started</th></tr>
        </thead>
        <tbody>
          <!-- The row is clickable for a mouse; the button in its first cell is the way in for a keyboard
               (Tab to it, Enter or Space opens the run), and it keeps the table a table for a screen reader. -->
          <tr v-for="run in runs" :key="run.id"
              :class="{ 'is-selected': selected?.id === run.id }" @click="openRun(run)">
            <td>
              <button type="button" class="wf-table__open"
                      :aria-current="selected?.id === run.id ? 'true' : undefined"
                      :aria-label="`Open the run of ${run.workflow_name}, ${run.status}`"
                      @click.stop="openRun(run)">{{ run.workflow_name }}</button>
            </td>
            <td>
              <span class="pill" :class="`pill--${STATUS_TONE[run.status] || 'muted'}`"
                    :title="STATUS_HINT[run.status] || ''">{{ run.status }}</span>
              <span v-if="run.recovery_count" class="wf-table__note"
                    :aria-label="`Reclaimed ${run.recovery_count} time${run.recovery_count === 1 ? '' : 's'} after its worker died`"
                    title="This run has been reclaimed after its worker died. A climbing count means it keeps killing workers.">
                <RotateCw :size="12" :stroke-width="2" aria-hidden="true" />{{ run.recovery_count }}
              </span>
            </td>
            <td>{{ run.trigger_kind }}</td>
            <td>{{ run.version ?? '—' }}</td>
            <td>{{ run.started_at ? new Date(run.started_at).toLocaleString() : '—' }}</td>
          </tr>
          <tr v-if="loadError && !loading">
            <td colspan="5">
              <LoadError title="Couldn't load workflow runs" :message="loadError" compact @retry="load" />
            </td>
          </tr>
          <tr v-else-if="!runs.length && !loading">
            <td colspan="5" class="wf-table__empty">No runs match this filter.</td>
          </tr>
          <tr v-if="hasMore && !loading && !loadError">
            <td colspan="5" class="wf-table__empty">
              <button class="btn" :disabled="loadingMore" @click.stop="loadMore">{{ loadingMore ? 'Loading…' : 'Load more' }}</button>
            </td>
          </tr>
        </tbody>
      </table>

      <aside v-if="selected" class="wf-detail" aria-labelledby="wf-detail-title">
        <h2 id="wf-detail-title" class="wf-detail__title">{{ selected.workflow_name }}</h2>

        <div v-if="selected.dead_reason" class="wf-dead">
          <strong>Why it stopped</strong>
          <p>{{ selected.dead_reason }}</p>
          <strong>What to do</strong>
          <p>{{ selected.recovery_action }}</p>
        </div>

        <div class="wf-detail__actions">
          <button v-if="canPause" class="btn" :disabled="controlBusy" @click="control('pause')">Pause</button>
          <button v-if="canResume" class="btn" :disabled="controlBusy" @click="control('resume')">Resume</button>
          <button class="btn" :disabled="controlBusy" @click="replay(true)">Replay (same input)</button>
          <button class="btn" :disabled="controlBusy" @click="replay(false)">Replay (fresh input)</button>
        </div>

        <p v-if="timelineLoading" role="status">Loading timeline…</p>
        <template v-else-if="timeline">
          <div v-if="timeline.failed_node" class="wf-failed">
            <strong>Failed at {{ timeline.failed_node.node_id }}</strong>
            <p>{{ timeline.failed_node.error }}</p>
            <!-- The operator's real question. `unsafe_write` means a retry may duplicate a real
                 effect, and saying so here is cheaper than them finding out afterwards. -->
            <p class="wf-failed__safety" :class="{ 'is-unsafe': !timeline.failed_node.safe_to_retry }">
              {{ timeline.failed_node.safe_to_retry
                 ? 'Safe to retry — this node does not repeat an external write.'
                 : 'NOT safe to auto-retry — repeating this node may duplicate a real effect.' }}
            </p>
          </div>
          <div v-if="timeline.last_checkpoint" class="wf-checkpoint">
            Last completed: <strong>{{ timeline.last_checkpoint.node_id }}</strong>
          </div>

          <h3>Attempts</h3>
          <StudioJobList v-for="node in (timeline.node_runs || []).filter(n => n.output?.awaiting_media_job && n.output.job_id)" :key="node.id" :ids="[node.output.job_id]" @settled="openRun(selected)" />
          <!-- EVERY attempt, not just the latest. The earlier one is what tells an operator whether a
               retry would repeat a side effect. -->
          <ol class="wf-timeline">
            <li v-for="(row, i) in timeline.timeline" :key="i"
                :class="{ 'is-superseded': row.superseded }">
              <span class="pill" :class="`pill--${STATUS_TONE[row.status] || 'muted'}`">{{ row.status }}</span>
              <code>{{ row.node_id }}</code>
              <span class="wf-timeline__meta">#{{ row.attempt }}</span>
              <span v-if="row.duration_ms" class="wf-timeline__meta">{{ row.duration_ms }}ms</span>
              <span v-if="row.error_code" class="wf-timeline__err">{{ row.error_code }}</span>
              <span v-if="row.superseded" class="wf-timeline__meta"
                    :title="row.superseded_reason">superseded</span>
            </li>
          </ol>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* Every colour is a --vm-* token, so [data-theme="dark"] in style.css re-skins the page (F2). */
.wf-ops { padding: 1.5rem; color: var(--vm-ink); }
.wf-ops__back {
  display: inline-flex; align-items: center; gap: 4px; margin-bottom: 6px; font-size: 12px; font-weight: 700;
  color: var(--vm-ink-faint); text-decoration: none; border-radius: 6px;
}
.wf-ops__back:hover { color: var(--vm-link); }
.wf-ops__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
.wf-ops__title { font-size: 22px; font-weight: 800; color: var(--vm-ink); margin: 0; }
.wf-ops__sub { color: var(--vm-ink-faint); margin: .25rem 0 0; }

.btn {
  display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px;
  border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface);
  color: var(--vm-ink-soft); font-size: 12px; font-weight: 700; cursor: pointer;
}
.btn:hover:not(:disabled) { background: var(--vm-surface-soft); color: var(--vm-ink); }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn--link {
  min-height: 0; padding: 0; border: none; background: none; color: var(--vm-link); text-decoration: underline;
}
.btn--link:hover:not(:disabled) { background: none; color: var(--vm-link); }

.wf-attn {
  display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;
  margin: 1rem 0; padding: .75rem 1rem; border-radius: 8px;
  background: var(--vm-red-soft); border: 1px solid color-mix(in srgb, var(--vm-red-ink) 30%, transparent);
}
.wf-attn--clear {
  background: var(--vm-green-soft); border-color: color-mix(in srgb, var(--vm-green-ink) 30%, transparent);
}
.wf-attn__soft { color: var(--vm-ink-soft); font-size: .9em; }

.wf-ops__filters { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
.wf-ops__field { display: inline-flex; align-items: center; gap: .5rem; font-size: 13px; font-weight: 600; color: var(--vm-ink-soft); }
.wf-ops__select {
  min-height: 32px; padding: 0 8px; border: 1px solid var(--vm-line-2); border-radius: 8px;
  background: var(--vm-surface); color: var(--vm-ink); font-size: 13px;
}
.wf-ops__check { display: flex; gap: .4rem; align-items: center; color: var(--vm-ink-soft); font-size: 13px; }
.wf-ops__check input { accent-color: var(--vm-primary); width: 16px; height: 16px; }

.wf-ops__body { display: grid; grid-template-columns: 1fr minmax(320px, 420px); gap: 1.5rem; }
@media (max-width: 900px) { .wf-ops__body { grid-template-columns: 1fr; } }
.wf-table { width: 100%; border-collapse: collapse; }
.wf-table th { color: var(--vm-ink-faint); font-size: 12px; font-weight: 700; }
.wf-table th, .wf-table td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid var(--vm-line-2); }
.wf-table tbody tr { cursor: pointer; }
.wf-table tbody tr:hover, .wf-table tr.is-selected { background: var(--vm-surface-soft); }
.wf-table__open {
  padding: 2px 4px; margin: -2px -4px; border: none; border-radius: 6px; background: none;
  color: var(--vm-ink); font: inherit; font-weight: 600; text-align: left; cursor: pointer;
}
.wf-table__open:hover { color: var(--vm-link); text-decoration: underline; }
.wf-table__empty { text-align: center; color: var(--vm-ink-faint); padding: 2rem; }
.wf-table__note {
  display: inline-flex; align-items: center; gap: 2px; margin-left: .4rem; color: var(--vm-ink-faint); font-size: .85em;
}

.pill { display: inline-block; padding: .1rem .5rem; border-radius: 999px; font-size: .8em; font-weight: 600; }
.pill--ok { background: var(--vm-green-soft); color: var(--vm-green-ink); }
.pill--bad { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.pill--busy { background: var(--vm-blue-soft); color: var(--vm-link); }
.pill--wait { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.pill--muted { background: var(--vm-surface-soft); color: var(--vm-ink-soft); }

.wf-detail { border-left: 1px solid var(--vm-line-2); padding-left: 1.25rem; }
@media (max-width: 900px) { .wf-detail { border-left: none; border-top: 1px solid var(--vm-line-2); padding: 1rem 0 0; } }
.wf-detail__title { font-size: 17px; font-weight: 800; color: var(--vm-ink); margin: 0; }
.wf-detail h3 { font-size: 13px; font-weight: 700; color: var(--vm-ink); margin: 1rem 0 .5rem; }
.wf-detail__actions { display: flex; flex-wrap: wrap; gap: .5rem; margin: .75rem 0 1rem; }
.wf-dead, .wf-failed { background: var(--vm-red-soft); padding: .75rem; border-radius: 6px; margin-bottom: .75rem; }
.wf-dead p, .wf-failed p { margin: .25rem 0 .6rem; }
.wf-failed__safety { font-weight: 600; }
.wf-failed__safety.is-unsafe { color: var(--vm-red-ink); }
.wf-checkpoint { margin-bottom: 1rem; color: var(--vm-ink-soft); }
.wf-timeline { list-style: none; padding: 0; margin: 0; }
.wf-timeline li { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; padding: .35rem 0; border-bottom: 1px solid var(--vm-line-2); }
/* A superseded attempt reads as older by its strike-through and its label, not by fading it below 4.5:1. */
.wf-timeline li.is-superseded code { text-decoration: line-through; color: var(--vm-ink-faint); }
.wf-timeline__meta { color: var(--vm-ink-faint); font-size: .85em; }
.wf-timeline__err { color: var(--vm-red-ink); font-size: .85em; }

@media (pointer: coarse) {
  .btn, .wf-ops__select { min-height: 44px; }
  .wf-table__open { min-height: 44px; }
}
</style>
