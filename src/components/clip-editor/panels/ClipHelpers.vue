<template>
  <!-- Helpers (plan J36-J39, G32; contract section 7): server jobs on the selected clip's file, each with its progress,
       and each result shown for review before anything on the timeline changes: remove pauses and filler words,
       split at scene cuts, steady a shaky clip, reframe for another shape, find the beats of a music clip (markers,
       and "cut to the beat"), and a pointer to background removal (in Effects, behind its price card). Free jobs never charge. -->
  <section class="hp pn" aria-label="Helpers" data-test="helpers">
    <h3 class="hp-h">Helpers</h3>
    <p v-if="!clip" class="pn-note">Select a clip on the timeline to use a helper on it.</p>
    <template v-else>
      <details class="pn-group" data-test="hp-silences">
        <summary>Remove pauses and filler words</summary>
        <label class="st-field">Shortest pause to remove (seconds)<input v-model.number="minPause" class="st-input" type="number" min="0.2" max="5" step="0.1" /></label>
        <button type="button" class="st-button pn-small" :disabled="!clip.media || silences.state.status === 'working'" data-test="hp-silences-find" @click="silences.start(clip.media, 'silences', { min_ms: Math.round(minPause * 1000), fillers: true })">Find them</button>
        <p v-if="silences.state.status === 'working'" class="pn-note" role="status">{{ progress(silences, 'Listening for pauses and filler words') }}</p>
        <template v-if="silences.state.status === 'ready'">
          <p v-if="silences.state.result?.fillers_note" class="pn-note">{{ silences.state.result.fillers_note }}</p>
          <p v-if="!found.length" class="pn-note" role="status">No pauses or filler words were found in this clip.</p>
          <template v-else>
            <p class="pn-note" role="status">Found {{ found.length }}. Untick any part to keep it, then cut the rest.</p>
            <ul class="pn-list hp-review">
              <li v-for="(r, n) in found" :key="n"><label class="pn-check"><input v-model="chosen" type="checkbox" :value="n" />
                {{ r.text ? `“${r.text}”` : 'Pause' }} at {{ at(r.start_ms) }}, {{ secs(r.end_ms - r.start_ms) }}</label></li>
            </ul>
            <button type="button" class="st-button primary pn-small" :disabled="!chosen.length" data-test="hp-silences-cut" @click="cutChosen">Cut the {{ chosen.length }} chosen part{{ chosen.length === 1 ? '' : 's' }}</button>
          </template>
        </template>
        <p v-if="silences.state.status === 'failed'" class="pn-error" role="alert">{{ silences.state.error }}</p>
      </details>

      <details class="pn-group" data-test="hp-scenes">
        <summary>Split at scene cuts</summary>
        <button type="button" class="st-button pn-small" :disabled="scenes.state.status === 'working'" data-test="hp-scenes-find" @click="scenes.start(clip.media, 'scene_cuts', {})">Find the cuts</button>
        <p v-if="scenes.state.status === 'working'" class="pn-note" role="status">{{ progress(scenes, 'Looking for scene cuts') }}</p>
        <template v-if="scenes.state.status === 'ready'">
          <p class="pn-note" role="status">{{ cuts.length ? `Found ${cuts.length} cut${cuts.length === 1 ? '' : 's'} inside this clip: ${cuts.map(at).join(', ')}.` : 'No scene cuts were found inside this clip.' }}</p>
          <button v-if="cuts.length" type="button" class="st-button primary pn-small" data-test="hp-scenes-split" @click="splitScenes">Split at {{ cuts.length }} cut{{ cuts.length === 1 ? '' : 's' }}</button>
        </template>
        <p v-if="scenes.state.status === 'failed'" class="pn-error" role="alert">{{ scenes.state.error }}</p>
      </details>

      <details v-if="isVideo" class="pn-group" data-test="hp-stabilize">
        <summary>Steady a shaky clip</summary>
        <button type="button" class="st-button pn-small" :disabled="steady.state.status === 'working'" @click="steady.start(clip.media, 'stabilize', {})">Make a steady copy</button>
        <p v-if="steady.state.status === 'working'" class="pn-note" role="status">{{ progress(steady, 'Steadying (two passes)') }}</p>
        <template v-if="steady.state.status === 'ready'">
          <button v-if="steady.state.result?.media" type="button" class="st-button primary pn-small" @click="useSteady">Use the steady copy in this clip</button>
          <p v-else class="pn-error" role="alert">The steady copy was made but no file came back to use.</p>
        </template>
        <p v-if="steady.state.status === 'failed'" class="pn-error" role="alert">{{ steady.state.error }}</p>
      </details>

      <details v-if="isVideo" class="pn-group" data-test="hp-reframe">
        <summary>Reframe for another shape</summary>
        <label class="st-field">New shape<select v-model="reframeTo" class="st-input"><option v-for="a in otherShapes" :key="a" :value="a">{{ a }}</option></select></label>
        <label class="pn-check"><input v-model="reshape" type="checkbox" /> Also change the video to {{ reframeTo }}</label>
        <button type="button" class="st-button pn-small" :disabled="reframe.state.status === 'working'" @click="reframe.start(clip.media, 'reframe', { aspect: reframeTo })">Follow the subject</button>
        <p v-if="reframe.state.status === 'working'" class="pn-note" role="status">{{ progress(reframe, 'Following the subject') }}</p>
        <button v-if="reframe.state.status === 'ready'" type="button" class="st-button primary pn-small" :disabled="!reframeOps.length" @click="useReframe">Use the reframed crop</button>
        <p v-if="reframe.state.status === 'failed'" class="pn-error" role="alert">{{ reframe.state.error }}</p>
      </details>

      <details class="pn-group" data-test="hp-beats">
        <summary>Beats of a music clip</summary>
        <p class="pn-note">Finds the beats of the selected clip's sound. Add them as markers, or cut the other selected video clips to them.</p>
        <button type="button" class="st-button pn-small" :disabled="beats.state.status === 'working'" data-test="hp-beats-find" @click="beatsFor = clip.id; beats.start(clip.media, 'beats', {})">Find the beats</button>
        <p v-if="beats.state.status === 'working'" class="pn-note" role="status">{{ progress(beats, 'Finding the beats') }}</p>
        <template v-if="beats.state.status === 'ready'">
          <p class="pn-note" role="status">Found {{ beatTimes.length }} beat{{ beatTimes.length === 1 ? '' : 's' }} in this part of the music.</p>
          <div class="pn-seg">
            <button type="button" :disabled="!beatTimes.length" data-test="hp-beats-markers" @click="addBeatMarkers">Add {{ Math.min(beatTimes.length, markerRoom) }} beat markers</button>
            <button type="button" :disabled="!beatTimes.length || !toCut.length" data-test="hp-beats-cut" @click="cutBeat">Cut {{ toCut.length }} selected clip{{ toCut.length === 1 ? '' : 's' }} to the beat</button>
          </div>
          <p v-if="!toCut.length" class="pn-note">Select the video clips to cut as well (Shift or Ctrl with a click), with the music clip.</p>
        </template>
        <p v-if="beats.state.status === 'failed'" class="pn-error" role="alert">{{ beats.state.error }}</p>
      </details>

      <p v-if="isVideo" class="pn-note">Background removal is under Settings, Effects, with its price shown before it runs.</p>
      <p v-if="error" class="pn-error" role="alert">{{ error }}</p>
    </template>
  </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import * as tl from '../timelineModel'
import * as br from './bridge'
import { cutSourceRangesOps, cutToBeatOps, sourceToTimeline, splitAtSourceOps } from './panelModel'
import { useDerive } from './useDerive'
import './panels.css'

const props = defineProps({ doc: { type: Object, required: true }, clip: { type: Object, default: null }, selection: { type: Array, default: () => [] },
  media: { type: Object, default: () => ({}) } })
const emit = defineEmits(['ops'])
const silences = useDerive(), scenes = useDerive(), steady = useDerive(), reframe = useDerive(), beats = useDerive()
const minPause = ref(0.6), chosen = ref([]), error = ref(''), reframeTo = ref('9:16'), reshape = ref(true), beatsFor = ref('')
const rate = computed(() => props.doc.rate || 30)
const isVideo = computed(() => !!props.clip && props.clip.source_out_ms != null && tl.find(props.doc, props.clip.id)?.track.kind === 'video')
const secs = ms => `${(ms / 1000).toFixed(1)} s`
const at = ms => tl.timecode(ms, rate.value)
const progress = (d, text) => d.state.progress != null ? `${text}… ${Math.round(d.state.progress * 100)}%` : `${text}…`
const inside = r => props.clip && r.end_ms > props.clip.source_in_ms && r.start_ms < props.clip.source_out_ms
// Another clip, another result: a helper's findings belong to the clip they were made for.
watch(() => props.clip?.media, () => { for (const d of [silences, scenes, steady, reframe]) d.reset(); chosen.value = [] })

// The derive result (editor_derive silences): each pause with the part to cut (`cut`, null when it is too short to
// cut after the kept edges) and each filler word; only what can be cut is offered. Times are file times.
const found = computed(() => {
  const r = silences.state.result || {}
  const pauses = (r.silences || []).filter(s => s.cut).map(s => ({ start_ms: s.cut.start_ms, end_ms: s.cut.end_ms }))
  const fillers = (r.fillers || []).map(f => ({ start_ms: f.start_ms, end_ms: f.end_ms, text: f.text }))
  return [...pauses, ...fillers].filter(inside).sort((a, b) => a.start_ms - b.start_ms)
})
watch(found, list => { chosen.value = list.map((_, n) => n) })
function cutChosen() {
  const ranges = chosen.value.map(n => found.value[n])
  const ops = cutSourceRangesOps(props.doc, props.clip.id, ranges, { rate: rate.value })
  if (!ops.length) { error.value = 'Nothing could be cut: the parts are shorter than a frame, or the clip has a speed ramp.'; return }
  error.value = ''
  emit('ops', { ops, label: `${ranges.length} part${ranges.length === 1 ? '' : 's'} cut` })
  silences.reset()
}
// Scene cuts: [{ms, score}] in file time (editor_derive scene_cuts).
const cuts = computed(() => (scenes.state.result?.cuts || []).map(c => c.ms).filter(ms => props.clip && ms > props.clip.source_in_ms && ms < props.clip.source_out_ms))
function splitScenes() {
  const ops = splitAtSourceOps(props.doc, props.clip.id, cuts.value, { rate: rate.value })
  if (ops.length) emit('ops', { ops, label: `Split at ${cuts.value.length} scene cut${cuts.value.length === 1 ? '' : 's'}` })
  scenes.reset()
}
function useSteady() { const ops = tl.setOps(props.doc, props.clip.id, { media: steady.state.result.media }); if (ops.length) emit('ops', { ops, label: 'Steady copy used' }) }

const otherShapes = computed(() => tl.ASPECTS.filter(a => a !== props.doc.canvas.aspect))
watch(otherShapes, list => { if (!list.includes(reframeTo.value)) reframeTo.value = list[0] }, { immediate: true })
// The reframe result (editor_derive reframe): the crop's size {crop: {w, h}} and the subject's path in the file
// ([{t_ms (file time), cx, cy, x, y}], x and y the crop's top left), made into the clip's crop with keyframes on its
// position.
const reframeOps = computed(() => {
  const r = reframe.state.result, c = props.clip
  const w = r?.crop?.w, h = r?.crop?.h
  if (!r || !c || !Array.isArray(r.path) || !w || !h) return []
  const len = tl.clipLength(c, rate.value), speed = c.speed || 1, keysX = [], keysY = []
  for (const p of r.path) {
    const t = br.snap((p.t_ms - c.source_in_ms) / speed, rate.value)
    if (t < 0 || t > len || keysX.some(k => k.t_ms === t)) continue
    const x = Math.min(Math.max(p.x, 0), 1 - w), y = Math.min(Math.max(p.y, 0), 1 - h)
    keysX.push({ t_ms: t, v: Math.round(x * 1000) / 1000, ease: 'linear' }); keysY.push({ t_ms: t, v: Math.round(y * 1000) / 1000, ease: 'linear' })
  }
  const keyframes = { ...(c.keyframes || {}) }
  if (keysX.length) { keyframes['crop.x'] = keysX; keyframes['crop.y'] = keysY }
  const ops = tl.setOps(props.doc, c.id, { crop: { x: keysX[0]?.v ?? (1 - w) / 2, y: keysY[0]?.v ?? (1 - h) / 2, w, h }, fit: 'cover', keyframes })
  return reshape.value ? [...tl.setCanvasOps(props.doc, { aspect: reframeTo.value }), ...ops] : ops
})
function useReframe() { emit('ops', { ops: reframeOps.value, label: `Reframed for ${reframeTo.value}` }) }

const music = computed(() => tl.find(props.doc, beatsFor.value)?.item || null)
const beatTimes = computed(() => {
  const m = music.value
  if (!m || m.source_out_ms == null) return []
  // Beats (editor_derive beats, services/beats.py): `beat_ms`, every beat's file time.
  return (beats.state.result?.beat_ms || []).filter(b => b >= m.source_in_ms && b <= m.source_out_ms).map(b => sourceToTimeline(m, b, rate.value))
})
const markerRoom = computed(() => Math.max(0, br.registry().limits.markers - (props.doc.markers || []).length))
const toCut = computed(() => props.selection.filter(id => id !== beatsFor.value && tl.find(props.doc, id)?.track.kind === 'video' && tl.find(props.doc, id)?.item.type === 'clip'))
function addBeatMarkers() {
  let cur = props.doc
  const ops = []
  for (const t of beatTimes.value.slice(0, markerRoom.value)) { const o = br.markerOps(cur, 'add', { at_ms: t, name: 'Beat', color: '#7FE0A8' }); ops.push(...o); cur = tl.applyOps(cur, o).doc }
  if (ops.length) emit('ops', { ops, label: `${Math.min(beatTimes.value.length, markerRoom.value)} beat markers added` })
}
function cutBeat() {
  const ops = cutToBeatOps(props.doc, toCut.value, beatTimes.value, { rate: rate.value, media: props.media })
  if (!ops.length) { error.value = 'The selected clips already end on beats, or no beat falls inside them.'; return }
  error.value = ''
  emit('ops', { ops, label: 'Cut to the beat' })
}
</script>
<style scoped>
.hp{margin-top:14px;padding-top:12px;border-top:1px solid var(--vm-line-2)}
.hp-h{font-size:13px;font-weight:600;margin:0}
.hp summary{min-height:32px;display:flex;align-items:center;font-size:13px;color:var(--vm-ink);cursor:pointer}
.hp-review{max-height:200px;overflow:auto}
@media (max-width:767px){.hp summary{min-height:44px}}
</style>
