<script setup>
// Workspace settings, "Your machines" (TRAINING_OPEN_MODELS_PLAN.md section 5): machines the person owns, managed by AADML.
// The person's whole part is the one command shown here; training and running models on a machine are chosen on the
// Train tab and the Deployments page's Edge Devices tab. Backend: training_models_data/machines_api.py.
import { computed, onUnmounted, ref } from 'vue';
import { Check, Copy, Plus, Server, Trash2, Wrench } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import MachineConnection from './MachineConnection.vue';
import MachineNeeds from './MachineNeeds.vue';
import { machinesApi, machineState, capabilityLine, lastSeen, projectsLine, MACHINE_COMMANDS, reachCommand } from '../api/machines.js';

const props = defineProps({ embedded: Boolean });
const emit = defineEmits(['changed']);
const connecting = ref(false);
function takeMachines(answer) { data.value = answer; error.value = ''; emit('changed', answer); }
function connected() { connecting.value = false; load(); }
const data = ref(null); const error = ref(''); const loading = ref(false);
const said = ref('');
function announce(text) { said.value = ''; requestAnimationFrame(() => { said.value = text; }); }

let gone = false; let pollTimer = null;
async function load() {
  if (loading.value) return;
  loading.value = true;
  try {
    const answer = await machinesApi.list();
    if (!gone) takeMachines(answer);
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; if (!gone) { clearTimeout(pollTimer); pollTimer = setTimeout(load, 30000); } }
}
load();
const machines = computed(() => data.value?.machines || []);
const now = ref(Date.now());
const clock = setInterval(() => { now.value = Date.now(); }, 5000);

const copyError = ref('');
// The commands of "If something is wrong" and "Removing a machine", each with its own chip.
const copiedCheck = ref(''); let checkTimer = null;
async function copyCheck(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    copiedCheck.value = what; copyError.value = '';
    announce('Copied the command.');
    clearTimeout(checkTimer); checkTimer = setTimeout(() => { copiedCheck.value = ''; }, 2000);
  } catch { copyError.value = 'Copying was blocked by the browser. Select the command and copy it with Ctrl+C.'; }
}
const hosts = computed(() => data.value?.firewall_hosts || []);
const reachChecks = computed(() => hosts.value.map(h => ({ host: h.host, command: reachCommand(h.host) })).filter(c => c.command));
const offlineMinutes = computed(() => data.value?.offline_minutes || 3);

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

onUnmounted(() => { gone = true; clearTimeout(pollTimer); clearTimeout(checkTimer); clearInterval(clock); });
</script>

<template>
  <section :class="['studio machines', {'machines--embedded':props.embedded}]" aria-labelledby="machines-heading" :aria-busy="loading">
    <p class="visually-hidden" aria-live="polite">{{ said }}</p>
    <header class="machines-head">
      <div>
        <h2 id="machines-heading">{{ props.embedded ? 'Your edge machines' : 'Machines in this workspace' }}</h2>
        <p v-if="!props.embedded">Your own computers, which AADML trains and runs models on. You start one container on the machine; choosing its work, watching it and stopping it are done in AADML: here, on a project's Train tab, and on the Deployments page's Edge Devices tab.</p>
      </div>
      <UiButton v-if="data?.may_manage && data?.available && !connecting" variant="primary" @click="connecting = true"><Plus :size="16" aria-hidden="true"/> Connect a machine</UiButton>
    </header>

    <p v-if="error" class="field-error" role="alert">{{ error }} <button type="button" class="link-button" @click="load">Try again</button></p>
    <p v-if="data && !data.available" class="machines-note">{{ data.unavailable_note }}</p>
    <p v-else-if="data && !data.may_manage" class="machines-note">An Admin of the workspace adds and removes machines.</p>

    <MachineConnection v-if="connecting" continue-label="Back to machines" @cancel="connecting=false" @connected="connected" @updated="takeMachines"/>
    <template v-else>
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

    <details class="panel machines-help machine-requirements">
      <summary>Machine requirements</summary>
      <MachineNeeds :hosts="hosts.length ? hosts : null"/>
    </details>

    <details class="machine-maintenance"><summary>Help &amp; maintenance</summary><div class="machines-help-grid">
      <section class="panel machines-help" aria-labelledby="remove-heading">
        <h3 id="remove-heading"><Trash2 :size="16" aria-hidden="true"/> Removing a machine</h3>
        <p>Remove it here first: its key stops working at once, training it has not finished fails, and the models it runs stop. Then clear it from the machine: the agent, its volume and the containers it started.</p>
        <div class="check-row"><code>{{ MACHINE_COMMANDS.clean }}</code><button type="button" class="copy-chip" :aria-label="copiedCheck==='clean' ? 'Command copied' : 'Copy the command that clears the machine'" @click="copyCheck(MACHINE_COMMANDS.clean,'clean')"><Check v-if="copiedCheck==='clean'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copiedCheck==='clean' ? 'Copied' : 'Copy' }}</button></div>
        <p>To add it again, make a new command. Clear the old volume first: a machine that still holds a removed key cannot join.</p>
      </section>

      <section class="panel machines-help" aria-labelledby="trouble-heading">
        <h3 id="trouble-heading"><Wrench :size="16" aria-hidden="true"/> If something is wrong</h3>
        <details class="trouble">
          <summary>The machine does not appear, or shows Offline</summary>
          <p>A machine is Offline when AADML has not heard from it for {{ offlineMinutes }} minutes. On the machine, check that Docker runs, version 24 or newer, on x86_64:</p>
          <div class="check-row"><code>{{ MACHINE_COMMANDS.docker }}</code><button type="button" class="copy-chip" :aria-label="copiedCheck==='docker' ? 'Command copied' : 'Copy the Docker check'" @click="copyCheck(MACHINE_COMMANDS.docker,'docker')"><Check v-if="copiedCheck==='docker'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copiedCheck==='docker' ? 'Copied' : 'Copy' }}</button></div>
          <p>Then read what the agent last said. It names a code that expired or was used, and a host it cannot reach:</p>
          <div class="check-row"><code>{{ MACHINE_COMMANDS.logs }}</code><button type="button" class="copy-chip" :aria-label="copiedCheck==='logs' ? 'Command copied' : 'Copy the log command'" @click="copyCheck(MACHINE_COMMANDS.logs,'logs')"><Check v-if="copiedCheck==='logs'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copiedCheck==='logs' ? 'Copied' : 'Copy' }}</button></div>
          <template v-if="reachChecks.length">
            <p>Check that outbound HTTPS reaches each host. Any number back means it is reached; 000 or a timeout means a firewall or a proxy blocks it:</p>
            <div v-for="c in reachChecks" :key="c.host" class="check-row"><code>{{ c.command }}</code><button type="button" class="copy-chip" :aria-label="copiedCheck===c.host ? 'Command copied' : `Copy the check for ${c.host}`" @click="copyCheck(c.command,c.host)"><Check v-if="copiedCheck===c.host" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copiedCheck===c.host ? 'Copied' : 'Copy' }}</button></div>
          </template>
          <p>If the join code expired before the machine joined, make a new command here and run that one.</p>
        </details>
        <details class="trouble">
          <summary>The GPU is not listed</summary>
          <p>The machine needs the NVIDIA driver and the NVIDIA Container Toolkit, and must have been started with the command made for a GPU (the one with <code>--gpus all</code>). Check that Docker can give a container the GPU:</p>
          <div class="check-row"><code>{{ MACHINE_COMMANDS.gpu }}</code><button type="button" class="copy-chip" :aria-label="copiedCheck==='gpu' ? 'Command copied' : 'Copy the GPU check'" @click="copyCheck(MACHINE_COMMANDS.gpu,'gpu')"><Check v-if="copiedCheck==='gpu'" :size="15" aria-hidden="true"/><Copy v-else :size="15" aria-hidden="true"/>{{ copiedCheck==='gpu' ? 'Copied' : 'Copy' }}</button></div>
          <p>Once it lists the GPU, remove the machine here, clear it as Removing a machine says, and add it again with "The machine has an NVIDIA GPU" ticked.</p>
        </details>
        <details class="trouble">
          <summary>It says Updating its agent</summary>
          <p>The machine is moving to the agent version AADML names. It does so by itself within a few minutes, and keeps its key and its work.</p>
        </details>
        <p v-if="copyError" class="field-error" role="alert">{{ copyError }}</p>
      </section>
    </div>

    </details>
    </template>

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
.machines{max-width:1120px}.machines--embedded{max-width:none}.machines--embedded .machines-head h2{font-size:15px}.machines--embedded .machines-head{align-items:center;margin-bottom:20px}.machines-head p{font-size:13px;color:#718097;line-height:1.8}.machines .machines-empty{border:1px dashed #d6dfec;background:#fff;border-radius:12px;padding:30px 22px;min-height:200px;gap:12px;text-align:center}.machines .machines-empty h2{font-size:16px;color:#34445c}.machines .machines-empty p{font-size:12px;color:#8190a6;line-height:1.8;max-width:55ch}.machines--embedded .machines-empty{min-height:160px}.machine-requirements summary,.machine-maintenance>summary{min-height:44px;align-content:center;font-size:13px;font-weight:550;color:#52627b;cursor:pointer}.machine-requirements[open] summary{margin-bottom:18px}.machine-maintenance{margin-top:16px;border:1px solid #e3e8ef;border-radius:11px;padding:7px 18px;background:#fff}.machine-maintenance[open]{padding-bottom:18px}.machines-help{border-color:#e3e8ef}.machines--embedded .machine-row{padding:16px}.machines--embedded .machine-row p{font-size:12px;color:#7b889e}.machines--embedded .machine-meta{font-size:11px}
.machines-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}
.machines-head h2{margin:0 0 6px}
.machines-head p{max-width:62ch}
.machines-note{background:var(--aadml-tint);border:1px solid var(--aadml-soft);border-radius:8px;padding:12px 14px;color:#41506a;margin:0 0 18px}
.link-button{background:none;border:0;color:var(--aadml-primary);font-weight:600;padding:0 4px;text-decoration:underline}
.machines-empty{display:flex;flex-direction:column;align-items:center}
.machine-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.machine-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px}
.machine-main{min-width:0}
.machine-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.machine-title strong{font-size:14px;overflow-wrap:anywhere}
.machine-row p{margin:4px 0 0}
.machine-meta{font-size:12px}
.machines-help{margin-top:22px;padding:22px 24px}
.machines-help h3{display:flex;align-items:center;gap:8px;font-size:15px;margin:0 0 14px;color:#0f172a}
.machines-help h3 svg{color:var(--aadml-primary)}
.machines-help > p,.trouble p{font-size:12.5px;line-height:1.6;color:#475569!important;margin:8px 0!important}
.machines-help-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:0 18px;align-items:start}
.check-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 6px 6px 12px;border:1px solid #dfe3eb;border-radius:9px;background:#f8f9fb;margin:8px 0;min-width:0}
.check-row code{font-size:12px;color:#1d2a42;overflow-wrap:anywhere;min-width:0}
.copy-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:6px 12px;border:1px solid #dfe3eb;border-radius:7px;background:#fff;color:#33415a;font:inherit;font-size:12px;font-weight:550;cursor:pointer;flex-shrink:0;transition:background-color .15s,border-color .15s}
.copy-chip:hover{border-color:var(--aadml-focus);background:var(--aadml-tint)}
.copy-chip:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.trouble{border-top:1px solid #e9ecf2;padding:4px 0}
.trouble:first-of-type{border-top:0}
.trouble summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:13px;font-weight:600;color:#0f172a}
.trouble summary:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px;border-radius:4px}
.trouble code{font-size:12px}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:640px){
  .machines-head,.machine-row{flex-direction:column;align-items:stretch}
  .machine-row .button,.machines-head .button{width:100%;min-height:44px}
  .check-row{flex-wrap:wrap}
  .machines-help{padding:18px}
}
@media(max-width:900px){.machines-help-grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.spin{animation:none}.copy-chip{transition:none}}
</style>
