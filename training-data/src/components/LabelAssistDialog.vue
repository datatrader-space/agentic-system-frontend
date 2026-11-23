<script setup>
// Label Assist (agentic-docs/LABEL_EDITOR_TOOLS_PLAN.md 2.3): a dialog over the photo. The models are in three tabs by
// their ``tab`` (contract C6: 'ai' foundation models and vision + SAM 3 pairs, 'yours' trained in this project,
// 'published' AADML's and the workspace's open models); a source without ``tab`` is in none (nothing is guessed).
// One model is chosen with the same picker as Auto Label (ModelSourcePicker, with its Polygons / Masks switch); the
// project's classes are chips, ticked as Auto Label left them (askedClasses), untick one to skip it; "+ Add class"
// follows the editor's own rules (only a person who may change classes, never while they are locked). A description
// per class is saved to the class (vision models read it). "Label with AI" hands the choice to the editor, which asks
// the model through the same path as Find Objects with AI and shows the answer dashed until Save.
import { computed, nextTick, ref, watch } from 'vue';
import { Check, ExternalLink, Plus, Search, WandSparkles } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiDialog from './UiDialog.vue';
import ModelSourcePicker from './ModelSourcePicker.vue';
import { askedClasses } from '../api/annotate.js';
import { costOf, groupSources, sentence } from '../sourceFamilies.js';
import { helpArticle, MASKS_POLYGONS_SLUG } from '../editorTools.js';

const props = defineProps({
  open: Boolean,
  projectRef: { type: String, default: '' },
  sources: { type: Array, default: () => [] },
  classes: { type: Array, default: () => [] },
  preference: { type: String, default: '' },
  only: { type: String, default: '' },              // one class alone (the class panel's AI button)
  mayChangeClasses: Boolean,
  busy: Boolean,
  error: { type: String, default: '' },             // why the editor did not ask the model (in words)
  // ``addClass(name)`` adds a project class and answers its name (throws with the server's words when refused).
  addClass: { type: Function, default: null },
});
const emit = defineEmits(['close', 'run', 'find']);

const ASSIST_TABS = [{ id: 'ai', name: 'AI models' }, { id: 'yours', name: 'Your models' }, { id: 'published', name: 'Published models' }];
const tab = ref('ai'); const pick = ref(''); const ticked = ref([]); const described = ref({});
const describing = ref(false);
const adding = ref(false); const newName = ref(''); const addError = ref(''); const addBusy = ref(false); const nameBox = ref(null);
const tabSources = computed(() => props.sources.filter(s => s.tab === tab.value));
// The models a tab offers, counted as the picker shows them: one row per model or pair (its Polygons and Masks are one).
const countIn = id => groupSources(props.sources.filter(s => s.tab === id)).reduce((n, g) => n + g.families.length, 0);
const current = computed(() => props.sources.find(s => s.id === pick.value) || null);
const names = computed(() => props.classes.map(c => c.name));
const firstUsable = list => list.find(s => s.id === props.preference && !s.unavailable)?.id || list.find(s => !s.unavailable)?.id || '';

function reset() {
  const preferred = props.sources.find(s => s.id === props.preference && s.tab);
  tab.value = preferred?.tab || ASSIST_TABS.find(t => countIn(t.id))?.id || 'ai';
  pick.value = firstUsable(tabSources.value);
  ticked.value = props.only ? [props.only] : askedClasses(props.projectRef, names.value);
  described.value = Object.fromEntries(props.classes.map(c => [c.name, c.description || '']));
  adding.value = false; newName.value = ''; addError.value = ''; describing.value = false;
}
watch(() => props.open, open => { if (open) reset(); }, { immediate: true });
function chooseTab(id) { if (tab.value === id) return; tab.value = id; pick.value = firstUsable(tabSources.value); }
function tabKey(event) {
  const at = ASSIST_TABS.findIndex(t => t.id === tab.value);
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  const next = ASSIST_TABS[(at + step + ASSIST_TABS.length) % ASSIST_TABS.length];
  chooseTab(next.id); nextTick(() => document.getElementById(`assist-tab-${next.id}`)?.focus());
}
function toggle(name) { ticked.value = ticked.value.includes(name) ? ticked.value.filter(n => n !== name) : [...ticked.value, name]; }
async function startAdd() { adding.value = true; addError.value = ''; await nextTick(); nameBox.value?.focus(); }
async function saveAdd() {
  const name = newName.value.trim(); if (!name || !props.addClass) return;
  addBusy.value = true; addError.value = '';
  try { const added = await props.addClass(name); if (added && !ticked.value.includes(added)) ticked.value = [...ticked.value, added]; if (added) described.value[added] = described.value[added] || ''; adding.value = false; newName.value = ''; }
  catch (e) { addError.value = e.message; } finally { addBusy.value = false; }
}
// What one photo costs with the chosen model, in words ('' when its words name no price: a model of this project).
const price = computed(() => {
  const s = current.value; if (!s) return '';
  if (s.hosted?.price) return `${s.hosted.price}, paid from your balance.`;
  const cost = costOf(s);
  return cost ? `${sentence(cost)} Paid from your balance.` : '';
});
const blocked = computed(() => !current.value ? 'Choose a model.' : current.value.unavailable ? current.value.unavailable
  : !ticked.value.length ? 'Tick at least one class for the model to look for.' : '');
const shownTicked = computed(() => props.classes.filter(c => ticked.value.includes(c.name)));
function run() {
  if (blocked.value || props.busy) return;
  const changed = {};
  for (const c of props.classes) if (ticked.value.includes(c.name) && (described.value[c.name] || '').trim() !== (c.description || '').trim()) changed[c.name] = (described.value[c.name] || '').trim();
  emit('run', { source: pick.value, classes: props.classes.map(c => c.name).filter(n => ticked.value.includes(n)), descriptions: props.mayChangeClasses ? changed : {}, only: !!props.only });
}
</script>

<template>
  <UiDialog class="assist-dialog" :open="open" title="Label Assist" @close="emit('close')">
    <p class="dialog-description">{{ only ? `A model labels every ${only} in this photo.` : 'A model labels the classes you tick in this photo.' }} You check what it found before anything is kept.</p>
    <div class="assist-tabs" role="tablist" aria-label="Models" @keydown="tabKey">
      <button v-for="t in ASSIST_TABS" :id="`assist-tab-${t.id}`" :key="t.id" type="button" role="tab" :aria-selected="tab===t.id" :tabindex="tab===t.id?0:-1"
              aria-controls="assist-panel" @click="chooseTab(t.id)">{{ t.name }} <small>{{ countIn(t.id) }}</small></button>
    </div>
    <div id="assist-panel" class="assist-panel" role="tabpanel" :aria-labelledby="`assist-tab-${tab}`">
      <ModelSourcePicker v-if="tabSources.length" v-model="pick" :sources="tabSources" inline :disabled="busy"/>
      <p v-else class="assist-empty">{{ tab==='yours' ? 'No model is trained in this project yet. Train one on its labelled photos, or choose another tab.' : 'No model is offered here yet. Choose another tab.' }}</p>
      <a v-if="tabSources.length" class="assist-link" :href="helpArticle(MASKS_POLYGONS_SLUG)" target="_blank" rel="noopener">Masks or polygons: what changes <ExternalLink :size="12" aria-hidden="true"/></a>
    </div>
    <fieldset class="assist-classes">
      <legend>Classes to label</legend>
      <div class="assist-chips">
        <button v-for="c in classes" :key="c.name" type="button" :aria-pressed="ticked.includes(c.name)" :class="['assist-chip',{on:ticked.includes(c.name)}]" @click="toggle(c.name)">
          <i :style="{background:c.color}" aria-hidden="true"/>{{ c.name }}<Check v-if="ticked.includes(c.name)" :size="14" aria-hidden="true"/>
        </button>
        <button v-if="mayChangeClasses&&addClass&&!adding" type="button" class="assist-chip assist-add" @click="startAdd"><Plus :size="14" aria-hidden="true"/> Add class</button>
      </div>
      <p v-if="!classes.length" class="assist-empty">This project has no classes yet.{{ mayChangeClasses ? ' Add what you want labelled.' : ' A person who may change its classes adds them.' }}</p>
      <form v-if="adding" class="assist-add-form" @submit.prevent="saveAdd">
        <label class="field-label" for="assist-new-class">New class</label>
        <div><input id="assist-new-class" ref="nameBox" v-model="newName" class="text-input" maxlength="40" placeholder="What do you want to label?" autocomplete="off" @keydown.esc.stop.prevent="adding=false">
          <UiButton type="button" @click="adding=false">Cancel</UiButton><UiButton type="submit" variant="primary" :disabled="!newName.trim()||addBusy">Add class</UiButton></div>
        <p v-if="addError" class="field-error" role="alert">{{ addError }}</p>
      </form>
      <button v-if="shownTicked.length" type="button" class="link-button assist-describe-toggle" :aria-expanded="describing" aria-controls="assist-descriptions" @click="describing=!describing">{{ describing ? 'Hide the descriptions' : 'Describe the classes (optional)' }}</button>
      <div v-if="shownTicked.length&&describing" id="assist-descriptions" class="assist-descriptions">
        <template v-for="c in shownTicked" :key="c.name">
          <label :for="`assist-describe-${c.name}`">{{ c.name }} <span>optional</span></label>
          <input v-if="mayChangeClasses" :id="`assist-describe-${c.name}`" v-model="described[c.name]" class="text-input" maxlength="300" placeholder="What it looks like, e.g. only the ones on the floor" aria-describedby="assist-describe-help">
          <span v-else :id="`assist-describe-${c.name}`" class="assist-described">{{ c.description || 'No description.' }}</span>
        </template>
        <small id="assist-describe-help">{{ mayChangeClasses ? 'A description is saved to its class. Vision models read it; SAM 3 looks for the class name alone.' : 'Descriptions belong to the classes; a person who may change classes edits them.' }}</small>
      </div>
    </fieldset>
    <p v-if="price" class="assist-price">{{ price }}</p>
    <p v-if="blocked&&(current||tabSources.length)" class="field-help" role="status">{{ blocked }}</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <div class="dialog-actions assist-actions">
      <button type="button" class="link-button" @click="emit('find')"><Search :size="14" aria-hidden="true"/> Find one object by name instead</button>
      <UiButton @click="emit('close')">Cancel</UiButton>
      <UiButton variant="primary" :disabled="!!blocked||busy" @click="run"><WandSparkles :size="15" aria-hidden="true"/> Label with AI</UiButton>
    </div>
  </UiDialog>
</template>

<style scoped>
.assist-dialog { width: min(640px, calc(100% - 32px)); max-height: calc(100vh - 48px); overflow: auto; }
.assist-tabs { display: flex; gap: 4px; margin-top: 16px; border-bottom: 1px solid #e2e8f0; }
.assist-tabs button { min-height: 44px; padding: 10px 14px; border: 0; border-bottom: 2px solid transparent; background: none; color: #475569; font-size: 13px; font-weight: 550; cursor: pointer; }
.assist-tabs button small { margin-left: 4px; color: #94a3b8; font-weight: 500; }
.assist-tabs button[aria-selected=true] { color: #1d4ed8; border-color: #2563eb; }
.assist-tabs button:focus-visible { outline: 2px solid var(--aadml-focus); outline-offset: -2px; border-radius: 6px 6px 0 0; }
.assist-panel { display: flex; flex-direction: column; gap: 8px; padding: 14px 0 4px; }
.assist-empty { margin: 0; padding: 14px; border: 1px dashed #cbd5e1; border-radius: 10px; color: #475569; font-size: 13px; }
.assist-link { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; font-size: 12px; color: #1d4ed8; }
.assist-classes { border: 0; margin: 12px 0 0; padding: 0; }
.assist-classes legend { padding: 0; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: #344054; }
.assist-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.assist-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 6px 12px; border: 1px solid #d0d5dd; border-radius: 999px; background: #fff;
  color: #475569; font-size: 13px; cursor: pointer; transition: background .15s, border-color .15s; }
.assist-chip i { width: 9px; height: 9px; border-radius: 50%; }
.assist-chip.on { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
.assist-chip:focus-visible { outline: 2px solid var(--aadml-focus); outline-offset: 2px; }
.assist-add { border-style: dashed; color: #1d4ed8; }
.assist-add-form { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.assist-add-form > div { display: flex; gap: 6px; }
.assist-add-form .text-input { flex: 1; }
.assist-add-form .button { margin: 0; }
.assist-describe-toggle { display: inline-flex; margin-top: 12px; min-height: 32px; align-items: center; }
.assist-descriptions { display: grid; grid-template-columns: minmax(90px, auto) 1fr; gap: 8px 12px; align-items: center; margin-top: 14px; font-size: 13px; }
.assist-descriptions label { color: #344054; font-weight: 550; }
.assist-descriptions label span { font-weight: 400; color: #64748b; font-size: 12px; }
.assist-descriptions small { grid-column: 1 / -1; color: #64748b; font-size: 12px; }
.assist-described { color: #475569; }
.assist-price { margin: 14px 0 0; font-size: 13px; color: #344054; }
.assist-actions { align-items: center; }
.link-button { background: none; border: 0; padding: 0; color: var(--aadml-primary); font: inherit; font-size: 13px; text-decoration: underline; cursor: pointer; }
.assist-actions .link-button { display: inline-flex; align-items: center; gap: 6px; margin-right: auto; min-height: 44px; }
@media (prefers-reduced-motion: reduce) { .assist-chip { transition: none; } }
</style>
