<template>
  <!-- A mask (plan D18, contract section 3): its shape, and handles on a small picture of the frame. Drag the shape to
       move it, the corner to size it, the round handle to turn it; every handle also has its typed value with a
       keyframe diamond below (no drag needed, WCAG 2.5.7). -->
  <div class="mk" data-test="mask-editor">
    <div class="pn-pair">
      <label class="st-field">Shape
        <select class="st-input" :value="p.shape" data-test="mask-shape" @change="set('shape', $event.target.value, 'Mask shape changed')">
          <option v-for="s in spec.shape.choices" :key="s" :value="s">{{ SHAPE[s] || s }}</option>
        </select>
      </label>
      <label class="pn-check"><input type="checkbox" :checked="!!p.invert" @change="set('invert', $event.target.checked, 'Mask inverted')" /> Invert</label>
    </div>
    <svg ref="svgEl" class="mk-frame" :viewBox="`0 0 ${W} ${H}`" aria-hidden="true">
      <g :transform="`rotate(${cur.rotation} ${cur.x * W} ${cur.y * H})`">
        <rect v-if="p.shape === 'rect'" :x="(cur.x - cur.w / 2) * W" :y="(cur.y - cur.h / 2) * H" :width="cur.w * W" :height="cur.h * H" class="mk-shape" @pointerdown="grab($event, 'move')" />
        <ellipse v-else-if="p.shape === 'ellipse'" :cx="cur.x * W" :cy="cur.y * H" :rx="cur.w * W / 2" :ry="cur.h * H / 2" class="mk-shape" @pointerdown="grab($event, 'move')" />
        <template v-else>
          <rect :x="-W" :y="p.shape === 'mirror' ? (cur.y - cur.h / 2) * H : cur.y * H" :width="3 * W" :height="p.shape === 'mirror' ? cur.h * H : 2 * H" class="mk-shape" @pointerdown="grab($event, 'move')" />
        </template>
        <rect :x="(cur.x + cur.w / 2) * W - 5" :y="(cur.y + cur.h / 2) * H - 5" width="10" height="10" class="mk-handle" @pointerdown="grab($event, 'size')" />
        <circle :cx="cur.x * W" :cy="(cur.y - cur.h / 2) * H - 12" r="5" class="mk-handle" @pointerdown="grab($event, 'turn')" />
      </g>
    </svg>
    <ParamRow v-for="k in ['x', 'y', 'w', 'h', 'rotation', 'feather']" :key="k" :doc="doc" :item="item" :path="`fx.${fx.id}.${k}`" :spec="spec[k]"
              :scale="k === 'rotation' ? 1 : 100" :unit="k === 'rotation' ? 'degrees' : '%'" :t-rel="tRel" :compact="compact"
              @ops="$emit('ops', $event)" @seek="$emit('seek', $event)" />
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import * as tl from '../timelineModel'
import * as br from './bridge'
import ParamRow from './ParamRow.vue'
import { clamp, currentValue, valueOps } from './panelModel'

const props = defineProps({ doc: { type: Object, required: true }, item: { type: Object, required: true }, fx: { type: Object, required: true },
  tRel: { type: Number, default: null }, aspect: { type: String, default: '16:9' }, compact: Boolean })
const emit = defineEmits(['ops', 'seek'])
const spec = br.registry().effects.mask.params
const SHAPE = { rect: 'Rectangle', ellipse: 'Ellipse', linear: 'Linear', mirror: 'Mirror' }
const W = 160
const H = computed(() => { const [a, b] = props.aspect.split(':').map(Number); return Math.round(W * b / a) })
const p = computed(() => props.fx.params)
const live = ref(null)
const valueOf = k => currentValue(props.item, `fx.${props.fx.id}.${k}`, props.tRel, spec[k].default)
const cur = computed(() => live.value || Object.fromEntries(['x', 'y', 'w', 'h', 'rotation'].map(k => [k, valueOf(k)])))
function set(k, v, label) { const ops = br.setEffectOps(props.doc, props.item.id, props.fx.id, { params: { [k]: v } }); if (ops.length) emit('ops', { ops, label }) }

const svgEl = ref(null)
let drag = null
function grab(e, mode) {
  if (props.compact) return
  e.preventDefault()
  drag = { mode, box: svgEl.value.getBoundingClientRect(), start: { ...cur.value } }
  live.value = { ...cur.value }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', drop, { once: true })
}
function move(e) {
  if (!drag) return
  const { box, start, mode } = drag, x = (e.clientX - box.left) / box.width, y = (e.clientY - box.top) / box.height
  if (mode === 'move') live.value = { ...live.value, x: clamp(x, 0, 1), y: clamp(y, 0, 1) }
  else if (mode === 'size') live.value = { ...live.value, w: clamp(Math.abs(x - start.x) * 2, 0.02, 1), h: clamp(Math.abs(y - start.y) * 2, 0.02, 1) }
  else live.value = { ...live.value, rotation: clamp(Math.round(Math.atan2(y - start.y, x - start.x) * 180 / Math.PI + 90), -180, 180) }
}
// One edit for the whole drag: each changed value (a keyframe at the playhead on an animated value).
function drop() {
  window.removeEventListener('pointermove', move)
  if (!drag) return
  const changed = Object.entries(live.value).filter(([k, v]) => Math.abs(v - drag.start[k]) > 1e-4)
  drag = null
  let doc = props.doc, item = props.item
  const ops = []
  for (const [k, v] of changed) {
    const o = valueOps(doc, item, `fx.${props.fx.id}.${k}`, Math.round(v * 1000) / 1000, props.tRel)
    ops.push(...o)
    if (o.length) { doc = tl.applyOps(doc, o).doc; item = tl.find(doc, props.item.id).item }
  }
  live.value = null
  if (ops.length) emit('ops', { ops, label: 'Mask moved' })
}
onBeforeUnmount(() => window.removeEventListener('pointermove', move))
</script>
<style scoped>
.mk{display:grid;gap:8px}
.mk-frame{width:100%;max-width:260px;border:1px solid var(--vm-line-2);border-radius:6px;background:linear-gradient(135deg,var(--vm-surface-2),var(--vm-bg));touch-action:none;overflow:hidden}
.mk-shape{fill:rgba(141,180,255,.18);stroke:var(--vs-accent-ink);stroke-width:1.5;cursor:move}
.mk-handle{fill:var(--vm-amber);stroke:var(--vm-bg);stroke-width:1.5;cursor:pointer}
</style>
