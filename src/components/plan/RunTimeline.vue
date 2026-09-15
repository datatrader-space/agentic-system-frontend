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
import { computed, ref } from 'vue'
import { useRunTimeline } from '../../stores/useRunTimeline'
import { useChatStore } from '../../stores/useChatStore'

const props = defineProps({
  runId: { type: [String, Number], required: true },
  // ABSORBED FROM WorkGoalRow. The rail is ONE surface: a separate row restating the state, the
  // segment, the attempts and the findings is the duplication this component exists to remove -- and it
  // was visibly duplicating, printing the same findings twice under two different headings.
  goal: { type: Object, default: null },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['action'])

const STATE_LABEL = {
  ACTIVE: 'Working', PAUSED: 'Paused', ACHIEVED: 'Goal met',
  ABANDONED: 'Stopped', EXHAUSTED: 'Stopped — goal not met',
}
const ACTION_LABEL = { pause: 'Pause', resume: 'Resume', edit: 'Edit goal', clear: 'Clear' }

const g = computed(() => props.goal || {})
const stateLabel = computed(() => STATE_LABEL[g.value.state] || g.value.state || '')
const running = computed(() => g.value.state === 'ACTIVE')
const used = computed(() => Number(g.value.segments_used || 0))
const maxSeg = computed(() => Number(g.value.max_segments || 0))
const pct = computed(() => (maxSeg.value
  ? Math.min(100, Math.round((used.value / maxSeg.value) * 100)) : 0))
const attemptList = computed(() => (g.value.attempts || []).map((a) => ({
  n: a.n,
  ok: a.verdict === 'met',
  bad: a.verdict === 'not_met',
  partial: a.verdict === 'unconfirmed',
  live: !a.verdict && a.state === 'EXECUTING',
  title: `Attempt ${a.n}: ${a.verdict === 'met' ? 'passed'
    : a.verdict === 'not_met' ? 'rejected'
    : a.verdict === 'unconfirmed' ? 'passed its own check, but the goal check did not confirm it'
    : a.state === 'EXECUTING' ? 'running' : (a.verdict || a.state || 'unknown')}`,
})))

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

// THE ANSWER BELONGS ON THE RAIL. In the target the model's text sits between the steps that produced
// it and the verdict that judged it, so the run reads as one narrative. Rendered as a separate bubble
// outside the rail it reads as a wall of output with no relationship to the work above it.
//
// WHAT THIS CANNOT DO is turn a data dump into prose. Conv 1543's answer is a ~4 KB JSON document, so
// placing it here unchanged would put the same wall on the rail. A JSON answer therefore COLLAPSES to
// one honest line -- its own `status` and issue count, read from the document rather than invented --
// and expands on demand. Real prose renders as prose.
const chat = useChatStore()
const _open = ref({})
function toggle(id) { _open.value = { ..._open.value, [id]: !_open.value[id] } }
function isOpen(id) { return !!_open.value[id] }

function parsed(text) {
  const t = String(text || '').trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return null
  try { return JSON.parse(t) } catch { return null }
}

function jsonSummary(d) {
  // THE AGENT'S OWN SENTENCE WINS. Agent 3316's output contract now opens with `summary`: one short
  // plain-English paragraph written for the person reading the run. Deriving a line from status and
  // issue counts is the FALLBACK for an answer that predates that field or comes from another agent --
  // it is accurate but it is telemetry, not narration, and narration is what makes the rail readable.
  const written = d && typeof d.summary === 'string' ? d.summary.trim() : ''
  if (written) return written
  const bits = []
  if (d && typeof d.status === 'string') bits.push(d.status.replace(/_/g, ' '))
  const issues = d && Array.isArray(d.issues) ? d.issues.length : 0
  if (issues) bits.push(`${issues} issue${issues === 1 ? '' : 's'}`)
  if (d && d.attempt_count) bits.push(`attempt ${d.attempt_count}`)
  return bits.length ? bits.join(' · ') : 'structured result'
}

// THE RUN STARTS WITH WHAT WAS ASKED. Without it the rail opens mid-story: four steps and a verdict
// with no statement of the thing they were serving. It is the user's own sentence, shown in full --
// truncating the request to fit a row is how a transcript stops being trustworthy.
const request = computed(() => {
  const first = (chat.messages || []).find((m) => m.role === 'user' && String(m.content || '').trim())
  return first ? String(first.content) : ''
})

const answers = computed(() => (chat.messages || [])
  .filter((m) => m.role === 'assistant' && String(m.content || '').trim())
  .map((m) => {
    const doc = parsed(m.content)
    return {
      id: m.id,
      text: String(m.content || ''),
      doc,
      summary: doc ? jsonSummary(doc) : '',
    }
  }))

function fmtTokens(n) {
  const v = Number(n || 0)
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

function fmt(ms) {
  if (!ms && ms !== 0) return ''
  const s = Number(ms) / 1000
  return s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${s.toFixed(1)}s`
}
</script>

<template>
  <div class="rt" data-test="run-timeline">
    <!-- The run's own header. One surface: state, how far, how many attempts, and the controls. -->
    <div v-if="goal" class="rt__head" data-test="rt-head">
      <span class="rt__dot" :class="{ 'rt__dot--live': running }" aria-hidden="true" />
      <span class="rt__state">{{ stateLabel }}</span>
      <span v-if="maxSeg" class="rt__meta">Segment {{ used }} of {{ maxSeg }}</span>
      <span v-if="attemptList.length" class="rt__pips" data-test="rt-attempt-pips">
        <span v-for="a in attemptList" :key="a.n" class="rt__pip"
              :class="{ ok: a.ok, bad: a.bad, partial: a.partial, live: a.live }"
              :title="a.title">{{ a.n }}</span>
      </span>
      <span class="rt__spacer" />
      <button v-for="a in (goal.available_actions || [])" :key="a" class="rt__btn"
              :disabled="busy" @click="emit('action', a)">{{ ACTION_LABEL[a] || a }}</button>
    </div>
    <p v-if="goal && goal.outcome" class="rt__outcome">{{ goal.outcome }}</p>
    <div v-if="goal && maxSeg" class="rt__bar" role="progressbar" :aria-valuenow="used"
         aria-valuemin="0" :aria-valuemax="maxSeg">
      <div class="rt__fill" :style="{ width: pct + '%' }" />
    </div>

    <!-- A hole in the log means the tree cannot be trusted. Saying so beats drawing it anyway. -->
    <p v-if="hasGap" class="rt__gap" data-test="rt-gap">
      Some updates were missed — reload to see the full run.
    </p>

    <p v-if="unidentified" class="rt__dropped" data-test="rt-unidentified">
      {{ unidentified }} step{{ unidentified === 1 ? '' : 's' }} could not be shown — the server sent
      {{ unidentified === 1 ? 'it' : 'them' }} without an identity. Reload to try again.
    </p>

    <p v-if="request" class="rt__req" data-test="rt-request">{{ request }}</p>

    <ol class="rt__thread">
      <template v-for="s in steps" :key="s.node_id">
      <li class="rt__node"
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
        <button v-if="s.tools && s.tools.length" class="rt__chev"
                :data-test="`rt-step-toggle-${s.node_id}`"
                :aria-expanded="isOpen(s.node_id) ? 'true' : 'false'"
                @click="toggle(s.node_id)">{{ isOpen(s.node_id) ? '▾' : '▸' }}</button>
      </li>
      <li v-if="isOpen(s.node_id)" class="rt__stepdetail"
          :data-test="`rt-step-detail-${s.node_id}`">
        <span v-for="t in s.tools" :key="t" class="rt__tool">{{ t }}</span>
        <p v-if="s.details" class="rt__detailnote">{{ s.details }}</p>
        <p v-if="s.failure" class="rt__detailnote">{{ s.failure }}</p>
      </li>
      </template>
    </ol>

    <!-- The model's own text, on the rail, between the work and the verdict. -->
    <div v-for="a in answers" :key="a.id" class="rt__say" :data-test="`rt-answer-${a.id}`">
      <span class="rt__mark" aria-hidden="true">✓</span>
      <div class="rt__saybody">
        <template v-if="a.doc">
          <button class="rt__disclose" :data-test="`rt-answer-toggle-${a.id}`" @click="toggle(a.id)">
            {{ isOpen(a.id) ? '▾' : '▸' }} {{ a.summary }}
          </button>
          <pre v-if="isOpen(a.id)" class="rt__json">{{ a.text }}</pre>
        </template>
        <p v-else class="rt__prose">{{ a.text }}</p>
      </div>
    </div>

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
          v-if="terminal.retried">, <b>{{ terminal.retried }} retried</b></template><template
          v-if="terminal.duration_ms"> · {{ fmt(terminal.duration_ms) }}</template><template
          v-if="terminal.total_tokens"> · {{ fmtTokens(terminal.total_tokens) }} tokens</template><template
          v-if="terminal.cost_usd"> · ${{ terminal.cost_usd }}</template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.rt { font-size: 13px; border: 1px solid var(--border, #e3e6ea); border-radius: 10px;
      padding: 12px 14px; background: var(--surface, #fff); margin: 8px 0; }
.rt__head { display: flex; align-items: center; gap: 8px; }
.rt__dot { width: 8px; height: 8px; border-radius: 50%; background: #b9c0c8; flex: none; }
.rt__dot--live { background: #2f7bed; animation: rtpulse 1.6s ease-in-out infinite; }
.rt__state { font-weight: 600; }
.rt__meta { color: var(--muted, #6b7280); }
.rt__pips { display: inline-flex; gap: 4px; margin-left: 2px; }
.rt__pip { min-width: 17px; height: 17px; line-height: 15px; padding: 0 4px; border-radius: 999px;
  border: 1px solid var(--vm-line-2, #e4e8ee); background: var(--vm-surface, #fff);
  color: var(--vm-ink-soft, #5b6472); font-size: 10px; font-weight: 700; text-align: center; }
.rt__pip.ok { border-color: #bfe3c9; background: #f2fbf5; color: #1d7a3d; }
.rt__pip.bad { border-color: #e8d8a8; background: #fdfaef; color: #8a6d1f; }
.rt__pip.partial { border-color: #d7dce3; background: #f6f8fa; color: #5b6472; }
.rt__pip.live { border-color: var(--vm-violet-d, #6d5ef1); color: var(--vm-violet-d, #6d5ef1); }
.rt__btn { border: 1px solid var(--border, #e3e6ea); background: transparent; border-radius: 6px;
  padding: 3px 9px; font-size: 12px; cursor: pointer; }
.rt__btn:disabled { opacity: .5; cursor: default; }
.rt__outcome { margin: 8px 0 6px; }
.rt__bar { height: 3px; border-radius: 2px; background: var(--vm-line-2, #eef1f5); margin-bottom: 10px; }
.rt__fill { height: 100%; border-radius: 2px; background: #2f7bed; }
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
.rt__req { margin: 6px 0 10px; padding-left: 10px; border-left: 2px solid var(--line, #e4e8ee);
           white-space: pre-wrap; color: var(--vm-ink-soft, #5b6472); }
.rt__chev { border: 0; background: transparent; cursor: pointer; color: var(--muted, #9aa3ae);
            font: inherit; padding: 0 2px; }
.rt__stepdetail { list-style: none; padding: 2px 0 8px 34px; margin-left: -1px;
                  border-left: 1px solid var(--line, #e4e8ee); }
.rt__tool { display: inline-block; font-size: 10px; padding: 1px 6px; margin: 2px 4px 2px 0;
  border-radius: 4px; background: var(--surface-2, #f6f8fa); color: var(--vm-ink-soft, #5b6472); }
.rt__detailnote { margin: 4px 0 0; font-size: 12px; color: var(--muted, #6b7280); }
.rt__say { display: flex; gap: 8px; padding: 6px 0 6px 10px; margin-left: -1px;
           border-left: 1px solid var(--line, #e4e8ee); }
.rt__saybody { flex: 1 1 auto; min-width: 0; }
.rt__prose { margin: 0; white-space: pre-wrap; }
.rt__disclose { border: 0; background: transparent; padding: 0; cursor: pointer; font: inherit;
  color: var(--muted, #6b7280); text-align: left; }
.rt__json { margin: 6px 0 0; padding: 8px 10px; border-radius: 6px; overflow: auto; max-height: 340px;
  background: var(--surface-2, #f6f8fa); font-size: 11px; white-space: pre-wrap; word-break: break-word; }
.rt__terminal { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 8px 12px;
                border-radius: 8px; background: var(--surface-2, #f6f8fa); }
.rt__pill { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 7px;
            border-radius: 999px; background: #eaf6ee; color: #1d7a3d; }
.rt__tsum { color: var(--muted, #6b7280); }
</style>
