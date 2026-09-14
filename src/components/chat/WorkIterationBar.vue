<template>
  <!-- Two shapes, one component, because they are the same fact at different moments: which iteration
       of a Work run you are looking at. `divider` sections the transcript; the live form sits at the
       foot of the thread and says what is happening right now. -->
  <div v-if="divider" class="iter-divider" data-test="iteration-divider">
    <span class="iter-line" aria-hidden="true"></span>
    <span class="iter-chip">{{ label }}</span>
    <span class="iter-line" aria-hidden="true"></span>
  </div>

  <div v-else-if="chat.workIterationLabel" class="iter-live" data-test="iteration-live"
       role="status" aria-live="polite">
    <span class="iter-pulse" aria-hidden="true"></span>
    <span class="iter-live-text">{{ chat.workIterationLabel }} · working</span>
  </div>

  <div v-else-if="chat.workGoal" class="iter-done" :class="outcome.tone" data-test="iteration-outcome">
    <span class="iter-done-title">{{ outcome.title }}</span>
    <span class="iter-done-sub">{{ outcome.detail }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChatStore } from '../../stores/useChatStore'

const props = defineProps({
  // When set, render the section divider for this iteration instead of the live status.
  divider: { type: Object, default: null },
})

const chat = useChatStore()

const label = computed(() => {
  const d = props.divider || {}
  return `Iteration ${d.segment}${d.max ? ` of ${d.max}` : ''}`
})

// THE GOAL'S OWN STATE, NOT A GUESS FROM THE RUN STATUS. `ACHIEVED` is the only one that earns a
// success tone — a run that stopped because it ran out of iterations produced work, and saying so
// plainly is the point of the whole verification chain. An unknown state falls through to neutral
// rather than green, for the same reason `disposition` fails closed on the backend.
const OUTCOMES = {
  ACHIEVED: { tone: 'ok', title: 'Goal met', detail: 'The run verified its objective.' },
  EXHAUSTED: { tone: 'warn', title: 'Stopped — goal not met',
               detail: 'Every permitted iteration was used without the objective being verified.' },
  PAUSED: { tone: 'warn', title: 'Paused',
            detail: 'The run stopped before its goal could be verified.' },
  ABANDONED: { tone: 'warn', title: 'Abandoned', detail: 'The run gave up on this goal.' },
}

const outcome = computed(() => {
  const g = chat.workGoal || {}
  const base = OUTCOMES[g.state] || { tone: 'warn', title: 'Run finished',
                                      detail: 'The goal was not confirmed.' }
  const used = g.segments ? ` ${g.segments}${g.max ? ` of ${g.max}` : ''} iteration${g.segments === 1 ? '' : 's'} used.` : ''
  return { ...base, detail: base.detail + used }
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
