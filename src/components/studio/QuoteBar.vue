<template>
  <div class="qb" data-test="studio-quote-bar">
    <div class="qb-summary"><strong>{{ summary }}</strong><span>{{ priceUsd == null ? 'Price shown on the approval card before anything is spent' : priceUsd === 0 ? 'Free local edit' : `$${Number(priceUsd).toFixed(3)}` }}</span></div>
    <p v-if="disabledReason" :id="reasonId" class="qb-reason" role="status">{{ disabledReason }}</p>
    <div class="qb-actions"><button v-if="shuffle" type="button" class="st-button qb-shuffle" aria-label="Shuffle preset variation" :disabled="busy" @click="emit('shuffle')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h3l12 12h3M17 14l4 4-4 4M3 18h3l4-4M14 10l4-4h3M17 2l4 4-4 4" /></svg></button><button type="button" class="st-button qb-generate" :class="{ primary: !busy && !disabledReason }" data-test="studio-generate" :disabled="busy || !!disabledReason" :aria-describedby="disabledReason ? reasonId : undefined" @click="emit('generate')">{{ busy ? 'Preparing request...' : actionLabel }}</button></div>
  </div>
</template>
<script setup>
import { useId } from 'vue'
defineProps({ summary: { type: String, required: true }, priceUsd: { type: Number, default: null }, disabledReason: { type: String, default: '' }, busy: Boolean, shuffle: { type: Boolean, default: true }, actionLabel: { type: String, default: 'Generate' } })
const emit = defineEmits(['generate','shuffle'])
const reasonId = `quote-reason-${useId()}`
</script>
<style scoped>
.qb{display:grid;gap:12px;padding:18px 24px}.qb-summary{display:grid;gap:4px}.qb-summary strong{font-size:14px;font-weight:600}.qb-summary span{font-size:12px;line-height:1.5;color:var(--vm-ink-soft)}.qb-reason{color:var(--vs-warn-ink);font-size:12px;line-height:1.5}.qb-actions{display:flex;gap:8px}.qb-shuffle{width:42px;padding:0}.qb-generate{flex:1;min-height:42px}.qb-generate:disabled{border-color:var(--vm-line);background:var(--vm-surface-2);color:var(--vm-ink-soft);opacity:1;cursor:not-allowed}@media(max-width:767px){.qb{padding:12px 16px;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px}.qb-summary{align-self:center}.qb-summary span{font-size:11px}.qb-summary strong{font-size:13px}.qb-actions{grid-column:2;grid-row:1}.qb-reason{grid-column:1/-1;grid-row:2;font-size:12px}.qb-shuffle{width:44px}.qb-generate{min-width:105px;min-height:44px}}
</style>
