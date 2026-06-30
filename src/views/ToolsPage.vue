<template>
  <div class="min-h-full bg-[#F8FAFC] px-5 py-7 sm:px-7 lg:px-8">
    <div class="mx-auto max-w-[1390px]">
      <!-- Header -->
      <header class="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-[28px] font-[850] leading-tight tracking-normal text-[#0F172A]">Tools</h1>
          <p class="mt-2 text-[14px] text-[#52627A]">Discover, manage, and enable tools your agents can use.</p>
        </div>
      </header>

      <div class="grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <!-- Main column -->
        <div class="min-w-0">
          <!-- Tabs -->
          <div>
            <ToolsTabs v-model="tab" :tabs="tabDefs" />
          </div>

          <section class="rounded-b-[10px] rounded-tr-[10px] border border-[#DDE6F2] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <!-- Toolbar -->
            <div class="mb-7 flex flex-wrap items-center gap-4">
            <div class="relative min-w-[240px] flex-1">
              <Search :size="17" class="absolute left-4 top-1/2 -translate-y-1/2 text-[#667994]" />
              <input
                v-model="q"
                type="text"
                placeholder="Search tools..."
                class="h-11 w-full rounded-[8px] border border-[#D8E2F0] bg-white py-0 pl-11 pr-3 text-[13px] font-semibold text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              v-model="category"
              class="h-11 min-w-[190px] rounded-[8px] border border-[#D8E2F0] bg-white px-4 py-0 text-[13px] font-bold text-[#334155] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">All Categories</option>
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>

            <div class="relative h-11 w-11">
              <SlidersHorizontal
                :size="16"
                class="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[#0F172A]"
              />
              <select
                v-model="sort"
                aria-label="Sort tools"
                class="h-11 w-11 appearance-none rounded-[8px] border border-[#D8E2F0] bg-white px-2 py-0 text-[0px] font-bold text-transparent focus:border-[#2563EB] focus:outline-none"
              >
                <option value="name">Name (A-Z)</option>
                <option value="usage">Most used</option>
                <option value="status">Status</option>
              </select>
            </div>

            <AddToolMenu class="ml-auto" @select="onAdd" />
          </div>

          <!-- Error -->
          <div v-if="error" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {{ error }}
          </div>

          <!-- Tables -->
          <ToolsTable
            v-if="tab === 'all'"
            :tools="pagedTools"
            :loading="loading"
            @select="openDetails"
            @toggle="toggleTool"
            @delete="removeTool"
          />

          <McpServersTable
            v-else-if="tab === 'mcp'"
            :servers="mcpServers"
            :loading="mcpLoading"
            @test="testMcp"
            @refresh="refreshMcp"
            @delete="deleteMcp"
          />

          <CustomToolsTable
            v-else
            :tools="pagedTools"
            :loading="loading"
            @select="openDetails"
            @toggle="toggleTool"
            @delete="removeTool"
            @create="onAdd('yaml')"
          />

            <div v-if="tab !== 'mcp' && !loading" class="mt-7 flex flex-wrap items-center justify-between gap-3">
              <p class="text-[13px] font-medium text-[#64748B]">
                Showing {{ pageStart }} to {{ pageEnd }} of {{ visibleTools.length }} tools
              </p>
              <div class="flex items-center gap-2">
                <button
                  class="grid h-9 w-9 place-items-center rounded-[8px] border border-[#DDE6F2] text-[#94A3B8] hover:bg-slate-50 disabled:opacity-45"
                  :disabled="currentPage === 1"
                  @click="currentPage = Math.max(1, currentPage - 1)"
                >
                  <ChevronLeft :size="16" :stroke-width="2.2" />
                </button>
                <span class="grid h-9 min-w-9 place-items-center rounded-[8px] border border-[#AFC4FF] px-3 text-[13px] font-bold text-[#2457F5]">
                  {{ currentPage }}
                </span>
                <button
                  class="grid h-9 w-9 place-items-center rounded-[8px] border border-[#DDE6F2] text-[#94A3B8] hover:bg-slate-50 disabled:opacity-45"
                  :disabled="currentPage >= totalPages"
                  @click="currentPage = Math.min(totalPages, currentPage + 1)"
                >
                  <ChevronRight :size="16" :stroke-width="2.2" />
                </button>
              </div>
            </div>
          </section>
        </div>

        <!-- Sidebar -->
        <ToolHelpSidebar @create="onAdd('yaml')" />
      </div>
    </div>

    <!-- Details drawer -->
    <ToolDetailsDrawer
      :open="drawerOpen"
      :tool="selected"
      :detail="selectedDetail"
      :usage="selectedUsage"
      :usage-loading="usageLoading"
      @close="drawerOpen = false"
      @toggle="toggleTool"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-vue-next'
import api from '../services/api'
import { notify } from '../composables/useNotify'
import { confirm } from '../composables/useConfirm'

import ToolsTabs from '../components/tools-library/ToolsTabs.vue'
import ToolsTable from '../components/tools-library/ToolsTable.vue'
import McpServersTable from '../components/tools-library/McpServersTable.vue'
import CustomToolsTable from '../components/tools-library/CustomToolsTable.vue'
import ToolDetailsDrawer from '../components/tools-library/ToolDetailsDrawer.vue'
import ToolHelpSidebar from '../components/tools-library/ToolHelpSidebar.vue'
import AddToolMenu from '../components/tools-library/AddToolMenu.vue'

const tools = ref([])
const loading = ref(false)
const error = ref('')

const mcpServers = ref([])
const mcpLoading = ref(false)

const q = ref('')
const category = ref('')
const sort = ref('name')
const tab = ref('all')
const pageSize = 10
const currentPage = ref(1)

const drawerOpen = ref(false)
const selected = ref(null)
const selectedDetail = ref(null)
const selectedUsage = ref(null)
const usageLoading = ref(false)

// ── Derived ────────────────────────────────────────────────
function isCustom(t) {
  return t.tool_kind === 'yaml' || t.tool_kind === 'remote'
}

const categories = computed(() => {
  const set = new Set()
  tools.value.forEach(t => { if (t.category) set.add(t.category) })
  return [...set].sort()
})

const tabFiltered = computed(() => {
  if (tab.value === 'custom') return tools.value.filter(isCustom)
  return tools.value // 'all' (mcp tab uses its own list)
})

const visibleTools = computed(() => {
  let list = tabFiltered.value
  const needle = q.value.trim().toLowerCase()
  if (needle) {
    list = list.filter(t =>
      (t.name || '').toLowerCase().includes(needle) ||
      (t.display_name || '').toLowerCase().includes(needle) ||
      (t.description || '').toLowerCase().includes(needle))
  }
  if (category.value) list = list.filter(t => t.category === category.value)

  const arr = [...list]
  if (sort.value === 'usage') arr.sort((a, b) => (b.agents_count || 0) - (a.agents_count || 0))
  else if (sort.value === 'status') arr.sort((a, b) => (a.status || '').localeCompare(b.status || ''))
  else arr.sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name))
  return arr
})

const totalPages = computed(() => Math.max(1, Math.ceil(visibleTools.value.length / pageSize)))

const pagedTools = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return visibleTools.value.slice(start, start + pageSize)
})

const pageStart = computed(() => {
  if (!visibleTools.value.length) return 0
  return (currentPage.value - 1) * pageSize + 1
})

const pageEnd = computed(() => Math.min(currentPage.value * pageSize, visibleTools.value.length))

watch([q, category, sort, tab], () => {
  currentPage.value = 1
})

watch(totalPages, pages => {
  if (currentPage.value > pages) currentPage.value = pages
})

const tabDefs = computed(() => [
  { key: 'all', label: 'All Tools', count: tools.value.length },
  { key: 'mcp', label: 'MCP Servers', count: mcpServers.value.length },
  { key: 'custom', label: 'Custom Tools', count: tools.value.filter(isCustom).length },
])

// ── Data loading ───────────────────────────────────────────
async function loadTools() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.getTools()
    tools.value = data.tools || []
  } catch (e) {
    error.value = 'Failed to load tools. Please try again.'
    notify.error('Failed to load tools')
  } finally {
    loading.value = false
  }
}

async function loadMcp() {
  mcpLoading.value = true
  try {
    const { data } = await api.getMCPServers()
    mcpServers.value = data.servers || []
  } catch (e) {
    notify.error('Failed to load MCP servers')
  } finally {
    mcpLoading.value = false
  }
}

onMounted(() => {
  loadTools()
  loadMcp()
})

// ── Details drawer ─────────────────────────────────────────
async function openDetails(tool) {
  selected.value = tool
  selectedDetail.value = null
  selectedUsage.value = null
  drawerOpen.value = true

  // Detail
  try {
    const { data } = await api.getToolDetail(tool.name)
    selectedDetail.value = data
  } catch (e) { /* drawer falls back to row data */ }

  // Usage (new endpoint)
  usageLoading.value = true
  try {
    const { data } = await api.getToolAgents(tool.name)
    selectedUsage.value = data
  } catch (e) { /* non-fatal */ } finally {
    usageLoading.value = false
  }
}

// ── Actions ────────────────────────────────────────────────
async function toggleTool(tool) {
  if (!tool) return
  const next = !tool.enabled
  try {
    await api.updateTool(tool.name, { enabled: next })
    tool.enabled = next
    tool.status = next ? (tool.requires_auth ? 'needs_config' : 'enabled') : 'disabled'
    notify.success(`${tool.display_name || tool.name} ${next ? 'enabled' : 'disabled'}`)
  } catch (e) {
    notify.error('Failed to update tool')
  }
}

async function removeTool(tool) {
  if (!tool) return
  const ok = await confirm({
    title: 'Delete tool',
    message: `Delete "${tool.display_name || tool.name}"? Agents using it will lose this capability.`,
    confirmText: 'Delete',
  })
  if (!ok) return
  try {
    await api.deleteTool(tool.name)
    tools.value = tools.value.filter(t => t.name !== tool.name)
    notify.success('Tool deleted')
    if (selected.value?.name === tool.name) drawerOpen.value = false
  } catch (e) {
    notify.error('Failed to delete tool')
  }
}

// ── MCP actions ────────────────────────────────────────────
async function testMcp(s) {
  try {
    await api.testMCPConnection(s.id)
    notify.success(`${s.name}: connection OK`)
  } catch (e) {
    notify.error(`${s.name}: connection failed`)
  }
}

async function refreshMcp(s) {
  try {
    await api.refreshMCPTools(s.id)
    notify.success(`${s.name}: tools refreshed`)
    loadMcp()
    loadTools()
  } catch (e) {
    notify.error('Failed to refresh tools')
  }
}

async function deleteMcp(s) {
  const ok = await confirm({
    title: 'Delete MCP server',
    message: `Delete "${s.name}"? Its tools will no longer be available to your agents.`,
    confirmText: 'Delete',
  })
  if (!ok) return
  try {
    await api.deleteMCPServer(s.id)
    mcpServers.value = mcpServers.value.filter(x => x.id !== s.id)
    notify.success('MCP server deleted')
  } catch (e) {
    notify.error('Failed to delete MCP server')
  }
}

// ── Add tool menu ──────────────────────────────────────────
function onAdd(kind) {
  // These open the relevant creation surface. The Connectors page owns the
  // full MCP/custom-tool creation wizards; from here we deep-link to them.
  if (kind === 'mcp') {
    notify.info('Add an MCP server from the Connectors page.')
  } else if (kind === 'yaml') {
    notify.info('Create a YAML tool from the Connectors page.')
  } else if (kind === 'remote') {
    notify.info('Register a remote tool from the Connectors page.')
  }
}
</script>
