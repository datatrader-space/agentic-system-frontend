<script setup>
// The Deployments page's Cloud Streaming tab: a project's photo model answers the frames of a video, an uploaded file
// or a stream address, sampled 1 or 2 a second; the answers show live and are kept in a results file.
// Backend: streaming_api.py workspace/streams/ (list, start), workspace/streams/<id>/ (one), …/stop/, …/results/.
// It opens when per-call charging is connected; until then the backend lets platform staff only start one, capped.
import { computed, onUnmounted, ref, watch } from 'vue';
import {
  Check, Clock, Download, FileVideo, LoaderCircle, Plus, Radio, RefreshCw, Square, Upload, Video, X,
} from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { modelName, timeAgo } from '../api/workspace.js';
import {
  streamingApi, downloadResults, POLL_MS, addressProblem, addressShown, fileProblem, megabytes, streamState, isActive,
  anyActive, clockText, progressOf, capText, countsSaid, endedText, recentBars,
} from '../api/streaming.js';

// ── the list ─────────────────────────────────────────────────────────────────────────────────────
const page = ref(null); const error = ref(''); const loading = ref(false);
const said = ref(''); const announce = ref('');
const streams = computed(() => page.value?.streams || []);
const options = computed(() => page.value?.options || { projects: [], fps: [1, 2], default_fps: 1, cap: null, upload: {} });
const isOpen = computed(() => page.value?.open !== false);
const may = computed(() => page.value?.may || {});
let gone = false; let listTimer = null; let viewTimer = null;

function noteChanges(before, after) {
  const was = new Map((before || []).map(s => [s.id, s.state]));
  const changed = (after || []).filter(s => was.has(s.id) && was.get(s.id) !== s.state);
  if (changed.length) announce.value = changed.map(s => `The stream of ${modelName(s.model)} is ${streamState(s)[1].toLowerCase()}.`).join(' ');
}
function takePage(body) {
  if (!body) return;
  noteChanges(page.value?.streams, body.streams);
  page.value = body;
}
async function load() {
  if (loading.value) return;
  loading.value = true;
  try { takePage(await streamingApi.list()); error.value = ''; }
  catch (e) { error.value = e.message; }
  finally { loading.value = false; scheduleList(); }
}
// The list is read again every 5 seconds while one of its streams runs and no stream is open (the open one is
// read every 2 seconds on its own).
function scheduleList() {
  clearTimeout(listTimer); listTimer = null;
  if (!gone && !viewing.value && anyActive(streams.value)) listTimer = setTimeout(load, 5000);
}
load();

// ── one stream, open ─────────────────────────────────────────────────────────────────────────────
const viewing = ref(null); const viewError = ref(''); const spoken = ref('');
let polls = 0;
const live = computed(() => viewing.value && isActive(viewing.value));
const last = computed(() => viewing.value?.last || null);
const counts = computed(() => last.value?.counts || null);
const bars = computed(() => recentBars(viewing.value?.recent, 40));
function mergeRow(row) {
  if (!page.value || !row) return;
  page.value = { ...page.value, streams: page.value.streams.map(s => (s.id === row.id ? { ...s, ...row } : s)) };
}
function speak(row, force = false) {
  // The counts are read out when the stream starts answering, every 5th read (10 seconds) while it runs, and when it ends.
  if (force || polls % 5 === 1 || !isActive(row)) spoken.value = isActive(row) ? countsSaid(row.last) : `${streamState(row)[1]}. ${endedText(row)}`;
}
async function readView() {
  clearTimeout(viewTimer); viewTimer = null;
  const id = viewing.value?.id;
  if (!id || gone) return;
  try {
    const { stream } = await streamingApi.get(id);
    if (viewing.value?.id !== id) return;
    const wasActive = isActive(viewing.value);
    viewing.value = stream; viewError.value = ''; polls += 1;
    mergeRow(stream);
    speak(stream, wasActive && !isActive(stream));
    if (wasActive && !isActive(stream)) load();
  } catch (e) { viewError.value = e.message; }
  finally { if (!gone && viewing.value?.id === id && isActive(viewing.value)) viewTimer = setTimeout(readView, POLL_MS); }
}
function openStream(row) {
  viewing.value = row; viewError.value = ''; polls = 0; spoken.value = '';
  clearTimeout(listTimer);
  readView();
  setTimeout(() => document.getElementById('st-view')?.focus(), 0);
}
function closeStream() { clearTimeout(viewTimer); viewing.value = null; scheduleList(); }

// ── "New stream" ─────────────────────────────────────────────────────────────────────────────────
const creating = ref(false); const starting = ref(false);
const form = ref({ project: '', model: '', source: 'file', address: '', fps: 1 });
const file = ref(null); const fileInput = ref(null);
const fieldErrors = ref({}); const formError = ref(''); const addressTouched = ref(false);
const chosenProject = computed(() => options.value.projects.find(p => p.ref === form.value.project) || null);
const models = computed(() => chosenProject.value?.models || []);
const uploadLimit = computed(() => options.value.upload?.bytes || 200 * 1024 * 1024);
const cap = computed(() => capText(options.value.cap, form.value.fps));
const sourceProblem = computed(() => (form.value.source === 'file'
  ? fileProblem(file.value, { bytes: uploadLimit.value, extensions: options.value.upload?.extensions })
  : addressProblem(form.value.address)));
const startWhy = computed(() => {
  if (!may.value.start) return may.value.reason || (options.value.projects.length ? 'You may not start a stream.' : 'You need the Train right in a photo project to start a stream.');
  if (!models.value.length) return 'Choose a project with a trained model.';
  return '';
});
watch(() => form.value.project, () => {
  if (!models.value.some(m => String(m.number) === String(form.value.model))) form.value.model = models.value[0] ? String(models.value[0].number) : '';
});
function openCreate() {
  const first = options.value.projects.find(p => p.models.length) || options.value.projects[0];
  form.value = { project: first?.ref || '', model: first?.models[0] ? String(first.models[0].number) : '', source: 'file', address: '', fps: options.value.default_fps || 1 };
  file.value = null; fieldErrors.value = {}; formError.value = ''; addressTouched.value = false; said.value = '';
  creating.value = true;
}
function pickFile(event) {
  file.value = event.target.files?.[0] || null;
  fieldErrors.value = { ...fieldErrors.value, file: file.value ? fileProblem(file.value, { bytes: uploadLimit.value }) : '' };
}
function clearFile() { file.value = null; if (fileInput.value) fileInput.value.value = ''; fieldErrors.value = { ...fieldErrors.value, file: '' }; }
function checkAddress() {
  addressTouched.value = true;
  fieldErrors.value = { ...fieldErrors.value, address: addressProblem(form.value.address) };
}
async function startStream() {
  formError.value = '';
  if (form.value.source === 'address') checkAddress();
  else fieldErrors.value = { ...fieldErrors.value, file: fileProblem(file.value, { bytes: uploadLimit.value }) };
  if (sourceProblem.value || startWhy.value || starting.value) return;
  starting.value = true;
  try {
    const body = await streamingApi.start({
      project: form.value.project, model: Number(form.value.model), fps: Number(form.value.fps),
      ...(form.value.source === 'file' ? { file: file.value } : { address: form.value.address.trim() }),
    });
    takePage(body);
    said.value = body?.said || 'The stream is queued.'; announce.value = said.value;
    creating.value = false;
    if (body?.stream) openStream(body.stream);
  } catch (e) {
    const field = e.field === 'source' ? (form.value.source === 'file' ? 'file' : 'address') : e.field;
    if (field && ['project', 'model', 'fps', 'address', 'file'].includes(field)) fieldErrors.value = { ...fieldErrors.value, [field]: e.message };
    else formError.value = e.message;
    if (e.code === 'timeout' || e.code === 'network') load();
  } finally { starting.value = false; }
}

// ── "Stop", always confirmed first ────────────────────────────────────────────────────────────────
const stopping = ref(null); const stopBusy = ref(false); const stopError = ref('');
function askStop(row) { stopping.value = row; stopError.value = ''; }
async function confirmStop() {
  if (!stopping.value || stopBusy.value) return;
  stopBusy.value = true;
  try {
    const body = await streamingApi.stop(stopping.value.id);
    takePage(body);
    said.value = body?.said || 'The stream is stopped.'; announce.value = said.value;
    if (viewing.value?.id === body?.stream?.id) { viewing.value = body.stream; speak(body.stream, true); }
    stopping.value = null;
  } catch (e) {
    stopError.value = e.message;
    if (e.code === 'timeout' || e.code === 'network') load();
  } finally { stopBusy.value = false; scheduleList(); }
}

// ── "Download results" ────────────────────────────────────────────────────────────────────────────
const downloading = ref(null); const downloadError = ref('');
async function download(row) {
  downloading.value = row.id; downloadError.value = '';
  try { await downloadResults(row.id); }
  catch (e) { downloadError.value = e.message; }
  finally { downloading.value = null; }
}

const started = row => timeAgo(row.started_at || row.created_at);
onUnmounted(() => { gone = true; clearTimeout(listTimer); clearTimeout(viewTimer); });
</script>

<template>
  <section class="streaming" role="tabpanel" aria-labelledby="st-heading" :aria-busy="loading">
    <div class="st-head">
      <div>
        <h2 id="st-heading">Cloud streaming</h2>
        <p>Point a photo model at a video. It answers 1 or 2 frames a second while the video plays, and every answer is kept in a file you can download.</p>
      </div>
      <UiButton variant="primary" :disabled="!page" @click="openCreate"><Plus :size="15" aria-hidden="true"/> New stream</UiButton>
    </div>

    <p v-if="page && !isOpen" class="st-closed" role="status"><Clock :size="18" aria-hidden="true"/><span>{{ page.not_open }}</span></p>
    <div v-if="said" class="notice" role="status"><Check :size="16" aria-hidden="true"/><span>{{ said }}</span></div>
    <div v-if="error" class="st-error" role="alert">
      <span>{{ error }}</span>
      <UiButton :disabled="loading" @click="load"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton>
    </div>
    <p v-if="downloadError" class="field-error" role="alert">{{ downloadError }}</p>

    <!-- The open stream: the newest frame's counts, how far it is, and its newest frames. -->
    <section v-if="viewing" id="st-view" class="st-view" tabindex="-1" aria-labelledby="st-view-title">
      <header class="st-view-head">
        <div>
          <h3 id="st-view-title">{{ modelName(viewing.model) }} <span class="st-on">on</span> {{ viewing.source }}</h3>
          <p>{{ viewing.project.name }}, {{ viewing.fps }} frame{{ viewing.fps === 1 ? '' : 's' }} a second</p>
        </div>
        <div class="st-view-acts">
          <UiBadge :tone="streamState(viewing)[0]"><LoaderCircle v-if="live" class="spin" :size="12" aria-hidden="true"/>{{ streamState(viewing)[1] }}</UiBadge>
          <button type="button" class="st-close" aria-label="Close this stream" @click="closeStream"><X :size="18" aria-hidden="true"/></button>
        </div>
      </header>

      <div class="st-readout">
        <div class="st-counts" :class="{ waiting: !counts }">
          <div class="st-count"><span class="st-num">{{ counts ? counts.walls : '–' }}</span><span class="st-what">walls</span></div>
          <div class="st-count"><span class="st-num">{{ counts ? counts.windows : '–' }}</span><span class="st-what">windows</span></div>
          <div class="st-count"><span class="st-num">{{ counts ? counts.doors : '–' }}</span><span class="st-what">doors</span></div>
        </div>
        <div class="st-where">
          <p class="st-frame">
            <template v-if="last">Frame {{ last.frame + 1 }} <span class="st-at">at {{ clockText(last.t) }}</span></template>
            <template v-else-if="viewing.state === 'queued'">Waiting for a worker to read the video</template>
            <template v-else-if="viewing.state === 'running'">Placing the model and reading the first frame</template>
            <template v-else>No frame was answered</template>
          </p>
          <p v-if="last && last.error" class="st-frame-error">This frame got no answer: {{ last.error }}</p>
          <div class="st-bar" role="progressbar" aria-label="Frames read of the most a stream reads" :aria-valuenow="viewing.frames" aria-valuemin="0" :aria-valuemax="viewing.max_frames">
            <span :style="{ transform: `scaleX(${progressOf(viewing)})` }"></span>
          </div>
          <p class="st-meta">{{ viewing.frames }} of at most {{ viewing.max_frames }} frames<template v-if="viewing.frames_failed">, {{ viewing.frames_failed }} without an answer</template></p>
        </div>
      </div>

      <div v-if="bars.length" class="st-strip" aria-hidden="true" title="Walls found in the newest frames">
        <span v-for="b in bars" :key="b.frame" :class="{ failed: b.failed }" :style="{ height: `${b.h}px` }"></span>
      </div>
      <p v-if="!live && endedText(viewing)" class="st-ended" :class="{ failed: viewing.state === 'failed' }">{{ endedText(viewing) }}</p>
      <p v-if="viewError" class="field-error" role="alert">{{ viewError }}</p>
      <p class="sr-only" aria-live="polite" aria-atomic="true">{{ spoken }}</p>

      <div class="st-view-foot">
        <UiButton v-if="viewing.has_results" :disabled="downloading === viewing.id" @click="download(viewing)">
          <LoaderCircle v-if="downloading === viewing.id" class="spin" :size="14" aria-hidden="true"/><Download v-else :size="14" aria-hidden="true"/> Download results
        </UiButton>
        <UiButton v-if="viewing.may && viewing.may.stop" class="st-stop" @click="askStop(viewing)"><Square :size="13" aria-hidden="true"/> Stop stream</UiButton>
      </div>
    </section>

    <p v-if="!page && !error" class="muted">Loading streams…</p>
    <div v-else-if="page && !streams.length" class="list-empty">
      <span class="empty-icon"><Video :size="22" aria-hidden="true"/></span>
      <h3>No stream yet</h3>
      <p>Upload a video or give a stream address, and a model of one of your projects answers its frames as it plays.</p>
      <div class="empty-actions"><UiButton variant="primary" @click="openCreate"><Plus :size="15" aria-hidden="true"/> New stream</UiButton></div>
    </div>
    <div v-else-if="page" class="table-wrap">
      <table class="ws-table st-table">
        <thead><tr><th>Video</th><th>Project and model</th><th>State</th><th>Frames</th><th>Started</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>
          <tr v-for="s in streams" :key="s.id" :class="{ open: viewing && viewing.id === s.id }">
            <td data-label="Video"><span class="st-src"><FileVideo v-if="s.source_kind === 'file'" :size="15" aria-hidden="true"/><Radio v-else :size="15" aria-hidden="true"/><strong>{{ s.source }}</strong></span>
              <small>{{ s.source_kind_label }}, {{ s.fps }} a second</small></td>
            <td data-label="Project and model">{{ s.project.name }}<small>{{ modelName(s.model) }}</small></td>
            <td data-label="State">
              <UiBadge :tone="streamState(s)[0]"><LoaderCircle v-if="isActive(s)" class="spin" :size="12" aria-hidden="true"/>{{ streamState(s)[1] }}</UiBadge>
              <small v-if="!isActive(s) && endedText(s)" :class="{ 'failed-why': s.state === 'failed' }">{{ endedText(s) }}</small>
            </td>
            <td data-label="Frames">{{ s.frames }} <small>of at most {{ s.max_frames }}, {{ clockText(s.video_seconds) }} of video</small></td>
            <td data-label="Started">{{ started(s) }}</td>
            <td class="row-actions"><div class="st-acts">
              <UiButton class="small" :aria-label="`Open the stream of ${modelName(s.model)} on ${s.source}`" @click="openStream(s)">Open</UiButton>
              <UiButton v-if="s.has_results" class="small" :disabled="downloading === s.id" :aria-label="`Download the results of the stream on ${s.source}`" @click="download(s)"><Download :size="14" aria-hidden="true"/> Results</UiButton>
              <UiButton v-if="s.may && s.may.stop" class="small" :aria-label="`Stop the stream on ${s.source}`" @click="askStop(s)"><Square :size="13" aria-hidden="true"/> Stop</UiButton>
            </div></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="sr-only" aria-live="polite">{{ announce }}</p>

    <UiDialog class="st-dialog" :open="creating" title="New stream" @close="creating=false">
      <form class="st-form" novalidate @submit.prevent="startStream">
        <p class="dialog-description">Choose a model and a video for it. Nothing starts until you press Start stream.</p>
        <p v-if="!isOpen" class="st-closed" role="status"><Clock :size="18" aria-hidden="true"/><span>{{ page.not_open }}</span></p>

        <div class="st-row">
          <div class="st-field">
            <label for="st-project">Project</label>
            <select id="st-project" v-model="form.project" class="text-input" :aria-invalid="!!fieldErrors.project" aria-describedby="st-project-error">
              <option v-if="!options.projects.length" value="">No project you may train in</option>
              <option v-for="p in options.projects" :key="p.ref" :value="p.ref">{{ p.name }}</option>
            </select>
            <p id="st-project-error" class="field-error" aria-live="polite">{{ fieldErrors.project }}</p>
          </div>
          <div class="st-field">
            <label for="st-model">Model</label>
            <select id="st-model" v-model="form.model" class="text-input" :disabled="!models.length" :aria-invalid="!!fieldErrors.model" aria-describedby="st-model-error">
              <option v-if="!models.length" value="">No trained model</option>
              <option v-for="m in models" :key="m.number" :value="String(m.number)">{{ modelName(m) }}</option>
            </select>
            <p id="st-model-error" class="field-error" aria-live="polite">{{ fieldErrors.model }}</p>
          </div>
        </div>

        <fieldset class="st-field">
          <legend>Video</legend>
          <div class="segmented" role="radiogroup" aria-label="Where the video comes from">
            <button type="button" role="radio" :aria-checked="form.source==='file'" :class="{on:form.source==='file'}" @click="form.source='file'"><Upload :size="14" aria-hidden="true"/> Upload a video</button>
            <button type="button" role="radio" :aria-checked="form.source==='address'" :class="{on:form.source==='address'}" @click="form.source='address'"><Radio :size="14" aria-hidden="true"/> Stream address</button>
          </div>

          <div v-if="form.source==='file'" class="st-source">
            <label class="st-drop" :class="{ chosen: file }" for="st-file">
              <FileVideo :size="20" aria-hidden="true"/>
              <span v-if="file"><strong>{{ file.name }}</strong><small>{{ megabytes(file.size) || '<1' }} MB</small></span>
              <span v-else><strong>Choose a video</strong><small>MP4, WebM or MOV, up to {{ megabytes(uploadLimit) }} MB</small></span>
            </label>
            <input id="st-file" ref="fileInput" class="st-file-input" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                   :aria-invalid="!!fieldErrors.file" aria-describedby="st-file-error" @change="pickFile">
            <button v-if="file" type="button" class="st-clear" aria-label="Remove the chosen video" @click="clearFile"><X :size="16" aria-hidden="true"/></button>
            <p id="st-file-error" class="field-error" aria-live="polite">{{ fieldErrors.file }}</p>
          </div>
          <div v-else class="st-source">
            <label for="st-address" class="sr-only">Stream address</label>
            <input id="st-address" v-model="form.address" class="text-input" type="url" inputmode="url" autocomplete="off" spellcheck="false"
                   placeholder="rtsp://camera.example.com/live" :aria-invalid="!!fieldErrors.address" aria-describedby="st-address-help st-address-error"
                   @blur="checkAddress" @input="addressTouched && checkAddress()">
            <p id="st-address-help" class="st-help">rtsp:// or rtsps:// for a camera, https:// for an HLS playlist (.m3u8) or an .mp4, .webm or .mov file. The address must lead to a public server. Only its server's name is shown afterwards<template v-if="addressShown(form.address)">: {{ addressShown(form.address) }}</template>.</p>
            <p id="st-address-error" class="field-error" aria-live="polite">{{ fieldErrors.address }}</p>
          </div>
        </fieldset>

        <fieldset class="st-field">
          <legend>Frames a second</legend>
          <div class="st-cards">
            <label v-for="f in options.fps" :key="f" class="st-card" :class="{chosen: Number(form.fps)===f}">
              <input v-model.number="form.fps" type="radio" name="st-fps" :value="f">
              <span><strong>{{ f }} a second</strong><small>{{ f === 1 ? 'One answer for every second of video.' : 'Two answers a second, for quicker movement.' }}</small></span>
            </label>
          </div>
          <p v-if="fieldErrors.fps" class="field-error" role="alert">{{ fieldErrors.fps }}</p>
        </fieldset>

        <p v-if="cap" class="st-cap" aria-live="polite">{{ cap }} One stream runs at a time in a workspace.</p>
        <p v-if="formError" class="field-error" role="alert">{{ formError }}</p>
        <div class="st-actions">
          <p v-if="startWhy" id="st-start-why" class="st-why">{{ startWhy }}</p>
          <UiButton @click="creating=false">Cancel</UiButton>
          <UiButton type="submit" variant="primary" :disabled="!!startWhy || starting" :aria-describedby="startWhy ? 'st-start-why' : undefined">
            <LoaderCircle v-if="starting" class="spin" :size="15" aria-hidden="true"/> {{ starting ? (form.source==='file' ? 'Uploading…' : 'Starting…') : 'Start stream' }}
          </UiButton>
        </div>
      </form>
    </UiDialog>

    <UiDialog :open="!!stopping" title="Stop this stream?" @close="stopping=null">
      <template v-if="stopping">
        <p class="dialog-description">The model stops reading {{ stopping.source }} after the frame it is on. The answers so far stay in its results file{{ stopping.source_kind === 'file' ? ', and the uploaded video is deleted' : '' }}.</p>
        <p v-if="stopError" class="field-error" role="alert">{{ stopError }}</p>
        <div class="dialog-actions">
          <UiButton @click="stopping=null">Keep it running</UiButton>
          <UiButton variant="primary" class="danger" :disabled="stopBusy" @click="confirmStop"><Square :size="13" aria-hidden="true"/> {{ stopBusy ? 'Stopping…' : 'Stop stream' }}</UiButton>
        </div>
      </template>
    </UiDialog>
  </section>
</template>

<style scoped>
.muted{font-size:12px!important;color:#5f6d82!important}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.st-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.st-head h2{margin:0 0 4px}
.st-head p{margin:0;max-width:620px;color:#4c5d74}
.st-closed{display:flex;gap:10px;align-items:flex-start;margin:0 0 16px;padding:12px 14px;border-radius:10px;background:#fff7e6;border:1px solid #f5dfb0;color:#6f4500!important;font-size:13px;line-height:1.55}
.st-closed svg{flex-shrink:0;margin-top:1px;color:#b26b00}
.st-error{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 16px;padding:10px 14px;border:1px solid #efc5ce;border-radius:10px;background:#fff5f6;color:#ad3449;font-size:13px}
.badge--red{color:#a12c3c;background:#fdecee}
.badge .spin{margin-right:2px}
.spin{animation:st-spin 1.1s linear infinite}
@keyframes st-spin{to{transform:rotate(360deg)}}
.failed-why{color:#a12c3c!important}

/* the open stream */
.st-view{margin:0 0 20px;padding:18px 20px;border:1px solid var(--aadml-soft);border-radius:12px;background:var(--aadml-tint);outline:none}
.st-view:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.st-view-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.st-view-head h3{margin:0;font-size:15px;color:#162139;overflow-wrap:anywhere}
.st-view-head p{margin:2px 0 0;font-size:12px;color:#4c5d74}
.st-on{font-weight:400;color:#5f6d82}
.st-view-acts{display:flex;align-items:center;gap:6px;flex-shrink:0}
.st-close{display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:8px;background:none;color:#5f6d82;cursor:pointer}
.st-close:hover{background:#fff;color:var(--aadml-primary)}
.st-readout{display:grid;grid-template-columns:auto minmax(0,1fr);gap:22px;align-items:center;margin-top:16px}
.st-counts{display:flex;gap:8px}
.st-count{display:flex;flex-direction:column;align-items:center;min-width:84px;padding:8px 12px 6px;border:1px solid #d9e0ea;border-radius:8px;background:#fff;box-shadow:0 2px 0 #e6ebf2}
.st-num{font-size:34px;line-height:1.15;font-weight:700;color:#162139;font-variant-numeric:tabular-nums}
.st-what{font-size:12px;color:#4c5d74}
.st-counts.waiting .st-num{color:#a3afc2}
.st-where{min-width:0}
.st-frame{margin:0!important;font-size:14px;font-weight:600;color:#162139!important;font-variant-numeric:tabular-nums}
.st-at{font-weight:400;color:#4c5d74}
.st-frame-error{margin:4px 0 0!important;font-size:12px!important;color:#a12c3c!important}
.st-bar{height:6px;margin:12px 0 6px;border-radius:3px;background:#dfe5ee;overflow:hidden}
.st-bar span{display:block;height:100%;background:var(--aadml-primary);transform-origin:left;transition:transform .4s ease-out}
.st-meta{margin:0!important;font-size:12px!important;color:#5f6d82!important}
.st-strip{display:flex;align-items:flex-end;gap:3px;height:40px;margin-top:16px;padding-top:4px;border-top:1px solid #dfe5ee}
.st-strip span{flex:1 1 0;max-width:14px;min-width:3px;border-radius:2px 2px 0 0;background:var(--aadml-outline)}
.st-strip span:last-child{background:var(--aadml-primary)}
.st-strip span.failed{background:repeating-linear-gradient(135deg,#f3c2ca 0 3px,#fdecee 3px 6px)}
.st-ended{margin:12px 0 0!important;font-size:13px!important;color:#22304a!important}
.st-ended.failed{color:#a12c3c!important}
.st-view-foot{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.st-view-foot .button{min-height:44px}

/* the list */
.list-empty{text-align:center;padding:30px 20px;border:1px solid #e3e8f1;border-radius:12px;background:#fff}
.empty-icon{display:grid;place-items:center;width:46px;height:46px;margin:0 auto;border-radius:50%;background:#f1f4f8;color:#4c5d74}
.list-empty h3{margin:12px 0 6px;font-size:16px}
.list-empty p{margin:0 auto 16px;max-width:520px}
.empty-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
.ws-table td{vertical-align:top;font-size:13px;min-width:0}
.ws-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:5px;max-width:300px;line-height:1.5}
.st-table tr.open td{background:var(--aadml-tint)}
.st-src{display:inline-flex;align-items:center;gap:7px;color:#162139;overflow-wrap:anywhere}
.st-src svg{color:#5f6d82}
.row-actions{white-space:nowrap;text-align:right}
.st-acts{display:inline-flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.button.small,.small{min-height:44px;padding:6px 12px;font-size:13px}

/* "New stream" */
.st-dialog{width:min(640px,calc(100% - 32px))}
.st-form{margin:0}
.st-field{display:block;margin:18px 0 0;min-width:0;border:0;padding:0}
.st-field > label,.st-field > legend{display:block;font-size:13px;font-weight:600;color:#1d2a42;margin:0 0 8px;padding:0}
.st-field .text-input{display:block;width:100%;min-height:44px;margin:0;padding:10px 12px;font-size:14px}
.st-field .text-input:focus-visible,.st-card:focus-within,.st-drop:focus-within{outline:2px solid var(--aadml-focus);outline-offset:2px}
.st-field .text-input[aria-invalid="true"]{border-color:#c0394c}
.st-field .field-error{margin:6px 0 0}
.st-field .field-error:empty{margin:0}
.st-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}
.segmented{display:inline-flex;padding:3px;border-radius:9px;background:#f1f3f7;gap:2px;flex-wrap:wrap}
.segmented button{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:7px 14px;border:0;border-radius:7px;background:transparent;color:#4d5a70;font:inherit;font-size:13px;font-weight:550;cursor:pointer;transition:background-color .15s,color .15s}
.segmented button.on{background:#fff;color:var(--aadml-primary);box-shadow:0 1px 3px #1d2a4224}
.segmented button:hover:not(.on){color:#1d2a42}
.segmented button:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.st-source{position:relative;margin-top:12px}
.st-drop{display:flex;align-items:center;gap:12px;min-height:64px;padding:12px 52px 12px 16px;border:1px dashed #c3ccda;border-radius:9px;background:#f8f9fb;color:#4c5d74;cursor:pointer;transition:border-color .15s,background-color .15s}
.st-drop:hover{border-color:var(--aadml-focus);background:var(--aadml-tint)}
.st-drop.chosen{border-style:solid;border-color:var(--aadml-focus);background:var(--aadml-tint)}
.st-drop span{display:flex;flex-direction:column;gap:2px;min-width:0}
.st-drop strong{font-size:14px;color:#162139;overflow-wrap:anywhere}
.st-drop small{font-size:12px;color:#5f6d82}
.st-file-input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}
.st-source:has(.st-file-input:focus-visible) .st-drop{outline:2px solid var(--aadml-focus);outline-offset:2px}
.st-clear{position:absolute;top:10px;right:8px;display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:8px;background:none;color:#5f6d82;cursor:pointer}
.st-clear:hover{background:#fff;color:#a12c3c}
.st-help{margin:6px 0 0!important;font-size:12px!important;line-height:1.5!important;color:#5f6d82!important;overflow-wrap:anywhere}
.st-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.st-card{display:flex;align-items:flex-start;gap:10px;min-height:44px;padding:12px 14px;border:1px solid #dce0e8;border-radius:9px;background:#fff;cursor:pointer;transition:border-color .15s,background-color .15s}
.st-card:hover{border-color:var(--aadml-focus)}
.st-card.chosen{border-color:var(--aadml-focus);background:var(--aadml-tint)}
.st-card input{margin-top:3px;width:16px;height:16px}
.st-card span{display:flex;flex-direction:column;gap:3px;min-width:0}
.st-card strong{font-size:14px;color:#162139}
.st-card small{font-size:12px;line-height:1.5;color:#4c5d74}
.st-cap{margin:20px 0 0!important;padding:10px 14px;border-radius:9px;background:#f4f6fa;color:#22304a!important;font-size:13px}
.st-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:20px;flex-wrap:wrap}
.st-actions .button{min-height:44px}
.st-why{margin:0 auto 0 0!important;flex:1 1 220px;font-size:12px!important;line-height:1.5!important;color:#6f4500!important}
.button--primary.danger{background:#b42318;border-color:#b42318}
.button--primary.danger:hover:not(:disabled){background:#912018;border-color:#912018}
.dialog-actions .button{min-height:44px}

@media(max-width:640px){
  .st-head .button{width:100%}
  .st-row,.st-cards{grid-template-columns:1fr}
  .st-readout{grid-template-columns:1fr;gap:14px}
  .st-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
  .st-count{min-width:0;padding:8px 4px 6px}
  .st-num{font-size:28px}
  .segmented{display:flex;flex-wrap:nowrap}
  .segmented button{flex:1 1 0;min-width:0;justify-content:center;padding:7px 6px}
  .st-actions .button,.st-view-foot .button{flex:1 1 auto}
  .st-why{flex-basis:100%}
  .st-view{padding:14px}
}
@media(max-width:650px){
  .ws-table thead{display:none}
  .ws-table,.ws-table tbody,.ws-table tr,.ws-table td{display:block;width:100%}
  .ws-table tr{border-bottom:1px solid #e9eaf0;padding:10px 0}
  .ws-table td{border:0!important;padding:6px 14px!important}
  .ws-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:4px}
  .row-actions{text-align:left}
  .st-acts{justify-content:flex-start}
}
@media(prefers-reduced-motion:reduce){.spin{animation:none}.st-bar span,.st-card,.st-drop,.segmented button{transition:none}}
</style>
