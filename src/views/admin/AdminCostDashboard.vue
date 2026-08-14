<template>
  <div class="cd">
    <header class="cd-head">
      <div>
        <h1>Cost per Organization</h1>
        <p>Daily LLM spend attributed per organization ($/turn) — a turn is one user message. Attribution
          follows the requesting user (falling back to the conversation owner), so a user in several orgs
          counts toward each; the platform totals row is computed from the raw log and never double-counts.</p>
      </div>
      <div class="cd-controls">
        <div class="seg">
          <button v-for="d in [7, 30, 90]" :key="d" :class="{ on: days === d }" @click="setDays(d)">{{ d }}d</button>
        </div>
        <button class="btn primary" :disabled="loading" @click="load">
          <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" /> Refresh
        </button>
      </div>
    </header>

    <!-- Platform headline -->
    <div v-if="data" class="kpis">
      <div class="kpi">
        <span class="kpi-label">Platform spend</span>
        <span class="kpi-val">{{ usd(pt.cost_usd) }}</span>
        <span class="kpi-note">last {{ data.period_days }} days</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Turns</span>
        <span class="kpi-val">{{ num(pt.turns) }}</span>
        <span class="kpi-note">user messages</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Cost / turn</span>
        <span class="kpi-val">{{ pt.cost_per_turn != null ? usd(pt.cost_per_turn) : '—' }}</span>
        <span class="kpi-note">platform average</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Tokens</span>
        <span class="kpi-val">{{ compact(pt.tokens) }}</span>
        <span class="kpi-note">{{ num(pt.calls) }} LLM calls</span>
      </div>
    </div>

    <section class="card">
      <div v-if="loading && !data" class="state">Loading…</div>
      <div v-else-if="error" class="state err">Couldn’t load. <button class="link" @click="load">Retry</button></div>
      <div v-else-if="data && !data.orgs.length" class="state">No LLM spend recorded in the last {{ data.period_days }} days.</div>
      <div v-else-if="data" class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Organization</th><th>Members</th><th>Daily spend</th>
              <th class="r">Turns</th><th class="r">Cost</th><th class="r">$ / turn</th><th class="r">Tokens</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in data.orgs" :key="o.org_id">
              <td>
                <strong>{{ o.org_name }}</strong>
                <span v-if="o.is_personal" class="tag">personal</span>
                <div class="sub">{{ o.org_slug }}</div>
              </td>
              <td class="muted">{{ o.members }}</td>
              <td>
                <div class="bars" role="img" :aria-label="`Daily spend for ${o.org_name}`">
                  <div v-for="d in data.dates" :key="d" class="bar-slot"
                       :title="barTitle(o, d)">
                    <div class="bar" :style="{ height: barHeight(o, d) }"></div>
                  </div>
                </div>
              </td>
              <td class="r">{{ num(o.totals.turns) }}</td>
              <td class="r strong">{{ usd(o.totals.cost_usd) }}</td>
              <td class="r">{{ o.totals.cost_per_turn != null ? usd(o.totals.cost_per_turn) : '—' }}</td>
              <td class="r muted">{{ compact(o.totals.tokens) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr v-if="hasUnattributed">
              <td colspan="3"><em class="muted">Unattributed (no user on the log row)</em></td>
              <td class="r">{{ num(data.unattributed.turns) }}</td>
              <td class="r">{{ usd(data.unattributed.cost_usd) }}</td>
              <td class="r">—</td>
              <td class="r muted">{{ compact(data.unattributed.tokens) }}</td>
            </tr>
            <tr class="totals">
              <td colspan="3"><strong>Platform totals</strong></td>
              <td class="r"><strong>{{ num(pt.turns) }}</strong></td>
              <td class="r"><strong>{{ usd(pt.cost_usd) }}</strong></td>
              <td class="r"><strong>{{ pt.cost_per_turn != null ? usd(pt.cost_per_turn) : '—' }}</strong></td>
              <td class="r"><strong>{{ compact(pt.tokens) }}</strong></td>
            </tr>
          </tfoot>
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

const pt = computed(() => data.value?.platform_totals || {})
const hasUnattributed = computed(() => (data.value?.unattributed?.cost_usd || 0) > 0
  || (data.value?.unattributed?.calls || 0) > 0)

// One shared scale across every org row so bar heights are comparable between orgs.
const maxDayCost = computed(() => {
  let m = 0
  for (const o of data.value?.orgs || []) for (const d of o.days) m = Math.max(m, d.cost_usd)
  return m
})
const dayMaps = computed(() => {
  const out = {}
  for (const o of data.value?.orgs || []) {
    out[o.org_id] = Object.fromEntries(o.days.map((d) => [d.date, d]))
  }
  return out
})

function barHeight(o, date) {
  const v = dayMaps.value[o.org_id]?.[date]?.cost_usd || 0
  if (!v || !maxDayCost.value) return '0px'
  return `${Math.max(2, Math.round((v / maxDayCost.value) * 36))}px`
}
function barTitle(o, date) {
  const d = dayMaps.value[o.org_id]?.[date]
  return d ? `${date} — ${usd(d.cost_usd)} · ${d.turns} turn(s) · ${num(d.tokens)} tokens` : `${date} — no spend`
}

const num = (n) => (n ?? 0).toLocaleString()
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
    const { data: d } = await api.get('/admin/ops/cost-per-org/', { params: { days: days.value }, noCache: true })
    data.value = d
  } catch (e) { error.value = true }
  loading.value = false
}
function setDays(d) { if (days.value !== d) { days.value = d; load() } }

onMounted(load)
</script>

<style scoped>
.cd { padding: 28px 32px 60px; }
.cd-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.cd-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.cd-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 680px; line-height: 1.5; }
.cd-controls { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.seg { display: inline-flex; border: 1px solid #d8e2f0; border-radius: 9px; overflow: hidden; background: #fff; }
.seg button { border: 0; background: transparent; padding: 0 13px; height: 36px; font-size: 12.5px; font-weight: 700; color: #64748b; cursor: pointer; }
.seg button + button { border-left: 1px solid #e5ebf3; }
.seg button.on { background: #4f46e5; color: #fff; }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; }
.btn.primary { background: #4f46e5; color: #fff; }
.btn:disabled { opacity: .6; } .btn svg { width: 15px; height: 15px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }

.kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 15px 17px; display: flex; flex-direction: column; }
.kpi-label { font-size: 11.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
.kpi-val { font-size: 26px; font-weight: 800; color: #0f172a; margin-top: 7px; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.kpi-note { font-size: 12px; color: #94a3b8; margin-top: 4px; }

.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); overflow: hidden; }
.state { padding: 44px; text-align: center; color: #64748b; } .state.err { color: #b45309; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }
.tbl-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 12px 16px; border-bottom: 1px solid #eef2f7; background: #f8fafc; white-space: nowrap; }
.tbl th.r, .tbl td.r { text-align: right; }
.tbl td { padding: 13px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: middle; }
.tbl tbody tr:last-child td { border-bottom: 1px solid #eef2f7; }
.tbl td.strong { font-weight: 700; font-variant-numeric: tabular-nums; }
.tbl tfoot td { border-bottom: 0; background: #f8fafc; }
.tbl tfoot tr.totals td { border-top: 1px solid #e5ebf3; }
.sub { color: #94a3b8; font-size: 11.5px; margin-top: 3px; }
.muted { color: #94a3b8; }
.tag { margin-left: 8px; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 850; text-transform: uppercase; letter-spacing: .03em; background: #f1f5f9; color: #64748b; }

/* per-day mini bars — single sequential hue (spend magnitude), 2px gaps, rounded data-ends */
.bars { display: flex; align-items: flex-end; gap: 2px; height: 38px; min-width: 140px; max-width: 340px; }
.bar-slot { flex: 1 1 0; min-width: 2px; height: 100%; display: flex; align-items: flex-end; cursor: default; }
.bar { width: 100%; background: #4f46e5; border-radius: 2px 2px 0 0; transition: background .12s; }
.bar-slot:hover .bar { background: #312e81; }

@media (max-width: 680px) { .cd { padding: 20px 16px; } .cd-head { flex-direction: column; } }
</style>
