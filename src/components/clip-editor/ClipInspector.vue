<template>
  <!-- The selected item's settings (plan P3): every value typed or stepped, so nothing needs a drag (WCAG 2.5.7).
       Each change is one edit: it can be undone, and it is saved with the timeline. -->
  <section class="ci" aria-label="Settings of the selection">
    <template v-if="!row">
      <h3 class="ci-h">Video</h3>
      <label class="st-field">Shape<select class="st-input" :value="doc.canvas.aspect" @change="canvas({ aspect: $event.target.value }, 'Shape changed')"><option v-for="a in tl.ASPECTS" :key="a" :value="a">{{ a }}</option></select></label>
      <label class="st-field">Frame rate<select class="st-input" :value="doc.rate" @change="emitOps([{ op: 'set', path: ['rate'], value: Number($event.target.value) }], 'Frame rate changed')"><option v-for="r in tl.RATES" :key="r" :value="r">{{ r }} frames a second</option></select></label>
      <label class="st-field">Background<input class="ci-color" type="color" :value="doc.canvas.background" @change="canvas({ background: $event.target.value.toUpperCase() }, 'Background changed')" /></label>
      <p class="st-muted ci-note">Select a clip, a text or a transition on the timeline to change it.</p>
    </template>

    <template v-else-if="item.type === 'transition'">
      <h3 class="ci-h">Transition</h3>
      <label class="st-field">Kind<select class="st-input" :value="item.kind" @change="set({ kind: $event.target.value }, 'Transition changed')"><option v-for="k in tl.TRANSITIONS" :key="k" :value="k">{{ transitionName(k) }}</option></select></label>
      <label class="st-field">Length (seconds)<input class="st-input" type="number" inputmode="decimal" :min="tl.TRANSITION_MS[0] / 1000" :max="tl.TRANSITION_MS[1] / 1000" step="0.1" :value="item.ms / 1000" @change="emitOps(tl.setTransitionMsOps(doc, item.id, Number($event.target.value) * 1000), 'Transition length changed')" /></label>
      <button type="button" class="st-button" @click="emitOps(tl.removeTransitionOps(doc, item.id), 'Transition removed')">Remove transition</button>
    </template>

    <template v-else>
      <h3 class="ci-h">{{ item.type === 'text' ? (row.track.captions ? 'Caption' : 'Text') : row.track.kind === 'audio' ? 'Sound' : isPicture ? 'Picture' : 'Video clip' }}</h3>
      <label v-if="item.type === 'text'" class="st-field">Text<textarea class="st-input" rows="3" maxlength="500" :value="item.text" @change="setText($event.target.value)" /></label>
      <div class="ci-pair">
        <label class="st-field">Starts at<input class="st-input" inputmode="decimal" :value="seconds(item.start_ms)" @change="typed($event, v => tl.moveOps(doc, item.id, v), 'Moved')" /></label>
        <label class="st-field">Ends at<input class="st-input" inputmode="decimal" :value="seconds(tl.itemEnd(item))" @change="typed($event, v => trimOps('end', v), 'Trimmed')" /></label>
      </div>
      <div v-if="hasSource" class="ci-pair">
        <label class="st-field">From the file at<input class="st-input" inputmode="decimal" :value="seconds(item.source_in_ms)" @change="typed($event, v => sourceOps('source_in_ms', v), 'In point changed')" /></label>
        <label class="st-field">To the file at<input class="st-input" inputmode="decimal" :value="seconds(item.source_out_ms)" @change="typed($event, v => sourceOps('source_out_ms', v), 'Out point changed')" /></label>
      </div>
      <p v-if="typedError" class="st-error" role="alert">{{ typedError }}</p>

      <template v-if="row.track.kind === 'video' && item.type === 'clip'">
        <label v-if="!isPicture" class="st-field">Speed<select class="st-input" :value="item.speed || 1" @change="set({ speed: Number($event.target.value) }, 'Speed changed')"><option v-for="s in SPEEDS" :key="s" :value="s">{{ s }}×</option></select></label>
        <label v-if="isPicture" class="ci-check"><input type="checkbox" :checked="!!item.zoom" @change="set({ zoom: $event.target.checked || undefined }, 'Slow zoom changed')" /> Slow zoom</label>
        <label class="st-field">Fit<select class="st-input" :value="item.fit || 'contain'" @change="set({ fit: $event.target.value }, 'Fit changed')"><option value="contain">Whole picture (padded)</option><option value="cover">Fill the box (cropped)</option></select></label>
        <fieldset class="ci-group"><legend>Position and size</legend>
          <label v-for="k in ['x', 'y', 'scale', 'opacity']" :key="k" class="ci-range">{{ TRANSFORM_LABEL[k] }}<input type="range" :min="k === 'scale' ? 0.05 : 0" max="1" step="0.01" :value="(item.transform || {})[k] ?? (k === 'scale' || k === 'opacity' ? 1 : 0.5)" @change="set({ transform: { ...DEFAULT_TF, ...item.transform, [k]: Number($event.target.value) } }, `${TRANSFORM_LABEL[k]} changed`)" /><output>{{ Math.round(((item.transform || {})[k] ?? (k === 'scale' || k === 'opacity' ? 1 : 0.5)) * 100) }}%</output></label>
          <button type="button" class="st-button" @click="set({ transform: { ...DEFAULT_TF } }, 'Position reset')">Full frame</button>
        </fieldset>
        <fieldset class="ci-group"><legend>Crop</legend>
          <div class="ci-grid">
            <label v-for="k in ['x', 'y', 'w', 'h']" :key="k" class="st-field">{{ CROP_LABEL[k] }} (%)<input class="st-input" type="number" min="0" max="100" step="1" :value="Math.round(((item.crop || FULL_CROP)[k]) * 100)" @change="setCrop(k, $event.target.value)" /></label>
          </div>
          <button v-if="item.crop" type="button" class="st-button" @click="set({ crop: undefined }, 'Crop removed')">Remove crop</button>
          <p v-if="cropError" class="st-error" role="alert">{{ cropError }}</p>
        </fieldset>
        <div v-if="next" class="ci-group"><span class="ci-legend">Into the next clip</span>
          <button v-if="!into" type="button" class="st-button" :disabled="!touchesNext" @click="emitOps(tl.addTransitionOps(doc, item.id, 'crossfade', 500), 'Crossfade added')">Add a crossfade</button>
          <p v-if="!into && !touchesNext" class="st-muted ci-note">Move the next clip to start where this one ends to join them with a transition.</p>
          <button v-else-if="into" type="button" class="st-button" @click="$emit('select', into.id)">Edit the transition</button>
        </div>
      </template>

      <template v-if="hasSource || (row.track.kind === 'audio')">
        <fieldset class="ci-group"><legend>Sound</legend>
          <label class="ci-range">Volume<input type="range" min="-40" max="12" step="1" :value="item.volume_db || 0" @change="set({ volume_db: Number($event.target.value) }, 'Volume changed')" /><output>{{ item.volume_db || 0 }} dB</output></label>
          <label v-if="row.track.kind === 'video'" class="ci-check"><input type="checkbox" :checked="!!item.muted" @change="set({ muted: $event.target.checked || undefined }, $event.target.checked ? 'Clip muted' : 'Clip unmuted')" /> Mute this clip's own sound</label>
          <label v-if="row.track.kind === 'audio'" class="ci-check"><input type="checkbox" :checked="!!item.duck" @change="set({ duck: $event.target.checked || undefined }, 'Lowering under speech changed')" /> Lower under speech</label>
          <div class="ci-pair">
            <label class="st-field">Fade in (s)<input class="st-input" type="number" inputmode="decimal" min="0" max="60" step="0.1" :value="(item.fade_in_ms || 0) / 1000" @change="set({ fade_in_ms: Math.round(Number($event.target.value) * 1000) || undefined }, 'Fade changed')" /></label>
            <label class="st-field">Fade out (s)<input class="st-input" type="number" inputmode="decimal" min="0" max="60" step="0.1" :value="(item.fade_out_ms || 0) / 1000" @change="set({ fade_out_ms: Math.round(Number($event.target.value) * 1000) || undefined }, 'Fade changed')" /></label>
          </div>
        </fieldset>
      </template>

      <template v-if="item.type === 'text'">
        <label class="st-field">Font<select class="st-input" :value="item.style.font" @change="style({ font: $event.target.value })"><option v-for="font in tl.FONTS" :key="font.id" :value="font.id">{{ font.label }}</option></select></label>
        <label class="ci-range">Size<input type="range" min="0.02" max="0.25" step="0.005" :value="item.style.size" @change="style({ size: Number($event.target.value) })" /><output>{{ Math.round(item.style.size * 1000) / 10 }}%</output></label>
        <div class="ci-pair">
          <label class="st-field">Colour<input class="ci-color" type="color" :value="item.style.color" @change="style({ color: $event.target.value.toUpperCase() })" /></label>
          <label class="st-field">Box<select class="st-input" :value="item.style.box ? 'on' : 'off'" @change="style({ box: $event.target.value === 'on' ? '#0000008C' : null })"><option value="off">None</option><option value="on">Dark box</option></select></label>
        </div>
        <label v-if="item.style.box" class="st-field">Box colour<input class="ci-color" type="color" :value="item.style.box.slice(0, 7)" @change="style({ box: $event.target.value.toUpperCase() + (item.style.box.slice(7) || '') })" /></label>
        <label class="ci-range">Across<input type="range" min="0" max="1" step="0.01" :value="item.x" @change="set({ x: Number($event.target.value) }, 'Text moved')" /><output>{{ Math.round(item.x * 100) }}%</output></label>
        <label class="ci-range">Down<input type="range" min="0" max="1" step="0.01" :value="item.y" @change="set({ y: Number($event.target.value) }, 'Text moved')" /><output>{{ Math.round(item.y * 100) }}%</output></label>
      </template>
    </template>
  </section>
</template>
<script setup>
import { computed, ref } from 'vue'
import * as tl from './timelineModel'

const props = defineProps({ doc: { type: Object, required: true }, selectedId: { type: String, default: '' }, media: { type: Object, default: () => ({}) } })
const emit = defineEmits(['ops', 'select'])
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]
const DEFAULT_TF = { x: 0.5, y: 0.5, scale: 1, opacity: 1 }
const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 }
const TRANSFORM_LABEL = { x: 'Across', y: 'Down', scale: 'Size', opacity: 'Opacity' }
const CROP_LABEL = { x: 'Left', y: 'Top', w: 'Width', h: 'Height' }
const typedError = ref(''), cropError = ref('')
const row = computed(() => (props.selectedId && tl.find(props.doc, props.selectedId)) || null)
const item = computed(() => row.value?.item)
const isPicture = computed(() => item.value?.hold_ms != null)
const hasSource = computed(() => item.value?.type === 'clip' && item.value.source_out_ms != null)
const next = computed(() => { if (!row.value) return null; const list = tl.ordered(row.value.track), n = list.findIndex(i => i.id === item.value.id); return list[n + 1] || null })
const into = computed(() => next.value && tl.transitionInto(row.value.track, next.value.id))
const touchesNext = computed(() => next.value && next.value.start_ms === tl.itemEnd(item.value))
const transitionName = k => ({ crossfade: 'Crossfade', fade_black: 'Fade through black', fade_white: 'Fade through white', wipe: 'Wipe', slide: 'Slide', dissolve: 'Dissolve' })[k] || k
const seconds = ms => tl.timecode(ms, props.doc.rate).replace(/\.(\d\d)$/, (m, f) => `.${f}f`)

function emitOps(ops, label) { if (ops.length) emit('ops', { ops, label }) }
function set(changes, label) { emitOps(tl.setOps(props.doc, item.value.id, changes), label) }
function canvas(changes, label) { emitOps(tl.setCanvasOps(props.doc, changes), label) }
function style(changes) { set({ style: { ...item.value.style, ...changes } }, 'Text style changed') }
function setText(text) {
  if (!text.trim()) { typedError.value = 'Text cannot be empty. Delete the item to remove it.'; return }
  typedError.value = ''; set({ text: text.trim() }, 'Text changed')
}
// The part of the file a clip plays, typed directly: the clip keeps its start on the timeline.
function sourceOps(key, v) {
  const it = item.value, dur = props.media[it.media]?.duration_ms, min = Math.ceil(tl.frameMs(props.doc.rate))
  const inMs = key === 'source_in_ms' ? v : it.source_in_ms, outMs = key === 'source_out_ms' ? v : it.source_out_ms
  if (inMs < 0 || outMs - inMs < min || (dur && outMs > dur)) { typedError.value = `The clip must start before it ends, inside its file${dur ? ` (${seconds(dur)})` : ''}.`; return [] }
  return tl.setOps(props.doc, it.id, { [key]: v })
}
function trimOps(edge, at) { return tl.trimOps(props.doc, item.value.id, edge, at, { durationMs: props.media[item.value.media]?.duration_ms, rate: props.doc.rate }) }
// A typed time: seconds ("12.5"), minutes and seconds ("1:02.5"), or the shown form ("0:12.15f": frames).
function readTyped(text) {
  const f = /^(\d+):(\d{1,2})\.(\d{1,2})f$/.exec(String(text).trim())
  if (f) return Math.round((Number(f[1]) * 60 + Number(f[2])) * 1000 + Number(f[3]) * tl.frameMs(props.doc.rate))
  return tl.parseTime(text)
}
function typed(event, build, label) {
  const v = readTyped(event.target.value)
  if (!Number.isFinite(v)) { typedError.value = 'Type a time in seconds, like 12.5, or minutes and seconds, like 1:02.5.'; return }
  typedError.value = ''
  emitOps(build(tl.toFrame(v, props.doc.rate)), label)
}
function setCrop(key, value) {
  const c = { ...FULL_CROP, ...(item.value.crop || {}), [key]: Math.min(Math.max(Number(value) / 100, 0), 1) }
  if (c.w < 0.05 || c.h < 0.05 || c.x + c.w > 1.0001 || c.y + c.h > 1.0001) { cropError.value = 'The crop must stay inside the picture and keep at least 5% of it.'; return }
  cropError.value = ''
  set({ crop: c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1 ? undefined : c }, 'Crop changed')
}
</script>
<style scoped>
.ci{display:grid;gap:12px;align-content:start;min-width:0}
.ci-h{font-size:14px;font-weight:600;color:var(--vm-ink)}
.ci-pair,.ci-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ci-group{display:grid;gap:8px;margin:0;padding:10px;border:1px solid var(--vm-line-2);border-radius:7px;min-width:0}
.ci-group legend,.ci-legend{padding:0 4px;font-size:12px;color:var(--vm-ink-soft)}
.ci-range{display:grid;grid-template-columns:70px 1fr 48px;align-items:center;gap:8px;font-size:12px;color:var(--vm-ink-soft)}
.ci-range input{width:100%;accent-color:var(--vm-primary);min-height:24px}.ci-range output{font-variant-numeric:tabular-nums;text-align:right;color:var(--vm-ink)}
.ci-check{display:flex;align-items:center;gap:8px;min-height:32px;font-size:13px;color:var(--vm-ink)}
.ci-check input{width:18px;height:18px;accent-color:var(--vm-primary)}
.ci-color{width:100%;height:40px;padding:2px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface)}
.ci-note{font-size:12px;line-height:1.5}
@media (max-width:767px){.ci-range input,.ci-check{min-height:44px}.ci-range{grid-template-columns:62px 1fr 44px}}
</style>
