<script setup>
// The workspace's Deployments page, laid out as Roboflow's (owner, 2026-10-21): tabs for every way of deploying (the
// Cloud API, Dedicated, Batch, Edge on your machines, Cloud Streaming, Cost Benchmark); the Overview with the successful calls of the
// workspace's models over a chosen range, the ways to deploy, "Improve model", and the projects deployed and not yet
// deployed. Deploying, stopping and going back are done on a project's own Deployments page.
// Backend: app_api.py workspace/deployments/?range= (and workspace/models/ for "Improve model").
// The Dedicated Deployments tab (TRAINING_PHASE3_SERVING_PLAN.md 7.9): a project's approved model, or an open model the
// workspace added from Hugging Face as it is (TRAINING_OPEN_MODELS_PLAN.md section 4), on a machine of its own.
// Backend: app_api.py workspace/dedicated/ (list, start) and workspace/dedicated/<id>/stop/.
import { computed, onUnmounted, ref, watch } from 'vue';
import {
  Activity, ArrowRight, BookOpen, Check, ChartColumn, ChartLine, Cloud, Code, Copy, Cpu, KeyRound, Layers, LoaderCircle,
  Network, Plus, RefreshCw, Rocket, Server, Sparkles, Square, Video, Wallet,
} from 'lucide-vue-next';
import '../deployments.css';
import DeploymentHeader from './DeploymentHeader.vue';
import DeploymentMetrics from './DeploymentMetrics.vue';
import DeploymentToolbar from './DeploymentToolbar.vue';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import StreamingTab from './StreamingTab.vue';
import CostTab from './CostTab.vue';
import BatchTab from './BatchTab.vue';
import EdgeTab from './EdgeTab.vue';
import {
  workspaceApi, projectLink, environmentState, modelName, timeAgo, RUN_RANGES, API_REFERENCE, runsChart, runsDay,
  DEDICATED_NAME_RULE, dedicatedNameProblem, machineCost, dedicatedCostSummary, dedicatedModels, missingApproval,
  dedicatedState, anyStarting, DEDICATED_HOST, DEDICATED_SOURCES, deployableOpenModels, dedicatedMachinesFor, machineKind,
  openModelLine, missingOpenModel, dedicatedSource, useLanguages, useInstall, usesInstall, useSnippet,
} from '../api/workspace.js';

const emit = defineEmits(['navigate', 'create']);

const TABS = [
  { id: 'overview', name: 'Overview', icon: ChartLine },
  { id: 'dedicated', name: 'Dedicated Deployments', icon: Server },
  { id: 'batch', name: 'Batch Processing', icon: Layers },
  { id: 'edge', name: 'Edge Devices', icon: Cpu },
  { id: 'streaming', name: 'Cloud Streaming', icon: Video },
  { id: 'cost', name: 'Cost Benchmark', icon: ChartColumn },
];
const tab = ref('overview');
const current = computed(() => TABS.find(t => t.id === tab.value));

// The page's data: the projects and their deployments, and the successful calls over the chosen range.
const range = ref('1m');
const data = ref(null); const error = ref(''); const busy = ref(false);
async function load() {
  busy.value = true;
  try { data.value = await workspaceApi.deployments(range.value); error.value = ''; }
  catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
watch(range, load, { immediate: true });
const rows = computed(() => data.value?.projects || []);
const deployed = computed(() => rows.value.filter(row => row.deployed));
const idle = computed(() => rows.value.filter(row => !row.deployed));
const runs = computed(() => data.value?.runs || null);

// The chart: a smooth area of successful calls; the readout follows the pointer, or the arrow keys.
const W = 1000; const H = 200;
const chart = computed(() => runsChart(runs.value?.series || [], W, H));
const hover = ref(null);
const point = computed(() => (hover.value === null || !runs.value ? null : runs.value.series[hover.value]));
function pointAt(event) {
  const n = runs.value?.series.length || 0;
  if (!n) return;
  const box = event.currentTarget.getBoundingClientRect();
  hover.value = Math.min(n - 1, Math.max(0, Math.round(((event.clientX - box.left) / box.width) * (n - 1))));
}
function step(by) {
  const n = runs.value?.series.length || 0;
  if (n) hover.value = Math.min(n - 1, Math.max(0, (hover.value ?? n - 1) + by));
}
const ticks = computed(() => {
  const series = runs.value?.series || [];
  if (!series.length) return [];
  const picks = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];
  return picks.map(i => ({ left: (chart.value.xs[i] / W) * 100, text: runsDay(series[i].day, runs.value.bucket) }));
});
const total = computed(() => (runs.value ? runs.value.answered.toLocaleString() : '—'));
const said = computed(() => {
  if (!runs.value) return '';
  const label = RUN_RANGES.find(([key]) => key === runs.value.range)?.[1];
  return `${runs.value.answered} successful call${runs.value.answered === 1 ? '' : 's'} of ${runs.value.calls}, ${label === 'All Time' ? 'all time' : `last ${label}`}.`;
});

// "Improve model": a model of the workspace, opened on its project's Models page.
const models = ref([]);
workspaceApi.models().then(body => { models.value = body.models || []; improve.value = models.value[0] ? key(models.value[0]) : ''; }).catch(() => {});
const key = m => `${m.project.ref}#${m.number}`;
const improve = ref('');
const improving = computed(() => models.value.find(m => key(m) === improve.value));

// The lists below the overview.
const listTab = ref('deployed');
const keysOpen = ref(false);
const day = iso => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
function openTab(id) { tab.value = id; }
function moveTab(event) {
  let index = TABS.findIndex(item => item.id === tab.value);
  if (event.key === 'Home') index = 0;
  else if (event.key === 'End') index = TABS.length - 1;
  else if (event.key === 'ArrowRight') index = (index + 1) % TABS.length;
  else if (event.key === 'ArrowLeft') index = (index - 1 + TABS.length) % TABS.length;
  else return;
  event.preventDefault();
  openTab(TABS[index].id);
  event.currentTarget.parentElement.children[index]?.focus();
}
const overviewMetrics = computed(() => [
  { label: 'Successful calls', value: total.value, hint: 'Selected time range', icon: Activity },
  { label: 'Deployed projects', value: deployed.value.length, hint: 'Staging or production', icon: Rocket },
  { label: 'Not yet deployed', value: idle.value.length, hint: 'Projects not yet deployed', icon: Layers },
]);
function showDeployed() { listTab.value = 'deployed'; document.getElementById('ws-deploy-lists')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

// ── Dedicated deployments ──────────────────────────────────────────────────────────────────────────
// The list is read when the tab opens, and again every 5 seconds while one of them is starting and the tab is open.
const ded = ref(null); const dedError = ref(''); const dedLoading = ref(false);
const dedSaid = ref(''); const announce = ref('');
const deployments = computed(() => ded.value?.deployments || []);
const dedicatedQuery = ref(''); const dedicatedStatus = ref('');
const dedicatedStates = computed(() => [...new Map(deployments.value.map(d => [d.state, { value: d.state, label: dedicatedState(d)[1] }])).values()]);
const visibleDeployments = computed(() => deployments.value.filter(d => (!dedicatedStatus.value || d.state === dedicatedStatus.value) && [d.name, dedicatedSource(d).title, dedicatedSource(d).detail, d.instance_type].join(' ').toLowerCase().includes(dedicatedQuery.value.trim().toLowerCase())));
const dedicatedMetrics = computed(() => [
  { label: 'Live deployments', value: deployments.value.filter(d => d.state === 'live').length, hint: 'Serving your apps', icon: Activity },
  { label: 'Starting', value: deployments.value.filter(d => d.state === 'starting').length, hint: 'Preparing infrastructure', icon: Server },
  { label: 'Production', value: deployments.value.filter(d => d.kind === 'production' && ['live', 'starting'].includes(d.state)).length, hint: 'Active production machines', icon: Rocket },
]);
const options = computed(() => ded.value?.options || { projects: [], machines: [], kinds: [], open_models: [], open_machines: [] });
const dedMay = computed(() => ded.value?.may || {});
let pollTimer = null; let gone = false;
function stopPolling() { clearTimeout(pollTimer); pollTimer = null; }
function schedulePoll() {
  stopPolling();
  if (!gone && tab.value === 'dedicated' && anyStarting(deployments.value)) pollTimer = setTimeout(loadDedicated, 5000);
}
// A deployment whose state changed since the last read is read out once.
function noteChanges(before, after) {
  const was = new Map((before || []).map(d => [d.id, d.state]));
  const changed = (after || []).filter(d => was.has(d.id) && was.get(d.id) !== d.state);
  if (changed.length) announce.value = changed.map(d => `${d.name} is ${dedicatedState(d)[1].toLowerCase()}.`).join(' ');
}
function takePage(body) {
  if (!body) return;
  noteChanges(ded.value?.deployments, body.deployments);
  ded.value = body;
}
async function loadDedicated() {
  if (dedLoading.value) return;
  dedLoading.value = true;
  try { takePage(await workspaceApi.dedicated()); dedError.value = ''; }
  catch (e) { dedError.value = e.message; }
  finally { dedLoading.value = false; schedulePoll(); }
}
watch(tab, now => { if (now === 'dedicated') loadDedicated(); else stopPolling(); });
const kindLabel = kind => options.value.kinds.find(k => k.value === kind)?.label || (kind === 'production' ? 'Production' : 'Development');
const machineOf = type => [...(options.value.machines || []), ...(options.value.open_machines || [])].find(m => m.instance_type === type);
const environmentLabel = env => (env === 'production' ? 'Production' : 'Staging');
const lastCall = d => (d.last_used_at ? timeAgo(d.last_used_at) : 'No calls yet');

// "New deployment": the form, checked here as the backend checks it; a refusal names its field.
const creating = ref(false); const starting = ref(false);
const form = ref({ source: 'model', name: '', project: '', model: '', open_model: '', instance_type: '', kind: 'development' });
const fieldErrors = ref({}); const formError = ref(''); const nameTouched = ref(false);
const chosenProject = computed(() => options.value.projects.find(p => p.ref === form.value.project) || null);
const eligible = computed(() => dedicatedModels(chosenProject.value, form.value.kind));
const mayOpen = computed(() => dedMay.value.start_open_model === true);
const sources = computed(() => DEDICATED_SOURCES.filter(source => source.value === 'model' || mayOpen.value));
const openModels = computed(() => options.value.open_models || []);
const offeredOpen = computed(() => deployableOpenModels(openModels.value));
const chosenOpen = computed(() => offeredOpen.value.find(m => String(m.id) === String(form.value.open_model)) || null);
const machinesShown = computed(() => dedicatedMachinesFor(options.value, form.value.source, chosenOpen.value));
const chosenMachine = computed(() => machinesShown.value.find(m => m.instance_type === form.value.instance_type) || null);
const chosenKind = computed(() => options.value.kinds.find(k => k.value === form.value.kind) || null);
const costLine = computed(() => dedicatedCostSummary(chosenMachine.value, form.value.kind, chosenKind.value?.idle_minutes || 60));
const mayStart = computed(() => dedMay.value[`start_${form.value.kind}`] === true);
const startWhy = computed(() => {
  if (!mayStart.value) return dedMay.value[`reason_${form.value.kind}`] || 'You may not start this type of deployment.';
  if (form.value.source === 'open_model') {
    if (!chosenOpen.value) return missingOpenModel(openModels.value) || 'Choose an open model.';
    if (!machinesShown.value.length) return 'No machine that holds this model can be chosen right now.';
    return '';
  }
  if (!eligible.value.length) return 'Choose a project with an approved model.';
  if (!machinesShown.value.length) return 'No machine can be chosen right now.';
  return '';
});
// A changed source or open model keeps the machine only while it is still offered for it.
watch([() => form.value.source, () => form.value.open_model, machinesShown], () => {
  if (!machinesShown.value.some(m => m.instance_type === form.value.instance_type)) form.value.instance_type = machinesShown.value[0]?.instance_type || '';
});
// A changed project or type keeps the model only while it is still allowed.
watch([() => form.value.project, () => form.value.kind], () => {
  if (!eligible.value.some(m => String(m.number) === String(form.value.model))) form.value.model = eligible.value[0] ? String(eligible.value[0].number) : '';
});
function checkName() {
  nameTouched.value = true;
  const problem = dedicatedNameProblem(form.value.name);
  fieldErrors.value = { ...fieldErrors.value, name: problem };
  return !problem;
}
function openCreate() {
  const first = options.value.projects.find(p => dedicatedModels(p, 'development').length) || options.value.projects[0];
  form.value = {
    source: 'model', name: '', project: first?.ref || '', model: '', open_model: offeredOpen.value[0] ? String(offeredOpen.value[0].id) : '',
    instance_type: options.value.machines[0]?.instance_type || '',
    kind: dedMay.value.start_development === false && dedMay.value.start_production ? 'production' : 'development',
  };
  const models = dedicatedModels(first, form.value.kind);
  form.value.model = models[0] ? String(models[0].number) : '';
  fieldErrors.value = {}; formError.value = ''; nameTouched.value = false; dedSaid.value = '';
  creating.value = true;
}
async function startDeployment() {
  formError.value = '';
  if (!checkName() || startWhy.value || starting.value) return;
  starting.value = true;
  try {
    const body = await workspaceApi.startDedicated({ ...form.value, model: Number(form.value.model), open_model: Number(form.value.open_model) });
    takePage(body);
    dedSaid.value = body?.said || `${form.value.name} is starting.`;
    announce.value = dedSaid.value;
    creating.value = false;
    schedulePoll();
  } catch (e) {
    if (e.field && ['name', 'project', 'model', 'open_model', 'instance_type', 'kind', 'source'].includes(e.field)) fieldErrors.value = { ...fieldErrors.value, [e.field]: e.message };
    else formError.value = e.message;
    // A start whose answer never came may have been made: the list is read again.
    if (e.code === 'timeout' || e.code === 'network') loadDedicated();
  } finally { starting.value = false; }
}

// "Stop": always confirmed in a dialog first.
const stopping = ref(null); const stopBusy = ref(false); const stopError = ref('');
function askStop(d) { stopping.value = d; stopError.value = ''; }
async function confirmStop() {
  if (!stopping.value || stopBusy.value) return;
  stopBusy.value = true;
  const name = stopping.value.name;
  try {
    takePage(await workspaceApi.stopDedicated(stopping.value.id));
    dedSaid.value = `${name} is stopped.`; announce.value = dedSaid.value;
    stopping.value = null;
  } catch (e) {
    stopError.value = e.message;
    if (e.code === 'timeout' || e.code === 'network') loadDedicated();
  } finally { stopBusy.value = false; schedulePoll(); }
}

// "Use": how an app calls a live deployment, with copy chips that say "Copied" for 2 seconds.
// A photo deployment is called with AADML's SDK; an open chat model with OpenAI's own client (its address is the base URL).
const using = ref(null); const language = ref(''); const copied = ref(''); const copyError = ref('');
const languages = computed(() => useLanguages(using.value));
const installLine = computed(() => useInstall(using.value));
const useUrl = computed(() => (using.value ? `${DEDICATED_HOST}${using.value.path}` : ''));
const useCode = computed(() => (useUrl.value ? useSnippet(using.value, language.value, useUrl.value) : ''));
const COPIED_WORDS = { install: 'the install command', code: 'the code', address: 'the address' };
let copiedTimer = null;
const CHAT_ABOUT = "It takes OpenAI's chat format, so OpenAI's own client works with it: set the client's base URL to the address below.";
function openUse(d) { using.value = d; language.value = useLanguages(d)[0]; copied.value = ''; copyError.value = ''; }
async function copyText(text, what) {
  try {
    await navigator.clipboard.writeText(text); copied.value = what; copyError.value = '';
    clearTimeout(copiedTimer); copiedTimer = setTimeout(() => { copied.value = ''; }, 2000);
  } catch { copyError.value = 'Copying was blocked by the browser. Select the text and copy it with Ctrl+C.'; }
}
onUnmounted(() => { gone = true; stopPolling(); clearTimeout(copiedTimer); });
</script>

<template>
  <div class="studio ws-deployments deployments-workspace">
    <nav class="deploy-tabs" role="tablist" aria-label="Ways to deploy">
      <!-- One keyboard tab stop; arrow keys switch between deployment views. -->
      <button v-for="t in TABS" :key="t.id" type="button" role="tab" :id="`deployment-tab-${t.id}`" :aria-controls="`deployment-panel-${t.id}`" :tabindex="tab===t.id ? 0 : -1" @keydown="moveTab" :aria-selected="tab===t.id" :class="{active:tab===t.id}" :title="t.soon ? 'Coming soon' : undefined" @click="openTab(t.id)">
        <component :is="t.icon" :size="15"/> {{ t.name }}
      </button>
    </nav>

    <section v-if="current.soon" class="panel soon" role="tabpanel">
      <span class="soon-icon"><component :is="current.icon" :size="26"/></span>
      <div><h2>{{ current.name }} <UiBadge tone="purple">Coming soon</UiBadge></h2>
        <p>{{ current.soon }} It is not available in AADML yet. Today a model answers through the Cloud API: its project's Deployments page puts it live in staging or production.</p>
        <UiButton @click="tab='overview'">Back to Overview</UiButton></div>
    </section>

    <section v-else-if="tab==='dedicated'" id="deployment-panel-dedicated" class="dedicated" role="tabpanel" aria-labelledby="ded-heading" :aria-busy="dedLoading">
      <DeploymentHeader title="Dedicated Deployments" heading-id="ded-heading" eyebrow="RESERVED COMPUTE. RELIABLE INFERENCE." :icon="Server" description="Give your model a dedicated machine and an endpoint for your apps.">
        <UiButton variant="primary" :disabled="!ded" @click="openCreate"><Plus :size="15" aria-hidden="true"/> New deployment</UiButton>
      </DeploymentHeader>
      <DeploymentMetrics :items="dedicatedMetrics" :loaded="!!ded"/>
      <p v-if="ded && ded.cost_note" class="ded-billing"><Wallet :size="16" aria-hidden="true"/><span>{{ ded.cost_note }}</span></p>
      <div v-if="dedSaid" class="notice" role="status"><Check :size="16" aria-hidden="true"/><span>{{ dedSaid }}</span></div>
      <div v-if="dedError" class="ded-error" role="alert">
        <span>{{ dedError }}</span>
        <UiButton :disabled="dedLoading" @click="loadDedicated"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton>
      </div>

      <DeploymentToolbar v-if="ded" title="Deployments" v-model:query="dedicatedQuery" v-model:status="dedicatedStatus" :states="dedicatedStates" :count="visibleDeployments.length" :total="deployments.length" :loading="dedLoading" @refresh="loadDedicated"/>
      <div v-if="ded && deployments.length && !visibleDeployments.length" class="deployment-no-results" role="status"><h3>No matching deployments</h3><p>Try a different name, machine, or status.</p></div>
      <p v-if="!ded && !dedError" class="muted">Loading deployments…</p>
      <div v-else-if="ded && !deployments.length" class="list-empty">
        <span class="empty-icon"><Server :size="22" aria-hidden="true"/></span>
        <h3>No dedicated deployment yet</h3>
        <p>Start one to give an approved model a machine of its own, with an address your apps call.</p>
        <div class="empty-actions"><UiButton variant="primary" @click="openCreate"><Plus :size="15" aria-hidden="true"/> New deployment</UiButton></div>
      </div>
      <div v-else-if="ded && visibleDeployments.length" class="table-wrap">
        <table class="ws-table ded-table">
          <thead><tr><th>Name</th><th>Source</th><th>Type</th><th>Machine</th><th>State</th><th>Last call</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="d in visibleDeployments" :key="d.id">
              <td data-label="Name"><strong class="ded-name">{{ d.name }}</strong></td>
              <td data-label="Source"><span class="source-chip" :class="d.source">{{ dedicatedSource(d).label }}</span>
                <span class="ded-source-title">{{ dedicatedSource(d).title }}</span><small>{{ dedicatedSource(d).detail }}</small></td>
              <td data-label="Type"><span class="kind-chip" :class="d.kind">{{ d.kind_label || kindLabel(d.kind) }}</span>
                <small v-if="d.kind==='development' && d.idle_minutes">Stops after {{ d.idle_minutes }} minutes without a call</small></td>
              <td data-label="Machine"><code>{{ d.instance_type }}</code><small v-if="machineOf(d.instance_type)">{{ machineKind(machineOf(d.instance_type)) }}</small></td>
              <td data-label="State">
                <UiBadge :tone="dedicatedState(d)[0]"><LoaderCircle v-if="d.state==='starting'" class="spin" :size="12" aria-hidden="true"/>{{ dedicatedState(d)[1] }}</UiBadge>
                <small v-if="d.state==='failed' && d.failure_reason" class="failed-why">{{ d.failure_reason }}</small>
                <small v-else-if="d.state==='live' && d.live_at">Went live {{ timeAgo(d.live_at) }}</small>
                <small v-else-if="d.state==='stopped' && d.stopped_at">Stopped {{ timeAgo(d.stopped_at) }}</small>
              </td>
              <td data-label="Last call">{{ lastCall(d) }}</td>
              <td class="row-actions"><div class="ded-acts">
                <UiButton v-if="d.state==='live'" class="small" :aria-label="`Use ${d.name}`" @click="openUse(d)"><Code :size="14" aria-hidden="true"/> Use</UiButton>
                <UiButton v-if="d.state==='live' || d.state==='starting'" class="small" :aria-label="`Stop ${d.name}`" @click="askStop(d)"><Square :size="13" aria-hidden="true"/> Stop</UiButton>
              </div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="sr-only" aria-live="polite">{{ announce }}</p>
    </section>

    <StreamingTab id="deployment-panel-streaming" v-else-if="tab==='streaming'"/>

    <CostTab id="deployment-panel-cost" v-else-if="tab==='cost'"/>

    <BatchTab id="deployment-panel-batch" v-else-if="tab==='batch'"/>

    <EdgeTab id="deployment-panel-edge" v-else-if="tab==='edge'" @navigate="id => emit('navigate', id)"/>

    <div v-else id="deployment-panel-overview" class="deployment-overview" role="tabpanel" :aria-busy="busy" aria-labelledby="overview-heading">
      <DeploymentHeader title="Deployment Overview" heading-id="overview-heading" eyebrow="FROM MODEL TO PRODUCTION." :icon="ChartLine" description="Track inference activity and choose the right deployment for your models.">
        <UiButton @click="emit('navigate', 'models')"><Network :size="15" aria-hidden="true"/> View models</UiButton>
      </DeploymentHeader>
      <DeploymentMetrics :items="overviewMetrics" :loaded="!!data"/>
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>

      <section class="runs" :class="{ refreshing: busy && data }" aria-labelledby="runs-label">
        <div class="runs-top"><div class="chart-heading"><h3>Inference activity</h3><p>Successful calls across your workspace</p></div>
          <div class="ranges" role="group" aria-label="Time range">
            <button v-for="[value, label] in RUN_RANGES" :key="value" type="button" :aria-pressed="range===value" :class="{active:range===value}" @click="range=value">{{ label }}</button>
          </div>
          <UiButton :disabled="busy" aria-label="Refresh inference activity" @click="load"><RefreshCw :size="14" aria-hidden="true"/> Refresh</UiButton>
        </div>
        <p id="runs-label" class="sr-only">Successful calls over the selected time range</p>
        <div v-if="!data && !error" class="chart-wait" aria-hidden="true"></div>
        <div v-else-if="!data || !runs?.series?.length" class="inference-empty"><ChartLine :size="26" aria-hidden="true"/><h4>{{ error ? 'Inference activity unavailable' : 'No inference activity yet' }}</h4><p>{{ error ? 'Refresh to try loading your activity again.' : 'Successful calls will appear here when your apps start using a deployed model.' }}</p></div>
        <div v-else class="chart" tabindex="0" role="img" :aria-label="said"
             @pointermove="pointAt" @pointerleave="hover=null" @focus="step(0)" @blur="hover=null"
             @keydown.left.prevent="step(-1)" @keydown.right.prevent="step(1)">
          <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
            <path class="area" :d="chart.area"/>
            <path class="line" :d="chart.line" vector-effect="non-scaling-stroke"/>
            <line class="base" x1="0" :y1="H - 1" :x2="W" :y2="H - 1" vector-effect="non-scaling-stroke"/>
          </svg>
          <template v-if="point">
            <span class="crosshair" :style="{ left: `${chart.xs[hover] / W * 100}%` }"></span>
            <span class="dot" :style="{ left: `${chart.xs[hover] / W * 100}%`, top: `${chart.ys[hover] / H * 100}%` }"></span>
            <div class="tip" :class="{ flip: chart.xs[hover] > W * 0.7 }" :style="{ left: `${chart.xs[hover] / W * 100}%` }" role="status">
              <strong>{{ runsDay(point.day, runs.bucket) }}</strong>
              <span>{{ point.answered.toLocaleString() }} successful</span><small>{{ point.calls.toLocaleString() }} call{{ point.calls===1?'':'s' }} in all</small>
            </div>
          </template>
          <div class="ticks" aria-hidden="true"><span v-for="t in ticks" :key="t.left" :style="{ left: `${t.left}%` }">{{ t.text }}</span></div>
        </div>
        <details v-if="runs && runs.series.length" class="as-table">
          <summary>Show as a table</summary>
          <div class="table-wrap"><table class="ws-table">
            <thead><tr><th>{{ runs.bucket === 'week' ? 'Week' : 'Day' }}</th><th>Successful calls</th><th>All calls</th></tr></thead>
            <tbody><tr v-for="p in [...runs.series].reverse()" :key="p.day"><td>{{ runsDay(p.day, runs.bucket) }}</td><td>{{ p.answered }}</td><td>{{ p.calls }}</td></tr></tbody>
          </table></div>
        </details>
      </section>

      <section class="ask">
        <p>Not sure which deployment type to use?</p>
        <UiButton @click="emit('navigate', 'agent')"><Sparkles :size="15"/> Ask the AADML Agent</UiButton>
      </section>

      <div class="deployment-section-heading"><h3>Deploy your way</h3><p>Choose the infrastructure that fits your workflow.</p></div>
      <section class="ways" aria-label="Ways to deploy">
        <button type="button" class="way" @click="showDeployed">
          <span class="way-icon"><Cloud :size="18"/></span>
          <span><strong>Cloud API</strong><small>Your model answers at its own address in staging and production, called with your app's key.</small></span>
          <ArrowRight :size="16" class="way-go"/>
        </button>
        <button type="button" class="way" @click="openTab('dedicated')">
          <span class="way-icon"><Server :size="18"/></span>
          <span><strong>Dedicated Deployments</strong><small>A model on a machine of its own, kept for your apps only.</small></span>
          <ArrowRight :size="16" class="way-go"/>
        </button>
        <button type="button" class="way" @click="openTab('batch')">
          <span class="way-icon"><Layers :size="18"/></span>
          <span><strong>Batch Processing</strong><small>Run a model over many photos of a project at once and download what it found.</small></span>
          <ArrowRight :size="16" class="way-go"/>
        </button>
        <button type="button" class="way" @click="openTab('edge')"><span class="way-icon"><Cpu :size="18" aria-hidden="true"/></span><span><strong>Edge Devices</strong><small>Run approved models on your machines, with photos kept on your network.</small></span><ArrowRight :size="16" class="way-go" aria-hidden="true"/></button>
        <button type="button" class="way" @click="openTab('streaming')"><span class="way-icon"><Video :size="18" aria-hidden="true"/></span><span><strong>Cloud Streaming</strong><small>Analyze video frames and download predictions from each stream.</small></span><ArrowRight :size="16" class="way-go" aria-hidden="true"/></button>
        <button type="button" class="way" @click="openTab('cost')"><span class="way-icon"><ChartColumn :size="18" aria-hidden="true"/></span><span><strong>Cost Benchmark</strong><small>Compare compute costs using your model and expected traffic.</small></span><ArrowRight :size="16" class="way-go" aria-hidden="true"/></button>
      </section>

      <section class="improve">
        <label for="improve-model"><Network :size="16"/> Improve model:</label>
        <select id="improve-model" v-model="improve" class="text-input compact" :disabled="!models.length">
          <option v-if="!models.length" value="">No model trained yet</option>
          <option v-for="m in models" :key="key(m)" :value="key(m)">{{ m.project.name }}: {{ m.name }} {{ m.version || '' }}</option>
        </select>
        <a v-if="improving" class="button button--primary small" :href="projectLink(improving.project.ref, 'models')"><ChartLine :size="14"/> Analyze Model</a>
        <UiButton v-else variant="primary" class="small" disabled><ChartLine :size="14"/> Analyze Model</UiButton>
      </section>

      <section id="ws-deploy-lists" class="lists">
        <div class="lists-head">
          <div class="list-tabs" role="tablist" aria-label="Projects">
            <button type="button" role="tab" :aria-selected="listTab==='deployed'" :class="{active:listTab==='deployed'}" @click="listTab='deployed'"><Rocket :size="15"/> Deployments</button>
            <button type="button" role="tab" :aria-selected="listTab==='idle'" :class="{active:listTab==='idle'}" @click="listTab='idle'"><Layers :size="15"/> Not Yet Deployed</button>
          </div>
          <div class="list-actions">
            <a class="button icon-button-box" :href="API_REFERENCE" aria-label="API reference" title="API reference"><BookOpen :size="16"/></a>
            <UiButton @click="keysOpen=true"><KeyRound :size="15"/> API Keys</UiButton>
            <UiButton @click="emit('create')"><Plus :size="15"/> Create Project</UiButton>
          </div>
        </div>

        <p v-if="!data && !error" class="muted">Loading deployments…</p>
        <template v-else-if="listTab==='deployed'">
          <div v-if="!deployed.length" class="list-empty">
            <span class="empty-icon"><Rocket :size="22"/></span>
            <h3>Nothing is deployed yet</h3>
            <p>Train a model in a project, approve it, then deploy it to staging or production from that project's Deployments page.</p>
            <div class="empty-actions"><UiButton @click="listTab='idle'">See projects not yet deployed</UiButton><UiButton variant="primary" @click="emit('navigate','models')"><Network :size="15"/> Try a Model</UiButton></div>
          </div>
          <div v-else class="table-wrap">
            <table class="ws-table">
              <thead><tr><th>Project</th><th>Staging</th><th>Production</th><th>Calls, last 7 days</th><th><span class="sr-only">Open</span></th></tr></thead>
              <tbody>
                <tr v-for="row in deployed" :key="row.project.ref">
                  <td data-label="Project"><strong>{{ row.project.name }}</strong></td>
                  <td v-for="env in row.environments" :key="env.key" :data-label="env.label">
                    <UiBadge :tone="environmentState(env)[0]">{{ environmentState(env)[1] }}</UiBadge>
                    <small v-if="env.live">{{ modelName(env.live.model) }}, revision {{ env.live.number }}<template v-if="env.live.live_at">, live since {{ day(env.live.live_at) }}</template></small>
                    <small v-if="env.live&&env.live.healthy===false">It did not answer at its last check, {{ timeAgo(env.live.checked_at) }}. Its Deployments page checks it again.</small>
                    <small v-if="env.starting">{{ modelName(env.starting.model) }} is starting as revision {{ env.starting.number }}.</small>
                  </td>
                  <td data-label="Calls, last 7 days"><template v-if="row.usage">{{ row.usage.calls }} <small>{{ row.usage.answered }} answered, last {{ timeAgo(row.usage.last) }}</small></template><span v-else class="muted">None</span></td>
                  <td class="row-actions"><a class="button" :href="projectLink(row.project.ref,'deploy')">{{ row.may.deploy ? 'Manage' : 'Open' }}</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <template v-else>
          <div v-if="!idle.length" class="list-empty">
            <span class="empty-icon"><Check :size="22"/></span>
            <h3>Everything here is deployed.</h3>
            <p>You can view the Deployments tab, or create another project if you are ready to deploy more.</p>
            <div class="empty-actions"><UiButton @click="listTab='deployed'"><Rocket :size="15"/> View Deployments</UiButton><UiButton variant="primary" @click="emit('navigate','models')"><Network :size="15"/> Try a Model</UiButton></div>
          </div>
          <ul v-else class="idle-list">
            <li v-for="row in idle" :key="row.project.ref">
              <span><strong>{{ row.project.name }}</strong>
                <small v-if="row.models_ready">{{ row.models_ready }} model{{ row.models_ready===1?'':'s' }} trained, not deployed yet</small>
                <small v-else>No model trained yet</small></span>
              <a v-if="row.models_ready" class="button" :href="projectLink(row.project.ref,'deploy')"><Rocket :size="14"/> {{ row.may.deploy ? 'Deploy' : 'Open' }}</a>
              <a v-else class="button" :href="projectLink(row.project.ref,'train')">Train a model</a>
            </li>
          </ul>
        </template>
      </section>
    </div>

    <UiDialog :open="keysOpen" title="API keys" @close="keysOpen=false">
      <p class="dialog-description">An app calls a project's model with a key of its own, made on the project's Connect app page. Keys are never shown again after they are made.</p>
      <p v-if="!rows.length" class="muted">No project yet.</p>
      <ul class="key-list"><li v-for="row in rows" :key="row.project.ref"><span>{{ row.project.name }}</span><a class="text-link" :href="projectLink(row.project.ref,'connect')" @click="keysOpen=false">Its keys</a></li></ul>
      <div class="dialog-actions"><UiButton @click="keysOpen=false">Close</UiButton></div>
    </UiDialog>

    <UiDialog class="ded-dialog" :open="creating" title="New deployment" @close="creating=false">
      <form class="ded-form" novalidate @submit.prevent="startDeployment">
        <p class="dialog-description">Choose a model and a machine for it. Nothing starts until you press Start deployment.</p>

        <fieldset v-if="sources.length > 1" class="ded-field">
          <legend>Source</legend>
          <div class="ded-cards two">
            <label v-for="src in sources" :key="src.value" class="ded-card" :class="{chosen: form.source===src.value}">
              <input v-model="form.source" type="radio" name="ded-source" :value="src.value">
              <span><strong>{{ src.label }}</strong><small>{{ src.about }}</small></span>
            </label>
          </div>
          <p v-if="fieldErrors.source" class="field-error" role="alert">{{ fieldErrors.source }}</p>
        </fieldset>
        <div class="ded-field">
          <label for="ded-name">Name</label>
          <input id="ded-name" v-model.trim="form.name" class="text-input" autocomplete="off" spellcheck="false" maxlength="30"
                 :aria-invalid="!!fieldErrors.name" aria-describedby="ded-name-help ded-name-error"
                 @blur="checkName" @input="nameTouched && checkName()">
          <p id="ded-name-help" class="ded-help">{{ DEDICATED_NAME_RULE }} It is part of the address your apps call.</p>
          <p id="ded-name-error" class="field-error" aria-live="polite">{{ fieldErrors.name }}</p>
        </div>

        <fieldset class="ded-field">
          <legend>Type</legend>
          <div class="ded-cards two">
            <label v-for="k in options.kinds" :key="k.value" class="ded-card" :class="{chosen: form.kind===k.value}">
              <input v-model="form.kind" type="radio" name="ded-kind" :value="k.value">
              <span><strong>{{ k.label }}</strong>
                <small>{{ k.about || (k.value==='development' ? `Stops after ${k.idle_minutes || 60} minutes without a call.` : 'Stays on until you stop it.') }}</small></span>
            </label>
          </div>
          <p v-if="fieldErrors.kind" class="field-error" role="alert">{{ fieldErrors.kind }}</p>
        </fieldset>

        <div v-if="form.source==='open_model'" class="ded-field">
          <label for="ded-open-model">Open model</label>
          <select id="ded-open-model" v-model="form.open_model" class="text-input" :disabled="!offeredOpen.length" :aria-invalid="!!fieldErrors.open_model" aria-describedby="ded-open-help ded-open-error">
            <option v-if="!offeredOpen.length" value="">No open model can be deployed</option>
            <option v-for="m in offeredOpen" :key="m.id" :value="String(m.id)">{{ m.name }} ({{ m.kind === 'chat' ? 'chat' : 'photos' }})</option>
          </select>
          <p id="ded-open-help" class="ded-help">{{ chosenOpen ? `${openModelLine(chosenOpen)}. It runs as published, with no internet access.` : missingOpenModel(openModels) }}</p>
          <p id="ded-open-error" class="field-error" aria-live="polite">{{ fieldErrors.open_model }}</p>
        </div>

        <div v-else class="ded-row">
          <div class="ded-field">
            <label for="ded-project">Project</label>
            <select id="ded-project" v-model="form.project" class="text-input" :aria-invalid="!!fieldErrors.project" aria-describedby="ded-project-error">
              <option v-if="!options.projects.length" value="">No project yet</option>
              <option v-for="p in options.projects" :key="p.ref" :value="p.ref">{{ p.name }}</option>
            </select>
            <p id="ded-project-error" class="field-error" aria-live="polite">{{ fieldErrors.project }}</p>
          </div>
          <div class="ded-field">
            <label for="ded-model">Model</label>
            <select id="ded-model" v-model="form.model" class="text-input" :disabled="!eligible.length" :aria-invalid="!!fieldErrors.model" aria-describedby="ded-model-help ded-model-error">
              <option v-if="!eligible.length" value="">No approved model</option>
              <option v-for="m in eligible" :key="m.number" :value="String(m.number)">{{ modelName(m) }}</option>
            </select>
            <p id="ded-model-help" class="ded-help">{{ eligible.length ? `Only models approved for ${form.kind==='production' ? 'production' : 'staging'} are listed.` : missingApproval(chosenProject, form.kind) }}</p>
            <p id="ded-model-error" class="field-error" aria-live="polite">{{ fieldErrors.model }}</p>
          </div>
        </div>

        <fieldset class="ded-field">
          <legend>Machine</legend>
          <div class="ded-cards">
            <label v-for="m in machinesShown" :key="m.instance_type" class="ded-card" :class="{chosen: form.instance_type===m.instance_type}">
              <input v-model="form.instance_type" type="radio" name="ded-machine" :value="m.instance_type">
              <span><strong><Zap v-if="m.gpu" :size="14" aria-hidden="true"/><Cpu v-else :size="14" aria-hidden="true"/> {{ m.instance_type }}</strong>
                <small>{{ machineKind(m) }}</small><small>{{ machineCost(m) }}</small></span>
            </label>
          </div>
          <p v-if="form.source==='open_model' && machinesShown.length" class="ded-help">Only machines with room for this model are listed.</p>
          <p v-if="!machinesShown.length" class="ded-help">No machine can be chosen right now.</p>
          <p v-if="fieldErrors.instance_type" class="field-error" role="alert">{{ fieldErrors.instance_type }}</p>
        </fieldset>

        <p v-if="costLine" class="ded-cost" aria-live="polite">{{ costLine }}</p>
        <p v-if="formError" class="field-error" role="alert">{{ formError }}</p>
        <div class="ded-actions">
          <p v-if="startWhy" id="ded-start-why" class="ded-why">{{ startWhy }}</p>
          <UiButton @click="creating=false">Cancel</UiButton>
          <UiButton type="submit" variant="primary" :disabled="!!startWhy || starting" :aria-describedby="startWhy ? 'ded-start-why' : undefined">
            <LoaderCircle v-if="starting" class="spin" :size="15" aria-hidden="true"/> {{ starting ? 'Starting…' : 'Start deployment' }}
          </UiButton>
        </div>
      </form>
    </UiDialog>

    <UiDialog :open="!!stopping" :title="stopping ? `Stop ${stopping.name}?` : ''" @close="stopping=null">
      <template v-if="stopping">
        <p class="dialog-description">Its machine is shut down and calls to its address are refused. Apps that call it stop getting answers.</p>
        <p v-if="stopError" class="field-error" role="alert">{{ stopError }}</p>
        <div class="dialog-actions">
          <UiButton @click="stopping=null">Keep it running</UiButton>
          <UiButton variant="primary" class="danger" :disabled="stopBusy" @click="confirmStop"><Square :size="13" aria-hidden="true"/> {{ stopBusy ? 'Stopping…' : 'Stop deployment' }}</UiButton>
        </div>
      </template>
    </UiDialog>

    <UiDialog class="ded-dialog" :open="!!using" :title="using ? `Use ${using.name}` : ''" @close="using=null">
      <template v-if="using">
        <p class="dialog-description">Call {{ using.name }} from your own code. {{ using.call==='chat' ? CHAT_ABOUT : 'Each call is one photo, answered with what the model found.' }}</p>
        <p v-if="ded.cost_note" class="ded-billing"><Wallet :size="16" aria-hidden="true"/><span>Calls are not charged one by one: the deployment's machine is. {{ ded.cost_note }}</span></p>
        <ol class="use-steps">
          <li>
            <h3><span class="use-step-no" aria-hidden="true">1</span>Choose your language</h3>
            <div class="segmented" role="radiogroup" aria-label="Language">
              <button v-for="l in languages" :key="l" type="button" role="radio" :aria-checked="language===l" :class="{on:language===l}" @click="language=l">{{ l }}</button>
            </div>
          </li>
          <li>
            <h3><span class="use-step-no" aria-hidden="true">2</span>Install</h3>
            <div v-if="usesInstall(using, language)" class="command-row">
              <code>{{ installLine }}</code>
              <button type="button" class="copy-chip" :aria-label="copied==='install' ? 'Install command copied' : 'Copy the install command'" @click="copyText(installLine,'install')"><Check v-if="copied==='install'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copied==='install' ? 'Copied' : 'Copy' }}</button>
            </div>
            <p v-else class="step-note">Nothing to install: {{ language==='JavaScript' ? 'browsers and Node.js 18 or newer have fetch built in.' : 'curl comes with macOS, Linux and Windows 10 or newer.' }}</p>
          </li>
          <li>
            <h3><span class="use-step-no" aria-hidden="true">3</span>Copy and run the code</h3>
            <div class="use-code">
              <button type="button" class="copy-chip on-dark" :aria-label="copied==='code' ? 'Code copied' : 'Copy the code'" @click="copyText(useCode,'code')"><Check v-if="copied==='code'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copied==='code' ? 'Copied' : 'Copy' }}</button>
              <pre class="code-block" tabindex="0" :aria-label="`Code to call ${using.name} with ${language}`"><code>{{ useCode }}</code></pre>
            </div>
          </li>
        </ol>
        <dl class="use-facts">
          <div><dt>{{ using.call==='chat' ? 'Address (the base URL is everything before /chat/completions)' : 'Address' }}</dt><dd><code>{{ useUrl }}</code><button type="button" class="copy-icon" :aria-label="copied==='address' ? 'Address copied' : 'Copy the address'" @click="copyText(useUrl,'address')"><Check v-if="copied==='address'" :size="14" aria-hidden="true"/><Copy v-else :size="14" aria-hidden="true"/></button></dd></div>
          <div><dt>App key</dt><dd><KeyRound :size="14" aria-hidden="true"/>
            <span v-if="using.project">A key of an app allowed to call {{ using.project.name }} in {{ environmentLabel(using.environment).toLowerCase() }}. <a class="text-link" :href="projectLink(using.project.ref,'connect')" @click="using=null">Make or find one</a></span>
            <span v-else>A key of an app of this workspace that may call one of its projects in {{ environmentLabel(using.environment).toLowerCase() }}. Keys are made on a project's Connect app page.</span></dd></div>
        </dl>
        <p class="sr-only" aria-live="polite">{{ copied ? `Copied ${COPIED_WORDS[copied]}.` : '' }}</p>
        <p v-if="copyError" class="field-error" role="alert">{{ copyError }}</p>
        <div class="dialog-actions"><UiButton @click="using=null">Close</UiButton></div>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.muted{font-size:12px!important;color:#5f6d82!important}
.deploy-tabs{display:flex;gap:4px;border-bottom:1px solid #e3e6ed;margin:-4px 0 22px;overflow-x:auto;scrollbar-width:thin}
.deploy-tabs button{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;background:none;border:0;border-bottom:2px solid transparent;padding:12px 12px;color:#5f6d82;font:inherit;font-size:13px;cursor:pointer;transition:color .15s,border-color .15s}
.deploy-tabs button:hover{color:#162139}
.deploy-tabs button.active{color:var(--aadml-primary);border-color:var(--aadml-primary);font-weight:600}
.deploy-tabs .badge{margin-left:2px}
.soon{display:flex;gap:18px;align-items:flex-start;padding:28px}
.soon h2{display:flex;align-items:center;gap:10px;margin:2px 0 8px}
.soon p{max-width:620px;margin:0 0 16px}
.soon-icon,.way-icon,.empty-icon{display:grid;place-items:center;flex-shrink:0;border-radius:10px;background:var(--aadml-soft);color:var(--aadml-primary)}
.soon-icon{width:52px;height:52px}
/* the overview */
.runs{background:var(--aadml-tint);border:1px solid var(--aadml-soft);border-radius:12px;padding:18px 20px 14px;transition:opacity .2s}
.runs.refreshing{opacity:.6}
.runs-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.ranges{display:flex;gap:4px}
.ranges button{border:0;background:none;border-radius:7px;padding:6px 11px;font:inherit;font-size:12px;font-weight:600;color:#4c5d74;cursor:pointer}
.ranges button:hover{background:#eef2f8}
.ranges button.active{background:var(--aadml-soft);color:var(--aadml-primary)}
.runs-note{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#5f6d82}
.icon-only{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:7px;background:none;color:#5f6d82;cursor:pointer}
.icon-only:hover{background:#eef2f8;color:var(--aadml-primary)}
.runs-hero{display:flex;justify-content:center;align-items:stretch;gap:8px;margin-top:6px}
.digits,.bolt{display:grid;place-items:center;border:1px solid #d9e0ea;border-radius:8px;background:#fff;box-shadow:0 2px 0 #e6ebf2}
.digits{min-width:76px;padding:2px 12px;font-size:34px;font-weight:700;color:#162139;font-variant-numeric:tabular-nums;letter-spacing:.01em}
.bolt{width:46px;color:#162139}
.runs-label{text-align:center;margin:8px 0 6px!important;font-size:14px;color:#4c5d74!important}
.chart,.chart-wait{position:relative;height:190px;margin:6px 0 22px}
.chart{cursor:crosshair;outline:none}
.chart:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:4px;border-radius:6px}
.chart svg{width:100%;height:100%;display:block;overflow:visible}
.chart .area{fill:var(--aadml-primary);opacity:.12}
.chart .line{fill:none;stroke:var(--aadml-primary);stroke-width:2}
.chart .base{stroke:#c9d3e2;stroke-width:1}
.crosshair{position:absolute;top:0;bottom:0;width:1px;background:#9fb1cc;pointer-events:none}
.dot{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--aadml-primary);box-shadow:0 0 0 2px #fff;pointer-events:none}
.tip{position:absolute;top:4px;transform:translateX(10px);display:flex;flex-direction:column;gap:2px;min-width:140px;padding:8px 10px;border:1px solid #e0e6ef;border-radius:8px;background:#fff;box-shadow:0 6px 18px #0f172a1f;font-size:12px;color:#162139;pointer-events:none;z-index:2}
.tip.flip{transform:translateX(calc(-100% - 10px))}
.tip small{color:#5f6d82;font-size:11px}
.ticks{position:absolute;left:0;right:0;bottom:-20px;height:16px;font-size:11px;color:#5f6d82}
.ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.ticks span:first-child{transform:none}
.ticks span:last-child{transform:translateX(-100%)}
.chart-wait{border-radius:8px;background:linear-gradient(90deg,var(--aadml-tint),var(--aadml-soft),var(--aadml-tint))}
.as-table{font-size:12px;color:#4c5d74;margin-top:4px}
.as-table summary{cursor:pointer;color:var(--aadml-primary);width:max-content}
.as-table .table-wrap{max-height:260px;margin-top:8px}
.ask{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:22px 0 18px;padding:14px 18px;border:1px solid #e3e8f1;border-radius:12px;background:linear-gradient(100deg,#f7f9fc,#fff 60%,var(--aadml-tint))}
.ask p{margin:0!important;color:#162139!important;font-size:14px;font-weight:500}
.ways{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.way{display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #dde3ec;border-radius:12px;background:#fff;text-align:left;font:inherit;color:inherit;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.way:hover{border-color:var(--aadml-outline);box-shadow:0 4px 14px #0f172a0d}
.way:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.way-icon{width:40px;height:40px}
.way strong{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px;color:#162139}
.way small{display:block;margin-top:3px;font-size:13px;line-height:1.45;color:#4c5d74}
.way-go{margin-left:auto;flex-shrink:0;color:#7c8aa0}
.improve{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:18px 0 24px;padding:12px 16px;border:1px solid #e3e8f1;border-radius:12px;background:#f8f9fb}
.improve label{display:inline-flex;align-items:center;gap:7px;font-size:14px;color:#162139}
.improve label svg{color:var(--aadml-primary)}
.improve select{max-width:340px;min-width:200px}
.button.small,.small{min-height:32px;padding:6px 12px;font-size:13px}
.lists-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;border-bottom:1px solid #e3e6ed;margin-bottom:14px}
.list-tabs{display:flex;gap:4px}
.list-tabs button{display:inline-flex;align-items:center;gap:7px;background:none;border:0;border-bottom:2px solid transparent;padding:12px 12px;font:inherit;font-size:14px;color:#5f6d82;cursor:pointer}
.list-tabs button.active{color:var(--aadml-primary);border-color:var(--aadml-primary);font-weight:600}
.list-actions{display:flex;gap:8px;padding-bottom:8px;flex-wrap:wrap}
.icon-button-box{display:grid;place-items:center;width:40px;padding:0}
.list-empty{text-align:center;padding:30px 20px;border:1px solid #e3e8f1;border-radius:12px;background:#fff}
.empty-icon{width:46px;height:46px;margin:0 auto;border-radius:50%;background:#f1f4f8;color:#4c5d74}
.list-empty h3{margin:12px 0 6px;font-size:16px}
.list-empty p{margin:0 auto 16px;max-width:520px}
.empty-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
.ws-table td{vertical-align:top;font-size:13px}
.ws-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:5px;max-width:300px;line-height:1.5}
.row-actions{white-space:nowrap;text-align:right}
.row-actions .button{min-height:32px;padding:6px 12px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.badge--amber{color:#93610b;background:#fff4dc}
.idle-list{list-style:none;padding:0;margin:0;border:1px solid #e3e8f1;border-radius:12px;background:#fff}
.idle-list li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #eef0f4;flex-wrap:wrap}
.idle-list li:last-child{border-bottom:0}
.idle-list small{display:block;font-size:12px;color:#5f6d82;margin-top:2px}
.idle-list .button{min-height:32px;padding:6px 12px}
.key-list{list-style:none;padding:0;margin:8px 0 0}
.key-list li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #eef0f4}
.key-list .text-link{margin:0}
/* dedicated deployments */
.ded-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.ded-head h2{margin:0 0 4px}
.ded-head p{margin:0;max-width:620px;color:#4c5d74}
.ded-billing{display:flex;gap:8px;align-items:flex-start;margin:0 0 16px;font-size:13px;line-height:1.55;color:#33415a!important}
.ded-billing svg{flex-shrink:0;margin-top:2px;color:#5f6d82}
.ded-error{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 16px;padding:10px 14px;border:1px solid #efc5ce;border-radius:10px;background:#fff5f6;color:#ad3449;font-size:13px}
.ded-table .ded-name{color:#162139;overflow-wrap:anywhere}
.ded-table td{min-width:0}
.kind-chip{display:inline-flex;align-items:center;padding:4px 8px;border:1px solid #d9e0ea;border-radius:5px;font-size:11px;font-weight:550;color:#33415a;background:#fff;white-space:nowrap}
.kind-chip.production{border-color:var(--aadml-outline);color:var(--aadml-primary)}
.badge--red{color:#a12c3c;background:#fdecee}
.badge .spin{margin-right:2px}
.spin{animation:ded-spin 1.1s linear infinite}
@keyframes ded-spin{to{transform:rotate(360deg)}}
.failed-why{color:#a12c3c!important}
.ded-acts{display:inline-flex;gap:6px;flex-wrap:wrap}
.ded-acts .button.small{min-height:44px}
.ded-dialog{width:min(680px,calc(100% - 32px))}
.ded-form{margin:0}
.ded-field{display:block;margin:18px 0 0;min-width:0;border:0;padding:0}
.ded-field > label,.ded-field > legend{display:block;font-size:13px;font-weight:600;color:#1d2a42;margin:0 0 8px}
.ded-field .text-input{display:block;width:100%;min-height:44px;margin:0;padding:10px 12px;font-size:14px}
.ded-field .text-input:focus-visible,.ded-card:focus-within{outline:2px solid var(--aadml-focus);outline-offset:2px}
.ded-field .text-input[aria-invalid="true"]{border-color:#c0394c}
.ded-help{margin:6px 0 0!important;font-size:12px!important;line-height:1.5!important;color:#5f6d82!important}
.ded-field .field-error{margin:6px 0 0}
.ded-field .field-error:empty{margin:0}
.ded-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}
.ded-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.ded-card{display:flex;align-items:flex-start;gap:10px;min-height:44px;padding:12px 14px;border:1px solid #dce0e8;border-radius:9px;background:#fff;cursor:pointer;transition:border-color .15s,background-color .15s}
.ded-card:hover{border-color:var(--aadml-focus)}
.ded-card.chosen{border-color:var(--aadml-focus);background:var(--aadml-tint)}
.ded-card input{margin-top:3px;width:16px;height:16px}
.ded-card span{display:flex;flex-direction:column;gap:3px;min-width:0}
.ded-card strong{display:inline-flex;align-items:center;gap:6px;font-size:14px;color:#162139}
.ded-card small{font-size:12px;line-height:1.5;color:#4c5d74}
.ded-cost{margin:20px 0 0!important;padding:10px 14px;border-radius:9px;background:#f4f6fa;color:#22304a!important;font-size:13px}
.ded-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:20px;flex-wrap:wrap}
.ded-actions .button{min-height:44px}
.ded-why{margin:0 auto 0 0!important;flex:1 1 220px;font-size:12px!important;line-height:1.5!important;color:#6f4500!important}
.button--primary.danger{background:#b42318;border-color:#b42318}
.button--primary.danger:hover:not(:disabled){background:#912018;border-color:#912018}
.source-chip{display:inline-flex;align-items:center;padding:3px 7px;margin-bottom:5px;border-radius:5px;font-size:11px;font-weight:550;color:#33415a;background:#f1f4f8}
.source-chip.open_model{color:var(--aadml-primary);background:var(--aadml-tint)}
.ded-source-title{display:block;color:#162139;overflow-wrap:anywhere}
/* "Use", as the Models page's "Use model" */
.use-steps{list-style:none;padding:0;margin:20px 0 0;display:grid;grid-template-columns:minmax(0,1fr);gap:20px}
.use-steps li{min-width:0}
.use-steps h3{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:14px;color:#1d2a42}
.use-step-no{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#1d2a42;color:#fff;font-size:12px;font-weight:600}
.use-steps li > :not(h3){margin-left:34px}
.segmented{display:inline-flex;padding:3px;border-radius:9px;background:#f1f3f7;gap:2px;flex-wrap:wrap}
.segmented button{min-height:44px;padding:7px 14px;border:0;border-radius:7px;background:transparent;color:#4d5a70;font:inherit;font-size:13px;font-weight:550;cursor:pointer;transition:background-color .15s,color .15s}
.segmented button.on{background:#fff;color:var(--aadml-primary);box-shadow:0 1px 3px #1d2a4224}
.segmented button:hover:not(.on){color:#1d2a42}
.segmented button:focus-visible,.copy-chip:focus-visible,.copy-icon:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.command-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 8px 8px 14px;border:1px solid #dfe3eb;border-radius:9px;background:#f8f9fb}
.command-row code{font-size:13px;color:#1d2a42;overflow-wrap:anywhere}
.step-note{margin:0!important;font-size:13px;color:#5f6d82!important}
.copy-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:6px 12px;border:1px solid #dfe3eb;border-radius:7px;background:#fff;color:#33415a;font:inherit;font-size:12px;font-weight:550;cursor:pointer;transition:background-color .15s,border-color .15s}
.copy-chip:hover{border-color:var(--aadml-focus);background:var(--aadml-tint)}
.copy-chip.on-dark{position:absolute;top:8px;right:8px;background:#2c3a50;border-color:#3e4d65;color:#e3e8f1}
.copy-chip.on-dark:hover{background:#38475f;border-color:#53637d}
.use-code{position:relative;min-width:0}
.use-code .code-block{margin:0;min-height:0;max-height:300px;overflow:auto;padding:60px 22px 20px;white-space:pre;font-size:12.5px;line-height:1.7}
.use-code .code-block:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px}
.use-facts{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:10px;margin:22px 0 0}
.use-facts > div{padding:12px 14px;border:1px solid #e3e6ed;border-radius:9px;min-width:0}
.use-facts dt{font-size:12px;color:#6b778c;margin-bottom:6px}
.use-facts dd{margin:0;display:flex;align-items:flex-start;gap:6px;font-size:13px;color:#22304a;overflow-wrap:anywhere;line-height:1.45}
.use-facts dd svg{flex-shrink:0;margin-top:2px;color:#6b778c}
.use-facts code{font-size:12px;min-width:0}
.use-facts .text-link{margin:0}
.copy-icon{display:inline-grid;place-items:center;flex-shrink:0;min-width:44px;min-height:44px;margin:-12px -10px -12px auto;border:0;border-radius:6px;background:transparent;color:#6b778c;cursor:pointer}
.copy-icon:hover{background:var(--aadml-tint);color:var(--aadml-primary)}
@media(max-width:900px){.ways{grid-template-columns:1fr}}
@media(max-width:640px){
  .ded-head .button{width:100%}
  .ded-row{grid-template-columns:1fr}
  .ded-cards{grid-template-columns:1fr}
  .use-facts{grid-template-columns:1fr}
  .use-steps li > :not(h3){margin-left:0}
  .segmented{display:flex;flex-wrap:nowrap}
  .segmented button{flex:1 1 0;min-width:0;padding:7px 6px}
  .command-row{flex-wrap:wrap}
  .use-code .code-block{font-size:12px;padding:60px 16px 16px}
  .ded-actions .button{flex:1 1 auto}
  .ded-why{flex-basis:100%}
}
@media(max-width:650px){
  .runs{padding:14px}
  .digits{font-size:28px}
  .chart,.chart-wait{height:150px}
  .improve select{min-width:0;flex:1}
  .ws-table thead{display:none}
  .ws-table,.ws-table tbody,.ws-table tr,.ws-table td{display:block;width:100%}
  .ws-table tr{border-bottom:1px solid #e9eaf0;padding:10px 0}
  .ws-table td{border:0!important;padding:6px 14px!important}
  .ws-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:4px}
  .row-actions{text-align:left}
}
@media(prefers-reduced-motion:reduce){.runs,.way,.deploy-tabs button,.ded-card,.segmented button,.copy-chip{transition:none}.spin{animation:none}}
</style>
