<script setup>
// The attempts of a run or an evaluation (ADM-1210 §3.4, §3.9): each with what happened, when, its billable machine
// time, its cost, the provider's job name (decision D11: support asks for it) and its whole log to download. Vision
// and language-model rows alike (api/provenance.js attemptRow).
import { computed } from 'vue';
import UiBadge from './UiBadge.vue';
import { attemptRow, attemptWhen } from '../api/provenance.js';

const props = defineProps({
  attempts: { type: Array, default: () => [] },
  empty: { type: String, default: 'No attempt yet: it waits for a machine.' },
  caption: { type: String, default: 'Attempts' },
});
const rows = computed(() => props.attempts.map(a => ({ ...attemptRow(a), when: attemptWhen(a) })));
// "Retry of" only where the rows say it (the vision rows do).
const retries = computed(() => props.attempts.some(a => a && 'retry_of' in a));
const tone = s => ({ succeeded: 'green', failed: 'red', cancelled: 'neutral' }[s] || 'purple');
</script>

<template>
  <p v-if="!rows.length" class="attempts-empty">{{ empty }}</p>
  <div v-else class="attempts-wrap">
    <table class="ws-table attempts-table">
      <caption class="sr-only">{{ caption }}</caption>
      <thead><tr>
        <th scope="col">Attempt</th><th v-if="retries" scope="col">Retry of</th><th scope="col">State</th><th scope="col">What happened</th>
        <th scope="col">Machine time</th><th scope="col">Cost</th><th scope="col">Log</th>
      </tr></thead>
      <tbody>
        <tr v-for="a in rows" :key="a.number">
          <td data-label="Attempt"><strong>{{ a.number }}</strong><small v-if="a.onDemand">On-demand machine</small><small v-if="a.job" class="attempt-job" :title="a.job" translate="no">{{ a.job }}</small></td>
          <td v-if="retries" data-label="Retry of">{{ a.retryOf ?? '—' }}</td>
          <td data-label="State"><UiBadge :tone="tone(a.state)">{{ a.stateLabel }}</UiBadge></td>
          <td data-label="What happened">{{ a.what }}{{ a.exit != null ? ` (exit ${a.exit})` : '' }}<small v-if="a.when">{{ a.when }}</small></td>
          <td data-label="Machine time" class="attempt-number">{{ a.machineTime }}</td>
          <td data-label="Cost" class="attempt-number">{{ a.cost.text }}<small v-if="a.cost.note">{{ a.cost.note }}</small></td>
          <td data-label="Log"><a v-if="a.log" :href="a.log" download>Download log<span class="sr-only"> of attempt {{ a.number }}</span></a><span v-else class="attempts-muted">Never started</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.badge--red{color:#b42318;background:#fef3f2}
.attempts-empty,.attempts-muted{font-size:12px!important;color:#5f6d82!important}
.attempts-empty,.attempts-wrap{margin:0 0 16px}
.attempts-wrap{max-width:100%;overflow:auto;border:1px solid #e3e8ef;border-radius:10px;background:#fff}
.attempts-table{width:100%;border-collapse:collapse;background:#fff}
.attempts-table thead th{padding:11px 14px;background:#f7f9fc;border-bottom:1px solid #e5eaf1;color:#5f6d82;font-size:11px;font-weight:600;text-align:left;white-space:nowrap}
.attempts-table td{padding:12px 14px;border-bottom:1px solid #edf0f5;vertical-align:top;font-size:12px;color:#43536c;overflow-wrap:anywhere}
.attempts-table tbody tr:last-child td{border-bottom:0}
.attempts-table td strong{color:#24344c;font-weight:600}
.attempts-table td small{display:block;color:#5f6d82;font-size:11px;line-height:1.5;margin-top:4px}
.attempts-table .attempt-job{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;max-width:22ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.attempts-table .attempt-number{font-variant-numeric:tabular-nums;white-space:nowrap}
.attempts-table a{color:var(--aadml-primary);font-weight:550}
.attempts-table a:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px;border-radius:3px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:650px){
  .attempts-wrap{border:0;background:transparent}
  .attempts-table thead{display:none}
  .attempts-table,.attempts-table tbody,.attempts-table tr,.attempts-table td{display:block;width:100%}
  .attempts-table tr{border:1px solid #e3e8ef;border-radius:10px;background:#fff;padding:6px 0;margin-bottom:10px}
  .attempts-table td{border:0!important;padding:6px 14px!important}
  .attempts-table td[data-label]::before{content:attr(data-label);display:block;font-size:11px;color:#5f6d82;margin-bottom:2px}
  .attempts-table .attempt-job{max-width:100%;white-space:normal;overflow-wrap:anywhere}
  .attempts-table .attempt-number{white-space:normal}
}
</style>
