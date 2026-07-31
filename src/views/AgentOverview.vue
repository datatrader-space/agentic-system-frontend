<template>
  <div class="h-full overflow-y-auto bg-[#F8FAFC]">
    <div class="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">

      <!-- Header -->
      <header class="mb-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <router-link
              to="/dashboard/agents"
              class="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              title="Back to agents"
            >
              <ChevronLeft :size="17" :stroke-width="2.25" />
            </router-link>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2.5">
                <h1 class="text-[24px] font-bold leading-tight tracking-tight text-[#0F172A]">
                  <span v-if="loading" class="inline-block h-6 w-44 animate-pulse rounded bg-slate-200 align-middle" />
                  <span v-else>{{ agent.name || 'Agent' }}</span>
                </h1>
                <span
                  v-if="!loading"
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                  :class="publishPill.cls"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="publishPill.dot" />
                  {{ publishPill.label }}
                </span>
                <span
                  v-if="!loading && agent.has_unpublished_changes"
                  class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-semibold text-amber-700"
                >
                  <Dot :size="14" :stroke-width="3" class="-mx-1" /> Unpublished changes
                </span>
              </div>
              <p v-if="!loading && agent.description" class="mt-1 max-w-2xl truncate text-[13.5px] text-[#64748B]">
                {{ agent.description }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2.5">
            <router-link
              :to="playgroundLink"
              class="inline-flex items-center gap-2 rounded-[11px] border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-[#475569] transition hover:border-slate-300"
            >
              <FlaskConical :size="15" :stroke-width="2" />
              Test
            </router-link>
            <router-link
              :to="configureLink"
              class="inline-flex items-center gap-2 rounded-[11px] bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(37,99,235,0.25)] transition hover:bg-[#1D4ED8]"
            >
              <Settings2 :size="16" :stroke-width="2" />
              Configure
            </router-link>
          </div>
        </div>

        <!-- Sub-nav -->
        <nav class="mt-4 flex flex-wrap items-center gap-1 border-b border-slate-200">
          <component
            :is="tab.to ? 'router-link' : 'span'"
            v-for="tab in subNav"
            :key="tab.key"
            :to="tab.to"
            class="-mb-px cursor-pointer border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium transition"
            :class="tab.active
              ? 'border-[#2563EB] text-[#2563EB]'
              : 'border-transparent text-[#64748B] hover:text-[#334155]'"
          >
            {{ tab.label }}
          </component>
        </nav>
      </header>

      <!-- Error -->
      <div v-if="error" class="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-[13.5px] text-rose-700">
        <AlertTriangle :size="17" class="shrink-0" />
        <span>Could not load this agent. </span>
        <button class="ml-1 font-semibold underline" @click="loadAll">Retry</button>
      </div>

      <!-- Body: 2-col with persistent quick-test rail -->
      <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div class="min-w-0 space-y-5">
          <AgentSummaryCards
            :agent="agent"
            :credential-count="credentials.length"
            :last-test="lastTest"
            :loading="loading"
          />

          <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <AgentBrainPreview :agent="agent" :loading="loading" />
            <AgentActionsPreview :agent="agent" :loading="loading" />
            <ConnectedCredentialsPreview
              :agent-id="agentId"
              :credentials="credentials"
              :loading="credLoading"
              :error="credError"
            />
            <AutonomySummaryCard :agent="agent" :loading="loading" />
          </div>
        </div>

        <!-- Right rail: persistent quick test -->
        <aside class="xl:sticky xl:top-5 xl:h-[calc(100vh-7rem)]">
          <AgentQuickTestPanel
            :agent="agent"
            class="h-[600px] xl:h-full"
            @test-complete="onTestComplete"
          />
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  ChevronLeft, FlaskConical, Settings2, AlertTriangle, Dot,
} from 'lucide-vue-next'
import api from '../services/api'
import { setBreadcrumbLabel } from '@/composables/useBreadcrumbs'

import AgentSummaryCards from '../components/agent-overview/AgentSummaryCards.vue'
import AgentBrainPreview from '../components/agent-overview/AgentBrainPreview.vue'
import AgentActionsPreview from '../components/agent-overview/AgentActionsPreview.vue'
import ConnectedCredentialsPreview from '../components/agent-overview/ConnectedCredentialsPreview.vue'
import AutonomySummaryCard from '../components/agent-overview/AutonomySummaryCard.vue'
import AgentQuickTestPanel from '../components/agent-overview/AgentQuickTestPanel.vue'

const route = useRoute()
const agentId = computed(() => route.params.id)

const agent = ref({})
const loading = ref(true)
const error = ref(false)

setBreadcrumbLabel(() => agent.value?.name)

const credentials = ref([])
const credLoading = ref(true)
const credError = ref(false)

// "Last Test" has no backend field — client-side only, updated by the Quick Test panel.
const lastTest = ref(null)

const configureLink = computed(() => `/dashboard/agents/${agentId.value}/editor`)
const playgroundLink = computed(() => `/dashboard/agents/${agentId.value}/editor?step=final`)

const publishPill = computed(() => {
  const s = agent.value?.publish_status
  if (s === 'published') return { label: 'Published', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
  if (s === 'archived') return { label: 'Archived', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' }
  return { label: 'Draft', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' }
})

const subNav = computed(() => {
  const base = `/dashboard/agents/${agentId.value}`
  return [
    { key: 'overview', label: 'Overview', to: base, active: true },
    { key: 'brain', label: 'Brain', to: `${base}/editor?step=brain`, active: false },
    { key: 'knowledge', label: 'Knowledge', to: `${base}/editor?step=knowledge`, active: false },
    { key: 'actions', label: 'Actions', to: `${base}/editor?step=actions`, active: false },
    { key: 'autonomy', label: 'Autonomy', to: `${base}/editor?step=autonomy`, active: false },
    { key: 'activity', label: 'Activity', to: `${base}/monitor`, active: false },
  ]
})

const loadAgent = async () => {
  loading.value = true
  error.value = false
  try {
    const res = await api.get(`/agents/${agentId.value}/`)
    agent.value = res.data || {}
  } catch (e) {
    error.value = true
  } finally {
    loading.value = false
  }
}

const loadCredentials = async () => {
  credLoading.value = true
  credError.value = false
  try {
    const res = await api.get(`/agents/${agentId.value}/credentials/`)
    credentials.value = res.data?.credentials || []
  } catch (e) {
    credError.value = true
    credentials.value = []
  } finally {
    credLoading.value = false
  }
}

const loadAll = () => {
  loadAgent()
  loadCredentials()
}

const onTestComplete = (payload) => {
  lastTest.value = payload
}

watch(agentId, (id) => { if (id) loadAll() })
onMounted(() => { if (agentId.value) loadAll() })
</script>
