<script setup>
// What a run of an open photo model (kind hf: its task's figures, measured on the version's validation photos) or of a
// generation model's LoRA (kind diffusion: its training loss) measured, as hf_runs.figures / diffusion_runs.figures
// send them. The figure a person reads first comes first.
import { computed } from 'vue';
import { figureRows } from '../api/anyModel.js';

const props = defineProps({ figures: { type: Object, default: null }, caption: { type: String, default: 'What the run measured' } });
const rows = computed(() => figureRows(props.figures));
const where = computed(() => (props.figures?.measured_on === 'training'
  ? 'Measured while it trained: a LoRA has no validation figure of its own, so look at its sample pictures.'
  : props.figures?.measured_on ? `Measured on the validation photos of ${props.figures.version || 'its dataset version'}.` : ''));
</script>

<template>
  <div v-if="rows.length" class="run-figures">
    <div class="size-table-wrap"><table>
      <caption>{{ caption }}</caption>
      <thead><tr><th scope="col">Figure</th><th scope="col">Value</th></tr></thead>
      <tbody><tr v-for="r in rows" :key="r.name" :class="{ chosen: r.primary }"><th scope="row">{{ r.label }}<span v-if="r.primary" class="primary-mark"> (read first)</span></th><td>{{ r.value }}</td></tr></tbody>
    </table></div>
    <p v-if="where" class="run-figures-where">{{ where }}</p>
  </div>
</template>

<style scoped>
.run-figures{margin:12px 0}
.run-figures table{width:100%;border-collapse:collapse;font-size:13px}
.run-figures caption{text-align:left;font-weight:600;padding:0 0 6px;color:#162139}
.run-figures th,.run-figures td{padding:8px 10px;border-bottom:1px solid var(--aadml-soft);text-align:left;font-weight:400}
.run-figures thead th{font-weight:600;color:#4b5565}
.run-figures tr.chosen th,.run-figures tr.chosen td{background:var(--aadml-tint);font-weight:600}
.primary-mark{font-weight:400;color:#4b5565}
.run-figures-where{font-size:12px!important;color:#4b5565!important;margin:6px 0 0!important}
</style>
