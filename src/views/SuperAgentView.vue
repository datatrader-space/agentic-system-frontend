<template>
  <!-- Platform Super Agent — read-only capabilities view (Phase 11.5 / primitive #4). Shows what the
       user's super agent coordinates: its team (all their agents) + its skills. -->
  <div class="mx-auto w-full max-w-[1100px] px-6 py-8 font-[Inter,system-ui,sans-serif]">
    <div v-if="loading" class="py-20 text-center text-[13px] text-[#98A2B3]">Loading your Super Agent…</div>

    <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50/60 p-6 text-center">
      <p class="text-[14px] font-semibold text-red-600">{{ error }}</p>
      <button class="mt-3 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#344054]"
              @click="load">Try again</button>
    </div>

    <template v-else-if="agent">
      <!-- Hero -->
      <section class="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div class="flex items-start gap-4">
          <span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white">
            <Sparkles :size="24" :stroke-width="2" />
          </span>
          <div>
            <h1 class="text-[24px] font-bold tracking-tight text-[#0F172A]">{{ agent.name }}</h1>
            <p class="mt-1 max-w-[640px] text-[13.5px] text-[#64748B]">{{ agent.description }}</p>
          </div>
        </div>
        <button @click="chat"
                class="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-indigo-700">
          Chat with Super Agent
        </button>
      </section>

      <!-- Capability inventory — what it could coordinate (read-only counts). -->
      <section v-if="inv" class="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        <div v-for="stat in inventoryStats" :key="stat.key"
             class="rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 text-center">
          <div class="text-[22px] font-bold text-[#0F172A] tabular-nums">{{ stat.value }}</div>
          <div class="text-[10.5px] font-semibold uppercase tracking-wide text-[#94A3B8]">{{ stat.label }}</div>
        </div>
      </section>

      <!-- What it coordinates -->
      <div class="grid gap-4 md:grid-cols-2">
        <!-- Team -->
        <section class="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <div class="mb-3 flex items-center gap-2">
            <Users :size="17" :stroke-width="2" class="text-indigo-600" />
            <h2 class="text-[13px] font-bold uppercase tracking-wide text-[#334155]">Team</h2>
            <span class="ml-auto text-[12px] font-semibold text-[#667085]">{{ team.length }} agents</span>
          </div>
          <p class="mb-3 text-[12px] text-[#94A3B8]">
            Every one of your agents is a teammate the Super Agent can delegate to.
          </p>
          <ul v-if="team.length" class="divide-y divide-[#F2F4F7]">
            <li v-for="a in team" :key="a.id" class="flex items-center gap-3 py-2">
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <Bot :size="15" :stroke-width="2" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-[13px] font-medium text-[#0F172A]">{{ a.name }}</span>
                  <span v-if="a.is_paused" class="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">paused</span>
                </div>
                <div v-if="a.description" class="truncate text-[11px] text-[#98A2B3]">{{ a.description }}</div>
              </div>
            </li>
          </ul>
          <div v-else class="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-6 text-center">
            <p class="text-[12.5px] font-medium text-[#475467]">No other agents yet</p>
            <router-link to="/dashboard/agents" class="mt-1 inline-block text-[12px] font-semibold text-indigo-600">Create a specialist →</router-link>
          </div>
        </section>

        <!-- Skills -->
        <section class="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <div class="mb-3 flex items-center gap-2">
            <BookOpen :size="17" :stroke-width="2" class="text-indigo-600" />
            <h2 class="text-[13px] font-bold uppercase tracking-wide text-[#334155]">Skills</h2>
            <span class="ml-auto text-[12px] font-semibold text-[#667085]">{{ skills.length }}</span>
          </div>
          <ul v-if="skills.length" class="divide-y divide-[#F2F4F7]">
            <li v-for="s in skills" :key="s.id" class="py-2">
              <div class="text-[13px] font-medium text-[#0F172A]">{{ s.name }}</div>
              <div v-if="s.description" class="text-[11px] text-[#98A2B3]">{{ s.description }}</div>
            </li>
          </ul>
          <div v-else class="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-6 text-center">
            <p class="text-[12.5px] font-medium text-[#475467]">No skills assigned</p>
          </div>
        </section>
      </div>

      <!-- Recent delegation activity -->
      <section v-if="recent.length" class="mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-5">
        <div class="mb-3 flex items-center gap-2">
          <Activity :size="17" :stroke-width="2" class="text-indigo-600" />
          <h2 class="text-[13px] font-bold uppercase tracking-wide text-[#334155]">Recent delegations</h2>
          <router-link to="/dashboard/delegations" class="ml-auto text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">View all →</router-link>
        </div>
        <ul class="divide-y divide-[#F2F4F7]">
          <li v-for="d in recent" :key="d.id" class="flex items-center gap-3 py-2">
            <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                  :class="d.status === 'completed' ? (d.verified ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600') : 'bg-red-50 text-red-600'">
              <Bot :size="13" :stroke-width="2" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[12.5px] font-medium text-[#0F172A]">{{ d.sub_agent_name || 'agent' }}</div>
              <div class="truncate text-[11px] text-[#98A2B3]">{{ d.task || '—' }}</div>
            </div>
            <VerificationBadge :verified="d.verified" :status="d.status" />
          </li>
        </ul>
      </section>

      <!-- Everything the platform can do, grouped -->
      <section v-if="catalog.length" class="mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-5">
        <div class="mb-3 flex items-center gap-2">
          <Boxes :size="17" :stroke-width="2" class="text-indigo-600" />
          <h2 class="text-[13px] font-bold uppercase tracking-wide text-[#334155]">Platform tools by category</h2>
          <span class="ml-auto text-[12px] font-semibold text-[#667085]">{{ catalog.length }} categories</span>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div v-for="g in catalog" :key="g.category"
               class="rounded-xl border border-[#F2F4F7] bg-[#FBFCFE] px-3 py-2.5">
            <div class="flex items-center justify-between">
              <span class="truncate text-[12.5px] font-semibold text-[#0F172A]" :title="g.category">{{ g.category }}</span>
              <span class="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 tabular-nums">{{ g.count }}</span>
            </div>
            <div v-if="g.sample.length" class="mt-1 truncate text-[10.5px] text-[#98A2B3]" :title="g.sample.join(', ')">{{ g.sample.slice(0,3).join(' · ') }}</div>
          </div>
        </div>
        <p class="mt-3 text-[11.5px] text-[#98A2B3]">Your Super Agent can browse and use these across the whole system.</p>
      </section>

      <p class="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-[12px] text-[#475467]">
        The Super Agent coordinates your workspace: it can search the web, your knowledge bases and memory,
        and produce documents directly — and it delegates focused sub-tasks to the right teammate (or spawns a
        temporary specialist for big parallel jobs) when that's better. Direct access to <em>all</em> your
        tools &amp; connectors is rolling out.
      </p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Sparkles, Users, Bot, BookOpen, Activity, Boxes } from 'lucide-vue-next'
import api from '../services/api'
import VerificationBadge from '../components/common/VerificationBadge.vue'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const agent = ref(null)
const recent = ref([])

const team = computed(() => (agent.value?.delegation_team || []))
const skills = computed(() => (agent.value?.skills || []))
const inv = computed(() => agent.value?.capability_inventory || null)
const catalog = computed(() => {
  const c = agent.value?.tool_catalog || {}
  return Object.entries(c)
    .map(([category, v]) => ({ category, count: (v && v.count) || 0, sample: (v && v.sample) || [] }))
    .sort((a, b) => b.count - a.count)
})
const inventoryStats = computed(() => {
  const i = inv.value || {}
  return [
    { key: 'tools', label: 'Tools', value: i.tools ?? 0 },
    { key: 'connectors', label: 'Connectors', value: i.connectors ?? 0 },
    { key: 'mcp_servers', label: 'MCP', value: i.mcp_servers ?? 0 },
    { key: 'knowledge_bases', label: 'Knowledge', value: i.knowledge_bases ?? 0 },
    { key: 'agents', label: 'Agents', value: i.agents ?? 0 },
    { key: 'skills', label: 'Skills', value: i.skills ?? 0 },
  ]
})

async function load() {
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get('/agents/super-agent/')
    agent.value = data
  } catch (e) {
    error.value = e?.response?.data?.detail || e?.message || 'Could not load your Super Agent.'
  } finally {
    loading.value = false
  }
  try {
    const { data } = await api.get('/delegations/')
    recent.value = (Array.isArray(data) ? data : (data?.results ?? [])).slice(0, 8)
  } catch (e) { /* activity feed is best-effort */ }
}

function chat() {
  if (agent.value?.id) router.push({ path: '/dashboard/chat/new', query: { agent: agent.value.id } })
}

onMounted(load)
</script>
