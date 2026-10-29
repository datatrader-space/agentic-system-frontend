<script setup>
// The Cost Benchmark tab of the workspace's Deployments page (TRAINING_PHASE3_SERVING_PLAN.md 7.3, 7.4, 7.8, 7.9):
// pick one of the workspace's photo models and see what 1,000 calls would cost on each way of deploying it, with every
// assumption in words. Backend: training_models_data/cost_benchmark_api.py (workspace/cost-benchmark/). Every figure
// is the backend's: what the person is charged (the Shared Cloud API per answered call, a Dedicated machine by the
// second, both with AADML's markup). While no price per call is set, none is shown for the Shared Cloud API.
import { computed, onMounted, ref, watch } from 'vue';
import { ChartColumn, Info, LoaderCircle, RefreshCw } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import {
  costBenchmarkApi, modelOptions, parseCallsPerDay, usd, count, modelTimeText, measuredSummary, wayName, trafficText,
  METRICS, defaultMetric, barRows, barsSummary,
} from '../api/costBenchmark.js';

const listing = ref(null); const listError = ref('');
const options = computed(() => modelOptions(listing.value));
const chosen = ref('');
const callsText = ref('');
const parsed = computed(() => parseCallsPerDay(callsText.value));
const callsProblem = ref('');

const body = ref(null); const error = ref(''); const loading = ref(false);
const metric = ref('full'); const metricChosen = ref(false);
let asked = 0;

async function loadModels() {
  listError.value = '';
  try {
    listing.value = await costBenchmarkApi.models();
    if (!options.value.some(o => o.key === chosen.value)) chosen.value = options.value[0]?.key || '';
  } catch (e) { listError.value = e.message; }
}

async function compare() {
  const option = options.value.find(o => o.key === chosen.value);
  callsProblem.value = parsed.value.problem;
  if (!option || callsProblem.value) return;
  const mine = ++asked;
  loading.value = true; error.value = '';
  try {
    const answer = await costBenchmarkApi.compare({ project: option.ref, model: option.number, calls_per_day: parsed.value.value ?? '' });
    if (mine !== asked) return;                              // a newer question was asked meanwhile
    body.value = answer;
    if (!metricChosen.value) metric.value = defaultMetric(answer.calls_per_day);
  } catch (e) {
    if (mine !== asked) return;
    if (e.field === 'calls_per_day') callsProblem.value = e.message;
    else error.value = e.status === 404 ? 'That model is no longer among the models you can see in this workspace. Choose another one.' : e.message;
  } finally { if (mine === asked) loading.value = false; }
}

watch(chosen, key => { if (key) compare(); });
onMounted(loadModels);

function pickMetric(id) { metric.value = id; metricChosen.value = true; }

const rows = computed(() => body.value?.options || []);
const bars = computed(() => barRows(rows.value, metric.value, body.value?.calls_per_day));
const chartSaid = computed(() => barsSummary(bars.value));
const modelLabel = computed(() => (body.value ? `${body.value.model.name} ${body.value.model.version}` : ''));
</script>

<template>
  <section class="cost" role="tabpanel" aria-labelledby="cost-heading" :aria-busy="loading">
    <header class="cost-head">
      <h2 id="cost-heading">Cost benchmark</h2>
      <p>What 1,000 calls to one of your photo models would cost on each way of deploying it, with every assumption listed below the table.</p>
    </header>

    <div v-if="listError" class="cost-error" role="alert">
      <span>{{ listError }}</span>
      <UiButton @click="loadModels"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton>
    </div>
    <p v-else-if="!listing" class="cost-muted">Loading your models…</p>
    <div v-else-if="!options.length" class="cost-empty">
      <span class="cost-empty-icon"><ChartColumn :size="22" aria-hidden="true"/></span>
      <h3>No photo model to compare yet</h3>
      <p>Train a model in one of this workspace's photo projects. Once it is registered, it can be compared here.</p>
    </div>

    <template v-else>
      <form class="cost-controls" novalidate @submit.prevent="compare">
        <div class="cost-field">
          <label for="cost-model">Model</label>
          <select id="cost-model" v-model="chosen" class="text-input">
            <option v-for="o in options" :key="o.key" :value="o.key">{{ o.label }}</option>
          </select>
        </div>
        <div class="cost-field cost-field--calls">
          <label for="cost-calls">Your calls a day</label>
          <input id="cost-calls" v-model="callsText" class="text-input" inputmode="numeric" autocomplete="off" placeholder="For example 5000"
                 :aria-invalid="callsProblem ? 'true' : 'false'" aria-describedby="cost-calls-help cost-calls-error"/>
          <p id="cost-calls-help" class="cost-help">Optional. Used for the cost at your traffic.</p>
          <p id="cost-calls-error" class="field-error" aria-live="polite">{{ callsProblem }}</p>
        </div>
        <UiButton type="submit" variant="primary" class="cost-go" :disabled="loading || !chosen">
          <LoaderCircle v-if="loading" class="cost-spin" :size="15" aria-hidden="true"/> Compare costs
        </UiButton>
      </form>

      <div v-if="error" class="cost-error" role="alert">
        <span>{{ error }}</span>
        <UiButton :disabled="loading" @click="compare"><RefreshCw :size="14" aria-hidden="true"/> Try again</UiButton>
      </div>
      <p v-else-if="!body" class="cost-muted">Working out the costs…</p>

      <div v-if="body" class="cost-result" :class="{ refreshing: loading }">
        <p class="cost-basis"><Info :size="16" aria-hidden="true"/><span><strong>{{ body.project.name }}: {{ modelLabel }}.</strong> {{ measuredSummary(body) }}</span></p>
        <p v-if="body.no_machines" class="cost-warn" role="status">{{ body.no_machines }}</p>

        <div class="cost-table-wrap">
          <table class="cost-table">
            <caption class="sr-only">Cost of {{ modelLabel }} on each way of deploying it, in US dollars</caption>
            <thead><tr>
              <th scope="col">Way of deploying</th><th scope="col">Machine</th><th scope="col">Price an hour</th><th scope="col">Photos an hour</th>
              <th scope="col">Per 1,000 calls at full use</th><th scope="col">Per 1,000 calls at your traffic</th><th scope="col">A month</th>
            </tr></thead>
            <tbody>
              <tr v-for="o in rows" :key="o.instance_type || o.way" :class="`way-${o.way}`">
                <th scope="row" data-label="Way of deploying">{{ wayName(o) }}</th>
                <td data-label="Machine"><span>
                  <code v-if="o.instance_type">{{ o.instance_type }}</code><template v-else>Shared pool</template>
                  <small>{{ modelTimeText(o.model_time) }}</small>
                </span></td>
                <template v-if="o.way === 'shared' && o.price_set">
                  <td data-label="Price an hour"><span>{{ usd(o.usd_per_call) }} a call<small>Nothing while it is not called.</small></span></td>
                  <td data-label="Photos an hour">Shared</td>
                  <td data-label="Per 1,000 calls at full use">{{ usd(o.usd_per_1000_full_use) }}</td>
                  <td data-label="Per 1,000 calls at your traffic" :class="{ 'cost-muted-cell': !body.calls_per_day }">{{ trafficText(o, body.calls_per_day) }}</td>
                  <td data-label="A month"><span>{{ o.usd_per_month ? usd(o.usd_per_month) : 'Enter your calls a day' }}<small v-if="o.usd_per_day">{{ usd(o.usd_per_day) }} a day</small></span></td>
                </template>
                <template v-else-if="o.way === 'shared'">
                  <td colspan="5" class="cost-unpriced" data-label="Price">
                    <UiBadge tone="purple">Not priced yet</UiBadge> {{ o.price_note }}
                    <small>Charged per call, so nothing is paid while it is not called.</small>
                  </td>
                </template>
                <template v-else>
                  <td data-label="Price an hour">{{ usd(o.usd_per_hour) }}</td>
                  <td data-label="Photos an hour">{{ o.photos_per_hour === null ? 'Not known' : count(o.photos_per_hour) }}</td>
                  <td data-label="Per 1,000 calls at full use">{{ o.usd_per_1000_full_use === null ? 'Not known' : usd(o.usd_per_1000_full_use) }}</td>
                  <td data-label="Per 1,000 calls at your traffic" :class="{ 'cost-over': o.fits === false, 'cost-muted-cell': !body.calls_per_day }">{{ trafficText(o, body.calls_per_day) }}</td>
                  <td data-label="A month"><span>{{ usd(o.usd_per_month) }}<small>{{ usd(o.usd_per_day) }} a day</small></span></td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>

        <figure class="cost-chart">
          <figcaption>
            <span class="cost-chart-title">Cost {{ bars.unit }}</span>
            <span class="cost-metrics" role="radiogroup" aria-label="Measure the bars show">
              <button v-for="m in METRICS" :key="m.id" type="button" role="radio" :aria-checked="metric === m.id"
                      :class="{ on: metric === m.id }" @click="pickMetric(m.id)">{{ m.label }}</button>
            </span>
          </figcaption>
          <p class="sr-only" aria-live="polite">{{ chartSaid }}</p>
          <ul class="cost-bars" aria-hidden="true">
            <li v-for="b in bars.rows" :key="b.key" class="cost-bar-row">
              <span class="cost-bar-name">{{ b.name }}<small>{{ b.machine }}</small></span>
              <span v-if="b.value === null" class="cost-bar-track empty">{{ b.why }}</span>
              <span v-else class="cost-bar-track">
                <!-- The bar's length leaves 96px for its value at the tip, so the longest bar's label still fits. -->
                <span class="cost-bar" :style="{ width: `calc(${b.share} * (100% - 96px) / 100)` }"></span>
                <span class="cost-bar-value">{{ b.text }}</span>
              </span>
            </li>
          </ul>
        </figure>

        <section class="cost-assumptions" aria-labelledby="cost-assumptions-heading">
          <h3 id="cost-assumptions-heading">Assumptions</h3>
          <ul><li v-for="(line, i) in body.assumptions" :key="i">{{ line }}</li></ul>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.cost{--ink:#162139;--ink-2:#4c5d74;--line:#e2e8f0;color:var(--ink)}
.cost-head{margin-bottom:18px}
.cost-head h2{margin:0 0 4px}
.cost-head p{margin:0;max-width:640px;color:var(--ink-2);font-size:13px}
.cost-muted{font-size:13px;color:#5f6d82}
.cost-error{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 16px;padding:10px 14px;border:1px solid #efc5ce;border-radius:10px;background:#fff5f6;color:#ad3449;font-size:13px}
.cost-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:40px 16px;border:1px dashed var(--aadml-outline);border-radius:12px}
.cost-empty p{max-width:460px;font-size:13px;color:var(--ink-2)}
.cost-empty-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:10px;background:var(--aadml-soft);color:var(--aadml-primary)}

.cost-controls{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr) auto;gap:0 14px;align-items:start;padding:16px 18px;border:1px solid var(--line);border-radius:12px;background:#fff;margin-bottom:16px}
.cost-field{min-width:0}
.cost-field label{display:block;font-size:13px;font-weight:600;margin:0 0 6px}
.cost-field .text-input{display:block;width:100%;min-height:44px;padding:10px 12px;font-size:14px}
.cost-field .text-input:focus-visible{outline:2px solid var(--aadml-focus);outline-offset:2px}
.cost-field .text-input[aria-invalid="true"]{border-color:#c0394c}
.cost-help{margin:6px 0 0!important;font-size:12px!important;line-height:1.5!important;color:#5f6d82!important}
.cost-field .field-error{margin:4px 0 0}
.cost-field .field-error:empty{margin:0}
.cost-go{min-height:44px;margin-top:25px}
.cost-spin{animation:cost-spin 1s linear infinite}
@keyframes cost-spin{to{transform:rotate(360deg)}}

.cost-result{transition:opacity .2s}
.cost-result.refreshing{opacity:.6}
.cost-basis{display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;font-size:13px;color:var(--ink-2)}
.cost-basis svg{margin-top:3px;color:var(--aadml-primary)}
.cost-basis strong{color:var(--ink);font-weight:600}
.cost-warn{margin:0 0 12px;padding:10px 14px;border-radius:10px;background:#fff7e6;border:1px solid #f5dfb0;color:#6f4500;font-size:13px}

.cost-table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:#fff}
.cost-table{width:100%;border-collapse:collapse;font-size:13px}
.cost-table th,.cost-table td{padding:12px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
.cost-table thead th{font-size:12px;font-weight:600;color:var(--ink-2);background:var(--aadml-tint);white-space:nowrap}
.cost-table tbody tr:last-child > *{border-bottom:0}
.cost-table tbody th{font-weight:600}
.cost-table td{font-variant-numeric:tabular-nums}
.cost-table small{display:block;margin-top:4px;font-size:11px;line-height:1.5;color:#5f6d82}
.cost-table code{font-size:12px}
.cost-unpriced{color:var(--ink-2)}
.cost-over{color:#93610b}
.cost-muted-cell{color:#5f6d82}
.way-shared{background:#fbfcfe}

.cost-chart{margin:20px 0 0;padding:16px 18px;border:1px solid var(--line);border-radius:12px;background:#fff}
.cost-chart figcaption{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.cost-chart-title{font-size:14px;font-weight:600}
.cost-metrics{display:inline-flex;gap:2px;padding:3px;border-radius:8px;background:#f1f4f9}
.cost-metrics button{min-height:36px;padding:6px 12px;border:0;border-radius:6px;background:transparent;font-size:12px;color:var(--ink-2)}
.cost-metrics button:hover{color:var(--aadml-primary)}
.cost-metrics button.on{background:#fff;color:var(--aadml-primary);font-weight:600;box-shadow:0 1px 3px #1d2a4224}
.cost-bars{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.cost-bar-row{display:grid;grid-template-columns:200px minmax(0,1fr);gap:14px;align-items:center}
.cost-bar-name{font-size:13px;font-weight:600;min-width:0}
.cost-bar-name small{display:block;font-weight:400;font-size:11px;color:#5f6d82}
.cost-bar-track{display:flex;align-items:center;gap:8px;min-height:28px;min-width:0;border-left:1px solid #c9d2df}
.cost-bar{display:block;flex:0 0 auto;height:20px;border-radius:0 4px 4px 0;background:var(--aadml-primary);transition:width .2s ease-out}
.cost-bar-value{font-size:12px;font-variant-numeric:tabular-nums;color:var(--ink);white-space:nowrap}
.cost-bar-track.empty{padding:4px 10px;border:1px dashed #c9d2df;border-radius:0 6px 6px 0;font-size:12px;color:var(--ink-2)}

.cost-assumptions{margin-top:20px;padding:16px 18px;border-radius:12px;background:var(--aadml-tint);border:1px solid var(--aadml-soft)}
.cost-assumptions h3{font-size:14px;margin:0 0 8px}
.cost-assumptions ul{margin:0;padding-left:18px;display:grid;gap:6px}
.cost-assumptions li{font-size:13px;line-height:1.6;color:var(--ink-2);max-width:78ch}

.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

@media (max-width:760px){
  .cost-controls{grid-template-columns:1fr;gap:14px;padding:14px}
  .cost-go{margin-top:0;width:100%}
  .cost-table-wrap{border:0;background:transparent;overflow:visible}
  .cost-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
  .cost-table,.cost-table tbody,.cost-table tr,.cost-table th,.cost-table td{display:block;width:100%}
  .cost-table tr{margin-bottom:12px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}
  .cost-table tbody th{background:var(--aadml-tint);font-size:14px}
  .cost-table td{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;padding:10px 14px}
  .cost-table td::before{content:attr(data-label);font-size:12px;font-weight:600;color:var(--ink-2)}
  .cost-table td.cost-unpriced{display:block}
  .cost-table td.cost-unpriced::before{content:none}
  .cost-table tbody tr:last-child > *{border-bottom:1px solid var(--line)}
  .cost-table tbody tr > *:last-child{border-bottom:0}
  .cost-bar-row{grid-template-columns:1fr;gap:6px}
  .cost-chart,.cost-assumptions{padding:14px}
}
@media (prefers-reduced-motion:reduce){
  .cost-bar,.cost-result{transition:none}
  .cost-spin{animation:none}
}
</style>
