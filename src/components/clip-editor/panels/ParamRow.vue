<template>
  <!-- One number from the registry (contract section 3): a slider and a typed value, both kept inside the registry's
       range, and the keyframe diamond when the value can be animated. One change is one edit (undoable, saved). -->
  <div class="pn-row" :data-test="`param-${path}`">
    <span :id="labelId">{{ label }}</span>
    <input type="range" :min="min * scale" :max="max * scale" :step="step * scale" :value="shown" :aria-labelledby="labelId"
           :aria-valuetext="valueText" :disabled="locked" @change="commit(Number($event.target.value) / scale)" />
    <input class="pn-num" type="number" inputmode="decimal" :min="min * scale" :max="max * scale" :step="step * scale" :value="shownRounded"
           :aria-label="`${label}${unit ? ` (${unit})` : ''}`" :disabled="locked" @change="typed($event.target.value)" />
    <KeyframeControls v-if="animatable" :keys="keys" :t-rel="tRel" :label="label" :easings="easings" :compact="compact"
                      @toggle="toggle" @seek="t => $emit('seek', item.start_ms + t)" @ease="ease" />
    <span v-else aria-hidden="true" />
    <p v-if="error" class="pn-error" role="alert" style="grid-column:1/-1">{{ error }}</p>
  </div>
</template>
<script setup>
import { computed, ref, useId } from 'vue'
import KeyframeControls from './KeyframeControls.vue'
import * as br from './bridge'
import { clamp, currentValue, keyAt, keyframeCount, keyOps, valueOps } from './panelModel'

const props = defineProps({
  doc: { type: Object, required: true }, item: { type: Object, required: true }, path: { type: String, required: true },
  spec: { type: Object, required: true },            // a registry param: {min, max, default, step, animatable, label}
  tRel: { type: Number, default: null },              // the playhead inside the item (frame grid), or null
  label: { type: String, default: '' }, scale: { type: Number, default: 1 }, unit: { type: String, default: '' },
  compact: Boolean, locked: Boolean,
  check: { type: Function, default: null },           // (value) => '' or the reason the value is refused
})
const emit = defineEmits(['ops', 'seek'])
const labelId = `pn-${useId()}`
const error = ref('')
const label = computed(() => props.label || props.spec.label)
const min = computed(() => props.spec.min), max = computed(() => props.spec.max), step = computed(() => props.spec.step || 0.01)
const animatable = computed(() => props.spec.animatable !== false)
const easings = computed(() => br.registry().easings)
const keys = computed(() => props.item.keyframes?.[props.path] || [])
const value = computed(() => currentValue(props.item, props.path, props.tRel, props.spec.default))
const shown = computed(() => value.value * props.scale)
const decimals = computed(() => Math.max(0, -Math.floor(Math.log10(step.value * props.scale) + 1e-9)))
const shownRounded = computed(() => Number(shown.value.toFixed(decimals.value)))
const valueText = computed(() => `${shownRounded.value}${props.unit ? ` ${props.unit}` : ''}${keys.value.length ? ', animated' : ''}`)

function send(ops, text) { if (ops.length) emit('ops', { ops, label: text }) }
function commit(v) {
  error.value = ''
  v = clamp(v, min.value, max.value)
  if (keys.value.length && props.tRel == null) { error.value = 'This value is animated: move the playhead inside the clip to change it.'; return }
  const why = props.check?.(v)
  if (why) { error.value = why; return }
  send(valueOps(props.doc, props.item, props.path, v, props.tRel), `${label.value} changed`)
}
function typed(raw) {
  const v = Number(String(raw).replace(',', '.'))
  if (raw === '' || !Number.isFinite(v)) { error.value = `Type a number from ${min.value * props.scale} to ${max.value * props.scale}.`; return }
  commit(v / props.scale)
}
function toggle() {
  error.value = ''
  if (props.tRel == null) return
  if (keyAt(props.item, props.path, props.tRel)) { send(br.removeKeyframeOps(props.doc, props.item.id, props.path, props.tRel), `Keyframe of ${label.value} removed`); return }
  const most = br.registry().limits.keyframes_per_clip
  if (keyframeCount(props.item) >= most) { error.value = `A clip holds at most ${most} keyframes.`; return }
  send(keyOps(props.doc, props.item, props.path, props.tRel, value.value, 'linear'), `Keyframe of ${label.value} added`)
}
function ease({ ease: e, bez }) {
  const k = keyAt(props.item, props.path, props.tRel)
  if (k) send(keyOps(props.doc, props.item, props.path, props.tRel, k.v, e === 'bezier' ? { ease: 'bezier', bez } : e), `Easing of ${label.value} changed`)
}
</script>
