<script setup>
// A project's Models page: its model versions with their newest evaluation, approvals and where they answer, and the
// backend's own actions on them; the measures side by side; how deployed models were called; the published models.
// Backend: app_api.py models/ (registry, approvals, evaluations, usage) — every action is checked there.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Box, Check, FileCheck2, Gauge, RotateCcw, Search, ShieldCheck, Upload, X } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import ApprovalDialog from './ApprovalDialog.vue';
import { modelsApi, catalogue, measureText, meets, msText, unanswered } from '../api/models.js';
import { startKey } from '../api/train.js';

const props = defineProps({ projectRef: { type: String, required: true } });
const emit = defineEmits(['navigate']);
const TABS = ['My models', 'Open source models', 'Compare', 'Model monitoring'];
const tab = ref('My models');
const data = ref(null); const loading = ref(true); const error = ref(''); const notice = ref(''); const busy = ref(false);
const files = ref(null);

async function load() {
  try { data.value = await modelsApi.load(props.projectRef); error.value = ''; } catch (e) { error.value = e.message; } finally { loading.value = false; }
}
// An evaluation runs as a job: the page asks again, 5 s after each answer, until none is running. Asking only after
// the answer came back keeps a slow server from piling requests up.
let timer = null; let alive = true;
const running = computed(() => (data.value?.models || []).some(m => m.evaluating));
function follow() { clearTimeout(timer); timer = alive && running.value ? setTimeout(async () => { await load(); follow(); }, 5000) : null; }
watch(running, follow);
onMounted(load);
onUnmounted(() => { alive = false; clearTimeout(timer); });
watch(() => props.projectRef, () => { loading.value = true; data.value = null; load(); });

function replace(model) { data.value.models = data.value.models.map(m => (m.number === model.number ? model : m)); }
async function act(model, action, body) {
  busy.value = true; error.value = ''; notice.value = ''; files.value = null;
  try {
    const answer = await modelsApi.act(props.projectRef, model.number, action, body);
    replace(answer.model); notice.value = answer.said; dialog.value = null;
    if (action === 'check') files.value = { number: model.number, rows: answer.files, bad: answer.bad };
    return true;
  } catch (e) {
    if (unanswered(e)) { dialog.value = null; await load(); error.value = 'No answer came back, so the page read the models again: check below whether it was done before trying again.'; }
    else { dialogError.value = e.message; if (!dialog.value) error.value = e.message; }
    return false;
  } finally { busy.value = false; }
}

// One dialog at a time: a reason (reject / restore) or an evaluation. Approving and revoking are ApprovalDialog's.
const dialog = ref(null); const dialogError = ref(''); const text = ref('');
const form = ref(null); const choice = ref({ test_version: '', golden_version: '', previous: '', max_runtime: '' });
function ask(type, model) { dialog.value = { type, model }; dialogError.value = ''; text.value = ''; }
const dialogTitle = computed(() => ({ reject: 'Reject this model', restore: 'Register it again', evaluate: 'Evaluate this model' }[dialog.value?.type] || ''));
const approving = ref(null);
function approved(answer) { replace(answer.model); notice.value = answer.said; error.value = ''; files.value = null; approving.value = null; }
async function approvalUnanswered() {
  approving.value = null; await load();
  error.value = 'No answer came back, so the page read the models again: check below whether it was done before trying again.';
}
async function openEvaluate(model) {
  ask('evaluate', model); form.value = null;
  try {
    form.value = await modelsApi.evaluateForm(props.projectRef, model.number);
    choice.value = { test_version: form.value.tests[0]?.id || '', golden_version: '', previous: '', max_runtime: form.value.default_runtime, key: startKey() };
  } catch (e) { dialogError.value = e.message; }
}
async function startEvaluation() {
  const { model } = dialog.value;
  busy.value = true; dialogError.value = '';
  try {
    const started = await modelsApi.evaluate(props.projectRef, model.number, choice.value);
    dialog.value = null; await load();
    notice.value = `Evaluation ${started.number} has started. It measures ${model.name} ${model.version} on this server; the page shows its result when it is done.`;
  } catch (e) {
    if (unanswered(e)) { dialog.value = null; await load(); error.value = 'No answer came back, so the page read the models again: check below whether the evaluation started before trying again.'; }
    else dialogError.value = e.message;
  } finally { busy.value = false; }
}

const when = iso => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const measures = computed(() => data.value?.measures || []);
// Pass and fail are shown only against approved targets: proposed ones are shown, not held against a model.
const judged = (ms, value) => (data.value?.criteria_approved ? meets(ms, value) : null);
const verdictTone = v => ({ passed: 'green', failed: 'red', inconclusive: 'amber' }[v] || 'neutral');
const activeApprovals = model => model.approvals.filter(a => a.active);
const history = model => model.approvals.filter(a => !a.active);

// Compare: every model that has a measured evaluation.
const compared = computed(() => (data.value?.models || []).filter(m => m.evaluation && Object.values(m.evaluation.values).some(v => v !== null && v !== undefined)));

// Open source models.
const words = ref(''); const kindFilter = ref('');
const kinds = computed(() => [...new Set(catalogue(data.value?.catalogue).map(row => row.kind))]);
const shown = computed(() => catalogue(data.value?.catalogue, words.value, kindFilter.value));

// Monitoring.
const usage = ref(null); const days = ref(30); const usageError = ref('');
async function loadUsage() {
  usageError.value = '';
  try { usage.value = await modelsApi.usage(props.projectRef, days.value); } catch (e) { usageError.value = e.message; }
}
watch([tab, days], () => { if (tab.value === 'Model monitoring') loadUsage(); });
const share = (part, whole) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : '—');
</script>

<template>
  <div class="models-page">
    <div class="studio-tabs"><button v-for="t in TABS" :key="t" :class="{active:tab===t}" @click="tab=t">{{ t }}</button></div>
    <div v-if="notice" class="notice" role="status"><Check :size="16"/><span>{{ notice }}</span><button class="icon-button" aria-label="Dismiss" @click="notice=''"><X :size="14"/></button></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="loading">Loading…</p>

    <template v-else-if="data&&tab==='My models'">
      <div class="studio-actions">
        <UiButton variant="primary" @click="emit('navigate','train')">Train a model</UiButton>
        <UiButton disabled title="Coming soon"><Upload :size="15"/> Upload weights</UiButton><UiBadge tone="purple">Coming soon</UiBadge>
      </div>
      <p v-if="!data.criteria_approved" class="models-note">The thresholds below are proposed targets. They are not approved for this project yet, so an evaluation measures a model but does not pass or fail it.</p>
      <div v-if="!data.models.length" class="model-empty">
        <Box :size="42"/><h2>No trained models yet</h2>
        <p>A model appears here when a training run of this project finishes and registers it.</p>
        <UiButton variant="primary" @click="emit('navigate','train')">Train a model</UiButton>
      </div>
      <article v-for="m in data.models" :key="m.number" class="panel model-card" :class="{rejected:m.state==='rejected'}">
        <header>
          <div>
            <h3>{{ m.name }} <span class="model-version">{{ m.version }}</span></h3>
            <p class="model-meta">{{ m.trains || m.architecture }} · run {{ m.run }}<template v-if="m.dataset_version"> · trained on {{ m.dataset_version }}</template> · {{ when(m.created_at) }}</p>
          </div>
          <div class="model-badges">
            <UiBadge :tone="m.state==='rejected'?'red':'green'">{{ m.state_label }}</UiBadge>
            <UiBadge v-if="m.smoke" tone="amber">Smoke test</UiBadge>
            <UiBadge v-if="m.research_only">Research or evaluation use only</UiBadge>
            <UiBadge v-for="env in m.live_in" :key="env" tone="purple">Live on {{ env }}</UiBadge>
            <UiBadge v-if="!m.kept" tone="red">Files missing</UiBadge>
          </div>
        </header>
        <p v-if="m.state==='rejected'&&m.rejected_reason" class="model-reason">Rejected: {{ m.rejected_reason }}</p>
        <p v-if="m.started_from?.changed" class="model-reason">The published weights it started from ({{ m.started_from.name }}) are not the bytes an earlier model of this kind started from. Look at this before trusting it.</p>

        <section class="model-section">
          <h4>Evaluation</h4>
          <p v-if="m.evaluating" class="model-running"><Gauge :size="14"/> Evaluation {{ m.evaluating.number }} is {{ m.evaluating.state_label }}…</p>
          <p v-else-if="m.ended" class="model-reason">Evaluation {{ m.ended.number }}: {{ m.ended.state_label.toLowerCase() }}<template v-if="m.ended.reason"> — {{ m.ended.reason }}</template></p>
          <template v-if="m.evaluation">
            <p class="model-meta">Evaluation {{ m.evaluation.number }}<template v-if="m.evaluation.test_version"> on {{ m.evaluation.test_version }}</template> · <UiBadge :tone="verdictTone(m.evaluation.verdict)">{{ m.evaluation.verdict_label || m.evaluation.state }}</UiBadge></p>
            <dl class="measure-list">
              <div v-for="ms in measures" :key="ms.key" :class="{pass:judged(ms,m.evaluation.values[ms.key])===true,fail:judged(ms,m.evaluation.values[ms.key])===false}">
                <dt>{{ ms.label }}</dt><dd>{{ measureText(ms.key, m.evaluation.values[ms.key]) }}</dd>
              </div>
            </dl>
            <ul v-if="m.evaluation.reasons.length" class="model-reasons"><li v-for="r in m.evaluation.reasons" :key="r">{{ r }}</li></ul>
          </template>
          <p v-else-if="!m.evaluating&&!m.ended" class="model-meta">Not evaluated yet.</p>
        </section>

        <section class="model-section">
          <h4>Approvals</h4>
          <p v-if="!activeApprovals(m).length" class="model-meta">None in force.</p>
          <ul class="approval-list">
            <li v-for="a in activeApprovals(m)" :key="a.id"><ShieldCheck :size="14"/><span><strong>{{ a.kind_label }}</strong> by {{ a.by }} · {{ when(a.at) }}<template v-if="a.note"> · “{{ a.note }}”</template></span>
              <UiButton v-if="m.may.act" class="small" :disabled="busy" @click="approving={type:'revoke', model:m, approval:a}">Revoke</UiButton></li>
          </ul>
          <details v-if="history(m).length" class="approval-history">
            <summary>Earlier approvals, revoked ({{ history(m).length }})</summary>
            <ul class="approval-list">
              <li v-for="a in history(m)" :key="a.id" class="revoked"><span><strong>{{ a.kind_label }}</strong> by {{ a.by }} · {{ when(a.at) }} — revoked {{ when(a.revoked_at) }}<template v-if="a.revoked_by"> by {{ a.revoked_by }}</template><template v-if="a.revoke_reason">: {{ a.revoke_reason }}</template></span></li>
            </ul>
          </details>
          <p v-if="m.release_refusal" class="model-meta">Release: {{ m.release_refusal }}</p>
        </section>

        <div v-if="files&&files.number===m.number" class="file-check" :class="{bad:files.bad}">
          <span v-for="f in files.rows" :key="f.what"><FileCheck2 :size="13"/> {{ f.what }}: {{ {same:'the registered file',changed:'NOT the registered file',missing:'not in storage'}[f.state] }}</span>
        </div>

        <footer class="model-actions">
          <template v-if="m.may.act">
            <UiButton :disabled="busy" @click="act(m,'check')"><FileCheck2 :size="14"/> Check files</UiButton>
            <UiButton v-if="m.state!=='rejected'" :disabled="busy||!!m.evaluating" @click="openEvaluate(m)"><Gauge :size="14"/> Evaluate</UiButton>
            <UiButton v-if="m.state!=='rejected'" :disabled="busy" @click="approving={type:'approve', model:m}"><ShieldCheck :size="14"/> Approve</UiButton>
            <UiButton v-if="m.state!=='rejected'" class="danger" :disabled="busy" @click="ask('reject', m)">Reject</UiButton>
            <UiButton v-else :disabled="busy" @click="ask('restore', m)"><RotateCcw :size="14"/> Register again</UiButton>
          </template>
          <span class="model-actions-end">
            <UiButton @click="emit('navigate','test')">Test model</UiButton>
            <UiButton @click="emit('navigate','deploy')">Deployment options</UiButton>
          </span>
        </footer>
      </article>
    </template>

    <template v-else-if="data&&tab==='Open source models'">
      <div class="studio-actions">
        <div class="search-field"><Search :size="16"/><input v-model="words" aria-label="Search models" placeholder="Search models…"></div>
        <select v-model="kindFilter" class="compact-select" aria-label="Model task"><option value="">All tasks</option><option v-for="k in kinds" :key="k" :value="k">{{ k }}</option></select>
      </div>
      <div class="model-catalog">
        <article v-for="row in shown" :key="row.name" class="panel catalog-card">
          <div class="catalog-head"><Box :size="22"/><UiBadge>{{ row.kind }}</UiBadge><UiBadge v-if="row.coming" tone="purple">Coming soon</UiBadge></div>
          <h3>{{ row.name }}</h3>
          <p class="model-meta">{{ row.publisher }}<template v-if="row.licence"> · {{ row.licence }}</template></p>
          <p>{{ row.description }}</p>
          <p v-if="row.coming&&!row.soon" class="model-meta">{{ row.why_not }}</p>
          <div class="catalog-tags">
            <UiBadge v-if="row.trainable" tone="green">Can be trained here</UiBadge>
            <UiBadge v-if="row.tried_as_published" tone="green">Can be tried as published</UiBadge>
            <UiBadge v-if="row.research_only">Research or evaluation use only</UiBadge>
          </div>
          <UiButton v-if="row.trainable" @click="emit('navigate','train')">Train with it</UiButton>
          <UiButton v-else-if="row.tried_as_published" @click="emit('navigate','annotate')">Use it in Auto label</UiButton>
          <UiButton v-else disabled>Coming soon</UiButton>
        </article>
      </div>
      <p v-if="!shown.length">No models match your selection.</p>
    </template>

    <template v-else-if="data&&tab==='Compare'">
      <div v-if="!compared.length" class="model-empty"><Gauge :size="40"/><h2>Nothing to compare yet</h2><p>Evaluate a model on a test version; its measures appear here beside the others.</p></div>
      <div v-else class="table-wrap">
        <table class="compare-table">
          <thead><tr><th>Model</th><th>Verdict</th><th v-for="ms in measures" :key="ms.key">{{ ms.label }}</th></tr></thead>
          <tbody>
            <tr class="threshold-row"><td>Target{{ data.criteria_approved ? '' : ' (proposed)' }}</td><td></td><td v-for="ms in measures" :key="ms.key">{{ ms.direction==='at_most'?'≤':'≥' }} {{ measureText(ms.key, ms.threshold) }}</td></tr>
            <tr v-for="m in compared" :key="m.number">
              <td><strong>{{ m.name }} {{ m.version }}</strong><span class="model-meta"> · {{ m.evaluation.test_version }}</span></td>
              <td><UiBadge :tone="verdictTone(m.evaluation.verdict)">{{ m.evaluation.verdict_label || m.evaluation.state }}</UiBadge></td>
              <td v-for="ms in measures" :key="ms.key" :class="{pass:judged(ms,m.evaluation.values[ms.key])===true,fail:judged(ms,m.evaluation.values[ms.key])===false}">{{ measureText(ms.key, m.evaluation.values[ms.key]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <section v-else-if="data" class="panel">
      <div class="monitor-head"><h2>Model monitoring</h2>
        <select v-if="usage" v-model.number="days" aria-label="Period"><option v-for="p in usage.periods" :key="p.value" :value="p.value">{{ p.label }}</option></select></div>
      <p v-if="usageError" class="field-error" role="alert">{{ usageError }}</p>
      <p v-else-if="!usage">Loading…</p>
      <template v-else-if="usage.total">
        <div class="metric-grid">
          <article><span>Calls</span><strong>{{ usage.total.calls }}</strong></article>
          <article><span>Not answered</span><strong>{{ share(usage.total.not_answered, usage.total.calls) }}</strong></article>
          <article><span>Latency p50</span><strong>{{ msText(usage.total.p50_ms) }}</strong></article>
          <article><span>Latency p95</span><strong>{{ msText(usage.total.p95_ms) }}</strong></article>
        </div>
        <p class="model-meta">Last call {{ when(usage.total.last) }}<template v-if="usage.total.estimate"> · some counts are estimates</template></p>
        <div v-for="part in [['By model','by_model'],['By environment','by_environment'],['By app','by_app']]" :key="part[1]" class="table-wrap monitor-table">
          <table>
            <thead><tr><th>{{ part[0] }}</th><th>Calls</th><th>Answered</th><th>Not answered</th><th>p50</th><th>p95</th><th>Last call</th></tr></thead>
            <tbody><tr v-for="row in usage[part[1]]" :key="row.label"><td>{{ row.label }}</td><td>{{ row.calls }}</td><td>{{ row.answered }}</td><td>{{ row.not_answered }}</td><td>{{ msText(row.p50_ms) }}</td><td>{{ msText(row.p95_ms) }}</td><td>{{ when(row.last) }}</td></tr></tbody>
          </table>
        </div>
      </template>
      <div v-else class="model-empty"><Gauge :size="40"/><h2>No calls in this period</h2><p>Calls appear here once a deployed model of this project is asked for predictions.</p><UiButton @click="emit('navigate','deploy')">Deployment options</UiButton></div>
    </section>

    <UiDialog :open="!!dialog" :title="dialogTitle" @close="dialog=null">
      <template v-if="dialog&&['reject','restore'].includes(dialog.type)">
        <p class="dialog-description" v-if="dialog.type==='reject'">{{ dialog.model.name }} {{ dialog.model.version }} stays in the registry and cannot be deployed again. Say why; the reason is kept.</p>
        <p class="dialog-description" v-else>{{ dialog.model.name }} {{ dialog.model.version }} becomes a registered model again. Say why; the reason is kept.</p>
        <label class="field-label">Reason<textarea v-model="text" class="text-input" rows="3" :aria-invalid="!!dialogError"></textarea></label>
        <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
        <div class="dialog-actions"><UiButton @click="dialog=null">Cancel</UiButton><UiButton variant="primary" :class="{'danger-fill':dialog.type==='reject'}" :disabled="busy||!text.trim()" @click="act(dialog.model, dialog.type, {reason:text.trim()})">{{ dialog.type==='reject' ? 'Reject' : 'Register again' }}</UiButton></div>
      </template>
      <template v-else-if="dialog&&dialog.type==='evaluate'">
        <p class="dialog-description">The model predicts every photo of the version you choose, on this server, and its answers are measured against the labels. It stops at the time limit.</p>
        <p v-if="!form&&!dialogError">Loading…</p>
        <template v-if="form">
          <p v-if="form.refused" class="field-error" role="alert">{{ form.refused }}</p>
          <label class="field-label">Measure on
            <select v-model="choice.test_version" class="text-input"><option v-if="!form.tests.length" value="">No version has test photos</option><option v-for="v in form.tests" :key="v.id" :value="v.id">{{ v.name }} · {{ v.photos }} photos</option></select></label>
          <label class="field-label">Golden photos (optional)
            <select v-model="choice.golden_version" class="text-input"><option value="">None</option><option v-for="v in form.goldens" :key="v.id" :value="v.id">{{ v.name }} · {{ v.photos }} photos</option></select></label>
          <label class="field-label">Compare with an earlier model (optional)
            <select v-model="choice.previous" class="text-input"><option value="">None</option><option v-for="e in form.earlier" :key="e.id" :value="e.id">{{ e.name }}</option></select></label>
          <label class="field-label">Time limit
            <select v-model.number="choice.max_runtime" class="text-input"><option v-for="r in form.runtimes" :key="r.value" :value="r.value">{{ r.label }}</option></select></label>
        </template>
        <p v-if="dialogError" class="field-error" role="alert">{{ dialogError }}</p>
        <div class="dialog-actions"><UiButton @click="dialog=null">Cancel</UiButton><UiButton variant="primary" :disabled="busy||!form||!!form.refused||!choice.test_version" @click="startEvaluation">Start evaluation</UiButton></div>
      </template>
    </UiDialog>
    <ApprovalDialog :asked="approving" :project-ref="projectRef" @close="approving=null" @done="approved" @unanswered="approvalUnanswered"/>
  </div>
</template>

<style scoped>
.badge--red{color:#b42318;background:#fef3f2}
.badge--amber{color:#93610b;background:#fff4dc}
.models-note{font-size:12px;background:#fff8e6;border:1px solid #f5dfa6;color:#7a5a00!important;padding:10px 14px;border-radius:7px;margin-bottom:16px}
.model-card{margin-bottom:16px;padding:22px}
.model-card.rejected{background:#fcfcfd;border-style:dashed}
.model-card header{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.model-card h3{font-size:16px;margin:0}
.model-version{font-weight:500;color:#6d7c92;font-size:13px}
.model-meta{font-size:12px!important;color:#6d7c92!important;margin:4px 0!important}
.model-badges{display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start}
.model-reason{font-size:12px;color:#b42318!important;margin:10px 0 0}
.model-section{border-top:1px solid #eef0f4;margin-top:16px;padding-top:12px}
.model-section h4{font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#6d7c92;margin:0 0 6px;font-weight:600}
.model-running{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--aadml-primary)!important}
.measure-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin:10px 0 0}
.measure-list>div{border:1px solid #e6e8ee;border-radius:7px;padding:8px 10px}
.measure-list dt{font-size:11px;color:#6d7c92}
.measure-list dd{margin:4px 0 0;font-size:14px;font-weight:600}
.pass{color:#27765a}.measure-list>.pass{border-color:#b9e3cf;background:#f3fbf7}
.fail{color:#b42318}.measure-list>.fail{border-color:#fbcfca;background:#fff6f5}
.model-reasons{margin:10px 0 0;padding-left:18px;font-size:12px;color:#48566c}
.approval-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.approval-list li{display:flex;align-items:center;gap:8px;font-size:12px;color:#33415c}
.approval-list li>svg{color:#27765a}
.approval-list li.revoked{color:#8a94a6}
.approval-history{margin-top:6px}
.approval-history summary{cursor:pointer;font-size:12px;color:var(--aadml-primary)}
.approval-history .approval-list{margin-top:6px}
.approval-list .small,.model-actions .button{min-height:30px;padding:6px 10px;font-size:12px}
.file-check{display:flex;flex-direction:column;gap:4px;margin-top:12px;padding:10px 12px;border-radius:7px;background:#f3fbf7;color:#27765a;font-size:12px}
.file-check.bad{background:#fff6f5;color:#b42318}
.file-check span{display:flex;align-items:center;gap:6px}
.model-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;border-top:1px solid #eef0f4;padding-top:14px}
.model-actions-end{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
.danger{color:#b42318;border-color:#fda29b}
.danger-fill{background:#d92d20;border-color:#d92d20}
.catalog-card{display:flex;flex-direction:column;gap:6px}
.catalog-card h3{margin:6px 0 0}
.catalog-card>p{min-height:0!important;margin:0!important}
.catalog-head{display:flex;align-items:center;gap:8px}
.catalog-head>svg{color:var(--aadml-focus)}
.catalog-tags{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
.catalog-card .button{margin-top:auto}
.compare-table td,.compare-table th{padding:12px 14px;font-size:12px}
.threshold-row td{background:#f8f9fb;color:#6d7c92}
.monitor-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.monitor-table{margin-top:16px}
.monitor-table td,.monitor-table th{padding:10px 14px;font-size:12px}
@media(max-width:700px){.model-actions-end{margin-left:0}}
</style>
