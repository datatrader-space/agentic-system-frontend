<template>
  <!-- Captions (VIDEO_EDITOR_PRO_PLAN.md F27, F37; contract section 1 "Caption items"): made from speech on a paid
       model (its estimate waits on its card for Generate), each word timed so the spoken word can be highlighted;
       a style for every caption (none, word highlight, karaoke, box) and its highlight colour; long captions split by
       length; all captions edited as text; SRT and VTT in and out; and editing the video by striking words in the
       transcript. -->
  <section class="cc pn" aria-label="Captions" data-test="captions">
    <h3 class="cc-h">Captions</h3>

    <fieldset v-if="clip" class="pn-group"><legend>From speech in the selected clip</legend>
      <template v-if="!jobId">
        <MediaRoutePicker v-model="routeId" operation="transcribe" label="Transcription model" />
        <button type="button" class="st-button pn-small" :disabled="!routeId || busy" data-test="cc-estimate" @click="ask">{{ busy ? 'Asking for the estimate…' : 'Review transcription estimate' }}</button>
      </template>
      <template v-else>
        <VideoJobCard v-if="job" :job="job" in-studio />
        <template v-if="job?.state === 'ready'">
          <label class="st-field">Longest caption (letters)<input v-model.number="maxChars" class="st-input" type="number" min="8" max="120" step="1" data-test="cc-max" /></label>
          <button type="button" class="st-button primary pn-small" :disabled="busy" data-test="cc-place" @click="place">Put the captions on the timeline</button>
          <button type="button" class="st-button pn-small" :disabled="busy" :aria-expanded="editing ? 'true' : 'false'" data-test="cc-transcript" @click="openTranscript">Edit the video by its transcript</button>
        </template>
        <button type="button" class="st-button pn-small" @click="reset">{{ job?.state === 'ready' ? 'Done' : 'Choose another model' }}</button>
      </template>
    </fieldset>

    <fieldset v-if="editing" class="pn-group" data-test="cc-words"><legend>Edit by transcript</legend>
      <p class="pn-note">Press a word to strike it; struck words are cut from the clip and the gap closes. Press it again to keep it.</p>
      <p class="cc-words">
        <button v-for="(w, n) in words" :key="n" type="button" class="cc-word" :aria-pressed="struck.has(n) ? 'true' : 'false'" @click="strike(n)">{{ w.text }}</button>
      </p>
      <div class="pn-icons"><IconButton :icon="Scissors" :label="`Cut ${struck.size} struck word${struck.size === 1 ? '' : 's'}`" :disabled="!struck.size" data-test="cc-cut" @click="cutStruck" />
        <span class="pn-note">{{ struck.size }} struck</span></div>
      <p class="pn-note">Captions already on the timeline do not move; make them again after cutting.</p>
    </fieldset>

    <template v-if="captions.length">
      <fieldset class="pn-group" data-test="cc-style"><legend>Style of every caption</legend>
        <div class="pn-seg" role="group" aria-label="Caption style">
          <button v-for="m in MODES" :key="m.id" type="button" :aria-pressed="mode === m.id ? 'true' : 'false'" :data-test="`cc-mode-${m.id}`" @click="setStyle({ mode: m.id })">{{ m.label }}</button>
        </div>
        <label v-if="mode !== 'none'" class="st-field">Highlight colour<input class="pn-color" type="color" :value="highlight" data-test="cc-highlight" @change="setStyle({ highlight_color: $event.target.value.toUpperCase() })" /></label>
        <p v-if="mode !== 'none' && !timed" class="pn-note">These captions have no word times, so words are highlighted at an even pace.</p>
      </fieldset>

      <fieldset class="pn-group"><legend>Split long captions</legend>
        <label class="st-field">Longest caption (letters)<input v-model.number="maxChars" class="st-input" type="number" min="8" max="120" step="1" /></label>
        <div class="pn-icons"><IconButton :icon="Scissors" :label="`Split ${tooLong} long caption${tooLong === 1 ? '' : 's'}`" :disabled="!tooLong" data-test="cc-split" @click="splitLong" />
          <span class="pn-note">{{ tooLong }} longer than that</span></div>
      </fieldset>

      <fieldset class="pn-group"><legend>Edit as text</legend>
        <label class="st-field">One caption a line<textarea v-model="asText" class="st-input cc-text" rows="6" data-test="cc-text" /></label>
        <div class="pn-icons"><IconButton :icon="Check" label="Use this text for the captions" :disabled="asText === joined" data-test="cc-apply" @click="applyText" /></div>
      </fieldset>
    </template>

    <fieldset class="pn-group"><legend>Caption files</legend>
      <div class="pn-seg">
        <IconButton :icon="FileUp" label="Import an SRT or VTT file" data-test="cc-import" @click="fileEl.click()" />
        <button type="button" :disabled="!captions.length" data-test="cc-srt" @click="download('srt')">Download SRT</button>
        <button type="button" :disabled="!captions.length" data-test="cc-vtt" @click="download('vtt')">Download VTT</button>
      </div>
      <input ref="fileEl" class="st-sr" type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" aria-label="Import a caption file" @change="importFile($event.target.files[0]); $event.target.value = ''" />
    </fieldset>
    <p v-if="error" class="pn-error" role="alert">{{ error }}</p>
    <p v-else-if="note" class="pn-note" role="status">{{ note }}</p>
  </section>
</template>
<script setup>
import { Check, FileUp, Scissors } from 'lucide-vue-next'
import IconButton from './panels/IconButton.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import api from '../../services/api'
import { useVideoStore } from '../../stores/useVideoStore'
import * as tl from './timelineModel'
import { cutSourceRangesOps } from './panels/panelModel'
import { onGrid, parseSubtitles, splitByLength, spreadWords, toSrt, toVtt } from './panels/subtitles'
import MediaRoutePicker from '../studio/MediaRoutePicker.vue'
import VideoJobCard from '../video/VideoJobCard.vue'
import './panels/panels.css'

const props = defineProps({ projectId: { type: String, required: true }, doc: { type: Object, required: true }, clip: { type: Object, default: null }, rate: { type: Number, default: 30 } })
const emit = defineEmits(['captions', 'ops'])
const MODES = [{ id: 'none', label: 'Plain' }, { id: 'word', label: 'Word highlight' }, { id: 'karaoke', label: 'Karaoke' }, { id: 'box', label: 'Box on the word' }]
const video = useVideoStore()
const routeId = ref(''), jobId = ref(''), busy = ref(false), error = ref(''), note = ref(''), maxChars = ref(32)
const job = computed(() => jobId.value ? video.jobs[jobId.value] : null)
const fileEl = ref(null)
let timer = null
function reset() { clearInterval(timer); jobId.value = ''; error.value = ''; editing.value = false }
watch(() => props.clip?.media, reset)
onBeforeUnmount(() => clearInterval(timer))

const track = computed(() => props.doc.tracks.find(t => t.kind === 'text' && t.captions) || null)
const captions = computed(() => track.value ? tl.ordered(track.value) : [])
const style = computed(() => captions.value[0]?.caption_style || {})
const mode = computed(() => style.value.mode || 'none')
const highlight = computed(() => style.value.highlight_color || '#F2B341')
const timed = computed(() => captions.value.some(c => c.words?.length))
const tooLong = computed(() => captions.value.filter(c => c.text.length > maxChars.value).length)
const joined = computed(() => captions.value.map(c => c.text.replace(/\s*\n\s*/g, ' ')).join('\n'))
const asText = ref('')
watch(joined, v => { asText.value = v }, { immediate: true })

async function ask() {
  busy.value = true; error.value = ''
  try {
    const { data } = await api.post('/video/shorts/transcribe/', { attachment_id: props.clip.media, route_id: routeId.value, project_id: props.projectId })
    video._put(data); jobId.value = data.job_id
    timer = setInterval(async () => { await video.refreshJob(jobId.value); if (['ready', 'failed', 'cancelled'].includes(job.value?.state)) clearInterval(timer) }, 4000)
  } catch (e) { error.value = e?.response?.data?.error?.message || 'The estimate could not be made.' }
  finally { busy.value = false }
}
// The transcript's words inside the clip's part of its file (times relative to its in point, as the server gives them).
async function readCues() {
  const c = props.clip
  const { data } = await api.get('/video/editor/captions/', { params: { transcript_job_id: jobId.value, start_ms: c.source_in_ms, end_ms: c.source_out_ms } })
  const cues = data.cues || []
  const words = Array.isArray(data.words) ? data.words : cues.flatMap(q => q.words || [])
  return { cues, words }
}
const onTimeline = ms => Math.round(props.clip.start_ms + ms / (props.clip.speed || 1))
// Each caption a few words long, timed to the speech; with word times each word is kept for the highlight.
async function place() {
  busy.value = true; error.value = ''; note.value = ''
  try {
    const { cues } = await readCues()
    const items = cues.flatMap(q => splitByLength({
      text: q.text, start_ms: onTimeline(q.start_ms), end_ms: onTimeline(q.end_ms),
      ...(q.words?.length ? { words: q.words.map(w => ({ text: w.text, start_ms: onTimeline(w.start_ms), end_ms: onTimeline(w.end_ms) })) } : {}),
    }, maxChars.value)).filter(q => q.end_ms - q.start_ms >= tl.MIN_ITEM_MS)
    if (!items.length) error.value = 'No speech was found in this part of the clip.'
    else emit('captions', items.map(q => ({ ...q, ...(style.value.mode ? { caption_style: { ...style.value } } : {}) })))
  } catch (e) { error.value = e?.response?.data?.error?.message || 'The captions could not be read.' }
  finally { busy.value = false }
}

// ── edit by transcript ─────────────────────────────────────────────────────────────────────────────────────────
const editing = ref(false), words = ref([]), struck = ref(new Set())
async function openTranscript() {
  if (editing.value) { editing.value = false; return }
  busy.value = true; error.value = ''
  try {
    const { words: list } = await readCues()
    if (!list.length) { error.value = 'This transcript has no word times, so it cannot cut the video.'; return }
    words.value = list; struck.value = new Set(); editing.value = true
  } catch (e) { error.value = e?.response?.data?.error?.message || 'The transcript could not be read.' }
  finally { busy.value = false }
}
function strike(n) { const s = new Set(struck.value); s.has(n) ? s.delete(n) : s.add(n); struck.value = s }
// Struck words in a row are cut as one part, the pause between them included.
function cutStruck() {
  const inMs = props.clip.source_in_ms, ranges = []
  ;[...struck.value].sort((a, b) => a - b).forEach(n => {
    const w = words.value[n], next = words.value[n + 1]
    const end = struck.value.has(n + 1) && next ? next.start_ms : w.end_ms
    ranges.push({ start_ms: inMs + w.start_ms, end_ms: inMs + end })
  })
  const ops = cutSourceRangesOps(props.doc, props.clip.id, ranges, { rate: props.rate })
  if (!ops.length) { error.value = 'Nothing could be cut there: the struck words are shorter than a frame, or the clip has a speed ramp.'; return }
  emit('ops', { ops, label: `${struck.value.size} word${struck.value.size === 1 ? '' : 's'} cut` })
  editing.value = false
}

// ── every caption on the captions track ──────────────────────────────────────────────────────────────────────────
function setTrackItems(items, label) {
  const ti = tl.trackOf(props.doc, track.value.id)
  emit('ops', { ops: [{ op: 'set', path: ['tracks', ti, 'items'], value: items }], label })
}
function setStyle(change) {
  const next = { ...style.value, ...change }
  if (next.mode === 'none') delete next.highlight_color
  const ops = captions.value.flatMap(c => tl.setOps(props.doc, c.id, { caption_style: next.mode === 'none' && !next.highlight_color ? undefined : next }))
  if (ops.length) emit('ops', { ops, label: 'Caption style changed' })
}
function splitLong() {
  const used = new Set(props.doc.tracks.flatMap(t => [t.id, ...t.items.map(i => i.id)]))
  const fresh = () => { let n = 1; while (used.has(`q${n}`)) n++; used.add(`q${n}`); return `q${n}` }
  const items = track.value.items.flatMap(i => {
    if (i.type !== 'text' || i.text.length <= maxChars.value) return [i]
    // Each piece on the frame grid (word times are not; the pieces' edges are).
    return splitByLength(i, maxChars.value).map((c, n) => onGrid({ ...i, ...c, id: n === 0 ? i.id : fresh(), style: { ...i.style } }, props.doc.rate))
  })
  setTrackItems(items, 'Long captions split')
}
function applyText() {
  const lines = asText.value.split('\n').map(l => l.trim())
  if (lines.length !== captions.value.length) { error.value = `Keep one line for each caption: there are ${captions.value.length}, and the text has ${lines.length} lines.`; return }
  if (lines.some(l => !l)) { error.value = 'A caption cannot be empty. Delete it on the timeline to remove it.'; return }
  error.value = ''
  const ops = captions.value.flatMap((c, n) => lines[n] === c.text ? [] : tl.setOps(props.doc, c.id, { text: lines[n].slice(0, 500), ...(c.words ? { words: spreadWords(lines[n], c.start_ms, tl.itemEnd(c, props.doc.rate)) } : {}) }))
  if (ops.length) emit('ops', { ops, label: 'Captions edited' })
}
async function importFile(file) {
  if (!file) return
  error.value = ''; note.value = ''
  const cues = parseSubtitles(await file.text())
  if (!cues.length) { error.value = 'No captions were found in that file. Choose an SRT or VTT file.'; return }
  emit('captions', cues)
  note.value = `${cues.length} caption${cues.length === 1 ? '' : 's'} read from ${file.name}.`
}
function download(kind) {
  const cues = captions.value.map(c => ({ start_ms: c.start_ms, end_ms: tl.itemEnd(c, props.doc.rate), text: c.text }))
  const blob = new Blob([kind === 'srt' ? toSrt(cues) : toVtt(cues)], { type: kind === 'srt' ? 'application/x-subrip' : 'text/vtt' })
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = `captions.${kind}`; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>
<style scoped>
.cc{margin-top:14px;padding-top:12px;border-top:1px solid var(--vm-line-2)}
.cc-h{font-size:13px;font-weight:600;margin:0}
.cc-text{font-size:13px;line-height:1.5}
.cc-words{display:flex;flex-wrap:wrap;gap:4px;margin:0;max-height:220px;overflow:auto}
.cc-word{min-height:28px;padding:2px 6px;border:1px solid var(--vm-line-2);border-radius:4px;background:var(--vm-bg);color:var(--vm-ink);font:13px/1.4 var(--vm-font-sans);cursor:pointer}
.cc-word[aria-pressed="true"]{text-decoration:line-through;color:var(--vm-ink-faint);border-color:var(--vs-bad-ink);background:var(--vs-bad-bg)}
@media (max-width:767px){.cc-word{min-height:44px;padding:4px 10px}}
</style>
