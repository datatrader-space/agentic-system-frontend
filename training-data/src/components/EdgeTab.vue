<script setup>
// The Edge Devices tab of the workspace Deployments page: run an approved model on one of the workspace's own machines
// (TRAINING_OPEN_MODELS_PLAN.md section 5), with a machine overview, deployment controls and an expandable connection
// guide for apps on the same network. Nothing is downloaded and nothing is run by hand but the one command of
// Your machines: the machine takes the model at its next poll and answers on its own network. Backend: machines_api.py
// workspace/edge/, workspace/machines/ (the hosts a machine reaches, who may add one), workspace/machines/<id>/serve/,
// workspace/machine-jobs/<id>/stop/; the release rules are edge.py's; what the model answers is ml/fmw_walls/serve/app.py.
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { Activity, ArrowRight, Check, ChevronDown, Cloud, Copy, Cpu, EyeOff, KeyRound, Laptop, LoaderCircle, Lock, Network, Play, Plus, RefreshCw, Server, ShieldCheck, Square } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import MachineNeeds from './MachineNeeds.vue';
import {
  edgeApi, choiceKey, modelLabel, sortedChoices, whyNot, ENVIRONMENT_LABELS, machinesFor, portProblem, answerAt,
  DEFAULT_PORT, cleanHost, edgeUrl, EDGE_LANGUAGES, edgeInstall, NOTHING_TO_INSTALL, edgeSnippet, pingCommand, privateRule,
  ANSWER_EXAMPLE, ANSWER_FIELDS, CALL_ERRORS, answering, startedLine, stepStates,
} from '../api/edge.js';
import { machinesApi, machineState, capabilityLine, jobState, isActive, lastSeen } from '../api/machines.js';

const emit = defineEmits(['navigate']);

const data = ref(null); const error = ref(''); const loading = ref(false);
const machinesInfo = ref(null);            // the Your machines answer: the hosts to allow, and who may add a machine
const said = ref('');
function announce(text) { said.value = ''; requestAnimationFrame(() => { said.value = text; }); }
let gone = false; let pollTimer = null;
async function load() {
  if (loading.value) return;
  loading.value = true;
  try { data.value = await edgeApi.list(); error.value = ''; }
  catch (e) { error.value = e.message; }
  finally {
    loading.value = false;
    // Read again while a model is starting or stopping (every 10 seconds), and while no machine is online (every 30), so
    // each step's state is true without a reload.
    if (!gone) {
      clearTimeout(pollTimer);
      if (jobs.value.some(j => isActive(j) && !(j.state === 'running' && j.health?.ok))) pollTimer = setTimeout(load, 10000);
      else if (data.value && !(data.value.machines || []).some(m => m.state === 'online')) pollTimer = setTimeout(load, 30000);
    }
  }
}
load();
machinesApi.list().then(answer => { machinesInfo.value = answer; }).catch(() => { machinesInfo.value = null; });

const choices = computed(() => sortedChoices(data.value?.models));
const blockedChoices = computed(() => choices.value.filter(row => !row.may_serve));
const jobs = computed(() => data.value?.jobs || []);
const running = computed(() => jobs.value.filter(isActive));
const ended = computed(() => jobs.value.filter(j => !isActive(j)));
const allMachines = computed(() => (data.value?.machines || []).filter(m => m.state !== 'removed'));
const available = computed(() => !!data.value?.available);
const guideOpen = ref(false);
const onlineMachines = computed(() => allMachines.value.filter(m => m.state === 'online'));
const approvedChoices = computed(() => choices.value.filter(row => row.may_serve));
const steps = computed(() => stepStates({ available: available.value, machines: allMachines.value, jobs: jobs.value }));
const STATE_WORDS = { done: 'Complete', current: 'Next step', attention: 'Needs attention', waiting: 'Pending' };
const hosts = computed(() => machinesInfo.value?.firewall_hosts || null);
const mayManage = computed(() => !!machinesInfo.value?.may_manage);

// ── step 2, the form: a model, where it is released to, the machine, its port ────────────────────────────────────
const picked = ref(''); const environment = ref(''); const machineId = ref(''); const port = ref(DEFAULT_PORT);
const chosen = computed(() => choices.value.find(row => choiceKey(row) === picked.value) || null);
const environments = computed(() => chosen.value?.environments || []);
const machines = computed(() => (chosen.value ? machinesFor(data.value?.machines, chosen.value.project.id) : []));
watch(chosen, row => {
  environment.value = row?.environments?.includes('production') ? 'production' : row?.environments?.[0] || '';
  if (!machines.value.some(m => String(m.id) === String(machineId.value))) machineId.value = machines.value[0]?.id ?? '';
});
const portError = computed(() => portProblem(port.value));
const ready = computed(() => !!(chosen.value?.may_serve && environment.value && machineId.value && !portError.value));
const busy = ref(false); const serveError = ref('');
const callJobId = ref(null);
async function start() {
  if (!ready.value || busy.value) return;
  busy.value = true; serveError.value = '';
  try {
    const job = await edgeApi.serve(machineId.value, { project: chosen.value.project.ref, model: chosen.value.number, environment: environment.value, port: port.value });
    announce(`${modelLabel(chosen.value)} goes to ${job.machine.name}. It starts at the machine's next check, within a minute.`);
    picked.value = '';
    callJobId.value = job.id;
    await load();
  } catch (e) { serveError.value = e.message; }
  finally { busy.value = false; }
}

// ── stopping a model ─────────────────────────────────────────────────────────────────────────────────────────
const stopping = ref(null); const stopBusy = ref(false); const stopError = ref('');
async function confirmStop() {
  if (!stopping.value || stopBusy.value) return;
  stopBusy.value = true; stopError.value = '';
  try {
    const job = stopping.value;
    await edgeApi.stop(job.id);
    stopping.value = null;
    announce(`${job.model.name} ${job.model.version} stops on ${job.machine.name} at its next check.`);
    await load();
  } catch (e) { stopError.value = e.message; }
  finally { stopBusy.value = false; }
}
const now = ref(Date.now());
const clock = setInterval(() => { now.value = Date.now(); }, 30000);
const health = job => (job.state !== 'running' ? '' : job.health?.at ? (job.health.ok ? `Answering. Checked ${lastSeen(job.health.at, now.value).replace('Seen ', '')}.` : 'Not answering its health check.') : 'Starting: pulling the image and the model.');

// ── step 3: calling it ───────────────────────────────────────────────────────────────────────────────────────
// The model the code is for (one that answers now, else the first one running), and the machine's address on the
// network, which AADML does not know: the person types it, and it is kept in this browser only, per machine.
const callable = computed(() => answering(jobs.value));
const callJob = computed(() => callable.value.find(j => j.id === callJobId.value) || callable.value[0] || null);
const callPort = computed(() => callJob.value?.port || DEFAULT_PORT);
const HOSTS_KEY = 'aadml.edge.machine-addresses';
function readHosts() { try { return JSON.parse(localStorage.getItem(HOSTS_KEY) || '{}') || {}; } catch { return {}; } }
const typedHosts = ref(readHosts());
const hostKey = computed(() => String(callJob.value?.machine?.id ?? 'any'));
const hostText = computed({
  get: () => typedHosts.value[hostKey.value] || '',
  set: text => {
    typedHosts.value = { ...typedHosts.value, [hostKey.value]: String(text).slice(0, 255) };
    try { localStorage.setItem(HOSTS_KEY, JSON.stringify(typedHosts.value)); } catch { /* kept for this visit only */ }
  },
});
const hostError = computed(() => (hostText.value.trim() && !cleanHost(hostText.value) ? 'Type an IP address or a host name, such as 192.168.1.20 or garage.local.' : ''));
const host = computed(() => cleanHost(hostText.value));
const callUrl = computed(() => edgeUrl(host.value, callPort.value));
const pingUrl = computed(() => edgeUrl(host.value, callPort.value, '/ping'));
const language = ref(EDGE_LANGUAGES[0]);
// The language choice is a radio group: the arrow keys move the choice and the focus with it.
function moveLanguage(event) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const next = (EDGE_LANGUAGES.indexOf(language.value) + step + EDGE_LANGUAGES.length) % EDGE_LANGUAGES.length;
  language.value = EDGE_LANGUAGES[next];
  event.currentTarget.parentElement?.children[next]?.focus();
}
const installLine = computed(() => edgeInstall(language.value));
const code = computed(() => edgeSnippet(language.value, callUrl.value));
const ping = computed(() => pingCommand(host.value, callPort.value));
const rule = computed(() => privateRule(callPort.value));
const step3 = ref(null);
async function goToStep(index) {
  if (index === 2) guideOpen.value = true;
  await nextTick();
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(`edge-section-${index + 1}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
async function callIt(job) {
  callJobId.value = job.id;
  guideOpen.value = true;
  await nextTick();
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  step3.value?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  step3.value?.focus({ preventScroll: true });
}

const copied = ref(''); const copyError = ref(''); let copiedTimer = null;
const COPIED_WORDS = { install: 'the install command', code: 'the code', address: 'the address', health: 'the health address', ping: 'the health check', rule: 'the firewall rule' };
async function copyText(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = what; copyError.value = '';
    announce(`Copied ${COPIED_WORDS[what]}.`);
    clearTimeout(copiedTimer); copiedTimer = setTimeout(() => { copied.value = ''; }, 2000);
  } catch { copyError.value = 'Copying was blocked by the browser. Select the text and copy it with Ctrl+C.'; }
}
onUnmounted(() => { gone = true; clearTimeout(pollTimer); clearTimeout(copiedTimer); clearInterval(clock); });
</script>

<template>
  <section class="studio edge" role="tabpanel" aria-labelledby="edge-heading" :aria-busy="loading">
    <p class="visually-hidden" aria-live="polite">{{ said }}</p>
    <header class="edge-head">
      <div class="edge-heading-group">
        <span class="edge-icon" aria-hidden="true"><Cpu :size="23"/></span>
        <div><span class="edge-eyebrow">YOUR INFRASTRUCTURE. YOUR CONTROL.</span><h2 id="edge-heading">Edge Devices</h2><p>Deploy approved models to your machines. Run inference on your own network.</p></div>
      </div>
      <UiButton variant="primary" @click="emit('navigate', 'machines')"><Plus :size="16" aria-hidden="true"/> Add machine</UiButton>
    </header>

    <div class="edge-privacy"><ShieldCheck :size="17" aria-hidden="true"/><p>{{ data?.photos || 'The photos you send it stay on your network: they never reach AADML.' }}</p><span>Local inference</span></div>
    <div v-if="error" class="edge-error" role="alert">{{ error }} <button type="button" class="link-button" @click="load">Try again</button></div>
    <div v-if="loading && !data" class="preview-loading" aria-label="Loading the Edge Devices tab"><div></div><div></div><div></div></div>
    <template v-else>
      <dl class="edge-metrics" aria-label="Edge deployment overview">
        <div><dt><Server :size="16" aria-hidden="true"/> Connected machines</dt><dd>{{ data ? allMachines.length : '—' }}<span>{{ data ? `${onlineMachines.length} online` : 'Unavailable' }}</span></dd></div>
        <div><dt><Activity :size="16" aria-hidden="true"/> Active deployments</dt><dd>{{ data ? running.length : '—' }}<span>{{ data ? `${callable.filter(j => j.health?.ok).length} healthy` : 'Unavailable' }}</span></dd></div>
        <div><dt><ShieldCheck :size="16" aria-hidden="true"/> Approved models</dt><dd>{{ data ? approvedChoices.length : '—' }}<span>Ready to deploy</span></dd></div>
      </dl>

      <nav class="edge-progress" aria-label="Edge deployment setup">
        <a v-for="(item, index) in steps" :key="index" :href="`#edge-section-${index + 1}`" :class="['progress-item', `is-${item.state}`]" :aria-current="item.state === 'current' ? 'step' : undefined" @click.prevent="goToStep(index)">
          <span class="step-mark"><Check v-if="item.state === 'done'" :size="14" aria-hidden="true"/><template v-else>{{ index + 1 }}</template></span>
          <span><strong>{{ ['Connect a machine', 'Deploy a model', 'Connect your app'][index] }}</strong><small>{{ STATE_WORDS[item.state] }}</small></span><ArrowRight v-if="index < 2" :size="15" class="progress-arrow" aria-hidden="true"/>
        </a>
      </nav>

      <div class="edge-workspace">
        <section id="edge-section-1" class="edge-card machine-card" aria-labelledby="edge-step-1">
          <div class="card-heading"><span class="card-icon"><Server :size="18" aria-hidden="true"/></span><div><h3 id="edge-step-1">Your machines</h3><p>Infrastructure in your workspace</p></div><UiBadge>{{ allMachines.length }}</UiBadge></div>
          <ul v-if="allMachines.length" class="edge-machines" aria-label="Machines of this workspace">
            <li v-for="m in allMachines" :key="m.id"><div class="machine-row"><span class="machine-symbol"><Server :size="18" aria-hidden="true"/></span><strong>{{ m.name }}</strong><UiBadge :tone="machineState(m)[0]">{{ machineState(m)[1] }}</UiBadge></div><p>{{ capabilityLine(m.capabilities) }}</p></li>
          </ul>
          <div v-else class="machine-empty"><span class="empty-symbol"><Server :size="28" aria-hidden="true"/></span><h4>{{ data ? 'Connect your first machine' : 'Machines unavailable' }}</h4><p>{{ data ? 'Bring your own Linux machine. Connect it once with a Docker command, then manage deployments here.' : 'Try refreshing to load your workspace machines.' }}</p><UiButton @click="emit('navigate', 'machines')"><Plus :size="15" aria-hidden="true"/> Connect a machine</UiButton></div>
          <p class="machine-state" :class="`is-${steps[0].state}`">{{ steps[0].line }}</p>
          <div class="machine-footer"><UiButton @click="emit('navigate', 'machines')">Manage machines <ArrowRight :size="14" aria-hidden="true"/></UiButton><details class="requirements"><summary>Machine requirements <ChevronDown :size="14" aria-hidden="true"/></summary><MachineNeeds :hosts="hosts"/></details><p v-if="machinesInfo && !mayManage" class="step-hint">A workspace Admin connects new machines.</p></div>
        </section>

        <section id="edge-section-2" class="edge-card deploy-card" aria-labelledby="edge-step-2">
          <div class="card-heading"><span class="card-icon"><Play :size="18" aria-hidden="true"/></span><div><h3 id="edge-step-2">Deploy a model</h3><p>Choose what to run and where to run it</p></div></div>
          <form v-if="available" class="edge-form" aria-labelledby="edge-step-2" @submit.prevent="start">
            <div class="form-grid">
              <label class="field-label">Model
                <select v-model="picked" class="text-input">
                  <option value="">{{ choices.length ? 'Choose an approved model' : 'No registered model yet' }}</option>
                  <option v-for="row in choices" :key="choiceKey(row)" :value="choiceKey(row)" :disabled="!row.may_serve">
                    {{ row.project.name }}: {{ modelLabel(row) }}{{ row.may_serve ? '' : ' (cannot be chosen)' }}
                  </option>
                </select>
              </label>
              <label class="field-label">Environment
                <select v-model="environment" class="text-input" :disabled="!environments.length">
                  <option v-if="!environments.length" value="">Choose a model first</option>
                  <option v-for="e in environments" :key="e" :value="e">{{ ENVIRONMENT_LABELS[e] || e }}</option>
                </select>
              </label>
              <label class="field-label">Machine
                <select v-model="machineId" class="text-input" :disabled="!machines.length">
                  <option v-if="!machines.length" value="">{{ chosen ? 'No online machine may run this project' : 'Choose a model first' }}</option>
                  <option v-for="m in machines" :key="m.id" :value="m.id">{{ m.name }}</option>
                </select>
              </label>
              <label class="field-label">Inference port
                <input v-model.number="port" class="text-input" type="number" min="1024" max="65535" inputmode="numeric" :aria-invalid="!!portError" aria-describedby="edge-port-help">
                <span id="edge-port-help" class="field-help">{{ portError || `It answers at ${answerAt(port)}` }}</span>
              </label>
            </div>
            <p v-if="chosen && !chosen.may_serve" class="field-error">{{ whyNot(chosen) }}</p>
            <p v-if="chosen?.licence" class="edge-licence">{{ chosen.licence.text }}</p>
            <p v-if="serveError" class="field-error" role="alert">{{ serveError }}</p>
            <div class="deploy-notice"><ShieldCheck :size="16" aria-hidden="true"/><p>Requires the Train right and a model approved for staging or production. Deployment starts at the machine’s next check, within a minute.</p></div>
            <div class="studio-actions">
              <UiButton type="submit" variant="primary" :disabled="!ready || busy">
                <LoaderCircle v-if="busy" :size="16" class="spin" aria-hidden="true"/><Play v-else :size="16" aria-hidden="true"/>
                {{ busy ? 'Sending…' : 'Deploy model' }}
              </UiButton>
            </div>
            <details v-if="blockedChoices.length" class="edge-why">
              <summary>Why {{ blockedChoices.length === 1 ? 'one model cannot' : `${blockedChoices.length} models cannot` }} be chosen</summary>
              <ul>
                <li v-for="row in blockedChoices" :key="choiceKey(row)"><strong>{{ row.project.name }}: {{ modelLabel(row) }}</strong> {{ whyNot(row) }}</li>
              </ul>
            </details>
            <p v-if="data && !choices.length" class="step-hint">A model can run here once it is trained and approved for staging or production on the Models page. <button type="button" class="link-button" @click="emit('navigate', 'models')">Open Models</button></p>
          </form>

          <div v-if="!available" class="deployment-unavailable"><Lock :size="22" aria-hidden="true"/><h4>Edge deployment is unavailable</h4><p>{{ steps[0].line }}</p></div>
        </section>
      </div>
          <section v-if="data" class="edge-jobs" aria-labelledby="edge-jobs-heading">
            <div class="section-heading"><div><h3 id="edge-jobs-heading">Deployments <span class="deployment-count">{{ jobs.length }}</span></h3><p>Monitor models running on your edge machines.</p></div><UiButton :disabled="loading" @click="load"><RefreshCw :size="14" :class="{ spin: loading }" aria-hidden="true"/> Refresh</UiButton></div>
            <div v-if="!jobs.length" class="edge-empty"><span class="empty-symbol"><Cpu :size="25" aria-hidden="true"/></span><div><h4>No edge deployments yet</h4><p>Deploy an approved model above to see its status, machine, and endpoint here.</p></div></div>
            <ul v-else class="edge-job-list">
              <li v-for="job in [...running, ...ended]" :key="job.id" class="panel edge-job">
                <div class="edge-job-main">
                  <div class="edge-job-title">
                    <strong>{{ job.model?.name }} {{ job.model?.version }}</strong>
                    <UiBadge :tone="jobState(job)[0]">{{ jobState(job)[1] }}</UiBadge>
                  </div>
                  <p class="job-project">{{ job.project.name }}<template v-if="isActive(job) && startedLine(job, now)"> � {{ startedLine(job, now) }}</template></p>
                  <dl class="job-details"><div><dt>Machine</dt><dd>{{ job.machine.name }}</dd></div><div><dt>Environment</dt><dd>{{ ENVIRONMENT_LABELS[job.environment] || job.environment }}</dd></div><div><dt>Port</dt><dd><code>{{ job.port }}</code></dd></div></dl>
                  <p v-if="health(job)" class="edge-health">{{ health(job) }}</p>
                  <p v-if="job.failure" class="field-error">{{ job.failure }}</p>
                </div>
                <div v-if="isActive(job) && !job.stopping" class="edge-job-actions">
                  <UiButton v-if="job.state === 'running'" :aria-label="`Show how to call ${job.model?.name} ${job.model?.version} on ${job.machine.name}`" @click="callIt(job)"><Laptop :size="14" aria-hidden="true"/> Call it</UiButton>
                  <UiButton :aria-label="`Stop ${job.model?.name} ${job.model?.version} on ${job.machine.name}`" @click="stopping = job; stopError = ''"><Square :size="14" aria-hidden="true"/> Stop</UiButton>
                </div>
              </li>
            </ul>
          </section>

      <details id="edge-section-3" class="edge-card connection-guide" :open="guideOpen" @toggle="guideOpen = $event.target.open">
        <summary><span class="card-icon"><Network :size="18" aria-hidden="true"/></span><span><strong>Connect your app</strong><small>Endpoints, code examples, and network configuration</small></span><ChevronDown :size="18" class="guide-chevron" aria-hidden="true"/></summary>
        <div class="guide-content">
          <h3 id="edge-step-3" ref="step3" tabindex="-1">Call a model on your network</h3>
          <p class="step-lead">An app on the same network sends a photo directly to your machine and receives the prediction.</p>
          <figure class="edge-path" aria-label="How a call travels">
            <div class="path-node"><Laptop :size="18" aria-hidden="true"/><span><strong>Your app</strong>on your network</span></div>
            <div class="path-link"><span>photo in, answer out</span></div>
            <div class="path-node path-node--machine"><Server :size="18" aria-hidden="true"/><span><strong>{{ callJob?.machine?.name || 'Your machine' }}</strong>port {{ callPort }}</span></div>
            <figcaption class="path-side"><Cloud :size="16" aria-hidden="true"/><span>AADML only hears whether the model answers its health check.</span></figcaption>
          </figure>

          <div class="call-setup">
            <label v-if="callable.length > 1" class="field-label">Model
              <select v-model="callJobId" class="text-input">
                <option v-for="j in callable" :key="j.id" :value="j.id">{{ j.model?.name }} {{ j.model?.version }} on {{ j.machine?.name }}, port {{ j.port }}</option>
              </select>
            </label>
            <label class="field-label">{{ callJob ? `Address of ${callJob.machine?.name} on your network` : 'Address of the machine on your network' }}
              <input v-model="hostText" class="text-input" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="For example 192.168.1.20" :aria-invalid="!!hostError" aria-describedby="edge-host-help">
              <span id="edge-host-help" class="field-help">{{ hostError || 'AADML does not know it. On the machine, hostname -I shows it. Kept in this browser only.' }}</span>
            </label>
          </div>

          <dl class="call-addresses">
            <div><dt>Send a photo <code class="verb">POST</code></dt><dd><code>{{ callUrl }}</code><button type="button" class="copy-icon" :aria-label="copied==='address' ? 'Address copied' : 'Copy the address'" @click="copyText(callUrl,'address')"><Check v-if="copied==='address'" :size="14" aria-hidden="true"/><Copy v-else :size="14" aria-hidden="true"/></button></dd></div>
            <div><dt>Check it answers <code class="verb">GET</code></dt><dd><code>{{ pingUrl }}</code><button type="button" class="copy-icon" :aria-label="copied==='health' ? 'Health address copied' : 'Copy the health address'" @click="copyText(pingUrl,'health')"><Check v-if="copied==='health'" :size="14" aria-hidden="true"/><Copy v-else :size="14" aria-hidden="true"/></button></dd></div>
          </dl>

          <div class="call-code">
            <div class="segmented" role="radiogroup" aria-label="Language">
              <button v-for="l in EDGE_LANGUAGES" :key="l" type="button" role="radio" :aria-checked="language===l" :tabindex="language===l ? 0 : -1" :class="{on:language===l}" @click="language=l" @keydown="moveLanguage">{{ l }}</button>
            </div>
            <div v-if="installLine" class="command-row">
              <code>{{ installLine }}</code>
              <button type="button" class="copy-chip" :aria-label="copied==='install' ? 'Install command copied' : 'Copy the install command'" @click="copyText(installLine,'install')"><Check v-if="copied==='install'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copied==='install' ? 'Copied' : 'Copy' }}</button>
            </div>
            <p v-else class="step-hint">{{ NOTHING_TO_INSTALL[language] }}</p>
            <div class="use-code">
              <button type="button" class="copy-chip on-dark" :aria-label="copied==='code' ? 'Code copied' : 'Copy the code'" @click="copyText(code,'code')"><Check v-if="copied==='code'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copied==='code' ? 'Copied' : 'Copy' }}</button>
              <pre class="code-block" tabindex="0" :aria-label="`Code to call the model with ${language}`"><code>{{ code }}</code></pre>
            </div>
            <p class="step-hint">Send the photo itself as the body: JPEG, PNG or WebP, up to 6 MB.<template v-if="language==='JavaScript'"> Call it from a server or an app: a web page of another site is refused, because the model sends no CORS headers and an https page cannot call an http address.</template></p>
          </div>

          <div class="call-answer">
            <h4>What it answers</h4>
            <div class="answer-grid">
              <pre class="code-block answer-json" tabindex="0" aria-label="An example answer"><code>{{ ANSWER_EXAMPLE }}</code></pre>
              <dl class="answer-fields">
                <div v-for="f in ANSWER_FIELDS" :key="f.name"><dt><code>{{ f.name }}</code></dt><dd>{{ f.text }}</dd></div>
              </dl>
            </div>
          </div>

          <ul class="call-facts">
            <li>
              <KeyRound :size="18" aria-hidden="true"/>
              <div><strong>No key on your network</strong><span>The model answers anyone who can reach port {{ callPort }} of the machine. It needs no app key, and a call costs nothing in AADML.</span></div>
            </li>
            <li>
              <Lock :size="18" aria-hidden="true"/>
              <div>
                <strong>Keep it private</strong>
                <span>Do not forward the port on your router, and keep the machine off the public internet. Docker opens the port on every network the machine is on, ahead of ufw and firewalld, so to allow only your own network add this rule on the machine (change the network to yours):</span>
                <div class="command-row small"><code>{{ rule }}</code><button type="button" class="copy-chip" :aria-label="copied==='rule' ? 'Firewall rule copied' : 'Copy the firewall rule'" @click="copyText(rule,'rule')"><Check v-if="copied==='rule'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copied==='rule' ? 'Copied' : 'Copy' }}</button></div>
                <span>It lasts until the machine restarts; save it with your system's iptables tools to keep it.</span>
              </div>
            </li>
            <li>
              <EyeOff :size="18" aria-hidden="true"/>
              <div><strong>Photos stay with you</strong><span>{{ data?.photos || 'The photos you send it stay on your network: they never reach AADML.' }} AADML hears only whether the model answers its health check.</span></div>
            </li>
          </ul>

          <details class="edge-why call-errors">
            <summary>When a call fails</summary>
            <p>Every failure answers <code>{"error": "...", "field": "..."}</code> with one of these statuses. To check the model answers at all, run:</p>
            <div class="command-row small"><code>{{ ping }}</code><button type="button" class="copy-chip" :aria-label="copied==='ping' ? 'Health check copied' : 'Copy the health check'" @click="copyText(ping,'ping')"><Check v-if="copied==='ping'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copied==='ping' ? 'Copied' : 'Copy' }}</button></div>
            <dl>
              <div v-for="e in CALL_ERRORS" :key="e.status"><dt>{{ e.status }}</dt><dd>{{ e.text }}</dd></div>
              <div><dt>No answer</dt><dd>The address or the port is wrong, the model is stopped, or a firewall between your app and the machine blocks the port.</dd></div>
            </dl>
          </details>
          <p v-if="copyError" class="field-error" role="alert">{{ copyError }}</p>
        </div>
      </details>
    </template>

    <p class="edge-foot"><ShieldCheck :size="15" aria-hidden="true"/> Every model started or stopped on a machine is recorded in the workspace's Audit log.</p>

    <UiDialog :open="!!stopping" :title="stopping ? `Stop ${stopping.model?.name} ${stopping.model?.version}?` : ''" @close="stopping = null">
      <p class="dialog-description">It stops answering on {{ stopping?.machine.name }} at the machine's next check, and its container and files are removed there. You can run it again from this tab.</p>
      <p v-if="stopError" class="field-error" role="alert">{{ stopError }}</p>
      <div class="dialog-actions">
        <UiButton @click="stopping = null">Keep it running</UiButton>
        <UiButton variant="primary" :disabled="stopBusy" @click="confirmStop">{{ stopBusy ? 'Stopping…' : 'Stop the model' }}</UiButton>
      </div>
    </UiDialog>
  </section>
</template>

<style scoped>
.edge{max-width:1240px;--edge-border:#e3e8ef;color:#17243b}
.edge-head{display:flex;justify-content:space-between;align-items:center;gap:20px;margin:8px 0 24px}.edge-heading-group{display:flex;align-items:center;gap:15px}.edge-icon{display:grid;place-items:center;width:52px;height:52px;border:1px solid var(--aadml-outline);border-radius:14px;background:var(--aadml-tint);color:var(--aadml-primary)}.edge-eyebrow{display:block;font-size:10px;font-weight:650;letter-spacing:1.5px;color:#68768c;margin-bottom:5px}.edge-head h2{font-size:25px;letter-spacing:-.7px}.edge-head p{font-size:13px;color:#64748b;margin-top:5px}.edge-privacy{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#f0f9f5;border:1px solid #d8ece1;border-radius:9px;color:#287452;margin-bottom:22px}.edge-privacy p{font-size:12px;color:#34654e;flex:1}.edge-privacy>span{font-size:10px;font-weight:600;white-space:nowrap;letter-spacing:.2px}.edge-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:0 0 22px}.edge-metrics>div{padding:19px 22px;background:white;border:1px solid var(--edge-border);border-radius:12px;box-shadow:0 2px 3px #182e4e03}.edge-metrics dt{display:flex;gap:9px;align-items:center;color:#617088;font-size:12px;font-weight:500}.edge-metrics dt svg{color:#8491a4}.edge-metrics dd{display:flex;align-items:baseline;gap:12px;margin:10px 0 0;font-size:29px;font-weight:650;letter-spacing:-1px;line-height:1.2}.edge-metrics dd span{font-size:11px;color:#64748b;font-weight:400;letter-spacing:0}.edge-progress{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin:0 0 24px;padding:15px 20px;background:#f4f6f9;border:1px solid #e8ecf1;border-radius:10px}.progress-item{display:flex;align-items:center;gap:10px;min-width:0;border-radius:4px}.progress-item strong{display:block;font-size:12px;font-weight:600}.progress-item small{display:block;font-size:10px;color:#64748b;margin-top:3px;text-transform:capitalize}.progress-arrow{margin-left:auto;color:#a0aabb}.step-mark{display:grid;place-items:center;width:28px;height:28px;flex-shrink:0;border:1px solid #d5dce6;border-radius:50%;font-size:11px;background:white;color:#738097}.is-done .step-mark{background:#e5f4eb;border-color:#c9e7d5;color:#24704c}.is-current .step-mark{background:var(--aadml-primary);border-color:var(--aadml-primary);color:white}.is-attention .step-mark{color:#9a5c0a;background:#fff6df;border-color:#eddbac}.edge-workspace{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.3fr);align-items:start;gap:22px}.edge-card{background:#fff;border:1px solid var(--edge-border);border-radius:13px;overflow:hidden;box-shadow:0 2px 4px #182e4e03;scroll-margin-top:24px}.card-heading{display:flex;align-items:center;gap:11px;padding:20px 22px;border-bottom:1px solid #edf0f4}.card-heading h3{font-size:14px;letter-spacing:-.15px}.card-heading p{font-size:11px;color:#778398;margin-top:3px}.card-heading>.badge{margin-left:auto}.card-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:#f3f6fb;color:var(--aadml-primary);flex-shrink:0}.edge-machines{list-style:none;margin:0;padding:8px 20px}.edge-machines li{padding:15px 0;border-bottom:1px solid #edf0f4}.edge-machines li:last-child{border:0}.machine-row{display:flex;align-items:center;gap:10px}.machine-row strong{font-size:12px;overflow-wrap:anywhere;min-width:0;flex:1}.machine-symbol{color:#7a8ba4}.edge-machines li p{font-size:11px;color:#748095;margin:7px 0 0 28px;overflow-wrap:anywhere}.machine-empty{text-align:center;padding:28px 24px 18px}.empty-symbol{display:inline-grid;place-items:center;width:52px;height:52px;border-radius:14px;border:1px dashed #d7dfec;background:#f8fafc;color:#8697af}.machine-empty h4{font-size:13px;margin:14px 0 7px}.machine-empty p{font-size:12px;color:#718096;max-width:32ch;margin:0 auto 17px}.machine-state{font-size:11px;padding:0 22px 16px;color:#65748a;overflow-wrap:anywhere}.machine-footer{border-top:1px solid #edf0f4;padding:16px 22px}.machine-footer>.button{width:100%}.requirements{margin-top:12px}.requirements summary{display:flex;align-items:center;justify-content:space-between;min-height:35px;font-size:11px;color:#64748b;cursor:pointer}.requirements[open] summary{margin-bottom:12px}.requirements :deep(.needs){grid-template-columns:1fr;gap:14px}.edge-form{padding:22px}.edge-form .form-grid{margin:0;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:20px 16px}.edge-form .field-label{margin:0;font-size:12px;color:#34445c}.edge-form .text-input{min-height:43px;border-radius:8px;font-size:12px;background:#fff;border-color:#dbe2ec;margin-top:7px;width:100%;min-width:0}.field-help{display:block;font-size:10px;color:#7b8798;font-weight:400;margin-top:6px;overflow-wrap:anywhere}.deploy-notice{display:flex;gap:9px;align-items:flex-start;padding:12px;background:#f7f9fc;border:1px solid #e9edf4;border-radius:8px;margin-top:20px;color:#7788a2}.deploy-notice p{font-size:11px;line-height:1.6;color:#65748a}.edge-form .studio-actions{margin:18px 0 0;justify-content:flex-end}.edge-form .studio-actions .button{min-height:42px}.edge-licence,.step-hint{font-size:12px;color:#65748a;margin-top:10px}.edge-why{font-size:12px;color:#64748b;margin-top:14px}.edge-why summary{cursor:pointer;min-height:34px;color:var(--aadml-primary);overflow-wrap:anywhere}.edge-why li{margin:7px 0}.deployment-unavailable{text-align:center;padding:35px 24px;color:#7b89a0}.deployment-unavailable h4{font-size:14px;margin:12px 0 8px}.deployment-unavailable p{font-size:12px}.edge-jobs{margin:28px 0 24px}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:15px}.section-heading h3{font-size:15px}.section-heading p{font-size:12px;color:#7c8799;margin-top:4px}.edge-empty{display:flex;gap:18px;align-items:center;padding:25px;border:1px dashed #d8e0ec;border-radius:12px;background:#fafbfd}.edge-empty h4{font-size:13px;margin:0 0 5px}.edge-empty p{font-size:12px;color:#7b8799}.edge-job-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}.edge .edge-job{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:19px 22px;border-radius:11px}.edge-job-main{min-width:0}.edge-job-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px}.edge-job p{font-size:12px;margin:6px 0 0;color:#64748b;overflow-wrap:anywhere}.edge-job .edge-health{font-size:11px}.edge-job-actions{display:flex;gap:8px;flex-wrap:wrap}.connection-guide{margin:0 0 20px}.connection-guide>summary{display:flex;align-items:center;gap:12px;padding:19px 22px;cursor:pointer;list-style:none}.connection-guide>summary::-webkit-details-marker{display:none}.connection-guide summary strong{font-size:13px;display:block}.connection-guide summary small{display:block;font-size:11px;color:#7c889b;margin-top:4px}.guide-chevron{margin-left:auto;color:#8491a6}.connection-guide[open] .guide-chevron{transform:rotate(180deg)}.guide-content{padding:24px;border-top:1px solid #edf0f4}.guide-content>h3{font-size:15px;margin-bottom:8px}.step-lead{font-size:12px;color:#64748b;margin:0 0 20px}.link-button{border:0;background:transparent;color:var(--aadml-primary);text-decoration:underline;min-height:32px}.edge-error{padding:14px 18px;background:#fff4f2;border:1px solid #f4d1cc;border-radius:9px;margin-bottom:16px;color:#a03829;font-size:12px}.edge :is(a,summary):focus-visible{outline:3px solid var(--aadml-outline);outline-offset:3px}.requirements[open] summary svg{transform:rotate(180deg)}
@media(max-width:1050px){.edge-workspace{grid-template-columns:1fr 1.2fr}.edge-form .form-grid{grid-template-columns:1fr}.edge-metrics>div{padding:16px}.edge-metrics dd{gap:8px}}
@media(max-width:760px){.edge-workspace{grid-template-columns:1fr}.edge-form .form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.edge-head{align-items:flex-start}.edge-head p{max-width:35ch}.edge-eyebrow{font-size:8px}.edge-icon{display:none}.edge-metrics{gap:8px}.edge-metrics>div{padding:14px 12px}.edge-metrics dt{font-size:10px}.edge-metrics dt svg{display:none}.edge-metrics dd{flex-wrap:wrap;font-size:25px;gap:5px}.edge-metrics dd span{flex-basis:100%;font-size:10px}.edge-progress{padding:12px;gap:10px}.progress-item{gap:6px}.progress-item strong{font-size:10px}.progress-arrow{display:none}.progress-item small{font-size:9px}.edge-privacy>span{display:none}}
@media(max-width:480px){.edge-head{gap:10px}.edge-head h2{font-size:22px}.edge-head>.button{font-size:11px;padding:9px}.edge-form .form-grid{grid-template-columns:1fr}.edge-progress{grid-template-columns:1fr}.progress-item{padding:3px}.progress-item>span:last-of-type{display:flex;gap:10px;align-items:center}.progress-item small{margin:0}.edge-empty{align-items:flex-start}.guide-content{padding:16px}.edge .edge-job{align-items:flex-start;flex-direction:column}.edge-privacy p{font-size:11px}.edge-head p{font-size:12px}}

.deployment-count{display:inline-block;font-size:10px;vertical-align:middle;border:1px solid #e3e8ef;border-radius:5px;padding:2px 6px;color:#75839a;margin-left:5px;font-weight:500}.job-details{display:flex;flex-wrap:wrap;gap:14px 28px;margin:14px 0 10px}.job-details>div{min-width:0}.job-details dt{font-size:10px;color:#7b8799;margin-bottom:4px}.job-details dd{font-size:12px;color:#34445c;margin:0;overflow-wrap:anywhere}.job-details code{font-size:11px;padding:2px 5px;background:#f3f5f8;border-radius:4px}
/* App integration */
.edge-path{display:grid;grid-template-columns:auto minmax(80px,1fr) auto;align-items:center;margin:0 0 18px;padding:16px 18px;border:1px solid #e3e6ed;border-radius:12px;background:var(--aadml-tint)}
.path-node{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:#fff;border:1px solid #dbe3ef;color:var(--aadml-primary);min-width:0}
.path-node span{display:flex;flex-direction:column;font-size:12px;color:#5f6d82;line-height:1.35;min-width:0}
.path-node strong{font-size:13px;color:#0f172a;overflow-wrap:anywhere}
.path-node--machine{border-color:var(--aadml-outline)}
.path-link{position:relative;height:2px;background:var(--aadml-primary);margin:0 12px 0 8px}
.path-link::after{content:"";position:absolute;right:-7px;top:-4px;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:7px solid var(--aadml-primary)}
.path-link span{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);white-space:nowrap;font-size:11.5px;color:#1e3a8a;font-weight:550}
.path-side{grid-column:1 / -1;display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px dashed #cfd8e6;font-size:12px;color:#5f6d82}
.path-side svg{color:#8a97ab}

.call-setup{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:14px}
.call-setup .field-label{margin:0}
.call-setup .text-input{min-height:44px}
.call-addresses{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 18px}
.call-addresses > div{padding:12px 14px;border:1px solid #e3e6ed;border-radius:9px;min-width:0;background:#fff}
.call-addresses dt{font-size:12px;color:#5f6d82;margin-bottom:6px;display:flex;align-items:center;gap:8px}
.call-addresses dd{margin:0;display:flex;align-items:flex-start;gap:6px;font-size:13px;color:#0f172a;overflow-wrap:anywhere;line-height:1.45}
.call-addresses dd code{font-size:12.5px;min-width:0}
.verb{font-size:10.5px;font-weight:650;color:var(--aadml-primary-dark);background:var(--aadml-soft);border-radius:4px;padding:1px 5px}
.copy-icon{display:inline-grid;place-items:center;flex-shrink:0;min-width:44px;min-height:44px;margin:-12px -10px -12px auto;border:0;border-radius:6px;background:transparent;color:#5f6d82;cursor:pointer}
.copy-icon:hover{background:var(--aadml-tint);color:var(--aadml-primary)}

.call-code{display:grid;gap:12px;min-width:0}
.segmented{display:inline-flex;padding:3px;border-radius:9px;background:#f1f3f7;gap:2px;width:max-content;max-width:100%}
.segmented button{min-height:44px;padding:7px 16px;border:0;border-radius:7px;background:transparent;color:#4d5a70;font:inherit;font-size:13px;font-weight:550;cursor:pointer;transition:background-color .15s,color .15s}
.segmented button.on{background:#fff;color:var(--aadml-primary);box-shadow:0 1px 3px #1d2a4224}
.segmented button:hover:not(.on){color:#1d2a42}
.segmented button:focus-visible,.copy-chip:focus-visible,.copy-icon:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.command-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 8px 8px 14px;border:1px solid #dfe3eb;border-radius:9px;background:#f8f9fb;min-width:0}
.command-row code{font-size:13px;color:#1d2a42;overflow-wrap:anywhere;min-width:0}
.command-row.small{margin:8px 0}
.command-row.small code{font-size:12px}
.copy-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:6px 12px;border:1px solid #dfe3eb;border-radius:7px;background:#fff;color:#33415a;font:inherit;font-size:12px;font-weight:550;cursor:pointer;flex-shrink:0;transition:background-color .15s,border-color .15s}
.copy-chip:hover{border-color:var(--aadml-focus);background:var(--aadml-tint)}
.copy-chip.on-dark{position:absolute;top:8px;right:8px;background:#2c3a50;border-color:#3e4d65;color:#e3e8f1}
.copy-chip.on-dark:hover{background:#38475f;border-color:#53637d}
.use-code{position:relative;min-width:0}
.use-code .code-block{margin:0;min-height:0;max-height:340px;overflow:auto;padding:58px 22px 20px;white-space:pre;font-size:12.5px;line-height:1.7;overflow-wrap:normal}
.answer-json{margin:0;min-height:0;max-height:300px;overflow:auto;padding:18px 20px;white-space:pre;font-size:12px;line-height:1.65;overflow-wrap:normal}
.use-code .code-block:focus-visible,.answer-json:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px}

.call-answer{margin-top:24px}
.answer-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px;align-items:start}
.answer-fields{margin:0;display:grid;gap:10px}
.answer-fields dt code{font-size:12px;color:#0f172a;background:#f1f4f8;border-radius:5px;padding:2px 6px}
.answer-fields dd{margin:4px 0 0;font-size:12.5px;line-height:1.55;color:#475569}

.call-facts{list-style:none;margin:24px 0 0;padding:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:12px}
.call-facts > li{display:flex;gap:12px;align-items:flex-start;padding:16px;border:1px solid #e3e6ed;border-radius:12px;background:#fff;min-width:0}
.call-facts > li:nth-child(3){grid-column:1 / -1}
.call-facts > li > svg{color:var(--aadml-primary);margin-top:2px}
.call-facts > li > div{min-width:0}
.call-facts strong{display:block;font-size:13px;color:#0f172a}
.call-facts span{display:block;font-size:12.5px;line-height:1.55;color:#475569;margin-top:3px}

.call-errors p{margin:8px 0!important;color:#475569!important}
.call-errors dl{margin:8px 0 0;display:grid;gap:6px}
.call-errors dl > div{display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px}
.call-errors dt{font-weight:650;color:#0f172a;font-variant-numeric:tabular-nums}
.call-errors dd{margin:0}
.call-errors code{font-size:12px}

.edge-foot{display:flex;align-items:center;gap:8px;font-size:12px;color:#5f6d82!important;margin:0!important}
.edge-foot svg{color:#27765a}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:860px){
  .answer-grid,.call-facts{grid-template-columns:1fr}
  .call-facts > li:nth-child(3){grid-column:auto}
}
@media(max-width:640px){
  .step-mark{width:28px;height:28px;font-size:13px}
  .edge-job{flex-direction:column;align-items:stretch}
  .edge-job-actions .button,.edge-form .button{flex:1 1 auto;width:100%}
  .edge-path{grid-template-columns:1fr;padding:14px}
  .path-link{width:2px;height:40px;margin:0 0 0 22px}
  .path-link::after{right:auto;left:-4px;top:auto;bottom:-7px;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid var(--aadml-primary);border-bottom:0}
  .path-link span{left:16px;bottom:auto;top:50%;transform:translateY(-50%)}
  .call-addresses{grid-template-columns:1fr}
  .segmented{display:flex;width:100%}
  .segmented button{flex:1 1 0;min-width:0;padding:7px 6px}
  .command-row{flex-wrap:wrap}
  .use-code .code-block{font-size:12px;padding:58px 16px 16px}
  .call-errors dl > div{grid-template-columns:1fr;gap:2px}
}
@media(prefers-reduced-motion:reduce){.spin{animation:none}.segmented button,.copy-chip{transition:none}}
</style>
