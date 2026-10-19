<script setup>
// The versions page's LLM form (plan §2.1): conversation dataset versions (one JSONL file per split, the manifest's
// sha256, counts per kind and split), what publishing the newest preparation run would hold now, and "Publish".
// Backend: llm/app_api.py chat_datasets, llm/datasets.py.
import { computed, onMounted, ref } from 'vue';
import { Layers, RefreshCw } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { llmApi, KIND_LABEL, SPLIT_LABEL } from '../api/llm.js';
import { ago } from '../api/training.js';

const props = defineProps({ project: Object });
const emit = defineEmits(['navigate']);
const may = computed(() => (props.project?.rights || []).includes('batch'));
const data = ref(null); const error = ref(''); const told = ref(''); const busy = ref(false); const title = ref('');
const words = counts => Object.entries(counts || {}).map(([k, n]) => `${KIND_LABEL[k] || SPLIT_LABEL[k] || k} ${n}`).join(' · ');

async function load() {
  error.value = '';
  try { data.value = await llmApi.datasets(props.project.ref); } catch (e) { error.value = e.message; }
}
async function publish() {
  busy.value = true; error.value = ''; told.value = '';
  try { const v = await llmApi.publish(props.project.ref, { title: title.value }); told.value = `${v.name} is published: ${v.examples} examples.`; title.value = ''; await load(); }
  catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
onMounted(load);
</script>

<template>
  <div class="studio llm-versions">
    <div class="studio-actions"><p>A version freezes the examples a preparation run kept, as it prepared them: one file per split, and a manifest whose sha256 names it for ever.</p><UiButton @click="load"><RefreshCw :size="15" /> Refresh</UiButton></div>
    <div v-if="told" class="notice" role="status"><span>{{ told }}</span></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <section v-if="data" class="panel">
      <div class="eyebrow">NEXT VERSION</div>
      <template v-if="data.preview">
        <h2>From preparation run {{ data.preview.run }}: {{ data.preview.would_hold }} of {{ data.preview.kept }} examples</h2>
        <ul v-if="Object.keys(data.preview.left_out).length" class="llm-reasons"><li v-for="(n, why) in data.preview.left_out" :key="why">{{ n }} left out: {{ why }}</li></ul>
        <p v-else class="field-help">Every example the run kept can go in.</p>
        <div v-if="may" class="llm-publish"><label class="field-label">Name (optional)<input v-model="title" class="text-input" maxlength="100"></label><UiButton variant="primary" :disabled="busy || !data.preview.would_hold" @click="publish"><Layers :size="15" /> {{ busy ? 'Publishing…' : 'Publish version' }}</UiButton></div>
      </template>
      <template v-else><h2>No preparation run yet</h2><p>Run preparation on the Dataset page; a version is published from its result.</p><UiButton @click="emit('navigate', 'dataset')">Go to preparation</UiButton></template>
    </section>

    <section v-if="data?.versions?.length" class="panel">
      <h2>Versions</h2>
      <table class="llm-table"><thead><tr><th>Version</th><th>Examples</th><th>Splits</th><th>Kinds</th><th>Base model</th><th>Manifest</th><th>Published</th></tr></thead><tbody>
        <tr v-for="v in data.versions" :key="v.number"><td><strong>{{ v.name }}</strong><span v-if="v.title"> · {{ v.title }}</span></td><td>{{ v.examples }}</td><td>{{ words(v.split_counts) }}</td><td>{{ words(v.kind_counts) }}</td>
          <td>{{ v.base_model }}, {{ v.max_length }} tokens</td><td><code :title="v.manifest_sha256">{{ v.manifest_sha256.slice(0, 12) }}</code></td><td>{{ ago(v.published_at) }}{{ v.created_by ? ` by ${v.created_by}` : '' }} · run {{ v.run }}</td></tr>
      </tbody></table>
    </section>
    <section v-else-if="data" class="panel empty-state"><Layers :size="30" /><h2>No version yet</h2><UiBadge>Train reads a version</UiBadge></section>
  </div>
</template>

<style scoped>
.llm-versions{display:grid;gap:16px}
.llm-reasons{margin:8px 0;padding-left:18px;font-size:14px}
.llm-publish{display:flex;gap:12px;align-items:flex-end;margin-top:12px}.llm-publish .field-label{flex:1;margin:0}
.llm-table{width:100%;border-collapse:collapse;font-size:13px}
.llm-table th{text-align:left;color:#475569;padding:8px;border-bottom:1px solid #e2e8f0}
.llm-table td{padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
@media (max-width:700px){.llm-table{display:block;overflow-x:auto}}
</style>
