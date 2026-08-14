<template>
  <div class="rtm">
    <header class="rtm-head">
      <div>
        <h1>Runtime Metrics</h1>
        <p>Live backpressure, circuit-breaker, and thread-pool saturation for the worker process that
          answers this request — the same span-based machinery (Phase F) that already sheds load and
          fails fast in production, read out instead of only acting on it.</p>
      </div>
      <div class="rtm-controls">
        <label class="auto" :class="{ on: autoRefresh }">
          <input type="checkbox" v-model="autoRefresh" @change="onAutoToggle" />
          <span class="auto-dot"></span> Auto-refresh (5s)
        </label>
        <button class="btn primary" :disabled="loading" @click="load">
          <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" /> Refresh
        </button>
      </div>
    </header>

    <div class="scope-note">
      <Icon icon="lucide:info" />
      <span>
        <strong>Process-local, not platform-wide.</strong> This is one worker's live counters/gauges — a
        multi-worker deployment shows only whichever process answered this request, and restarting that
        process resets every counter here. Compare <code>started_at</code> against <code>generated_at</code>
        below to tell a restart from a genuine zero.
      </span>
    </div>

    <div v-if="loading && !data" class="state card">Loading…</div>
    <div v-else-if="error" class="state err card">Couldn’t load. <button class="link" @click="load">Retry</button></div>

    <template v-else-if="data">
      <!-- KPI tiles -->
      <div class="kpis">
        <div v-for="t in kpis" :key="t.label" class="kpi" :class="'tone-' + t.tone">
          <span class="kpi-label">{{ t.label }}</span>
          <span class="kpi-val">{{ t.value }}</span>
          <span class="kpi-note">{{ t.note }}</span>
        </div>
      </div>

      <!-- Thread pools -->
      <section class="card">
        <div class="card-head">
          <h2>Thread pools</h2>
          <span class="count">{{ poolRows.length }}</span>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr><th>Pool</th><th class="r">Active / Max</th><th class="r">Idle</th><th class="r">Queued</th><th>Saturation</th></tr>
            </thead>
            <tbody>
              <tr v-for="p in poolRows" :key="p.name">
                <td><strong>{{ p.label }}</strong></td>
                <template v-if="p.started">
                  <td class="r tabular">{{ n(p.active) }} / {{ p.max ?? '—' }}</td>
                  <td class="r tabular muted">{{ n(p.idle) }}</td>
                  <td class="r tabular" :class="{ warn: (p.queued || 0) > 0 }">{{ n(p.queued) }}</td>
                  <td class="bar-cell">
                    <div class="bar-track">
                      <div class="bar-fill" :class="'tier-' + p.tier" :style="{ width: (p.pct ?? 0) + '%' }"></div>
                    </div>
                    <span class="bar-pct" :class="'tier-' + p.tier">{{ p.pct == null ? 'n/a' : p.pct + '%' }}</span>
                  </td>
                </template>
                <template v-else>
                  <td class="r muted" colspan="3">not created in this process yet</td>
                  <td class="bar-cell"><span class="bar-pct tier-unknown">n/a</span></td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Backpressure nodes -->
      <section class="card">
        <div class="card-head">
          <h2>Backpressure nodes</h2>
          <span class="count">{{ bpRows.length }}</span>
        </div>
        <div v-if="!bpRows.length" class="state">No backpressure node has been touched in this process yet
          — nodes are created lazily on first use, so this is expected right after a restart.</div>
        <div v-else class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr><th>Node</th><th class="r">Active / Max</th><th class="r">Admitted</th><th class="r">Rejected (lifetime)</th><th>Saturation</th></tr>
            </thead>
            <tbody>
              <tr v-for="b in bpRows" :key="b.name">
                <td><strong>{{ b.name }}</strong></td>
                <td class="r tabular">{{ n(b.active) }} / {{ b.max ?? '—' }}</td>
                <td class="r tabular muted">{{ n(b.admitted) }}</td>
                <td class="r tabular" :class="{ warn: b.rejected > 0 }">{{ n(b.rejected) }}</td>
                <td class="bar-cell">
                  <div class="bar-track">
                    <div class="bar-fill" :class="'tier-' + b.tier" :style="{ width: (b.pct ?? 0) + '%' }"></div>
                  </div>
                  <span class="bar-pct" :class="'tier-' + b.tier">{{ b.pct == null ? 'n/a' : b.pct + '%' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="more">Admission is non-blocking by design, so a rejection here <em>is</em> the wait —
            there is no separate blocking-wait count to add on top.</div>
        </div>
      </section>

      <!-- Circuit breakers -->
      <section class="card">
        <div class="card-head">
          <h2>Circuit breakers</h2>
          <span class="count">{{ breakerRows.length }}</span>
        </div>
        <div v-if="!breakerRows.length" class="state ok">No circuit breaker has tripped or been probed in
          this process yet — breakers are created lazily on first failure.</div>
        <div v-else class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr><th>Dependency</th><th>State</th><th class="r">Opened (lifetime)</th><th class="r">Rejected while open</th></tr>
            </thead>
            <tbody>
              <tr v-for="b in breakerRows" :key="b.name">
                <td><strong>{{ b.name }}</strong></td>
                <td><span class="pill" :class="'tier-' + b.tier">{{ stateLabel(b.state) }}</span></td>
                <td class="r tabular muted">{{ n(b.opened) }}</td>
                <td class="r tabular" :class="{ warn: b.rejected > 0 }">{{ n(b.rejected) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer class="rtm-foot">
        <span>{{ n(counters['tool.executions']) }} tool executions · {{ n(counters['tool.errors']) }} errors this process has seen</span>
        <span class="dot">·</span>
        <span>generated {{ shortDateTime(data.generated_at) }}</span>
        <span class="dot">·</span>
        <span>started {{ shortDateTime(data.started_at) }}</span>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'
import {
  utilizationPct,
  utilizationTier,
  poolTier,
  breakerTier,
  humanizeUptime,
  countBreakerStates,
  breakerSummaryTier,
  sumBackpressureRejected,
  sumBackpressureActive,
  sumPoolQueued,
  aggregatePoolUtilization,
} from './runtimeMetrics'

const loading = ref(true)
const error = ref(false)
const data = ref(null)
const autoRefresh = ref(false)
let timer = null

const POOL_LABELS = {
  llm_stream: 'LLM-stream pool',
  asgi_default: 'ASGI default pool',
  tool_registry: 'Tool-registry executor',
}
const POOL_ORDER = ['llm_stream', 'asgi_default', 'tool_registry']

const pools = computed(() => data.value?.pools || {})
const backpressure = computed(() => data.value?.backpressure || {})
const breakers = computed(() => data.value?.breakers || {})
const counters = computed(() => data.value?.counters || {})

const poolAgg = computed(() => aggregatePoolUtilization(pools.value))
const queuedTotal = computed(() => sumPoolQueued(pools.value))
const bpActiveTotal = computed(() => sumBackpressureActive(backpressure.value))
const bpRejectedTotal = computed(() => sumBackpressureRejected(counters.value))
const breakerCounts = computed(() => countBreakerStates(breakers.value))
const breakerTone = computed(() => breakerSummaryTier(breakerCounts.value))

const kpis = computed(() => {
  if (!data.value) return []
  return [
    { label: 'Uptime', value: humanizeUptime(data.value.uptime_s),
      note: `since ${shortDateTime(data.value.started_at)}`, tone: 'neutral' },
    { label: 'Pool utilization', value: poolAgg.value.pct == null ? 'n/a' : `${poolAgg.value.pct}%`,
      note: `${poolAgg.value.included} of ${poolAgg.value.included + poolAgg.value.excluded} pools contributing`,
      tone: poolAgg.value.tier },
    { label: 'Queued (pools)', value: n(queuedTotal.value),
      note: 'submitted work not yet picked up by a worker thread',
      tone: queuedTotal.value > 0 ? 'amber' : 'green' },
    { label: 'Backpressure rejections', value: n(bpRejectedTotal.value),
      note: `${bpActiveTotal.value} admitted right now · lifetime shed/wait count`,
      tone: bpRejectedTotal.value > 0 ? 'amber' : 'neutral' },
    { label: 'Circuit breakers', value: `${breakerCounts.value.open} open · ${breakerCounts.value.half_open} half-open`,
      note: `${breakerCounts.value.closed} of ${breakerCounts.value.total} closed`,
      tone: breakerTone.value },
  ]
})

const poolRows = computed(() => {
  const names = Object.keys(pools.value)
  const ordered = [...POOL_ORDER.filter((k) => names.includes(k)), ...names.filter((k) => !POOL_ORDER.includes(k))]
  return ordered.map((name) => {
    const p = pools.value[name] || {}
    return {
      name, label: POOL_LABELS[name] || name, started: !!p.started,
      active: p.active, idle: p.idle, threads: p.threads, max: p.max_workers, queued: p.queued,
      pct: utilizationPct(p.active, p.max_workers), tier: poolTier(p),
    }
  })
})

const bpRows = computed(() => Object.entries(backpressure.value).map(([name, node]) => {
  const pct = utilizationPct(node?.active, node?.max_concurrent)
  return {
    name, active: node?.active, max: node?.max_concurrent, pct, tier: utilizationTier(pct),
    admitted: Number(counters.value[`bp.${name}.admitted`]) || 0,
    rejected: Number(counters.value[`bp.${name}.rejected`]) || 0,
  }
}))

const breakerRows = computed(() => Object.entries(breakers.value).map(([name, state]) => ({
  name, state, tier: breakerTier(state),
  opened: Number(counters.value[`breaker.${name}.opened`]) || 0,
  rejected: Number(counters.value[`breaker.${name}.rejected`]) || 0,
})))

function stateLabel(s) {
  const v = String(s || '').toLowerCase()
  return v === 'half_open' ? 'half-open' : (v || 'unknown')
}

const n = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString())
function shortDateTime(d) { try { return d ? new Date(d).toLocaleString() : '—' } catch { return '—' } }

async function load() {
  loading.value = true; error.value = false
  try {
    const { data: d } = await api.get('/admin/ops/runtime-metrics/', { noCache: true })
    data.value = d
  } catch (e) { error.value = true }
  loading.value = false
}

function onAutoToggle() {
  clearInterval(timer)
  if (autoRefresh.value) timer = setInterval(load, 5000)
}

onMounted(load)
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.rtm { padding: 28px 32px 60px; }
.rtm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
.rtm-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.rtm-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 700px; line-height: 1.5; }
.rtm-controls { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.auto { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 13px; border-radius: 9px;
  border: 1px solid #d8e2f0; background: #fff; font-size: 12.5px; font-weight: 700; color: #64748b; cursor: pointer; user-select: none; }
.auto input { position: absolute; opacity: 0; width: 0; height: 0; }
.auto-dot { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; flex-shrink: 0; }
.auto.on { border-color: #c7d2fe; background: #eef2ff; color: #4338ca; }
.auto.on .auto-dot { background: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.18); }

.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; flex-shrink: 0; }
.btn.primary { background: #4f46e5; color: #fff; }
.btn:disabled { opacity: .6; } .btn svg { width: 15px; height: 15px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }

.scope-note { display: flex; align-items: flex-start; gap: 10px; background: #f8fafc; border: 1px solid #e5ebf3;
  border-radius: 12px; padding: 12px 15px; font-size: 12.5px; color: #475569; line-height: 1.5; margin-bottom: 18px; }
.scope-note svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; color: #64748b; }
.scope-note code { background: #eef2f7; border-radius: 4px; padding: 1px 5px; font-size: 11.5px; }

.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 15px 17px; display: flex; flex-direction: column; }
.kpi-label { font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
.kpi-val { font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 7px; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.kpi-note { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.kpi.tone-amber { border-color: #fde68a; background: #fffdf5; }
.kpi.tone-amber .kpi-val { color: #b45309; }
.kpi.tone-red { border-color: #fecaca; background: #fff5f5; }
.kpi.tone-red .kpi-val { color: #dc2626; }
.kpi.tone-green .kpi-val { color: #15803d; }

.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); overflow: hidden; margin-bottom: 18px; }
.card-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #eef2f7; }
.card-head h2 { margin: 0; font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: .04em; }
.count { font-size: 12px; font-weight: 700; color: #64748b; background: #f1f5f9; border-radius: 999px; padding: 3px 10px; font-variant-numeric: tabular-nums; }
.state { padding: 30px; text-align: center; color: #64748b; font-size: 13px; }
.state.ok { color: #15803d; }
.state.err { color: #b45309; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }

.tbl-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 12px 16px; border-bottom: 1px solid #eef2f7; background: #f8fafc; white-space: nowrap; }
.tbl th.r, .tbl td.r { text-align: right; }
.tbl td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.tbl tr:last-child td { border-bottom: 0; }
.tbl td.tabular { font-variant-numeric: tabular-nums; }
.tbl td.warn { color: #b45309; font-weight: 700; }
.muted { color: #94a3b8; }
.more { padding: 10px 16px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }

.bar-cell { display: flex; align-items: center; gap: 10px; min-width: 160px; }
.bar-track { flex: 1; height: 8px; border-radius: 999px; background: #eef2f7; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 999px; transition: width .2s ease; }
.bar-pct { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; width: 44px; text-align: right; flex-shrink: 0; }

.pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 11px; font-size: 11px; font-weight: 800; text-transform: capitalize; }

/* Shared saturation tiers — green (healthy) -> amber (tightening) -> red (at/over the edge) -> unknown
   (never created / never observed in this process, kept visually distinct from "confirmed healthy"). */
.tier-green { color: #15803d; }
.bar-fill.tier-green, .pill.tier-green { background: #16a34a; }
.pill.tier-green { color: #fff; }
.tier-amber { color: #b45309; }
.bar-fill.tier-amber, .pill.tier-amber { background: #d97706; }
.pill.tier-amber { color: #fff; }
.tier-red { color: #dc2626; }
.bar-fill.tier-red, .pill.tier-red { background: #dc2626; }
.pill.tier-red { color: #fff; }
.tier-unknown { color: #94a3b8; }
.bar-fill.tier-unknown, .pill.tier-unknown { background: #cbd5e1; }
.pill.tier-unknown { color: #475569; }
.tone-unknown .kpi-val { color: #64748b; }

.rtm-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; padding: 4px 2px; }
.rtm-foot .dot { color: #cbd5e1; }

@media (max-width: 680px) {
  .rtm { padding: 20px 16px; }
  .rtm-head { flex-direction: column; }
  .bar-cell { min-width: 120px; }
}
</style>
