<template>
  <div class="code-browser">
    <!-- Left Sidebar: File Tree -->
    <div class="sidebar" :style="{ width: sidebarWidth + 'px' }">
      <div class="sidebar-header">
        <div class="sidebar-tabs">
          <button 
            @click="sidebarTab = 'files'" 
            :class="{ active: sidebarTab === 'files' }"
            class="sidebar-tab">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Files
          </button>
          <button
            @click="sidebarTab = 'artifacts'"
            :class="{ active: sidebarTab === 'artifacts' }"
            class="sidebar-tab">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            Artifacts
          </button>
          <button
            @click="sidebarTab = 'scm'"
            :class="{ active: sidebarTab === 'scm' }"
            class="sidebar-tab" title="Source Control">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 3v12m0 0a3 3 0 103 3m-3-3a3 3 0 013 3m9-9a3 3 0 10-3-3m3 3a3 3 0 01-3-3m0 0H9a3 3 0 00-3 3" />
            </svg>
            Source Control
            <span v-if="scmCount > 0" class="scm-tabcount">{{ scmCount }}</span>
          </button>
        </div>
      </div>

      <div class="sidebar-content">
        <!-- File Tree -->
        <div v-if="sidebarTab === 'files'" class="file-tree">
          <div class="search-box">
            <input
              v-model="fileSearch"
              placeholder="Search files..."
              class="search-input" />
          </div>
          <div class="tree-list">
            <!-- Search results (flat, capped) -->
            <template v-if="fileSearch.trim()">
              <div v-if="searching" class="loading">Searching…</div>
              <div v-else-if="!searchResults.length" class="empty">No matches</div>
              <div v-else>
                <div
                  v-for="r in searchResults"
                  :key="r.path"
                  class="tree-node search-hit"
                  @click="openFile(r.path)">
                  <Icon class="node-iconify" :icon="iconFor(r)"
                        :style="iconColor(r) ? { color: iconColor(r) } : {}" />
                  <span class="node-name">{{ r.name }}</span>
                  <span class="node-path">{{ r.path }}</span>
                  <span v-if="r.gitignored" class="node-gi" title="Gitignored — local-only, not committed">local-only</span>
                </div>
                <div v-if="searchTruncated" class="empty">Showing first {{ searchResults.length }} matches — refine your search.</div>
              </div>
            </template>
            <!-- Lazy directory tree -->
            <template v-else>
              <div v-if="loading" class="loading">Loading files...</div>
              <div v-else-if="!rootNodes.length" class="empty">No files found</div>
              <div v-else>
                <FileTreeNode
                  v-for="file in rootNodes"
                  :key="file.path"
                  :file="file"
                  @select="openFile" />
              </div>
            </template>
          </div>
        </div>

        <!-- Source Control -->
        <div v-else-if="sidebarTab === 'scm'" class="scm-pane">
          <SourceControlPanel :system-id="systemId" :repo-id="repositoryId" @count="scmCount = $event" />
        </div>

        <!-- Artifact Tree -->
        <div v-else class="artifact-tree">
          <div class="search-box">
            <input 
              v-model="artifactSearch" 
              placeholder="Search artifacts..."
              class="search-input" />
          </div>
          <div class="tree-list">
            <div v-if="!artifacts || !artifacts.length" class="empty">
              No artifacts available
            </div>
            <div v-else>
              <ArtifactTreeNode 
                v-for="artifact in filteredArtifacts" 
                :key="artifact.name"
                :artifact="artifact"
                @select="openArtifact" />
            </div>
          </div>
        </div>
      </div>

      <!-- Resize Handle -->
      <div class="resize-handle" @mousedown="startResize"></div>
    </div>

    <!-- Center: Editor Panel -->
    <div class="editor-panel">
      <!-- Tab Bar -->
      <div class="tab-bar" v-if="openTabs.length > 0">
        <div
          v-for="tab in openTabs"
          :key="tab.id"
          @click="activeTabId = tab.id"
          :class="['tab', { active: activeTabId === tab.id }]">
          <span class="tab-icon">{{ getFileIcon(tab.path) }}</span>
          <span class="tab-name">{{ tab.name }}</span>
          <span v-if="isDirty(tab)" class="tab-dot" title="Unsaved changes">●</span>
          <button @click.stop="closeTab(tab.id)" class="tab-close">×</button>
        </div>
        <div v-if="editable" class="tab-actions">
          <button class="save-btn" :disabled="!activeTab || !isDirty(activeTab) || saving" @click="saveActive">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>

      <!-- Monaco Editor -->
      <div class="editor-container">
        <MonacoEditor
          v-if="activeTab"
          :value="activeTab.content"
          :language="activeTab.language"
          :path="activeTab.path"
          :options="editorOptions"
          class="monaco-editor"
          @change="onEditorChange"
          @editorDidMount="onEditorMount"
        />
        <div v-else class="empty-editor">
          <svg class="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-gray-500 font-medium">No file open</p>
          <p class="text-sm text-gray-400 mt-1">Select a file from the sidebar to view</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, h } from 'vue'
import * as monaco from 'monaco-editor'
import MonacoEditor from 'monaco-editor-vue3'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import SourceControlPanel from '@/components/letscode/SourceControlPanel.vue'

// Real per-extension file icons (colorful brand logos where available, lucide fallbacks otherwise).
const EXT_ICON = {
  py: 'logos:python', js: 'logos:javascript', mjs: 'logos:javascript', cjs: 'logos:javascript',
  ts: 'logos:typescript-icon', tsx: 'logos:react', jsx: 'logos:react', vue: 'logos:vue',
  json: 'lucide:braces', jsonc: 'lucide:braces',
  md: 'lucide:file-text', markdown: 'lucide:file-text', rst: 'lucide:file-text', txt: 'lucide:file-text',
  html: 'logos:html-5', htm: 'logos:html-5', css: 'logos:css-3', scss: 'logos:sass', sass: 'logos:sass', less: 'logos:less',
  yml: 'lucide:settings-2', yaml: 'lucide:settings-2', toml: 'lucide:settings-2', ini: 'lucide:settings-2', cfg: 'lucide:settings-2', conf: 'lucide:settings-2',
  env: 'lucide:settings-2', sh: 'lucide:terminal', bash: 'lucide:terminal', zsh: 'lucide:terminal', bat: 'lucide:terminal', cmd: 'lucide:terminal', ps1: 'lucide:terminal',
  sql: 'lucide:database', db: 'lucide:database', sqlite: 'lucide:database',
  go: 'logos:go', rs: 'logos:rust', rb: 'logos:ruby', php: 'logos:php', java: 'logos:java', kt: 'logos:kotlin',
  swift: 'logos:swift', cs: 'logos:c-sharp', c: 'lucide:file-code', h: 'lucide:file-code', cpp: 'lucide:file-code', cc: 'lucide:file-code', hpp: 'lucide:file-code',
  dart: 'logos:dart', scala: 'logos:scala', r: 'logos:r-lang', lua: 'logos:lua', ex: 'logos:elixir', exs: 'logos:elixir',
  xml: 'lucide:code', svg: 'lucide:image', png: 'lucide:image', jpg: 'lucide:image', jpeg: 'lucide:image', gif: 'lucide:image', webp: 'lucide:image', ico: 'lucide:image',
  pdf: 'lucide:file-type', csv: 'lucide:table', xlsx: 'lucide:table', xls: 'lucide:table',
  zip: 'lucide:file-archive', tar: 'lucide:file-archive', gz: 'lucide:file-archive', rar: 'lucide:file-archive',
  lock: 'lucide:lock', log: 'lucide:scroll-text',
}
function iconFor(file) {
  if (file.type === 'directory') return file.expanded ? 'lucide:folder-open' : 'lucide:folder'
  const name = (file.name || '').toLowerCase()
  if (name === 'dockerfile') return 'logos:docker-icon'
  if (name.startsWith('.env')) return 'lucide:settings-2'
  if (name === '.gitignore' || name === '.gitattributes') return 'logos:git-icon'
  if (name === 'package.json') return 'logos:nodejs-icon'
  if (name === 'requirements.txt' || name === 'pyproject.toml' || name === 'pipfile') return 'logos:python'
  const ext = name.includes('.') ? name.split('.').pop() : ''
  return EXT_ICON[ext] || 'lucide:file'
}
function iconColor(file) {
  // directories get a warm folder color; files using a lucide (monochrome) icon get a neutral tint.
  if (file.type === 'directory') return '#60a5fa'
  return (iconFor(file).startsWith('lucide:')) ? '#94a3b8' : ''
}

const props = defineProps({
  repositoryId: {
    type: Number,
    required: true
  },
  systemId: {
    type: Number,
    required: true
  },
  artifacts: {
    type: Array,
    default: () => []
  },
  // Opt-in editing (Let's Code IDE). Default false → existing usages stay read-only.
  editable: {
    type: Boolean,
    default: false
  },
  // Inline diff highlights from the current proposal: { 'rel/path': [{start,end}], … } (new-file added line ranges)
  decorations: {
    type: Object,
    default: () => ({})
  }
})

// State
const sidebarTab = ref('files')
const scmCount = ref(0)               // Source Control change-count badge
const sidebarWidth = ref(300)
const fileSearch = ref('')
const artifactSearch = ref('')
const rootNodes = ref([])             // lazy tree: top-level entries; dirs load children on expand
const loading = ref(false)
const searchResults = ref([])         // flat results when the search box is non-empty
const searching = ref(false)
const searchTruncated = ref(false)
const openTabs = ref([])
const activeTabId = ref(null)
const saving = ref(false)

// Editor options (readOnly unless `editable`)
const editorOptions = computed(() => ({
  readOnly: !props.editable,
  minimap: { enabled: true },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  theme: 'vs-dark',
  fontSize: 14,
  wordWrap: 'on',
  folding: true,
  renderWhitespace: 'selection'
}))

function isDirty(tab) {
  return props.editable && tab && tab.type === 'file' && tab.original !== undefined && tab.content !== tab.original
}

function onEditorChange(value) {
  if (!props.editable) return
  const tab = openTabs.value.find(t => t.id === activeTabId.value)
  if (tab && tab.type === 'file') tab.content = value
}

async function saveActive() {
  const tab = openTabs.value.find(t => t.id === activeTabId.value)
  if (!tab || !isDirty(tab)) return
  saving.value = true
  try {
    await api.saveFileContent(props.systemId, props.repositoryId, tab.path, tab.content)
    tab.original = tab.content
    notify.success(`Saved ${tab.name}`)
  } catch (e) {
    notify.error(e?.response?.data?.error || 'Failed to save file')
  } finally {
    saving.value = false
  }
}

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    if (props.editable) { e.preventDefault(); saveActive() }
  }
}

// ── Inline diff decorations (proposed added lines highlighted green) ──
let editorInst = null
let decoIds = []
function onEditorMount(ed) { editorInst = ed; applyDecorations() }
function applyDecorations() {
  if (!editorInst) return
  const ranges = (activeTab.value && props.decorations[activeTab.value.path]) || []
  const decos = ranges.map(r => ({
    range: new monaco.Range(r.start, 1, r.end, 1),
    options: { isWholeLine: true, className: 'lc-add-line', linesDecorationsClassName: 'lc-add-gutter' },
  }))
  try { decoIds = editorInst.deltaDecorations(decoIds, decos) } catch { /* editor not ready */ }
}
watch(activeTabId, () => applyDecorations())
watch(() => props.decorations, () => applyDecorations(), { deep: true })

// Computed
const activeTab = computed(() => {
  return openTabs.value.find(t => t.id === activeTabId.value)
})

// Build a reactive tree node from a server entry. `expanded`/`loaded`/`loading`/`children` are plain
// fields — they live inside the reactive `rootNodes` array, so mutating them updates the tree.
function makeNode(e) {
  return {
    name: e.name, path: e.path, type: e.type, size: e.size,
    gitignored: !!e.gitignored,
    expanded: false, loaded: false, loading: false, children: [],
  }
}

// Toggle a directory; first expand lazily fetches its immediate children (one level). The backend
// returns EVERYTHING (incl. node_modules/venv/.git) — we just don't read a dir until it's opened.
async function expandDir(node) {
  if (node.type !== 'directory') return
  node.expanded = !node.expanded
  if (node.expanded && !node.loaded && !node.loading) {
    node.loading = true
    try {
      const res = await api.getRepositoryFiles(props.systemId, props.repositoryId, { path: node.path })
      node.children = (res.data.entries || []).map(makeNode)
      node.loaded = true
    } catch (e) {
      console.error('Failed to load directory:', node.path, e)
      node.children = []
    } finally {
      node.loading = false
    }
  }
}

// Debounced server-side search (capped) — replaces the old client-side filter over the full tree.
let _searchTimer = null
watch(fileSearch, (q) => {
  clearTimeout(_searchTimer)
  q = (q || '').trim()
  if (!q) { searchResults.value = []; searching.value = false; searchTruncated.value = false; return }
  searching.value = true
  _searchTimer = setTimeout(() => runSearch(q), 250)
})

async function runSearch(q) {
  searching.value = true
  try {
    const res = await api.getRepositoryFiles(props.systemId, props.repositoryId, { search: q })
    searchResults.value = res.data.entries || []
    searchTruncated.value = !!res.data.truncated
  } catch (e) {
    console.error('File search failed:', e)
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

const filteredArtifacts = computed(() => {
  if (!artifactSearch.value) return props.artifacts
  const query = artifactSearch.value.toLowerCase()
  return props.artifacts.filter(a => 
    a.name.toLowerCase().includes(query) || 
    (a.type && a.type.toLowerCase().includes(query))
  )
})

// Methods
async function loadFiles() {
  loading.value = true
  try {
    const response = await api.getRepositoryFiles(props.systemId, props.repositoryId, { path: '' })
    rootNodes.value = (response.data.entries || response.data.files || []).map(makeNode)
  } catch (error) {
    console.error('❌ Failed to load files:', error, error.response?.data)
    rootNodes.value = []
  } finally {
    loading.value = false
  }
}

async function openFile(filePath) {
  // Check if already open
  const existing = openTabs.value.find(t => t.path === filePath)
  if (existing) {
    activeTabId.value = existing.id
    return
  }

  try {
    // Load file content
    const response = await api.getFileContent(props.systemId, props.repositoryId, filePath)
    const content = response.data.content
    const language = detectLanguage(filePath)
    
    const newTab = {
      id: Date.now(),
      name: filePath.split('/').pop(),
      path: filePath,
      content,
      original: content,   // baseline for dirty tracking (editable mode)
      language,
      type: 'file'
    }

    openTabs.value.push(newTab)
    activeTabId.value = newTab.id
  } catch (error) {
    console.error('Failed to load file:', error)
    notify.error('Failed to load file: ' + error.message)
  }
}

function openArtifact(artifact) {
  // Check if already open
  const existing = openTabs.value.find(t => t.artifactId === artifact.name)
  if (existing) {
    activeTabId.value = existing.id
    return
  }

  const content = formatArtifactCode(artifact)
  const language = 'python' // Most artifacts are Python
  
  const newTab = {
    id: Date.now(),
    name: artifact.name,
    path: artifact.file || artifact.name,
    content,
    language,
    type: 'artifact',
    artifactId: artifact.name
  }
  
  openTabs.value.push(newTab)
  activeTabId.value = newTab.id
}

async function closeTab(tabId) {
  const index = openTabs.value.findIndex(t => t.id === tabId)
  if (index === -1) return

  const tab = openTabs.value[index]
  if (isDirty(tab)) {
    const ok = await confirm({
      title: 'Discard unsaved changes?',
      message: `"${tab.name}" has unsaved edits. Close without saving?`,
      confirmText: 'Close', cancelText: 'Keep editing', danger: true,
    })
    if (!ok) return
  }

  openTabs.value.splice(index, 1)
  
  // Switch to another tab if closing active tab
  if (activeTabId.value === tabId) {
    if (openTabs.value.length > 0) {
      activeTabId.value = openTabs.value[Math.max(0, index - 1)].id
    } else {
      activeTabId.value = null
    }
  }
}

function detectLanguage(filePath) {
  const ext = filePath.split('.').pop().toLowerCase()
  const langMap = {
    'py': 'python',
    'js': 'javascript',
    'vue': 'html',
    'ts': 'typescript',
    'tsx': 'typescript',
    'jsx': 'javascript',
    'json': 'json',
    'md': 'markdown',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'sql': 'sql',
    'sh': 'shell',
    'bash': 'shell'
  }
  return langMap[ext] || 'plaintext'
}

function formatArtifactCode(artifact) {
  // Try different fields for code content
  if (artifact.content) return artifact.content
  if (artifact.source_code) return artifact.source_code
  if (artifact.code) return artifact.code
  
  // Fallback to JSON
  return JSON.stringify(artifact, null, 2)
}

function getFileIcon(path) {
  const ext = path.split('.').pop().toLowerCase()
  const icons = {
    'py': '🐍',
    'js': '📜',
    'vue': '💚',
    'json': '📋',
    'md': '📝',
    'html': '🌐',
    'css': '🎨',
    'ts': '📘',
    'yaml': '⚙️',
    'sql': '🗄️'
  }
  return icons[ext] || '📄'
}

// Sidebar resize
let isResizing = false
function startResize(e) {
  isResizing = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

function handleResize(e) {
  if (!isResizing) return
  const newWidth = e.clientX
  if (newWidth >= 200 && newWidth <= 600) {
    sidebarWidth.value = newWidth
  }
}

function stopResize() {
  isResizing = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

// Lifecycle
onMounted(() => {
  loadFiles()
  if (props.editable) window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  if (props.editable) window.removeEventListener('keydown', onKeydown)
})

// Tree node component with directory support (real per-extension icons via @iconify).
const FileTreeNode = {
  props: ['file', 'level'],
  emits: ['select'],
  setup(props, { emit }) {
    const handleClick = () => {
      if (props.file.type === 'directory') {
        expandDir(props.file)            // lazy: fetch this level's children on first open
      } else {
        emit('select', props.file.path)
      }
    }

    const renderChildren = () => {
      if (props.file.type === 'directory' && props.file.expanded && props.file.children) {
        return props.file.children.map(child =>
          h(FileTreeNode, {
            key: child.path,
            file: child,
            level: (props.level || 0) + 1,
            onSelect: (path) => emit('select', path)
          })
        )
      }
      return []
    }

    return () => h('div', {}, [
      h('div', {
        class: 'tree-node',
        style: { paddingLeft: `${(props.level || 0) * 12}px`, cursor: 'pointer' },
        onClick: handleClick
      }, [
        props.file.type === 'directory'
          ? h('span', { class: 'node-expand' }, props.file.loading ? '⋯' : (props.file.expanded ? '▼' : '▶'))
          : h('span', { class: 'node-expand' }),
        h(Icon, {
          class: 'node-iconify',
          icon: iconFor(props.file),
          style: iconColor(props.file) ? { color: iconColor(props.file) } : {},
        }),
        h('span', { class: 'node-name' }, props.file.name),
        props.file.gitignored
          ? h('span', { class: 'node-gi', title: 'Gitignored — local-only, not committed' }, 'local-only')
          : null,
      ]),
      ...renderChildren()
    ])
  }
}

const ArtifactTreeNode = {
  props: ['artifact'],
  emits: ['select'],
  setup(props, { emit }) {
    const getIcon = () => {
      const type = (props.artifact.type || '').toLowerCase()
      if (type.includes('model')) return '🗃️'
      if (type.includes('view')) return '👁️'
      if (type.includes('serializer')) return '📦'
      return '📄'
    }
    
    return () => h('div', {
      class: 'tree-node',
      onClick: () => emit('select', props.artifact)
    }, [
      h('span', { class: 'node-icon' }, getIcon()),
      h('span', { class: 'node-name' }, props.artifact.name),
      h('span', { class: 'node-type' }, props.artifact.type)
    ])
  }
}
</script>

<style scoped>
.code-browser {
  display: flex;
  height: 100%;
  background: #1e1e1e;
  color: #d4d4d4;
}

/* Sidebar */
.sidebar {
  position: relative;
  border-right: 1px solid #3c3c3c;
  display: flex;
  flex-direction: column;
  background: #252526;
}

.sidebar-header {
  border-bottom: 1px solid #3c3c3c;
}

.sidebar-tabs {
  display: flex;
}

.sidebar-tab {
  flex: 1;
  padding: 10px;
  background: transparent;
  color: #969696;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  transition: all 0.2s;
}

.sidebar-tab:hover {
  background: #2a2d2e;
}

.sidebar-tab.active {
  background: #1e1e1e;
  color: #ffffff;
  border-bottom: 2px solid #007acc;
}
.scm-tabcount {
  margin-left: 4px; background: #007acc; color: #fff; font-size: 9px; font-weight: 700;
  border-radius: 8px; padding: 0 5px; line-height: 15px; min-width: 15px; text-align: center;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}
.scm-pane { height: 100%; min-height: 0; }

.search-box {
  padding: 8px;
  border-bottom: 1px solid #3c3c3c;
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  background: #3c3c3c;
  border: 1px solid #454545;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 13px;
}

.search-input:focus {
  outline: none;
  border-color: #007acc;
}

.tree-list {
  padding: 4px 0;
}

.tree-node {
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  transition: background 0.1s;
}

.tree-node:hover {
  background: #2a2d2e;
}

.node-icon {
  font-size: 14px;
  margin-right: 4px;
}

.node-expand {
  display: inline-block;
  width: 12px;
  font-size: 10px;
  color: #858585;
  margin-right: 4px;
}

.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-type {
  font-size: 11px;
  color: #858585;
  background: #3c3c3c;
  padding: 2px 6px;
  border-radius: 3px;
}

.loading, .empty {
  padding: 20px;
  text-align: center;
  color: #858585;
  font-size: 13px;
}

/* Resize Handle */
.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: ew-resize;
  background: transparent;
}

.resize-handle:hover {
  background: #007acc;
}

/* Editor Panel */
.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-bar {
  display: flex;
  background: #2d2d2d;
  border-bottom: 1px solid #3c3c3c;
  overflow-x: auto;
  overflow-y: hidden;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #2d2d2d;
  color: #969696;
  border-right: 1px solid #3c3c3c;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
  transition: all 0.1s;
}

.tab:hover {
  background: #1e1e1e;
}

.tab.active {
  background: #1e1e1e;
  color: #ffffff;
  border-bottom: 2px solid #007acc;
}

.tab-icon {
  font-size: 14px;
}

.tab-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-dot { color: #e2b341; font-size: 12px; line-height: 1; }
.tab-actions { margin-left: auto; display: flex; align-items: center; padding: 0 8px; }
.save-btn { background: #2563EB; color: #fff; border: none; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
.save-btn:hover:not(:disabled) { background: #1D4ED8; }
.save-btn:disabled { opacity: .45; cursor: not-allowed; }
.tab-close {
  background: none;
  border: none;
  color: #969696;
  cursor: pointer;
  font-size: 18px;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.1s;
}

.tab-close:hover {
  color: #ffffff;
}

.editor-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.monaco-editor {
  width: 100%;
  height: 100%;
}

.empty-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #858585;
}

/* Scrollbar styling */
.sidebar-content::-webkit-scrollbar,
.tab-bar::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.sidebar-content::-webkit-scrollbar-track,
.tab-bar::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.sidebar-content::-webkit-scrollbar-thumb,
.tab-bar::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 5px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover,
.tab-bar::-webkit-scrollbar-thumb:hover {
  background: #4e4e4e;
}
</style>

<!-- NON-scoped: the file-tree nodes are rendered by a child component (FileTreeNode), so scoped
     rules don't reach them. Selector-scoped under .code-browser to avoid leaking app-wide. -->
<style>
.code-browser .tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-size: 13px;
  line-height: 1.3;
  cursor: pointer;
  white-space: nowrap;
}
.code-browser .tree-node:hover { background: #2a2d2e; }
.code-browser .node-iconify { width: 16px; height: 16px; flex: 0 0 auto; }
.code-browser .node-expand { flex: 0 0 auto; display: inline-flex; justify-content: center; width: 12px; font-size: 10px; color: #858585; }
.code-browser .node-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #d4d4d4; }
.code-browser .node-gi { flex: 0 0 auto; margin-left: 6px; font: 700 8.5px var(--vm-font-sans, sans-serif); letter-spacing: .02em; color: #94a3b8; background: rgba(148,163,184,.16); border-radius: 4px; padding: 1px 5px; text-transform: uppercase; }
.code-browser .node-path { flex: 0 1 auto; min-width: 0; margin-left: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: #6b7280; }
.code-browser .search-hit .node-name { flex: 0 0 auto; }
</style>
