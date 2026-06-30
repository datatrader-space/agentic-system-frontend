<template>
  <!-- Editor Step 3 — Knowledge & Tools (Screen 15). Knowledge source column cards + tool
       category cards. Backed by existing endpoints; tool toggles save via the top-bar Save. -->
  <div class="mx-auto w-full max-w-[1840px] px-8 pb-10 font-[Inter,system-ui,sans-serif]">
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 class="text-[20px] font-bold tracking-tight text-[#0F172A]">Add Knowledge &amp; Tools</h2>
        <p class="mt-0.5 text-[13.5px] text-[#64748B]">Give your agent the knowledge sources and tools it needs to be effective.</p>
      </div>
      <button class="btn-outline" @click="go('/dashboard/connectors')"><Link2 :size="15" :stroke-width="2" /> Manage Connectors</button>
    </div>

    <!-- ============ Knowledge Sources ============ -->
    <section class="mb-5 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <h3 class="text-base font-semibold text-[#0F172A]">Knowledge Sources</h3>
      <p class="mb-4 text-[13px] text-[#64748B]">Add and manage the knowledge your agent can use to answer questions and complete tasks.</p>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Uploaded Files -->
        <div class="flex flex-col rounded-xl border border-[#E5E7EB] p-4">
          <div class="mb-1 flex items-start justify-between">
            <div class="flex items-start gap-2.5">
              <span class="grid h-9 w-9 place-items-center rounded-[10px] bg-blue-50 text-blue-600"><FileText :size="18" :stroke-width="2" /></span>
              <div>
                <p class="text-[14px] font-semibold text-[#0F172A]">Uploaded Files</p>
                <p class="text-[11.5px] text-[#667085]">Add PDFs, docs, spreadsheets, and more.</p>
              </div>
            </div>
            <span class="badge bg-blue-50 text-blue-600">{{ files.length }} files</span>
          </div>
          <ul class="my-3 flex-1 space-y-2.5">
            <li v-for="f in files.slice(0, 3)" :key="f.id" class="group flex items-center gap-2.5">
              <FileType :size="16" :stroke-width="2" class="shrink-0 text-[#98A2B3]" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[12.5px] font-medium text-[#0F172A]">{{ f.filename || f.name || 'file' }}</span>
                <span class="block text-[11px] text-[#98A2B3]">{{ fileMeta(f) }}</span>
              </span>
              <button class="icon-x" @click="removeFile(f)"><X :size="13" :stroke-width="2" /></button>
            </li>
            <li v-if="!files.length" class="py-2 text-[12px] text-[#98A2B3]">No files yet.</li>
          </ul>
          <div class="mt-auto flex items-center justify-between border-t border-[#F2F4F7] pt-3">
            <button class="view-link">View all files <ChevronRight :size="13" :stroke-width="2" /></button>
            <label class="add-btn"><Plus :size="13" :stroke-width="2" /> {{ uploading ? 'Uploading…' : 'Add Files' }}<input type="file" class="hidden" :disabled="uploading" @change="onUpload" /></label>
          </div>
        </div>

        <!-- URLs -->
        <div class="flex flex-col rounded-xl border border-[#E5E7EB] p-4">
          <div class="mb-1 flex items-start justify-between">
            <div class="flex items-start gap-2.5">
              <span class="grid h-9 w-9 place-items-center rounded-[10px] bg-emerald-50 text-emerald-600"><Globe :size="18" :stroke-width="2" /></span>
              <div>
                <p class="text-[14px] font-semibold text-[#0F172A]">URLs</p>
                <p class="text-[11.5px] text-[#667085]">Add website links and online resources.</p>
              </div>
            </div>
            <span class="badge bg-emerald-50 text-emerald-600">{{ webSources.length }} URLs</span>
          </div>
          <ul class="my-3 flex-1 space-y-2.5">
            <li v-for="w in webSources.slice(0, 3)" :key="w.id" class="flex items-center gap-2.5">
              <Link2 :size="16" :stroke-width="2" class="shrink-0 text-[#98A2B3]" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[12.5px] font-medium text-[#0F172A]">{{ w.url || w.root_url || 'url' }}</span>
                <span class="block text-[11px] text-[#98A2B3]">{{ urlMeta(w) }}</span>
              </span>
              <button class="icon-x" @click="removeUrl(w)"><X :size="13" :stroke-width="2" /></button>
            </li>
            <li v-if="!webSources.length" class="py-2 text-[12px] text-[#98A2B3]">No URLs yet.</li>
          </ul>
          <div v-if="addUrlOpen" class="mb-2 flex gap-2">
            <input v-model="newUrl" type="url" placeholder="https://…" class="field flex-1" @keydown.enter="addUrl" />
            <button class="add-btn-sm" :disabled="addingUrl || !newUrl.trim()" @click="addUrl"><Plus :size="14" :stroke-width="2" /></button>
          </div>
          <div class="mt-auto flex items-center justify-between border-t border-[#F2F4F7] pt-3">
            <button class="view-link">View all URLs <ChevronRight :size="13" :stroke-width="2" /></button>
            <button class="add-btn" @click="addUrlOpen = !addUrlOpen"><Plus :size="13" :stroke-width="2" /> Add URL</button>
          </div>
        </div>

        <!-- Memory Sources -->
        <div class="flex flex-col rounded-xl border border-[#E5E7EB] p-4">
          <div class="mb-1 flex items-start justify-between">
            <div class="flex items-start gap-2.5">
              <span class="grid h-9 w-9 place-items-center rounded-[10px] bg-amber-50 text-amber-600"><Database :size="18" :stroke-width="2" /></span>
              <div>
                <p class="text-[14px] font-semibold text-[#0F172A]">Memory Sources</p>
                <p class="text-[11.5px] text-[#667085]">Use existing memories and knowledge bases.</p>
              </div>
            </div>
            <span class="badge bg-amber-50 text-amber-600">{{ memorySources.length }} sources</span>
          </div>
          <ul class="my-3 flex-1 space-y-2.5">
            <li v-for="m in memorySources.slice(0, 3)" :key="m.id" class="flex items-center gap-2.5">
              <BarChart3 :size="16" :stroke-width="2" class="shrink-0 text-[#98A2B3]" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[12.5px] font-medium text-[#0F172A]">{{ m.name }}</span>
                <span class="block text-[11px] text-[#98A2B3]">{{ m.meta }}</span>
              </span>
            </li>
            <li v-if="!memorySources.length" class="py-2 text-[12px] text-[#98A2B3]">Memories are captured automatically.</li>
          </ul>
          <div class="mt-auto flex items-center justify-between border-t border-[#F2F4F7] pt-3">
            <button class="view-link">View all sources <ChevronRight :size="13" :stroke-width="2" /></button>
            <button class="add-btn" @click="notify.info('Memory sources are managed from the Memory panel.')"><Plus :size="13" :stroke-width="2" /> Add Source</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ Agent Tools & Capabilities ============ -->
    <section class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-base font-semibold text-[#0F172A]">Agent Tools &amp; Capabilities</h3>
          <p class="text-[13px] text-[#64748B]">Enable tools and capabilities to allow your agent to take action and get work done.</p>
        </div>
        <button class="btn-outline" @click="go('/dashboard/tools')">Manage Tools</button>
      </div>

      <div v-if="loadingTools" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="n in 4" :key="n" class="h-44 animate-pulse rounded-xl bg-slate-100" />
      </div>

      <div v-else class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="grp in toolGroups" :key="grp.label" class="flex min-h-[220px] flex-col rounded-xl border border-[#E5E7EB] p-4">
          <div class="mb-1 flex items-start justify-between">
            <span class="grid h-9 w-9 place-items-center rounded-[10px]" :class="grp.meta.tint"><component :is="grp.meta.icon" :size="18" :stroke-width="2" /></span>
            <span class="badge" :class="grp.meta.badge">{{ grp.tools.length }} tools</span>
          </div>
          <p class="mt-1 text-[14px] font-semibold text-[#0F172A]">{{ grp.label }}</p>
          <p class="mb-3 text-[11.5px] text-[#667085]">{{ grp.meta.desc }}</p>
          <ul class="flex-1 space-y-2.5">
            <li v-for="t in grp.tools.slice(0, 3)" :key="t.id" class="flex items-start gap-2">
              <component :is="grp.meta.icon" :size="14" :stroke-width="2" class="mt-0.5 shrink-0 text-[#98A2B3]" />
              <span class="min-w-0">
                <span class="block text-[12.5px] font-medium text-[#0F172A]">{{ t.display_name || t.name }}</span>
                <span class="block truncate text-[11px] text-[#98A2B3]">{{ shortDesc(t) }}</span>
              </span>
            </li>
          </ul>
          <div class="mt-auto flex items-center justify-between border-t border-[#F2F4F7] pt-3">
            <button class="view-link" @click="openToolsModal(grp)">View tools</button>
            <button type="button" class="grid h-5 w-9 place-items-center rounded-full transition" :class="catOn(grp) ? 'bg-[#2563EB]' : 'bg-[#E5E7EB]'" @click="toggleCategory(grp)">
              <span class="h-4 w-4 rounded-full bg-white shadow transition" :class="catOn(grp) ? 'translate-x-2' : '-translate-x-2'" />
            </button>
          </div>
        </div>
        <p v-if="!toolGroups.length" class="text-[13px] text-[#667085]">No tools available.</p>
      </div>

      <!-- Tool delivery: how this agent's tools are presented to the model (per-agent override) -->
      <div class="mt-5 border-t border-[#F2F4F7] pt-4">
        <h4 class="text-[14px] font-semibold text-[#0F172A]">Tool delivery</h4>
        <p class="text-[12.5px] text-[#64748B]">How this agent's tools are presented to the model. Defaults follow the system setting.</p>
        <div class="mt-3 max-w-md">
          <label class="block text-[11.5px] font-medium text-[#475569] mb-1">Tool format</label>
          <select v-model="agent.tool_delivery_mode"
                  class="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2563EB]">
            <option value="default">Use system default</option>
            <option value="native">Native function-calling (tools array)</option>
            <option value="text">Full schemas in prompt (text protocol)</option>
          </select>
          <p class="mt-1 text-[11px] leading-snug text-[#98A2B3]">Native uses the provider's tools API; text embeds full schemas in the prompt.</p>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="toolsModalOpen" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-5 py-8 backdrop-blur-sm" @click.self="closeToolsModal">
        <section class="flex max-h-[88vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-[18px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.34)]">
          <header class="flex items-start justify-between gap-5 px-8 pb-4 pt-7">
            <div>
              <h3 class="text-[25px] font-bold tracking-tight text-[#111827]">Add tools to this agent</h3>
              <p class="mt-1.5 text-[15px] text-[#53627A]">Choose the capabilities this agent can use during conversations.</p>
            </div>
            <button class="modal-close border-0" aria-label="Close tools dialog" @click="closeToolsModal"><X :size="23" :stroke-width="1.8" /></button>
          </header>

          <div class="px-8 pb-4">
            <div class="relative">
              <Search :size="20" :stroke-width="2" class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#667085]" />
              <input v-model="toolSearch" class="modal-search h-12 rounded-[9px] pl-12 text-[15px]" placeholder="Search tools, functions, capabilities..." />
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-2">
              <button
                v-for="filter in modalFilters"
                :key="filter.key"
                type="button"
                class="modal-filter-chip"
                :class="toolFilter === filter.key ? 'border-[#DAD7FF] bg-[#F1F0FF] text-[#4338CA]' : 'border-[#E2E8F0] bg-white text-[#344054]'"
                @click="toolFilter = filter.key"
              >
                <component v-if="filter.icon" :is="filter.icon" :size="16" :stroke-width="2" />
                {{ filter.label }}
              </button>
            </div>
          </div>

          <div class="grid min-h-[500px] grid-cols-[270px_minmax(0,1fr)] overflow-hidden border-y border-[#E5E7EB]">
            <aside class="overflow-y-auto border-r border-[#E5E7EB] bg-white p-6">
              <p class="mb-5 text-[14px] font-semibold text-[#111827]">Categories</p>
              <div class="space-y-1">
                <button
                  v-for="group in modalCategories"
                  :key="group.label"
                  type="button"
                  class="modal-category-row"
                  :class="selectedGroup?.label === group.label ? 'bg-[#F0EEFF] text-[#4338CA] shadow-[inset_4px_0_0_#4F46E5]' : 'text-[#475569] hover:bg-[#F8FAFC]'"
                  @click="selectedGroup = group"
                >
                  <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full" :class="group.meta.tint">
                    <component :is="group.meta.icon || Sparkles" :size="18" :stroke-width="2" />
                  </span>
                  <span class="min-w-0 flex-1 truncate text-left">{{ group.label }}</span>
                  <span class="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold text-[#667085]">{{ group.tools.length }}</span>
                </button>
              </div>
            </aside>

            <main class="overflow-y-auto bg-white p-5">
              <h4 class="mb-3 text-[15px] font-semibold text-[#111827]">Recommended in {{ selectedGroup?.label || 'Tools' }}</h4>
              <div v-if="filteredModalTools.length" class="overflow-hidden rounded-[10px] border border-[#E5E7EB]">
                <article
                  v-for="tool in filteredModalTools"
                  :key="tool.id"
                  class="tool-row"
                >
                  <span class="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-[#ECEBFF] text-[#4F46E5]">
                    <component :is="selectedGroup?.meta?.icon || Sparkles" :size="25" :stroke-width="2" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 flex-wrap items-center gap-2">
                      <p class="truncate text-[16px] font-bold text-[#111827]">{{ tool.display_name || tool.name }}</p>
                      <span class="tool-chip">{{ selectedGroup?.label || tool.category_label || 'Tool' }}</span>
                    </div>
                    <p class="mt-1 text-[14px] leading-5 text-[#475569]">{{ tool.description || 'No description available.' }}</p>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                      <span v-for="tag in toolTags(tool)" :key="tag" class="tool-chip">{{ tag }}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="tool-add-btn"
                    :class="toolOn(tool) ? 'border-[#E4E1FF] bg-[#EFEDFF] text-[#4F46E5]' : 'border-[#D7D5FF] bg-white text-[#4338CA]'"
                    @click="toggleTool(tool)"
                  >
                    <span v-if="toolOn(tool)">Added</span>
                    <span v-else>+ Add</span>
                    <span v-if="toolOn(tool)" class="text-[15px]">✓</span>
                  </button>
                </article>
              </div>
              <div v-else class="rounded-xl border border-dashed border-[#D0D5DD] bg-[#F8FAFC] px-5 py-12 text-center text-[14px] text-[#64748B]">
                No tools match your search.
              </div>
            </main>
          </div>

          <footer class="flex flex-wrap items-center justify-between gap-4 px-8 py-5">
            <div class="flex min-w-0 flex-wrap items-center gap-3">
              <span class="text-[14px] font-medium text-[#475569]">{{ selectedModalTools.length }} tools selected</span>
              <span v-for="tool in selectedModalTools.slice(0, 4)" :key="tool.id" class="selected-tool-chip">
                {{ tool.display_name || tool.name }}
                <button type="button" class="text-[#4F46E5]" @click="toggleTool(tool)"><X :size="13" :stroke-width="2" /></button>
              </span>
            </div>
            <div class="flex items-center gap-3">
              <button class="modal-secondary" @click="closeToolsModal">Cancel</button>
              <button class="modal-primary min-w-[126px]" @click="closeToolsModal">Add {{ selectedModalTools.length }} tools</button>
            </div>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { FileText, FileType, Link2, Globe, Database, BarChart3, Plus, X, ChevronRight, Folder, Search, Sparkles, Terminal, Star, Shield, Braces } from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import { ago } from '../dashboard/time'

const props = defineProps({ agent: { type: Object, required: true } })
const router = useRouter()
const go = (to) => router.push(to)
const agentId = computed(() => props.agent.id)

// ── Files ──
const files = ref([])
const uploading = ref(false)
async function loadFiles() {
  try { const r = await api.get('/context_files/', { params: { agent_id: agentId.value } }); files.value = Array.isArray(r.data) ? r.data : (r.data?.results || []) } catch (e) { files.value = [] }
}
async function onUpload(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  uploading.value = true
  try { await api.uploadAgentFile(agentId.value, file); notify.success('File uploaded'); await loadFiles() }
  catch (err) { notify.error('Upload failed') }
  finally { uploading.value = false; e.target.value = '' }
}
async function removeFile(f) {
  try { await api.deleteGenericFile(f.id); files.value = files.value.filter(x => x.id !== f.id) } catch (e) { notify.error('Could not remove file') }
}
function fileMeta(f) {
  const ext = (f.filename || f.name || '').split('.').pop()
  const type = ext ? ext.toUpperCase() : (f.file_type || 'FILE')
  return `${type} · ${formatSize(f.size ?? f.file_size ?? f.size_bytes)}`
}
function formatSize(b) {
  if (!b && b !== 0) return '—'
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`
  if (b >= 1024) return `${Math.round(b / 1024)} KB`
  return `${b} B`
}

// ── URLs ──
const webSources = ref([])
const newUrl = ref('')
const addUrlOpen = ref(false)
const addingUrl = ref(false)
async function loadUrls() {
  try { const r = await api.listWebSources(agentId.value); webSources.value = Array.isArray(r.data) ? r.data : (r.data?.results || []) } catch (e) { webSources.value = [] }
}
async function addUrl() {
  const url = newUrl.value.trim()
  if (!url || addingUrl.value) return
  addingUrl.value = true
  try { await api.discoverWebSource({ url, agent_id: agentId.value }); notify.success('URL added — crawling started'); newUrl.value = ''; addUrlOpen.value = false; await loadUrls() }
  catch (e) { notify.error('Could not add URL') }
  finally { addingUrl.value = false }
}
async function removeUrl(w) {
  try { await api.deleteWebSource(w.id); webSources.value = webSources.value.filter(x => x.id !== w.id) } catch (e) { notify.error('Could not remove URL') }
}
function urlMeta(w) {
  const t = w.created_at || w.updated_at
  return t ? `Added ${ago(t)}` : 'Queued'
}

// ── Memory sources (no per-agent endpoint yet — show whatever the agent exposes, else empty) ──
const memorySources = computed(() => {
  const list = props.agent.memory_sources || props.agent.knowledge_bases || []
  return Array.isArray(list) ? list.map(m => ({ id: m.id, name: m.name || m.title || 'Source', meta: m.meta || (m.chunk_count != null ? `Vector Store · ${m.chunk_count} chunks` : 'Vector Store') })) : []
})

// ── Tools (grouped into category cards) ──
const toolDefs = ref([])
const loadingTools = ref(true)
const toolsModalOpen = ref(false)
const selectedGroup = ref(null)
const toolSearch = ref('')
const toolFilter = ref('all')
const modalFilters = [
  { key: 'all', label: 'All' },
  { key: 'recommended', label: 'Recommended', icon: Star },
  { key: 'connected', label: 'Connected', icon: Link2 },
  { key: 'approval', label: 'Requires approval', icon: Shield },
  { key: 'code', label: 'Code', icon: Braces },
  { key: 'database', label: 'Database', icon: Database },
]
const CAT_META = [
  { label: 'Files', match: ['file', 'document', 'upload', 'folder'], icon: Folder, tint: 'bg-blue-50 text-blue-600', badge: 'bg-blue-50 text-blue-600', desc: 'Access and manage files.' },
  { label: 'Search / Data', match: ['search', 'data', 'retriev', 'knowledge', 'web', 'query', 'crawl', 'url'], icon: Search, tint: 'bg-teal-50 text-teal-600', badge: 'bg-teal-50 text-teal-600', desc: 'Search and retrieve data.' },
  { label: 'AI', match: ['ai', 'model', 'llm', 'embed', 'summar', 'image', 'vision', 'audio', 'video', 'openai', 'chat'], icon: Sparkles, tint: 'bg-violet-50 text-violet-600', badge: 'bg-violet-50 text-violet-600', desc: 'Use AI models and capabilities.' },
  { label: 'Code & Terminal', match: ['code', 'terminal', 'shell', 'python', 'script', 'bash', 'execute', 'command'], icon: Terminal, tint: 'bg-orange-50 text-orange-600', badge: 'bg-orange-50 text-orange-600', desc: 'Run code and terminal commands.' },
]
function catMeta(tool) {
  const haystack = [tool.category_label, tool.category, tool.display_name, tool.name, tool.description].filter(Boolean).join(' ').toLowerCase()
  return CAT_META.find(m => m.match.some(k => haystack.includes(k))) || CAT_META[2]
}
async function loadTools() {
  loadingTools.value = true
  try { const r = await api.get('/tools/definitions/'); toolDefs.value = Array.isArray(r.data) ? r.data : (r.data?.results || []) }
  catch (e) { toolDefs.value = [] }
  finally { loadingTools.value = false }
}
const toolGroups = computed(() => {
  const map = new Map(CAT_META.map(meta => [meta.label, { label: meta.label, tools: [], meta }]))
  for (const t of toolDefs.value) {
    const meta = catMeta(t)
    map.get(meta.label).tools.push(t)
  }
  return [...map.values()].filter(group => group.tools.length)
})
const modalCategories = computed(() => toolGroups.value.length ? toolGroups.value : CAT_META.map(meta => ({ label: meta.label, tools: [], meta })))
const filteredModalTools = computed(() => {
  let tools = selectedGroup.value?.tools || []
  const q = toolSearch.value.trim().toLowerCase()
  const filter = toolFilter.value
  if (filter === 'connected') tools = tools.filter(toolOn)
  if (filter === 'approval') tools = tools.filter(t => toolText(t).includes('approval') || toolText(t).includes('credential') || toolText(t).includes('permission'))
  if (filter === 'code') tools = tools.filter(t => toolText(t).includes('code') || toolText(t).includes('python') || toolText(t).includes('terminal') || (selectedGroup.value?.label || '').toLowerCase().includes('code'))
  if (filter === 'database') tools = tools.filter(t => toolText(t).includes('database') || toolText(t).includes('sql') || toolText(t).includes('query') || (selectedGroup.value?.label || '').toLowerCase().includes('data'))
  if (q) tools = tools.filter(t => toolText(t).includes(q))
  return tools
})
const selectedCount = computed(() => filteredModalTools.value.filter(toolOn).length)
const selectedModalTools = computed(() => toolDefs.value.filter(toolOn))
function shortDesc(t) {
  const d = t.description || ''
  return d.length > 40 ? d.slice(0, 40) + '…' : d
}
function toolText(t) {
  return [t.display_name, t.name, t.description, t.category, t.category_label, t.permission].filter(Boolean).join(' ').toLowerCase()
}
function toolTags(tool) {
  const source = [tool.category_label, tool.category, tool.permission].filter(Boolean)
  const nameBits = String(tool.display_name || tool.name || '').split(/[\s_/-]+/).filter(Boolean)
  return [...new Set([...source, ...nameBits])].map(t => String(t).toLowerCase()).filter(Boolean).slice(0, 3)
}
function ensureToolIds() { if (!Array.isArray(props.agent.tool_ids)) props.agent.tool_ids = [] }
const toolOn = (tool) => Array.isArray(props.agent.tool_ids) && props.agent.tool_ids.includes(tool.id)
const catOn = (grp) => grp.tools.length > 0 && grp.tools.every(t => Array.isArray(props.agent.tool_ids) && props.agent.tool_ids.includes(t.id))
function toggleCategory(grp) {
  ensureToolIds()
  const ids = props.agent.tool_ids
  if (catOn(grp)) {
    props.agent.tool_ids = ids.filter(id => !grp.tools.some(t => t.id === id))
  } else {
    for (const t of grp.tools) if (!ids.includes(t.id)) ids.push(t.id)
  }
}
function toggleTool(tool) {
  ensureToolIds()
  if (toolOn(tool)) {
    props.agent.tool_ids = props.agent.tool_ids.filter(id => id !== tool.id)
  } else {
    props.agent.tool_ids.push(tool.id)
  }
}
function openToolsModal(group) {
  selectedGroup.value = group || toolGroups.value[0] || null
  toolSearch.value = ''
  toolFilter.value = 'all'
  toolsModalOpen.value = true
}
function closeToolsModal() {
  toolsModalOpen.value = false
}
function enableAllModalTools() {
  ensureToolIds()
  for (const tool of filteredModalTools.value) {
    if (!props.agent.tool_ids.includes(tool.id)) props.agent.tool_ids.push(tool.id)
  }
}
function disableAllModalTools() {
  ensureToolIds()
  const remove = new Set(filteredModalTools.value.map(t => t.id))
  props.agent.tool_ids = props.agent.tool_ids.filter(id => !remove.has(id))
}

onMounted(() => { loadFiles(); loadUrls(); loadTools() })
</script>

<style scoped>
.field { border: 1px solid #D0D5DD; border-radius: 9px; padding: 8px 11px; font-size: 12.5px; color: #0F172A; background: #fff; outline: none; transition: box-shadow .15s, border-color .15s; }
.field:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EAF0FF; }
.badge { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.btn-outline { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #E5E7EB; background: #fff; border-radius: 10px; padding: 8px 13px; font-size: 13px; font-weight: 600; color: #344054; cursor: pointer; }
.btn-outline:hover { border-color: #cdd5e0; color: #0F172A; }
.view-link { display: inline-flex; align-items: center; gap: 3px; background: none; border: none; cursor: pointer; color: #2563EB; font-size: 12.5px; font-weight: 600; padding: 0; }
.view-link:hover { color: #1D4ED8; }
.add-btn { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #E5E7EB; background: #fff; border-radius: 9px; padding: 6px 11px; font-size: 12px; font-weight: 600; color: #344054; cursor: pointer; }
.add-btn:hover { border-color: #2563EB; color: #2563EB; }
.add-btn-sm { display: grid; place-items: center; height: 34px; width: 36px; border: none; border-radius: 9px; background: #2563EB; color: #fff; cursor: pointer; flex-shrink: 0; }
.add-btn-sm:hover:not(:disabled) { background: #1D4ED8; }
.add-btn-sm:disabled { opacity: .5; cursor: not-allowed; }
.icon-x { display: grid; place-items: center; height: 22px; width: 22px; border-radius: 6px; color: #98A2B3; cursor: pointer; flex-shrink: 0; }
.icon-x:hover { background: #FEECEB; color: #F04438; }
.modal-close { display: grid; height: 36px; width: 36px; place-items: center; border: 1px solid #E5E7EB; border-radius: 10px; color: #475569; background: #fff; }
.modal-close:hover { border-color: #CBD5E1; color: #0F172A; }
.modal-search { height: 38px; width: 100%; border: 1px solid #D9E0EA; border-radius: 10px; background: #fff; padding: 0 12px 0 38px; font-size: 13px; color: #0F172A; outline: none; box-shadow: 0 1px 2px rgba(16,24,40,.03); }
.modal-search:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EAF0FF; }
.modal-filter-chip { display: inline-flex; height: 38px; align-items: center; gap: 8px; border: 1px solid; border-radius: 7px; padding: 0 18px; font-size: 14px; font-weight: 650; transition: border-color .15s, background .15s, color .15s, box-shadow .15s; }
.modal-filter-chip:hover { border-color: #C7D2FE; box-shadow: 0 1px 2px rgba(15,23,42,.05); }
.modal-category-row { display: flex; width: 100%; align-items: center; gap: 12px; border: 0; border-radius: 8px; padding: 10px 12px; font-size: 15px; font-weight: 650; transition: background .15s, color .15s, box-shadow .15s; }
.tool-row { display: flex; align-items: center; gap: 18px; border-bottom: 1px solid #E5E7EB; padding: 20px 22px; background: #fff; }
.tool-row:last-child { border-bottom: 0; }
.tool-row:hover { background: #FCFCFF; }
.tool-add-btn { display: inline-flex; min-width: 96px; height: 38px; flex-shrink: 0; align-items: center; justify-content: center; gap: 8px; border: 1px solid; border-radius: 8px; padding: 0 16px; font-size: 14px; font-weight: 750; transition: background .15s, border-color .15s, color .15s; }
.modal-action { height: 34px; border: 1px solid #D9E0EA; border-radius: 9px; background: #fff; padding: 0 12px; font-size: 12.5px; font-weight: 700; color: #344054; }
.modal-action:hover { border-color: #2563EB; color: #2563EB; }
.modal-primary { height: 38px; border: none; border-radius: 10px; background: #2563EB; padding: 0 18px; font-size: 13px; font-weight: 700; color: #fff; box-shadow: 0 1px 2px rgba(37,99,235,.25); }
.modal-primary:hover { background: #1D4ED8; }
.modal-secondary { height: 38px; border: 1px solid #D9E0EA; border-radius: 9px; background: #fff; padding: 0 20px; font-size: 13px; font-weight: 700; color: #344054; }
.modal-secondary:hover { border-color: #CBD5E1; color: #0F172A; }
.modal-toggle { position: relative; height: 22px; width: 42px; flex-shrink: 0; border-radius: 999px; transition: background .15s; }
.modal-toggle-dot { display: block; height: 18px; width: 18px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.22); transition: transform .15s; }
.tool-chip { border-radius: 999px; background: #F1F5F9; padding: 3px 8px; font-size: 11px; font-weight: 700; color: #475569; }
.selected-tool-chip { display: inline-flex; height: 34px; max-width: 170px; align-items: center; gap: 8px; border: 1px solid #DCD9FF; border-radius: 7px; background: #F2F0FF; padding: 0 11px; font-size: 12px; font-weight: 700; color: #4338CA; }
.selected-tool-chip button { display: grid; place-items: center; flex-shrink: 0; }
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
