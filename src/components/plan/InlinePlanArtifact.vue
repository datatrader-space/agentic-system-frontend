<script setup>
// Store-connected host for ONE inline plan artifact, rendered at its durable message anchor.
// Hydrates the snapshot on mount (if the pushed frame hasn't populated it yet), passes freshness to
// the card, and routes approval decisions through the plan store (same domain service as the agent).
import { computed, onMounted } from 'vue'
import { usePlanStore } from '../../stores/usePlanStore'
import InlinePlanCard from './InlinePlanCard.vue'
import { notify } from '../../composables/useNotify'

const props = defineProps({
  runId: { type: String, required: true },
  planId: { type: String, default: '' },
  readOnly: { type: Boolean, default: false },
})

const store = usePlanStore()
const plan = computed(() => store.planFor(props.runId))
const connState = computed(() => store.connStateFor(props.runId))

onMounted(() => { if (!plan.value) store.hydrateRun(props.runId) })

async function onDecide({ decision, comment }) {
  const res = await store.decide(props.runId, decision, { comment })
  if (res?.ok) {
    notify.success(decision === 'approve' ? 'Plan approved'
      : decision === 'reject' ? 'Plan rejected' : 'Changes requested')
  } else if (res?.conflict) {
    notify.warning('The plan changed since you opened it — showing the latest version.')
  } else if (res?.status && res.status !== 'busy') {
    notify.error(res.detail || 'Could not apply your decision.')
  }
}
</script>

<template>
  <InlinePlanCard v-if="plan" :plan="plan" :busy="store.isActionPending(runId)"
                  :read-only="readOnly" :conn-state="connState" @decide="onDecide" />
</template>
