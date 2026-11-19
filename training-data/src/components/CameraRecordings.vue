<script setup>
// The Deployments page's Recordings tab (the owner, 2026-11-18: "a recording tab where all recordings will be shown
// even after the video source is removed or disconnected, so we do not lose the recordings"). Every kept recording of
// the workspace's cameras, newest first, a removed camera's too, until its days are over (the nightly clean-up; a
// camera removed with "keep" keeps them). Filter by camera and day; play, download, and (an Admin) delete one.
// Backend: streaming_api.py workspace/recordings/ (``cameras``, ``removed``, ``kept_until``, ``offset``).
// The play and download links are signed for 15 minutes: a list older than 10 asks for new ones before playing, and a
// recording the browser cannot play says so and offers its download instead of spinning.
import { computed, onMounted, ref, watch } from 'vue';
import { Disc, Download, Film, Play, RefreshCw, Trash2 } from 'lucide-vue-next';
import DeploymentHeader from './DeploymentHeader.vue';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import {
  recordingsApi, dayRange, recordingWhen, keptUntilText, cameraChoices, storageText, sizeText, linksFresh,
} from '../api/streaming.js';

const PAGE = 50;
const rows = ref([]); const count = ref(0); const cameras = ref([]); const stored = ref(null); const limit = ref(0);
const mayDelete = ref(false); const loading = ref(false); const error = ref(''); const said = ref('');
const camera = ref(''); const day = ref('');
const playing = ref(null); const playError = ref(''); const confirming = ref(null); const busy = ref(false);
let loadedAt = 0;

const choices = computed(() => cameraChoices(cameras.value));
const usage = computed(() => storageText(stored.value, limit.value));
const more = computed(() => rows.value.length < count.value);

async function load({ append = false } = {}) {
  loading.value = true; error.value = '';
  try {
    const answer = await recordingsApi.list({ source: camera.value, ...dayRange(day.value), limit: PAGE, offset: append ? rows.value.length : 0 });
    const got = answer?.recordings || [];
    rows.value = append ? [...rows.value, ...got] : got;
    count.value = Number(answer?.count) || 0; cameras.value = answer?.cameras || [];
    stored.value = answer?.stored_bytes ?? null; limit.value = Number(answer?.limit_bytes) || 0;
    mayDelete.value = !!answer?.may?.delete;
    if (!append) loadedAt = Date.now();
    if (playing.value && !rows.value.some(r => r.id === playing.value.id)) playing.value = null;
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}
onMounted(load);
watch([camera, day], () => { playing.value = null; confirming.value = null; load(); });

// Links older than 10 minutes are asked for again first (they are signed for 15).
async function play(row) {
  playError.value = ''; confirming.value = null;
  if (!linksFresh(loadedAt)) {
    await load();
    row = rows.value.find(r => r.id === row.id) || null;
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
    await recordingsApi.remove(row.id);
    if (playing.value?.id === row.id) playing.value = null;
    said.value = `The recording ${recordingWhen(row)} is deleted.`;
    confirming.value = null;
    await load();
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <section class="recs" role="tabpanel" aria-labelledby="recs-heading" :aria-busy="loading">
    <DeploymentHeader title="Recordings" heading-id="recs-heading" eyebrow="KEPT VIDEO" :icon="Film"
                      description="Every recording of your cameras, a removed or offline camera's too, kept until its days are over."/>
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

    <p v-if="loading && !rows.length" class="recs-muted" role="status">Loading the recordings…</p>
    <div v-else-if="!rows.length && !error" class="recs-empty" role="status">
      <span class="recs-empty-icon"><Disc :size="20" aria-hidden="true"/></span>
      <h4>{{ day || camera ? 'No recordings here' : 'No recordings yet' }}</h4>
      <p>Turn on Record to the cloud on a camera in Cloud Streaming. Its video is kept here in 5-minute pieces, a few minutes after it is made, and stays when the camera is removed (unless you choose to delete it then).</p>
    </div>
    <ul v-else class="recs-list">
      <li v-for="r in rows" :key="r.id" :class="{ playing: playing && playing.id === r.id }">
        <span class="recs-what">
          <strong>{{ r.source.name }} <UiBadge v-if="r.source.removed">Removed</UiBadge></strong>
          <span>{{ recordingWhen(r) }}</span>
          <small>{{ sizeText(r.bytes) }}<template v-if="keptUntilText(r.kept_until)"> · {{ keptUntilText(r.kept_until) }}</template></small>
        </span>
        <span class="recs-acts">
          <UiButton class="small" :disabled="!r.play_url" @click="play(r)"><Play :size="13" aria-hidden="true"/> Play</UiButton>
          <a v-if="r.download_url" class="button small" :href="r.download_url" rel="noopener"><Download :size="13" aria-hidden="true"/> Download</a>
          <UiButton v-if="mayDelete" class="small recs-danger" :disabled="busy" :aria-label="confirming === r.id ? `Confirm: delete the recording ${recordingWhen(r)}` : `Delete the recording ${recordingWhen(r)}`" @click="remove(r)">
            <Trash2 :size="13" aria-hidden="true"/><template v-if="confirming === r.id"> Delete?</template>
          </UiButton>
        </span>
      </li>
    </ul>
    <div v-if="more" class="recs-more"><UiButton :disabled="loading" @click="load({ append: true })">Show more ({{ count - rows.length }} left)</UiButton></div>
  </section>
</template>

<style scoped>
.recs{display:flex;flex-direction:column;gap:14px}
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
.recs-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.recs-list li{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border:1px solid #e5e6ed;border-radius:12px;background:#fff}
.recs-list li.playing{border-color:var(--aadml-primary);background:var(--aadml-tint)}
.recs-what{display:flex;flex-direction:column;gap:2px;min-width:0}
.recs-what strong{display:flex;align-items:center;gap:8px;font-size:14px;color:#162139;overflow-wrap:anywhere}
.recs-what span{font-size:14px;color:#33415a}
.recs-what small{font-size:12px;color:#4c5d74}
.recs-acts{display:flex;flex-wrap:wrap;gap:6px}
.recs-danger{color:#a12c3c}
.recs-more{display:flex;justify-content:center}
</style>
