<template>
  <!-- Coding Agent permission card (Phase 6). The agent paused on a protected/risky action (e.g. create
       .env, run a risky command). The user allows (once / task / project) or denies; the choice goes back
       as permission_response and the agent remembers it. No native dialogs. -->
  <div
    v-for="(r, i) in requests" :key="i"
    class="border border-amber-300 bg-amber-50/70 rounded-xl p-3 mt-1 text-sm"
  >
    <div class="flex items-center gap-2 mb-1.5">
      <span class="text-base leading-none">🔒</span>
      <span class="font-semibold text-amber-900">Permission needed</span>
      <span class="ml-auto text-[11px] text-amber-600 font-medium uppercase tracking-wide">
        {{ riskLabel(r.card) }}
      </span>
    </div>

    <p class="text-gray-700 mb-1.5">{{ r.card.reason || 'This action needs your approval.' }}</p>

    <div
      v-if="r.card.path || r.card.command"
      class="text-[12px] font-mono bg-white border border-amber-100 rounded px-2 py-1 mb-2 break-all"
    >{{ r.card.path || r.card.command }}</div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="(opt, k) in (r.card.options && r.card.options.length ? r.card.options : DEFAULT_OPTIONS)"
        :key="k"
        @click="$emit('respond', { card: r.card, choice: opt })"
        :class="btnClass(opt)"
      >{{ opt }}</button>
    </div>

    <p v-if="r.card.safe_alternative" class="text-[11px] text-amber-700 mt-2">
      💡 {{ r.card.safe_alternative }}
    </p>
  </div>
</template>

<script setup>
defineProps({
  requests: { type: Array, default: () => [] },
})
defineEmits(['respond'])

const DEFAULT_OPTIONS = ['Allow once', 'Allow for this task', 'Always allow for this project', 'Deny']

function isDeny(opt) { return String(opt || '').toLowerCase().includes('deny') }

function btnClass(opt) {
  return isDeny(opt)
    ? 'px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50'
    : 'px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700'
}

function riskLabel(card) {
  const r = (card && card.risk) || ''
  if (r === 'protected_gitignored_secret_file') return 'secret file'
  if (r === 'modifies_state_or_network') return 'risky command'
  return (r || 'review').replace(/_/g, ' ')
}
</script>
