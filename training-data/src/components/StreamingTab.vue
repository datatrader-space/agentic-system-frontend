<script setup>
// The Deployments page's Cloud Streaming tab: the workspace's saved cameras (VideoSources.vue), and a project's photo
// model answering the frames of a video, an uploaded file, a stream address or a saved camera, sampled 1 or 2 a
// second; the answers show live, as the model's own classes, and are kept in a results file. A stream on a saved
// camera may run continuously, until it is stopped (CLOUD_STREAMING_PLAN.md section 7).
// Backend: streaming_api.py workspace/streams/ (list, start), workspace/streams/<id>/ (one), …/stop/, …/results/.
// Every frame the model answers is charged as one photo call, from the balance of the person who started the stream.
// "Read barcodes" (backend barcodes.py) reads the barcodes and QR codes of each frame, alone or after the model; each
// frame read costs a share of a photo call (a tenth unless the platform changes it: options.codes.photo_calls_a_read),
// and the codes read show newest first.
import { computed, onUnmounted, provide, ref, watch } from 'vue';
import {
  Bell, Cctv, Check, Download, FileVideo, LoaderCircle, Plus, Radio, RefreshCw, Square, Upload, Video, Wallet, X,
} from 'lucide-vue-next';
import DeploymentHeader from './DeploymentHeader.vue';
import DeploymentToolbar from './DeploymentToolbar.vue';
import VideoSources from './VideoSources.vue';
import CameraEvents from './CameraEvents.vue';
import CameraRecordings from './CameraRecordings.vue';
import StreamingTermsDialog from './StreamingTermsDialog.vue';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { modelName, timeAgo } from '../api/workspace.js';
import {
  streamingApi, downloadResults, POLL_MS, addressProblem, addressShown, fileProblem, megabytes, streamState, isActive,
  anyActive, clockText, progressOf, capText, countsSaid, endedText, recentBars, classNames, countOf, classesText,
  sourceShown, streamWhat, codesRead, frameCodesText, windowText, readCalls, readPriceText, chargeText, termsRequired,
} from '../api/streaming.js';

// ── the list ─────────────────────────────────────────────────────────────────────────────────────
const page = ref(null); const error = ref(''); const loading = ref(false);
const said = ref(''); const announce = ref('');
const streams = computed(() => page.value?.streams || []);
const listQuery = ref(''); const listStatus = ref('');
const listStates = computed(() => [...new Map(streams.value.map(s => [s.state, { value: s.state, label: streamState(s)[1] }])).values()]);
const visibleStreams = computed(() => streams.value.filter(s => (!listStatus.value || s.state === listStatus.value) && [s.source, s.project.name, streamWhat(s)].join(' ').toLowerCase().includes(listQuery.value.trim().toLowerCase())));
const options = computed(() => page.value?.options || { projects: [], fps: [1, 2], default_fps: 1, cap: null, upload: {} });
const may = computed(() => page.value?.may || {});
let gone = false; let listTimer = null; let viewTimer = null;

function noteChanges(before, after) {
  const was = new Map((before || []).map(s => [s.id, s.state]));
  const changed = (after || []).filter(s => was.has(s.id) && was.get(s.id) !== s.state);
  if (changed.length) announce.value = changed.map(s => `The stream of ${streamWhat(s)} is ${streamState(s)[1].toLowerCase()}.`).join(' ');
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
// The model's own classes: those the stream has shown so far keep their place; the newest answer gives the counts.
const answered = computed(() => !!last.value && !last.value.error);
const names = computed(() => classNames(viewing.value, 8));
const bars = computed(() => recentBars(viewing.value?.recent, 40));
const endless = stream => !!stream?.continuous || !Number(stream?.max_frames);
// The codes the open stream read, newest first.
const codes = computed(() => codesRead(viewing.value, 20));
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

// ── the saved cameras (VideoSources.vue reads them; the dialog below offers them) ──────────────────
const sourcesRef = ref(null); const sourcesPage = ref(null);
const savedSources = computed(() => sourcesPage.value?.sources || []);
const streamLimit = computed(() => Number(sourcesPage.value?.limits?.streams) || 0);
function changed() { load(); }
// A stream opened from a source's details: the list's row when it has it, else the stream's own read.
async function openStreamById(id) {
  const row = streams.value.find(s => s.id === id);
  if (row) { openStream(row); return; }
  try { const body = await streamingApi.get(id); if (body?.stream) openStream(body.stream); }
  catch (e) { error.value = e.message; }
}
// A source's own page (VideoSources.vue, VideoSourcePage.vue) takes the tab's place while it is open.
const sourceOpen = ref(false);
// Cameras and streams, or every kept recording (CameraRecordings.vue; the owner, 2026-11-19: inside Cloud Streaming,
// not a Deployments tab of its own). Kept for this tab across a reload.
const VIEW_KEY = 'tmd.streaming.view';
const VIEWS = [['cameras', 'Cameras and streams'], ['events', 'Events'], ['recordings', 'Recordings']];
function keptView() { try { const kept = sessionStorage.getItem(VIEW_KEY); return ['recordings', 'events'].includes(kept) ? kept : 'cameras'; } catch { return 'cameras'; } }
const view = ref(keptView());
watch(view, value => { try { sessionStorage.setItem(VIEW_KEY, value); } catch { /* no storage: not kept */ } });
function addSource() { view.value = 'cameras'; sourcesRef.value?.openAdd(); }
// The Terms and the Privacy Policy, accepted once before a first camera or stream (StreamingTermsDialog.vue): what the
// person asked for opens right after. The server refuses those until then (428 terms_required): such a refusal opens
// this window too (an older page, or acceptance withdrawn elsewhere).
const termsOpen = ref(false); let afterTerms = null;
const terms = computed(() => page.value?.terms || null);
function ensureTerms(next) {
  if (!terms.value || terms.value.accepted) return true;
  afterTerms = next || null; termsOpen.value = true;
  return false;
}
function termsNeeded() {
  if (page.value) page.value = { ...page.value, terms: { ...(page.value.terms || {}), accepted: false } };
  afterTerms = null; termsOpen.value = true;
}
function termsAccepted(state) {
  if (page.value) page.value = { ...page.value, terms: state };
  termsOpen.value = false;
  const next = afterTerms; afterTerms = null;
  if (next) next();
}
provide('streamingTerms', { ensure: ensureTerms, needed: termsNeeded })
// "Offline notifications": what is sent and to whom (backend camera_management.py OFFLINE NOTICES; live, 2026-11-19:
// this dialog still said "coming soon" after the notices shipped), and how often cameras are checked (camera_watch.py).
// The e-mail's switch is in AADML's Settings.
const notifying = ref(false);

// ── "New stream" ─────────────────────────────────────────────────────────────────────────────────
const creating = ref(false); const starting = ref(false);
const form = ref({ project: '', model: '', source: 'file', address: '', fps: 1, saved: '', continuous: false, useModel: true, readCodes: false, recording: null,
  useDetector: false, detector: '', useFind: false, find: '', skipStill: false, listen: false, listenConsent: false });
const listenOption = computed(() => options.value.listen || null);
// The ready detector (people, vehicles, pets and 77 more, on AADML's server) and finding objects by name (SAM 3): each
// in place of the project's model, one of the three at most (SMART_CAMERA_AI_PLAN.md Phase A).
const detectorsOption = computed(() => options.value.detectors || null);
const detectorChoices = computed(() => detectorsOption.value?.choices || []);
const findOption = computed(() => options.value.find || null);
watch(() => form.value.useModel, on => { if (on) { form.value.useDetector = false; form.value.useFind = false; } });
watch(() => form.value.useDetector, on => { if (on) { form.value.useModel = false; form.value.useFind = false; } });
watch(() => form.value.useFind, on => { if (on) { form.value.useModel = false; form.value.useDetector = false; } });
const chosenSource = computed(() => savedSources.value.find(s => String(s.id) === String(form.value.saved)) || null);
// A continuous stream answers a frame or two every second until it is stopped: say what an hour of it is. A frame both
// answered and read for barcodes is charged for each.
const codesOption = computed(() => options.value.codes || null);
const readPrice = computed(() => readPriceText(readCalls(codesOption.value)));
const continuousCharge = computed(() => chargeText({ useModel: form.value.useModel, readCodes: form.value.readCodes,
  codes: codesOption.value, fps: form.value.fps, detector: form.value.useDetector, find: form.value.useFind }));
const capMinutes = computed(() => Math.round((Number(options.value.cap?.seconds) || 600) / 60));
const file = ref(null); const fileInput = ref(null);
const fieldErrors = ref({}); const formError = ref(''); const addressTouched = ref(false);
const chosenProject = computed(() => options.value.projects.find(p => p.ref === form.value.project) || null);
const models = computed(() => chosenProject.value?.models || []);
const uploadLimit = computed(() => options.value.upload?.bytes || 200 * 1024 * 1024);
const runsOn = computed(() => form.value.source === 'saved' && form.value.continuous);
const cap = computed(() => (runsOn.value
  ? 'It runs until you stop it, the balance runs out, or the camera stops answering.'
  : capText(options.value.cap, form.value.fps)));
const atOnce = computed(() => (streamLimit.value ? ` At most ${streamLimit.value} stream${streamLimit.value === 1 ? '' : 's'} run at once in a workspace.` : ''));
const sourceProblem = computed(() => {
  if (form.value.source === 'file') return fileProblem(file.value, { bytes: uploadLimit.value, extensions: options.value.upload?.extensions });
  if (form.value.source === 'saved') return chosenSource.value ? '' : 'Choose a saved camera.';
  if (form.value.source === 'recording') return form.value.recording ? '' : 'Choose a recording.';
  return addressProblem(form.value.address);
});
const startWhy = computed(() => {
  if (!may.value.start) return may.value.reason || (options.value.projects.length ? 'You may not start a stream.' : 'You need the Train right in a photo project to start a stream.');
  if (!form.value.useModel && !form.value.useDetector && !form.value.useFind && !form.value.readCodes && !form.value.listen) return 'Choose what runs on each frame: the model, the ready detector, Find by name, Read barcodes, or Listen for sounds.';
  if (form.value.listen && !form.value.listenConsent) return 'Confirm that the people near this camera are told its sound is analysed.';
  if (form.value.useModel && !models.value.length) return 'Choose a project with a trained model, or the ready detector.';
  if (form.value.useDetector && detectorsOption.value && detectorsOption.value.available === false) return "The ready detector cannot run on AADML's server right now. Try again later.";
  if (form.value.useFind && !form.value.find.trim()) return 'Name what to find, for example "person, forklift".';
  if (form.value.useFind && findOption.value && findOption.value.available === false) return findOption.value.note || 'Finding objects by name is not offered right now.';
  if (form.value.readCodes && codesOption.value && codesOption.value.available === false) return 'Barcodes cannot be read on AADML right now. Run the model on its own, or try again later.';
  return '';
});
watch(() => form.value.project, () => {
  if (!models.value.some(m => String(m.number) === String(form.value.model))) form.value.model = models.value[0] ? String(models.value[0].number) : '';
  if (!models.value.length) form.value.useModel = false;          // a project without a model can still read barcodes
});
// Opened from the header (no source), from a saved camera's "Start stream" (that camera, its default project first),
// or from one of its recordings' "Use in project" (that recording, read in place: never continuous).
function openCreate(saved = null, recording = null) {
  if (!ensureTerms(() => openCreate(saved, recording))) return;
  const own = saved?.project?.ref ? options.value.projects.find(p => p.ref === saved.project.ref && p.models.length) : null;
  const first = own || options.value.projects.find(p => p.models.length) || options.value.projects[0];
  form.value = {
    project: first?.ref || '', model: first?.models[0] ? String(first.models[0].number) : '',
    source: recording?.id ? 'recording' : saved ? 'saved' : 'file', address: '', fps: options.value.default_fps || 1,
    saved: saved ? String(saved.id) : '', continuous: false, recording: recording?.id ? recording : null,
    useModel: !!first?.models?.length, readCodes: false,
    useDetector: !first?.models?.length && detectorsOption.value?.available !== false,
    detector: detectorsOption.value?.default || detectorChoices.value[0]?.key || '', useFind: false, find: '', skipStill: false,
    listen: false, listenConsent: false,
  };
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
  else if (form.value.source === 'saved') fieldErrors.value = { ...fieldErrors.value, saved: sourceProblem.value };
  else fieldErrors.value = { ...fieldErrors.value, file: fileProblem(file.value, { bytes: uploadLimit.value }) };
  if (sourceProblem.value || startWhy.value || starting.value) return;
  starting.value = true;
  try {
    const body = await streamingApi.start({
      project: form.value.project, model: form.value.useModel ? Number(form.value.model) : null, fps: Number(form.value.fps),
      readCodes: form.value.readCodes,
      detector: form.value.useDetector ? form.value.detector : '', find: form.value.useFind ? form.value.find.trim() : '',
      skipStill: form.value.skipStill && (form.value.useModel || form.value.useDetector || form.value.useFind),
      listen: form.value.listen && form.value.listenConsent,
      ...(form.value.source === 'file' ? { file: file.value }
        : form.value.source === 'saved' ? { source: chosenSource.value.id, continuous: form.value.continuous }
          : form.value.source === 'recording' ? { recording: form.value.recording.id }
            : { address: form.value.address.trim() }),
    });
    takePage(body);
    sourcesRef.value?.load();
    said.value = body?.said || 'The stream is queued.'; announce.value = said.value;
    creating.value = false;
    // From a source's own page the page shows it (it reads its streams again); else the stream opens here.
    if (sourceOpen.value) sourcesRef.value?.refreshDetail?.();
    else if (body?.stream) openStream(body.stream);
  } catch (e) {
    if (termsRequired(e)) { creating.value = false; termsNeeded(); return; }
    const field = e.field === 'source' ? ({ file: 'file', saved: 'saved' }[form.value.source] || 'address') : e.field;
    if (field && ['project', 'model', 'fps', 'address', 'file', 'saved', 'read_codes', 'detector', 'find', 'listen'].includes(field)) fieldErrors.value = { ...fieldErrors.value, [field]: e.message };
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
    sourcesRef.value?.load();
    if (sourceOpen.value) sourcesRef.value?.refreshDetail?.();
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
    <template v-if="!sourceOpen">
    <DeploymentHeader title="Cloud Streaming" heading-id="st-heading" eyebrow="VIDEO IN. INSIGHTS OUT." :icon="Video" description="Run your models on live video from your cameras, stream addresses or test videos, and watch them from the cloud.">
      <div class="st-head-acts">
        <UiButton @click="notifying = true"><Bell :size="15" aria-hidden="true"/> Offline notifications</UiButton>
        <UiButton variant="primary" :disabled="!sourcesRef?.ready || !!sourcesRef?.addWhy" :title="sourcesRef?.addWhy || undefined" @click="addSource"><Plus :size="15" aria-hidden="true"/> Add video source</UiButton>
      </div>
    </DeploymentHeader>
    <p v-if="page && page.cost_note" class="st-billing"><Wallet :size="16" aria-hidden="true"/><span>{{ page.cost_note }}</span></p>
    <div v-if="said" class="notice" role="status"><Check :size="16" aria-hidden="true"/><span>{{ said }}</span></div>
    <div v-if="error" class="st-error" role="alert">
      <span>{{ error }}</span>
      <UiButton :disabled="loading" @click="load"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton>
    </div>
    <div class="st-views" role="tablist" aria-label="Cloud Streaming">
      <button v-for="[id, label] in VIEWS" :id="`st-view-${id}`" :key="id" type="button" role="tab" :aria-selected="view === id"
              :class="{ on: view === id }" @click="view = id">{{ label }}</button>
    </div>
    <CameraRecordings v-if="view === 'recordings'" role="tabpanel" aria-labelledby="st-view-recordings"/>
    <CameraEvents v-if="view === 'events'" role="tabpanel" aria-labelledby="st-view-events"/>
    </template>
    <p v-if="downloadError" class="field-error" role="alert">{{ downloadError }}</p>

    <div v-show="view === 'cameras' || sourceOpen">
    <VideoSources ref="sourcesRef" :projects="options.projects" :may-start="!!page && may.start !== false" :start-why="may.reason || ''"
                  @start="openCreate" @loaded="sourcesPage = $event" @changed="changed" @open-stream="openStreamById"
                  @page="sourceOpen = $event" @stop-stream="askStop" @download="download"/>
    <template v-if="!sourceOpen">

    <!-- The open stream: the newest frame's counts, how far it is, and its newest frames. -->
    <section v-if="viewing" id="st-view" class="st-view" tabindex="-1" aria-labelledby="st-view-title">
      <header class="st-view-head">
        <div>
          <h3 id="st-view-title">{{ streamWhat(viewing) }} <span class="st-on">on</span> {{ viewing.source }}</h3>
          <p>{{ viewing.project.name }}, {{ viewing.fps }} frame{{ viewing.fps === 1 ? '' : 's' }} a second</p>
        </div>
        <div class="st-view-acts">
          <UiBadge :tone="streamState(viewing)[0]"><LoaderCircle v-if="live" class="spin" :size="12" aria-hidden="true"/>{{ streamState(viewing)[1] }}</UiBadge>
          <button type="button" class="st-close" aria-label="Close this stream" @click="closeStream"><X :size="18" aria-hidden="true"/></button>
        </div>
      </header>

      <div class="st-readout">
        <div v-if="viewing.model" class="st-counts" :class="{ waiting: !answered }">
          <div v-for="name in names" :key="name" class="st-count"><span class="st-num">{{ answered ? countOf(last, name) : '–' }}</span><span class="st-what">{{ name }}</span></div>
          <div v-if="!names.length" class="st-count"><span class="st-num">{{ answered ? 0 : '–' }}</span><span class="st-what">found</span></div>
        </div>
        <div class="st-where">
          <p class="st-frame">
            <template v-if="last">Frame {{ last.frame + 1 }} <span class="st-at">at {{ clockText(last.t) }}</span></template>
            <template v-else-if="viewing.state === 'queued'">Waiting for a worker to read the video</template>
            <template v-else-if="viewing.state === 'running'">{{ viewing.model ? 'Placing the model and reading the first frame' : 'Reading the first frame' }}</template>
            <template v-else>No frame was answered</template>
          </p>
          <p v-if="last && last.error" class="st-frame-error">This frame got no answer: {{ last.error }}</p>
          <p v-else-if="last && viewing.read_codes" class="st-frame-codes">Barcodes in this frame: {{ frameCodesText(last) }}</p>
          <div v-if="!endless(viewing)" class="st-bar" role="progressbar" aria-label="Frames read of the most a stream reads" :aria-valuenow="viewing.frames" aria-valuemin="0" :aria-valuemax="viewing.max_frames">
            <span :style="{ transform: `scaleX(${progressOf(viewing)})` }"></span>
          </div>
          <p v-if="endless(viewing)" class="st-meta">{{ viewing.frames }} frame{{ viewing.frames === 1 ? '' : 's' }} so far<template v-if="viewing.frames_failed">, {{ viewing.frames_failed }} without an answer</template>. It runs until you stop it.</p>
          <p v-else class="st-meta">{{ viewing.frames }} of at most {{ viewing.max_frames }} frames<template v-if="viewing.frames_failed">, {{ viewing.frames_failed }} without an answer</template></p>
        </div>
      </div>

      <section v-if="viewing.read_codes" class="st-codes" aria-labelledby="st-codes-h">
        <h4 id="st-codes-h">Barcodes read <small>newest first</small></h4>
        <p v-if="!codes.length" class="st-meta">No barcode or QR code read yet.</p>
        <ol v-else class="st-code-list">
          <li v-for="c in codes" :key="c.key"><span class="st-code-type">{{ c.type }}</span><span class="st-code-value">{{ c.value }}</span><span class="st-code-at">frame {{ c.frame + 1 }}, {{ clockText(c.t) }}</span></li>
        </ol>
      </section>
      <div v-if="viewing.model && bars.length" class="st-strip" aria-hidden="true" title="Everything found in each of the newest frames">
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

    <DeploymentToolbar v-if="page" title="Streams" v-model:query="listQuery" v-model:status="listStatus" :states="listStates" :count="visibleStreams.length" :total="streams.length" :loading="loading" @refresh="load">
      <UiButton variant="primary" :disabled="may.start === false" @click="openCreate()"><Plus :size="15" aria-hidden="true"/> New stream</UiButton>
    </DeploymentToolbar>
    <div v-if="page && streams.length && !visibleStreams.length" class="deployment-no-results" role="status"><h3>No matching streams</h3><p>Try a different video, project, or status.</p></div>
    <p v-if="!page && !error" class="muted">Loading streams…</p>
    <div v-else-if="page && !streams.length" class="list-empty">
      <span class="empty-icon"><Video :size="22" aria-hidden="true"/></span>
      <h3>No stream yet</h3>
      <p>Upload a video, give a stream address or pick a saved camera, and a model of one of your projects answers its frames as it plays.</p>
      <div class="empty-actions"><UiButton variant="primary" :disabled="may.start === false" @click="openCreate()"><Plus :size="15" aria-hidden="true"/> New stream</UiButton></div>
    </div>
    <div v-else-if="page && visibleStreams.length" class="table-wrap">
      <table class="ws-table st-table">
        <thead><tr><th>Video</th><th>Project and model</th><th>State</th><th>Frames</th><th>Started</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>
          <tr v-for="s in visibleStreams" :key="s.id" :class="{ open: viewing && viewing.id === s.id }">
            <td data-label="Video"><span class="st-src"><FileVideo v-if="s.source_kind === 'file'" :size="15" aria-hidden="true"/><Radio v-else :size="15" aria-hidden="true"/><strong>{{ s.source }}</strong></span>
              <small>{{ s.source_kind_label }}, {{ s.fps }} a second</small></td>
            <td data-label="Project and model">{{ s.project.name }}<small>{{ streamWhat(s) }}</small></td>
            <td data-label="State">
              <UiBadge :tone="streamState(s)[0]"><LoaderCircle v-if="isActive(s)" class="spin" :size="12" aria-hidden="true"/>{{ streamState(s)[1] }}</UiBadge>
              <small v-if="!isActive(s) && endedText(s)" :class="{ 'failed-why': s.state === 'failed' }">{{ endedText(s) }}</small>
            </td>
            <td data-label="Frames">{{ s.frames }} <small v-if="endless(s)">runs until stopped, {{ clockText(s.video_seconds) }} of video</small><small v-else>of at most {{ s.max_frames }}, {{ clockText(s.video_seconds) }} of video</small>
              <small v-if="s.last && !s.last.error && s.model" class="st-found">Newest: {{ classesText(s.last) }}</small>
              <small v-if="s.last && !s.last.error && s.read_codes" class="st-found">Barcodes: {{ frameCodesText(s.last) }}</small></td>
            <td data-label="Started">{{ started(s) }}</td>
            <td class="row-actions"><div class="st-acts">
              <UiButton class="small" :aria-label="`Open the stream of ${streamWhat(s)} on ${s.source}`" @click="openStream(s)">Open</UiButton>
              <UiButton v-if="s.has_results" class="small" :disabled="downloading === s.id" :aria-label="`Download the results of the stream on ${s.source}`" @click="download(s)"><Download :size="14" aria-hidden="true"/> Results</UiButton>
              <UiButton v-if="s.may && s.may.stop" class="small" :aria-label="`Stop the stream on ${s.source}`" @click="askStop(s)"><Square :size="13" aria-hidden="true"/> Stop</UiButton>
            </div></td>
          </tr>
        </tbody>
      </table>
    </div>
    </template>
    </div>
    <p class="sr-only" aria-live="polite">{{ announce }}</p>

    <UiDialog class="st-dialog" :open="creating" title="New stream" @close="creating=false">
      <form class="st-form" novalidate @submit.prevent="startStream">
        <p class="dialog-description">Choose what runs on each frame and a video for it. Nothing starts until you press Start stream.</p>
        <p v-if="page && page.cost_note" class="st-billing"><Wallet :size="16" aria-hidden="true"/><span>{{ page.cost_note }}</span></p>

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
            <select id="st-model" v-model="form.model" class="text-input" :disabled="!models.length || !form.useModel" :aria-invalid="!!fieldErrors.model" aria-describedby="st-model-error">
              <option v-if="!models.length" value="">No trained model</option>
              <option v-for="m in models" :key="m.number" :value="String(m.number)">{{ modelName(m) }}</option>
            </select>
            <p id="st-model-error" class="field-error" aria-live="polite">{{ fieldErrors.model }}</p>
          </div>
        </div>

        <fieldset class="st-field">
          <legend>On each frame</legend>
          <div class="st-cards">
            <label class="st-card" :class="{ chosen: form.useModel }">
              <input v-model="form.useModel" type="checkbox" :disabled="!models.length" aria-describedby="st-use-model-help">
              <span><strong>Run the model</strong><small id="st-use-model-help">{{ models.length ? 'The model answers each frame with what it finds.' : 'This project has no trained model yet.' }}</small></span>
            </label>
            <label v-if="detectorChoices.length" class="st-card" :class="{ chosen: form.useDetector }">
              <input v-model="form.useDetector" type="checkbox" :disabled="detectorsOption.available === false" aria-describedby="st-detector-help">
              <span><strong>Ready detector</strong><small id="st-detector-help">Finds people, vehicles, pets and {{ Math.max(0, (detectorsOption.classes || []).length - 3) }} more everyday things, with no model of your own. {{ detectorsOption.note }}</small></span>
            </label>
            <label v-if="findOption" class="st-card" :class="{ chosen: form.useFind }">
              <input v-model="form.useFind" type="checkbox" :disabled="findOption.available === false" aria-describedby="st-find-help">
              <span><strong>Find by name</strong><small id="st-find-help">{{ findOption.available === false ? findOption.note : `${findOption.what} ${findOption.note}` }}</small></span>
            </label>
            <label class="st-card" :class="{ chosen: form.readCodes }">
              <input v-model="form.readCodes" type="checkbox" :disabled="!!codesOption && codesOption.available === false" aria-describedby="st-codes-help">
              <span><strong>Read barcodes</strong><small id="st-codes-help">Finds the barcodes and QR codes in each frame{{ form.useModel || form.useDetector || form.useFind ? ', after the model' : ', on its own' }}. Each frame read costs {{ readPrice }}.</small></span>
            </label>
          </div>
          <div v-if="form.useDetector && detectorChoices.length > 1" class="st-field">
            <label for="st-detector">Detector size</label>
            <select id="st-detector" v-model="form.detector" class="text-input" :aria-invalid="!!fieldErrors.detector">
              <option v-for="d in detectorChoices" :key="d.key" :value="d.key">{{ d.name }}</option>
            </select>
          </div>
          <div v-if="form.useFind" class="st-field">
            <label for="st-find">What to find</label>
            <input id="st-find" v-model="form.find" class="text-input" maxlength="400" placeholder="person, forklift, red helmet" :aria-invalid="!!fieldErrors.find">
          </div>
          <label v-if="form.useModel || form.useDetector || form.useFind" class="st-check">
            <input v-model="form.skipStill" type="checkbox"> <span>{{ options.skip_still_note || 'Skip still frames: a frame nearly the same as the last one answered is not sent, and is not charged.' }}</span>
          </label>
          <label v-if="listenOption" class="st-check">
            <input v-model="form.listen" type="checkbox"> <span><strong>Listen for sounds</strong>: {{ (listenOption.sounds || []).join(', ') }}. {{ listenOption.note }}</span>
          </label>
          <label v-if="form.listen" class="st-check">
            <input v-model="form.listenConsent" type="checkbox"> <span>{{ listenOption.consent }}</span>
          </label>
          <p v-if="fieldErrors.listen" class="field-error" role="alert">{{ fieldErrors.listen }}</p>
          <p v-if="fieldErrors.detector" class="field-error" role="alert">{{ fieldErrors.detector }}</p>
          <p v-if="fieldErrors.find" class="field-error" role="alert">{{ fieldErrors.find }}</p>
          <p v-if="fieldErrors.read_codes" class="field-error" role="alert">{{ fieldErrors.read_codes }}</p>
        </fieldset>

        <fieldset class="st-field">
          <legend>Video</legend>
          <p v-if="form.source==='recording'" class="st-help">The recording of {{ form.recording.source?.name || 'this camera' }}, {{ windowText(form.recording) }}. Its stored video is read as it is; nothing is copied.</p>
          <div v-else class="segmented" role="radiogroup" aria-label="Where the video comes from">
            <button type="button" role="radio" :aria-checked="form.source==='file'" :class="{on:form.source==='file'}" @click="form.source='file'"><Upload :size="14" aria-hidden="true"/> Upload a video</button>
            <button type="button" role="radio" :aria-checked="form.source==='address'" :class="{on:form.source==='address'}" @click="form.source='address'"><Radio :size="14" aria-hidden="true"/> Stream address</button>
            <button v-if="savedSources.length" type="button" role="radio" :aria-checked="form.source==='saved'" :class="{on:form.source==='saved'}" @click="form.source='saved'"><Cctv :size="14" aria-hidden="true"/> Saved camera</button>
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
          <div v-else-if="form.source==='saved'" class="st-source">
            <label for="st-saved" class="sr-only">Saved camera</label>
            <select id="st-saved" v-model="form.saved" class="text-input" :aria-invalid="!!fieldErrors.saved" aria-describedby="st-saved-help st-saved-error">
              <option value="" disabled>Choose a saved camera</option>
              <option v-for="v in savedSources" :key="v.id" :value="String(v.id)">{{ v.name }}</option>
            </select>
            <p id="st-saved-help" class="st-help">{{ chosenSource ? sourceShown(chosenSource) : '' }}</p>
            <p id="st-saved-error" class="field-error" aria-live="polite">{{ fieldErrors.saved }}</p>
            <label class="st-card st-continuous" :class="{ chosen: form.continuous }">
              <input v-model="form.continuous" type="checkbox" aria-describedby="st-continuous-help">
              <span><strong>Run continuously until I stop it</strong>
                <small id="st-continuous-help">Otherwise it stops after {{ capMinutes }} minutes. {{ continuousCharge }}</small></span>
            </label>
          </div>
          <div v-else-if="form.source==='address'" class="st-source">
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

        <p v-if="cap" class="st-cap" aria-live="polite">{{ cap }}{{ atOnce }}</p>
        <p v-if="formError" class="field-error" role="alert">{{ formError }}</p>
        <div class="st-actions">
          <p v-if="startWhy" id="st-start-why" class="st-why">{{ startWhy }}</p>
          <UiButton @click="creating=false">Cancel</UiButton>
          <UiButton type="submit" variant="primary" :disabled="!!startWhy || starting" :aria-describedby="startWhy ? 'st-start-why' : undefined">
            <LoaderCircle v-if="starting" class="spin" :size="15" aria-hidden="true"/> {{ starting ? (form.source==='file' ? 'Uploading…' : 'Starting…') : runsOn ? 'Start continuous stream' : 'Start stream' }}
          </UiButton>
        </div>
      </form>
    </UiDialog>

    <StreamingTermsDialog :open="termsOpen" :terms="terms" @close="termsOpen = false" @accepted="termsAccepted"/>

    <UiDialog :open="notifying" title="Offline notifications" @close="notifying=false">
      <p class="dialog-description">When a camera goes offline or needs attention, the workspace's Admins and the organization's owners are told under the bell in AADML and by e-mail, at most once an hour a camera, and again once when it is back online.</p>
      <p class="dialog-description">AADML checks each camera by itself: a camera address every 5 minutes, a camera on your machine every 10 (by that machine). A camera found down is looked at again a minute later before anyone is told, so a moment's network trouble sends nothing. While a camera is watched, recorded or streamed, and when an RTMP stream or a phone starts or stops sending, a change is noticed at once; Check now in its details checks it any time.</p>
      <p class="dialog-description">The e-mail can be turned off in Settings, Notifications, Camera alerts; the notice under the bell is always made.</p>
      <div class="dialog-actions"><UiButton variant="primary" @click="notifying=false">Close</UiButton></div>
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
.st-head-acts{display:flex;gap:10px;flex-wrap:wrap}
.st-views{display:inline-flex;gap:4px;margin:0 0 16px;padding:4px;border-radius:12px;background:#f1f4f8;max-width:100%;overflow-x:auto}
.st-views button{min-height:40px;padding:8px 16px;border:0;border-radius:9px;background:transparent;color:#33415a;font:inherit;font-size:14px;font-weight:600;white-space:nowrap;cursor:pointer}
.st-views button.on{background:#fff;color:#162139;box-shadow:0 1px 2px #0d132033}
.st-views button:focus-visible{outline:2px solid var(--aadml-focus,#2563eb);outline-offset:2px}
.st-head-acts .button{min-height:44px}
.st-billing{display:flex;gap:8px;align-items:flex-start;margin:0 0 16px;font-size:13px;line-height:1.55;color:#33415a!important}
.st-billing svg{flex-shrink:0;margin-top:2px;color:#5f6d82}
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
.st-counts{display:flex;flex-wrap:wrap;gap:8px;max-width:560px}
.st-count{display:flex;flex-direction:column;align-items:center;min-width:84px;padding:8px 12px 6px;border:1px solid #d9e0ea;border-radius:8px;background:#fff;box-shadow:0 2px 0 #e6ebf2}
.st-num{font-size:34px;line-height:1.15;font-weight:700;color:#162139;font-variant-numeric:tabular-nums}
.st-what{max-width:120px;font-size:12px;color:#4c5d74;text-align:center;overflow-wrap:anywhere}
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
.st-continuous{margin-top:12px}
.st-found{color:#33415a!important;overflow-wrap:anywhere}
.st-frame-codes{margin:4px 0 0!important;font-size:12px!important;color:#33415a!important;overflow-wrap:anywhere}
.st-check{display:flex;gap:8px;align-items:flex-start;margin-top:8px;font-size:13px;color:#33415a}
.st-codes{margin-top:16px;padding-top:12px;border-top:1px solid #dfe5ee}
.st-codes h4{margin:0 0 8px;font-size:13px;color:#162139}
.st-codes h4 small{font-weight:400;color:#5f6d82}
.st-code-list{list-style:none;margin:0;padding:0;display:grid;gap:6px;max-height:260px;overflow:auto}
.st-code-list li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:baseline;padding:8px 10px;border:1px solid #dfe5ee;border-radius:8px;background:#fff;font-size:13px}
.st-code-type{font-size:11px;font-weight:600;color:#4c5d74;white-space:nowrap}
.st-code-value{color:#162139;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.st-code-at{font-size:11px;color:#5f6d82;white-space:nowrap;font-variant-numeric:tabular-nums}
.st-cap{margin:20px 0 0!important;padding:10px 14px;border-radius:9px;background:#f4f6fa;color:#22304a!important;font-size:13px}
.st-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:20px;flex-wrap:wrap}
.st-actions .button{min-height:44px}
.st-why{margin:0 auto 0 0!important;flex:1 1 220px;font-size:12px!important;line-height:1.5!important;color:#6f4500!important}
.button--primary.danger{background:#b42318;border-color:#b42318}
.button--primary.danger:hover:not(:disabled){background:#912018;border-color:#912018}
.dialog-actions .button{min-height:44px}

@media(max-width:640px){
  .st-head .button{width:100%}
  .st-head-acts{width:100%}
  .st-head-acts .button{flex:1 1 auto}
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
