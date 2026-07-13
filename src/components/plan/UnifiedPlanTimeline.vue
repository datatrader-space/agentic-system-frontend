<script setup>
// Store-connected host for the unified plan experience — the ONLY plan UI (final cutover).
// Hydrates the durable snapshot(s) for a conversation and renders one UnifiedPlanCard per run,
// wired to the plan store's approval actions. There is no rollout flag.
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePlanStore } from '../../stores/usePlanStore'
import { useChatStore } from '../../stores/useChatStore'
import UnifiedPlanCard from './UnifiedPlanCard.vue'
import { notify } from '../../composables/useNotify'

const props = defineProps({
  conversationId: { type: [String, Number], default: null },
  readOnly: { type: Boolean, default: false },
})

const store = usePlanStore()
const chat = useChatStore()
const visible = computed(() => true)
const runs = computed(() => (props.conversationId != null
  ? store.runsForConversation(props.conversationId) : []))

let _timer = null
function scheduleHydrate() {
  if (_timer) clearTimeout(_timer)
  _timer = setTimeout(hydrate, 350)
}

async function hydrate() {
  if (!visible.value || props.conversationId == null) return
  await store.hydrateConversation(props.conversationId)
}

// Live updates come from the AUTHORITATIVE snapshot: re-hydrate (debounced) whenever chat activity
// advances. This keeps the chat hot path untouched (no edits to useChatStore) while the durable
// snapshot — not stream events alone — remains the source of truth. Only active when the unified
// UI is visible; also refresh on tab focus for reconnect/tab-restore.
let _unsub = null
function onVisibility() { if (!document.hidden) scheduleHydrate() }

onMounted(() => {
  hydrate()
  if (visible.value) {
    _unsub = chat.$subscribe(() => scheduleHydrate(), { detached: true })
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', onVisibility)
    }
  }
})
onBeforeUnmount(() => {
  if (_unsub) { try { _unsub() } catch (_) { /* noop */ } }
  if (typeof document !== 'undefined' && document.removeEventListener) {
    document.removeEventListener('visibilitychange', onVisibility)
  }
  if (_timer) clearTimeout(_timer)
})
watch(() => props.conversationId, hydrate)

async function onDecide(runId, { decision, comment }) {
  const res = await store.decide(runId, decision, { comment })
  if (res?.ok) {
    notify.success(decision === 'approve' ? 'Plan approved' : decision === 'reject' ? 'Plan rejected' : 'Changes requested')
  } else if (res?.conflict) {
    notify.warning('The plan changed since you opened it — showing the latest version.')
  } else if (res?.status && res.status !== 'busy') {
    notify.error(res.detail || 'Could not apply your decision.')
  }
}
</script>

<template>
  <div v-if="visible && runs.length" class="uplan-timeline">
    <UnifiedPlanCard
      v-for="p in runs" :key="p.run_id" :plan="p"
      :busy="store.isActionPending(p.run_id)" :read-only="readOnly"
      @decide="(payload) => onDecide(p.run_id, payload)" />
  </div>
</template>

<style scoped>
.uplan-timeline { display: flex; flex-direction: column; gap: 10px; }
</style>
