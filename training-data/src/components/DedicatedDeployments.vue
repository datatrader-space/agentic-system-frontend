<script setup>
// The Dedicated Deployments tab (TRAINING_PHASE3_SERVING_PLAN.md 7.9): a project's approved model, or an open model the
// workspace added from Hugging Face as it is (TRAINING_OPEN_MODELS_PLAN.md section 4), on a machine of its own: one
// AADML rents (RunPod) or one of the workspace's own machines (machine:<id>, backend machine_deployments.py). Its state,
// how an app calls it, and Stop. The workspace Deployments page shows it for every project; a project's Deploy page
// shows it with ``projectRef``: that project's deployments and the workspace's open models', and a start for that
// project only (the same calls, so every rule stays the backend's: the Train right, the model's approval for the
// environment, a machine of this workspace, the person's balance). A chat project's trained version is offered the same
// way (backend dedicated.start_chat; owner, 2026-11-18): approved for the environment on the project's Deploy page, on a
// GPU that holds it or one of the workspace's machines, and called as OpenAI's chat completions.
// Backend: app_api.py workspace/dedicated/ (list, start) and workspace/dedicated/<id>/stop/.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Activity, Check, Code, Copy, Cpu, KeyRound, LoaderCircle, Plus, RefreshCw, Rocket, Server, Square, Wallet } from 'lucide-vue-next';
import '../deployments.css';
import DeploymentHeader from './DeploymentHeader.vue';
import DeploymentMetrics from './DeploymentMetrics.vue';
import DeploymentToolbar from './DeploymentToolbar.vue';
import MachinePicker from './MachinePicker.vue';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import {
  workspaceApi, projectLink, modelName, timeAgo, DEDICATED_NAME_RULE, dedicatedNameProblem, dedicatedCostSummary,
  dedicatedModels, missingApproval, dedicatedState, anyStarting, DEDICATED_HOST, DEDICATED_SOURCES, deployableOpenModels,
  dedicatedMachinesFor, machineKind, openModelLine, missingOpenModel, dedicatedSource, useLanguages, useInstall, usesInstall,
  useSnippet, dedicatedOfProject, projectStartProblem, focusDeploymentsTab, APP_KEY_WHERE,
} from '../api/workspace.js';

// projectRef: the project whose Deploy page this is ('' on the workspace Deployments page). chat: that project is a chat
// project (its Deploy page is LlmDeploy.vue): Edge Devices, which answers photos, is not offered there.
const props = defineProps({ projectRef: { type: String, default: '' }, chat: { type: Boolean, default: false } });
const emit = defineEmits(['navigate']);
// Edge Devices is on the workspace Deployments page: a project's page opens it there.
function openEdge() { focusDeploymentsTab('edge'); emit('navigate', 'deployments'); }
// The list is read when this opens, and again every 5 seconds while one of them is starting and it is open.
const ded = ref(null); const dedError = ref(''); const dedLoading = ref(false);
const dedSaid = ref(''); const announce = ref('');
const deployments = computed(() => dedicatedOfProject(ded.value?.deployments, props.projectRef));
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
  if (!gone && anyStarting(deployments.value)) pollTimer = setTimeout(loadDedicated, 5000);
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
onMounted(loadDedicated);
const kindLabel = kind => options.value.kinds.find(k => k.value === kind)?.label || (kind === 'production' ? 'Production' : 'Development');
const machineOf = type => [...(options.value.machines || []), ...(options.value.open_machines || [])].find(m => m.instance_type === type);
const environmentLabel = env => (env === 'production' ? 'Production' : 'Staging');
const lastCall = d => (d.last_used_at ? timeAgo(d.last_used_at) : 'No calls yet');

// "New deployment": the form, checked here as the backend checks it; a refusal names its field.
const creating = ref(false); const starting = ref(false);
const form = ref({ source: 'model', name: '', project: '', model: '', open_model: '', instance_type: '', kind: 'development' });
const fieldErrors = ref({}); const formError = ref(''); const nameTouched = ref(false);
const chosenProject = computed(() => options.value.projects.find(p => p.ref === form.value.project) || null);
// On a project's page: why this project's model cannot be started here, if it cannot.
const projectProblem = computed(() => projectStartProblem(options.value, props.projectRef));
const thisProject = computed(() => options.value.projects.find(p => p.ref === props.projectRef) || null);
const eligible = computed(() => dedicatedModels(chosenProject.value, form.value.kind));
// A chat project's version brings its own machines (the GPUs and the workspace's machines that hold its weights).
const chatProject = computed(() => chosenProject.value?.family === 'llm');
const chosenModel = computed(() => eligible.value.find(m => String(m.number) === String(form.value.model)) || null);
const mayOpen = computed(() => dedMay.value.start_open_model === true);
const sources = computed(() => DEDICATED_SOURCES.filter(source => source.value === 'model' || mayOpen.value));
const openModels = computed(() => options.value.open_models || []);
const offeredOpen = computed(() => deployableOpenModels(openModels.value));
const chosenOpen = computed(() => offeredOpen.value.find(m => String(m.id) === String(form.value.open_model)) || null);
const machinesShown = computed(() => dedicatedMachinesFor(options.value, form.value.source, chosenOpen.value,
  form.value.source === 'model' && chatProject.value ? (chosenModel.value || { machines: [] }) : null));
const chosenMachine = computed(() => machinesShown.value.find(m => m.instance_type === form.value.instance_type) || null);
// The workspace's own machines this model may run on (backend machine_deployments.py; MACHINE_RUNPOD_PARITY_PLAN.md):
// each with whether it holds the model and why not, and the platform fee. Chosen as 'machine:<id>'.
const ownMachines = computed(() => (form.value.source === 'open_model' ? chosenOpen.value?.own_machines
  : chatProject.value ? chosenModel.value?.own_machines : chosenProject.value?.own_machines) || []);
const chosenOwn = computed(() => ownMachines.value.find(m => m.key === form.value.instance_type) || null);
// The machines of this form in the picker's shape (MachinePicker): GPU or CPU, then one from a list.
const dedPicker = ref(null);
const loadDedMachines = computed(() => {
  const listed = machinesShown.value.map(m => ({
    key: m.instance_type, kind: m.gpu === false ? 'cpu' : 'gpu', gpu_name: m.gpu_name || m.instance_type,
    memory_gb: m.memory_gb ?? '', data_center: m.data_center || '', soc2: !!m.soc2, stock_text: m.stock_text || '',
    files_here: !!m.files_here, usd_per_hour: m.charged_usd_per_hour, usd_per_second: m.usd_per_second || (Number(m.charged_usd_per_hour) / 3600),
  })).concat(ownMachines.value);
  const gpuOnly = form.value.source === 'open_model' ? chosenOpen.value?.gpu_only || ''
    : chatProject.value ? chosenModel.value?.gpu_only || '' : '';
  return () => Promise.resolve({ machines: listed, gpu_only: gpuOnly,
    note: 'You are charged by the second it runs, from your balance. A location without the model\'s files copies them first.' });
});
const chosenKind = computed(() => options.value.kinds.find(k => k.value === form.value.kind) || null);
const costLine = computed(() => (chosenOwn.value
  ? `${chosenOwn.value.name} (your machine) costs ${chosenOwn.value.price_text}, billed by the second from your balance${form.value.kind === 'development' ? `; it stops itself after ${chosenKind.value?.idle_minutes || 60} minutes without a call` : ' until you stop it'}. If the machine is offline, calls say so; nothing moves to RunPod.`
  : dedicatedCostSummary(chosenMachine.value, form.value.kind, chosenKind.value?.idle_minutes || 60)));
const anyMachine = computed(() => machinesShown.value.length > 0 || ownMachines.value.some(m => m.fits));
const mayStart = computed(() => dedMay.value[`start_${form.value.kind}`] === true);
const startWhy = computed(() => {
  if (!mayStart.value) return dedMay.value[`reason_${form.value.kind}`] || 'You may not start this type of deployment.';
  if (form.value.source === 'open_model') {
    if (!chosenOpen.value) return missingOpenModel(openModels.value) || 'Choose an open model.';
    if (!anyMachine.value) return 'No machine that holds this model can be chosen right now.';
    return '';
  }
  if (projectProblem.value) return projectProblem.value;
  if (!eligible.value.length) return props.projectRef ? missingApproval(chosenProject.value, form.value.kind) : 'Choose a project with an approved model.';
  if (!anyMachine.value) return 'No machine can be chosen right now.';
  return '';
});
// A changed source, open model or chat version keeps the machine only while it is still offered for it.
watch([() => form.value.source, () => form.value.open_model, () => form.value.model, machinesShown], () => {
  if (!machinesShown.value.some(m => m.instance_type === form.value.instance_type) && !ownMachines.value.some(m => m.fits && m.key === form.value.instance_type)) {
    form.value.instance_type = machinesShown.value[0]?.instance_type || '';
  }
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
  const first = props.projectRef ? thisProject.value
    : options.value.projects.find(p => dedicatedModels(p, 'development').length) || options.value.projects[0];
  form.value = {
    source: props.projectRef && !first && mayOpen.value && offeredOpen.value.length ? 'open_model' : 'model', name: '', project: first?.ref || '', model: '', open_model: offeredOpen.value[0] ? String(offeredOpen.value[0].id) : '',
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
const COPIED_WORDS = { install: 'the install command', code: 'the code', address: 'the address', key: 'the key' };
let copiedTimer = null;
const CHAT_ABOUT = "It takes OpenAI's chat format, so OpenAI's own client works with it: set the client's base URL to the address below.";
function openUse(d) {
  using.value = d; language.value = useLanguages(d)[0]; copied.value = ''; copyError.value = '';
  keyName.value = ''; madeKey.value = null; keyError.value = '';
}
// Making the app key right here (workspaceApi.dedicatedAppKey): it may call this deployment's project in its
// environment, works at once, and is shown only in this dialog, once.
const keyName = ref(''); const madeKey = ref(null); const keyBusy = ref(false); const keyError = ref('');
async function makeAppKey() {
  if (!using.value || keyBusy.value || !keyName.value.trim()) return;
  keyBusy.value = true; keyError.value = '';
  try { madeKey.value = (await workspaceApi.dedicatedAppKey(using.value.id, keyName.value.trim())).made; }
  catch (e) { keyError.value = e.message; }
  finally { keyBusy.value = false; }
}
async function copyText(text, what) {
  try {
    await navigator.clipboard.writeText(text); copied.value = what; copyError.value = '';
    clearTimeout(copiedTimer); copiedTimer = setTimeout(() => { copied.value = ''; }, 2000);
  } catch { copyError.value = 'Copying was blocked by the browser. Select the text and copy it with Ctrl+C.'; }
}
onUnmounted(() => { gone = true; stopPolling(); clearTimeout(copiedTimer); });
</script>

<template>
  <div class="ded-root">
    <section class="dedicated" aria-labelledby="ded-heading" :aria-busy="dedLoading">
      <DeploymentHeader title="Dedicated Deployments" heading-id="ded-heading" eyebrow="RESERVED COMPUTE. RELIABLE INFERENCE." :icon="Server"
        :description="projectRef ? 'This project\'s approved model, or an open model of the workspace, on a machine of its own: a GPU AADML rents for you, or one of your workspace\'s own machines. It gets an address your apps call.' : 'Give your model a dedicated machine and an endpoint for your apps.'">
        <UiButton variant="primary" :disabled="!ded" @click="openCreate"><Plus :size="15" aria-hidden="true"/> New deployment</UiButton>
      </DeploymentHeader>
      <DeploymentMetrics :items="dedicatedMetrics" :loaded="!!ded"/>
      <p v-if="ded && ded.cost_note" class="ded-billing"><Wallet :size="16" aria-hidden="true"/><span>{{ ded.cost_note }}</span></p>
      <p v-if="projectRef && chat" class="ded-billing"><Cpu :size="16" aria-hidden="true"/><span>On one of your own machines, its calls reach the machine through AADML and are answered whole, not streamed, and it is charged by the second at the platform fee for work on your machine.</span></p>
      <p v-else-if="projectRef" class="ded-billing"><Cpu :size="16" aria-hidden="true"/><span>On one of your own machines, its calls reach the machine through AADML, and it is charged by the second at the platform fee for work on your machine. To answer only on your own network instead, with the photos never leaving it, use <button type="button" class="link-button" @click="openEdge">Edge Devices</button>.</span></p>
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
        <p>{{ projectRef ? 'Start one to give this project\'s approved model, or an open model of the workspace, a machine of its own, with an address your apps call.' : 'Start one to give an approved model a machine of its own, with an address your apps call.' }}</p>
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
              <td data-label="Machine"><code>{{ d.machine_label || d.instance_type }}</code><small v-if="machineOf(d.instance_type)">{{ machineKind(machineOf(d.instance_type)) }}</small></td>
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

    <UiDialog class="ded-dialog" :open="creating" title="New deployment" @close="creating=false">
      <form class="ded-form" novalidate @submit.prevent="dedPicker ? dedPicker.confirm(startDeployment) : startDeployment()">
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
          <div v-if="projectRef" class="ded-field">
            <span class="ded-label">Project</span>
            <p class="ded-fixed">{{ thisProject ? thisProject.name : 'This project' }}</p>
            <p v-if="projectProblem" class="field-error" role="alert">{{ projectProblem }}</p>
          </div>
          <div v-else class="ded-field">
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
            <p id="ded-model-help" class="ded-help">{{ eligible.length ? `Only models approved for ${form.kind==='production' ? 'production' : 'staging'} are listed.${chatProject ? " It answers chat in OpenAI's format." : ''}` : missingApproval(chosenProject, form.kind) }}</p>
            <p id="ded-model-error" class="field-error" aria-live="polite">{{ fieldErrors.model }}</p>
          </div>
        </div>

        <div class="ded-field">
          <MachinePicker ref="dedPicker" v-model="form.instance_type" :load="loadDedMachines" legend="Machine"/>
          <p v-if="options.machines_unavailable" class="field-error" role="alert">{{ options.machines_unavailable }}</p>
          <p v-if="(form.source==='open_model' || chatProject) && machinesShown.length" class="ded-help">Only machines with room for this model are listed.</p>
          <p v-if="fieldErrors.instance_type" class="field-error" role="alert">{{ fieldErrors.instance_type }}</p>
        </div>

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
            <span v-if="using.project">The key of an app allowed to call {{ using.project.name }} in {{ environmentLabel(using.environment).toLowerCase() }}: it starts with aadml_app_. Make one below, or find your apps on <a class="text-link" :href="projectLink(using.project.ref,'deploy')" @click="using=null">the project's Deployments page</a>.</span>
            <span v-else>The key of an app of this workspace allowed, in {{ environmentLabel(using.environment).toLowerCase() }}, on any of its projects: it starts with aadml_app_. It is made on that project's Deployments page, under "Apps that may call the model". A key from Connect app (tmd_) only sends records in.</span></dd></div>
        </dl>
        <section v-if="using.project" class="use-key" aria-labelledby="use-key-h">
          <h3 id="use-key-h">Make an app key for this deployment</h3>
          <template v-if="!madeKey">
            <p class="ded-help">Name the app that will call it (a new one, or one of yours). It is allowed to call {{ using.project.name }} in {{ environmentLabel(using.environment).toLowerCase() }} and gets a key that works at once.</p>
            <form class="use-key-form" @submit.prevent="makeAppKey">
              <input v-model="keyName" class="text-input" maxlength="120" placeholder="App name, e.g. Support site" aria-label="Name of the app that calls this deployment">
              <UiButton type="submit" variant="primary" :disabled="keyBusy || !keyName.trim()"><KeyRound :size="14" aria-hidden="true"/> {{ keyBusy ? 'Making…' : 'Make the key' }}</UiButton>
            </form>
          </template>
          <div v-else class="use-key-made" role="status">
            <strong>The key for {{ madeKey.app }}. Copy it now: it is shown only this once.</strong>
            <div class="use-key-line"><code>{{ madeKey.key }}</code><button type="button" class="copy-icon" :aria-label="copied==='key' ? 'Key copied' : 'Copy the key'" @click="copyText(madeKey.key,'key')"><Check v-if="copied==='key'" :size="14" aria-hidden="true"/><Copy v-else :size="14" aria-hidden="true"/></button></div>
            <p class="ded-help">Put it in the code above where it says &lt;your app key&gt;.</p>
          </div>
          <p v-if="keyError" class="field-error" role="alert">{{ keyError }}</p>
        </section>
        <p class="sr-only" aria-live="polite">{{ copied ? `Copied ${COPIED_WORDS[copied]}.` : '' }}</p>
        <p v-if="copyError" class="field-error" role="alert">{{ copyError }}</p>
        <div class="dialog-actions"><UiButton @click="using=null">Close</UiButton></div>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.muted{font-size:12px!important;color:#5f6d82!important}
.empty-icon{display:grid;place-items:center;flex-shrink:0;border-radius:50%;background:#f1f4f8;color:#4c5d74;width:46px;height:46px;margin:0 auto}
.list-empty{text-align:center;padding:30px 20px;border:1px solid #e3e8f1;border-radius:12px;background:#fff}
.list-empty h3{margin:12px 0 6px;font-size:16px}
.list-empty p{margin:0 auto 16px;max-width:520px}
.empty-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
.ws-table td{vertical-align:top;font-size:13px}
.ws-table td small{display:block;color:#5f6d82;font-size:11px;margin-top:5px;max-width:300px;line-height:1.5}
.row-actions{white-space:nowrap;text-align:right}
.button.small,.small{min-height:32px;padding:6px 12px;font-size:13px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.badge--amber{color:#93610b;background:#fff4dc}
.link-button{background:none;border:0;padding:0;color:var(--aadml-primary);font:inherit;text-decoration:underline;cursor:pointer}
.ded-label{display:block;font-size:13px;font-weight:600;color:#1d2a42;margin:0 0 8px}
.ded-fixed{margin:0!important;padding:10px 12px;border:1px solid #e3e6ed;border-radius:7px;background:#f8f9fb;font-size:14px;color:#162139!important}
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
.use-key{margin-top:18px;padding:14px;border:1px solid #e3e6ed;border-radius:9px}
.use-key h3{font-size:14px;margin:0 0 6px}
.use-key-form{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.use-key-form .text-input{flex:1 1 220px;min-width:0}
.use-key-made{display:grid;gap:8px}
.use-key-line{display:flex;align-items:center;gap:6px;min-width:0}
.use-key-line code{overflow-wrap:anywhere;min-width:0;font-size:12px}
.use-facts .text-link{margin:0}
.copy-icon{display:inline-grid;place-items:center;flex-shrink:0;min-width:44px;min-height:44px;margin:-12px -10px -12px auto;border:0;border-radius:6px;background:transparent;color:#6b778c;cursor:pointer}
.copy-icon:hover{background:var(--aadml-tint);color:var(--aadml-primary)}
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
  .ws-table thead{display:none}
  .ws-table,.ws-table tbody,.ws-table tr,.ws-table td{display:block;width:100%}
  .ws-table tr{border-bottom:1px solid #e9eaf0;padding:10px 0}
  .ws-table td{border:0!important;padding:6px 14px!important}
  .ws-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:4px}
  .row-actions{text-align:left}
}
@media(prefers-reduced-motion:reduce){.ded-card,.segmented button,.copy-chip{transition:none}.spin{animation:none}}
</style>
