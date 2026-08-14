<template>
  <!-- Editor Step — Team / Sub-Agents (Phase 6.1). Assign OTHER of the user's agents as this agent's
       delegation team (the sub_agents M2M). Mirrors the Knowledge attach card: an id-list bound to
       sub_agent_ids, persisted with an immediate one-field PATCH. -->
  <div class="mx-auto w-full max-w-[1840px] px-6 pb-8 font-[Inter,system-ui,sans-serif]">
    <div class="mb-4">
      <h2 class="text-[20px] font-bold tracking-tight text-[#0F172A]">Team &amp; Sub-Agents</h2>
      <p class="mt-0.5 text-[13.5px] text-[#64748B]">
        Give this agent a team of your other agents to delegate sub-tasks to. It hands focused work to the
        best-matching teammate and folds the result back.
      </p>
    </div>

    <!-- Super agent, ordinary user: the team is the platform's, assigned by an admin. Read-only here.
         This used to say the opposite ("it treats all of your agents as its team"), which is exactly the
         behaviour that was withdrawn — your own agents are yours, and are never conscripted. -->
    <section v-if="isSuper && !isStaff"
             class="mb-4 flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-600">
        <Sparkles :size="18" :stroke-width="2" />
      </span>
      <div>
        <p class="text-[14px] font-semibold text-[#0F172A]">The Super Agent works with the platform's team</p>
        <p class="mt-0.5 text-[13px] text-[#475467]">
          Its teammates are assigned by your platform admins, and <strong>your own agents are never added to
          it</strong>. Everything you connect — apps, MCP servers, services — is available to it right away,
          with nothing to assign.
        </p>
      </div>
    </section>

    <!-- Super agent, admin: the platform team picker. Candidates are BUILT-IN agents, not anyone's own. -->
    <section v-else-if="isSuper"
             class="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
        <Sparkles :size="18" :stroke-width="2" />
      </span>
      <div>
        <p class="text-[14px] font-semibold text-[#0F172A]">You're assigning the platform's team</p>
        <p class="mt-0.5 text-[13px] text-[#475467]">
          These teammates serve <strong>every user</strong> on the platform, so only built-in agents can be
          added. Users' own agents are never eligible.
        </p>
      </div>
    </section>

    <!-- New agent (no id yet): can't reference peers until saved. -->
    <section v-if="!isSuper && !agentId"
             class="mb-4 rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-8 text-center">
      <Users :size="26" :stroke-width="1.5" class="mx-auto text-[#CBD5E1]" />
      <p class="mt-2 text-[13px] font-semibold text-[#475467]">Name and save your agent first</p>
      <p class="text-[12px] text-[#98A2B3]">Then come back here to build its delegation team.</p>
    </section>

    <section v-else-if="!isSuper || isStaff"
             class="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div class="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div class="relative flex-1 min-w-[200px] max-w-md">
          <Search :size="15" :stroke-width="2" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
          <input v-model="filter" :placeholder="isSuper ? 'Search built-in agents…' : 'Search your agents…'"
                 class="w-full rounded-lg border border-[#E5E7EB] bg-white py-2 pl-8 pr-3 text-[13px] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
        </div>
        <span class="text-[12px] font-semibold text-[#667085]">{{ selectedIds.length }} in team</span>
      </div>

      <div v-if="loading" class="py-10 text-center text-[12.5px] text-[#98A2B3]">Loading your agents…</div>
      <div v-else-if="error" class="rounded-xl border border-dashed border-red-200 bg-red-50/60 px-4 py-4 text-center">
        <p class="text-[12.5px] font-medium text-red-600">{{ error }}</p>
        <button class="mt-2 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-[#344054] border border-[#E5E7EB]"
                @click="loadAgents">Retry</button>
      </div>
      <div v-else-if="!filtered.length" class="py-10 text-center">
        <Users :size="26" :stroke-width="1.5" class="mx-auto text-[#CBD5E1]" />
        <p class="mt-2 text-[13px] font-semibold text-[#475467]">
          {{ candidates.length ? 'No matches' : (isSuper ? 'No built-in agents yet' : 'You have no other agents yet') }}
        </p>
        <router-link v-if="!candidates.length && !isSuper" to="/dashboard/agents"
                     class="mt-1 inline-block text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">
          Create another agent →
        </router-link>
      </div>

      <ul v-else class="divide-y divide-[#F2F4F7]">
        <li v-for="a in paged" :key="a.id" class="flex items-center gap-3 py-2.5">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
            <Bot :size="15" :stroke-width="2" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-[13px] font-medium text-[#0F172A]" :title="a.name">{{ a.name }}</span>
              <span v-if="a.is_paused"
                    class="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">paused</span>
            </div>
            <div v-if="a.description" class="truncate text-[11px] text-[#98A2B3]" :title="a.description">{{ a.description }}</div>
          </div>
          <button type="button" @click="toggle(a)" :disabled="saving"
                  :aria-pressed="isSelected(a.id)"
                  :class="['group rounded-lg px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50',
                           isSelected(a.id)
                             ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:border-red-200 focus-visible:bg-red-50 focus-visible:text-red-700'
                             : 'border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50']">
            <template v-if="isSelected(a.id)">
              <span class="group-hover:hidden group-focus-visible:hidden">✓ On team</span>
              <span class="hidden group-hover:inline group-focus-visible:inline">Remove</span>
            </template>
            <template v-else>Add to team</template>
          </button>
        </li>
      </ul>

      <div v-if="!loading && filtered.length && totalPages > 1"
           class="mt-2 flex items-center justify-end gap-2 text-[12px] text-[#667085]">
        <button @click="page > 1 && page--" :disabled="page <= 1"
                class="h-7 w-7 grid place-items-center rounded-lg border border-[#E5E7EB] text-[#475467] hover:bg-[#F8FAFC] disabled:opacity-40">←</button>
        <span>Page {{ page }} of {{ totalPages }}</span>
        <button @click="page < totalPages && page++" :disabled="page >= totalPages"
                class="h-7 w-7 grid place-items-center rounded-lg border border-[#E5E7EB] text-[#475467] hover:bg-[#F8FAFC] disabled:opacity-40">→</button>
      </div>

      <p class="mt-3 border-t border-[#F2F4F7] pt-3 text-[11.5px] text-[#98A2B3]">
        A teammate runs under a scoped grant (never more access than this agent) and its result is verified
        before it's used. Paused teammates are skipped until unpaused.
      </p>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Users, Search, Sparkles, Bot } from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'

const props = defineProps({ agent: { type: Object, required: true } })

const agentId = computed(() => props.agent.id)
const isSuper = computed(() => !!props.agent.is_platform_super_agent)

// Candidates: for a normal agent, the user's OTHER agents (owner-scoped; builtins + ephemeral already
// excluded server-side). For the SUPER agent, the platform's BUILT-IN agents — its team serves every user,
// so nobody's private agent may join it. The backend enforces the same split twice
// (validate_sub_agent_ids on write, eligible_agents at delegation time); this only decides what to offer.
const candidates = ref([])
const isStaff = ref(false)
const loading = ref(false)
const error = ref('')
const filter = ref('')
const saving = ref(false)
const page = ref(1)
const PAGE = 6

function pickArray(d) { return Array.isArray(d) ? d : (d?.results ?? []) }

// sub_agent_ids is write-only (absent from GET) — derive it from the sub_agents read summary, like tool_ids.
function ensureIds() {
  if (!Array.isArray(props.agent.sub_agent_ids)) {
    props.agent.sub_agent_ids = Array.isArray(props.agent.sub_agents)
      ? props.agent.sub_agents.map(s => s.id)
      : []
  }
}
const selectedIds = computed(() => (Array.isArray(props.agent.sub_agent_ids) ? props.agent.sub_agent_ids : []))
function isSelected(id) { return selectedIds.value.includes(id) }

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return candidates.value
  return candidates.value.filter(a =>
    (a.name || '').toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q))
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE, page.value * PAGE))

watch(filtered, () => { if (page.value > totalPages.value) page.value = totalPages.value })

async function loadAgents() {
  if (!agentId.value) return
  loading.value = true; error.value = ''
  try {
    // The super agent's roster is drawn from built-ins (admin-only endpoint), everything else from the
    // caller's own agents. /agents/ deliberately never lists built-ins, so it cannot serve both.
    const { data } = isSuper.value ? await api.adminListBuiltinAgents() : await api.getAgents()
    candidates.value = pickArray(data).filter(a => String(a.id) !== String(agentId.value))
  } catch (e) {
    error.value = isSuper.value ? 'Could not load the built-in agents.' : 'Could not load your agents.'
  } finally {
    loading.value = false
  }
}

async function saveIds(next) {
  await api.patch(`/agents/${agentId.value}/`, { sub_agent_ids: next })
  props.agent.sub_agent_ids = next
  // Keep the read summary in sync so the count/state is correct without a reload.
  const byId = new Map(candidates.value.map(a => [a.id, a]))
  props.agent.sub_agents = next.map(id => {
    const a = byId.get(id)
    return { id, name: a ? a.name : '', is_paused: a ? !!a.is_paused : false }
  })
}

async function toggle(a) {
  if (!agentId.value) { notify.info('Name and save your agent first, then build its team.'); return }
  ensureIds()
  const wasSelected = isSelected(a.id)
  const next = wasSelected ? selectedIds.value.filter(x => x !== a.id) : [...selectedIds.value, a.id]
  saving.value = true
  try {
    await saveIds(next)
    notify.success(wasSelected ? `Removed ${a.name} from the team` : `Added ${a.name} to the team`)
  } catch (e) {
    notify.error('Could not update the team.')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  ensureIds()
  // Staff decides whether the super agent shows a picker or a read-only note. Resolved before loading so a
  // non-staff user never fires the admin-only built-ins request (a guaranteed 403 rendered as an error).
  if (isSuper.value) {
    try {
      const { data } = await api.getCurrentUser()
      isStaff.value = !!(data?.user?.is_staff ?? data?.is_staff)
    } catch { isStaff.value = false }
    if (!isStaff.value) return
  }
  loadAgents()
})
watch(agentId, (v) => { if (v && (!isSuper.value || isStaff.value)) { ensureIds(); loadAgents() } })
</script>
