<template>
  <div class="h-full overflow-y-auto bg-[#F8FAFC] p-4 sm:p-6">
    <div class="mx-auto max-w-7xl space-y-5">
      <!-- header -->
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button class="text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]" @click="goBack">
            ← Agents
          </button>
          <h1 class="mt-1 text-[22px] font-bold tracking-tight text-[#0F172A]">
            {{ agentName }}
            <span class="text-[15px] font-medium text-[#94A3B8]">· Test, Publish &amp; Monitor</span>
          </h1>
          <p class="mt-0.5 text-[13px] text-[#64748B]">Live deployment health, recent runs &amp; cost for this agent.</p>
        </div>
        <button
          :disabled="loading"
          class="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0F172A] hover:bg-slate-50 disabled:opacity-50"
          @click="refresh"
        >
          <RefreshCw :size="15" :stroke-width="2.2" :class="loading ? 'animate-spin' : ''" /> Refresh
        </button>
      </div>

      <!-- KPI row -->
      <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          :icon="Rocket"
          label="Deployment"
          :value="publishLabel"
          :loading="loading"
          tint="bg-blue-50 text-blue-600"
        />
        <MetricCard
          :icon="HeartPulse"
          label="Health"
          :value="healthLabel"
          :loading="loading"
          :tint="healthTint"
        />
        <MetricCard
          :icon="CheckCircle2"
          label="Success Rate"
          :value="kpis.success_rate != null ? kpis.success_rate + '%' : '—'"
          :loading="loading"
          tint="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          :icon="Timer"
          label="Avg Response"
          :value="kpis.avg_response_ms != null ? kpis.avg_response_ms + ' ms' : '—'"
          :loading="loading"
          tint="bg-violet-50 text-violet-600"
        />
      </div>

      <!-- two-column body: main + right rail -->
      <div class="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <!-- main column -->
        <div class="space-y-5">
          <!-- last test + publish controls -->
          <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <LastTestResultCard :result="lastTest" />
            <PublishControlsCard
              :publish="bundle.publish || {}"
              :busy="actionBusy"
              @publish="doPublish"
              @unpublish="doUnpublish"
              @rollback="doRollback"
            />
          </div>

          <!-- activity chart + recent runs -->
          <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ActivitySummaryChart :points="bundle.activity_timeseries || []" :loading="loading" />
            <RecentRunsList :runs="bundle.recent_runs || []" :loading="loading" />
          </div>

          <!-- health strip -->
          <HealthIndicatorsBar :health="bundle.health || {}" />
        </div>

        <!-- right rail: quick test -->
        <div class="xl:sticky xl:top-6 xl:h-[calc(100vh-7rem)]">
          <AgentQuickTestPanel :agent-id="agentId" @ran="onTestRan" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RefreshCw, Rocket, HeartPulse, CheckCircle2, Timer } from 'lucide-vue-next'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { useConfirm } from '@/composables/useConfirm'

import MetricCard from '../components/dashboard/MetricCard.vue'
import PublishControlsCard from '../components/agent-monitor/PublishControlsCard.vue'
import LastTestResultCard from '../components/agent-monitor/LastTestResultCard.vue'
import ActivitySummaryChart from '../components/agent-monitor/ActivitySummaryChart.vue'
import RecentRunsList from '../components/agent-monitor/RecentRunsList.vue'
import HealthIndicatorsBar from '../components/agent-monitor/HealthIndicatorsBar.vue'
import AgentQuickTestPanel from '../components/agent-monitor/AgentQuickTestPanel.vue'

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()

const agentId = ref(route.params.id)
const agentName = ref('Agent')
const loading = ref(false)
const actionBusy = ref(false)
const bundle = ref({})

const kpis = computed(() => bundle.value.kpis || {})

const publishLabel = computed(() => {
  const s = bundle.value.publish?.status
  return s === 'published' ? 'Published' : s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Draft'
})

const lastTest = computed(() => (bundle.value.recent_runs && bundle.value.recent_runs[0]) || null)

const healthLabel = computed(() => {
  const st = bundle.value.health?.status
  if (!st) return 'Unknown'
  return st.charAt(0).toUpperCase() + st.slice(1)
})
const healthTint = computed(() => {
  const st = bundle.value.health?.status
  if (st === 'healthy') return 'bg-emerald-50 text-emerald-600'
  if (st === 'degraded') return 'bg-amber-50 text-amber-600'
  if (st === 'down') return 'bg-red-50 text-red-500'
  return 'bg-slate-100 text-slate-500'
})

async function loadAgentName() {
  try {
    const res = await api.get(`/agents/${agentId.value}/`)
    agentName.value = res.data?.name || 'Agent'
  } catch (e) { /* keep default */ }
}

async function loadBundle() {
  try {
    const res = await api.getAgentMonitoring(agentId.value)
    bundle.value = res.data || {}
    if (bundle.value.agent_name) agentName.value = bundle.value.agent_name
  } catch (e) {
    bundle.value = {}
    notify.error('Could not load monitoring data: ' + (e.response?.data?.error || e.message))
  }
}

async function refresh() {
  loading.value = true
  await Promise.all([loadAgentName(), loadBundle()])
  loading.value = false
}

async function doPublish() {
  actionBusy.value = true
  try {
    await api.publishAgent(agentId.value)
    notify.success('Agent published')
    await loadBundle()
  } catch (e) {
    notify.error('Publish failed: ' + (e.response?.data?.error || e.message))
  } finally {
    actionBusy.value = false
  }
}

async function doUnpublish() {
  const ok = await confirm({
    title: 'Unpublish agent?',
    message: 'The agent will go back to draft. Public/share access stops until you publish again.',
    confirmText: 'Unpublish',
  })
  if (!ok) return
  actionBusy.value = true
  try {
    await api.unpublishAgent(agentId.value)
    notify.success('Agent unpublished')
    await loadBundle()
  } catch (e) {
    notify.error('Unpublish failed: ' + (e.response?.data?.error || e.message))
  } finally {
    actionBusy.value = false
  }
}

async function doRollback() {
  const ok = await confirm({
    title: 'Roll back to published snapshot?',
    message: 'This restores the agent config (prompt, model, tools, settings) from the last publish, discarding unpublished changes.',
    confirmText: 'Roll back',
    danger: true,
  })
  if (!ok) return
  actionBusy.value = true
  try {
    await api.rollbackAgent(agentId.value)
    notify.success('Rolled back to the published snapshot')
    await refresh()
  } catch (e) {
    notify.error('Rollback failed: ' + (e.response?.data?.error || e.message))
  } finally {
    actionBusy.value = false
  }
}

// After a quick-test turn finishes, refresh the bundle so KPIs/runs reflect the new run.
let testRefreshTimer = null
function onTestRan() {
  if (testRefreshTimer) clearTimeout(testRefreshTimer)
  // Small delay so the LLMRequestLog row is committed before we re-query.
  testRefreshTimer = setTimeout(loadBundle, 1200)
}

watch(() => route.params.id, (id) => { agentId.value = id; refresh() })
onMounted(refresh)
</script>
