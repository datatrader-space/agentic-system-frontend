<template>
  <p class="lp" role="status" aria-live="polite" data-test="live-price">
    <template v-if="loading"><span class="lp-dot" aria-hidden="true" />Working out the price…</template>
    <template v-else-if="price"><strong>{{ price.status === 'unknown' ? 'No published price' : `About ${usd(price.estimate)}` }}</strong><span v-if="price.status === 'unknown'"> · at most {{ usd(price.most) }} is held</span><span v-else-if="price.most > price.estimate"> · at most {{ usd(price.most) }}</span><span class="lp-note"> · nothing is spent until you press Generate on its card</span></template>
    <template v-else-if="problem">{{ problem }}</template>
    <template v-else>{{ empty }}</template>
  </p>
</template>
<script setup>
import { usd } from '../../utils/studioPrice'
// The draft's price, from useLivePrice: worked out as the settings change, before anything is asked for.
defineProps({ price: Object, loading: Boolean, problem: String, empty: { type: String, default: 'Fill in the details to see the price.' } })
</script>
<style scoped>
.lp{display:flex;flex-wrap:wrap;align-items:center;gap:2px 0;margin:0;font-size:12.5px;line-height:1.55;color:var(--vm-ink-soft)}
.lp strong{color:var(--vm-ink);font-weight:600}
.lp-note{color:var(--vm-ink-soft)}
.lp-dot{width:6px;height:6px;margin-right:7px;border-radius:50%;background:var(--vm-violet,#8b7cf6);animation:lp-pulse 1s ease-in-out infinite}
@keyframes lp-pulse{0%,100%{opacity:.35}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.lp-dot{animation:none}}
</style>
