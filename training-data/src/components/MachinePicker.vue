<script setup>
// Where a model runs or trains (backend: training_models_data/placement.py; agentic-docs/MACHINE_CHOICE_PLAN.md).
// Auto (the default): at Start the machines free now are read again and the cheapest that can run the model in the
// location its files are already in is shown (owner, 2026-11-09: a new location needs a new volume, which RunPod
// refuses below a $5 balance; another location is chosen by hand) to the person, who approves it or cancels (owner,
// 2026-11-06); nothing starts without that approval, and nothing is
// ever swapped for another machine on its own. Or the person chooses GPU, CPU or Your machine in the first dropdown (a
// kind the model cannot use is shown with the reason, not choosable) and one machine of that kind in the second. The server reads every choice again
// before anything starts. A page calls ``confirm(start)`` instead of ``start()``.
import { computed, onMounted, ref, watch } from 'vue';
import { HardDrive, MapPin, RefreshCw, ShieldCheck } from 'lucide-vue-next';
import UiButton from './UiButton.vue';

const props = defineProps({
  load: { type: Function, required: true },          // () => Promise<{ machines, note, gpu_only }>
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  legend: { type: String, default: 'Where it runs' },
  // A page whose model runs where AADML always runs it unless the person picks one of their machines (a chat test
  // server, a chat deployment; agentic-docs/MACHINE_RUNPOD_PARITY_PLAN.md): { title, small, text, value } replaces Auto.
  // Choosing it sends ``value`` (a page that must tell "AADML's" from "nothing chosen" names one, e.g. 'aadml'; else '')
  // and starts at once (there is nothing to find), and GPU / CPU are shown only when the list has some.
  aadml: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue']);
const machines = ref(null); const note = ref(''); const gpuOnly = ref(''); const error = ref(''); const loading = ref(false);
const kind = ref('auto');
const aadmlValue = () => props.aadml?.value || '';
const pending = ref(null);              // Auto's find, waiting for the person's approval: { machine, run }
const said = ref('');
const uid = Math.random().toString(36).slice(2, 9);
const NONE_HERE = 'No machine that can run this model is free now where its files are. Choose GPU or CPU and pick one in another location, or try again in a few minutes. Nothing was started.';

const ofKind = computed(() => (kind.value === 'auto' ? (machines.value || [])
  : (machines.value || []).filter(m => (m.kind || 'gpu') === kind.value)));
// "Your machine" (agentic-docs/MACHINE_RUNPOD_PARITY_PLAN.md): the workspace's own machines the server lists for this
// model (kind 'own_machine'), each charged the platform fee it names (``price_text``, owner 2026-11-11: $0.10 an hour,
// by the second). One that cannot take this model (offline, too little GPU memory, limited to other projects) is
// listed with the reason and cannot be chosen; it is never hidden without a word.
const counts = computed(() => ({
  gpu: (machines.value || []).filter(m => (m.kind || 'gpu') === 'gpu').length,
  cpu: (machines.value || []).filter(m => m.kind === 'cpu').length,
  own_machine: (machines.value || []).filter(m => m.kind === 'own_machine').length,
}));
const chosen = computed(() => (machines.value || []).find(m => m.key === props.modelValue) || null);
const fits = m => m.kind !== 'own_machine' || m.fits !== false;
const ownPrice = computed(() => (machines.value || []).find(m => m.kind === 'own_machine')?.price_text || '');
// Auto's find: the cheapest machine where the files already are (the list comes that location first, cheapest first).
const autoFind = () => (machines.value || []).find(m => m.files_here) || null;

async function read() {
  loading.value = true; error.value = '';
  try {
    const found = await props.load();
    machines.value = found.machines || []; note.value = found.note || ''; gpuOnly.value = found.gpu_only || '';
    const still = kind.value !== 'auto' && machines.value.find(m => m.key === props.modelValue);
    const first = (still && fits(still) ? still : null)
      || (kind.value === 'auto' ? (props.aadml ? null : autoFind()) : machines.value.find(fits));
    if (kind.value !== 'auto') kind.value = first?.kind || 'gpu';
    emit('update:modelValue', first?.key || (kind.value === 'auto' && props.aadml ? aadmlValue() : ''));
    // Auto with nothing where the files are: Start stays off, and the reason is said (aadml.com, 2026-11-09: it was
    // only greyed out).
    said.value = kind.value === 'auto' && !first && machines.value.length && !props.aadml ? NONE_HERE : '';
  } catch (e) { error.value = e.message; machines.value = machines.value || []; }
  finally { loading.value = false; }
}
onMounted(read);
watch(() => props.load, read);
// Switching GPU / CPU chooses the cheapest of that kind (the list comes cheapest first, the files' location first).
function pickKind(next) {
  // A kind with no machine that can take this model is listed but never chosen (the dropdown disables it too).
  if (next === kind.value || (next !== 'auto' && !usable(next))) return;
  kind.value = next; pending.value = null;
  const first = next === 'auto' ? (props.aadml ? null : autoFind()) : ofKind.value.find(fits);
  said.value = next === 'auto' && props.aadml ? ''
    : next === 'auto' && !first && (machines.value || []).length ? NONE_HERE
    : next === 'own_machine' && !first ? (ofKind.value[0]?.why_not || 'None of your machines can take this now.') : '';
  emit('update:modelValue', first?.key || (next === 'auto' && props.aadml ? aadmlValue() : ''));
}
// What the page's Start does: a machine the person chose starts at once; Auto first reads what is free now, takes the
// cheapest that can run the model where its files are and asks the person to approve it.
async function confirm(run) {
  said.value = '';
  if (kind.value !== 'auto' || props.aadml) return run();
  await read();
  const found = autoFind();
  if (!found) {
    said.value = (machines.value || []).length ? NONE_HERE
      : 'Auto found no machine that can run this model free now. Nothing was started.';
    return undefined;
  }
  emit('update:modelValue', found.key);
  pending.value = { machine: found, run };
  return undefined;
}
function approve() { const go = pending.value; pending.value = null; if (go) go.run(); }
function cancel() { pending.value = null; said.value = 'Nothing was started, and nothing was charged.'; }
const describe = m => `${m.gpu_name} (${m.kind === 'cpu' ? 'CPU' : 'GPU'}, ${m.memory_gb} GB) in ${m.data_center}, ${m.soc2 ? 'SOC 2' : 'not SOC 2'}, ${money(m.usd_per_hour)} an hour ($${Number(m.usd_per_second).toFixed(6)} a second), ${m.files_here ? 'its files are already there' : 'its files are copied there first'}`;

function money(value) { return `$${Number(value).toFixed(2)}`; }
const optionText = m => (m.kind === 'own_machine'
  ? `${m.name}, ${m.gpu_name || 'CPU'}${m.memory_gb ? `, ${m.memory_gb} GB` : ''}${fits(m) ? '' : `: ${m.why_not}`}`
  : `${m.gpu_name}, ${m.memory_gb} GB, ${m.data_center}${m.soc2 ? ' (SOC 2)' : ' (not SOC 2)'}, ${money(m.usd_per_hour)} an hour`);
const own = computed(() => chosen.value?.kind === 'own_machine');
const byKind = k => (machines.value || []).filter(m => (m.kind || 'gpu') === k);
// The first dropdown (owner, 2026-11-11: "drop down auto, gpu, cpu, your machine option to choose"): what kind of machine.
// Every kind is always listed; one this model cannot use now is listed with the reason and cannot be chosen (owner: "if
// model can run only gpu but can't on cpu or even machine connected resource gpu is not enough we show but disabled").
// The second dropdown lists the machines of the kind chosen, each that cannot take the model again with its reason.
const usable = k => byKind(k).filter(fits).length;
const kinds = computed(() => {
  const none = props.aadml ? `not chosen here: ${props.aadml.title} runs it` : 'none free now';
  const firstWhy = byKind('own_machine').find(m => !fits(m))?.why_not || '';
  return [
    { value: 'auto', text: props.aadml ? `${props.aadml.title} (${props.aadml.small})` : 'Auto: the cheapest free now, you approve it' },
    counts.value.gpu ? { value: 'gpu', text: `GPU, ${counts.value.gpu} free` } : { value: 'gpu', text: `GPU: ${none}`, off: true },
    counts.value.cpu ? { value: 'cpu', text: `CPU, ${counts.value.cpu} free` }
      : { value: 'cpu', text: `CPU: ${gpuOnly.value ? 'this model needs a GPU' : none}`, off: true },
    usable('own_machine') ? { value: 'own_machine', text: `Your machine, ${ownPrice.value}` }
      : { value: 'own_machine', off: true,
          text: `Your machine: ${counts.value.own_machine ? firstWhy || 'none of yours can take this now' : 'none connected for this model'}` },
  ];
});
const KIND_LABEL = { gpu: 'GPU', cpu: 'CPU', own_machine: 'Your machine' };
function choose(value) {
  const m = (machines.value || []).find(x => x.key === value);
  if (!m || !fits(m)) return;
  kind.value = m.kind || 'gpu'; pending.value = null; said.value = '';
  emit('update:modelValue', m.key);
}
defineExpose({ read, confirm });
</script>

<template>
  <fieldset class="machine-picker" :disabled="disabled">
    <legend>{{ legend }}</legend>
    <p v-if="loading && !machines" class="muted">Reading which machines are free now…</p>
    <div v-else-if="error" class="machine-picker-state" role="alert">
      <span class="field-error">{{ error }}</span>
      <UiButton :disabled="loading" @click="read"><RefreshCw :size="14" aria-hidden="true"/> Read again</UiButton>
    </div>
    <div v-else-if="machines && !machines.length && !aadml" class="machine-picker-state">
      <span>No machine that can hold this model is free now.</span>
      <UiButton :disabled="loading" @click="read"><RefreshCw :size="14" aria-hidden="true"/> Read again</UiButton>
    </div>
    <template v-else-if="machines">
      <!-- Two dropdowns (owner, 2026-11-11): the kind first (Auto or AADML's own server, GPU, CPU, Your machine), then
           the machines of that kind with their prices. A kind or a machine this model cannot use is listed with the
           reason and cannot be chosen. -->
      <label class="sr-only" :for="`machine-kind-${uid}`">{{ legend }}</label>
      <select :id="`machine-kind-${uid}`" class="compact-select machine-kind" :value="kind"
              @change="pickKind($event.target.value)">
        <option v-for="k in kinds" :key="k.value" :value="k.value" :disabled="k.off">{{ k.text }}</option>
      </select>
      <template v-if="kind !== 'auto'">
        <label class="machine-select-label" :for="`machine-${uid}`">{{ KIND_LABEL[kind] }}</label>
        <select :id="`machine-${uid}`" class="compact-select machine-select" :value="modelValue"
                @change="choose($event.target.value)">
          <option v-for="m in byKind(kind)" :key="m.key" :value="m.key" :disabled="!fits(m)">{{ optionText(m) }}</option>
        </select>
      </template>
      <p v-if="gpuOnly && !counts.cpu" class="machine-gpu-only" role="note">{{ gpuOnly }}</p>
      <p v-if="kind === 'auto' && aadml" class="machine-auto">{{ aadml.text }}</p>
      <p v-else-if="kind === 'auto'" class="machine-auto">At Start, the cheapest machine free now that can run this model, where its files already are, is found and shown to you; it starts only when you approve it.</p>

      <div v-if="pending" class="machine-found" role="alertdialog" aria-labelledby="found-title" aria-describedby="found-text">
        <strong id="found-title">Auto found a machine</strong>
        <p id="found-text">{{ describe(pending.machine) }}. Use it?</p>
        <div class="machine-found-actions">
          <UiButton variant="primary" @click="approve">Use this machine</UiButton>
          <UiButton @click="cancel">Cancel</UiButton>
        </div>
      </div>
      <p v-if="said" class="machine-said" role="status">{{ said }}</p>

      <p v-if="chosen && own" class="machine-chosen">
        <span><HardDrive :size="14" aria-hidden="true"/>{{ chosen.stock_text || 'Online' }}</span>
        <span>{{ chosen.gpu_name || 'CPU only' }}<template v-if="chosen.memory_gb">, {{ chosen.memory_gb }} GB</template></span>
        <strong>{{ chosen.price_text }}, charged by the second</strong>
        <span>What it needs goes to this machine. If the machine is offline it says so; nothing moves to RunPod.</span>
      </p>
      <p v-else-if="chosen && kind !== 'auto'" class="machine-chosen">
        <span><MapPin :size="14" aria-hidden="true"/>{{ chosen.data_center }}</span>
        <span v-if="chosen.soc2" class="machine-soc2"><ShieldCheck :size="14" aria-hidden="true"/>SOC 2</span>
        <span v-else>not SOC 2</span>
        <span>{{ chosen.stock_text }}</span>
        <span>{{ chosen.files_here ? 'its files are here' : 'copies its files first (a few minutes)' }}</span>
        <strong>{{ money(chosen.usd_per_hour) }} an hour, ${{ Number(chosen.usd_per_second).toFixed(6) }} a second</strong>
      </p>
      <p class="machine-note muted">{{ note }}
        <button type="button" class="link-button" :disabled="loading" @click="read">Read again</button></p>
    </template>
  </fieldset>
</template>

<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.machine-picker { border: 0; padding: 0; margin: 0 0 14px; min-width: 0; }
.machine-picker legend { font-weight: 600; margin-bottom: 8px; color: var(--aadml-navy); }
.machine-auto { margin: 0; font-size: 14px; color: var(--muted); }
.machine-found { margin: 10px 0 0; padding: 12px 14px; border: 1px solid var(--aadml-primary); border-radius: 12px;
  background: var(--aadml-tint); }
.machine-found p { margin: 6px 0 10px; }
.machine-found-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.machine-said { margin: 8px 0 0; font-size: 14px; }
.machine-select-label { display: block; font-weight: 600; font-size: 14px; margin: 12px 0 6px; color: var(--aadml-navy); }
.machine-kind, .machine-select { width: 100%; min-height: 44px; }
.machine-kind { margin-bottom: 8px; }
.machine-chosen { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin: 8px 0 0; font-size: 14px; }
.machine-chosen span { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); }
.machine-chosen .machine-soc2 { color: var(--aadml-teal); }
.machine-chosen strong { color: var(--aadml-navy); }
.machine-gpu-only { margin: 0 0 8px; font-size: 14px; color: var(--aadml-navy); }
.machine-note { font-size: 13px; margin: 8px 0 0; }
.machine-picker-state { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.link-button { background: none; border: 0; padding: 0 0 0 4px; color: var(--aadml-primary); cursor: pointer; font: inherit; }
.link-button:focus-visible { outline: 2px solid var(--aadml-focus); }
</style>
