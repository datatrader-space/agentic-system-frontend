<script setup>
// Where a model runs or trains: GPU or CPU first (a CPU only for a small model; otherwise the reason it runs on a GPU
// only), then one machine from a list of those free now, with its location and price as the person is charged
// (backend: training_models_data/placement.py; agentic-docs/MACHINE_CHOICE_PLAN.md). The cheapest is chosen until the
// person picks another; the server reads the choice again before anything starts.
import { computed, onMounted, ref, watch } from 'vue';
import { Cpu, MapPin, RefreshCw, ShieldCheck, Zap } from 'lucide-vue-next';
import UiButton from './UiButton.vue';

const props = defineProps({
  load: { type: Function, required: true },          // () => Promise<{ machines, note, gpu_only }>
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  legend: { type: String, default: 'Where it runs' },
});
const emit = defineEmits(['update:modelValue']);
const machines = ref(null); const note = ref(''); const gpuOnly = ref(''); const error = ref(''); const loading = ref(false);
const kind = ref('gpu');
const uid = Math.random().toString(36).slice(2, 9);

const ofKind = computed(() => (machines.value || []).filter(m => (m.kind || 'gpu') === kind.value));
const counts = computed(() => ({
  gpu: (machines.value || []).filter(m => (m.kind || 'gpu') === 'gpu').length,
  cpu: (machines.value || []).filter(m => m.kind === 'cpu').length,
}));
const chosen = computed(() => (machines.value || []).find(m => m.key === props.modelValue) || null);

async function read() {
  loading.value = true; error.value = '';
  try {
    const found = await props.load();
    machines.value = found.machines || []; note.value = found.note || ''; gpuOnly.value = found.gpu_only || '';
    const still = machines.value.find(m => m.key === props.modelValue);
    const first = still || machines.value[0];
    kind.value = first?.kind || 'gpu';
    if (!still) emit('update:modelValue', first?.key || '');
  } catch (e) { error.value = e.message; machines.value = machines.value || []; }
  finally { loading.value = false; }
}
onMounted(read);
watch(() => props.load, read);
// Switching GPU / CPU chooses the cheapest of that kind (the list comes cheapest first, the files' location first).
function pickKind(next) {
  if (next === kind.value || !counts.value[next]) return;
  kind.value = next;
  emit('update:modelValue', ofKind.value[0]?.key || '');
}

const money = value => `$${Number(value).toFixed(2)}`;
const optionText = m => `${m.gpu_name}, ${m.memory_gb} GB, ${m.data_center}${m.soc2 ? ' (SOC 2)' : ' (not SOC 2)'}, ${money(m.usd_per_hour)} an hour`;
defineExpose({ read });
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
      <div class="machine-kinds" role="radiogroup" aria-label="GPU or CPU">
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

      <label class="machine-select-label" :for="`machine-${uid}`">{{ kind === 'cpu' ? 'CPU machine' : 'GPU machine' }}</label>
      <select :id="`machine-${uid}`" class="compact-select machine-select" :value="modelValue"
              @change="emit('update:modelValue', $event.target.value)">
        <option v-for="m in ofKind" :key="m.key" :value="m.key">{{ optionText(m) }}</option>
      </select>

      <p v-if="chosen" class="machine-chosen">
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
.machine-kinds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
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
