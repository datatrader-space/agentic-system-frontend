<script setup>
import { onUnmounted, ref, watch } from 'vue';
import UiButton from './UiButton.vue';
import { apiFetch } from '../api/client.js';
import { stageFile, cancelUpload, LARGE_FILE_BYTES } from '../api/uploads.js';
const props = defineProps({ project: Object, formats: Array, selectedFormat: String,
  origin: String, consent: String, grouping: String, groupName: String });
const format = ref(props.selectedFormat || 'coco-json'); const file = ref(null); const session = ref(null);
const summary = ref(null); const result = ref(null); const busy = ref(false); const error = ref('');
const progress = ref(''); const defaultClass = ref('');
watch(() => props.selectedFormat, value => { if (value) format.value = value; });
watch([format, defaultClass], () => { summary.value = null; result.value = null; });
const base = () => `/training-data/app/projects/${encodeURIComponent(props.project.ref)}/imports/`;
async function choose(event) {
  if (session.value) await cancelUpload(props.project.ref, session.value).catch(() => {});
  session.value = null; file.value = event.target.files?.[0] || null;
  summary.value = null; result.value = null; error.value = '';
}
async function send(operation) {
  if (!file.value || busy.value) return;
  busy.value = true; error.value = ''; progress.value = '';
  try {
    if (file.value.size > 8_000_000_000) throw new Error('ZIP files must be at most 8 GB.');
    if (props.origin === 'development' && !props.consent?.trim()) throw new Error('Describe the dataset’s permission source in More options first.');
    if (props.grouping === 'one' && !props.groupName?.trim()) throw new Error('Enter the group name in More options first.');
    const form = new FormData();
    if (file.value.size > LARGE_FILE_BYTES) {
      if (!session.value) session.value = await stageFile(props.project.ref, file.value, value => { progress.value = `Uploading ${Math.round(value * 100)}%`; });
      form.append('upload_session', session.value);
    } else form.append('archive', file.value, file.value.name);
    form.append('format', format.value); form.append('default_class', defaultClass.value.trim());
    form.append('origin', props.origin || 'customer'); form.append('consent_source', props.consent || '');
    form.append('grouping', props.grouping || 'auto'); form.append('group', props.groupName || '');
    const body = await apiFetch(`${base()}${operation}/`, { method: 'POST', body: form, timeoutMs: 300000 });
    if (operation === 'inspect') summary.value = body;
    else { result.value = body; session.value = null; }
  } catch (exception) { error.value = exception.message; }
  finally { busy.value = false; progress.value = ''; }
}
onUnmounted(() => { if (session.value) cancelUpload(props.project.ref, session.value).catch(() => {}); });
</script>

<template>
  <section class="dataset-import" aria-label="Import annotated dataset">
    <p>Upload the images and their annotations together in one ZIP. Class names are read from the dataset; no fixed class vocabulary is required.</p>
    <label class="field-label">Annotation format<select v-model="format" class="text-input" :disabled="busy"><option v-for="item in (formats || []).filter(item => item.import)" :key="item.key" :value="item.key">{{ item.name }}</option></select></label>
    <label class="field-label">Dataset ZIP<input type="file" accept=".zip,application/zip" :disabled="busy" @change="choose"/></label>
    <label class="field-label">Class name, only if the source does not provide one<input v-model="defaultClass" class="text-input" maxlength="200" :disabled="busy" placeholder="Use the class name from your project"/></label>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p><p v-if="progress" role="status">{{ progress }}</p>
    <UiButton :disabled="busy || !file || !(formats || []).some(item => item.key === format && item.import)" @click="send('inspect')">{{ busy ? 'Reading dataset…' : 'Check dataset' }}</UiButton>
    <template v-if="summary"><p>{{ summary.photos }} images · {{ summary.annotations }} annotations</p><table><thead><tr><th>Source class</th><th>Annotations</th></tr></thead><tbody><tr v-for="item in summary.classes" :key="item.name"><td>{{ item.name }}</td><td>{{ item.annotations }}</td></tr></tbody></table><p>Annotation types: {{ Object.entries(summary.types).map(([type, count]) => `${type} (${count})`).join(', ') || 'Empty images' }}.</p><p>Labels retain their type and class name. Importing does not approve labels or start training.</p><UiButton variant="primary" :disabled="busy || !!result" @click="send('apply')">{{ busy ? 'Importing…' : 'Import dataset' }}</UiButton></template>
    <div v-if="result" role="status"><p>{{ result.results.filter(item => item.state === 'imported').length }} images imported · {{ result.results.filter(item => item.state === 'already').length }} already present.</p><ul><li v-for="item in result.results.filter(item => !['imported','already'].includes(item.state))" :key="item.name">{{ item.name }}: {{ item.detail || item.state }}</li></ul></div>
  </section>
</template>

<style scoped>
.dataset-import{display:grid;gap:14px}.dataset-import table{border-collapse:collapse;font-size:13px;width:100%}.dataset-import td,.dataset-import th{text-align:left;border-bottom:1px solid var(--aadml-outline);padding:8px}.dataset-import p{font-size:13px}.dataset-import input[type=file]{display:block;margin-top:8px;max-width:100%}
</style>
