<script setup>
// The Edge Devices tab of the workspace Deployments page: run an approved model on one of the workspace's own machines
// (TRAINING_OPEN_MODELS_PLAN.md section 5). Nothing is downloaded and nothing is run by hand: the machine takes the model
// at its next poll and answers on its own network. Backend: machines_api.py workspace/edge/, workspace/machines/<id>/serve/,
// workspace/machine-jobs/<id>/stop/; the release rules are edge.py's.
import { computed, onUnmounted, ref, watch } from 'vue';
import { Cpu, LoaderCircle, Play, Server, Square } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { edgeApi, choiceKey, modelLabel, sortedChoices, whyNot, ENVIRONMENT_LABELS, machinesFor, portProblem, answerAt } from '../api/edge.js';
import { jobState, isActive, lastSeen } from '../api/machines.js';

const emit = defineEmits(['navigate']);

const data = ref(null); const error = ref(''); const loading = ref(false);
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
    // Read again while a model is starting or stopping, so its state is true without a reload.
    if (!gone) { clearTimeout(pollTimer); if (jobs.value.some(j => isActive(j))) pollTimer = setTimeout(load, 10000); }
  }
}
load();

const choices = computed(() => sortedChoices(data.value?.models));
const jobs = computed(() => data.value?.jobs || []);
const running = computed(() => jobs.value.filter(isActive));
const ended = computed(() => jobs.value.filter(j => !isActive(j)));

// ── the form: a model, where it is released to, the machine, its port ────────────────────────────────────
const picked = ref(''); const environment = ref(''); const machineId = ref(''); const port = ref(8080);
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
async function start() {
  if (!ready.value || busy.value) return;
  busy.value = true; serveError.value = '';
  try {
    const job = await edgeApi.serve(machineId.value, { project: chosen.value.project.ref, model: chosen.value.number, environment: environment.value, port: port.value });
    announce(`${modelLabel(chosen.value)} goes to ${job.machine.name}. It starts at the machine's next check, within a minute.`);
    picked.value = '';
    await load();
  } catch (e) { serveError.value = e.message; }
  finally { busy.value = false; }
}

// ── stopping a model ─────────────────────────────────────────────────────────────────────────────────────
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
const health = job => (job.state !== 'running' ? '' : job.health?.at ? (job.health.ok ? `Answering. Checked ${lastSeen(job.health.at).replace('Seen ', '')}.` : 'Not answering its health check.') : 'Starting: pulling the image and the model.');
onUnmounted(() => { gone = true; clearTimeout(pollTimer); });
</script>

<template>
  <section class="studio edge" role="tabpanel" aria-labelledby="edge-heading" :aria-busy="loading">
    <p class="visually-hidden" aria-live="polite">{{ said }}</p>
    <header class="edge-head">
      <span class="edge-icon" aria-hidden="true"><Cpu :size="20"/></span>
      <div>
        <h2 id="edge-heading">Run a model on your machine</h2>
        <p>An approved model answers on one of your own machines, on your network. {{ data?.photos }}</p>
      </div>
    </header>

    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-if="data && !data.available" class="edge-note">{{ data.unavailable_note }}</p>
    <div v-else-if="data && !(data.machines || []).length" class="edge-note">
      <p>This workspace has no machine yet. An Admin adds one in Workspace settings, Your machines.</p>
      <UiButton @click="emit('navigate', 'machines')"><Server :size="16" aria-hidden="true"/> Open Your machines</UiButton>
    </div>

    <form v-if="data?.available" class="panel edge-form" @submit.prevent="start">
      <div class="form-grid">
        <label class="field-label">Model
          <select v-model="picked" class="text-input">
            <option value="">{{ choices.length ? 'Choose an approved model' : 'No registered model yet' }}</option>
            <option v-for="row in choices" :key="choiceKey(row)" :value="choiceKey(row)" :disabled="!row.may_serve">
              {{ row.project.name }}: {{ modelLabel(row) }}{{ row.may_serve ? '' : ' (not approved to leave AADML)' }}
            </option>
          </select>
        </label>
        <label class="field-label">Released for
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
        <label class="field-label">Port on the machine
          <input v-model.number="port" class="text-input" type="number" min="1024" max="65535" inputmode="numeric" :aria-invalid="!!portError" aria-describedby="edge-port-help">
          <span id="edge-port-help" class="field-help">{{ portError || `It answers at ${answerAt(port)}` }}</span>
        </label>
      </div>
      <p v-if="chosen && !chosen.may_serve" class="field-error">{{ whyNot(chosen) }}</p>
      <p v-if="chosen?.licence" class="edge-licence">{{ chosen.licence.text }}</p>
      <p v-if="serveError" class="field-error" role="alert">{{ serveError }}</p>
      <div class="studio-actions">
        <UiButton type="submit" variant="primary" :disabled="!ready || busy">
          <LoaderCircle v-if="busy" :size="16" class="spin" aria-hidden="true"/><Play v-else :size="16" aria-hidden="true"/>
          {{ busy ? 'Sending…' : 'Run on the machine' }}
        </UiButton>
      </div>
    </form>

    <section v-if="data" class="edge-jobs" aria-labelledby="edge-jobs-heading">
      <h3 id="edge-jobs-heading">Models on your machines</h3>
      <p v-if="!jobs.length" class="edge-empty">No model runs on a machine yet.</p>
      <ul v-else class="edge-job-list">
        <li v-for="job in [...running, ...ended]" :key="job.id" class="panel edge-job">
          <div class="edge-job-main">
            <div class="edge-job-title">
              <strong>{{ job.model?.name }} {{ job.model?.version }}</strong>
              <UiBadge :tone="jobState(job)[0]">{{ jobState(job)[1] }}</UiBadge>
            </div>
            <p>{{ job.project.name }}, on {{ job.machine.name }}, port {{ job.port }}, released for {{ ENVIRONMENT_LABELS[job.environment] || job.environment }}.</p>
            <p v-if="health(job)" class="edge-health">{{ health(job) }}</p>
            <p v-if="job.failure" class="field-error">{{ job.failure }}</p>
          </div>
          <UiButton v-if="isActive(job) && !job.stopping" :aria-label="`Stop ${job.model?.name} ${job.model?.version} on ${job.machine.name}`" @click="stopping = job; stopError = ''">
            <Square :size="14" aria-hidden="true"/> Stop
          </UiButton>
        </li>
      </ul>
    </section>

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
.edge{max-width:980px}
.edge-head{display:flex;gap:14px;align-items:flex-start;margin-bottom:18px}
.edge-head h2{margin:0 0 6px}
.edge-head p{max-width:68ch}
.edge-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--aadml-soft);color:var(--aadml-primary);flex-shrink:0}
.edge-note{display:flex;flex-direction:column;align-items:flex-start;gap:12px;background:var(--aadml-tint);border:1px solid var(--aadml-soft);border-radius:8px;padding:14px 16px;color:#41506a;margin:0 0 18px}
.edge-note p{margin:0;color:#41506a}
.edge-form .form-grid{margin:0}
.edge-form .field-label{margin:0}
.edge-form .text-input{min-height:44px}
.field-help{display:block;font-weight:400;color:#5f6d82;margin-top:6px;font-size:12px}
.edge-licence{font-size:12px;margin-top:12px}
.edge-jobs{margin-top:26px}
.edge-jobs h3{margin-bottom:10px}
.edge-empty{font-size:13px}
.edge-job-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.edge-job{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px}
.edge-job-main{min-width:0}
.edge-job-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.edge-job p{margin:4px 0 0}
.edge-health{font-size:12px}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:640px){
  .edge-job{flex-direction:column;align-items:stretch}
  .edge-job .button,.edge-form .button{width:100%;min-height:44px}
}
@media(prefers-reduced-motion:reduce){.spin{animation:none}}
</style>
