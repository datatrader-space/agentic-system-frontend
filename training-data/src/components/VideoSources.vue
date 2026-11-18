<script setup>
// The Cloud Streaming tab's saved cameras (CLOUD_STREAMING_PLAN.md 3.1, 3.2 item 2 and section 7): the "Video sources"
// card (chips by state, list or grid, a row opens the source's details), the Summary and Connectors cards beside it,
// and the "Add video source" dialog (Camera URL, a connector camera and an RTMP stream work; Verkada is said to be
// coming). An RTMP stream (CLOUD_STREAMING_PLAN.md §14): its camera or encoder pushes to AADML; adding it shows its
// Server and Stream key once (PushDetails.vue), with a warning to keep the key secret. From a
// source's own page (VideoSourcePage.vue, in the list's place; `page` tells the tab): watch it live, check it, run a
// model on it (the tab's own dialog, through the `start` event), see its results, edit or remove it. Public cameras
// AADML publishes are read-only. "Scan from phone" (CLOUD_STREAMING_PLAN.md 3.2 item 5): a one-time pairing code shown
// as a QR code; the phone scans the camera's label and what it read fills the Camera URL form here (backend
// camera_pairing.py). Nothing is added until the person checks the form and presses Add camera.
// Backend: streaming_api.py workspace/video-sources/ (list, add), <id>/ (one, change, remove), <id>/check/,
// <id>/live/. Seeing and watching need Overview in the workspace; every change needs Manage, and the server decides.
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import {
  Activity, ArrowRight, Cctv, Check, CircleQuestionMark, Cloud, Copy, Film, ImageOff, LayoutGrid, Link, List,
  LoaderCircle, Lock, Pencil, Play, Plug, RadioTower, RefreshCw, Smartphone, Trash2, TriangleAlert, Tv, Wallet, Webcam, Wifi,
} from 'lucide-vue-next';
import LiveView from './LiveView.vue';
import PushDetails from './PushDetails.vue';
import VideoSourcePage from './VideoSourcePage.vue';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { modelName, timeAgo } from '../api/workspace.js';
import { machinesApi, discoverWhy, foundAddress, foundLine, FOUND_NEXT } from '../api/machines.js';
import { Search } from 'lucide-vue-next';
import {
  videoSources, SOURCE_FILTERS, CONSENT_TEXT, SOURCE_NAME_LIMIT, CREDENTIAL_LIMIT, addressShown,
  sourceState, sourceCounts, filterSources, sourceShown, sourceKindLabel, sourceLine, runningText, isPublic,
  thumbnailOf, lastFrameText, limitText, summaryItems, sourceForm, sourceFormProblems, sourceBody, canWatch, streamState,
  connectorRows, connectorLine, sizeText,
  pairingApi, PAIRING_POLL_MS, formFromScan, privateHost, pushDetails,
} from '../api/streaming.js';
import { qrOf } from '../api/phone.js';

const props = defineProps({
  // The projects a stream may be started in (the streams list's options), offered as a source's default project.
  projects: { type: Array, default: () => [] },
  mayStart: { type: Boolean, default: true },
  startWhy: { type: String, default: '' },
});
const emit = defineEmits(['start', 'loaded', 'changed', 'open-stream', 'page', 'stop-stream', 'download']);

// ── the list ─────────────────────────────────────────────────────────────────────────────────────
const page = ref(null); const error = ref(''); const loading = ref(false);
const said = ref(''); const announce = ref('');
const sources = computed(() => page.value?.sources || []);
const limits = computed(() => page.value?.limits || {});
const may = computed(() => page.value?.may || {});
// The list says whether a source may be added (may.add); each source says what may be done to it (may.check,
// may.change, may.remove, may.stream), so a person who sees sources but may not change them gets no buttons that would
// be refused. A public camera says false to all but stream.
const mayManage = computed(() => may.value.add !== false && may.value.manage !== false);
const mayDo = (s, what) => !s?.may || s.may[what] !== false;
const filter = ref(''); const view = ref('list'); const helpOpen = ref(''); // '' | 'sources' | 'connectors'
const counts = computed(() => sourceCounts(sources.value));
const visible = computed(() => filterSources(sources.value, { state: filter.value }));
// The limit counts the workspace's own sources; public cameras are not its own.
const ownCount = computed(() => sources.value.filter(s => !isPublic(s)).length);
const atLimit = computed(() => !!limits.value.sources && ownCount.value >= Number(limits.value.sources));
const addWhy = computed(() => {
  if (!mayManage.value) return may.value.reason || 'You need the Manage right in this workspace to add a video source.';
  if (atLimit.value) return `This workspace has ${limitText(ownCount.value, limits.value.sources)}. Remove one to add another.`;
  return '';
});
const ready = computed(() => !!page.value);
const ICONS = { sources: Cctv, online: Wifi, streams: Activity, attention: TriangleAlert, frames: Film, spend: Wallet };
const summary = computed(() => summaryItems(page.value?.summary, page.value?.limits).map(item => ({ ...item, icon: ICONS[item.key] })));
const broken = ref(new Set());
let gone = false; let timer = null;

async function load() {
  if (loading.value) return;
  loading.value = true;
  try {
    const body = await videoSources.list();
    page.value = body; error.value = ''; broken.value = new Set();
    emit('loaded', body);
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; schedule(); }
}
// States and thumbnails change on their own (a camera goes offline; a thumbnail link lasts 15 minutes): read the list
// again every minute while the tab is open.
function schedule() {
  clearTimeout(timer); timer = null;
  if (!gone) timer = setTimeout(load, 60000);
}
load();

function tell(text) { said.value = text; announce.value = text; }
const thumb = source => (broken.value.has(source.id) ? '' : thumbnailOf(source));
function thumbFailed(source) { broken.value = new Set([...broken.value, source.id]); }
const chipLabel = f => `${f.label} · ${counts.value[f.value] ?? 0}`;
const toggleHelp = which => { helpOpen.value = helpOpen.value === which ? '' : which; };

// ── one source's details ─────────────────────────────────────────────────────────────────────────
const detailId = ref(null); const detailFull = ref(null); const detailError = ref('');
// The row of the list (kept fresh by its reads), with what the source's own read adds (its streams, the consent).
const detail = computed(() => {
  if (detailId.value === null) return null;
  const row = sources.value.find(s => s.id === detailId.value) || (detailFull.value?.id === detailId.value ? detailFull.value : null);
  return row ? { ...(detailFull.value?.id === detailId.value ? detailFull.value : {}), ...row } : null;
});
const detailStreams = computed(() => (Array.isArray(detailFull.value?.streams) ? detailFull.value.streams : []));
async function openDetail(source) {
  detailId.value = source.id; detailFull.value = null; detailError.value = '';
  try {
    const body = await videoSources.get(source.id);
    const full = body?.source || body;
    if (detailId.value === source.id && full) detailFull.value = { ...full, id: full.id ?? source.id, streams: full.streams ?? body?.streams };
  } catch (e) { if (detailId.value === source.id) detailError.value = e.message; }
}
function closeDetail() { detailId.value = null; detailFull.value = null; checkError.value = ''; }
// The source's own read again (a stream started or stopped on it).
async function refreshDetail() {
  const id = detailId.value;
  if (id === null) return;
  try {
    const body = await videoSources.get(id);
    const full = body?.source || body;
    if (detailId.value === id && full) detailFull.value = { ...full, id: full.id ?? id, streams: full.streams ?? body?.streams };
  } catch (e) { if (detailId.value === id) detailError.value = e.message; }
}
watch(() => detailId.value !== null, open => emit('page', open));
const detailMay = computed(() => (detail.value ? {
  check: mayDo(detail.value, 'check'), change: mayDo(detail.value, 'change'), remove: mayDo(detail.value, 'remove'),
  stream: mayDo(detail.value, 'stream'),
} : {}));
// Another dialog takes over from the details.
function from(fn) { return (source) => { closeDetail(); fn(source); }; }
const watchFrom = from(s => { watching.value = s; });
const startFrom = from(s => emit('start', s));
const editFrom = from(s => openEdit(s));
const removeFrom = from(s => askRemove(s));
function openStream(stream) { closeDetail(); emit('open-stream', stream.id); }
const streamWhen = stream => timeAgo(stream.started_at || stream.created_at);

// ── "Watch live": anyone who sees the source may watch it (LiveView.vue) ─────────────────────────
const watching = ref(null);

// ── "Check now" ──────────────────────────────────────────────────────────────────────────────────
const checking = ref(null); const checkError = ref('');
async function check(source) {
  if (checking.value) return;
  checking.value = source.id; checkError.value = '';
  try {
    const body = await videoSources.check(source.id);
    const row = body?.source || null;
    if (row && page.value) page.value = { ...page.value, sources: page.value.sources.map(s => (s.id === row.id ? { ...s, ...row } : s)) };
    const now = row || source;
    tell(body?.said || `${now.name} is ${sourceState(now)[1].toLowerCase()}${now.state_reason ? `: ${now.state_reason}` : '.'}`);
    load();
  } catch (e) { checkError.value = e.message; }
  finally { checking.value = null; }
}

// ── "Add video source" and "Edit" ────────────────────────────────────────────────────────────────
const WAYS = [
  { id: 'connector', name: 'Connect a camera', icon: Webcam },
  { id: 'url', name: 'Camera URL', icon: Link },
  { id: 'phone', name: 'Scan from phone', icon: Smartphone },
  { id: 'verkada', name: 'Verkada', icon: Cloud },
  { id: 'rtmp', name: 'RTMP stream', icon: RadioTower },
];
const SYSTEMS = ['Windows', 'macOS', 'Linux'];
const editorOpen = ref(false); const editing = ref(null); const way = ref('url'); const system = ref('Windows');
const form = ref(sourceForm()); const fieldErrors = ref({}); const formError = ref(''); const saving = ref(false);
const consentNote = ref(''); const addedSaid = ref('');
// The push details of the RTMP stream just added, its stream key with them: shown until the dialog closes, never kept.
const addedPush = ref(null);
// The projects offered: those a stream may start in, and the source's own default project when it is not one of them.
const projectChoices = computed(() => {
  const list = props.projects.map(p => ({ ref: p.ref, name: p.name }));
  const own = editing.value?.project;
  if (own?.ref && !list.some(p => p.ref === own.ref)) list.push({ ref: own.ref, name: own.name || own.ref });
  return list;
});
const shownNow = computed(() => addressShown(form.value.address));

function openAdd() {
  if (addWhy.value || !page.value) return;
  editing.value = null; way.value = 'url'; form.value = sourceForm();
  fieldErrors.value = {}; formError.value = ''; consentNote.value = ''; addedSaid.value = ''; said.value = '';
  addedPush.value = null;
  stopPairing(); pairing.value = null; scannedSaid.value = '';
  editorOpen.value = true;
}

// ── "Scan from phone": a pairing code, then the phone's value fills the Camera URL form ─────────────
const pairing = ref(null); const pairState = ref(''); const pairError = ref(''); const pairBusy = ref(false);
const scannedSaid = ref('');
const pairQr = computed(() => qrOf(pairing.value?.url));
const pairUntil = computed(() => (pairing.value?.pairing?.expires_at
  ? new Date(pairing.value.pairing.expires_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''));
let pairTimer = null;
const parsedHost = text => { try { return new URL(text).hostname; } catch { return ''; } };
function stopPairing() { clearTimeout(pairTimer); pairTimer = null; }
async function showPairing() {
  if (pairBusy.value) return;
  pairBusy.value = true; pairError.value = ''; scannedSaid.value = '';
  try {
    pairing.value = await pairingApi.make(); pairState.value = 'waiting';
    pollPairing();
  } catch (e) { pairError.value = e.message; }
  finally { pairBusy.value = false; }
}
async function pollPairing() {
  stopPairing();
  const id = pairing.value?.pairing?.id;
  if (!id || gone || !editorOpen.value || way.value !== 'phone') return;
  try {
    const answer = await pairingApi.get(id);
    if (pairing.value?.pairing?.id !== id) return;
    if (answer?.state === 'scanned') {
      const filled = formFromScan(answer.value);
      if (filled.refused) {
        pairing.value = null; pairState.value = '';
        scannedSaid.value = filled.refused; tell(filled.refused);
        return;
      }
      form.value = { ...form.value, ...filled };
      fieldErrors.value = {}; pairing.value = null; pairState.value = '';
      // An address on the camera's own network (the usual CCTV case) is reached through one of your machines.
      const local = !!filled.address && privateHost(parsedHost(filled.address));
      scannedSaid.value = !filled.address
        ? 'Your phone filled in the name from the label. Enter the camera address, tick the consent and press Add camera.'
        : local ? 'Your phone filled in the camera address. It is an address on your own network, so choose the machine the camera is on, give it a name, tick the consent and press Add camera.'
          : 'Your phone filled in the camera address. Check it, give the camera a name, tick the consent and press Add camera.';
      way.value = local ? 'connector' : 'url';
      tell(scannedSaid.value);
      await nextTick(); document.getElementById(filled.address ? 'vs-name' : 'vs-address')?.focus();
      return;
    }
    if (answer?.state === 'ended') { pairState.value = 'ended'; return; }
    pairState.value = 'waiting';
  } catch (e) { pairError.value = e.message; }
  if (!gone && editorOpen.value && way.value === 'phone') pairTimer = setTimeout(pollPairing, PAIRING_POLL_MS);
}
watch(() => editorOpen.value && way.value === 'phone', on => { if (!on) stopPairing(); else if (pairing.value && pairState.value === 'waiting') pollPairing(); });
function consentLine(source) {
  if (!source?.consent_at) return '';
  const who = typeof source.consent_by === 'string' ? source.consent_by : source.consent_by?.name || source.consent_by?.email || '';
  const when = new Date(source.consent_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${who ? `${who} confirmed` : 'Confirmed'} on ${when} that this camera may be connected.`;
}
async function openEdit(source) {
  editing.value = source; way.value = 'url'; form.value = sourceForm(source);
  fieldErrors.value = {}; formError.value = ''; consentNote.value = consentLine(source); addedSaid.value = ''; said.value = '';
  editorOpen.value = true;
  try {
    const body = await videoSources.get(source.id);
    const full = body?.source || body;
    if (!editorOpen.value || editing.value?.id !== source.id || !full) return;
    editing.value = { ...source, ...full };
    consentNote.value = consentLine(editing.value);
    // The values the person has not touched yet follow the server's.
    const was = sourceForm(source); const now = sourceForm(editing.value);
    for (const key of ['name', 'username', 'project']) if (form.value[key] === was[key]) form.value[key] = now[key];
  } catch { /* the row's own values are enough to edit */ }
}
function closeEditor() { if (!saving.value) { editorOpen.value = false; addedPush.value = null; } }
// An RTMP stream: the "RTMP stream" tab, or editing one (its name and default project only).
const pushing = computed(() => (editing.value ? editing.value.kind === 'rtmp' : way.value === 'rtmp'));
watch(way, () => { if (addedPush.value) { addedPush.value = null; addedSaid.value = ''; } });
function addAnotherPush() { addedPush.value = null; addedSaid.value = ''; }
function checkField(name) {
  const problems = sourceFormProblems(form.value, { editing: !!editing.value, pushing: pushing.value });
  fieldErrors.value = { ...fieldErrors.value, [name]: problems[name] || '' };
}
const FIELDS = ['machine', 'name', 'address', 'username', 'password', 'project', 'consent'];
// A camera on one of the workspace's machines (CLOUD_STREAMING_PLAN.md §11): the "Connect a camera" tab, or editing one.
const machineRows = ref(null); const machinesError = ref('');
const connecting = computed(() => (editing.value ? editing.value.kind === 'connector' : way.value === 'connector'));
const usableMachines = computed(() => (machineRows.value || []).filter(m => m.state !== 'removed'));
async function loadMachines() {
  machinesError.value = '';
  try { machineRows.value = (await machinesApi.list())?.machines || []; }
  catch (e) { machinesError.value = e.message; machineRows.value = []; }
}
watch(() => editorOpen.value && way.value === 'connector' && !editing.value, open => { if (open && machineRows.value === null) loadMachines(); });
const machineLine = m => `${m.name} (${m.state === 'online' ? 'online' : 'offline'}${m.agent_version ? `, agent ${m.agent_version}` : ''})`;

// "Find cameras" (CLOUD_STREAMING_PLAN.md §11, discovery): the chosen machine looks for ONVIF cameras on its network
// (machinesApi.discover, agent 1.6.0) and the page asks for its answer every few seconds. Picking one fills the address
// with its host; the person completes its stream path and credentials. The server decides who may and which machine.
const FIND_POLL_MS = 3000; const FIND_POLLS = 60;      // three minutes: a machine's first search downloads the image
const finding = ref(null); const findError = ref(''); const foundPicked = ref('');
let findTimer = null; let findPolls = 0; let findRun = 0;
const chosenMachine = computed(() => usableMachines.value.find(m => String(m.id) === String(form.value.machine)) || null);
const findWhy = computed(() => discoverWhy(chosenMachine.value));
function resetFinding() {
  clearTimeout(findTimer); findTimer = null; findRun += 1;
  finding.value = null; findError.value = ''; foundPicked.value = '';
}
async function findCameras() {
  const machine = chosenMachine.value;
  if (!machine || findWhy.value || finding.value?.state === 'looking') return;
  resetFinding();
  const run = findRun;
  try {
    const answer = await machinesApi.discover(machine.id);
    if (run !== findRun) return;
    finding.value = answer?.discovery || null; findPolls = 0;
    if (finding.value?.state === 'looking') findTimer = setTimeout(() => pollFinding(machine.id, finding.value.id, run), FIND_POLL_MS);
  } catch (e) { if (run === findRun) findError.value = e.message; }
}
async function pollFinding(machineId, jobId, run) {
  if (run !== findRun || gone) return;
  findPolls += 1;
  try {
    const answer = await machinesApi.discovery(machineId, jobId);
    if (run !== findRun) return;
    finding.value = answer?.discovery || finding.value;
  } catch (e) {
    if (run === findRun) findError.value = e.message;
    return;
  }
  if (finding.value?.state !== 'looking') return;
  if (findPolls >= FIND_POLLS) {
    finding.value = { ...finding.value, state: 'waiting',
      said: `${finding.value.machine?.name || 'The machine'} has not answered yet. Press Find cameras again in a minute to see its answer.` };
    return;
  }
  findTimer = setTimeout(() => pollFinding(machineId, jobId, run), FIND_POLL_MS);
}
function pickFound(camera) {
  const address = foundAddress(camera);
  if (!address) return;
  form.value.address = address;
  if (!String(form.value.name || '').trim() && camera?.name) form.value.name = String(camera.name).slice(0, SOURCE_NAME_LIMIT);
  fieldErrors.value = { ...fieldErrors.value, address: '' };
  foundPicked.value = `${foundLine(camera)}: ${FOUND_NEXT}`;
  nextTick(() => document.getElementById('vs-address')?.focus());
}
watch(() => [form.value.machine, editorOpen.value, way.value], resetFinding);
onUnmounted(() => clearTimeout(findTimer));

async function save() {
  formError.value = ''; addedSaid.value = '';
  const isEdit = !!editing.value;
  if (!isEdit && !connecting.value) form.value.machine = '';            // a camera address: no machine
  const problems = sourceFormProblems(form.value, { editing: isEdit, connector: connecting.value, pushing: pushing.value });
  fieldErrors.value = problems;
  const first = FIELDS.find(f => problems[f]);
  if (first) { await nextTick(); document.getElementById(`vs-${first}`)?.focus(); return; }
  if (saving.value) return;
  const body = sourceBody(form.value, { editing: isEdit, original: editing.value, pushing: pushing.value });
  if (isEdit && !Object.keys(body).length) { editorOpen.value = false; tell('Nothing changed.'); return; }
  saving.value = true;
  try {
    const answer = isEdit ? await videoSources.update(editing.value.id, body) : await videoSources.add(body);
    const name = answer?.source?.name || body.name || editing.value?.name || 'The source';
    if (isEdit) {
      tell(answer?.said || `${name} is saved.`);
      editorOpen.value = false;
    } else {
      // The dialog stays open for another camera; Done closes it.
      addedSaid.value = answer?.said || `${name} is added. Open it in the list and press Check now to see a frame from it.`;
      tell(addedSaid.value);
      if (pushing.value) addedPush.value = { details: pushDetails(answer?.source?.push) };
      form.value = sourceForm(); fieldErrors.value = {};
    }
    load(); emit('changed');
  } catch (e) {
    if (e.field && FIELDS.includes(e.field)) fieldErrors.value = { ...fieldErrors.value, [e.field]: e.message };
    else formError.value = e.message;
    if (e.code === 'timeout' || e.code === 'network') load();
  } finally { saving.value = false; }
}
function tabKeys(event, index, list, pick, prefix) {
  const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: list.length - 1 };
  if (!(event.key in keys)) return;
  event.preventDefault();
  const next = list[(keys[event.key] + list.length) % list.length];
  pick(next);
  document.getElementById(`${prefix}-${String(next.id ?? next).toLowerCase()}`)?.focus();
}

// ── "Remove", always confirmed first; its recordings kept until their days are over (the default) or deleted now ──
const removing = ref(null); const removeBusy = ref(false); const removeError = ref(''); const removeRecordings = ref('keep');
const removingKept = computed(() => Number(removing.value?.recording?.stored_bytes) || 0);
// The choice is offered when the camera has recordings, or when its page has not said yet whether it has.
const removeAsks = computed(() => !!removing.value && (!removing.value.recording || removingKept.value > 0));
function askRemove(source) { removing.value = source; removeError.value = ''; removeRecordings.value = 'keep'; }
async function confirmRemove() {
  if (!removing.value || removeBusy.value) return;
  removeBusy.value = true;
  try {
    const answer = await videoSources.remove(removing.value.id, { recordings: removeAsks.value ? removeRecordings.value : 'keep' });
    tell(answer?.said || `${removing.value.name} is removed. Its past streams and their results are kept.`);
    if (watching.value?.id === removing.value.id) watching.value = null;
    if (detailId.value === removing.value.id) closeDetail();      // its page is gone with it
    removing.value = null;
    load(); emit('changed');
  } catch (e) {
    removeError.value = e.message;
    if (e.code === 'timeout' || e.code === 'network') load();
  } finally { removeBusy.value = false; }
}

// ── the Connectors card: the workspace's machines that have cameras (the machines list and the sources) ────────────
const connectorMachines = ref(null);
async function loadConnectors() {
  try { connectorMachines.value = (await machinesApi.list())?.machines || []; }
  catch { connectorMachines.value = []; }          // the sources' own machine names and states are shown then
}
watch(() => sources.value.some(s => s.kind === 'connector'), has => { if (has && connectorMachines.value === null) loadConnectors(); }, { immediate: true });
watch(page, () => { if (connectorMachines.value !== null) loadConnectors(); });
const connectors = computed(() => connectorRows(connectorMachines.value || machineRows.value || [], sources.value));
function connectCamera() {
  openAdd();
  if (editorOpen.value) way.value = 'connector';
}

defineExpose({ load, openAdd, addWhy, ready, refreshDetail, closeDetail });
onUnmounted(() => { gone = true; clearTimeout(timer); stopPairing(); });
</script>

<template>
  <div class="vs-root">
  <VideoSourcePage v-if="detail" :source="detail" :streams="detailStreams" :streams-loaded="!!detailFull"
                   :streams-error="detailError" :may="detailMay" :may-start="mayStart" :start-why="startWhy"
                   :checking="checking === detail.id" :check-error="checkError" :consent="isPublic(detail) ? '' : consentLine(detail)"
                   @back="closeDetail" @check="check(detail)" @edit="openEdit(detail)" @remove="askRemove(detail)"
                   @start="emit('start', detail, $event)" @stop-stream="emit('stop-stream', $event)" @download="emit('download', $event)"
                   @open-stream="openStream($event)" @refresh="refreshDetail(); load()"/>
  <div v-else class="vs-layout">
    <!-- Video sources -->
    <section class="vs-card" aria-labelledby="vs-heading" :aria-busy="loading">
      <header class="vs-bar">
        <div class="vs-title">
          <h3 id="vs-heading">Video sources</h3>
          <button type="button" class="vs-help-btn" aria-label="About video sources" :aria-expanded="helpOpen==='sources'" aria-controls="vs-help-sources" @click="toggleHelp('sources')"><CircleQuestionMark :size="15" aria-hidden="true"/></button>
        </div>
        <div class="vs-tools">
          <div v-if="page" class="vs-chips" role="group" aria-label="Show sources">
            <button v-for="f in SOURCE_FILTERS" :key="f.value" type="button" class="vs-chip" :aria-pressed="filter===f.value" :aria-label="`${f.label}, ${counts[f.value] ?? 0}`" @click="filter=f.value">{{ chipLabel(f) }}</button>
          </div>
          <div class="vs-views" role="group" aria-label="Show video sources as">
            <button type="button" :aria-pressed="view==='list'" aria-label="List" title="List" @click="view='list'"><List :size="16" aria-hidden="true"/></button>
            <button type="button" :aria-pressed="view==='grid'" aria-label="Grid" title="Grid" @click="view='grid'"><LayoutGrid :size="16" aria-hidden="true"/></button>
            <button type="button" aria-label="Refresh video sources" title="Refresh" :disabled="loading" @click="load"><RefreshCw :size="15" :class="{ spin: loading }" aria-hidden="true"/></button>
          </div>
        </div>
      </header>
      <p v-if="helpOpen==='sources'" id="vs-help-sources" class="vs-helptext">A video source is a camera saved in this workspace: AADML connects to it only while you check it, watch it or run a stream on it. Public cameras are ones AADML shares with every workspace to try; they cannot be changed.<template v-if="page && limits.sources"> This workspace has {{ limitText(ownCount, limits.sources) }}.</template></p>

      <div v-if="said" class="notice vs-notice" role="status"><Check :size="16" aria-hidden="true"/><span>{{ said }}</span></div>
      <p v-if="page && addWhy" class="vs-why">{{ addWhy }}</p>
      <div v-if="error" class="vs-error" role="alert">
        <span>{{ error }}</span>
        <UiButton :disabled="loading" @click="load"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton>
      </div>

      <p v-if="!page && !error" class="vs-muted">Loading video sources…</p>
      <div v-else-if="page && !sources.length" class="vs-empty">
        <span class="vs-empty-icon"><Cctv :size="22" aria-hidden="true"/></span>
        <h4>No video source yet</h4>
        <p>Save a camera by its address once, then watch it or start a stream on it whenever you need its frames answered.</p>
        <UiButton v-if="!addWhy" variant="primary" @click="openAdd">Add video source</UiButton>
      </div>
      <div v-else-if="page && !visible.length" class="vs-empty" role="status">
        <h4>No source here</h4>
        <p><button type="button" class="vs-link" @click="filter=''">Show all sources</button></p>
      </div>

      <!-- The list -->
      <div v-else-if="page && view==='list'" class="vs-table-wrap">
        <table class="vs-table">
          <thead><tr><th scope="col">Source</th><th scope="col">Workflows</th><th scope="col">Status</th><th scope="col"><span class="vs-sr">Details</span></th></tr></thead>
          <tbody>
            <tr v-for="s in visible" :key="s.id">
              <td>
                <span class="vs-name">
                  <span class="vs-thumb small">
                    <img v-if="thumb(s)" :src="thumb(s)" alt="" loading="lazy" referrerpolicy="no-referrer" @error="thumbFailed(s)">
                    <Cctv v-else :size="16" aria-hidden="true"/>
                  </span>
                  <span><strong>{{ s.name }}</strong><small>{{ sourceLine(s) }}</small></span>
                </span>
              </td>
              <td class="vs-flows">{{ runningText(s) }}</td>
              <td>
                <span class="vs-badges">
                  <UiBadge :tone="sourceState(s)[0]">{{ sourceState(s)[1] }}</UiBadge>
                  <UiBadge v-if="isPublic(s)" tone="purple">Public</UiBadge>
                </span>
                <small class="vs-when">{{ lastFrameText(s) }}</small>
              </td>
              <td class="vs-go"><button type="button" class="vs-open" :aria-label="`Open ${s.name}`" @click="openDetail(s)"><ArrowRight :size="16" aria-hidden="true"/></button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- The grid -->
      <ul v-else-if="page" class="vs-grid">
        <li v-for="s in visible" :key="s.id" class="vs-tile">
          <div class="vs-thumb">
            <img v-if="thumb(s)" :src="thumb(s)" :alt="`Newest frame from ${s.name}`" loading="lazy" referrerpolicy="no-referrer" @error="thumbFailed(s)">
            <span v-else class="vs-thumb-none"><ImageOff :size="22" aria-hidden="true"/><small>No frame yet</small></span>
            <span class="vs-tile-badges">
              <UiBadge :tone="sourceState(s)[0]">{{ sourceState(s)[1] }}</UiBadge>
              <UiBadge v-if="isPublic(s)" tone="purple">Public</UiBadge>
            </span>
          </div>
          <div class="vs-tile-body">
            <div>
              <h4>{{ s.name }}</h4>
              <p>{{ sourceLine(s) }}</p>
              <p class="vs-when">{{ lastFrameText(s) }} · {{ runningText(s) === '—' ? 'no stream running' : runningText(s) }}</p>
            </div>
            <button type="button" class="vs-open" :aria-label="`Open ${s.name}`" @click="openDetail(s)"><ArrowRight :size="16" aria-hidden="true"/></button>
          </div>
        </li>
      </ul>
      <p class="vs-sr" aria-live="polite">{{ announce }}</p>
    </section>

    <aside class="vs-side">
      <section class="vs-card vs-panel" aria-labelledby="vs-summary-h">
        <header class="vs-bar"><h3 id="vs-summary-h">Summary</h3></header>
        <dl class="vs-summary">
          <div v-for="item in summary" :key="item.key" :title="page ? item.hint : undefined">
            <dt><component :is="item.icon" :size="15" aria-hidden="true"/>{{ item.label }}</dt>
            <dd>{{ page ? item.value : '–' }}</dd>
          </div>
        </dl>
      </section>

      <section class="vs-card vs-panel" aria-labelledby="vs-connectors-h">
        <header class="vs-bar">
          <div class="vs-title">
            <h3 id="vs-connectors-h">Connectors</h3>
            <button type="button" class="vs-help-btn" aria-label="About connectors" :aria-expanded="helpOpen==='connectors'" aria-controls="vs-help-connectors" @click="toggleHelp('connectors')"><CircleQuestionMark :size="15" aria-hidden="true"/></button>
          </div>
        </header>
        <p v-if="helpOpen==='connectors'" id="vs-help-connectors" class="vs-helptext">A connector is a small program on a computer in your own network. It reaches out to AADML, so cameras that are not on the internet can be used without opening a port on your router.</p>
        <ul v-if="connectors.length" class="vs-connectors" aria-label="Machines with cameras">
          <li v-for="c in connectors" :key="c.id">
            <span class="vs-connector-name"><strong>{{ c.name }}</strong><small>{{ connectorLine(c) }}</small></span>
            <UiBadge :tone="c.badge[0]">{{ c.badge[1] }}</UiBadge>
          </li>
        </ul>
        <div v-else class="vs-empty vs-empty-plain">
          <span class="vs-empty-icon"><Plug :size="20" aria-hidden="true"/></span>
          <h4>No camera on your machines yet</h4>
          <p>A machine in your own network can read its cameras for AADML: they are listed here once you add one.</p>
        </div>
        <div v-if="page && !addWhy" class="vs-connector-foot">
          <UiButton class="small" @click="connectCamera"><Webcam :size="14" aria-hidden="true"/> Connect a camera</UiButton>
        </div>
      </section>
    </aside>
  </div>


    <!-- "Add video source" and "Edit" -->
    <UiDialog class="vs-dialog" :open="editorOpen" :title="editing ? `Edit ${editing.name}` : 'Add video source'" @close="closeEditor">
      <div v-if="!editing" class="vs-ways" role="tablist" aria-label="How the video reaches AADML">
        <button v-for="(w, i) in WAYS" :id="`vs-way-${w.id}`" :key="w.id" type="button" role="tab" :aria-selected="way===w.id" aria-controls="vs-way-panel"
                :tabindex="way===w.id ? 0 : -1" :class="{ on: way===w.id }" @click="way=w.id" @keydown="tabKeys($event, i, WAYS, n => { way = n.id; }, 'vs-way')">
          <component :is="w.icon" :size="15" aria-hidden="true"/>{{ w.name }}<span v-if="w.chip" class="vs-pilot">{{ w.chip }}</span>
        </button>
      </div>

      <div id="vs-way-panel" class="vs-way-panel" :role="editing ? undefined : 'tabpanel'" :aria-labelledby="editing ? undefined : `vs-way-${way}`">
        <!-- Connect a camera: the connector is not released yet; nothing here pretends it is. -->
        <div v-if="!editing && way==='connector' && machineRows !== null && !usableMachines.length">
          <ol class="vs-steps">
            <li>
              <span class="vs-step-n" aria-hidden="true">1</span>
              <div class="vs-step-body">
                <h4>Connect a machine on the cameras' network</h4>
                <p>The connector is AADML's machine agent, on a computer in the same network as your cameras. It only reaches out to AADML, so no port is opened on your router. Add the computer on the Machines page (Models, Your machines), then come back here to add its cameras.</p>
                <p v-if="machinesError" class="field-error" role="alert">{{ machinesError }}</p>
                <div class="vs-os" role="tablist" aria-label="Computer">
                  <button v-for="(os, i) in SYSTEMS" :id="`vs-os-${os.toLowerCase()}`" :key="os" type="button" role="tab" :aria-selected="system===os" aria-controls="vs-os-panel"
                          :tabindex="system===os ? 0 : -1" :class="{ on: system===os }" @click="system=os" @keydown="tabKeys($event, i, SYSTEMS, n => { system = n; }, 'vs-os')">{{ os }}</button>
                </div>
                <div id="vs-os-panel" class="vs-code" role="tabpanel" :aria-labelledby="`vs-os-${system.toLowerCase()}`">
                  The Machines page gives the one command for {{ system }} that starts the agent and joins it to this workspace.
                </div>
              </div>
            </li>
          </ol>
        </div>

        <!-- Scan from phone: a pairing code; what the phone reads fills the Camera URL form -->
        <div v-else-if="!editing && way==='phone'" class="vs-pair">
          <p class="dialog-description">Scan the camera's label with your phone: its QR code or barcode (the camera's address, or its serial number) fills in the camera form here. Nothing is added until you check the form and press Add camera.</p>
          <p class="vs-help">This reads an IP camera's label; it does not send your phone's own camera. To use your phone as a camera, add an <button type="button" class="link-button" @click="way = 'rtmp'">RTMP stream</button> and send it from a streaming app on the phone that can send RTMPS (for example Larix Broadcaster).</p>
          <div v-if="pairing && pairState !== 'ended'" class="vs-pair-made">
            <svg v-if="pairQr" class="vs-pair-qr" :viewBox="`0 0 ${pairQr.size} ${pairQr.size}`" shape-rendering="crispEdges" role="img" aria-label="Pairing QR code for your phone"><rect :width="pairQr.size" :height="pairQr.size" fill="#ffffff"/><path :d="pairQr.path" fill="#0f172a"/></svg>
            <div>
              <ol class="vs-pair-steps">
                <li>Point your phone's camera at this code and open the link.</li>
                <li>On the phone, scan the code on the camera's label, or type what it says.</li>
                <li>Press Send. The form here fills in.</li>
              </ol>
              <p class="vs-help">The code works once, until {{ pairUntil }}. The phone's browser needs to be allowed to use its camera.</p>
              <p class="vs-pair-wait" role="status"><LoaderCircle class="spin" :size="14" aria-hidden="true"/> Waiting for your phone…</p>
              <UiButton class="small" :disabled="pairBusy" @click="showPairing">Show a new code</UiButton>
            </div>
          </div>
          <div v-else class="vs-pair-start">
            <p v-if="pairState === 'ended'" class="vs-help" role="status">That pairing code has ended: it was used, or its 15 minutes are over.</p>
            <UiButton variant="primary" :disabled="pairBusy" @click="showPairing"><LoaderCircle v-if="pairBusy" class="spin" :size="15" aria-hidden="true"/><Smartphone v-else :size="15" aria-hidden="true"/> {{ pairState === 'ended' ? 'Show a new code' : 'Show a pairing code' }}</UiButton>
          </div>
          <p v-if="pairError" class="field-error" role="alert">{{ pairError }}</p>
        </div>

        <!-- Verkada: the form it will have, switched off -->
        <div v-else-if="!editing && way==='verkada'">
          <p class="dialog-description">Add the cameras of a Verkada organisation, with no connector to install. <UiBadge>Coming soon</UiBadge></p>
          <p class="vs-help">In Verkada Command, an organisation admin creates an API key that may use the Streaming API. The organisation ID is the ID of that organisation.</p>
          <fieldset class="vs-off" disabled>
            <legend class="vs-sr">Verkada connection, not available yet</legend>
            <div class="vs-row">
              <div class="vs-field"><label for="vs-vk-name">Connection name</label><input id="vs-vk-name" class="text-input" type="text" placeholder="Head office"></div>
              <div class="vs-field"><label for="vs-vk-region">Region</label><select id="vs-vk-region" class="text-input"><option>Choose a region</option></select></div>
            </div>
            <div class="vs-field"><label for="vs-vk-org">Organisation ID</label><input id="vs-vk-org" class="text-input" type="text"></div>
            <div class="vs-field"><label for="vs-vk-key">API key</label><input id="vs-vk-key" class="text-input" type="password" aria-describedby="vs-vk-key-help"><p id="vs-vk-key-help" class="vs-help">It will be stored encrypted and never shown again.</p></div>
            <UiButton variant="primary" class="vs-inline-submit" disabled>Connect Verkada</UiButton>
          </fieldset>
        </div>

        <!-- RTMP stream, just added: its Server and Stream key, shown this once -->
        <div v-else-if="!editing && way==='rtmp' && addedPush" class="vs-pushed">
          <div class="notice vs-notice" role="status"><Check :size="16" aria-hidden="true"/><span>{{ addedSaid }}</span></div>
          <PushDetails v-if="addedPush.details" :push="addedPush.details" id-prefix="vs-push"/>
          <p v-else class="field-error" role="alert">The stream was added, but its stream key could not be shown here. Open it in the list and rotate its key to get one.</p>
          <UiButton class="small" @click="addAnotherPush">Add another RTMP stream</UiButton>
        </div>

        <!-- Camera URL (and Edit) -->
        <form v-else class="vs-form" novalidate @submit.prevent="save">
          <p class="dialog-description">{{ pushing ? (editing ? 'Change its name or default project. Its stream key is rotated on its own page.' : 'Your camera or encoder (OBS, a drone, a video recorder) sends its video to AADML over an encrypted RTMPS connection. After you add it, AADML shows the server and a secret stream key to put in it, once. Plain RTMP without encryption is not accepted.') : editing ? 'Change what you need. A field left blank keeps what is saved.' : connecting ? 'A camera on the network of one of your machines: that machine reads it, AADML never connects into your network. Check now takes a frame of it; live view, recording and models run on it through the machine too (agent 1.5.0 or later).' : 'No connector to install: AADML connects to the camera or stream at its address, only while a check, a live view or a stream needs it. It must be reachable from the internet.' }}</p>
          <div v-if="connecting && !editing" class="vs-field">
            <label for="vs-machine">The machine the camera is on</label>
            <select id="vs-machine" v-model="form.machine" class="text-input" :aria-invalid="!!fieldErrors.machine" aria-describedby="vs-machine-error">
              <option value="">{{ machineRows === null ? 'Loading your machines…' : 'Choose a machine' }}</option>
              <option v-for="m in usableMachines" :key="m.id" :value="String(m.id)">{{ machineLine(m) }}</option>
            </select>
            <p v-if="fieldErrors.machine" id="vs-machine-error" class="field-error" role="alert">{{ fieldErrors.machine }}</p>
            <div v-if="chosenMachine" class="vs-find">
              <UiButton :disabled="!!findWhy || finding?.state === 'looking'" aria-describedby="vs-find-help" @click="findCameras">
                <LoaderCircle v-if="finding?.state === 'looking'" class="spin" :size="14" aria-hidden="true"/><Search v-else :size="14" aria-hidden="true"/>
                {{ finding?.state === 'looking' ? 'Looking for cameras…' : 'Find cameras' }}
              </UiButton>
              <p id="vs-find-help" class="vs-help">{{ findWhy || `${chosenMachine.name} looks for ONVIF cameras on its network for a few seconds. A camera it does not find can still be added by its address.` }}</p>
              <p v-if="findError" class="field-error" role="alert">{{ findError }}</p>
              <div v-if="finding" class="vs-found" aria-live="polite">
                <p class="vs-help">{{ finding.said }}</p>
                <ul v-if="finding.cameras?.length" class="vs-found-list" aria-label="Cameras found">
                  <li v-for="c in finding.cameras" :key="c.host">
                    <button type="button" class="vs-found-item" :disabled="!foundAddress(c)" @click="pickFound(c)">
                      <Cctv :size="14" aria-hidden="true"/><span>{{ foundLine(c) }}</span><small>Use this camera</small>
                    </button>
                  </li>
                </ul>
              </div>
              <p v-if="foundPicked" class="notice vs-found-picked" role="status">{{ foundPicked }}</p>
            </div>
          </div>
          <div v-if="addedSaid" class="notice vs-notice" role="status"><Check :size="16" aria-hidden="true"/><span>{{ addedSaid }}</span></div>
          <div v-else-if="scannedSaid && !editing" class="notice vs-notice" role="status"><Smartphone :size="16" aria-hidden="true"/><span>{{ scannedSaid }}</span></div>

          <div class="vs-field">
            <label for="vs-name">Name</label>
            <input id="vs-name" v-model="form.name" class="text-input" type="text" autocomplete="off" :maxlength="SOURCE_NAME_LIMIT + 20" placeholder="Front gate"
                   :aria-invalid="!!fieldErrors.name" aria-describedby="vs-name-error" @blur="checkField('name')">
            <p id="vs-name-error" class="field-error" aria-live="polite">{{ fieldErrors.name }}</p>
          </div>

          <div v-if="!pushing" class="vs-field">
            <label for="vs-address">Camera or stream URL</label>
            <p id="vs-address-help" class="vs-help vs-help-top">rtsp://, rtsps:// or an HLS playlist (https://…/live.m3u8). Only its scheme and server are shown afterwards<template v-if="shownNow">: {{ shownNow }}</template>.</p>
            <input id="vs-address" v-model="form.address" class="text-input" type="url" inputmode="url" autocomplete="off" spellcheck="false"
                   :placeholder="editing ? `Leave blank to keep ${addressShown(editing.shown_address || editing.address_shown || editing.address || '') || 'the saved address'}` : 'rtsps://camera.example.com:322/stream1'"
                   :aria-invalid="!!fieldErrors.address" aria-describedby="vs-address-help vs-address-error"
                   @blur="checkField('address')" @input="fieldErrors.address && checkField('address')">
            <p id="vs-address-error" class="field-error" aria-live="polite">{{ fieldErrors.address }}</p>
          </div>

          <div v-if="!pushing" class="vs-row">
            <div class="vs-field">
              <label for="vs-username">Username <span class="vs-optional">(optional)</span></label>
              <input id="vs-username" v-model="form.username" class="text-input" type="text" autocomplete="off" spellcheck="false" :maxlength="CREDENTIAL_LIMIT"
                     :aria-invalid="!!fieldErrors.username" aria-describedby="vs-username-error">
              <p id="vs-username-error" class="field-error" aria-live="polite">{{ fieldErrors.username }}</p>
            </div>
            <div class="vs-field">
              <label for="vs-password">Password <span class="vs-optional">(optional)</span></label>
              <input id="vs-password" v-model="form.password" class="text-input" type="password" autocomplete="new-password" :maxlength="CREDENTIAL_LIMIT"
                     :placeholder="editing ? 'Leave blank to keep the saved one' : ''" :aria-invalid="!!fieldErrors.password" aria-describedby="vs-password-help vs-password-error">
              <p id="vs-password-error" class="field-error" aria-live="polite">{{ fieldErrors.password }}</p>
            </div>
          </div>

          <div class="vs-field">
            <label for="vs-project">Default project <span class="vs-optional">(optional)</span></label>
            <select id="vs-project" v-model="form.project" class="text-input" :aria-invalid="!!fieldErrors.project" aria-describedby="vs-project-help vs-project-error">
              <option value="">No default project</option>
              <option v-for="p in projectChoices" :key="p.ref" :value="p.ref">{{ p.name }}</option>
            </select>
            <p id="vs-project-help" class="vs-help">Picked first when you start a stream on this camera.</p>
            <p id="vs-project-error" class="field-error" aria-live="polite">{{ fieldErrors.project }}</p>
          </div>

          <div v-if="!editing" class="vs-field">
            <label class="vs-consent" :class="{ invalid: !!fieldErrors.consent }">
              <input id="vs-consent" v-model="form.consent" type="checkbox" required :aria-invalid="!!fieldErrors.consent" aria-describedby="vs-consent-error" @change="checkField('consent')">
              <span>{{ page?.consent_text || CONSENT_TEXT }}</span>
            </label>
            <p id="vs-consent-error" class="field-error" aria-live="polite">{{ fieldErrors.consent }}</p>
          </div>
          <p v-else-if="consentNote" class="vs-help">{{ consentNote }}</p>

          <p v-if="formError" class="field-error" role="alert">{{ formError }}</p>
          <UiButton type="submit" variant="primary" class="vs-inline-submit" :disabled="saving">
            <LoaderCircle v-if="saving" class="spin" :size="15" aria-hidden="true"/> {{ saving ? 'Saving…' : editing ? 'Save changes' : pushing ? 'Add RTMP stream' : 'Add camera' }}
          </UiButton>
          <p v-if="!pushing" id="vs-password-help" class="vs-help vs-lock"><Lock :size="13" aria-hidden="true"/> AADML stores the password encrypted and never shows it again.<template v-if="editing"> A blank password keeps the saved one.</template></p>
        </form>
      </div>

      <div class="dialog-actions vs-foot">
        <UiButton :disabled="saving" @click="closeEditor">Cancel</UiButton>
        <UiButton v-if="!editing" variant="primary" :disabled="saving" @click="closeEditor">Done</UiButton>
      </div>
    </UiDialog>

    <UiDialog :open="!!removing" :title="removing ? `Remove ${removing.name}?` : 'Remove source?'" @close="removing=null">
      <template v-if="removing">
        <p class="dialog-description">Any stream running on this camera stops, and its address and password are deleted. Past streams and their results are kept.</p>
        <fieldset v-if="removeAsks" class="vs-remove-recs">
          <legend>Its recordings<template v-if="removingKept"> ({{ sizeText(removingKept) }} kept now)</template></legend>
          <label><input v-model="removeRecordings" type="radio" name="vs-remove-recs" value="keep"> Keep them until their days are over, then they are deleted. Keeping them is charged until then.</label>
          <label><input v-model="removeRecordings" type="radio" name="vs-remove-recs" value="delete"> Delete them now. This cannot be undone.</label>
        </fieldset>
        <p v-if="removeError" class="field-error" role="alert">{{ removeError }}</p>
        <div class="dialog-actions">
          <UiButton @click="removing=null">Keep it</UiButton>
          <UiButton variant="primary" class="danger" :disabled="removeBusy" @click="confirmRemove"><Trash2 :size="14" aria-hidden="true"/> {{ removeBusy ? 'Removing…' : 'Remove source' }}</UiButton>
        </div>
      </template>
    </UiDialog>
    <LiveView :source="watching" @close="watching = null"/>
  </div>
</template>

<style scoped>
.vs-pair-made{display:grid;grid-template-columns:200px minmax(0,1fr);gap:16px;align-items:start;margin:12px 0}
.vs-pair-qr{width:200px;height:200px;border:1px solid #e2e8f0;border-radius:9px}
.vs-pair-steps{margin:0 0 8px;padding-left:18px;font-size:13px;line-height:1.6;color:#33415a}
.vs-pair-wait{display:flex;align-items:center;gap:6px;margin:8px 0!important;font-size:13px!important;color:#33415a!important}
.vs-pair-start{margin:14px 0}
@media(max-width:560px){.vs-pair-made{grid-template-columns:1fr}.vs-pair-qr{justify-self:center}}
.vs-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;align-items:start;margin:0 0 8px}
.vs-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.vs-card{position:relative;min-width:0;border:1px solid #e3e8ef;border-radius:12px;background:#fff}
.vs-bar{display:flex;align-items:center;justify-content:space-between;gap:10px 14px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #eef1f5}
.vs-bar h3{margin:0;font-size:15px;font-weight:600;color:#17243b}
.vs-title{display:flex;align-items:center;gap:4px}
.vs-help-btn{display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:6px;background:none;color:#64748b}
.vs-help-btn:hover,.vs-help-btn[aria-expanded="true"]{background:#f1f4f8;color:var(--aadml-primary)}
.vs-helptext{margin:0!important;padding:10px 16px;border-bottom:1px solid #eef1f5;background:#f8fafc;font-size:12px!important;line-height:1.6!important;color:#33415a!important}
.vs-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.vs-chips{display:flex;flex-wrap:wrap;gap:2px;padding:3px;border-radius:8px;background:#f4f6f9}
.vs-chip{min-height:36px;padding:4px 10px;border:1px solid transparent;border-radius:6px;background:none;color:#52627a;font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums}
.vs-chip[aria-pressed="true"]{border-color:#dbe2ec;background:#fff;color:#17243b;font-weight:600;box-shadow:0 1px 2px #1d2a4214}
.vs-views{display:flex;gap:2px;padding:3px;border-radius:8px;background:#f4f6f9}
.vs-views button{display:grid;place-items:center;width:36px;height:36px;border:1px solid transparent;border-radius:6px;background:none;color:#64748b}
.vs-views button[aria-pressed="true"]{border-color:#dbe2ec;background:#fff;color:var(--aadml-primary)}
.vs-notice{margin:12px 16px 0!important}
.vs-why{margin:10px 16px 0!important;font-size:12px!important;line-height:1.5!important;color:#6f4500!important}
.vs-error{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:12px 16px 0;padding:10px 14px;border:1px solid #efc5ce;border-radius:10px;background:#fff5f6;color:#ad3449;font-size:13px}
.vs-muted{padding:16px;font-size:12px!important;color:#5f6d82!important}
.vs-empty{text-align:center;padding:26px 20px}
.vs-empty-icon{display:grid;place-items:center;width:44px;height:44px;margin:0 auto 10px;border-radius:50%;background:#f1f4f8;color:#4c5d74}
.vs-empty h4{margin:0 0 6px;font-size:14px;color:#17243b}
.vs-empty p{margin:0 auto 14px;max-width:440px;font-size:12px;line-height:1.6}
.vs-empty-plain p{margin-bottom:0}
.vs-connectors{list-style:none;margin:0;padding:6px 16px}
.vs-connectors li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #f0f2f6}
.vs-connectors li:last-child{border-bottom:0}
.vs-connector-name{display:flex;flex-direction:column;gap:2px;min-width:0}
.vs-connector-name strong{font-size:13px;color:#162139;overflow-wrap:anywhere}
.vs-connector-name small{font-size:12px;color:#64748b}
.vs-connector-foot{display:flex;justify-content:center;padding:0 16px 14px}
.vs-remove-recs{display:grid;gap:8px;margin:12px 0 0;padding:10px 12px;border:1px solid #e3e8ef;border-radius:10px}
.vs-remove-recs legend{padding:0 4px;font-size:13px;font-weight:600;color:#17243b}
.vs-remove-recs label{display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.5;color:#33415a}
.vs-remove-recs input{margin-top:3px}
.vs-link{border:0;background:none;padding:0;color:var(--aadml-primary);text-decoration:underline;font:inherit;cursor:pointer;min-height:44px}
/* relative: the hidden "Details" heading is absolutely placed, and must not widen the page past this scroll box */
.vs-table-wrap{position:relative;overflow-x:auto}
.vs-table{width:100%;min-width:560px;border-collapse:collapse;font-size:13px}
.vs-table td:first-child{min-width:240px}
.vs-table th{padding:10px 16px;text-align:left;font-size:11px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #eef1f5}
.vs-table td{padding:12px 16px;vertical-align:middle;border-bottom:1px solid #f0f2f6;color:#22304a}
.vs-table tr:last-child td{border-bottom:0}
.vs-name{display:flex;align-items:center;gap:12px;min-width:0}
.vs-name strong{display:block;color:#162139;overflow-wrap:anywhere}
.vs-name small{display:block;margin-top:2px;font-size:12px;color:#64748b;overflow-wrap:anywhere}
.vs-flows{color:#64748b;white-space:nowrap}
.vs-badges{display:inline-flex;flex-direction:column;align-items:flex-start;gap:4px}
.vs-when{display:block;margin-top:4px;font-size:11px;color:#64748b}
.vs-go{width:56px;text-align:right}
.vs-open{display:inline-grid;place-items:center;width:44px;height:44px;border:0;border-radius:8px;background:none;color:#64748b}
.vs-open:hover{background:var(--aadml-tint);color:var(--aadml-primary)}
.vs-address{font-size:12px;color:#33415a;background:#f4f6fa;padding:2px 6px;border-radius:5px;overflow-wrap:anywhere}
.vs-reason{color:#6f4500!important}
.vs-thumb{position:relative;display:grid;place-items:center;aspect-ratio:16/9;background:#eef1f6;color:#8491a4;overflow:hidden}
.vs-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.vs-thumb.small{width:44px;height:44px;aspect-ratio:auto;flex-shrink:0;border-radius:8px}
.vs-thumb-none{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px}
.vs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin:0;padding:16px;list-style:none}
.vs-tile{border:1px solid #e3e8ef;border-radius:10px;overflow:hidden;min-width:0}
.vs-tile-badges{position:absolute;top:8px;left:8px;display:flex;gap:4px}
.vs-tile-body{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 6px 10px 12px}
.vs-tile-body > div{min-width:0}
.vs-tile-body h4{margin:0;font-size:14px;color:#162139;overflow-wrap:anywhere}
.vs-tile-body p{margin:2px 0 0;font-size:12px;color:#64748b;overflow-wrap:anywhere}
.vs-side{display:flex;flex-direction:column;gap:16px;min-width:0}
.vs-summary{margin:0;padding:8px 16px 12px}
.vs-summary > div{display:flex;align-items:baseline;gap:8px;padding:7px 0}
.vs-summary dt{display:flex;align-items:center;gap:9px;font-size:13px;color:#52627a;white-space:nowrap}
.vs-summary dt svg{color:#8491a4}
.vs-summary > div::after{content:"";order:1;flex:1;border-bottom:1px dotted #d6dce6;transform:translateY(-3px)}
.vs-summary dd{order:2;margin:0;font-size:13px;font-weight:600;color:#17243b;font-variant-numeric:tabular-nums}
.badge--amber{color:#93610b;background:#fff4dc}
.spin{animation:vs-spin 1.1s linear infinite}
@keyframes vs-spin{to{transform:rotate(360deg)}}

/* dialogs */
.vs-dialog{width:min(720px,calc(100% - 32px))}
.vs-detail-top{display:grid;grid-template-columns:minmax(0,260px) minmax(0,1fr);gap:16px;margin-top:16px}
.vs-detail-thumb{border-radius:10px}
.vs-facts{margin:0;display:grid;gap:8px}
.vs-facts > div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px;font-size:13px}
.vs-facts dt{color:#64748b}
.vs-facts dd{margin:0;color:#22304a;overflow-wrap:anywhere}
.vs-facts .vs-badges{flex-direction:row}
.vs-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.vs-acts .button{min-height:44px}
.vs-danger{color:#b42318}
.vs-sub{margin:20px 0 8px;font-size:14px;color:#17243b}
.vs-streams{margin:0;padding:0;list-style:none;border:1px solid #eef1f5;border-radius:10px}
.vs-streams li{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #f0f2f6}
.vs-streams li:last-child{border-bottom:0}
.vs-streams li > span:first-child{flex:1;min-width:0}
.vs-streams strong{display:block;font-size:13px;color:#162139;overflow-wrap:anywhere}
.vs-streams small{display:block;font-size:11px;color:#64748b}
.button.small{min-height:44px;padding:6px 12px;font-size:13px}
.vs-ways{display:flex;gap:2px;margin:18px 0 0;border-bottom:1px solid #e3e8ef;overflow-x:auto}
.vs-ways button{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:8px 12px;border:0;border-bottom:2px solid transparent;background:none;color:#52627a;font-size:13px;font-weight:550;white-space:nowrap}
.vs-ways button.on{border-bottom-color:var(--aadml-primary);color:var(--aadml-primary)}
.vs-ways button:focus-visible,.vs-os button:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:-2px}
.vs-pilot{padding:1px 6px;border-radius:5px;background:var(--aadml-soft);color:var(--aadml-primary);font-size:11px;font-weight:600}
.vs-way-panel{min-height:280px;max-height:min(60vh,560px);overflow-y:auto;padding:2px 2px 4px}
.vs-steps{margin:16px 0 0;padding:0;list-style:none}
.vs-steps li{display:flex;gap:12px}
.vs-step-n{display:grid;place-items:center;flex-shrink:0;width:26px;height:26px;border-radius:50%;background:var(--aadml-soft);color:var(--aadml-primary);font-size:12px;font-weight:600}
.vs-step-body{flex:1;min-width:0}
.vs-step-body h4{display:flex;align-items:center;gap:8px;margin:3px 0 6px;font-size:14px;color:#17243b}
.vs-step-body > p{margin:0 0 12px;font-size:13px;line-height:1.6;color:#33415a}
.vs-os{display:flex;gap:2px;border-bottom:1px solid #e3e8ef}
.vs-os button{min-height:40px;padding:6px 12px;border:0;border-bottom:2px solid transparent;background:none;color:#52627a;font-size:13px}
.vs-os button.on{border-bottom-color:var(--aadml-primary);color:var(--aadml-primary);font-weight:600}
.vs-code{margin:0 0 12px;padding:14px;border:1px solid #e3e8ef;border-top:0;border-radius:0 0 8px 8px;background:#f8fafc;font-size:13px;line-height:1.6;color:#33415a}
.vs-pushed{display:grid;gap:14px;margin-top:16px}
.vs-pushed > .vs-notice{margin:0}
.vs-off{margin:0;padding:0;border:0;min-width:0}
.vs-off .text-input{background:#f4f6f9;color:#8491a4}
.vs-form{margin:0}
.vs-field{display:block;margin:16px 0 0;min-width:0}
.vs-field > label{display:block;font-size:13px;font-weight:600;color:#1d2a42;margin:0 0 6px}
.vs-optional{font-weight:400;color:#5f6d82}
.vs-field .text-input{display:block;width:100%;min-height:44px;margin:0;padding:10px 12px;font-size:14px}
.vs-field .text-input:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.vs-field .text-input[aria-invalid="true"]{border-color:#c0394c}
.vs-field .field-error{margin:6px 0 0}
.vs-field .field-error:empty{margin:0}
.vs-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}
.vs-help{margin:6px 0 0!important;font-size:12px!important;line-height:1.5!important;color:#5f6d82!important;overflow-wrap:anywhere}
.vs-help-top{margin:0 0 8px!important}
.vs-find{margin:10px 0 0}
.vs-find .button{display:inline-flex;align-items:center;gap:6px;min-height:44px}
.vs-found-list{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:6px}
.vs-found-item{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:8px 12px;border:1px solid #dce0e8;border-radius:9px;background:#fbfcfe;color:#22304a;font-size:13px;text-align:left;cursor:pointer}
.vs-found-item span{flex:1;min-width:0;overflow-wrap:anywhere}
.vs-found-item small{font-size:12px;color:var(--aadml-primary);white-space:nowrap}
.vs-found-item:hover:not(:disabled){border-color:var(--aadml-primary)}
.vs-found-item:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.vs-found-item:disabled{opacity:.6;cursor:not-allowed}
.vs-found-picked{margin:8px 0 0!important;font-size:12px!important;line-height:1.5!important}
.vs-lock{display:flex;align-items:flex-start;gap:6px}
.vs-lock svg{margin-top:2px}
.vs-field > label.vs-consent,.vs-consent{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid #dce0e8;border-radius:9px;background:#fbfcfe;font-size:13px!important;font-weight:400!important;line-height:1.5;color:#22304a!important;cursor:pointer}
.vs-consent.invalid{border-color:#c0394c}
.vs-consent input{width:18px;height:18px;margin-top:1px;flex-shrink:0}
.vs-consent:focus-within{outline:2px solid var(--aadml-focus);outline-offset:2px}
.vs-inline-submit{min-height:44px;margin-top:16px}
.vs-foot{justify-content:space-between;padding-top:16px;border-top:1px solid #eef1f5}
.dialog-actions .button{min-height:44px}
.button--primary.danger{background:#b42318;border-color:#b42318}
.button--primary.danger:hover:not(:disabled){background:#912018;border-color:#912018}

@media(max-width:1000px){.vs-layout{grid-template-columns:minmax(0,1fr)}.vs-side{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}}
@media(max-width:650px){
  .vs-bar{padding:10px 12px}
  .vs-tools,.vs-chips{width:100%}
  .vs-chip{flex:1 1 auto}
  .vs-row,.vs-detail-top{grid-template-columns:1fr}
  .vs-facts > div{grid-template-columns:96px minmax(0,1fr)}
  .vs-acts .button{flex:1 1 auto}
  .vs-grid{padding:12px}
}
@media(prefers-reduced-motion:reduce){.spin{animation:none}}
.link-button{background:none;border:0;padding:0;color:var(--aadml-primary);font:inherit;text-decoration:underline;cursor:pointer}
</style>
