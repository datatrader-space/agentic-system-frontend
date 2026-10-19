<script setup>
// Auto Label for one batch (a real project). The models are the ones the old editor's "Start from walls that are
// already there" offers (views._detect_sources): the published detectors, and the models trained in this project.
// "Generate Preview" really asks the chosen model about the preview photos and draws what it finds (nothing is
// saved). "Auto Label With This Model" gives the batch to this person and makes the model their choice for a photo
// nobody has drawn on: each photo then opens in the editor with the model's walls as a head start, which the person
// checks and sends to review — the same rule as the old editor; a model never makes a label by itself.
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Image as ImageIcon, Plus, Zap, Check, Trash2, Sparkles, Layers, Filter, ThumbsUp, ThumbsDown } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { api, classesOf } from '../api/annotate.js';
import { tidyUp } from '../geometry.js';

const props = defineProps({ batch: Object, state: Object, media: Array, busy: Boolean });
const emit = defineEmits(['close', 'autolabel']);
const sources = ref([]); const loading = ref(true); const error = ref(''); const chosen = ref('');
const pickerOpen = ref(false); const tab = ref('Foundation Models'); const choosing = ref(false); const confirmOpen = ref(false);
const picked = ref(props.media.slice(0, 1).map(m => m.id));
const previews = ref([]);                      // [{image, state: 'asking'|'waiting'|'ready'|'refused', shapes, now, error, width, height}]
let timers = []; let stopped = false;

const foundation = computed(() => sources.value.filter(s => !s.trained_here));
const mine = computed(() => sources.value.filter(s => s.trained_here));
const current = computed(() => sources.value.find(s => s.id === chosen.value) || null);
const pickedImages = computed(() => props.media.filter(m => picked.value.includes(m.id)));
const generating = computed(() => previews.value.some(p => p.state === 'asking' || p.state === 'waiting'));
const colour = kind => props.state.classes.find(c => c.name === kind)?.color || '#8b5cf6';
const label = s => `${s.mode ? `${s.mode}: ` : ''}${s.name}`;

// The models the reference product also lists, which cannot run here yet: shown, marked Coming soon, never chosen.
const COMING = [
  { name: 'SAM 3 (Masks)', kind: 'Mask labels', what: 'SAM 3 with RLE compressed masks' },
  { name: 'SAM 3 (Polygons)', kind: 'Polygon labels', what: 'SAM 3 with polygons' },
  { name: 'GPT-6 Astra (Masks)', kind: 'Mask labels', what: 'GPT-6 Astra segments your classes with RLE compressed masks' },
  { name: 'GPT-6 Astra + SAM 3 (Polygons)', kind: 'Polygon labels', what: 'GPT-6 Astra finds your classes, SAM 3 draws each mask' },
];
async function loadSources() {
  loading.value = true; error.value = '';
  try {
    const body = await api.detectSources(props.state.ref);
    sources.value = body.sources;
    chosen.value = body.preference || body.sources.find(s => s.tidy)?.id || body.sources[0]?.id || '';
    tab.value = current.value?.trained_here ? 'My Models' : 'Foundation Models';
  } catch (e) { error.value = `The models could not be loaded. ${e.message}`; } finally { loading.value = false; }
}
onMounted(loadSources);

// The project's classes (label_classes.py). Wall, window and door are what a walls model learns; a class added here is
// label-only. The Owner and a Data preparer change the list; everyone else reads it.
const canChange = computed(() => !!props.state.canChangeClasses);
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

function choose(id) { chosen.value = id; pickerOpen.value = false; previews.value = []; }
function toggle(image) {
  const at = picked.value.indexOf(image.id);
  if (at >= 0) picked.value.splice(at, 1); else if (picked.value.length < 4) picked.value.push(image.id);
}
// One photo at a time: a model that is not running is started by the first one; the others then answer quickly.
async function generate() {
  timers.forEach(clearTimeout); timers = []; stopped = false;
  previews.value = pickedImages.value.map(image => ({ image, state: 'asking', shapes: [], now: 'asking the model', error: '' }));
  for (const preview of previews.value) await ask(preview);
}
async function ask(preview) {
  while (!stopped) {
    try {
      const body = await api.detect(props.state.ref, preview.image.id, chosen.value);
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
function start() { confirmOpen.value = false; emit('autolabel', chosen.value); }
</script>

<template>
  <section class="auto-label">
    <header class="auto-head">
      <button class="team-back" @click="emit('close')"><ArrowLeft :size="14"/>Batch: {{ batch.givenName || batch.name }}</button><span v-if="batch.code" class="batch-code" title="Reference code of this batch">{{ batch.code }}</span>
      <h2><Zap :size="20"/> Auto Label</h2>
    </header>
    <div class="auto-body">
      <div class="auto-side">
        <h3>Classes <UiBadge>{{ state.classes.length }}</UiBadge></h3>
        <p>Wall, window and door are what a walls model learns. A class you add is label-only: it is drawn and kept with the labels, and no model is trained on it.</p>
        <div class="auto-row"><span>{{ canChange ? '' : 'Only the Owner or a Data preparer changes the classes.' }}</span><UiButton v-if="canChange" :disabled="!!adding" @click="startAdd"><Plus :size="15"/> Add Class</UiButton></div>
        <div class="auto-classes">
          <form v-if="adding" class="auto-class adding" @submit.prevent="saveAdd">
            <input ref="newName" v-model="adding.name" class="text-input class-name" placeholder="Class name" aria-label="New class name" maxlength="40" @keydown.esc.prevent="adding=null">
            <label class="class-colour" :style="{background:adding.color}" title="Colour"><input v-model="adding.color" type="color" aria-label="Colour of the new class"></label>
            <input v-model="adding.description" class="text-input class-desc" placeholder="Visual description of the class" aria-label="Description of the new class" maxlength="300">
            <div class="auto-class-actions"><UiButton type="button" @click="adding=null">Cancel</UiButton><UiButton type="submit" variant="primary" :disabled="classBusy||!adding.name.trim()">Save class</UiButton></div>
          </form>
          <div v-for="c in state.classes" :key="c.name" class="auto-class">
            <input class="text-input class-name" :value="c.name" readonly :aria-label="`Class ${c.name}`">
            <label class="class-colour" :style="{background:c.color}" :title="canChange?`Change the colour of ${c.name}`:c.name"><input type="color" :value="c.color" :disabled="!canChange||classBusy" :aria-label="`Colour of ${c.name}`" @change="saveClass(c,{color:$event.target.value})"></label>
            <input class="text-input class-desc" :value="c.description" :readonly="!canChange" placeholder="Visual description of the class" :aria-label="`Visual description of ${c.name}`" maxlength="300" @change="saveClass(c,{description:$event.target.value})">
            <div class="auto-class-meta"><UiBadge :class="c.trained?'':'label-only'">{{ c.trained ? 'Trained' : 'Label only' }}</UiBadge><button v-if="canChange&&!c.trained" class="icon-button" :disabled="classBusy" :aria-label="`Remove class ${c.name}`" :title="`Remove class ${c.name}`" @click="removeClass(c)"><Trash2 :size="15"/></button></div>
          </div>
        </div>
        <p v-if="classError" class="field-error" role="alert">{{ classError }}</p>
        <h3 class="auto-gap">Preview Images</h3>
        <p>Select up to four photos of this batch to preview what the model finds.</p>
        <div class="auto-row"><span><ImageIcon :size="16"/> {{ picked.length }} of {{ media.length }} selected</span><UiButton @click="choosing=!choosing">{{ choosing ? 'Done' : 'Change' }}</UiButton></div>
        <div class="auto-thumbs">
          <button v-for="image in (choosing ? media : pickedImages)" :key="image.id" :class="{picked:picked.includes(image.id)}" :aria-pressed="picked.includes(image.id)" :title="image.name" @click="choosing&&toggle(image)">
            <img :src="image.url" :alt="image.name"><Check v-if="choosing&&picked.includes(image.id)" :size="14"/>
          </button>
        </div>
      </div>
      <div class="auto-main">
        <div class="auto-model">
          <button class="auto-current" :aria-expanded="pickerOpen" :disabled="loading||!sources.length" @click="pickerOpen=!pickerOpen">
            <span><strong>{{ loading ? 'Loading the models…' : current ? label(current) : error ? 'The models could not be loaded' : 'No model is ready on this server yet' }}<code v-if="current" class="label-kind">Polygon labels</code></strong>
              <small v-if="current">{{ current.research_only ? 'Research or evaluation only' : current.trained_here ? 'Trained in this project' : 'Published model' }} · Is this model useful? <ThumbsUp :size="12"/> <ThumbsDown :size="12"/> <em>Coming soon</em></small></span>
            <ChevronUp v-if="pickerOpen" :size="18"/><ChevronDown v-else :size="18"/>
          </button>
          <UiButton variant="primary" :disabled="!current||busy||!media.length" @click="confirmOpen=true"><Zap :size="15"/> Auto Label With This Model</UiButton>
        </div>
        <div v-if="pickerOpen" class="auto-picker">
          <div class="auto-tabs" role="tablist">
            <button v-for="t in [['Foundation Models',foundation.length],['My Models',mine.length],['My Workflows',null]]" :key="t[0]" role="tab" :aria-selected="tab===t[0]" :class="{active:tab===t[0]}" @click="tab=t[0]">{{ t[0] }} <UiBadge>{{ t[1] ?? 'Coming soon' }}</UiBadge></button>
          </div>
          <template v-if="tab!=='My Workflows'">
            <button v-for="s in (tab==='Foundation Models'?foundation:mine)" :key="s.id" :class="['auto-option',{active:s.id===chosen}]" @click="choose(s.id)">
              <strong>{{ label(s) }} <code class="label-kind">Polygon labels</code></strong><UiBadge v-if="s.research_only" class="research-tag">Research or evaluation only</UiBadge>
              <span v-if="s.what">{{ s.what }}</span><span>{{ s.detail }}. If it is not running it is started first, which takes a moment.</span>
              <span v-if="s.licence">Licence: {{ s.licence }}. A label started from its answer says so, so that it can be left out later.</span>
            </button>
            <template v-if="tab==='Foundation Models'"><div v-for="m in COMING" :key="m.name" class="auto-option soon" aria-disabled="true"><strong>{{ m.name }} <code class="label-kind">{{ m.kind }}</code> <UiBadge>Coming soon</UiBadge></strong><span>{{ m.what }}</span></div></template>
            <p v-if="tab==='My Models'&&!mine.length" class="auto-empty">No model of this project is registered yet. Train one on the Train page.</p>
          </template>
          <p v-else class="auto-empty">Workflows that chain models are coming soon.</p>
          <div class="auto-agent">
            <p><Sparkles :size="15"/> <strong>Need custom labeling logic? Build with Agent</strong> <span class="soon-link"><Plus :size="12"/> Create manually</span> <UiBadge>Coming soon</UiBadge></p>
            <p>Chain models, language models and custom logic: label with one model, filter its answers, or combine models by consensus.</p>
            <div class="auto-agent-ask"><input class="text-input" disabled placeholder="Describe the labeling logic you need…" aria-label="Describe the labeling logic you need (coming soon)"><UiButton disabled>Open Chat <ArrowRight :size="14"/></UiButton></div>
            <div class="auto-agent-chips"><button disabled><Layers :size="13"/> Two-stage detect + classify</button><button disabled><Filter :size="13"/> Keep only the most confident box</button></div>
          </div>
        </div>
        <p v-if="error" class="field-error auto-error" role="alert">{{ error }} <UiButton @click="loadSources">Try again</UiButton></p>
        <div v-if="!previews.length" class="auto-welcome">
          <span class="auto-bolt"><Zap :size="26"/></span>
          <strong>Welcome to Auto Label,<br>a faster way to label your photos.</strong>
          <p>A model marks the walls, windows and doors first; you check every corner and send each photo to review.</p>
          <UiButton variant="primary" :disabled="!current||!picked.length" @click="generate"><Zap :size="15"/> Generate Preview</UiButton>
        </div>
        <div v-else class="auto-results">
          <div class="auto-row"><strong>Preview: {{ current ? label(current) : '' }}</strong><UiButton v-if="generating" @click="stop">Stop</UiButton><UiButton v-else @click="generate"><Zap :size="15"/> Generate again</UiButton></div>
          <figure v-for="p in previews" :key="p.image.id" class="auto-result">
            <div class="auto-stage"><img :src="p.image.url" :alt="p.image.name" @load="loaded(p,$event)">
              <svg v-if="p.state==='ready'&&p.width" :viewBox="`0 0 ${p.width} ${p.height}`" preserveAspectRatio="none"><polygon v-for="(s,i) in p.shapes" :key="i" :points="s.points.map(q=>q.join(',')).join(' ')" :fill="colour(s.kind)" fill-opacity=".25" :stroke="colour(s.kind)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
            </div>
            <figcaption>
              <span>{{ p.image.name }}</span>
              <span v-if="p.state==='asking'">Asking the model…</span>
              <span v-else-if="p.state==='waiting'" role="status">{{ p.now }}…</span>
              <span v-else-if="p.state==='refused'" class="field-error">{{ p.error }}</span>
              <span v-else-if="!p.shapes.length">Nothing found on this photo.</span>
              <span v-else class="auto-counts"><b v-for="c in counts(p.shapes)" :key="c.name"><i :style="{background:c.color}"/>{{ c.n }} {{ c.name }}{{ c.n===1?'':'s' }}</b></span>
            </figcaption>
          </figure>
          <p class="auto-note">A preview only: nothing is saved.</p>
        </div>
      </div>
    </div>
    <UiDialog :open="confirmOpen" title="Auto label this batch" @close="confirmOpen=false">
      <p class="dialog-description">The {{ media.length }} photo{{ media.length===1?'':'s' }} of this batch are given to you to label. Each one opens in the editor with what <strong>{{ current?.name }}</strong> finds, as a head start: you check every corner and send the photo to review.</p>
      <p class="dialog-description">{{ current?.name }} also becomes your choice for any photo nobody has drawn on in this project. Change it in the editor with “Start from walls that are already there” (M).</p>
      <p v-if="current?.research_only" class="dialog-description">This model is for research or evaluation use only. A label started from its answer says so, so that it can be left out later.</p>
      <div class="dialog-actions"><UiButton @click="confirmOpen=false">Cancel</UiButton><UiButton variant="primary" :disabled="busy" @click="start"><Zap :size="15"/> Start labelling</UiButton></div>
    </UiDialog>
  </section>
</template>

<style scoped>
.auto-label{min-width:0;display:flex;flex-direction:column}
.auto-head{padding:22px 24px 18px;border-bottom:1px solid #e0e3eb}
.team-back{display:flex;align-items:center;gap:7px;border:0;background:none;color:#657890;font-size:12px;padding:0}
.auto-head h2{display:flex;align-items:center;gap:10px;font-size:21px;font-weight:600;margin:12px 0 0}
.auto-body{display:grid;grid-template-columns:330px minmax(0,1fr);gap:22px;padding:22px 24px}
.auto-side h3{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600}
.auto-side>p{font-size:12px;margin:8px 0 14px}
.auto-gap{margin-top:26px}
.auto-classes{border:1px solid #e0e3eb;border-radius:8px}
.auto-class{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 10px;align-items:center;padding:12px;border-bottom:1px solid #eef0f4}.auto-class.adding{background:var(--aadml-tint)}.class-name{grid-column:1;grid-row:1}.class-desc{grid-column:1;grid-row:2}.class-colour{grid-column:2;grid-row:1;justify-self:center;position:relative;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #d0d5dd;cursor:pointer}.class-colour input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.class-colour input:disabled{cursor:default}.auto-class-meta{grid-column:2;grid-row:2;display:flex;align-items:center;gap:2px}.auto-class-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}.label-only{background:#fef3c7;color:#92400e}
.auto-class:last-child{border-bottom:0}
.auto-class .text-input{padding:9px 11px;font-size:13px;width:100%;min-width:0}.auto-class .class-name{font-weight:500;color:#16213a;background:#fff}
.auto-class .text-input:disabled{background:#f8f9fb}

.auto-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0;font-size:13px}
.auto-row>span{display:flex;align-items:center;gap:7px}
.auto-thumbs{display:flex;flex-wrap:wrap;gap:8px}
.auto-thumbs button{position:relative;width:76px;height:76px;padding:0;border:2px solid transparent;border-radius:7px;overflow:hidden;background:#f2f4f7}
.auto-thumbs button.picked{border-color:var(--aadml-focus)}
.auto-thumbs img{width:100%;height:100%;object-fit:cover}
.auto-thumbs svg{position:absolute;top:4px;right:4px;background:var(--aadml-focus);color:#fff;border-radius:50%;padding:1px}
.auto-main{min-width:0;border:1px solid #e0e3eb;border-radius:9px;display:flex;flex-direction:column;position:relative;min-height:560px}
.auto-model{display:flex;align-items:stretch;border-bottom:1px solid #e0e3eb}
.auto-current{flex:1;display:flex;align-items:center;justify-content:space-between;gap:12px;background:none;border:0;border-right:1px solid #e0e3eb;padding:14px 16px;text-align:left;color:#16213a;min-width:0}
.auto-current span{display:flex;flex-direction:column;gap:3px;min-width:0}
.auto-current strong{font-size:15px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.auto-current small{font-size:11px;color:#6d7c92}
.auto-model>.button{margin:12px 14px;align-self:center}
.auto-picker{position:absolute;top:64px;left:0;right:0;z-index:5;background:#fff;border-bottom:1px solid #e0e3eb;box-shadow:0 14px 28px #0f172a1f;max-height:440px;overflow:auto}
.auto-tabs{display:flex;gap:6px;border-bottom:1px solid #e0e3eb;padding:0 12px}
.auto-tabs button{display:flex;align-items:center;gap:6px;background:none;border:0;border-bottom:2px solid transparent;padding:12px 10px;color:#5f6f86;font-size:13px}
.auto-tabs button.active{color:var(--aadml-primary);border-color:var(--aadml-primary)}
.auto-option{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid #f0f2f5;padding:12px 16px;font-size:12px;color:#5b6b82;line-height:1.5}
.auto-option strong{font-size:14px;color:#16213a;font-weight:550}
.auto-option:hover,.auto-option.active{background:var(--aadml-tint)}
.auto-option.active strong{color:var(--aadml-primary)}
.auto-empty{padding:16px;font-size:13px}.label-kind{font-family:ui-monospace,Consolas,monospace;font-size:11px;font-weight:400;color:#5f6f86;margin-left:8px}.auto-current small{display:flex;align-items:center;gap:4px;flex-wrap:wrap}.auto-current em{font-style:normal;color:#98a2b3}.auto-option.soon{cursor:default;opacity:.75}.auto-option.soon:hover{background:none}.auto-option.soon strong{display:flex;align-items:center;gap:4px;flex-wrap:wrap}.auto-agent{padding:14px 16px;background:linear-gradient(180deg,#faf5ff,#fff);border-top:1px solid #eef0f4;font-size:12px}.auto-agent p{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 6px}.auto-agent strong{color:#16213a;font-size:13px}.soon-link{display:inline-flex;align-items:center;gap:2px;color:var(--aadml-primary)}.auto-agent-ask{display:flex;gap:8px;margin:8px 0}.auto-agent-ask .text-input{flex:1;padding:8px 10px;font-size:12px}.auto-agent-chips{display:flex;gap:8px;flex-wrap:wrap}.auto-agent-chips button{display:inline-flex;align-items:center;gap:6px;border:1px solid #dfe3ea;background:#fff;border-radius:6px;padding:6px 10px;font-size:12px;color:#5b6b82}.auto-error{display:flex;align-items:center;gap:10px;margin:12px 16px}
.research-tag{background:#fef3c7;color:#92400e}
.auto-welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;padding:40px 24px}
.auto-welcome strong{font-size:17px;font-weight:600;line-height:1.5;color:#16213a}
.auto-welcome p{font-size:13px;max-width:520px}
.auto-bolt{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:#fef9c3;color:#ca8a04;border:2px solid #fde68a}
.auto-results{padding:6px 18px 18px}
.auto-result{margin:0 0 16px}
.auto-stage{position:relative;line-height:0;border-radius:7px;overflow:hidden;background:#f2f4f7}
.auto-stage img{width:100%;height:auto;display:block}
.auto-stage svg{position:absolute;inset:0;width:100%;height:100%}
.auto-result figcaption{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:12px;color:#5b6b82;margin-top:8px}
.auto-counts{display:flex;gap:12px}
.auto-counts b{display:flex;align-items:center;gap:5px;font-weight:500}
.auto-counts i{width:8px;height:8px;border-radius:50%}
.auto-note{font-size:11px;color:#8b95a7}
@media(max-width:1100px){.auto-body{grid-template-columns:1fr}}
</style>
