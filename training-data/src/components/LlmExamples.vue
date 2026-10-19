<script setup>
// The dataset page's LLM form (plan §2.1): the Examples tab (filters by source, kind, state and split; one example
// with its revisions; deleting one on request) and the Preparation tab (the settings, "Run preparation", and the
// report of a run with its findings). Backend: llm/app_api.py.
import { computed, onMounted, ref, watch } from 'vue';
import { RefreshCw, Play, Trash2, ShieldCheck } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import LlmConversation from './LlmConversation.vue';
import { llmApi, KIND_LABEL, SOURCE_LABEL, STATE_LABEL, SPLIT_LABEL, ACTION_LABEL, findingText } from '../api/llm.js';
import { ago } from '../api/training.js';

const props = defineProps({ project: Object });
const emit = defineEmits(['navigate']);
const rights = computed(() => props.project?.rights || []);
const tab = ref('Examples');

// ── Examples ──
const filters = ref({ source: '', kind: '', state: '', split: '' });
const page = ref(1); const list = ref(null); const error = ref(''); const loading = ref(false);
const opened = ref(null); const reason = ref(''); const deleting = ref(false); const deleteError = ref('');
const LABELS = { source: SOURCE_LABEL, kind: KIND_LABEL, state: STATE_LABEL, split: SPLIT_LABEL };
const pages = computed(() => list.value ? Math.max(1, Math.ceil(list.value.total / list.value.page_size)) : 1);

async function loadExamples() {
  if (!rights.value.includes('overview')) return;
  loading.value = true; error.value = '';
  try { list.value = await llmApi.examples(props.project.ref, { ...filters.value, page: page.value }); }
  catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}
watch(filters, () => { page.value = 1; loadExamples(); }, { deep: true });
watch(page, loadExamples);

async function open(row) {
  deleteError.value = ''; reason.value = '';
  try { opened.value = await llmApi.example(props.project.ref, row.id); } catch (e) { error.value = e.message; }
}
async function removeOpened() {
  if (!reason.value.trim()) { deleteError.value = 'Give the reason for the deletion.'; return; }
  deleting.value = true; deleteError.value = '';
  try {
    const r = await llmApi.deleteExample(props.project.ref, opened.value.id, reason.value.trim());
    opened.value = null;
    error.value = '';
    told.value = `Example ${r.deleted} is deleted.${r.affected_versions.length ? ` It was in ${r.affected_versions.join(', ')}, which stay as they were published.` : ''}${r.record_kept_for_other_examples ? ' The file it came from is kept for its other examples.' : ''}`;
    await loadExamples();
  } catch (e) { deleteError.value = e.message; }
  finally { deleting.value = false; }
}

// ── Preparation ──
const prep = ref(null); const settings = ref({ base_model: '', max_length: 1024 }); const saving = ref(false);
const running = ref(false); const run = ref(null); const actionFilter = ref(''); const told = ref('');
const chosenModel = computed(() => prep.value?.base_models.find(m => m.key === settings.value.base_model));
const USE = { paid: 'Commercial use allowed', terms: 'Commercial use with its licence’s conditions', research: 'Research and testing only: never released' };

async function loadPreparation() {
  error.value = '';
  try {
    prep.value = await llmApi.preparation(props.project.ref);
    settings.value = { base_model: prep.value.settings.base_model, max_length: prep.value.settings.max_length };
    if (prep.value.runs.length && !run.value) await openRun(prep.value.runs[0].number);
  } catch (e) { error.value = e.message; }
}
async function saveSettings() {
  saving.value = true; error.value = '';
  try { prep.value = await llmApi.saveSettings(props.project.ref, { ...settings.value, max_length: Number(settings.value.max_length) }); told.value = `Settings saved as version ${prep.value.settings.version}.`; }
  catch (e) { error.value = e.message; }
  finally { saving.value = false; }
}
async function runPreparation() {
  running.value = true; error.value = ''; told.value = '';
  try {
    const r = await llmApi.runPreparation(props.project.ref);
    told.value = r.state === 'done' ? `Run ${r.number} is done: ${r.report.kept} kept, ${r.report.left_out} left out, ${r.report.flagged} flagged for review.` : `Run ${r.number} failed: ${r.failure}`;
    run.value = null; await loadPreparation(); await openRun(r.number);
  } catch (e) { error.value = e.message; }
  finally { running.value = false; }
}
async function openRun(number) {
  try { run.value = await llmApi.run(props.project.ref, number, { action: actionFilter.value }); } catch (e) { error.value = e.message; }
}
watch(actionFilter, () => { if (run.value) openRun(run.value.number); });
const report = computed(() => run.value?.report || null);
const piiTypes = computed(() => Object.entries(report.value?.personal_data?.types || {}));

watch(tab, t => { if (t === 'Preparation' && !prep.value) loadPreparation(); });
onMounted(loadExamples);
</script>

<template>
  <div class="studio llm-examples">
    <div class="studio-actions"><div class="studio-tabs"><button v-for="t in ['Examples', 'Preparation']" :key="t" :class="{active: tab===t}" @click="tab=t">{{ t }}</button></div>
      <UiButton @click="tab==='Examples' ? loadExamples() : loadPreparation()"><RefreshCw :size="15" /> Refresh</UiButton></div>
    <div v-if="told" class="notice" role="status"><span>{{ told }}</span><button class="icon-button" aria-label="Dismiss" @click="told=''">×</button></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>

    <template v-if="tab==='Examples'">
      <section v-if="!rights.includes('overview')" class="panel empty-state"><h2>Examples</h2><p>Your role sees the examples given to you to review, on the Annotate page.</p></section>
      <template v-else>
        <div class="llm-filters">
          <label v-for="(labels, field) in LABELS" :key="field" class="field-label">{{ {source:'Source',kind:'Kind',state:'State',split:'Split'}[field] }}
            <select v-model="filters[field]" class="text-input"><option value="">All</option><option v-for="(label, value) in labels" :key="value" :value="value">{{ label }} ({{ list?.counts?.[field]?.[value] ?? 0 }})</option></select></label>
        </div>
        <p v-if="list?.waiting" class="field-help">{{ list.waiting }} record{{ list.waiting===1?'':'s' }} sent by an app did not become examples yet: map their keys on the Connect app page.</p>
        <section class="panel">
          <p v-if="loading" class="field-help">Loading…</p>
          <div v-else-if="list && !list.examples.length" class="empty-state"><h2>No examples {{ list.all ? 'match these filters' : 'yet' }}</h2><p v-if="!list.all">Upload a file of examples, or connect an app that sends conversations.</p><UiButton v-if="!list.all" @click="emit('navigate', 'upload')">Upload examples</UiButton></div>
          <table v-else-if="list" class="llm-table"><thead><tr><th>Example</th><th>Kind</th><th>Source</th><th>State</th><th>Split</th><th>Revision</th><th>Added</th></tr></thead><tbody>
            <tr v-for="row in list.examples" :key="row.id" class="llm-row" tabindex="0" @click="open(row)" @keydown.enter="open(row)"><td>{{ row.preview || '(no text)' }}</td><td>{{ KIND_LABEL[row.kind] }}</td><td>{{ SOURCE_LABEL[row.source] }}</td>
              <td><UiBadge :tone="row.state==='approved' ? 'green' : row.state==='flagged' ? 'purple' : 'neutral'">{{ STATE_LABEL[row.state] }}</UiBadge></td><td>{{ SPLIT_LABEL[row.split] || row.split }}</td><td>{{ row.revision }}</td><td>{{ ago(row.created_at) }}</td></tr>
          </tbody></table>
          <div v-if="list && pages > 1" class="llm-pager"><UiButton :disabled="page<=1" @click="page--">Previous</UiButton><span>Page {{ page }} of {{ pages }} · {{ list.total }} examples</span><UiButton :disabled="page>=pages" @click="page++">Next</UiButton></div>
        </section>
      </template>
    </template>

    <template v-else>
      <section class="panel">
        <div class="eyebrow">SETTINGS</div>
        <h2>How examples are checked</h2>
        <p>Every example is rendered through the base model's own chat template and counted in its tokens. Personal data is handled by the project's answer: <strong>{{ prep?.personal_data ? {redact:'removed from the text',drop:'the example is left out',keep:'kept, as the Owner accepted'}[prep.personal_data] : 'not answered yet' }}</strong>. Keys, tokens and passwords are always removed.</p>
        <div v-if="prep" class="llm-column-grid">
          <label class="field-label">Base model<select v-model="settings.base_model" class="text-input" :disabled="!rights.includes('manage')">
            <option v-for="m in prep.base_models" :key="m.key" :value="m.key">{{ m.name }} · {{ m.size }} · {{ m.licence }}{{ m.ready ? '' : ' · not ready' }}</option></select></label>
          <label class="field-label">Longest example (tokens)<input v-model="settings.max_length" class="text-input" type="number" :min="prep.limits.min_length" :max="prep.limits.max_length" :disabled="!rights.includes('manage')"></label>
        </div>
        <p v-if="chosenModel" class="field-help"><UiBadge :tone="chosenModel.use==='research' ? 'dark' : 'green'">{{ USE[chosenModel.use] }}</UiBadge> {{ chosenModel.description }}<template v-if="!chosenModel.ready"> It is not ready on this server yet: the platform's operator makes it ready once.</template></p>
        <p class="field-help">Not checked in stage 1: {{ prep?.not_checked?.join(' and ') }}. A person reviews flagged examples.</p>
        <div class="dialog-actions">
          <UiButton v-if="rights.includes('manage')" :disabled="saving" @click="saveSettings">{{ saving ? 'Saving…' : 'Save settings' }}</UiButton>
          <UiButton v-if="rights.includes('batch')" variant="primary" :disabled="running" @click="runPreparation"><Play :size="15" /> {{ running ? 'Preparing… this can take a few minutes' : 'Run preparation' }}</UiButton>
        </div>
      </section>

      <section v-if="prep?.runs?.length" class="panel">
        <div class="studio-actions"><h2>Runs</h2><select class="text-input llm-run-select" :value="run?.number" @change="openRun(Number($event.target.value))"><option v-for="r in prep.runs" :key="r.number" :value="r.number">Run {{ r.number }} · {{ r.state }} · {{ ago(r.started_at) }}</option></select></div>
        <template v-if="run">
          <p v-if="run.state==='failed'" class="field-error">{{ run.failure }}</p>
          <template v-if="report">
            <div class="metric-grid">
              <article><span>Examples</span><strong>{{ report.examples }}</strong></article>
              <article><span>Kept</span><strong>{{ report.kept }}</strong></article>
              <article><span>Left out</span><strong>{{ report.left_out }}</strong></article>
              <article><span>Flagged for review</span><strong>{{ report.flagged }}</strong></article>
              <article><span>Tokens</span><strong>{{ report.tokens.total }}</strong></article>
              <article><span>Longest</span><strong>{{ report.tokens.max }}</strong></article>
            </div>
            <dl class="summary-list">
              <dt>Settings</dt><dd>{{ run.settings.base_model }}, at most {{ run.settings.max_length }} tokens (version {{ run.settings.version }}); personal data: {{ run.personal_data }}</dd>
              <dt>Kinds</dt><dd>{{ Object.entries(report.kinds).map(([k, n]) => `${KIND_LABEL[k] || k} ${n}`).join(' · ') || '—' }}</dd>
              <dt>Turns</dt><dd>{{ report.turns.mean }} on average, at most {{ report.turns.max }}</dd>
              <dt>Personal data</dt><dd>{{ piiTypes.map(([k, n]) => `${k} ${n}`).join(' · ') || 'none found' }}{{ report.personal_data.secrets ? ` · secrets removed ${report.personal_data.secrets}` : '' }}</dd>
              <dt>Duplicates</dt><dd>{{ report.duplicates.exact }} exact, {{ report.duplicates.near }} near</dd>
              <dt>Leaks into the test split</dt><dd>{{ report.leaks }}</dd>
              <dt>Documents</dt><dd>{{ report.documents.pieces }} piece{{ report.documents.pieces===1?'':'s' }}</dd>
              <dt>Languages</dt><dd>{{ Object.entries(report.languages).map(([k, n]) => `${k} ${n}`).join(' · ') || '—' }}</dd>
              <dt>Kept per split</dt><dd>{{ Object.entries(report.splits).map(([k, n]) => `${SPLIT_LABEL[k] || k} ${n}`).join(' · ') || '—' }}</dd>
              <dt>Left out, and why</dt><dd>{{ Object.entries(report.left_out_by_reason).map(([k, n]) => `${findingText(k)}: ${n}`).join(' · ') || 'nothing' }}</dd>
            </dl>
            <div class="studio-actions"><h3>Findings</h3><select v-model="actionFilter" class="text-input llm-run-select"><option value="">Every action</option><option v-for="(label, value) in ACTION_LABEL" :key="value" :value="value">{{ label }}</option></select></div>
            <table v-if="run.findings.length" class="llm-table"><thead><tr><th>Example</th><th>Step</th><th>What</th><th>Done</th></tr></thead><tbody>
              <tr v-for="(f, i) in run.findings" :key="i"><td>{{ f.example }}</td><td>{{ f.step_label }}</td><td>{{ findingText(f.code) }}<span v-if="f.detail.types" class="field-help"> ({{ Object.entries(f.detail.types).map(([k, n]) => `${k} ${n}`).join(', ') }})</span><span v-else-if="f.detail.tokens" class="field-help"> ({{ f.detail.tokens }} tokens)</span></td><td>{{ f.action_label }}</td></tr>
            </tbody></table>
            <p v-else class="field-help">No finding{{ actionFilter ? ' with this action' : '' }}.</p>
            <p v-if="run.total > run.findings.length" class="field-help">The first {{ run.findings.length }} of {{ run.total }} findings are shown.</p>
          </template>
        </template>
      </section>
    </template>

    <UiDialog :open="!!opened" :title="opened ? `Example ${opened.id} · ${KIND_LABEL[opened.kind]}` : ''" @close="opened=null">
      <template v-if="opened">
        <p class="dialog-description">{{ SOURCE_LABEL[opened.source] }}{{ opened.line ? `, line ${opened.line}` : '' }} · {{ STATE_LABEL[opened.state] }} · {{ SPLIT_LABEL[opened.split] }} · group {{ opened.group }}</p>
        <details v-for="r in [...opened.revisions].reverse()" :key="r.number" :open="r.number===opened.revision" class="llm-revision">
          <summary>Revision {{ r.number }} · {{ r.reason_label }}{{ r.by ? ` by ${r.by}` : '' }} · {{ ago(r.created_at) }}<UiBadge v-if="r.number===opened.revision" tone="green">In use</UiBadge></summary>
          <LlmConversation :content="r.content" />
        </details>
        <template v-if="rights.includes('upload')">
          <h3><Trash2 :size="15" /> Delete on request</h3>
          <p class="field-help">The example and every revision go; it is never made again from where it came. Published dataset versions stay as they were and are listed.</p>
          <label class="field-label">Reason<input v-model="reason" class="text-input" maxlength="500" placeholder="e.g. the customer asked for it"></label>
          <p v-if="deleteError" class="field-error" role="alert">{{ deleteError }}</p>
          <div class="dialog-actions"><UiButton @click="opened=null">Close</UiButton><UiButton :disabled="deleting" @click="removeOpened"><ShieldCheck :size="15" /> {{ deleting ? 'Deleting…' : 'Delete this example' }}</UiButton></div>
        </template>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.llm-examples{display:grid;gap:16px}
.llm-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.llm-column-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:12px 0}
.llm-table{width:100%;border-collapse:collapse;font-size:13px}
.llm-table th{text-align:left;color:#475569;padding:8px;border-bottom:1px solid #e2e8f0}
.llm-table td{padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.llm-row{cursor:pointer}.llm-row:hover td,.llm-row:focus td{background:#f8fafc}
.llm-pager{display:flex;gap:12px;align-items:center;justify-content:flex-end;margin-top:12px;font-size:13px}
.llm-run-select{max-width:320px}
.llm-revision{border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;margin:8px 0}
.llm-revision summary{cursor:pointer;display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:8px}
@media (max-width:700px){.llm-table{display:block;overflow-x:auto}}
</style>
