<!-- What AWS charged the two AADML accounts in a month (backend billing/services/infra_cost.py). Each account is read
     from Cost Explorer at most every few hours and the page shows the stored read; Refresh is rate-limited on the
     server because every Cost Explorer request is charged. -->
<template>
  <div class="ic admin-page">
    <header class="ic-head admin-page-header">
      <div class="heading-main"><span class="page-icon"><Server :size="25" aria-hidden="true" /></span>
        <div><div class="eyebrow">PLATFORM FINANCE</div><h1 class="admin-page-title">Infrastructure cost</h1>
          <p>What AWS charged both AADML accounts, for what, and how much. Amounts in USD as AWS bills them: credits,
            refunds and tax included.</p></div>
      </div>
      <div class="ic-controls admin-toolbar">
        <label class="field"><span>Month</span>
          <select v-model="month" :disabled="loading" aria-label="Month" @change="load">
            <option v-for="m in data?.months || [month]" :key="m" :value="m">{{ monthLabel(m) }}</option>
          </select>
        </label>
        <button class="btn primary" type="button" :disabled="loading || refreshing || waitSeconds > 0" @click="refresh">
          <RefreshCw :size="15" :class="{ spin: refreshing }" aria-hidden="true" />{{ refreshing ? 'Reading AWS…' : 'Refresh' }}
        </button>
      </div>
    </header>
    <div class="billing-note"><Info :size="15" aria-hidden="true" />
      <span>AWS charges $0.01 for every Cost Explorer read, so this page shows the last read
        <template v-if="data">(read again after {{ hours(data.fresh_seconds) }})</template>.
        <template v-if="waitSeconds > 0"> Refresh is available again in {{ minutes(waitSeconds) }}.</template></span>
    </div>

    <div v-if="loadError" class="billing-load-error" role="alert"><AlertTriangle :size="17" aria-hidden="true" />
      <span>{{ loadError }}</span><button type="button" class="btn" @click="load">Try again</button></div>
    <div v-else-if="loading && !data" class="vm-skel" style="height:220px" role="status" aria-label="Loading infrastructure cost"></div>

    <div v-if="data" class="accounts">
      <section v-for="a in data.accounts" :key="a.key" class="card admin-surface account" :aria-labelledby="`acct-${a.key}`">
        <div class="acct-head">
          <div>
            <h2 :id="`acct-${a.key}`" class="admin-section-title">{{ a.name }}</h2>
            <p class="muted admin-muted">{{ a.account_id }} · {{ a.region }} · {{ a.holds }}</p>
          </div>
          <span class="read-at muted admin-muted">
            <template v-if="a.fetched_at">Read from AWS {{ when(a.fetched_at) }}<span v-if="a.final" class="tag">final</span></template>
            <template v-else>Not read yet</template>
          </span>
        </div>

        <div v-if="a.error" class="acct-error" role="alert"><AlertTriangle :size="16" aria-hidden="true" />
          <span>{{ a.error }}<template v-if="a.figures"> The figures below are from the last good read.</template></span></div>

        <template v-if="a.figures">
          <div class="kpis admin-metrics">
            <div class="kpi admin-metric">
              <span class="kpi-label">{{ a.own_tag ? "AADML's own" : 'Total' }}</span>
              <strong class="kpi-val">{{ usd(a.figures.total_usd) }}</strong>
              <small class="muted admin-muted">{{ a.own_tag ? `${a.own_tag.key} = ${a.own_tag.value}` : 'the whole account' }}</small>
            </div>
            <div v-if="a.figures.shared_usd != null" class="kpi admin-metric">
              <span class="kpi-label">Shared</span>
              <strong class="kpi-val">{{ usd(a.figures.shared_usd) }}</strong>
              <small class="muted admin-muted">used by AADML and others, shown apart</small>
            </div>
            <div v-if="a.figures.forecast" class="kpi admin-metric">
              <span class="kpi-label">Forecast for the month</span>
              <strong class="kpi-val">{{ a.figures.forecast.usd != null ? usd(a.figures.forecast.usd) : '—' }}</strong>
              <small class="muted admin-muted">{{ a.figures.forecast.error || "AWS's own forecast" }}</small>
            </div>
          </div>

          <div class="customers">
            <h3 class="admin-section-title">AWS cost and what customers paid</h3>
            <table class="tbl admin-table">
              <tbody>
                <tr><th scope="row">AWS charged {{ a.own_tag ? 'for AADML' : 'the account' }}</th><td class="r">{{ usd(a.figures.total_usd) }}</td></tr>
                <tr><th scope="row">Charged to customers ({{ a.customers.usage_kinds.join(', ') }})</th><td class="r">{{ usd(a.customers.charged_usd) }}</td></tr>
                <tr><th scope="row">Provider cost those charges recorded</th><td class="r">{{ usd(a.customers.recorded_cost_usd) }}</td></tr>
                <tr v-if="a.customers.held_now_usd != null"><th scope="row">Held on customers' balances now</th><td class="r">{{ usd(a.customers.held_now_usd) }}</td></tr>
                <tr v-if="a.customers.compute_ledger"><th scope="row">Compute ledger: every job's cost as recorded</th><td class="r">{{ usd(a.customers.compute_ledger.total) }}</td></tr>
              </tbody>
            </table>
            <p class="muted admin-muted small">Platform staff are never charged, so their work is AWS cost with no charge beside it.</p>
          </div>

          <div class="chart-wrap">
            <h3 class="admin-section-title">Day by day</h3>
            <div class="chart-box" role="img" :aria-label="chartSummary(a)">
              <Bar :data="chartData(a)" :options="chartOptions" />
            </div>
            <details class="as-table"><summary>Show as a table</summary>
              <table class="tbl admin-table">
                <thead><tr><th>Day</th><th class="r">{{ a.own_tag ? "AADML's own" : 'Cost' }}</th><th v-if="a.figures.shared_usd != null" class="r">Shared</th></tr></thead>
                <tbody><tr v-for="d in a.figures.daily" :key="d.date"><td>{{ d.date }}</td><td class="r">{{ usd(d.usd) }}</td>
                  <td v-if="a.figures.shared_usd != null" class="r">{{ usd(d.shared_usd) }}</td></tr></tbody>
              </table>
            </details>
          </div>

          <h3 class="admin-section-title">By service</h3>
          <table class="tbl admin-table">
            <thead><tr><th>Service</th><th class="r">Cost</th></tr></thead>
            <tbody>
              <tr v-for="s in a.figures.by_service" :key="s.name"><td>{{ s.label }}</td><td class="r">{{ usd(s.usd) }}</td></tr>
              <tr v-if="!a.figures.by_service.length"><td colspan="2" class="muted admin-muted">Nothing charged this month.</td></tr>
            </tbody>
          </table>
          <details v-if="a.figures.shared_by_service?.length" class="as-table"><summary>Shared, by service</summary>
            <table class="tbl admin-table"><tbody>
              <tr v-for="s in a.figures.shared_by_service" :key="s.name"><td>{{ s.label }}</td><td class="r">{{ usd(s.usd) }}</td></tr>
            </tbody></table>
          </details>

          <template v-for="key in a.tag_keys" :key="key">
            <h3 class="admin-section-title"><template v-if="key === 'REGION'">By region</template><template v-else>By tag <code>{{ key }}</code></template><span v-if="a.own_tag && key === a.own_tag.key" class="muted admin-muted small"> (the whole account)</span></h3>
            <table class="tbl admin-table">
              <thead><tr><th>{{ key }}</th><th class="r">Cost</th></tr></thead>
              <tbody>
                <tr v-for="t in a.figures.by_tag[key]" :key="t.name"><td>{{ t.label }}</td><td class="r">{{ usd(t.usd) }}</td></tr>
                <tr v-if="!a.figures.by_tag[key]?.length"><td colspan="2" class="muted admin-muted">Nothing charged this month.</td></tr>
              </tbody>
            </table>
          </template>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Bar } from 'vue-chartjs'
import { AlertTriangle, Info, RefreshCw, Server } from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'
import { axisTicks, baseOptions } from '../../components/admin/learning/learningCharts'

// Two series at most (AADML's own, Shared); the pair passes the palette checks (CVD separation 22, contrast >= 3:1).
const OWN = '#4f46e5'
const SHARED = '#0d9488'

const data = ref(null)
// The current month (UTC, as the API counts months) until the API answers, so the picker never shows an empty month.
const month = ref(new Date().toISOString().slice(0, 7))
const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const waitSeconds = ref(0)
let ticker = null

function apiError(e, fallback) { return e.response?.data?.detail || e.response?.data?.error || fallback }
function setWait(seconds) {
  waitSeconds.value = Math.max(0, Number(seconds) || 0)
  clearInterval(ticker)
  if (waitSeconds.value > 0) ticker = setInterval(() => { waitSeconds.value = Math.max(0, waitSeconds.value - 1); if (!waitSeconds.value) clearInterval(ticker) }, 1000)
}
function show(d) { data.value = d; month.value = d.month; setWait(d.refresh?.wait_seconds) }

async function load() {
  loading.value = true; loadError.value = ''
  try { const { data: d } = await api.billingAdminInfraCost(month.value || undefined); show(d) }
  catch (e) { loadError.value = apiError(e, 'The infrastructure cost could not be loaded.') }
  loading.value = false
}

async function refresh() {
  refreshing.value = true
  try {
    const { data: d } = await api.billingAdminInfraCostRefresh(month.value)
    show(d)
    const failed = d.accounts.filter((a) => a.error_code)
    if (failed.length) notify.error(`${failed.map((a) => a.name).join(' and ')}: ${failed[0].error}`)
    else notify.success('Read again from AWS.')
  } catch (e) {
    if (e.response?.status === 429) setWait(e.response.data?.retry_after_seconds)
    notify.error(apiError(e, 'AWS could not be read again.'))
  }
  refreshing.value = false
}

function chartData(a) {
  const days = a.figures.daily
  const datasets = [{ label: a.own_tag ? "AADML's own" : a.name, data: days.map((d) => Number(d.usd)), backgroundColor: OWN,
    stack: 'cost', borderRadius: 4, borderSkipped: 'bottom', borderColor: '#ffffff', borderWidth: { top: 2 } }]
  if (a.figures.shared_usd != null) {
    datasets.push({ label: 'Shared', data: days.map((d) => Number(d.shared_usd)), backgroundColor: SHARED, stack: 'cost',
      borderRadius: 4, borderSkipped: 'bottom', borderColor: '#ffffff', borderWidth: { top: 2 } })
  }
  return { labels: days.map((d) => Number(d.date.slice(8))), datasets }
}
const chartOptions = baseOptions({
  plugins: {
    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 12 } } },
    tooltip: { padding: 10, boxPadding: 4, callbacks: { label: (c) => `${c.dataset.label}: ${usd(c.parsed.y)}` } },
  },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: axisTicks },
    y: { stacked: true, beginAtZero: true, grid: { color: '#eef2f7' }, ticks: { ...axisTicks, callback: (v) => `$${v}` } },
  },
})
function chartSummary(a) {
  const top = [...a.figures.daily].sort((x, y) => Number(y.usd) - Number(x.usd))[0]
  return `${a.name}: ${usd(a.figures.total_usd)} this month${top && Number(top.usd) ? `, highest on ${top.date} at ${usd(top.usd)}` : ''}.`
}

const usd = (v) => `$${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
function when(s) { return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }
function monthLabel(m) { if (!/^\d{4}-\d{2}$/.test(m || '')) return m || ''; const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
function minutes(s) { const m = Math.ceil(s / 60); return `${m} minute${m === 1 ? '' : 's'}` }
function hours(s) { const h = Math.round(s / 3600); return h >= 1 ? `${h} hour${h === 1 ? '' : 's'}` : minutes(s) }

onMounted(load)
onBeforeUnmount(() => clearInterval(ticker))
</script>

<style scoped>
.ic { padding: 28px 32px 60px; }
.ic-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 14px; }
.heading-main { display: flex; gap: 14px; align-items: flex-start; }
.page-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: var(--admin-soft, #eef2ff); color: #4f46e5; flex-shrink: 0; }
.eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .08em; color: var(--admin-muted, #64748b); }
.ic-head p { margin: 6px 0 0; color: var(--admin-muted, #64748b); font-size: 13px; max-width: 680px; line-height: 1.5; }
.ic-controls { display: flex; align-items: flex-end; gap: 10px; flex-shrink: 0; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: var(--admin-muted, #64748b); }
.field select { height: 38px; border: 1px solid var(--admin-line, #d8e2f0); border-radius: 9px; padding: 0 10px; background: var(--admin-surface, #fff); color: var(--admin-ink, #0f172a); }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid var(--admin-line, #d8e2f0); background: var(--admin-surface, #fff); cursor: pointer; }
.btn.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.btn:disabled { opacity: .6; cursor: default; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.billing-note, .billing-load-error, .acct-error { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; padding: 10px 14px; border-radius: 10px; margin-bottom: 16px; }
.billing-note { background: var(--admin-soft, #f8fafc); color: var(--admin-muted, #475569); }
.billing-load-error, .acct-error { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
.billing-load-error .btn { margin-left: auto; }
.accounts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; align-items: start; }
.card { background: var(--admin-surface, #fff); border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.account { padding: 18px 20px; min-width: 0; }
.acct-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.acct-head h2 { margin: 0; font-size: 17px; }
.acct-head p { margin: 4px 0 0; font-size: 12.5px; }
.read-at { font-size: 12px; white-space: nowrap; }
.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
.kpi { border: 1px solid var(--admin-line, #e2e8f0); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.kpi-label { font-size: 11.5px; font-weight: 700; color: var(--admin-muted, #64748b); text-transform: uppercase; letter-spacing: .03em; }
.kpi-val { font-size: 22px; font-weight: 800; color: var(--admin-ink, #0f172a); font-variant-numeric: tabular-nums; }
.kpi small { font-size: 11.5px; }
h3.admin-section-title { font-size: 13.5px; margin: 18px 0 8px; }
.customers h3 { margin-top: 4px; }
.small { font-size: 12px; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th, .tbl td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: left; }
.tbl thead th { font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: var(--admin-muted, #64748b); background: var(--admin-soft, #f8fafc); }
.tbl tbody th { font-weight: 600; color: var(--admin-ink, #0f172a); }
.tbl .r { text-align: right; font-variant-numeric: tabular-nums; }
.chart-box { position: relative; height: 240px; min-width: 0; }
.as-table { margin-top: 8px; font-size: 13px; }
.as-table summary { cursor: pointer; color: #4f46e5; font-weight: 700; }
.muted { color: var(--admin-muted, #94a3b8); }
.tag { margin-left: 8px; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: var(--admin-soft, #f1f5f9); color: var(--admin-muted, #64748b); }
code { font-size: 12px; background: var(--admin-soft, #f1f5f9); padding: 1px 6px; border-radius: 5px; }
@media (max-width: 1100px) { .accounts { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 680px) { .ic { padding: 20px 16px; } .ic-head { flex-direction: column; } .read-at { white-space: normal; } }
</style>
