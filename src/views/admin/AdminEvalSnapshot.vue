<template>
  <div class="es">
    <header class="es-head">
      <div>
        <h1>Eval Snapshot</h1>
        <p>A compact quality panel built from data the platform already records — LLM request log, captured
          run traces, the durable step timeline, the tool-authorization ledger, HITL requests and plan
          approvals. Every section is labeled with the table it truly comes from; nothing is modeled or
          estimated.</p>
      </div>
      <div class="range">
        <button v-for="d in [7, 14, 30, 90]" :key="d" class="range-btn" :class="{ on: days === d }"
                @click="setDays(d)">{{ d }}d</button>
        <button class="btn ghost" @click="load"><Icon icon="lucide:refresh-cw" /> Refresh</button>
      </div>
    </header>

    <div v-if="loading" class="card state">Loading…</div>
    <div v-else-if="error" class="card state err">Couldn’t load. <button class="link" @click="load">Retry</button></div>

    <template v-else-if="snap">
      <!-- KPI cards -->
      <div class="kpis">
        <div class="kpi">
          <div class="kpi-label">LLM calls</div>
          <div class="kpi-value">{{ snap.llm.total }}</div>
          <div class="kpi-sub"><span class="bad-t" v-if="llmErrors">{{ llmErrors }} errors</span><span v-else class="ok-t">no errors</span></div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Avg latency</div>
          <div class="kpi-value">{{ snap.llm.avg_latency_ms != null ? Math.round(snap.llm.avg_latency_ms) + 'ms' : '—' }}</div>
          <div class="kpi-sub">spend {{ snap.llm.total_cost_usd != null ? '$' + Number(snap.llm.total_cost_usd).toFixed(4) : '—' }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Captured traces</div>
          <div class="kpi-value">{{ snap.traces.total }}</div>
          <div class="kpi-sub"><span class="bad-t" v-if="snap.traces.by_outcome.failure">{{ snap.traces.by_outcome.failure }} failed</span><span v-else class="muted">consent-gated capture</span></div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Tool denials</div>
          <div class="kpi-value">{{ snap.tool_ledger.by_decision.DENIED || 0 }}</div>
          <div class="kpi-sub">of {{ snap.tool_ledger.total }} ledger calls<span v-if="snap.tool_ledger.timed_out"> · <span class="bad-t">{{ snap.tool_ledger.timed_out }} timed out</span></span></div>
        </div>
        <div class="kpi">
          <div class="kpi-label">HITL approvals</div>
          <div class="kpi-value">{{ snap.hitl.approvals.approved }}<span class="kpi-dim">/{{ snap.hitl.approvals.completed }}</span></div>
          <div class="kpi-sub"><span class="bad-t" v-if="snap.hitl.approvals.denied">{{ snap.hitl.approvals.denied }} denied</span><span v-if="snap.hitl.approvals.timed_out" class="warn-t"> · {{ snap.hitl.approvals.timed_out }} timed out</span></div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Canonical runs</div>
          <div class="kpi-value">{{ snap.canonical_runs.total }}</div>
          <div class="kpi-sub"><span class="ok-t" v-if="snap.canonical_runs.by_status.completed">{{ snap.canonical_runs.by_status.completed }} completed</span><span class="bad-t" v-if="snap.canonical_runs.by_status.failed"> · {{ snap.canonical_runs.by_status.failed }} failed</span></div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="pane-title">LLM calls per day <span class="src">{{ snap.llm.source }}</span></div>
          <div v-if="!snap.llm.per_day.length" class="state">No LLM calls in this window.</div>
          <table v-else class="tbl">
            <thead><tr><th>Day</th><th class="r">Calls</th><th class="r">Errors</th></tr></thead>
            <tbody>
              <tr v-for="d in snap.llm.per_day" :key="d.day">
                <td>{{ d.day }}</td><td class="r">{{ d.total }}</td>
                <td class="r" :class="{ 'bad-t': d.errors }">{{ d.errors }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="pane-title">Tool authorization <span class="src">{{ snap.tool_ledger.source }}</span></div>
          <div class="pairs">
            <div class="pair" v-for="(n, k) in snap.tool_ledger.by_decision" :key="'d' + k">
              <span :class="['chip', k === 'ALLOWED' ? 'ok' : (k === 'DENIED' ? 'bad' : 'warn')]">{{ k }}</span><strong>{{ n }}</strong>
            </div>
          </div>
          <div class="pairs">
            <div class="pair" v-for="(n, k) in snap.tool_ledger.by_result_status" :key="'r' + k">
              <span class="chip idle">{{ k }}</span><strong>{{ n }}</strong>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="pane-title">Denials by code <span class="src">{{ snap.tool_ledger.source }}</span></div>
          <div v-if="!snap.tool_ledger.denials_by_code.length" class="state">No denials in this window.</div>
          <table v-else class="tbl">
            <thead><tr><th>Denial code</th><th class="r">Count</th></tr></thead>
            <tbody><tr v-for="d in snap.tool_ledger.denials_by_code" :key="d.code"><td>{{ d.code || '(unlabeled)' }}</td><td class="r">{{ d.count }}</td></tr></tbody>
          </table>
        </div>

        <div class="card">
          <div class="pane-title">Top denied tools <span class="src">{{ snap.tool_ledger.source }}</span></div>
          <div v-if="!snap.tool_ledger.top_denied_tools.length" class="state">No denials in this window.</div>
          <table v-else class="tbl">
            <thead><tr><th>Tool</th><th class="r">Denials</th></tr></thead>
            <tbody><tr v-for="d in snap.tool_ledger.top_denied_tools" :key="d.tool"><td>{{ d.tool }}</td><td class="r">{{ d.count }}</td></tr></tbody>
          </table>
        </div>

        <div class="card">
          <div class="pane-title">Step timeline <span class="src">{{ snap.steps.source }}</span></div>
          <table class="tbl">
            <tbody>
              <tr><td>Steps recorded</td><td class="r">{{ snap.steps.total }}</td></tr>
              <tr><td>Distinct turns</td><td class="r">{{ snap.steps.turns }}</td></tr>
              <tr><td>Tool errors</td><td class="r" :class="{ 'bad-t': snap.steps.tool_errors }">{{ snap.steps.tool_errors }}</td></tr>
              <tr><td>Failed steps</td><td class="r" :class="{ 'bad-t': snap.steps.failures }">{{ snap.steps.failures }}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="pane-title">Trace outcomes <span class="src">{{ snap.traces.source }}</span></div>
          <div v-if="!Object.keys(snap.traces.by_outcome).length" class="state">No captured traces in this window.</div>
          <div v-else class="pairs">
            <div class="pair" v-for="(n, k) in snap.traces.by_outcome" :key="k">
              <span :class="['chip', k === 'success' ? 'ok' : (k === 'failure' ? 'bad' : 'idle')]">{{ k || 'no outcome' }}</span><strong>{{ n }}</strong>
            </div>
          </div>
          <div class="note">{{ snap.traces.note }}</div>
        </div>

        <div class="card">
          <div class="pane-title">HITL requests <span class="src">{{ snap.hitl.source }}</span></div>
          <div class="pairs">
            <div class="pair" v-for="(n, k) in snap.hitl.by_status" :key="k">
              <span :class="['chip', k === 'completed' ? 'ok' : (k === 'timeout' ? 'bad' : (k === 'pending' ? 'warn' : 'idle'))]">{{ k }}</span><strong>{{ n }}</strong>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="pane-title">Plan approvals <span class="src">{{ snap.plan_approvals.source }}</span></div>
          <div v-if="!Object.keys(snap.plan_approvals.by_decision).length" class="state">No plan approvals in this window.</div>
          <div v-else class="pairs">
            <div class="pair" v-for="(n, k) in snap.plan_approvals.by_decision" :key="k">
              <span :class="['chip', k === 'approve' ? 'ok' : (k === 'reject' ? 'bad' : 'warn')]">{{ k }}</span><strong>{{ n }}</strong>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="pane-title">Canonical run statuses <span class="src">{{ snap.canonical_runs.source }}</span></div>
          <div v-if="!Object.keys(snap.canonical_runs.by_status).length" class="state">No canonical runs in this window.</div>
          <div v-else class="pairs">
            <div class="pair" v-for="(n, k) in snap.canonical_runs.by_status" :key="k">
              <span :class="['chip', k === 'completed' ? 'ok' : (k === 'failed' ? 'bad' : (k === 'cancelled' ? 'idle' : 'warn'))]">{{ k }}</span><strong>{{ n }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="footer-note">Window: last {{ snap.window_days }} days (since {{ shortTime(snap.since) }}), generated {{ shortTime(snap.generated_at) }}.</div>
    </template>
  </div>
</template>

<script setup>
// Read-only Phase 0 quality panel over /admin/observability/eval-snapshot/. Each section carries its
// backing table name from the API so the numbers are always attributable.
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'

const snap = ref(null)
const loading = ref(true)
const error = ref(false)
const days = ref(7)

const llmErrors = computed(() => {
  const s = snap.value?.llm?.by_status || {}
  return (s.error || 0) + (s.timeout || 0)
})

function shortTime(d) { try { return new Date(d).toLocaleString() } catch { return '' } }
function setDays(d) { days.value = d; load() }

async function load() {
  loading.value = true; error.value = false
  try {
    const { data } = await api.get('/admin/observability/eval-snapshot/', {
      params: { days: days.value }, noCache: true,
    })
    snap.value = data
  } catch (e) { error.value = true }
  loading.value = false
}

onMounted(load)
</script>

<style scoped>
.es { padding: 28px 32px 60px; }
.es-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; flex-wrap: wrap; }
.es-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.es-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 700px; line-height: 1.5; }
.range { display: flex; align-items: center; gap: 8px; }
.range-btn { height: 34px; padding: 0 13px; border-radius: 8px; border: 1px solid #d8e2f0; background: #fff; color: #334155; font-size: 12.5px; font-weight: 800; cursor: pointer; }
.range-btn.on { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 34px; border-radius: 8px; padding: 0 13px; font-size: 12.5px; font-weight: 700; border: 1px solid transparent; cursor: pointer; }
.btn.ghost { background: #fff; border-color: #d8e2f0; color: #334155; }
.btn svg { width: 14px; height: 14px; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }
.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); overflow: hidden; }
.state { padding: 30px; text-align: center; color: #64748b; font-size: 13px; } .state.err { color: #b45309; }
.muted { color: #94a3b8; }
.pane-title { padding: 13px 16px; font-size: 13px; font-weight: 800; border-bottom: 1px solid #eef2f7; background: #f8fafc; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.src { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: none; font-family: ui-monospace, monospace; }

.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; padding: 15px 17px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.kpi-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
.kpi-value { font-size: 26px; font-weight: 850; color: #0f172a; margin-top: 5px; }
.kpi-dim { color: #94a3b8; font-size: 16px; font-weight: 700; }
.kpi-sub { margin-top: 3px; font-size: 11.5px; color: #94a3b8; }
.ok-t { color: #16a34a; font-weight: 700; } .bad-t { color: #dc2626; font-weight: 700; } .warn-t { color: #b45309; font-weight: 700; }

.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 10px 16px; border-bottom: 1px solid #eef2f7; background: #f8fafc; }
.tbl th.r, .tbl td.r { text-align: right; }
.tbl td { padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 12.5px; }
.tbl tr:last-child td { border-bottom: 0; }

.pairs { display: flex; flex-wrap: wrap; gap: 10px; padding: 14px 16px; }
.pair { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; }
.chip { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; text-transform: uppercase; letter-spacing: .02em; }
.chip.ok { background: #dcfce7; color: #16a34a; }
.chip.bad { background: #fee2e2; color: #dc2626; }
.chip.warn { background: #fef3c7; color: #b45309; }
.chip.idle { background: #f1f5f9; color: #64748b; }

.note { padding: 0 16px 13px; color: #94a3b8; font-size: 11.5px; line-height: 1.45; }
.footer-note { margin-top: 16px; color: #94a3b8; font-size: 11.5px; }
@media (max-width: 680px) { .es { padding: 20px 16px; } }
</style>
