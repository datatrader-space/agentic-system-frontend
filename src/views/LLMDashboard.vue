<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900 p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">AI Cost Dashboard</h1>
        <p class="text-gray-400 mt-1">Monitor usage, costs, and audit LLM requests</p>
      </div>
      <div class="flex items-center gap-3">
        <select v-model="agentFilter" @change="refreshAll" class="bg-gray-700/50 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <option value="">All Agents</option>
          <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
        <button @click="refreshAll" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2">
          <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-gray-800/60 backdrop-blur border border-gray-700/50 rounded-xl p-5">
        <div class="flex items-center justify-between">
          <p class="text-gray-400 text-sm font-medium">Total Requests</p>
          <div class="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
        </div>
        <p class="text-3xl font-bold text-white mt-2">{{ stats?.total_requests || 0 }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ stats?.requests_24h || 0 }} in last 24h</p>
      </div>

      <div class="bg-gray-800/60 backdrop-blur border border-gray-700/50 rounded-xl p-5">
        <div class="flex items-center justify-between">
          <p class="text-gray-400 text-sm font-medium">Total Cost</p>
          <div class="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
        <p class="text-3xl font-bold text-white mt-2">${{ (usage?.total_cost || 0).toFixed(4) }}</p>
        <p class="text-xs text-gray-500 mt-1">USD estimated</p>
      </div>

      <div class="bg-gray-800/60 backdrop-blur border border-gray-700/50 rounded-xl p-5">
        <div class="flex items-center justify-between">
          <p class="text-gray-400 text-sm font-medium">Avg Latency</p>
          <div class="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
        <p class="text-3xl font-bold text-white mt-2">{{ stats?.avg_latency_ms ? Math.round(stats.avg_latency_ms / 1000) + 's' : '—' }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ stats?.error_rate ? (stats.error_rate * 100).toFixed(1) + '% error rate' : '0% error rate' }}</p>
      </div>

      <div class="bg-gray-800/60 backdrop-blur border border-gray-700/50 rounded-xl p-5">
        <div class="flex items-center justify-between">
          <p class="text-gray-400 text-sm font-medium">Top Model</p>
          <div class="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          </div>
        </div>
        <p class="text-lg font-bold text-white mt-2 truncate">{{ stats?.top_provider_model?.model || '—' }}</p>
        <p class="text-xs text-gray-500 mt-1">{{ stats?.top_provider_model?.total_requests || 0 }} requests</p>
      </div>
    </div>

    <!-- Cost Breakdown -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <!-- By Provider -->
      <div class="bg-gray-800/60 backdrop-blur border border-gray-700/50 rounded-xl p-6">
        <h3 class="text-lg font-semibold text-white mb-4">Cost by Provider</h3>
        <div v-if="!usage?.cost_by_provider?.length" class="text-gray-500 text-sm">No data yet</div>
        <div v-else class="space-y-3">
          <div v-for="item in usage.cost_by_provider" :key="item.provider_type" class="flex items-center gap-3">
            <div class="w-24 text-sm text-gray-300 truncate">{{ item.provider_type || 'unknown' }}</div>
            <div class="flex-1 h-6 bg-gray-700/50 rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                :style="{ width: providerBarWidth(item.cost) }"></div>
            </div>
            <div class="w-20 text-right text-sm font-medium text-emerald-400">${{ item.cost.toFixed(4) }}</div>
            <div class="w-16 text-right text-xs text-gray-500">{{ item.requests }} req</div>
          </div>
        </div>
      </div>

      <!-- By Model -->
      <div class="bg-gray-800/60 backdrop-blur border border-gray-700/50 rounded-xl p-6">
        <h3 class="text-lg font-semibold text-white mb-4">Top Models by Cost</h3>
        <div v-if="!usage?.cost_by_model?.length" class="text-gray-500 text-sm">No data yet</div>
        <div v-else class="space-y-3">
          <div v-for="item in usage.cost_by_model" :key="item.model_name" class="flex items-center gap-3">
            <div class="w-36 text-sm text-gray-300 truncate" :title="item.model_name">{{ item.model_name || 'unknown' }}</div>
            <div class="flex-1 h-6 bg-gray-700/50 rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-400 transition-all duration-500"
                :style="{ width: modelBarWidth(item.cost) }"></div>
            </div>
            <div class="w-20 text-right text-sm font-medium text-emerald-400">${{ item.cost.toFixed(4) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs: Requests / Audit -->
    <div class="bg-gray-800/60 backdrop-blur border border-gray-700/50 rounded-xl">
      <div class="border-b border-gray-700/50 px-6 pt-4 flex gap-1">
        <button @click="activeTab = 'requests'" :class="tabClass('requests')">Request Log</button>
        <button @click="activeTab = 'audit'" :class="tabClass('audit')">Audit Trail</button>
      </div>

      <!-- Request Log Tab -->
      <div v-if="activeTab === 'requests'" class="p-6">
        <!-- Filters -->
        <div class="flex gap-3 mb-4">
          <select v-model="reqProviderFilter" @change="loadRequests" class="bg-gray-700/50 text-gray-200 rounded-lg px-3 py-1.5 text-sm border border-gray-600">
            <option value="">All Providers</option>
            <option v-for="p in providerOptions" :key="p" :value="p">{{ p }}</option>
          </select>
          <select v-model="reqStatusFilter" @change="loadRequests" class="bg-gray-700/50 text-gray-200 rounded-lg px-3 py-1.5 text-sm border border-gray-600">
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="timeout">Timeout</option>
          </select>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-gray-400 text-left border-b border-gray-700/50">
                <th class="pb-3 font-medium">Provider</th>
                <th class="pb-3 font-medium">Model</th>
                <th class="pb-3 font-medium">Status</th>
                <th class="pb-3 font-medium text-right">Latency</th>
                <th class="pb-3 font-medium text-right">Tokens</th>
                <th class="pb-3 font-medium text-right">Cost</th>
                <th class="pb-3 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700/30">
              <tr v-for="req in requests" :key="req.id" class="hover:bg-gray-700/20 transition-colors">
                <td class="py-2.5 text-gray-300">{{ req.provider || '—' }}</td>
                <td class="py-2.5 text-gray-300 max-w-[200px] truncate">{{ req.model || '—' }}</td>
                <td class="py-2.5">
                  <span :class="statusBadge(req.status)">{{ req.status }}</span>
                </td>
                <td class="py-2.5 text-gray-400 text-right">{{ req.latency_ms ? (req.latency_ms / 1000).toFixed(1) + 's' : '—' }}</td>
                <td class="py-2.5 text-gray-400 text-right">{{ req.total_tokens || '—' }}</td>
                <td class="py-2.5 text-emerald-400 text-right font-medium">${{ (req.cost_estimate || 0).toFixed(4) }}</td>
                <td class="py-2.5 text-gray-500 text-right text-xs">{{ formatTime(req.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="reqTotalPages > 1" class="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
          <span class="text-sm text-gray-500">{{ reqCount }} total requests</span>
          <div class="flex gap-2">
            <button @click="reqPage--; loadRequests()" :disabled="reqPage <= 1" class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 disabled:opacity-30">Prev</button>
            <span class="text-sm text-gray-400 py-1">{{ reqPage }} / {{ reqTotalPages }}</span>
            <button @click="reqPage++; loadRequests()" :disabled="reqPage >= reqTotalPages" class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 disabled:opacity-30">Next</button>
          </div>
        </div>
      </div>

      <!-- Audit Trail Tab -->
      <div v-if="activeTab === 'audit'" class="p-6">
        <!-- Filters -->
        <div class="flex gap-3 mb-4">
          <select v-model="auditAgentFilter" @change="loadAudit" class="bg-gray-700/50 text-gray-200 rounded-lg px-3 py-1.5 text-sm border border-gray-600">
            <option value="">All Agents</option>
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <input v-model="auditConvFilter" @change="loadAudit" placeholder="Conversation ID..." class="bg-gray-700/50 text-gray-200 rounded-lg px-3 py-1.5 text-sm border border-gray-600 w-48" />
        </div>

        <!-- Audit Entries -->
        <div class="space-y-3">
          <div v-if="!auditEntries.length" class="text-gray-500 text-sm">No audit data available</div>
          <div v-for="entry in auditEntries" :key="entry.id" class="border border-gray-700/50 rounded-lg overflow-hidden">
            <!-- Header -->
            <div @click="toggleAudit(entry.id)" class="flex items-center justify-between px-4 py-3 bg-gray-700/30 cursor-pointer hover:bg-gray-700/50 transition-colors">
              <div class="flex items-center gap-3">
                <span :class="statusBadge(entry.status)">{{ entry.status }}</span>
                <span class="text-gray-300 text-sm">{{ entry.provider }}/{{ entry.model }}</span>
                <span v-if="entry.agent" class="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">{{ entry.agent }}</span>
              </div>
              <div class="flex items-center gap-4">
                <span class="text-emerald-400 text-sm font-medium">${{ (entry.cost_estimate || 0).toFixed(4) }}</span>
                <span class="text-gray-500 text-xs">{{ formatTime(entry.created_at) }}</span>
                <svg class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-180': expandedAudit.has(entry.id) }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <!-- Detail -->
            <div v-if="expandedAudit.has(entry.id)" class="p-4 bg-gray-900/50 space-y-3 text-sm">
              <div v-if="entry.audit_data?.prompt" class="space-y-1">
                <p class="text-gray-400 font-medium">Prompt</p>
                <pre class="text-gray-300 bg-gray-800 rounded p-3 overflow-x-auto whitespace-pre-wrap text-xs max-h-48 overflow-y-auto">{{ entry.audit_data.prompt }}</pre>
              </div>
              <div v-if="entry.audit_data?.tool_calls?.length" class="space-y-1">
                <p class="text-gray-400 font-medium">Tool Calls</p>
                <pre class="text-gray-300 bg-gray-800 rounded p-3 overflow-x-auto whitespace-pre-wrap text-xs max-h-48 overflow-y-auto">{{ JSON.stringify(entry.audit_data.tool_calls, null, 2) }}</pre>
              </div>
              <div v-if="entry.audit_data?.response" class="space-y-1">
                <p class="text-gray-400 font-medium">Response</p>
                <pre class="text-gray-300 bg-gray-800 rounded p-3 overflow-x-auto whitespace-pre-wrap text-xs max-h-48 overflow-y-auto">{{ entry.audit_data.response }}</pre>
              </div>
              <div v-if="!entry.audit_data || Object.keys(entry.audit_data).length === 0" class="text-gray-500 italic">
                No audit data recorded for this request
              </div>
              <div class="flex gap-4 text-xs text-gray-500 pt-2 border-t border-gray-700/50">
                <span>Latency: {{ entry.latency_ms ? (entry.latency_ms / 1000).toFixed(1) + 's' : '—' }}</span>
                <span>Tokens: {{ entry.total_tokens || '—' }}</span>
                <span v-if="entry.conversation_id">Conv: {{ entry.conversation_id }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="auditTotalPages > 1" class="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
          <span class="text-sm text-gray-500">{{ auditCount }} total entries</span>
          <div class="flex gap-2">
            <button @click="auditPage--; loadAudit()" :disabled="auditPage <= 1" class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 disabled:opacity-30">Prev</button>
            <span class="text-sm text-gray-400 py-1">{{ auditPage }} / {{ auditTotalPages }}</span>
            <button @click="auditPage++; loadAudit()" :disabled="auditPage >= auditTotalPages" class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 disabled:opacity-30">Next</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import api from '../services/api'

const loading = ref(false)
const stats = ref(null)
const usage = ref(null)
const agents = ref([])
const agentFilter = ref('')

// Request Log
const requests = ref([])
const reqPage = ref(1)
const reqCount = ref(0)
const reqTotalPages = ref(1)
const reqProviderFilter = ref('')
const reqStatusFilter = ref('')

// Audit
const auditEntries = ref([])
const auditPage = ref(1)
const auditCount = ref(0)
const auditTotalPages = ref(1)
const auditAgentFilter = ref('')
const auditConvFilter = ref('')
const expandedAudit = reactive(new Set())

const activeTab = ref('requests')

const providerOptions = computed(() => {
  const providers = new Set()
  if (usage.value?.cost_by_provider) {
    usage.value.cost_by_provider.forEach(p => { if (p.provider_type) providers.add(p.provider_type) })
  }
  return [...providers]
})

const providerBarWidth = (cost) => {
  const max = Math.max(...(usage.value?.cost_by_provider || []).map(p => p.cost), 0.001)
  return Math.max(4, (cost / max) * 100) + '%'
}

const modelBarWidth = (cost) => {
  const max = Math.max(...(usage.value?.cost_by_model || []).map(m => m.cost), 0.001)
  return Math.max(4, (cost / max) * 100) + '%'
}

const statusBadge = (status) => ({
  'text-xs px-2 py-0.5 rounded-full font-medium': true,
  'bg-green-500/20 text-green-400': status === 'success',
  'bg-red-500/20 text-red-400': status === 'error',
  'bg-yellow-500/20 text-yellow-400': status === 'timeout',
})

const tabClass = (tab) => [
  'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
  activeTab.value === tab
    ? 'bg-gray-700/50 text-white border-b-2 border-blue-500'
    : 'text-gray-400 hover:text-gray-200'
]

const formatTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const toggleAudit = (id) => {
  if (expandedAudit.has(id)) expandedAudit.delete(id)
  else expandedAudit.add(id)
}

async function loadStats() {
  try {
    const params = {}
    if (agentFilter.value) params.agent_id = agentFilter.value
    const r = await api.getLlmStats(params)
    stats.value = r.data
  } catch (e) { console.error('Stats error:', e) }
}

async function loadUsage() {
  try {
    const params = {}
    if (agentFilter.value) params.agent_id = agentFilter.value
    const r = await api.getLlmUsage(params)
    usage.value = r.data
  } catch (e) { console.error('Usage error:', e) }
}

async function loadRequests() {
  try {
    const params = { page: reqPage.value }
    if (agentFilter.value) params.agent_id = agentFilter.value
    if (reqProviderFilter.value) params.provider = reqProviderFilter.value
    if (reqStatusFilter.value) params.status = reqStatusFilter.value
    const r = await api.getLlmRequests(params)
    requests.value = r.data.results
    reqCount.value = r.data.count
    reqTotalPages.value = r.data.total_pages
  } catch (e) { console.error('Requests error:', e) }
}

async function loadAudit() {
  try {
    const params = { page: auditPage.value }
    if (auditAgentFilter.value) params.agent_id = auditAgentFilter.value
    if (auditConvFilter.value) params.conversation_id = auditConvFilter.value
    const r = await api.getLlmAudit(params)
    auditEntries.value = r.data.results
    auditCount.value = r.data.count
    auditTotalPages.value = r.data.total_pages
  } catch (e) { console.error('Audit error:', e) }
}

async function loadAgents() {
  try {
    const r = await api.getAgents()
    agents.value = r.data.results || r.data || []
  } catch (e) { console.error('Agents error:', e) }
}

async function refreshAll() {
  loading.value = true
  await Promise.all([loadStats(), loadUsage(), loadRequests(), loadAudit()])
  loading.value = false
}

onMounted(async () => {
  loading.value = true
  await loadAgents()
  await Promise.all([loadStats(), loadUsage(), loadRequests(), loadAudit()])
  loading.value = false
})
</script>
