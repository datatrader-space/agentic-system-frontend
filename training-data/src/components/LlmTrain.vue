<script setup>
// The train page's LLM form (plan §2.1): a dataset version, the method (SFT, continued pre-training, DPO, KTO), the
// base model it was prepared for with its licence, a named configuration and what to set over it, the parent model
// of a DPO or KTO run, and the runs with their progress, losses and log. Backend: llm/app_api.py, llm/runs.py.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Play, RefreshCw, X, RotateCw, ArrowLeft } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { llmApi, trainingOverrides, configSummary } from '../api/llm.js';
import { ago } from '../api/training.js';
import './llm.css';

const props = defineProps({ project: Object });
const emit = defineEmits(['navigate']);
const page = ref(null); const error = ref(''); const told = ref(''); const busy = ref(false); const opened = ref(null);
const form = ref({ version: '', method: 'sft', config: '', runtime: 3600, parent: '', epochs: '', max_steps: '', learning_rate: '', rank: '' });
let timer = null;

const version = computed(() => page.value?.versions.find(v => v.number === Number(form.value.version)));
const base = computed(() => page.value?.base_models.find(m => m.key === version.value?.base_model));
const parents = computed(() => (page.value?.models || []).filter(m => m.base_model === version.value?.base_model && ['sft', 'cpt'].includes(m.method)));
const USE = { paid: 'Commercial use allowed', terms: 'Commercial use with its licence’s conditions', research: 'Research and testing only: a model trained from it is never released' };

async function load() {
  error.value = '';
  try {
    page.value = await llmApi.training(props.project.ref);
    if (!form.value.version && page.value.versions.length) form.value.version = page.value.versions[0].number;
    if (!form.value.config) form.value.config = Object.keys(page.value.configurations)[0] || '';
    if (opened.value) opened.value = await llmApi.trainingRun(props.project.ref, opened.value.number);
  } catch (e) { error.value = e.message; }
  clearTimeout(timer);
  if (page.value?.runs.some(r => ['queued', 'starting', 'running', 'finalizing'].includes(r.state))) timer = setTimeout(load, 3000);
}
// Preference training usually goes on from a model taught by SFT: the newest one is offered first (it can be changed).
watch(() => form.value.method, m => {
  if (!['dpo', 'kto'].includes(m)) form.value.parent = '';
  else if (!form.value.parent && parents.value.length) form.value.parent = parents.value[0].version;
});

async function start() {
  busy.value = true; error.value = ''; told.value = '';
  try {
    const run = await llmApi.startTraining(props.project.ref, {
      dataset_version: Number(form.value.version), method: form.value.method, config: form.value.config,
      max_runtime_seconds: Number(form.value.runtime), parent: form.value.parent ? Number(form.value.parent) : undefined,
      overrides: trainingOverrides(form.value), idempotency_key: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    });
    told.value = `Run ${run.number} is started. Its state and progress are in the list below.`;   // not a state that goes stale
    Object.assign(form.value, { epochs: '', max_steps: '', learning_rate: '', rank: '' });   // a change was for that run only
    await load();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function open(run) {
  try { opened.value = await llmApi.trainingRun(props.project.ref, run.number); } catch (e) { error.value = e.message; }
}
async function move(name) {
  busy.value = true; error.value = '';
  try { opened.value = await llmApi.trainingMove(props.project.ref, opened.value.number, name); await load(); }
  catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
const unfinished = run => ['queued', 'starting', 'running', 'finalizing'].includes(run?.state);
// A job says its steps once it trains; before that it loads the model and the data (found 2026-10-21: "0 of 0 steps").
const progressText = p => (!p ? '—' : p.steps ? `${p.phase === 'training' ? '' : `${p.phase}: `}${p.steps_done} of ${p.steps} steps`
  : p.phase === 'preparing' ? 'loading the model and the data' : p.phase);
// Green for a model, purple while it runs; an ended run without a model stays neutral (its word says which).
const stateTone = state => (state === 'succeeded' ? 'green' : unfinished({ state }) ? 'purple' : 'neutral');
onMounted(load);
onUnmounted(() => clearTimeout(timer));
</script>

<template>
  <div class="studio llm-train">
    <div v-if="told" class="notice" role="status"><span>{{ told }}</span></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <p v-if="!page && !error" class="llm-loading">Loading…</p>
    <template v-if="!opened">
      <section v-if="page && !page.versions.length" class="panel empty-state"><h2>No dataset version yet</h2><p>A run trains on a published version: prepare the examples and publish one first.</p><UiButton @click="emit('navigate', 'versions')">Go to versions</UiButton></section>
      <section v-else-if="page && page.can_train" class="panel">
        <div class="eyebrow">NEW RUN</div>
        <h2>Train a language model</h2>
        <div class="llm-grid">
          <label class="field-label">Dataset version<select v-model="form.version" class="text-input"><option v-for="v in page.versions" :key="v.number" :value="v.number">{{ v.name }}{{ v.title ? ` · ${v.title}` : '' }} · {{ v.examples }} examples</option></select></label>
          <label class="field-label">Method<select v-model="form.method" class="text-input"><option v-for="m in page.methods" :key="m.value" :value="m.value" :disabled="!version?.per_method?.[m.value]">{{ m.label }} ({{ version?.per_method?.[m.value] ?? 0 }} {{ (version?.per_method?.[m.value] ?? 0) === 1 ? 'example' : 'examples' }})</option></select></label>
          <label class="field-label">Configuration<select v-model="form.config" class="text-input"><option v-for="(values, name) in page.configurations" :key="name" :value="name">{{ name }}</option></select></label>
          <label class="field-label">Longest it may run<select v-model="form.runtime" class="text-input"><option v-for="r in page.max_runtimes" :key="r.value" :value="r.value">{{ r.label }}</option></select></label>
          <label v-if="['dpo', 'kto'].includes(form.method)" class="field-label">Start from<select v-model="form.parent" class="text-input"><option value="">The base model</option><option v-for="m in parents" :key="m.version" :value="m.version">{{ m.name }} ({{ m.method.toUpperCase() }})</option></select></label>
        </div>
        <p v-if="base" class="field-help">Base model: <strong>{{ base.name }}</strong> ({{ base.size }}), {{ base.licence }} <UiBadge :tone="base.use === 'research' ? 'dark' : 'green'">{{ USE[base.use] }}</UiBadge><template v-if="!base.ready"> It is not ready on this server.</template></p>
        <p v-if="form.config" class="field-help">{{ form.config }}: {{ configSummary({ ...page.configurations[form.config], ...trainingOverrides(form) }) }}{{ Object.keys(trainingOverrides(form)).length ? ' (changed for this run)' : '' }}</p>
        <details><summary>Change settings for this run</summary>
          <div class="llm-grid">
            <label class="field-label">Epochs<input v-model="form.epochs" class="text-input" type="number" min="1" max="20" placeholder="as configured"></label>
            <label class="field-label">Steps (0 = all)<input v-model="form.max_steps" class="text-input" type="number" min="0" placeholder="as configured"></label>
            <label class="field-label">Learning rate<input v-model="form.learning_rate" class="text-input" type="number" step="0.00001" placeholder="as configured"></label>
            <label class="field-label">LoRA rank<input v-model="form.rank" class="text-input" type="number" min="1" max="256" placeholder="as configured"></label>
          </div>
        </details>
        <div class="dialog-actions"><UiButton variant="primary" :disabled="busy || !form.version || !form.config" @click="start"><Play :size="15" /> {{ busy ? 'Starting…' : 'Start training' }}</UiButton></div>
      </section>
      <section v-else-if="page" class="panel"><p>Only the project's Owner starts a training run. Every run is listed below.</p></section>

      <section v-if="page?.runs?.length" class="panel">
        <div class="studio-actions"><h2>Runs</h2><UiButton @click="load"><RefreshCw :size="15" /> Refresh</UiButton></div>
        <table class="llm-table"><thead><tr><th>Run</th><th>Method</th><th>Dataset</th><th>State</th><th>Progress</th><th>Loss</th><th>Model</th><th>Started</th></tr></thead><tbody>
          <tr v-for="r in page.runs" :key="r.number" class="llm-row" tabindex="0" @click="open(r)" @keydown.enter="open(r)">
            <td>{{ r.number }}</td><td>{{ r.method_label }}{{ r.parent ? ` from ${r.parent}` : '' }}</td><td>{{ r.dataset_version }}</td>
            <td><UiBadge :tone="stateTone(r.state)">{{ r.state_label }}</UiBadge><small v-if="r.state === 'queued'" class="field-help"> waits its turn: this machine runs one training or evaluation job at a time</small></td>
            <td>{{ progressText(r.progress) }}</td>
            <td>{{ r.metrics?.train_loss != null ? r.metrics.train_loss.toFixed(3) : '—' }}{{ r.metrics?.eval_loss != null ? ` / ${r.metrics.eval_loss.toFixed(3)}` : '' }}</td>
            <td>{{ r.model || '—' }}</td><td>{{ ago(r.created_at) }}</td></tr>
        </tbody></table>
      </section>

      <section v-if="page?.base_models?.length" class="panel" aria-labelledby="llm-base-models">
        <h2 id="llm-base-models">Base models</h2>
        <p class="field-help">A run starts from the base model its dataset version was prepared for. Each one names its licence; only models whose licence allows commercial use are offered.</p>
        <div class="base-grid">
          <article v-for="m in page.base_models" :key="m.key" class="base-card">
            <header><strong>{{ m.name }}</strong><UiBadge v-if="m.coming" tone="purple">Coming soon</UiBadge><UiBadge v-else-if="m.ready" tone="green">Ready</UiBadge><UiBadge v-else>Not ready on this server</UiBadge></header>
            <p class="field-help">{{ m.publisher }} · {{ m.size }} · {{ m.licence }}</p>
            <p>{{ m.description }}</p>
            <UiBadge :tone="m.use === 'research' ? 'dark' : 'green'">{{ USE[m.use] }}</UiBadge>
          </article>
        </div>
      </section>
    </template>

    <template v-else>
      <div class="studio-actions"><UiButton @click="opened = null; load()"><ArrowLeft :size="16" /> Back to training</UiButton>
        <div class="dialog-actions">
          <UiButton v-if="page?.can_train && unfinished(opened) && !opened.cancel_requested" :disabled="busy" @click="move('cancel')"><X :size="15" /> Cancel</UiButton>
          <UiButton v-if="page?.can_train && ['failed', 'cancelled'].includes(opened.state)" :disabled="busy" @click="move('retry')"><RotateCw :size="15" /> Try again</UiButton>
        </div></div>
      <section class="panel">
        <h2>Run {{ opened.number }} · {{ opened.method_label }} <UiBadge :tone="stateTone(opened.state)">{{ opened.state_label }}</UiBadge></h2>
        <p v-if="opened.cancel_requested && unfinished(opened)" class="field-help" role="status">Cancelling: the job is asked to stop and ends within about two minutes.</p>
        <p v-if="opened.failure" class="field-error">{{ opened.failure }}</p>
        <dl class="llm-facts">
          <dt>Dataset</dt><dd>{{ opened.dataset_version }}</dd>
          <dt>Base model</dt><dd>{{ opened.base_model }}{{ opened.parent ? `, starting from ${opened.parent}` : '' }}</dd>
          <dt>Configuration</dt><dd>{{ opened.config_name }}: {{ configSummary(opened.config_given) }}</dd>
          <dt>Progress</dt><dd>{{ progressText(opened.progress) }}{{ opened.progress ? `, ${opened.progress.training_rows} rows` : '' }}</dd>
          <dt>Loss</dt><dd>{{ opened.metrics?.train_loss != null ? `training ${opened.metrics.train_loss.toFixed(3)}` : '—' }}{{ opened.metrics?.eval_loss != null ? `, validation ${opened.metrics.eval_loss.toFixed(3)}` : '' }}</dd>
          <dt>Model</dt><dd>{{ opened.model || 'none yet' }}</dd>
          <dt>Code</dt><dd><code>{{ opened.code.git_sha.slice(0, 12) }}</code> · tree <code>{{ opened.code.tree_sha256.slice(0, 12) }}</code></dd>
          <dt>Attempts</dt><dd>{{ opened.attempts.map(a => `${a.number}: ${a.state}${a.exit_code != null ? ` (exit ${a.exit_code})` : ''}`).join(' · ') }}</dd>
        </dl>
        <h3>Log</h3>
        <pre class="code-block llm-log">{{ opened.log || 'Nothing written yet.' }}</pre>
      </section>
    </template>
  </div>
</template>

<style scoped>
.llm-train{display:grid;gap:16px}
.llm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:12px 0}
.llm-log{max-height:360px;overflow:auto;font-size:11px}
.base-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:12px}
.base-card{display:grid;gap:6px;align-content:start;padding:14px;border:1px solid var(--border);border-radius:12px}
.base-card header{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.base-card p{margin:0}
</style>
