<script setup>
// The Train tab's runs of any open photo model (hf-train: object detection, semantic or instance segmentation) and of
// an image or video generation model's LoRA (diffusion-train), ADM-1365. Backend: training_models_data/app_api.py
// training() (``open_models``, ``hf_tasks``, ``generation``), runs/ (``task`` or ``generation``), runs/machines/
// (hf_runs.py, diffusion_runs.py, placement.py). What it offers comes from the server, with why a model cannot be
// trained now and its GPU numbers (never hidden); the server checks every value again before a run starts, and
// nothing starts before the person approves the machine (MachinePicker.confirm).
import { computed, nextTick, ref, watch } from 'vue';
import { Cpu, Play, Sparkles, WandSparkles } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import MachinePicker from './MachinePicker.vue';
import { trainApi, startKeys, NO_ANSWER_START } from '../api/train.js';
import { unanswered } from '../api/models.js';
import { defaultTask, startingSettings, settingsForm, settingsBody, gpuLine, needsLine, machinesQuery,
  generationForm, generationBody, genTaskWords } from '../api/anyModel.js';

const props = defineProps({ projectRef: { type: String, required: true }, training: { type: Object, required: true } });
const emit = defineEmits(['started']);
const uid = Math.random().toString(36).slice(2, 8);

// ── an added photo model ──
const models = computed(() => props.training.open_models || []);
const tasks = computed(() => props.training.hf_tasks || []);
const versions = computed(() => props.training.versions || []);
const runtimes = computed(() => props.training.runtimes || []);
const blocked = computed(() => props.training.refused || props.training.no_version || '');
const modelKey = ref(''); const task = ref(''); const version = ref(''); const runtime = ref(props.training.default_runtime || 3600);
const form = ref(settingsForm());
const chosen = computed(() => models.value.find(m => m.key === modelKey.value) || null);
watch(models, list => {
  if (!list.some(m => m.key === modelKey.value)) modelKey.value = (list.find(m => m.trainable) || list[0])?.key || '';
}, { immediate: true });
watch(versions, list => { if (!list.some(v => v.name === version.value)) version.value = list[0]?.name || ''; }, { immediate: true });
// A model chosen: its own task, and the settings a run of it starts with.
watch(chosen, m => { task.value = defaultTask(m, tasks.value); }, { immediate: true });
watch([chosen, task], () => { form.value = settingsForm(startingSettings(chosen.value, task.value, tasks.value)); }, { immediate: true });
const taskOf = computed(() => tasks.value.find(t => t.value === task.value) || null);
const trainedElse = computed(() => !!(chosen.value?.train_task && task.value && task.value !== chosen.value.train_task));

// Where it trains: the server's answer for THIS version, model, task and epochs, with what the run needs.
const compute = ref(''); const picker = ref(null); const needs = ref(null); const tooSmall = ref('');
const canAsk = computed(() => !!(version.value && chosen.value?.trainable && task.value));
const loadPlaces = computed(() => {
  const asked = machinesQuery({ version: version.value, model: chosen.value?.value, task: task.value, epochs: form.value.epochs });
  const ref_ = props.projectRef;
  return async () => {
    needs.value = null; tooSmall.value = '';
    const got = await trainApi.machines(ref_, asked);
    needs.value = got.needs || null; tooSmall.value = got.gpu_too_small || '';
    return got;
  };
});

const error = ref(''); const errorField = ref(''); const busy = ref(false); const reviewing = ref(false); const said = ref('');
const keys = startKeys();
let made = null;
function review() {
  error.value = ''; errorField.value = ''; said.value = '';
  const body = settingsBody(form.value);
  if (body.error) { error.value = body.error; errorField.value = body.field; nextTick(() => document.getElementById(`hf-${body.field}-${uid}`)?.focus()); return; }
  made = { version: version.value, model: chosen.value.value, task: task.value, settings: body.settings, max_runtime: Number(runtime.value) };
  reviewing.value = true;
}
function startNow() { reviewing.value = false; if (picker.value) picker.value.confirm(() => start(made, keys, busy, error)); else start(made, keys, busy, error); }
async function start(body, startKeysOf, busyRef, errorRef) {
  if (!body) return;
  busyRef.value = true; errorRef.value = ''; said.value = '';
  const sent = { ...body, key: startKeysOf.keyFor(body), ...(body.generation ? (genCompute.value ? { compute: genCompute.value } : {}) : (compute.value ? { compute: compute.value } : {})) };
  try {
    const run = await trainApi.start(props.projectRef, sent);
    startKeysOf.started();
    said.value = `Run ${run.number} started on ${run.version}.`;
    emit('started', run.number);
  } catch (e) {
    errorRef.value = unanswered(e) ? NO_ANSWER_START : e.message;
  } finally { busyRef.value = false; }
}
const reviewRows = computed(() => (made && !made.generation ? [
  ['Model', `${chosen.value?.name || made.model} by ${chosen.value?.publisher || ''}`],
  ['Task', taskOf.value?.label || made.task], ['Version', made.version],
  ['Settings', `${made.settings.epochs} epochs, learning rate ${made.settings.learning_rate}, batch ${made.settings.batch_size}, ${made.settings.resolution} px, weight decay ${made.settings.weight_decay}${made.settings.lora ? `, LoRA rank ${made.settings.lora.r}` : ''}${made.settings.freeze_backbone ? ', backbone frozen' : ''}${made.settings.augmentation ? `, flip chance ${made.settings.augmentation.horizontal_flip}` : ''}`],
  ['Maximum runtime', runtimes.value.find(r => r.value === made.max_runtime)?.label || `${made.max_runtime} s`],
  ['Runs on', compute.value ? (compute.value.startsWith('machine:') ? 'Your machine chosen under “Where it trains”' : 'The GPU chosen under “Where it trains”') : 'Auto: the machine it finds is shown for your approval'],
] : []));

// ── an image or video generation model's LoRA ──
const gen = computed(() => props.training.generation || null);
const bases = computed(() => gen.value?.bases || []);
const genVersions = computed(() => gen.value?.versions || []);
const baseKey = ref(''); const genTask = ref(''); const genVersion = ref(''); const genRuntime = ref(props.training.default_runtime || 3600);
const genForm = ref(generationForm());
const genBase = computed(() => bases.value.find(b => b.value === baseKey.value) || null);
watch(bases, list => { if (!list.some(b => b.value === baseKey.value)) baseKey.value = (list.find(b => b.trainable) || list[0])?.value || ''; }, { immediate: true });
watch(genVersions, list => { if (!list.some(v => v.name === genVersion.value)) genVersion.value = list[0]?.name || ''; }, { immediate: true });
watch(genBase, b => { genTask.value = b?.default_task || b?.tasks?.[0] || ''; }, { immediate: true });
watch(gen, g => { if (g) genForm.value = generationForm(g.settings || {}); }, { immediate: true });
const genCompute = ref(''); const genPicker = ref(null); const genNeeds = ref(null); const genTooSmall = ref('');
const genCanAsk = computed(() => !!(genVersion.value && genBase.value?.trainable));
const loadGenPlaces = computed(() => {
  const asked = machinesQuery({ generation: true, version: genVersion.value, model: genBase.value?.value, task: genTask.value });
  const ref_ = props.projectRef;
  return async () => {
    genNeeds.value = null; genTooSmall.value = '';
    const got = await trainApi.machines(ref_, asked);
    genNeeds.value = got.needs || null; genTooSmall.value = got.gpu_too_small || '';
    return got;
  };
});
const genError = ref(''); const genBusy = ref(false); const genReviewing = ref(false);
const genKeys = startKeys();
let genMade = null;
function genReview() {
  genError.value = ''; said.value = '';
  const body = generationBody(genForm.value);
  if (body.error) { genError.value = body.error; nextTick(() => document.getElementById(`gen-${body.field}-${uid}`)?.focus()); return; }
  genMade = { generation: true, version: genVersion.value, model: genBase.value.value, task: genTask.value, settings: body.settings, max_runtime: Number(genRuntime.value) };
  genReviewing.value = true;
}
function genStartNow() { genReviewing.value = false; if (genPicker.value) genPicker.value.confirm(() => start(genMade, genKeys, genBusy, genError)); else start(genMade, genKeys, genBusy, genError); }
const genReviewRows = computed(() => (genMade ? [
  ['Base model', genBase.value?.name || genMade.model], ['Task', genTaskWords(genMade.task)], ['Caption version', genMade.version],
  ['Settings', `rank ${genMade.settings.rank}, ${genMade.settings.max_train_steps} steps, learning rate ${genMade.settings.learning_rate}`],
  ['Trigger words', (genMade.settings.trigger_words || []).join(', ') || 'None'],
  ['Sample prompts', String((genMade.settings.sample_prompts || []).length)],
  ['Maximum runtime', runtimes.value.find(r => r.value === genMade.max_runtime)?.label || `${genMade.max_runtime} s`],
] : []));
const describedBy = (...ids) => ids.filter(Boolean).join(' ') || undefined;
</script>

<template>
  <div class="any-model">
    <p class="sr-only" role="status" aria-live="polite">{{ said }}</p>

    <!-- An image or video generation project: a LoRA of a generation model AADML hosts, from a caption version. -->
    <section v-if="gen" class="panel training-config" :aria-labelledby="`gen-title-${uid}`" data-test="gen-train">
      <h2 :id="`gen-title-${uid}`"><WandSparkles :size="18" aria-hidden="true"/> Train a generation model</h2>
      <p>A LoRA teaches one of AADML's image or video generation models your subject or style, from this project's captioned photos. Each base says whether it can be trained now, and why not.</p>
      <p v-if="gen.unavailable" class="any-note" role="note">{{ gen.unavailable }} A run on one of your own machines with an NVIDIA GPU can still start.</p>
      <p v-if="!genVersions.length" class="field-error" role="note">No caption version yet: caption the photos, then create a dataset version for training.</p>
      <fieldset class="open-models">
        <legend>Base model</legend>
        <p v-if="!bases.length">No generation model is hosted by AADML now.</p>
        <label v-for="b in bases" :key="b.value" :class="['model-choice', { active: baseKey === b.value, unavailable: !b.trainable }]">
          <input v-model="baseKey" type="radio" :name="`gen-base-${uid}`" :value="b.value" :disabled="!b.trainable" :aria-describedby="`gen-base-${b.value}-${uid}`">
          <span class="open-model-text"><strong>{{ b.name }}</strong>
            <small :id="`gen-base-${b.value}-${uid}`">{{ b.kind === 'video' || /video/.test(b.default_task || '') ? 'Video' : 'Image' }}{{ b.need_gb ? ` · about ${b.need_gb} GB of GPU memory to train (estimated)` : '' }}{{ b.largest_gpu_gb ? ` · AADML's largest GPU ${b.largest_gpu_gb} GB` : '' }}{{ b.trainable ? '' : `. ${b.why_not}` }}</small></span>
          <UiBadge :tone="b.research_only ? 'purple' : 'green'">{{ b.research_only ? 'Research only' : (b.licence || 'Licence') }}</UiBadge>
        </label>
      </fieldset>
      <div class="form-grid">
        <label class="field-label">Caption version<select v-model="genVersion" class="text-input"><option v-if="!genVersions.length" value="">No caption version yet</option><option v-for="v in genVersions" :key="v.name" :value="v.name">{{ v.title ? `${v.title} · ` : '' }}{{ v.name }} · {{ v.photos }} photos</option></select></label>
        <label class="field-label">What it learns<select v-model="genTask" class="text-input" :disabled="!genBase?.tasks?.length"><option v-for="t in genBase?.tasks || []" :key="t" :value="t">{{ genTaskWords(t) }}</option></select></label>
        <label class="field-label" :for="`gen-rank-${uid}`">LoRA rank<input :id="`gen-rank-${uid}`" v-model.lazy="genForm.rank" class="text-input" type="number" min="1" max="256" step="1" inputmode="numeric"></label>
        <label class="field-label" :for="`gen-max_train_steps-${uid}`">Steps<input :id="`gen-max_train_steps-${uid}`" v-model.lazy="genForm.max_train_steps" class="text-input" type="number" min="1" max="100000" step="1" inputmode="numeric"></label>
        <label class="field-label" :for="`gen-learning_rate-${uid}`">Learning rate<input :id="`gen-learning_rate-${uid}`" v-model.lazy="genForm.learning_rate" class="text-input" type="number" min="0.0000001" max="0.01" step="any" inputmode="decimal"></label>
        <label class="field-label">Maximum runtime<select v-model="genRuntime" class="text-input"><option v-for="r in runtimes" :key="r.value" :value="r.value">{{ r.label }}</option></select></label>
        <label class="field-label wide" :for="`gen-trigger_words-${uid}`">Trigger words<input :id="`gen-trigger_words-${uid}`" v-model="genForm.trigger_words" class="text-input" maxlength="600" placeholder="e.g. sks mug" :aria-describedby="`gen-trigger-help-${uid}`"><small :id="`gen-trigger-help-${uid}`" class="field-help">Separated by commas, at most 8. A prompt with them asks for what this LoRA learnt.</small></label>
        <label class="field-label wide" :for="`gen-sample_prompts-${uid}`">Sample prompts<textarea :id="`gen-sample_prompts-${uid}`" v-model="genForm.sample_prompts" class="text-input" rows="3" maxlength="4200" placeholder="One a line, e.g. a photo of sks mug on a beach" :aria-describedby="`gen-prompts-help-${uid}`"/><small :id="`gen-prompts-help-${uid}`" class="field-help">At most 8. The run makes a picture of each at the end, for you to judge it by.</small></label>
      </div>
      <div v-if="genCanAsk">
        <MachinePicker ref="genPicker" v-model="genCompute" :load="loadGenPlaces" :disabled="genBusy" legend="Where it trains"/>
        <p v-if="needsLine(genNeeds)" class="any-note" aria-live="polite"><Cpu :size="14" aria-hidden="true"/> {{ needsLine(genNeeds) }}</p>
        <p v-if="genTooSmall" class="field-error" role="note">{{ genTooSmall }}</p>
      </div>
      <p v-if="genError" class="field-error" role="alert">{{ genError }}</p>
      <p v-if="genBusy" class="dialog-description" role="status">Starting the run. Getting a machine for it can take up to a minute or two; keep this page open.</p>
      <UiButton variant="primary" :disabled="genBusy || !genCanAsk || !!props.training.refused" @click="genReview"><Play :size="15" aria-hidden="true"/> Review generation training</UiButton>
    </section>

    <!-- Any open photo model the workspace added: trained by hf-train for the task chosen. -->
    <section v-else class="panel training-config" :aria-labelledby="`hf-title-${uid}`" data-test="hf-train">
      <h2 :id="`hf-title-${uid}`"><Sparkles :size="18" aria-hidden="true"/> Train an added photo model</h2>
      <p>Any photo model your workspace added from Hugging Face trains here for one task, with a new head for this project's classes, from the commit it was added at.</p>
      <p v-if="!models.length">No photo model is added to this workspace yet. Add one on Open models, then train it here.</p>
      <template v-else>
        <fieldset class="open-models">
          <legend>Model</legend>
          <label v-for="m in models" :key="m.key" :class="['model-choice', { active: modelKey === m.key, unavailable: !m.trainable }]">
            <input v-model="modelKey" type="radio" :name="`hf-model-${uid}`" :value="m.key" :disabled="!m.trainable" :aria-describedby="`hf-model-${m.key}-${uid}`">
            <span class="open-model-text"><strong>{{ m.name }}</strong>
              <small :id="`hf-model-${m.key}-${uid}`">{{ m.publisher }}{{ m.size ? `, ${m.size} parameters` : '' }}{{ m.train_task_label ? ` · ${m.train_task_label}` : '' }}{{ gpuLine(m) ? ` · ${gpuLine(m)}` : '' }}{{ m.trainable ? '' : ` ${m.why_not}` }}</small></span>
            <UiBadge :tone="m.research_only ? 'purple' : 'green'">{{ m.research_only ? 'Research only' : (m.licence_name || 'Licence') }}</UiBadge>
          </label>
        </fieldset>
        <p v-if="chosen?.walls" class="any-note">{{ chosen.walls_trainable ? `${chosen.name} can also be trained by the walls trainer: choose it under Architecture above.` : chosen.walls_why_not }}</p>
        <div class="form-grid">
          <label class="field-label">Dataset version<select v-model="version" class="text-input"><option v-if="!versions.length" value="">No version can be trained yet</option><option v-for="v in versions" :key="v.name" :value="v.name">{{ v.title ? `${v.title} · ` : '' }}{{ v.name }} · {{ v.photos }} photos</option></select></label>
          <label class="field-label">Task<select v-model="task" class="text-input" :aria-describedby="trainedElse ? `hf-task-note-${uid}` : undefined"><option v-for="t in tasks" :key="t.value" :value="t.value">{{ t.label }}</option></select>
            <small v-if="trainedElse" :id="`hf-task-note-${uid}`" class="field-help">{{ chosen.name }} is made for {{ chosen.train_task_label || chosen.train_task }}: another task may be refused.</small></label>
          <label class="field-label" :for="`hf-epochs-${uid}`">Epochs<input :id="`hf-epochs-${uid}`" v-model.lazy="form.epochs" class="text-input" type="number" min="1" max="1000" step="1" inputmode="numeric" :aria-invalid="errorField==='epochs'"></label>
          <label class="field-label" :for="`hf-learning_rate-${uid}`">Learning rate<input :id="`hf-learning_rate-${uid}`" v-model.lazy="form.learning_rate" class="text-input" type="number" min="0.00000001" max="1" step="any" inputmode="decimal" :aria-invalid="errorField==='learning_rate'"></label>
          <label class="field-label" :for="`hf-batch_size-${uid}`">Batch size<input :id="`hf-batch_size-${uid}`" v-model.lazy="form.batch_size" class="text-input" type="number" min="1" max="512" step="1" inputmode="numeric" :aria-invalid="errorField==='batch_size'"></label>
          <label class="field-label" :for="`hf-resolution-${uid}`">Photo side (px)<input :id="`hf-resolution-${uid}`" v-model.lazy="form.resolution" class="text-input" type="number" min="32" max="4096" step="1" inputmode="numeric" :aria-invalid="errorField==='resolution'"></label>
          <label class="field-label" :for="`hf-weight_decay-${uid}`">Weight decay<input :id="`hf-weight_decay-${uid}`" v-model.lazy="form.weight_decay" class="text-input" type="number" min="0" max="1" step="any" inputmode="decimal" :aria-invalid="errorField==='weight_decay'"></label>
          <label class="field-label" :for="`hf-flip-${uid}`">Chance of a horizontal flip<input :id="`hf-flip-${uid}`" v-model.lazy="form.flip" class="text-input" type="number" min="0" max="1" step="0.1" inputmode="decimal" placeholder="The trainer's own" :aria-invalid="errorField==='flip'"></label>
          <label class="field-label">Maximum runtime<select v-model="runtime" class="text-input"><option v-for="r in runtimes" :key="r.value" :value="r.value">{{ r.label }}</option></select></label>
          <fieldset class="any-switches wide">
            <legend>Less GPU memory</legend>
            <label class="any-check"><input :id="`hf-freeze_backbone-${uid}`" v-model="form.freeze_backbone" type="checkbox" :disabled="form.lora_enabled"> Freeze the backbone (train the head only)</label>
            <label class="any-check"><input v-model="form.lora_enabled" type="checkbox" :disabled="form.freeze_backbone"> Train with LoRA (the base weights stay as they are)</label>
            <div v-if="form.lora_enabled" class="any-lora">
              <label class="field-label" :for="`hf-lora_r-${uid}`">LoRA rank<input :id="`hf-lora_r-${uid}`" v-model.lazy="form.lora_r" class="text-input" type="number" min="1" max="512" step="1"></label>
              <label class="field-label" :for="`hf-lora_alpha-${uid}`">LoRA alpha<input :id="`hf-lora_alpha-${uid}`" v-model.lazy="form.lora_alpha" class="text-input" type="number" min="1" max="2048" step="1"></label>
              <label class="field-label" :for="`hf-lora_dropout-${uid}`">LoRA dropout<input :id="`hf-lora_dropout-${uid}`" v-model.lazy="form.lora_dropout" class="text-input" type="number" min="0" max="0.9" step="0.01"></label>
            </div>
          </fieldset>
        </div>
        <div v-if="canAsk">
          <MachinePicker ref="picker" v-model="compute" :load="loadPlaces" :disabled="busy" legend="Where it trains"/>
          <p v-if="needsLine(needs)" class="any-note" aria-live="polite"><Cpu :size="14" aria-hidden="true"/> {{ needsLine(needs) }}</p>
          <p v-if="tooSmall" class="field-error" role="note">{{ tooSmall }}</p>
        </div>
        <p v-if="chosen?.research_only" class="any-note">{{ chosen.name }} is published for research or evaluation only ({{ chosen.licence_name }}): a model trained from it is never released to an app.</p>
        <p v-if="blocked" class="field-error" role="note">{{ blocked }}</p>
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <p v-if="busy" class="dialog-description" role="status">Starting the run. Getting a machine for it can take up to a minute or two; keep this page open.</p>
        <UiButton variant="primary" :disabled="busy || !canAsk || !!blocked" :aria-describedby="describedBy(!canAsk && chosen && !chosen.trainable ? `hf-model-${chosen.key}-${uid}` : '')" @click="review"><Play :size="15" aria-hidden="true"/> Review training of {{ chosen?.name || 'the model' }}</UiButton>
      </template>
    </section>

    <UiDialog :open="reviewing" :title="`Train ${chosen?.name || 'the model'}`" @close="reviewing=false">
      <dl class="summary-list"><template v-for="[name, value] in reviewRows" :key="name"><dt>{{ name }}</dt><dd>{{ value }}</dd></template></dl>
      <p class="dialog-description">It stops at the time limit you chose. The machine is shown for your approval before anything starts.</p>
      <div class="dialog-actions"><UiButton @click="reviewing=false">Back</UiButton><UiButton variant="primary" :disabled="busy" @click="startNow">Start training</UiButton></div>
    </UiDialog>
    <UiDialog :open="genReviewing" :title="`Train a LoRA of ${genBase?.name || 'the model'}`" @close="genReviewing=false">
      <dl class="summary-list"><template v-for="[name, value] in genReviewRows" :key="name"><dt>{{ name }}</dt><dd>{{ value }}</dd></template></dl>
      <p class="dialog-description">It stops at the time limit you chose. The machine is shown for your approval before anything starts.</p>
      <div class="dialog-actions"><UiButton @click="genReviewing=false">Back</UiButton><UiButton variant="primary" :disabled="genBusy" @click="genStartNow">Start training</UiButton></div>
    </UiDialog>
  </div>
</template>

<style scoped>
.any-model h2{display:flex;align-items:center;gap:8px}
.any-note{display:flex;gap:6px;align-items:flex-start;font-size:12px;color:#4b5565!important;margin:8px 0}
.wide{grid-column:1/-1}
.any-switches{border:1px solid var(--aadml-soft);border-radius:8px;padding:10px 14px;margin:0;min-width:0}
.any-switches legend{font-size:12px;font-weight:600;padding:0 4px}
.any-check{display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;font-size:13px}
.any-check input{width:18px;height:18px;margin:0;accent-color:var(--aadml-focus);flex:none}
.any-check:focus-within{outline:2px solid var(--aadml-focus);outline-offset:2px;border-radius:4px}
.any-lora{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.any-model .text-input{min-height:44px}
.any-model :deep(.button){min-height:44px;white-space:normal;text-align:left}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:550px){.any-lora{grid-template-columns:1fr}}
</style>
