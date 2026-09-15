<script setup>
// ONE RAIL. The whole Work run, start to end, on a single vertical thread.
//
// WHAT IT REPLACES. The old view drew a card per segment, so a run that turned twice produced two
// cards, a run that turned twelve produced twelve, and the reader lost any sense of how much work the
// run actually contained. Here the plan lands once as pending nodes that activate in place, and a
// retry re-activates the step it belongs to with an `attempt N` badge. Four steps stay four steps
// however many times the loop turns.
//
// NO SECOND SURFACE. No side panel, no pinned plan block, no per-iteration band. A second surface
// restating the steps is duplication, not orientation — it was tried and cut.
//
// KEYED ON node_id, NEVER ON INDEX. That is the whole fix for the duplicate card: a second
// announcement of a node patches the node that exists instead of appending beside it. The store
// enforces it; `:key` here must not undo it.
import { computed } from 'vue'
import { useRunTimeline } from '../../stores/useRunTimeline'

const props = defineProps({
  runId: { type: [String, Number], required: true },
})

const store = useRunTimeline()
const nodes = computed(() => store.nodesFor(props.runId))
const hasGap = computed(() => store.hasGapFor(props.runId))

const steps = computed(() => nodes.value.filter((n) => n.type === 'step'))
const verdicts = computed(() => nodes.value.filter((n) => n.type === 'loop.continuing'))
const terminal = computed(() => nodes.value.find((n) => n.type === 'run.completed') || null)
// A step the server could not identify is DROPPED rather than given a positional id that will collide
// on the next render. Dropping beats mis-positioning — but SILENTLY dropping is worse than either: the
// rail would under-report how much work the run contains and nobody would know to look. So the count
// is surfaced, and it names what to do about it.
const unidentified = computed(() =>
  Number((nodes.value.find((n) => n.type === 'plan.created') || {}).unidentified || 0))

// Exactly one active node at a time carries the live indicator.
const activeId = computed(() => (steps.value.find((s) => s.state === 'active') || {}).node_id || null)

const MARK = { pending: '', active: '●', done: '✓', failed: '!' }

function fmt(ms) {
  if (!ms && ms !== 0) return ''
  const s = Number(ms) / 1000
  return s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${s.toFixed(1)}s`
}
</script>

<template>
  <div class="rt" data-test="run-timeline">
    <!-- A hole in the log means the tree cannot be trusted. Saying so beats drawing it anyway. -->
    <p v-if="hasGap" class="rt__gap" data-test="rt-gap">
      Some updates were missed — reload to see the full run.
    </p>

    <p v-if="unidentified" class="rt__dropped" data-test="rt-unidentified">
      {{ unidentified }} step{{ unidentified === 1 ? '' : 's' }} could not be shown — the server sent
      {{ unidentified === 1 ? 'it' : 'them' }} without an identity. Reload to try again.
    </p>

    <ol class="rt__thread">
      <li v-for="s in steps" :key="s.node_id" class="rt__node"
          :class="[`is-${s.state}`, { 'is-live': s.node_id === activeId }]"
          :data-test="`rt-step-${s.node_id}`">
        <span class="rt__mark" aria-hidden="true">{{ MARK[s.state] || '' }}</span>
        <span v-if="s.index" class="rt__idx">{{ s.index }}</span>
        <span class="rt__label">{{ s.label }}</span>
        <!-- The retry rides ON the step, which is what keeps the plan from growing. -->
        <span v-if="s.attempt > 1" class="rt__attempt" :data-test="`rt-attempt-${s.node_id}`">
          attempt {{ s.attempt }}
        </span>
        <span class="rt__spacer" />
        <span v-if="s.duration_ms" class="rt__dur">{{ fmt(s.duration_ms) }}</span>
      </li>
    </ol>

    <!-- Why the loop re-entered: a NODE with a fail marker, its reason and the blocking findings.
         Not a divider, and not an "Iteration N of M" band — that shape was cut. -->
    <div v-for="v in verdicts" :key="v.node_id" class="rt__verdict" :data-test="`rt-verdict-${v.node_id}`">
      <div class="rt__vhead">
        <span class="rt__mark rt__mark--fail" aria-hidden="true">!</span>
        <span class="rt__vtitle">Not there yet — running the failed steps again</span>
      </div>
      <ul class="rt__findings">
        <li v-for="(f, i) in v.findings" :key="i">
          <span class="rt__issue">{{ f.issue }}</span>
          <span v-if="f.remedy" class="rt__fix"> → {{ f.remedy }}</span>
        </li>
      </ul>
    </div>

    <!-- One unambiguous end. -->
    <div v-if="terminal" class="rt__terminal" data-test="rt-terminal">
      <span class="rt__pill">{{ terminal.label || 'Done' }}</span>
      <span class="rt__tsum">
        Ran <b>{{ terminal.steps }} step{{ terminal.steps === 1 ? '' : 's' }}</b><template
          v-if="terminal.retried"

        >, <b>{{ terminal.retried }} retried</b></template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.rt { font-size: 13px; }
.rt__gap { margin: 0 0 8px; font-size: 12px; color: #8a6d1f; }
.rt__dropped { margin: 0 0 8px; font-size: 12px; color: #8a6d1f; }
.rt__thread { list-style: none; margin: 0; padding: 0 0 0 4px; border-left: 1px solid var(--line, #e4e8ee); }
.rt__node { display: flex; align-items: center; gap: 8px; padding: 6px 0 6px 10px; margin-left: -1px; }
.rt__node.is-pending { color: var(--muted, #9aa3ae); }
.rt__mark { width: 14px; text-align: center; color: #1d7a3d; }
.rt__node.is-failed .rt__mark, .rt__mark--fail { color: #b4690e; }
.rt__node.is-live .rt__mark { color: #2f7bed; animation: rtpulse 1.6s ease-in-out infinite; }
@keyframes rtpulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
@media (prefers-reduced-motion: reduce) { .rt__node.is-live .rt__mark { animation: none } }
.rt__idx { color: var(--muted, #9aa3ae); min-width: 12px; }
.rt__label { font-weight: 500; }
.rt__attempt {
  font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 999px;
  border: 1px solid #e8d8a8; background: #fdfaef; color: #8a6d1f;
}
.rt__spacer { flex: 1 1 auto; }
.rt__dur { color: var(--muted, #9aa3ae); font-variant-numeric: tabular-nums; }
.rt__verdict { margin: 6px 0 6px 14px; padding: 10px 12px; border-radius: 8px;
               border: 1px solid #f0e2bd; background: #fdfaef; }
.rt__vhead { display: flex; align-items: center; gap: 8px; }
.rt__vtitle { font-weight: 600; color: #8a6d1f; }
.rt__findings { margin: 6px 0 0; padding-left: 18px; }
.rt__findings li { margin: 3px 0; }
.rt__fix { color: var(--muted, #6b7280); }
.rt__terminal { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 8px 12px;
                border-radius: 8px; background: var(--surface-2, #f6f8fa); }
.rt__pill { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 7px;
            border-radius: 999px; background: #eaf6ee; color: #1d7a3d; }
.rt__tsum { color: var(--muted, #6b7280); }
</style>
