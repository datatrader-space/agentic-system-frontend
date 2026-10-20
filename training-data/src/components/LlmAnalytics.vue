<script setup>
// The analytics page's LLM form (plan §2.1, §9): evaluations of a model version against its base model, started with
// the choice of who marks the answers (automatic measures only, people, the AI judge, or both); each evaluation's
// measures, marks, the judge's calibration and spend, the agreement between people and the judge, and the verdict.
// The project's own test questions (versioned, written or uploaded) and the Owner's acceptance criteria.
// Backend: llm/app_api.py, llm/evaluations.py, llm/judge.py, llm/suites.py.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Play, RefreshCw, X, RotateCw, ArrowLeft, Plus, Trash2, Upload, Save, CheckCheck } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import { llmApi, percent, verdictLabel, verdictTone, tallyParts, tallyInWords, questionRows, questionCases, requestKey } from '../api/llm.js';
import { ago } from '../api/training.js';
import './llm.css';

const props = defineProps({ project: Object });
const emit = defineEmits(['navigate']);
const TABS = ['Evaluations', 'Test questions', 'Acceptance criteria'];
const tab = ref('Evaluations'); const page = ref(null); const error = ref(''); const told = ref(''); const busy = ref(false);
const opened = ref(null); const revealed = ref(null);
const form = ref({ model: '', marking: 'none', reviewers: [], cap: '', items: 50, tokens: 128, runtime: 3600 });
const judgeForm = ref({ model: '', rubric: '', open: false });
let timer = null;

const UNFINISHED = ['queued', 'starting', 'running', 'finalizing', 'judging', 'waiting_people'];
const unfinished = e => UNFINISHED.includes(e?.state);
const stateTone = state => (state === 'succeeded' ? 'green' : UNFINISHED.includes(state) ? 'purple' : 'neutral');
const usesJudge = computed(() => ['ai', 'both'].includes(form.value.marking));
const usesPeople = computed(() => ['people', 'both'].includes(form.value.marking));
const MARKING_HELP = {
  none: 'Closeness to the expected answers, validation loss, tool calls and safety prompts, measured by the job. No marks.',
  people: 'Reviewers you choose see each pair of answers blind and say which is better. No cost, and nothing leaves AADML.',
  ai: 'A bigger model marks every pair, in both orders, after its calibration passed. It costs a little, within the cap you set.',
  both: 'People and the AI judge mark the same pairs. The page shows how often they agree.',
};

async function load() {
  error.value = '';
  try {
    page.value = await llmApi.evaluations(props.project.ref);
    if (!form.value.model && page.value.models.length) form.value.model = page.value.models[0].version;
    if (!form.value.cap) form.value.cap = page.value.choices.default_judge_cap;
    form.value.items = form.value.items || page.value.choices.default_max_items;
    if (!judgeForm.value.rubric) judgeForm.value.rubric = page.value.judge?.rubric || page.value.default_rubric;
    if (opened.value) opened.value = await llmApi.evaluation(props.project.ref, opened.value.number);
  } catch (e) { error.value = e.message; }
  clearTimeout(timer);
  if (page.value?.evaluations.some(unfinished) || unfinished(opened.value)) timer = setTimeout(load, 4000);
}

async function start() {
  busy.value = true; error.value = ''; told.value = '';
  try {
    const started = await llmApi.startEvaluation(props.project.ref, {
      model_version: Number(form.value.model), marking: form.value.marking, reviewers: usesPeople.value ? form.value.reviewers : [],
      judge: usesJudge.value ? page.value.judge?.id : undefined, judge_cap_usd: usesJudge.value ? form.value.cap : undefined,
      max_items: Number(form.value.items), max_new_tokens: Number(form.value.tokens), max_runtime_seconds: Number(form.value.runtime),
      idempotency_key: requestKey(),
    });
    told.value = `Evaluation ${started.number} is ${started.state_label.toLowerCase()}.`;
    await load();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function setUpJudge() {
  busy.value = true; error.value = ''; told.value = '';
  try {
    await llmApi.setUpJudge(props.project.ref, { llm_model: Number(judgeForm.value.model), rubric: judgeForm.value.rubric });
    judgeForm.value.open = false;
    told.value = 'The judge is set up. It is calibrated at the start of the first evaluation it marks.';
    await load();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function open(evaluation) {
  error.value = ''; told.value = ''; revealed.value = null;
  try { opened.value = await llmApi.evaluation(props.project.ref, evaluation.number); } catch (e) { error.value = e.message; }
  clearTimeout(timer);
  if (unfinished(opened.value)) timer = setTimeout(load, 4000);
}
async function move(name) {
  busy.value = true; error.value = '';
  try { opened.value = await llmApi.evaluationMove(props.project.ref, opened.value.number, name); await load(); }
  catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function reveal() {
  try { revealed.value = (await llmApi.evaluationPairs(props.project.ref, opened.value.number)).pairs; } catch (e) { error.value = e.message; }
}
const judgeCalibration = judge => (judge?.passed == null ? 'Not calibrated yet: it is calibrated at the start of the first evaluation it marks.'
  : judge.passed ? `Calibration passed: it preferred the right answer in ${percent(judge.calibration?.share)} of the test pairs.`
    : `Calibration failed: it preferred the right answer in only ${percent(judge.calibration?.share)} of the test pairs. It marks nothing.`);
const DECISION = { a: 'A', b: 'B', same: 'The same', both_wrong: 'Both wrong', invalid: 'Unreadable', '': '—' };
const whoWon = (p, decision) => (!decision ? '—' : decision === p.trained_is ? 'Trained' : ['a', 'b'].includes(decision) ? 'Base' : DECISION[decision]);

// ── Test questions ──
const questions = ref(null); const rows = ref([]); const upload = ref(null); const replace = ref(false); const lineErrors = ref([]);
async function loadQuestions() {
  try { questions.value = await llmApi.questions(props.project.ref); rows.value = questionRows(questions.value.suite?.cases); }
  catch (e) { error.value = e.message; }
}
async function saveQuestions() {
  busy.value = true; error.value = ''; told.value = ''; lineErrors.value = [];
  try {
    const saved = await llmApi.saveQuestions(props.project.ref, questionCases(rows.value));
    told.value = `Saved as version ${saved.suite.version}: ${saved.suite.questions} questions.`;
    await loadQuestions(); await load();
  } catch (e) { error.value = e.message; lineErrors.value = e.errors || []; }
  finally { busy.value = false; }
}
async function uploadQuestions() {
  const file = upload.value?.files?.[0];
  if (!file) return;
  busy.value = true; error.value = ''; told.value = ''; lineErrors.value = [];
  try {
    const saved = await llmApi.uploadQuestions(props.project.ref, file, replace.value);
    told.value = `${saved.added} question(s) ${replace.value ? 'now replace the ones before' : 'added'}: version ${saved.suite.version} holds ${saved.suite.questions}.`;
    upload.value.value = '';
    await loadQuestions(); await load();
  } catch (e) { error.value = e.message; lineErrors.value = e.errors || []; }
  finally { busy.value = false; }
}

// ── Acceptance criteria ──
const criteriaForm = ref({ win: '', f1: '', safety: '' });
const asShare = v => (v === '' || v == null ? null : Number(v) / 100);
async function approveCriteria() {
  busy.value = true; error.value = ''; told.value = '';
  try {
    const made = await llmApi.approveCriteria(props.project.ref, { min_win_rate: asShare(criteriaForm.value.win),
      min_token_f1: asShare(criteriaForm.value.f1), max_safety_losses: asShare(criteriaForm.value.safety) });
    told.value = `Version ${made.criteria.version} of the acceptance criteria is approved. Evaluations that finish from now on are judged by it.`;
    await load();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
watch(() => page.value?.criteria, c => {
  if (c) criteriaForm.value = { win: c.min_win_rate == null ? '' : Math.round(c.min_win_rate * 100), f1: c.min_token_f1 == null ? '' : Math.round(c.min_token_f1 * 100), safety: c.max_safety_losses == null ? '' : Math.round(c.max_safety_losses * 100) };
});
watch(tab, t => { error.value = ''; told.value = ''; if (t === 'Test questions' && !questions.value) loadQuestions(); });

const measureRows = computed(() => {
  const m = opened.value?.measures || {};
  const rowsOut = [];
  const side = (set, key) => [m[set]?.trained?.[key], m[set]?.base?.[key]];
  if (m.test?.items) {
    rowsOut.push(['Token F1 on the test split', ...side('test', 'token_f1').map(v => percent(v, 1))]);
    rowsOut.push(['Exact match on the test split', ...side('test', 'exact_match').map(v => percent(v, 1))]);
    rowsOut.push(['ROUGE-L on the test split', ...side('test', 'rouge_l').map(v => percent(v, 1))]);
  }
  if (m.cases?.items && m.cases?.trained) rowsOut.push(['Token F1 on your questions', ...side('cases', 'token_f1').map(v => percent(v, 1))]);
  if (m.validation?.trained) {
    rowsOut.push(['Validation loss', m.validation.trained.loss?.toFixed(3) ?? '—', m.validation.base?.loss?.toFixed(3) ?? '—']);
    rowsOut.push(['Perplexity', m.validation.trained.perplexity?.toFixed(2) ?? '—', m.validation.base?.perplexity?.toFixed(2) ?? '—']);
  }
  if (m.tool_calls) rowsOut.push(['Readable tool calls', percent(m.tool_calls.trained), percent(m.tool_calls.base)]);
  return rowsOut;
});

onMounted(load);
onUnmounted(() => clearTimeout(timer));
</script>

<template>
  <div class="studio llm-analytics">
    <div class="studio-actions">
      <div class="studio-tabs" role="tablist" aria-label="Analytics">
        <button v-for="t in TABS" :key="t" role="tab" :aria-selected="tab === t" :class="{ active: tab === t }" @click="tab = t; opened = null">{{ t }}</button>
      </div>
      <UiButton @click="tab === 'Test questions' ? loadQuestions() : load()"><RefreshCw :size="15" /> Refresh</UiButton>
    </div>
    <div v-if="told" class="notice" role="status"><CheckCheck :size="16" /><span>{{ told }}</span></div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <ul v-if="lineErrors.length" class="llm-line-errors" aria-label="Lines that could not be read"><li v-for="e in lineErrors" :key="e.line">Line {{ e.line }}: {{ e.error }}</li></ul>
    <p v-if="!page && !error" class="llm-loading">Loading…</p>

    <!-- Evaluations -->
    <template v-if="page && tab === 'Evaluations' && !opened">
      <section v-if="!page.models.length" class="panel empty-state"><h2>No model to evaluate yet</h2><p>An evaluation measures a trained model version against its base model. Train one first.</p><UiButton @click="emit('navigate', 'train')">Go to training</UiButton></section>
      <section v-else-if="page.can_train" class="panel">
        <div class="eyebrow">NEW EVALUATION</div>
        <h2>Measure a model against its base model</h2>
        <div class="llm-grid">
          <label class="field-label">Model version<select v-model="form.model" class="text-input"><option v-for="m in page.models" :key="m.version" :value="m.version">{{ m.name }} · {{ m.method.toUpperCase() }} on {{ m.base_model }}</option></select></label>
          <label class="field-label">Questions from the test split, at most<select v-model="form.items" class="text-input"><option v-for="n in page.choices.max_items" :key="n" :value="n">{{ n }}</option></select></label>
          <label class="field-label">Longest answer<select v-model="form.tokens" class="text-input"><option v-for="n in page.choices.max_new_tokens" :key="n" :value="n">{{ n }} tokens</option></select></label>
          <label class="field-label">Longest it may run<select v-model="form.runtime" class="text-input"><option v-for="r in page.choices.max_runtimes" :key="r.value" :value="r.value">{{ r.label }}</option></select></label>
        </div>
        <p class="field-help">{{ page.questions ? `Your test questions, version ${page.questions.version} (${page.questions.questions}), are asked too, and a fixed set of safety prompts.` : 'The project has no test questions of its own yet; write them on the Test questions tab. A fixed set of safety prompts is always asked.' }}</p>

        <fieldset class="llm-marking">
          <legend class="field-label">Who marks the answers</legend>
          <label v-for="m in page.choices.marking" :key="m.value" :class="['llm-marking-card', { active: form.marking === m.value, disabled: ['ai', 'both'].includes(m.value) && !page.judge_allowed }]">
            <input v-model="form.marking" type="radio" name="marking" :value="m.value" :disabled="['ai', 'both'].includes(m.value) && !page.judge_allowed">
            <strong>{{ m.label }}</strong><small>{{ MARKING_HELP[m.value] }}</small>
          </label>
        </fieldset>
        <p v-if="!page.judge_allowed" class="field-help">The AI judge is not offered: the project's data-use answers do not allow its conversations to be shown to an AI judge's provider. Its Owner can change that answer in the project's settings.</p>

        <fieldset v-if="usesPeople" class="llm-reviewers">
          <legend class="field-label">Reviewers (the pairs are shared out among them)</legend>
          <p v-if="!page.reviewers.length" class="field-help">No one in the project may mark answers yet. Give someone the Labeller or Preparer role on the Members page.</p>
          <label v-for="r in page.reviewers" :key="r.id" class="llm-check"><input v-model="form.reviewers" type="checkbox" :value="r.id"> {{ r.name }}</label>
        </fieldset>

        <div v-if="usesJudge" class="llm-judge">
          <h3>The AI judge</h3>
          <p v-if="page.judge" class="field-help"><strong>{{ page.judge.model }}</strong> · {{ judgeCalibration(page.judge) }}</p>
          <p v-else class="field-help">No judge is set up yet. Choose the judge model and what a good answer has.</p>
          <UiButton v-if="page.judge && !judgeForm.open" @click="judgeForm.open = true">Change the judge</UiButton>
          <div v-if="!page.judge || judgeForm.open" class="llm-judge-form">
            <label class="field-label">Judge model<select v-model="judgeForm.model" class="text-input"><option value="" disabled>Choose a model you may use</option><option v-for="m in page.judge_models" :key="m.id" :value="m.id">{{ m.name }} ({{ m.provider }})</option></select></label>
            <p v-if="!page.judge_models.length" class="field-help">You have no model with a price in AADML that can judge. Add a provider and its models in AADML's settings.</p>
            <p class="field-help">The judge must be of another model family than the model judged ({{ page.models.find(m => m.version === Number(form.model))?.base_model }}).</p>
            <label class="field-label" for="llm-judge-rubric">Rubric: what a good answer has</label>
            <textarea id="llm-judge-rubric" v-model="judgeForm.rubric" class="text-input" rows="3"></textarea>
            <div class="dialog-actions"><UiButton v-if="page.judge" @click="judgeForm.open = false">Keep the current judge</UiButton><UiButton variant="primary" :disabled="busy || !judgeForm.model" @click="setUpJudge">Set up the judge</UiButton></div>
          </div>
          <label class="field-label">Spending cap for this evaluation<select v-model="form.cap" class="text-input llm-narrow"><option v-for="c in page.choices.judge_caps" :key="c" :value="c">US$ {{ c }}</option></select></label>
          <p class="field-help">Every call is priced as it is made. Before a pair is asked, its cost is estimated; when it would pass the cap the judge stops and the result is inconclusive, never passed.</p>
        </div>

        <div class="dialog-actions"><UiButton variant="primary" :disabled="busy || !form.model || (usesPeople && !form.reviewers.length) || (usesJudge && (!page.judge || page.judge.passed === false))" @click="start"><Play :size="15" /> {{ busy ? 'Starting…' : 'Start the evaluation' }}</UiButton></div>
      </section>
      <section v-else class="panel"><p>Only the project's Owner starts an evaluation. Every evaluation is listed below.</p></section>

      <section v-if="page.evaluations.length" class="panel">
        <h2>Evaluations</h2>
        <table class="llm-table"><thead><tr><th>Evaluation</th><th>Model</th><th>Marked by</th><th>State</th><th>Verdict</th><th>Win rate</th><th>Judge spend</th><th>Started</th></tr></thead><tbody>
          <tr v-for="e in page.evaluations" :key="e.number" class="llm-row" tabindex="0" @click="open(e)" @keydown.enter="open(e)">
            <td>{{ e.number }}</td><td>{{ e.model }}</td><td>{{ e.marking_label }}</td>
            <td><UiBadge :tone="stateTone(e.state)">{{ e.state_label }}</UiBadge></td>
            <td><UiBadge v-if="e.verdict" :tone="verdictTone(e.verdict)">{{ verdictLabel(e.verdict) }}</UiBadge><template v-else>—</template></td>
            <td>{{ percent((e.results?.people || e.results?.judge)?.overall?.win_rate) }}</td>
            <td>{{ e.judge ? `$${Number(e.judge_spent_usd).toFixed(2)} of $${Number(e.judge_cap_usd).toFixed(2)}` : '—' }}</td>
            <td>{{ ago(e.created_at) }}</td></tr>
        </tbody></table>
      </section>
    </template>

    <!-- One evaluation -->
    <template v-if="page && tab === 'Evaluations' && opened">
      <div class="studio-actions"><UiButton @click="opened = null; load()"><ArrowLeft :size="16" /> All evaluations</UiButton>
        <div class="dialog-actions">
          <UiButton v-if="page.can_manage && ['judging', 'waiting_people'].includes(opened.state) && ['people', 'both'].includes(opened.marking)" :disabled="busy" @click="move('close')">Close the marking now</UiButton>
          <UiButton v-if="page.can_train && unfinished(opened) && !opened.cancel_requested" :disabled="busy" @click="move('cancel')"><X :size="15" /> Cancel</UiButton>
          <UiButton v-if="page.can_train && ['failed', 'cancelled'].includes(opened.state)" :disabled="busy" @click="move('retry')"><RotateCw :size="15" /> Try again</UiButton>
        </div></div>
      <section class="panel">
        <h2>Evaluation {{ opened.number }} · {{ opened.model }} against {{ opened.base_model }} <UiBadge :tone="stateTone(opened.state)">{{ opened.state_label }}</UiBadge></h2>
        <p v-if="opened.failure" class="field-error">{{ opened.failure }}</p>
        <p v-if="opened.progress" class="field-help" aria-live="polite">Answering: {{ opened.progress.steps_done }} of {{ opened.progress.steps }} questions.</p>
        <p v-if="opened.state === 'waiting_people'" class="field-help" aria-live="polite">Waiting for people: {{ opened.results?.people?.given - opened.results?.people?.unmarked }} of {{ opened.results?.people?.given }} pairs are marked. {{ page.can_manage ? 'You may close the marking now; the marked pairs then count.' : '' }}</p>
        <p v-if="opened.state === 'judging'" class="field-help" aria-live="polite">The AI judge marks the answers, a few minutes at a time.</p>
        <div v-if="opened.verdict" class="llm-verdict"><UiBadge :tone="verdictTone(opened.verdict)">{{ verdictLabel(opened.verdict) }}</UiBadge><ul><li v-for="(r, i) in opened.verdict_reasons" :key="i">{{ r }}</li></ul></div>
        <dl class="llm-facts">
          <dt>Marked by</dt><dd>{{ opened.marking_label }}{{ opened.reviewers?.length ? `: ${opened.reviewers.map(r => r.name).join(', ')}` : '' }}</dd>
          <dt>Questions</dt><dd>Up to {{ opened.config_given?.max_items }} from the test split{{ opened.questions ? `, your test questions version ${opened.questions}` : '' }}, and the safety prompts; answers up to {{ opened.config_given?.max_new_tokens }} tokens</dd>
          <template v-if="opened.judge"><dt>AI judge</dt><dd>{{ opened.judge.model }} · spent ${{ Number(opened.judge_spent_usd).toFixed(4) }} of ${{ Number(opened.judge_cap_usd).toFixed(2) }}{{ opened.judge_note ? ` · stopped: ${opened.judge_note}` : '' }}</dd></template>
          <template v-if="opened.criteria"><dt>Criteria</dt><dd>Version {{ opened.criteria.version }}</dd></template>
          <dt>Started</dt><dd>{{ ago(opened.created_at) }} by {{ opened.created_by || 'someone' }}</dd>
        </dl>
      </section>

      <section v-if="measureRows.length" class="panel">
        <h2>Measured by the job</h2>
        <table class="llm-table llm-measures"><thead><tr><th>Measure</th><th>Trained model</th><th>Base model</th></tr></thead><tbody>
          <tr v-for="row in measureRows" :key="row[0]"><td>{{ row[0] }}</td><td>{{ row[1] }}</td><td>{{ row[2] }}</td></tr>
        </tbody></table>
      </section>

      <section v-for="who in ['people', 'judge'].filter(w => opened.results?.[w])" :key="who" class="panel">
        <h2>{{ who === 'people' ? 'Marked by people' : 'Marked by the AI judge' }}</h2>
        <p v-if="who === 'judge'" class="field-help">{{ judgeCalibration({ passed: opened.results.judge.calibration ? opened.results.judge.calibration.share >= opened.results.judge.calibration.needed : null, calibration: opened.results.judge.calibration }) }}{{ opened.results.judge.orders_disagreed ? ` In ${opened.results.judge.orders_disagreed} pair(s) its two orders disagreed; they count as the same.` : '' }}</p>
        <div v-for="set in [['overall', 'Test split and your questions'], ['safety', 'Safety prompts']]" :key="set[0]" class="llm-tally">
          <h3>{{ set[1] }}</h3>
          <div v-if="tallyParts(opened.results[who][set[0]]).length" class="llm-bar" role="img" :aria-label="tallyInWords(opened.results[who][set[0]])">
            <span v-for="p in tallyParts(opened.results[who][set[0]])" v-show="p.count" :key="p.key" :class="`llm-bar--${p.key}`" :style="{ width: `${p.width}%` }">{{ p.count }}</span>
          </div>
          <p class="field-help">{{ tallyInWords(opened.results[who][set[0]]) }}</p>
        </div>
        <p v-if="opened.results[who].unmarked" class="field-help">{{ opened.results[who].unmarked }} pair(s) were not marked.</p>
        <ul class="llm-legend" aria-hidden="true"><li class="llm-bar--trained_better">Trained better</li><li class="llm-bar--same">The same</li><li class="llm-bar--both_wrong">Both wrong</li><li class="llm-bar--base_better">Base better</li></ul>
      </section>

      <section v-if="opened.results?.agreement" class="panel">
        <h2>People and the AI judge</h2>
        <p class="llm-big">{{ percent(opened.results.agreement.share) }} <small>agreement on {{ opened.results.agreement.pairs }} pairs both marked</small></p>
        <p class="field-help">How often the judge gave the same mark as the person. A high agreement says the judge can be trusted on its own next time.</p>
        <table v-if="opened.agreement_pairs?.length" class="llm-table"><thead><tr><th>Pair</th><th>Set</th><th>Person</th><th>AI judge</th><th>Agreed</th></tr></thead><tbody>
          <tr v-for="a in opened.agreement_pairs" :key="a.position"><td>{{ a.position }}</td><td>{{ a.set }}</td><td>{{ DECISION[a.people] }}</td><td>{{ DECISION[a.judge] }}</td><td>{{ a.agreed ? 'Yes' : 'No' }}</td></tr>
        </tbody></table>
      </section>

      <section v-if="['succeeded', 'cancelled'].includes(opened.state) && opened.marking !== 'none'" class="panel">
        <div class="studio-actions"><h2>The answers</h2><UiButton v-if="!revealed" @click="reveal">Show the answers with their models</UiButton></div>
        <table v-if="revealed" class="llm-table llm-answers"><thead><tr><th>Question</th><th>Answer A</th><th>Answer B</th><th>Trained</th><th>Person</th><th>AI judge</th></tr></thead><tbody>
          <tr v-for="p in revealed" :key="p.id"><td>{{ p.prompt.at(-1)?.content }}</td><td>{{ p.answer_a }}</td><td>{{ p.answer_b }}</td><td>{{ p.trained_is.toUpperCase() }}</td><td>{{ whoWon(p, p.decision) }}</td><td>{{ whoWon(p, p.judge_decision) }}</td></tr>
        </tbody></table>
      </section>

      <section class="panel"><details><summary>The job's log</summary><pre class="code-block llm-log">{{ opened.log || 'Nothing written yet.' }}</pre></details></section>
    </template>

    <!-- Test questions -->
    <template v-if="tab === 'Test questions'">
      <p v-if="!questions" class="llm-loading">Loading…</p>
      <section v-else class="panel">
        <div class="eyebrow">{{ questions.suite ? `VERSION ${questions.suite.version} · ${questions.suite.questions} QUESTIONS` : 'NO QUESTIONS YET' }}</div>
        <h2>Your own test questions</h2>
        <p class="field-help">Questions your customers ask, each with the answer you expect, a rubric (what a good answer has), or both. Every evaluation asks them, and they are never trained on: preparation leaves out any example that shares 13 words in a row with one of them. A change is saved as a new version.</p>
        <ol class="llm-questions">
          <li v-for="(row, i) in rows" :key="i" class="llm-question">
            <label class="field-label" :for="`q-${i}`">Question {{ i + 1 }}</label>
            <textarea :id="`q-${i}`" v-model="row.question" class="text-input" rows="2" :disabled="!questions.can_write"></textarea>
            <div class="llm-grid">
              <label class="field-label">Expected answer<textarea v-model="row.expected" class="text-input" rows="2" :disabled="!questions.can_write"></textarea></label>
              <label class="field-label">Rubric<textarea v-model="row.rubric" class="text-input" rows="2" :disabled="!questions.can_write" placeholder="For example: names the five working days."></textarea></label>
            </div>
            <UiButton v-if="questions.can_write" :aria-label="`Remove question ${i + 1}`" @click="rows.splice(i, 1)"><Trash2 :size="14" /> Remove</UiButton>
          </li>
        </ol>
        <p v-if="!rows.length" class="field-help">No question yet.</p>
        <div v-if="questions.can_write" class="dialog-actions">
          <UiButton :disabled="rows.length >= questions.max_questions" @click="rows.push({ question: '', expected: '', rubric: '', tags: [] })"><Plus :size="15" /> Add a question</UiButton>
          <UiButton variant="primary" :disabled="busy || !rows.some(r => r.question.trim())" @click="saveQuestions"><Save :size="15" /> {{ busy ? 'Saving…' : `Save as version ${(questions.suite?.version || 0) + 1}` }}</UiButton>
        </div>
      </section>
      <section v-if="questions?.can_write" class="panel">
        <h2>Upload questions</h2>
        <p class="field-help">A JSONL file, one question a line: <code>{"question": "…", "expected": "…", "rubric": "…"}</code> (or <code>"messages"</code> for a longer conversation), or a CSV file with the columns question, expected, rubric. Every bad line is named, and then nothing is saved.</p>
        <label class="field-label" for="llm-questions-file">File</label>
        <input id="llm-questions-file" ref="upload" class="text-input" type="file" accept=".jsonl,.json,.csv,text/csv,application/json">
        <label class="llm-check"><input v-model="replace" type="checkbox"> Replace the current questions instead of adding to them</label>
        <div class="dialog-actions"><UiButton variant="primary" :disabled="busy" @click="uploadQuestions"><Upload :size="15" /> Upload</UiButton></div>
      </section>
    </template>

    <!-- Acceptance criteria -->
    <template v-if="page && tab === 'Acceptance criteria'">
      <section class="panel">
        <div class="eyebrow">{{ page.criteria ? `VERSION ${page.criteria.version}` : 'NONE APPROVED' }}</div>
        <h2>When a model is good enough</h2>
        <p class="field-help">Until the Owner approves thresholds, every evaluation is "measured" only. With them, an evaluation passes when it meets every threshold and fails when it misses one. A measure that could not be taken makes it inconclusive: a missing measure never counts as a pass.</p>
        <dl v-if="page.criteria" class="llm-facts">
          <dt>Win rate over the base model</dt><dd>{{ page.criteria.min_win_rate == null ? 'not set' : `at least ${percent(page.criteria.min_win_rate)}` }}</dd>
          <dt>Token F1 on the test split</dt><dd>{{ page.criteria.min_token_f1 == null ? 'not set' : `at least ${percent(page.criteria.min_token_f1)}` }}</dd>
          <dt>Safety prompts answered worse</dt><dd>{{ page.criteria.max_safety_losses == null ? 'not set' : `at most ${percent(page.criteria.max_safety_losses)}` }}</dd>
          <dt>Approved</dt><dd>{{ ago(page.criteria.approved_at) }} by {{ page.criteria.approved_by || 'the Owner' }}</dd>
        </dl>
        <template v-if="page.can_manage">
          <div class="llm-grid">
            <label class="field-label">Win rate at least (%)<input v-model="criteriaForm.win" class="text-input" type="number" min="0" max="100" inputmode="numeric" placeholder="not set"></label>
            <label class="field-label">Token F1 at least (%)<input v-model="criteriaForm.f1" class="text-input" type="number" min="0" max="100" inputmode="numeric" placeholder="not set"></label>
            <label class="field-label">Safety prompts worse, at most (%)<input v-model="criteriaForm.safety" class="text-input" type="number" min="0" max="100" inputmode="numeric" placeholder="not set"></label>
          </div>
          <div class="dialog-actions"><UiButton variant="primary" :disabled="busy || [criteriaForm.win, criteriaForm.f1, criteriaForm.safety].every(v => v === '' || v == null)" @click="approveCriteria">Approve as version {{ (page.criteria?.version || 0) + 1 }}</UiButton></div>
        </template>
        <p v-else class="field-help">Only the project's Owner approves the criteria.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.llm-analytics{display:grid;gap:16px}
/* A field inside its label takes the label's weight; what a person types is read as normal text. */
.llm-analytics .field-label>.text-input{font-weight:400;margin-top:8px}
.llm-analytics .text-input::placeholder{color:#64748b;font-weight:400}
.llm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:12px 0}
.llm-log{max-height:360px;overflow:auto;font-size:11px}
.llm-narrow{max-width:220px}
.llm-marking{border:0;padding:0;margin:8px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.llm-marking legend{margin-bottom:10px}
.llm-marking-card{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:start;border:1px solid #cbd5e1;border-radius:10px;padding:12px;cursor:pointer;background:#fff;transition:border-color .15s ease,background-color .15s ease}
.llm-marking-card input{margin-top:3px;grid-row:span 2}
.llm-marking-card strong{font-size:13px;color:#162139}
.llm-marking-card small{font-size:12px;line-height:1.5;color:#475569}
.llm-marking-card.active{border-color:var(--accent);background:var(--aadml-tint)}
.llm-marking-card.disabled{cursor:not-allowed;opacity:.6}
.llm-marking-card:focus-within{outline:3px solid var(--aadml-outline);outline-offset:2px}
.llm-reviewers{border:0;padding:0;margin:8px 0 0}
.llm-check{display:flex;gap:8px;align-items:center;font-size:13px;color:#162139;min-height:36px}
.llm-judge{border-top:1px solid #e2e8f0;margin-top:16px;padding-top:12px}
.llm-judge-form{margin-top:4px}
.llm-verdict{display:flex;gap:12px;align-items:flex-start;margin:12px 0;padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}
.llm-verdict ul{margin:0;padding-left:18px;font-size:13px;color:#162139;line-height:1.6}
.llm-tally{margin:12px 0}
.llm-tally h3{font-size:13px;margin-bottom:6px}
.llm-bar{display:flex;height:26px;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0}
.llm-bar span{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;min-width:22px}
.llm-bar--trained_better{background:#0f766e;color:#fff}
.llm-bar--same{background:#cbd5e1;color:#162139}
.llm-bar--both_wrong{background:#fde68a;color:#162139}
.llm-bar--base_better{background:#9f1239;color:#fff}
.llm-legend{list-style:none;display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:8px 0 0}
.llm-legend li{font-size:11px;padding:3px 8px;border-radius:5px}
.llm-big{font-size:28px;font-weight:650;color:#162139;margin:6px 0}
.llm-big small{font-size:13px;font-weight:400;color:#475569}
.llm-questions{list-style:none;padding:0;margin:12px 0;display:grid;gap:14px}
.llm-question{border:1px solid #e2e8f0;border-radius:10px;padding:4px 14px 14px}
.llm-question textarea{resize:vertical}
.llm-line-errors{margin:0;padding:10px 10px 10px 28px;border:1px solid #fecaca;background:#fef2f2;border-radius:8px;font-size:12px;color:#7f1d1d;max-height:200px;overflow:auto}
.llm-answers td{max-width:280px;white-space:pre-wrap;overflow-wrap:anywhere}
@media (max-width:700px){.llm-verdict{flex-direction:column}}
@media (prefers-reduced-motion:reduce){.llm-marking-card{transition:none}}
</style>
