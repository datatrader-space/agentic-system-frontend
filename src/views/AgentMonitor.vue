<template>
  <div class="h-full overflow-y-auto bg-gray-50 p-4 sm:p-6">
    <div class="max-w-5xl mx-auto space-y-6">
      <!-- header -->
      <div class="flex items-center justify-between gap-4">
        <div>
          <button @click="goBack" class="text-sm text-indigo-600 hover:text-indigo-800">← Agents</button>
          <h1 class="text-xl font-bold text-slate-900 mt-1">
            Monitor <span class="text-slate-400 font-normal">· {{ agentName }}</span>
          </h1>
          <p class="text-xs text-slate-500 mt-0.5">Live operational data — signals, schedules &amp; cost (read-only).</p>
        </div>
        <button @click="refresh" :disabled="loading"
          class="text-sm px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50">
          <span v-if="loading" class="animate-spin inline-block">↻</span><span v-else>↻</span> Refresh
        </button>
      </div>

      <!-- stat cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white border border-slate-200 rounded-xl p-4">
          <div class="text-2xl font-bold text-indigo-600">{{ stats.queue?.pending ?? 0 }}</div>
          <div class="text-xs text-slate-500 mt-1">Pending</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-4">
          <div class="text-2xl font-bold text-emerald-600">{{ stats.totals?.processed ?? 0 }}</div>
          <div class="text-xs text-slate-500 mt-1">Processed</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-4">
          <div class="text-2xl font-bold text-red-500">{{ stats.totals?.dead ?? 0 }}</div>
          <div class="text-xs text-slate-500 mt-1">Dead Letters</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-4">
          <div class="text-2xl font-bold text-slate-700">${{ stats.cost?.today_usd ?? '0' }}</div>
          <div class="text-xs text-slate-500 mt-1">Today's Cost</div>
        </div>
      </div>

      <!-- signal log -->
      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span class="text-sm font-semibold text-slate-800">📡 Signal Log</span>
          <select v-model="statusFilter" @change="loadSignals"
            class="text-xs border border-slate-200 rounded px-2 py-1 bg-white">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="processed">Processed</option>
            <option value="failed">Failed</option>
            <option value="dead">Dead</option>
          </select>
        </div>
        <div v-if="signals.length === 0" class="p-8 text-center text-sm text-slate-400">No signals yet.</div>
        <div v-else class="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
          <div v-for="s in signals" :key="s.id" class="px-4 py-2.5 flex items-center gap-3 text-sm">
            <span :class="statusClass(s.status)" class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0">{{ s.status }}</span>
            <span class="font-medium text-slate-700 truncate max-w-[180px]">{{ s.signal_type }}</span>
            <span class="text-xs text-slate-400 truncate flex-1">{{ s.source }} · {{ fmt(s.created_at) }}</span>
            <span v-if="s.cost_usd" class="text-xs text-slate-500 shrink-0">${{ s.cost_usd }}</span>
            <button v-if="['dead','failed'].includes(s.status)" @click="retrySignal(s)" class="text-xs text-indigo-600 hover:underline shrink-0">Retry</button>
            <button v-if="['pending','processing'].includes(s.status)" @click="cancelSignal(s)" class="text-xs text-red-500 hover:underline shrink-0">Cancel</button>
          </div>
        </div>
      </div>

      <!-- schedules -->
      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100">
          <span class="text-sm font-semibold text-slate-800">⏱ Schedules</span>
        </div>
        <div v-if="schedules.length === 0" class="p-8 text-center text-sm text-slate-400">No schedules.</div>
        <div v-else class="divide-y divide-slate-100">
          <div v-for="s in schedules" :key="s.id" class="px-4 py-2.5 flex items-center gap-3 text-sm">
            <span :class="s.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'" class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0">{{ s.active ? 'active' : 'paused' }}</span>
            <span class="font-medium text-slate-700 truncate max-w-[200px]">{{ s.name }}</span>
            <span class="text-xs text-slate-400 font-mono flex-1 truncate">{{ s.schedule }}</span>
            <span class="text-xs text-slate-500 shrink-0">{{ s.run_count || 0 }} runs</span>
            <span v-if="s.last_error" class="text-xs text-red-500 shrink-0" :title="s.last_error">⚠</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import { notify } from '@/composables/useNotify'

const route = useRoute()
const router = useRouter()

const agentId = ref(route.params.id)
const agentName = ref('agent')
const stats = ref({})
const signals = ref([])
const schedules = ref([])
const statusFilter = ref('')
const loading = ref(false)

function fmt(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString() } catch (e) { return iso }
}

function statusClass(status) {
  const map = {
    processed: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-indigo-100 text-indigo-700',
    processing: 'bg-amber-100 text-amber-700',
    failed: 'bg-orange-100 text-orange-700',
    dead: 'bg-red-100 text-red-700',
    paused: 'bg-slate-100 text-slate-500',
  }
  return map[status] || 'bg-slate-100 text-slate-600'
}

async function loadAgent() {
  try {
    const res = await api.get(`/agents/${agentId.value}/`)
    agentName.value = res.data?.name || 'agent'
  } catch (e) { /* keep default */ }
}

async function loadStats() {
  try { stats.value = (await api.getSignalStats(agentId.value)).data || {} }
  catch (e) { stats.value = {} }
}

async function loadSignals() {
  try {
    const res = await api.getSignals(agentId.value, {
      status: statusFilter.value || undefined,
      limit: 50,
    })
    signals.value = res.data?.signals || res.data?.results || res.data || []
  } catch (e) { signals.value = [] }
}

async function loadSchedules() {
  try {
    const res = await api.get(`/agents/${agentId.value}/schedules/`)
    schedules.value = res.data?.schedules || res.data?.results || res.data || []
  } catch (e) { schedules.value = [] }
}

async function refresh() {
  loading.value = true
  await Promise.all([loadAgent(), loadStats(), loadSignals(), loadSchedules()])
  loading.value = false
}

async function retrySignal(s) {
  try { await api.retrySignal(agentId.value, s.id); await Promise.all([loadStats(), loadSignals()]) }
  catch (e) { notify.error('Retry failed: ' + (e.response?.data?.error || e.message)) }
}
async function cancelSignal(s) {
  try { await api.cancelSignal(agentId.value, s.id); await Promise.all([loadStats(), loadSignals()]) }
  catch (e) { notify.error('Cancel failed: ' + (e.response?.data?.error || e.message)) }
}

function goBack() { router.push('/dashboard/agents') }

watch(() => route.params.id, (id) => { agentId.value = id; refresh() })
onMounted(refresh)
</script>
