<!--
  The workspace's Data Tables storage (ADM-1363): how much of the free 100 MB is used, this month's storage charges,
  and the state that matters, told by an icon and a word as well as colour:
    ok        under the warning line
    warn      at 80% of the free amount
    charging  above it: each day over the free amount is charged from the balance (price per GB-month)
    paused    the balance could not pay a day: new writes are refused (reads keep working, nothing is deleted)
-->
<template>
  <section class="tum" :class="`is-${level}`" aria-labelledby="tum-h">
    <div class="tum-top">
      <div>
        <h2 id="tum-h" class="tum-h">Table storage</h2>
        <p class="tum-big"><strong>{{ formatBytes(usage.bytes) }}</strong> <span>of {{ formatBytes(usage.free_bytes) }} free</span></p>
      </div>
      <span class="tum-state">
        <Icon :icon="STATE[level].icon" aria-hidden="true" />{{ STATE[level].word }}
      </span>
    </div>
    <div
      class="tum-bar" role="meter" :aria-valuenow="percentShown" aria-valuemin="0" aria-valuemax="100"
      :aria-valuetext="`${percentText} of the free storage used`" aria-label="Free storage used"
    >
      <span class="tum-fill" :style="{ width: `${Math.min(100, percentShown)}%` }" />
      <span v-if="warnAt != null" class="tum-mark" :style="{ left: `${warnAt}%` }" aria-hidden="true" />
    </div>
    <dl class="tum-facts">
      <div><dt>Used</dt><dd>{{ percentText }} of free</dd></div>
      <div><dt>This month</dt><dd>{{ formatUsd(usage.month_charges_usd) }}</dd></div>
      <div v-if="Number(usage.over_free_bytes) > 0"><dt>Charged per day now</dt><dd>{{ formatUsd(usage.per_day_usd) }}</dd></div>
      <div><dt>Price above free</dt><dd>{{ formatUsd(usage.usd_per_gb_month) }} per GB-month</dd></div>
    </dl>
    <p v-if="level === 'paused'" class="tum-msg" role="alert">
      <Icon icon="lucide:circle-alert" aria-hidden="true" />
      <span>Writes paused: the balance could not pay for storage<template v-if="usage.unpaid_since"> since {{ day(usage.unpaid_since) }}</template>. Top up or delete rows. Reading keeps working and nothing is deleted.</span>
      <RouterLink class="tum-link" to="/dashboard/settings/billing">Top up</RouterLink>
    </p>
    <p v-else-if="level === 'charging'" class="tum-msg">
      <Icon icon="lucide:info" aria-hidden="true" />
      <span>Above the free {{ formatBytes(usage.free_bytes) }}: {{ formatBytes(usage.over_free_bytes) }} is charged from your balance each day.</span>
    </p>
    <p v-else-if="level === 'warn'" class="tum-msg">
      <Icon icon="lucide:triangle-alert" aria-hidden="true" />
      <span>Most of the free storage is used. Above {{ formatBytes(usage.free_bytes) }} each day is charged from your balance.</span>
    </p>
    <p v-if="usage.measured_at" class="tum-when">Measured {{ when(usage.measured_at) }}</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { formatBytes, formatUsd, usageLevel } from './tableData'

const props = defineProps({ usage: { type: Object, required: true } })

const STATE = {
  ok: { icon: 'lucide:circle-check', word: 'Within free storage' },
  warn: { icon: 'lucide:triangle-alert', word: 'Near the free limit' },
  charging: { icon: 'lucide:hard-drive', word: 'Charged above free' },
  paused: { icon: 'lucide:circle-alert', word: 'Writes paused' },
}
const level = computed(() => usageLevel(props.usage))
const percentShown = computed(() => Math.max(0, Math.round(Number(props.usage.percent_of_free) || 0)))
const percentText = computed(() => `${Math.round((Number(props.usage.percent_of_free) || 0) * 10) / 10}%`)
const warnAt = computed(() => {
  const free = Number(props.usage.free_bytes)
  const warn = Number(props.usage.warn_at_bytes)
  return free > 0 && warn > 0 ? Math.min(100, Math.round((warn / free) * 100)) : null
})
const day = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString() }
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString() }
</script>

<style scoped>
.tum { display: grid; gap: 10px; padding: 14px 16px; border: 1px solid var(--vm-border); border-radius: 10px; background: var(--vm-surface); box-shadow: var(--vm-shadow-s); }
.tum-top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 8px; }
.tum-h { margin: 0; font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.tum-big { margin: 2px 0 0; font-size: 13px; color: var(--vm-ink-soft); }
.tum-big strong { font-size: 22px; font-weight: 800; color: var(--vm-ink); font-variant-numeric: tabular-nums; }
.tum-state { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--vm-green-soft); color: var(--vm-green-ink); }
.tum.is-warn .tum-state, .tum.is-charging .tum-state { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.tum.is-paused .tum-state { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.tum :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.tum-bar { position: relative; height: 8px; border-radius: 999px; background: var(--vm-surface-soft); border: 1px solid var(--vm-line); overflow: hidden; }
.tum-fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--vm-primary); transition: width .3s var(--vm-ease2); }
.tum.is-warn .tum-fill, .tum.is-charging .tum-fill { background: var(--vm-amber); }
.tum.is-paused .tum-fill { background: var(--vm-danger); }
.tum-mark { position: absolute; top: -1px; bottom: -1px; width: 2px; background: var(--vm-ink-faint); }
.tum-facts { display: flex; flex-wrap: wrap; gap: 6px 22px; margin: 0; }
.tum-facts div { display: grid; gap: 1px; }
.tum-facts dt { font-size: 11px; color: var(--vm-ink-faint); }
.tum-facts dd { margin: 0; font-size: 13px; font-weight: 600; color: var(--vm-ink); font-variant-numeric: tabular-nums; }
.tum-msg { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0; padding: 8px 10px; border-radius: 6px; font-size: 12px; line-height: 1.5; background: var(--vm-surface-soft); color: var(--vm-ink-soft); }
.tum.is-warn .tum-msg, .tum.is-charging .tum-msg { background: var(--vm-amber-soft); color: var(--vm-amber-ink); }
.tum.is-paused .tum-msg { background: var(--vm-red-soft); color: var(--vm-red-ink); }
.tum-msg span { flex: 1 1 240px; }
.tum-link { font-weight: 700; color: inherit; text-decoration: underline; }
.tum-link:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; border-radius: 3px; }
.tum-when { margin: 0; font-size: 11px; color: var(--vm-ink-faint); }
@media (prefers-reduced-motion: reduce) { .tum-fill { transition: none; } }
</style>
