<template>
  <div class="lp-wrap">
    <p class="lp" role="status" aria-live="polite" data-test="live-price">
      <template v-if="loading"><span class="lp-dot" aria-hidden="true" />Working out the price…</template>
      <template v-else-if="price">
        <strong data-test="live-price-amount">{{ amount }}</strong><span v-if="held"> · {{ usd(price.most) }} is held</span>
        <span v-if="price.status === 'unknown'" class="lp-note" data-test="live-price-reason">{{ unknownReason }}</span>
        <span class="lp-est">An estimate: you pay what the provider bills.</span>
        <span class="lp-note">Nothing is spent until you press Generate on its card.</span>
      </template>
      <template v-else-if="problem"><span :class="{ 'lp-refused': refused }" data-test="live-price-problem">{{ problem }}</span><span v-if="refused" class="lp-note">Choose another model to continue.</span></template>
      <template v-else>{{ empty }}</template>
    </p>
    <fieldset v-if="!loading && price?.adjustments?.length" class="lp-adjust" data-test="live-price-adjustments">
      <legend>This model cannot do everything as asked</legend>
      <ul><li v-for="(a, i) in price.adjustments" :key="`${a.field}-${i}`">{{ describe(a) }}</li></ul>
      <label v-if="price.needsAcceptance" class="lp-accept"><input type="checkbox" :checked="accepted" data-test="live-price-accept" @change="emit('update:accepted', $event.target.checked)" /> Accept these changes</label>
      <p v-if="price.needsAcceptance && !accepted" class="lp-note" role="status">Accept the changes, or change the settings, to continue.</p>
    </fieldset>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { usd } from '../../utils/studioPrice'
// The draft's price, from useLivePrice: worked out as the settings change, before anything is asked for. It is the
// listed price, an estimate: the person pays what the provider bills (owner, 2026-11-03), so it is never "at most".
// A price that depends on the settings the provider uses is shown as its published range. unknown: why it is known
// only once made (never "$0"). code 'not_priced': the model cannot be charged for, so it cannot be used.
const props = defineProps({ price: Object, loading: Boolean, problem: String, code: { type: String, default: '' }, accepted: Boolean, empty: { type: String, default: 'Fill in the details to see the price.' } })
const emit = defineEmits(['update:accepted'])
const refused = computed(() => props.code === 'not_priced')
const amount = computed(() => {
  const p = props.price
  if (p.status === 'unknown') return 'No published price'
  if (p.status === 'estimated' && p.most != null && p.most > p.estimate) return `About ${usd(p.estimate)} to ${usd(p.most)}`
  return `About ${usd(p.estimate)}`
})
const held = computed(() => props.price?.status === 'unknown' && props.price.most > 0)
const unknownReason = computed(() => { const r = String(props.price?.reason || '').trim(); return r ? `${r[0].toUpperCase()}${r.slice(1)}${/[.!?]$/.test(r) ? '' : '.'}` : 'This model publishes no price before it runs; the cost is known once it is made.' })
const word = key => { const s = String(key || '').replace(/[_-]+/g, ' ').trim(); return s ? s[0].toUpperCase() + s.slice(1) : 'Setting' }
const value = v => v === true ? 'on' : v === false ? 'off' : String(v)
function describe(a) {
  const change = a.requested != null && a.proposed != null ? `you asked for ${value(a.requested)}; it would use ${value(a.proposed)}` : ''
  return [`${word(a.field)}: ${change}`.replace(/: $/, ''), a.reason ? `(${a.reason})` : ''].filter(Boolean).join(' ') + '.'
}
</script>
<style scoped>
.lp-wrap{display:grid;gap:8px;min-width:0}
.lp{display:flex;flex-wrap:wrap;align-items:center;gap:2px 0;margin:0;font-size:12.5px;line-height:1.55;color:var(--vm-ink-soft)}
.lp strong{color:var(--vm-ink);font-weight:600}
.lp-est,.lp-note{flex-basis:100%;color:var(--vm-ink-soft)}
.lp-refused{color:var(--vm-ink);font-weight:600}
.lp-dot{width:6px;height:6px;margin-right:7px;border-radius:50%;background:var(--vm-violet,#8b7cf6);animation:lp-pulse 1s ease-in-out infinite}
.lp-adjust{display:grid;gap:6px;margin:0;padding:10px 12px;border:1px solid var(--vm-line);border-radius:7px;background:var(--vm-surface-2);font-size:12.5px;line-height:1.55;color:var(--vm-ink-soft)}
.lp-adjust legend{padding:0 4px;color:var(--vm-ink);font-weight:600}
.lp-adjust ul{margin:0;padding-left:18px}
.lp-adjust .lp-note{margin:0}
.lp-accept{display:flex;align-items:center;gap:8px;min-height:36px;color:var(--vm-ink);cursor:pointer}
.lp-accept input{width:18px;height:18px}
@keyframes lp-pulse{0%,100%{opacity:.35}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.lp-dot{animation:none}}
@media(max-width:767px){.lp-accept{min-height:44px}}
</style>
