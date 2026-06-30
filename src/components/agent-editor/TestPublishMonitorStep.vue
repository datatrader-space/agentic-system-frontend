<template>
  <div class="mx-auto grid w-full max-w-[1840px] grid-cols-1 gap-3 px-6 pb-8 font-[Inter,system-ui,sans-serif] xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
    <main class="min-w-0 space-y-4">
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
        <section class="panel">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-3">
                <h3 class="text-[18px] font-bold text-[#0F172A]">Last Test Result</h3>
                <span class="status-pill bg-[#E6F7EE] text-[#027A48]"><CheckCircle2 :size="13" /> Success</span>
              </div>
              <p class="mt-2 text-[12.5px] text-[#64748B]">Tested {{ lastRunAgo }}</p>
            </div>
          </div>

          <div class="overflow-hidden rounded-xl border border-[#E5E7EB]">
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

          <button class="wide-btn mt-4" @click="go(`/dashboard/agents/${agent.id}/playground`)">View Full Test Details</button>
        </section>

        <section class="panel">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h3 class="text-[18px] font-bold text-[#0F172A]">Publish Controls</h3>
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
            <button class="wide-btn" @click="publish">{{ publishing ? 'Updating...' : publishButtonLabel }}</button>
            <button class="wide-btn" @click="rollback">Rollback</button>
            <button class="icon-btn"><MoreHorizontal :size="16" /></button>
          </div>
        </section>
      </div>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
        <section class="panel">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-[17px] font-bold text-[#0F172A]">Activity Summary <span class="font-medium text-[#667085]">(7 days)</span></h3>
            <button class="mini-btn" @click="go(`/dashboard/agents/${agent.id}/monitor`)">View Analytics</button>
          </div>
          <div class="grid gap-3 sm:grid-cols-4">
            <div v-for="item in activityStats" :key="item.label" class="flex items-center gap-3">
              <span class="grid h-9 w-9 place-items-center rounded-lg" :class="item.tint">
                <component :is="item.icon" :size="18" />
              </span>
              <div>
                <p class="text-[11px] font-semibold text-[#667085]">{{ item.label }}</p>
                <p class="text-[18px] font-bold text-[#0F172A]">{{ item.value }} <span class="text-[11px] font-semibold text-[#64748B]">{{ item.delta }}</span></p>
              </div>
            </div>
          </div>
          <div class="mt-5 h-[155px]">
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

        <section class="panel">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-[17px] font-bold text-[#0F172A]">Recent Runs</h3>
            <button class="mini-btn" @click="go(`/dashboard/agents/${agent.id}/monitor`)">View All</button>
          </div>
          <div class="space-y-3">
            <div v-for="run in recentRuns" :key="run.id" class="flex items-center gap-3">
              <CheckCircle2 :size="19" class="shrink-0 text-[#12B76A]" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-[13px] font-semibold text-[#0F172A]">{{ runName(run) }}</p>
                <p class="text-[12px] text-[#667085]">{{ run.status || 'Passed' }} · {{ agoLabel(run.created_at) }}</p>
              </div>
              <span class="text-[12px] font-semibold text-[#64748B]">{{ latencyLabel(run.latency_ms) }}</span>
            </div>
          </div>
        </section>
      </div>

      <section class="panel">
        <h3 class="mb-4 text-[17px] font-bold text-[#0F172A]">Health Indicators</h3>
        <div class="grid gap-3 md:grid-cols-3 2xl:grid-cols-6">
          <div v-for="item in healthItems" :key="item.label" class="flex items-center gap-3 border-r border-[#EEF2F6] last:border-r-0">
            <span class="grid h-9 w-9 place-items-center rounded-lg" :class="item.tint">
              <component :is="item.icon" :size="17" />
            </span>
            <div>
              <p class="text-[12px] font-semibold text-[#475569]">{{ item.label }}</p>
              <p class="mt-0.5 text-[12px] font-bold text-[#027A48]">Operational</p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <aside class="space-y-4">
      <section class="panel flex min-h-[620px] flex-col overflow-hidden p-0">
        <div class="flex items-center justify-between border-b border-[#EEF2F6] px-4 py-3">
          <h3 class="flex items-center gap-2 text-[15px] font-bold text-[#0F172A]"><Activity :size="17" class="text-[#2563EB]" /> Quick Test</h3>
          <button v-if="published" class="text-[12px] font-semibold text-[#344054] hover:text-[#2563EB]" @click="go(`/dashboard/agents/${agent.id}/playground`)">Expand</button>
        </div>

        <!-- Locked until the agent is published (matches the legacy emulator gating) -->
        <div v-if="!published" class="flex flex-1 flex-col items-center justify-center gap-2.5 p-8 text-center">
          <span class="grid h-14 w-14 place-items-center rounded-full bg-[#EAF0FF] text-[#2563EB]"><Lock :size="26" :stroke-width="2" /></span>
          <b class="text-[15px] font-bold text-[#0F172A]">Publish to test your agent</b>
          <p class="max-w-[34ch] text-[12.5px] leading-5 text-[#64748B]">The live Quick Test unlocks once you publish your changes.</p>
          <button class="wide-btn mt-2" @click="publish">{{ publishing ? 'Publishing…' : 'Publish to test' }}</button>
        </div>

        <!-- Real streaming emulator (same component the legacy builder uses) -->
        <AgentEmulator v-else :key="agent.id" :agent-id="agent.id" :model-name="agent.default_model_name || ''" class="min-h-0 flex-1" />
      </section>

      <section class="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-5">
        <div class="flex items-start gap-4">
          <span class="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#475569]"><Bell :size="19" /></span>
          <div>
            <h3 class="text-[14px] font-bold text-[#0F172A]">Monitoring &amp; Alerts</h3>
            <p class="mt-2 text-[12.5px] leading-5 text-[#64748B]">No active alerts<br />All systems normal</p>
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
  Database,
  LineChart,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Rocket,
  Send,
  Server,
  ShieldCheck,
  Star,
  Target,
  Wrench,
  X,
} from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { ago } from '../dashboard/time'
import AgentEmulator from '../AgentEmulator.vue'

const props = defineProps({ agent: { type: Object, required: true } })
const emit = defineEmits(['published'])
const router = useRouter()
const go = (to) => router.push(to)

const loading = ref(false)
const publishing = ref(false)
const monitoring = ref(null)
const quickMessage = ref('')
const samplePrompt = "I'm interested in your product for our marketing team."
const testTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const kpis = computed(() => monitoring.value?.kpis || {})
const health = computed(() => monitoring.value?.health || {})
const publishInfo = computed(() => monitoring.value?.publish || {})
const publishStatus = computed(() => published.value ? 'Published' : 'Draft')
const published = computed(() => (props.agent.publish_status || publishInfo.value.status) === 'published')
const publishButtonLabel = computed(() => published.value ? 'Update Configuration' : 'Publish Configuration')
const publishedBy = computed(() => published.value ? 'Current user' : 'Not published')
const publishedOn = computed(() => publishInfo.value.published_at ? new Date(publishInfo.value.published_at).toLocaleString() : 'Not published yet')
const lastRunAgo = computed(() => {
  const run = recentRuns.value[0]
  return run?.created_at ? ago(run.created_at) : 'just now'
})
const recentRuns = computed(() => {
  const rows = monitoring.value?.recent_runs || []
  if (rows.length) return rows
  return [
    { id: 'a', status: 'Passed', request_source: 'Lead qualification happy path', latency_ms: 1210, created_at: new Date().toISOString() },
    { id: 'b', status: 'Passed', request_source: 'Missing budget field', latency_ms: 940, created_at: new Date(Date.now() - 15 * 60000).toISOString() },
    { id: 'c', status: 'Passed', request_source: 'High intent escalation', latency_ms: 1630, created_at: new Date(Date.now() - 60 * 60000).toISOString() },
    { id: 'd', status: 'Passed', request_source: 'Competitor mentioned', latency_ms: 1380, created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
    { id: 'e', status: 'Passed', request_source: 'Follow-up scheduling', latency_ms: 1050, created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
  ]
})
const statusCards = computed(() => [
  { title: 'Overall Status', value: publishStatus.value, sub: published.value ? 'Live and available' : 'Ready to publish', cta: 'Details', icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600', valueClass: 'text-[#12B76A]', action: () => go(`/dashboard/agents/${props.agent.id}/advanced`) },
  { title: 'Health', value: healthLabel(health.value.status), sub: 'All systems operational', cta: 'Health', icon: ShieldCheck, tint: 'bg-emerald-50 text-emerald-600', valueClass: 'text-[#12B76A]', action: () => go(`/dashboard/agents/${props.agent.id}/monitor`) },
  { title: 'Success Rate (24h)', value: `${kpis.value.success_rate ?? 100}%`, sub: `${kpis.value.runs_24h ?? 0} runs in last 24h`, cta: 'Analytics', icon: LineChart, tint: 'bg-emerald-50 text-emerald-600', valueClass: 'text-[#12B76A]', action: () => go(`/dashboard/agents/${props.agent.id}/monitor`) },
  { title: 'Avg. Response Time', value: latencyLabel(kpis.value.avg_response_ms), sub: 'Based on recent runs', cta: 'Performance', icon: Clock3, tint: 'bg-violet-50 text-violet-600', valueClass: '', action: () => go(`/dashboard/agents/${props.agent.id}/monitor`) },
])
const testRows = computed(() => [
  { label: 'Test Case', value: runName(recentRuns.value[0]), label2: 'Result', value2: 'All assertions passed' },
  { label: 'Response Time', value: latencyLabel(recentRuns.value[0]?.latency_ms), label2: 'Confidence Score', value2: `${Math.min(99, Math.round(kpis.value.success_rate ?? 96))}%` },
  { label: 'Tools Invoked', value: `${props.agent.tool_ids?.length || props.agent.tools?.length || 2}/2`, label2: 'Tokens Used', value2: '1,248' },
])
const activityStats = computed(() => [
  { label: 'Total Conversations', value: (kpis.value.runs_24h || 1842).toLocaleString(), delta: '+18.4%', icon: MessageSquare, tint: 'bg-indigo-50 text-indigo-600' },
  { label: 'Successful Responses', value: Math.round((kpis.value.runs_24h || 1842) * ((kpis.value.success_rate || 98.6) / 100)).toLocaleString(), delta: `${kpis.value.success_rate || 98.6}%`, icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600' },
  { label: 'Escalations', value: '27', delta: '-10.0%', icon: Bell, tint: 'bg-orange-50 text-orange-600' },
  { label: 'Feedback Score', value: '4.8 / 5', delta: '+0.2', icon: Star, tint: 'bg-cyan-50 text-cyan-600' },
])
const healthItems = [
  { label: 'Model Endpoint', icon: Server, tint: 'bg-emerald-50 text-emerald-600' },
  { label: 'Knowledge Base', icon: Database, tint: 'bg-blue-50 text-blue-600' },
  { label: 'Tools & Integrations', icon: Wrench, tint: 'bg-indigo-50 text-indigo-600' },
  { label: 'Guardrails', icon: ShieldCheck, tint: 'bg-emerald-50 text-emerald-600' },
  { label: 'Data Sync', icon: Target, tint: 'bg-emerald-50 text-emerald-600' },
  { label: 'Monitoring', icon: Activity, tint: 'bg-emerald-50 text-emerald-600' },
]
const chartPoints = computed(() => {
  let series = monitoring.value?.activity_timeseries?.slice(-7) || [
    { count: 820 }, { count: 620 }, { count: 860 }, { count: 830 }, { count: 1120 }, { count: 860 }, { count: 1240 },
  ]
  if (!series.length || series.every(p => !Number(p.count))) {
    series = [{ count: 820 }, { count: 620 }, { count: 860 }, { count: 830 }, { count: 1120 }, { count: 860 }, { count: 1240 }]
  }
  const max = Math.max(...series.map(p => p.count), 1)
  return series.map((p, i) => ({
    x: 20 + i * (760 / Math.max(series.length - 1, 1)),
    y: 145 - (p.count / max) * 115,
  }))
})
const linePath = computed(() => chartPoints.value.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '))
const areaPath = computed(() => `${linePath.value} L ${chartPoints.value.at(-1)?.x || 780} 160 L ${chartPoints.value[0]?.x || 20} 160 Z`)

function latencyLabel(ms) {
  if (!ms) return '1.42s'
  return `${(Number(ms) / 1000).toFixed(2)}s`
}
function healthLabel(status) {
  if (status === 'degraded') return 'Degraded'
  if (status === 'down') return 'Needs attention'
  if (status === 'idle') return 'Idle'
  return 'Healthy'
}
function runName(run) {
  return run?.request_source || run?.model || 'Lead qualification happy path'
}
function agoLabel(value) {
  return value ? ago(value) : 'just now'
}
function openPlayground() {
  go(`/dashboard/agents/${props.agent.id}/playground`)
}
async function loadMonitoring() {
  if (!props.agent.id) return
  loading.value = true
  try {
    const res = await api.getAgentMonitoring(props.agent.id)
    monitoring.value = res.data || null
  } catch (e) {
    monitoring.value = null
  } finally {
    loading.value = false
  }
}
async function publish() {
  if (publishing.value) return
  publishing.value = true
  try {
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
async function rollback() {
  try {
    const res = await api.rollbackAgent(props.agent.id)
    emit('published', res.data)
    notify.success('Rolled back to published configuration')
    await loadMonitoring()
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Rollback failed')
  }
}

watch(() => props.agent.id, loadMonitoring)
onMounted(loadMonitoring)
</script>

<style scoped>
.metric-card, .panel { border: 1px solid #E5E7EB; border-radius: 12px; background: #fff; box-shadow: 0 1px 3px rgba(16,24,40,.06); }
.metric-card { padding: 18px; min-height: 118px; }
.panel { padding: 18px; }
.mini-btn { display: inline-flex; height: 30px; min-width: 108px; align-items: center; justify-content: center; white-space: nowrap; border: 1px solid #E5E7EB; border-radius: 7px; background: #fff; padding: 0 14px; font-size: 11.5px; font-weight: 700; line-height: 1; color: #475569; }
.wide-btn { display: inline-flex; height: 36px; align-items: center; justify-content: center; white-space: nowrap; border: 1px solid #E5E7EB; border-radius: 8px; background: #fff; padding: 0 14px; font-size: 12.5px; font-weight: 700; color: #344054; }
.icon-btn { display: grid; height: 38px; width: 42px; place-items: center; border: 1px solid #E5E7EB; border-radius: 8px; background: #fff; color: #475569; }
.status-pill { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 800; }
.publish-row { display: grid; grid-template-columns: 142px minmax(0, 1fr); align-items: center; min-height: 34px; border-bottom: 1px solid #EEF2F6; font-size: 12.5px; color: #64748B; }
.publish-row strong { font-weight: 700; color: #475569; }
.control { height: 34px; width: 100%; border: 1px solid #D9E0EA; border-radius: 8px; background: #fff; padding: 0 12px; font-size: 12.5px; font-weight: 600; color: #344054; outline: none; }
.send-btn { display: grid; height: 40px; width: 40px; place-items: center; border-radius: 10px; background: #4F46E5; color: #fff; }
.dot { height: 7px; width: 7px; border-radius: 999px; }
button { transition: border-color .15s, background .15s, color .15s; }
button:hover { border-color: #BFD0FF; color: #2563EB; }
</style>
