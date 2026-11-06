<template>
  <div class="code-browser">
    <!-- Left Sidebar: File Tree -->
    <div class="sidebar" :style="{ width: sidebarWidth + 'px' }">
      <div class="sidebar-header">
        <div class="sidebar-tabs" role="tablist" aria-label="Browser views">
          <button
            type="button" role="tab" :aria-selected="sidebarTab === 'files' ? 'true' : 'false'"
            @click="sidebarTab = 'files'"
            :class="{ active: sidebarTab === 'files' }"
            class="sidebar-tab">
            <Icon icon="lucide:folder" aria-hidden="true" />
            Files
          </button>
          <button
            v-if="artifacts && artifacts.length"
            type="button" role="tab" :aria-selected="sidebarTab === 'artifacts' ? 'true' : 'false'"
            @click="sidebarTab = 'artifacts'"
            :class="{ active: sidebarTab === 'artifacts' }"
            class="sidebar-tab">
            <Icon icon="lucide:database" aria-hidden="true" />
            Artifacts
          </button>
          <button
            type="button" role="tab" :aria-selected="sidebarTab === 'scm' ? 'true' : 'false'"
            @click="sidebarTab = 'scm'"
            :class="{ active: sidebarTab === 'scm' }"
            class="sidebar-tab" title="Source control">
            <Icon icon="lucide:git-branch" aria-hidden="true" />
            Source control
            <span v-if="scmCount > 0" class="scm-tabcount" :aria-label="`${scmCount} changes`">{{ scmCount }}</span>
          </button>
        </div>
      </div>

      <div class="sidebar-content">
        <!-- File Tree -->
        <div v-if="sidebarTab === 'files'" class="file-tree">
          <div class="search-box">
            <input
              v-model="fileSearch"
              type="search"
              aria-label="Search files"
              placeholder="Search files"
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
                  role="button" tabindex="0"
                  @click="openFile(r.path)"
                  @keydown.enter.prevent="openFile(r.path)">
                  <Icon class="node-iconify" :icon="iconFor(r)"
                        :style="iconColor(r) ? { color: iconColor(r) } : {}" />
                  <span class="node-name">{{ r.name }}</span>
                  <span class="node-path">{{ r.path }}</span>
                  <span v-if="r.gitignored" class="node-gi" title="Gitignored: kept in your workspace only, never committed">local-only</span>
                </div>
                <div v-if="searchTruncated" class="empty">Showing the first {{ searchResults.length }} matches. Type more of the name to narrow it down.</div>
              </div>
            </template>
            <!-- Lazy directory tree -->
            <template v-else>
              <div v-if="loading" class="loading">Loading files</div>
              <div v-else-if="treeError" class="tree-error" role="alert">
                <Icon icon="lucide:cloud-off" class="tree-error-ic" aria-hidden="true" />
                <p class="tree-error-t">{{ treeError }}</p>
                <button type="button" class="tree-error-retry" :disabled="loading" @click="loadFiles">
                  <Icon icon="lucide:refresh-cw" aria-hidden="true" /> Try again
                </button>
              </div>
              <div v-else-if="!rootNodes.length" class="empty">No files found</div>
              <div v-else role="tree" aria-label="Repository files">
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
          <SourceControlPanel :system-id="systemId" :repo-id="repositoryId" @count="scmCount = $event" @open-diff="openDiff" />
        </div>

        <!-- Artifact Tree -->
        <div v-else class="artifact-tree">
          <div class="search-box">
            <input
              v-model="artifactSearch"
              type="search"
              aria-label="Search artifacts"
              placeholder="Search artifacts"
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
      <div class="resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize the file list" @mousedown="startResize"></div>
    </div>

    <!-- Center: Editor Panel -->
    <div class="editor-panel">
      <!-- Tab Bar -->
      <div class="tab-bar" v-if="openTabs.length > 0">
        <div
          v-for="tab in openTabs"
          :key="tab.id"
          role="tab" tabindex="0" :aria-selected="activeTabId === tab.id ? 'true' : 'false'"
          @click="activeTabId = tab.id"
          @keydown.enter.self="activeTabId = tab.id"
          :class="['tab', { active: activeTabId === tab.id }]">
          <Icon v-if="tab.type === 'diff'" class="tab-icon" icon="lucide:file-diff" aria-hidden="true" />
          <Icon v-else class="tab-icon" :icon="iconFor({ name: tab.name, type: 'file' })" aria-hidden="true"
                :style="iconColor({ name: tab.name, type: 'file' }) ? { color: iconColor({ name: tab.name, type: 'file' }) } : {}" />
          <span class="tab-name">{{ tab.name }}</span>
          <span v-if="isDirty(tab)" class="tab-dot" title="Unsaved changes" aria-label="Unsaved changes"></span>
          <button type="button" @click.stop="closeTab(tab.id)" class="tab-close" :aria-label="`Close ${tab.name}`"><Icon icon="lucide:x" /></button>
        </div>
        <div v-if="editable" class="tab-actions">
          <button type="button" class="save-btn" :disabled="!activeTab || !isDirty(activeTab) || saving" @click="saveActive">
            {{ saving ? 'Saving' : 'Save' }}
          </button>
        </div>
      </div>

      <!-- Monaco Editor -->
      <div class="editor-container">
        <!-- A change from Source control: side by side, the last commit on the left and the file now on the right,
             as VS Code shows it. Read-only: edits are made in the file's own tab. -->
        <template v-if="activeTab && activeTab.type === 'diff'">
          <div v-if="activeTab.loading" class="empty-editor"><p class="empty-editor-s">Loading the changes…</p></div>
          <div v-else-if="activeTab.note" class="empty-editor" role="status">
            <Icon :icon="activeTab.noteIcon || 'lucide:file-diff'" class="empty-editor-ic" aria-hidden="true" />
            <p class="empty-editor-t">{{ activeTab.path }}</p>
            <p class="empty-editor-s">{{ activeTab.note }}</p>
          </div>
          <MonacoDiffEditor
            v-else
            :value="activeTab.modified"
            :original="activeTab.originalText"
            :language="activeTab.language"
            :theme="monacoTheme"
            :options="diffOptions"
            class="monaco-editor"
          />
        </template>
        <MonacoEditor
          v-else-if="activeTab"
          :value="activeTab.content"
          :language="activeTab.language"
          :path="activeTab.path"
          :options="editorOptions"
          :theme="monacoTheme"
          class="monaco-editor"
          @change="onEditorChange"
          @editorDidMount="onEditorMount"
        />
        <div v-else class="empty-editor">
          <Icon icon="lucide:file-code" class="empty-editor-ic" aria-hidden="true" />
          <p class="empty-editor-t">No file open</p>
          <p class="empty-editor-s">Pick a file from the list to open it here.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, h } from 'vue'
import { lazyComponent } from '@/utils/lazyComponent'
// MONACO IS LOADED WHEN AN EDITOR IS ACTUALLY SHOWN, not on every page view.
//
// MEASURED on production, chat route: total JS 5,856 KB across 30 files, of which monaco was 4,154 KB
// -- 71% of everything -- and it arrived at 359ms in the FIRST wave with index/vue-core/vendor,
// before AppShell at 912ms. It was `modulepreload`ed from index.html on every page, because a static
// import here put it in the entry graph: three views import CodeBrowser, so monaco reached the
// initial chunk set no matter which route the user opened. `vite.config.js` states the intent --
// "Deliberately NOT listed: monaco-editor ... they're route-level/dynamic" -- and a static import is
// what made that untrue.
//
// Both halves have to be dynamic. Importing only the component would still pull the namespace below.
// `applyDecorations` is unreachable until `onEditorMount` fires, so by the time `Range` is needed the
// namespace has resolved; the guard is there for the case where it has not.
let monacoNs = null
// lazyComponent: an error state + one guarded reload when the chunk is stale (F-C1).
const MonacoEditor = lazyComponent(async () => {
  await import('@/utils/monacoWorkers')        // before the editor starts: it asks for its workers at once
  monacoNs = await import('monaco-editor')
  const mod = await import('monaco-editor-vue3')
  return mod.default || mod
})
// The same lazy load, for a change's side-by-side diff (Source control).
const MonacoDiffEditor = lazyComponent(async () => {
  await import('@/utils/monacoWorkers')
  monacoNs = await import('monaco-editor')
  const mod = await import('monaco-editor-vue3')
  return mod.DiffEditor
})
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { useTheme } from '@/composables/useTheme'
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
  // directories get the info blue; files using a lucide (monochrome) icon get a neutral tint.
  if (file.type === 'directory') return 'var(--vm-sky)'
  return (iconFor(file).startsWith('lucide:')) ? 'var(--vm-ink-faint)' : ''
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
const treeError = ref('')             // why the files could not be listed (e.g. the project's sandbox is off)
const searchResults = ref([])         // flat results when the search box is non-empty
const searching = ref(false)
const searchTruncated = ref(false)
const openTabs = ref([])
const activeTabId = ref(null)
const saving = ref(false)

// The editor follows the app theme (useTheme → <html data-theme>): light 'vs', dark 'vs-dark'.
const { isDark } = useTheme()
const monacoTheme = computed(() => (isDark.value ? 'vs-dark' : 'vs'))
watch(monacoTheme, (t) => { try { monacoNs && monacoNs.editor.setTheme(t) } catch { /* editor not loaded */ } })

// Editor options (readOnly unless `editable`)
const editorOptions = computed(() => ({
  readOnly: !props.editable,
  minimap: { enabled: true },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  theme: monacoTheme.value,
  fontSize: 14,
  wordWrap: 'on',
  folding: true,
  renderWhitespace: 'selection'
}))

const diffOptions = computed(() => ({
  readOnly: true,
  originalEditable: false,
  renderSideBySide: true,
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 14,
  wordWrap: 'on',
}))

// A change from Source control opens as its own tab ("app.py (changes)"), like VS Code's diff editor.
async function openDiff({ path }) {
  const existing = openTabs.value.find(t => t.type === 'diff' && t.path === path)
  if (existing) { activeTabId.value = existing.id; return }
  const tab = {
    id: Date.now(), type: 'diff', path, name: `${path.split('/').pop()} (changes)`,
    language: detectLanguage(path), loading: true, note: '', noteIcon: '', originalText: '', modified: '',
  }
  openTabs.value.push(tab)
  activeTabId.value = tab.id
  const live = openTabs.value.find(t => t.id === tab.id)
  try {
    const { data } = await api.getSourceControlDiff(props.systemId, props.repositoryId, path)
    if (data.redacted) { live.note = 'This file holds secrets, so its values are not shown.'; live.noteIcon = 'lucide:lock' }
    else if (data.binary) { live.note = 'Binary file. There is no text to compare.' }
    else if (data.original === undefined && data.modified === undefined) { live.note = 'The changes cannot be shown for this file.' }
    else { live.originalText = data.original || ''; live.modified = data.modified || '' }
  } catch (e) {
    live.note = e?.response?.data?.error || 'The changes could not be loaded.'
  } finally {
    live.loading = false
  }
}

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
function onEditorMount(ed) {
  editorInst = ed
  try { monacoNs && monacoNs.editor.setTheme(monacoTheme.value) } catch { /* noop */ }
  applyDecorations()
}
function applyDecorations() {
  if (!editorInst || !monacoNs) return
  const ranges = (activeTab.value && props.decorations[activeTab.value.path]) || []
  const decos = ranges.map(r => ({
    range: new monacoNs.Range(r.start, 1, r.end, 1),
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
      node.expanded = false
      notify.error(e?.response?.data?.error || 'Could not open this folder')
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
  treeError.value = ''
  try {
    const response = await api.getRepositoryFiles(props.systemId, props.repositoryId, { path: '' })
    rootNodes.value = (response.data.entries || response.data.files || []).map(makeNode)
  } catch (error) {
    console.error('Failed to load files:', error, error.response?.data)
    rootNodes.value = []
    // A Let's Code project's files are in its sandbox: when that is off or cannot start, say so (ADM-1128).
    treeError.value = error?.response?.data?.error || 'The files could not be loaded.'
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
    notify.error(error?.response?.data?.error || 'Could not open the file')
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
        style: { paddingLeft: `${10 + (props.level || 0) * 12}px` },
        role: 'treeitem',
        tabindex: 0,
        'aria-expanded': props.file.type === 'directory' ? String(!!props.file.expanded) : undefined,
        onClick: handleClick,
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } },
      }, [
        props.file.type === 'directory'
          ? h('span', { class: 'node-expand', 'aria-hidden': 'true' }, [
              h(Icon, {
                icon: props.file.loading ? 'lucide:loader-2' : (props.file.expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'),
                class: props.file.loading ? 'node-spin' : '',
              }),
            ])
          : h('span', { class: 'node-expand', 'aria-hidden': 'true' }),
        h(Icon, {
          class: 'node-iconify',
          icon: iconFor(props.file),
          style: iconColor(props.file) ? { color: iconColor(props.file) } : {},
        }),
        h('span', { class: 'node-name' }, props.file.name),
        props.file.gitignored
          ? h('span', { class: 'node-gi', title: 'Gitignored: kept in your workspace only, never committed' }, 'local-only')
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
      if (type.includes('model')) return 'lucide:database'
      if (type.includes('view')) return 'lucide:eye'
      if (type.includes('serializer')) return 'lucide:package'
      return 'lucide:file'
    }

    return () => h('div', {
      class: 'tree-node',
      role: 'button',
      tabindex: 0,
      onClick: () => emit('select', props.artifact),
      onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emit('select', props.artifact) } },
    }, [
      h(Icon, { class: 'node-iconify', icon: getIcon(), 'aria-hidden': 'true' }),
      h('span', { class: 'node-name' }, props.artifact.name),
      h('span', { class: 'node-type' }, props.artifact.type)
    ])
  }
}
</script>

<style scoped>
.code-browser {
  --cb-on-solid: white;   /* text on the solid primary Save button: the same in both themes */
  display: flex;
  height: 100%;
  min-width: 0;
  background: var(--vm-surface);
  color: var(--vm-ink-soft);
  font-family: var(--vm-font-sans);
}

/* Sidebar */
.sidebar {
  position: relative;
  max-width: 45%;
  flex: 0 0 auto;
  border-right: 1px solid var(--vm-line);
  display: flex;
  flex-direction: column;
  background: var(--vm-surface-soft);
  min-width: 0;
}

.sidebar-header {
  border-bottom: 1px solid var(--vm-line);
}

.sidebar-tabs {
  display: flex;
}

.sidebar-tab {
  flex: 1;
  min-width: 0;
  padding: 10px 8px 8px;
  background: transparent;
  color: var(--vm-ink-soft);
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font: 600 12.5px var(--vm-font-sans);
  white-space: nowrap;
  overflow: hidden;
  transition: color .15s, background-color .15s, border-color .15s;
}
.sidebar-tab :deep(svg) { width: 15px; height: 15px; flex: 0 0 auto; }

.sidebar-tab:hover {
  color: var(--vm-ink);
  background: color-mix(in srgb, var(--vm-ink) 4%, transparent);
}

.sidebar-tab.active {
  color: var(--vm-ink);
  border-bottom-color: var(--vm-violet);
}
.scm-tabcount {
  margin-left: 2px; background: var(--vm-violet); color: var(--cb-on-solid); font-size: 10px; font-weight: 700;
  border-radius: 8px; padding: 0 5px; line-height: 16px; min-width: 16px; text-align: center;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}
.scm-pane { height: 100%; min-height: 0; }

.search-box {
  padding: 8px;
  border-bottom: 1px solid var(--vm-line);
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  background: var(--vm-surface);
  border: 1px solid var(--vm-line-2);
  border-radius: 6px;
  color: var(--vm-ink);
  font-size: 13px;
}
.search-input::placeholder { color: var(--vm-ink-faint); }

.search-input:focus {
  outline: none;
  border-color: var(--vm-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vm-focus) 20%, transparent);
}

.tree-list {
  padding: 4px 0;
}

.node-type {
  font-size: 11px;
  color: var(--vm-ink-soft);
  background: var(--vm-surface);
  border: 1px solid var(--vm-line);
  padding: 1px 6px;
  border-radius: 4px;
}

.loading, .empty {
  padding: 20px;
  text-align: center;
  color: var(--vm-ink-faint);
  font-size: 13px;
  line-height: 1.45;
}

.tree-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 16px;
  text-align: center;
}
.tree-error-ic { width: 22px; height: 22px; color: var(--vm-ink-faint); }
.tree-error-t { margin: 0; font-size: 13px; line-height: 1.5; color: var(--vm-ink-soft); max-width: 32ch; }
.tree-error-retry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--vm-line);
  border-radius: 6px;
  background: var(--vm-surface);
  color: var(--vm-ink);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}
.tree-error-retry:hover:not(:disabled) { border-color: var(--vm-ink-faint); }
.tree-error-retry:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.tree-error-retry:disabled { opacity: 0.6; cursor: default; }
.tree-error-retry :deep(svg) { width: 14px; height: 14px; }

/* Resize Handle */
.resize-handle {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: ew-resize;
  background: transparent;
  z-index: 2;
  transition: background-color .15s;
}

.resize-handle:hover {
  background: var(--vm-violet);
}

/* Editor Panel */
.editor-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-bar {
  display: flex;
  background: var(--vm-surface-soft);
  border-bottom: 1px solid var(--vm-line);
  overflow-x: auto;
  overflow-y: hidden;
}

.tab {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 8px 7px 12px;
  background: transparent;
  color: var(--vm-ink-soft);
  border-right: 1px solid var(--vm-line);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
  transition: color .15s, background-color .15s;
}

.tab:hover {
  color: var(--vm-ink);
  background: var(--vm-surface);
}

.tab.active {
  background: var(--vm-surface);
  color: var(--vm-ink);
  border-bottom-color: var(--vm-violet);
}

.tab-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.tab-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--vm-amber); flex: 0 0 auto; }
.tab-actions { margin-left: auto; display: flex; align-items: center; padding: 0 8px; }
.save-btn { background: var(--vm-violet); color: var(--cb-on-solid); border: none; border-radius: 6px; padding: 5px 12px; font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s, opacity .15s; }
.save-btn:hover:not(:disabled) { background: var(--vm-violet-d); }
.save-btn:disabled { opacity: .45; cursor: not-allowed; }
.tab-close {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--vm-ink-faint);
  cursor: pointer;
  transition: color .15s, background-color .15s;
}
.tab-close :deep(svg) { width: 14px; height: 14px; }

.tab-close:hover {
  color: var(--vm-ink);
  background: var(--vm-surface-soft);
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
  gap: 4px;
  height: 100%;
  padding: 24px;
  text-align: center;
  color: var(--vm-ink-faint);
}
.empty-editor-ic { width: 40px; height: 40px; margin-bottom: 10px; color: var(--vm-ink-faint); }
.empty-editor-t { margin: 0; font: 600 14px var(--vm-font-sans); color: var(--vm-ink-soft); }
.empty-editor-s { margin: 0; font-size: 13px; color: var(--vm-ink-faint); }

/* Scrollbar styling */
.sidebar-content::-webkit-scrollbar,
.tab-bar::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.sidebar-content::-webkit-scrollbar-track,
.tab-bar::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb,
.tab-bar::-webkit-scrollbar-thumb {
  background: var(--vm-line-2);
  border-radius: 5px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover,
.tab-bar::-webkit-scrollbar-thumb:hover {
  background: var(--vm-ink-faint);
}

@media (max-width: 640px) {
  .sidebar-tab { min-height: 44px; font-size: 12px; }
  .tab { min-height: 44px; }
  .tab-close { width: 36px; height: 36px; }
  .save-btn { min-height: 36px; }
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
  color: var(--vm-ink-soft);
  transition: background-color .1s;
}
.code-browser .tree-node:hover { background: color-mix(in srgb, var(--vm-ink) 5%, transparent); }
.code-browser .tree-node:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; border-radius: 4px; }
.code-browser .node-iconify { width: 16px; height: 16px; flex: 0 0 auto; }
.code-browser .node-expand { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 14px; color: var(--vm-ink-faint); }
.code-browser .node-expand svg { width: 13px; height: 13px; }
.code-browser .node-spin { animation: cb-node-spin 1s linear infinite; }
@keyframes cb-node-spin { to { transform: rotate(360deg); } }
.code-browser .node-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink); }
.code-browser .node-gi { flex: 0 0 auto; margin-left: 6px; font: 600 10px var(--vm-font-sans); color: var(--vm-ink-soft); background: color-mix(in srgb, var(--vm-ink-faint) 16%, transparent); border-radius: 4px; padding: 1px 5px; }
.code-browser .node-path { flex: 0 1 auto; min-width: 0; margin-left: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--vm-ink-faint); }
.code-browser .search-hit .node-name { flex: 0 0 auto; }
@media (max-width: 640px) { .code-browser .tree-node { min-height: 40px; } }
@media (prefers-reduced-motion: reduce) { .code-browser .node-spin { animation: none; } }
</style>
