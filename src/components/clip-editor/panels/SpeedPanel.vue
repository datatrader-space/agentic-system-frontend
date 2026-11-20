<template>
  <!-- The Speed tab (plan E22-E23, contract sections 1 and 5): a constant speed from 0.25x to 4x, or a speed ramp from
       a preset (Montage, Hero, Bullet, Jump cut, Flash in, Flash out) or its own points; keep the pitch of the sound,
       reverse, and freeze the frame under the playhead. The clip's length follows the speed exactly. -->
  <div class="pn" data-test="panel-speed">
    <template v-if="frozen">
      <p class="pn-note" data-test="frozen">This clip is a still of its file at {{ seconds(item.freeze_at_ms) }}.</p>
      <label class="st-field">Still length (seconds)<input class="st-input" type="number" inputmode="decimal" min="0.1" max="600" step="0.1" :value="item.hold_ms / 1000" @change="holdFor($event.target.value)" /></label>
      <p v-if="error" class="pn-error" role="alert">{{ error }}</p>
      <div class="pn-icons"><IconButton :icon="RotateCcw" label="Remove the freeze: play the clip again" data-test="unfreeze" @click="send(unfreezeOps(doc, item), 'Freeze removed')" /></div>
    </template>
    <template v-else>
      <div class="pn-seg" role="group" aria-label="Speed">
        <button type="button" :aria-pressed="!curve ? 'true' : 'false'" data-test="speed-constant" @click="toConstant">Constant</button>
        <button type="button" :aria-pressed="curve ? 'true' : 'false'" data-test="speed-curve" @click="curve || applyPreset(PRESETS[1])">Ramp</button>
      </div>

      <template v-if="!curve">
        <ParamRow :doc="doc" :item="item" path="speed" :spec="SPEED_SPEC" unit="times" :t-rel="tRel" :compact="compact" @ops="$emit('ops', $event)" />
        <div class="pn-seg" role="group" aria-label="Common speeds">
          <button v-for="s in COMMON" :key="s" type="button" :aria-pressed="(item.speed || 1) === s ? 'true' : 'false'" @click="setSpeed(s)">{{ s }}×</button>
        </div>
      </template>

      <template v-else>
        <div class="pn-seg" role="group" aria-label="Ramp presets">
          <button v-for="p in PRESETS" :key="p.id" type="button" :aria-pressed="presetOf === p.id ? 'true' : 'false'" :data-test="`preset-${p.id}`" @click="applyPreset(p)">{{ p.label }}</button>
        </div>
        <svg class="sp-graph" viewBox="0 0 240 96" role="img" :aria-label="graphLabel">
          <line x1="0" :y1="yOf(1)" x2="240" :y2="yOf(1)" class="sp-one" />
          <polyline :points="draft.map(p => `${p.x * 240},${yOf(p.y)}`).join(' ')" class="sp-line" />
          <circle v-for="(p, n) in draft" :key="n" :cx="p.x * 240" :cy="yOf(p.y)" r="5" class="sp-dot" @pointerdown="grab($event, n)" />
        </svg>
        <template v-if="!compact">
          <ol class="pn-list" aria-label="Ramp points">
            <li v-for="(p, n) in draft" :key="n" class="sp-point">
              <label class="st-field"><span>Point {{ n + 1 }} at (%)</span><input class="pn-num" type="number" min="0" max="100" step="1" :value="Math.round(p.x * 100)" :disabled="n === 0 || n === draft.length - 1" @change="editPoint(n, { x: Number($event.target.value) / 100 })" /></label>
              <label class="st-field"><span>Speed (×)</span><input class="pn-num" type="number" :min="L.speed_curve_y[0]" :max="L.speed_curve_y[1]" step="0.1" :value="p.y" @change="editPoint(n, { y: Number($event.target.value) })" /></label>
              <IconButton :icon="Trash2" :label="`Remove point ${n + 1}`" :disabled="n === 0 || n === draft.length - 1 || draft.length <= L.speed_curve_points[0]" @click="removePoint(n)" />
            </li>
          </ol>
          <div class="pn-icons"><IconButton :icon="Plus" label="Add a ramp point" :disabled="draft.length >= L.speed_curve_points[1]" data-test="ramp-add" @click="addPoint" /></div>
        </template>
        <p class="pn-note" data-test="ramp-length">Length on the timeline: {{ seconds(rampLength) }}.</p>
      </template>
      <p v-if="error" class="pn-error" role="alert">{{ error }}</p>

      <label class="pn-check"><input type="checkbox" :checked="item.keep_pitch !== false" data-test="keep-pitch" @change="set({ keep_pitch: $event.target.checked ? undefined : false }, $event.target.checked ? 'Pitch kept' : 'Pitch follows the speed')" /> Keep the pitch of the sound</label>
      <label class="pn-check"><input type="checkbox" :checked="!!item.reverse" data-test="reverse" @change="reverse($event.target.checked)" /> Play backwards</label>
      <p v-if="item.reverse && derive.state.status !== 'idle'" class="pn-note" role="status">{{ reverseNote }}</p>

      <fieldset v-if="isVideo" class="pn-group"><legend>Freeze frame</legend>
        <div class="pn-icons"><IconButton :icon="Snowflake" label="Freeze the frame at the playhead" :disabled="tRel == null" data-test="freeze" @click="send(freezeOps(doc, item, playhead), 'Frame frozen')" /></div>
        <p class="pn-note">The whole clip becomes a still of that frame. Split the clip first to freeze only part of it.</p>
      </fieldset>
    </template>
  </div>
</template>
<script setup>
import { Plus, RotateCcw, Snowflake, Trash2 } from 'lucide-vue-next'
import IconButton from './IconButton.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import * as tl from '../timelineModel'
import * as br from './bridge'
import ParamRow from './ParamRow.vue'
import { SPEED_PRESETS, curveProblem, freezeOps, unfreezeOps } from './panelModel'
import { useDerive } from './useDerive'

const props = defineProps({ doc: { type: Object, required: true }, item: { type: Object, required: true }, track: { type: Object, default: null },
  tRel: { type: Number, default: null }, playhead: { type: Number, default: 0 }, compact: Boolean })
// refresh-media: a helper file of this clip's media is made (the reversed copy): the editor reads the media view again
// so the monitor plays it (its reversed_url).
const emit = defineEmits(['ops', 'refresh-media'])
const L = br.editorLimits(br.registry()), PRESETS = SPEED_PRESETS
const SPEED_SPEC = { min: L.speed[0], max: L.speed[1], default: 1, step: 0.05, label: 'Speed', animatable: false }
const COMMON = [0.25, 0.5, 1, 1.5, 2, 4]
const error = ref('')
const derive = useDerive()
const curve = computed(() => props.item.speed_curve || null)
const frozen = computed(() => props.item.freeze_at_ms != null)
const isVideo = computed(() => props.track?.kind === 'video' && props.item.source_out_ms != null)
const draft = ref([])
watch(curve, c => { draft.value = c ? c.map(p => ({ ...p })) : [] }, { immediate: true })
const presetOf = computed(() => PRESETS.find(p => JSON.stringify(p.points) === JSON.stringify(curve.value))?.id || '')
const sourceMs = computed(() => (props.item.source_out_ms ?? 0) - (props.item.source_in_ms ?? 0))
const rampLength = computed(() => br.snap(br.curveLength(draft.value, sourceMs.value), props.doc.rate))
const graphLabel = computed(() => `Speed ramp: ${draft.value.map(p => `${p.y}× at ${Math.round(p.x * 100)}%`).join(', ')}`)
watch(() => derive.state.status, s => { if (s === 'ready' && props.item.media) emit('refresh-media', props.item.media) })
const reverseNote = computed(() => ({ working: 'Preparing the reversed copy of this file…', ready: 'The reversed copy is ready.', failed: derive.state.error, estimate: '' })[derive.state.status] || '')
const seconds = ms => tl.timecode(ms, props.doc.rate)
// The graph's speed scale is logarithmic: 0.1x at the bottom, 10x at the top, 1x in the middle.
const yOf = v => 48 - Math.log10(Math.min(Math.max(v, 0.1), 10)) * 44

function send(ops, label) { error.value = ''; if (ops.length) emit('ops', { ops, label }) }
function set(changes, label) { send(tl.setOps(props.doc, props.item.id, changes), label) }
function setSpeed(s) { set({ speed: s, speed_curve: undefined }, `Speed ${s}×`) }
function toConstant() { if (curve.value) set({ speed_curve: undefined, speed: 1 }, 'Constant speed') }
function setCurve(points, label) {
  const why = curveProblem(points)
  if (why) { error.value = why; draft.value = (curve.value || []).map(p => ({ ...p })); return }
  set({ speed_curve: points, speed: undefined }, label)
}
function applyPreset(p) { setCurve(p.points.map(q => ({ ...q })), `Speed ramp: ${p.label}`) }
function editPoint(n, change) {
  const next = draft.value.map(p => ({ ...p }))
  Object.assign(next[n], change)
  setCurve(next, 'Speed ramp changed')
}
function removePoint(n) { setCurve(draft.value.filter((_, i) => i !== n), 'Ramp point removed') }
function addPoint() {
  // A new point in the middle of the widest gap, at the speed the curve has there.
  let at = 1
  for (let i = 1; i < draft.value.length; i++) if (draft.value[i].x - draft.value[i - 1].x > draft.value[at].x - draft.value[at - 1].x) at = i
  const a = draft.value[at - 1], b = draft.value[at]
  const next = draft.value.map(p => ({ ...p }))
  next.splice(at, 0, { x: Math.round((a.x + b.x) / 2 * 100) / 100, y: Math.round((a.y + b.y) / 2 * 100) / 100 })
  setCurve(next, 'Ramp point added')
}
function holdFor(raw) {
  const v = Math.round(Number(raw) * 1000)
  if (!Number.isFinite(v) || v < 100) { error.value = 'Type a length of at least 0.1 seconds.'; return }
  set({ hold_ms: br.snap(v, props.doc.rate) }, 'Still length changed')
}
function reverse(on) {
  set({ reverse: on || undefined }, on ? 'Plays backwards' : 'Plays forwards')
  if (on && props.item.media) derive.start(props.item.media, 'reverse', {})
}

// Dragging a point on the graph (pointer only; the typed points above do the same without a drag).
let dragging = null
function grab(e, n) {
  if (props.compact) return
  dragging = { n, box: e.currentTarget.ownerSVGElement.getBoundingClientRect() }
  window.addEventListener('pointermove', drag); window.addEventListener('pointerup', drop, { once: true })
}
function drag(e) {
  if (!dragging) return
  const { n, box } = dragging, next = draft.value.map(p => ({ ...p }))
  const y = 10 ** ((48 - (e.clientY - box.top) / box.height * 96) / 44)
  next[n].y = Math.round(Math.min(Math.max(y, L.speed_curve_y[0]), L.speed_curve_y[1]) * 100) / 100
  if (n > 0 && n < next.length - 1) {
    const x = (e.clientX - box.left) / box.width
    next[n].x = Math.round(Math.min(Math.max(x, next[n - 1].x + 0.01), next[n + 1].x - 0.01) * 100) / 100
  }
  draft.value = next
}
function drop() { window.removeEventListener('pointermove', drag); if (dragging) { dragging = null; setCurve(draft.value, 'Speed ramp changed') } }
onBeforeUnmount(() => window.removeEventListener('pointermove', drag))
</script>
<style scoped>
.sp-graph{width:100%;height:96px;border:1px solid var(--vm-line-2);border-radius:6px;background:var(--vm-bg);touch-action:none}
.sp-one{stroke:var(--vm-line);stroke-dasharray:3 3}
.sp-line{fill:none;stroke:var(--vm-primary);stroke-width:2}
.sp-dot{fill:var(--vm-amber);stroke:var(--vm-bg);stroke-width:2;cursor:grab}
.sp-point{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:6px;align-items:end;font-size:12px;color:var(--vm-ink-soft)}
</style>
