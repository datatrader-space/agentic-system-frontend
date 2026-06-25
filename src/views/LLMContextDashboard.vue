<template>
  <div class="min-h-screen p-6 sm:p-8 font-sans">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="font-display text-3xl font-extrabold tracking-tight text-ink">LLM Context System</h1>
        <p class="text-[14px] text-ink-soft mt-1 font-medium">
          Phase 2 store counts, retention footprint, and embedding cost (admin only)
        </p>
      </div>
      <div class="flex items-center gap-3">
        <select
          v-model.number="days"
          @change="load"
          class="bg-white text-slate-700 rounded-[10px] px-3 py-2 text-[14px] font-medium border border-slate-200 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all outline-none shadow-sm cursor-pointer"
        >
          <option :value="7">Last 7 days</option>
          <option :value="30">Last 30 days</option>
          <option :value="90">Last 90 days</option>
        </select>
        <button
          @click="load"
          class="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-[10px] text-[14px] font-semibold transition-all shadow-md flex items-center gap-2"
        >
          <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-8 bg-rose-50 border border-rose-200 text-rose-700 rounded-[12px] px-5 py-4 text-[14px] font-medium">
      {{ error }}
    </div>

    <PageLoader v-else-if="loading && !hasLoaded" label="Loading context stats…" min-height="320px" />

    <template v-else>
      <!-- Cost board -->
      <div class="bg-white border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] rounded-[16px] mb-8 overflow-hidden">
        <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div class="p-6">
            <p class="text-[13px] font-bold tracking-wide uppercase text-slate-500 mb-3">Embedding Cost</p>
            <p class="text-4xl font-extrabold tracking-tight text-slate-900">${{ (stats.embedding_cost || 0).toFixed(4) }}</p>
            <p class="text-[13px] text-slate-500 mt-2 font-medium">{{ fmt(stats.embedding_requests) }} requests · {{ fmt(stats.embedding_tokens) }} tokens</p>
          </div>
          <div class="p-6">
            <p class="text-[13px] font-bold tracking-wide uppercase text-slate-500 mb-3">Vector Chunks</p>
            <p class="text-4xl font-extrabold tracking-tight text-slate-900">{{ fmt(stats.vector_chunks) }}</p>
            <p class="text-[13px] text-slate-500 mt-2 font-medium">indexed conversation messages</p>
          </div>
          <div class="p-6">
            <p class="text-[13px] font-bold tracking-wide uppercase text-slate-500 mb-3">Active Memory Items</p>
            <p class="text-4xl font-extrabold tracking-tight text-slate-900">{{ fmt(stats.structured_memory_active) }}</p>
            <p class="text-[13px] text-slate-500 mt-2 font-medium">structured memory (status=active)</p>
          </div>
        </div>
      </div>

      <!-- Store counts -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <div v-for="c in cards" :key="c.label" class="bg-white border border-slate-200/60 shadow-sm rounded-[14px] p-5">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[12px] font-bold tracking-wide uppercase text-slate-500">{{ c.label }}</p>
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" :class="c.backend === 'db' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'">{{ c.backend }}</span>
          </div>
          <p class="text-3xl font-extrabold tracking-tight text-slate-900">{{ fmt(c.value) }}</p>
          <p class="text-[12px] text-slate-400 mt-1 font-medium">{{ c.hint }}</p>
        </div>
      </div>

      <!-- LLM cost by source -->
      <div class="bg-white border border-slate-200/60 shadow-sm rounded-[16px] p-6">
        <h3 class="text-[16px] font-extrabold text-slate-900 mb-6 flex items-center gap-2">
          <span class="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
          LLM Cost by Source <span class="text-[13px] font-medium text-slate-400">· last {{ days }} days</span>
        </h3>
        <div v-if="!costBySource.length" class="text-slate-400 text-[14px] font-medium py-4 text-center border border-dashed border-slate-200 rounded-lg">
          No LLM requests in this window
        </div>
        <table v-else class="w-full text-[14px]">
          <thead>
            <tr class="text-left text-[12px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100">
              <th class="py-2">Source</th>
              <th class="py-2 text-right">Requests</th>
              <th class="py-2 text-right">Cost (USD)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in costBySource" :key="row.source" class="border-b border-slate-50 last:border-0">
              <td class="py-2.5 font-semibold text-slate-700">{{ row.source }}</td>
              <td class="py-2.5 text-right text-slate-600">{{ fmt(row.n) }}</td>
              <td class="py-2.5 text-right font-bold text-slate-900">${{ row.cost.toFixed(4) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-[12px] text-slate-400 mt-6 font-medium">
        Cache hit/miss and token-estimate error are emitted to the app log
        (<code class="bg-slate-100 px-1 rounded">[LLM CACHE …]</code>,
        <code class="bg-slate-100 px-1 rounded">[LLM USAGE] estimate_error_percent</code>), not stored.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../services/api'
import PageLoader from '../components/common/PageLoader.vue'

const loading = ref(false)
const hasLoaded = ref(false)   // show the full-page spinner only on the first load
const error = ref('')
const days = ref(30)
const stats = ref({})

const fmt = (n) => (n == null ? '0' : Number(n).toLocaleString())

// Store counts, each tagged with the backend it lives in (db vs disk).
const cards = computed(() => {
  const s = stats.value || {}
  return [
    { label: 'Tool Memory (DB)', value: s.tool_memory_db_records, backend: 'db', hint: 'ToolResultRecord rows' },
    { label: 'Tool Memory (disk)', value: s.tool_memory_disk_convs, backend: 'disk', hint: 'conversations with refs.json' },
    { label: 'Checkpoints (DB)', value: s.checkpoint_db_rows, backend: 'db', hint: 'ConversationCheckpoint rows' },
    { label: 'Checkpoints (disk)', value: s.checkpoint_files, backend: 'disk', hint: 'checkpoint.json files' },
    { label: 'Artifact Index (DB)', value: s.artifact_index_rows, backend: 'db', hint: 'Artifact rows' },
    { label: 'Artifact Files', value: s.artifact_files, backend: 'disk', hint: 'tool-output artifacts' },
    { label: 'Long Answers', value: s.long_answer_files, backend: 'disk', hint: 'stubbed assistant answers' },
    { label: 'Vector Chunks', value: s.vector_chunks, backend: 'db', hint: 'ConversationChunk rows' },
  ]
})

// The backend keys the source breakdown as `llm_cost_by_source_<days>d`.
const costBySource = computed(() => {
  const s = stats.value || {}
  const key = Object.keys(s).find((k) => k.startsWith('llm_cost_by_source_'))
  const obj = (key && s[key]) || {}
  return Object.entries(obj)
    .map(([source, v]) => ({ source, n: v.n || 0, cost: v.cost || 0 }))
    .sort((a, b) => b.cost - a.cost)
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('/admin/llm-context-stats/', { params: { days: days.value } })
    stats.value = res.data || {}
  } catch (e) {
    const code = e?.response?.status
    if (code === 403) error.value = 'Admin access required to view LLM context stats.'
    else error.value = e?.response?.data?.error || 'Failed to load LLM context stats.'
  } finally {
    loading.value = false
    hasLoaded.value = true
  }
}

onMounted(load)
</script>
