<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Knowledge &amp; RAG</h1>
        <p class="mt-1 text-[13.5px] text-slate-500 max-w-2xl">
          Your knowledge base. Upload files or crawl websites once here, then assign any source to your
          agents — assignment is by reference, so an update reflects everywhere instantly.
        </p>
      </div>
      <div v-if="scopeView === 'user'" class="flex items-center gap-2 shrink-0">
        <input ref="fileInput" type="file" class="hidden" @change="onFilePicked" />
        <button @click="$refs.fileInput.click()" :disabled="uploading"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <FileUp :size="15" :stroke-width="2" /> {{ uploading ? 'Uploading…' : 'Upload file' }}
        </button>
        <button @click="showWebModal = true"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
          <Plus :size="15" :stroke-width="2.2" /> Add website / URL
        </button>
      </div>
    </div>

    <!-- KB card -->
    <div class="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <!-- toolbar -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-100 flex-wrap">
        <h2 class="text-[14px] font-bold text-slate-900">Knowledge sources</h2>
        <span v-if="resources.length" class="text-[11px] font-semibold text-slate-400">{{ resources.length }} total</span>
        <select v-model="scopeView"
                class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-slate-600 cursor-pointer">
          <option value="user">Scope: My knowledge</option>
          <option value="conversation">Scope: By conversation</option>
        </select>
        <div class="relative flex-1 min-w-[160px]">
          <Search :size="14" :stroke-width="2" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="q" placeholder="Filter by name or URL"
                 class="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
        </div>
        <select v-model="kindFilter"
                class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-slate-600 cursor-pointer">
          <option value="all">All types</option>
          <option value="file">Files</option>
          <option value="website">Websites</option>
        </select>
        <button @click="load(true)" title="Refresh"
                class="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><RefreshCw :size="14" :stroke-width="2" /></button>
      </div>

      <!-- loading / empty -->
      <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-[13px] text-slate-400">
        <span class="w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></span> Loading…
      </div>
      <div v-else-if="!filtered.length" class="py-16 text-center">
        <Database :size="30" :stroke-width="1.5" class="mx-auto text-slate-300" />
        <p class="mt-2 text-[13px] font-semibold text-slate-600">{{ resources.length ? 'No matches' : 'No knowledge yet' }}</p>
        <p class="mt-0.5 text-[12px] text-slate-400">{{ resources.length ? 'Try a different filter.' : 'Upload a file or add a website to get started.' }}</p>
      </div>

      <!-- table -->
      <table v-else class="w-full text-[13px]">
        <thead>
          <tr class="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
            <th class="px-4 py-2.5">Name</th>
            <th v-if="isConvScope" class="px-3 py-2.5">Conversation</th>
            <th v-if="isConvScope" class="px-3 py-2.5">Agent</th>
            <th v-else class="px-3 py-2.5">Type</th>
            <th class="px-3 py-2.5">Status</th>
            <th class="px-3 py-2.5 text-right">Chunks</th>
            <th class="px-3 py-2.5 text-right">Cost</th>
            <th v-if="!isConvScope" class="px-3 py-2.5 text-right">Agents</th>
            <th v-if="!isConvScope" class="px-4 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in paged" :key="r.id" class="border-b border-slate-50 hover:bg-slate-50/60">
            <td class="px-4 py-2.5">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                      :class="r.kind === 'website' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'">
                  <Globe v-if="r.kind === 'website'" :size="15" :stroke-width="2" />
                  <FileText v-else :size="15" :stroke-width="2" />
                </span>
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-900 max-w-[260px]" :title="r.name">{{ r.name }}</div>
                  <div v-if="r.root_url" class="truncate text-[11px] text-slate-400 max-w-[260px]">{{ r.root_url }}</div>
                </div>
              </div>
            </td>
            <td v-if="isConvScope" class="px-3 py-2.5">
              <span class="truncate block max-w-[200px] text-slate-600" :title="r.conversation_title">{{ r.conversation_title }}</span>
            </td>
            <td v-if="isConvScope" class="px-3 py-2.5 text-slate-600">{{ r.agent_name || '—' }}</td>
            <td v-else class="px-3 py-2.5"><span class="capitalize text-slate-600">{{ r.kind }}</span></td>
            <td class="px-3 py-2.5">
              <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" :class="statusPill(r.status)">
                <span v-if="isBusy(r.status)" class="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin"></span>
                {{ statusLabel(r.status) }}
              </span>
            </td>
            <td class="px-3 py-2.5 text-right text-slate-600">{{ r.chunk_count }}</td>
            <td class="px-3 py-2.5 text-right font-medium text-slate-700">{{ fmtCost(r.cost_usd) }}</td>
            <td v-if="!isConvScope" class="px-3 py-2.5 text-right text-slate-600">{{ r.assigned_agent_count }}</td>
            <td v-if="!isConvScope" class="px-4 py-2.5">
              <div class="flex items-center justify-end gap-1">
                <button v-if="r.kind === 'website'" @click="managePages(r)" title="Manage pages"
                        class="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><Settings2 :size="15" :stroke-width="2" /></button>
                <button @click="doExport(r)" :disabled="busy[r.id]" title="Export"
                        class="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"><Download :size="15" :stroke-width="2" /></button>
                <button @click="remove(r)" :disabled="busy[r.id]" title="Delete"
                        class="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40"><Trash2 :size="15" :stroke-width="2" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- pagination -->
      <div v-if="filtered.length" class="flex items-center gap-3 px-4 py-3 border-t border-slate-100">
        <span class="text-[12px] text-slate-500">
          {{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, filtered.length) }} of {{ filtered.length }}
        </span>
        <div class="ml-auto flex items-center gap-2">
          <button @click="page > 1 && page--" :disabled="page <= 1"
                  class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">←</button>
          <span class="text-[12px] text-slate-500">Page {{ page }} of {{ totalPages }}</span>
          <button @click="page < totalPages && page++" :disabled="page >= totalPages"
                  class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">→</button>
        </div>
      </div>
    </div>

    <p class="mt-4 text-[12px] text-slate-400">
      Export: files download the original; websites download a CSV of every crawled page's full content.
      Assign a source to an agent from the agent editor → <strong>Knowledge</strong> step.
    </p>

    <AddWebsiteSourceModal v-if="showWebModal" standalone
                           @close="showWebModal = false" @added="onSourceChanged" @doc-added="onSourceChanged" />
    <WebSourcePagesModal v-if="pagesSource" :source="pagesSource"
                         @close="pagesSource = null" @updated="load(true)" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { Database, FileText, Globe, Download, Trash2, Plus, FileUp, Settings2, Search, RefreshCw } from 'lucide-vue-next'
import api from '../services/api'
import { notify } from '../composables/useNotify'
import { confirm } from '../composables/useConfirm'
import AddWebsiteSourceModal from '../components/knowledge/AddWebsiteSourceModal.vue'
import WebSourcePagesModal from '../components/knowledge/WebSourcePagesModal.vue'

const PAGE_SIZE = 10
const resources = ref([])
const loading = ref(true)
const uploading = ref(false)
const busy = reactive({})
const showWebModal = ref(false)
const pagesSource = ref(null)
const q = ref('')
const kindFilter = ref('all')
const scopeView = ref('user')          // 'user' = my KnowledgeSources · 'conversation' = chat uploads
const page = ref(1)
let poll = null

const isConvScope = computed(() => scopeView.value === 'conversation')

const BUSY = ['discovering', 'discovered', 'indexing', 'queued', 'converting', 'chunking', 'embedding', 'reading']
function isBusy(s) { return BUSY.includes(s) }
function statusLabel(s) {
  if (['ready', 'indexed'].includes(s)) return 'Ready'
  if (s === 'partial') return 'Partial'
  if (s === 'failed') return 'Failed'
  if (s === 'cancelled') return 'Cancelled'
  if (s === 'empty') return 'Empty'
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
}
function fmtCost(c) {
  const n = Number(c || 0)
  if (n === 0) return '$0'
  if (n < 0.01) return '<$0.01'
  return '$' + n.toFixed(n < 1 ? 3 : 2)
}
function statusPill(s) {
  if (['ready', 'indexed'].includes(s)) return 'bg-emerald-50 text-emerald-700'
  if (s === 'partial') return 'bg-amber-50 text-amber-700'
  if (['failed', 'cancelled'].includes(s)) return 'bg-red-50 text-red-600'
  if (isBusy(s)) return 'bg-indigo-50 text-indigo-600'
  return 'bg-slate-100 text-slate-500'
}

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  return resources.value.filter(r => {
    if (kindFilter.value !== 'all' && r.kind !== kindFilter.value) return false
    if (!term) return true
    return (r.name || '').toLowerCase().includes(term) || (r.root_url || '').toLowerCase().includes(term)
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([q, kindFilter], () => { page.value = 1 })
watch(totalPages, (tp) => { if (page.value > tp) page.value = tp })
watch(scopeView, () => { page.value = 1; resources.value = []; load() })

async function load(silent = false) {
  if (!silent) loading.value = true
  try {
    const rows = (await api.listKnowledge(scopeView.value)).data.resources || []
    const byId = Object.fromEntries(resources.value.map(r => [r.id, r]))
    resources.value = rows.map(r => Object.assign(byId[r.id] || {}, r))
  } catch (e) {
    if (!silent) notify.error('Failed to load knowledge: ' + (e.response?.data?.detail || e.message))
  } finally {
    if (!silent) loading.value = false
  }
}

async function onFilePicked(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  uploading.value = true
  try {
    await api.uploadKnowledgeFile(file, file.name)
    notify.success('File uploaded — indexing started')
    await load(true)
  } catch (e) {
    notify.error('Upload failed: ' + (e.response?.data?.detail || e.message))
  } finally {
    uploading.value = false
  }
}

function onSourceChanged() { showWebModal.value = false; load(true) }

function managePages(r) {
  if (!r.web_source_id) return
  pagesSource.value = { id: r.web_source_id, status: r.status, root_url: r.root_url,
                        recrawl_schedule: r.recrawl_schedule || 'never' }
}

async function doExport(r) {
  busy[r.id] = true
  try {
    const res = await api.exportKnowledge(r.id)
    const ext = r.kind === 'website' ? '.csv' : ''
    const base = (r.name || `knowledge-${r.id}`).replace(/[^\w.-]+/g, '_')
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = ext && !base.endsWith(ext) ? base + ext : base
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    notify.error('Export failed: ' + (e.response?.data?.detail || e.message))
  } finally {
    busy[r.id] = false
  }
}

async function remove(r) {
  const ok = await confirm({
    title: 'Delete this knowledge source?',
    message: `“${r.name}” and its indexed content will be removed. Agents using it lose access. This can't be undone.`,
    confirmText: 'Delete', danger: true,
  })
  if (!ok) return
  busy[r.id] = true
  try {
    await api.deleteKnowledge(r.id)
    resources.value = resources.value.filter(x => x.id !== r.id)
    notify.success('Deleted')
  } catch (e) {
    notify.error('Delete failed: ' + (e.response?.data?.detail || e.message))
  } finally {
    busy[r.id] = false
  }
}

onMounted(() => {
  load()
  poll = setInterval(() => {
    if (resources.value.some(r => isBusy(r.status)) || pagesSource.value) load(true)
  }, 4000)
})
onUnmounted(() => poll && clearInterval(poll))
</script>
