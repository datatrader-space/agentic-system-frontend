<script setup>
// One saved camera's own page (the owner, 2026-11-17, with a reference screenshot): opened from a row of the Video
// sources card, it takes the Cloud Streaming tab's place. Left, the source: its live view through AADML's media relay
// (LiveView.vue, inline) or, for a source the relay does not play, its newest frame; under it, the model that runs on
// it (a stream: "Run a model" starts one; workflows on cameras come later). Right, the results: the newest answers of
// the stream on this camera, as the model's own classes, and its newest frames. AADML's own words throughout.
// Backend: streaming_api.py workspace/video-sources/<id>/ (the source and its streams), workspace/streams/<id>/.
import { computed, onUnmounted, ref, watch } from 'vue';
import {
  ArrowDown, ArrowLeft, ChartLine, Circle, CircleQuestionMark, Disc, Download, ImageOff, LoaderCircle, Maximize, Pencil,
  Play, RefreshCw, Square, Trash2, Tv, Workflow,
} from 'lucide-vue-next';
import LiveView from './LiveView.vue';
import UiBadge from './UiBadge.vue';
import UiButton from './UiButton.vue';
import { modelName, timeAgo } from '../api/workspace.js';
import {
  streamingApi, POLL_MS, isActive, streamState, classNames, countOf, recentBars, clockText, endedText,
  sourceState, sourceKindLabel, sourceShown, isPublic, thumbnailOf, lastFrameText, canWatch,
  videoSources, recordingsApi, dayRange, windowText, sizeText, dayPriceText,
} from '../api/streaming.js';

const props = defineProps({
  source: { type: Object, required: true },
  streams: { type: Array, default: () => [] },       // the source's streams, newest first (its own read)
  streamsLoaded: { type: Boolean, default: false },
  streamsError: { type: String, default: '' },
  may: { type: Object, default: () => ({}) },         // { check, change, remove, stream }
  mayStart: { type: Boolean, default: true },
  startWhy: { type: String, default: '' },
  checking: { type: Boolean, default: false },
  checkError: { type: String, default: '' },
  consent: { type: String, default: '' },
});
const emit = defineEmits(['back', 'check', 'edit', 'remove', 'start', 'stop-stream', 'download', 'open-stream', 'refresh']);

// ── the source: watched live while the page is open, when the relay can play it ──────────────────
const player = ref(null);
const watching = ref(true); const liveState = ref('connecting');
const watchable = computed(() => canWatch(props.source));
const thumbBroken = ref(false);
const thumb = computed(() => (thumbBroken.value ? '' : thumbnailOf(props.source)));
const badge = computed(() => {
  if (watchable.value && watching.value && liveState.value === 'playing') return ['green', 'Live'];
  return sourceState(props.source);
});
function stopWatching() { player.value?.stop?.(); watching.value = false; }
function watchAgain() { watching.value = true; }
function fullscreen() { player.value?.fullscreen?.(); }
const helpOpen = ref(false);

// ── the stream on it: the running one, else the newest; followed while it runs ───────────────────
const current = ref(null);
const chosen = computed(() => props.streams.find(isActive) || props.streams[0] || null);
let timer = null; let gone = false;
async function follow() {
  clearTimeout(timer); timer = null;
  const id = chosen.value?.id;
  if (!id || gone) return;
  try {
    const { stream } = await streamingApi.get(id);
    if (chosen.value?.id === id) current.value = stream;
  } catch { /* the list's copy is shown until the next read */ }
  finally { if (!gone && chosen.value?.id === id && isActive(current.value || chosen.value)) timer = setTimeout(follow, POLL_MS); }
}
watch(() => chosen.value?.id, () => { current.value = chosen.value; follow(); }, { immediate: true });
onUnmounted(() => { gone = true; clearTimeout(timer); });
const stream = computed(() => current.value || chosen.value);
const running = computed(() => !!stream.value && isActive(stream.value));
const last = computed(() => stream.value?.last || null);
const answered = computed(() => !!last.value && !last.value.error);
const names = computed(() => (stream.value ? classNames(stream.value, 12) : []));
const bars = computed(() => recentBars(stream.value?.recent, 56));
const endless = s => !!s?.continuous || !Number(s?.max_frames);
const started = s => timeAgo(s.started_at || s.created_at);
const others = computed(() => props.streams.filter(s => s.id !== stream.value?.id).slice(0, 5));

// ── cloud recording (CLOUD_STREAMING_PLAN.md §9): the switch in the Source card, the Recordings tab ─────────────────
const rec = computed(() => props.source.recording || null);           // null: a public camera seen from elsewhere
const mayRecord = computed(() => !!rec.value && props.may.record !== false && props.may.change !== false);
const recordable = computed(() => watchable.value);                    // rtsp:// cameras only, as live view
const asking = ref(false); const recDays = ref(30); const recConsent = ref(false);
const recBusy = ref(false); const recError = ref(''); const recSaid = ref('');
function askRecording() { recDays.value = rec.value?.days || 30; recConsent.value = false; recError.value = ''; asking.value = true; }
async function setRecording(body) {
  recBusy.value = true; recError.value = '';
  try {
    const answer = await videoSources.recording(props.source.id, body);
    recSaid.value = answer?.said || ''; asking.value = false;
    emit('refresh');
  } catch (e) { recError.value = e.message; }
  finally { recBusy.value = false; }
}
const recLine = computed(() => {
  const r = rec.value;
  if (!r) return '';
  if (r.on && r.unpaid) return 'Recording stopped: a day of keeping it could not be paid. Top up and it goes on within the hour.';
  if (r.on) return `Recording to the cloud. Kept ${r.days} day${r.days === 1 ? '' : 's'}, ${sizeText(r.stored_bytes)} kept now.`;
  return r.stored_bytes ? `Not recording. ${sizeText(r.stored_bytes)} kept until its days are over.` : 'Not recording.';
});

const tab = ref('results');                                            // results | recordings
const today = new Date().toISOString().slice(0, 10);
const recDay = ref(today);
const recRows = ref([]); const recLoading = ref(false); const recListError = ref(''); const mayDelete = ref(false);
const playing = ref(null);
async function loadRecordings() {
  recLoading.value = true; recListError.value = '';
  try {
    const answer = await recordingsApi.list({ source: props.source.id, ...dayRange(recDay.value) });
    recRows.value = answer?.recordings || []; mayDelete.value = !!answer?.may?.delete;
    if (playing.value && !recRows.value.some(r => r.id === playing.value.id)) playing.value = null;
  } catch (e) { recListError.value = e.message; }
  finally { recLoading.value = false; }
}
watch([tab, recDay], () => { if (tab.value === 'recordings') loadRecordings(); });
async function removeRecording(row) {
  try { await recordingsApi.remove(row.id); if (playing.value?.id === row.id) playing.value = null; await loadRecordings(); emit('refresh'); }
  catch (e) { recListError.value = e.message; }
}
</script>

<template>
  <section class="sp" aria-labelledby="sp-title">
    <header class="sp-head">
      <nav class="sp-crumbs" aria-label="Breadcrumb">
        <button type="button" class="sp-back" @click="emit('back')"><ArrowLeft :size="14" aria-hidden="true"/> Deployments</button>
        <span aria-hidden="true">/</span>
        <button type="button" class="sp-back" @click="emit('back')">Cloud Streaming</button>
      </nav>
      <div class="sp-titlebar">
        <div>
          <h2 id="sp-title">{{ source.name }}</h2>
          <p class="sp-kind">{{ sourceKindLabel(source) }}<template v-if="isPublic(source)"> · Public</template><template v-else-if="sourceShown(source)"> · {{ sourceShown(source) }}</template></p>
        </div>
        <div class="sp-acts">
          <UiButton v-if="may.check !== false" :disabled="checking" @click="emit('check')"><LoaderCircle v-if="checking" class="spin" :size="14" aria-hidden="true"/><RefreshCw v-else :size="14" aria-hidden="true"/> Check now</UiButton>
          <UiButton v-if="may.change !== false && !isPublic(source)" @click="emit('edit')"><Pencil :size="14" aria-hidden="true"/> Edit</UiButton>
          <UiButton v-if="may.remove !== false && !isPublic(source)" class="sp-danger" @click="emit('remove')"><Trash2 :size="14" aria-hidden="true"/> Remove</UiButton>
        </div>
      </div>
      <p v-if="checkError" class="field-error" role="alert">{{ checkError }}</p>
    </header>

    <div class="sp-body">
      <div class="sp-left">
        <!-- Source -->
        <section class="sp-card" aria-labelledby="sp-source-h">
          <div class="sp-card-bar">
            <h3 id="sp-source-h" class="sp-card-title">Source
              <button type="button" class="sp-icon" aria-label="About the source" :aria-expanded="helpOpen" aria-controls="sp-source-help" @click="helpOpen = !helpOpen"><CircleQuestionMark :size="15" aria-hidden="true"/></button>
            </h3>
            <div class="sp-card-tools">
              <button v-if="watchable && watching" type="button" class="sp-icon" aria-label="Stop watching" title="Stop watching" @click="stopWatching"><Square :size="14" aria-hidden="true"/></button>
              <button v-if="watchable && watching" type="button" class="sp-icon" aria-label="Full screen" title="Full screen" @click="fullscreen"><Maximize :size="15" aria-hidden="true"/></button>
              <UiBadge :tone="badge[0]">{{ badge[1] }}</UiBadge>
            </div>
          </div>
          <p v-if="helpOpen" id="sp-source-help" class="sp-help">What the camera sees now. AADML connects to it only while someone watches or a stream reads it, and stops when they stop. The sound is off.</p>
          <LiveView v-if="watchable && watching" ref="player" :source="source" inline @state="liveState = $event"/>
          <div v-else class="sp-still">
            <img v-if="thumb" :src="thumb" :alt="`Newest frame from ${source.name}`" referrerpolicy="no-referrer" @error="thumbBroken = true">
            <span v-else class="sp-still-none"><ImageOff :size="22" aria-hidden="true"/><small>No frame yet</small></span>
            <div class="sp-still-foot">
              <small>{{ watchable ? 'Not watching.' : 'Live view plays RTSP cameras; this is its newest frame.' }} {{ lastFrameText(source) }}</small>
              <UiButton v-if="watchable" class="small" @click="watchAgain"><Tv :size="14" aria-hidden="true"/> Watch live</UiButton>
            </div>
          </div>
          <p v-if="source.state_reason" class="sp-reason">{{ source.state_reason }}</p>
          <!-- Cloud recording -->
          <div v-if="rec" class="sp-rec" :class="{ on: rec.on && !rec.unpaid }">
            <p class="sp-rec-line"><Circle v-if="rec.on && !rec.unpaid" class="sp-rec-dot" :size="10" aria-hidden="true"/>{{ recLine }}</p>
            <template v-if="mayRecord && !asking">
              <UiButton v-if="!rec.on" class="small" :disabled="!recordable || recBusy" :title="recordable ? undefined : 'Only rtsp:// and rtsps:// cameras can be recorded.'" @click="askRecording"><Disc :size="14" aria-hidden="true"/> Record to the cloud</UiButton>
              <span v-else class="sp-rec-acts">
                <UiButton class="small" :disabled="recBusy" @click="askRecording">Days kept</UiButton>
                <UiButton class="small" :disabled="recBusy" @click="setRecording({ on: false })"><Square :size="12" aria-hidden="true"/> Stop recording</UiButton>
              </span>
            </template>
            <form v-if="asking" class="sp-rec-form" @submit.prevent="setRecording(rec.on ? { days: recDays } : { on: true, days: recDays, consent: recConsent })">
              <label class="sp-rec-days">Keep recordings
                <select v-model.number="recDays" class="text-input"><option v-for="d in [1, 3, 7, 14, 30]" :key="d" :value="d">{{ d }} day{{ d === 1 ? '' : 's' }}</option></select>
              </label>
              <p class="sp-muted">{{ dayPriceText(rec) }}. Recordings are deleted after the days you choose.</p>
              <label v-if="!rec.on" class="sp-rec-consent"><input v-model="recConsent" type="checkbox"> {{ rec.consent_text }}</label>
              <span class="sp-rec-acts">
                <UiButton type="submit" variant="primary" class="small" :disabled="recBusy || (!rec.on && !recConsent)">{{ rec.on ? 'Save' : 'Turn on' }}</UiButton>
                <UiButton class="small" type="button" :disabled="recBusy" @click="asking = false">Cancel</UiButton>
              </span>
            </form>
            <p v-if="recError" class="field-error" role="alert">{{ recError }}</p>
            <p v-else-if="recSaid" class="sp-muted" role="status">{{ recSaid }}</p>
          </div>
        </section>

        <ArrowDown class="sp-arrow" :size="16" aria-hidden="true"/>

        <!-- Model -->
        <section class="sp-card sp-model" aria-labelledby="sp-model-h">
          <div class="sp-card-bar"><h3 id="sp-model-h" class="sp-card-title">Model</h3>
            <UiBadge v-if="stream" :tone="streamState(stream)[0]"><LoaderCircle v-if="running" class="spin" :size="12" aria-hidden="true"/>{{ streamState(stream)[1] }}</UiBadge>
          </div>
          <div class="sp-model-body">
            <p v-if="streamsError" class="field-error" role="alert">{{ streamsError }}</p>
            <p v-else-if="!streamsLoaded" class="sp-muted">Loading what runs on this camera…</p>
            <template v-else-if="stream">
              <p class="sp-model-name"><strong>{{ modelName(stream.model) }}</strong></p>
              <p class="sp-muted">{{ [stream.project?.name, `${stream.fps} frame${stream.fps === 1 ? '' : 's'} a second`, `started ${started(stream)}`].filter(Boolean).join(' · ') }}</p>
              <p class="sp-muted">{{ endless(stream) ? 'Runs until you stop it.' : `Reads at most ${stream.max_frames} frames.` }}</p>
              <ul v-if="others.length" class="sp-others" aria-label="Earlier streams on this camera">
                <li v-for="s in others" :key="s.id"><span>{{ modelName(s.model) }}, {{ started(s) }}</span><UiBadge :tone="streamState(s)[0]">{{ streamState(s)[1] }}</UiBadge></li>
              </ul>
            </template>
            <p v-else class="sp-empty-text">Choose a model to run on this camera. Its answers appear alongside as it works.</p>
          </div>
          <p v-if="!mayStart && startWhy" class="sp-why">{{ startWhy }}</p>
          <div class="sp-model-foot">
            <UiButton v-if="running && stream.may && stream.may.stop" @click="emit('stop-stream', stream)"><Square :size="13" aria-hidden="true"/> Stop</UiButton>
            <UiButton v-else-if="may.stream !== false" variant="primary" :disabled="!mayStart" :title="mayStart ? undefined : startWhy" @click="emit('start')"><Play :size="14" aria-hidden="true"/> Run a model</UiButton>
            <UiButton disabled title="Workflows on cameras are coming"><Workflow :size="14" aria-hidden="true"/> Build a workflow <UiBadge>Soon</UiBadge></UiButton>
          </div>
        </section>
        <p v-if="consent" class="sp-consent">{{ consent }}</p>
      </div>

      <!-- Results -->
      <section class="sp-card sp-results" aria-labelledby="sp-results-h">
        <div class="sp-card-bar">
          <div class="sp-tabs" role="tablist" aria-label="What this camera gave">
            <button id="sp-results-h" type="button" role="tab" :aria-selected="tab === 'results'" :class="{ on: tab === 'results' }" @click="tab = 'results'">Results</button>
            <button v-if="rec" type="button" role="tab" :aria-selected="tab === 'recordings'" :class="{ on: tab === 'recordings' }" @click="tab = 'recordings'">Recordings</button>
          </div>
          <UiButton v-if="tab === 'results' && stream && stream.has_results" class="small" @click="emit('download', stream)"><Download :size="14" aria-hidden="true"/> Download results</UiButton>
          <label v-if="tab === 'recordings'" class="sp-day">Day (UTC) <input v-model="recDay" type="date" class="text-input" :max="today"></label>
        </div>
        <!-- Recordings -->
        <div v-if="tab === 'recordings'" class="sp-recs">
          <video v-if="playing" :key="playing.id" class="sp-player" :src="playing.play_url" controls autoplay muted playsinline :aria-label="`Recording of ${source.name}, ${windowText(playing)}`"></video>
          <p v-if="recListError" class="field-error" role="alert">{{ recListError }}</p>
          <p v-else-if="recLoading" class="sp-muted" role="status">Loading the recordings…</p>
          <div v-else-if="!recRows.length" class="sp-results-empty" role="status">
            <span class="sp-empty-icon"><Disc :size="20" aria-hidden="true"/></span>
            <h4>No recordings on this day</h4>
            <p>{{ rec && rec.on ? 'Recordings appear here in 5-minute pieces, a few minutes after they are made.' : 'Turn on Record to the cloud to keep this camera\'s video.' }}</p>
          </div>
          <ul v-else class="sp-rec-list">
            <li v-for="r in recRows" :key="r.id" :class="{ playing: playing && playing.id === r.id }">
              <span><strong>{{ windowText(r) }}</strong><small>{{ sizeText(r.bytes) }}</small></span>
              <span class="sp-rec-acts">
                <UiButton class="small" :disabled="!r.play_url" @click="playing = r"><Play :size="13" aria-hidden="true"/> Play</UiButton>
                <a v-if="r.download_url" class="button small" :href="r.download_url" rel="noopener"><Download :size="13" aria-hidden="true"/> Download</a>
                <UiButton v-if="mayDelete" class="small sp-danger" :aria-label="`Delete the recording ${windowText(r)}`" @click="removeRecording(r)"><Trash2 :size="13" aria-hidden="true"/></UiButton>
              </span>
            </li>
          </ul>
        </div>
        <div v-else-if="!stream" class="sp-results-empty" role="status">
          <span class="sp-empty-icon"><ChartLine :size="20" aria-hidden="true"/></span>
          <h4>Results appear here</h4>
          <p>Run a model on this camera to see what it finds in each frame.</p>
        </div>
        <div v-else class="sp-results-body">
          <p class="sp-frame">
            <template v-if="last">Frame {{ last.frame + 1 }} <span class="sp-at">at {{ clockText(last.t) }}</span></template>
            <template v-else-if="stream.state === 'queued'">Waiting for a worker to read the camera</template>
            <template v-else-if="stream.state === 'running'">Placing the model and reading the first frame</template>
            <template v-else>No frame was answered</template>
          </p>
          <p v-if="last && last.error" class="sp-frame-error">This frame got no answer: {{ last.error }}</p>
          <div class="sp-counts" :class="{ waiting: !answered }">
            <div v-for="name in names" :key="name" class="sp-count"><span class="sp-num">{{ answered ? countOf(last, name) : '–' }}</span><span class="sp-what">{{ name }}</span></div>
            <div v-if="!names.length" class="sp-count"><span class="sp-num">{{ answered ? 0 : '–' }}</span><span class="sp-what">found</span></div>
          </div>
          <div v-if="bars.length" class="sp-strip" title="Everything found in each of the newest frames">
            <span v-for="b in bars" :key="b.frame" :class="{ failed: b.failed }" :style="{ height: `${b.h}px` }"></span>
          </div>
          <p class="sp-muted">{{ stream.frames }} frame{{ stream.frames === 1 ? '' : 's' }} read<template v-if="stream.frames_failed">, {{ stream.frames_failed }} without an answer</template><template v-if="!endless(stream)"> of at most {{ stream.max_frames }}</template>.</p>
          <p v-if="!running && endedText(stream)" class="sp-ended" :class="{ failed: stream.state === 'failed' }">{{ endedText(stream) }}</p>
          <button type="button" class="sp-link" @click="emit('open-stream', stream)">Open this stream in the streams list</button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.sp{margin:0 0 12px}
.sp-head{padding:0 0 16px;margin:0 0 18px;border-bottom:1px solid #e3e8ef}
.sp-crumbs{display:flex;align-items:center;gap:6px;color:#64748b;font-size:13px}
.sp-back{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 4px;border:0;background:none;color:#475569;font:inherit;cursor:pointer;border-radius:6px}
.sp-back:hover{color:var(--aadml-primary)}
.sp-back:focus-visible,.sp-icon:focus-visible,.sp-link:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.sp-titlebar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:6px}
.sp-titlebar h2{margin:0;font-size:22px;font-weight:600;color:#17243b}
.sp-kind{margin:4px 0 0;color:#64748b;font-size:14px;overflow-wrap:anywhere}
.sp-acts{display:flex;gap:8px;flex-wrap:wrap}
.sp-danger{color:#b42318}
.sp-body{display:grid;grid-template-columns:minmax(280px,340px) minmax(0,1fr);gap:20px;align-items:stretch}
.sp-left{display:flex;flex-direction:column;align-items:stretch;min-width:0}
.sp-card{min-width:0;border:1px solid #e3e8ef;border-radius:12px;background:#fff;overflow:hidden}
.sp-card-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:52px;padding:8px 14px;border-bottom:1px solid #eef1f5}
.sp-card-title{display:flex;align-items:center;gap:2px;margin:0;font-size:15px;font-weight:600;color:#17243b}
.sp-card-tools{display:flex;align-items:center;gap:4px}
.sp-icon{display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:6px;background:none;color:#64748b;cursor:pointer}
.sp-icon:hover,.sp-icon[aria-expanded="true"]{background:#f1f4f8;color:var(--aadml-primary)}
.sp-help{margin:0;padding:10px 14px;border-bottom:1px solid #eef1f5;background:#f8fafc;font-size:12px;line-height:1.6;color:#33415a}
.sp-still{position:relative;aspect-ratio:16/9;background:#0d1320;display:flex;align-items:center;justify-content:center}
.sp-still img{width:100%;height:100%;object-fit:cover}
.sp-still-none{display:flex;flex-direction:column;align-items:center;gap:6px;color:#9aa6b8}
.sp-still-foot{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:linear-gradient(transparent,#0d1320d9);color:#e6ebf3}
.sp-still-foot small{font-size:12px;line-height:1.4}
.sp-reason{margin:0;padding:8px 14px;font-size:12px;color:#b54708;background:#fffaeb}
.sp-arrow{align-self:center;margin:8px 0;color:#94a3b8}
.sp-model{display:flex;flex-direction:column;flex:1;min-height:300px}
.sp-model-body{flex:1;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:16px}
.sp-model-name{margin:0;font-size:15px;color:#17243b}
.sp-empty-text{margin:0;text-align:center;color:#475569;font-size:14px;line-height:1.6}
.sp-muted{margin:0;color:#64748b;font-size:13px;line-height:1.5}
.sp-others{list-style:none;margin:10px 0 0;padding:10px 0 0;border-top:1px solid #eef1f5;display:grid;gap:6px}
.sp-others li{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:#475569}
.sp-why{margin:0;padding:0 16px 8px;color:#b54708;font-size:12px}
.sp-model-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px;border-top:1px solid #eef1f5}
.sp-consent{margin:10px 2px 0;color:#64748b;font-size:12px;line-height:1.5}
.sp-results{display:flex;flex-direction:column;min-height:560px}
.sp-results-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px;text-align:center}
.sp-results-empty h4{margin:6px 0 0;font-size:15px;color:#17243b}
.sp-results-empty p{margin:0;max-width:320px;color:#64748b;font-size:13px;line-height:1.5}
.sp-empty-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#f1f4f8;color:#64748b}
.sp-results-body{display:flex;flex-direction:column;gap:12px;padding:16px}
.sp-frame{margin:0;font-size:15px;font-weight:600;color:#17243b}
.sp-at{font-weight:400;color:#64748b}
.sp-frame-error{margin:0;color:#b42318;font-size:13px}
.sp-counts{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.sp-counts.waiting{opacity:.6}
.sp-count{display:flex;flex-direction:column;gap:2px;padding:12px;border:1px solid #eef1f5;border-radius:10px;background:#f8fafc}
.sp-num{font-size:26px;font-weight:600;color:#17243b;font-variant-numeric:tabular-nums}
.sp-what{font-size:12px;color:#475569;overflow-wrap:anywhere}
.sp-strip{display:flex;align-items:flex-end;gap:2px;height:56px;padding:6px 0;border-bottom:1px solid #eef1f5}
.sp-strip span{flex:1;min-width:2px;max-width:10px;border-radius:2px 2px 0 0;background:var(--aadml-primary);opacity:.75}
.sp-strip span.failed{background:#f04438}
.sp-ended{margin:0;font-size:13px;color:#475569}
.sp-ended.failed{color:#b42318}
.sp-link{align-self:flex-start;border:0;background:none;padding:0;min-height:32px;color:var(--aadml-primary);text-decoration:underline;font:inherit;font-size:13px;cursor:pointer}
.sp-rec{display:grid;gap:8px;padding:12px 14px;border-top:1px solid #eef1f5}
.sp-rec.on{background:#fef3f2}
.sp-rec-line{display:flex;align-items:center;gap:6px;margin:0;font-size:13px;color:#33415a;line-height:1.5}
.sp-rec-dot{flex-shrink:0;fill:#d92d20;color:#d92d20}
.sp-rec-acts{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sp-rec-form{display:grid;gap:8px}
.sp-rec-days{display:flex;align-items:center;gap:8px;font-size:13px;color:#33415a}
.sp-rec-days select{width:auto;min-height:36px}
.sp-rec-consent{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:1.5;color:#33415a}
.sp-rec-consent input{margin-top:3px}
.sp-tabs{display:flex;gap:4px}
.sp-tabs button{min-height:36px;padding:0 12px;border:0;border-radius:8px;background:none;color:#475569;font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.sp-tabs button.on{background:var(--aadml-soft);color:var(--aadml-primary)}
.sp-tabs button:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.sp-day{display:flex;align-items:center;gap:8px;font-size:13px;color:#475569}
.sp-day input{width:auto;min-height:36px}
.sp-recs{display:flex;flex-direction:column;gap:12px;padding:16px;flex:1}
.sp-player{width:100%;max-height:420px;border-radius:10px;background:#0d1320}
.sp-rec-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.sp-rec-list li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid #eef1f5;border-radius:8px}
.sp-rec-list li.playing{border-color:var(--aadml-primary);background:var(--aadml-tint)}
.sp-rec-list li span:first-child{display:flex;flex-direction:column;gap:2px}
.sp-rec-list small{color:#64748b;font-size:12px}
.spin{animation:sp-spin 1.1s linear infinite}
@keyframes sp-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spin{animation:none}}
@media(max-width:860px){.sp-body{grid-template-columns:1fr}.sp-results{min-height:320px}.sp-model{min-height:0}}
</style>
