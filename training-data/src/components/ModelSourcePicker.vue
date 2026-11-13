<script setup>
// Which model draws the head start, for Auto Label and the editor's "Find Objects with AI" (one component, so the two
// never differ; agentic-docs/AUTO_LABEL_VISION_SAM3_PLAN.md). The models are grouped by maker (sourceFamilies.js); a row
// is a model or a pair ("GPT-6.1 Terra + SAM 3"), and the Masks / Polygons switch under it chooses how its answer is
// shown. A model the platform cannot run now is listed with the reason and cannot be chosen (no other model is taken
// in its place). ``inline`` shows the list open, without the button (the editor's dialog).
// A model with SAM 3 may also run on one of the workspace's own machines (agentic-docs/SAM3_ON_MY_MACHINE_PLAN.md):
// "Where SAM 3 runs" then chooses AADML's GPU server or the machine (``v-model:where``, '' or ``machine:<id>``), with
// the machine's fee. Before SAM 3 first runs on a machine of the workspace, Meta's SAM License is accepted once: the
// step links the licence and asks the page to record the acceptance (``accept-licence``). While SAM 3 runs there its
// stage is shown, and the person may stop it (``stop-machine``; it also stops by itself after 15 minutes unused).
import { computed, nextTick, ref, watch } from 'vue';
import { Boxes, Check, ChevronDown, ChevronRight, Cloud, Cpu, ExternalLink, Search, ScrollText, Shapes, PaintBucket } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import { familyOfId, groupSources, idFor, labelsOfId, waysOf } from '../sourceFamilies.js';

const props = defineProps({
  sources: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  inline: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  empty: { type: String, default: 'No model is ready here yet.' },
  where: { type: String, default: '' },
  licenceBusy: { type: Boolean, default: false },
  placeError: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'update:where', 'accept-licence', 'stop-machine']);
const uid = Math.random().toString(36).slice(2, 9);
const open = ref(props.inline);
const query = ref('');
const folded = ref({});
const active = ref('');                          // the family key the keyboard is on
const searchBox = ref(null);
const trigger = ref(null);

const groups = computed(() => groupSources(props.sources));
const current = computed(() => familyOfId(groups.value, props.modelValue));
const labels = computed(() => labelsOfId(props.sources, props.modelValue));
const ways = computed(() => waysOf(current.value));
// The machines the chosen model's SAM 3 may run on, and the one chosen (none: AADML's GPU server).
const places = computed(() => current.value?.where || []);
const place = computed(() => places.value.find(p => p.id === props.where) || null);
const usesSam3 = computed(() => /^(sam3(?:-masks)?$|vision-sam3(?:-masks)?:)/.test(props.modelValue));
const shown = computed(() => {
  const q = query.value.trim().toLowerCase();
  return groups.value
    .map(g => ({ ...g, families: g.families.filter(f => !q || f.name.toLowerCase().includes(q) || g.maker.toLowerCase().includes(q)) }))
    .filter(g => g.families.length);
});
// The rows the keyboard walks: the shown, unfolded and choosable ones (a search unfolds every group).
const walkable = computed(() => shown.value.flatMap(g => (folded.value[g.maker] && !query.value ? [] : g.families.filter(f => !f.unavailable))));
const waysWords = family => waysOf(family).map(w => (w === 'masks' ? 'Masks' : 'Polygons')).join(' · ');

function choose(family) {
  if (family.unavailable) return;
  emit('update:modelValue', idFor(family, labels.value));
  if (!props.inline) { open.value = false; nextTick(() => trigger.value?.focus()); }
}
function setWay(way) { if (current.value) emit('update:modelValue', idFor(current.value, way)); }
function setWhere(id) { if (!props.disabled) emit('update:where', id); }
// Another model that cannot run on the machine chosen: it runs where it runs.
watch(places, now => { if (props.where && !now.some(p => p.id === props.where)) emit('update:where', ''); });
function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) { active.value = current.value?.key || walkable.value[0]?.key || ''; nextTick(() => searchBox.value?.focus()); }
}
function move(step) {
  const list = walkable.value;
  if (!list.length) return;
  const at = list.findIndex(f => f.key === active.value);
  active.value = list[(at + step + list.length) % list.length].key;
  nextTick(() => document.getElementById(`${uid}-${active.value}`)?.scrollIntoView({ block: 'nearest' }));
}
function onKey(event) {
  if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
  else if (event.key === 'Enter') { event.preventDefault(); const f = walkable.value.find(x => x.key === active.value); if (f) choose(f); }
  else if (event.key === 'Escape' && !props.inline) { event.preventDefault(); open.value = false; trigger.value?.focus(); }
}
watch(query, () => { active.value = walkable.value[0]?.key || ''; });
</script>

<template>
  <div :class="['source-picker', { inline }]">
    <button v-if="!inline" ref="trigger" type="button" class="source-trigger" :disabled="disabled||loading||!sources.length"
            aria-haspopup="listbox" :aria-expanded="open" :aria-controls="`${uid}-list`" @click="toggle">
      <Boxes :size="18" aria-hidden="true"/>
      <span class="source-trigger-text">
        <strong>{{ loading ? 'Loading the models…' : current ? current.name : (sources.length ? 'Choose a model' : empty) }}</strong>
        <small v-if="current">{{ current.maker }}</small>
      </span>
      <ChevronDown :size="18" aria-hidden="true" :class="{ turned: open }"/>
    </button>
    <div v-if="open" class="source-panel" @keydown="onKey">
      <label class="source-search"><Search :size="16" aria-hidden="true"/>
        <input ref="searchBox" v-model="query" type="search" placeholder="Search models" aria-label="Search models"
               role="combobox" :aria-expanded="true" :aria-controls="`${uid}-list`" :aria-activedescendant="active ? `${uid}-${active}` : undefined">
      </label>
      <div :id="`${uid}-list`" class="source-list" role="listbox" :aria-label="'Models'">
        <p v-if="!shown.length" class="source-empty">{{ sources.length ? 'No model matches that.' : empty }}</p>
        <div v-for="g in shown" :key="g.maker" role="group" :aria-labelledby="`${uid}-g-${g.maker}`" class="source-group">
          <button :id="`${uid}-g-${g.maker}`" type="button" class="source-maker" :aria-expanded="!folded[g.maker]||!!query"
                  @click="folded[g.maker]=!folded[g.maker]">
            <span>{{ g.maker }}</span><small>{{ g.families.length }}</small>
            <ChevronDown v-if="!folded[g.maker]||query" :size="16" aria-hidden="true"/><ChevronRight v-else :size="16" aria-hidden="true"/>
          </button>
          <template v-if="!folded[g.maker]||query">
            <div v-for="f in g.families" :id="`${uid}-${f.key}`" :key="f.key" role="option"
                 :aria-selected="current?.key===f.key" :aria-disabled="!!f.unavailable"
                 :class="['source-option', { chosen: current?.key===f.key, keyed: active===f.key, off: !!f.unavailable }]"
                 :title="f.unavailable || f.what" @click="choose(f)" @mousemove="!f.unavailable && (active=f.key)">
              <span class="source-option-text">
                <strong>{{ f.name }}</strong>
                <small v-if="f.unavailable" class="source-off">{{ f.unavailable }}</small>
                <small v-else>{{ waysWords(f) }}<template v-if="f.research_only"> · Research or evaluation only</template><template v-if="f.where.length"> · Also on your machine</template></small>
              </span>
              <Check v-if="current?.key===f.key" :size="16" aria-hidden="true"/>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div v-if="current && ways.length > 1" class="source-ways" role="radiogroup" aria-label="How the answer is shown">
      <button v-for="way in ways" :key="way" type="button" role="radio" :aria-checked="labels===way" :class="{ on: labels===way }"
              :disabled="disabled" @click="setWay(way)">
        <PaintBucket v-if="way==='masks'" :size="15" aria-hidden="true"/><Shapes v-else :size="15" aria-hidden="true"/>
        {{ way === 'masks' ? 'Masks' : 'Polygons' }}
      </button>
    </div>
    <div v-if="current && (usesSam3 || places.length)" class="source-where" role="radiogroup" :aria-labelledby="`${uid}-where`">
      <span :id="`${uid}-where`" class="source-where-label">Where SAM 3 runs</span>
      <button type="button" role="radio" :aria-checked="!place" :class="['source-place', { on: !place }]" :disabled="disabled" @click="setWhere('')">
        <Cloud :size="18" aria-hidden="true"/>
        <span class="source-place-text"><strong>AADML GPU · RunPod</strong><small>Paid from your balance, by the second</small></span>
        <Check v-if="!place" :size="16" aria-hidden="true"/>
      </button>
      <button v-for="p in places" :key="p.id" type="button" role="radio" :aria-checked="place?.id===p.id"
              :class="['source-place', { on: place?.id===p.id, off: !!p.unavailable }]" :disabled="disabled||!!p.unavailable"
              :title="p.unavailable || `${p.gpu}`" @click="setWhere(p.id)">
        <Cpu :size="18" aria-hidden="true"/>
        <span class="source-place-text"><strong>Your machine: {{ p.name }}</strong>
          <small :class="{ 'source-off': !!p.unavailable }">{{ p.unavailable || `${p.price} · ${p.gpu}` }}</small></span>
        <Check v-if="place?.id===p.id" :size="16" aria-hidden="true"/>
      </button>
      <p v-if="!places.length" class="source-location-note" role="status">No eligible connected machine is available for this project. Check your machine connection and this project’s own-machine data-use setting.</p>
      <div v-if="place && place.state==='licence'" class="source-licence" role="group" :aria-labelledby="`${uid}-licence`">
        <ScrollText :size="18" aria-hidden="true"/>
        <div class="source-licence-text">
          <strong :id="`${uid}-licence`">Accept the SAM License first</strong>
          <p>SAM 3 is Meta's model, shared under the SAM License. Its weights go to {{ place.name }} only under that licence, and a
            copy of it is kept beside them. Someone in this workspace accepts it once.</p>
          <a :href="place.licence?.url" target="_blank" rel="noopener noreferrer">Read the SAM License<ExternalLink :size="14" aria-hidden="true"/><span class="visually-hidden"> (opens in a new tab)</span></a>
          <UiButton variant="primary" :disabled="licenceBusy" @click="emit('accept-licence', place)">{{ licenceBusy ? 'Accepting…' : 'Accept the SAM License' }}</UiButton>
        </div>
      </div>
      <p v-else-if="place?.running" class="source-running" role="status">SAM 3 on {{ place.name }}: {{ place.running.label }}.
        <button type="button" class="source-stop" :disabled="disabled" @click="emit('stop-machine', place)">Stop it</button></p>
      <p v-if="placeError" class="source-off source-error" role="alert">{{ placeError }}</p>
    </div>
    <div v-else-if="current" class="source-where"><span class="source-where-label">Where this model runs</span><p class="source-location-note">{{ current.detail || 'Location information is unavailable. Reload the models before running.' }}</p></div>
  </div>
</template>

<style scoped>
.source-picker { position: relative; display: flex; flex-direction: column; gap: 10px; }
.source-trigger { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 8px 12px; border: 1px solid #d0d5dd;
  border-radius: 10px; background: #fff; color: #16213a; text-align: left; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
.source-trigger:hover:not(:disabled) { border-color: #98a2b3; }
.source-trigger:focus-visible { outline: none; border-color: var(--aadml-primary); box-shadow: 0 0 0 3px var(--aadml-tint); }
.source-trigger:disabled { cursor: default; color: #667085; background: #f8f9fb; }
.source-trigger-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.source-trigger-text strong { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-trigger-text small { font-size: 12px; color: #667085; }
.turned { transform: rotate(180deg); transition: transform .15s; }
.source-panel { position: absolute; top: 54px; left: 0; right: 0; z-index: 30; background: #fff; border: 1px solid #e0e3eb; border-radius: 10px;
  box-shadow: 0 14px 32px #0f172a24; overflow: hidden; }
.inline .source-panel { position: static; box-shadow: none; }
.source-search { display: flex; align-items: center; gap: 8px; padding: 0 12px; border-bottom: 1px solid #eef0f4; color: #667085; }
.source-search input { flex: 1; min-width: 0; border: 0; outline: none; padding: 12px 0; font-size: 14px; background: none; color: #16213a; }
.source-list { max-height: 340px; overflow: auto; padding: 4px 0; }
.inline .source-list { max-height: 300px; }
.source-maker { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 8px 14px; border: 0; background: none;
  font-size: 13px; font-weight: 600; color: #344054; cursor: pointer; }
.source-maker span { flex: 1; text-align: left; }
.source-maker small { font-weight: 500; color: #98a2b3; }
.source-maker:focus-visible { outline: 2px solid var(--aadml-focus); outline-offset: -2px; }
.source-option { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 14px 8px 28px; cursor: pointer; }
.source-option.keyed { background: #f5f7fb; }
.source-option.chosen { background: var(--aadml-tint); }
.source-option.chosen strong { color: var(--aadml-primary); }
.source-option.off { cursor: not-allowed; }
.source-option.off strong { color: #98a2b3; }
.source-option-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.source-option-text strong { font-size: 14px; font-weight: 550; color: #16213a; }
.source-option-text small { font-size: 12px; color: #667085; }
.source-off { color: #b54708 !important; }
.source-empty { margin: 0; padding: 14px; font-size: 13px; color: #667085; }
.source-ways { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 10px; background: #f2f4f7; }
.source-ways button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; border: 0; border-radius: 8px;
  background: none; color: #475467; font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s, color .15s; }
.source-ways button.on { background: #fff; color: #16213a; box-shadow: 0 1px 3px #10182826; }
.source-ways button:focus-visible { outline: 2px solid var(--aadml-focus); outline-offset: 1px; }
.source-where { display: flex; flex-direction: column; gap: 6px; }
.source-location-note { margin: 0; font-size: 12px; line-height: 1.5; color: #667085; }
.source-where-label { font-size: 13px; font-weight: 600; color: #344054; }
.source-place { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 8px 12px; border: 1px solid #d0d5dd;
  border-radius: 10px; background: #fff; color: #475467; text-align: left; cursor: pointer; transition: border-color .15s, background .15s; }
.source-place:hover:not(:disabled) { border-color: #98a2b3; }
.source-place.on { border-color: var(--aadml-primary); background: var(--aadml-tint); color: var(--aadml-primary); }
.source-place.off { cursor: not-allowed; }
.source-place:disabled { cursor: not-allowed; }
.source-place:focus-visible { outline: 2px solid var(--aadml-focus); outline-offset: 1px; }
.source-place-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.source-place-text strong { font-size: 14px; font-weight: 550; color: #16213a; overflow-wrap: anywhere; }
.source-place-text small { font-size: 12px; color: #667085; overflow-wrap: anywhere; }
.source-licence { display: flex; gap: 10px; padding: 12px; border: 1px solid #fedf89; border-radius: 10px; background: #fffaeb; color: #b54708; }
.source-licence-text { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.source-licence-text strong { font-size: 14px; font-weight: 600; color: #16213a; }
.source-licence-text p { margin: 0; font-size: 13px; line-height: 1.5; color: #475467; }
.source-licence-text a { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; font-size: 13px; color: var(--aadml-primary); }
.source-licence-text a:focus-visible { outline: 2px solid var(--aadml-focus); outline-offset: 2px; border-radius: 4px; }
.source-running { margin: 0; font-size: 13px; color: #027a48; }
.source-stop { min-height: 32px; padding: 0 4px; border: 0; background: none; color: var(--aadml-primary); font: inherit; text-decoration: underline; cursor: pointer; }
.source-stop:focus-visible { outline: 2px solid var(--aadml-focus); outline-offset: 2px; border-radius: 4px; }
.source-error { margin: 0; font-size: 13px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (prefers-reduced-motion: reduce) { .turned, .source-trigger, .source-ways button, .source-place { transition: none; } }
</style>
