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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, Image as ImageIcon, Plus, Zap, Check, Trash2, Sparkles, Coins, Maximize2, RotateCcw, SlidersHorizontal } from 'lucide-vue-next';
import ModelSourcePicker from './ModelSourcePicker.vue';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { api, classesOf } from '../api/annotate.js';
import { tidyUp } from '../geometry.js';

const props = defineProps({ batch: Object, state: Object, media: Array, busy: Boolean });
const emit = defineEmits(['close', 'autolabel']);
const sources = ref([]); const loading = ref(true); const error = ref(''); const chosen = ref('');
const choosing = ref(false); const confirmOpen = ref(false);
const showLabels = ref(true); const focus = ref(0); const canvas = ref(null);
const picked = ref(props.media.slice(0, 1).map(m => m.id));
const previews = ref([]);                      // [{image, state: 'asking'|'waiting'|'ready'|'refused', shapes, now, error, width, height}]
let timers = []; let stopped = false;

const current = computed(() => sources.value.find(s => s.id === chosen.value) || null);
const shown = computed(() => previews.value[Math.min(focus.value, previews.value.length - 1)] || null);
const predictions = computed(() => (shown.value?.state === 'ready' ? shown.value.shapes.length : 0));
// What the bottom bar says the page is doing.
const stateWords = computed(() => {
  if (loading.value) return ['Loading the models', ''];
  if (!current.value) return ['Choose a model', 'Pick the model that draws the head start.'];
  if (current.value.unavailable) return ['This model cannot be used now', current.value.unavailable];
  if (generating.value) return ['Generating the preview', 'The model is looking at the preview photos.'];
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

// Another model, or another way of showing it: the preview is of the one chosen before, so it goes.
watch(chosen, () => { previews.value = []; focus.value = 0; });
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
      <p class="auto-sub">{{ media.length }} photo{{ media.length===1?'':'s' }} in this batch</p>
    </header>
    <div class="auto-body">
      <aside class="auto-side">
        <div class="auto-pipeline" aria-disabled="true">
          <Sparkles :size="18" aria-hidden="true"/>
          <span><strong>Build a custom labeling pipeline</strong><small>Build and refine with the agent.</small></span>
          <UiBadge>Coming soon</UiBadge>
        </div>
        <p class="auto-or"><span>or</span></p>
        <ModelSourcePicker v-model="chosen" :sources="sources" :loading="loading" :empty="error ? 'The models could not be loaded' : 'No model is ready here yet'"/>
        <p v-if="error" class="field-error" role="alert">{{ error }} <UiButton @click="loadSources">Try again</UiButton></p>
        <p v-else-if="current?.unavailable" class="field-error" role="status">{{ current.unavailable }}</p>
        <p v-else-if="current?.what" class="auto-what">{{ current.what }}</p>

        <h3 class="auto-gap">Classes <UiBadge>{{ state.classes.length }}</UiBadge></h3>
        <p class="auto-help">Every model is asked for these classes. Wall, window and door are what a walls model learns; a class you add is label-only.</p>
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
        <button v-if="canChange" class="auto-add" type="button" :disabled="!!adding" @click="startAdd"><Plus :size="15"/> Add Class</button>
        <p v-else class="auto-help">Only the Owner or a Data preparer changes the classes.</p>
        <p v-if="classError" class="field-error" role="alert">{{ classError }}</p>

        <details class="auto-advanced">
          <summary><SlidersHorizontal :size="16" aria-hidden="true"/> Advanced</summary>
          <dl v-if="current">
            <dt>Model</dt><dd>{{ label(current) }}</dd>
            <dt>Where it runs and its cost</dt><dd>{{ current.detail }}. If it is not running it is started first, which takes a moment.</dd>
            <template v-if="current.licence"><dt>Licence</dt><dd>{{ current.licence }}. A label started from its answer says so, so that it can be left out later.</dd></template>
          </dl>
          <p v-else class="auto-help">Choose a model to see where it runs and what it costs.</p>
        </details>
      </aside>

      <div class="auto-main">
        <div class="auto-preview-head"><h3>Preview</h3><span v-if="previews.length" role="status">{{ predictions }} prediction{{ predictions===1?'':'s' }}</span></div>
        <div ref="canvas" class="auto-canvas">
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
          <div v-else class="auto-welcome">
            <span class="auto-bolt"><Zap :size="26"/></span>
            <strong>See what the model finds before you label.</strong>
            <p>A model draws every class on up to four photos of this batch. Nothing is saved: you check every corner in the editor and send each photo to review.</p>
            <UiButton variant="primary" :disabled="!current||!!current?.unavailable||!picked.length" @click="generate"><Zap :size="15"/> Generate Preview</UiButton>
          </div>
        </div>
        <div class="auto-strip">
          <div class="auto-thumbs" role="list" :aria-label="choosing ? 'Choose up to four photos to preview' : 'Preview photos'">
            <button v-for="image in (choosing ? media : pickedImages)" :key="image.id" role="listitem" :class="{picked:choosing&&picked.includes(image.id), focused:!choosing&&shown?.image.id===image.id}"
                    :aria-pressed="choosing ? picked.includes(image.id) : shown?.image.id===image.id" :title="image.name"
                    @click="choosing ? toggle(image) : (focus = Math.max(0, previews.findIndex(p => p.image.id===image.id)))">
              <img :src="image.thumb||image.url" :alt="image.name" @error="image.thumb=''"><Check v-if="choosing&&picked.includes(image.id)" :size="14"/>
            </button>
          </div>
          <UiButton @click="choosing=!choosing"><ImageIcon :size="15"/> {{ choosing ? 'Done' : 'Change' }}</UiButton>
          <span class="auto-strip-count">{{ picked.length }} preview{{ picked.length===1?'':'s' }} · {{ media.length }} in batch</span>
        </div>
      </div>
    </div>
    <footer class="auto-bar">
      <span class="auto-bar-state" role="status"><strong>{{ stateWords[0] }}</strong><small>{{ stateWords[1] }}</small></span>
      <span v-if="current" class="auto-credits" :title="current.detail"><Coins :size="15" aria-hidden="true"/> Uses Credits</span>
      <UiButton v-if="generating" @click="stop">Stop</UiButton>
      <UiButton v-else :disabled="!current||!!current?.unavailable||!picked.length" @click="generate"><RotateCcw v-if="previews.length" :size="15"/><Zap v-else :size="15"/> {{ previews.length ? 'Run Again' : 'Generate Preview' }}</UiButton>
      <UiButton variant="primary" :disabled="!current||!!current?.unavailable||busy||!media.length" @click="confirmOpen=true"><Check :size="15"/> Label Batch <ArrowRight :size="15"/></UiButton>
    </footer>
    <UiDialog :open="confirmOpen" title="Label this batch" @close="confirmOpen=false">
      <p class="dialog-description">The {{ media.length }} photo{{ media.length===1?'':'s' }} of this batch are given to you to label. Each one opens in the editor with what <strong>{{ current ? label(current) : '' }}</strong> finds, as a head start: you check every corner and send the photo to review.</p>
      <p class="dialog-description">{{ current ? label(current) : '' }} also becomes your choice for any photo nobody has drawn on in this project. Change it in the editor with “Find Objects with AI” (M).</p>
      <p v-if="current" class="dialog-description">Each photo is charged to you: {{ current.detail }}.</p>
      <p v-if="current?.research_only" class="dialog-description">This model is for research or evaluation use only. A label started from its answer says so, so that it can be left out later.</p>
      <div class="dialog-actions"><UiButton @click="confirmOpen=false">Cancel</UiButton><UiButton variant="primary" :disabled="busy" @click="start"><Check :size="15"/> Start labelling</UiButton></div>
    </UiDialog>
  </section>
</template>

<style scoped>
.auto-label{min-width:0;display:flex;flex-direction:column;min-height:100%}
.auto-head{padding:22px 24px 18px;border-bottom:1px solid #e0e3eb}
.team-back{display:flex;align-items:center;gap:7px;border:0;background:none;color:#657890;font-size:12px;padding:0;cursor:pointer}
.auto-head h2{display:flex;align-items:center;gap:10px;font-size:21px;font-weight:600;margin:12px 0 0}
.auto-sub{margin:4px 0 0;font-size:13px;color:#667085}
.auto-body{flex:1;display:grid;grid-template-columns:340px minmax(0,1fr);gap:0;min-height:0}
.auto-side{padding:20px 22px 28px;border-right:1px solid #e0e3eb;display:flex;flex-direction:column;gap:12px;min-width:0}
.auto-side h3{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;margin:0}
.auto-help,.auto-what{font-size:13px;line-height:1.5;color:#5b6b82;margin:0}
.auto-gap{margin-top:14px !important}
.auto-pipeline{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #e9d7fe;border-radius:12px;background:linear-gradient(180deg,#faf5ff,#fff);color:#7c3aed}
.auto-pipeline span{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.auto-pipeline strong{font-size:14px;font-weight:600;color:#16213a}
.auto-pipeline small{font-size:12px;color:#5b6b82}
.auto-or{display:flex;align-items:center;gap:10px;margin:0;font-size:12px;color:#98a2b3;text-transform:uppercase}
.auto-or::before,.auto-or::after{content:'';flex:1;height:1px;background:#e0e3eb}
.auto-classes{border:1px solid #e0e3eb;border-radius:10px}
.auto-class{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 10px;align-items:center;padding:12px;border-bottom:1px solid #eef0f4}.auto-class.adding{background:var(--aadml-tint)}.class-name{grid-column:1;grid-row:1}.class-desc{grid-column:1;grid-row:2}.class-colour{grid-column:2;grid-row:1;justify-self:center;position:relative;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #d0d5dd;cursor:pointer}.class-colour input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.class-colour input:disabled{cursor:default}.auto-class-meta{grid-column:2;grid-row:2;display:flex;align-items:center;gap:2px}.auto-class-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}.label-only{background:#fef3c7;color:#92400e}
.auto-class:last-child{border-bottom:0}
.auto-class .text-input{padding:9px 11px;font-size:13px;width:100%;min-width:0}.auto-class .class-name{font-weight:500;color:#16213a;background:#fff}
.auto-add{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 4px;border:0;background:none;color:var(--aadml-primary);font-size:14px;font-weight:500;cursor:pointer}
.auto-add:disabled{color:#98a2b3;cursor:default}
.auto-add:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px;border-radius:6px}
.auto-advanced{border-top:1px solid #e0e3eb;padding-top:12px;margin-top:6px}
.auto-advanced summary{display:flex;align-items:center;gap:8px;min-height:40px;font-size:14px;font-weight:500;color:#344054;cursor:pointer;list-style:none}
.auto-advanced summary::-webkit-details-marker{display:none}
.auto-advanced dl{margin:8px 0 0;font-size:13px;line-height:1.5}
.auto-advanced dt{font-weight:600;color:#344054;margin-top:8px}
.auto-advanced dd{margin:2px 0 0;color:#5b6b82}
.auto-main{min-width:0;display:flex;flex-direction:column;padding:16px 20px 20px;gap:12px;background:#fbfcfe}
.auto-preview-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.auto-preview-head h3{margin:0;font-size:15px;font-weight:600}
.auto-preview-head span{font-size:13px;color:#5b6b82}
.auto-canvas{position:relative;flex:1;min-height:420px;border:1px solid #e0e3eb;border-radius:12px;background:#f2f4f7;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto}
.auto-canvas:fullscreen{background:#101828;padding:24px}
.auto-tools{position:absolute;top:12px;right:12px;z-index:2;display:flex;align-items:center;gap:4px;padding:4px 6px;background:#fff;border:1px solid #e0e3eb;border-radius:10px;box-shadow:0 2px 6px #10182814}
.auto-switch{display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:0 8px;font-size:13px;color:#344054;cursor:pointer}
.auto-switch input{position:absolute;opacity:0;width:1px;height:1px}
.auto-switch span{position:relative;width:32px;height:18px;border-radius:9px;background:#d0d5dd;transition:background .15s}
.auto-switch span::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s}
.auto-switch input:checked+span{background:var(--aadml-primary)}
.auto-switch input:checked+span::after{transform:translateX(14px)}
.auto-switch input:focus-visible+span{outline:2px solid var(--aadml-focus);outline-offset:2px}
.auto-result{margin:0;width:100%;max-width:900px}
.auto-stage{position:relative;line-height:0;border-radius:8px;overflow:hidden;background:#e4e7ec}
.auto-stage img{width:100%;height:auto;display:block}
.auto-stage svg{position:absolute;inset:0;width:100%;height:100%}
.auto-result figcaption{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;color:#5b6b82;margin-top:10px}
.auto-canvas:fullscreen figcaption{color:#d0d5dd}
.auto-counts{display:flex;gap:12px;flex-wrap:wrap}
.auto-counts b{display:flex;align-items:center;gap:5px;font-weight:500}
.auto-counts i{width:8px;height:8px;border-radius:50%}
.auto-welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;padding:40px 24px;max-width:520px}
.auto-welcome strong{font-size:17px;font-weight:600;line-height:1.5;color:#16213a}
.auto-welcome p{font-size:14px;line-height:1.6;margin:0;color:#5b6b82}
.auto-bolt{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:#fef9c3;color:#ca8a04;border:2px solid #fde68a}
.auto-strip{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.auto-thumbs{display:flex;flex-wrap:wrap;gap:8px}
.auto-thumbs button{position:relative;width:64px;height:64px;padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:#f2f4f7;cursor:pointer}
.auto-thumbs button.picked,.auto-thumbs button.focused{border-color:var(--aadml-focus)}
.auto-thumbs button:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.auto-thumbs img{width:100%;height:100%;object-fit:cover}
.auto-thumbs svg{position:absolute;top:4px;right:4px;background:var(--aadml-focus);color:#fff;border-radius:50%;padding:1px}
.auto-strip-count{margin-left:auto;font-size:13px;color:#5b6b82}
.auto-bar{position:sticky;bottom:0;z-index:10;display:flex;align-items:center;gap:12px;padding:12px 24px;background:#fff;border-top:1px solid #e0e3eb;box-shadow:0 -4px 12px #1018280d}
.auto-bar-state{flex:1;min-width:0;display:flex;flex-direction:column}
.auto-bar-state strong{font-size:14px;font-weight:600;color:#16213a}
.auto-bar-state small{font-size:12px;color:#5b6b82;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.auto-credits{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 10px;border-radius:8px;background:#f2f4f7;color:#344054;font-size:13px;cursor:help}
@media(max-width:1100px){.auto-body{grid-template-columns:1fr}.auto-side{border-right:0;border-bottom:1px solid #e0e3eb}}
@media(max-width:640px){.auto-head{padding:16px}.auto-side{padding:16px}.auto-main{padding:14px 16px}.auto-canvas{min-height:260px;padding:10px}
  .auto-bar{flex-wrap:wrap;padding:12px 16px}.auto-bar-state{flex-basis:100%}.auto-bar .button{flex:1}.auto-credits{order:-1}.auto-strip-count{margin-left:0}}
@media(prefers-reduced-motion:reduce){.auto-switch span,.auto-switch span::after{transition:none}}
</style>
