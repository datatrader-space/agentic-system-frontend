<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm" @click.self="close">
    <div class="fv-root rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden"
         :class="isDark ? 'fv-dark' : 'fv-light'">

      <!-- ═══ Header ═══ -->
      <div class="fv-bar flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="text-lg flex-shrink-0">{{ fileIcon }}</span>
          <div class="min-w-0">
            <h3 class="fv-strong text-sm font-bold truncate">{{ fileName }}</h3>
            <div class="fv-muted flex items-center gap-2 text-[10px]">
              <span v-if="languageLabel" class="fv-accent px-1.5 py-0.5 rounded font-mono uppercase tracking-wide">{{ languageLabel }}</span>
              <span v-if="lineCount && renderMode === 'code'">{{ lineCount }} lines</span>
              <span v-if="pdfPageCount">{{ pdfPageCount }} pages</span>
              <span v-if="fileSize">{{ formatBytes(fileSize) }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <!-- File navigation (prev/next in folder) -->
          <template v-if="siblingFiles.length > 1">
            <button @click="goToFile(-1)" :disabled="currentFileIndex <= 0"
              class="fv-iconbtn disabled:opacity-30"
              title="Previous file (←)">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <span class="text-[10px] text-gray-500 font-mono tabular-nums min-w-[3ch] text-center">{{ currentFileIndex + 1 }}/{{ siblingFiles.length }}</span>
            <button @click="goToFile(1)" :disabled="currentFileIndex >= siblingFiles.length - 1"
              class="fv-iconbtn disabled:opacity-30"
              title="Next file (→)">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
            <div class="fv-divider w-px h-5 mx-1"></div>
          </template>
          <!-- PDF page nav -->
          <template v-if="renderMode === 'pdf' && pdfPageCount > 1">
            <button @click="pdfPage = Math.max(1, pdfPage - 1)" :disabled="pdfPage <= 1"
              class="fv-iconbtn disabled:opacity-30">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <span class="text-xs text-gray-400 font-mono tabular-nums">{{ pdfPage }}/{{ pdfPageCount }}</span>
            <button @click="pdfPage = Math.min(pdfPageCount, pdfPage + 1)" :disabled="pdfPage >= pdfPageCount"
              class="fv-iconbtn disabled:opacity-30">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
            <div class="fv-divider w-px h-5 mx-1"></div>
          </template>
          <!-- Download -->
          <button @click="downloadFile" :disabled="downloading"
            class="fv-accent-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            {{ downloading ? '...' : 'Download' }}
          </button>
          <!-- Close -->
          <button @click="close" class="fv-iconbtn">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- ═══ Content ═══ -->
      <div class="flex-1 min-h-0 relative" :class="[contentBg, renderMode === 'code' || renderMode === 'json' ? 'overflow-hidden' : 'overflow-auto']">

        <!-- Loading -->
        <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div class="w-8 h-8 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin"></div>
          <span class="text-sm text-gray-500">Loading file...</span>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="flex flex-col items-center justify-center h-full px-8 text-center">
          <div class="text-4xl mb-3">⚠️</div>
          <p class="text-red-400 text-sm max-w-md">{{ error }}</p>
        </div>

        <!-- Image -->
        <div v-else-if="renderMode === 'image'" class="flex items-center justify-center h-full p-4 bg-[#11111b]">
          <img :src="mediaUrl" :alt="fileName" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>

        <!-- Video -->
        <div v-else-if="renderMode === 'video'" class="flex items-center justify-center h-full p-4 bg-[#11111b]">
          <video :src="mediaUrl" controls autoplay class="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>

        <!-- PDF -->
        <div v-else-if="renderMode === 'pdf'" class="flex items-center justify-center p-6 bg-[#11111b] min-h-full">
          <canvas ref="pdfCanvas" class="shadow-2xl rounded-lg"></canvas>
        </div>

        <!-- HTML (sandboxed) -->
        <div v-else-if="renderMode === 'html'" class="h-full bg-white">
          <iframe :srcdoc="content" sandbox="allow-same-origin" class="w-full h-full border-0" title="HTML Preview"></iframe>
        </div>

        <!-- Markdown (fully self-styled — the @tailwindcss/typography `prose` plugin is not installed) -->
        <div v-else-if="renderMode === 'markdown'" class="p-6 sm:p-10 max-w-4xl mx-auto">
          <div class="fv-md" v-html="renderedMarkdown"></div>
        </div>

        <!-- CSV/TSV Table -->
        <div v-else-if="renderMode === 'csv'" class="p-4 overflow-auto">
          <div class="fv-bd rounded-xl border overflow-hidden">
            <table class="w-full text-xs text-left">
              <thead class="fv-bar sticky top-0 z-10">
                <tr>
                  <th v-for="(header, hi) in csvData.headers" :key="hi"
                    class="fv-muted fv-bd px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b whitespace-nowrap">
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in csvData.rows" :key="ri"
                  class="fv-bd border-b hover:bg-black/5 transition-colors"
                  :class="ri % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'">
                  <td v-for="(cell, ci) in row" :key="ci"
                    class="fv-text px-4 py-2 font-mono whitespace-nowrap">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-[10px] text-gray-600 mt-2 px-1">{{ csvData.rows.length }} rows × {{ csvData.headers.length }} columns</p>
        </div>

        <!-- JSON (pretty-printed & highlighted) -->
        <div v-else-if="renderMode === 'json'" class="absolute inset-0 overflow-auto">
          <pre class="p-4 sm:p-6 text-sm leading-relaxed"><code class="hljs language-json" v-html="highlightedContent"></code></pre>
        </div>

        <!-- Code (syntax-highlighted with line numbers) -->
        <div v-else-if="renderMode === 'code'" class="absolute inset-0 overflow-auto text-sm">
          <table class="border-collapse min-w-full">
            <tbody>
              <tr v-for="(line, i) in codeLines" :key="i" class="hover:bg-white/[0.03] transition-colors group">
                <td class="pl-4 pr-3 py-0 text-right select-none w-[1%] whitespace-nowrap sticky left-0 bg-[#1e1e2e] group-hover:bg-[#232336] z-[1]">
                  <span class="text-[11px] font-mono text-gray-600 tabular-nums leading-relaxed">{{ i + 1 }}</span>
                </td>
                <td class="px-4 py-0 whitespace-pre font-mono leading-relaxed"><code v-html="line"></code></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Binary / Unsupported -->
        <div v-else-if="renderMode === 'binary'" class="flex flex-col items-center justify-center h-full px-8 text-center gap-4">
          <div class="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
            {{ fileIcon }}
          </div>
          <div>
            <p class="text-lg font-bold text-gray-200">{{ fileName }}</p>
            <p class="text-sm text-gray-500 mt-1">This file type cannot be previewed in the browser</p>
            <p v-if="fileSize" class="text-xs text-gray-600 mt-1">{{ formatBytes(fileSize) }} · .{{ fileExt }}</p>
          </div>
          <button @click="downloadFile"
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/25">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Download File
          </button>
        </div>

        <!-- Plain text fallback -->
        <div v-else class="relative">
          <pre class="fv-body p-4 sm:p-6 font-mono text-sm leading-relaxed whitespace-pre">{{ content }}</pre>
        </div>
      </div>

      <!-- ═══ Footer ═══ -->
      <div class="fv-bar fv-muted px-4 py-2 border-t flex items-center justify-between text-[10px] shrink-0">
        <div class="flex items-center gap-3">
          <span v-if="renderMode" class="fv-chip px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">{{ renderMode }}</span>
          <span v-if="lineCount && renderMode === 'code'">{{ lineCount }} lines</span>
          <span v-if="content">{{ content.length.toLocaleString() }} chars</span>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="fileModified" :title="fileModified">{{ timeAgo(fileModified) }}</span>
          <span>Read-only</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import api from '../services/api';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark-dimmed.css';
import { marked } from 'marked';
import { useTheme } from '../composables/useTheme';

const { isDark } = useTheme();   // follow the app theme (light default; toggled via data-theme)

const props = defineProps({
  agentId: { type: [String, Number], default: null },
  systemId: { type: String, default: null },
  repoId: { type: String, default: null },
});

// ── State ──
const isOpen = ref(false);
const currentPath = ref('');
const content = ref('');
const loading = ref(false);
const error = ref('');
const downloading = ref(false);
const mediaUrl = ref('');
const fileModified = ref(null);
const fileSize = ref(0);
const activeAgentId = ref(null);
// URL-mode (WORKSPACE_* scoped files): when set, content/download go through this /api path (relative to the
// axios baseURL '/api') instead of the coding-agent (agentId, path) API. Empty string = coding-agent mode.
const urlDownloadPath = ref('');

// PDF state
const pdfCanvas = ref(null);
const pdfDoc = ref(null);
const pdfPage = ref(1);
const pdfPageCount = ref(0);

// File navigation state
const siblingFiles = ref([]); // flat list of {path, name, ...} entries (files only)

const currentFileIndex = computed(() => {
  if (!siblingFiles.value.length || !currentPath.value) return -1;
  return siblingFiles.value.findIndex(f => f.path === currentPath.value);
});

function goToFile(delta) {
  const idx = currentFileIndex.value + delta;
  if (idx < 0 || idx >= siblingFiles.value.length) return;
  const entry = siblingFiles.value[idx];
  open(entry, activeAgentId.value, siblingFiles.value);
}

// Keyboard navigation
function handleKeydown(e) {
  if (!isOpen.value) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); goToFile(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); goToFile(1); }
  else if (e.key === 'Escape') { e.preventDefault(); close(); }
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

// ── Extension Maps ──
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
const VIDEO_EXTS = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
const CODE_EXTS = {
  py: 'python', js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
  java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp', go: 'go', rs: 'rust', rb: 'ruby',
  php: 'php', swift: 'swift', kt: 'kotlin', scala: 'scala', r: 'r', lua: 'lua',
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash', ps1: 'powershell',
  sql: 'sql', graphql: 'graphql', yml: 'yaml', yaml: 'yaml', toml: 'ini',
  xml: 'xml', vue: 'xml', svelte: 'xml', css: 'css', scss: 'scss', less: 'less',
  dockerfile: 'dockerfile', makefile: 'makefile', cmake: 'cmake',
  tf: 'hcl', hcl: 'hcl', proto: 'protobuf', zig: 'zig', nim: 'nim',
  ex: 'elixir', exs: 'elixir', erl: 'erlang', hs: 'haskell', ml: 'ocaml',
  dart: 'dart', groovy: 'groovy', pl: 'perl', m: 'objectivec',
};
const BINARY_EXTS = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'db', 'sqlite'];

// ── Computed ──
const fileExt = computed(() => {
  const name = currentPath.value || '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
});

const fileName = computed(() => {
  const p = currentPath.value || 'Untitled';
  return p.split('/').pop();
});

const renderMode = computed(() => {
  const ext = fileExt.value;
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'csv' || ext === 'tsv') return 'csv';
  if (ext === 'json') return 'json';
  if (ext in CODE_EXTS) return 'code';
  if (BINARY_EXTS.includes(ext)) return 'binary';
  // Text-like files without known extension
  if (['txt', 'log', 'env', 'gitignore', 'editorconfig', 'ini', 'cfg', 'conf', 'properties'].includes(ext)) return 'code';
  // If we got text content, show as code
  if (content.value && typeof content.value === 'string') return 'code';
  return 'binary';
});

const languageLabel = computed(() => {
  const ext = fileExt.value;
  if (ext in CODE_EXTS) return CODE_EXTS[ext];
  if (['json', 'csv', 'tsv', 'md', 'html', 'htm', 'txt', 'log'].includes(ext)) return ext;
  return '';
});

const contentBg = computed(() => {
  const mode = renderMode.value;
  if (mode === 'image' || mode === 'video' || mode === 'pdf') return 'bg-[#11111b]';
  if (mode === 'html') return 'bg-white';
  if (mode === 'code' || mode === 'json') return 'fv-codepanel';   // dark editor surface (hljs theme)
  return 'fv-body';                                                 // markdown / csv / text — theme-aware
});

const fileIcon = computed(() => {
  const ext = fileExt.value;
  const mode = renderMode.value;
  if (mode === 'image') return '🖼️';
  if (mode === 'video') return '🎬';
  if (mode === 'pdf') return '📕';
  if (mode === 'html') return '🌐';
  if (mode === 'markdown') return '📝';
  if (mode === 'csv') return '📊';
  if (mode === 'json') return '{ }';
  if (ext === 'py') return '🐍';
  if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) return '⚡';
  if (['java', 'kt'].includes(ext)) return '☕';
  if (['rs'].includes(ext)) return '🦀';
  if (['go'].includes(ext)) return '🐹';
  if (['rb'].includes(ext)) return '💎';
  if (['sh', 'bash', 'zsh'].includes(ext)) return '🐚';
  if (['sql'].includes(ext)) return '🗃️';
  if (['yml', 'yaml', 'toml'].includes(ext)) return '⚙️';
  if (['docx', 'doc'].includes(ext)) return '📘';
  if (['xlsx', 'xls'].includes(ext)) return '📗';
  if (['zip', 'tar', 'gz', 'rar'].includes(ext)) return '📦';
  return '📄';
});

const lineCount = computed(() => content.value ? content.value.split('\n').length : 0);

// ── Code Highlighting ──
const highlightedCode = computed(() => {
  if (!content.value) return '';
  const ext = fileExt.value;
  const lang = CODE_EXTS[ext];
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(content.value, { language: lang }).value;
    }
    return hljs.highlightAuto(content.value).value;
  } catch {
    return escapeHtml(content.value);
  }
});

const codeLines = computed(() => highlightedCode.value.split('\n'));

const highlightedContent = computed(() => {
  if (!content.value) return '';
  try {
    const pretty = JSON.stringify(JSON.parse(content.value), null, 2);
    return hljs.highlight(pretty, { language: 'json' }).value;
  } catch {
    return escapeHtml(content.value);
  }
});

// ── Markdown ──
const renderedMarkdown = computed(() => {
  if (!content.value) return '';
  try {
    return marked(content.value);
  } catch {
    return `<pre>${escapeHtml(content.value)}</pre>`;
  }
});

// ── CSV ──
const csvData = computed(() => {
  if (!content.value) return { headers: [], rows: [] };
  const delim = fileExt.value === 'tsv' ? '\t' : ',';
  const lines = content.value.split('\n').filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0], delim);
  const rows = lines.slice(1).map(l => parseCsvLine(l, delim));
  return { headers, rows };
});

// ── Utilities ──
const resolvedAgentId = () => activeAgentId.value || props.agentId;

function parseCsvLine(line, delim) {
  const fields = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === delim && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const timeAgo = (ts) => {
  if (!ts) return '';
  const date = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
};

// ── PDF Rendering ──
async function loadPdf(blob) {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    const arrayBuffer = await blob.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    pdfDoc.value = doc;
    pdfPageCount.value = doc.numPages;
    pdfPage.value = 1;
    await nextTick();
    renderPdfPage();
  } catch (e) {
    console.error('PDF load failed:', e);
    error.value = 'Failed to render PDF: ' + e.message;
  }
}

async function renderPdfPage() {
  if (!pdfDoc.value || !pdfCanvas.value) return;
  try {
    const page = await pdfDoc.value.getPage(pdfPage.value);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = pdfCanvas.value;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = Math.min(viewport.width / scale, 800) + 'px';
    canvas.style.height = 'auto';
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
  } catch (e) {
    console.error('PDF page render failed:', e);
  }
}

watch(pdfPage, async () => {
  await nextTick();
  renderPdfPage();
});

// ── Main Open/Close ──
const open = async (pathOrEntry, agentId = null, siblings = null) => {
  const entry = typeof pathOrEntry === 'string' ? { path: pathOrEntry } : pathOrEntry;
  if (agentId) activeAgentId.value = agentId;
  if (siblings) siblingFiles.value = siblings;
  isOpen.value = true;
  urlDownloadPath.value = '';   // coding-agent mode (fetch by agentId + path)
  currentPath.value = entry.path || entry;
  content.value = '';
  error.value = '';
  if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value);
  mediaUrl.value = '';
  loading.value = true;
  fileModified.value = entry.modified || null;
  fileSize.value = entry.size || 0;
  pdfDoc.value = null;
  pdfPageCount.value = 0;
  pdfPage.value = 1;

  const aid = resolvedAgentId();
  const ext = fileExt.value;

  try {
    // Binary media: fetch as blob
    if (IMAGE_EXTS.includes(ext) || VIDEO_EXTS.includes(ext)) {
      if (aid) {
        const res = await api.downloadWorkspaceFile(aid, currentPath.value);
        mediaUrl.value = URL.createObjectURL(res.data);
      }
    }
    // PDF: fetch blob and render
    else if (ext === 'pdf') {
      if (aid) {
        const res = await api.downloadWorkspaceFile(aid, currentPath.value);
        await loadPdf(res.data);
      }
    }
    // Binary files: no content, just info card
    else if (BINARY_EXTS.includes(ext)) {
      // No content to load — binary card will show
    }
    // Text files: fetch content
    else if (aid) {
      const res = await api.readWorkspaceFile(aid, currentPath.value);
      content.value = res.data.content || res.data;
    } else if (props.systemId && props.repoId) {
      const res = await api.getFileContent(props.systemId, props.repoId, currentPath.value);
      content.value = res.data.content || res.data;
    } else {
      throw new Error('Cannot view files: No active context.');
    }
  } catch (e) {
    console.error('Failed to load file:', e);
    error.value = e.response?.data?.error || e.message || 'Failed to load file';
  } finally {
    loading.value = false;
  }
};

// Open a WORKSPACE_* scoped file (agent working-memory file) straight from its served URL — no agentId
// needed. Reuses every render mode (markdown/code/json/csv/pdf/image/binary) via the filename's extension.
// `file` = { path|name, view_url, download_url, size } as emitted in tool metadata.workspace_file.
const openUrl = async (file) => {
  const f = file || {};
  isOpen.value = true;
  activeAgentId.value = null;
  siblingFiles.value = [];
  currentPath.value = f.path || f.name || 'file';   // drives fileExt / renderMode / fileName
  content.value = '';
  error.value = '';
  if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value);
  mediaUrl.value = '';
  loading.value = true;
  fileModified.value = f.updated_at || null;
  fileSize.value = f.size || 0;
  pdfDoc.value = null;
  pdfPageCount.value = 0;
  pdfPage.value = 1;

  // Card URLs already carry the '/api' prefix; the axios instance also prefixes baseURL '/api', so strip it.
  const viewPath = (f.view_url || f.download_url || '').replace(/^\/api/, '');
  urlDownloadPath.value = (f.download_url || f.view_url || '').replace(/^\/api/, '').replace(/\?inline=1$/, '');
  const ext = fileExt.value;
  try {
    if (!viewPath) throw new Error('This file has no download URL.');
    if (IMAGE_EXTS.includes(ext) || VIDEO_EXTS.includes(ext)) {
      const res = await api.get(viewPath, { responseType: 'blob' });
      mediaUrl.value = URL.createObjectURL(res.data);
    } else if (ext === 'pdf') {
      const res = await api.get(viewPath, { responseType: 'blob' });
      await loadPdf(res.data);
    } else if (BINARY_EXTS.includes(ext)) {
      // binary card — no inline content, Download only
    } else {
      const res = await api.get(viewPath, { responseType: 'text' });
      content.value = typeof res.data === 'string' ? res.data : (res.data?.content ?? '');
    }
  } catch (e) {
    console.error('Failed to load workspace file:', e);
    error.value = e.response?.data?.error || e.message || 'Failed to load file';
  } finally {
    loading.value = false;
  }
};

const downloadFile = async () => {
  downloading.value = true;
  try {
    let blob;
    if (urlDownloadPath.value) {
      const res = await api.get(urlDownloadPath.value, { responseType: 'blob' });
      blob = res.data;
    } else {
      const aid = resolvedAgentId();
      if (!aid) return;
      const res = await api.downloadWorkspaceFile(aid, currentPath.value);
      blob = res.data;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.value;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Download failed:', e);
  } finally {
    downloading.value = false;
  }
};

const close = () => {
  if (mediaUrl.value) URL.revokeObjectURL(mediaUrl.value);
  pdfDoc.value = null;
  isOpen.value = false;
};

defineExpose({ open, openUrl, close });
</script>

<style scoped>
:deep(.hljs) { background: transparent !important; }

/* ── Theme tokens — the modal follows the app theme (useTheme → data-theme; light by default) ── */
.fv-light {
  --fv-panel:#ffffff; --fv-bar:#f8fafc; --fv-body:#ffffff;
  --fv-text:#1f2937; --fv-strong:#0f172a; --fv-muted:#64748b;
  --fv-border:rgba(15,23,42,.12); --fv-hover:rgba(15,23,42,.06); --fv-divider:rgba(15,23,42,.12);
  --fv-code-bg:#eef2f7; --fv-fence-bg:#f6f8fa; --fv-fence-text:#1f2937;
}
.fv-dark {
  --fv-panel:#1e1e2e; --fv-bar:#181825; --fv-body:#1e1e2e;
  --fv-text:#e5e7eb; --fv-strong:#f3f4f6; --fv-muted:#9aa0aa;
  --fv-border:rgba(255,255,255,.10); --fv-hover:rgba(255,255,255,.10); --fv-divider:rgba(255,255,255,.10);
  --fv-code-bg:rgba(255,255,255,.06); --fv-fence-bg:#11111b; --fv-fence-text:#e5e7eb;
}

/* ── Surfaces ── */
.fv-root { background:var(--fv-panel); color:var(--fv-text); border:1px solid var(--fv-border); }
.fv-bar { background:var(--fv-bar); border-color:var(--fv-border); }
.fv-body { background:var(--fv-body); color:var(--fv-text); }
.fv-codepanel { background:#1e1e2e; color:#e5e7eb; }   /* code / JSON: always a dark editor surface (hljs theme) */
.fv-strong { color:var(--fv-strong); }
.fv-muted { color:var(--fv-muted); }
.fv-bd { border-color:var(--fv-border) !important; }
.fv-divider { background:var(--fv-divider); }
.fv-chip { background:var(--fv-hover); color:var(--fv-muted); }
.fv-iconbtn { color:var(--fv-muted); border-radius:.5rem; padding:.375rem; transition:color .15s, background .15s; }
.fv-iconbtn:hover:not(:disabled) { color:var(--fv-strong); background:var(--fv-hover); }
.fv-accent { background:rgba(59,130,246,.14); color:#2563eb; }
.fv-dark .fv-accent { color:#93c5fd; }
.fv-accent-btn { background:rgba(59,130,246,.14); color:#2563eb; border:1px solid rgba(59,130,246,.28); }
.fv-accent-btn:hover:not(:disabled) { background:rgba(59,130,246,.22); }
.fv-dark .fv-accent-btn { color:#93c5fd; }

/* ── Markdown (rendered from v-html → descendants need :deep; the `prose` plugin isn't installed) ── */
.fv-md { color:var(--fv-text); font-size:.92rem; line-height:1.7; word-wrap:break-word; }
.fv-md :deep(:is(h1,h2,h3,h4,h5,h6)) { color:var(--fv-strong); font-weight:700; line-height:1.3; margin:1.3em 0 .5em; }
.fv-md :deep(h1) { font-size:1.6em; }
.fv-md :deep(h2) { font-size:1.35em; }
.fv-md :deep(h3) { font-size:1.15em; }
.fv-md :deep(p) { margin:.7em 0; }
.fv-md :deep(a) { color:#3b82f6; text-decoration:underline; text-underline-offset:2px; }
.fv-md :deep(:is(ul,ol)) { margin:.7em 0; padding-left:1.5em; }
.fv-md :deep(li) { margin:.3em 0; }
.fv-md :deep(strong) { color:var(--fv-strong); font-weight:700; }
.fv-md :deep(code) { background:var(--fv-code-bg); padding:.12em .4em; border-radius:.35em; font-size:.86em;
  font-family:ui-monospace,"Cascadia Code",Consolas,monospace; }
.fv-md :deep(pre) { background:var(--fv-fence-bg); color:var(--fv-fence-text); padding:1em 1.1em;
  border-radius:.6em; overflow-x:auto; border:1px solid var(--fv-border); margin:.9em 0; }
.fv-md :deep(pre code) { background:transparent; padding:0; font-size:.85em; }
.fv-md :deep(blockquote) { border-left:3px solid #3b82f6; margin:.9em 0; padding:.1em 0 .1em 1em; color:var(--fv-muted); }
.fv-md :deep(table) { border-collapse:collapse; margin:.9em 0; width:100%; display:block; overflow-x:auto; }
.fv-md :deep(:is(th,td)) { border:1px solid var(--fv-border); padding:.45em .75em; text-align:left; }
.fv-md :deep(th) { color:var(--fv-strong); font-weight:700; }
.fv-md :deep(hr) { border:0; border-top:1px solid var(--fv-border); margin:1.3em 0; }
.fv-md :deep(img) { max-width:100%; border-radius:.4em; }
</style>
