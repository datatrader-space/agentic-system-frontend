<template>
  <div class="billing">
    <header class="head">
      <h1>Billing</h1>
      <p>Your balance pays for everything AADML does for you: chats, agents, images, video, search, sandboxes and
        training. Top up any time; there is no plan or subscription.</p>
    </header>

    <div v-if="banner" class="banner" :class="banner.kind" role="status" aria-live="polite">
      <component :is="banner.icon" :size="18" aria-hidden="true" />
      <span>{{ banner.text }}</span>
    </div>

    <div v-if="loading" class="card" aria-busy="true">
      <div class="vm-skel" style="height:44px;width:40%"></div>
    </div>

    <template v-else-if="wallet">
      <!-- Balance -->
      <section class="card balance-card" :class="balanceState" aria-labelledby="balance-h" data-tour="balance">
        <div class="balance-main">
          <div id="balance-h" class="label">Balance</div>
          <div class="balance">{{ balanceText(wallet.balance_exact_usd) }}</div>
          <div v-if="Number(wallet.held_usd) > 0" class="sub">
            ${{ wallet.held_usd }} is set aside for work in progress, so ${{ wallet.available_usd }} is available.
          </div>
          <div v-if="wallet.exempt" class="sub">As platform staff, your own usage is not charged.</div>
        </div>
        <div v-if="!wallet.exempt && balanceState !== 'ok'" class="state-note" role="alert">
          <AlertTriangle :size="18" aria-hidden="true" />
          <span v-if="balanceState === 'empty'">
            Your balance is empty. Chats, agents, schedules and jobs that cost money are paused until you top up.
            A stopped run can be resumed afterwards.
          </span>
          <span v-else>Your balance is low. Top up to keep things running when it reaches $0.</span>
        </div>
      </section>

      <!-- Top up -->
      <section class="card" aria-labelledby="topup-h">
        <h2 id="topup-h">Top up</h2>
        <p v-if="!configured" class="muted">Payments are not configured yet. A platform administrator has to connect
          Stripe before you can top up.</p>
        <form v-else class="topup" @submit.prevent="startTopUp">
          <fieldset class="presets">
            <legend class="sr-only">Amount</legend>
            <button v-for="p in presets" :key="p" type="button" class="preset" :class="{ on: picked === String(p) }"
                    :aria-pressed="picked === String(p)" @click="pick(p)">
              ${{ p }}
            </button>
          </fieldset>
          <div class="custom">
            <label for="topup-amount">Or enter an amount</label>
            <div class="money-input" :class="{ invalid: !!amountError }">
              <span aria-hidden="true">$</span>
              <input id="topup-amount" v-model="custom" inputmode="decimal" autocomplete="off"
                     :aria-invalid="!!amountError" aria-describedby="topup-help" placeholder="0.00"
                     @focus="picked = ''" @blur="touched = true" />
            </div>
            <div id="topup-help" class="help" :class="{ err: !!amountError }" :role="amountError ? 'alert' : null">
              {{ amountError || `Between $${limits.min} and $${limits.max}. You pay on Stripe's secure page.` }}
            </div>
          </div>
          <button class="btn primary" type="submit" :disabled="busy || !validAmount">
            <Loader2 v-if="busy" :size="16" class="spin" aria-hidden="true" />
            <CreditCard v-else :size="16" aria-hidden="true" />
            {{ busy ? 'Opening Stripe…' : validAmount ? `Add $${amountText}` : 'Add money' }}
          </button>
        </form>
      </section>

      <!-- History -->
      <section class="card" aria-labelledby="history-h">
        <div class="row between wrap">
          <h2 id="history-h">History</h2>
          <div class="filters" role="group" aria-label="Show">
            <button v-for="f in FILTERS" :key="f.key" type="button" class="chip" :class="{ on: filter === f.key }"
                    :aria-pressed="filter === f.key" @click="setFilter(f.key)">{{ f.label }}</button>
          </div>
        </div>
        <div v-if="entriesLoading && !entries.length" class="vm-skel" style="height:120px"></div>
        <p v-else-if="!entries.length" class="muted">Nothing here yet.</p>
        <ul v-else class="ledger">
          <li v-for="e in entries" :key="e.id" class="entry">
            <span class="ic" :class="e.kind" aria-hidden="true"><component :is="iconFor(e)" :size="16" /></span>
            <div class="what">
              <div class="desc">{{ e.description || KIND_LABEL[e.kind] }}</div>
              <div class="meta">
                {{ formatDate(e.created_at) }}
                <template v-if="e.usage_kind"> · {{ USAGE_LABEL[e.usage_kind] || e.usage_kind }}</template>
                <a v-if="e.receipt_url" :href="e.receipt_url" target="_blank" rel="noopener noreferrer"> · Receipt</a>
              </div>
            </div>
            <div class="amt" :class="Number(e.amount_usd) >= 0 ? 'credit' : 'debit'">
              {{ money(e.amount_usd) }}
              <span class="after">Balance {{ balanceText(e.balance_after_usd) }}</span>
            </div>
          </li>
        </ul>
        <button v-if="nextBefore" class="btn ghost more" type="button" :disabled="entriesLoading" @click="loadMore">
          {{ entriesLoading ? 'Loading…' : 'Show older' }}
        </button>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlertTriangle, CheckCircle2, CreditCard, Loader2, Info, Bot, Image, Video, AudioLines, Search, Box,
  GraduationCap, Gift, RotateCcw, Scale, Sparkles,
} from 'lucide-vue-next'
import api from '../services/api'
import { notify } from '../composables/useNotify'
import { balanceText } from '../utils/money'

const FILTERS = [
  { key: '', label: 'All' }, { key: 'topup', label: 'Top-ups' }, { key: 'llm', label: 'AI models' },
  { key: 'image', label: 'Images' }, { key: 'video', label: 'Video' }, { key: 'audio', label: 'Audio' },
  { key: 'search', label: 'Search' }, { key: 'sandbox', label: 'Sandboxes' }, { key: 'training', label: 'Training' },
  { key: 'embedding', label: 'Embeddings' },
]
const KIND_LABEL = { topup: 'Top-up', charge: 'Usage', refund: 'Refund', dispute: 'Payment disputed',
  adjustment: 'Adjustment', starting_credit: 'Starting credit' }
const USAGE_LABEL = { llm: 'AI model', embedding: 'Embeddings', image: 'Image', video: 'Video', audio: 'Audio',
  search: 'Web search', sandbox: 'Sandbox', training: 'Training', serving: 'Model serving' }
const USAGE_ICON = { llm: Bot, embedding: Sparkles, image: Image, video: Video, audio: AudioLines, search: Search,
  sandbox: Box, training: GraduationCap, serving: GraduationCap }

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const wallet = ref(null)
const settings = ref(null)
const configured = ref(false)
const picked = ref('10')
const custom = ref('')
const touched = ref(false)
const busy = ref(false)
const banner = ref(null)
const entries = ref([])
const nextBefore = ref(null)
const entriesLoading = ref(false)
const filter = ref('')
let pollTimer = null

const presets = computed(() => settings.value?.preset_amounts?.length ? settings.value.preset_amounts : [5, 10, 25, 50])
const limits = computed(() => ({ min: settings.value?.min_topup_usd || '5.00', max: settings.value?.max_topup_usd || '500.00' }))
const amountText = computed(() => (picked.value || custom.value || '').trim())
const amountError = computed(() => {
  if (picked.value || !custom.value.trim() || !touched.value) return ''
  const v = custom.value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return 'Enter dollars, for example 15 or 12.50.'
  const n = Number(v)
  if (n < Number(limits.value.min)) return `The smallest top-up is $${limits.value.min}.`
  if (n > Number(limits.value.max)) return `The largest top-up is $${limits.value.max}.`
  return ''
})
const validAmount = computed(() => {
  const v = amountText.value
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return false
  const n = Number(v)
  return n >= Number(limits.value.min) && n <= Number(limits.value.max)
})
const balanceState = computed(() => {
  const b = Number(wallet.value?.balance_exact_usd || 0)
  if (b <= 0) return 'empty'
  if (b < Number(settings.value?.low_balance_usd || 1)) return 'low'
  return 'ok'
})

function pick(p) { picked.value = String(p); custom.value = ''; touched.value = false }
function money(v) { const n = Number(v); return `${n >= 0 ? '+' : '−'}$${fmt(Math.abs(n))}` }
function fmt(n) { return n >= 0.01 || n === 0 ? n.toFixed(2) : n.toFixed(4) }
function iconFor(e) {
  if (e.kind === 'charge') return USAGE_ICON[e.usage_kind] || Bot
  return { topup: CreditCard, starting_credit: Gift, refund: RotateCcw, dispute: AlertTriangle, adjustment: Scale }[e.kind] || Info
}
function formatDate(s) {
  return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.billingWallet()
    wallet.value = data.wallet
    settings.value = data.settings
    configured.value = !!data.payments_configured
    if (!presets.value.map(String).includes(picked.value)) picked.value = String(presets.value[0])
  } catch (e) {
    notify.error(e.response?.data?.detail || 'Could not load your balance')
  } finally {
    loading.value = false
  }
  await loadEntries(true)
}

async function loadEntries(reset = false) {
  entriesLoading.value = true
  try {
    const params = {}
    if (filter.value === 'topup') params.kind = 'topup'
    else if (filter.value) params.usage_kind = filter.value
    if (!reset && nextBefore.value) params.before = nextBefore.value
    const { data } = await api.billingEntries(params)
    entries.value = reset ? data.entries : [...entries.value, ...data.entries]
    nextBefore.value = data.next_before
  } catch (e) {
    notify.error('Could not load your history')
  } finally {
    entriesLoading.value = false
  }
}
function setFilter(k) { filter.value = k; nextBefore.value = null; loadEntries(true) }
function loadMore() { loadEntries(false) }

async function startTopUp() {
  touched.value = true
  if (!validAmount.value || busy.value) return
  busy.value = true
  try {
    const { data } = await api.billingTopUp(amountText.value)
    if (data.url) window.location.assign(data.url)
  } catch (e) {
    notify.error(e.response?.data?.detail || 'Could not start the payment. Please try again.')
    busy.value = false
  }
}

// Back from Stripe: the balance changes only when Stripe's signed confirmation arrives, so ask until it has.
async function followReturn() {
  const id = route.query.topup
  if (route.query.status === 'cancel') {
    banner.value = { kind: 'warn', icon: Info, text: 'Payment cancelled. Nothing was charged.' }
    return
  }
  if (route.query.status !== 'success' || !id) return
  banner.value = { kind: 'info', icon: Loader2, text: 'Payment received by Stripe. Adding it to your balance…' }
  let tries = 0
  const tick = async () => {
    tries += 1
    try {
      const { data } = await api.billingTopUpStatus(id)
      if (data.topup.status === 'paid') {
        banner.value = { kind: 'ok', icon: CheckCircle2, text: `$${data.topup.amount_usd} was added to your balance.` }
        wallet.value = data.wallet
        router.replace({ query: {} })
        loadEntries(true)
        return
      }
      if (['failed', 'expired'].includes(data.topup.status)) {
        banner.value = { kind: 'warn', icon: AlertTriangle, text: 'The payment did not go through. Nothing was added.' }
        return
      }
    } catch (e) { /* keep asking */ }
    if (tries < 30) pollTimer = setTimeout(tick, 2000)
    else banner.value = { kind: 'info', icon: Info, text: 'Stripe is still confirming the payment. Your balance updates as soon as it does.' }
  }
  tick()
}

onMounted(async () => { await load(); followReturn() })
onBeforeUnmount(() => clearTimeout(pollTimer))
</script>

<style scoped>
.billing { max-width: 900px; margin: 0 auto; padding: 28px 20px 64px; display: flex; flex-direction: column; gap: 16px; }
.head h1 { font-family: var(--vm-font-display); font-size: 1.6rem; font-weight: 800; color: var(--vm-ink); margin: 0; }
.head p { color: var(--vm-ink-soft); margin: 6px 0 0; font-size: .95rem; line-height: 1.55; max-width: 68ch; }
.card { background: var(--vm-surface); border: 1px solid var(--vm-border); border-radius: 14px; padding: 20px; }
.card h2 { margin: 0 0 14px; font-size: 1.05rem; font-weight: 700; color: var(--vm-ink); }
.row { display: flex; align-items: center; gap: 12px; }
.row.between { justify-content: space-between; }
.row.wrap { flex-wrap: wrap; }
.muted { color: var(--vm-ink-soft); font-size: .9rem; margin: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.banner { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px; font-size: .92rem; border: 1px solid; }
.banner.ok { color: #047857; background: rgba(18,183,106,.1); border-color: rgba(18,183,106,.3); }
.banner.warn { color: #b45309; background: rgba(247,144,9,.12); border-color: rgba(247,144,9,.3); }
.banner.info { color: var(--vm-primary); background: var(--vm-primary-soft); border-color: rgba(37,99,235,.25); }

.balance-card { display: flex; flex-direction: column; gap: 14px; }
.label { color: var(--vm-ink-soft); font-size: .85rem; font-weight: 600; }
.balance { font-size: 2.6rem; font-weight: 800; color: var(--vm-ink); letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1.15; }
.sub { color: var(--vm-ink-soft); font-size: .88rem; margin-top: 4px; }
.balance-card.low { border-color: rgba(247,144,9,.45); }
.balance-card.empty { border-color: rgba(240,68,56,.45); }
.state-note { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; font-size: .9rem; line-height: 1.5; }
.low .state-note { color: #b45309; background: rgba(247,144,9,.1); }
.empty .state-note { color: #b42318; background: rgba(240,68,56,.08); }
.state-note svg { flex: none; margin-top: 2px; }

.topup { display: flex; flex-direction: column; gap: 16px; }
.presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(88px, 1fr)); gap: 10px; border: 0; padding: 0; margin: 0; }
@media (max-width: 480px) { .presets { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.preset { min-height: 48px; border: 1px solid var(--vm-border); border-radius: 10px; background: var(--vm-surface); color: var(--vm-ink);
  font-size: 1.05rem; font-weight: 700; cursor: pointer; transition: border-color .15s, background-color .15s; font-variant-numeric: tabular-nums; }
.preset:hover { border-color: var(--vm-primary); }
.preset.on { border-color: var(--vm-primary); background: var(--vm-primary-soft); color: var(--vm-primary); box-shadow: 0 0 0 1px var(--vm-primary) inset; }
.preset:focus-visible, .chip:focus-visible, .btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.custom label { display: block; font-size: .88rem; font-weight: 600; color: var(--vm-ink); margin-bottom: 6px; }
.money-input { display: flex; align-items: center; gap: 6px; max-width: 220px; border: 1px solid var(--vm-border); border-radius: 10px;
  padding: 0 12px; background: var(--vm-surface); transition: border-color .15s; }
.money-input:focus-within { border-color: var(--vm-focus); box-shadow: 0 0 0 3px rgba(46,144,250,.18); }
.money-input.invalid { border-color: var(--vm-danger); }
.money-input span { color: var(--vm-ink-soft); font-weight: 600; }
.money-input input { border: 0; outline: 0; background: transparent; color: var(--vm-ink); font-size: 1rem; padding: 11px 0; width: 100%; font-variant-numeric: tabular-nums; }
.help { font-size: .82rem; color: var(--vm-ink-soft); margin-top: 6px; }
.help.err { color: var(--vm-danger); }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border-radius: 10px;
  font-weight: 600; font-size: .92rem; cursor: pointer; border: 1px solid var(--vm-border); background: var(--vm-surface); color: var(--vm-ink);
  transition: opacity .15s, background-color .15s; align-self: flex-start; }
.btn.primary { color: #fff; background: var(--vm-g-brand); border: none; }
.btn.primary:hover:not(:disabled) { opacity: .92; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn.more { margin-top: 12px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.chip { min-height: 32px; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--vm-border); background: var(--vm-surface);
  color: var(--vm-ink-soft); font-size: .82rem; font-weight: 600; cursor: pointer; transition: background-color .15s, color .15s; }
.chip:hover { color: var(--vm-ink); }
.chip.on { background: var(--vm-primary-soft); color: var(--vm-primary); border-color: rgba(37,99,235,.35); }

.ledger { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
.entry { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid var(--vm-border); }
.entry:first-child { border-top: 0; }
.ic { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.ic.topup, .ic.starting_credit { background: rgba(18,183,106,.12); color: var(--vm-green); }
.ic.refund, .ic.dispute { background: rgba(247,144,9,.12); color: #b45309; }
.desc { color: var(--vm-ink); font-size: .92rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { color: var(--vm-ink-soft); font-size: .8rem; margin-top: 2px; }
.meta a { color: var(--vm-primary); text-decoration: none; }
.meta a:hover { text-decoration: underline; }
.amt { text-align: right; font-weight: 700; font-size: .92rem; font-variant-numeric: tabular-nums; }
.amt.credit { color: var(--vm-green); }
.amt.debit { color: var(--vm-ink); }
.after { display: block; font-weight: 500; font-size: .76rem; color: var(--vm-ink-soft); }

@media (max-width: 480px) {
  .billing { padding: 20px 14px 48px; }
  .balance { font-size: 2.1rem; }
  .money-input { max-width: none; }
  .btn { align-self: stretch; }
}
@media (prefers-reduced-motion: reduce) {
  .spin { animation: none; }
  .preset, .chip, .btn, .money-input { transition: none; }
}
</style>
