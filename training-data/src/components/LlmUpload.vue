<script setup>
// Upload examples (the Upload page's LLM form, plan §2.1): JSONL in OpenAI's chat format, Alpaca or ShareGPT, a JSON
// array, CSV with its columns chosen, or documents (text, Markdown, HTML, PDF, Word). One outcome per file, with every
// bad line's number and reason. Backend: llm/app_api.py chat_upload.
import { computed, ref } from 'vue';
import { Upload, FileText, Check, X } from 'lucide-vue-next';
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

async function pick(event) {
  error.value = ''; results.value = null;
  files.value = Array.from(event.target.files || []).slice(0, MAX_FILES);
  if (event.target.files?.length > MAX_FILES) error.value = `Upload at most ${MAX_FILES} files at once; the first ${MAX_FILES} are kept.`;
  const csv = files.value.find(f => f.name.toLowerCase().endsWith('.csv'));
  header.value = csv ? csvHeader(await csv.slice(0, 65536).text()) : [];
}

function csvReady() {
  if (!hasCsv.value) return '';
  const c = chosen.value;
  if (mode.value === 'translation') return c.translate_from && c.translate_to && c.from_language.trim() && c.to_language.trim() ? '' : 'Choose both columns and name both languages.';
  if (!c.user || !c.assistant) return 'Choose the column of the user message and of the answer.';
  return c.user === c.assistant ? 'The user message and the answer must be two different columns.' : '';
}

async function send() {
  const why = files.value.length ? csvReady() : 'Choose at least one file.';
  if (why) { error.value = why; return; }
  busy.value = true; error.value = '';
  try {
    const answer = await llmApi.upload(props.project.ref, files.value, hasCsv.value ? csvColumns(mode.value, chosen.value) : null);
    results.value = answer.results; refused.value = answer.training_refused || '';
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <div class="studio llm-upload">
    <section v-if="!may" class="panel empty-state"><Upload :size="30" /><h2>Upload examples</h2><p>Your role in this project does not upload data.</p></section>
    <template v-else>
      <section class="panel">
        <div class="eyebrow">UPLOAD EXAMPLES</div>
        <h2>Add conversations, questions and answers, or documents</h2>
        <p>JSONL lines in OpenAI's chat format (<code>messages</code>), Alpaca (<code>instruction</code>, <code>output</code>) or ShareGPT (<code>conversations</code>); preference lines (<code>chosen</code> and <code>rejected</code>); a JSON array of the same; CSV with its columns chosen below; or documents: text, Markdown, HTML, PDF and Word. Every line becomes one example; a line that cannot be used is reported with its number.</p>
        <label class="field-label">Files (up to {{ MAX_FILES }})<input class="text-input" type="file" multiple :accept="ACCEPT" @change="pick"></label>
        <ul v-if="files.length" class="llm-file-list"><li v-for="f in files" :key="f.name"><FileText :size="14" /> {{ f.name }} <span class="field-help">{{ (f.size / 1024).toFixed(1) }} KB</span></li></ul>
        <fieldset v-if="hasCsv" class="llm-columns">
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
        <UiButton variant="primary" :disabled="busy || !files.length" @click="send"><Upload :size="15" /> {{ busy ? 'Uploading…' : 'Upload' }}</UiButton>
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
.llm-file-list{list-style:none;padding:0;margin:8px 0;display:grid;gap:4px;font-size:13px}
.llm-columns{border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:12px 0}
.llm-columns legend{font-weight:600;padding:0 6px}
.llm-column-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:10px}
.llm-result{border-top:1px solid #f1f5f9;padding:10px 0}
.llm-result header{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.llm-result .llm-table{margin-top:8px}
</style>
