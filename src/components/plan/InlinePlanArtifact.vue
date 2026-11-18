<script setup>
// Store-connected host for ONE inline plan artifact, rendered at its durable message anchor.
// Hydrates the snapshot on mount (if the pushed frame hasn't populated it yet), passes freshness to
// the card, and routes approval decisions through the plan store (same domain service as the agent).
import { computed, onMounted } from 'vue'
import { usePlanStore, planIsStepless } from '../../stores/usePlanStore'
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
// Plan mode answers this plan on its own card (PlanModeCard); here it is shown, never offered a second time.
const decided = computed(() => props.readOnly || store.isPlanModeRun(props.runId, plan.value?.plan_version_id))

onMounted(() => { if (!plan.value) store.hydrateRun(props.runId) })

// A STEPLESS ORDINARY PLAN SAYS NOTHING (`planIsStepless`): the card appears once there is a step to show.
const stepless = computed(() => planIsStepless(plan.value))

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
  <div v-if="plan && !stepless">
    <InlinePlanCard :plan="plan" :busy="store.isActionPending(runId)"
                    :read-only="decided" :conn-state="connState" @decide="onDecide" />
  </div>
</template>
