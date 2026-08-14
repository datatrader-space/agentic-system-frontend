<template>
  <div class="tw">
    <header class="tw-head">
      <div>
        <h1>Trace Waterfall</h1>
        <p>Per-run observability over the captured trace ledger (ARTC), the durable step timeline and the
          tool-authorization ledger. Timings are shown exactly as recorded — measured tool durations where the
          capture holds one, capture-write offsets everywhere else. Receipts below are the unsigned completion
          payloads from the durable tool-call records.</p>
      </div>
      <button class="btn ghost" @click="loadRuns"><Icon icon="lucide:refresh-cw" /> Refresh</button>
    </header>

    <div class="split">
      <!-- Left: recent runs index -->
      <aside class="card runs">
        <div class="pane-title">Recent runs <span class="muted">({{ runs.length }})</span></div>
        <div v-if="runsLoading" class="state">Loading…</div>
        <div v-else-if="runsError" class="state err">Couldn’t load. <button class="link" @click="loadRuns">Retry</button></div>
        <div v-else-if="!runs.length" class="state">No captured traces yet (capture is consent-gated).</div>
        <button v-for="r in runs" :key="r.trace_id" class="run-row" :class="{ sel: r.trace_id === selectedId }"
                @click="select(r)">
          <div class="run-top">
            <span class="run-name">{{ r.agent?.name || 'agent' }} <span class="muted">· turn {{ r.turn_id || '—' }}</span></span>
            <span :class="['chip', outcomeClass(r.outcome_status)]">{{ r.outcome_status || 'n/a' }}</span>
          </div>
          <div class="run-sub">
            <span>{{ r.user?.username || '—' }}</span>
            <span>conv {{ r.conversation_id ?? '—' }}</span>
            <span>{{ r.event_count }} events</span>
            <span v-if="r.capture_window_ms != null">{{ fmtMs(r.capture_window_ms) }}</span>
            <span>{{ shortTime(r.created_at) }}</span>
          </div>
        </button>
      </aside>

      <!-- Right: waterfall + ledger + receipts -->
      <section class="detail">
        <div v-if="!selectedId" class="card state">Select a run to see its waterfall.</div>
        <template v-else>
          <div class="card">
            <div class="pane-title">
              Waterfall
              <span class="muted" v-if="detail">— {{ detail.source === 'run_trace' ? 'captured trace' : 'conversation steps (no trace captured)' }},
                window {{ fmtMs(detail.capture_window_ms) }}</span>
            </div>
            <div v-if="detailLoading" class="state">Loading…</div>
            <div v-else-if="detailError" class="state err">Couldn’t load this run. <button class="link" @click="loadDetail(selectedId)">Retry</button></div>
            <template v-else-if="detail">
              <!-- REAL measured spans (span_timings event) — true execution offsets/durations; shown
                   ABOVE the capture stream whenever the turn persisted them. -->
              <div v-if="detail.real_spans && detail.real_spans.length" class="wf wf-real">
                <div class="wf-real-head">
                  Measured execution spans
                  <span class="muted">— {{ detail.real_spans_source }},
                    total {{ fmtMs(detail.real_total_turn_ms) }}</span>
                </div>
                <div v-for="(s, i) in detail.real_spans" :key="'rs' + i" class="wf-row">
                  <div class="wf-label"><span class="wf-name" :title="s.name">{{ s.name }}</span></div>
                  <div class="wf-track">
                    <div class="wf-bar ok" :style="realBarStyle(s)"></div>
                  </div>
                  <div class="wf-ms">{{ fmtMs(s.duration_ms) }}</div>
                </div>
              </div>
              <div class="wf">
                <div v-for="e in detail.events" :key="e.turn_id + '-' + e.seq" class="wf-row">
                  <div class="wf-label">
                    <span class="seq">#{{ e.seq }}</span>
                    <span :class="['chip', 'type', typeClass(e.event_type)]">{{ e.event_type }}</span>
                    <span class="wf-name" :title="e.name">{{ e.name }}</span>
                    <span v-if="e.status" :class="['dot', statusClass(e.status)]" :title="e.status"></span>
                  </div>
                  <div class="wf-track">
                    <div v-if="e.duration_ms != null" class="wf-bar" :class="statusClass(e.status)" :style="barStyle(e)"></div>
                    <div v-else class="wf-mark" :style="markStyle(e)" title="no measured duration — capture-write offset only"></div>
                  </div>
                  <div class="wf-ms">
                    <template v-if="e.duration_ms != null">{{ fmtMs(e.duration_ms) }}</template>
                    <template v-else><span class="muted">@ +{{ fmtMs(e.captured_offset_ms) }}</span></template>
                  </div>
                </div>
              </div>
              <div class="note"><Icon icon="lucide:info" /> {{ detail.timing_note }}</div>
            </template>
          </div>

          <div class="card" v-if="detail && detail.tool_ledger">
            <div class="pane-title">Authorization ledger <span class="muted">({{ detail.tool_ledger.length }})</span></div>
            <div v-if="!detail.tool_ledger.length" class="state">No ledger rows for this conversation.</div>
            <table v-else class="tbl">
              <thead><tr><th>Tool</th><th>Decision</th><th>Result</th><th>Auth</th><th>Total</th><th>Source</th><th>Started</th></tr></thead>
              <tbody>
                <tr v-for="l in detail.tool_ledger" :key="l.event_id">
                  <td><strong>{{ l.tool }}</strong><div v-if="l.denial_code" class="sub">{{ l.denial_code }}</div></td>
                  <td><span :class="['chip', decisionClass(l.decision)]">{{ l.decision }}</span></td>
                  <td><span :class="['chip', resultClass(l.result_status)]">{{ l.result_status }}</span></td>
                  <td class="muted">{{ l.auth_ms != null ? fmtMs(l.auth_ms) : '—' }}</td>
                  <td class="muted">{{ l.total_ms != null ? fmtMs(l.total_ms) : '—' }}</td>
                  <td class="muted">{{ l.request_source }}</td>
                  <td class="muted">{{ shortTime(l.started_at) }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="detail.ledger_note" class="note"><Icon icon="lucide:info" /> {{ detail.ledger_note }}</div>
          </div>

          <div class="card">
            <div class="pane-title">Tool receipts
              <span v-if="receipts" class="muted">({{ receipts.count }})</span>
            </div>
            <div v-if="receiptsLoading" class="state">Loading…</div>
            <div v-else-if="receiptsMissing" class="state">No canonical run (and therefore no receipts) is linked to this trace.</div>
            <template v-else-if="receipts">
              <div class="verify-banner">
                <Icon icon="lucide:shield-question" />
                <span><strong>Unsigned.</strong> {{ receipts.verification.reason }}</span>
              </div>
              <div v-if="!receipts.receipts.length" class="state">{{ receipts.note || 'No receipts recorded for this run.' }}</div>
              <div v-for="rec in receipts.receipts" :key="rec.tool_call_id" class="receipt">
                <div class="receipt-head">
                  <span :class="['chip', resultClass(rec.state)]">{{ rec.state }}</span>
                  <strong>{{ rec.tool_name || rec.tool_call_id }}</strong>
                  <span class="muted">{{ rec.tool_call_id }}</span>
                  <span v-if="rec.is_mutation" class="chip type t-tool">mutation</span>
                  <span class="grow"></span>
                  <span :class="['chip', verifyClass(rec.verified)]">
                    <Icon :icon="rec.verified === true ? 'lucide:shield-check' : (rec.verified === false ? 'lucide:shield-x' : 'lucide:shield-question')" />
                    {{ rec.verified === true ? 'verified' : (rec.verified === false ? 'invalid' : 'unsigned') }}
                  </span>
                </div>
                <div class="receipt-meta">
                  <span v-if="rec.exec_ms != null">exec {{ fmtMs(rec.exec_ms) }}</span>
                  <span v-if="rec.approval_scope">scope {{ rec.approval_scope }}</span>
                  <span>rollback {{ rec.rollback_capability }}</span>
                  <span v-if="rec.completed_at">{{ shortTime(rec.completed_at) }}</span>
                </div>
                <pre v-if="rec.receipt" class="receipt-json">{{ pretty(rec.receipt) }}</pre>
                <pre v-if="rec.error" class="receipt-json err-json">{{ pretty(rec.error) }}</pre>
              </div>
            </template>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup>
// Read-only Phase 0 observability page: recent-runs index (left) + the selected run's waterfall,
// authorization-ledger rows and unsigned tool receipts (right). All data comes from the staff-only
// /admin/observability/* endpoints; nothing here mutates state.
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../../services/api'

const runs = ref([])
const runsLoading = ref(true)
const runsError = ref(false)
const selectedId = ref(null)
const detail = ref(null)
const detailLoading = ref(false)
const detailError = ref(false)
const receipts = ref(null)
const receiptsLoading = ref(false)
const receiptsMissing = ref(false)

function fmtMs(ms) {
  if (ms == null) return '—'
  if (ms >= 60000) return (ms / 60000).toFixed(1) + 'min'
  if (ms >= 1000) return (ms / 1000).toFixed(2) + 's'
  return Math.round(ms * 10) / 10 + 'ms'
}
function shortTime(d) { try { return new Date(d).toLocaleString() } catch { return '' } }
function pretty(o) { try { return JSON.stringify(o, null, 2) } catch { return String(o) } }

function outcomeClass(s) { return s === 'success' ? 'ok' : (s === 'failure' ? 'bad' : (s === 'partial' ? 'warn' : 'idle')) }
function statusClass(s) { return s === 'success' ? 'ok' : ((s === 'failure' || s === 'error') ? 'bad' : (s === 'partial' ? 'warn' : 'idle')) }
function decisionClass(d) { return d === 'ALLOWED' ? 'ok' : (d === 'DENIED' ? 'bad' : 'warn') }
function resultClass(s) {
  if (s === 'SUCCEEDED') return 'ok'
  if (s === 'FAILED' || s === 'TIMED_OUT' || s === 'CANCELLED') return 'bad'
  if (s === 'DISPATCHED' || s === 'UNKNOWN') return 'warn'
  return 'idle'
}
function verifyClass(v) { return v === true ? 'ok' : (v === false ? 'bad' : 'idle') }
function typeClass(t) {
  if (t === 'llm_call') return 't-llm'
  if (t === 'reasoning') return 't-reason'
  if (t === 'tool_call' || t === 'tool_result' || t === 'tool_error') return 't-tool'
  if (t && t.startsWith('plan')) return 't-plan'
  return 't-other'
}

function barStyle(e) {
  const w = detail.value?.capture_window_ms || 0
  if (!w || w <= 0) return { left: '0%', width: '2%' }
  const left = Math.min(99, Math.max(0, ((e.captured_offset_ms || 0) / w) * 100))
  const width = Math.max(0.6, Math.min(100 - left, ((e.duration_ms || 0) / w) * 100))
  return { left: left + '%', width: width + '%' }
}
function markStyle(e) {
  const w = detail.value?.capture_window_ms || 0
  const left = (!w || w <= 0) ? 0 : Math.min(99.4, Math.max(0, ((e.captured_offset_ms || 0) / w) * 100))
  return { left: left + '%' }
}
// Real measured spans scale on total_turn_ms (true execution time), not the capture window.
function realBarStyle(s) {
  const w = detail.value?.real_total_turn_ms || 0
  if (!w || w <= 0) return { left: '0%', width: '2%' }
  const left = Math.min(99, Math.max(0, ((s.start_offset_ms || 0) / w) * 100))
  const width = Math.max(0.6, Math.min(100 - left, ((s.duration_ms || 0) / w) * 100))
  return { left: left + '%', width: width + '%' }
}

async function loadRuns() {
  runsLoading.value = true; runsError.value = false
  try {
    const { data } = await api.get('/admin/observability/traces/', { noCache: true })
    runs.value = data.traces || []
    if (!selectedId.value && runs.value.length) select(runs.value[0])
  } catch (e) { runsError.value = true }
  runsLoading.value = false
}

function select(r) {
  selectedId.value = r.trace_id
  loadDetail(r.trace_id)
  loadReceipts(r)
}

async function loadDetail(traceId) {
  detailLoading.value = true; detailError.value = false; detail.value = null
  try {
    const { data } = await api.get(`/admin/observability/traces/${traceId}/`, { noCache: true })
    detail.value = data
  } catch (e) { detailError.value = true }
  detailLoading.value = false
}

async function loadReceipts(r) {
  receipts.value = null; receiptsMissing.value = false; receiptsLoading.value = true
  // Prefer the linked canonical run; fall back to the conversation (latest canonical run).
  const ref_ = r.agent_run_id || r.conversation_id
  if (ref_ == null) { receiptsMissing.value = true; receiptsLoading.value = false; return }
  try {
    const { data } = await api.get(`/admin/observability/runs/${ref_}/receipts/`, { noCache: true })
    receipts.value = data
  } catch (e) { receiptsMissing.value = true }
  receiptsLoading.value = false
}

onMounted(loadRuns)
</script>

<style scoped>
.tw { padding: 28px 32px 60px; }
.tw-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
.tw-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.tw-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 720px; line-height: 1.5; }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; }
.btn.ghost { background: #fff; border-color: #d8e2f0; color: #334155; }
.btn svg { width: 15px; height: 15px; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }
.card { background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15,23,42,.04); overflow: hidden; }
.state { padding: 34px; text-align: center; color: #64748b; font-size: 13px; } .state.err { color: #b45309; }
.muted { color: #94a3b8; font-weight: 500; }
.sub { color: #94a3b8; font-size: 11px; margin-top: 2px; }
.pane-title { padding: 13px 16px; font-size: 13px; font-weight: 800; border-bottom: 1px solid #eef2f7; background: #f8fafc; }

.split { display: grid; grid-template-columns: 340px 1fr; gap: 18px; align-items: start; }
.runs { max-height: 76vh; overflow-y: auto; }
.run-row { display: block; width: 100%; text-align: left; border: 0; background: transparent; padding: 11px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
.run-row:hover { background: #f8fafc; } .run-row.sel { background: #eef2ff; }
.run-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.run-name { font-size: 13px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.run-sub { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; color: #94a3b8; font-size: 11px; }

.detail { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.wf { padding: 12px 16px 6px; }
.wf-real { border-bottom: 1px dashed #e5ebf3; margin-bottom: 4px; }
.wf-real-head { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: #16a34a; padding: 2px 0 8px; }
.wf-row { display: grid; grid-template-columns: 300px 1fr 78px; align-items: center; gap: 10px; padding: 4px 0; }
.wf-label { display: flex; align-items: center; gap: 7px; min-width: 0; }
.seq { color: #94a3b8; font-size: 11px; font-weight: 700; width: 26px; flex: none; }
.wf-name { font-size: 12.5px; font-weight: 600; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wf-track { position: relative; height: 14px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
.wf-bar { position: absolute; top: 0; bottom: 0; border-radius: 5px; background: #94a3b8; }
.wf-bar.ok { background: #34d399; } .wf-bar.bad { background: #f87171; } .wf-bar.warn { background: #fbbf24; } .wf-bar.idle { background: #a5b4fc; }
.wf-mark { position: absolute; top: 3px; width: 8px; height: 8px; border-radius: 50%; background: #6366f1; opacity: .75; }
.wf-ms { font-size: 11.5px; color: #334155; font-weight: 700; text-align: right; white-space: nowrap; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.dot.ok { background: #10b981; } .dot.bad { background: #ef4444; } .dot.warn { background: #f59e0b; } .dot.idle { background: #cbd5e1; }

.chip { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; text-transform: uppercase; letter-spacing: .02em; display: inline-flex; align-items: center; gap: 4px; }
.chip svg { width: 12px; height: 12px; }
.chip.ok { background: #dcfce7; color: #16a34a; }
.chip.bad { background: #fee2e2; color: #dc2626; }
.chip.warn { background: #fef3c7; color: #b45309; }
.chip.idle { background: #f1f5f9; color: #64748b; }
.chip.type { text-transform: none; font-weight: 700; }
.t-llm { background: #eef2ff; color: #4f46e5; } .t-tool { background: #e0f2fe; color: #0369a1; }
.t-reason { background: #f5f3ff; color: #7c3aed; } .t-plan { background: #ccfbf1; color: #0d9488; }
.t-other { background: #f1f5f9; color: #64748b; }

.note { display: flex; gap: 7px; align-items: flex-start; padding: 10px 16px 14px; color: #94a3b8; font-size: 11.5px; line-height: 1.45; }
.note svg { width: 13px; height: 13px; flex: none; margin-top: 1px; }

.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 10px 16px; border-bottom: 1px solid #eef2f7; background: #f8fafc; }
.tbl td { padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 12.5px; vertical-align: middle; }
.tbl tr:last-child td { border-bottom: 0; }

.verify-banner { display: flex; gap: 8px; align-items: flex-start; margin: 12px 16px 0; padding: 10px 12px; border-radius: 9px; background: #f8fafc; border: 1px solid #e5ebf3; color: #64748b; font-size: 12px; line-height: 1.45; }
.verify-banner svg { width: 15px; height: 15px; flex: none; margin-top: 1px; color: #94a3b8; }
.receipt { margin: 12px 16px; border: 1px solid #eef2f7; border-radius: 10px; padding: 12px 14px; }
.receipt-head { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; font-size: 13px; }
.receipt-head .grow { flex: 1; }
.receipt-meta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px; color: #94a3b8; font-size: 11.5px; }
.receipt-json { margin: 8px 0 0; padding: 10px 12px; background: #f8fafc; border-radius: 8px; font-size: 11.5px; color: #334155; overflow-x: auto; max-height: 220px; }
.err-json { background: #fef2f2; color: #b91c1c; }

@media (max-width: 1080px) { .split { grid-template-columns: 1fr; } .runs { max-height: 300px; } .wf-row { grid-template-columns: 180px 1fr 70px; } }
@media (max-width: 680px) { .tw { padding: 20px 16px; } }
</style>
