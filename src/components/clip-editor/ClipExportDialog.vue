<template>
  <!-- Export (VIDEO_EDITOR_PRO_PLAN.md I34-I35, contract section 9): shapes, resolution (4K only when a source is
       above 1080p; it counts as two running exports), frame rate, quality, the whole timeline or the selection, the
       outputs (video, sound, a still at the playhead, GIF, captions, stems, OpenTimelineIO, YouTube chapters) and a
       loudness target; then the free export job with its progress. Every result lands in the Library and the
       project. A custom dialog: no browser dialog. -->
  <div class="cx-backdrop" @click.self="$emit('close')">
    <section ref="box" class="cx" role="dialog" aria-modal="true" aria-labelledby="cx-title" tabindex="-1" @keydown.esc.prevent="$emit('close')" @keydown.tab="trap">
      <header class="cx-head"><h2 id="cx-title">Export</h2><IconButton :icon="X" label="Close" shortcut="Esc" data-test="cx-close" @click="$emit('close')" /></header>
      <template v-if="!job">
        <fieldset class="cx-group"><legend>What to make</legend>
          <label v-for="o in OUTPUTS" :key="o.id" class="cx-check" :class="{ 'is-off': reasonOff(o.id) }">
            <input v-model="outputs" type="checkbox" :value="o.id" :disabled="!!reasonOff(o.id)" :data-test="`cx-out-${o.id}`" :aria-describedby="reasonOff(o.id) ? `cx-why-${o.id}` : undefined" />
            <span>{{ o.label }}<small v-if="reasonOff(o.id)" :id="`cx-why-${o.id}`" class="cx-why">{{ reasonOff(o.id) }}</small></span>
          </label>
        </fieldset>
        <fieldset v-if="visual" class="cx-group"><legend>Shapes</legend>
          <label v-for="a in tl.ASPECTS" :key="a" class="cx-check"><input v-model="aspects" type="checkbox" :value="a" :data-test="`cx-shape-${a}`" /> {{ a }}{{ a === doc.canvas.aspect ? ' (this timeline)' : '' }}</label>
        </fieldset>
        <div v-if="visual" class="cx-grid">
          <label class="st-field">Resolution
            <select v-model="resolution" class="st-input" data-test="cx-resolution">
              <option value="720p">720p</option><option value="1080p">1080p</option>
              <option v-if="can4k" value="4k">4K (counts as two exports)</option>
            </select>
          </label>
          <label class="st-field">Frame rate
            <select v-model.number="rate" class="st-input" data-test="cx-rate">
              <option :value="doc.rate">{{ doc.rate }} a second (the timeline's)</option>
              <option v-if="doc.rate !== 60" :value="60">60 a second</option>
            </select>
          </label>
          <label class="st-field">Quality
            <select v-model="quality" class="st-input" data-test="cx-quality">
              <option value="draft">Draft (smallest file)</option><option value="standard">Standard</option><option value="high">High (slower)</option>
            </select>
          </label>
        </div>
        <p v-if="visual && !can4k" class="cx-note st-muted">4K is offered when a video on the timeline is larger than 1080p.</p>
        <p v-if="resolution === '4k'" class="cx-note st-muted">A 4K export counts as two of your two running exports, so nothing else exports while it renders.</p>
        <div class="cx-grid">
          <fieldset class="cx-group cx-inline"><legend>Range</legend>
            <label class="cx-check"><input v-model="range" type="radio" value="all" data-test="cx-range-all" /> The whole timeline ({{ tc(total) }})</label>
            <label class="cx-check"><input v-model="range" type="radio" value="selection" :disabled="!selectionRange" data-test="cx-range-selection" /> The selection{{ selectionRange ? ` (${tc(selectionRange[0])} to ${tc(selectionRange[1])})` : ': select clips first' }}</label>
          </fieldset>
          <label class="st-field">Loudness
            <select v-model="loudness" class="st-input" data-test="cx-loudness">
              <option value="none">As mixed</option><option value="-14">−14 LUFS (streaming: YouTube, Spotify)</option><option value="-16">−16 LUFS (podcasts, Apple)</option><option value="-23">−23 LUFS (broadcast, EBU R128)</option>
            </select>
          </label>
        </div>
        <p v-if="outputs.includes('still')" class="cx-note st-muted">The still is the frame at the playhead, {{ tc(playhead) }}.</p>
        <p class="st-muted cx-note">{{ tc(spanMs) }} long. Export is free. Positions and sizes are shares of the frame, so every shape is drawn from the same timeline.</p>
        <p v-if="problem" class="st-error" role="status">{{ problem }}</p>
        <p v-if="error" class="st-error" role="alert">{{ error }}</p>
        <!-- A refusal for helper files not made yet (409 derived_missing): each one, with the way to make it. -->
        <ul v-if="missing.length" class="cx-missing" data-test="cx-missing">
          <li v-for="m in missing" :key="`${m.clip}:${m.op}`">
            <span>{{ m.op === 'reverse' ? 'The reversed copy' : 'The background removal' }} of {{ m.name || 'a clip' }}</span>
            <button type="button" class="st-button pn-small" :disabled="m.op === 'reverse' && helper === 'working'" :data-test="`cx-make-${m.op}`" @click="$emit('make-helper', m)">
              {{ m.op === 'reverse' ? (helper === 'working' ? 'Making the reversed copy…' : 'Make the reversed copy') : 'Open background removal' }}</button>
          </li>
        </ul>
        <button type="button" class="st-button primary" :disabled="!!problem || busy" data-test="cx-export" @click="$emit('export', params)">{{ busy ? 'Starting…' : 'Export' }}</button>
        <fieldset class="cx-group"><legend>Other formats (free)</legend>
          <IconButton :icon="FileJson" label="Download Lottie (text and overlays)" data-test="cx-lottie" :disabled="busy" @click="$emit('lottie')" />
          <IconButton :icon="Globe" label="Download as a web page" data-test="cx-webpage" :disabled="busy" @click="$emit('webpage')" />
          <p v-if="note" class="st-muted cx-note" role="status">{{ note }}</p>
        </fieldset>
      </template>
      <template v-else>
        <VideoJobCard :job="job" in-studio />
        <p class="st-muted cx-note">{{ job.state === 'ready' ? 'Done. Everything it made is in your Library and in this project\'s files.' : 'You can keep editing while it renders; it uses the timeline as saved when you pressed Export.' }}</p>
        <button type="button" class="st-button" @click="$emit('close')">Close</button>
      </template>
    </section>
  </div>
</template>
<script setup>
import { FileJson, Globe, X } from 'lucide-vue-next'
import IconButton from './panels/IconButton.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as tl from './timelineModel'
import * as br from './panels/bridge'
import VideoJobCard from '../video/VideoJobCard.vue'

const props = defineProps({ doc: { type: Object, required: true }, busy: Boolean, job: { type: Object, default: null }, error: { type: String, default: '' }, note: { type: String, default: '' },
  media: { type: Object, default: () => ({}) }, selectionRange: { type: Array, default: null }, playhead: { type: Number, default: 0 },
  // After a 409 derived_missing: [{clip, media, op, name}], and the state of the reversed copy being made ('' | working | ready | failed).
  missing: { type: Array, default: () => [] }, helper: { type: String, default: '' } })
defineEmits(['close', 'export', 'lottie', 'webpage', 'make-helper'])
const OUTPUTS = [
  { id: 'video', label: 'Video (MP4)' }, { id: 'audio_mp3', label: 'Sound only (MP3)' }, { id: 'audio_wav', label: 'Sound only (WAV)' },
  { id: 'still', label: 'Still picture of the playhead frame (PNG)' }, { id: 'gif', label: 'GIF (up to 15 seconds)' },
  { id: 'srt', label: 'Captions (SRT)' }, { id: 'vtt', label: 'Captions (VTT)' }, { id: 'stems', label: 'Stems: one WAV per role (ZIP)' },
  { id: 'otio', label: 'OpenTimelineIO, for other editors' }, { id: 'chapters', label: 'YouTube chapters' },
]
const VISUAL = ['video', 'still', 'gif']
const aspects = ref([props.doc.canvas.aspect]), resolution = ref('1080p'), rate = ref(props.doc.rate), quality = ref('standard')
const range = ref('all'), outputs = ref(['video']), loudness = ref('none'), box = ref(null)
const total = computed(() => tl.totalMs(props.doc))
const tc = ms => tl.timecode(ms, props.doc.rate)
const spanMs = computed(() => range.value === 'selection' && props.selectionRange ? props.selectionRange[1] - props.selectionRange[0] : total.value)
const visual = computed(() => outputs.value.some(o => VISUAL.includes(o)))
// 4K only when a video source on the timeline is larger than 1080p on its short side (contract section 9).
const can4k = computed(() => props.doc.tracks.some(t => t.items.some(i => {
  const m = props.media[i.media]
  return m && m.media_type === 'video' && Math.min(m.width || 0, m.height || 0) > 1080
})))
watch(can4k, ok => { if (!ok && resolution.value === '4k') resolution.value = '1080p' })
const captions = computed(() => props.doc.tracks.some(t => t.kind === 'text' && t.captions && t.items.length))
const chapters = computed(() => (props.doc.markers || []).some(m => m.chapter))
function reasonOff(id) {
  if ((id === 'srt' || id === 'vtt') && !captions.value) return 'There are no captions on the timeline.'
  if (id === 'chapters' && !chapters.value) return 'Mark chapters on the ruler first.'
  if (id === 'gif' && spanMs.value > br.editorLimits(br.registry()).gif_max_ms) return 'Choose a range of 15 seconds or less.'
  if (id === 'still' && (props.playhead < 0 || props.playhead >= total.value)) return 'Move the playhead onto the video.'
  return ''
}
watch(() => OUTPUTS.map(o => reasonOff(o.id)).join('|'), () => { outputs.value = outputs.value.filter(o => !reasonOff(o)) })
const problem = computed(() => {
  if (!outputs.value.length) return 'Choose at least one thing to make.'
  if (visual.value && !aspects.value.length) return 'Choose at least one shape.'
  if (!spanMs.value) return 'Add something to the timeline first.'
  return ''
})
// The range sent: the selection when chosen; a GIF always names its range (at most 15 s), the whole timeline when short.
const rangeMs = computed(() => {
  if (range.value === 'selection' && props.selectionRange) return [...props.selectionRange]
  return outputs.value.includes('gif') ? [0, total.value] : null
})
const params = computed(() => ({
  aspects: visual.value ? aspects.value : [props.doc.canvas.aspect], resolution: resolution.value, rate: rate.value, quality: quality.value,
  outputs: [...outputs.value], loudness: loudness.value,
  ...(rangeMs.value ? { range_ms: rangeMs.value } : {}),
  ...(outputs.value.includes('still') ? { still_at_ms: props.playhead } : {}),
}))

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
let before = null
onMounted(async () => { before = document.activeElement; await nextTick(); box.value?.focus() })
onBeforeUnmount(() => before?.focus?.())
function trap(e) {
  const items = [...(box.value?.querySelectorAll(FOCUSABLE) || [])]
  if (!items.length) return
  const first = items[0], last = items[items.length - 1]
  if (e.shiftKey && (document.activeElement === first || document.activeElement === box.value)) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
</script>
<style scoped>
.cx-backdrop{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:16px;background:var(--vs-scrim)}
.cx{display:grid;gap:12px;width:min(560px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border:1px solid var(--vm-line);border-radius:10px;background:var(--vm-surface);box-shadow:var(--vm-shadow-l);color:var(--vm-ink)}
.cx :is(button,input,select,a):focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:2px}
.cx-head{display:flex;align-items:center;justify-content:space-between}.cx-head h2{font-size:16px;font-weight:600;margin:0}
.cx-group{display:flex;flex-wrap:wrap;gap:4px 14px;margin:0;padding:10px;border:1px solid var(--vm-line-2);border-radius:7px;min-width:0}
.cx-missing{display:grid;gap:6px;margin:0;padding:0;list-style:none;font-size:13px}
.cx-missing li{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.cx-group legend{padding:0 4px;font-size:12px;color:var(--vm-ink-soft)}
.cx-inline{flex-direction:column}
/* 180 px: three settings fit a row only when "30 a second (the timeline's)" is not cut; otherwise they wrap. */
.cx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;align-items:start}
.cx-check{display:flex;align-items:flex-start;gap:6px;min-height:32px;font-size:13px;line-height:1.4}.cx-check input{flex:none;margin-top:1px;accent-color:var(--vm-primary);width:18px;height:18px}
.cx-check.is-off{color:var(--vm-ink-faint)}
.cx-why{display:block;font-size:11px;color:var(--vm-ink-faint)}
.cx-note{font-size:12px;line-height:1.55;margin:0}
@media (max-width:767px){.cx-backdrop{align-items:end;padding:0}.cx{width:100%;border-radius:12px 12px 0 0}.cx-check,.cx .st-button{min-height:44px}}
</style>
