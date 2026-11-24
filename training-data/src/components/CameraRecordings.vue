<script setup>
// Cloud Streaming's Recordings (the owner, 2026-11-18: "a recording tab where all recordings will be shown even after
// the video source is removed or disconnected, so we do not lose the recordings"; 2026-11-19: inside Cloud Streaming).
// Every kept recording of the workspace's cameras, newest first, a removed camera's too. Filter by camera and day;
// play, download, and (an Admin) delete one. Nothing is deleted at once (the owner, 2026-11-19): a recording past its
// days or deleted waits 14 days, free, said as "Deleted on <date>" with Cancel deletion, and is deleted for good after.
// Backend: streaming_api.py workspace/recordings/ (``cameras``, ``removed``, ``kept_until``, ``offset``).
// The play and download links are signed for 15 minutes: a list older than 10 asks for new ones before playing, and a
// recording the browser cannot play says so and offers its download instead of spinning.
// VIDEO CARDS (the owner, 2026-11-23: "a video card preview like YouTube"): a grid of cards, each with the recording's
// own picture (one frame of it, ``thumbnail_url``; a plain card while it has none) and its length in the corner.
// Pointing at a card (or focusing it) plays a silent preview of it in the card; clicking the picture plays it above.
// AS IT IS MADE (the owner, 2026-11-24): a recording being made is listed first, marked Recording, its length growing
// (the list asks again every few seconds while a camera records, ``refreshAfter``), and plays what is recorded so far;
// when it ends it is listed as the kept recording.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Disc, Download, FolderInput, Play, RefreshCw, RotateCcw, Trash2 } from 'lucide-vue-next';
import RecordingThumb from './RecordingThumb.vue';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import {
  recordingsApi, dayRange, recordingWhen, keptUntilText, cameraChoices, storageText, sizeText, linksFresh,
  deletionText, deletionWhy, RECORDING_STATES, refreshAfter, canUseRecording,
} from '../api/streaming.js';

// "Use in project" (runbook P5, 2026-11-24: a recording could only be downloaded and uploaded again): opens the New stream
// form on this recording, read in place, for a project's model, a detector, SAM 3 or a workflow. ``mayStart`` is
// Cloud Streaming's own start permission.
const props = defineProps({ mayStart: { type: Boolean, default: false } });
const emit = defineEmits(['start']);
const PAGE = 50;
const rows = ref([]); const live = ref([]); const count = ref(0); const cameras = ref([]); const stored = ref(null); const limit = ref(0);
const mayDelete = ref(false); const loading = ref(false); const error = ref(''); const said = ref('');
const camera = ref(''); const day = ref(''); const state = ref(''); const grace = ref(14); const waiting = ref(0);
const playing = ref(null); const playError = ref(''); const confirming = ref(null); const busy = ref(false);
let loadedAt = 0;
const fresh = () => linksFresh(loadedAt);

const choices = computed(() => cameraChoices(cameras.value));
const usage = computed(() => storageText(stored.value, limit.value));
const more = computed(() => rows.value.length < count.value);
const shown = computed(() => [...live.value, ...rows.value]);
let again = null; let gone = false;
function askAgain(answer) {
  clearTimeout(again); again = null;
  const wait = refreshAfter(answer);
  if (wait && !gone) again = setTimeout(() => load({ quiet: true }), wait);
}
onUnmounted(() => { gone = true; clearTimeout(again); });

async function load({ append = false, quiet = false } = {}) {
  if (!quiet) loading.value = true;
  if (!quiet) error.value = '';
  try {
    const answer = await recordingsApi.list({ source: camera.value, ...dayRange(day.value), state: state.value, limit: PAGE, offset: append ? rows.value.length : 0 });
    const got = answer?.recordings || [];
    if (quiet && rows.value.length > got.length) {          // a later page was shown: keep it, put the newest first
      const ids = new Set(got.map(r => r.id));
      rows.value = [...got, ...rows.value.filter(r => !ids.has(r.id))];
    } else rows.value = append ? [...rows.value, ...got] : got;
    if (!append) live.value = answer?.live || [];
    count.value = Number(answer?.count) || 0; cameras.value = answer?.cameras || [];
    stored.value = answer?.stored_bytes ?? null; limit.value = Number(answer?.limit_bytes) || 0;
    mayDelete.value = !!answer?.may?.delete;
    grace.value = Number(answer?.grace_days) || 14; waiting.value = Number(answer?.scheduled) || 0;
    if (!append) loadedAt = Date.now();
    // One being played stays (a recording being made plays what was recorded when it was opened).
    if (playing.value && !playing.value.live && !rows.value.some(r => r.id === playing.value.id)) playing.value = null;
    if (!append) askAgain(answer);
  } catch (e) { if (!quiet) error.value = e.message; else askAgain({ recording_cameras: 1 }); }
  finally { loading.value = false; }
}
onMounted(load);
watch([camera, day, state], () => { playing.value = null; confirming.value = null; load(); });

// Links older than 10 minutes are asked for again first (they are signed for 15).
async function play(row) {
  playError.value = ''; confirming.value = null;
  if (!linksFresh(loadedAt)) {
    await load();
    row = rows.value.find(r => r.id === row.id) || null;
    if (!row) row = live.value.find(r => r.source.id === playing.value?.source?.id) || null;
    if (!row) { said.value = 'That recording is no longer kept.'; return; }
  }
  playing.value = row;
}
function cannotPlay() {
  playError.value = 'This recording could not be played in this browser. Download it to watch it, or try again.';
}
async function remove(row) {
  if (confirming.value !== row.id) { confirming.value = row.id; return; }
  busy.value = true; said.value = '';
  try {
    const answer = await recordingsApi.remove(row.id);
    said.value = answer?.said || `The recording ${recordingWhen(row)} is scheduled for deletion.`;
    confirming.value = null;
    await load();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
async function restore(row) {
  busy.value = true; said.value = '';
  try {
    const answer = await recordingsApi.restore(row.id);
    said.value = answer?.said || 'The recording is restored.';
    await load();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <section class="recs" :aria-busy="loading">
    <p class="recs-intro">Every recording of your cameras, a removed or offline camera's too. A deleted recording, or one past its days, is kept {{ grace }} more days, free, and can be restored until then.</p>
    <div class="recs-bar">
      <label class="recs-field"><span>Camera</span>
        <select v-model="camera" :disabled="loading && !rows.length">
          <option v-for="c in choices" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
      </label>
      <label class="recs-field"><span>Day (UTC)</span>
        <input v-model="day" type="date" :max="new Date().toISOString().slice(0, 10)">
      </label>
      <UiButton v-if="day" class="small" @click="day = ''">All days</UiButton>
      <label class="recs-field"><span>Show</span>
        <select v-model="state">
          <option v-for="[value, label] in RECORDING_STATES" :key="value" :value="value">{{ label }}<template v-if="value === 'scheduled' && waiting"> ({{ waiting }})</template></option>
        </select>
      </label>
      <span class="recs-spacer"></span>
      <small v-if="usage" class="recs-usage">{{ usage }}</small>
      <UiButton class="small" :disabled="loading" aria-label="Refresh the recordings" @click="load()"><RefreshCw :size="14" aria-hidden="true"/></UiButton>
    </div>

    <div v-if="said" class="recs-said" role="status">{{ said }}</div>
    <div v-if="error" class="recs-error" role="alert"><span>{{ error }}</span><UiButton class="small" :disabled="loading" @click="load()">Try again</UiButton></div>

    <div v-if="playing" class="recs-player">
      <video :key="playing.id + ':' + playing.play_url" :src="playing.play_url" controls autoplay muted playsinline
             :aria-label="`Recording of ${playing.source.name}, ${recordingWhen(playing)}`" @error="cannotPlay"></video>
      <p class="recs-playing"><strong>{{ playing.source.name }}</strong> {{ recordingWhen(playing) }}</p>
      <p v-if="playError" class="recs-error" role="alert"><span>{{ playError }}</span>
        <a v-if="playing.download_url" class="button small" :href="playing.download_url" rel="noopener"><Download :size="13" aria-hidden="true"/> Download</a>
      </p>
    </div>

    <p v-if="loading && !shown.length" class="recs-muted" role="status">Loading the recordings…</p>
    <div v-else-if="!shown.length && !error" class="recs-empty" role="status">
      <span class="recs-empty-icon"><Disc :size="20" aria-hidden="true"/></span>
      <h4>{{ day || camera ? 'No recordings here' : 'No recordings yet' }}</h4>
      <p>Turn on Record to the cloud on a camera in Cloud Streaming. Its recording shows here as it is made, all the time in 5-minute pieces or each burst of motion, and stays when the camera is removed (unless you choose to delete it then).</p>
    </div>
    <ul v-else class="recs-list">
      <li v-for="r in shown" :key="r.id" :class="{ playing: playing && playing.id === r.id, waiting: !!r.deletion, live: r.live }"
          :data-test="`rec-card-${r.id}`">
        <RecordingThumb :recording="r" :fresh="fresh" :label="`Play the recording of ${r.source.name}, ${recordingWhen(r)}`" @play="play(r)"/>
        <span class="recs-what">
          <strong>{{ r.source.name }} <UiBadge v-if="r.motion">Motion</UiBadge> <UiBadge v-if="r.source.removed">Removed</UiBadge> <UiBadge v-if="r.deletion" tone="red">{{ deletionText(r.deletion) }}</UiBadge></strong>
          <span>{{ recordingWhen(r) }}</span>
          <small v-if="r.live">Being recorded: it is kept when it ends</small>
          <small v-else>{{ sizeText(r.bytes) }}<template v-if="r.deletion"> · {{ deletionWhy(r.deletion) }}</template><template v-else-if="keptUntilText(r.kept_until)"> · {{ keptUntilText(r.kept_until) }}</template></small>
        </span>
        <span class="recs-acts">
          <UiButton class="small" :disabled="!r.play_url" @click="play(r)"><Play :size="13" aria-hidden="true"/> Play</UiButton>
          <a v-if="r.download_url" class="button small" :href="r.download_url" rel="noopener"><Download :size="13" aria-hidden="true"/> Download</a>
          <UiButton v-if="canUseRecording(r, props.mayStart)" class="small" :aria-label="`Use the recording of ${r.source.name}, ${recordingWhen(r)}, in a project`" title="Run a project's model or a workflow over this recording" @click="emit('start', r)"><FolderInput :size="13" aria-hidden="true"/> Use in project</UiButton>
          <UiButton v-if="mayDelete && r.deletion" class="small recs-restore" :disabled="busy" :aria-label="`Cancel the deletion of ${recordingWhen(r)}`" @click="restore(r)"><RotateCcw :size="13" aria-hidden="true"/> Cancel deletion</UiButton>
          <UiButton v-if="mayDelete && !r.deletion && !r.live" class="small recs-danger" :disabled="busy" :aria-label="confirming === r.id ? `Confirm: delete the recording ${recordingWhen(r)}` : `Delete the recording ${recordingWhen(r)}`" @click="remove(r)">
            <Trash2 :size="13" aria-hidden="true"/><template v-if="confirming === r.id"> Delete? Kept {{ grace }} days first</template>
          </UiButton>
        </span>
      </li>
    </ul>
    <div v-if="more" class="recs-more"><UiButton :disabled="loading" @click="load({ append: true })">Show more ({{ count - rows.length }} left)</UiButton></div>
  </section>
</template>

<style scoped>
.recs{display:flex;flex-direction:column;gap:14px}
.recs-intro{margin:0;color:#4c5d74;font-size:14px;max-width:760px}
.recs-list li.waiting{background:#fffaf9;border-style:dashed}
.recs-restore{color:#05603a}
.recs-bar{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px}
.recs-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#4c5d74}
.recs-field select,.recs-field input{min-height:36px;padding:6px 10px;border:1px solid #d4d9e3;border-radius:8px;background:#fff;color:#162139;font:inherit;font-size:14px;max-width:min(360px,calc(100vw - 32px))}
.recs-spacer{flex:1}
.recs-usage{color:#4c5d74;font-size:13px}
.recs-said{padding:10px 12px;border-radius:10px;background:#ecfdf3;color:#05603a;font-size:14px}
.recs-error{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0;padding:10px 12px;border-radius:10px;background:#fff5f6;color:#a12c3c;font-size:14px}
.recs-player{display:flex;flex-direction:column;gap:6px}
.recs-player video{width:100%;max-height:60vh;border-radius:12px;background:#0d1320}
.recs-playing{margin:0;font-size:14px;color:#33415a}
.recs-muted{color:#4c5d74;font-size:14px}
.recs-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:36px 16px;border:1px dashed #d4d9e3;border-radius:12px}
.recs-empty h4{margin:4px 0 0;font-size:16px}
.recs-empty p{margin:0;max-width:520px;color:#4c5d74;font-size:14px}
.recs-empty-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#f1f4f8;color:#4c5d74}
.recs-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.recs-list li{display:flex;flex-direction:column;gap:10px;padding:0 0 12px;border:1px solid #e5e6ed;border-radius:12px;background:#fff;overflow:hidden;min-width:0}
.recs-list li.playing{border-color:var(--aadml-primary);background:var(--aadml-tint)}
.recs-list li > .recs-what,.recs-list li > .recs-acts{padding:0 12px}
.recs-what{display:flex;flex-direction:column;gap:2px;min-width:0}
.recs-what strong{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;font-size:14px;color:#162139}
.recs-what span{font-size:14px;color:#33415a}
.recs-what small{font-size:12px;color:#4c5d74}
.recs-acts{display:flex;flex-wrap:wrap;gap:6px}
.recs-danger{color:#a12c3c}
.recs-more{display:flex;justify-content:center}
</style>
