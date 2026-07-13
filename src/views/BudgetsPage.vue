<template>
  <main class="budgets-page">
    <section class="budgets-main">
      <header class="page-head">
        <div>
          <h1>Budgets</h1>
          <p>Set limits, apply rules, and monitor usage across your workspace.</p>
        </div>
        <div class="head-actions">
          <select v-if="store.organizations.length > 1" :value="store.selectedOrgId" @change="onOrgChange" title="Organization">
            <option v-for="o in store.organizations" :key="o.id" :value="o.id">{{ o.name }}{{ o.is_personal ? ' (personal)' : '' }}</option>
          </select>
          <span v-else-if="store.organization" class="org-chip" title="Active organization">
            <Icon icon="lucide:building" /> {{ store.organization.name }}
          </span>
          <select :value="store.period" @change="onPeriodChange">
            <option v-for="opt in PERIOD_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <button class="ghost" @click="exportCsv"><Icon icon="lucide:download" /> Export</button>
          <button class="primary" :disabled="!store.canManage" :title="store.canManage ? '' : 'You don’t have permission to manage budgets for this organization'" @click="openNewBudget"><Icon icon="lucide:plus" /> New budget</button>
        </div>
      </header>

      <div v-if="store.loading && !store.loaded" class="state-banner">Loading budgets…</div>
      <div v-else-if="store.error" class="state-banner error">{{ store.error }}</div>
      <div v-else-if="!store.hasBudget" class="state-banner empty">
        No organization budget yet. <button class="link-btn" @click="openNewBudget">Create your first budget</button> to start tracking spend against a limit.
      </div>

      <section class="metric-grid">
        <article v-for="metric in metrics" :key="metric.label" class="metric-card">
          <div>
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <p :class="metric.tone">{{ metric.copy }}</p>
          </div>
          <div :class="['metric-icon', metric.tone]">
            <Icon :icon="metric.icon" />
          </div>
          <svg v-if="metric.spark" class="spark" viewBox="0 0 120 42" aria-hidden="true">
            <path d="M2 32 C12 18 20 26 30 28 S44 10 54 22 66 38 76 12 90 24 98 8 111 13 118 4" />
          </svg>
          <div v-if="metric.ring" class="mini-ring"><span>{{ metric.percent != null ? Math.round(100 - metric.percent) + '%' : '—' }}</span></div>
        </article>
      </section>

      <section class="chart-grid">
        <article class="panel line-panel">
          <header class="section-head compact">
            <div>
              <h2>Spend over time</h2>
              <p>Daily spend across all scopes</p>
            </div>
            <div class="chart-controls"><button>Line <Icon icon="lucide:chevron-down" /></button><button>Total <Icon icon="lucide:chevron-down" /></button></div>
          </header>
          <div class="line-chart">
            <svg viewBox="0 0 520 210" aria-hidden="true">
              <g class="gridlines">
                <path d="M0 35H520M0 75H520M0 115H520M0 155H520M0 195H520" />
              </g>
              <path class="last" d="M0 155 L28 132 L56 146 L84 92 L112 132 L140 122 L168 121 L196 118 L224 88 L252 113 L280 112 L308 112 L336 70 L364 96 L392 90 L420 99 L448 62 L476 56 L504 116 L520 98" />
              <path class="this" d="M0 146 L28 108 L56 126 L84 120 L112 82 L140 106 L168 79 L196 64 L224 91 L252 89 L280 88 L308 52 L336 78 L364 71 L392 81 L420 52 L448 50 L476 34 L504 109 L520 102" />
            </svg>
            <div class="x-axis"><span>May 1</span><span>May 6</span><span>May 11</span><span>May 16</span><span>May 21</span><span>May 26</span><span>May 31</span></div>
          </div>
        </article>

        <article v-for="donut in donuts" :key="donut.title" class="panel donut-panel">
          <h2>{{ donut.title }}</h2>
          <p>{{ donut.copy }}</p>
          <div class="donut-wrap">
            <div :class="['donut', donut.tone]"><strong>{{ totalSpendLabel }}</strong><span>Total spend</span></div>
            <ul>
              <li v-if="!donut.items.length" class="muted-row">No spend in this period.</li>
              <li v-for="item in donut.items" :key="item.name"><i :class="item.tone" /> <span>{{ item.name }}</span><b>{{ item.value }}</b><em>{{ item.percent }}</em></li>
            </ul>
          </div>
        </article>
      </section>

      <section class="panel budget-table">
        <header class="section-head">
          <div>
            <h2>Budget by scope</h2>
            <p>Set spending caps at different levels. Lower-level budgets cannot exceed their parent limits.</p>
          </div>
          <div class="toggle-wrap">
            <span>Show hierarchy</span>
            <button class="toggle on"><i /></button>
            <button class="ghost small"><Icon icon="lucide:settings" /> Configure</button>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Scope</th>
              <th>Name</th>
              <th>Monthly Budget</th>
              <th>Daily Budget</th>
              <th>Remaining</th>
              <th>Usage</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!budgetRows.length"><td colspan="8" class="muted-row">No budgets yet.</td></tr>
            <tr v-for="row in budgetRows" :key="row.budget_id">
              <td><span :class="['scope-icon', row.tone]"><Icon :icon="row.icon" /></span>{{ row.scope }}</td>
              <td>{{ row.name }}</td>
              <td>{{ row.monthly }}</td>
              <td>{{ row.daily }}</td>
              <td>{{ row.remaining }} <small>{{ row.percent }}</small></td>
              <td><div class="usage"><i :class="row.statusTone" :style="{ width: row.usage }" /></div></td>
              <td><b :class="row.statusTone">{{ row.status }}</b></td>
              <td class="actions">
                <Icon icon="lucide:pencil" role="button" title="Edit" @click="editBudget(row.budget_id)" />
                <Icon icon="lucide:trash-2" role="button" title="Delete" @click="deleteBudget(row)" />
              </td>
            </tr>
          </tbody>
        </table>
        <button class="add-link" @click="openNewBudget"><Icon icon="lucide:plus" /> Add budget</button>
      </section>

      <section class="panel rules-panel">
        <header class="section-head compact">
          <div>
            <h2>Budget rules</h2>
            <p>Automatic controls to prevent unexpected spend and enforce limits.</p>
          </div>
        </header>
        <table>
          <thead>
            <tr><th>Rule</th><th>Scope</th><th>Type</th><th>Limit</th><th>Current</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr v-if="!rulesView.length"><td colspan="6" class="muted-row">No rules yet.</td></tr>
            <tr v-for="rule in rulesView" :key="rule.id">
              <td><Icon icon="lucide:clipboard" />{{ rule.rule }}</td>
              <td>{{ rule.scope }}</td>
              <td>{{ rule.type }}</td>
              <td>{{ rule.limit }}</td>
              <td :class="rule.tone">{{ rule.current }}</td>
              <td class="rule-actions">
                <Icon icon="lucide:pencil" role="button" title="Edit" @click="editRule(rule.raw)" />
                <Icon icon="lucide:trash-2" role="button" title="Delete" @click="deleteRule(rule.raw)" />
              </td>
            </tr>
          </tbody>
        </table>
        <button class="add-link" @click="openNewRule"><Icon icon="lucide:plus" /> Add rule</button>
      </section>

      <section class="panel approvals-panel">
        <header class="section-head compact">
          <div>
            <h2>Approval requests</h2>
            <p>Runs paused because a budget requires approval. Approve to let them continue, or deny to keep them stopped.</p>
          </div>
          <span class="pill" :class="{ warn: store.approvals.length }">{{ store.approvals.length }} pending</span>
        </header>
        <table v-if="store.approvals.length">
          <thead>
            <tr><th>Scope</th><th>Rule</th><th>Current</th><th>Projected</th><th>Limit</th><th>Requested</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr v-for="a in store.approvals" :key="a.id">
              <td>{{ (a.scope_type || 'org') }}</td>
              <td>{{ ruleLabel(a.rule_type) }}</td>
              <td>${{ money(a.current_spend) }}</td>
              <td>${{ money(a.projected_spend) }}</td>
              <td>{{ a.unit === 'tokens' ? Number(a.limit_value).toLocaleString() + ' tok' : '$' + money(a.limit_value) }}</td>
              <td>${{ money(a.requested_amount) }}</td>
              <td class="approve-actions">
                <button class="mini approve" :disabled="!store.canManage" @click="decide(a, 'approve')">Approve</button>
                <button class="mini deny" :disabled="!store.canManage" @click="decide(a, 'deny')">Deny</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted-row">No pending approvals.</p>
      </section>

      <section class="panel events-panel">
        <header class="section-head compact">
          <div>
            <h2>Budget activity</h2>
            <p>Recent warn, approval, and block events across your runs (audit trail).</p>
          </div>
        </header>
        <table v-if="store.events.length">
          <thead>
            <tr><th>When</th><th>Action</th><th>Scope</th><th>Rule</th><th>Projected</th><th>Limit</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="e in store.events" :key="e.id">
              <td>{{ shortTime(e.created_at) }}</td>
              <td><b :class="eventTone(e.action)">{{ actionLabel(e.action) }}</b></td>
              <td>{{ e.scope_type || 'org' }}</td>
              <td>{{ ruleLabel(e.rule_type) }}</td>
              <td>${{ money(e.projected_spend) }}</td>
              <td>{{ e.unit === 'tokens' ? Number(e.limit_value).toLocaleString() + ' tok' : '$' + money(e.limit_value) }}</td>
              <td><span class="status-tag" :class="e.status">{{ e.status }}</span></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted-row">No budget events yet.</p>
      </section>
    </section>

    <aside class="budgets-rail">
      <section class="rail-card">
        <h2>How budgets work</h2>
        <article v-for="item in explainers" :key="item.title" class="explain-row">
          <span><Icon :icon="item.icon" /></span>
          <div><strong>{{ item.title }}</strong><p>{{ item.copy }}</p></div>
        </article>
      </section>

      <section class="rail-card presets">
        <h2>Budget presets</h2>
        <p>Apply a preset to get started quickly.</p>
        <article v-for="preset in presets" :key="preset.title" :class="{ recommended: preset.recommended }">
          <div><strong>{{ preset.title }}</strong><small v-if="preset.recommended">Recommended</small></div>
          <p>{{ preset.copy }}</p>
          <ul><li v-for="line in preset.lines" :key="line">{{ line }}</li></ul>
          <button @click="applyPreset(preset)">Apply</button>
        </article>
      </section>

      <section class="rail-card help-card">
        <h2>Need help?</h2>
        <p>Learn how budgets and approvals work.</p>
        <button>View documentation <Icon icon="lucide:arrow-right" /></button>
        <button>Contact support <Icon icon="lucide:arrow-right" /></button>
      </section>
    </aside>

    <BudgetEditModal v-if="showBudgetModal" :budget="editingBudget" :saving="store.saving"
      :org-name="store.organization?.name || ''" :org-id="store.selectedOrgId" :parent-caps="orgCaps"
      @close="showBudgetModal = false" @save="onSaveBudget" />
    <BudgetRuleModal v-if="showRuleModal" :rule="editingRule" :budgets="store.budgets" :saving="store.saving"
      @close="showRuleModal = false" @save="onSaveRule" />
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useBudgetStore, PERIOD_OPTIONS } from '../stores/useBudgetStore'
import { useNotify } from '../composables/useNotify'
import { useConfirm } from '../composables/useConfirm'
import BudgetEditModal from '../components/budgets/BudgetEditModal.vue'
import BudgetRuleModal from '../components/budgets/BudgetRuleModal.vue'

const store = useBudgetStore()
const notify = useNotify()
const confirm = useConfirm()

const showBudgetModal = ref(false)
const showRuleModal = ref(false)
const editingBudget = ref(null)
const editingRule = ref(null)

onMounted(() => store.load())

// ── Display data (real, from the store) ──────────────────────────────────
const metrics = computed(() => store.metricsList)
const donuts = computed(() => store.donuts)
const totalSpendLabel = computed(() => `$${Number(store.metrics?.current_spend || 0).toFixed(2)}`)

const SCOPE_ICON = { org: 'lucide:building', workspace: 'lucide:building-2', agent: 'lucide:bot',
  workflow: 'lucide:workflow', schedule: 'lucide:calendar-clock' }
const SCOPE_TONE = { org: 'violet', workspace: 'violet', agent: 'purple', workflow: 'teal', schedule: 'blue' }

const budgetRows = computed(() => store.scopes.map((s) => {
  const pct = s.percent
  const untracked = s.tracked === false   // spend can't be attributed for this scope (no usable signal)
  const statusTone = untracked ? 'slate' : (pct == null ? 'green' : (pct >= 100 ? 'red' : (pct >= 80 ? 'amber' : 'green')))
  const status = untracked ? 'Not tracked' : (pct == null ? 'No cap' : (pct >= 100 ? 'Over budget' : (pct >= 80 ? 'At risk' : 'On track')))
  const usd = (v) => (v == null ? '—' : `$${Number(v).toFixed(2)}`)
  return {
    budget_id: s.budget_id,
    scope: (s.scope_type || '').charAt(0).toUpperCase() + (s.scope_type || '').slice(1),
    name: s.name,
    monthly: usd(s.monthly_limit_usd),
    daily: usd(s.daily_limit_usd),
    remaining: untracked ? '—' : usd(s.remaining),
    percent: untracked || pct == null ? '' : `${pct}%`,
    usage: `${untracked ? 0 : Math.min(pct || 0, 100)}%`,
    status, statusTone,
    tone: SCOPE_TONE[s.scope_type] || 'violet',
    icon: SCOPE_ICON[s.scope_type] || 'lucide:circle-dollar-sign',
  }
}))

const RULE_TYPE_LABEL = { daily_cap: 'Daily monetary cap', monthly_cap: 'Monthly monetary cap',
  per_run: 'Max spend per run', token_budget: 'Token budget', provider_budget: 'Provider budget',
  approval: 'Require approval above' }
const ACTION_LABEL = { warn: 'Warn', require_approval: 'Approval', block: 'Block' }

const rulesView = computed(() => store.rules.map((r) => ({
  id: r.id,
  raw: r,
  rule: RULE_TYPE_LABEL[r.rule_type] || r.rule_type,
  scope: r.target || 'All scopes',
  type: ACTION_LABEL[r.action] || r.action,
  limit: r.unit === 'tokens' ? `${Number(r.limit_value).toLocaleString()} tokens` : `$${Number(r.limit_value).toFixed(2)}`,
  current: r.enabled ? 'Active' : 'Disabled',
  tone: r.enabled ? 'green' : 'amber',
})))

function onPeriodChange(e) { store.setPeriod(e.target.value) }
function onOrgChange(e) { store.setOrg(Number(e.target.value)) }

// ── Approvals + events helpers ───────────────────────────────────────────
const RULE_LABELS = { monthly_cap: 'Monthly cap', daily_cap: 'Daily cap', per_run: 'Per-run',
  per_turn: 'Per-turn', approval: 'Approval threshold', token_budget: 'Token budget',
  provider_budget: 'Provider budget' }
function ruleLabel(t) { return RULE_LABELS[t] || t || '—' }
function money(v) { return Number(v || 0).toFixed(2) }
function actionLabel(a) { return ({ warn: 'Warn', require_approval: 'Approval', block: 'Block' })[a] || a }
function eventTone(a) { return ({ warn: 'amber', require_approval: 'blue', block: 'red' })[a] || 'slate' }
function shortTime(iso) { try { return new Date(iso).toLocaleString() } catch { return iso } }
async function decide(a, decision) {
  if (decision === 'deny') {
    const ok = await confirm({ title: 'Deny request?', message: 'Deny this budget approval? The run stays stopped.', confirmText: 'Deny', danger: true })
    if (!ok) return
  }
  try { await store.decideApproval(a.id, decision); notify.success(decision === 'approve' ? 'Approved' : 'Denied') }
  catch (e) { notify.error(e?.response?.data?.error || 'Failed to update approval') }
}

// Organization parent caps (the ceiling every child budget must stay under) — from the org scope row.
const orgCaps = computed(() => {
  const org = store.scopes.find((s) => s.scope_type === 'org')
  return { monthly: org?.monthly_limit_usd ?? null, daily: org?.daily_limit_usd ?? null }
})

// ── Budget modal actions ─────────────────────────────────────────────────
function openNewBudget() { editingBudget.value = null; showBudgetModal.value = true }
function editBudget(id) {
  editingBudget.value = store.budgets.find((b) => b.id === id) || null
  showBudgetModal.value = true
}
async function onSaveBudget(payload) {
  try {
    await store.saveBudget(payload)
    showBudgetModal.value = false
    notify.success(payload.id ? 'Budget updated' : 'Budget created')
  } catch (e) { notify.error(e?.response?.data?.error || 'Failed to save budget') }
}
async function deleteBudget(row) {
  const ok = await confirm({ title: 'Delete budget?',
    message: `Delete the budget for "${row.name}"? Spend history is kept; only the limits are removed.`,
    confirmText: 'Delete', danger: true })
  if (!ok) return
  try { await store.removeBudget(row.budget_id); notify.success('Budget deleted') }
  catch (e) { notify.error('Failed to delete budget') }
}

// ── Rule modal actions ───────────────────────────────────────────────────
function openNewRule() {
  if (!store.budgets.length) { notify.error('Create a budget first, then attach rules to it.'); return }
  editingRule.value = null; showRuleModal.value = true
}
function editRule(raw) { editingRule.value = raw; showRuleModal.value = true }
async function onSaveRule(payload) {
  try {
    await store.saveRule(payload)
    showRuleModal.value = false
    notify.success(payload.id ? 'Rule updated' : 'Rule created')
  } catch (e) { notify.error(e?.response?.data?.error || 'Failed to save rule') }
}
async function deleteRule(raw) {
  const ok = await confirm({ title: 'Delete rule?', message: 'Remove this budget rule?',
    confirmText: 'Delete', danger: true })
  if (!ok) return
  try { await store.removeRule(raw.id); notify.success('Rule deleted') }
  catch (e) { notify.error('Failed to delete rule') }
}

// ── Presets ──────────────────────────────────────────────────────────────
const PRESET_VALUES = {
  Conservative: { monthly_limit_usd: 500, daily_limit_usd: 25, approval_threshold_usd: 50 },
  Balanced: { monthly_limit_usd: 2000, daily_limit_usd: 100, approval_threshold_usd: 100 },
  Scale: { monthly_limit_usd: 10000, daily_limit_usd: 500, approval_threshold_usd: 250 },
}
async function applyPreset(preset) {
  const vals = PRESET_VALUES[preset.title]
  if (!vals) return
  const ok = await confirm({ title: `Apply "${preset.title}" preset?`,
    message: `This sets your organization budget to:\nMonthly $${vals.monthly_limit_usd}, Daily $${vals.daily_limit_usd}, Approval over $${vals.approval_threshold_usd}.`,
    confirmText: 'Apply' })
  if (!ok) return
  const existing = store.budgets.find((b) => b.scope_type === 'org')
  try {
    await store.saveBudget({ id: existing?.id || null, scope_type: 'org', scope_id: null,
      name: existing?.name || `${preset.title} budget`, alert_thresholds: [0.5, 0.8, 1.0],
      enabled: true, ...vals })
    notify.success(`Applied "${preset.title}" preset`)
  } catch (e) { notify.error('Failed to apply preset') }
}

// ── Export ───────────────────────────────────────────────────────────────
function exportCsv() {
  const rows = [['Scope', 'Name', 'Monthly limit', 'Daily limit', 'Spent', 'Remaining', 'Percent', 'Status']]
  for (const r of budgetRows.value) {
    rows.push([r.scope, r.name, r.monthly, r.daily,
      `$${Number(store.scopes.find((s) => s.budget_id === r.budget_id)?.spent || 0).toFixed(2)}`,
      r.remaining, r.percent, r.status])
  }
  const csv = rows.map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `budgets-${store.period}.csv`; a.click()
  URL.revokeObjectURL(url)
}

const explainers = [
  { title: 'Set limits', copy: 'Define budgets at the workspace, agent, workflow, or schedule level.', icon: 'lucide:badge-dollar-sign' },
  { title: 'Automatic enforcement', copy: 'Budgets are checked before runs. When limits are hit, actions are blocked or queued.', icon: 'lucide:gauge' },
  { title: 'Stay informed', copy: 'Get alerts for at-risk usage, approvals, and rule breaches.', icon: 'lucide:megaphone' },
  { title: 'Flexible controls', copy: 'Combine caps, approvals, and provider limits to match your policies.', icon: 'lucide:sliders-horizontal' },
]

const presets = [
  { title: 'Conservative', copy: 'Tight controls for cost-sensitive teams.', lines: ['Lower daily caps', 'Approval over $50'] },
  { title: 'Balanced', copy: 'Good for growing teams.', recommended: true, lines: ['Moderate daily caps', 'Approval over $100'] },
  { title: 'Scale', copy: 'Built for high-volume teams.', lines: ['Higher daily caps', 'Approval over $250'] },
]
</script>

<style scoped>
.budgets-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
  min-height: 100%;
  padding: 24px 30px 48px;
  background: #f8fbff;
  color: #0f172a;
}
.budgets-main { max-width: 1500px; width: 100%; justify-self: center; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.page-head h1 { margin: 0; font-size: 24px; font-weight: 850; letter-spacing: 0; }
.page-head p, .section-head p, .rail-card > p { margin: 8px 0 0; color: #64748b; font-size: 13px; }
.head-actions { display: flex; gap: 10px; align-items: center; }
select, button { font: inherit; }
.head-actions select, .ghost, .primary {
  height: 38px; border-radius: 9px; padding: 0 14px; font-size: 12px; font-weight: 850;
}
.head-actions select, .ghost { border: 1px solid #dbe4f0; background: #fff; color: #334155; }
.ghost, .primary { display: inline-flex; align-items: center; gap: 8px; }
.primary { border: 0; background: #3156e9; color: #fff; }
.ghost svg, .primary svg { width: 15px; height: 15px; }

.metric-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; }
.metric-card, .panel, .rail-card {
  border: 1px solid #dfe7f2; border-radius: 12px; background: #fff; box-shadow: 0 8px 22px rgba(15,23,42,.035);
}
.metric-card { position: relative; min-height: 122px; padding: 20px 18px; overflow: hidden; }
.metric-card > div:first-child { min-width: 0; padding-right: 46px; }
.metric-card span { display: block; color: #334155; font-size: 11px; line-height: 1.2; font-weight: 850; white-space: normal; }
.metric-card strong { display: block; margin-top: 10px; font-size: clamp(19px, 1.65vw, 24px); line-height: 1.08; font-weight: 850; white-space: nowrap; }
.metric-card p { max-width: 112px; margin: 10px 0 0; color: #64748b; font-size: 11.5px; line-height: 1.25; font-weight: 750; }
.metric-icon { position: absolute; right: 18px; top: 20px; display: grid; width: 38px; height: 38px; place-items: center; border-radius: 999px; }
.metric-icon svg { width: 19px; height: 19px; }
.green { color: #10b981 !important; } .blue { color: #2563eb !important; } .violet { color: #7c3aed !important; } .red { color: #ef4444 !important; } .orange { color: #f59e0b !important; } .amber { color: #f59e0b !important; }
.metric-icon.green { background: #e9fbf1; } .metric-icon.blue { background: #eef4ff; } .metric-icon.violet { background: #f2efff; } .metric-icon.red { background: #fff1f1; } .metric-icon.orange { background: #fff7ed; }
.spark { position: absolute; right: 14px; bottom: 17px; width: 82px; height: 34px; }
.spark path { fill: none; stroke: #2563eb; stroke-width: 3; stroke-linecap: round; }
.mini-ring { position: absolute; right: 18px; bottom: 18px; display: grid; width: 46px; height: 46px; place-items: center; border-radius: 999px; background: conic-gradient(#2563eb 75%, #e5ebf3 0); }
.mini-ring::before { content:""; position: absolute; inset: 7px; border-radius: inherit; background: #fff; }
.mini-ring span { position: relative; color: #64748b; font-size: 10px; }

.panel { margin-top: 18px; padding: 20px; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.section-head.compact { align-items: center; }
.section-head h2, .rail-card h2 { margin: 0; font-size: 15px; font-weight: 850; }
.toggle-wrap, .chart-controls { display: flex; align-items: center; gap: 10px; color: #64748b; font-size: 12px; font-weight: 750; }
.small { height: 32px; padding: 0 12px; }
.toggle { position: relative; width: 36px; height: 20px; border: 0; border-radius: 999px; background: #dbe4f0; padding: 0; }
.toggle i { position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 999px; background: #fff; }
.toggle.on { background: #3156e9; }
.toggle.on i { left: 19px; }

table { width: 100%; border-collapse: collapse; margin-top: 14px; }
th { padding: 10px 12px; color: #64748b; background: #f8fafc; font-size: 11px; text-align: left; font-weight: 850; }
td { padding: 10px 12px; border-top: 1px solid #edf2f7; color: #334155; font-size: 12px; font-weight: 700; }
td:first-child { display: flex; align-items: center; gap: 8px; }
.scope-icon { display: grid; width: 24px; height: 24px; place-items: center; border-radius: 999px; background: #eef4ff; }
.scope-icon svg { width: 13px; height: 13px; }
.scope-icon.violet { background:#f2efff; } .scope-icon.purple { background:#f5efff; } .scope-icon.slate { background:#f1f5f9; color:#64748b !important; } .scope-icon.teal { background:#e7fbf6; } .scope-icon.blue { background:#eef4ff; }
em { border-radius: 999px; background: #eef4ff; color: #2563eb; padding: 2px 7px; font-style: normal; font-size: 10px; font-weight: 850; }
small { margin-left: 6px; color: #64748b; font-size: 11px; }
.usage { width: 112px; height: 6px; border-radius: 999px; background: #e6ebf2; overflow: hidden; }
.usage i { display: block; height: 100%; border-radius: inherit; }
.usage i.green { background: #10b981; } .usage i.amber { background: #f59e0b; }
td b { font-size: 11.5px; }
.actions, .rule-actions { display: flex; align-items: center; gap: 13px; color: #64748b; }
.actions svg, .rule-actions svg { width: 14px; height: 14px; }
.add-link, .view-link { display: inline-flex; align-items: center; gap: 7px; margin-top: 10px; border: 0; background: transparent; color: #2563eb; font-size: 12px; font-weight: 850; }

.chart-grid { display: grid; grid-template-columns: minmax(340px, 1.08fr) minmax(320px, .94fr) minmax(320px, .94fr); gap: 18px; align-items: stretch; }
.chart-controls button { display: inline-flex; align-items: center; gap: 6px; height: 30px; border: 1px solid #dbe4f0; border-radius: 8px; background: #fff; padding: 0 10px; color: #334155; font-size: 12px; font-weight: 800; }
.line-chart { margin-top: 12px; }
.line-chart svg { width: 100%; height: 212px; }
.gridlines path { stroke: #e5ebf3; stroke-width: 1; }
.line-chart .last { fill: none; stroke: #9db7f5; stroke-width: 2; stroke-dasharray: 6 5; }
.line-chart .this { fill: none; stroke: #3156e9; stroke-width: 3; }
.x-axis { display: flex; justify-content: space-between; color: #64748b; font-size: 11px; }
.donut-panel { min-width: 0; }
.donut-wrap { display: grid; grid-template-columns: 138px minmax(170px, 1fr); gap: 18px; align-items: center; margin-top: 18px; }
.donut { display: grid; width: 132px; height: 132px; place-content: center; text-align: center; border-radius: 999px; background: conic-gradient(#2563eb 0 45%, #10b981 45% 68%, #f59e0b 68% 83%, #7c3aed 83% 94%, #cbd5e1 94%); position: relative; }
.donut::before { content:""; position: absolute; inset: 21px; border-radius: inherit; background: #fff; }
.donut strong, .donut span { position: relative; }
.donut strong { font-size: 14px; line-height: 1.1; } .donut span { color: #64748b; font-size: 11px; }
.donut-wrap ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 9px; }
.donut-wrap li { display: grid; grid-template-columns: 10px minmax(72px, 1fr) minmax(58px, auto) 42px; gap: 8px; align-items: center; color: #334155; font-size: 11px; line-height: 1.18; }
.donut-wrap li i { width: 8px; height: 8px; border-radius: 999px; }
.donut-wrap li span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: normal; }
.blue-dot { background:#2563eb; } .green-dot { background:#10b981; } .yellow-dot { background:#f59e0b; } .violet-dot { background:#7c3aed; } .slate-dot { background:#94a3b8; }
.donut-wrap li b, .donut-wrap li em { background: transparent; color: #334155; padding: 0; font-size: 11px; text-align: right; white-space: nowrap; font-weight: 850; }
.donut-wrap li em { color: #0f172a; }
.view-link { float: right; margin-top: 14px; }
.rules-panel td:first-child svg { width: 13px; height: 13px; margin-right: 7px; color: #64748b; }

.budgets-rail { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; max-width: 1500px; width: 100%; justify-self: center; }
.rail-card { padding: 18px; }
.explain-row { display: flex; gap: 14px; margin-top: 22px; }
.explain-row > span { display: grid; width: 38px; height: 38px; flex-shrink: 0; place-items: center; border: 1px solid #dbe4f0; border-radius: 999px; color: #64748b; }
.explain-row svg { width: 18px; height: 18px; }
.explain-row strong, .presets strong { display: block; font-size: 12px; font-weight: 850; }
.explain-row p { margin: 7px 0 0; color: #64748b; font-size: 11.5px; line-height: 1.5; }
.presets article { position: relative; margin-top: 12px; border: 1px solid #dfe7f2; border-radius: 10px; padding: 14px; }
.presets article.recommended { border-color: #3156e9; box-shadow: 0 0 0 2px rgba(49,86,233,.08); }
.presets article div { display: flex; justify-content: space-between; gap: 8px; }
.presets small { margin: 0; color: #2563eb; background: #eef4ff; border-radius: 99px; padding: 2px 7px; }
.presets p { margin: 8px 0; color: #64748b; font-size: 11px; }
.presets ul { margin: 0 0 8px; padding-left: 16px; color: #334155; font-size: 11px; line-height: 1.8; }
.presets article button { position: absolute; right: 14px; bottom: 14px; height: 28px; border: 1px solid #8da2ff; border-radius: 7px; background: #fff; color: #3156e9; font-size: 11px; font-weight: 850; padding: 0 12px; }
.help-card button { display: flex; align-items: center; gap: 7px; margin-top: 14px; border: 0; background: transparent; color: #2563eb; font-size: 12px; font-weight: 850; }

@media (max-width: 1400px) {
  .budgets-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1100px) {
  .metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .budget-table { overflow-x: auto; }
  .budgets-rail { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .chart-grid { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .budgets-page { padding: 20px 14px 70px; }
  .page-head, .head-actions, .section-head { flex-direction: column; align-items: stretch; }
  .metric-grid { grid-template-columns: 1fr; }
}

/* Dynamic-state additions */
.slate { color: #94a3b8 !important; }
.pill { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px;
  background: #eef2f7; color: #64748b; font-size: 11px; font-weight: 850; }
.pill.warn { background: #fff7ed; color: #b45309; }
.approve-actions { display: flex; gap: 8px; }
.mini { height: 28px; padding: 0 12px; border-radius: 8px; font-size: 12px; font-weight: 800; border: 1px solid #dbe4f0; background: #fff; cursor: pointer; }
.mini.approve { border: 0; background: #16a34a; color: #fff; }
.mini.deny { border: 0; background: #ef4444; color: #fff; }
.mini:disabled { opacity: .5; cursor: default; }
.status-tag { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 850; text-transform: capitalize; }
.status-tag.pending { background: #fff7ed; color: #b45309; }
.status-tag.approved { background: #e9fbf1; color: #16a34a; }
.status-tag.denied { background: #fff1f1; color: #b91c1c; }
.status-tag.logged { background: #eef2f7; color: #64748b; }
.org-chip { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; border-radius: 9px;
  border: 1px solid #dbe4f0; background: #fff; color: #334155; font-size: 12px; font-weight: 850; }
.org-chip svg { width: 15px; height: 15px; color: #64748b; }
.state-banner { margin-bottom: 16px; padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 700;
  background: #eef4ff; border: 1px solid #dbe4f0; color: #334155; }
.state-banner.error { background: #fff1f1; border-color: #fecaca; color: #b91c1c; }
.state-banner.empty { background: #fffbeb; border-color: #fde68a; color: #92400e; }
.link-btn { border: 0; background: transparent; color: #2563eb; font: inherit; font-weight: 850; cursor: pointer; padding: 0; }
.muted-row { color: #94a3b8; font-weight: 600; padding: 14px 12px; }
.actions [role="button"], .rule-actions [role="button"] { cursor: pointer; }
.actions [role="button"]:hover, .rule-actions [role="button"]:hover { color: #2563eb; }
</style>

