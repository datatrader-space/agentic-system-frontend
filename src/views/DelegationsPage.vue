<template>
  <!-- Delegation history / audit (Phase 10.4) — every sub-task the user's agents handed off, with its
       verification verdict. Reads the owner-scoped /api/delegations/ feed with status/verified filters. -->
  <div class="mx-auto w-full max-w-[1040px] px-6 py-8 font-[Inter,system-ui,sans-serif]">
    <div class="mb-4">
      <router-link to="/dashboard/super-agent" class="text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">← Super Agent</router-link>
      <h1 class="mt-1 text-[24px] font-bold tracking-tight text-[#0F172A]">Delegations</h1>
      <p class="mt-1 text-[13.5px] text-[#64748B]">Every sub-task your agents handed off — and whether the result was verified.</p>
    </div>

    <!-- Filters -->
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button v-for="f in filters" :key="f.key" @click="setFilter(f)"
              :class="['rounded-full px-3 py-1.5 text-[12px] font-semibold transition',
                       activeKey === f.key ? 'bg-indigo-600 text-white' : 'border border-[#E5E7EB] bg-white text-[#475467] hover:bg-[#F8FAFC]']">
        {{ f.label }}
      </button>
    </div>

    <div v-if="loading" class="py-16 text-center text-[13px] text-[#98A2B3]">Loading…</div>
    <div v-else-if="!rows.length" class="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-14 text-center">
      <p class="text-[14px] font-semibold text-[#475467]">No delegations yet</p>
      <p class="text-[12.5px] text-[#98A2B3]">When an agent hands a sub-task to a teammate, it shows up here.</p>
    </div>

    <div v-else class="overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white">
      <table class="w-full text-left text-[13px]">
        <thead class="border-b border-[#F2F4F7] text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
          <tr>
            <th class="px-4 py-3">Sub-agent</th>
            <th class="px-4 py-3">Task</th>
            <th class="px-4 py-3">Result</th>
            <th class="px-4 py-3 text-right">When</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="d in rows" :key="d.id">
            <tr class="border-b border-[#F7F8FA] last:border-0 align-top">
              <td class="px-4 py-3 font-medium text-[#0F172A] whitespace-nowrap">{{ d.sub_agent_name || 'agent' }}</td>
              <td class="px-4 py-3 text-[#475467]"><div class="max-w-[420px] truncate" :title="d.task">{{ d.task || '—' }}</div></td>
              <td class="px-4 py-3 whitespace-nowrap">
                <VerificationBadge :verified="d.verified" :status="d.status" />
                <!-- Expandable "why": the deterministic gate's verdict (checks + reasons), when recorded. -->
                <button v-if="hasWhy(d)" @click="toggleWhy(d.id)"
                        class="ml-2 inline-flex items-center gap-0.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                        :aria-expanded="openWhy === d.id ? 'true' : 'false'">
                  why
                  <svg :class="['h-3 w-3 transition-transform', openWhy === d.id ? 'rotate-180' : '']"
                       viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" clip-rule="evenodd" />
                  </svg>
                </button>
              </td>
              <td class="px-4 py-3 text-right text-[11.5px] text-[#98A2B3] whitespace-nowrap">{{ when(d.created_at) }}</td>
            </tr>
            <tr v-if="openWhy === d.id" class="border-b border-[#F7F8FA] last:border-0">
              <td colspan="4" class="bg-[#F8FAFC] px-4 py-3">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                  Verification checks<span v-if="d.verification && d.verification.method" class="normal-case font-medium"> · {{ d.verification.method }}</span>
                </div>
                <div v-if="d.verification && d.verification.checks" class="mt-1.5 flex flex-wrap gap-1.5">
                  <span v-for="(ok, key) in d.verification.checks" :key="key"
                        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                        :class="ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'">
                    {{ ok ? '✓' : '✕' }} {{ CHECK_LABELS[key] || key }}
                  </span>
                </div>
                <ul v-if="d.verification && d.verification.reasons && d.verification.reasons.length"
                    class="mt-1.5 list-disc pl-4 text-[12px] text-[#475467]">
                  <li v-for="(r, i) in d.verification.reasons" :key="i">{{ humanizeReason(r) }}</li>
                </ul>
                <p v-else class="mt-1.5 text-[12px] text-[#98A2B3]">All acceptance checks passed.</p>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import VerificationBadge from '../components/common/VerificationBadge.vue'
import { humanizeReason, CHECK_LABELS } from '../components/common/verificationBadge'

const rows = ref([])
const loading = ref(true)
const activeKey = ref('all')

// One row's "why" (gate verdict) open at a time — id of the open row, or null.
const openWhy = ref(null)
function toggleWhy(id) { openWhy.value = openWhy.value === id ? null : id }
function hasWhy(d) {
  const v = d && d.verification
  return !!(v && typeof v === 'object'
    && ((v.reasons && v.reasons.length) || (v.checks && Object.keys(v.checks).length)))
}

const filters = [
  { key: 'all', label: 'All', params: {} },
  { key: 'verified', label: 'Verified', params: { verified: 'true' } },
  { key: 'unverified', label: 'Unverified', params: { status: 'completed', verified: 'false' } },
  { key: 'failed', label: 'Failed', params: { status: 'failed' } },
]

function pickArray(d) { return Array.isArray(d) ? d : (d?.results ?? []) }

function when(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString() } catch (e) { return iso }
}

async function load(params = {}) {
  loading.value = true
  openWhy.value = null // rows are replaced — an open "why" panel would point at a stale row
  try {
    const { data } = await api.get('/delegations/', { params })
    rows.value = pickArray(data)
  } catch (e) {
    notify.error('Could not load delegations.')
  } finally {
    loading.value = false
  }
}

function setFilter(f) {
  activeKey.value = f.key
  load(f.params)
}

onMounted(() => load())
</script>
