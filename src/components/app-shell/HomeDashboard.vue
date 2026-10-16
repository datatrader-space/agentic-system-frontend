<template>
  <!-- Screen 21 — Home dashboard. Aadml (design.md §3): white cards on #F8FAFC, blue accent,
       soft borders, Inter. Built from small reusable components; data from /dashboard/summary. -->
  <div class="min-h-full bg-[#F8FAFC] px-6 py-8 font-[Inter,system-ui,sans-serif] lg:px-10">
    <DashboardHeader :first-name="firstName" @new-agent="go('/dashboard/agents/new')" />

    <!-- Metric cards -->
    <section class="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        v-for="m in metrics"
        :key="m.key"
        :icon="m.icon"
        :label="m.label"
        :value="m.value"
        :delta="m.delta"
        :unit="m.unit"
        :tint="m.tint"
        :round="m.round"
        :loading="loading"
      />
    </section>

    <!-- Recent agents + activity -->
    <section class="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <RecentAgentsCard
        :agents="recentAgents"
        :loading="loading"
        @view-all="go('/dashboard/agents')"
        @create="go('/dashboard/agents/new')"
        @open="(a) => go(`/dashboard/agents/${a.id}`)"
      />
      <RecentActivityCard
        :activities="recentActivity"
        :loading="loading"
        @view-all="go('/dashboard/activity')"
      />
    </section>

    <!-- Quick start -->
    <section class="mb-6">
      <h2 class="mb-3 text-base font-semibold text-[#0F172A]">Quick Start</h2>
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <QuickStartCard
          v-for="q in quickStart"
          :key="q.label"
          :icon="q.icon"
          :label="q.label"
          :desc="q.desc"
          :tint="q.tint"
          @click="go(q.to)"
        />
      </div>
    </section>

    <!-- Onboarding & help -->
    <HelpStrip @go="go" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { UserRound, Play, CheckCircle2, WalletCards, PlusSquare, Link2, Workflow, BookOpen } from 'lucide-vue-next'
import api from '../../services/api'
import DashboardHeader from '../dashboard/DashboardHeader.vue'
import MetricCard from '../dashboard/MetricCard.vue'
import RecentAgentsCard from '../dashboard/RecentAgentsCard.vue'
import RecentActivityCard from '../dashboard/RecentActivityCard.vue'
import QuickStartCard from '../dashboard/QuickStartCard.vue'
import HelpStrip from '../dashboard/HelpStrip.vue'

const router = useRouter()
const go = (to) => router.push(to)

const loading = ref(true)
const summary = ref(null)

const firstName = computed(() => summary.value?.user?.first_name || '')
const recentAgents = computed(() => summary.value?.recent_agents || [])
const recentActivity = computed(() => summary.value?.recent_activity || [])

const metrics = computed(() => {
  const k = summary.value?.kpis || {}
  return [
    { key: 'active_agents', label: 'Active Agents', icon: UserRound, tint: 'bg-blue-50 text-blue-600', round: true,
      value: fmtInt(k.active_agents?.value), delta: k.active_agents?.delta, unit: k.active_agents?.delta_unit },
    { key: 'runs_24h', label: 'Runs (24h)', icon: Play, tint: 'bg-violet-50 text-violet-600', round: false,
      value: fmtInt(k.runs_24h?.value), delta: k.runs_24h?.delta, unit: k.runs_24h?.delta_unit },
    { key: 'success_rate', label: 'Success Rate', icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600', round: true,
      value: k.success_rate?.value != null ? `${k.success_rate.value}%` : '—', delta: k.success_rate?.delta, unit: k.success_rate?.delta_unit },
    { key: 'total_cost_24h', label: 'Total Cost (24h)', icon: WalletCards, tint: 'bg-amber-50 text-amber-600', round: false,
      value: k.total_cost_24h?.value != null ? `$${k.total_cost_24h.value.toFixed(2)}` : '—', delta: k.total_cost_24h?.delta, unit: k.total_cost_24h?.delta_unit },
  ]
})

const quickStart = [
  { label: 'Create Agent', desc: 'Build a new AI agent from scratch.', to: '/dashboard/agents/new', icon: PlusSquare, tint: 'bg-blue-50 text-blue-600' },
  { label: 'Connect Tool', desc: 'Integrate tools and APIs in minutes.', to: '/dashboard/connectors', icon: Link2, tint: 'bg-violet-50 text-violet-600' },
  { label: 'Build Workflow', desc: 'Automate processes with visual builder.', to: '/dashboard/workflow-builder', icon: Workflow, tint: 'bg-emerald-50 text-emerald-600' },
  { label: 'Explore Docs', desc: 'Browse guides and API documentation.', to: '/dashboard/settings/general', icon: BookOpen, tint: 'bg-amber-50 text-amber-600' },
]

function fmtInt(v) { return v == null ? '—' : Number(v).toLocaleString() }

onMounted(async () => {
  try {
    const { data } = await api.get('/dashboard/summary/')
    summary.value = data
  } catch (e) {
    summary.value = null
  } finally {
    loading.value = false
  }
})
</script>

