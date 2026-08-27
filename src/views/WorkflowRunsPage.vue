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
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import { useNotify } from '../composables/useNotify'
import { useConfirm } from '../composables/useConfirm'

const notify = useNotify()
const confirm = useConfirm()

const loading = ref(false)
const runs = ref([])
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

const needsAction = computed(() =>
  (attention.value?.dead || 0) + (attention.value?.blocked || 0))

async function load() {
  loading.value = true
  try {
    const params = { limit: 50 }
    if (statusFilter.value) params.status = statusFilter.value
    if (attentionOnly.value) params.needs_attention = 'true'
    const { data } = await api.getWorkflowOpsRuns(params)
    runs.value = data.items || []
    if (data.attention) attention.value = data.attention
  } catch (e) {
    notify.error('Could not load workflow runs.')
  } finally {
    loading.value = false
  }
}

async function openRun(run) {
  selected.value = run
  timeline.value = null
  timelineLoading.value = true
  try {
    const { data } = await api.getWorkflowRunTimeline(run.id)
    timeline.value = data
  } catch (e) {
    notify.error('Could not load the run timeline.')
  } finally {
    timelineLoading.value = false
  }
}

async function control(action, extra = {}) {
  if (!selected.value) return
  try {
    await api.controlWorkflowRun(selected.value.id, action, extra)
    notify.success(`Run ${action}d.`)
    await load()
    await openRun(selected.value)
  } catch (e) {
    notify.error(e?.response?.data?.error || `Could not ${action} the run.`)
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

onMounted(load)
</script>

<template>
  <div class="wf-ops">
    <header class="wf-ops__head">
      <div>
        <!-- This page has no sidebar entry of its own — it is reached from the Workflow Builder page.
             The way back has to be ON the page, or the only route out is the browser's back button. -->
        <router-link to="/dashboard/workflow-builder" class="wf-ops__back">← Workflow Builder</router-link>
        <h1>Workflow operations</h1>
        <p class="wf-ops__sub">Every workflow run, newest first — across all your workflows.</p>
      </div>
      <button class="btn" :disabled="loading" @click="load">Refresh</button>
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
      <select v-model="statusFilter" @change="load">
        <option value="">All statuses</option>
        <option v-for="s in ['queued','running','waiting','paused','success','failed','cancelled','blocked','dead']"
                :key="s" :value="s">{{ s }}</option>
      </select>
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
          <tr v-for="run in runs" :key="run.id"
              :class="{ 'is-selected': selected?.id === run.id }" @click="openRun(run)">
            <td>{{ run.workflow_name }}</td>
            <td>
              <span class="pill" :class="`pill--${STATUS_TONE[run.status] || 'muted'}`"
                    :title="STATUS_HINT[run.status] || ''">{{ run.status }}</span>
              <span v-if="run.recovery_count" class="wf-table__note"
                    title="This run has been reclaimed after its worker died. A climbing count means it keeps killing workers.">
                ↻{{ run.recovery_count }}
              </span>
            </td>
            <td>{{ run.trigger_kind }}</td>
            <td>{{ run.version ?? '—' }}</td>
            <td>{{ run.started_at ? new Date(run.started_at).toLocaleString() : '—' }}</td>
          </tr>
          <tr v-if="!runs.length && !loading">
            <td colspan="5" class="wf-table__empty">No runs match this filter.</td>
          </tr>
        </tbody>
      </table>

      <aside v-if="selected" class="wf-detail">
        <h2>{{ selected.workflow_name }}</h2>

        <div v-if="selected.dead_reason" class="wf-dead">
          <strong>Why it stopped</strong>
          <p>{{ selected.dead_reason }}</p>
          <strong>What to do</strong>
          <p>{{ selected.recovery_action }}</p>
        </div>

        <div class="wf-detail__actions">
          <button class="btn" @click="control('pause')">Pause</button>
          <button class="btn" @click="control('resume')">Resume</button>
          <button class="btn" @click="replay(true)">Replay (same input)</button>
          <button class="btn" @click="replay(false)">Replay (fresh input)</button>
        </div>

        <p v-if="timelineLoading">Loading timeline…</p>
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
.wf-ops__back {
  display: inline-block; margin-bottom: 6px; font-size: 12px; font-weight: 700;
  color: #64748b; text-decoration: none;
}
.wf-ops__back:hover { color: #2563eb; }

.wf-ops { padding: 1.5rem; }
.wf-ops__head { display: flex; justify-content: space-between; align-items: flex-start; }
.wf-ops__sub { color: var(--vm-text-muted, #6b7280); margin: .25rem 0 0; }
.wf-attn {
  display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;
  margin: 1rem 0; padding: .75rem 1rem; border-radius: 8px;
  background: var(--vm-danger-bg, #fef2f2); border: 1px solid var(--vm-danger-border, #fecaca);
}
.wf-attn--clear { background: var(--vm-ok-bg, #f0fdf4); border-color: var(--vm-ok-border, #bbf7d0); }
.wf-attn__soft { color: var(--vm-text-muted, #6b7280); font-size: .9em; }
.wf-ops__filters { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; }
.wf-ops__check { display: flex; gap: .4rem; align-items: center; }
.wf-ops__body { display: grid; grid-template-columns: 1fr minmax(320px, 420px); gap: 1.5rem; }
@media (max-width: 900px) { .wf-ops__body { grid-template-columns: 1fr; } }
.wf-table { width: 100%; border-collapse: collapse; }
.wf-table th, .wf-table td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid var(--vm-border, #e5e7eb); }
.wf-table tbody tr { cursor: pointer; }
.wf-table tbody tr:hover, .wf-table tr.is-selected { background: var(--vm-surface-hover, #f9fafb); }
.wf-table__empty { text-align: center; color: var(--vm-text-muted, #6b7280); padding: 2rem; }
.wf-table__note { margin-left: .4rem; color: var(--vm-text-muted, #6b7280); font-size: .85em; }
.pill { display: inline-block; padding: .1rem .5rem; border-radius: 999px; font-size: .8em; }
.pill--ok { background: #dcfce7; color: #166534; }
.pill--bad { background: #fee2e2; color: #991b1b; }
.pill--busy { background: #dbeafe; color: #1e40af; }
.pill--wait { background: #fef3c7; color: #92400e; }
.pill--muted { background: #f3f4f6; color: #374151; }
.wf-detail { border-left: 1px solid var(--vm-border, #e5e7eb); padding-left: 1.25rem; }
.wf-detail__actions { display: flex; gap: .5rem; margin: .75rem 0 1rem; }
.wf-dead, .wf-failed { background: var(--vm-danger-bg, #fef2f2); padding: .75rem; border-radius: 6px; margin-bottom: .75rem; }
.wf-dead p, .wf-failed p { margin: .25rem 0 .6rem; }
.wf-failed__safety { font-weight: 600; }
.wf-failed__safety.is-unsafe { color: #991b1b; }
.wf-checkpoint { margin-bottom: 1rem; color: var(--vm-text-muted, #6b7280); }
.wf-timeline { list-style: none; padding: 0; margin: 0; }
.wf-timeline li { display: flex; gap: .5rem; align-items: center; padding: .35rem 0; border-bottom: 1px solid var(--vm-border, #f3f4f6); }
.wf-timeline li.is-superseded { opacity: .55; }
.wf-timeline__meta { color: var(--vm-text-muted, #6b7280); font-size: .85em; }
.wf-timeline__err { color: #991b1b; font-size: .85em; }
.btn--link { background: none; border: none; color: #1d4ed8; cursor: pointer; text-decoration: underline; }
</style>
