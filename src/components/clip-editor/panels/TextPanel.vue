<template>
  <!-- The Text tab (plan F24-F28, contract section 1 "Text item"): the words, 16 fonts, style (stroke, shadow, box
       with rounding, spacing, alignment, bold, italic), place and opacity with keyframes, animations in, out and
       looping, and templates: platform-made ones and the person's own, saved on their account. -->
  <div class="pn" data-test="panel-text">
    <label class="st-field">Text<textarea class="st-input" rows="3" maxlength="500" :value="item.text" data-test="text-body" @change="setText($event.target.value)" /></label>
    <p v-if="error" class="pn-error" role="alert">{{ error }}</p>

    <fieldset class="pn-group" data-test="templates"><legend>Templates</legend>
      <div class="tx-line">
        <label class="st-field">Template
          <select v-model="chosen" class="st-input" data-test="template-pick">
            <optgroup label="Made by the Studio"><option v-for="t in BUILT_IN_TEMPLATES" :key="t.id" :value="t.id">{{ t.name }}</option></optgroup>
            <optgroup v-if="tpl.state.saved.length" label="Yours"><option v-for="t in tpl.state.saved" :key="t.id" :value="t.id">{{ t.name }}</option></optgroup>
          </select>
        </label>
        <span class="pn-icons">
          <IconButton :icon="Check" label="Use this template" :disabled="!chosen" data-test="template-apply" @click="applyChosen" />
          <IconButton v-if="chosenIsMine" :icon="Trash2" label="Remove this template" :disabled="tpl.state.busy" data-test="template-remove" @click="removeChosen" />
        </span>
      </div>
      <div class="tx-line">
        <label class="st-field">Save this text's look as<input v-model="saveName" class="st-input" maxlength="60" placeholder="Template name" data-test="template-name" /></label>
        <IconButton :icon="Save" label="Save as a template" :disabled="!saveName.trim() || tpl.state.busy" data-test="template-save" @click="saveMine" />
      </div>
      <p v-if="tpl.state.error" class="pn-error" role="alert">{{ tpl.state.error }}</p>
      <p v-else-if="tplNote" class="pn-note" role="status">{{ tplNote }}</p>
    </fieldset>

    <fieldset class="pn-group"><legend>Font</legend>
      <label class="st-field">Font
        <select class="st-input" :value="style.font || 'inter'" data-test="text-font" @change="setStyle({ font: $event.target.value }, 'Font changed')">
          <option v-for="f in modernFonts" :key="f.id" :value="f.id">{{ f.label }}</option>
          <optgroup v-if="legacyFonts.length" label="Earlier fonts"><option v-for="f in legacyFonts" :key="f.id" :value="f.id">{{ f.label }}</option></optgroup>
        </select>
      </label>
      <ParamRow :doc="doc" :item="item" path="style.size" :spec="SIZE" :scale="100" unit="% of the height" @ops="$emit('ops', $event)" />
      <div class="pn-icons" role="group" aria-label="Weight, slant and alignment">
        <IconButton :icon="Bold" label="Bold" :pressed="!!style.bold" data-test="text-bold" @click="setStyle({ bold: !style.bold || undefined }, style.bold ? 'Bold off' : 'Bold')" />
        <IconButton :icon="Italic" label="Italic" :pressed="!!style.italic" data-test="text-italic" @click="setStyle({ italic: !style.italic || undefined }, style.italic ? 'Italic off' : 'Italic')" />
        <IconButton v-for="a in ALIGN" :key="a.id" :icon="a.icon" :label="`Align ${a.label.toLowerCase()}`" :pressed="(style.align || 'center') === a.id" :data-test="`align-${a.id}`" @click="setStyle({ align: a.id }, `Aligned ${a.label.toLowerCase()}`)" />
      </div>
      <ParamRow :doc="doc" :item="item" path="style.letter_spacing" :spec="LETTER" unit="em" @ops="$emit('ops', $event)" />
      <ParamRow :doc="doc" :item="item" path="style.line_spacing" :spec="LINE" unit="lines" @ops="$emit('ops', $event)" />
    </fieldset>

    <fieldset class="pn-group"><legend>Colour, outline and shadow</legend>
      <div class="pn-pair">
        <label class="st-field">Colour<input class="pn-color" type="color" :value="hex(style.color, '#FFFFFF')" @change="setStyle({ color: $event.target.value.toUpperCase() }, 'Text colour changed')" /></label>
        <label class="st-field">Outline colour<input class="pn-color" type="color" :value="hex(style.stroke_color, '#000000')" @change="setStyle({ stroke_color: $event.target.value.toUpperCase(), stroke_width: style.stroke_width || 0.004 }, 'Outline changed')" /></label>
      </div>
      <ParamRow :doc="doc" :item="item" path="style.stroke_width" :spec="STROKE" :scale="1000" unit="thousandths of the height" label="Outline" @ops="$emit('ops', $event)" />
      <label class="st-field">Shadow colour<input class="pn-color" type="color" :value="hex(style.shadow_color, '#000000')" @change="setStyle({ shadow_color: $event.target.value.toUpperCase(), shadow_y: style.shadow_y ?? 0.004 }, 'Shadow changed')" /></label>
      <ParamRow :doc="doc" :item="item" path="style.shadow_x" :spec="SHADOW('Shadow across')" :scale="1000" unit="thousandths" @ops="$emit('ops', $event)" />
      <ParamRow :doc="doc" :item="item" path="style.shadow_y" :spec="SHADOW('Shadow down')" :scale="1000" unit="thousandths" @ops="$emit('ops', $event)" />
      <label class="pn-check"><input type="checkbox" :checked="!!style.box" data-test="text-box" @change="setStyle({ box: $event.target.checked ? '#0000008C' : null }, 'Box changed')" /> Box behind the text</label>
      <template v-if="style.box">
        <label class="st-field">Box colour<input class="pn-color" type="color" :value="style.box.slice(0, 7)" @change="setStyle({ box: $event.target.value.toUpperCase() + (style.box.slice(7) || '') }, 'Box colour changed')" /></label>
        <ParamRow :doc="doc" :item="item" path="style.box_radius" :spec="RADIUS" :scale="100" unit="%" @ops="$emit('ops', $event)" />
      </template>
    </fieldset>

    <fieldset class="pn-group"><legend>Place</legend>
      <ParamRow v-for="r in PLACE" :key="r.path" :doc="doc" :item="item" :path="r.path" :spec="r.spec" :scale="100" unit="%" :t-rel="tRel" :compact="compact"
                @ops="$emit('ops', $event)" @seek="$emit('seek', $event)" />
    </fieldset>

    <fieldset class="pn-group" data-test="text-anim"><legend>Animation</legend>
      <div v-for="phase in ['in', 'out']" :key="phase" class="tx-anim">
        <label class="st-field">{{ phase === 'in' ? 'Coming in' : 'Going out' }}
          <select class="st-input" :value="anim[phase]?.kind || ''" :data-test="`anim-${phase}`" @change="setAnim(phase, $event.target.value)">
            <option value="">None</option>
            <option v-for="k in reg.text_anims[phase]" :key="k" :value="k">{{ ANIM_LABEL[k] || k }}</option>
          </select>
        </label>
        <label v-if="anim[phase]" class="st-field">Seconds<input class="st-input" type="number" inputmode="decimal" :min="L.text_anim_ms[0] / 1000" :max="L.text_anim_ms[1] / 1000" step="0.1" :value="anim[phase].ms / 1000" :data-test="`anim-${phase}-ms`" @change="setAnimMs(phase, $event.target.value)" /></label>
      </div>
      <label class="st-field">While on screen
        <select class="st-input" :value="anim.loop?.kind || 'none'" data-test="anim-loop" @change="setLoop($event.target.value)">
          <option v-for="k in reg.text_anims.loop" :key="k" :value="k">{{ ANIM_LABEL[k] || k }}</option>
        </select>
      </label>
    </fieldset>
    <p v-if="isCaption" class="pn-note">Word highlighting and the style of every caption are set under Captions.</p>
  </div>
</template>
<script setup>
import { AlignCenter, AlignLeft, AlignRight, Bold, Check, Italic, Save, Trash2 } from 'lucide-vue-next'
import IconButton from './IconButton.vue'
import { computed, onMounted, ref } from 'vue'
import * as tl from '../timelineModel'
import * as br from './bridge'
import ParamRow from './ParamRow.vue'
import { BUILT_IN_TEMPLATES, applyTemplateChanges, templateOf, useTextTemplates } from './textTemplates'

const props = defineProps({ doc: { type: Object, required: true }, item: { type: Object, required: true }, track: { type: Object, default: null },
  tRel: { type: Number, default: null }, compact: Boolean })
const emit = defineEmits(['ops', 'seek'])
const reg = br.registry(), L = br.editorLimits(reg)
const stat = (min, max, def, step, label) => ({ min, max, default: def, step, label, animatable: false })
const anim1 = (min, max, def, label) => ({ min, max, default: def, step: 0.01, label, animatable: true })
const SIZE = stat(L.text_size[0], L.text_size[1], 0.07, 0.005, 'Size')
const LETTER = stat(-0.1, 0.5, 0, 0.01, 'Letter spacing'), LINE = stat(0.8, 2, 1.2, 0.05, 'Line spacing')
const STROKE = stat(0, 0.02, 0, 0.001, 'Outline'), RADIUS = stat(0, 1, 0, 0.01, 'Box rounding')
const SHADOW = label => stat(-0.02, 0.02, 0, 0.001, label)
const PLACE = [{ path: 'x', spec: anim1(0, 1, 0.5, 'Across') }, { path: 'y', spec: anim1(0, 1, 0.5, 'Down') }, { path: 'opacity', spec: anim1(0, 1, 1, 'Opacity') }]
const ALIGN = [{ id: 'left', label: 'Left', icon: AlignLeft }, { id: 'center', label: 'Centre', icon: AlignCenter }, { id: 'right', label: 'Right', icon: AlignRight }]
const ANIM_LABEL = { fade: 'Fade', slide_up: 'Slide up', slide_down: 'Slide down', slide_left: 'Slide left', slide_right: 'Slide right', pop: 'Pop', zoom: 'Zoom', rise: 'Rise', typewriter: 'Typewriter', none: 'Still', pulse: 'Pulse', float: 'Float' }
const error = ref(''), chosen = ref(BUILT_IN_TEMPLATES[0].id), saveName = ref(''), tplNote = ref('')
const tpl = useTextTemplates()
onMounted(() => tpl.load())
const style = computed(() => props.item.style || {})
const anim = computed(() => props.item.anim || {})
const isCaption = computed(() => !!props.track?.captions)
const modernFonts = computed(() => reg.fonts.filter(f => !f.legacy))
// The four earlier fonts stay valid (contract section 1); they are offered only to a text that already uses one.
const legacyFonts = computed(() => reg.fonts.filter(f => f.legacy && f.id === style.value.font))
const allTemplates = computed(() => [...BUILT_IN_TEMPLATES, ...tpl.state.saved])
const chosenIsMine = computed(() => tpl.state.saved.some(t => t.id === chosen.value))
const hex = (c, d) => (typeof c === 'string' && /^#[0-9A-Fa-f]{6}/.test(c) ? c.slice(0, 7) : d)

function send(ops, label) { error.value = ''; if (ops.length) emit('ops', { ops, label }) }
function set(changes, label) { send(tl.setOps(props.doc, props.item.id, changes), label) }
function setStyle(changes, label) {
  const next = { ...style.value, ...changes }
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k]
  set({ style: next }, label)
}
function setText(text) { if (!text.trim()) { error.value = 'Text cannot be empty. Delete the item to remove it.'; return } set({ text: text.trim() }, 'Text changed') }
function writeAnim(next, label) {
  for (const k of Object.keys(next)) if (!next[k] || (k === 'loop' && next[k].kind === 'none')) delete next[k]
  set({ anim: Object.keys(next).length ? next : undefined }, label)
}
function setAnim(phase, kind) { writeAnim({ ...anim.value, [phase]: kind ? { kind, ms: anim.value[phase]?.ms || 400 } : undefined }, kind ? `Animation ${ANIM_LABEL[kind] || kind}` : 'Animation removed') }
function setAnimMs(phase, raw) {
  const ms = Math.round(Number(raw) * 1000)
  if (!Number.isFinite(ms) || ms < L.text_anim_ms[0] || ms > L.text_anim_ms[1]) { error.value = `An animation lasts ${L.text_anim_ms[0] / 1000} to ${L.text_anim_ms[1] / 1000} seconds.`; return }
  writeAnim({ ...anim.value, [phase]: { ...anim.value[phase], ms } }, 'Animation length changed')
}
function setLoop(kind) { writeAnim({ ...anim.value, loop: { kind } }, kind === 'none' ? 'Loop removed' : `Loop ${ANIM_LABEL[kind]}`) }
function applyChosen() {
  const t = allTemplates.value.find(x => x.id === chosen.value)
  if (t) set(applyTemplateChanges(t), `Template ${t.name} used`)
}
async function saveMine() {
  tplNote.value = await tpl.save(templateOf(props.item, saveName.value))
  if (tplNote.value) saveName.value = ''
}
async function removeChosen() { tplNote.value = await tpl.remove(chosen.value); chosen.value = BUILT_IN_TEMPLATES[0].id }
</script>
<style scoped>
.tx-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:end}
.tx-anim{display:grid;grid-template-columns:minmax(0,1fr) 96px;gap:6px;align-items:end}
</style>
