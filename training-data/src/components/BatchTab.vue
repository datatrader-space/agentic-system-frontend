<script setup>
// The Deployments page's "Batch Processing" tab: run one of a project's models over that project's own photos (all of
// them, or one dataset version), follow it while it runs, and download what it found in each photo.
// Backend: training_models_data/batch_api.py (workspace/batches/, .../<id>/cancel/, .../<id>/results/).
// The list is read when the tab opens, and again every 3 seconds while a batch is queued or running.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Ban, Check, Download, Images, Info, Layers, LoaderCircle, Plus, RefreshCw } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { timeAgo } from '../api/workspace.js';
import {
  batchApi, DEFAULT_LIMIT, photoChoices, sourceOf, photosText, limitProblem, startProblem, modelLabel, batchSummary,
  batchState, isActive, anyActive, progressParts, progressText, changeNotes, POLL_MS,
} from '../api/batch.js';

const page = ref(null); const error = ref(''); const loading = ref(false);
const said = ref(''); const announce = ref('');
const batches = computed(() => page.value?.batches || []);
const projects = computed(() => page.value?.options?.projects || []);
const limit = computed(() => Number(page.value?.limit) || DEFAULT_LIMIT);
const limitNote = computed(() => page.value?.limit_note || `A batch takes at most ${DEFAULT_LIMIT} photos for now.`);
const may = computed(() => page.value?.may || {});

let timer = null; let gone = false;
function stopPolling() { clearTimeout(timer); timer = null; }
function schedule() {
  stopPolling();
  if (!gone && anyActive(batches.value)) timer = setTimeout(load, POLL_MS);
}
function take(body) {
  if (!body) return;
  const notes = changeNotes(page.value?.batches, body.batches);
  if (notes) announce.value = notes;
  page.value = body;
}
async function load() {
  if (loading.value) return;
  loading.value = true;
  try { take(await batchApi.list()); error.value = ''; }
  catch (e) { error.value = e.message; }
  finally { loading.value = false; schedule(); }
}
onMounted(load);
onUnmounted(() => { gone = true; stopPolling(); });

// ── "New batch" ────────────────────────────────────────────────────────────────────────────────────
const creating = ref(false); const starting = ref(false); const formError = ref(''); const fieldErrors = ref({});
const form = ref({ project: '', model: '', photos: 'all' });
const chosenProject = computed(() => projects.value.find(p => p.ref === form.value.project) || null);
const models = computed(() => chosenProject.value?.models || []);
const chosenModel = computed(() => models.value.find(m => String(m.number) === String(form.value.model)) || null);
const choices = computed(() => photoChoices(chosenProject.value));
const chosenPhotos = computed(() => choices.value.find(c => c.value === form.value.photos) || null);
const why = computed(() => startProblem({ may: may.value, project: chosenProject.value, model: chosenModel.value, choice: chosenPhotos.value, limit: limit.value }));
const summary = computed(() => (why.value ? '' : batchSummary(chosenProject.value, chosenModel.value, chosenPhotos.value)));

// A changed project keeps the model and the photos only while they are still its own.
watch(() => form.value.project, () => {
  if (!models.value.some(m => String(m.number) === String(form.value.model))) form.value.model = models.value[0] ? String(models.value[0].number) : '';
  if (!choices.value.some(c => c.value === form.value.photos)) form.value.photos = 'all';
  fieldErrors.value = {};
});

function openCreate() {
  const first = projects.value.find(p => !p.running && (p.models || []).length) || projects.value[0];
  form.value = { project: first?.ref || '', model: first?.models?.[0] ? String(first.models[0].number) : '', photos: 'all' };
  const fits = photoChoices(first).find(c => !limitProblem(c.photos, limit.value));
  if (fits) form.value.photos = fits.value;
  formError.value = ''; fieldErrors.value = {}; said.value = '';
  creating.value = true;
}
const FIELDS = { project: 'project', model: 'model', source: 'photos', version: 'photos' };
async function startBatch() {
  formError.value = ''; fieldErrors.value = {};
  if (why.value || starting.value) return;
  starting.value = true;
  try {
    const { source, version } = sourceOf(form.value.photos);
    const body = await batchApi.start({ project: form.value.project, model: Number(form.value.model), source, version });
    take(body);
    said.value = body?.said || 'The batch has started.';
    announce.value = said.value;
    creating.value = false;
  } catch (e) {
    if (e.field && FIELDS[e.field]) fieldErrors.value = { [FIELDS[e.field]]: e.message };
    else formError.value = e.message;
    if (e.code === 'timeout' || e.code === 'network') load();       // a start whose answer was lost may have been made
  } finally { starting.value = false; schedule(); }
}

// ── Cancel, always confirmed first ────────────────────────────────────────────────────────────────
const cancelling = ref(null); const cancelBusy = ref(false); const cancelError = ref('');
function askCancel(b) { cancelling.value = b; cancelError.value = ''; }
async function confirmCancel() {
  if (!cancelling.value || cancelBusy.value) return;
  cancelBusy.value = true;
  try {
    const body = await batchApi.cancel(cancelling.value.id);
    take(body);
    said.value = body?.said || 'The batch is cancelled.'; announce.value = said.value;
    cancelling.value = null;
  } catch (e) {
    cancelError.value = e.message;
    if (e.code === 'timeout' || e.code === 'network') load();
  } finally { cancelBusy.value = false; schedule(); }
}

// ── Download ─────────────────────────────────────────────────────────────────────────────────────
const downloading = ref(null); const downloadError = ref({});
async function download(b) {
  if (downloading.value) return;
  downloading.value = b.id; downloadError.value = {};
  try { const name = await batchApi.download(b.id); announce.value = `Downloading ${name}.`; }
  catch (e) { downloadError.value = { [b.id]: e.message }; }
  finally { downloading.value = null; }
}

const sourceLabel = b => (b.source === 'version' ? `Dataset version ${b.source_label}` : 'All photos');
function whenText(b) {
  if (b.finished_at) return `${b.state === 'done' ? 'Finished' : 'Ended'} ${timeAgo(b.finished_at)}`;
  return `Started ${timeAgo(b.created_at)}`;
}
</script>

<template>
  <section class="batch" role="tabpanel" aria-labelledby="batch-heading" :aria-busy="loading">
    <div class="bt-head">
      <div>
        <h2 id="batch-heading">Batch processing</h2>
        <p>Run one of a project's models over its photos, then download what it found in each one.</p>
      </div>
      <UiButton variant="primary" :disabled="!page" @click="openCreate"><Plus :size="15" aria-hidden="true"/> New batch</UiButton>
    </div>

    <p class="bt-limit"><Info :size="17" aria-hidden="true"/><span>{{ limitNote }}</span></p>
    <p v-if="page && may.start === false && may.reason" class="bt-closed" role="status">{{ may.reason }}</p>
    <div v-if="said" class="notice" role="status"><Check :size="16" aria-hidden="true"/><span>{{ said }}</span></div>
    <div v-if="error" class="bt-error" role="alert">
      <span>{{ error }}</span>
      <UiButton :disabled="loading" @click="load"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton>
    </div>

    <p v-if="!page && !error" class="bt-muted">Loading batches…</p>
    <div v-else-if="page && !batches.length" class="bt-empty">
      <span class="bt-empty-icon"><Layers :size="22" aria-hidden="true"/></span>
      <h3>No batch yet</h3>
      <p>Choose a model and a set of photos. The model looks at each photo and you get one file with every answer.</p>
      <UiButton variant="primary" :disabled="may.start === false" @click="openCreate"><Plus :size="15" aria-hidden="true"/> New batch</UiButton>
    </div>
    <ul v-else-if="page" class="bt-list" aria-label="Batches">
      <li v-for="b in batches" :key="b.id" class="bt-row" :class="b.state">
        <div class="bt-what">
          <strong>{{ b.project.name }}</strong>
          <span>{{ modelLabel(b.model) }}</span>
          <small><Images :size="13" aria-hidden="true"/> {{ sourceLabel(b) }}</small>
          <small>{{ whenText(b) }}<template v-if="b.by">, by {{ b.by }}</template></small>
        </div>

        <div class="bt-progress">
          <div class="bt-meter" role="progressbar" :aria-label="`Progress of the batch of ${b.project.name}`"
               aria-valuemin="0" :aria-valuemax="b.total" :aria-valuenow="progressParts(b).processed" :aria-valuetext="progressText(b)">
            <span class="bt-done" :style="{ width: `${progressParts(b).done}%` }"></span>
            <span class="bt-failed" :style="{ width: `${progressParts(b).failed}%` }"></span>
          </div>
          <p class="bt-count"><span>{{ progressText(b) }}</span><span class="bt-pct" aria-hidden="true">{{ progressParts(b).percent }}%</span></p>
          <p v-if="b.state === 'failed' && b.error" class="bt-why">{{ b.error }}</p>
          <p v-if="downloadError[b.id]" class="field-error" role="alert">{{ downloadError[b.id] }}</p>
        </div>

        <div class="bt-state">
          <UiBadge :tone="batchState(b)[0]"><LoaderCircle v-if="isActive(b)" class="bt-spin" :size="12" aria-hidden="true"/>{{ batchState(b)[1] }}</UiBadge>
          <small v-if="isActive(b) && b.stage_label">{{ b.stage_label }}</small>
        </div>

        <div class="bt-acts">
          <UiButton v-if="b.may.download" :disabled="downloading === b.id" :aria-label="`Download results of the batch of ${b.project.name}`" @click="download(b)">
            <LoaderCircle v-if="downloading === b.id" class="bt-spin" :size="14" aria-hidden="true"/><Download v-else :size="14" aria-hidden="true"/> Download results
          </UiButton>
          <UiButton v-if="b.may.cancel" :aria-label="`Cancel the batch of ${b.project.name}`" @click="askCancel(b)"><Ban :size="14" aria-hidden="true"/> Cancel</UiButton>
        </div>
      </li>
    </ul>
    <p class="bt-sr" aria-live="polite">{{ announce }}</p>

    <UiDialog class="bt-dialog" :open="creating" title="New batch" @close="creating=false">
      <form class="bt-form" novalidate @submit.prevent="startBatch">
        <p class="dialog-description">Choose a model and the photos it should look at. Nothing starts until you press Start batch.</p>

        <div class="bt-row2">
          <div class="bt-field">
            <label for="bt-project">Project</label>
            <select id="bt-project" v-model="form.project" class="text-input" :aria-invalid="!!fieldErrors.project" aria-describedby="bt-project-error">
              <option v-if="!projects.length" value="">No project you can run a batch in</option>
              <option v-for="p in projects" :key="p.ref" :value="p.ref">{{ p.name }}{{ p.running ? ' (a batch is running)' : '' }}</option>
            </select>
            <p id="bt-project-error" class="field-error" aria-live="polite">{{ fieldErrors.project }}</p>
          </div>
          <div class="bt-field">
            <label for="bt-model">Model</label>
            <select id="bt-model" v-model="form.model" class="text-input" :disabled="!models.length" :aria-invalid="!!fieldErrors.model" aria-describedby="bt-model-error">
              <option v-if="!models.length" value="">No trained model</option>
              <option v-for="m in models" :key="m.number" :value="String(m.number)">{{ modelLabel(m) }}</option>
            </select>
            <p id="bt-model-error" class="field-error" aria-live="polite">{{ fieldErrors.model }}</p>
          </div>
        </div>

        <fieldset class="bt-field">
          <legend>Photos</legend>
          <div class="bt-choices">
            <label v-for="c in choices" :key="c.value" class="bt-choice" :class="{ chosen: form.photos === c.value, over: !!limitProblem(c.photos, limit) }">
              <input v-model="form.photos" type="radio" name="bt-photos" :value="c.value" :aria-describedby="limitProblem(c.photos, limit) ? `bt-over-${c.value}` : undefined">
              <span><strong>{{ c.label }}</strong>
                <small>{{ photosText(c.photos) }}</small>
                <small v-if="limitProblem(c.photos, limit)" :id="`bt-over-${c.value}`" class="bt-over">{{ c.photos ? `More than ${limit} photos` : 'No photos' }}</small></span>
            </label>
          </div>
          <p v-if="!choices.length" class="bt-help">Choose a project first.</p>
          <p class="bt-help">{{ limitNote }}</p>
          <p v-if="fieldErrors.photos" class="field-error" role="alert">{{ fieldErrors.photos }}</p>
        </fieldset>

        <p v-if="summary" class="bt-summary" aria-live="polite">{{ summary }} If another model of this project is open on its Try page, it stops there.</p>
        <p v-if="formError" class="field-error" role="alert">{{ formError }}</p>
        <div class="bt-actions">
          <p v-if="why" id="bt-why" class="bt-whynot">{{ why }}</p>
          <UiButton @click="creating=false">Cancel</UiButton>
          <UiButton type="submit" variant="primary" :disabled="!!why || starting" :aria-describedby="why ? 'bt-why' : undefined">
            <LoaderCircle v-if="starting" class="bt-spin" :size="15" aria-hidden="true"/> {{ starting ? 'Starting…' : 'Start batch' }}
          </UiButton>
        </div>
      </form>
    </UiDialog>

    <UiDialog :open="!!cancelling" title="Cancel this batch?" @close="cancelling=null">
      <template v-if="cancelling">
        <p class="dialog-description">The photo being looked at now is finished, then no more are sent. What the model found so far is kept, and you can download it.</p>
        <p v-if="cancelError" class="field-error" role="alert">{{ cancelError }}</p>
        <div class="dialog-actions">
          <UiButton @click="cancelling=null">Keep it running</UiButton>
          <UiButton variant="primary" class="bt-danger" :disabled="cancelBusy" @click="confirmCancel"><Ban :size="14" aria-hidden="true"/> {{ cancelBusy ? 'Cancelling…' : 'Cancel batch' }}</UiButton>
        </div>
      </template>
    </UiDialog>
  </section>
</template>

<style scoped>
.batch{--bt-ink:#162139;--bt-muted:#4c5d74;--bt-line:#e3e8f1;--bt-fail:#b42318;--bt-fail-soft:#fdecee}
.bt-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.bt-head h2{margin:0 0 4px}
.bt-head p{margin:0;max-width:620px;color:var(--bt-muted)}
.bt-head .button,.bt-empty .button{min-height:44px}
.bt-limit{display:flex;gap:10px;align-items:flex-start;margin:0 0 16px;padding:10px 14px;border:1px solid var(--aadml-soft);border-radius:10px;background:var(--aadml-tint);color:var(--bt-ink)!important;font-size:13px;line-height:1.55}
.bt-limit svg{margin-top:2px;color:var(--aadml-primary)}
.bt-closed{margin:0 0 16px;padding:10px 14px;border-radius:10px;background:#fff7e6;border:1px solid #f5dfb0;color:#6f4500!important;font-size:13px;line-height:1.55}
.bt-error{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 16px;padding:10px 14px;border:1px solid #efc5ce;border-radius:10px;background:#fff5f6;color:#ad3449;font-size:13px}
.bt-error .button{min-height:44px}
.bt-muted{font-size:13px;color:#5f6d82}
.bt-empty{text-align:center;padding:30px 20px;border:1px solid var(--bt-line);border-radius:12px;background:#fff}
.bt-empty-icon{display:grid;place-items:center;width:46px;height:46px;margin:0 auto;border-radius:50%;background:#f1f4f8;color:var(--bt-muted)}
.bt-empty h3{margin:12px 0 6px;font-size:16px}
.bt-empty p{margin:0 auto 16px;max-width:520px}
/* the list: one row per batch, the meter in the middle carries the row */
.bt-list{list-style:none;margin:0;padding:0;border:1px solid var(--bt-line);border-radius:12px;background:#fff}
.bt-row{display:grid;grid-template-columns:minmax(180px,1.1fr) minmax(220px,1.6fr) 120px 180px;gap:16px 22px;align-items:start;padding:16px 18px;border-bottom:1px solid #eef0f4}
.bt-row:last-child{border-bottom:0}
.bt-what{display:flex;flex-direction:column;gap:3px;min-width:0}
.bt-what strong{color:var(--bt-ink);font-size:14px;overflow-wrap:anywhere}
.bt-what span{color:#22304a;font-size:13px}
.bt-what small{display:inline-flex;align-items:center;gap:5px;color:#5f6d82;font-size:12px;line-height:1.5}
.bt-progress{min-width:0}
.bt-meter{display:flex;height:12px;border-radius:6px;background:#eef1f6;overflow:hidden;box-shadow:inset 0 0 0 1px #e1e6ee}
.bt-done{background:var(--aadml-primary);transition:width .3s ease-out}
.bt-failed{background:repeating-linear-gradient(135deg,var(--bt-fail) 0 4px,#d4554a 4px 8px);transition:width .3s ease-out}
.bt-count{display:flex;justify-content:space-between;gap:12px;margin:7px 0 0!important;font-size:13px;color:#22304a!important;font-variant-numeric:tabular-nums}
.bt-pct{color:var(--bt-muted);font-weight:600}
.bt-why{margin:6px 0 0!important;font-size:12px!important;line-height:1.5!important;color:#a12c3c!important}
.bt-state{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.bt-state small{font-size:12px;color:#5f6d82}
.bt-state :deep(.badge--red){color:#a12c3c;background:var(--bt-fail-soft)}
.bt-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.bt-acts .button{min-height:44px;padding:8px 14px;font-size:13px;white-space:nowrap}
.bt-spin{animation:bt-spin 1.1s linear infinite;margin-right:3px}
@keyframes bt-spin{to{transform:rotate(360deg)}}
.bt-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* the dialog */
.bt-dialog{width:min(640px,calc(100% - 32px))}
.bt-form{margin:0}
.bt-field{display:block;margin:18px 0 0;padding:0;border:0;min-width:0}
.bt-field > label,.bt-field > legend{display:block;font-size:13px;font-weight:600;color:#1d2a42;margin:0 0 8px;padding:0}
.bt-field .text-input{display:block;width:100%;max-width:none;min-height:44px;margin:0;padding:10px 12px;font-size:14px}
.bt-field .text-input[aria-invalid="true"]{border-color:#c0394c}
.bt-field .field-error{margin:6px 0 0}
.bt-field .field-error:empty{margin:0}
.bt-row2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}
.bt-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.bt-choice{display:flex;align-items:flex-start;gap:10px;min-height:44px;padding:12px 14px;border:1px solid #dce0e8;border-radius:9px;background:#fff;cursor:pointer;transition:border-color .15s,background-color .15s}
.bt-choice:hover{border-color:var(--aadml-focus)}
.bt-choice:focus-within{outline:2px solid var(--aadml-focus);outline-offset:2px}
.bt-choice.chosen{border-color:var(--aadml-focus);background:var(--aadml-tint)}
.bt-choice.over.chosen{border-color:#c0394c;background:#fff5f6}
.bt-choice input{margin-top:3px;width:16px;height:16px}
.bt-choice span{display:flex;flex-direction:column;gap:3px;min-width:0}
.bt-choice strong{font-size:14px;color:var(--bt-ink);overflow-wrap:anywhere}
.bt-choice small{font-size:12px;line-height:1.5;color:var(--bt-muted);font-variant-numeric:tabular-nums}
.bt-choice .bt-over{color:#a12c3c}
.bt-help{margin:8px 0 0!important;font-size:12px!important;line-height:1.5!important;color:#5f6d82!important}
.bt-summary{margin:20px 0 0!important;padding:10px 14px;border-radius:9px;background:#f4f6fa;color:#22304a!important;font-size:13px;line-height:1.55}
.bt-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:20px;flex-wrap:wrap}
.bt-actions .button,.dialog-actions .button{min-height:44px}
.bt-whynot{margin:0 auto 0 0!important;flex:1 1 220px;font-size:12px!important;line-height:1.5!important;color:#6f4500!important}
.button--primary.bt-danger{background:#b42318;border-color:#b42318}
.button--primary.bt-danger:hover:not(:disabled){background:#912018;border-color:#912018}
@media(max-width:900px){
  .bt-row{grid-template-columns:minmax(0,1fr) auto}
  .bt-progress{grid-column:1 / -1;grid-row:2}
  .bt-acts{grid-column:1 / -1;justify-content:flex-start}
}
@media(max-width:640px){
  .bt-head .button{width:100%}
  .bt-row{padding:14px}
  .bt-row2,.bt-choices{grid-template-columns:1fr}
  .bt-acts .button{flex:1 1 auto;justify-content:center}
  .bt-actions .button{flex:1 1 auto}
  .bt-whynot{flex-basis:100%}
}
@media(prefers-reduced-motion:reduce){.bt-done,.bt-failed,.bt-choice{transition:none}.bt-spin{animation:none}}
</style>
