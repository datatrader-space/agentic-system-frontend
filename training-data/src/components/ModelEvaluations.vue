<script setup>
// One vision model's evaluations, in the Models page (ADM-1210 §3.4): the list of them (newest first, in pages) and one
// evaluation — what it compared, its measures beside the previous model's, the verdict, what it used and cost (§3.9),
// its attempts with their logs, time and cost, the end of its log, the report, and Cancel / Try again. Backend: app_api.py evaluations/ (every rule is checked there).
import { computed, onUnmounted, ref, watch } from 'vue';
import { ArrowLeft, Gauge, RotateCw, X } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import RunProvenance from './RunProvenance.vue';
import AttemptsTable from './AttemptsTable.vue';
import { evaluationsApi, measureText, unanswered } from '../api/models.js';

const props = defineProps({
  projectRef: { type: String, required: true },
  model: { type: Object, required: true },             // the model row: number, name, version
  number: { type: Number, default: null },             // the evaluation to open first; none: the list
  criteriaApproved: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'changed']);

const when = iso => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const stateTone = s => ({ succeeded: 'green', failed: 'red', cancelled: 'neutral' }[s] || 'purple');
const verdictTone = v => ({ passed: 'green', failed: 'red', inconclusive: 'amber' }[v] || 'neutral');

// ── The list ──
const rows = ref([]); const more = ref(false); const listLoading = ref(false); const listError = ref('');
async function loadList(next = false) {
  listLoading.value = true; listError.value = '';
  try {
    const before = next && rows.value.length ? rows.value.at(-1).number : undefined;
    const body = await evaluationsApi.list(props.projectRef, { model: props.model.number, before });
    rows.value = next ? [...rows.value, ...body.evaluations] : body.evaluations;
    more.value = !!body.more;
  } catch (e) { listError.value = e.message; } finally { listLoading.value = false; }
}

// ── One evaluation: asked again 5 s after each answer while it is unfinished (as a run's view does) ──
const opened = ref(props.number); const detail = ref(null); const loading = ref(false); const error = ref('');
const busy = ref(false); const actionError = ref(''); const told = ref(''); const confirming = ref(false);
let timer = null; let alive = true;
async function loadDetail(number) {
  clearTimeout(timer);
  if (!detail.value || detail.value.number !== number) loading.value = true;
  try {
    const body = await evaluationsApi.get(props.projectRef, number);
    if (!alive || opened.value !== number) return;
    detail.value = body; error.value = '';
  } catch (e) {
    if (opened.value === number) error.value = e.message;
  } finally { loading.value = false; }
  if (alive && opened.value === number && detail.value?.number === number && detail.value.unfinished) {
    timer = setTimeout(() => loadDetail(number), 5000);
  }
}
function open(number) { opened.value = number; detail.value = null; error.value = ''; actionError.value = ''; told.value = ''; loadDetail(number); }
function backToList() { clearTimeout(timer); opened.value = null; detail.value = null; loadList(); }
watch(() => props.number, n => (n ? open(n) : backToList()), { immediate: true });
onUnmounted(() => { alive = false; clearTimeout(timer); });

async function act(action) {
  const number = detail.value.number;
  busy.value = true; actionError.value = ''; told.value = '';
  try {
    detail.value = { ...detail.value, ...(await evaluationsApi[action](props.projectRef, number)) };
    confirming.value = false;
    told.value = action === 'cancel' ? `Cancelling evaluation ${number}: its job and its machine are being stopped.`
      : `Evaluation ${number} is queued again.`;
    emit('changed');
    loadDetail(number);
  } catch (e) {
    if (unanswered(e)) { confirming.value = false; await loadDetail(number); actionError.value = 'No answer came back, so the page read the evaluation again: check below whether it was done before trying again.'; }
    else actionError.value = e.message;          // a refusal (409), such as a balance that cannot pay, is said here
  } finally { busy.value = false; }
}

const facts = computed(() => {
  const d = detail.value; if (!d) return [];
  return [
    ['Model', `${props.model.name} ${d.candidate.version}`],
    ['Compared with', d.previous ? `${props.model.name} ${d.previous.version}` : 'No earlier model'],
    ['Test photos', d.test_version || '—'],
    ['Golden photos', d.golden_version || 'None'],
    ['Started', `${when(d.created_at)}${d.by ? ` by ${d.by}` : ''}`],
    ['Finished', d.finished_at ? when(d.finished_at) : '—'],
  ];
});
// Met / not met is said against approved targets; against proposed ones it is only what it would be.
const metText = met => (met === null || met === undefined ? 'Not measured'
  : props.criteriaApproved ? (met ? 'Met' : 'Not met') : (met ? 'Would be met' : 'Would not be met'));
const metTone = met => (met === null || met === undefined || !props.criteriaApproved ? 'neutral' : met ? 'green' : 'red');
</script>

<template>
  <div class="evaluations">
    <div class="studio-actions">
      <UiButton @click="emit('close')"><ArrowLeft :size="16"/> Back to models</UiButton>
      <UiButton v-if="opened" @click="backToList">All evaluations of {{ model.version }}</UiButton>
    </div>

    <!-- The list -->
    <section v-if="!opened" class="panel">
      <h2>Evaluations of {{ model.name }} {{ model.version }}</h2>
      <p v-if="listError" class="field-error" role="alert">{{ listError }}</p>
      <p v-if="listLoading && !rows.length">Loading…</p>
      <div v-else-if="!rows.length && !listError" class="model-empty"><Gauge :size="40"/><h2>Not evaluated yet</h2><p>Evaluate this model on a test version from its card on the Models page; each evaluation is listed here.</p></div>
      <div v-else-if="rows.length" class="table-wrap">
        <table class="ws-table">
          <thead><tr><th scope="col">Evaluation</th><th scope="col">State</th><th scope="col">Verdict</th><th scope="col">Started</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead>
          <tbody>
            <tr v-for="e in rows" :key="e.number">
              <td data-label="Evaluation"><strong>Evaluation {{ e.number }}</strong><small v-if="e.failure">{{ e.failure }}</small></td>
              <td data-label="State"><UiBadge :tone="stateTone(e.state)">{{ e.state_label }}</UiBadge></td>
              <td data-label="Verdict"><UiBadge v-if="e.verdict" :tone="verdictTone(e.verdict)">{{ e.verdict_label }}</UiBadge><span v-else>—</span></td>
              <td data-label="Started">{{ when(e.created_at) }}</td>
              <td class="row-actions"><UiButton @click="open(e.number)">Open evaluation {{ e.number }}</UiButton></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="more" class="more"><UiButton :disabled="listLoading" @click="loadList(true)">{{ listLoading ? 'Loading…' : 'Show more' }}</UiButton></div>
    </section>

    <!-- One evaluation -->
    <template v-else>
      <p v-if="loading && !detail">Loading…</p>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <template v-if="detail">
        <section class="panel">
          <div class="evaluation-head">
            <h2>Evaluation {{ detail.number }} · {{ model.name }} {{ detail.candidate.version }}</h2>
            <div class="evaluation-badges">
              <UiBadge :tone="stateTone(detail.state)">{{ detail.state_label }}</UiBadge>
              <UiBadge v-if="detail.verdict" :tone="verdictTone(detail.verdict)">{{ detail.verdict_label }}</UiBadge>
            </div>
          </div>
          <div v-if="told" class="notice" role="status"><span>{{ told }}</span><button class="icon-button" aria-label="Dismiss notification" @click="told=''"><X :size="14"/></button></div>
          <p v-if="detail.unfinished" class="evaluation-live" aria-live="polite"><Gauge :size="14"/> Still going: this page checks again every 5 seconds.</p>
          <p v-if="detail.failure" class="field-error">{{ detail.failure }}</p>
          <dl class="summary-list evaluation-facts"><template v-for="f in facts" :key="f[0]"><dt>{{ f[0] }}</dt><dd>{{ f[1] }}</dd></template></dl>
          <ul v-if="detail.reasons.length" class="evaluation-reasons"><li v-for="r in detail.reasons" :key="r">{{ r }}</li></ul>
          <RunProvenance :used="detail.used" :cost="detail.cost" what="evaluation"/>
          <p v-if="actionError" class="field-error" role="alert">{{ actionError }}</p>
          <div class="studio-actions">
            <UiButton v-if="detail.may.cancel" class="danger" :disabled="busy" @click="actionError='';confirming=true"><X :size="15"/> Cancel</UiButton>
            <UiButton v-if="detail.may.retry" variant="primary" :disabled="busy" @click="act('retry')"><RotateCw :size="15"/> {{ busy ? 'Starting…' : 'Try again' }}</UiButton>
            <a v-if="detail.report" class="button button--secondary" :href="detail.report" download>Download the evaluation report (JSON)</a>
          </div>
        </section>

        <section class="panel">
          <h3>Measures</h3>
          <p v-if="!detail.measures.length" class="muted">{{ detail.unfinished ? 'The measures appear when the evaluation finishes.' : 'This evaluation measured nothing.' }}</p>
          <div v-else class="table-wrap">
            <table class="ws-table">
              <thead><tr><th scope="col">Measure</th><th scope="col">This model</th><th scope="col">{{ detail.previous ? `Previous (${detail.previous.version})` : 'Previous model' }}</th><th scope="col">{{ criteriaApproved ? 'Target' : 'Proposed target' }}</th><th scope="col">Target met</th></tr></thead>
              <tbody>
                <tr v-for="ms in detail.measures" :key="ms.key">
                  <td data-label="Measure"><strong>{{ ms.label }}</strong><small v-if="ms.note">{{ ms.note }}</small></td>
                  <td data-label="This model">{{ measureText(ms.key, ms.value) }}</td>
                  <td data-label="Previous model">{{ measureText(ms.key, ms.previous) }}</td>
                  <td data-label="Target">{{ ms.direction==='at_most'?'≤':'≥' }} {{ measureText(ms.key, ms.threshold) }}</td>
                  <td data-label="Target met"><UiBadge :tone="metTone(ms.met)">{{ metText(ms.met) }}</UiBadge></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <h3>Attempts</h3>
          <AttemptsTable :attempts="detail.attempts" caption="The attempts of this evaluation" empty="No attempt yet: the evaluation waits for a machine."/>
          <h3>The end of the log</h3>
          <pre class="code-block evaluation-log" tabindex="0" aria-label="The end of the newest attempt's log">{{ detail.log || 'Nothing written yet.' }}</pre>
        </section>
      </template>
    </template>

    <UiDialog :open="confirming" :title="detail ? `Cancel evaluation ${detail.number}` : 'Cancel evaluation'" @close="confirming=false">
      <p class="dialog-description">This stops the evaluation's job and the machine it runs on. You can try it again afterwards.</p>
      <p v-if="actionError" class="field-error" role="alert">{{ actionError }}</p>
      <div class="dialog-actions"><UiButton @click="confirming=false">Keep it running</UiButton><UiButton variant="primary" class="danger-fill" :disabled="busy" @click="act('cancel')">{{ busy ? 'Cancelling…' : 'Cancel evaluation' }}</UiButton></div>
    </UiDialog>
  </div>
</template>

<style scoped>
.badge--red{color:#b42318;background:#fef3f2}
.badge--amber{color:#93610b;background:#fff4dc}
.evaluations{display:grid;gap:16px}
.evaluations .panel{padding:22px}
.evaluations h3{margin:0 0 10px}
.evaluation-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}
.evaluation-head h2{margin:0;font-size:16px}
.evaluation-badges{display:flex;gap:6px;flex-wrap:wrap}
.evaluation-live{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--aadml-primary)!important}
.evaluation-facts{margin:14px 0}
.evaluation-reasons{margin:0 0 12px;padding-left:18px;font-size:12px;color:#48566c}
.evaluation-log{max-height:360px;overflow:auto;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}
.evaluation-log:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.muted{font-size:12px!important;color:#5f6d82!important}
.danger{color:#b42318;border-color:#fda29b}
.danger-fill{background:#d92d20;border-color:#d92d20}
.more{display:flex;justify-content:center;margin:16px 0 0}
.ws-table td{vertical-align:top;font-size:12px}
.ws-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:4px}
.ws-table .row-actions{width:1%;white-space:nowrap}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:650px){
  .ws-table thead{display:none}
  .ws-table,.ws-table tbody,.ws-table tr,.ws-table td{display:block;width:100%}
  .ws-table tr{border-bottom:1px solid #e9eaf0;padding:10px 0}
  .ws-table td{border:0!important;padding:6px 14px!important}
  .ws-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:2px}
  .ws-table .row-actions{width:100%;white-space:normal}
}
</style>
