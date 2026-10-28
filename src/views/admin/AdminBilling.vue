<template>
  <div class="ab">
    <header class="ab-head">
      <h1>Billing &amp; Wallets</h1>
      <p>Everyone pays from a prepaid balance: provider cost × the markup, for every paid call on the platform's APIs.
        Platform staff are not charged.</p>
    </header>

    <div class="tabs" role="tablist" aria-label="Billing">
      <button v-for="t in TABS" :id="`tab-${t.key}`" :key="t.key" class="tab" role="tab" type="button"
              :aria-selected="tab === t.key" :aria-controls="`panel-${t.key}`" :class="{ on: tab === t.key }"
              @click="setTab(t.key)">{{ t.label }}</button>
    </div>

    <!-- Usage & charges: every cent traced -->
    <section v-if="tab === 'usage'" id="panel-usage" class="card" role="tabpanel" aria-labelledby="tab-usage">
      <form class="usage-filters" @submit.prevent="loadUsage">
        <label class="field"><span>Person (name or email)</span><input v-model="filters.q" placeholder="Anyone" /></label>
        <label class="field"><span>Entry</span>
          <select v-model="filters.kind"><option v-for="k in ENTRY_KINDS" :key="k" :value="k">{{ k === 'all' ? 'Everything' : k.replace('_', ' ') }}</option></select></label>
        <label class="field"><span>Kind of usage</span>
          <select v-model="filters.usage_kind"><option v-for="k in USAGE_KINDS" :key="k" :value="k">{{ k ? kindLabel(k) : 'All kinds' }}</option></select></label>
        <label class="field"><span>Provider</span><input v-model="filters.provider" placeholder="e.g. openrouter" /></label>
        <label class="field"><span>Model</span><input v-model="filters.model" placeholder="exact model id" /></label>
        <label class="field"><span>Agent id</span><input v-model="filters.agent" inputmode="numeric" /></label>
        <label class="field"><span>Chat id</span><input v-model="filters.conversation" inputmode="numeric" /></label>
        <label class="field"><span>From</span><input v-model="filters.date_from" type="date" /></label>
        <label class="field"><span>To</span><input v-model="filters.date_to" type="date" /></label>
        <div class="actions">
          <button class="btn primary" type="submit" :disabled="chargesLoading">{{ chargesLoading ? 'Loading…' : 'Apply' }}</button>
          <button class="btn" type="button" @click="resetFilters">Clear</button>
          <button class="btn" type="button" :disabled="exporting" @click="exportCsv">{{ exporting ? 'Exporting…' : 'Export CSV' }}</button>
          <span v-if="filters.user" class="muted">Person #{{ filters.user }} <button class="linkish" type="button" @click="filters.user = ''; loadUsage()">remove</button></span>
        </div>
      </form>

      <div v-if="summary" class="kpis">
        <div class="kpi"><span>Charged</span><strong>${{ exactUsd(summary.total_charged_usd) }}</strong></div>
        <div class="kpi"><span>Provider cost</span><strong>${{ exactUsd(summary.total_cost_usd) }}</strong></div>
        <div class="kpi"><span>Margin</span><strong>${{ exactUsd(summary.total_margin_usd) }}</strong></div>
      </div>

      <div class="row between" style="margin-top:18px">
        <h3 style="margin:0">Totals by</h3>
        <div class="filters" role="group" aria-label="Group by">
          <button v-for="g in GROUPS" :key="g.key" type="button" class="chip" :class="{ on: groupBy === g.key }"
                  :aria-pressed="groupBy === g.key" @click="groupBy = g.key; loadUsage()">{{ g.label }}</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>{{ GROUPS.find(g => g.key === groupBy).label }}</th><th class="num">Entries</th><th class="num">Tokens in / out</th>
            <th class="num">Provider cost</th><th class="num">Charged</th><th class="num">Margin</th></tr></thead>
          <tbody>
            <tr v-for="(g, i) in summary?.groups || []" :key="i" class="clickable" tabindex="0" @click="drill(g)" @keydown.enter="drill(g)">
              <td>{{ groupLabel(g) }}</td><td class="num">{{ g.count }}</td>
              <td class="num">{{ g.prompt_tokens.toLocaleString() }} / {{ g.completion_tokens.toLocaleString() }}</td>
              <td class="num">${{ g.cost_usd }}</td><td class="num">${{ g.charged_usd }}</td><td class="num">${{ g.margin_usd }}</td>
            </tr>
            <tr v-if="summary && !summary.groups.length"><td colspan="6" class="muted">Nothing matches these filters.</td></tr>
          </tbody>
        </table>
      </div>

      <h3>Every entry</h3>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>When</th><th>Person</th><th>What</th><th>Model / provider</th><th class="num">Cost</th><th class="num">Charged</th><th class="num">Balance</th></tr></thead>
          <tbody>
            <template v-for="c in charges" :key="c.id">
              <tr class="clickable" tabindex="0" :aria-expanded="openCharge === c.id" @click="openCharge = openCharge === c.id ? null : c.id" @keydown.enter="openCharge = openCharge === c.id ? null : c.id">
                <td class="nowrap">{{ when(c.created_at) }}</td>
                <td>{{ c.username }}<div class="muted">{{ c.email }}</div></td>
                <td>{{ c.description || c.kind }}<div class="muted">{{ c.usage_kind ? kindLabel(c.usage_kind) : c.kind }}<template v-if="c.agent_name"> · {{ c.agent_name }}</template></div></td>
                <td>{{ c.model || '—' }}<div class="muted">{{ c.provider }}</div></td>
                <td class="num">{{ c.provider_cost_usd != null ? `$${c.provider_cost_usd}` : '—' }}</td>
                <td class="num" :class="Number(c.amount_usd) >= 0 ? 'pos' : ''">{{ signedUsd(c.amount_usd) }}</td>
                <td class="num">{{ signedUsd(c.balance_after_usd, false) }}</td>
              </tr>
              <tr v-if="openCharge === c.id" class="detail">
                <td colspan="7">
                  <dl class="trace">
                    <div><dt>Entry</dt><dd>#{{ c.id }} · {{ c.kind }} · key <code>{{ c.idempotency_key }}</code></dd></div>
                    <div><dt>Person</dt><dd>{{ c.username }} (user {{ c.user_id }})</dd></div>
                    <div><dt>Source</dt><dd>{{ c.source_type || '—' }} {{ c.source_id }}<template v-if="c.llm_request_log_id"> · request log #{{ c.llm_request_log_id }}</template></dd></div>
                    <div><dt>Agent / chat / run</dt><dd>{{ c.agent_name || c.agent_id || '—' }} · {{ c.conversation_id || '—' }} · {{ c.billing_run_id || '—' }}</dd></div>
                    <div><dt>Tokens</dt><dd>{{ c.prompt_tokens }} in · {{ c.completion_tokens }} out</dd></div>
                    <div><dt>Money</dt><dd>cost ${{ c.provider_cost_usd ?? '—' }} × markup {{ c.markup ?? '—' }} = {{ c.amount_usd }}</dd></div>
                    <div v-if="c.reason"><dt>Reason</dt><dd>{{ c.reason }}<template v-if="c.actor_id"> (by user {{ c.actor_id }})</template></dd></div>
                  </dl>
                </td>
              </tr>
            </template>
            <tr v-if="!chargesLoading && !charges.length"><td colspan="7" class="muted">No entries.</td></tr>
          </tbody>
        </table>
      </div>
      <button v-if="chargesNext" class="btn ghost more" type="button" @click="moreCharges">Show older</button>
    </section>

    <!-- Settings -->
    <section v-if="tab === 'settings'" id="panel-settings" class="card" role="tabpanel" aria-labelledby="tab-settings">
      <div v-if="!form" class="vm-skel" style="height:160px"></div>
      <form v-else class="grid-form" @submit.prevent="saveSettings">
        <label class="field">
          <span>Markup</span>
          <input v-model="form.markup" inputmode="decimal" aria-describedby="h-markup" />
          <small id="h-markup">Price = provider cost × this. 1 = cost price; 1.25 adds 25% (covers Stripe's fee).</small>
          <em v-if="errors.markup" role="alert">{{ errors.markup }}</em>
        </label>
        <label class="field">
          <span>Smallest top-up ($)</span>
          <input v-model="form.min_topup_usd" inputmode="decimal" />
          <em v-if="errors.min_topup_usd" role="alert">{{ errors.min_topup_usd }}</em>
        </label>
        <label class="field">
          <span>Largest top-up ($)</span>
          <input v-model="form.max_topup_usd" inputmode="decimal" />
          <em v-if="errors.max_topup_usd" role="alert">{{ errors.max_topup_usd }}</em>
        </label>
        <label class="field">
          <span>Preset amounts ($, comma separated)</span>
          <input v-model="form.presets" />
          <em v-if="errors.preset_amounts" role="alert">{{ errors.preset_amounts }}</em>
        </label>
        <label class="field">
          <span>Starting credit for a new person ($)</span>
          <input v-model="form.starting_credit_usd" inputmode="decimal" />
          <small>Given once per email address, after the email is verified. Platform staff get none.</small>
          <em v-if="errors.starting_credit_usd" role="alert">{{ errors.starting_credit_usd }}</em>
        </label>
        <label class="field">
          <span>Low-balance notification under ($)</span>
          <input v-model="form.low_balance_usd" inputmode="decimal" />
          <em v-if="errors.low_balance_usd" role="alert">{{ errors.low_balance_usd }}</em>
        </label>
        <div class="actions">
          <button class="btn primary" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save settings' }}</button>
          <span class="muted">Every change is recorded with your name.</span>
        </div>
      </form>
    </section>

    <!-- Wallets -->
    <section v-if="tab === 'wallets'" id="panel-wallets" class="card" role="tabpanel" aria-labelledby="tab-wallets">
      <template v-if="!selected">
        <label class="search">
          <Search :size="16" aria-hidden="true" />
          <span class="sr-only">Search people</span>
          <input v-model="q" placeholder="Search by username or email…" @input="debouncedSearch" />
        </label>
        <div v-if="walletsLoading && !wallets.length" class="vm-skel" style="height:120px"></div>
        <div v-else class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Person</th><th class="num">Balance</th><th class="num">Held</th><th></th></tr></thead>
            <tbody>
              <tr v-for="w in wallets" :key="w.wallet_id">
                <td><strong>{{ w.username }}</strong><div class="muted">{{ w.email }}</div></td>
                <td class="num" :class="{ neg: Number(w.balance_usd) <= 0 }">${{ w.balance_usd }}<span v-if="w.exempt" class="tag">staff</span></td>
                <td class="num">${{ w.held_usd }}</td>
                <td class="num"><button class="btn sm" type="button" @click="openWallet(w.user_id)">Open</button></td>
              </tr>
              <tr v-if="!wallets.length"><td colspan="4" class="muted">No wallets found.</td></tr>
            </tbody>
          </table>
        </div>
        <button v-if="walletsNext" class="btn ghost more" type="button" @click="loadWallets(false)">Show more</button>
      </template>

      <template v-else>
        <button class="back" type="button" @click="selected = null"><ArrowLeft :size="16" aria-hidden="true" /> All wallets</button>
        <div class="who">
          <div>
            <h2>{{ selected.user.username }}</h2>
            <div class="muted">{{ selected.user.email }}</div>
          </div>
          <div class="big">${{ selected.wallet.balance_usd }}</div>
        </div>

        <form class="adjust" @submit.prevent="adjust">
          <h3>Adjust the balance</h3>
          <div class="adjust-row">
            <label class="field">
              <span>Amount ($, negative to take away)</span>
              <input v-model="adj.amount" inputmode="decimal" placeholder="5.00" />
            </label>
            <label class="field grow">
              <span>Reason (required, recorded)</span>
              <input v-model="adj.reason" maxlength="2000" placeholder="e.g. goodwill credit for an outage" />
            </label>
            <button class="btn primary" type="submit" :disabled="adjusting || !adj.amount || !adj.reason.trim()">
              {{ adjusting ? 'Saving…' : 'Apply' }}
            </button>
          </div>
        </form>

        <div v-if="selected.holds.length" class="holds">
          <h3>Money held for work in progress</h3>
          <ul>
            <li v-for="h in selected.holds" :key="h.id">
              <span>{{ h.description || h.usage_kind }} · ${{ h.amount_usd }} · <span :class="['state', h.state]">{{ h.state }}</span></span>
              <button v-if="h.state === 'unsettled'" class="btn sm" type="button" @click="releaseHold(h)">Release</button>
            </li>
          </ul>
        </div>

        <h3>Ledger</h3>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>When</th><th>What</th><th class="num">Cost</th><th class="num">Charged</th><th class="num">Balance</th></tr></thead>
            <tbody>
              <tr v-for="e in selected.entries" :key="e.id">
                <td class="nowrap">{{ when(e.created_at) }}</td>
                <td>{{ e.description || e.kind }}<div v-if="e.reason" class="muted">Reason: {{ e.reason }}</div></td>
                <td class="num">{{ e.provider_cost_usd != null ? `$${e.provider_cost_usd}` : '—' }}</td>
                <td class="num" :class="Number(e.amount_usd) >= 0 ? 'pos' : ''">{{ signedUsd(e.amount_usd) }}</td>
                <td class="num">{{ signedUsd(e.balance_after_usd, false) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button v-if="selected.next_before" class="btn ghost more" type="button" @click="moreEntries">Show older</button>
      </template>
    </section>

    <!-- Pricing coverage -->
    <section v-if="tab === 'pricing'" id="panel-pricing" class="card" role="tabpanel" aria-labelledby="tab-pricing">
      <div v-if="!coverage" class="vm-skel" style="height:120px"></div>
      <template v-else>
        <div class="cover-sum" :class="coverage.missing ? 'bad' : 'good'" role="status">
          <component :is="coverage.missing ? AlertTriangle : CheckCircle2" :size="18" aria-hidden="true" />
          <span v-if="coverage.missing">{{ coverage.missing }} of {{ coverage.total }} models have no price. People cannot
            use them: a call on an unpriced model is refused, never run for free. Set prices on
            <RouterLink to="/admin-dashboard/model-pricing">Model Pricing</RouterLink>.</span>
          <span v-else>{{ coverage.total === 1 ? 'The one active model has a price.' : `All ${coverage.total} active models have a price.` }}</span>
        </div>
        <div class="filters">
          <button v-for="f in ['missing', 'all']" :key="f" type="button" class="chip" :class="{ on: coverFilter === f }"
                  :aria-pressed="coverFilter === f" @click="coverFilter = f">{{ f === 'all' ? 'All models' : 'Missing a price' }}</button>
        </div>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Model</th><th>Platform API</th><th>Kind</th><th>Price</th></tr></thead>
            <tbody>
              <tr v-for="m in coverRows" :key="`${m.provider_id}:${m.model_id}`">
                <td><strong>{{ m.name }}</strong><div class="muted mono">{{ m.model_id }}</div></td>
                <td>{{ m.provider }}</td>
                <td>{{ m.kind }}</td>
                <td>
                  <span :class="['pill', m.status]">{{ STATUS[m.status] }}</span>
                  <span v-if="m.price?.input_per_1m_usd != null" class="muted"> ${{ m.price.input_per_1m_usd }} / ${{ m.price.output_per_1m_usd }} per 1M</span>
                  <span v-else-if="m.price?.per_item_usd != null" class="muted"> ${{ m.price.per_item_usd }} each</span>
                </td>
              </tr>
              <tr v-if="!coverRows.length"><td colspan="4" class="muted">Nothing to show.</td></tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <!-- Revenue -->
    <section v-if="tab === 'revenue'" id="panel-revenue" class="card" role="tabpanel" aria-labelledby="tab-revenue">
      <div class="row between">
        <h2>Money in and out</h2>
        <label class="days"><span class="sr-only">Period</span>
          <select v-model.number="days" @change="loadRevenue">
            <option :value="7">Last 7 days</option><option :value="30">Last 30 days</option>
            <option :value="90">Last 90 days</option><option :value="365">Last year</option>
          </select>
        </label>
      </div>
      <div v-if="!revenue" class="vm-skel" style="height:120px"></div>
      <template v-else>
        <div class="kpis">
          <div class="kpi"><span>Top-ups</span><strong>${{ exactUsd(revenue.topups_usd) }}</strong><small>{{ revenue.topup_count }} {{ revenue.topup_count === 1 ? 'payment' : 'payments' }}</small></div>
          <div class="kpi"><span>Charged for usage</span><strong>${{ exactUsd(revenue.charged_usd) }}</strong></div>
          <div class="kpi"><span>Provider cost</span><strong>${{ exactUsd(revenue.provider_cost_usd) }}</strong></div>
          <div class="kpi"><span>Margin</span><strong>${{ margin }}</strong></div>
          <div class="kpi"><span>Paid by the platform</span><strong>${{ exactUsd(revenue.platform_paid_usd) }}</strong><small>failed renders nobody was charged for</small></div>
          <div class="kpi"><span>Refunds</span><strong>${{ exactUsd(revenue.refunds_usd) }}</strong></div>
          <div class="kpi"><span>Disputes</span><strong>${{ exactUsd(revenue.disputes_usd) }}</strong></div>
          <div class="kpi"><span>Starting credit given</span><strong>${{ exactUsd(revenue.starting_credit_usd) }}</strong></div>
          <div class="kpi"><span>Balances held by people</span><strong>${{ exactUsd(revenue.balances_outstanding_usd) }}</strong></div>
        </div>
        <h3>By kind of usage</h3>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Kind</th><th class="num">Provider cost</th><th class="num">Charged</th></tr></thead>
            <tbody>
              <tr v-for="(v, k) in revenue.by_usage_kind" :key="k"><td>{{ kindLabel(k) }}</td><td class="num">${{ exactUsd(v.cost_usd) }}</td><td class="num">${{ exactUsd(v.charged_usd) }}</td></tr>
              <tr v-if="!Object.keys(revenue.by_usage_kind).length"><td colspan="3" class="muted">No usage in this period.</td></tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-vue-next'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'

const TABS = [{ key: 'usage', label: 'Usage & charges' }, { key: 'settings', label: 'Settings' }, { key: 'wallets', label: 'Wallets' },
  { key: 'pricing', label: 'Pricing coverage' }, { key: 'revenue', label: 'Revenue' }]
const STATUS = { priced: 'Priced', missing: 'No price', local_free: 'Free (local)' }

const route = useRoute()
const router = useRouter()
const tab = ref(TABS.some(t => t.key === route.query.tab) ? route.query.tab : 'usage')

// ── Usage & charges: every cent, who spent it, on what, where, and what it cost the platform ──
const USAGE_KINDS = ['', 'llm', 'embedding', 'image', 'video', 'audio', 'search', 'sandbox', 'training']
// The same names the person's Billing page uses.
const KIND_LABEL = { llm: 'AI models', embedding: 'Embeddings', image: 'Images', video: 'Video', audio: 'Audio',
  search: 'Web search', sandbox: 'Sandboxes', training: 'Training', serving: 'Model serving' }
function kindLabel(k) { return KIND_LABEL[k] || k }
// An exact amount with its sign and a dollar sign: -$0.00148625, +$10 (sign only when asked).
function signedUsd(v, sign = true) {
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return (n < 0 ? '−' : sign && n > 0 ? '+' : '') + '$' + exactUsd(Math.abs(n))
}
const ENTRY_KINDS = ['charge', 'topup', 'refund', 'dispute', 'adjustment', 'starting_credit', 'all']
const GROUPS = [{ key: 'user', label: 'Person' }, { key: 'usage_kind', label: 'Kind' }, { key: 'model', label: 'Model' },
  { key: 'provider', label: 'Provider' }, { key: 'agent', label: 'Agent' }, { key: 'conversation', label: 'Chat' },
  { key: 'day', label: 'Day' }]
const filters = ref({ q: '', user: '', kind: 'charge', usage_kind: '', provider: '', model: '', agent: '',
  conversation: '', date_from: '', date_to: '' })
const groupBy = ref('user')
const summary = ref(null)
const charges = ref([])
const chargesNext = ref(null)
const chargesLoading = ref(false)
const openCharge = ref(null)
const exporting = ref(false)
function cleanFilters() {
  const out = {}
  for (const [k, v] of Object.entries(filters.value)) if (v !== '' && v != null) out[k] = v
  return out
}
// Money as it really is: cents for ordinary amounts, every digit when a cent would hide it (one AI call can cost
// $0.0002, and "$0.00" would say it cost nothing).
function exactUsd(v) {
  const n = Number(v || 0)
  if (n === 0) return '0.00'
  const cents = n.toFixed(2)
  return Number(cents) === n ? cents : n.toFixed(8).replace(/0+$/, '')
}
function groupLabel(g) {
  const k = g.key || {}
  if (groupBy.value === 'user') return `${k.wallet__user__username || '?'} (${k.wallet__user__email || 'no email'})`
  if (groupBy.value === 'model') return `${k.model_name || '—'} · ${k.provider_type || '—'}`
  if (groupBy.value === 'agent') return k.agent_name || (k.agent_id ? `Agent ${k.agent_id}` : 'No agent')
  if (groupBy.value === 'conversation') return k.conversation_id ? `Chat ${k.conversation_id}` : 'No chat'
  return Object.values(k)[0] || '—'
}
function drill(g) {
  const k = g.key || {}
  if (groupBy.value === 'user') filters.value.user = k.wallet__user_id
  else if (groupBy.value === 'usage_kind') filters.value.usage_kind = k.usage_kind || ''
  else if (groupBy.value === 'model') { filters.value.model = k.model_name || ''; filters.value.provider = k.provider_type || '' }
  else if (groupBy.value === 'provider') filters.value.provider = k.provider_type || ''
  else if (groupBy.value === 'agent') filters.value.agent = k.agent_id || ''
  else if (groupBy.value === 'conversation') filters.value.conversation = k.conversation_id || ''
  else if (groupBy.value === 'day') { filters.value.date_from = k.day; filters.value.date_to = k.day }
  loadUsage()
}
function resetFilters() {
  filters.value = { q: '', user: '', kind: 'charge', usage_kind: '', provider: '', model: '', agent: '', conversation: '',
    date_from: '', date_to: '' }
  loadUsage()
}
async function loadUsage() {
  chargesLoading.value = true
  openCharge.value = null
  try {
    const params = cleanFilters()
    const [s, c] = await Promise.all([api.billingAdminSpendSummary({ ...params, group_by: groupBy.value }),
      api.billingAdminCharges(params)])
    summary.value = s.data
    charges.value = c.data.charges
    chargesNext.value = c.data.next_before
  } catch (e) { notify.error(apiError(e, 'Could not load usage')) } finally { chargesLoading.value = false }
}
async function moreCharges() {
  const { data } = await api.billingAdminCharges({ ...cleanFilters(), before: chargesNext.value })
  charges.value = [...charges.value, ...data.charges]
  chargesNext.value = data.next_before
}
async function exportCsv() {
  exporting.value = true
  try {
    const { data } = await api.billingAdminChargesCsv(cleanFilters())
    const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = `aadml-charges-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  } catch (e) { notify.error(apiError(e, 'Could not export')) } finally { exporting.value = false }
}

const form = ref(null)
const errors = ref({})
const saving = ref(false)

const q = ref('')
const wallets = ref([])
const walletsNext = ref(null)
const walletsLoading = ref(false)
const selected = ref(null)
const adj = ref({ amount: '', reason: '' })
const adjusting = ref(false)

const coverage = ref(null)
const coverFilter = ref('missing')
const coverRows = computed(() => (coverage.value?.models || []).filter(m => coverFilter.value === 'all' || m.status === 'missing'))

const revenue = ref(null)
const days = ref(30)
const margin = computed(() => exactUsd(Number(revenue.value?.charged_usd || 0) - Number(revenue.value?.provider_cost_usd || 0)))

function setTab(k) { tab.value = k; router.replace({ query: { ...route.query, tab: k } }); loadTab() }
function when(s) { return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }
function apiError(e, fallback) { return e.response?.data?.detail || e.response?.data?.error || fallback }

async function loadSettings() {
  try {
    const { data } = await api.billingAdminSettings()
    const s = data.settings
    form.value = { markup: s.markup, min_topup_usd: s.min_topup_usd, max_topup_usd: s.max_topup_usd,
      presets: (s.preset_amounts || []).join(', '), starting_credit_usd: s.starting_credit_usd, low_balance_usd: s.low_balance_usd }
  } catch (e) { notify.error(apiError(e, 'Could not load billing settings')) }
}
async function saveSettings() {
  saving.value = true
  errors.value = {}
  const presets = form.value.presets.split(',').map(v => v.trim()).filter(Boolean).map(Number)
  try {
    await api.billingAdminSaveSettings({ markup: form.value.markup, min_topup_usd: form.value.min_topup_usd,
      max_topup_usd: form.value.max_topup_usd, preset_amounts: presets,
      starting_credit_usd: form.value.starting_credit_usd, low_balance_usd: form.value.low_balance_usd })
    notify.success('Billing settings saved')
    await loadSettings()
  } catch (e) {
    errors.value = e.response?.data?.fields || {}
    notify.error(apiError(e, 'Could not save the settings'))
  } finally { saving.value = false }
}

let searchTimer = null
function debouncedSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadWallets(true), 300) }
async function loadWallets(reset = true) {
  walletsLoading.value = true
  try {
    const params = { q: q.value || undefined }
    if (!reset && walletsNext.value) params.before = walletsNext.value
    const { data } = await api.billingAdminWallets(params)
    wallets.value = reset ? data.wallets : [...wallets.value, ...data.wallets]
    walletsNext.value = data.next_before
  } catch (e) { notify.error(apiError(e, 'Could not load wallets')) } finally { walletsLoading.value = false }
}
async function openWallet(userId) {
  try {
    const { data } = await api.billingAdminWallet(userId)
    selected.value = data
    adj.value = { amount: '', reason: '' }
  } catch (e) { notify.error(apiError(e, 'Could not open the wallet')) }
}
async function moreEntries() {
  const { data } = await api.billingAdminWallet(selected.value.user.id, { before: selected.value.next_before })
  selected.value = { ...selected.value, entries: [...selected.value.entries, ...data.entries], next_before: data.next_before }
}
async function adjust() {
  adjusting.value = true
  try {
    await api.billingAdminAdjust(selected.value.user.id, adj.value.amount, adj.value.reason.trim())
    notify.success('Balance adjusted')
    await openWallet(selected.value.user.id)
  } catch (e) { notify.error(apiError(e, 'Could not adjust the balance')) } finally { adjusting.value = false }
}
async function releaseHold(h) {
  try {
    await api.billingAdminReleaseHold(h.id)
    notify.success('Hold released')
    await openWallet(selected.value.user.id)
  } catch (e) { notify.error(apiError(e, 'Could not release the hold')) }
}

async function loadCoverage() {
  try { coverage.value = (await api.billingAdminPricingCoverage()).data } catch (e) { notify.error(apiError(e, 'Could not load pricing coverage')) }
}
async function loadRevenue() {
  revenue.value = null
  try { revenue.value = (await api.billingAdminRevenue(days.value)).data } catch (e) { notify.error(apiError(e, 'Could not load revenue')) }
}

function loadTab() {
  if (tab.value === 'usage' && !summary.value) loadUsage()
  if (tab.value === 'settings' && !form.value) loadSettings()
  if (tab.value === 'wallets' && !wallets.value.length) loadWallets(true)
  if (tab.value === 'pricing') loadCoverage()
  if (tab.value === 'revenue') loadRevenue()
}
onMounted(loadTab)
</script>

<style scoped>
.ab { max-width: 1100px; margin: 0 auto; padding: 24px 20px 64px; display: flex; flex-direction: column; gap: 16px; }
.ab-head h1 { margin: 0; font-size: 1.5rem; font-weight: 800; color: var(--vm-ink); }
.ab-head p { margin: 6px 0 0; color: var(--vm-ink-soft); font-size: .92rem; max-width: 75ch; line-height: 1.5; }
.card { background: var(--vm-surface); border: 1px solid var(--vm-border); border-radius: 14px; padding: 20px; }
.card h2 { margin: 0 0 4px; font-size: 1.1rem; color: var(--vm-ink); }
.card h3 { margin: 20px 0 10px; font-size: .95rem; color: var(--vm-ink); }
.muted { color: var(--vm-ink-soft); font-size: .8rem; }
.mono { font-family: var(--vm-font-mono); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.row.between { justify-content: space-between; }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--vm-border); overflow-x: auto; }
.tab { border: 0; background: none; padding: 10px 14px; min-height: 44px; font-weight: 600; font-size: .9rem; color: var(--vm-ink-soft);
  border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; transition: color .15s, border-color .15s; }
.tab:hover { color: var(--vm-ink); }
.tab.on { color: var(--vm-primary); border-bottom-color: var(--vm-primary); }
.tab:focus-visible, .btn:focus-visible, .chip:focus-visible, .back:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }

.grid-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px 20px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field > span { font-size: .85rem; font-weight: 600; color: var(--vm-ink); }
.field input { min-height: 42px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--vm-border); background: var(--vm-surface);
  color: var(--vm-ink); font-size: .95rem; }
.field input:focus { outline: none; border-color: var(--vm-focus); box-shadow: 0 0 0 3px rgba(46,144,250,.18); }
.field small { color: var(--vm-ink-soft); font-size: .78rem; line-height: 1.4; }
.field em { color: var(--vm-danger); font-style: normal; font-size: .8rem; }
.field.grow { flex: 1; }
.actions { grid-column: 1 / -1; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; padding: 8px 16px; border-radius: 10px;
  font-weight: 600; font-size: .88rem; cursor: pointer; border: 1px solid var(--vm-border); background: var(--vm-surface); color: var(--vm-ink);
  transition: opacity .15s; }
.btn.primary { background: var(--vm-g-brand); color: #fff; border: none; }
.btn.primary:hover:not(:disabled) { opacity: .92; }
.btn.sm { min-height: 34px; padding: 4px 12px; font-size: .8rem; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn.more { margin-top: 12px; }

.search { display: flex; align-items: center; gap: 8px; max-width: 420px; border: 1px solid var(--vm-border); border-radius: 10px;
  padding: 0 12px; margin-bottom: 14px; color: var(--vm-ink-soft); background: var(--vm-surface); }
.search input { border: 0; outline: 0; background: transparent; color: var(--vm-ink); min-height: 42px; width: 100%; font-size: .92rem; }
.search:focus-within { border-color: var(--vm-focus); }

.table-wrap { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: .88rem; }
.tbl th { text-align: left; font-size: .76rem; text-transform: uppercase; letter-spacing: .03em; color: var(--vm-ink-soft); font-weight: 700;
  padding: 8px 10px; border-bottom: 1px solid var(--vm-border); }
.tbl td { padding: 10px; border-bottom: 1px solid var(--vm-border); color: var(--vm-ink); vertical-align: top; }
.tbl .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tbl .neg { color: var(--vm-danger); }
.tbl .pos { color: var(--vm-green); }
.nowrap { white-space: nowrap; }
.tag { margin-left: 6px; font-size: .68rem; font-weight: 700; padding: 1px 6px; border-radius: 999px; background: var(--vm-surface-soft); color: var(--vm-ink-soft); }

.back { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: var(--vm-primary); font-weight: 600;
  cursor: pointer; padding: 6px 0; min-height: 36px; }
.who { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin: 8px 0 4px; }
.big { font-size: 2rem; font-weight: 800; color: var(--vm-ink); font-variant-numeric: tabular-nums; }
.adjust-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.holds ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.holds li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid var(--vm-border);
  border-radius: 10px; font-size: .88rem; color: var(--vm-ink); }
.state.unsettled { color: #b45309; font-weight: 700; }

.cover-sum { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; font-size: .9rem; line-height: 1.5; margin-bottom: 14px; }
.cover-sum.bad { color: #b42318; background: rgba(240,68,56,.08); }
.cover-sum.good { color: #047857; background: rgba(18,183,106,.1); }
.cover-sum a { color: inherit; font-weight: 700; }
.cover-sum svg { flex: none; margin-top: 2px; }
.filters { display: flex; gap: 6px; margin-bottom: 10px; }
.chip { min-height: 32px; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--vm-border); background: var(--vm-surface);
  color: var(--vm-ink-soft); font-size: .82rem; font-weight: 600; cursor: pointer; }
.chip.on { background: var(--vm-primary-soft); color: var(--vm-primary); border-color: rgba(37,99,235,.35); }
.pill { font-size: .72rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.pill.priced { color: #047857; background: rgba(18,183,106,.12); }
.pill.missing { color: #b42318; background: rgba(240,68,56,.1); }
.pill.local_free { color: var(--vm-ink-soft); background: var(--vm-surface-soft); }

.days select { min-height: 40px; border-radius: 10px; border: 1px solid var(--vm-border); background: var(--vm-surface); color: var(--vm-ink); padding: 0 10px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 14px; }
.kpi { border: 1px solid var(--vm-border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.kpi span { color: var(--vm-ink-soft); font-size: .8rem; font-weight: 600; }
.kpi strong { color: var(--vm-ink); font-size: 1.35rem; font-variant-numeric: tabular-nums; }
.kpi small { color: var(--vm-ink-soft); font-size: .76rem; }

.usage-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px 14px; margin-bottom: 8px; }
.usage-filters select { min-height: 42px; border-radius: 10px; border: 1px solid var(--vm-border); background: var(--vm-surface); color: var(--vm-ink); padding: 0 10px; }
.clickable { cursor: pointer; }
.clickable:hover td { background: var(--vm-surface-soft); }
.clickable:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; }
.detail td { background: var(--vm-surface-soft); }
.trace { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px 18px; margin: 0; font-size: .84rem; }
.trace dt { color: var(--vm-ink-soft); font-weight: 600; font-size: .76rem; }
.trace dd { margin: 2px 0 0; color: var(--vm-ink); word-break: break-word; }
.trace code { font-family: var(--vm-font-mono); font-size: .78rem; }
.linkish { border: 0; background: none; color: var(--vm-primary); cursor: pointer; padding: 0 4px; font-weight: 600; }

@media (max-width: 480px) {
  .ab { padding: 16px 14px 48px; }
  .adjust-row .btn { width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .tab, .btn { transition: none; } }
</style>
