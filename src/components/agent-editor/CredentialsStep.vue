<template>
  <div class="mx-auto w-full max-w-[1840px] px-6 pb-8 font-[Inter,system-ui,sans-serif]">
    <div class="mb-4">
      <h2 class="text-[22px] font-bold tracking-tight text-[#0F172A]">Attach Credentials from Vault</h2>
      <p class="mt-1 text-[13.5px] text-[#64748B]">Attach secure, reusable credentials from your vault. Credentials are encrypted and can be shared across agents and workspaces.</p>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="space-y-4">
        <section class="rounded-xl border border-[#CFE0FF] bg-[#F8FBFF] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div class="flex items-center gap-5">
            <span class="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#2563EB] text-white shadow-[0_12px_24px_rgba(37,99,235,.24)]">
              <LockKeyhole :size="30" :stroke-width="2" />
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="text-[17px] font-semibold text-[#0F172A]">Credentials are Global, Secure &amp; Reusable</h3>
              <div class="mt-4 grid grid-cols-1 gap-3 text-[13px] text-[#475569] md:grid-cols-2">
                <p v-for="item in securityPoints" :key="item" class="flex items-center gap-2">
                  <Check :size="16" :stroke-width="2.5" class="text-[#2563EB]" /> {{ item }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.08)]">
          <header class="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div class="min-w-[320px] flex-1">
              <div class="flex items-center gap-2">
                <span class="grid h-7 w-7 place-items-center rounded-lg bg-[#F8FAFC] text-[#667085] ring-1 ring-[#E5E7EB]">
                  <ShieldCheck :size="15" :stroke-width="2" />
                </span>
                <h3 class="text-[15px] font-semibold text-[#0F172A]">Credential Vault</h3>
              </div>
              <p class="mt-1.5 text-[11.5px] font-medium text-[#64748B]">
                Select credentials to attach to this agent. Need a new credential?
                <button class="ml-1 inline-flex items-center gap-1 font-semibold text-[#2563EB]" @click="go('/dashboard/connections?tab=credentials')">
                  Manage Vault <ExternalLink :size="11" />
                </button>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <select v-model="typeFilter" class="control w-[132px]">
                <option value="all">All Types</option>
                <option v-for="type in typeOptions" :key="type" :value="type">{{ type }}</option>
              </select>
              <div class="relative">
                <Search :size="14" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#667085]" />
                <input v-model="search" class="control w-[270px] pr-9" placeholder="Search credentials..." />
              </div>
            </div>
          </header>

          <div v-if="loading" class="space-y-2">
            <div v-for="n in 5" :key="n" class="h-14 animate-pulse rounded-xl bg-slate-100" />
          </div>

          <div v-else class="overflow-hidden rounded-xl border border-[#E5E7EB]">
            <table class="w-full min-w-[860px] text-left">
              <thead class="bg-[#F8FAFC] text-[12px] font-semibold text-[#475569]">
                <tr>
                  <th class="px-4 py-3">Credential</th>
                  <th class="px-4 py-3">Workspace</th>
                  <th class="px-4 py-3">Sharing</th>
                  <th class="px-4 py-3">Status</th>
                  <th class="px-4 py-3">Last Used</th>
                  <th class="px-4 py-3 text-right">Attach</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#EEF2F6] bg-white">
                <tr v-for="cred in pageRows" :key="cred.id" class="hover:bg-[#F8FAFC]">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#E5E7EB] bg-white text-[12px] font-bold text-[#0F172A]">{{ initials(cred) }}</span>
                      <div class="min-w-0">
                        <p class="truncate text-[13px] font-semibold text-[#0F172A]">{{ cred.credential_name || cred.name || 'Credential' }}</p>
                        <span class="mt-1 inline-flex rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#475569]">{{ credType(cred) }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-[12.5px] text-[#475569]">
                    <span class="mr-2 inline-grid h-7 w-7 place-items-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">W</span>
                    {{ cred.workspace_name || cred.workspace || 'Workspace' }}
                  </td>
                  <td class="px-4 py-3 text-[12.5px] text-[#475569]">
                    <div class="flex items-center gap-2">
                      <Users v-if="cred.is_global" :size="15" :stroke-width="2" class="text-[#667085]" />
                      <Lock v-else :size="15" :stroke-width="2" class="text-[#667085]" />
                      <span>{{ cred.is_global ? 'Global' : 'Agent' }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" :class="cred.is_valid === false ? 'bg-red-50 text-red-600 ring-1 ring-red-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'">
                      {{ cred.is_valid === false ? 'Expired' : 'Active' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-[12.5px] text-[#475569]">{{ lastUsed(cred) }}</td>
                  <td class="px-4 py-3 text-right">
                    <div v-if="isAttached(cred)" class="inline-flex items-center gap-2">
                      <span class="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                        <Check :size="13" :stroke-width="2.5" /> Attached
                      </span>
                      <button class="detach-btn" :disabled="detachingId === cred.id" @click="detach(cred)">
                        {{ detachingId === cred.id ? 'Detaching...' : 'Detach' }}
                      </button>
                    </div>
                    <button v-else class="attach-btn" :disabled="attachingId === cred.id" @click="attach(cred)">
                      {{ attachingId === cred.id ? 'Attaching...' : 'Attach' }}
                    </button>
                  </td>
                </tr>
                <tr v-if="!pageRows.length">
                  <td colspan="6" class="px-4 py-10 text-center text-[13px] text-[#64748B]">No credentials found.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <footer class="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#64748B]">
            <span>Showing {{ rangeLabel }} of {{ filteredRows.length }} credentials</span>
            <div class="flex items-center gap-1">
              <button class="page-btn" :disabled="page === 1" @click="page--"><ChevronLeft :size="15" /></button>
              <button v-for="n in pageCount" :key="n" class="page-num" :class="n === page ? 'bg-[#EAF0FF] text-[#2563EB]' : 'text-[#475569]'" @click="page = n">{{ n }}</button>
              <button class="page-btn" :disabled="page === pageCount" @click="page++"><ChevronRight :size="15" /></button>
            </div>
          </footer>
        </section>
      </div>

      <aside class="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div class="mb-4 flex items-center gap-3">
          <span class="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><ShieldCheck :size="20" /></span>
          <h3 class="text-[16px] font-semibold text-[#0F172A]">Understanding Permissions</h3>
        </div>
        <p class="mb-5 text-[13px] leading-6 text-[#64748B]">Control how agents and users can interact with each credential.</p>
        <div class="space-y-5">
          <div v-for="mode in permissionModes" :key="mode.title" class="flex gap-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl" :class="mode.tint">
              <component :is="mode.icon" :size="20" :stroke-width="2" />
            </span>
            <div>
              <p class="text-[13.5px] font-semibold text-[#0F172A]">{{ mode.title }}</p>
              <p class="mt-1 text-[12.5px] leading-5 text-[#64748B]">{{ mode.desc }}</p>
              <span v-if="mode.tag" class="mt-2 inline-flex rounded-md bg-[#EAF0FF] px-2 py-1 text-[11px] font-semibold text-[#2563EB]">{{ mode.tag }}</span>
            </div>
          </div>
        </div>
        <div class="mt-6 rounded-xl border border-[#DCE6FB] bg-[#EFF4FF] p-4 text-[12.5px] leading-5 text-[#475569]">
          <p class="font-medium text-[#0F172A]">You can change permissions anytime from the credential settings in the vault.</p>
          <button class="mt-3 font-semibold text-[#2563EB]">Learn more about permissions <ExternalLink :size="12" class="inline" /></button>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Check, ChevronLeft, ChevronRight, ExternalLink, Eye, Lock, LockKeyhole, Pencil, Search, ShieldCheck, UserRoundCheck, Users } from 'lucide-vue-next'
import { credentialsApi } from '../../services/toolsApi'
import { notify } from '@/composables/useNotify'
import { ago } from '../dashboard/time'

const props = defineProps({ agent: { type: Object, required: true } })
const router = useRouter()
const go = (to) => router.push(to)

const loading = ref(true)
const rows = ref([])
const search = ref('')
const typeFilter = ref('all')
const page = ref(1)
const pageSize = 5
const attachingId = ref(null)
const detachingId = ref(null)

// Identity of a SPECIFIC credential = its scope (service / builtin tool) + its name. Keyed per-CREDENTIAL,
// never per-scope: two credentials of the same scope (e.g. two ssh_exec servers) must be tracked
// separately, otherwise attaching one wrongly marks every sibling of that scope as "Attached".
function credKey(c) {
  const scope = `${c.scope_type || 'service'}:${c.service_id ?? c.service_name ?? ''}`
  return `${scope}::${(c.credential_name || c.name || '').trim().toLowerCase()}`
}
// Attaching COPIES a vault credential into an agent-scoped copy (same name + scope). Map each copy that
// belongs to THIS agent by its identity → the copy's id (used for Detach). listGlobal returns these copies.
const attachedCopies = computed(() => {
  const map = {}
  for (const c of rows.value) {
    if (c.agent_profile_id != null && String(c.agent_profile_id) === String(props.agent.id)) {
      map[credKey(c)] = c.id
    }
  }
  return map
})
function isAttached(c) {
  return credKey(c) in attachedCopies.value
}
// The vault panel lists the reusable GLOBAL credentials only. The agent-scoped copies are attachment STATE
// (they drive isAttached / Detach), NOT extra vault rows — otherwise attaching shows a confusing duplicate.
const vaultRows = computed(() => rows.value.filter(c => c.is_global))

const securityPoints = [
  'Stored encrypted at rest and in transit',
  'Centralized access with granular permissions',
  'Reusable across agents and workflows',
  'Audit logs and usage tracking included',
]
const permissionModes = [
  { title: 'Use-Only', tag: 'Recommended', desc: 'Agent can use the credential to perform actions, but cannot see the value.', icon: UserRoundCheck, tint: 'bg-blue-50 text-blue-600' },
  { title: 'View', desc: 'Agent can view credential details safe for non-sensitive information.', icon: Eye, tint: 'bg-violet-50 text-violet-600' },
  { title: 'Edit', desc: 'Agent can update the credential value, description, and sharing.', icon: Pencil, tint: 'bg-orange-50 text-orange-600' },
]

const typeOptions = computed(() => [...new Set(vaultRows.value.map(credType).filter(Boolean))])
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return vaultRows.value.filter(c => {
    const type = credType(c)
    const matchesType = typeFilter.value === 'all' || type === typeFilter.value
    const text = [c.credential_name, c.name, c.service_name, c.auth_type, c.scope_type].filter(Boolean).join(' ').toLowerCase()
    return matchesType && (!q || text.includes(q))
  })
})
const pageCount = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)))
const pageRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const rangeLabel = computed(() => {
  if (!filteredRows.value.length) return '0'
  const start = (page.value - 1) * pageSize + 1
  return `${start}-${Math.min(start + pageSize - 1, filteredRows.value.length)}`
})

watch([search, typeFilter], () => { page.value = 1 })
watch(pageCount, (count) => { if (page.value > count) page.value = count })

function credType(c) {
  if (c.scope_type === 'builtin_tool') return 'Built-in'
  return c.auth_type || c.credential_type || c.service_name || 'API Key'
}
function initials(c) {
  const name = c.service_name || c.credential_name || c.name || 'Key'
  return name.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
function lastUsed(c) {
  return c.last_used_at ? ago(c.last_used_at) : 'Never'
}

async function loadCredentials() {
  loading.value = true
  try {
    const res = await credentialsApi.listGlobal()
    rows.value = res.data?.credentials || res.data?.results || (Array.isArray(res.data) ? res.data : [])
  } catch (e) {
    rows.value = []
    notify.error('Failed to load credentials')
  } finally {
    loading.value = false
  }
}
async function attach(cred) {
  if (!props.agent.id) return
  attachingId.value = cred.id
  try {
    await credentialsApi.assign(props.agent.id, cred.id)
    notify.success('Credential attached')
    await loadCredentials()   // refresh so the attached state (and Detach) reflects the backend
  } catch (e) {
    // 409 = the agent already has a credential for THIS scope (the backend allows one per scope). Surface
    // it — silently resyncing made the click look like it did nothing.
    if (e?.response?.status === 409) {
      notify.error(e?.response?.data?.error || 'This agent already has a credential for this scope — detach it first.')
      await loadCredentials()
    } else {
      notify.error(e?.response?.data?.error || 'Could not attach credential')
    }
  } finally {
    attachingId.value = null
  }
}
async function detach(cred) {
  if (!props.agent.id) return
  const attachedId = attachedCopies.value[credKey(cred)]
  if (!attachedId) return
  detachingId.value = cred.id
  try {
    await credentialsApi.delete(props.agent.id, attachedId)
    notify.success('Credential detached')
    await loadCredentials()
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Could not detach credential')
  } finally {
    detachingId.value = null
  }
}

onMounted(loadCredentials)
</script>

<style scoped>
.control { height: 36px; border: 1px solid #D9E0EA; border-radius: 8px; background: #fff; padding: 0 12px; font-size: 12px; font-weight: 500; color: #344054; outline: none; box-shadow: 0 1px 2px rgba(16,24,40,.03); }
.control:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EAF0FF; }
.attach-btn { border: 1px solid #9DB7F8; color: #155EEF; background: #fff; border-radius: 9px; padding: 7px 14px; font-size: 12.5px; font-weight: 650; }
.attach-btn:hover:not(:disabled) { background: #EFF4FF; border-color: #2563EB; }
.attach-btn:disabled { opacity: .6; cursor: not-allowed; }
.detach-btn { border: 1px solid #FDA29B; color: #B42318; background: #fff; border-radius: 9px; padding: 7px 12px; font-size: 12.5px; font-weight: 650; }
.detach-btn:hover:not(:disabled) { background: #FEF3F2; border-color: #F04438; }
.detach-btn:disabled { opacity: .6; cursor: not-allowed; }
.page-btn, .page-num { display: grid; height: 32px; min-width: 32px; place-items: center; border-radius: 8px; font-size: 12.5px; font-weight: 650; }
.page-btn:disabled { opacity: .4; }
.page-btn:hover:not(:disabled), .page-num:hover { background: #F1F5F9; }
</style>
