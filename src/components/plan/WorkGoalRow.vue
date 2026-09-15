<script setup>
// The Work-mode progress row.
//
// WHAT IT HAS TO ANSWER, because a long run is unreadable without it: which segment of how many, what
// the last verification said, and WHY it is going round again. "Working" with no number is
// indistinguishable from stuck, and a run between segments otherwise reads as finished.
//
// The outcome is shown in full. It is the user's own sentence back to them, and truncating the thing
// they asked for to fit a row is how a progress display stops being trustworthy.
//
// ACTIONS COME FROM THE BACKEND (`work_goal.available_actions`), never decided here. A UI that works
// out for itself which buttons are legal drifts from the runtime, and the first symptom is a button
// that silently does nothing.
import { computed } from 'vue'

const props = defineProps({
  goal: { type: Object, required: true },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['action'])   // 'pause' | 'resume' | 'edit' | 'clear'

const STATE_LABEL = {
  ACTIVE: 'Working', PAUSED: 'Paused', ACHIEVED: 'Goal met',
  ABANDONED: 'Stopped', EXHAUSTED: 'Stopped — goal not met',
}
const ACTION_LABEL = { pause: 'Pause', resume: 'Resume', edit: 'Edit goal', clear: 'Clear' }

const label = computed(() => STATE_LABEL[props.goal.state] || props.goal.state)
const used = computed(() => Number(props.goal.segments_used || 0))
const max = computed(() => Number(props.goal.max_segments || 0))
const pct = computed(() => (max.value ? Math.min(100, Math.round((used.value / max.value) * 100)) : 0))
const running = computed(() => props.goal.state === 'ACTIVE')
// The INNER loop. A segment is a whole turn dispatched again; an attempt is the repair loop going round
// inside one. Conv 1538 made three attempts within one segment and this row could only say "1 of 12",
// which reads as though the run had barely started.
const attempts = computed(() => Number(props.goal.attempts_used || 0))
// EACH attempt's outcome, not just how many there were. The count cannot say the last one PASSED, so
// conv 1541 ended with attempt 3 ACCEPTED/met and nothing on screen said so -- which reads as "it gave
// up" rather than "it got there and the goal check disagreed".
// `unconfirmed` is NOT a pass. An attempt is judged against its loop's `until`, which is a narrower bar
// than the run's goal, so it can pass while the goal does not. Conv 1543: `until` named only the
// coordinate validation, that half passed, and this row drew a green "Attempt 1: passed" for a run whose
// own answer said `render_validation: failed`, `needs_review`. Reading it as a pass is the whole defect.
const attemptList = computed(() => (props.goal.attempts || []).map((a) => ({
  n: a.n,
  ok: a.verdict === 'met',
  bad: a.verdict === 'not_met',
  partial: a.verdict === 'unconfirmed',
  // No verdict yet means it is the one running now.
  live: !a.verdict && a.state === 'EXECUTING',
  title: `Attempt ${a.n}: ${a.verdict === 'met' ? 'passed'
    : a.verdict === 'not_met' ? 'rejected'
    : a.verdict === 'unconfirmed' ? 'passed its own check, but the goal check did not confirm it'
    : a.state === 'EXECUTING' ? 'running' : (a.verdict || a.state || 'unknown')}`,
})))
const failed = computed(() => props.goal.state === 'EXHAUSTED')

// Only shown while there is something still outstanding. After the goal is met these are history, and
// leaving them on screen would read as unresolved problems in finished work.
const findings = computed(() =>
  (props.goal.state === 'ACHIEVED' ? [] : (props.goal.last_findings || [])).slice(0, 5))

const verdictNote = computed(() => {
  if (props.goal.state === 'ACHIEVED') return 'Verified against the goal.'
  if (props.goal.last_verdict === 'undecidable') {
    return 'The last check could not tell — stopped rather than spend more on an unverifiable goal.'
  }
  if (props.goal.last_verdict === 'not_met') return 'Not there yet — continuing.'
  return ''
})
</script>

<template>
  <div class="wg" :class="{ 'wg--done': goal.state === 'ACHIEVED', 'wg--failed': failed }">
    <div class="wg__head">
      <span class="wg__dot" :class="{ 'wg__dot--live': running }" aria-hidden="true" />
      <span class="wg__state">{{ label }}</span>
      <span v-if="max" class="wg__count">Segment {{ used }} of {{ max }}</span>
      <!-- The inner loop, named separately so three attempts inside one segment stop reading as
           "barely started" (conv 1538). -->
      <span v-if="attempts" class="wg__count" data-test="wg-attempts">·
        {{ attempts }} attempt{{ attempts === 1 ? '' : 's' }}</span>
      <!-- One pip per attempt, so a PASS is as visible as a rejection. -->
      <span v-if="attemptList.length" class="wg__pips" data-test="wg-attempt-pips">
        <span v-for="a in attemptList" :key="a.n" class="wg__pip"
              :class="{ ok: a.ok, bad: a.bad, partial: a.partial, live: a.live }"
              :title="a.title">{{ a.n }}</span>
      </span>
      <span class="wg__spacer" />
      <button
        v-for="a in (goal.available_actions || [])"
        :key="a"
        class="wg__btn"
        :disabled="busy"
        @click="emit('action', a)"
      >{{ ACTION_LABEL[a] || a }}</button>
    </div>

    <p class="wg__outcome">{{ goal.outcome }}</p>

    <div v-if="max" class="wg__bar" role="progressbar" :aria-valuenow="used" aria-valuemin="0"
         :aria-valuemax="max">
      <div class="wg__fill" :style="{ width: pct + '%' }" />
    </div>

    <p v-if="verdictNote" class="wg__verdict">{{ verdictNote }}</p>

    <ul v-if="findings.length" class="wg__findings">
      <li v-for="(f, i) in findings" :key="i">
        <span class="wg__obs">{{ f.observation || f.repair_instruction }}</span>
        <span v-if="f.observation && f.repair_instruction" class="wg__fix">
          → {{ f.repair_instruction }}
        </span>
      </li>
    </ul>

    <p v-if="goal.constraints && goal.constraints.length" class="wg__constraints">
      Must hold: {{ goal.constraints.join('; ') }}
    </p>
  </div>
</template>

<style scoped>
.wg__pips { display: inline-flex; gap: 4px; margin-left: 6px; vertical-align: middle; }
.wg__pip {
  min-width: 17px; height: 17px; line-height: 15px; padding: 0 4px;
  border-radius: 999px; border: 1px solid var(--vm-line-2, #e4e8ee);
  background: var(--vm-surface, #fff); color: var(--vm-ink-soft, #5b6472);
  font-size: 10px; font-weight: 700; text-align: center;
}
.wg__pip.ok   { border-color: #bfe3c9; background: #f2fbf5; color: #1d7a3d; }
.wg__pip.bad  { border-color: #e8d8a8; background: #fdfaef; color: #8a6d1f; }
.wg__pip.live { border-color: var(--vm-violet-d, #6d5ef1); color: var(--vm-violet-d, #6d5ef1); }
/* Deliberately NOT the green `ok` treatment: its own check passed, the goal check did not confirm it. */
.wg__pip.partial { border-color: #d7dce3; background: #f6f8fa; color: #5b6472; }

.wg { border: 1px solid var(--border, #e3e6ea); border-radius: 10px; padding: 12px 14px;
      background: var(--surface, #fff); margin: 8px 0; font-size: 13px; }
.wg--done { border-color: #b7e0c2; }
.wg--failed { border-color: #e8c7c7; }
.wg__head { display: flex; align-items: center; gap: 8px; }
.wg__dot { width: 8px; height: 8px; border-radius: 50%; background: #b9c0c8; flex: none; }
.wg__dot--live { background: #2f7bed; animation: wgpulse 1.6s ease-in-out infinite; }
@keyframes wgpulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
@media (prefers-reduced-motion: reduce) { .wg__dot--live { animation: none } }
.wg__state { font-weight: 600; }
.wg__count { color: var(--muted, #6b7280); }
.wg__spacer { flex: 1 1 auto; }
.wg__btn { border: 1px solid var(--border, #e3e6ea); background: transparent; border-radius: 6px;
           padding: 3px 9px; cursor: pointer; font-size: 12px; }
.wg__btn:hover:not(:disabled) { background: var(--hover, #f4f6f8); }
.wg__btn:disabled { opacity: .5; cursor: default; }
.wg__outcome { margin: 8px 0 6px; }
.wg__bar { height: 4px; border-radius: 2px; background: var(--track, #eef1f4); overflow: hidden; }
.wg__fill { height: 100%; background: #2f7bed; transition: width .3s ease; }
.wg__verdict { margin: 8px 0 0; color: var(--muted, #6b7280); }
.wg__findings { margin: 6px 0 0; padding-left: 18px; }
.wg__findings li { margin: 2px 0; }
.wg__fix { color: var(--muted, #6b7280); }
.wg__constraints { margin: 6px 0 0; color: var(--muted, #6b7280); font-size: 12px; }
</style>
