<template>
  <teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[60] bg-black/50 flex justify-end" @click.self="close">
      <div class="h-full w-full sm:w-[520px] bg-white shadow-2xl flex flex-col">
        <!-- header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <div class="flex items-center gap-2">
            <Folder class="w-5 h-5" :class="routing && routing.routed ? 'text-green-600' : 'text-blue-600'" />
            <h2 class="text-base font-bold text-gray-800">{{ routing && routing.routed ? 'Remote Workspace' : 'Local Workspace' }}</h2>
            <span v-if="files.length" class="text-xs text-gray-400">({{ formatSize(totalSize) }})</span>
          </div>
          <div class="flex items-center gap-1">
            <button @click="loadWorkspace" :disabled="loading" title="Refresh" class="p-1.5 hover:bg-gray-100 rounded text-gray-500">
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
            </button>
            <button @click="close" title="Close" class="p-1.5 hover:bg-gray-100 rounded text-gray-500">
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto">
          <!-- routing note -->
          <div v-if="routing && routing.routed" class="mx-3 mt-3 mb-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              <span class="text-sm font-semibold text-green-800">Remote Routing Active</span>
            </div>
            <p class="text-xs text-green-700">
              Tools execute on <strong>{{ routing.workspace && routing.workspace.workspace_name }}</strong>
            </p>
          </div>
          <div v-else class="mx-3 mt-3 mb-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p class="text-xs text-gray-500">
              Tools execute locally on the server. Assign this agent to a workspace and enable routing to execute remotely.
            </p>
          </div>

          <!-- loading -->
          <div v-if="loading" class="flex items-center justify-center py-16">
            <div class="animate-spin w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full"></div>
          </div>

          <!-- empty -->
          <div v-else-if="!files.length" class="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <Folder class="w-12 h-12" />
            <p class="text-sm">Workspace is empty</p>
            <p class="text-xs text-gray-300">Files created by the agent will appear here</p>
          </div>

          <!-- toolbar + tree -->
          <template v-else>
            <div class="px-3 pt-2 flex items-center gap-2">
              <button @click="sortBy = sortBy === 'name' ? 'time' : 'name'"
                class="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
                {{ sortBy === 'time' ? 'Recent' : 'Name' }}
              </button>
              <button v-if="!selectionMode" @click="selectionMode = true"
                class="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition">Select</button>
              <template v-else>
                <button @click="bulkDelete" :disabled="!selectedPaths.size"
                  class="text-xs px-2 py-1 rounded transition"
                  :class="selectedPaths.size ? 'bg-red-100 hover:bg-red-200 text-red-600' : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
                  Delete ({{ selectedPaths.size }})
                </button>
                <button @click="selectionMode = false; selectedPaths = new Set()"
                  class="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition">Cancel</button>
              </template>
            </div>
            <div class="p-3">
              <WorkspaceTreeNode
                :entries="sortedFiles"
                :expandedDirs="expandedDirs"
                :getFileIcon="getFileIcon"
                :formatSize="formatSize"
                :selectionMode="selectionMode"
                :selectedPaths="selectedPaths"
                @toggle-dir="toggleDir"
                @read-file="readFile"
                @delete="deleteEntry"
                @toggle-select="toggleSelect"
              />
            </div>
          </template>
        </div>
      </div>
    </div>
  </teleport>

  <FileViewer ref="fileViewer" />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Folder, RefreshCw, X } from 'lucide-vue-next'
import api from '../services/api'
import WorkspaceTreeNode from './WorkspaceTreeNode.vue'
import FileViewer from './FileViewer.vue'
import { confirm } from '@/composables/useConfirm'

const props = defineProps({
  agent: { type: Object, default: null },
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const open = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const files = ref([])
const totalSize = ref(0)
const loading = ref(false)
const expandedDirs = ref({})
const sortBy = ref('name')
const selectionMode = ref(false)
const selectedPaths = ref(new Set())
const routing = ref(null)
const fileViewer = ref(null)

function close() { open.value = false }

async function checkRouting() {
  if (!props.agent || !props.agent.id) return
  try { routing.value = (await api.getAgentWorkspaceRouting(props.agent.id)).data } catch (e) { routing.value = null }
}

async function loadWorkspace() {
  if (!props.agent || !props.agent.id) return
  loading.value = true
  try {
    const { data } = await api.getAgentWorkspace(props.agent.id)
    files.value = data.files || []
    totalSize.value = data.total_size || 0
  } catch (e) {
    console.error('Failed to load workspace:', e)
    files.value = []
  } finally {
    loading.value = false
  }
}

const sortEntries = (entries) => {
  const sorted = [...entries].sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1
    if (!a.is_dir && b.is_dir) return 1
    if (sortBy.value === 'time') return (b.modified || 0) - (a.modified || 0)
    return (a.name || '').localeCompare(b.name || '')
  })
  return sorted.map(e => (e.children ? { ...e, children: sortEntries(e.children) } : e))
}
const sortedFiles = computed(() => sortEntries(files.value))

function flattenFiles(entries) {
  const out = []
  for (const e of entries) {
    if (e.is_dir && e.children) out.push(...flattenFiles(e.children))
    else if (!e.is_dir) out.push(e)
  }
  return out
}

function toggleDir(path) { expandedDirs.value[path] = !expandedDirs.value[path] }

function readFile(entry) {
  if (entry.is_dir) return
  fileViewer.value && fileViewer.value.open(entry, props.agent.id, flattenFiles(sortedFiles.value))
}

async function deleteEntry(entry) {
  const label = entry.is_dir ? 'folder and all its contents' : 'file'
  if (!(await confirm({ title: 'Delete file?', message: `Delete this ${label}?\n${entry.path}`, confirmText: 'Delete', danger: true }))) return
  try {
    await api.deleteWorkspaceFile(props.agent.id, entry.path)
    selectedPaths.value.delete(entry.path)
    await loadWorkspace()
  } catch (e) { console.error('Delete failed:', e) }
}

function toggleSelect(path) {
  const s = new Set(selectedPaths.value)
  if (s.has(path)) s.delete(path); else s.add(path)
  selectedPaths.value = s
}

async function bulkDelete() {
  if (!selectedPaths.value.size) return
  if (!(await confirm({ title: 'Delete items?', message: `Delete ${selectedPaths.value.size} selected item(s)?`, confirmText: 'Delete', danger: true }))) return
  try {
    await api.bulkDeleteWorkspaceFiles(props.agent.id, [...selectedPaths.value])
    selectedPaths.value = new Set()
    selectionMode.value = false
    await loadWorkspace()
  } catch (e) { console.error('Bulk delete failed:', e) }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileIcon(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  const icons = {
    pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊', csv: '📊',
    json: '🔧', yaml: '🔧', yml: '🔧', toml: '🔧', xml: '🔧',
    py: '🐍', js: '📜', ts: '📜', jsx: '📜', tsx: '📜', vue: '📜',
    html: '🌐', css: '🎨', scss: '🎨', md: '📖', txt: '📃', log: '📃',
    sql: '🗃️', sh: '⚙️', bat: '⚙️', ps1: '⚙️',
  }
  return icons[ext] || '📎'
}

watch(open, (v) => { if (v) { checkRouting(); loadWorkspace() } })
</script>
