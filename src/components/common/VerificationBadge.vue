<template>
  <!-- Verification-tier badge (Phase 4) — the ONE way delegation verification renders everywhere
       (Delegations page, Super Agent recents, chat tool results). Three tiers from badgeTier():
       verified (green) / unverified (amber) / failed (red). Read-only; accessible (role=img). -->
  <span
    class="inline-flex shrink-0 items-center rounded-full font-semibold align-middle whitespace-nowrap"
    :class="[meta.cls, compact ? 'gap-0 p-[3px]' : 'gap-1 px-2 py-0.5 text-[10px]']"
    role="img"
    :aria-label="ariaText"
    :title="tipText"
  >
    <svg :width="compact ? 10 : 9" :height="compact ? 10 : 9" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path v-if="tier === 'verified'" d="M20 6L9 17l-5-5" />
      <template v-else-if="tier === 'unverified'">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <path d="M12 9v4m0 4h.01" />
      </template>
      <path v-else d="M18 6L6 18M6 6l12 12" />
    </svg>
    <span v-if="!compact">{{ meta.label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { badgeTier } from './verificationBadge'

const props = defineProps({
  // true → verified; false/null → unverified (unless status is failed). Null means "no verdict",
  // which must render amber, never green.
  verified: { type: Boolean, default: null },
  status: { type: String, default: '' },
  // compact → icon-only chip (for dense rows like the chat activity timeline).
  compact: { type: Boolean, default: false },
  // Optional extra context appended to the tooltip/aria (e.g. "2/3 verified" for DELEGATE_PARALLEL).
  note: { type: String, default: '' },
})

// Palette mirrors the existing delegation pills (emerald/amber/red *-50 backgrounds).
const TIERS = {
  verified: {
    label: 'Verified',
    cls: 'bg-emerald-50 text-emerald-700',
    tip: 'Verified — passed the deterministic acceptance checks',
    aria: 'Result verified',
  },
  unverified: {
    label: 'Unverified',
    cls: 'bg-amber-50 text-amber-600',
    tip: 'Completed but not verified — check before relying on it',
    aria: 'Result completed but not verified',
  },
  failed: {
    label: 'Failed',
    cls: 'bg-red-50 text-red-600',
    tip: 'The delegation failed',
    aria: 'Delegation failed',
  },
}

const tier = computed(() => badgeTier(props.verified, props.status))
const meta = computed(() => TIERS[tier.value])
const tipText = computed(() => (props.note ? `${meta.value.tip} (${props.note})` : meta.value.tip))
const ariaText = computed(() => (props.note ? `${meta.value.aria} (${props.note})` : meta.value.aria))
</script>
