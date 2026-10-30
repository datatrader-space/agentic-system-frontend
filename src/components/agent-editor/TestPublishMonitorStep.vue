<template>
  <div class="mx-auto grid w-full max-w-[1840px] grid-cols-1 gap-3 px-6 pb-8 font-[Inter,system-ui,sans-serif] xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px] admin-subview">
    <main class="min-w-0 space-y-4">
      <!-- Monitoring failed to load: say so, with Retry. Never stand-in numbers that look like real ones. -->
      <LoadError v-if="monitorError" compact title="Couldn't load this agent's activity" :message="monitorError"
                 :retrying="loading" @retry="loadMonitoring" />
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article v-for="card in statusCards" :key="card.title" class="metric-card">
          <div class="flex h-full items-start gap-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full" :class="card.tint">
              <component :is="card.icon" :size="20" :stroke-width="2.2" />
            </span>
            <div class="flex min-w-0 flex-1 flex-col">
              <p class="text-[11.5px] font-semibold leading-tight text-[#667085]">{{ card.title }}</p>
              <p class="mt-1 text-[17px] font-bold leading-tight text-[#0F172A]" :class="card.valueClass">{{ card.value }}</p>
              <p class="mt-1 min-h-[32px] text-[12px] leading-4 text-[#64748B]">{{ card.sub }}</p>
              <button class="mini-btn mt-3" @click="card.action">View {{ card.cta }}</button>
            </div>
          </div>
        </article>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <section class="panel admin-surface">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-3">
                <h3 class="text-[18px] font-bold text-[#0F172A] admin-section-title">Last Run</h3>
                <span v-if="lastRun" class="status-pill" :class="runFailed(lastRun) ? 'bg-[#FEE4E2] text-[#B42318]' : 'bg-[#E6F7EE] text-[#027A48]'">
                  <component :is="runFailed(lastRun) ? XCircle : CheckCircle2" :size="13" /> {{ runStatusLabel(lastRun) }}
                </span>
              </div>
              <p class="mt-2 text-[12.5px] text-[#64748B]">{{ lastRun ? `Ran ${lastRunAgo}` : (monitorError ? 'Activity unavailable' : 'No runs yet') }}</p>
            </div>
          </div>

          <div v-if="lastRun" class="overflow-hidden rounded-xl border border-[#E5E7EB]">
            <div v-for="row in testRows" :key="row.label" class="grid grid-cols-2 border-b border-[#EEF2F6] last:border-b-0">
              <div class="border-r border-[#EEF2F6] px-4 py-3">
                <p class="text-[11.5px] font-medium text-[#667085]">{{ row.label }}</p>
                <p class="mt-1 text-[12.5px] font-semibold text-[#344054]">{{ row.value }}</p>
              </div>
              <div class="px-4 py-3">
                <p class="text-[11.5px] font-medium text-[#667085]">{{ row.label2 }}</p>
                <p class="mt-1 text-[12.5px] font-semibold text-[#344054]">{{ row.value2 }}</p>
              </div>
            </div>
          </div>
          <p v-else class="rounded-xl border border-dashed border-[#E5E7EB] px-4 py-6 text-center text-[12.5px] text-[#64748B]">
            {{ monitorError ? 'Run details could not be loaded.' : 'Run this agent (Quick Test or chat) to see its latest result here.' }}
          </p>

          <button class="wide-btn mt-4" @click="go(shell.agentPage(agent.id, 'monitor'))">View Full Test Details</button>
        </section>

        <section class="panel admin-surface">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h3 class="text-[18px] font-bold text-[#0F172A] admin-section-title">Publish Controls</h3>
            <span class="status-pill bg-[#DFF8EC] text-[#027A48]"><Rocket :size="13" /> {{ publishStatus }}</span>
          </div>

          <div class="space-y-3">
            <label class="publish-row">
              <span>Environment</span>
              <select class="control">
                <option>Production</option>
                <option>Staging</option>
              </select>
            </label>
            <div class="publish-row">
              <span>Version</span>
              <div class="flex items-center gap-2">
                <span class="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-1 text-[12px] font-semibold text-[#475569]">v1.0.{{ agent.id || 0 }}</span>
                <span class="rounded-full bg-[#DFF8EC] px-2 py-1 text-[11px] font-bold text-[#027A48]">Current</span>
              </div>
            </div>
            <div class="publish-row"><span>Published By</span><strong>{{ publishedBy }}</strong></div>
            <div class="publish-row"><span>Published On</span><strong>{{ publishedOn }}</strong></div>
          </div>

          <div class="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
            <button class="wide-btn disabled:cursor-not-allowed disabled:opacity-60" :disabled="publishing" :aria-busy="publishing" @click="publish">{{ publishing ? 'Updating...' : publishButtonLabel }}</button>
            <button class="wide-btn disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canRollback || rollingBack"
                    :title="canRollback ? '' : 'Nothing to roll back to — this agent has not been published yet.'"
                    @click="rollback">{{ rollingBack ? 'Rolling back...' : 'Rollback' }}</button>
            <button class="icon-btn"><MoreHorizontal :size="16" /></button>
          </div>
        </section>
      </div>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
        <section class="panel admin-surface">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-[17px] font-bold text-[#0F172A] admin-section-title">Activity Summary <span class="font-medium text-[#667085]">(24 hours)</span></h3>
            <button class="mini-btn" @click="go(shell.agentPage(agent.id, 'monitor'))">View Analytics</button>
          </div>
          <div class="grid gap-3 sm:grid-cols-4">
            <div v-for="item in activityStats" :key="item.label" class="flex items-center gap-3">
              <span class="grid h-9 w-9 place-items-center rounded-lg" :class="item.tint">
                <component :is="item.icon" :size="18" />
              </span>
              <div>
                <p class="text-[11px] font-semibold text-[#667085]">{{ item.label }}</p>
                <p class="text-[18px] font-bold text-[#0F172A]">{{ item.value }}</p>
              </div>
            </div>
          </div>
          <p v-if="!chartPoints.length" class="mt-5 grid h-[155px] place-items-center rounded-xl border border-dashed border-[#E5E7EB] text-[12.5px] text-[#64748B]">
            {{ monitorError ? 'Activity could not be loaded.' : 'No activity in the last 24 hours.' }}
          </p>
          <div v-else class="mt-5 h-[155px]">
            <svg viewBox="0 0 800 170" class="h-full w-full overflow-visible">
              <defs>
                <linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#2563EB" stop-opacity=".20" />
                  <stop offset="100%" stop-color="#2563EB" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="areaPath" fill="url(#activityFill)" />
              <path :d="linePath" fill="none" stroke="#2563EB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              <circle v-for="p in chartPoints" :key="`${p.x}-${p.y}`" :cx="p.x" :cy="p.y" r="3.5" fill="#2563EB" />
            </svg>
          </div>
        </section>

        <section class="panel admin-surface">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-[17px] font-bold text-[#0F172A] admin-section-title">Recent Runs</h3>
            <button class="mini-btn" @click="go(shell.agentPage(agent.id, 'monitor'))">View All</button>
          </div>
          <div class="space-y-3">
            <div v-for="run in recentRuns" :key="run.id" class="flex items-center gap-3">
              <component :is="runFailed(run) ? XCircle : CheckCircle2" :size="19" class="shrink-0" :class="runFailed(run) ? 'text-[#D92D20]' : 'text-[#12B76A]'" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-[13px] font-semibold text-[#0F172A]">{{ runName(run) }}</p>
                <p class="text-[12px] text-[#667085]">{{ runStatusLabel(run) }} · {{ agoLabel(run.created_at) }}</p>
              </div>
              <span class="text-[12px] font-semibold text-[#64748B]">{{ latencyLabel(run.latency_ms) }}</span>
            </div>
            <p v-if="!recentRuns.length" class="py-6 text-center text-[12.5px] text-[#64748B]">
              {{ monitorError ? 'Runs could not be loaded.' : 'No runs yet.' }}
            </p>
          </div>
        </section>
      </div>
    </main>

    <aside class="space-y-4">
      <section class="panel flex min-h-[620px] flex-col overflow-hidden p-0 admin-surface">
        <div class="flex items-center justify-between border-b border-[#EEF2F6] px-4 py-3">
          <h3 class="flex items-center gap-2 text-[15px] font-bold text-[#0F172A] admin-section-title"><Activity :size="17" class="text-[#2563EB]" /> Quick Test</h3>
          <button v-if="published" class="text-[12px] font-semibold text-[#344054] hover:text-[#2563EB]" @click="go(shell.agentPage(agent.id, 'monitor'))">Expand</button>
        </div>

        <!-- Locked until the agent is published (matches the legacy emulator gating) -->
        <div v-if="!published" class="flex flex-1 flex-col items-center justify-center gap-2.5 p-8 text-center">
          <span class="grid h-14 w-14 place-items-center rounded-full bg-[#EAF0FF] text-[#2563EB]"><Lock :size="26" :stroke-width="2" /></span>
          <b class="text-[15px] font-bold text-[#0F172A]">Publish to test your agent</b>
          <p class="max-w-[34ch] text-[12.5px] leading-5 text-[#64748B]">The live Quick Test unlocks once you publish your changes.</p>
          <button class="wide-btn mt-2 disabled:cursor-not-allowed disabled:opacity-60" :disabled="publishing" :aria-busy="publishing" @click="publish">{{ publishing ? 'Publishing…' : 'Publish to test' }}</button>
        </div>

        <!-- Real streaming emulator (same component the legacy builder uses) -->
        <AgentEmulator v-else :key="agent.id" :agent-id="agent.id" :model-name="agent.default_model_name || ''" class="min-h-0 flex-1" />
      </section>

      <section class="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-5">
        <div class="flex items-start gap-4">
          <span class="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#475569]"><Bell :size="19" /></span>
          <div>
            <h3 class="text-[14px] font-bold text-[#0F172A] admin-section-title">Monitoring &amp; Alerts</h3>
            <p class="mt-2 text-[12.5px] leading-5 text-[#64748B]">{{ monitoringSummary }}</p>
          </div>
        </div>
      </section>
    </aside>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Activity,
  Bell,
  CheckCircle2,
  Clock3,
  DollarSign,
  LineChart,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Rocket,
  ShieldCheck,
  XCircle,
} from 'lucide-vue-next'
import LoadError from '../common/LoadError.vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { useEditorShell } from '../../composables/editorShell'
import { ago } from '../dashboard/time'
import AgentEmulator from '../AgentEmulator.vue'

const props = defineProps({
  agent: { type: Object, required: true },
  // Supplied by the editor: saves the pending edits and resolves true/false. Without it this step's
  // Publish published what the server last saw, not what is on screen (the header's button saves first).
  saveFirst: { type: Function, default: null },
})
const emit = defineEmits(['published'])
const router = useRouter()
const go = (to) => router.push(to)
const shell = useEditorShell()

// Everything this step shows about runs comes from GET /agents/{id}/monitoring/ (the last 24 hours).
// When that has nothing, it says so; when it fails, it says that, with Retry. It used to fill both cases
// with demo figures ("1,842 conversations", "4.8 / 5", five "Passed" runs) that read as the agent's own.
const loading = ref(false)
const publishing = ref(false)
const monitoring = ref(null)
const monitorError = ref('')

const kpis = computed(() => monitoring.value?.kpis || {})
const health = computed(() => monitoring.value?.health || {})
const publishInfo = computed(() => monitoring.value?.publish || {})
const publishStatus = computed(() => published.value ? 'Published' : 'Draft')
const published = computed(() => (props.agent.publish_status || publishInfo.value.status) === 'published')
const publishButtonLabel = computed(() => published.value ? 'Update Configuration' : 'Publish Configuration')
const publishedBy = computed(() => published.value ? 'Current user' : 'Not published')
const publishedOn = computed(() => publishInfo.value.published_at ? new Date(publishInfo.value.published_at).toLocaleString() : 'Not published yet')
const recentRuns = computed(() => monitoring.value?.recent_runs || [])
const lastRun = computed(() => recentRuns.value[0] || null)
const lastRunAgo = computed(() => (lastRun.value?.created_at ? ago(lastRun.value.created_at) : ''))
// No number at all until monitoring has answered: '—', never a default that looks measured.
const hasMonitoring = computed(() => !!monitoring.value)
const runs24h = computed(() => Number(kpis.value.runs_24h) || 0)
const statusCards = computed(() => [
  { title: 'Overall Status', value: publishStatus.value, sub: published.value ? 'Live and available' : 'Ready to publish', cta: 'Details', icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600', valueClass: published.value ? 'text-[#12B76A]' : '', action: () => go(shell.agentPage(props.agent.id, 'monitor')) },
  { title: 'Health', value: hasMonitoring.value ? healthLabel(health.value.status) : '—', sub: healthSub.value, cta: 'Health', icon: ShieldCheck, tint: 'bg-emerald-50 text-emerald-600', valueClass: healthClass(health.value.status), action: () => go(shell.agentPage(props.agent.id, 'monitor')) },
  { title: 'Success Rate (24h)', value: hasMonitoring.value && runs24h.value ? `${kpis.value.success_rate}%` : '—', sub: hasMonitoring.value ? `${runs24h.value} runs in last 24h` : 'Not available', cta: 'Analytics', icon: LineChart, tint: 'bg-emerald-50 text-emerald-600', valueClass: '', action: () => go(shell.agentPage(props.agent.id, 'monitor')) },
  { title: 'Avg. Response Time', value: latencyLabel(kpis.value.avg_response_ms), sub: hasMonitoring.value ? 'Based on the last 24h' : 'Not available', cta: 'Performance', icon: Clock3, tint: 'bg-violet-50 text-violet-600', valueClass: '', action: () => go(shell.agentPage(props.agent.id, 'monitor')) },
])
const healthSub = computed(() => {
  if (!hasMonitoring.value) return 'Not available'
  if (health.value.status === 'idle') return 'No runs in the last 24h'
  return `${health.value.error_rate ?? 0}% errors in the last 24h`
})
const testRows = computed(() => {
  const run = lastRun.value
  if (!run) return []
  return [
    { label: 'Source', value: runName(run), label2: 'Result', value2: runStatusLabel(run) },
    { label: 'Response Time', value: latencyLabel(run.latency_ms), label2: 'Model', value2: run.model || '—' },
    { label: 'Tools Assigned', value: String(props.agent.tool_ids?.length ?? props.agent.tools?.length ?? 0), label2: 'Cost', value2: costLabel(run.cost_estimate) },
  ]
})
const activityStats = computed(() => {
  const has = hasMonitoring.value
  const errors = has ? Math.round(runs24h.value * ((Number(health.value.error_rate) || 0) / 100)) : null
  return [
    { label: 'Runs', value: has ? runs24h.value.toLocaleString() : '—', icon: MessageSquare, tint: 'bg-indigo-50 text-indigo-600' },
    { label: 'Successful', value: has ? (runs24h.value - errors).toLocaleString() : '—', icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Errors', value: has ? errors.toLocaleString() : '—', icon: XCircle, tint: 'bg-orange-50 text-orange-600' },
    { label: 'Cost', value: has ? costLabel(kpis.value.cost_24h) : '—', icon: DollarSign, tint: 'bg-cyan-50 text-cyan-600' },
  ]
})
const monitoringSummary = computed(() => {
  if (monitorError.value) return 'Monitoring could not be loaded.'
  if (!hasMonitoring.value) return 'Loading…'
  const s = health.value.status
  if (s === 'down' || s === 'degraded') return `${healthLabel(s)}: ${health.value.error_rate ?? 0}% errors, ${latencyLabel(health.value.avg_latency_ms)} average response in the last 24h.`
  if (s === 'idle') return 'No runs in the last 24 hours.'
  return 'No problems in the last 24 hours.'
})
// The real per-hour series (24 points). No points when there is no activity — the template says so.
const chartPoints = computed(() => {
  const series = monitoring.value?.activity_timeseries || []
  if (!series.length || series.every(p => !Number(p.count))) return []
  const max = Math.max(...series.map(p => Number(p.count) || 0), 1)
  return series.map((p, i) => ({
    x: 20 + i * (760 / Math.max(series.length - 1, 1)),
    y: 145 - ((Number(p.count) || 0) / max) * 115,
  }))
})
const linePath = computed(() => chartPoints.value.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '))
const areaPath = computed(() => `${linePath.value} L ${chartPoints.value.at(-1)?.x || 780} 160 L ${chartPoints.value[0]?.x || 20} 160 Z`)

function latencyLabel(ms) {
  if (ms === null || ms === undefined || ms === '') return '—'
  return `${(Number(ms) / 1000).toFixed(2)}s`
}
function costLabel(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toFixed(n && n < 0.01 ? 4 : 2)}`
}
function healthLabel(status) {
  if (status === 'degraded') return 'Degraded'
  if (status === 'down') return 'Needs attention'
  if (status === 'idle') return 'Idle'
  if (status === 'healthy') return 'Healthy'
  return '—'
}
function healthClass(status) {
  if (status === 'healthy') return 'text-[#12B76A]'
  if (status === 'down') return 'text-[#D92D20]'
  if (status === 'degraded') return 'text-[#B54708]'
  return ''
}
function runFailed(run) {
  return ['error', 'failed', 'timeout'].includes(String(run?.status || '').toLowerCase())
}
function runStatusLabel(run) {
  const s = String(run?.status || '')
  if (!s) return 'Unknown'
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function runName(run) {
  return run?.request_source || run?.model || 'Run'
}
function agoLabel(value) {
  return value ? ago(value) : ''
}
async function loadMonitoring() {
  if (!props.agent.id) return
  const id = props.agent.id
  loading.value = true
  monitorError.value = ''
  try {
    const res = await api.getAgentMonitoring(id)
    if (String(props.agent.id) !== String(id)) return
    monitoring.value = res.data || null
  } catch (e) {
    if (String(props.agent.id) !== String(id)) return
    monitoring.value = null
    monitorError.value = e?.response?.status === 403
      ? 'You do not have access to this agent\'s activity.'
      : 'The activity for this agent could not be loaded.'
  } finally {
    loading.value = false
  }
}
async function publish() {
  if (publishing.value) return
  publishing.value = true
  try {
    // Save, then publish. A failed save has already told the user why; publishing anyway would put the
    // OLD configuration live while the screen shows the new one.
    if (props.saveFirst && !(await props.saveFirst())) return
    if (!props.agent.id) return
    const res = await api.publishAgent(props.agent.id)
    emit('published', res.data)
    notify.success(published.value ? 'Configuration updated' : 'Published')
    await loadMonitoring()
  } catch (e) {
    notify.error('Failed to publish')
  } finally {
    publishing.value = false
  }
}
// Rollback restores the last PUBLISHED snapshot, so there is nothing to roll back to before the first
// publish — and it discards unpublished changes, so it asks first (same wording as the Monitor page).
const rollingBack = ref(false)
const canRollback = computed(() => !!props.agent.id && !!publishInfo.value.published_at)
async function rollback() {
  if (!canRollback.value || rollingBack.value) return
  const ok = await confirm({
    title: 'Roll back to published snapshot?',
    message: 'This restores the agent config (prompt, model, tools, settings) from the last publish, discarding unpublished changes.',
    confirmText: 'Roll back',
    danger: true,
  })
  if (!ok) return
  rollingBack.value = true
  try {
    const res = await api.rollbackAgent(props.agent.id)
    emit('published', res.data)
    notify.success('Rolled back to published configuration')
    await loadMonitoring()
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Rollback failed')
  } finally {
    rollingBack.value = false
  }
}

watch(() => props.agent.id, loadMonitoring)
onMounted(loadMonitoring)
</script>

<style scoped>
.metric-card, .panel { border: 1px solid var(--admin-line, #E5E7EB); border-radius: 12px; background: var(--admin-surface, #fff); box-shadow: 0 1px 3px rgba(16,24,40,.06); }
.metric-card { padding: 18px; min-height: 118px; }
.panel { padding: 18px; }
.mini-btn { display: inline-flex; height: 30px; min-width: 108px; align-items: center; justify-content: center; white-space: nowrap; border: 1px solid var(--admin-line, #E5E7EB); border-radius: 7px; background: var(--admin-surface, #fff); padding: 0 14px; font-size: 11.5px; font-weight: 700; line-height: 1; color: var(--admin-muted, #475569); }
.wide-btn { display: inline-flex; height: 36px; align-items: center; justify-content: center; white-space: nowrap; border: 1px solid var(--admin-line, #E5E7EB); border-radius: 8px; background: var(--admin-surface, #fff); padding: 0 14px; font-size: 12.5px; font-weight: 700; color: var(--admin-ink, #344054); }
.icon-btn { display: grid; height: 38px; width: 42px; place-items: center; border: 1px solid var(--admin-line, #E5E7EB); border-radius: 8px; background: var(--admin-surface, #fff); color: var(--admin-muted, #475569); }
.status-pill { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 800; }
.publish-row { display: grid; grid-template-columns: 142px minmax(0, 1fr); align-items: center; min-height: 34px; border-bottom: 1px solid var(--admin-line, #EEF2F6); font-size: 12.5px; color: var(--admin-muted, #64748B); }
.publish-row strong { font-weight: 700; color: var(--admin-muted, #475569); }
.control { height: 34px; width: 100%; border: 1px solid var(--admin-line, #D9E0EA); border-radius: 8px; background: var(--admin-surface, #fff); padding: 0 12px; font-size: 12.5px; font-weight: 600; color: var(--admin-ink, #344054); outline: none; }
.send-btn { display: grid; height: 40px; width: 40px; place-items: center; border-radius: 10px; background: #4F46E5; color: #fff; }
.dot { height: 7px; width: 7px; border-radius: 999px; }
button { transition: border-color .15s, background .15s, color .15s; }
button:hover { border-color: #BFD0FF; color: #2563EB; }
</style>
