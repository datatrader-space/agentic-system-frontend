<template>
  <div class="min-h-screen p-6 sm:p-8 font-sans">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="font-display text-3xl font-extrabold tracking-tight text-ink">Conversation Steps</h1>
        <p class="text-[14px] text-ink-soft mt-1 font-medium">
          Durable tool-step timeline (internal ReAct trace) — admin/debug only. Raw output is hidden until
          you explicitly load a step; tool arguments are redacted at capture.
        </p>
      </div>
      <form class="flex items-center gap-2" @submit.prevent="load">
        <input
          v-model.number="conversationId" type="number" min="1" placeholder="Conversation ID"
          class="bg-white text-slate-700 rounded-[10px] px-3 py-2 text-[14px] font-medium border border-slate-200 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 outline-none shadow-sm w-44" />
        <button type="submit"
          class="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-[10px] text-[14px] font-semibold shadow-md flex items-center gap-2">
          <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Load
        </button>
      </form>
    </div>

    <div v-if="error" class="mb-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-[12px] px-5 py-4 text-[14px] font-medium">
      {{ error }}
    </div>

    <PageLoader v-if="loading && !hasLoaded" label="Loading steps…" min-height="280px" />

    <template v-else-if="hasLoaded">
      <div class="flex items-center gap-2 mb-4 text-[13px] text-slate-500 font-medium">
        <span class="font-bold text-slate-700">{{ steps.length }}</span> step(s) in conversation
        <span class="font-mono text-slate-700">#{{ loadedId }}</span>
      </div>

      <div v-if="!steps.length" class="bg-white border border-slate-200/60 rounded-[14px] p-8 text-center text-slate-500 text-[14px]">
        No durable steps recorded for this conversation.
      </div>

      <div v-else class="bg-white border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] rounded-[16px] overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-[13px]">
            <thead>
              <tr class="text-left text-slate-500 uppercase text-[11px] font-bold tracking-wide border-b border-slate-100 bg-slate-50/60">
                <th class="px-4 py-3">Turn / Seq</th>
                <th class="px-4 py-3">Type</th>
                <th class="px-4 py-3">Tool</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Summary / Error</th>
                <th class="px-4 py-3">Args (redacted)</th>
                <th class="px-4 py-3">Ref</th>
                <th class="px-4 py-3 text-right">Tokens</th>
                <th class="px-4 py-3">Created</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="s in steps" :key="s.id">
                <tr class="border-b border-slate-50 hover:bg-slate-50/40 align-top">
                  <td class="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">{{ s.turn_id || '—' }} · {{ s.seq }}</td>
                  <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-[11px] font-semibold" :class="typeClass(s.step_type)">{{ s.step_type }}</span></td>
                  <td class="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{{ s.tool_name || '—' }}</td>
                  <td class="px-4 py-3"><span v-if="s.status" class="px-2 py-0.5 rounded-full text-[11px] font-semibold" :class="statusClass(s.status)">{{ s.status }}</span></td>
                  <td class="px-4 py-3 text-slate-600 max-w-[260px]">
                    <div class="truncate">{{ s.output_summary || '—' }}</div>
                    <div v-if="s.error_message" class="text-rose-600 text-[12px] mt-0.5 truncate">⚠ {{ s.error_code }}: {{ s.error_message }}</div>
                  </td>
                  <td class="px-4 py-3 max-w-[220px]"><code class="text-[11px] text-slate-500 break-all">{{ argsPreview(s.args) }}</code></td>
                  <td class="px-4 py-3"><code class="text-[11px] text-slate-500 break-all">{{ s.output_ref }}</code></td>
                  <td class="px-4 py-3 text-right text-slate-500 whitespace-nowrap">{{ s.total_tokens != null ? fmt(s.total_tokens) : '—' }}</td>
                  <td class="px-4 py-3 text-slate-400 whitespace-nowrap text-[12px]">{{ fmtDate(s.created_at) }}</td>
                  <td class="px-4 py-3 text-right">
                    <button v-if="s.has_output" @click="toggleRaw(s)"
                      class="text-[12px] font-semibold px-2.5 py-1 rounded-[8px] border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors whitespace-nowrap">
                      {{ rawOpen[s.id] ? 'Hide raw' : 'View raw' }}
                    </button>
                  </td>
                </tr>
                <tr v-if="rawOpen[s.id]" :key="s.id + '-raw'" class="bg-slate-900">
                  <td colspan="10" class="px-4 py-3">
                    <div class="flex items-center gap-2 mb-2">
                      <input v-model="rawQuery[s.id]" @keyup.enter="loadRaw(s)" placeholder="grep within output (optional)"
                        class="bg-slate-800 text-slate-200 placeholder-slate-500 rounded-[8px] px-2.5 py-1 text-[12px] border border-slate-700 outline-none w-64" />
                      <button @click="loadRaw(s)" class="text-[12px] font-semibold px-3 py-1 rounded-[8px] bg-indigo-600 hover:bg-indigo-500 text-white">Apply</button>
                      <span v-if="rawErr[s.id]" class="text-rose-400 text-[12px] font-medium">{{ rawErr[s.id] }}</span>
                      <span v-else-if="rawLoading[s.id]" class="text-slate-400 text-[12px]">loading…</span>
                      <span class="ml-auto text-[11px] text-slate-500 font-mono">{{ s.output_ref }}</span>
                    </div>
                    <pre class="text-[12px] text-slate-100 whitespace-pre-wrap break-words max-h-[420px] overflow-auto font-mono leading-relaxed">{{ rawContent[s.id] ?? '' }}</pre>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <p class="text-[12px] text-slate-400 mt-4 font-medium">
        Internal trace — never shown to end users or the public widget. Secrets in tool arguments are
        redacted at capture; raw output loads only through an explicit, scope-checked per-step request.
      </p>
    </template>

    <div v-else class="bg-white border border-slate-200/60 rounded-[14px] p-8 text-center text-slate-500 text-[14px]">
      Enter a conversation ID and press <strong>Load</strong> to inspect its durable step timeline.
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import api from '../../services/api'
import PageLoader from '../../components/common/PageLoader.vue'

const conversationId = ref(null)
const loadedId = ref(null)
const steps = ref([])
const loading = ref(false)
const hasLoaded = ref(false)
const error = ref('')

const rawOpen = reactive({})
const rawContent = reactive({})
const rawLoading = reactive({})
const rawErr = reactive({})
const rawQuery = reactive({})

const fmt = (n) => (n == null ? '0' : Number(n).toLocaleString())
const fmtDate = (s) => (s ? new Date(s).toLocaleString() : '—')
const argsPreview = (a) => {
  if (!a || typeof a !== 'object' || !Object.keys(a).length) return '—'
  try { return JSON.stringify(a) } catch { return String(a) }
}
const typeClass = (t) => ({
  tool_call: 'bg-sky-50 text-sky-600',
  tool_result: 'bg-emerald-50 text-emerald-600',
  tool_error: 'bg-rose-50 text-rose-600',
}[t] || 'bg-slate-100 text-slate-500')
const statusClass = (s) => ({
  success: 'bg-emerald-50 text-emerald-600',
  failure: 'bg-rose-50 text-rose-600',
  requested: 'bg-slate-100 text-slate-500',
}[s] || 'bg-slate-100 text-slate-500')

async function load() {
  if (!conversationId.value) { error.value = 'Enter a conversation ID.'; return }
  loading.value = true
  error.value = ''
  try {
    const res = await api.get(`/admin/conversations/${conversationId.value}/steps/`)
    steps.value = res.data?.steps || []
    loadedId.value = res.data?.conversation_id
    // reset any open raw panels
    Object.keys(rawOpen).forEach((k) => delete rawOpen[k])
  } catch (e) {
    const code = e?.response?.status
    if (code === 403) error.value = 'Admin (staff) access is required to view conversation steps.'
    else if (code === 401) error.value = 'Please sign in as an administrator.'
    else error.value = e?.response?.data?.error || 'Failed to load steps.'
    steps.value = []
  } finally {
    loading.value = false
    hasLoaded.value = true
  }
}

function toggleRaw(s) {
  rawOpen[s.id] = !rawOpen[s.id]
  if (rawOpen[s.id] && rawContent[s.id] == null) loadRaw(s)
}

async function loadRaw(s) {
  rawLoading[s.id] = true
  rawErr[s.id] = ''
  try {
    const params = {}
    if (rawQuery[s.id]) params.query = rawQuery[s.id]
    const res = await api.get(`/admin/conversation-steps/${s.id}/raw/`, { params })
    rawContent[s.id] = res.data?.content ?? ''
  } catch (e) {
    const code = e?.response?.status
    if (code === 403) rawErr[s.id] = 'Forbidden (scope).'
    else if (code === 409) rawErr[s.id] = 'Integrity check failed.'
    else if (code === 404) rawErr[s.id] = 'Not found.'
    else rawErr[s.id] = 'Failed to load raw output.'
  } finally {
    rawLoading[s.id] = false
  }
}
</script>
