<template>
  <div class="billing">
    <header class="head">
      <h1>Billing &amp; plan</h1>
      <p>Manage your organization's subscription, usage, and payment method.</p>
    </header>

    <!-- status banners from Stripe redirect -->
    <div v-if="banner" class="banner" :class="banner.kind">{{ banner.text }}</div>

    <div v-if="loading" class="card"><div class="vm-skel" style="height:18px;width:40%"></div></div>

    <template v-else>
      <!-- Billing disabled notice -->
      <div v-if="!billingEnabled" class="card notice">
        <strong>Payments aren't enabled yet.</strong>
        <p>Billing is configured by an administrator. You can still see your current plan and usage below.</p>
      </div>

      <!-- Current plan -->
      <div class="card">
        <div class="row between">
          <div>
            <div class="muted">Current plan</div>
            <div class="plan-name">{{ sub?.plan?.name || 'Free' }}
              <span class="status" :class="sub?.status">{{ sub?.status || 'active' }}</span>
            </div>
            <div v-if="sub?.current_period_end" class="muted sm">
              Renews / ends {{ formatDate(sub.current_period_end) }}
            </div>
          </div>
          <button v-if="canManage && hasCustomer && billingEnabled" class="btn ghost" :disabled="busy.portal" @click="openPortal">
            {{ busy.portal ? 'Opening…' : 'Manage billing' }}
          </button>
        </div>
      </div>

      <!-- Usage vs limits -->
      <div class="card">
        <h3>Usage this period</h3>
        <div class="usage">
          <div v-for="u in usage" :key="u.key" class="usage-row">
            <div class="usage-top">
              <span>{{ u.label }}</span>
              <span class="muted">{{ fmtUsed(u) }} / {{ u.limit === null ? '∞' : fmtLimit(u) }}</span>
            </div>
            <div class="bar"><div class="fill" :class="{ over: isOver(u) }" :style="{ width: pct(u) + '%' }"></div></div>
          </div>
        </div>
      </div>

      <!-- Plans -->
      <div class="card">
        <div class="row between wrap">
          <h3>Plans</h3>
          <div v-if="billingEnabled" class="toggle">
            <button :class="{ active: interval === 'monthly' }" @click="interval = 'monthly'">Monthly</button>
            <button :class="{ active: interval === 'yearly' }" @click="interval = 'yearly'">Yearly</button>
          </div>
        </div>
        <div class="plans">
          <div v-for="p in plans" :key="p.tier" class="plan" :class="{ current: p.tier === currentTier }">
            <div class="plan-h">
              <span class="plan-title">{{ p.name }}</span>
              <span v-if="p.tier === currentTier" class="chip">Current</span>
            </div>
            <div class="price">
              <span class="amt">${{ priceFor(p) }}</span><span class="per">/mo</span>
            </div>
            <ul class="limits">
              <li>{{ p.max_agents ?? '∞' }} agents</li>
              <li>{{ p.max_workspaces ?? '∞' }} workspaces</li>
              <li>{{ p.max_members ?? '∞' }} members</li>
              <li v-if="p.max_mcp_servers !== 0">{{ p.max_mcp_servers ?? '∞' }} MCP servers</li>
            </ul>
            <button
              v-if="p.tier !== 'enterprise'"
              class="btn"
              :class="p.tier === currentTier ? 'ghost' : 'primary'"
              :disabled="!canUpgrade(p) || busy.checkout"
              @click="upgrade(p)"
            >
              {{ ctaLabel(p) }}
            </button>
            <a v-else class="btn ghost" href="/contact">Contact sales</a>
          </div>
        </div>
        <p v-if="!canManage" class="muted sm">Only an org owner, admin, or billing member can change the plan.</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'
import { notify } from '../composables/useNotify'

const route = useRoute()
const loading = ref(true)
const billingEnabled = ref(false)
const sub = ref(null)
const usage = ref([])
const plans = ref([])
const canManage = ref(false)
const interval = ref('monthly')
const busy = ref({ checkout: false, portal: false })

const currentTier = computed(() => sub.value?.plan?.tier || 'free')
const hasCustomer = computed(() => !!sub.value?.external_customer_id)
const banner = computed(() => {
  if (route.query.status === 'success') return { kind: 'ok', text: 'Payment received — your plan is being activated. It may take a few seconds to reflect.' }
  if (route.query.status === 'cancel') return { kind: 'warn', text: 'Checkout cancelled. No changes were made.' }
  return null
})

onMounted(load)

async function load() {
  loading.value = true
  try {
    const [{ data: subData }, { data: planData }] = await Promise.all([
      api.billingSubscription(),
      api.billingPlans(),
    ])
    sub.value = subData.subscription
    usage.value = subData.usage || []
    canManage.value = subData.can_manage
    billingEnabled.value = subData.billing_enabled
    plans.value = planData.plans || []
  } catch (e) {
    notify.error(e.response?.data?.error || 'Could not load billing')
  } finally {
    loading.value = false
  }
}

function priceFor(p) {
  const monthly = Number(p.price_monthly_usd)
  if (interval.value === 'yearly' && Number(p.price_yearly_usd) > 0) return Math.round(Number(p.price_yearly_usd) / 12)
  return monthly
}
function fmtUsed(u) { return u.key === 'llm_cost_usd' ? `$${Number(u.used).toFixed(2)}` : u.used }
function fmtLimit(u) { return u.key === 'llm_cost_usd' ? `$${Number(u.limit).toFixed(2)}` : u.limit }
function pct(u) {
  if (u.limit === null || !u.limit) return u.used > 0 ? 6 : 0
  return Math.min(100, Math.round((Number(u.used) / Number(u.limit)) * 100))
}
function isOver(u) { return u.limit !== null && u.limit > 0 && Number(u.used) >= Number(u.limit) }

function canUpgrade(p) {
  return billingEnabled.value && canManage.value && p.purchasable && p.tier !== currentTier.value
}
function ctaLabel(p) {
  if (p.tier === currentTier.value) return 'Current plan'
  if (!billingEnabled.value) return 'Unavailable'
  if (!p.purchasable) return 'Not configured'
  return p.tier === 'free' ? 'Downgrade' : 'Upgrade'
}
function formatDate(s) { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }

async function upgrade(p) {
  if (!canUpgrade(p)) return
  busy.value.checkout = true
  try {
    const { data } = await api.billingCheckout(p.tier, interval.value)
    if (data.url) window.location.href = data.url
  } catch (e) {
    notify.error(e.response?.data?.error || 'Could not start checkout')
  } finally {
    busy.value.checkout = false
  }
}

async function openPortal() {
  busy.value.portal = true
  try {
    const { data } = await api.billingPortal()
    if (data.url) window.location.href = data.url
  } catch (e) {
    notify.error(e.response?.data?.error || 'Could not open billing portal')
  } finally {
    busy.value.portal = false
  }
}
</script>

<style scoped>
.billing { max-width: 900px; margin: 0 auto; padding: 28px 20px 64px; display: flex; flex-direction: column; gap: 16px; }
.head h1 { font-family: var(--vm-font-display); font-size: 1.6rem; font-weight: 800; color: var(--vm-ink); margin: 0; }
.head p { color: var(--vm-ink-soft); margin: 4px 0 0; font-size: .92rem; }
.card { background: #fff; border: 1px solid var(--vm-border); border-radius: 14px; padding: 20px; }
.card h3 { margin: 0 0 14px; font-size: 1rem; font-weight: 700; color: var(--vm-ink); }
.notice { background: var(--vm-primary-soft); border-color: rgba(37,99,235,.25); }
.notice p { margin: 6px 0 0; font-size: .875rem; color: var(--vm-ink-soft); }
.row { display: flex; align-items: center; gap: 16px; }
.row.between { justify-content: space-between; }
.row.wrap { flex-wrap: wrap; }
.muted { color: var(--vm-ink-faint); font-size: .8rem; }
.muted.sm { font-size: .75rem; margin-top: 4px; }
.plan-name { font-size: 1.3rem; font-weight: 700; color: var(--vm-ink); display: flex; align-items: center; gap: 10px; }
.status { font-size: .68rem; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; color: var(--vm-green); background: rgba(16,185,129,.12); }
.status.past_due, .status.expired { color: #b45309; background: rgba(245,158,11,.14); }
.status.cancelled { color: #b91c1c; background: rgba(239,68,68,.1); }

.banner { padding: 12px 16px; border-radius: 12px; font-size: .9rem; }
.banner.ok { color: #047857; background: rgba(16,185,129,.1); border: 1px solid rgba(16,185,129,.25); }
.banner.warn { color: #b45309; background: rgba(245,158,11,.12); border: 1px solid rgba(245,158,11,.3); }

.usage { display: flex; flex-direction: column; gap: 14px; }
.usage-top { display: flex; justify-content: space-between; font-size: .85rem; color: var(--vm-ink); margin-bottom: 6px; }
.bar { height: 7px; background: var(--vm-surface-soft); border-radius: 999px; overflow: hidden; }
.fill { height: 100%; background: var(--vm-g-brand); border-radius: 999px; transition: width .3s; }
.fill.over { background: #ef4444; }

.toggle { display: inline-flex; border: 1px solid var(--vm-border); border-radius: 10px; padding: 3px; }
.toggle button { border: none; background: none; padding: 6px 14px; border-radius: 8px; font-size: .82rem; font-weight: 600; color: var(--vm-ink-soft); cursor: pointer; }
.toggle button.active { background: var(--vm-primary-soft); color: var(--vm-primary); }

.plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
.plan { border: 1px solid var(--vm-border); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.plan.current { border-color: var(--vm-primary); box-shadow: 0 0 0 1px var(--vm-primary) inset; }
.plan-h { display: flex; align-items: center; justify-content: space-between; }
.plan-title { font-weight: 700; color: var(--vm-ink); }
.chip { font-size: .65rem; font-weight: 700; text-transform: uppercase; color: var(--vm-primary); background: var(--vm-primary-soft); padding: 2px 8px; border-radius: 999px; }
.price { display: flex; align-items: baseline; gap: 3px; }
.amt { font-size: 1.8rem; font-weight: 800; color: var(--vm-ink); }
.per { color: var(--vm-ink-faint); font-size: .8rem; }
.limits { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; font-size: .82rem; color: var(--vm-ink-soft); }
.limits li::before { content: '✓ '; color: var(--vm-teal); }

.btn { margin-top: auto; padding: 10px 14px; border-radius: 10px; font-weight: 600; font-size: .85rem; cursor: pointer; border: 1px solid var(--vm-border); background: #fff; color: var(--vm-ink); text-align: center; text-decoration: none; }
.btn.primary { color: #fff; background: var(--vm-g-brand); border: none; box-shadow: var(--vm-glow-p); }
.btn.ghost { background: #fff; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
</style>
