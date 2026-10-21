<script setup>
// Upload examples (the Upload page's LLM form, plan §2.1): JSONL in OpenAI's chat format, Alpaca or ShareGPT, a JSON
// array, CSV with its columns chosen, or documents (text, Markdown, HTML, PDF, Word). One outcome per file, with every
// bad line's number and reason. Backend: llm/app_api.py chat_upload.
import { computed, ref } from 'vue';
import { Upload, FileText, Check, X, CloudUpload, MessageSquare, Table2, ArrowRight, LoaderCircle } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { llmApi, csvHeader, csvColumns } from '../api/llm.js';
import './llm.css';

const props = defineProps({ project: Object });
const emit = defineEmits(['navigate']);
const ACCEPT = '.jsonl,.json,.ndjson,.csv,.txt,.md,.markdown,.html,.htm,.pdf,.docx';
const MAX_FILES = 20;

const may = computed(() => (props.project?.rights || []).includes('upload'));
const files = ref([]); const header = ref([]); const mode = ref('conversation');
const chosen = ref({ user: '', assistant: '', system: '', group: '', translate_from: '', translate_to: '', from_language: '', to_language: '' });
const busy = ref(false); const error = ref(''); const results = ref(null); const refused = ref('');
const hasCsv = computed(() => files.value.some(f => f.name.toLowerCase().endsWith('.csv')));

const fileInput = ref(null);
const dragging = ref(false);
let selectionVersion = 0;
const totalSize = computed(() => formatSize(files.value.reduce((sum, file) => sum + file.size, 0)));
function formatSize(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}
async function selectFiles(incoming) {
  if (busy.value || !may.value) return;
  const version = ++selectionVersion;
  error.value = ''; results.value = null;
  const next = [...files.value];
  let unsupported = false;
  for (const file of incoming) {
    if (!ACCEPT.split(',').some(extension => file.name.toLowerCase().endsWith(extension))) { unsupported = true; continue; }
    if (!next.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) next.push(file);
  }
  files.value = next.slice(0, MAX_FILES);
  if (next.length > MAX_FILES) error.value = `Upload at most ${MAX_FILES} files at once; the first ${MAX_FILES} are kept.`;
  else if (unsupported) error.value = 'Some files were skipped. Choose one of the supported formats below.';
  header.value = [];
  const csv = files.value.find(file => file.name.toLowerCase().endsWith('.csv'));
  try {
    const columns = csv ? csvHeader(await csv.slice(0, 65536).text()) : [];
    if (version === selectionVersion) header.value = columns;
  } catch {
    if (version === selectionVersion) error.value = 'The CSV file could not be read. Remove it and try again.';
  }
}
function pick(event) {
  void selectFiles(Array.from(event.target.files || []));
  event.target.value = '';
}
function drop(event) {
  dragging.value = false;
  void selectFiles(Array.from(event.dataTransfer?.files || []));
}
function removeFile(index) {
  if (busy.value) return;
  files.value.splice(index, 1);
  void selectFiles([]);
}

function csvReady() {
  if (!hasCsv.value) return '';
  const c = chosen.value;
  if (mode.value === 'translation') return c.translate_from && c.translate_to && c.from_language.trim() && c.to_language.trim() ? '' : 'Choose both columns and name both languages.';
  if (!c.user || !c.assistant) return 'Choose the column of the user message and of the answer.';
  return c.user === c.assistant ? 'The user message and the answer must be two different columns.' : '';
}

async function send() {
  if (busy.value || !may.value) return;
  const why = files.value.length ? csvReady() : 'Choose at least one file.';
  if (why) { error.value = why; return; }
  busy.value = true; error.value = '';
  try {
    const answer = await llmApi.upload(props.project.ref, files.value, hasCsv.value ? csvColumns(mode.value, chosen.value) : null);
    results.value = answer.results; refused.value = answer.training_refused || '';
    files.value = []; header.value = [];   // sent: the next upload holds only what is chosen next (found 2026-10-21: 24 duplicates)
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <div class="studio llm-upload">
    <section v-if="!may" class="panel empty-state"><Upload :size="30" /><h2>Upload examples</h2><p>Your role in this project does not upload data.</p></section>
    <template v-else>
      <section class="panel upload-panel" :aria-busy="busy">
        <header class="upload-heading">
          <div class="upload-heading-icon"><CloudUpload :size="24" /></div>
          <div><div class="eyebrow">BUILD YOUR DATASET</div><h2>Great models start with great data</h2><p>Add conversations, question-and-answer pairs, or documents to your training dataset.</p></div>
        </header>
        <div class="upload-layout">
          <div class="upload-main">
            <div class="upload-dropzone" :class="{ 'is-dragging': dragging, 'is-busy': busy }"
              @dragover.prevent="dragging = !busy" @dragleave.prevent="dragging = false" @drop.prevent="drop">
              <span class="upload-cloud"><CloudUpload :size="32" :stroke-width="1.5" /></span>
              <h3>{{ dragging ? 'Drop your files here' : 'Drag & drop your training files' }}</h3>
              <p>or browse your computer to get started</p>
              <input ref="fileInput" class="upload-input" aria-label="Choose training files" type="file" multiple :accept="ACCEPT" :disabled="busy" @change="pick">
              <UiButton :disabled="busy" @click="fileInput?.click()"><Upload :size="16" /> Browse files</UiButton>
              <span class="upload-limit">Up to {{ MAX_FILES }} files per upload</span>
            </div>
            <div v-if="files.length" class="upload-queue">
              <div class="queue-heading"><strong>Selected files <span>{{ files.length }}/{{ MAX_FILES }}</span></strong><span>{{ totalSize }} total</span></div>
              <ul class="llm-file-list"><li v-for="(f, index) in files" :key="`${f.name}-${f.size}-${f.lastModified}`">
                <span class="file-icon"><FileText :size="19" /></span><div class="file-info"><strong>{{ f.name }}</strong><span>{{ formatSize(f.size) }}</span></div>
                <button class="remove-file" type="button" :disabled="busy" :aria-label="`Remove ${f.name}`" @click="removeFile(index)"><X :size="17" /></button>
              </li></ul>
            </div>
          </div>
          <aside class="upload-guide" aria-label="Supported file formats">
            <h3>Bring your data in any format</h3><p>Choose what you already have.</p>
            <div class="format-card"><MessageSquare :size="19" /><div><strong>Conversations</strong><p>Chat, instruction & preference examples</p><span>JSONL / JSON / NDJSON</span></div></div>
            <div class="format-card"><Table2 :size="19" /><div><strong>Questions & answers</strong><p>Map your columns after selecting a file</p><span>CSV</span></div></div>
            <div class="format-card"><FileText :size="19" /><div><strong>Documents</strong><p>Knowledge, guides & reference material</p><span>TXT / Markdown / HTML / PDF / DOCX</span></div></div>
            <details class="upload-details"><summary>Conversation format details</summary><p>OpenAI chat (messages), Alpaca (instruction, output), ShareGPT (conversations), and preference pairs (chosen, rejected). Use one example per JSONL line or a JSON array.</p></details>
          </aside>
        </div>
        <fieldset v-if="hasCsv" class="llm-columns" :disabled="busy">
          <legend>CSV columns</legend>
          <div class="studio-tabs"><button type="button" :class="{active: mode==='conversation'}" @click="mode='conversation'">Question and answer</button><button type="button" :class="{active: mode==='translation'}" @click="mode='translation'">Two languages</button></div>
          <p v-if="!header.length" class="field-help">The CSV file's first line names its columns; none were found.</p>
          <div v-else-if="mode==='conversation'" class="llm-column-grid">
            <label class="field-label">User message<select v-model="chosen.user" class="text-input"><option value="">Choose…</option><option v-for="h in header" :key="h">{{ h }}</option></select></label>
            <label class="field-label">Answer<select v-model="chosen.assistant" class="text-input"><option value="">Choose…</option><option v-for="h in header" :key="h">{{ h }}</option></select></label>
            <label class="field-label">System message (optional)<select v-model="chosen.system" class="text-input"><option value="">None</option><option v-for="h in header" :key="h">{{ h }}</option></select></label>
            <label class="field-label">Conversation id (optional)<select v-model="chosen.group" class="text-input"><option value="">None</option><option v-for="h in header" :key="h">{{ h }}</option></select></label>
          </div>
          <div v-else class="llm-column-grid">
            <label class="field-label">Text column<select v-model="chosen.translate_from" class="text-input"><option value="">Choose…</option><option v-for="h in header" :key="h">{{ h }}</option></select></label>
            <label class="field-label">Its language<input v-model="chosen.from_language" class="text-input" maxlength="40" placeholder="e.g. English"></label>
            <label class="field-label">Translation column<select v-model="chosen.translate_to" class="text-input"><option value="">Choose…</option><option v-for="h in header" :key="h">{{ h }}</option></select></label>
            <label class="field-label">Its language<input v-model="chosen.to_language" class="text-input" maxlength="40" placeholder="e.g. Urdu"></label>
          </div>
        </fieldset>
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <footer class="upload-footer">
          <p role="status" aria-live="polite">{{ busy ? 'Uploading and processing your files...' : files.length ? `${files.length} file${files.length === 1 ? '' : 's'} ready to upload` : 'Select your files to continue' }}<span>Review per-file results after upload.</span></p>
          <UiButton variant="primary" :disabled="busy || !files.length" @click="send"><component :is="busy ? LoaderCircle : Upload" :size="16" :class="{ spinning: busy }" /> {{ busy ? 'Uploading...' : 'Upload data' }}<ArrowRight v-if="!busy" :size="16" /></UiButton>
        </footer>
      </section>

      <section v-if="results" class="panel">
        <h2>What was added</h2>
        <p v-if="refused" class="notice" role="status">{{ refused }}</p>
        <article v-for="r in results" :key="r.name" class="llm-result">
          <header><component :is="r.state==='added' ? Check : X" :size="16" /> <strong>{{ r.name }}</strong> <UiBadge :tone="r.state==='added' ? 'green' : 'neutral'">{{ r.state==='added' ? `${r.made} example${r.made===1?'':'s'}` : 'Not added' }}</UiBadge> <UiBadge v-if="r.duplicate">Uploaded before</UiBadge></header>
          <p v-if="r.reason" class="field-help">{{ r.reason }}</p>
          <details v-if="r.bad_lines?.length"><summary>{{ r.bad_line_count || r.bad_lines.length }} line{{ (r.bad_line_count || r.bad_lines.length)===1?'':'s' }} could not be used</summary>
            <table class="llm-table"><thead><tr><th>Line</th><th>Why</th></tr></thead><tbody><tr v-for="b in r.bad_lines" :key="b.line"><td>{{ b.line }}</td><td>{{ b.reason }}</td></tr></tbody></table>
            <p v-if="r.bad_line_count > r.bad_lines.length" class="field-help">The first {{ r.bad_lines.length }} are listed.</p>
          </details>
        </article>
        <UiButton @click="emit('navigate', 'dataset')">See the examples</UiButton>
      </section>
    </template>
  </div>
</template>

<style scoped>
.llm-upload{display:grid;gap:20px}
.upload-panel{overflow:hidden}
.upload-heading{display:flex;align-items:flex-start;gap:16px;margin-bottom:28px}
.upload-heading-icon{display:grid;place-items:center;flex-shrink:0;width:48px;height:48px;border:1px solid #dbe5ff;border-radius:14px;background:#eff4ff;color:#315eec}
.upload-heading h2{margin:6px 0 8px;font-size:23px;letter-spacing:-.6px;line-height:1.3}
.upload-heading p{margin:0;color:#64748b;font-size:14px;line-height:1.6}
.upload-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(260px,1fr);gap:32px}
.upload-main{min-width:0}
.upload-dropzone{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;padding:32px 20px;border:1.5px dashed #bdccef;border-radius:16px;background:linear-gradient(145deg,#f8faff,#f4f7ff);text-align:center;transition:background .15s,border-color .15s}
.upload-dropzone.is-dragging{border-color:#315eec;background:#eaf0ff}
.upload-dropzone.is-busy{opacity:.7}
.upload-cloud{display:grid;place-items:center;width:68px;height:68px;border:1px solid #e1e8fc;background:white;box-shadow:0 5px 16px #244db00a;border-radius:20px;color:#4267e9;margin-bottom:20px}
.upload-dropzone h3{font-size:17px;letter-spacing:-.3px;margin:0 0 6px;color:#17243c}
.upload-dropzone p{font-size:13px;color:#64748b;margin:0 0 20px}
.upload-limit{font-size:12px;color:#64748b;margin-top:14px}
.upload-input{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.upload-dropzone:focus-within{outline:2px solid #315eec;outline-offset:4px}
.upload-guide h3{font-size:14px;margin:2px 0 6px;color:#24324b}
.upload-guide>p{font-size:13px;margin:0 0 20px;color:#64748b}
.format-card{display:flex;gap:12px;margin:0 0 18px;color:#61769c}
.format-card>svg{flex-shrink:0;margin-top:2px}
.format-card strong{font-size:13px;color:#283750;font-weight:600}
.format-card p{font-size:12px;line-height:1.5;margin:4px 0 6px;color:#64748b}
.format-card span{font-size:10px;font-weight:600;letter-spacing:.3px;color:#536b9b}
.upload-details{font-size:12px;color:#64748b;line-height:1.6}
.upload-details summary{cursor:pointer;color:#4261a0}
.upload-details p{font-size:12px}
.upload-queue{margin-top:20px}
.queue-heading{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#64748b;margin-bottom:10px}
.queue-heading strong{color:#334155}.queue-heading strong span{font-weight:400;margin-left:6px;color:#64748b}
.llm-file-list{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.llm-file-list li{display:flex;align-items:center;gap:12px;border:1px solid #e5eaf3;border-radius:10px;padding:12px}
.file-icon{display:grid;place-items:center;width:36px;height:40px;border-radius:8px;background:#eff4ff;color:#5274d6;flex-shrink:0}
.file-info{display:grid;gap:4px;min-width:0;flex:1}.file-info strong{font-size:13px;font-weight:500;overflow-wrap:anywhere}.file-info span{font-size:11px;color:#64748b}
.remove-file{display:grid;place-items:center;border:0;border-radius:6px;background:transparent;color:#64748b;padding:6px;cursor:pointer}.remove-file:hover{background:#f1f5f9}.remove-file:disabled{opacity:.4;cursor:default}
.upload-footer{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:28px;padding-top:22px;border-top:1px solid #edf0f6}
.upload-footer p{margin:0;font-size:13px;color:#475569;line-height:1.6}.upload-footer p span{display:block;color:#8090a8;font-size:12px}
.upload-footer .button{flex-shrink:0}
.spinning{animation:upload-spin 1s linear infinite}@keyframes upload-spin{to{transform:rotate(360deg)}}
@media(max-width:1000px){.upload-layout{grid-template-columns:1fr}.upload-guide{padding-top:4px}.upload-heading h2{font-size:21px}}
@media(max-width:550px){.upload-heading-icon{display:none}.upload-footer{align-items:stretch;flex-direction:column}.upload-dropzone{min-height:270px;padding:24px 12px}.upload-heading h2{font-size:20px}}
@media(prefers-reduced-motion:reduce){.spinning{animation:none}.upload-dropzone{transition:none}}
.llm-columns{border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:12px 0}
.llm-columns legend{font-weight:600;padding:0 6px}
.llm-column-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:10px}
.llm-result{border-top:1px solid #f1f5f9;padding:10px 0}
.llm-result header{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.llm-result .llm-table{margin-top:8px}
</style>
