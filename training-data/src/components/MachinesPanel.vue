<script setup>
// Workspace settings, "Your machines" (TRAINING_OPEN_MODELS_PLAN.md section 5): machines the person owns, managed by AADML.
// The person's whole part is the one command shown here; training and running models on a machine are chosen on the
// Train tab and the Deployments page's Edge Devices tab. Backend: training_models_data/machines_api.py.
import { computed, onUnmounted, ref } from 'vue';
import { Check, Copy, Cpu, LoaderCircle, Plus, RefreshCw, Server, ShieldCheck, Trash2 } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import { machinesApi, machineState, capabilityLine, lastSeen, expiryLine, secondsLeft, commandFor, projectsLine } from '../api/machines.js';

const data = ref(null); const error = ref(''); const loading = ref(false);
const said = ref('');
function announce(text) { said.value = ''; requestAnimationFrame(() => { said.value = text; }); }

let gone = false; let pollTimer = null;
async function load() {
  if (loading.value) return;
  loading.value = true;
  const before = new Map((data.value?.machines || []).map(m => [m.id, m.state]));
  try {
    data.value = await machinesApi.list(); error.value = '';
    // While the command is shown, a machine that was not there before is the one that just joined: the code is used up.
    const joined = added.value ? data.value.machines.filter(m => !before.has(m.id)) : [];
    if (joined.length) { announce(`${joined.map(m => m.name).join(', ')} joined and is online.`); added.value = null; }
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; if (!gone) { clearTimeout(pollTimer); pollTimer = setTimeout(load, added.value ? 5000 : 30000); } }
}
load();
const machines = computed(() => data.value?.machines || []);
const now = ref(Date.now());
const clock = setInterval(() => { now.value = Date.now(); }, 5000);

// ── adding a machine: one code, one command, shown once ────────────────────────────────────────────────────
const added = ref(null); const adding = ref(false); const addError = ref('');
const gpu = ref(true);
const command = computed(() => commandFor(added.value, gpu.value));
const expired = computed(() => !!added.value && !secondsLeft(added.value.expires_at, now.value));
async function addMachine() {
  if (adding.value) return;
  adding.value = true; addError.value = '';
  try {
    added.value = await machinesApi.add();
    now.value = Date.now();
    announce(`The command to add a machine is ready. It works for ${added.value.minutes || 10} minutes, once.`);
    clearTimeout(pollTimer); pollTimer = setTimeout(load, 5000);
  } catch (e) { addError.value = e.message; }
  finally { adding.value = false; }
}
function closeAdd() { added.value = null; copied.value = false; }

const copied = ref(false); const copyError = ref(''); let copiedTimer = null;
async function copyCommand() {
  try {
    await navigator.clipboard.writeText(command.value);
    copied.value = true; copyError.value = '';
    announce('Copied the command.');
    clearTimeout(copiedTimer); copiedTimer = setTimeout(() => { copied.value = false; }, 2000);
  } catch { copyError.value = 'Copying was blocked by the browser. Select the command and copy it with Ctrl+C.'; }
}

// ── removing one ─────────────────────────────────────────────────────────────────────────────────────────
const removing = ref(null); const removeBusy = ref(false); const removeError = ref('');
async function confirmRemove() {
  if (!removing.value || removeBusy.value) return;
  removeBusy.value = true; removeError.value = '';
  try {
    const name = removing.value.name;
    await machinesApi.remove(removing.value.id);
    removing.value = null;
    announce(`${name} was removed. Its key no longer works.`);
    await load();
  } catch (e) { removeError.value = e.message; }
  finally { removeBusy.value = false; }
}

onUnmounted(() => { gone = true; clearTimeout(pollTimer); clearTimeout(copiedTimer); clearInterval(clock); });
</script>

<template>
  <section class="studio machines" aria-labelledby="machines-heading" :aria-busy="loading">
    <p class="visually-hidden" aria-live="polite">{{ said }}</p>
    <header class="machines-head">
      <div>
        <h2 id="machines-heading">Machines in this workspace</h2>
        <p>You start one container on the machine. Choosing its work, watching it and stopping it are done in AADML: here, on a project's Train tab, and on the Deployments page's Edge Devices tab.</p>
      </div>
      <UiButton v-if="data?.may_manage && data?.available && !added" variant="primary" :disabled="adding" @click="addMachine">
        <LoaderCircle v-if="adding" :size="16" class="spin" aria-hidden="true"/><Plus v-else :size="16" aria-hidden="true"/>
        {{ adding ? 'Making the command…' : 'Add a machine' }}
      </UiButton>
    </header>

    <p v-if="error" class="field-error" role="alert">{{ error }} <button type="button" class="link-button" @click="load">Try again</button></p>
    <p v-if="addError" class="field-error" role="alert">{{ addError }}</p>
    <p v-if="data && !data.available" class="machines-note">{{ data.unavailable_note }}</p>
    <p v-else-if="data && !data.may_manage" class="machines-note">An Admin of the workspace adds and removes machines.</p>

    <section v-if="added" class="panel machine-add" aria-labelledby="add-heading">
      <h3 id="add-heading">Add a machine</h3>
      <p>Run this command once on the machine, in a terminal where Docker works. The machine joins this workspace and appears below as online.</p>
      <label class="gpu-choice"><input v-model="gpu" type="checkbox"> The machine has an NVIDIA GPU</label>
      <div class="command">
        <pre :id="'machine-command'" tabindex="0" aria-label="The command to run on the machine"><code>{{ command || 'The command cannot be shown. Make a new one.' }}</code></pre>
        <UiButton :disabled="!command || expired" :aria-describedby="'machine-command'" @click="copyCommand">
          <Check v-if="copied" :size="16" aria-hidden="true"/><Copy v-else :size="16" aria-hidden="true"/>{{ copied ? 'Copied' : 'Copy' }}
        </UiButton>
      </div>
      <p v-if="copyError" class="field-error" role="alert">{{ copyError }}</p>
      <p :class="['expiry', { 'expiry--ended': expired }]">{{ expiryLine(added.expires_at, now) }}</p>
      <div class="machine-add-facts">
        <div>
          <h4><ShieldCheck :size="16" aria-hidden="true"/> What the machine reaches</h4>
          <p>It opens no port. Allow outbound HTTPS (port 443) to:</p>
          <ul><li v-for="h in added.firewall_hosts" :key="h.host"><code>{{ h.host }}</code> <span>{{ h.why }}</span></li></ul>
        </div>
        <div>
          <h4><Cpu :size="16" aria-hidden="true"/> What it runs</h4>
          <p>The command gives AADML's agent your Docker socket, so it can start each job in a sealed container of its own: no network while it runs, no extra rights, a read-only system, and limits on memory, processors and time. A job never gets the socket.</p>
        </div>
      </div>
      <div class="studio-actions">
        <UiButton v-if="expired" variant="primary" :disabled="adding" @click="addMachine"><RefreshCw :size="16" aria-hidden="true"/> Make a new command</UiButton>
        <UiButton @click="closeAdd">Done</UiButton>
      </div>
    </section>

    <div v-if="loading && !data" class="preview-loading" aria-label="Loading your machines"><div></div><div></div></div>
    <div v-else-if="data && !machines.length" class="empty-state machines-empty">
      <Server :size="28" aria-hidden="true"/>
      <h2>No machines yet</h2>
      <p v-if="data.available">Add a machine to train models or run them on your own hardware. No AADML machine is paid for while it works.</p>
      <p v-else>Your machines will train models and run them on your own hardware. You can add one once the images they run are published.</p>
    </div>
    <ul v-else class="machine-list">
      <li v-for="m in machines" :key="m.id" class="panel machine-row">
        <div class="machine-main">
          <div class="machine-title">
            <strong>{{ m.name }}</strong>
            <UiBadge :tone="machineState(m)[0]">{{ machineState(m)[1] }}</UiBadge>
            <UiBadge v-if="!m.up_to_date" tone="purple">Updating its agent</UiBadge>
          </div>
          <p>{{ capabilityLine(m.capabilities) }}</p>
          <p class="machine-meta">{{ lastSeen(m.last_seen_at, now) }}. {{ projectsLine(m) }}. {{ m.jobs ? `${m.jobs} job${m.jobs === 1 ? '' : 's'} now.` : 'No job now.' }}</p>
        </div>
        <UiButton v-if="data.may_manage" :aria-label="`Remove ${m.name}`" @click="removing = m; removeError = ''"><Trash2 :size="16" aria-hidden="true"/> Remove</UiButton>
      </li>
    </ul>

    <UiDialog :open="!!removing" :title="removing ? `Remove ${removing.name}?` : ''" @close="removing = null">
      <p class="dialog-description">Its key stops working at once. Training it has not finished fails, and models it serves stop. To use the machine again, add it with a new command.</p>
      <p v-if="removeError" class="field-error" role="alert">{{ removeError }}</p>
      <div class="dialog-actions">
        <UiButton @click="removing = null">Cancel</UiButton>
        <UiButton variant="primary" :disabled="removeBusy" @click="confirmRemove">{{ removeBusy ? 'Removing…' : 'Remove machine' }}</UiButton>
      </div>
    </UiDialog>
  </section>
</template>

<style scoped>
.machines{max-width:960px}
.machines-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}
.machines-head h2{margin:0 0 6px}
.machines-head p{max-width:62ch}
.machines-note{background:var(--aadml-tint);border:1px solid var(--aadml-soft);border-radius:8px;padding:12px 14px;color:#41506a;margin:0 0 18px}
.link-button{background:none;border:0;color:var(--aadml-primary);font-weight:600;padding:0 4px;text-decoration:underline}
.machine-add{margin-bottom:22px;border-color:var(--aadml-outline)}
.machine-add h3{margin-bottom:6px}
.gpu-choice{display:inline-flex;align-items:center;gap:10px;margin:14px 0 10px;min-height:44px;cursor:pointer;font-weight:550}
.gpu-choice input{width:18px;height:18px;accent-color:var(--aadml-primary)}
.command{display:flex;gap:10px;align-items:stretch}
.command pre{flex:1;min-width:0;margin:0;background:#202b3c;color:#e6ebf3;border-radius:10px;padding:16px 18px;font-size:12px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}
.command pre:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px}
.command .button{align-self:flex-start;min-height:44px}
.expiry{margin-top:10px;color:#27765a;font-weight:550}
.expiry--ended{color:#b52f40}
.machine-add-facts{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:18px;padding-top:18px;border-top:1px solid #e9ecf2}
.machine-add-facts h4{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-size:13px;color:#162139}
.machine-add-facts h4 svg{color:var(--aadml-primary)}
.machine-add-facts ul{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:8px}
.machine-add-facts li{display:flex;flex-direction:column;gap:2px}
.machine-add-facts code{font-size:12px;color:#162139;overflow-wrap:anywhere}
.machine-add-facts li span{font-size:12px;color:#5f6d82}
.machines-empty{display:flex;flex-direction:column;align-items:center}
.machine-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.machine-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px}
.machine-main{min-width:0}
.machine-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.machine-title strong{font-size:14px;overflow-wrap:anywhere}
.machine-row p{margin:4px 0 0}
.machine-meta{font-size:12px}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:640px){
  .machines-head,.machine-row{flex-direction:column;align-items:stretch}
  .command{flex-direction:column}
  .command .button,.machine-row .button,.machines-head .button{width:100%;min-height:44px}
  .machine-add-facts{grid-template-columns:1fr}
}
@media(prefers-reduced-motion:reduce){.spin{animation:none}}
</style>
