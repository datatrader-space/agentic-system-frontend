<!-- The learning pipeline itself: is every finished run reviewed, what is stuck, what failed, what it costs,
     and the recovery sweep that retries runs which never entered it. -->
<template>
  <div class="pipeline">
    <div class="kpis">
      <div class="kpi"><span class="kpi-label">Runs reviewed</span><strong class="kpi-value">{{ formatNumber(reviewed) }}</strong><span class="kpi-note">of {{ formatNumber(runs.total) }} learning passes</span></div>
      <div class="kpi"><span class="kpi-label">Waiting for a model</span><strong class="kpi-value" :class="{ warn: pending }">{{ formatNumber(pending) }}</strong><span class="kpi-note">{{ pending ? 'No summarize model was available; the sweep retries them' : 'Nothing waiting' }}</span></div>
      <div class="kpi"><span class="kpi-label">Errors</span><strong class="kpi-value" :class="{ bad: errors }">{{ formatNumber(errors) }}</strong><span class="kpi-note">learning passes that failed</span></div>
      <div class="kpi"><span class="kpi-label">Learning spend</span><strong class="kpi-value">{{ formatMoney(cost.total_cost_usd) }}</strong><span class="kpi-note">{{ formatNumber(cost.calls) }} model calls · {{ formatNumber((cost.prompt_tokens || 0) + (cost.completion_tokens || 0)) }} tokens</span></div>
    </div>

    <section class="panel" aria-labelledby="sweep-title">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="section-icon violet"><Icon icon="lucide:timer-reset" /></span>
          <div><h2 id="sweep-title">Recovery sweep</h2><p>Retries finished runs that did not enter the learning pipeline.</p></div>
        </div>
        <span class="status-badge" :class="sched.enabled ? 'success' : 'neutral'"><span class="status-dot"></span>{{ sched.enabled ? 'Active' : 'Paused' }}</span>
      </div>
      <div v-if="!sched.available" class="empty-state compact">
        <Icon icon="lucide:calendar-x-2" /><span>The periodic task schedule is unavailable on this deployment.</span>
      </div>
      <template v-else>
        <div class="schedule-body">
          <label class="field interval-field" for="learning-interval">
            <span>Run every (minutes)</span>
            <input id="learning-interval" v-model.number="intervalMinutes" type="number" min="1" step="1" />
          </label>
          <div class="presets" role="group" aria-label="Interval presets">
            <button v-for="p in presets" :key="p.m" type="button" class="subtab" :class="{ active: intervalMinutes === p.m }" @click="intervalMinutes = p.m">{{ p.label }}</button>
          </div>
          <label class="switch-control">
            <input v-model="enabled" type="checkbox" />
            <span class="switch" aria-hidden="true"></span>
            <span>{{ enabled ? 'Sweep enabled' : 'Sweep paused' }}</span>
          </label>
          <div class="schedule-actions">
            <button type="button" class="button primary" :disabled="saving || !dirty" @click="saveSchedule"><Icon icon="lucide:save" /> {{ saving ? 'Saving…' : 'Save changes' }}</button>
            <button type="button" class="button secondary" :disabled="sweeping" @click="runNow"><Icon icon="lucide:play" /> {{ sweeping ? 'Queueing…' : 'Run now' }}</button>
          </div>
        </div>
        <div class="schedule-meta">
          <span><Icon icon="lucide:repeat-2" /> Every <strong>{{ prettyInterval(sched.interval_seconds) }}</strong></span>
          <span><Icon icon="lucide:activity" /> {{ formatNumber(sched.total_run_count || 0) }} sweeps</span>
          <span v-if="sched.last_run_at"><Icon icon="lucide:history" /> Last run {{ shortTime(sched.last_run_at) }}</span>
        </div>
      </template>
    </section>

    <section class="panel" aria-labelledby="passes-title">
      <div class="panel-header">
        <div class="panel-title-group">
          <span class="section-icon blue"><Icon icon="lucide:scan-search" /></span>
          <div><h2 id="passes-title">Learning passes</h2><p>One per finished run: whether a model reviewed it and how much it saved.</p></div>
        </div>
        <span class="source-label">{{ runs.source }}</span>
      </div>
      <div class="subtabs" role="group" aria-label="Pipeline views">
        <button v-for="v in views" :key="v.key" type="button" class="subtab" :class="{ active: view === v.key }"
                :aria-pressed="view === v.key" @click="view = v.key">
          {{ v.label }} <span class="count">{{ formatNumber(v.n) }}</span>
        </button>
      </div>

      <template v-if="view === 'recent'">
        <div v-if="!recent.length" class="empty-state"><Icon icon="lucide:inbox" /><strong>No learning passes</strong><span>No runs were recorded in this window.</span></div>
        <div v-else class="table-wrap">
          <table class="data-table card-table">
            <thead><tr><th>Agent</th><th>Conversation</th><th>Status</th><th class="numeric">Saved</th><th class="numeric">When</th></tr></thead>
            <tbody>
              <tr v-for="run in recentPage.visible" :key="run.id">
                <td class="card-title"><strong>{{ run.agent?.name || 'No agent' }}</strong></td>
                <td data-label="Conversation">
                  <button type="button" class="conversation-link" @click="$emit('pick-conversation', run.conversation?.id)">
                    #{{ run.conversation?.id ?? '—' }} · {{ run.conversation?.title || 'Untitled' }}
                  </button>
                </td>
                <td data-label="Status">
                  <span :class="['status-badge', statusChip(run.status)]"><span class="status-dot"></span>{{ statusLabel(run.status) }}</span>
                  <span v-if="run.skip_reason" class="sub">{{ skipLabel(run.skip_reason) }}</span>
                </td>
                <td data-label="Saved" class="numeric strong">{{ formatNumber(run.actions) }}</td>
                <td data-label="When" class="numeric muted nowrap">{{ shortTime(run.at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <LearningPager v-model:page="recentPage.page" v-model:size="recentPage.pageSize" :total="recentPage.total"
                       :of="runs.total" label="Learning passes" />
      </template>

      <template v-else-if="view === 'agents'">
        <div v-if="!byAgent.length" class="empty-state compact"><Icon icon="lucide:bot" /><strong>No agents</strong></div>
        <div v-else class="table-wrap">
          <table class="data-table card-table">
            <thead><tr><th>Agent</th><th class="numeric">Passes</th><th class="numeric">Reviewed</th><th class="numeric">Saved</th><th class="numeric">Skipped</th><th class="numeric">Waiting</th><th class="numeric">Errors</th></tr></thead>
            <tbody>
              <tr v-for="row in agentsPage.visible" :key="row.agent.id ?? 'none'">
                <td class="card-title"><strong>{{ row.agent.name }}</strong></td>
                <td data-label="Passes" class="numeric">{{ formatNumber(row.runs) }}</td>
                <td data-label="Reviewed" class="numeric positive">{{ formatNumber(row.reviewed) }}</td>
                <td data-label="Saved" class="numeric strong">{{ formatNumber(row.saved) }}</td>
                <td data-label="Skipped" class="numeric muted">{{ formatNumber(row.skipped) }}</td>
                <td data-label="Waiting" class="numeric" :class="{ caution: row.pending_review }">{{ formatNumber(row.pending_review) }}</td>
                <td data-label="Errors" class="numeric" :class="{ negative: row.errors }">{{ formatNumber(row.errors) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <LearningPager v-model:page="agentsPage.page" v-model:size="agentsPage.pageSize" :total="agentsPage.total"
                       label="Passes by agent" />
      </template>

      <template v-else>
        <div v-if="!errorRows.length" class="empty-state"><Icon icon="lucide:shield-check" /><strong>No learning failures</strong><span>No learning pass failed in this window.</span></div>
        <ul v-else class="activity-feed">
          <li v-for="failure in errorsPage.visible" :key="failure.id">
            <span class="feed-marker danger"><Icon icon="lucide:x" /></span>
            <div class="feed-content">
              <div class="feed-meta">
                <strong>{{ failure.agent?.name || 'No agent' }}</strong>
                <span class="muted">Conversation #{{ failure.conversation?.id ?? '—' }} · {{ shortTime(failure.at) }}</span>
              </div>
              <pre class="error-message">{{ failure.error }}</pre>
            </div>
          </li>
        </ul>
        <LearningPager v-model:page="errorsPage.page" v-model:size="errorsPage.pageSize" :total="errorsPage.total"
                       :of="errors" label="Errors" />
      </template>
    </section>

    <p v-if="snap.note" class="page-note"><Icon icon="lucide:info" /><span>{{ snap.note }}</span></p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../../services/api'
import { notify } from '@/composables/useNotify'
import { formatMoney, formatNumber, shortTime } from './learningFormat'
import LearningPager from './LearningPager.vue'
import { usePaged } from './usePaged'

const props = defineProps({
  snap: { type: Object, required: true },
})
const emit = defineEmits(['pick-conversation', 'refresh'])

const presets = [{ m: 5, label: '5m' }, { m: 10, label: '10m' }, { m: 30, label: '30m' }, { m: 60, label: '1h' }, { m: 360, label: '6h' }]
const view = ref('recent')
const sched = ref({})
const intervalMinutes = ref(10)
const enabled = ref(true)
const saving = ref(false)
const sweeping = ref(false)

const runs = computed(() => props.snap.runs || {})
const cost = computed(() => props.snap.cost || {})
const recent = computed(() => runs.value.recent || [])
const byAgent = computed(() => runs.value.by_agent || [])
const errorRows = computed(() => runs.value.errors || [])
const reviewed = computed(() => (runs.value.by_status?.reviewed || 0) + (runs.value.by_status?.done || 0))
const pending = computed(() => runs.value.pending_review || 0)
const errors = computed(() => runs.value.by_status?.error || 0)
const recentPage = usePaged(recent, { resetOn: () => props.snap })
const agentsPage = usePaged(byAgent, { resetOn: () => props.snap })
const errorsPage = usePaged(errorRows, { resetOn: () => props.snap })
const views = computed(() => [
  { key: 'recent', label: 'Recent', n: runs.value.total || 0 },
  { key: 'agents', label: 'By agent', n: byAgent.value.length },
  { key: 'errors', label: 'Errors', n: errors.value },
])
const dirty = computed(() => Math.round((sched.value.interval_seconds || 0) / 60) !== intervalMinutes.value
  || Boolean(sched.value.enabled) !== enabled.value)

function applySchedule (schedule) {
  sched.value = schedule || {}
  if (schedule?.interval_seconds) intervalMinutes.value = Math.max(1, Math.round(schedule.interval_seconds / 60))
  enabled.value = schedule?.enabled !== false
}
watch(() => props.snap.schedule, applySchedule, { immediate: true })

function prettyInterval (seconds) {
  if (!seconds) return '—'
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`
  const hours = seconds / 3600
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)} hour${hours === 1 ? '' : 's'}`
}

function statusChip (status) {
  if (status === 'reviewed' || status === 'done') return 'success'
  if (status === 'error') return 'danger'
  if (status === 'pending_review') return 'warning'
  return 'neutral'
}

function statusLabel (status) {
  if (status === 'pending_review') return 'Waiting for a model'
  if (status === 'done') return 'Reviewed'
  return status ? status.replaceAll('_', ' ') : 'Unknown'
}

function skipLabel (reason) {
  return ({
    prefilter: 'Nothing to learn', secret: 'Contained a secret', disabled: 'Learning off',
    duplicate: 'Already processed', no_model: 'No model available', empty: 'Empty run',
    no_agent_fault: 'Failed through no fault of the agent',
  })[reason] || reason
}

async function saveSchedule () {
  saving.value = true
  try {
    const { data } = await api.patch('/admin/observability/learning/schedule/', {
      interval_minutes: intervalMinutes.value, enabled: enabled.value,
    })
    applySchedule(data)
    notify.success(`Recovery sweep now runs every ${prettyInterval(data.interval_seconds)}.`)
  } catch (requestError) {
    notify.error(requestError?.response?.data?.error || 'Could not update the recovery sweep.')
  } finally {
    saving.value = false
  }
}

async function runNow () {
  sweeping.value = true
  try {
    const { data } = await api.post('/admin/observability/learning/sweep/', {})
    if (data.queued) {
      notify.success('Recovery sweep queued. The page refreshes as it completes.')
      window.setTimeout(() => emit('refresh'), 4000)
    } else {
      notify.error(data.error || 'Could not queue the recovery sweep.')
    }
  } catch (requestError) {
    notify.error(requestError?.response?.data?.error || 'Could not queue the recovery sweep.')
  } finally {
    sweeping.value = false
  }
}
</script>

<style scoped>
.pipeline { display: grid; gap: 14px; }
.kpi-value.warn { color: var(--warn); }
.kpi-value.bad { color: var(--bad); }
.schedule-body { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding: 16px; }
.interval-field { width: 180px; min-width: 0; }
.presets { display: flex; gap: 6px; flex-wrap: wrap; }
.switch-control { display: inline-flex; align-items: center; gap: 9px; min-height: 38px; color: #334155; font-size: 12.5px; font-weight: 750; cursor: pointer; }
.switch-control input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.switch { position: relative; width: 34px; height: 20px; border-radius: 999px; background: #cbd5e1; transition: background .16s; }
.switch::after { position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(15, 23, 42, .25); content: ''; transition: transform .16s; }
.switch-control input:checked + .switch { background: var(--primary); }
.switch-control input:checked + .switch::after { transform: translateX(14px); }
.switch-control input:focus-visible + .switch { outline: 3px solid rgba(99, 102, 241, .3); }
.schedule-actions { display: flex; gap: 8px; margin-left: auto; }
.schedule-meta { display: flex; gap: 18px; flex-wrap: wrap; padding: 10px 16px; border-top: 1px solid var(--soft-line); color: var(--muted); background: var(--wash); font-size: 11.5px; }
.schedule-meta > span { display: inline-flex; align-items: center; gap: 5px; }
.schedule-meta svg { width: 13px; height: 13px; color: var(--subtle); }
@media (max-width: 760px) {
  .schedule-body { flex-direction: column; align-items: stretch; }
  .interval-field { width: 100%; }
  .schedule-actions { margin-left: 0; display: grid; grid-template-columns: 1fr 1fr; }
}
</style>
