<template>
  <div class="sc">
    <header class="sc-head">
      <div>
        <h1>Speed &amp; Cache</h1>
        <p>Prompt-cache effectiveness and latency across the platform. Latency is measured <strong>per LLM
          call</strong> ({{ data?.latency_grain || 'llm_call' }}); embedding calls are excluded. “Est. saved”
          assumes cache reads bill ~10% of the input rate, over calls with a persisted input price.</p>
      </div>
      <div class="sc-controls">
        <div class="seg">
          <button v-for="d in [7, 30, 90]" :key="d" :class="{ on: days === d }" @click="setDays(d)">{{ d }}d</button>
        </div>
        <button class="btn primary" :disabled="loading" @click="load">
          <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" /> Refresh
        </button>
      </div>
    </header>

    <!-- Headline KPIs -->
    <div v-if="data" class="kpis">
      <div class="kpi">
        <span class="kpi-label">Cache hit</span>
        <span class="kpi-val">{{ pct(h.cache_hit_pct) }}</span>
        <span class="kpi-note">of prompt tokens read from cache</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Cached tokens</span>
        <span class="kpi-val">{{ compact(h.cached_tokens) }}</span>
        <span class="kpi-note">of {{ compact(h.prompt_tokens) }} prompt tokens</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Est. saved</span>
        <span class="kpi-val">{{ usd(h.est_saved_usd) }}</span>
        <span class="kpi-note">vs paying the full input rate</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Avg latency</span>
        <span class="kpi-val">{{ ms(h.avg_latency_ms) }}</span>
        <span class="kpi-note">per LLM call</span>
      </div>
      <div class="kpi" v-if="h.p95_latency_ms != null">
        <span class="kpi-label">p95 latency</span>
        <span class="kpi-val">{{ ms(h.p95_latency_ms) }}</span>
        <span class="kpi-note">per LLM call</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Errors</span>
        <span class="kpi-val">{{ pct(h.error_pct) }}</span>
        <span class="kpi-note">of {{ num(h.calls) }} calls</span>
      </div>
    </div>

    <!-- Daily cache-hit bars -->
    <section class="card pad">
      <div class="card-title">Daily cache-hit ratio</div>
      <div v-if="loading && !data" class="state">Loading…</div>
      <div v-else-if="error" class="state err">Couldn’t load. <button class="link" @click="load">Retry</button></div>
      <div v-else-if="data && !data.daily.length" class="state">No LLM calls in the last {{ data.period_days }} days.</div>
      <div v-else-if="data" class="chart" role="img" aria-label="Daily cache-hit ratio, percent of prompt tokens">
        <div class="chart-y"><span>100%</span><span>50%</span><span>0%</span></div>
        <div class="chart-bars">
          <div v-for="d in data.dates" :key="d" class="bar-slot" :title="dayTitle(d)">
            <div class="bar" :style="{ height: hitHeight(d) }"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Super vs normal -->
    <section v-if="data" class="card">
      <div class="card-title pad-h">Super Agent vs normal agents <span class="muted">(window totals)</span></div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Class</th><th class="r">Calls</th><th class="r">Cache hit</th><th class="r">Cached tokens</th><th class="r">Avg latency</th><th class="r">p95</th><th class="r">Errors</th></tr></thead>
          <tbody>
            <tr v-for="k in ['super', 'normal']" :key="k">
              <td><strong>{{ k === 'super' ? 'Platform Super Agent' : 'Normal agents' }}</strong></td>
              <td class="r">{{ num(data.by_agent_class[k].calls) }}</td>
              <td class="r strong">{{ pct(data.by_agent_class[k].cache_hit_pct) }}</td>
              <td class="r muted">{{ compact(data.by_agent_class[k].cached_tokens) }}</td>
              <td class="r">{{ ms(data.by_agent_class[k].avg_latency_ms) }}</td>
              <td class="r">{{ ms(data.by_agent_class[k].p95_latency_ms) }}</td>
              <td class="r">{{ pct(data.by_agent_class[k].error_pct) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Daily table -->
    <section v-if="data && data.daily.length" class="card">
      <div class="card-title pad-h">Daily detail</div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Date</th><th class="r">Calls</th><th class="r">Prompt tokens</th><th class="r">Cached</th><th class="r">Hit</th><th class="r">Avg latency</th><th class="r">p95</th><th class="r">Errors</th></tr></thead>
          <tbody>
            <tr v-for="d in dailyDesc" :key="d.date">
              <td class="muted">{{ d.date }}</td>
              <td class="r">{{ num(d.calls) }}</td>
              <td class="r">{{ compact(d.prompt_tokens) }}</td>
              <td class="r">{{ compact(d.cached_tokens) }}</td>
              <td class="r strong">{{ pct(d.cache_hit_pct) }}</td>
              <td class="r">{{ ms(d.avg_latency_ms) }}</td>
              <td class="r">{{ ms(d.p95_latency_ms) }}</td>
              <td class="r" :class="{ warn: d.error_pct > 0 }">{{ pct(d.error_pct) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'

const loading = ref(true)
const error = ref(false)
const data = ref(null)
const days = ref(30)

const h = computed(() => data.value?.headline || {})
const dailyMap = computed(() => Object.fromEntries((data.value?.daily || []).map((d) => [d.date, d])))
const dailyDesc = computed(() => [...(data.value?.daily || [])].reverse())

function hitHeight(date) {
  const d = dailyMap.value[date]
  if (!d || !d.prompt_tokens) return '0px'
  return `${Math.max(2, Math.round((d.cache_hit_pct / 100) * 72))}px`
}
function dayTitle(date) {
  const d = dailyMap.value[date]
  if (!d) return `${date} — no calls`
  return `${date} — ${pct(d.cache_hit_pct)} hit · ${compact(d.cached_tokens)}/${compact(d.prompt_tokens)} tokens cached · avg ${ms(d.avg_latency_ms)}`
}

const num = (n) => (n ?? 0).toLocaleString()
const pct = (n) => (n == null ? '—' : `${Number(n).toFixed(1)}%`)
const ms = (n) => (n == null ? '—' : `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })} ms`)
const usd = (n) => `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
function compact(n) {
  const v = Number(n ?? 0)
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`
  return String(v)
}

async function load() {
  loading.value = true; error.value = false
  try {
    const { data: d } = await api.get('/admin/ops/speed-cache/', { params: { days: days.value }, noCache: true })
    data.value = d
  } catch (e) { error.value = true }
  loading.value = false
}
function setDays(d) { if (days.value !== d) { days.value = d; load() } }

onMounted(load)
</script>

<style scoped>
.sc { padding: 28px 32px 60px; }
.sc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.sc-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.sc-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 680px; line-height: 1.5; }
.sc-controls { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.seg { display: inline-flex; border: 1px solid #d8e2f0; border-radius: 9px; overflow: hidden; background: #fff; }
.seg button { border: 0; background: transparent; padding: 0 13px; height: 36px; font-size: 12.5px; font-weight: 700; color: #64748b; cursor: pointer; }
.seg button + button { border-left: 1px solid #e5ebf3; }
.seg button.on { background: #4f46e5; color: #fff; }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; }
.btn.primary { background: #4f46e5; color: #fff; }
.btn:disabled { opacity: .6; } .btn svg { width: 15px; height: 15px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }

.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 15px 17px; display: flex; flex-direction: column; }
.kpi-label { font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
.kpi-val { font-size: 26px; font-weight: 800; color: #0f172a; margin-top: 7px; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.kpi-note { font-size: 12px; color: #94a3b8; margin-top: 4px; }

.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); overflow: hidden; margin-bottom: 18px; }
.card.pad { padding: 16px 18px 18px; }
.card-title { font-size: 12px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 12px; }
.card-title.pad-h { padding: 14px 16px 0; margin-bottom: 10px; }
.state { padding: 44px; text-align: center; color: #64748b; } .state.err { color: #b45309; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }

/* hit-ratio bars — single sequential hue on a fixed 0–100% scale, recessive gridline labels */
.chart { display: flex; gap: 10px; }
.chart-y { display: flex; flex-direction: column; justify-content: space-between; height: 74px; font-size: 10.5px; color: #94a3b8; text-align: right; padding-bottom: 1px; }
.chart-bars { flex: 1; display: flex; align-items: flex-end; gap: 2px; height: 74px; border-bottom: 1px solid #eef2f7; }
.bar-slot { flex: 1 1 0; min-width: 3px; height: 100%; display: flex; align-items: flex-end; cursor: default; }
.bar { width: 100%; background: #4f46e5; border-radius: 2px 2px 0 0; transition: background .12s; }
.bar-slot:hover .bar { background: #312e81; }

.tbl-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 12px 16px; border-bottom: 1px solid #eef2f7; background: #f8fafc; white-space: nowrap; }
.tbl th.r, .tbl td.r { text-align: right; }
.tbl td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.tbl tr:last-child td { border-bottom: 0; }
.tbl td.strong { font-weight: 700; font-variant-numeric: tabular-nums; }
.tbl td.warn { color: #b45309; font-weight: 700; }
.muted { color: #94a3b8; font-weight: 500; text-transform: none; letter-spacing: 0; }

@media (max-width: 680px) { .sc { padding: 20px 16px; } .sc-head { flex-direction: column; } }
</style>
