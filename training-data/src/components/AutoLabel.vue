<script setup>
// Auto Label for one batch (a real project), laid out as the owner's reference of 2026-11-09
// (agentic-docs/AUTO_LABEL_VISION_SAM3_PLAN.md). The models are the ones the editor's "Find Objects with AI" offers
// (views._detect_sources): the published detectors, the models trained in this project, and the foundation models
// (auto_label.py: SAM 3, GPT-6.1 Terra and Gemini 4 Argon alone and each with SAM 3), grouped by maker in one picker
// (ModelSourcePicker), with whether the answer is shown as polygons or as masks (the same polygons, masks filled).
// "Generate Preview" really asks the chosen model about the preview photos and draws what it finds (nothing is
// saved). "Label Batch" gives the batch to this person and makes the model their choice for a photo
// nobody has drawn on: each photo then opens in the editor with the model's walls as a head start, which the person
// checks and sends to review — the same rule as the old editor; a model never makes a label by itself.
// A model with SAM 3 may run SAM 3 on one of the workspace's own machines (agentic-docs/SAM3_ON_MY_MACHINE_PLAN.md):
// the picker's "Where SAM 3 runs", the machine's fee, the SAM License accepted once, and the machine's own stage while
// SAM 3 gets ready there ("Downloading SAM 3").
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, ChevronRight, Image as ImageIcon, Plus, Zap, Check, Trash2, Wallet, Maximize2, RotateCcw, SlidersHorizontal, PanelRight, Sparkles } from 'lucide-vue-next';
import AutoLabelAgent from './AutoLabelAgent.vue';
import LabelingWorkflow from './LabelingWorkflow.vue';
import ModelSourcePicker from './ModelSourcePicker.vue';
import { blockedAt, detailAt, licenceAccepted, placeOf, startsServer } from '../sourceFamilies.js';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { api, classesOf, askedClasses, keepAskedClasses } from '../api/annotate.js';
import { edgeApi } from '../api/edge.js';
import { tidyUp } from '../geometry.js';

const props = defineProps({ batch: Object, state: Object, media: Array, busy: Boolean, optionsOpen: Boolean });
const emit = defineEmits(['close', 'annotate', 'autolabel', 'options']);
const sources = ref([]); const loading = ref(true); const error = ref(''); const chosen = ref('');
const agentOpen = ref(false); const agentVisited = ref(false); const tab = ref('preview');
const workflowVisited = ref(false); const workflowPanel = ref(null);
function openAgent() { agentVisited.value = true; agentOpen.value = true; }
function openWorkflow() { workflowVisited.value = true; tab.value = 'workflow'; }
function back() { if (agentOpen.value) agentOpen.value = false; else emit('close'); }
const choosing = ref(false); const confirmOpen = ref(false);
const where = ref(''); const licenceBusy = ref(false); const placeError = ref('');     // where SAM 3 runs: '' or machine:<id>
const showLabels = ref(true); const focus = ref(0); const canvas = ref(null);
const picked = ref(props.media.slice(0, 1).map(m => m.id));
const previews = ref([]);                      // [{image, state: 'asking'|'waiting'|'ready'|'refused', shapes, now, error, width, height}]
let timers = []; let stopped = false;

const current = computed(() => sources.value.find(s => s.id === chosen.value) || null);
const place = computed(() => placeOf(current.value, where.value));
const blocked = computed(() => blockedAt(current.value, place.value));
const detail = computed(() => detailAt(current.value, place.value));
const shown = computed(() => previews.value[Math.min(focus.value, previews.value.length - 1)] || null);

// What the bottom bar says the page is doing.
const stateWords = computed(() => {
  if (loading.value) return ['Loading the models', ''];
  if (!current.value) return ['Choose a model', 'Pick the model that draws the head start.'];
  if (!asked.value.length) return ['Add your classes', 'Add a class or use a saved workflow before previewing.'];
  if (current.value.unavailable) return ['This model cannot be used now', current.value.unavailable];
  if (place.value?.unavailable) return [`SAM 3 cannot run on ${place.value.name} now`, place.value.unavailable];
  if (place.value?.state === 'licence') return ['Accept the SAM License', `SAM 3 runs on ${place.value.name} only under Meta's SAM License.`];
  if (generating.value) return ['Generating the preview', 'The model is looking at the preview photos.'];
  if (previews.value.some(p => p.state === 'refused')) return ['Preview needs attention', 'Check the image message, then try again.'];
  if (previews.value.length) return ['Ready to label', 'Preview ready. Review the results, then label your batch.'];
  return ['Ready to preview', 'Generate a preview to see what the model finds.'];
});
const pickedImages = computed(() => props.media.filter(m => picked.value.includes(m.id)));
const generating = computed(() => previews.value.some(p => p.state === 'asking' || p.state === 'waiting'));
const colour = kind => props.state.classes.find(c => c.name === kind)?.color || '#8b5cf6';
const label = s => `${s.mode ? `${s.mode}: ` : ''}${s.name}`;
// A mask is the same outline, filled: it is drawn more solid than a polygon.
const fillOpacity = computed(() => (current.value?.labels === 'masks' ? 0.55 : 0.25));
async function loadSources() {
  loading.value = true; error.value = '';
  try {
    const body = await api.detectSources(props.state.ref);
    sources.value = body.sources;
    const usable = body.sources.filter(s => !s.unavailable);
    chosen.value = body.preference || usable.find(s => s.tidy)?.id || usable[0]?.id || '';
    where.value = body.preference ? (body.where || '') : '';
  } catch (e) { error.value = `The models could not be loaded. ${e.message}`; } finally { loading.value = false; }
}
onMounted(loadSources);

// Names and descriptions come from the project. Never seed domain-specific classes in the page.
const canChange = computed(() => !!props.state.canChangeClasses);
// The classes the AI is asked for (owner, 2026-11-09): every class at first; unticked, the models do not look for it,
// and it stays in the project. Kept per project in this browser; the editor reads the same choice.
const classNames = computed(() => props.state.classes.map(c => c.name));
const asked = ref(askedClasses(props.state.ref, classNames.value));
const definition = computed(() => ({ schema: 'aadml.labeling-workflow.v1', source: chosen.value, where: where.value,
  classes: props.state.classes.filter(c => asked.value.includes(c.name)).map(c => ({ name: c.name, color: c.color, description: c.description || '' })) }));
watch(definition, () => { previews.value = []; focus.value = 0; });
const agentContext = computed(() => JSON.stringify({ project: props.state.ref, batch: { id: props.batch.id, source: props.batch.source },
  selected_image_ids: picked.value.slice(0, 4), configuration: definition.value }, null, 2));
async function applyWorkflow(body) {
  props.state.classes = classesOf(body.classes);
  await nextTick();
  const config = body.workflow.definition;
  chosen.value = config.source; where.value = config.where;
  asked.value = config.classes.map(c => c.name);
  keepAskedClasses(props.state.ref, classNames.value, asked.value);
  previews.value = []; tab.value = 'preview';
}
function refreshWorkflows() { workflowPanel.value?.reload(); }
watch(classNames, names => { asked.value = askedClasses(props.state.ref, names); });
function toggleAsked(name) {
  const now = asked.value.includes(name) ? asked.value.filter(n => n !== name) : [...asked.value, name];
  if (!now.length) return;                          // at least one class is always asked for
  asked.value = now; keepAskedClasses(props.state.ref, classNames.value, now); previews.value = [];
}
const adding = ref(null); const classBusy = ref(false); const classError = ref(''); const newName = ref(null);
const PALETTE = ['#ef4444', '#0ea5e9', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#6366f1', '#a855f7'];
function startAdd() {
  classError.value = '';
  adding.value = { name: '', color: PALETTE.find(c => !props.state.classes.some(k => k.color === c)) || PALETTE[0], description: '' };
  nextTick(() => newName.value?.focus());
}
async function changeClasses(call) {
  classBusy.value = true; classError.value = '';
  try { const body = await call(); props.state.classes = classesOf(body.classes); return true; }
  catch (e) { classError.value = e.message; return false; } finally { classBusy.value = false; }
}
async function saveAdd() { if (await changeClasses(() => api.addClass(props.state.ref, adding.value))) adding.value = null; }
function saveClass(c, change) { return changeClasses(() => api.updateClass(props.state.ref, c.name, change)); }
function removeClass(c) { return changeClasses(() => api.removeClass(props.state.ref, c.name)); }
onUnmounted(() => { stopped = true; timers.forEach(clearTimeout); });

// Another model, another way of showing it, or another place it runs: the preview is of the one chosen before, so it goes.
watch([chosen, where], () => { previews.value = []; focus.value = 0; placeError.value = ''; });
// The SAM License, accepted once for the workspace: every machine waiting for it can take SAM 3 now.
async function acceptLicence() {
  licenceBusy.value = true; placeError.value = '';
  try { await api.acceptSamLicence(props.state.ref); licenceAccepted(sources.value); }
  catch (e) { placeError.value = `The SAM License was not recorded. ${e.message}`; } finally { licenceBusy.value = false; }
}
// SAM 3 stopped on the machine at the person's word (its weights stay there for the next time).
async function stopOnMachine(chosenPlace) {
  placeError.value = '';
  try { await edgeApi.stop(chosenPlace.running.job); chosenPlace.running = null; }
  catch (e) { placeError.value = `SAM 3 was not stopped. ${e.message}`; }
}
function fullScreen() { canvas.value?.requestFullscreen?.(); }
function toggle(image) {
  const at = picked.value.indexOf(image.id);
  if (at >= 0) picked.value.splice(at, 1); else if (picked.value.length < 4) picked.value.push(image.id);
}
// One photo at a time: a model that is not running is started by the first one; the others then answer quickly.
async function generate() {
  timers.forEach(clearTimeout); timers = []; stopped = false;
  previews.value = pickedImages.value.map(image => ({ image, state: 'asking', shapes: [], now: 'asking the model', error: '' }));
  focus.value = 0;
  for (const preview of previews.value) await ask(preview);
}
async function ask(preview) {
  while (!stopped) {
    try {
      const body = await api.detect(props.state.ref, preview.image.id, chosen.value, asked.value, where.value);
      if (body.state === 'waiting') {
        preview.state = 'waiting'; preview.now = `${body.title}: ${body.now}${body.seconds ? ` (${body.seconds} s)` : ''}`;
        await new Promise(resolve => timers.push(setTimeout(resolve, 4000)));
        continue;
      }
      let shapes = body.shapes;
      if (body.tidy && shapes.length) shapes = tidyUp(JSON.parse(JSON.stringify(shapes))).shapes;
      Object.assign(preview, { state: 'ready', shapes });
    } catch (e) { Object.assign(preview, { state: 'refused', error: e.message }); }
    return;
  }
}
function stop() { stopped = true; timers.forEach(clearTimeout); previews.value.forEach(p => { if (p.state !== 'ready') Object.assign(p, { state: 'refused', error: 'Stopped.' }); }); }
function loaded(preview, event) { preview.width = event.target.naturalWidth; preview.height = event.target.naturalHeight; }
function counts(shapes) { return props.state.classes.map(c => ({ ...c, n: shapes.filter(s => s.kind === c.name).length })).filter(c => c.n); }
function start() { confirmOpen.value = false; emit('autolabel', chosen.value, where.value); }
</script>

<template>
  <section class="auto-label">
    <header class="auto-head">
      <button class="auto-back-button" :aria-label="agentOpen ? 'Back to Auto Label' : 'Back to batch'" :title="agentOpen ? 'Back to Auto Label' : 'Back to batch'" @click="back"><ArrowLeft :size="16"/><span :class="{'auto-sr-only':!agentOpen}">{{ agentOpen ? 'Back to Auto Label' : 'Back to batch' }}</span></button>
      <h2>Auto Label</h2>
      <nav class="auto-breadcrumb" aria-label="Auto Label navigation"><button @click="emit('annotate')">Annotate</button><ChevronRight :size="11" aria-hidden="true"/><span class="auto-batch-link" :title="batch.givenName || batch.name">{{ batch.givenName || batch.name }} · {{ media.length }} images</span></nav>
      <ol class="auto-progress" aria-label="Labeling progress"><li :aria-current="!previews.length && !confirmOpen ? 'step' : undefined"><span>1</span>Configure</li><li :aria-current="previews.length && !confirmOpen ? 'step' : undefined"><span>2</span>Preview</li><li :aria-current="confirmOpen ? 'step' : undefined"><span>3</span>Label batch</li></ol>
      <div class="auto-header-actions"><UiButton class="auto-options-toggle" :aria-expanded="optionsOpen" :aria-controls="`labeling-options-${batch.id}`" @click="emit('options')"><PanelRight :size="14"/>Labeling options</UiButton><span v-if="current" class="auto-cost" :title="detail"><Wallet :size="14"/><span>{{ place ? place.price : 'Uses balance' }}</span></span>
      <UiButton v-if="generating" @click="stop">Stop</UiButton>
      <UiButton v-else :variant="previews.some(p => p.state==='ready') ? 'secondary' : 'primary'" :disabled="blocked||!picked.length||!asked.length||classBusy||!!adding" @click="generate"><RotateCcw v-if="previews.length" :size="15"/><Zap v-else :size="15"/> {{ previews.length ? 'Run Again' : 'Generate Preview' }}</UiButton>
      <UiButton :variant="previews.some(p => p.state==='ready') ? 'primary' : 'secondary'" :disabled="blocked||busy||!media.length||!asked.length" @click="confirmOpen=true"><Check :size="15"/> Label Batch <ArrowRight :size="15"/></UiButton>
      </div>
    </header>
    <div class="auto-body">
      <aside v-show="!agentOpen" class="auto-side">
        <h3 class="auto-step-heading">Model</h3>
        <ModelSourcePicker v-model="chosen" v-model:where="where" :sources="sources" :loading="loading" :disabled="generating||busy" :empty="error ? 'The models could not be loaded' : 'No model is ready here yet'"
                           :licence-busy="licenceBusy" :place-error="placeError" @accept-licence="acceptLicence" @stop-machine="stopOnMachine"/>
        <p v-if="error" class="field-error" role="alert">{{ error }} <UiButton @click="loadSources">Try again</UiButton></p>
        <p v-else-if="current?.unavailable" class="field-error" role="status">{{ current.unavailable }}</p>


        <h3 class="auto-gap auto-step-heading">Classes <UiBadge>{{ asked.length }} / {{ state.classes.length }}</UiBadge></h3>
        <p class="auto-help">Select the classes to include. Descriptions keep your labeling instructions clear.</p>
        <p v-if="!state.classes.length" class="auto-help" role="status">No classes yet. Add the objects you want to label, or apply a saved workflow.</p>
        <div class="auto-classes">
          <form v-if="adding" class="auto-class adding" @submit.prevent="saveAdd">
            <input ref="newName" v-model="adding.name" class="text-input class-name" placeholder="Class name" aria-label="New class name" maxlength="40" @keydown.esc.prevent="adding=null">
            <label class="class-colour" :style="{background:adding.color}" title="Colour"><input v-model="adding.color" type="color" aria-label="Colour of the new class"></label>
            <input v-model="adding.description" class="text-input class-desc" placeholder="Visual description of the class" aria-label="Description of the new class" maxlength="300">
            <div class="auto-class-actions"><UiButton type="button" @click="adding=null">Cancel</UiButton><UiButton type="submit" variant="primary" :disabled="classBusy||!adding.name.trim()">Save class</UiButton></div>
          </form>
          <div v-for="c in state.classes" :key="c.name" class="auto-class">
            <input class="text-input class-name" :value="c.name" readonly :aria-label="`Class ${c.name}`">
            <label class="class-colour" :style="{background:c.color}" :title="canChange?`Change the colour of ${c.name}`:c.name"><input type="color" :value="c.color" :disabled="!canChange||classBusy||generating||c.editable===false" :aria-label="`Colour of ${c.name}`" @change="saveClass(c,{color:$event.target.value})"></label>
            <input class="text-input class-desc" :value="c.description" :readonly="!canChange||generating||classBusy||c.editable===false" placeholder="Visual description of the class" :aria-label="`Visual description of ${c.name}`" maxlength="300" @change="saveClass(c,{description:$event.target.value})">
            <label class="auto-ask" :title="asked.includes(c.name) ? `The AI looks for ${c.name}` : `The AI does not look for ${c.name}`"><input type="checkbox" :checked="asked.includes(c.name)" :disabled="generating||(asked.length===1&&asked.includes(c.name))" :aria-label="`Ask the AI for ${c.name}`" @change="toggleAsked(c.name)"> Ask the AI</label>
            <div class="auto-class-meta"><UiBadge :class="c.trained?'':'label-only'">{{ c.trained ? 'Model class' : 'Label only' }}</UiBadge><button v-if="canChange&&c.removable!==false" class="icon-button" :disabled="classBusy||generating" :aria-label="`Remove class ${c.name}`" :title="`Remove class ${c.name}`" @click="removeClass(c)"><Trash2 :size="15"/></button></div>
          </div>
        </div>
        <button v-if="canChange" class="auto-add" type="button" :disabled="!!adding||generating" @click="startAdd"><Plus :size="15"/> Add Class</button>
        <p v-else class="auto-help">Only the Owner or a Data preparer changes the classes.</p>
        <p v-if="classError" class="field-error" role="alert">{{ classError }}</p>
        <div class="auto-agent-launch"><p class="auto-help">Need help with your labels?</p><UiButton @click="openAgent"><Sparkles :size="16"/>Chat with Auto Label agent<ChevronRight :size="14"/></UiButton><button class="auto-add" @click="openWorkflow">Manage reusable workflows<ChevronRight :size="13"/></button></div>

        <details class="auto-advanced">
          <summary><SlidersHorizontal :size="16" aria-hidden="true"/> Model details &amp; usage</summary>
          <dl v-if="current">
            <dt>Model</dt><dd>{{ label(current) }}</dd><template v-if="current.what"><dt>About this model</dt><dd>{{ current.what }}</dd></template>
            <dt>Where it runs and its cost</dt><dd>{{ detail }}.<template v-if="place"> SAM 3 is started on {{ place.name }} the first time and stopped after 15 minutes without a photo; its weights stay on the machine for the next time.</template><template v-else-if="startsServer(current)"> If it is not running it is started first, which takes a moment.</template></dd>
            <template v-if="current.licence"><dt>Licence</dt><dd>{{ current.licence }}. A label started from its answer says so, so that it can be left out later.</dd></template>
          </dl>
          <p v-else class="auto-help">Choose a model to see where it runs and what it costs.</p>
        </details>
      </aside>

      <aside v-if="agentVisited" v-show="agentOpen" class="auto-agent-side"><AutoLabelAgent :context="agentContext" @settled="refreshWorkflows"/></aside>
      <div class="auto-main">
        <div class="auto-preview-head"><div class="auto-view-tabs" role="tablist" aria-label="Auto Label views"><button id="auto-preview-tab" role="tab" :aria-selected="tab==='preview'" aria-controls="auto-preview-panel" @click="tab='preview'">Preview</button><button id="auto-workflow-tab" role="tab" :aria-selected="tab==='workflow'" aria-controls="auto-workflow-panel" @click="openWorkflow">Workflow</button></div><span class="auto-bar-state" role="status"><strong>{{ stateWords[0] }}</strong><small v-if="blocked || generating || previews.some(p => p.state === 'refused')">{{ stateWords[1] }}</small></span></div>
        <div v-if="workflowVisited" v-show="tab==='workflow'" id="auto-workflow-panel" class="auto-workflow-panel" role="tabpanel" aria-labelledby="auto-workflow-tab"><LabelingWorkflow ref="workflowPanel" :project="state.ref" :definition="definition" :can-save="canChange" :disabled="generating||busy||loading" :source-name="current ? label(current) : ''" @apply="applyWorkflow"/></div>
        <div v-show="tab==='preview'" id="auto-preview-panel" ref="canvas" class="auto-canvas" role="tabpanel" aria-labelledby="auto-preview-tab">
          <div v-if="shown" class="auto-tools">
            <label class="auto-switch"><input v-model="showLabels" type="checkbox" role="switch" :aria-checked="showLabels"><span aria-hidden="true"/>Show Labels</label>
            <button class="icon-button" type="button" aria-label="Show the preview full screen" title="Full screen" @click="fullScreen"><Maximize2 :size="16"/></button>
          </div>
          <figure v-if="shown" class="auto-result">
            <div class="auto-stage"><img :src="shown.image.url" :alt="shown.image.name" @load="loaded(shown,$event)">
              <svg v-if="showLabels&&shown.state==='ready'&&shown.width" :viewBox="`0 0 ${shown.width} ${shown.height}`" preserveAspectRatio="none" aria-hidden="true"><polygon v-for="(s,i) in shown.shapes" :key="i" :points="s.points.map(q=>q.join(',')).join(' ')" :fill="colour(s.kind)" :fill-opacity="fillOpacity" :stroke="colour(s.kind)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
            </div>
            <figcaption>
              <span>{{ shown.image.name }}</span>
              <span v-if="shown.state==='asking'">Asking the model…</span>
              <span v-else-if="shown.state==='waiting'" role="status">{{ shown.now }}…</span>
              <span v-else-if="shown.state==='refused'" class="field-error">{{ shown.error }}</span>
              <span v-else-if="!shown.shapes.length">Nothing found on this photo.</span>
              <span v-else class="auto-counts"><b v-for="c in counts(shown.shapes)" :key="c.name"><i :style="{background:c.color}"/>{{ c.n }} {{ c.name }}{{ c.n===1?'':'s' }}</b></span>
            </figcaption>
          </figure>
          <div v-else class="auto-preview-idle">
            <img v-if="pickedImages.length" class="auto-original-image" :src="pickedImages[0].url" :alt="pickedImages[0].name"/>
            <div v-else class="auto-welcome"><ImageIcon :size="28"/><strong>{{ media.length ? 'Choose an image to preview' : 'This batch has no images yet' }}</strong></div>
            <span v-if="pickedImages.length" class="auto-before-note"><Zap :size="12"/>Generate a preview to see your labels</span>
          </div>
        </div>
        <div v-show="tab==='preview'" class="auto-strip">
          <div class="auto-thumbs" role="list" :aria-label="choosing ? 'Choose up to four photos to preview' : 'Preview photos'">
            <button v-for="image in (choosing ? media : pickedImages)" :key="image.id" role="listitem" :class="{picked:choosing&&picked.includes(image.id), focused:!choosing&&shown?.image.id===image.id}"
                    :aria-pressed="choosing ? picked.includes(image.id) : shown?.image.id===image.id" :title="image.name"
                    @click="choosing ? toggle(image) : (focus = Math.max(0, previews.findIndex(p => p.image.id===image.id)))">
              <img :src="image.thumb||image.url" :alt="image.name" @error="image.thumb=''"><Check v-if="choosing&&picked.includes(image.id)" :size="14"/>
            </button>
          </div>
          <UiButton :disabled="generating" @click="choosing=!choosing"><ImageIcon :size="15"/> {{ choosing ? 'Done choosing' : 'Choose preview images' }}</UiButton>
          <span class="auto-strip-count">{{ picked.length }} preview{{ picked.length===1?'':'s' }} · {{ media.length }} in batch</span>
        </div>
      </div>
    </div>
    <UiDialog :open="confirmOpen" title="Label this batch" @close="confirmOpen=false">
      <p class="dialog-description">The {{ media.length }} photo{{ media.length===1?'':'s' }} of this batch are given to you to label. Each one opens in the editor with what <strong>{{ current ? label(current) : '' }}</strong> finds, as a head start: you check every corner and send the photo to review.</p>
      <p class="dialog-description">{{ current ? label(current) : '' }} also becomes your choice for any photo nobody has drawn on in this project. Change it in the editor with “Find Objects with AI” (M).</p>
      <p v-if="current" class="dialog-description">Each photo is charged to you: {{ detail }}.</p>
      <p v-if="current?.research_only" class="dialog-description">This model is for research or evaluation use only. A label started from its answer says so, so that it can be left out later.</p>
      <div class="dialog-actions"><UiButton @click="confirmOpen=false">Cancel</UiButton><UiButton variant="primary" :disabled="busy" @click="start"><Check :size="15"/> Start labelling</UiButton></div>
    </UiDialog>
  </section>
</template>

<style scoped>
.auto-label{display:flex;flex-direction:column;min-width:0;height:calc(100dvh - 38px);min-height:600px;background:white;container-type:inline-size}
.auto-agent-side{border-right:1px solid #e2e8f0;min-height:0;min-width:0}.auto-agent-launch{border-top:1px solid #e2e8f0;padding-top:16px;margin-top:10px}.auto-agent-launch .button{width:100%;font-size:11px;padding:12px 9px;margin-top:8px;justify-content:flex-start}.auto-agent-launch .button>svg:last-child{margin-left:auto}.auto-back-button{display:flex!important;gap:6px;font-size:10px;white-space:nowrap}.auto-view-tabs{display:flex;gap:14px}.auto-view-tabs button{padding:6px 0;border:0;border-bottom:2px solid transparent;background:none;font-size:11px;color:#64748b}.auto-view-tabs button[aria-selected=true]{color:#2563eb;border-color:#2563eb}.auto-workflow-panel{display:flex;flex:1;min-height:0;overflow:hidden}
.auto-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid #e2e8f0;background:#fff;min-height:52px}
.auto-head h2{font-size:15px;letter-spacing:0;font-weight:650;white-space:nowrap;margin:0}.auto-back-button{display:grid;place-items:center;border:0;background:none;padding:6px;color:#475569;border-radius:5px}.auto-back-button:hover{background:#f1f5f9}.auto-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.auto-breadcrumb{display:flex;align-items:center;gap:5px;min-width:0;font-size:10px;color:#64748b}.auto-breadcrumb button{border:0;background:none;padding:0;color:#64748b;font-size:inherit}.auto-breadcrumb button:hover{text-decoration:underline}.auto-batch-link{max-width:165px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.auto-progress{display:flex;align-items:center;gap:12px;list-style:none;padding:0;margin:0;color:#94a3b8;font-size:10px}.auto-progress li{display:flex;align-items:center;gap:5px;white-space:nowrap}.auto-progress li>span{width:11px;height:11px;border:1px solid #cbd5e1;border-radius:50%;font-size:0}.auto-progress [aria-current=step]{color:#1d4ed8;font-weight:600}.auto-progress [aria-current=step]>span{border-color:#2563eb;background:#eff6ff}
.auto-header-actions{display:flex;align-items:center;gap:7px;margin-left:auto;flex-wrap:wrap}.auto-header-actions .button{min-height:31px;padding:6px 9px;font-size:10px;gap:5px;white-space:nowrap}.auto-cost{display:flex;align-items:center;gap:5px;padding:7px;border-radius:5px;background:#f1f5f9;color:#475569;font-size:10px;white-space:nowrap;cursor:help}
.auto-body{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:0;flex:1;overflow:hidden}.auto-side{display:flex;flex-direction:column;gap:11px;padding:22px 20px;border-right:1px solid #e2e8f0;min-width:0;overflow-y:auto;background:#fff}.auto-side h3{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:#334155;margin:0}.auto-gap{margin-top:15px!important}.auto-help{font-size:11px;line-height:1.6;color:#64748b;margin:0}
.auto-classes{border:1px solid #e2e8f0;border-radius:8px}.auto-class{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:9px;padding:12px;border-bottom:1px solid #eef2f6}.auto-class:last-child{border-bottom:0}.auto-class.adding{background:#f8fafc}.auto-class .text-input{width:100%;min-width:0;padding:8px 9px;font-size:11px;border-color:#e2e8f0}.class-name{grid-column:1;grid-row:1;font-weight:500}.class-desc{grid-column:1/-1;grid-row:2}.class-colour{grid-column:2;grid-row:1;width:14px;height:14px;border-radius:50%;position:relative;justify-self:center;box-shadow:0 0 0 2px #fff,0 0 0 3px #e2e8f0}.class-colour input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}.auto-ask{grid-column:1;grid-row:3;display:flex;align-items:center;gap:6px;font-size:10px;min-height:22px;color:#475569}.auto-ask input{accent-color:var(--accent);width:13px;height:13px}.auto-class-meta{grid-column:2;grid-row:3;display:flex;align-items:center;gap:3px}.auto-class-meta .badge{font-size:8px;padding:3px 5px}.auto-class-meta .icon-button{width:20px;height:20px;padding:3px}.label-only{background:#fffbeb;color:#92400e}.auto-class-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:5px}.auto-class-actions .button{font-size:10px;padding:5px 7px}.auto-add{display:flex;align-items:center;align-self:flex-start;gap:5px;padding:7px 0;border:0;background:none;color:#2563eb;font-size:11px;min-height:30px}
.auto-advanced{border-top:1px solid #e2e8f0;margin-top:10px;padding-top:10px}.auto-advanced summary{display:flex;align-items:center;gap:7px;font-size:11px;color:#475569;min-height:32px;cursor:pointer;list-style:none}.auto-advanced dl{font-size:11px;line-height:1.6;margin:8px 0}.auto-advanced dt{font-weight:600;margin-top:8px}.auto-advanced dd{margin:3px 0;color:#64748b}
.auto-main{display:flex;flex-direction:column;min-width:0;min-height:0;background:#fbfcfe;padding:12px 16px 0;gap:12px}.auto-preview-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.auto-preview-head h3{font-size:12px;font-weight:500;margin:0}.auto-bar-state{display:flex;flex-direction:column;align-items:flex-end;gap:3px;font-size:10px;color:#64748b}.auto-bar-state strong{font-weight:400}.auto-bar-state small{font-size:10px;max-width:300px}.auto-canvas{position:relative;flex:1;min-height:280px;border:1px solid #e2e8f0;border-radius:12px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}.auto-canvas:fullscreen{background:#101828}.auto-preview-idle{display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:0}.auto-original-image{display:block;width:100%;height:100%;object-fit:contain}.auto-before-note{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;white-space:nowrap;padding:7px 10px;border:1px solid #e2e8f0;border-radius:20px;background:#ffffffd9;color:#64748b;font-size:10px;pointer-events:none}.auto-welcome{display:flex;flex-direction:column;align-items:center;gap:12px;color:#64748b;text-align:center;font-size:13px}
.auto-tools{position:absolute;top:12px;right:12px;z-index:2;display:flex;align-items:center;gap:6px;padding:4px 6px;background:white;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 2px 4px #0f172a08}.auto-switch{display:flex;align-items:center;gap:6px;font-size:11px;color:#475569;padding:0 6px;min-height:30px}.auto-switch input{position:absolute;opacity:0;width:1px;height:1px}.auto-switch span{width:28px;height:16px;position:relative;border-radius:8px;background:#cbd5e1}.auto-switch span::after{content:'';position:absolute;left:2px;top:2px;width:12px;height:12px;border-radius:50%;background:white}.auto-switch input:checked+span{background:#2563eb}.auto-switch input:checked+span::after{transform:translateX(12px)}.auto-switch input:focus-visible+span{outline:2px solid #60a5fa;outline-offset:3px}.auto-tools .icon-button{width:28px;height:28px;padding:5px}
.auto-result{margin:0;width:100%;max-width:1000px}.auto-stage{position:relative;line-height:0;background:#e2e8f0}.auto-stage img{width:100%;height:auto;display:block}.auto-stage svg{position:absolute;inset:0;width:100%;height:100%}.auto-result figcaption{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:10px;margin-top:8px;color:#64748b}.auto-canvas:fullscreen figcaption{color:#e2e8f0}.auto-counts{display:flex;gap:10px}.auto-counts b{display:flex;align-items:center;gap:4px;font-weight:400}.auto-counts i{width:7px;height:7px;border-radius:50%}
.auto-strip{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 -16px;padding:10px 12px;border-top:1px solid #e2e8f0;background:#fff;min-height:72px}.auto-thumbs{display:flex;gap:7px;flex-wrap:wrap}.auto-thumbs button{position:relative;width:52px;height:52px;padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:#f1f5f9}.auto-thumbs img{width:100%;height:100%;object-fit:cover}.auto-thumbs .picked,.auto-thumbs .focused{border-color:#2563eb}.auto-thumbs svg{position:absolute;top:3px;right:3px;background:#2563eb;color:white;border-radius:50%;padding:1px}.auto-strip .button{font-size:10px;padding:5px 8px;border:0;box-shadow:none}.auto-strip-count{margin-left:auto;font-size:10px;color:#64748b}
.auto-breadcrumb,.auto-progress,.auto-cost,.auto-bar-state,.auto-bar-state small{font-size:11px}.auto-header-actions .button{font-size:11px}.auto-side h3{font-size:13px}.auto-help,.auto-class .text-input,.auto-agent-launch .button{font-size:12px}.auto-ask,.auto-add,.auto-view-tabs button,.auto-strip-count{font-size:11px}.auto-agent-side{height:100%}
@container(max-width:800px){.auto-breadcrumb{display:none}.auto-body{grid-template-columns:240px minmax(0,1fr)}.auto-progress{gap:8px}.auto-header-actions{margin-left:0}.auto-head{gap:9px}.auto-side{padding:16px 12px}.auto-canvas{padding:12px}}
@media(max-width:700px){.auto-label{height:auto;min-height:0}.auto-body{display:flex;flex-direction:column;overflow:visible}.auto-side{border-right:0;border-bottom:1px solid #e2e8f0;overflow:visible}.auto-main{min-height:520px}.auto-canvas{min-height:350px}.auto-head{padding:10px 12px}.auto-header-actions{width:100%;gap:6px}.auto-progress{margin-left:auto}.auto-cost{margin-left:auto}.auto-before-note{font-size:9px}.auto-header-actions .button{font-size:9px;padding:6px}.auto-strip-count{margin-left:0}}
</style>
<style>
main#main:has(.auto-label){padding:0!important}.main-shell:has(.auto-label)>.topbar{min-height:38px;height:38px;padding:0 16px}.main-shell:has(.auto-label)>.topbar .avatar{width:25px;height:25px}.main-shell:has(.auto-label)>.topbar .breadcrumb,.main-shell:has(.auto-label)>.topbar .dashboard-back{font-size:10px}@media(max-width:700px){.main-shell:has(.auto-label)>.topbar{height:auto;min-height:42px}}
</style>
