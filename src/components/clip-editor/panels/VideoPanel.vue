<template>
  <!-- The Video tab (plan B11-B13, contract sections 1 and 4): position, size up to 4x, rotation, flip, opacity, fit,
       crop and blend mode, each number with its keyframe diamond; and the canvas: shape, frame rate, background
       (a colour, a blur of the clip, or a picture). The safe-area guides are the monitor's own menu. -->
  <div class="pn" data-test="panel-video">
    <template v-if="item">
      <fieldset class="pn-group"><legend>Position and size</legend>
        <ParamRow v-for="r in TRANSFORM_ROWS" :key="r.path" v-bind="rowProps(r)" @ops="$emit('ops', $event)" @seek="$emit('seek', $event)" />
        <div class="pn-icons" role="group" aria-label="Flip and reset">
          <IconButton :icon="FlipHorizontal2" label="Flip across" :pressed="!!tf.flip_x" data-test="flip-x" @click="flip('flip_x')" />
          <IconButton :icon="FlipVertical2" label="Flip up and down" :pressed="!!tf.flip_y" data-test="flip-y" @click="flip('flip_y')" />
          <IconButton :icon="Maximize" label="Full frame: reset position, size and rotation" data-test="full-frame" @click="reset" />
        </div>
      </fieldset>
      <label class="st-field">Fit<select class="st-input" :value="item.fit || 'contain'" @change="set({ fit: $event.target.value }, 'Fit changed')"><option value="contain">Whole picture (padded)</option><option value="cover">Fill the box (cropped)</option></select></label>
      <label v-if="isPicture" class="pn-check"><input type="checkbox" :checked="!!item.zoom" @change="set({ zoom: $event.target.checked || undefined }, 'Slow zoom changed')" /> Slow zoom</label>
      <fieldset class="pn-group"><legend>Crop</legend>
        <ParamRow v-for="r in CROP_ROWS" :key="r.path" v-bind="rowProps(r)" :check="cropCheck(r.path)" @ops="$emit('ops', $event)" @seek="$emit('seek', $event)" />
        <div v-if="item.crop || hasCropKeys" class="pn-icons"><IconButton :icon="RotateCcw" label="Remove the crop" data-test="crop-remove" @click="removeCrop" /></div>
      </fieldset>
      <label class="st-field">Blend with the tracks below
        <select class="st-input" :value="item.blend || 'normal'" data-test="blend" @change="set({ blend: $event.target.value === 'normal' ? undefined : $event.target.value }, 'Blend mode changed')">
          <option v-for="m in registry.blend_modes" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>
      </label>
      <p v-if="lowestTrack && (item.blend || 'normal') !== 'normal'" class="pn-note">A blend mode mixes this clip with the tracks under it; on the lowest video track it mixes with the background.</p>
    </template>

    <fieldset class="pn-group" data-test="canvas"><legend>Canvas</legend>
      <label class="st-field">Shape<select class="st-input" :value="doc.canvas.aspect" @change="canvas({ aspect: $event.target.value }, 'Shape changed')"><option v-for="a in tl.ASPECTS" :key="a" :value="a">{{ a }}</option></select></label>
      <label class="st-field">Frame rate<select class="st-input" :value="doc.rate" @change="$emit('ops', { ops: [{ op: 'set', path: ['rate'], value: Number($event.target.value) }], label: 'Frame rate changed' })"><option v-for="r in L.rates" :key="r" :value="r">{{ r }} frames a second</option></select></label>
      <div class="pn-seg" role="group" aria-label="Background">
        <button v-for="k in BG_KINDS" :key="k.id" type="button" :aria-pressed="bg.kind === k.id ? 'true' : 'false'" :data-test="`bg-${k.id}`" @click="setBgKind(k.id)">{{ k.label }}</button>
      </div>
      <label v-if="bg.kind === 'color'" class="st-field">Background colour<input class="pn-color" type="color" :value="bg.color" @change="setBg({ kind: 'color', color: $event.target.value.toUpperCase() })" /></label>
      <label v-else-if="bg.kind === 'blur'" class="st-field">Blur strength
        <select class="st-input" :value="bg.strength" @change="setBg({ kind: 'blur', strength: Number($event.target.value) })"><option v-for="s in [1, 2, 3, 4]" :key="s" :value="s">{{ s }}</option></select>
      </label>
      <label v-else class="st-field">Background picture
        <select class="st-input" :value="bg.media || ''" @change="$event.target.value && setBg({ kind: 'image', media: $event.target.value })">
          <option value="">Choose a picture</option>
          <option v-for="p in pictures" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <p v-if="bg.kind === 'image' && !pictures.length" class="pn-note">Upload or bring a picture into this project's files to use it as the background.</p>
    </fieldset>
  </div>
</template>
<script setup>
import { FlipHorizontal2, FlipVertical2, Maximize, RotateCcw } from 'lucide-vue-next'
import IconButton from './IconButton.vue'
import { computed, ref, watch } from 'vue'
import * as tl from '../timelineModel'
import * as br from './bridge'
import ParamRow from './ParamRow.vue'
import { DEFAULT_TRANSFORM, staticValue } from './panelModel'

const props = defineProps({ doc: { type: Object, required: true }, item: { type: Object, default: null }, track: { type: Object, default: null },
  tRel: { type: Number, default: null }, media: { type: Object, default: () => ({}) }, compact: Boolean })
const emit = defineEmits(['ops', 'seek'])
const registry = br.registry()
const L = br.editorLimits(registry)
const n = (min, max, def, step, label) => ({ min, max, default: def, step, label, animatable: true })
const TRANSFORM_ROWS = [
  { path: 'transform.x', spec: n(0, 1, 0.5, 0.01, 'Across'), scale: 100, unit: '%' },
  { path: 'transform.y', spec: n(0, 1, 0.5, 0.01, 'Down'), scale: 100, unit: '%' },
  { path: 'transform.scale', spec: n(L.scale[0], L.scale[1], 1, 0.01, 'Size'), scale: 100, unit: '%' },
  { path: 'transform.rotation', spec: n(L.rotation[0], L.rotation[1], 0, 1, 'Rotation'), scale: 1, unit: 'degrees' },
  { path: 'transform.opacity', spec: n(0, 1, 1, 0.01, 'Opacity'), scale: 100, unit: '%' },
]
const CROP_ROWS = [
  { path: 'crop.x', spec: n(0, 0.95, 0, 0.01, 'Left'), scale: 100, unit: '%' }, { path: 'crop.y', spec: n(0, 0.95, 0, 0.01, 'Top'), scale: 100, unit: '%' },
  { path: 'crop.w', spec: n(0.05, 1, 1, 0.01, 'Width'), scale: 100, unit: '%' }, { path: 'crop.h', spec: n(0.05, 1, 1, 0.01, 'Height'), scale: 100, unit: '%' },
]
const BG_KINDS = [{ id: 'color', label: 'Colour' }, { id: 'blur', label: 'Blur of the clip' }, { id: 'image', label: 'Picture' }]

const tf = computed(() => ({ ...DEFAULT_TRANSFORM, ...(props.item?.transform || {}) }))
const isPicture = computed(() => props.item?.hold_ms != null && props.item?.freeze_at_ms == null)
const hasCropKeys = computed(() => Object.keys(props.item?.keyframes || {}).some(p => p.startsWith('crop.')))
const lowestTrack = computed(() => props.track && props.doc.tracks.find(t => t.kind === 'video') === props.track)
// A version 2 background is a colour string; version 3 is {kind, ...} (contract section 1).
const stored = computed(() => { const b = props.doc.canvas.background; return typeof b === 'string' || !b ? { kind: 'color', color: b || '#000000' } : b })
// Choosing "Picture" with no picture yet changes nothing until one is chosen (a background needs its file).
const pendingImage = ref(false)
const bg = computed(() => pendingImage.value && stored.value.kind !== 'image' ? { kind: 'image', media: '' } : stored.value)
const pictures = computed(() => Object.values(props.media).filter(m => m.media_type === 'image' && m.state !== 'failed').map(m => ({ id: m.attachment_id, name: m.name || 'Picture' })))

const rowProps = r => ({ doc: props.doc, item: props.item, path: r.path, spec: r.spec, scale: r.scale, unit: r.unit, tRel: props.tRel, compact: props.compact })
function set(changes, label) { const ops = tl.setOps(props.doc, props.item.id, changes); if (ops.length) emit('ops', { ops, label }) }
function canvas(changes, label) { emit('ops', { ops: tl.setCanvasOps(props.doc, changes), label }) }
function flip(k) { set({ transform: { ...tf.value, [k]: !tf.value[k] } }, k === 'flip_x' ? 'Flipped across' : 'Flipped up and down') }
function reset() {
  const keyframes = Object.fromEntries(Object.entries(props.item.keyframes || {}).filter(([p]) => !p.startsWith('transform.')))
  set({ transform: { ...DEFAULT_TRANSFORM }, keyframes: Object.keys(keyframes).length ? keyframes : undefined }, 'Position reset')
}
function removeCrop() {
  const keyframes = Object.fromEntries(Object.entries(props.item.keyframes || {}).filter(([p]) => !p.startsWith('crop.')))
  set({ crop: undefined, keyframes: Object.keys(keyframes).length ? keyframes : undefined }, 'Crop removed')
}
// The crop stays inside the picture: left + width and top + height at most 100%.
function cropCheck(path) {
  const k = path.split('.')[1], other = { x: 'w', w: 'x', y: 'h', h: 'y' }[k]
  return v => v + staticValue(props.item, `crop.${other}`, other === 'w' || other === 'h' ? 1 : 0) > 1.0001 ? 'The crop must stay inside the picture and keep at least 5% of it.' : ''
}
watch(stored, () => { pendingImage.value = false })
function setBg(value) { pendingImage.value = false; canvas({ background: value }, 'Background changed') }
function setBgKind(kind) {
  if (kind === bg.value.kind) return
  if (kind === 'color') setBg({ kind: 'color', color: '#000000' })
  else if (kind === 'blur') setBg({ kind: 'blur', strength: 2 })
  else if (pictures.value.length) setBg({ kind: 'image', media: pictures.value[0].id })
  else pendingImage.value = true
}
</script>
