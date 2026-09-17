<script setup>
// Store-connected host for ONE inline plan artifact, rendered at its durable message anchor.
// Hydrates the snapshot on mount (if the pushed frame hasn't populated it yet), passes freshness to
// the card, and routes approval decisions through the plan store (same domain service as the agent).
import { computed, onMounted, watch } from 'vue'
import { usePlanStore } from '../../stores/usePlanStore'
import { useRunTimeline } from '../../stores/useRunTimeline'
import InlinePlanCard from './InlinePlanCard.vue'
import RunTimeline from './RunTimeline.vue'
import WorkGoalRow from './WorkGoalRow.vue'
import { notify } from '../../composables/useNotify'
import { confirm } from '../../composables/useConfirm'

const props = defineProps({
  runId: { type: String, required: true },
  planId: { type: String, default: '' },
  readOnly: { type: Boolean, default: false },
})

const store = usePlanStore()
const plan = computed(() => store.planFor(props.runId))
const connState = computed(() => store.connStateFor(props.runId))

onMounted(() => { if (!plan.value) store.hydrateRun(props.runId) })

// ONE RAIL for a Work run. Not a flag and not a rollout: a Work run IS a different shape of run — it
// spans segments, and a card per segment is what made the transcript unreadable. An ordinary run is a
// handful of steps that the existing card reads fine, so it keeps it. The condition is the run's own
// mode, which is the same way every other behaviour here is selected.
const timeline = useRunTimeline()
const useRail = computed(() => !!plan.value?.work_goal)
// A STEPLESS PLAN THAT HAS ALREADY STOPPED SAYS NOTHING. Prod conv 1662: a chat question whose routing call
// was refused at the provider drew a "Plan · Blocked" card with no steps under an answer that already said why.
// Only for an ordinary run that ended with nothing planned — a plan still drafting, awaiting approval, or a
// Work run keeps its card.
const ENDED = new Set(['blocked', 'failed', 'cancelled', 'completed', 'superseded'])
const emptyAndEnded = computed(() => {
  const p = plan.value
  if (!p || p.work_goal) return false
  if ((p.steps || []).length || (p.total_step_count || 0) > 0) return false
  const state = String(p.plan_status_user || p.plan_status || '').toLowerCase()
  return ENDED.has(state)
})
// Re-derived from the snapshot on every change. `ingestSnapshot` resets and replays, so re-hydrating
// cannot duplicate or reorder the rail -- the same property the reducer gives replay.
watch(plan, (p) => { if (p && useRail.value) timeline.ingestSnapshot(props.runId, p) },
      { immediate: true, deep: true })

// The four actions the backend advertises on `work_goal.available_actions`. Routed through the plan
// store so they share the same pending/conflict handling as an approval decision — a second path would
// mean two ideas of whether an action is in flight.
async function onGoalAction(action) {
  // The house rule is custom popups, never a native dialog: `window.confirm` blocks the event loop,
  // cannot be styled or tested, and is suppressed outright by some browsers in an iframe.
  if (action === 'clear' && !(await confirm({
    title: 'Stop this work?',
    message: 'Everything done so far is kept, but nothing further runs.',
    confirmLabel: 'Stop work',
  }))) {
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
  <div v-if="plan && !emptyAndEnded">
    <!-- The Work-mode progress row sits ABOVE the plan, because for a run measured in hours the plan is
         the detail and "which segment, and why is it going round again" is the headline. Absent for
         every ordinary run, which is almost all of them. -->
    <!-- ONE SURFACE. The rail owns the header too: a WorkGoalRow above it restated the state, the
         segment, the attempts AND the findings, so a run printed its findings twice under two
         different headings. That is the duplication this component was built to remove. -->
    <RunTimeline v-if="useRail" :run-id="runId" :goal="plan.work_goal"
                 :busy="store.isActionPending(runId)" @action="onGoalAction" />
    <template v-else>
      <WorkGoalRow v-if="plan.work_goal" :goal="plan.work_goal"
                   :busy="store.isActionPending(runId)" @action="onGoalAction" />
      <InlinePlanCard :plan="plan" :busy="store.isActionPending(runId)"
                      :read-only="readOnly" :conn-state="connState" @decide="onDecide" />
    </template>
  </div>
</template>
