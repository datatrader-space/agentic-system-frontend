<template>
  <!-- Curves (plan C15, contract section 3: master, r, g, b, each 2..16 points in 0..1). Points can be dragged, or
       chosen and moved with the arrow keys (Shift: larger steps) or typed; Delete removes the chosen point. A click on
       the graph adds a point there; "Add a point" adds one without a pointer. -->
  <div class="cv" data-test="curves">
    <div class="pn-seg" role="group" aria-label="Channel">
      <button v-for="c in CHANNELS" :key="c.id" type="button" :aria-pressed="channel === c.id ? 'true' : 'false'" :data-test="`curve-${c.id}`" @click="pick(c.id)">{{ c.label }}</button>
    </div>
    <svg ref="svgEl" class="cv-graph" viewBox="0 0 200 200" role="group" :aria-label="`${label} curve`" @pointerdown.self="addAtPointer">
      <path d="M50 0V200M100 0V200M150 0V200M0 50H200M0 100H200M0 150H200" class="cv-grid" />
      <line x1="0" y1="200" x2="200" y2="0" class="cv-diag" />
      <polyline :points="sampled" class="cv-line" :style="{ stroke: colour }" @pointerdown="addAtPointer" />
      <circle v-for="(p, n) in draft" :key="n" :cx="p[0] * 200" :cy="200 - p[1] * 200" r="6" class="cv-dot" :class="{ on: n === chosen }"
              tabindex="0" role="button" :aria-label="`Point ${n + 1} of ${draft.length}: in ${pct(p[0])}, out ${pct(p[1])}. Arrow keys move it, Delete removes it.`"
              @focus="chosen = n" @keydown="key($event, n)" @keyup="keyUp" @pointerdown.stop="grab($event, n)" />
    </svg>
    <div v-if="draft[chosen]" class="pn-pair">
      <label class="st-field">In (%)<input class="pn-num" type="number" min="0" max="100" step="1" :value="pct(draft[chosen][0])" data-test="curve-x" @change="typed(0, $event.target.value)" /></label>
      <label class="st-field">Out (%)<input class="pn-num" type="number" min="0" max="100" step="1" :value="pct(draft[chosen][1])" data-test="curve-y" @change="typed(1, $event.target.value)" /></label>
    </div>
    <div class="pn-icons">
      <IconButton :icon="Plus" :label="`Add a point to the ${label} curve`" :disabled="draft.length >= 16" data-test="curve-add" @click="addMiddle" />
      <IconButton :icon="Trash2" label="Remove the chosen point" shortcut="Delete" :disabled="!removable(chosen)" @click="remove(chosen)" />
      <IconButton :icon="RotateCcw" :label="`Reset the ${label} curve`" @click="commit([[0, 0], [1, 1]], `${label} curve reset`)" />
    </div>
  </div>
</template>
<script setup>
import { Plus, RotateCcw, Trash2 } from 'lucide-vue-next'
import IconButton from './IconButton.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({ value: { type: Object, default: () => ({}) } })   // {master, r, g, b} as in the registry
const emit = defineEmits(['change'])                                         // ({master, r, g, b}, label)
const CHANNELS = [{ id: 'master', label: 'All', colour: 'var(--vm-ink)' }, { id: 'r', label: 'Red', colour: '#FF6E6E' }, { id: 'g', label: 'Green', colour: '#7FE0A8' }, { id: 'b', label: 'Blue', colour: '#8DB4FF' }]
const channel = ref('master'), chosen = ref(0), svgEl = ref(null)
const label = computed(() => CHANNELS.find(c => c.id === channel.value).label)
const colour = computed(() => CHANNELS.find(c => c.id === channel.value).colour)
const stored = computed(() => props.value?.[channel.value] || [[0, 0], [1, 1]])
const draft = ref([])
watch(stored, v => { draft.value = v.map(p => [...p]) }, { immediate: true })
const pct = v => Math.round(v * 100)
const r2 = v => Math.round(Math.min(Math.max(v, 0), 1) * 1000) / 1000

// A natural cubic spline through the points, as ffmpeg's curves filter draws it, sampled for the line.
const sampled = computed(() => {
  const p = draft.value, n = p.length
  if (n < 3) return p.map(([x, y]) => `${x * 200},${200 - y * 200}`).join(' ')
  const h = [], a = [], l = [1], mu = [0], z = [0], c = new Array(n).fill(0), b = [], d = []
  for (let i = 0; i < n - 1; i++) h[i] = p[i + 1][0] - p[i][0] || 1e-6
  for (let i = 1; i < n - 1; i++) a[i] = 3 / h[i] * (p[i + 1][1] - p[i][1]) - 3 / h[i - 1] * (p[i][1] - p[i - 1][1])
  for (let i = 1; i < n - 1; i++) { l[i] = 2 * (p[i + 1][0] - p[i - 1][0]) - h[i - 1] * mu[i - 1]; mu[i] = h[i] / l[i]; z[i] = (a[i] - h[i - 1] * z[i - 1]) / l[i] }
  for (let j = n - 2; j >= 0; j--) { c[j] = (z[j] || 0) - (mu[j] || 0) * c[j + 1]; b[j] = (p[j + 1][1] - p[j][1]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3; d[j] = (c[j + 1] - c[j]) / (3 * h[j]) }
  const out = []
  for (let s = 0; s <= 100; s++) {
    const x = p[0][0] + (p[n - 1][0] - p[0][0]) * s / 100
    let j = 0
    while (j < n - 2 && x > p[j + 1][0]) j++
    const dx = x - p[j][0], y = Math.min(Math.max(p[j][1] + b[j] * dx + c[j] * dx * dx + d[j] * dx ** 3, 0), 1)
    out.push(`${x * 200},${200 - y * 200}`)
  }
  return out.join(' ')
})

function commit(points, text = `${label.value} curve changed`) {
  emit('change', { ...props.value, [channel.value]: points.map(p => [r2(p[0]), r2(p[1])]) }, text)
}
function pick(id) { channel.value = id; chosen.value = 0 }
const removable = n => n > 0 && n < draft.value.length - 1 && draft.value.length > 2
function remove(n) { if (removable(n)) { commit(draft.value.filter((_, i) => i !== n), `${label.value} curve point removed`); chosen.value = Math.max(0, n - 1) } }
// Points keep their order across: x stays between the neighbours; the end points keep x 0 and 1.
function bounded(n, x) {
  if (n === 0) return 0
  if (n === draft.value.length - 1) return 1
  return Math.min(Math.max(x, draft.value[n - 1][0] + 0.01), draft.value[n + 1][0] - 0.01)
}
function insert(x, y) {
  if (draft.value.length >= 16) return
  const n = draft.value.findIndex(p => p[0] > x)
  if (n <= 0 || x - draft.value[n - 1][0] < 0.01 || draft.value[n][0] - x < 0.01) return
  const next = draft.value.map(p => [...p])
  next.splice(n, 0, [x, y])
  chosen.value = n
  commit(next, `${label.value} curve point added`)
}
function addMiddle() {
  let at = 1
  for (let i = 1; i < draft.value.length; i++) if (draft.value[i][0] - draft.value[i - 1][0] > draft.value[at][0] - draft.value[at - 1][0]) at = i
  const a = draft.value[at - 1], b = draft.value[at]
  insert((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
}
function typed(axis, raw) {
  const v = Number(raw) / 100
  if (!Number.isFinite(v)) return
  const next = draft.value.map(p => [...p])
  next[chosen.value][axis] = axis === 0 ? bounded(chosen.value, v) : Math.min(Math.max(v, 0), 1)
  commit(next)
}
let nudged = false
function key(e, n) {
  const step = e.shiftKey ? 0.1 : 0.01
  const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key]
  if (move) {
    e.preventDefault()
    const p = draft.value[n]
    draft.value[n] = [bounded(n, p[0] + move[0]), Math.min(Math.max(p[1] + move[1], 0), 1)]
    nudged = true
  } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(n) }
}
function keyUp() { if (nudged) { nudged = false; commit(draft.value) } }
function at(e) { const b = svgEl.value.getBoundingClientRect(); return [r2((e.clientX - b.left) / b.width), r2(1 - (e.clientY - b.top) / b.height)] }
function addAtPointer(e) { const [x, y] = at(e); insert(x, y) }
let dragging = -1
function grab(e, n) {
  chosen.value = n; dragging = n
  window.addEventListener('pointermove', drag); window.addEventListener('pointerup', drop, { once: true })
}
function drag(e) { if (dragging < 0) return; const [x, y] = at(e); draft.value[dragging] = [bounded(dragging, x), y] }
function drop() { window.removeEventListener('pointermove', drag); if (dragging >= 0) { dragging = -1; commit(draft.value) } }
onBeforeUnmount(() => window.removeEventListener('pointermove', drag))
</script>
<style scoped>
.cv{display:grid;gap:8px}
.cv-graph{width:100%;max-width:240px;aspect-ratio:1;border:1px solid var(--vm-line-2);border-radius:6px;background:var(--vm-bg);touch-action:none;cursor:crosshair}
.cv-grid{stroke:var(--vm-line-2);stroke-width:1;fill:none}
.cv-diag{stroke:var(--vm-line);stroke-dasharray:3 3}
.cv-line{fill:none;stroke-width:2}
.cv-dot{fill:var(--vm-surface);stroke:var(--vm-ink);stroke-width:2;cursor:grab}
.cv-dot.on{fill:var(--vm-amber);stroke:var(--vm-amber)}
.cv-dot:focus-visible{outline:none;stroke:var(--vs-accent-ink);stroke-width:4}
</style>
