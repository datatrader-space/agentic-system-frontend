<script setup>
// Where a model runs or trains (backend: training_models_data/placement.py; agentic-docs/MACHINE_CHOICE_PLAN.md).
// Auto (the default): at Start the machines free now are read again and the cheapest that can run the model in the
// location its files are already in is shown (owner, 2026-11-09: a new location needs a new volume, which RunPod
// refuses below a $5 balance; another location is chosen by hand) to the person, who approves it or cancels (owner,
// 2026-11-06); nothing starts without that approval, and nothing is
// ever swapped for another machine on its own. Or the person chooses GPU or CPU (a CPU only for a small model;
// otherwise the reason it runs on a GPU only) and one machine from the list. The server reads every choice again
// before anything starts. A page calls ``confirm(start)`` instead of ``start()``.
import { computed, onMounted, ref, watch } from 'vue';
import { Cpu, MapPin, RefreshCw, ShieldCheck, Sparkles, Zap } from 'lucide-vue-next';
import UiButton from './UiButton.vue';

const props = defineProps({
  load: { type: Function, required: true },          // () => Promise<{ machines, note, gpu_only }>
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  legend: { type: String, default: 'Where it runs' },
});
const emit = defineEmits(['update:modelValue']);
const machines = ref(null); const note = ref(''); const gpuOnly = ref(''); const error = ref(''); const loading = ref(false);
const kind = ref('auto');
const pending = ref(null);              // Auto's find, waiting for the person's approval: { machine, run }
const said = ref('');
const uid = Math.random().toString(36).slice(2, 9);

const ofKind = computed(() => (kind.value === 'auto' ? (machines.value || [])
  : (machines.value || []).filter(m => (m.kind || 'gpu') === kind.value)));
const counts = computed(() => ({
  gpu: (machines.value || []).filter(m => (m.kind || 'gpu') === 'gpu').length,
  cpu: (machines.value || []).filter(m => m.kind === 'cpu').length,
}));
const chosen = computed(() => (machines.value || []).find(m => m.key === props.modelValue) || null);
// Auto's find: the cheapest machine where the files already are (the list comes that location first, cheapest first).
const autoFind = () => (machines.value || []).find(m => m.files_here) || null;

async function read() {
  loading.value = true; error.value = '';
  try {
    const found = await props.load();
    machines.value = found.machines || []; note.value = found.note || ''; gpuOnly.value = found.gpu_only || '';
    const still = kind.value !== 'auto' && machines.value.find(m => m.key === props.modelValue);
    const first = still || (kind.value === 'auto' ? autoFind() : machines.value[0]);
    if (kind.value !== 'auto') kind.value = first?.kind || 'gpu';
    emit('update:modelValue', first?.key || '');
  } catch (e) { error.value = e.message; machines.value = machines.value || []; }
  finally { loading.value = false; }
}
onMounted(read);
watch(() => props.load, read);
// Switching GPU / CPU chooses the cheapest of that kind (the list comes cheapest first, the files' location first).
function pickKind(next) {
  if (next === kind.value || (next !== 'auto' && !counts.value[next])) return;
  kind.value = next; pending.value = null; said.value = '';
  emit('update:modelValue', (next === 'auto' ? autoFind() : ofKind.value[0])?.key || '');
}
// What the page's Start does: a machine the person chose starts at once; Auto first reads what is free now, takes the
// cheapest that can run the model where its files are and asks the person to approve it.
async function confirm(run) {
  said.value = '';
  if (kind.value !== 'auto') return run();
  await read();
  const found = autoFind();
  if (!found) {
    said.value = (machines.value || []).length
      ? 'No machine that can run this model is free now where its files are. Choose GPU or CPU and pick one in another location, or try again in a few minutes. Nothing was started.'
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
const optionText = m => `${m.gpu_name}, ${m.memory_gb} GB, ${m.data_center}${m.soc2 ? ' (SOC 2)' : ' (not SOC 2)'}, ${money(m.usd_per_hour)} an hour`;
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
    <div v-else-if="machines && !machines.length" class="machine-picker-state">
      <span>No machine that can hold this model is free now.</span>
      <UiButton :disabled="loading" @click="read"><RefreshCw :size="14" aria-hidden="true"/> Read again</UiButton>
    </div>
    <template v-else-if="machines">
      <div class="machine-kinds" role="radiogroup" aria-label="Auto, GPU or CPU">
        <label :class="['machine-kind', { chosen: kind === 'auto' }]">
          <input type="radio" :name="`kind-${uid}`" value="auto" :checked="kind === 'auto'" @change="pickKind('auto')">
          <Sparkles :size="15" aria-hidden="true"/><span><strong>Auto</strong><small>you approve it</small></span>
        </label>
        <label :class="['machine-kind', { chosen: kind === 'gpu', off: !counts.gpu }]">
          <input type="radio" :name="`kind-${uid}`" value="gpu" :checked="kind === 'gpu'" :disabled="!counts.gpu" @change="pickKind('gpu')">
          <Zap :size="15" aria-hidden="true"/><span><strong>GPU</strong><small>{{ counts.gpu }} free</small></span>
        </label>
        <label :class="['machine-kind', { chosen: kind === 'cpu', off: !counts.cpu }]" :title="gpuOnly">
          <input type="radio" :name="`kind-${uid}`" value="cpu" :checked="kind === 'cpu'" :disabled="!counts.cpu" @change="pickKind('cpu')">
          <Cpu :size="15" aria-hidden="true"/><span><strong>CPU</strong><small>{{ counts.cpu ? `${counts.cpu} free` : 'not for this model' }}</small></span>
        </label>
      </div>
      <p v-if="gpuOnly" class="machine-gpu-only" role="note">{{ gpuOnly }}</p>

      <p v-if="kind === 'auto'" class="machine-auto">At Start, the cheapest machine free now that can run this model, where its files already are, is found and shown to you; it starts only when you approve it.</p>
      <template v-else>
        <label class="machine-select-label" :for="`machine-${uid}`">{{ kind === 'cpu' ? 'CPU machine' : 'GPU machine' }}</label>
        <select :id="`machine-${uid}`" class="compact-select machine-select" :value="modelValue"
                @change="emit('update:modelValue', $event.target.value)">
          <option v-for="m in ofKind" :key="m.key" :value="m.key">{{ optionText(m) }}</option>
        </select>
      </template>

      <div v-if="pending" class="machine-found" role="alertdialog" aria-labelledby="found-title" aria-describedby="found-text">
        <strong id="found-title">Auto found a machine</strong>
        <p id="found-text">{{ describe(pending.machine) }}. Use it?</p>
        <div class="machine-found-actions">
          <UiButton variant="primary" @click="approve">Use this machine</UiButton>
          <UiButton @click="cancel">Cancel</UiButton>
        </div>
      </div>
      <p v-if="said" class="machine-said" role="status">{{ said }}</p>

      <p v-if="chosen && kind !== 'auto'" class="machine-chosen">
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
.machine-picker { border: 0; padding: 0; margin: 0 0 14px; min-width: 0; }
.machine-picker legend { font-weight: 600; margin-bottom: 8px; color: var(--aadml-navy); }
.machine-kinds { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
.machine-auto { margin: 0; font-size: 14px; color: var(--muted); }
.machine-found { margin: 10px 0 0; padding: 12px 14px; border: 1px solid var(--aadml-primary); border-radius: 12px;
  background: var(--aadml-tint); }
.machine-found p { margin: 6px 0 10px; }
.machine-found-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.machine-said { margin: 8px 0 0; font-size: 14px; }
@media (max-width: 480px) { .machine-kinds { grid-template-columns: 1fr; } }
.machine-kind { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid var(--border);
  border-radius: 12px; background: var(--surface); cursor: pointer; transition: border-color .15s, background-color .15s; }
.machine-kind span { display: grid; }
.machine-kind small { color: var(--muted); font-size: 13px; }
.machine-kind.chosen { border-color: var(--aadml-primary); background: var(--aadml-tint); }
.machine-kind.off { cursor: not-allowed; opacity: .6; }
.machine-kind:focus-within { outline: 2px solid var(--aadml-focus); outline-offset: 2px; }
.machine-kind input { accent-color: var(--aadml-primary); margin: 0; }
.machine-select-label { display: block; font-weight: 600; font-size: 14px; margin: 4px 0 6px; color: var(--aadml-navy); }
.machine-select { width: 100%; min-height: 44px; }
.machine-chosen { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin: 8px 0 0; font-size: 14px; }
.machine-chosen span { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); }
.machine-chosen .machine-soc2 { color: var(--aadml-teal); }
.machine-chosen strong { color: var(--aadml-navy); }
.machine-gpu-only { margin: 0 0 8px; font-size: 14px; color: var(--aadml-navy); }
.machine-note { font-size: 13px; margin: 8px 0 0; }
.machine-picker-state { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.link-button { background: none; border: 0; padding: 0 0 0 4px; color: var(--aadml-primary); cursor: pointer; font: inherit; }
.link-button:focus-visible { outline: 2px solid var(--aadml-focus); }
@media (prefers-reduced-motion: reduce) { .machine-kind { transition: none; } }
</style>
