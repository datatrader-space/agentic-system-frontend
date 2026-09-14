<script setup>
// Store-connected host for ONE inline plan artifact, rendered at its durable message anchor.
// Hydrates the snapshot on mount (if the pushed frame hasn't populated it yet), passes freshness to
// the card, and routes approval decisions through the plan store (same domain service as the agent).
import { computed, onMounted } from 'vue'
import { usePlanStore } from '../../stores/usePlanStore'
import InlinePlanCard from './InlinePlanCard.vue'
import WorkGoalRow from './WorkGoalRow.vue'
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

// The four actions the backend advertises on `work_goal.available_actions`. Routed through the plan
// store so they share the same pending/conflict handling as an approval decision — a second path would
// mean two ideas of whether an action is in flight.
async function onGoalAction(action) {
  if (action === 'clear' &&
      !window.confirm('Stop this work? Everything done so far is kept, but nothing further runs.')) {
    return
  }
  const res = await store.goalAction(props.runId, action)
  if (res?.ok) {
    notify.success(action === 'pause' ? 'Work paused'
      : action === 'resume' ? 'Work resumed'
      : action === 'clear' ? 'Work stopped' : 'Goal updated')
  } else if (res?.status && res.status !== 'busy') {
    notify.error(res.detail || 'Could not apply that.')
  }
}

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
  <div v-if="plan">
    <!-- The Work-mode progress row sits ABOVE the plan, because for a run measured in hours the plan is
         the detail and "which segment, and why is it going round again" is the headline. Absent for
         every ordinary run, which is almost all of them. -->
    <WorkGoalRow v-if="plan.work_goal" :goal="plan.work_goal"
                 :busy="store.isActionPending(runId)" @action="onGoalAction" />
    <InlinePlanCard :plan="plan" :busy="store.isActionPending(runId)"
                    :read-only="readOnly" :conn-state="connState" @decide="onDecide" />
  </div>
</template>
