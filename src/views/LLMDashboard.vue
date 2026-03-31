<template>
  <div class="min-h-screen bg-slate-50/50 p-6 sm:p-8 font-sans">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">AI Cost Dashboard</h1>
        <p class="text-[14px] text-slate-500 mt-1 font-medium">Monitor usage, costs, and audit LLM requests</p>
      </div>
      <div class="flex items-center gap-3">
        <select v-model="agentFilter" @change="refreshAll" class="bg-white text-slate-700 rounded-[10px] px-3 py-2 text-[14px] font-medium border border-slate-200 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all outline-none shadow-sm cursor-pointer">
          <option value="">All Agents</option>
          <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
        <button @click="refreshAll" class="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-[10px] text-[14px] font-semibold transition-all shadow-md flex items-center gap-2">
          <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- Unified Metrics Board -->
    <div class="bg-white border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] rounded-[16px] mb-8 overflow-hidden">
      <div class="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <!-- Total Requests -->
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <p class="text-[13px] font-bold tracking-wide uppercase text-slate-500">Total Requests</p>
            <div class="w-10 h-10 rounded-[10px] bg-blue-500/10 flex items-center justify-center">
               <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
          </div>
          <p class="text-4xl font-extrabold tracking-tight text-slate-900">{{ stats?.total_requests || 0 }}</p>
          <p class="text-[13px] text-slate-500 mt-2 font-medium"><span class="text-blue-600 font-bold">+{{ stats?.requests_24h || 0 }}</span> in last 24h</p>
        </div>

        <!-- Total Cost -->
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <p class="text-[13px] font-bold tracking-wide uppercase text-slate-500">Total Cost</p>
            <div class="w-10 h-10 rounded-[10px] bg-emerald-500/10 flex items-center justify-center">
               <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <p class="text-4xl font-extrabold tracking-tight text-slate-900">${{ (usage?.total_cost || 0).toFixed(4) }}</p>
          <p class="text-[13px] text-slate-500 mt-2 font-medium">USD estimated</p>
        </div>

        <!-- Avg Latency -->
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <p class="text-[13px] font-bold tracking-wide uppercase text-slate-500">Avg Latency</p>
            <div class="w-10 h-10 rounded-[10px] bg-purple-500/10 flex items-center justify-center">
               <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <p class="text-4xl font-extrabold tracking-tight text-slate-900">{{ stats?.avg_latency_ms ? Math.round(stats.avg_latency_ms / 1000) + 's' : '—' }}</p>
          <div class="flex items-center gap-2 mt-2">
             <span :class="['w-2.5 h-2.5 rounded-full', stats?.error_rate > 0 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]']"></span>
             <p class="text-[13px] text-slate-500 font-medium">{{ stats?.error_rate ? (stats.error_rate * 100).toFixed(1) + '% error rate' : '0% error rate' }}</p>
          </div>
        </div>

        <!-- Top Model -->
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <p class="text-[13px] font-bold tracking-wide uppercase text-slate-500">Top Model</p>
            <div class="w-10 h-10 rounded-[10px] bg-amber-500/10 flex items-center justify-center">
               <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </div>
          </div>
          <p class="text-2xl font-extrabold tracking-tight text-slate-900 truncate mt-1.5" :title="stats?.top_provider_model?.model || '—'">{{ stats?.top_provider_model?.model || '—' }}</p>
          <p class="text-[13px] text-slate-500 mt-2 font-medium">{{ stats?.top_provider_model?.total_requests || 0 }} requests</p>
        </div>
      </div>
    </div>

    <!-- Cost Breakdown -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <!-- By Provider -->
      <div class="bg-white border border-slate-200/60 shadow-sm rounded-[16px] p-6 hover:-translate-y-1 transition-transform duration-200">
        <h3 class="text-[16px] font-extrabold text-slate-900 mb-6 flex items-center gap-2">
            <span class="w-1.5 h-6 bg-blue-500 rounded-full"></span>
            Cost by Provider
        </h3>
        <div v-if="!usage?.cost_by_provider?.length" class="text-slate-400 text-[14px] font-medium py-4 text-center border border-dashed border-slate-200 rounded-lg">No data yet</div>
        <div v-else class="space-y-5">
          <div v-for="item in usage.cost_by_provider" :key="item.provider_type" class="flex items-center gap-4 w-full">
            <div class="w-24 text-[13px] font-bold text-slate-700 truncate" :title="item.provider_type">{{ item.provider_type || 'unknown' }}</div>
            <div class="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden shrink-0 min-w-10">
              <div class="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 shadow-inner"
                :style="{ width: providerBarWidth(item.cost) }"></div>
            </div>
            <div class="w-16 text-right text-[13px] font-mono font-bold text-emerald-600 shrink-0">${{ item.cost.toFixed(4) }}</div>
            <div class="w-16 text-right text-[12px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 shrink-0 shadow-sm">{{ item.requests }} <span class="text-[10px] uppercase text-slate-400">req</span></div>
          </div>
        </div>
      </div>

      <!-- By Model -->
      <div class="bg-white border border-slate-200/60 shadow-sm rounded-[16px] p-6 hover:-translate-y-1 transition-transform duration-200">
        <h3 class="text-[16px] font-extrabold text-slate-900 mb-6 flex items-center gap-2">
            <span class="w-1.5 h-6 bg-purple-500 rounded-full"></span>
            Top Models by Cost
        </h3>
        <div v-if="!usage?.cost_by_model?.length" class="text-slate-400 text-[14px] font-medium py-4 text-center border border-dashed border-slate-200 rounded-lg">No data yet</div>
        <div v-else class="space-y-5">
          <div v-for="item in usage.cost_by_model" :key="item.model_name" class="flex items-center gap-4 w-full">
            <div class="w-36 text-[12px] font-mono font-semibold text-slate-600 truncate bg-slate-50 px-2 py-1.5 rounded-md border border-slate-100 shadow-sm" :title="item.model_name">{{ item.model_name || 'unknown' }}</div>
            <div class="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden shrink-0 min-w-10">
              <div class="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all duration-500 shadow-inner"
                :style="{ width: modelBarWidth(item.cost) }"></div>
            </div>
            <div class="w-20 text-right text-[13px] font-mono font-bold text-emerald-600 shrink-0">${{ item.cost.toFixed(4) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs: Requests / Audit -->
    <div class="mb-5">
      <div class="inline-flex bg-slate-100/80 p-1 rounded-[12px] items-center">
        <button
          @click="activeTab = 'requests'"
          :class="[
            'px-5 py-2 text-[14px] font-bold rounded-[10px] transition-all',
            activeTab === 'requests' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          ]"
        >
          Request Log
        </button>
        <button
          @click="activeTab = 'audit'"
          :class="[
            'px-5 py-2 text-[14px] font-bold rounded-[10px] transition-all',
            activeTab === 'audit' ? 'bg-white text-purple-600 shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          ]"
        >
          Audit Trail
        </button>
      </div>
    </div>

    <!-- Data Tables Container -->
    <div class="bg-white border border-slate-200/80 shadow-[0_4px_16px_rgba(0,0,0,0.04)] rounded-[16px] overflow-hidden">
      <!-- Request Log Tab -->
      <div v-if="activeTab === 'requests'" class="p-6">
        <!-- Filters -->
        <div class="flex flex-wrap gap-3 mb-6">
          <select v-model="reqProviderFilter" @change="loadRequests" class="bg-slate-50 text-slate-700 rounded-[10px] px-3.5 py-2 text-[13px] font-bold border border-slate-200 hover:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm">
            <option value="">All Providers</option>
            <option v-for="p in providerOptions" :key="p" :value="p">{{ p }}</option>
          </select>
          <select v-model="reqStatusFilter" @change="loadRequests" class="bg-slate-50 text-slate-700 rounded-[10px] px-3.5 py-2 text-[13px] font-bold border border-slate-200 hover:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm">
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="timeout">Timeout</option>
          </select>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto rounded-[12px] border border-slate-200 shadow-sm">
          <table class="w-full text-left border-collapse">
            <thead class="bg-slate-50/80">
              <tr class="text-[11px] font-extrabold tracking-widest uppercase text-slate-500 border-b border-slate-200">
                <th class="px-5 py-3.5">Provider</th>
                <th class="px-5 py-3.5">Model</th>
                <th class="px-5 py-3.5">Status</th>
                <th class="px-5 py-3.5 text-right">Latency</th>
                <th class="px-5 py-3.5 text-right">Tokens</th>
                <th class="px-5 py-3.5 text-right">Cost</th>
                <th class="px-5 py-3.5 text-right">Time</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <tr v-for="req in requests" :key="req.id" class="hover:bg-blue-50/40 transition-colors group">
                <td class="px-5 py-3.5 text-[13px] font-extrabold text-slate-800">{{ req.provider || '—' }}</td>
                <td class="px-5 py-3.5 text-[12px] font-mono font-medium text-slate-600 max-w-[200px] truncate" :title="req.model">{{ req.model || '—' }}</td>
                <td class="px-5 py-3.5">
                  <span :class="statusBadge(req.status)">{{ req.status }}</span>
                </td>
                <td class="px-5 py-3.5 text-[13px] font-mono font-medium text-slate-500 text-right">{{ req.latency_ms ? (req.latency_ms / 1000).toFixed(1) + 's' : '—' }}</td>
                <td class="px-5 py-3.5 text-[13px] font-mono font-medium text-slate-500 text-right">{{ req.total_tokens || '—' }}</td>
                <td class="px-5 py-3.5 text-[13px] font-mono font-black text-emerald-600 text-right">${{ (req.cost_estimate || 0).toFixed(4) }}</td>
                <td class="px-5 py-3.5 text-[12px] text-slate-400 font-bold text-right">{{ formatTime(req.created_at) }}</td>
              </tr>
              <tr v-if="!requests.length">
                 <td colspan="7" class="px-5 py-10 text-center text-[14px] font-bold text-slate-400">No requests found.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="reqTotalPages > 1" class="flex flex-col sm:flex-row sm:items-center justify-between mt-6 gap-3">
          <span class="text-[13px] font-bold text-slate-500">{{ reqCount }} total requests</span>
          <div class="flex items-center gap-2">
            <button @click="reqPage--; loadRequests()" :disabled="reqPage <= 1" class="px-4 py-2 rounded-[8px] text-[13px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors">Prev</button>
            <span class="text-[13px] font-bold text-slate-400 px-3">{{ reqPage }} / {{ reqTotalPages }}</span>
            <button @click="reqPage++; loadRequests()" :disabled="reqPage >= reqTotalPages" class="px-4 py-2 rounded-[8px] text-[13px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      </div>

      <!-- Audit Trail Tab -->
      <div v-if="activeTab === 'audit'" class="p-6">
        <!-- Filters -->
        <div class="flex flex-wrap gap-3 mb-6">
           <select v-model="auditAgentFilter" @change="loadAudit" class="bg-slate-50 text-slate-700 rounded-[10px] px-3.5 py-2 text-[13px] font-bold border border-slate-200 hover:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all shadow-sm">
            <option value="">All Agents</option>
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <input v-model="auditConvFilter" @change="loadAudit" placeholder="Conversation ID..." class="bg-slate-50 text-slate-700 rounded-[10px] px-3.5 py-2 text-[13px] font-medium border border-slate-200 hover:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all shadow-sm w-72 placeholder:font-sans font-mono" />
        </div>

        <!-- Audit Entries -->
        <div class="space-y-4">
          <div v-if="!auditEntries.length" class="text-slate-400 text-[14px] font-bold py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
             No audit data available.
          </div>
          
          <div v-for="entry in auditEntries" :key="entry.id" class="border border-slate-200 rounded-[14px] overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
            <!-- Header -->
            <div @click="toggleAudit(entry.id)" class="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-purple-50/30 transition-colors">
              <div class="flex items-center gap-4">
                <span :class="statusBadge(entry.status)">{{ entry.status }}</span>
                <span class="text-[13px] font-extrabold text-slate-800">{{ entry.provider }}</span>
                <span class="text-[12px] font-mono font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 shadow-sm" :title="entry.model">{{ entry.model }}</span>
                <span v-if="entry.agent" class="text-[10px] font-black tracking-widest uppercase bg-purple-100 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-md">{{ entry.agent }}</span>
              </div>
              <div class="flex items-center gap-5">
                <span class="text-emerald-600 text-[13px] font-mono font-black">${{ (entry.cost_estimate || 0).toFixed(4) }}</span>
                <span class="text-slate-400 text-[12px] font-bold">{{ formatTime(entry.created_at) }}</span>
                <span class="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-500 shadow-sm transition-transform" :class="{ 'rotate-180 bg-purple-100 text-purple-700 border-purple-200': expandedAudit.has(entry.id) }">
                   <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </span>
              </div>
            </div>
            
            <!-- Detail Content -->
            <div v-if="expandedAudit.has(entry.id)" class="p-6 bg-slate-50/80 border-t border-slate-200 space-y-5">
              <div v-if="entry.audit_data?.prompt" class="space-y-2">
                <p class="text-[12px] font-black tracking-widest uppercase text-slate-500">Prompt payload</p>
                <div class="bg-slate-900 border border-slate-800 rounded-[12px] p-5 shadow-inner overflow-hidden relative group">
                   <div class="absolute top-3 right-3 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-800 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Request</div>
                   <pre class="text-slate-300 font-mono text-[12px] whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">{{ entry.audit_data.prompt }}</pre>
                </div>
              </div>
              
              <div v-if="entry.audit_data?.tool_calls?.length" class="space-y-2">
                <p class="text-[12px] font-black tracking-widest uppercase text-indigo-500">Tool Executions</p>
                <div class="bg-indigo-950 border border-indigo-900 rounded-[12px] p-5 shadow-inner overflow-hidden relative group">
                  <div class="absolute top-3 right-3 text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-900 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Methods</div>
                  <pre class="text-indigo-200 font-mono text-[12px] whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">{{ JSON.stringify(entry.audit_data.tool_calls, null, 2) }}</pre>
                </div>
              </div>
              
              <div v-if="entry.audit_data?.response" class="space-y-2">
                <p class="text-[12px] font-black tracking-widest uppercase text-emerald-600">Response output</p>
                <div class="bg-slate-900 border border-emerald-900/30 rounded-[12px] p-5 shadow-inner overflow-hidden relative group">
                  <div class="absolute top-3 right-3 text-[10px] font-black uppercase tracking-widest text-emerald-600/50 bg-slate-800 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Response</div>
                  <pre class="text-emerald-400/90 font-mono text-[12px] whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">{{ entry.audit_data.response }}</pre>
                </div>
              </div>
              
              <div v-if="!entry.audit_data || Object.keys(entry.audit_data).length === 0" class="text-slate-500 text-[13px] font-bold italic py-3">
                No telemetry details captured for this specific invocation.
              </div>
              
              <!-- Metrics Footer -->
              <div class="flex flex-wrap gap-5 text-[12px] font-mono font-bold text-slate-500 pt-4 border-t border-slate-200">
                <span class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                   <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                   {{ entry.latency_ms ? (entry.latency_ms / 1000).toFixed(1) + 's' : '—' }}
                </span>
                <span class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                   <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                   {{ entry.total_tokens || '0' }} <span class="font-sans text-[10px] font-black text-slate-400 uppercase tracking-widest">tok</span>
                </span>
                <span v-if="entry.conversation_id" class="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-lg shadow-sm border border-purple-100 text-purple-700">
                   <span class="font-sans text-[10px] font-black uppercase tracking-widest">Conv</span>
                   {{ entry.conversation_id }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="auditTotalPages > 1" class="flex flex-col sm:flex-row sm:items-center justify-between mt-6 gap-3">
          <span class="text-[13px] font-bold text-slate-500">{{ auditCount }} total entries</span>
          <div class="flex items-center gap-2">
            <button @click="auditPage--; loadAudit()" :disabled="auditPage <= 1" class="px-4 py-2 rounded-[8px] text-[13px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors">Prev</button>
            <span class="text-[13px] font-bold text-slate-400 px-3">{{ auditPage }} / {{ auditTotalPages }}</span>
            <button @click="auditPage++; loadAudit()" :disabled="auditPage >= auditTotalPages" class="px-4 py-2 rounded-[8px] text-[13px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors">Next</button>
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
  'inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border': true,
  'bg-emerald-50 text-emerald-600 border-emerald-200': status === 'success',
  'bg-red-50 text-red-600 border-red-200': status === 'error',
  'bg-amber-50 text-amber-600 border-amber-200': status === 'timeout',
  'bg-slate-50 text-slate-600 border-slate-200': !['success','error','timeout'].includes(status),
})

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
