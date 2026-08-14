<template>
  <div class="sandboxes-page">
    <header class="page-head">
      <div>
        <h1>Sandboxes</h1>
        <p>
          Isolated cloud machines your agents use to run code, build projects and browse. One is created
          only when a task actually needs to execute something, and it is closed or parked automatically.
        </p>
      </div>
      <label class="mini-select">
        <select v-model.number="days" @change="reload">
          <option :value="7">Last 7 days</option>
          <option :value="30">Last 30 days</option>
          <option :value="90">Last 90 days</option>
        </select>
        <Icon icon="lucide:chevron-down" />
      </label>
    </header>

    <p v-if="loading && !hasLoaded" class="loading-row">Loading sandboxes…</p>

  <!-- Sandbox time. Separate from the LLM cost panels above on purpose: this is PROVIDER
       compute billed by the second, not tokens, and showing a fabricated dollar figure next to real
       LLM costs would be worse than showing none. -->
  <section class="panel sandbox-panel" aria-label="Sandbox usage">
    <div class="panel-head">
      <h2>Sandbox Time</h2>
      <span class="sandbox-capacity" :title="'Weighted capacity in use'">
        <template v-if="!sandboxUsage.capacity?.unlimited">
          {{ sandboxUsage.capacity?.used_weight ?? 0 }} / {{ sandboxUsage.capacity?.limit_weight ?? 0 }} capacity
        </template>
        <template v-else>Unlimited capacity</template>
      </span>
    </div>

    <div class="sandbox-totals">
      <div>
        <strong>{{ sandboxTotals.cost === null ? '—' : formatMoney(sandboxTotals.cost) }}</strong>
        <small>est. compute cost</small>
      </div>
      <div><strong>{{ sandboxTotals.hours_consumed ?? 0 }}h</strong><small>total compute</small></div>
      <div><strong>{{ sandboxTotals.leases ?? 0 }}</strong><small>sandboxes</small></div>
      <div><strong>{{ sandboxTotals.live_leases ?? 0 }}</strong><small>running now</small></div>
    </div>

    <!-- Provenance, not decoration: a surprising bill has to be traceable to the rate this platform
         believed, and the estimate must never be mistaken for the provider's invoice. -->
    <p class="sandbox-note">
      <Icon icon="lucide:info" />
      <span v-if="sandboxRate.configured">
        Estimated from metered running time at
        {{ formatRate(sandboxRate.vcpu_hour) }}/vCPU-hr,
        {{ formatRate(sandboxRate.ram_gib_hour) }}/GiB-hr.
        Your provider invoice is authoritative.
      </span>
      <span v-else>No sandbox rate is configured, so compute is not priced here.</span>
    </p>

    <!-- WHAT MY LIMIT IS, not just what I spent. Spend climbing with no visible ceiling — and no
         hint of where to change it — is the thing this page was missing. -->
    <div v-if="sandboxBudget.priced" class="sandbox-limits">
      <div v-for="p in ['daily', 'monthly']" :key="p" class="limit">
        <div class="limit-head">
          <span>{{ p === 'daily' ? 'Today' : 'This month' }}</span>
          <strong>
            {{ formatMoney(sandboxBudget[p]?.spent) }}
            <template v-if="sandboxBudget[p]?.limit"> / {{ formatMoney(sandboxBudget[p].limit) }}</template>
            <template v-else> / unlimited</template>
          </strong>
        </div>
        <div class="mini-bar wide">
          <i :class="{ hot: (sandboxBudget[p]?.used_pct ?? 0) >= 80 }"
             :style="{ width: Math.min(100, sandboxBudget[p]?.used_pct ?? 0) + '%' }"></i>
        </div>
      </div>
      <p class="limit-source">
        <Icon icon="lucide:shield" />
        {{ sandboxBudget.source === 'default'
          ? 'Platform default limit — create an organization budget to set your own.'
          : `From your ${String(sandboxBudget.source).split(':')[1]} budget.` }}
        Managed in {{ sandboxBudget.managed_in }}.
      </p>
    </div>

    <!-- The lifecycle rules each sandbox type runs under. These are cost and data-retention
         promises, so they belong next to the spend rather than only in a plan document. -->
    <details class="sandbox-policies">
      <summary>Sandbox types &amp; limits</summary>
      <table class="sandbox-table">
        <thead>
          <tr><th>Type</th><th>Idle</th><th>Then</th><th>Max life</th><th>Cost/hr</th><th>Network</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in sandboxPolicies" :key="p.profile">
            <td>{{ p.purpose }}</td>
            <td>{{ p.idle_minutes }} min</td>
            <td><span class="pill" :class="p.idle_action">{{ p.idle_action }}</span></td>
            <td>{{ formatDuration(p.ttl_minutes * 60) }}</td>
            <td>{{ p.cost_per_hour === null ? '—' : formatRate(p.cost_per_hour) }}</td>
            <td><small>{{ p.network }}</small></td>
          </tr>
        </tbody>
      </table>
    </details>

    <table v-if="sandboxLeases.length" class="sandbox-table">
      <thead>
        <tr><th>Purpose</th><th>Agent</th><th>Where</th><th>Status</th><th>Time used</th><th>Est. cost</th><th>When idle</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="l in sandboxLeases" :key="l.lease_id" :class="{ live: l.live }">
          <td>{{ l.purpose }}</td>
          <td>
            <span v-if="l.agent">{{ l.agent.name }}</span>
            <small v-else class="muted">—</small>
          </td>
          <td>
            <!-- A link, not an id: the point of this column is getting to the chat that created the
                 sandbox. A headless run has no chat to open, so it says so rather than showing a dead
                 link or an empty cell the user has to interpret. -->
            <router-link v-if="l.conversation?.id" :to="`/dashboard/chat/${l.conversation.id}`"
                         class="conv-link" :title="l.conversation.title">
              {{ l.conversation.title }}
            </router-link>
            <small v-else class="muted">
              Background run<template v-if="l.conversation?.run_id"> · {{ l.conversation.run_id.slice(0, 8) }}</template>
            </small>
          </td>
          <td><span class="pill" :class="l.state_label">{{ l.state_label }}</span></td>
          <td>{{ formatDuration(l.seconds_consumed) }}</td>
          <td>{{ l.cost === null ? '—' : formatMoney(l.cost) }}</td>
          <td><small>{{ l.idle_action }}</small></td>
          <td class="sandbox-actions">
            <!-- Only a LIVE sandbox can be closed; a paused one still holds its filesystem and is
                 resumable, so closing it is destructive and needs the same confirm. -->
            <button
              v-if="l.state !== 'TERMINATED'"
              class="close-btn"
              :disabled="closingLease === l.lease_id"
              @click="onCloseSandbox(l)"
            >
              {{ closingLease === l.lease_id ? 'Closing…' : 'Close' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="sandbox-empty">No sandboxes used in this period.</p>
  </section>
  </div>
</template>

<script setup>
import { onMounted, computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import { useNotify } from '../composables/useNotify'
import { useConfirm } from '../composables/useConfirm'

const notify = useNotify()
const confirm = useConfirm()

const days = ref(30)
const loading = ref(false)
const hasLoaded = ref(false)
const closingLease = ref('')
const sandboxUsage = ref({})

const sandboxTotals = computed(() => sandboxUsage.value?.totals || {})
const sandboxLeases = computed(() => sandboxUsage.value?.leases || [])
const sandboxRate = computed(() => sandboxUsage.value?.rate_card || {})
const sandboxBudget = computed(() => sandboxUsage.value?.budget || {})
const sandboxPolicies = computed(() => sandboxUsage.value?.policies || [])

async function reload() {
  loading.value = true
  try {
    const res = await api.getSandboxUsage({ days: days.value })
    sandboxUsage.value = res.data || {}
  } catch (e) {
    // A deployment with no sandbox provider must render an empty page, not an error banner.
    sandboxUsage.value = {}
  } finally {
    hasLoaded.value = true
    loading.value = false
  }
}

// Closing DESTROYS the sandbox and everything in it that was not exported — a cloned repo, uncommitted
// edits, installed packages. Irreversible, so it is confirmed, and the confirm names what is lost rather
// than asking a generic "are you sure?".
async function onCloseSandbox(lease) {
  const ok = await confirm({
    title: 'Close this sandbox?',
    message: `"${lease.purpose}" will be destroyed along with any files in it that were not saved or `
      + 'exported. This cannot be undone.',
    confirmText: 'Close sandbox',
    danger: true,
  })
  if (!ok) return
  closingLease.value = lease.lease_id
  try {
    await api.terminateSandboxLease(lease.lease_id)
    notify.success('Sandbox closed')
    await reload()
  } catch (e) {
    notify.error(e?.response?.data?.detail || 'Could not close the sandbox')
  } finally {
    closingLease.value = ''
  }
}

// Seconds → the shortest honest reading. A raw "1540s" makes the user do arithmetic to learn it is
// 25 minutes.
function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  const h = Math.floor(s / 3600)
  return `${h}h ${Math.floor((s % 3600) / 60)}m`
}

function formatMoney(value) {
  const n = Number(value || 0)
  // A non-zero amount must never render as "$0.00" — sub-cent spend is real spend.
  if (n > 0 && n < 0.005) return '<$0.01'
  return `$${n.toFixed(2)}`
}

// Rates are fractions of a cent per hour, so the money formatter (2dp) would render every one as $0.00.
function formatRate(value) {
  const n = Number(value) || 0
  return `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`
}

onMounted(reload)
</script>

<style scoped>
.sandboxes-page {
  padding: 24px;
  max-width: 1180px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.page-head h1 {
  margin: 0 0 4px;
  color: #13223a;
  font-size: 20px;
  font-weight: 850;
}

.page-head p {
  margin: 0;
  max-width: 640px;
  color: #64748b;
  font-size: 12.5px;
  line-height: 1.5;
}

.mini-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #e6edf7;
  border-radius: 8px;
  background: #fff;
}

.mini-select select {
  border: 0;
  background: transparent;
  font-size: 12px;
  font-weight: 700;
  color: #273a5a;
  outline: none;
}

.loading-row {
  color: #64748b;
  font-size: 12.5px;
}

.panel {
  padding: 20px;
  border: 1px solid #e6edf7;
  border-radius: 12px;
  background: #fff;
  min-width: 0;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-head h2 {
  margin: 0;
  color: #13223a;
  font-size: 15px;
  font-weight: 850;
}

/* ── Sandbox time ───────────────────────────────────────────────────────────
   Same panel shell as the LLM cards so it reads as one page, but its own table:
   the unit here is provider compute seconds, not tokens or dollars. */
.sandbox-panel {
  margin-bottom: 18px;
}

.sandbox-capacity {
  color: #273a5a;
  font-size: 12px;
  font-weight: 750;
}

.sandbox-totals {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.sandbox-totals div {
  display: flex;
  flex-direction: column;
}

.sandbox-totals strong {
  color: #13223a;
  font-size: 20px;
  font-weight: 850;
  line-height: 1.2;
}

.sandbox-totals small {
  color: #64748b;
  font-size: 11px;
  font-weight: 650;
}

.sandbox-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px;
  color: #64748b;
  font-size: 12px;
}

.sandbox-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.sandbox-table th {
  text-align: left;
  padding: 6px 8px;
  color: #64748b;
  font-size: 11px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 1px solid #e6edf7;
}

.sandbox-table td {
  padding: 8px;
  border-bottom: 1px solid #f1f5fb;
  color: #273a5a;
  vertical-align: middle;
}

.sandbox-table tr.live td {
  background: #f6fbff;
}

.sandbox-table .pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2f8;
  color: #475569;
  font-size: 11px;
  font-weight: 750;
}

.sandbox-table .pill.running { background: #e6f7ee; color: #0f7a4d; }
.sandbox-table .pill.paused  { background: #fff4e5; color: #9a5b00; }
.sandbox-table .pill.failed  { background: #fdecec; color: #b42318; }
.sandbox-table .pill.closed  { background: #eef2f8; color: #64748b; }

.mini-bar {
  width: 72px;
  height: 6px;
  border-radius: 999px;
  background: #eef2f8;
  overflow: hidden;
}

.mini-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #3b82f6, #6366f1);
}

.sandbox-limits {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 28px;
  margin-bottom: 14px;
}

.limit {
  min-width: 210px;
  flex: 1 1 210px;
}

.limit-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 5px;
  color: #64748b;
  font-size: 11.5px;
  font-weight: 700;
}

.limit-head strong {
  color: #13223a;
  font-size: 13px;
  font-weight: 850;
}

.mini-bar.wide {
  width: 100%;
  height: 7px;
}

.mini-bar i.hot {
  background: linear-gradient(90deg, #f59e0b, #ef4444);
}

.limit-source {
  flex: 1 1 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: #64748b;
  font-size: 11.5px;
}

.sandbox-policies {
  margin-bottom: 14px;
}

.sandbox-policies summary {
  cursor: pointer;
  color: #273a5a;
  font-size: 12px;
  font-weight: 750;
  padding: 4px 0;
}

.sandbox-policies[open] summary {
  margin-bottom: 6px;
}

.sandbox-actions {
  text-align: right;
  white-space: nowrap;
}

.close-btn {
  padding: 3px 10px;
  border: 1px solid #e6edf7;
  border-radius: 999px;
  background: #fff;
  color: #b42318;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;
}

.close-btn:hover:not(:disabled) {
  background: #fdecec;
  border-color: #f5c9c4;
}

.close-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.conv-link {
  color: #2563eb;
  text-decoration: none;
  font-weight: 700;
  display: inline-block;
  max-width: 210px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.conv-link:hover {
  text-decoration: underline;
}

.sandbox-table .muted {
  color: #94a3b8;
}

.sandbox-empty {
  margin: 0;
  color: #64748b;
  font-size: 12.5px;
}

@media (max-width: 720px) {
  .sandbox-totals { gap: 18px; }
  .sandbox-table th:nth-child(5),
  .sandbox-table td:nth-child(5) { display: none; }
}
</style>
