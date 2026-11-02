<template>
  <!-- Coding Agent permission card. The agent paused on a protected/risky action (e.g. create .env, run a
       risky command). The user allows (once / task / project) or denies; the choice goes back as
       permission_response and the agent remembers it. No native dialogs. -->
  <div v-for="(r, i) in requests" :key="i" class="pc" role="group" :aria-label="`Permission needed: ${riskLabel(r.card)}`">
    <div class="pc-head">
      <Icon icon="lucide:shield-alert" class="pc-ic" aria-hidden="true" />
      <span class="pc-title">Permission needed</span>
      <span class="pc-risk">{{ riskLabel(r.card) }}</span>
    </div>

    <p class="pc-reason">{{ r.card.reason || 'This action needs your approval.' }}</p>

    <div v-if="r.card.path || r.card.command" class="pc-target">{{ r.card.path || r.card.command }}</div>

    <div class="pc-actions">
      <button
        v-for="(opt, k) in (r.card.options && r.card.options.length ? r.card.options : DEFAULT_OPTIONS)"
        :key="k" type="button"
        class="pc-btn" :class="isDeny(opt) ? 'deny' : 'allow'"
        @click="$emit('respond', { card: r.card, choice: opt })"
      >{{ opt }}</button>
    </div>

    <p v-if="r.card.safe_alternative" class="pc-alt">
      <Icon icon="lucide:lightbulb" aria-hidden="true" /> {{ r.card.safe_alternative }}
    </p>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'

defineProps({
  requests: { type: Array, default: () => [] },
})
defineEmits(['respond'])

const DEFAULT_OPTIONS = ['Allow once', 'Allow for this task', 'Always allow for this project', 'Deny']

function isDeny(opt) { return String(opt || '').toLowerCase().includes('deny') }

function riskLabel(card) {
  const r = (card && card.risk) || ''
  if (r === 'protected_gitignored_secret_file') return 'secret file'
  if (r === 'modifies_state_or_network') return 'risky command'
  return (r || 'review').replace(/_/g, ' ')
}
</script>

<style scoped>
.pc {
  --pc-on-solid: white;
  margin: 4px 14px 0; padding: 12px; border-radius: 12px; font-size: 13.5px;
  border: 1px solid color-mix(in srgb, var(--vm-amber) 45%, transparent);
  background: color-mix(in srgb, var(--vm-amber) 9%, var(--vm-surface));
  color: var(--vm-ink);
}
.pc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.pc-ic { width: 16px; height: 16px; flex: 0 0 auto; color: color-mix(in srgb, var(--vm-amber) 70%, var(--vm-ink)); }
.pc-title { font-weight: 700; color: var(--vm-ink); }
.pc-risk { margin-left: auto; font: 600 11.5px var(--vm-font-sans); color: color-mix(in srgb, var(--vm-amber) 55%, var(--vm-ink)); }
.pc-reason { margin: 0 0 6px; line-height: 1.5; color: var(--vm-ink-soft); }
.pc-target { margin-bottom: 8px; padding: 4px 8px; font: 12px var(--vm-font-mono); word-break: break-all; border-radius: 6px; background: var(--vm-surface); border: 1px solid var(--vm-line); color: var(--vm-ink); }
.pc-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.pc-btn { min-height: 32px; padding: 0 12px; border-radius: 8px; font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s, border-color .15s; }
.pc-btn.allow { border: 1px solid var(--vm-violet); background: var(--vm-violet); color: var(--pc-on-solid); }
.pc-btn.allow:hover { background: var(--vm-violet-d); border-color: var(--vm-violet-d); }
.pc-btn.deny { border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink-soft); }
.pc-btn.deny:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.pc-alt { display: flex; align-items: flex-start; gap: 6px; margin: 8px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--vm-ink-soft); }
.pc-alt :deep(svg) { width: 14px; height: 14px; flex: 0 0 auto; margin-top: 2px; color: color-mix(in srgb, var(--vm-amber) 70%, var(--vm-ink)); }
@media (max-width: 640px) { .pc-btn { min-height: 44px; } }
</style>
