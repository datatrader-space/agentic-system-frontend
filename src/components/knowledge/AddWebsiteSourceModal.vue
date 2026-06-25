<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="cancel()">
    <div class="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-start">
        <div>
          <h2 class="text-lg font-bold text-slate-900">Add a Website Source</h2>
          <p class="text-[13px] text-slate-500 mt-0.5">Your agent will answer questions from the content found on the pages you add.</p>
        </div>
        <button @click="cancel()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
      </div>

      <div class="px-6 py-5 space-y-5">
        <!-- Unsaved-agent hint: the source attaches to the agent, which must exist first. -->
        <div v-if="!agentId" class="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Tip: give your agent a name + system prompt so it saves automatically — then this website attaches to it.
        </div>

        <!-- Mode selector -->
        <div class="flex items-center justify-between">
          <label class="text-[13px] font-semibold text-slate-600">Source</label>
          <select v-model="mode" :disabled="phase === 'discovered'"
                  class="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer disabled:opacity-60">
            <option value="full_site">A Website</option>
            <option value="specific_pages">Specific Web Pages</option>
          </select>
        </div>

        <!-- INPUT phase -->
        <template v-if="phase !== 'discovered'">
          <!-- A Website -->
          <div v-if="mode === 'full_site'">
            <p class="text-[12px] text-slate-400 mb-2">We'll discover pages on your website (via sitemap/robots). You can select which to add.</p>
            <label class="block text-[12px] font-semibold text-slate-600 mb-1.5">Website</label>
            <div class="flex gap-2">
              <input v-model="url" type="text" placeholder="example.com" @keyup.enter="discover" :disabled="busy"
                     class="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50" />
              <button @click="discover" :disabled="busy || !url.trim()"
                      class="px-4 py-2 text-[13px] font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50 whitespace-nowrap inline-flex items-center gap-1.5">
                <span v-if="busy" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                {{ busy ? 'Discovering…' : 'Discover Pages' }}
              </button>
            </div>

            <!-- Live discovery progress: which page is being fetched right now -->
            <p v-if="busy && currentUrl" class="mt-2 flex items-center gap-2 text-[12px] text-slate-500">
              <span class="inline-block w-2 h-2 bg-indigo-500 rounded-full animate-pulse shrink-0"></span>
              <span class="shrink-0">Fetching:</span>
              <span class="font-mono text-slate-600 truncate">{{ currentUrl }}</span>
              <span v-if="foundCount" class="shrink-0 text-indigo-500 font-semibold">· {{ foundCount }} found</span>
            </p>

            <!-- Advanced crawl options -->
            <button type="button" @click="showAdvanced = !showAdvanced"
                    class="mt-2 text-[12px] font-semibold text-indigo-600 hover:text-indigo-800">
              {{ showAdvanced ? '▾ Hide advanced options' : '▸ Advanced options' }}
            </button>
            <div v-if="showAdvanced" class="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-[11px] font-semibold text-slate-500 mb-1">JS rendering</label>
                <select v-model="renderJs" :disabled="busy"
                        class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60">
                  <option value="auto">Auto (detect)</option>
                  <option value="false">Off — fastest</option>
                  <option value="true">On — JS sites</option>
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Max pages</label>
                <input v-model.number="maxPages" type="number" min="1" max="5000" :disabled="busy"
                       class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50" />
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Max depth</label>
                <input v-model.number="maxDepth" type="number" min="1" max="10" :disabled="busy"
                       class="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50" />
              </div>
              <p class="sm:col-span-3 text-[11px] text-slate-400 -mt-1">Set JS rendering to <strong>Off</strong> for faster crawling on standard server-rendered sites; lower Max pages for a quicker, focused index.</p>
            </div>
          </div>

          <!-- Specific Web Pages -->
          <div v-else>
            <p class="text-[12px] text-slate-400 mb-2">Paste one URL per line. Only these exact pages will be indexed.</p>
            <textarea v-model="manualText" rows="6" placeholder="https://example.com/page-1&#10;https://example.com/page-2"
                      class="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"></textarea>
          </div>

          <p v-if="error" class="text-[12px] text-red-600">{{ error }}</p>
        </template>

        <!-- DISCOVERED phase: page tree -->
        <template v-else>
          <div class="flex items-center justify-between">
            <div class="text-[13px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 flex-1">
              <strong>{{ selectedCount }}</strong> page(s) will be added
            </div>
            <button @click="editAsText = !editAsText" class="ml-3 text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap">
              {{ editAsText ? 'Tree view' : '&lt;/&gt; Edit as Text' }}
            </button>
          </div>

          <!-- Edit-as-text -->
          <textarea v-if="editAsText" v-model="manualText" rows="10"
                    class="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"></textarea>

          <!-- Tree -->
          <div v-else class="border border-slate-200 rounded-lg max-h-80 overflow-y-auto divide-y divide-slate-100">
            <!-- root row -->
            <label class="flex items-center gap-2 px-3 py-2 bg-slate-50/60 cursor-pointer">
              <input type="checkbox" :checked="allSelected" @change="toggleAll($event.target.checked)" class="accent-indigo-600" />
              <span class="text-[13px] font-semibold text-slate-800 truncate">{{ tree.root }}</span>
              <span class="text-[11px] text-slate-400 ml-auto">{{ tree.total }} pages</span>
            </label>
            <div v-for="g in tree.groups" :key="g.path">
              <label class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50">
                <button type="button" @click.prevent="toggleExpand(g.path)" class="text-slate-400 w-4 text-center">
                  {{ g.count > 1 ? (expanded[g.path] ? '▾' : '▸') : '' }}
                </button>
                <input type="checkbox" :checked="groupChecked(g)" @change="toggleGroup(g, $event.target.checked)" class="accent-indigo-600" />
                <span class="text-[13px] text-slate-700 font-medium">{{ g.path }}</span>
                <span v-if="g.count > 1" class="text-[11px] text-indigo-500 ml-1">{{ g.count }} pages</span>
              </label>
              <div v-if="expanded[g.path] && g.count > 1" class="pl-10">
                <label v-for="p in g.pages" :key="p.url" class="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" :checked="picked.has(p.url)" @change="togglePage(p.url, $event.target.checked)" class="accent-indigo-600" />
                  <span class="text-[12px] text-slate-500 truncate">{{ p.path }}</span>
                </label>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
        <button @click="cancel()" class="px-4 py-2 text-[13px] font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
        <button v-if="phase !== 'discovered' && mode === 'specific_pages'" @click="addManual" :disabled="busy || !manualLines.length"
                class="px-4 py-2 text-[13px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1.5">
          <span v-if="busy" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
          {{ busy ? 'Adding…' : `Add ${manualLines.length || ''} page${manualLines.length === 1 ? '' : 's'}`.trim() }}
        </button>
        <button v-if="phase === 'discovered'" @click="addSelected" :disabled="busy || !selectedCount"
                class="px-4 py-2 text-[13px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1.5">
          <span v-if="busy" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
          {{ busy ? 'Adding…' : `Add ${selectedCount} page${selectedCount === 1 ? '' : 's'}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'

const props = defineProps({ agentId: { type: [Number, String], default: null } })
const emit = defineEmits(['close', 'added'])

const mode = ref('full_site')
const url = ref('')
const manualText = ref('')
const busy = ref(false)
const error = ref('')
const phase = ref('input')          // input | discovered
const sourceId = ref(null)
const tree = reactive({ root: '', total: 0, groups: [] })
const picked = ref(new Set())
const expanded = reactive({})
const editAsText = ref(false)
// Advanced crawl options (full_site) — map to the discover endpoint's per-source overrides.
const showAdvanced = ref(false)
const renderJs = ref('auto')        // auto | false | true
const maxPages = ref(1000)
const maxDepth = ref(4)

// True once the user actually clicks "Add" — until then the discovered source is a throwaway that
// Cancel must delete (so a cancelled discovery never lingers in the KB / gets indexed).
const committed = ref(false)

// Live discovery progress (which URL is being fetched) via the knowledge-index WebSocket.
const currentUrl = ref('')
const foundCount = ref(0)
const progressWs = ref(null)

async function cancel() {
  // Discard the source created during discovery if the user never added it.
  if (sourceId.value && !committed.value) {
    const discardedId = sourceId.value
    try { await api.deleteWebSource(discardedId) } catch (e) { /* best-effort */ }
    emit('discarded', discardedId)
  }
  emit('close')
}

function progressWsUrl() {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${window.location.host}/ws/knowledge-index/${props.agentId}/`
}
function connectProgressWs() {
  if (!props.agentId) return                    // no agent → no group to subscribe to
  disconnectProgressWs()
  try {
    const sock = new WebSocket(progressWsUrl())
    progressWs.value = sock
    sock.onmessage = (e) => {
      let evt; try { evt = JSON.parse(e.data) } catch { return }
      if (evt.type !== 'web_source.progress') return
      if (sourceId.value && evt.source_id && evt.source_id !== sourceId.value) return
      if (evt.last_url) currentUrl.value = evt.last_url
      if (typeof evt.discovered === 'number') foundCount.value = evt.discovered
    }
    sock.onclose = () => { if (progressWs.value === sock) progressWs.value = null }
    sock.onerror = () => { /* noop — discovery still completes via polling */ }
  } catch (e) { /* noop */ }
}
function disconnectProgressWs() {
  if (progressWs.value) { try { progressWs.value.close() } catch (e) { /* noop */ } progressWs.value = null }
  currentUrl.value = ''
  foundCount.value = 0
}
onBeforeUnmount(() => {
  disconnectProgressWs()
  // Safety net: if the modal is torn down without committing (e.g. route change), drop the throwaway.
  if (sourceId.value && !committed.value) {
    try { api.deleteWebSource(sourceId.value) } catch (e) { /* best-effort, fire-and-forget */ }
  }
})

const manualLines = computed(() =>
  manualText.value.split(/\s+/).map(s => s.trim()).filter(s => /^https?:\/\//i.test(s) || s.includes('.')))

const selectedCount = computed(() => editAsText.value ? manualLines.value.length : picked.value.size)
const allSelected = computed(() => tree.total > 0 && picked.value.size === tree.total)

function groupChecked(g) { return g.pages.every(p => picked.value.has(p.url)) }
function toggleExpand(path) { expanded[path] = !expanded[path] }

function _replace(set) { picked.value = new Set(set) }
function toggleAll(on) {
  const s = new Set()
  if (on) tree.groups.forEach(g => g.pages.forEach(p => s.add(p.url)))
  _replace(s)
}
function toggleGroup(g, on) {
  const s = new Set(picked.value)
  g.pages.forEach(p => on ? s.add(p.url) : s.delete(p.url))
  _replace(s)
}
function togglePage(u, on) {
  const s = new Set(picked.value)
  on ? s.add(u) : s.delete(u)
  _replace(s)
}

async function discover() {
  error.value = ''
  busy.value = true
  connectProgressWs()                 // subscribe before kicking off so we don't miss early pages
  try {
    const r = await api.discoverWebSource({
      agent_id: props.agentId, url: url.value.trim(), mode: mode.value,
      render_js: renderJs.value, max_pages: maxPages.value, max_depth: maxDepth.value,
    })
    sourceId.value = r.data.id
    await pollUntilDiscovered()
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Discovery failed'
  } finally {
    busy.value = false
    disconnectProgressWs()             // discovery resolved → stop the live-URL line
  }
}

async function pollUntilDiscovered() {
  for (let i = 0; i < 60; i++) {
    const r = await api.getWebSource(sourceId.value)
    const s = r.data
    if (s.status === 'discovered') {
      Object.assign(tree, s.discovery_tree || { root: s.root_url, total: 0, groups: [] })
      toggleAll(true)                       // pre-select everything (Botpress default)
      if (tree.groups?.length) expanded[tree.groups[0].path] = false
      phase.value = 'discovered'
      return
    }
    if (s.status === 'failed') { error.value = s.error || 'Discovery failed'; return }
    await new Promise(res => setTimeout(res, 1500))
  }
  error.value = 'Discovery is taking longer than expected — try again.'
}

async function addSelected() {
  busy.value = true
  try {
    const urls = editAsText.value ? manualLines.value : [...picked.value]
    const r = await api.addWebSource(sourceId.value, { urls })
    committed.value = true                 // user committed → keep the source
    notify.success(`Indexing ${urls.length} page(s)…`)
    emit('added', r.data)
    emit('close')
  } catch (e) {
    notify.error('Failed to start indexing: ' + (e.response?.data?.error || e.message))
  } finally {
    busy.value = false
  }
}

async function addManual() {
  error.value = ''
  busy.value = true
  try {
    const r = await api.discoverWebSource({
      agent_id: props.agentId, mode: 'specific_pages', urls: manualLines.value,
    })
    sourceId.value = r.data.id
    // specific_pages finishes discovery quickly; poll then add all.
    for (let i = 0; i < 30; i++) {
      const s = (await api.getWebSource(sourceId.value)).data
      if (s.status === 'discovered') break
      if (s.status === 'failed') throw new Error(s.error || 'failed')
      await new Promise(res => setTimeout(res, 1000))
    }
    const add = await api.addWebSource(sourceId.value, { select_all: true })
    committed.value = true
    notify.success(`Indexing ${manualLines.value.length} page(s)…`)
    emit('added', add.data)
    emit('close')
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Failed to add pages'
  } finally {
    busy.value = false
  }
}
</script>
