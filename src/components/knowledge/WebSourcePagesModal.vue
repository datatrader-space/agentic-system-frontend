<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[88vh] flex flex-col">
      <!-- Toolbar -->
      <div class="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <button @click="showAdd = !showAdd"
                class="px-3 py-1.5 text-[13px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Add pages</button>

        <div class="relative flex-1 min-w-[140px]">
          <input v-model="q" @input="debouncedReload" placeholder="Filter"
                 class="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
        </div>

        <select v-model="ordering" @change="reload"
                class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-slate-600 cursor-pointer">
          <option value="created_at">Order by Creation Date</option>
          <option value="url">Order by URL</option>
          <option value="status">Order by Status</option>
          <option value="indexed_at">Order by Indexed Date</option>
        </select>
        <select v-model="order" @change="reload"
                class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-slate-600 cursor-pointer">
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>

        <select v-model="recrawl" @change="onRecrawlChange"
                title="Auto re-crawl frequency"
                class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-slate-600 cursor-pointer">
          <option value="never">Recrawl Never</option>
          <option value="daily">Recrawl Daily</option>
          <option value="weekly">Recrawl Weekly</option>
          <option value="monthly">Recrawl Monthly</option>
        </select>

        <span class="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-md"
              :class="statusBadgeClass">{{ statusLabel }}</span>
      </div>

      <!-- Add-pages panel -->
      <div v-if="showAdd" class="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <textarea v-model="addText" rows="3" placeholder="Paste one URL per line to add to this source…"
                  class="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"></textarea>
        <div class="flex justify-end gap-2 mt-2">
          <button @click="showAdd = false" class="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button @click="submitAdd" :disabled="adding || !addLines.length"
                  class="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {{ adding ? 'Adding…' : `Add ${addLines.length || ''} page${addLines.length === 1 ? '' : 's'}`.trim() }}
          </button>
        </div>
      </div>

      <!-- Pages list -->
      <div class="flex-1 overflow-y-auto divide-y divide-slate-100">
        <div v-if="loading" class="flex items-center justify-center gap-2 text-[13px] text-slate-400 py-8">
          <span class="w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></span> Loading…
        </div>
        <div v-else-if="!pages.length" class="text-center text-[13px] text-slate-400 py-8">No pages.</div>
        <div v-for="p in pages" :key="p.id" class="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
          <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="dotClass(p.status)" :title="p.status"></span>
          <a :href="p.url" target="_blank" rel="noopener"
             class="text-[12px] text-slate-700 hover:text-indigo-600 truncate flex-1">{{ p.url }}</a>
          <span class="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
            <template v-if="p.status === 'ready'">Indexed {{ relativeTime(p.indexed_at) }}</template>
            <template v-else-if="p.status === 'failed'" class="text-red-500">Failed</template>
            <template v-else>{{ p.status }}</template>
          </span>
        </div>
      </div>

      <!-- Footer / pagination -->
      <div class="px-4 py-3 border-t border-slate-100 flex items-center gap-3">
        <button @click="prev" :disabled="page <= 1"
                class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">←</button>
        <span class="text-[12px] text-slate-500">Page {{ page }} of {{ totalPages }}</span>
        <button @click="next" :disabled="page >= totalPages"
                class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">→</button>
        <button @click="$emit('close')" class="ml-auto px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Close <span class="text-slate-400">Esc</span></button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'
import { useRelativeTime } from '@/composables/useRelativeTime'

const props = defineProps({ source: { type: Object, required: true } })
const emit = defineEmits(['close', 'updated'])
const { relativeTime } = useRelativeTime()

const PAGE_SIZE = 10
const pages = ref([])
const count = ref(0)
const page = ref(1)
const q = ref('')
const ordering = ref('created_at')
const order = ref('desc')
const recrawl = ref(props.source.recrawl_schedule || 'never')
const loading = ref(false)
const showAdd = ref(false)
const addText = ref('')
const adding = ref(false)

const totalPages = computed(() => Math.max(1, Math.ceil(count.value / PAGE_SIZE)))
const addLines = computed(() =>
  addText.value.split(/\s+/).map(s => s.trim()).filter(s => /^https?:\/\//i.test(s) || s.includes('.')))

const statusLabel = computed(() => {
  const s = props.source.status
  if (s === 'ready') return 'Indexed'
  if (s === 'indexing') return 'Indexing'
  if (s === 'partial') return 'Partial'
  if (s === 'failed') return 'Failed'
  return s
})
const statusBadgeClass = computed(() => {
  const s = props.source.status
  if (s === 'ready') return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  if (s === 'failed') return 'bg-red-50 text-red-600 border border-red-200'
  if (s === 'partial') return 'bg-amber-50 text-amber-700 border border-amber-200'
  return 'bg-slate-100 text-slate-500 border border-slate-200'
})
function dotClass(s) {
  return s === 'ready' ? 'bg-emerald-500'
    : s === 'failed' ? 'bg-red-500'
    : s === 'skipped' ? 'bg-slate-300'
    : 'bg-amber-400'
}

async function loadPages() {
  loading.value = true
  try {
    const r = await api.getWebSourcePages(props.source.id, {
      q: q.value, ordering: ordering.value, order: order.value,
      limit: PAGE_SIZE, offset: (page.value - 1) * PAGE_SIZE,
    })
    pages.value = r.data.results || []
    count.value = r.data.count || 0
  } catch (e) { notify.error('Failed to load pages') } finally { loading.value = false }
}
function reload() { page.value = 1; loadPages() }
let _t = null
function debouncedReload() { clearTimeout(_t); _t = setTimeout(reload, 300) }
function prev() { if (page.value > 1) { page.value--; loadPages() } }
function next() { if (page.value < totalPages.value) { page.value++; loadPages() } }

async function onRecrawlChange() {
  try {
    const r = await api.setWebSourceRecrawl(props.source.id, recrawl.value)
    emit('updated', r.data)
    notify.success(recrawl.value === 'never' ? 'Auto re-crawl off' : `Re-crawl set to ${recrawl.value}`)
  } catch (e) { notify.error('Failed to set schedule') }
}

async function submitAdd() {
  adding.value = true
  try {
    const r = await api.addWebSourcePages(props.source.id, addLines.value)
    notify.success(`Adding ${r.data.added} page(s)…`)
    emit('updated', r.data)
    addText.value = ''; showAdd.value = false
    reload()
  } catch (e) {
    notify.error('Failed to add pages: ' + (e.response?.data?.error || e.message))
  } finally { adding.value = false }
}

function onKey(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => { loadPages(); window.addEventListener('keydown', onKey) })
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
