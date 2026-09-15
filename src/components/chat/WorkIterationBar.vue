<template>
  <!-- Two shapes, one component, because they are the same fact at different moments: which iteration
       of a Work run you are looking at. `divider` sections the transcript; the live form sits at the
       foot of the thread and says what is happening right now. -->
  <div v-if="divider" class="iter-divider" data-test="iteration-divider">
    <span class="iter-line" aria-hidden="true"></span>
    <span class="iter-chip">{{ label }}</span>
    <span class="iter-line" aria-hidden="true"></span>
  </div>

  <div v-else-if="running" class="iter-live" data-test="iteration-live"
       role="status" aria-live="polite">
    <span class="iter-pulse" aria-hidden="true"></span>
    <span class="iter-live-text">{{ liveLabel }}<template v-if="attemptText"> · {{ attemptText }} so far</template> · working — more iterations may follow</span>
  </div>

  <div v-else-if="finished" class="iter-done" :class="outcome.tone" data-test="iteration-outcome">
    <span class="iter-done-title">{{ outcome.title }}</span>
    <span class="iter-done-sub">{{ outcome.detail }}</span>
  </div>
</template>

<script setup>
// ONE SOURCE OF TRUTH FOR "WHERE IS THIS RUN".
//
// `WorkGoalRow` already answers this, authoritatively: it renders `plan.work_goal` — the RunGoal row
// itself, delivered by the transactional outbox, which survives a worker crash and a reconnect. The
// first version of this component kept its own copy from the live `work_segment` frames instead, and
// production showed exactly what that costs: the goal row read "Working - Segment 3 of 12" while this
// bar read "Iteration 1 of 12", because a fault in the headless bridge meant the frames never arrived.
// Two displays of one fact, and the newer one was wrong.
//
// So this reads the SAME object. It exists only because `WorkGoalRow` renders at the plan's anchor,
// far up a long thread, and the question "do I need to keep waiting?" is asked at the bottom, next to
// the composer. Same data, second placement - never a second copy.
import { computed } from 'vue'
import { useChatStore } from '../../stores/useChatStore'
import { usePlanStore } from '../../stores/usePlanStore'

const props = defineProps({
  // When set, render the section divider for this iteration instead of the live status.
  divider: { type: Object, default: null },
})

const chat = useChatStore()
const plan = usePlanStore()

const label = computed(() => {
  const d = props.divider || {}
  return `Iteration ${d.segment}${d.max ? ` of ${d.max}` : ''}`
})

// The run's goal, straight from the plan store. Null for every ordinary chat, which renders nothing.
const goal = computed(() => {
  const runs = plan.runsForConversation(chat.conversationId)
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    if (runs[i] && runs[i].work_goal) return runs[i].work_goal
  }
  return null
})

const used = computed(() => Number((goal.value && goal.value.segments_used) || 0))
const max = computed(() => Number((goal.value && goal.value.max_segments) || 0))
const state = computed(() => String((goal.value && goal.value.state) || ''))
const running = computed(() => state.value === 'ACTIVE')

// "Iteration 3 of 12" - the iteration now RUNNING, which is `segments_used` floored at 1: the counter
// is incremented before a segment is dispatched, and is still 0 while the very first one executes.
const liveLabel = computed(() =>
  (running.value ? `Iteration ${Math.max(1, used.value)}${max.value ? ` of ${max.value}` : ''}` : ''))

// WHAT THE USER ACTUALLY ASKED: "how do I know if I need to wait more, or the agent ended?" Every
// state answers it in a sentence, and an unknown one says the honest thing rather than guessing.
const STATE = {
  ACTIVE: { tone: 'run', title: 'Still working', detail: 'More iterations may follow.' },
  ACHIEVED: { tone: 'ok', title: 'Goal met', detail: 'The run verified its objective and stopped.' },
  EXHAUSTED: { tone: 'warn', title: 'Stopped - goal not met',
               detail: 'Every permitted iteration was used without the objective being verified.' },
  PAUSED: { tone: 'warn', title: 'Paused', detail: 'The run stopped before its goal was verified.' },
  ABANDONED: { tone: 'warn', title: 'Stopped', detail: 'The run gave up on this goal.' },
}

const finished = computed(() => !!goal.value && !running.value)

// ATTEMPTS ARE NOT ITERATIONS. A segment is a whole turn dispatched again; an attempt is the repair
// loop going round INSIDE one, and a run can make several of the second within one of the first.
// Production conv 1538 made three attempts and this row said "1 of 12 iterations used" — true, and it
// reads as though almost nothing happened. Reporting both is what makes the work visible.
const attempts = computed(() => Number((goal.value && goal.value.attempts_used) || 0))
const attemptText = computed(() =>
  (attempts.value ? `${attempts.value} attempt${attempts.value === 1 ? '' : 's'}` : ''))

const outcome = computed(() => {
  const base = STATE[state.value] || { tone: 'warn', title: 'Run finished',
                                       detail: 'The goal was not confirmed.' }
  const n = used.value
  const spent = n ? ` ${n}${max.value ? ` of ${max.value}` : ''} iteration${n === 1 ? '' : 's'}` : ''
  const both = spent + (attemptText.value ? `, ${attemptText.value}` : '') + (spent ? ' used.' : '')
  return { ...base, detail: base.detail + both }
})
</script>

<style scoped>
.iter-divider { display: flex; align-items: center; gap: 10px; margin: 18px auto 10px; max-width: 760px; }
.iter-line { flex: 1; height: 1px; background: var(--vm-border, #e3e3ea); }
.iter-chip {
  font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--vm-muted, #6b6b76); background: var(--vm-surface, #f6f6f9);
  border: 1px solid var(--vm-border, #e3e3ea); border-radius: 999px; padding: 3px 10px; white-space: nowrap;
}

.iter-live { display: flex; align-items: center; gap: 8px; margin: 8px auto; max-width: 760px;
             font-size: 13px; color: var(--vm-muted, #6b6b76); }
.iter-pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--vm-violet, #6d5cff);
              animation: iterpulse 1.4s ease-in-out infinite; }
.iter-live-text { font-weight: 500; }
@keyframes iterpulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .iter-pulse { animation: none; opacity: 1; } }

.iter-done { display: flex; flex-direction: column; gap: 2px; margin: 10px auto; max-width: 760px;
             padding: 10px 12px; border-radius: 10px; border: 1px solid var(--vm-border, #e3e3ea);
             background: var(--vm-surface, #f6f6f9); }
.iter-done.ok { border-color: #bfe3c9; background: #f2fbf5; }
.iter-done.warn { border-color: #e8d8a8; background: #fdfaef; }
.iter-done-title { font-size: 13px; font-weight: 600; color: var(--vm-ink, #1d1d22); }
.iter-done-sub { font-size: 12px; color: var(--vm-muted, #6b6b76); }
</style>
