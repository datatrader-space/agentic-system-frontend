<script setup>
// One saved camera's own page (the owner, 2026-11-17, with a reference screenshot): opened from a row of the Video
// sources card, it takes the Cloud Streaming tab's place. Left, the source: its live view through AADML's media relay
// (LiveView.vue, inline) or, for a source the relay does not play, its newest frame; under it, the model that runs on
// it (a stream: "Run a model" starts one; "Build a workflow" opens the Workflow Builder with this camera's event as
// its trigger). Right, the results: the newest answers of the stream on this camera, as the model's own classes, and
// its newest frames; with "Read barcodes", the barcodes and QR codes it read, newest first, each with its type, its
// value (shown as text only) and its frame time; its Events (what its rules matched, with a snapshot) and Rules
// (CLOUD_STREAMING_PLAN.md §3.5, phase 6); its Recordings, each of which can be used in a project. An RTMP stream (§14)
// shows where its camera sends ("Send to AADML": the server; the stream key only right after "Rotate key", an Admin's,
// confirmed first: the old key stops at once and the camera sending with it is disconnected). A phone camera (§16)
// shows when its phone link ends, and "New phone link" (an Admin's, confirmed first: the old link stops at once and a
// phone sending with it is disconnected) shows the new link once, as a QR code. AADML's own words throughout.
// Backend: streaming_api.py workspace/video-sources/<id>/ (the source and its streams), workspace/streams/<id>/;
// stream_events_api.py workspace/video-sources/<id>/rules/ and events/.
import { computed, onUnmounted, ref, watch } from 'vue';
import {
  ArrowDown, ArrowLeft, Bell, ChartLine, Circle, CircleQuestionMark, Disc, Download, FolderInput, History, ImageOff,
  KeyRound, ListChecks, LoaderCircle, Maximize, Pencil, Play, Plus, RadioTower, RefreshCw, Smartphone, Square, Trash2, Tv, Wallet, Workflow,
} from 'lucide-vue-next';
import LiveView from './LiveView.vue';
import PushDetails from './PushDetails.vue';
import PhoneLinkDetails from './PhoneLinkDetails.vue';
import UiBadge from './UiBadge.vue';
import UiButton from './UiButton.vue';
import { timeAgo } from '../api/workspace.js';
import {
  streamingApi, POLL_MS, isActive, streamState, classNames, countOf, recentBars, clockText, endedText,
  sourceState, sourceKindLabel, sourceShown, isPublic, thumbnailOf, lastFrameText, canWatch,
  videoSources, recordingsApi, dayRange, windowText, sizeText, dayPriceText, historyRows, spendItems, monthText,
  streamWhat, codesRead, frameCodesText, pushDetails, phoneLinkDetails, phoneLinkUntil,
  streamRules, streamEvents, ruleForm, ruleProblems, ruleBody, ruleClasses, cooldownText, matchedText, eventTime,
  workflowFromCamera, COOLDOWN_MIN,
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
// A connector camera's check its machine has not answered yet (streaming_api._connector_asked): said in place of the
// previous answer, and the source is read again until the machine answers.
const asked = computed(() => props.source.asked || null);
const ASK_POLL_MS = 5000; let askTimer = null;
watch(asked, now => {
  clearTimeout(askTimer); askTimer = null;
  if (now) askTimer = setTimeout(() => { if (!gone) emit('refresh'); }, ASK_POLL_MS);
}, { immediate: true });
onUnmounted(() => clearTimeout(askTimer));
const askedLine = computed(() => (asked.value
  ? `Asked ${asked.value.machine} for a frame ${timeAgo(asked.value.since)}. It appears here when the machine answers; a machine's first check downloads AADML's camera image, which can take a few minutes.`
  : ''));
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
// The barcodes the stream read, newest first (its own read: the list's copy has none).
const codes = computed(() => codesRead(stream.value, 50));

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
  if (r.on) return `Recording to the cloud. Kept ${r.days} day${r.days === 1 ? '' : 's'}, ${r.stored_bytes ? `${sizeText(r.stored_bytes)} kept now` : 'nothing kept yet: the first 5 minutes appear a few minutes after recording starts'}.`;
  return r.stored_bytes ? `Not recording. ${sizeText(r.stored_bytes)} kept until its days are over.` : 'Not recording.';
});

// ── an RTMP stream: where its camera sends, and "Rotate key" (CLOUD_STREAMING_PLAN.md §14) ────────────────────────
const pushed = computed(() => props.source.kind === 'rtmp' && props.source.shared !== true);
// The new key is kept only while this page shows it: leaving the page drops it.
const newPush = ref(null);
const push = computed(() => newPush.value || pushDetails(props.source.push));
const mayRotate = computed(() => pushed.value && props.may.rotate !== false && props.may.change !== false
  && props.source.may?.rotate !== false);
const rotating = ref(false); const rotateBusy = ref(false); const rotateError = ref(''); const rotateSaid = ref('');
watch(() => props.source.id, () => { newPush.value = null; rotating.value = false; rotateSaid.value = ''; });
async function rotateKey() {
  if (rotateBusy.value) return;
  rotateBusy.value = true; rotateError.value = '';
  try {
    const answer = await videoSources.rotateKey(props.source.id);
    newPush.value = pushDetails(answer?.source?.push);
    rotateSaid.value = answer?.said || 'The stream key is rotated. The old one no longer works.';
    rotating.value = false;
    if (!newPush.value?.streamKey) rotateError.value = "The key was rotated, but the new one could not be shown here. This page may be older than AADML's latest update: reload it (Ctrl+Shift+R, or pull down on a phone), then rotate it again.";
    emit('refresh');
  } catch (e) { rotateError.value = e.message; }
  finally { rotateBusy.value = false; }
}

// ── a phone camera: when its link ends, and "New phone link" (CLOUD_STREAMING_PLAN.md §16) ─────────────────────────
const phoned = computed(() => props.source.kind === 'phone' && props.source.shared !== true);
// The new link is kept only while this page shows it: leaving the page drops it.
const newPhone = ref(null);
const phoneNow = computed(() => phoneLinkDetails(props.source.phone));
const mayNewLink = computed(() => phoned.value && props.may.change !== false && props.source.may?.new_link !== false);
const relinking = ref(false); const relinkBusy = ref(false); const relinkError = ref(''); const relinkSaid = ref('');
watch(() => props.source.id, () => { newPhone.value = null; relinking.value = false; relinkSaid.value = ''; relinkError.value = ''; });
async function newPhoneLink() {
  if (relinkBusy.value) return;
  relinkBusy.value = true; relinkError.value = '';
  try {
    const answer = await videoSources.newPhoneLink(props.source.id);
    const details = phoneLinkDetails(answer?.source?.phone);
    newPhone.value = details?.url ? details : null;
    relinkSaid.value = answer?.said || 'There is a new phone link. The old one no longer works.';
    relinking.value = false;
    if (!newPhone.value) relinkError.value = "A new link was made, but it could not be shown here. This page may be older than AADML's latest update: reload it (Ctrl+Shift+R, or pull down on a phone), then make a new phone link.";
    emit('refresh');
  } catch (e) { relinkError.value = e.message; }
  finally { relinkBusy.value = false; }
}

const tab = ref('results');                                            // results | events | rules | recordings
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
// ── management (CLOUD_STREAMING_PLAN.md §3.6): this month's spend and the state history ─────────────────────────────
const spend = computed(() => spendItems(props.source.spend_month));
const spendMonth = computed(() => monthText(props.source.spend_month?.month));
const history = computed(() => historyRows(props.source.history));
const HISTORY_FIRST = 5; const historyAll = ref(false);
const historyShown = computed(() => (historyAll.value ? history.value : history.value.slice(0, HISTORY_FIRST)));

async function removeRecording(row) {
  try { await recordingsApi.remove(row.id); if (playing.value?.id === row.id) playing.value = null; await loadRecordings(); emit('refresh'); }
  catch (e) { recListError.value = e.message; }
}
// "Use in project": a project's model runs over the recording, read in place (the tab's start dialog, as Run a model).
const mayUse = computed(() => props.may.stream !== false && props.mayStart);

// ── events and rules (CLOUD_STREAMING_PLAN.md §3.5): only the workspace's own cameras have them ──────────────────
const own = computed(() => props.source.shared !== true && !isPublic(props.source));
const workflowLink = computed(() => (own.value ? workflowFromCamera(props.source) : ''));
const events = ref([]); const evPage = ref(1); const evPages = ref(1); const evCount = ref(0);
const evLoading = ref(false); const evError = ref('');
async function loadEvents(page = evPage.value) {
  evLoading.value = true; evError.value = '';
  try {
    const answer = await streamEvents.list(props.source.id, { page, limit: 20 });
    events.value = answer?.events || []; evPage.value = answer?.page || 1; evPages.value = answer?.pages || 1; evCount.value = answer?.count || 0;
  } catch (e) { evError.value = e.message; }
  finally { evLoading.value = false; }
}
const rulesPage = ref(null); const rulesLoading = ref(false); const rulesError = ref(''); const rulesSaid = ref('');
const rules = computed(() => rulesPage.value?.rules || []);
const ruleLimits = computed(() => rulesPage.value?.limits || {});
const mayRule = computed(() => !!rulesPage.value?.may?.change);
const classChoices = computed(() => ruleClasses(stream.value, rulesPage.value?.classes));
const adding = ref(false); const draft = ref(ruleForm()); const draftErrors = ref({}); const ruleBusy = ref(false);
async function loadRules() {
  rulesLoading.value = true; rulesError.value = '';
  try { rulesPage.value = await streamRules.list(props.source.id); }
  catch (e) { rulesError.value = e.message; }
  finally { rulesLoading.value = false; }
}
function startRule() {
  draft.value = { ...ruleForm(classChoices.value), cooldown_seconds: ruleLimits.value.cooldown_default || ruleForm().cooldown_seconds };
  draftErrors.value = {}; rulesSaid.value = ''; adding.value = true;
}
async function ruleCall(call) {
  ruleBusy.value = true; rulesError.value = '';
  try { const answer = await call(); rulesPage.value = answer; rulesSaid.value = answer?.said || ''; return true; }
  catch (e) {
    if (e.field && ['class_name', 'min_count', 'cooldown_seconds'].includes(e.field)) draftErrors.value = { ...draftErrors.value, [e.field]: e.message };
    else rulesError.value = e.message;
    return false;
  } finally { ruleBusy.value = false; }
}
async function saveRule() {
  draftErrors.value = ruleProblems(draft.value, ruleLimits.value);
  if (Object.keys(draftErrors.value).length || ruleBusy.value) return;
  if (await ruleCall(() => streamRules.add(props.source.id, ruleBody(draft.value)))) adding.value = false;
}
const toggleRule = rule => ruleCall(() => streamRules.update(props.source.id, rule.id, { enabled: !rule.enabled }));
const removeRule = rule => ruleCall(() => streamRules.remove(props.source.id, rule.id));
watch(tab, now => {
  if (now === 'events') loadEvents(1);
  if (now === 'rules') loadRules();
});
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
          <p v-if="asked" class="sp-reason" role="status"><LoaderCircle class="spin" :size="13" aria-hidden="true"/> {{ askedLine }}</p>
          <p v-else-if="source.state_reason" class="sp-reason">{{ source.state_reason }}</p>
          <!-- Phone camera: its phone link -->
          <div v-if="phoned" class="sp-push" aria-labelledby="sp-phone-h">
            <h4 id="sp-phone-h" class="sp-push-title"><Smartphone :size="14" aria-hidden="true"/> Phone link</h4>
            <p v-if="phoneNow && !phoneNow.available" class="sp-reason">Sending a phone's camera to AADML is switched off on this server for now.</p>
            <p v-if="relinkSaid" class="sp-muted" role="status">{{ relinkSaid }}</p>
            <PhoneLinkDetails v-if="newPhone" :phone="newPhone" id-prefix="sp-phone"/>
            <p v-else-if="phoneNow" class="sp-muted">The phone opens this camera's link and sends from its browser. The link was shown once, when it was made. {{ phoneLinkUntil(phoneNow) }}</p>
            <p v-if="relinkError" class="field-error" role="alert">{{ relinkError }}</p>
            <template v-if="mayNewLink">
              <div v-if="relinking" class="sp-rotate-ask" role="group" aria-labelledby="sp-relink-q">
                <p id="sp-relink-q">Make a new phone link? The current one stops working now, and a phone sending with it is disconnected until it opens the new link.</p>
                <span class="sp-rec-acts">
                  <UiButton variant="primary" class="small" :disabled="relinkBusy" @click="newPhoneLink"><LoaderCircle v-if="relinkBusy" class="spin" :size="13" aria-hidden="true"/><Smartphone v-else :size="13" aria-hidden="true"/> New phone link</UiButton>
                  <UiButton class="small" :disabled="relinkBusy" @click="relinking = false">Cancel</UiButton>
                </span>
              </div>
              <UiButton v-else class="small" @click="relinking = true; relinkError = ''"><Smartphone :size="13" aria-hidden="true"/> New phone link</UiButton>
            </template>
          </div>
          <!-- RTMP stream: where its camera or encoder sends -->
          <div v-if="pushed" class="sp-push" aria-labelledby="sp-push-h">
            <h4 id="sp-push-h" class="sp-push-title"><RadioTower :size="14" aria-hidden="true"/> Send to AADML</h4>
            <p v-if="push && !push.available" class="sp-reason">Pushing video to AADML is switched off on this server for now.</p>
            <p v-if="rotateSaid" class="sp-muted" role="status">{{ rotateSaid }}</p>
            <PushDetails v-if="push" :push="push" id-prefix="sp-push"/>
            <p v-if="rotateError" class="field-error" role="alert">{{ rotateError }}</p>
            <template v-if="mayRotate">
              <div v-if="rotating" class="sp-rotate-ask" role="group" aria-labelledby="sp-rotate-q">
                <p id="sp-rotate-q">Make a new stream key? The current one stops working now, and the camera or encoder sending with it is disconnected until you give it the new key.</p>
                <span class="sp-rec-acts">
                  <UiButton variant="primary" class="small" :disabled="rotateBusy" @click="rotateKey"><LoaderCircle v-if="rotateBusy" class="spin" :size="13" aria-hidden="true"/><KeyRound v-else :size="13" aria-hidden="true"/> Rotate key</UiButton>
                  <UiButton class="small" :disabled="rotateBusy" @click="rotating = false">Cancel</UiButton>
                </span>
              </div>
              <UiButton v-else class="small" @click="rotating = true; rotateError = ''"><KeyRound :size="13" aria-hidden="true"/> Rotate key</UiButton>
            </template>
          </div>
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
              <p class="sp-model-name"><strong>{{ streamWhat(stream) }}</strong></p>
              <p class="sp-muted">{{ [stream.project?.name, `${stream.fps} frame${stream.fps === 1 ? '' : 's'} a second`, `started ${started(stream)}`].filter(Boolean).join(' · ') }}</p>
              <p class="sp-muted">{{ endless(stream) ? 'Runs until you stop it.' : `Reads at most ${stream.max_frames} frames.` }}</p>
              <ul v-if="others.length" class="sp-others" aria-label="Earlier streams on this camera">
                <li v-for="s in others" :key="s.id"><span>{{ streamWhat(s) }}, {{ started(s) }}</span><UiBadge :tone="streamState(s)[0]">{{ streamState(s)[1] }}</UiBadge></li>
              </ul>
            </template>
            <p v-else class="sp-empty-text">Choose a model to run on this camera, or read its barcodes. What it finds appears alongside as it works.</p>
          </div>
          <p v-if="!mayStart && startWhy" class="sp-why">{{ startWhy }}</p>
          <div class="sp-model-foot">
            <UiButton v-if="running && stream.may && stream.may.stop" @click="emit('stop-stream', stream)"><Square :size="13" aria-hidden="true"/> Stop</UiButton>
            <UiButton v-else-if="may.stream !== false" variant="primary" :disabled="!mayStart" :title="mayStart ? undefined : startWhy" @click="emit('start')"><Play :size="14" aria-hidden="true"/> Run a model</UiButton>
            <a v-if="workflowLink" class="button" :href="workflowLink" title="Opens the Workflow Builder with this camera's events as the trigger"><Workflow :size="14" aria-hidden="true"/> Build a workflow</a>
          </div>
        </section>
        <!-- This month and the state history -->
        <section v-if="spend.length" class="sp-card sp-manage" aria-labelledby="sp-spend-h">
          <div class="sp-card-bar"><h3 id="sp-spend-h" class="sp-card-title"><Wallet :size="15" aria-hidden="true"/>&nbsp;Spent on this camera</h3><small class="sp-muted">{{ spendMonth || 'This month' }}</small></div>
          <dl class="sp-spend">
            <div v-for="item in spend" :key="item.key" :class="{ total: item.key === 'total' }">
              <dt>{{ item.label }}<small v-if="item.hint">{{ item.hint }}</small></dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </section>
        <section v-if="source.history" class="sp-card sp-manage" aria-labelledby="sp-history-h">
          <div class="sp-card-bar"><h3 id="sp-history-h" class="sp-card-title"><History :size="15" aria-hidden="true"/>&nbsp;State history</h3></div>
          <p v-if="!history.length" class="sp-muted sp-pad">No change yet. Each time this camera goes online or offline, it is listed here, and the workspace's Admins are told when it goes offline.</p>
          <ol v-else class="sp-history">
            <li v-for="e in historyShown" :key="e.key">
              <span class="sp-history-top"><UiBadge :tone="e.badge[0]">{{ e.badge[1] }}</UiBadge><time :datetime="e.at" :title="new Date(e.at).toLocaleString()">{{ e.when }}</time></span>
              <span v-if="e.reason" class="sp-history-reason">{{ e.reason }}</span>
              <small>{{ [e.cause, e.told].filter(Boolean).join('. ') }}</small>
            </li>
          </ol>
          <button v-if="history.length > HISTORY_FIRST" type="button" class="sp-link sp-pad" :aria-expanded="historyAll" @click="historyAll = !historyAll">{{ historyAll ? 'Show fewer' : `Show all ${history.length}` }}</button>
        </section>
        <p v-if="consent" class="sp-consent">{{ consent }}</p>
      </div>

      <!-- Results -->
      <section class="sp-card sp-results" aria-labelledby="sp-results-h">
        <div class="sp-card-bar">
          <div class="sp-tabs" role="tablist" aria-label="What this camera gave">
            <button id="sp-results-h" type="button" role="tab" :aria-selected="tab === 'results'" :class="{ on: tab === 'results' }" @click="tab = 'results'">Results</button>
            <button v-if="own" type="button" role="tab" :aria-selected="tab === 'events'" :class="{ on: tab === 'events' }" @click="tab = 'events'">Events</button>
            <button v-if="own" type="button" role="tab" :aria-selected="tab === 'rules'" :class="{ on: tab === 'rules' }" @click="tab = 'rules'">Rules</button>
            <button v-if="rec" type="button" role="tab" :aria-selected="tab === 'recordings'" :class="{ on: tab === 'recordings' }" @click="tab = 'recordings'">Recordings</button>
          </div>
          <UiButton v-if="tab === 'results' && stream && stream.has_results" class="small" @click="emit('download', stream)"><Download :size="14" aria-hidden="true"/> Download results</UiButton>
          <label v-if="tab === 'recordings'" class="sp-day">Day (UTC) <input v-model="recDay" type="date" class="text-input" :max="today"></label>
          <UiButton v-if="tab === 'events'" class="small" :disabled="evLoading" @click="loadEvents()"><RefreshCw :size="14" aria-hidden="true"/> Refresh</UiButton>
          <UiButton v-if="tab === 'rules' && mayRule && !adding" class="small" :disabled="rules.length >= (ruleLimits.rules || 20)" @click="startRule"><Plus :size="14" aria-hidden="true"/> Add a rule</UiButton>
        </div>
        <!-- Events -->
        <div v-if="tab === 'events'" class="sp-recs">
          <p v-if="evError" class="field-error" role="alert">{{ evError }}</p>
          <p v-else-if="evLoading && !events.length" class="sp-muted" role="status">Loading the events…</p>
          <div v-else-if="!events.length" class="sp-results-empty" role="status">
            <span class="sp-empty-icon"><Bell :size="20" aria-hidden="true"/></span>
            <h4>No events yet</h4>
            <p>An event is kept when a rule matches what a model finds on this camera. Add a rule, then run a model.</p>
          </div>
          <template v-else>
            <ul class="sp-ev-list" aria-label="Events, newest first">
              <li v-for="e in events" :key="e.id">
                <img v-if="e.snapshot_url" :src="e.snapshot_url" :alt="`Frame of ${source.name} when ${e.rule.text}`" referrerpolicy="no-referrer" loading="lazy">
                <span v-else class="sp-ev-none"><ImageOff :size="18" aria-hidden="true"/></span>
                <span class="sp-ev-text"><strong>{{ e.rule.text }}</strong><small>{{ eventTime(e) }}<template v-if="matchedText(e)"> · {{ matchedText(e) }}</template></small>
                  <small v-if="e.model">{{ modelName(e.model) }}<template v-if="e.project"> · {{ e.project.name }}</template><template v-if="e.workflows_started"> · {{ e.workflows_started }} workflow{{ e.workflows_started === 1 ? '' : 's' }} started</template></small></span>
              </li>
            </ul>
            <div v-if="evPages > 1" class="sp-pager">
              <UiButton class="small" :disabled="evLoading || evPage <= 1" @click="loadEvents(evPage - 1)">Newer</UiButton>
              <span class="sp-muted">Page {{ evPage }} of {{ evPages }} · {{ evCount }} events</span>
              <UiButton class="small" :disabled="evLoading || evPage >= evPages" @click="loadEvents(evPage + 1)">Older</UiButton>
            </div>
          </template>
        </div>
        <!-- Rules -->
        <div v-else-if="tab === 'rules'" class="sp-recs">
          <p class="sp-muted">A rule keeps an event when a model running on this camera finds a class in a frame, at most once in its cooldown. A workflow with this camera's events as its trigger starts on each event.</p>
          <form v-if="adding" class="sp-rule-form" @submit.prevent="saveRule">
            <div class="sp-rule-fields">
              <label>Class
                <input v-model="draft.class_name" class="text-input" list="sp-rule-classes" maxlength="64" autocomplete="off" :aria-invalid="!!draftErrors.class_name">
                <datalist id="sp-rule-classes"><option v-for="c in classChoices" :key="c" :value="c"></option></datalist>
                <small v-if="draftErrors.class_name" class="field-error">{{ draftErrors.class_name }}</small>
              </label>
              <label>At least
                <input v-model.number="draft.min_count" class="text-input" type="number" min="1" :max="ruleLimits.count_max || 1000" step="1" :aria-invalid="!!draftErrors.min_count">
                <small v-if="draftErrors.min_count" class="field-error">{{ draftErrors.min_count }}</small>
              </label>
              <label>Cooldown (seconds)
                <input v-model.number="draft.cooldown_seconds" class="text-input" type="number" :min="ruleLimits.cooldown_min || COOLDOWN_MIN" step="1" :aria-invalid="!!draftErrors.cooldown_seconds">
                <small v-if="draftErrors.cooldown_seconds" class="field-error">{{ draftErrors.cooldown_seconds }}</small>
              </label>
            </div>
            <p v-if="!classChoices.length" class="sp-muted">Run a model on this camera to choose from the classes it finds, or type a class name.</p>
            <span class="sp-rec-acts">
              <UiButton type="submit" variant="primary" class="small" :disabled="ruleBusy">Save rule</UiButton>
              <UiButton type="button" class="small" :disabled="ruleBusy" @click="adding = false">Cancel</UiButton>
            </span>
          </form>
          <p v-if="rulesError" class="field-error" role="alert">{{ rulesError }}</p>
          <p v-else-if="rulesSaid" class="sp-muted" role="status">{{ rulesSaid }}</p>
          <p v-if="rulesLoading && !rulesPage" class="sp-muted" role="status">Loading the rules…</p>
          <div v-else-if="rulesPage && !rules.length && !adding" class="sp-results-empty" role="status">
            <span class="sp-empty-icon"><ListChecks :size="20" aria-hidden="true"/></span>
            <h4>No rules yet</h4>
            <p>{{ mayRule ? 'Add a rule, for example "person seen", to keep an event when a model finds it.' : 'A camera manager of this workspace adds the rules.' }}</p>
          </div>
          <ul v-else-if="rules.length" class="sp-rec-list" aria-label="Rules">
            <li v-for="r in rules" :key="r.id" :class="{ off: !r.enabled }">
              <span><strong>{{ r.text }}</strong><small>At most once every {{ cooldownText(r.cooldown_seconds) }}<template v-if="r.project"> · only {{ r.project.name }}</template><template v-if="!r.enabled"> · Off</template><template v-if="r.last_fired_at"> · last event {{ timeAgo(r.last_fired_at) }}</template></small></span>
              <span class="sp-rec-acts">
                <a v-if="r.enabled" class="button small" :href="workflowFromCamera(source, r)" :aria-label="`Build a workflow on the rule ${r.text}`"><Workflow :size="13" aria-hidden="true"/></a>
                <UiButton v-if="mayRule" class="small" :disabled="ruleBusy" @click="toggleRule(r)">{{ r.enabled ? 'Turn off' : 'Turn on' }}</UiButton>
                <UiButton v-if="mayRule" class="small sp-danger" :disabled="ruleBusy" :aria-label="`Remove the rule ${r.text}`" @click="removeRule(r)"><Trash2 :size="13" aria-hidden="true"/></UiButton>
              </span>
            </li>
          </ul>
        </div>
        <!-- Recordings -->
        <div v-else-if="tab === 'recordings'" class="sp-recs">
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
                <UiButton v-if="mayUse" class="small" :title="`Run a project's model over this recording`" @click="emit('start', r)"><FolderInput :size="13" aria-hidden="true"/> Use in project</UiButton>
                <a v-if="r.download_url" class="button small" :href="r.download_url" rel="noopener"><Download :size="13" aria-hidden="true"/> Download</a>
                <UiButton v-if="mayDelete" class="small sp-danger" :aria-label="`Delete the recording ${windowText(r)}`" @click="removeRecording(r)"><Trash2 :size="13" aria-hidden="true"/></UiButton>
              </span>
            </li>
          </ul>
        </div>
        <div v-else-if="!stream" class="sp-results-empty" role="status">
          <span class="sp-empty-icon"><ChartLine :size="20" aria-hidden="true"/></span>
          <h4>Results appear here</h4>
          <p>Run a model or read barcodes on this camera to see what it finds in each frame.</p>
        </div>
        <div v-else class="sp-results-body">
          <p class="sp-frame">
            <template v-if="last">Frame {{ last.frame + 1 }} <span class="sp-at">at {{ clockText(last.t) }}</span></template>
            <template v-else-if="stream.state === 'queued'">Waiting for a worker to read the camera</template>
            <template v-else-if="stream.state === 'running'">{{ stream.model ? 'Placing the model and reading the first frame' : 'Reading the first frame' }}</template>
            <template v-else>No frame was answered</template>
          </p>
          <p v-if="last && last.error" class="sp-frame-error">This frame got no answer: {{ last.error }}</p>
          <div v-if="stream.model" class="sp-counts" :class="{ waiting: !answered }">
            <div v-for="name in names" :key="name" class="sp-count"><span class="sp-num">{{ answered ? countOf(last, name) : '–' }}</span><span class="sp-what">{{ name }}</span></div>
            <div v-if="!names.length" class="sp-count"><span class="sp-num">{{ answered ? 0 : '–' }}</span><span class="sp-what">found</span></div>
          </div>
          <section v-if="stream.read_codes" class="sp-codes" aria-labelledby="sp-codes-h">
            <h4 id="sp-codes-h">Barcodes read <small>newest first</small></h4>
            <p v-if="last && !last.error && frameCodesText(last)" class="sp-muted">This frame: {{ frameCodesText(last) }}</p>
            <p v-if="!codes.length" class="sp-muted">{{ running ? 'No barcode or QR code read yet. Hold one in front of the camera.' : 'No barcode or QR code was read.' }}</p>
            <table v-else class="sp-code-table">
              <thead><tr><th scope="col">Type</th><th scope="col">Value</th><th scope="col">Frame time</th></tr></thead>
              <tbody>
                <tr v-for="c in codes" :key="c.key"><td class="sp-code-type">{{ c.type }}</td><td class="sp-code-value">{{ c.value }}</td><td class="sp-code-at">{{ clockText(c.t) }} <small>frame {{ c.frame + 1 }}</small></td></tr>
              </tbody>
            </table>
          </section>
          <div v-if="stream.model && bars.length" class="sp-strip" title="Everything found in each of the newest frames">
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
.sp-codes{display:grid;gap:8px}
.sp-codes h4{margin:0;font-size:14px;color:#17243b}
.sp-codes h4 small{font-weight:400;color:#64748b}
.sp-code-table{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
.sp-code-table th{text-align:left;font-size:12px;font-weight:600;color:#64748b;padding:6px 8px;border-bottom:1px solid #eef1f5}
.sp-code-table th:first-child{width:110px}.sp-code-table th:last-child{width:120px}
.sp-code-table td{padding:8px;border-bottom:1px solid #f1f4f8;vertical-align:top}
.sp-code-type{font-size:12px;font-weight:600;color:#475569}
.sp-code-value{color:#17243b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.sp-code-at{color:#475569;font-variant-numeric:tabular-nums;white-space:nowrap}
.sp-code-at small{display:block;color:#94a3b8;font-size:11px}
.sp-ended.failed{color:#b42318}
.sp-link{align-self:flex-start;border:0;background:none;padding:0;min-height:32px;color:var(--aadml-primary);text-decoration:underline;font:inherit;font-size:13px;cursor:pointer}
.sp-rec{display:grid;gap:8px;padding:12px 14px;border-top:1px solid #eef1f5}
.sp-push{display:grid;gap:10px;padding:12px 14px;border-top:1px solid #eef1f5}
.sp-push-title{display:flex;align-items:center;gap:6px;margin:0;font-size:13px;font-weight:600;color:#1d2a42}
.sp-push > .sp-reason{margin:0;border-radius:6px}
.sp-rotate-ask{display:grid;gap:8px;padding:10px 12px;border-radius:8px;background:#f8fafc}
.sp-rotate-ask p{margin:0;font-size:13px;line-height:1.5;color:#33415a}
.sp-push > .button,.sp-push > button{justify-self:start}
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
.sp-manage{margin-top:12px}
.sp-pad{padding:12px 14px}
.sp-spend{margin:0;padding:6px 14px 10px}
.sp-spend > div{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:6px 0}
.sp-spend > div.total{border-top:1px solid #eef1f5;margin-top:4px;padding-top:8px;font-weight:600}
.sp-spend dt{display:flex;flex-direction:column;gap:1px;font-size:13px;color:#33415a}
.sp-spend dt small{font-size:11px;color:#64748b;font-weight:400}
.sp-spend dd{margin:0;font-size:13px;color:#17243b;font-variant-numeric:tabular-nums}
.sp-history{list-style:none;margin:0;padding:6px 14px 8px;display:grid;gap:0}
.sp-history li{display:flex;flex-direction:column;gap:3px;padding:8px 0;border-bottom:1px solid #f0f2f6}
.sp-history li:last-child{border-bottom:0}
.sp-history-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sp-history time{font-size:12px;color:#64748b;white-space:nowrap}
.sp-history-reason{font-size:12px;color:#33415a;line-height:1.5;overflow-wrap:anywhere}
.sp-history small{font-size:11px;color:#64748b}
.sp-rec-list li.off strong{color:#64748b}
.sp-ev-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.sp-ev-list li{display:flex;align-items:center;gap:12px;padding:8px;border:1px solid #eef1f5;border-radius:8px}
.sp-ev-list img,.sp-ev-none{flex-shrink:0;width:96px;aspect-ratio:16/9;object-fit:cover;border-radius:6px;background:#0d1320}
.sp-ev-none{display:grid;place-items:center;color:#9aa6b8}
.sp-ev-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.sp-ev-text strong{font-size:14px;color:#17243b;overflow-wrap:anywhere}
.sp-ev-text small{color:#64748b;font-size:12px;overflow-wrap:anywhere}
.sp-pager{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sp-rule-form{display:grid;gap:10px;padding:12px;border:1px solid #eef1f5;border-radius:10px;background:#f8fafc}
.sp-rule-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.sp-rule-fields label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#33415a}
.sp-rule-fields input{min-height:36px}
.spin{animation:sp-spin 1.1s linear infinite}
@keyframes sp-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spin{animation:none}}
@media(max-width:860px){.sp-body{grid-template-columns:1fr}.sp-results{min-height:320px}.sp-model{min-height:0}}
</style>
