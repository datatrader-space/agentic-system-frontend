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
import './runTimeline.css'

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

// The marker is drawn by CSS from `data-state`; the component only names the state.
//
// A FAILED STEP IS AN ERROR (red), NOT A WARNING (amber). They were sharing one colour, so a run that
// was correcting itself looked identical to one that had broken. Amber is reserved for the verdict
// node -- "not right yet, going again", which is the loop working -- and red means this step errored,
// the only state a reader should read as a fault.
const STATE = { pending: 'pending', active: 'active', done: 'done', failed: 'error' }

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
// ACTIVITIES NEST INSIDE THE STEP THAT OWNS THEM. That is the structural difference between a rail and
// a list: the target nests tool calls, renders and narration under the step they served, so a run reads
// as four things with detail beneath them rather than twenty things in a row.
//
// Keyed on `planStepId`, stamped live by the chat store from the plan snapshot's `current_step_id`.
// An activity with no stamp is NOT guessed into a bucket -- a row placed under the wrong step is worse
// than one not shown, because it invents a relationship the data never had.
const activityByStep = computed(() => {
  const live = chat.richActive ? (chat.liveSteps || []) : []
  const done = (chat.messages || [])
    .flatMap((m) => ((m.timeline && m.timeline.steps) || []))
  const out = {}
  for (const a of [...done, ...live]) {
    const owner = a && a.planStepId
    if (!owner) continue
    ;(out[owner] = out[owner] || []).push({
      key: a.stepId || `${owner}-${(out[owner] || []).length}`,
      label: a.label || 'Working',
      tool: a.tool || '',
      status: a.status || '',
      durationMs: a.durationMs || null,
      reason: a.reason || '',
    })
  }
  return out
})
function activitiesFor(id) { return activityByStep.value[id] || [] }

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
    <div class="thread">
      <p v-if="hasGap" class="notice" data-test="rt-gap">
        Some updates were missed — reload to see the full run.
      </p>
      <p v-if="unidentified" class="notice" data-test="rt-unidentified">
        {{ unidentified }} step{{ unidentified === 1 ? '' : 's' }} could not be shown — the server sent
        {{ unidentified === 1 ? 'it' : 'them' }} without an identity. Reload to try again.
      </p>

      <div v-if="goal && (goal.available_actions || []).length" class="acts" data-test="rt-head">
        <button v-for="a in (goal.available_actions || [])" :key="a" class="btn"
                :disabled="busy" @click="emit('action', a)">{{ ACTION_LABEL[a] || a }}</button>
      </div>

      <!-- What was asked. The run opens on the thing the steps are serving. -->
      <div v-if="request" class="node" data-state="you" data-test="rt-request">
        <span class="mkr" aria-hidden="true" />
        <div class="req"><p class="qt">{{ request }}</p></div>
      </div>

      <!-- The plan. Every step lands at once; a retry re-activates the step it belongs to. -->
      <div v-for="s in steps" :key="s.node_id" class="node"
           :class="{ collapsible: activitiesFor(s.node_id).length || (s.tools && s.tools.length) }"
           :data-state="STATE[s.state] || 'pending'"
           :data-open="isOpen(s.node_id) ? 'true' : 'false'"
           :data-test="`rt-step-${s.node_id}`">
        <span class="mkr" aria-hidden="true" />
        <div class="head" @click="toggle(s.node_id)">
          <span v-if="s.index" class="num">{{ s.index }}</span>
          <span class="lb">{{ s.label }}</span>
          <span v-if="s.attempt > 1" class="attempt-badge" :data-test="`rt-attempt-${s.node_id}`">
            attempt {{ s.attempt }}
          </span>
          <span v-if="s.duration_ms" class="dur">{{ fmt(s.duration_ms) }}</span>
          <button v-if="activitiesFor(s.node_id).length || (s.tools && s.tools.length)"
                  class="caret" :data-test="`rt-toggle-${s.node_id}`"
                  :aria-expanded="isOpen(s.node_id) ? 'true' : 'false'"
                  @click.stop="toggle(s.node_id)">▾</button>
        </div>
        <div class="body"><div class="inner">
          <div class="stack" :data-test="`rt-detail-${s.node_id}`">
            <!-- What the step DID, in order — nested here, never beside the rail. -->
            <div v-for="a in activitiesFor(s.node_id)" :key="a.key" class="act"
                 :data-s="a.status === 'failed' ? 'fail' : a.status === 'running' ? 'run' : 'done'">
              <span class="ic" aria-hidden="true">{{ a.status === 'failed' ? '✕'
                : a.status === 'running' ? '◌' : '✓' }}</span>
              <span class="al">{{ a.label }}<span v-if="a.tool" class="tag">{{ a.tool }}</span></span>
              <span v-if="a.durationMs" class="ad">{{ fmt(a.durationMs) }}</span>
            </div>
            <!-- Only when nothing was recorded: a capability list is a poor substitute for a record
                 of the work, and a misleading one beside it. -->
            <div v-if="!activitiesFor(s.node_id).length" class="act" data-s="done">
              <span class="al"><span v-for="t in s.tools" :key="t" class="tag">{{ t }}</span></span>
            </div>
            <div v-if="s.details || s.failure" class="act-note">
              {{ s.details || s.failure }}
            </div>
          </div>
        </div></div>
      </div>

      <!-- The model's own text, between the work and the verdict. -->
      <div v-for="a in answers" :key="a.id" class="node" data-state="done"
           :data-test="`rt-answer-${a.id}`">
        <span class="mkr" aria-hidden="true" />
        <div class="msg">
          <template v-if="a.doc">
            <button class="disclose" :data-test="`rt-answer-toggle-${a.id}`" @click="toggle(a.id)">
              {{ isOpen(a.id) ? '▾' : '▸' }} {{ a.summary }}
            </button>
            <pre v-if="isOpen(a.id)" class="jsonbox">{{ a.text }}</pre>
          </template>
          <div v-else class="mt">{{ a.text }}</div>
        </div>
      </div>

      <!-- Why the loop re-entered: a node with its findings. Not a divider, not an iteration band. -->
      <div v-for="v in verdicts" :key="v.node_id" class="node" data-state="fail"
           :data-test="`rt-verdict-${v.node_id}`">
        <span class="mkr" aria-hidden="true" />
        <div class="head" style="padding-bottom:4px">
          <span class="lb" style="color:var(--warn)">Not there yet — running the failed steps again</span>
        </div>
        <div class="verdict">
          <ul>
            <li v-for="(f, i) in v.findings" :key="i">
              {{ f.issue }}<span v-if="f.remedy" class="fix"> → {{ f.remedy }}</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- One unambiguous end. -->
      <div v-if="terminal" class="node" data-state="done" data-test="rt-terminal">
        <span class="mkr" aria-hidden="true" />
        <div class="terminal">
          <span class="pill ok">{{ terminal.label || 'Done' }}</span>
          <span class="ts">
            Ran <b>{{ terminal.steps }} step{{ terminal.steps === 1 ? '' : 's' }}</b><template
              v-if="terminal.retried">, <b>{{ terminal.retried }} retried</b></template><template
              v-if="terminal.duration_ms"> · {{ fmt(terminal.duration_ms) }}</template><template
              v-if="terminal.total_tokens"> · {{ fmtTokens(terminal.total_tokens) }} tokens</template><template
              v-if="terminal.cost_usd"> · ${{ terminal.cost_usd }}</template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
