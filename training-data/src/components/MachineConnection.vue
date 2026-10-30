<script setup>
import { computed, nextTick, onUnmounted, ref } from 'vue';
import { ArrowLeft, ArrowRight, Check, Copy, Cpu, LoaderCircle, RefreshCw, Server, ShieldCheck, Terminal } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import MachineNeeds from './MachineNeeds.vue';
import { machinesApi, capabilityLine, commandFor, expiryLine, secondsLeft } from '../api/machines.js';

defineProps({ continueLabel: { type: String, default: 'Continue to deployment' } });
const emit = defineEmits(['cancel', 'connected', 'updated']);
const info = ref(null); const loading = ref(false); const error = ref('');
const stage = ref(1); const enrollment = ref(null); const generating = ref(false); const gpu = ref(false);
const now = ref(Date.now()); const copied = ref(false); const copyError = ref('');
const selected = ref(''); const detected = ref([]); const said = ref(''); const stageHeading = ref(null);
let baseline = new Map(); let gone = false; let pollTimer; let copyTimer;
const clock = setInterval(() => { now.value = Date.now(); }, 1000);
const expired = computed(() => !!enrollment.value && !secondsLeft(enrollment.value.expires_at, now.value));
const command = computed(() => expired.value ? '' : commandFor(enrollment.value, gpu.value));
const mayConnect = computed(() => !!(info.value?.available && info.value?.may_manage));
const hosts = computed(() => info.value?.firewall_hosts || enrollment.value?.firewall_hosts || []);
const online = computed(() => (info.value?.machines || []).filter(m => m.state === 'online' && detected.value.includes(m.id)));
const machine = computed(() => online.value.find(m => String(m.id) === String(selected.value)) || null);

async function showStage(number) {
  stage.value = number;
  await nextTick();
  stageHeading.value?.focus({ preventScroll: true });
}
function schedule() {
  clearTimeout(pollTimer);
  if (!gone && (enrollment.value || stage.value === 3)) pollTimer = setTimeout(refresh, 5000);
}
async function refresh() {
  if (loading.value || gone) return;
  loading.value = true;
  try {
    const answer = await machinesApi.list();
    if (gone) return;
    info.value = answer; error.value = '';
    emit('updated', answer);
    if (enrollment.value) {
      const arrived = (answer.machines || []).filter(m => m.state === 'online' && baseline.get(m.id) !== 'online');
      if (arrived.length) {
        detected.value = arrived.map(m => m.id); selected.value = arrived[0].id;
        enrollment.value = null; copied.value = false;
        said.value = 'An online machine is available. Confirm it below to continue.';
        await showStage(3);
      }
    }
  } catch (e) { if (!gone) error.value = e.message; }
  finally { loading.value = false; schedule(); }
}
async function generate() {
  if (generating.value || !mayConnect.value) return;
  if (enrollment.value && !expired.value) { await showStage(2); return; }
  generating.value = true; error.value = ''; copyError.value = ''; copied.value = false;
  try {
    // Establish the current machine list before creating a one-use join code.
    const current = await machinesApi.list();
    if (gone) return;
    info.value = current;
    if (!current.available || !current.may_manage) return;
    baseline = new Map((current.machines || []).map(m => [m.id, m.state]));
    const answer = await machinesApi.add();
    if (gone) return;
    enrollment.value = answer; now.value = Date.now(); detected.value = []; selected.value = '';
    said.value = 'Connection command ready. Run it on your machine.';
    await showStage(2);
  } catch (e) { if (!gone) error.value = e.message; }
  finally { generating.value = false; schedule(); }
}
async function copy() {
  if (!command.value) return;
  try {
    await navigator.clipboard.writeText(command.value);
    copied.value = true; copyError.value = ''; said.value = 'Connection command copied.';
    clearTimeout(copyTimer); copyTimer = setTimeout(() => { copied.value = false; }, 2000);
  } catch { copyError.value = 'Copying was blocked. Select the command and copy it manually.'; }
}
function finish() { if (machine.value && !loading.value && !error.value) emit('connected', machine.value); }
refresh();
onUnmounted(() => {
  gone = true; clearTimeout(pollTimer); clearTimeout(copyTimer); clearInterval(clock);
  enrollment.value = null; // A join command lives only in this open setup flow.
});
</script>

<template>
  <section class="machine-connection" :aria-busy="loading || generating">
    <p class="connection-sr" aria-live="polite">{{ said }}</p>
    <p class="connection-intro">Connect your hardware, then continue deploying your model. Your deployment settings stay in place.</p>
    <ol class="connection-progress" aria-label="Machine connection progress">
      <li v-for="(label, index) in ['Check requirements', 'Run command', 'Confirm connection']" :key="label" :class="{current:stage === index + 1, complete:stage > index + 1}" :aria-current="stage === index + 1 ? 'step' : undefined"><span><Check v-if="stage > index + 1" :size="13" aria-hidden="true"/><template v-else>{{ index + 1 }}</template></span><strong>{{ label }}</strong></li>
    </ol>
    <div v-if="error" class="connection-error" role="alert"><span>{{ error }}</span><UiButton :disabled="loading" @click="refresh">Check again</UiButton></div>
    <p v-if="!info && loading" class="connection-loading" role="status"><LoaderCircle :size="16" class="connection-spin" aria-hidden="true"/> Checking workspace access…</p>
    <p v-else-if="info && !info.available" class="connection-notice" role="status">{{ info.unavailable_note || 'Machine connection is not available in this workspace yet.' }}</p>
    <p v-else-if="info && !info.may_manage" class="connection-notice" role="status">A workspace Admin needs to connect the machine. Ask them to complete this setup, then refresh Edge Devices.</p>

    <template v-if="stage === 1">
      <h3 ref="stageHeading" tabindex="-1">Prepare your machine</h3>
      <p class="connection-lead">Use a Linux machine you control. You will run one Docker command in its terminal.</p>
      <div class="connection-requirements"><MachineNeeds :hosts="hosts.length ? hosts : null"/></div>
      <label class="connection-gpu"><input v-model="gpu" type="checkbox"><Cpu :size="17" aria-hidden="true"/><span><strong>This machine has an NVIDIA GPU</strong><small>Optional. Requires the NVIDIA driver and Container Toolkit.</small></span></label>
      <div class="connection-trust"><ShieldCheck :size="17" aria-hidden="true"/><p>The command gives AADML's machine agent access to Docker so it can manage job containers. Generate it only for a machine you are authorized to connect.</p></div>
      <div class="connection-actions"><UiButton :disabled="generating" @click="emit('cancel')">Cancel setup</UiButton><UiButton variant="primary" :disabled="!mayConnect || generating || loading" @click="generate"><LoaderCircle v-if="generating" :size="15" class="connection-spin" aria-hidden="true"/><Terminal v-else :size="15" aria-hidden="true"/>{{ generating ? 'Generating…' : enrollment && !expired ? 'Return to command' : 'Generate connection command' }}</UiButton></div>
    </template>

    <template v-else-if="stage === 2">
      <h3 ref="stageHeading" tabindex="-1">Run this on your machine</h3>
      <p class="connection-lead">Copy the command into a terminal on your Linux machine where Docker works. Keep this setup open while it connects.</p>
      <div v-if="command" class="connection-terminal"><div><span><Terminal :size="14" aria-hidden="true"/> Docker · {{ gpu ? 'NVIDIA GPU' : 'CPU' }}</span><button type="button" @click="copy"><Check v-if="copied" :size="14" aria-hidden="true"/><Copy v-else :size="14" aria-hidden="true"/>{{ copied ? 'Copied' : 'Copy command' }}</button></div><pre tabindex="0" aria-label="Machine connection command"><code>{{ command }}</code></pre></div>
      <div v-else class="connection-notice" role="status">{{ expired ? 'This connection command has expired. Generate a new one to continue.' : 'The connection command could not be displayed. Close setup and try again.' }}</div>
      <p v-if="enrollment" class="connection-expiry" :class="{expired}">{{ expiryLine(enrollment.expires_at, now) }} The command is kept only while setup is open.</p>
      <p v-if="copyError" class="connection-error" role="alert">{{ copyError }}</p>
      <div class="connection-wait"><LoaderCircle :size="19" class="connection-spin" aria-hidden="true"/><div><strong>Waiting for your machine</strong><p>It usually appears within a minute. Checking every 5 seconds.</p></div><UiButton :disabled="loading" @click="refresh"><RefreshCw :size="14" aria-hidden="true"/> Check now</UiButton></div>
      <details class="connection-help"><summary>What happens after I run the command?</summary><p>The agent exchanges the single-use code for a machine key kept in its Docker volume. It reports its hardware, keeps itself up to date, and receives jobs from AADML over outbound HTTPS. Jobs run in isolated containers with resource limits and no Docker socket access.</p></details>
      <div class="connection-actions"><UiButton :disabled="generating" @click="showStage(1)"><ArrowLeft :size="14" aria-hidden="true"/> Back</UiButton><UiButton v-if="expired" variant="primary" :disabled="!mayConnect || generating" @click="generate">{{ generating ? 'Generating…' : 'Generate new command' }}</UiButton><UiButton v-else disabled>Waiting for connection</UiButton></div>
    </template>

    <template v-else>
      <div class="connection-success-icon"><Check :size="25" aria-hidden="true"/></div>
      <h3 ref="stageHeading" tabindex="-1">Confirm your online machine</h3>
      <p class="connection-lead">An online machine is available in this workspace. Confirm the machine you want to use, then return to deployment.</p>
      <label v-if="online.length > 1" class="connection-select">Machine<select v-model="selected"><option v-for="m in online" :key="m.id" :value="m.id">{{ m.name }}</option></select></label>
      <div v-if="machine" class="connection-machine"><Server :size="22" aria-hidden="true"/><div><strong>{{ machine.name }}</strong><p>{{ capabilityLine(machine.capabilities) }}</p></div><span>Online</span></div>
      <p v-else class="connection-notice" role="status">The detected machine is no longer online. Check its connection before continuing.</p>
      <p class="connection-note">The next step uses your existing model, environment, and port settings. Only machines allowed to run the selected project can be selected for deployment.</p>
      <div class="connection-actions"><UiButton @click="emit('cancel')">Close setup</UiButton><UiButton variant="primary" :disabled="!machine || loading || !!error" @click="finish">{{ continueLabel }} <ArrowRight :size="15" aria-hidden="true"/></UiButton></div>
    </template>
  </section>
</template>

<style scoped>
.machine-connection{color:#24344c;min-width:0}.connection-intro{font-size:12px;color:#758298;margin:0 0 20px;line-height:1.7}.connection-progress{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));list-style:none;gap:12px;background:#f3f6fa;border:1px solid #e6ebf2;border-radius:10px;padding:14px;margin:0 0 24px}.connection-progress li{display:flex;align-items:center;gap:8px;min-width:0}.connection-progress li>span{display:grid;place-items:center;flex-shrink:0;width:26px;height:26px;border:1px solid #d9e1ec;border-radius:50%;background:white;font-size:11px;color:#8190a6}.connection-progress strong{font-size:11px;font-weight:550;line-height:1.5;color:#758298}.connection-progress .current>span{color:white;background:var(--aadml-primary);border-color:var(--aadml-primary)}.connection-progress .current strong{color:#34445c}.connection-progress .complete>span{background:#e6f5ed;color:#287652;border-color:#d0e9dc}.machine-connection h3{font-size:16px;letter-spacing:-.2px;margin:0 0 8px}.machine-connection h3:focus{outline:none}.machine-connection h3:focus-visible{outline:2px solid var(--aadml-outline);outline-offset:4px}.connection-lead{font-size:12px;color:#718097;line-height:1.75;margin:0 0 18px}.connection-requirements{padding:18px;border:1px solid #e3e8ef;border-radius:10px}.connection-gpu{display:flex;align-items:center;gap:10px;margin:16px 0;padding:13px 14px;border:1px solid #e3e8ef;border-radius:9px;cursor:pointer}.connection-gpu input{width:17px;height:17px;accent-color:var(--aadml-primary);flex-shrink:0}.connection-gpu svg{color:#8192ac}.connection-gpu strong{display:block;font-size:12px;font-weight:550}.connection-gpu small{display:block;font-size:11px;color:#8190a6;line-height:1.6;margin-top:3px}.connection-trust{display:flex;align-items:flex-start;gap:9px;padding:12px 14px;background:#f5f8fc;border:1px solid #e7edf5;border-radius:8px;color:#8091aa}.connection-trust p{font-size:11px;color:#718097;line-height:1.7;margin:0}.connection-trust svg{margin-top:2px}.connection-actions{display:flex;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:10px;border-top:1px solid #edf0f5;padding-top:18px;margin-top:24px}.connection-actions :deep(.button){min-height:42px}.connection-actions :deep(.button:first-child){margin-right:auto}.connection-error{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;padding:12px 14px;margin-bottom:16px;color:#a43e30;background:#fff5f4;border:1px solid #f0d4ce;border-radius:8px;overflow-wrap:anywhere}.connection-notice{font-size:12px;padding:14px;margin-bottom:16px;border:1px solid #efdfb8;background:#fff9ed;border-radius:9px;color:#82612a;line-height:1.7}.connection-loading{display:flex;align-items:center;gap:8px;font-size:12px;color:#718097;margin-bottom:18px}.connection-terminal{background:#172338;border:1px solid #24344d;border-radius:11px;overflow:hidden}.connection-terminal>div{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid #2b3b54}.connection-terminal>div>span{display:flex;align-items:center;gap:7px;color:#aebed5;font-size:11px}.connection-terminal button{display:flex;align-items:center;gap:6px;padding:8px 10px;min-height:36px;border:1px solid #43536d;background:#293b56;border-radius:6px;color:#e5edf8;font-size:11px;cursor:pointer}.connection-terminal pre{padding:18px;margin:0;color:#d9e5f6;font-size:12px;line-height:1.85;white-space:pre-wrap;overflow-wrap:anywhere}.connection-expiry{font-size:11px;color:#6b7c94;line-height:1.7;margin:11px 0 20px}.connection-expiry.expired{color:#9b5c24}.connection-wait{display:flex;align-items:center;gap:12px;padding:16px;border:1px solid #dbe6f6;border-radius:10px;background:#f5f9ff;color:var(--aadml-primary)}.connection-wait>div{flex:1}.connection-wait strong{font-size:12px;font-weight:600;color:#34445c}.connection-wait p{font-size:11px;color:#758298;margin:4px 0 0;line-height:1.7}.connection-help{margin-top:16px}.connection-help summary{font-size:12px;color:#5f7290;cursor:pointer;min-height:36px;align-content:center}.connection-help p{font-size:11px;color:#7b889e;line-height:1.85;margin-top:8px}.connection-success-icon{display:grid;place-items:center;width:52px;height:52px;border:1px solid #d4ebde;background:#ecf8f0;border-radius:15px;color:#278052;margin-bottom:18px}.connection-machine{display:flex;align-items:center;gap:12px;padding:18px;border:1px solid #d4e9dc;border-radius:11px;background:#f8fcfa;color:#668377}.connection-machine>div{flex:1;min-width:0}.connection-machine strong{color:#34445c;font-size:13px;overflow-wrap:anywhere}.connection-machine p{font-size:11px;color:#7a8c83;line-height:1.7;margin:5px 0 0;overflow-wrap:anywhere}.connection-machine>span{font-size:10px;color:#287652;background:#e7f4ec;border-radius:5px;padding:5px 8px}.connection-note{font-size:12px;color:#7b889e;line-height:1.8;margin:16px 0 0}.connection-select{font-size:12px;display:grid;gap:8px;margin:16px 0}.connection-select select{padding:10px;border:1px solid #dbe2ec;border-radius:8px;background:white}.connection-spin{animation:connection-spin 1s linear infinite}.connection-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}@keyframes connection-spin{to{transform:rotate(360deg)}}
@media(max-width:640px){.connection-progress{padding:12px;gap:10px}.connection-progress li{flex-direction:column;align-items:flex-start;gap:6px}.connection-progress strong{font-size:10px}.connection-wait{flex-wrap:wrap}.connection-wait>div{min-width:180px}.connection-wait :deep(.button){width:100%;min-height:42px}.connection-actions :deep(.button){flex:1;white-space:normal}.connection-requirements{padding:15px}.connection-terminal pre{padding:14px;font-size:11px}.connection-error{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.connection-spin{animation:none}}
</style>
