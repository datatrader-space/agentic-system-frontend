<template>
  <!-- The Effects tab (plan D18-D21, contract section 3): add, remove, reorder (the list is the processing order) and
       switch effects on or off: blur, sharpen, vignette, mask, chroma key, and background removal behind its price
       card. Colour effects live in the Colour tab and keep their place in the same order. -->
  <div class="pn" data-test="panel-effects">
    <div class="ef-add">
      <label class="st-field">Add an effect
        <select v-model="adding" class="st-input" data-test="effect-kind">
          <option v-for="k in addable" :key="k" :value="k">{{ reg.effects[k].label }}</option>
        </select>
      </label>
      <IconButton :icon="Plus" :label="`Add ${reg.effects[adding]?.label || 'the effect'}`" :disabled="!adding || full" data-test="effect-add" @click="add" />
    </div>
    <p v-if="full" class="pn-note">A clip holds at most {{ reg.limits.effects_per_clip }} effects.</p>
    <p v-if="!list.length" class="pn-note">No effects on this clip yet.</p>
    <ol class="pn-list" aria-label="Effects, in the order they are applied">
      <li v-for="e in list" :key="e.id" class="pn-group ef-item" :class="{ 'is-off': !e.enabled }" :data-test="`effect-${e.kind}`">
        <div class="ef-head">
          <label class="pn-check"><input type="checkbox" :checked="e.enabled !== false" :aria-label="`${reg.effects[e.kind]?.label || e.kind} on`" @change="toggle(e, $event.target.checked)" /> {{ reg.effects[e.kind]?.label || e.kind }}</label>
          <span class="pn-icons">
            <IconButton :icon="ArrowUp" :label="`Move ${name(e)} earlier`" :disabled="indexOf(e) === 0" data-test="effect-up" @click="moveBy(e, -1)" />
            <IconButton :icon="ArrowDown" :label="`Move ${name(e)} later`" :disabled="indexOf(e) === all.length - 1" data-test="effect-down" @click="moveBy(e, 1)" />
            <IconButton :icon="Trash2" :label="`Remove ${name(e)}`" data-test="effect-remove" @click="remove(e)" />
          </span>
        </div>
        <MaskEditor v-if="e.kind === 'mask'" :doc="doc" :item="item" :fx="e" :t-rel="tRel" :aspect="doc.canvas.aspect" :compact="compact" @ops="$emit('ops', $event)" @seek="$emit('seek', $event)" />
        <template v-else>
          <template v-for="(spec, key) in reg.effects[e.kind]?.params || {}" :key="key">
            <ParamRow v-if="spec.type === 'number'" :doc="doc" :item="item" :path="`fx.${e.id}.${key}`" :spec="spec" :t-rel="tRel" :compact="compact" @ops="$emit('ops', $event)" @seek="$emit('seek', $event)" />
            <div v-else-if="spec.type === 'color'" class="ef-color">
              <label class="st-field">{{ spec.label }}<input class="pn-color" type="color" :value="e.params[key] || spec.default" :data-test="`effect-color-${key}`" @change="param(e, key, $event.target.value.toUpperCase())" /></label>
              <IconButton v-if="canPick" :icon="Pipette" label="Pick the colour from the screen" @click="pickColour(e, key)" />
            </div>
            <label v-else-if="spec.type === 'bool'" class="pn-check"><input type="checkbox" :checked="!!e.params[key]" @change="param(e, key, $event.target.checked)" /> {{ spec.label }}</label>
            <label v-else-if="spec.type === 'enum'" class="st-field">{{ spec.label }}<select class="st-input" :value="e.params[key]" @change="param(e, key, $event.target.value)"><option v-for="o in spec.choices" :key="o" :value="o">{{ o }}</option></select></label>
          </template>
          <p v-if="e.kind === 'chroma_key'" class="pn-note">Similarity widens the colour that becomes clear; smoothness softens its edge; spill removal takes the colour's tint off the person.</p>
        </template>
      </li>
    </ol>
    <fieldset v-if="isVideoClip" class="pn-group"><legend>Background removal</legend>
      <BgRemovalCard :doc="doc" :clip="item" @ops="$emit('ops', $event)" @refresh-media="$emit('refresh-media', $event)" />
    </fieldset>
  </div>
</template>
<script setup>
import { ArrowDown, ArrowUp, Pipette, Plus, Trash2 } from 'lucide-vue-next'
import IconButton from './IconButton.vue'
import { computed, ref } from 'vue'
import * as br from './bridge'
import ParamRow from './ParamRow.vue'
import { COLOUR_KINDS } from './panelModel'
import MaskEditor from './MaskEditor.vue'
import BgRemovalCard from './BgRemovalCard.vue'

const props = defineProps({ doc: { type: Object, required: true }, item: { type: Object, required: true }, track: { type: Object, default: null },
  tRel: { type: Number, default: null }, compact: Boolean })
const emit = defineEmits(['ops', 'seek', 'refresh-media'])
const reg = br.registry()
const all = computed(() => props.item.effects || [])
const list = computed(() => all.value.filter(e => !COLOUR_KINDS.includes(e.kind)))
const full = computed(() => all.value.length >= reg.limits.effects_per_clip)
// Background removal is added by its own card (it needs its server job, which is paid); phones have no masks (plan
// section 6).
const addable = computed(() => Object.keys(reg.effects).filter(k => !COLOUR_KINDS.includes(k) && !br.effectDerive(reg, k) && !(props.compact && k === 'mask')))
const adding = ref(addable.value[0] || '')
const isVideoClip = computed(() => props.track?.kind === 'video' && props.item.type === 'clip')
const canPick = typeof window !== 'undefined' && 'EyeDropper' in window
const indexOf = e => all.value.findIndex(x => x.id === e.id)
const name = e => reg.effects[e.kind]?.label || e.kind

function send(ops, label) { if (ops.length) emit('ops', { ops, label }) }
function add() { send(br.addEffectOps(props.doc, props.item.id, adding.value, { registry: reg }), `${reg.effects[adding.value].label} added`) }
function toggle(e, on) { send(br.setEffectOps(props.doc, props.item.id, e.id, { enabled: on }), `${name(e)} ${on ? 'on' : 'off'}`) }
function remove(e) { send(br.removeEffectOps(props.doc, props.item.id, e.id), `${name(e)} removed`) }
function moveBy(e, by) { send(br.moveEffectOps(props.doc, props.item.id, e.id, indexOf(e) + by), `${name(e)} moved ${by < 0 ? 'earlier' : 'later'}`) }
function param(e, key, v) { send(br.setEffectOps(props.doc, props.item.id, e.id, { params: { [key]: v } }), `${name(e)} changed`) }
async function pickColour(e, key) {
  try { const r = await new window.EyeDropper().open(); param(e, key, String(r.sRGBHex).toUpperCase()) } catch { /* the person closed the picker */ }
}
</script>
<style scoped>
.ef-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}
.ef-item{list-style:none}
.ef-item.is-off{opacity:.7}
.ef-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px}
.ef-moves{display:flex;gap:4px}
.ef-color{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}
</style>
