<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm" @click.self="close">
    <div class="bg-[#1e1e2e] rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden border border-white/10">

      <!-- ═══ Header ═══ -->
      <div class="flex items-center justify-between px-4 py-2.5 bg-[#181825] border-b border-white/10 shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="text-lg flex-shrink-0">{{ fileIcon }}</span>
          <div class="min-w-0">
            <h3 class="text-sm font-bold text-gray-100 truncate">{{ fileName }}</h3>
            <div class="flex items-center gap-2 text-[10px] text-gray-500">
              <span v-if="languageLabel" class="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono uppercase tracking-wide">{{ languageLabel }}</span>
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
              class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
              title="Previous file (←)">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <span class="text-[10px] text-gray-500 font-mono tabular-nums min-w-[3ch] text-center">{{ currentFileIndex + 1 }}/{{ siblingFiles.length }}</span>
            <button @click="goToFile(1)" :disabled="currentFileIndex >= siblingFiles.length - 1"
              class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
              title="Next file (→)">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
            <div class="w-px h-5 bg-white/10 mx-1"></div>
          </template>
          <!-- PDF page nav -->
          <template v-if="renderMode === 'pdf' && pdfPageCount > 1">
            <button @click="pdfPage = Math.max(1, pdfPage - 1)" :disabled="pdfPage <= 1"
              class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <span class="text-xs text-gray-400 font-mono tabular-nums">{{ pdfPage }}/{{ pdfPageCount }}</span>
            <button @click="pdfPage = Math.min(pdfPageCount, pdfPage + 1)" :disabled="pdfPage >= pdfPageCount"
              class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-30">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
            <div class="w-px h-5 bg-white/10 mx-1"></div>
          </template>
          <!-- Download -->
          <button @click="downloadFile" :disabled="downloading"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition border border-blue-500/20">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            {{ downloading ? '...' : 'Download' }}
          </button>
          <!-- Close -->
          <button @click="close" class="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition">
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

        <!-- Markdown -->
        <div v-else-if="renderMode === 'markdown'" class="p-6 sm:p-10 bg-[#1e1e2e] max-w-4xl mx-auto">
          <div class="prose prose-invert prose-sm max-w-none prose-headings:text-gray-100 prose-p:text-gray-300 prose-a:text-blue-400 prose-code:text-pink-300 prose-code:bg-white/5 prose-pre:bg-[#11111b] prose-pre:border prose-pre:border-white/5 prose-strong:text-gray-200 prose-blockquote:border-blue-500/50 prose-blockquote:text-gray-400 prose-table:text-gray-300 prose-th:text-gray-200 prose-td:border-white/10 prose-th:border-white/10"
            v-html="renderedMarkdown"></div>
        </div>

        <!-- CSV/TSV Table -->
        <div v-else-if="renderMode === 'csv'" class="p-4 overflow-auto">
          <div class="rounded-xl border border-white/10 overflow-hidden">
            <table class="w-full text-xs text-left">
              <thead class="bg-[#181825] sticky top-0 z-10">
                <tr>
                  <th v-for="(header, hi) in csvData.headers" :key="hi"
                    class="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-white/10 whitespace-nowrap">
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in csvData.rows" :key="ri"
                  class="border-b border-white/5 hover:bg-white/5 transition-colors"
                  :class="ri % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'">
                  <td v-for="(cell, ci) in row" :key="ci"
                    class="px-4 py-2 text-gray-300 font-mono whitespace-nowrap">{{ cell }}</td>
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
          <pre class="p-4 sm:p-6 font-mono text-sm text-gray-300 leading-relaxed whitespace-pre">{{ content }}</pre>
        </div>
      </div>

      <!-- ═══ Footer ═══ -->
      <div class="px-4 py-2 bg-[#181825] border-t border-white/10 flex items-center justify-between text-[10px] text-gray-600 shrink-0">
        <div class="flex items-center gap-3">
          <span v-if="renderMode" class="px-1.5 py-0.5 rounded bg-white/5 text-gray-500 uppercase tracking-wider font-bold">{{ renderMode }}</span>
          <span v-if="lineCount && renderMode === 'code'">{{ lineCount }} lines</span>
          <span v-if="content">{{ content.length.toLocaleString() }} chars</span>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="fileModified" :title="fileModified">{{ timeAgo(fileModified) }}</span>
          <span class="text-gray-700">Read-only</span>
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
  return 'bg-[#1e1e2e]';
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

const downloadFile = async () => {
  const aid = resolvedAgentId();
  if (!aid) return;
  downloading.value = true;
  try {
    const res = await api.downloadWorkspaceFile(aid, currentPath.value);
    const url = URL.createObjectURL(res.data);
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

defineExpose({ open, close });
</script>

<style scoped>
/* Scrollbar styling for dark theme */
:deep(.hljs) {
  background: transparent !important;
}
</style>
