<script setup>
// Where a model runs or trains: the GPUs (and CPUs, for a small model) and locations that can hold it and are free now, as the person is
// charged (backend: training_models_data/placement.py; agentic-docs/MACHINE_CHOICE_PLAN.md). The first one is chosen
// until the person picks another; the server reads the choice again before anything starts.
import { onMounted, ref, watch } from 'vue';
import { Cpu, MapPin, RefreshCw, ShieldCheck, Zap } from 'lucide-vue-next';
import UiBadge from './UiBadge.vue';
import UiButton from './UiButton.vue';

const props = defineProps({
  load: { type: Function, required: true },          // () => Promise<{ machines, note }>
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  legend: { type: String, default: 'Where it runs' },
});
const emit = defineEmits(['update:modelValue']);
const machines = ref(null); const note = ref(''); const gpuOnly = ref(''); const error = ref(''); const loading = ref(false);
const name = `machine-${Math.random().toString(36).slice(2, 9)}`;

async function read() {
  loading.value = true; error.value = '';
  try {
    const found = await props.load();
    machines.value = found.machines || []; note.value = found.note || ''; gpuOnly.value = found.gpu_only || '';
    const still = machines.value.some(m => m.key === props.modelValue);
    if (!still) emit('update:modelValue', machines.value[0]?.key || '');
  } catch (e) { error.value = e.message; machines.value = machines.value || []; }
  finally { loading.value = false; }
}
onMounted(read);
watch(() => props.load, read);

const tone = stock => (stock === 'HIGH' ? 'green' : 'neutral');
const perSecond = m => `$${Number(m.usd_per_second).toFixed(6)} a second`;
defineExpose({ read });
</script>

<template>
  <fieldset class="machine-picker" :disabled="disabled">
    <legend>{{ legend }}</legend>
    <p v-if="loading && !machines" class="muted">Reading which machines are free now…</p>
    <p v-if="gpuOnly" class="machine-gpu-only" role="note"><Zap :size="14" aria-hidden="true"/>{{ gpuOnly }}</p>
    <div v-else-if="error" class="machine-picker-state" role="alert">
      <span class="field-error">{{ error }}</span>
      <UiButton :disabled="loading" @click="read"><RefreshCw :size="14" aria-hidden="true"/> Read again</UiButton>
    </div>
    <div v-else-if="machines && !machines.length" class="machine-picker-state">
      <span>No machine that can hold this model is free now.</span>
      <UiButton :disabled="loading" @click="read"><RefreshCw :size="14" aria-hidden="true"/> Read again</UiButton>
    </div>
    <template v-else-if="machines">
      <div class="machine-list" role="radiogroup" :aria-label="legend">
        <label v-for="m in machines" :key="m.key" :class="['machine-row', { chosen: m.key === modelValue }]">
          <input type="radio" :name="name" :value="m.key" :checked="m.key === modelValue"
                 @change="emit('update:modelValue', m.key)">
          <span class="machine-gpu"><Cpu v-if="m.kind==='cpu'" :size="16" aria-hidden="true"/><Zap v-else :size="16" aria-hidden="true"/>
            <strong>{{ m.gpu_name }}</strong>
            <span class="muted">{{ m.kind==='cpu' ? 'CPU' : 'GPU' }}, {{ m.memory_gb }} GB</span></span>
          <span class="machine-where"><MapPin :size="14" aria-hidden="true"/>{{ m.data_center }}
            <span v-if="m.soc2" class="machine-soc2"><ShieldCheck :size="13" aria-hidden="true"/>SOC 2</span>
            <span v-else class="muted">not SOC 2</span>
            <span class="muted">{{ m.files_here ? 'its files are here' : 'copies its files first' }}</span></span>
          <UiBadge :tone="tone(m.stock)">{{ m.stock_text }}</UiBadge>
          <span class="machine-price"><strong>${{ m.usd_per_hour }} an hour</strong><span class="muted">{{ perSecond(m) }}</span></span>
        </label>
      </div>
      <p class="machine-note muted">{{ note }}
        <button type="button" class="link-button" :disabled="loading" @click="read">Read again</button></p>
    </template>
  </fieldset>
</template>

<style scoped>
.machine-picker { border: 0; padding: 0; margin: 0 0 14px; min-width: 0; }
.machine-picker legend { font-weight: 600; margin-bottom: 8px; color: var(--aadml-navy); }
.machine-list { display: grid; gap: 8px; }
.machine-row { display: grid; grid-template-columns: auto minmax(0, 1.3fr) minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); cursor: pointer; transition: border-color .15s, background-color .15s; }
.machine-row:hover { border-color: var(--aadml-outline); }
.machine-row.chosen { border-color: var(--aadml-primary); background: var(--aadml-tint); }
.machine-row:focus-within { outline: 2px solid var(--aadml-focus); outline-offset: 2px; }
.machine-row input { accent-color: var(--aadml-primary); width: 18px; height: 18px; margin: 0; }
.machine-gpu, .machine-where { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
.machine-price { display: grid; text-align: right; }
.machine-price .muted, .machine-where .muted, .machine-gpu .muted { font-size: 13px; }
.machine-note { font-size: 13px; margin: 8px 0 0; }
.machine-gpu-only { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 14px; color: var(--aadml-navy); }
.machine-soc2 { display: inline-flex; align-items: center; gap: 3px; font-size: 13px; color: var(--aadml-teal); }
.machine-picker-state { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.link-button { background: none; border: 0; padding: 0 0 0 4px; color: var(--aadml-primary); cursor: pointer; font: inherit; }
.link-button:focus-visible { outline: 2px solid var(--aadml-focus); }
@media (max-width: 640px) {
  .machine-row { grid-template-columns: auto 1fr auto; row-gap: 6px; }
  .machine-where { grid-column: 2 / 4; }
  .machine-price { grid-column: 2 / 4; text-align: left; }
}
@media (prefers-reduced-motion: reduce) { .machine-row { transition: none; } }
</style>
