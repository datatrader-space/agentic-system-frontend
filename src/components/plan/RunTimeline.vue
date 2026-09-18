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
import { computed, ref, shallowRef, watch } from 'vue'
import { fileLinkPayload } from '../../composables/fileLinks'
import SourcesList from '../chat/SourcesList.vue'
import { useRunTimeline } from '../../stores/useRunTimeline'
import { useChatStore } from '../../stores/useChatStore'
import { renderUntrustedMarkdown } from '../../utils/safeMarkdown'
import { enhanceChatMedia } from '../../utils/chatMedia'
import './runTimeline.css'

// THE RAIL SHOWED MARKDOWN AS SOURCE. Answers were interpolated as text (`{{ a.text }}`), so a work run's
// report — the thing the whole run exists to produce — arrived as literal `**bold**`, `## 3. Consolidated
// table` and `| Project | Version |` rows (production conv 1564), while the same answer in an ordinary chat
// bubble rendered properly. It goes through the bubble's own pipeline, which is also its security boundary:
// raw HTML is escaped and `javascript:`/`data:` URLs are neutralised (utils/safeMarkdown), because answer text
// routinely quotes web pages and tool output. Cached by text: the rail recomputes on every streamed chunk,
// and re-parsing every earlier answer each time would be pure waste.
const _mdCache = new Map()
function renderAnswer(text) {
  const key = String(text || '')
  let html = _mdCache.get(key)
  if (html === undefined) {
    html = enhanceChatMedia(renderUntrustedMarkdown(key))
    if (_mdCache.size > 50) _mdCache.clear()
    _mdCache.set(key, html)
  }
  return html
}

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
const ACTION_LABEL = { pause: 'Pause work', resume: 'Resume work', edit: 'Edit goal', clear: 'Stop and clear work' }
// Icon buttons, labelled by tooltip and aria-label. Text buttons in a row above the run read as a form
// rather than as controls on it, and pushed the run itself down.
const ACTION_ICON = {
  pause: 'M9 5v14M15 5v14',
  resume: 'M7 5l12 7-12 7z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  clear: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
}

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
const STATE = { pending: 'pending', active: 'active', done: 'done', failed: 'error', stopped: 'stopped' }

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
//
// THIS RUN'S rows only: the pinned timeline of each of its messages, and the live rows while one of its
// messages is streaming (the live rows are pinned onto that message when it ends, so the two never both
// count). Rows that arrive BEFORE the plan exists -- "Analyzing your request", "Loading tools" -- have
// no step to belong to; they are the run's preparation and open the rail as its first step, instead of
// being drawn as a separate card that the rail then replaces (conv 1578). A later unstamped row (a
// "Generating response" between two steps) belongs with the step before it, which is when it happened.
const PREP = '__prepare__'
// The work of a run that has NO plan steps. Its searches and page reads used to be filed under "Got ready",
// which folds once preparation ends — so prod conv 1630 showed nothing between "Got ready" and "Verifying
// results…" for a minute of failing fetches, and read as stuck.
const WORK = '__work__'
const activityByStep = computed(() => {
  const list = chat.messages || []
  const liveMsg = list.find((m) => m.role === 'assistant' && m.status === 'streaming')
  const out = {}
  const put = (owner, a) => {
    // "Step 2 of 4: Generate red chilli powder" restates the step it sits inside (conv 1588).
    if (a.isPhase && /^Step \d+ of \d+:/.test(String(a.label || ''))) return
    const bucket = (out[owner] = out[owner] || [])
    bucket.push({
      key: a.stepId || `${owner}-${bucket.length}`,
      // A reasoning row is the model's streamed thought and reads as "Thinking"; every other row keeps
      // the label the backend wrote, including the planning row this used to rename out of existence.
      label: a.phase === 'reasoning' ? 'Thinking' : (a.label || 'Working'),
      isPhase: !!a.isPhase,
      reasoning: String(a.reasoningText || '').trim(),
      status: a.status || '',
      durationMs: a.durationMs || null,
      reason: a.reason || '',
      media: (a.media || []).filter((x) => x && x.url && (x.type || 'image') === 'image'),
    })
  }
  let owner = null
  for (const m of list) {
    if (m.role !== 'assistant' || !belongsToThisRun(m)) continue
    const rows = ((m === liveMsg ? chat.liveSteps : (m.timeline && m.timeline.steps)) || []).filter(Boolean)
    // A later segment re-prepares before it resumes a step: those rows belong to the step it resumes
    // (the first one it names), not to the step the previous segment happened to end on.
    const firstStamped = (rows.find((a) => a.planStepId) || {}).planStepId || null
    let cur = owner === null ? PREP : (firstStamped || owner)
    for (const a of rows) {
      if (a.planStepId) cur = a.planStepId
      // Preparation ends where real work begins: the first call to a tool (a row with a call id; a status
      // row upgraded into a tool step is marked `isPhase: false`) — OR the moment the model is asked.
      // That model call is routinely the longest thing in the turn (39.3s of a 52s wait on conv 1747) and
      // ending preparation only at the first TOOL left all of it inside "Got ready", which reads exactly
      // like a hung turn.
      else if (cur === PREP && (a.toolCallId || a.isPhase === false || a.phase === 'planning')) cur = WORK
      put(cur, a)
    }
    owner = cur
  }
  return out
})
function activitiesFor(id) { return activityByStep.value[id] || [] }

// The newest activity of the attempt now running, for the line under a live goal check.
const liveActivity = computed(() => {
  const live = (chat.messages || []).find((m) => m.role === 'assistant' && m.status === 'streaming'
    && belongsToThisRun(m))
  if (!live) return []
  return (chat.liveSteps || []).filter((a) => a && a.label && !/^Step \d+ of \d+:/.test(a.label))
    .slice(-3).map((a, i) => ({ key: a.stepId || i, label: a.phase === 'reasoning' ? 'Thinking' : a.label,
                               running: a.status === 'running' }))
})
function hasDetail(s) {
  return !!(activitiesFor(s.node_id).length || s.details || s.failure)
}

// The preparation step: shown while the run is getting ready, and kept (collapsed) afterwards so the rail
// still reads from the first thing that happened.
const prep = computed(() => {
  const rows = activitiesFor(PREP)
  if (!rows.length) return null
  const live = rows.some((r) => r.status === 'running') && !steps.value.length
  const ms = rows.reduce((t, r) => t + (Number(r.durationMs) || 0), 0)
  return { rows, state: live ? 'active' : 'done', duration_ms: ms || null }
})

// The unplanned work node: live while anything in it runs or the run is still working with no plan steps.
const work = computed(() => {
  const rows = activitiesFor(WORK)
  if (!rows.length || steps.value.length) return null
  const live = rows.some((r) => r.status === 'running') || (running.value && !terminal.value)
  const failed = rows.filter((r) => r.status === 'failed').length
  const ms = rows.reduce((t, r) => t + (Number(r.durationMs) || 0), 0)
  return { rows, state: live ? 'active' : 'done', failed, duration_ms: ms || null }
})

// A step is open while it is the one running -- that is where the live activity and reasoning are --
// and otherwise only when the reader opens it.
function stepOpen(s) {
  const id = s.node_id
  if (id in _open.value) return !!_open.value[id]
  // ONCE THE RUN HAS ENDED, EVERY STEP FOLDS BACK TO ITS TITLE and the final answer is what is left open —
  // the work is one click away, not in the way of the result. While it runs, the step that is working is
  // open, and so is one that produced something to look at (a generated image is that step's result).
  if (terminal.value) return false
  return s.state === 'active' || activitiesFor(id).some((a) => a.media && a.media.length)
}
function toggleStep(s) { _open.value = { ..._open.value, [s.node_id]: !stepOpen(s) } }

// Reasoning while it streams shows its latest part; a finished thought opens on demand.
function reasoningTail(text) {
  const t = String(text || '')
  return t.length > 600 ? `…${t.slice(-600)}` : t
}

// THIS RUN'S request, not the conversation's first message: a thread that ran Work twice opened the
// second rail on the first run's question. It is the last thing the user typed before this run's first
// message. Shown clamped with an expander -- it already sits in full in the bubble right above.
const request = computed(() => {
  const list = chat.messages || []
  const start = list.findIndex((m) => m.role === 'assistant' && belongsToThisRun(m))
  const upto = start >= 0 ? start : list.length
  for (let i = upto - 1; i >= 0; i--) {
    const m = list[i]
    if (m.role === 'user' && m.authoredBy !== 'system' && String(m.content || '').trim()) {
      return String(m.content)
    }
  }
  return ''
})
const requestOpen = ref(false)
const requestLong = computed(() => request.value.length > 220 || request.value.split('\n').length > 3)

// DOES THIS MESSAGE BELONG TO **THIS** RUN.
//
// The rail used to draw every assistant message in the conversation, which is right only while the
// conversation contains nothing but this run. A thread that ran Work and then went back to ordinary
// chat would have its chat answers pulled onto the Work rail -- the same conversation-scope mistake
// that ChatMessage made in the other direction, and the two together drew one answer twice.
//
// `turn_mode_resolved` and `run_id` are stamped by the server on every writer
// (agent/services/turn_metadata.py). A message written before that shipped has neither, and is
// admitted on the older evidence so an existing thread does not lose its answers: a plan anchor
// naming this run, or a work_iteration stamp.
// EVERY SITE THIS RUN HAS READ, live and after a reload. Live citations arrive on the streaming message;
// a finished message keeps its own pinned snapshot, so reopening the thread shows the same list rather
// than an empty panel. Deduplicated on the URL, because three sub-questions reading the same release
// page is one source, not three.
const SRC_SHOWN = 6
const allSources = ref(false)
const _srcOpen = ref(null)
// ONCE SHOWN, A SOURCE STAYS. The panel counted 7 -> 3 -> 4 on conv 1764: live citations accumulate
// across the whole turn, while each finished message pins only its own, so every time a message settled
// the union shrank and pages the user had already seen disappeared. A run's reading list only ever grows.
const _seenSources = new Map()
// Per component instance, and emptied when the rail is pointed at a different run — the accumulator is
// this RUN's reading list, not the tab's.
watch(() => String(props.runId), () => _seenSources.clear())
const readSources = computed(() => {
  const out = _seenSources
  const list = chat.messages || []
  // LIVE CITATIONS BELONG TO THE RUN, NOT TO A STREAMING BUBBLE. Keyed on a message with
  // status === 'streaming', the panel went blank for the whole of a fan-out: RESEARCH_IN_PARALLEL can
  // run for minutes between model rounds, and in that window there is no streaming message at all — so
  // a run that read nine pages through its children showed none of them (live, conv 1760). The run is
  // live until it is terminal; that is the right test.
  const add = (x) => {
    if (!x) return
    const ref = String(x.ref || '')
    const name = String(x.name || '') || ref
    if (!name) return
    const key = ref || name
    if (!out.has(key)) out.set(key, { name, ref, kind: String(x.kind || '') })
  }
  for (const m of list) {
    if (m.role !== 'assistant' || !belongsToThisRun(m)) continue
    for (const x of ((m.timeline && m.timeline.sources) || [])) add(x)
  }
  if (!terminal.value) for (const x of (chat.liveSources || [])) add(x)
  return [...out.values()]
})
const shownSources = computed(() => (allSources.value ? readSources.value : readSources.value.slice(0, SRC_SHOWN)))
// Open while the run is still reading (that is the whole point of showing it), folded once it ends.
const sourcesOpen = computed(() => (_srcOpen.value === null ? !terminal.value : _srcOpen.value))
function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch (_e) { return '' }
}

function belongsToThisRun(m) {
  const rid = String(props.runId)
  if (m.runId) return String(m.runId) === rid
  for (const a of (m.planArtifacts || [])) if (a && String(a.run_id) === rid) return true
  if (m.turnModeResolved) return m.turnModeResolved === 'work'
  return !!m.workIteration
}

// Which segment produced each answer. Stamped per message (live from `work_segment`, durably by the
// server); a message without a stamp belongs to the segment before it, and the first to segment 1.
const answers = computed(() => {
  let seg = 0
  // WHILE A STEP IS STILL RUNNING, text the model is streaming is narration ("I'll generate the four images
  // now…"), not the answer; it is replaced once the work is done. Drawn under the steps it read as the answer
  // arriving before the work it describes (prod conv 1591, 13s into a 75s run). It appears once no step is
  // running — which is when the real answer streams.
  const working = steps.value.some((x) => x.state === 'active')
  return (chat.messages || [])
    .filter((m) => m.role === 'assistant' && String(m.content || '').trim() && belongsToThisRun(m)
      && !(working && m.status === 'streaming'))
    .map((m) => {
      const stamped = Number((m.workIteration && m.workIteration.segment) || 0)
      seg = stamped || seg || 1
      const doc = parsed(m.content)
      return {
        id: m.id,
        message: m,
        segment: seg,
        streaming: m.status === 'streaming',
        text: String(m.content || ''),
        html: doc ? '' : renderAnswer(m.content),
        doc,
        summary: doc ? jsonSummary(doc) : '',
        citations: m.status === 'streaming' ? []
          : ((m.answerBasis && m.answerBasis.citations) || m.citations || []),
      }
    })
})

function findingsOf(list) {
  return (list || []).slice(0, 6).map((f) => ({
    issue: (f && (f.observation || f.repair_instruction)) || String(f || ''),
    remedy: f && f.observation ? (f.repair_instruction || '') : '',
  }))
}

// THE RUN IN THE ORDER IT HAPPENED: answer 1, the check that rejected it, answer 2, ... Every
// judgement is kept by the server (`work_goal.verdicts`), so a later `met` no longer erases the
// rejection before it -- which is what made a two-attempt run read as a first-time success, with the
// yellow box appearing and then vanishing (conv 1578). A `met` judgement is not drawn: the end row
// says it. A snapshot from before the history existed falls back to the single latest verdict.
const VERDICT_LABEL = {
  not_met: 'Not verified',
  undecidable: 'Could not verify the result',
  // Not a judgement: the model provider refused the segment, so nothing was checked or retried (conv 1642).
  provider_failed: 'Stopped — the AI provider refused the request',
}
const items = computed(() => {
  const history = Array.isArray(g.value.verdicts) ? g.value.verdicts : null
  const judged = (history || []).filter((h) => h && h.verdict && h.verdict !== 'met')
    .map((h) => ({ kind: 'verdict', key: `verdict_s${h.segment}`, segment: Number(h.segment) || 0,
                   verdict: h.verdict, findings: findingsOf(h.findings) }))
  const out = []
  let vi = 0
  for (const a of answers.value) {
    while (vi < judged.length && judged[vi].segment < a.segment) out.push(judged[vi++])
    out.push({ kind: 'answer', key: `answer_${a.id}`, ...a })
  }
  while (vi < judged.length) out.push(judged[vi++])
  if (!history) {
    for (const v of verdicts.value) {
      out.push({ kind: 'verdict', key: v.node_id, verdict: v.verdict || 'not_met', findings: v.findings })
    }
  }
  // Only the LAST rejection of a run still going says "trying again"; the others already did.
  let lastVerdict = -1
  let lastAnswer = -1
  out.forEach((it, i) => {
    if (it.kind === 'verdict') lastVerdict = i
    if (it.kind === 'answer') lastAnswer = i
  })
  const judgedSegments = new Set((history || []).map((h) => Number(h && h.segment)))
  let attempts = 0
  return out.map((it, i) => {
    if (it.kind === 'answer') {
      // ONE ANSWER THE USER READS: the one that passed. An earlier attempt's answer folds to a line once a
      // later attempt exists; the newest waits under "Verifying results…" until the check has spoken — it
      // used to be drawn in full, then judged, then replaced, which read as three answers to one question
      // (conv 1618).
      const superseded = i !== lastAnswer
      const verifying = !superseded && !!history && running.value && !terminal.value
        && (it.streaming || !judgedSegments.has(Number(it.segment)))
      return { ...it, superseded, verifying }
    }
    if (it.kind !== 'verdict') return it
    attempts += 1
    // THE LATEST REJECTION OF A RUN STILL GOING IS LIVE: the next attempt is already starting. Drawn as a
    // static amber box it read as "the run stopped" (conv 1599), so it pulses and shows that attempt's work
    // arriving beneath it.
    // ...until that attempt's answer is on the rail beneath it (conv 1603 kept "Attempt 2 is running"
    // under the check after answer 2 had arrived).
    const retrying = it.verdict === 'not_met' && i === lastVerdict && running.value
      && !out.slice(i + 1).some((x) => x.kind === 'answer' && !x.streaming)
    return {
      ...it,
      retrying,
      nextAttempt: attempts + 1,
      label: `${VERDICT_LABEL[it.verdict] || 'Not verified'}${
        it.verdict === 'not_met' && (i !== lastVerdict || running.value) ? ' — retrying' : ''}`,
    }
  })
})

// The end of the run: its tone follows the goal, not just "the run stopped".
const terminalTone = computed(() => {
  const st = String(g.value.state || '')
  if (st === 'ACHIEVED') return 'ok'
  if (st === 'EXHAUSTED' || st === 'ABANDONED' || st === 'PAUSED') return 'warn'
  const rs = String((terminal.value && terminal.value.state) || '')
  return rs === 'completed' ? 'ok' : 'warn'
})
// The goal's own outcome when it has one: "Completed" said the run stopped, not whether it got there.
const terminalLabel = computed(() => (g.value.state && g.value.state !== 'ACTIVE' && STATE_LABEL[g.value.state])
  || (terminal.value && terminal.value.label) || 'Done')
function fmtCost(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return ''
  return n < 0.01 ? `<$0.01` : `$${n.toFixed(2)}`
}

// What the answer bubble used to offer, at the END of the run where it belongs, acting on the run's
// final answer.
const finalAnswer = computed(() => {
  const list = answers.value
  return list.length ? list[list.length - 1] : null
})
const copied = ref(false)
async function copyFinal() {
  if (!finalAnswer.value) return
  try {
    await navigator.clipboard.writeText(finalAnswer.value.text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* clipboard unavailable */ }
}
// FILE LINKS IN AN ANSWER open in the file viewer, exactly as they do in a chat bubble. Loaded on first use
// (FileViewer pulls in highlight.js), and awaited so the first click is not swallowed.
const fileViewer = ref(null)
const FileViewerComp = shallowRef(null)
async function onAnswerClick(e) {
  const payload = fileLinkPayload(e.target?.closest?.('a[href*="/api/workspace/files/"], a[href*="/api/documents/"]'))
  if (!payload) return
  e.preventDefault()
  if (!FileViewerComp.value) {
    try {
      FileViewerComp.value = (await import('../FileViewer.vue')).default
    } catch {
      window.open(payload.download_url, '_blank', 'noopener')
      return
    }
    await new Promise((r) => setTimeout(r, 0))
  }
  fileViewer.value?.openUrl(payload)
}

function feedback(value) {
  const m = finalAnswer.value && finalAnswer.value.message
  if (m) chat.setFeedback(m.id, value)
}

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


      <!-- No request to sit on (an older thread): the controls still show. -->
          <div v-if="!request && goal && (goal.available_actions || []).length" class="acts" data-test="rt-head">
        <button v-for="a in (goal.available_actions || [])" :key="a" class="icon-btn" type="button"
                :class="{ danger: a === 'clear' }" :data-test="`rt-action-${a}`"
                :title="ACTION_LABEL[a] || a" :aria-label="ACTION_LABEL[a] || a"
                :disabled="busy" @click="emit('action', a)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="ACTION_ICON[a] || 'M12 5v14M5 12h14'" /></svg>
        </button>
          </div>

      <!-- What was asked. The run opens on the thing the steps are serving. -->
      <div v-if="request" class="node" data-state="you" data-test="rt-request">
        <span class="mkr" aria-hidden="true" />
        <div class="req">
          <div class="req-row">
            <p class="qt" :class="{ clamped: requestLong && !requestOpen }">{{ request }}</p>
            <!-- The goal's controls sit on the request they act on, not floating above the rail. -->
          <div v-if="goal && (goal.available_actions || []).length" class="acts req-acts" data-test="rt-head">
        <button v-for="a in (goal.available_actions || [])" :key="a" class="icon-btn" type="button"
                :class="{ danger: a === 'clear' }" :data-test="`rt-action-${a}`"
                :title="ACTION_LABEL[a] || a" :aria-label="ACTION_LABEL[a] || a"
                :disabled="busy" @click="emit('action', a)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="ACTION_ICON[a] || 'M12 5v14M5 12h14'" /></svg>
        </button>
          </div>
          </div>
          <button v-if="requestLong" type="button" class="more" data-test="rt-request-more"
                  @click="requestOpen = !requestOpen">{{ requestOpen ? 'Show less' : 'Show more' }}</button>
        </div>
      </div>

      <!-- Getting ready: what happened before the plan existed, as the run's first step. -->
      <div v-if="prep" class="node collapsible" :data-state="prep.state"
           :data-open="stepOpen({ node_id: PREP, state: prep.state }) ? 'true' : 'false'" data-test="rt-prepare">
        <span class="mkr" aria-hidden="true" />
        <div class="head" @click="toggleStep({ node_id: PREP, state: prep.state })">
          <span class="lb">{{ prep.state === 'active' ? 'Getting ready' : 'Got ready' }}</span>
          <span v-if="prep.duration_ms" class="dur">{{ fmt(prep.duration_ms) }}</span>
          <button class="caret" data-test="rt-toggle-prepare"
                  :aria-expanded="stepOpen({ node_id: PREP, state: prep.state }) ? 'true' : 'false'"
                  @click.stop="toggleStep({ node_id: PREP, state: prep.state })">▾</button>
        </div>
        <div class="body"><div class="inner">
          <div class="stack">
            <template v-for="a in prep.rows" :key="a.key">
              <div class="act" :data-s="a.status === 'failed' ? 'fail' : a.status === 'running' ? 'run' : 'done'">
                <span class="ic" aria-hidden="true">{{ a.status === 'failed' ? '✕' : a.status === 'running' ? '◌' : '✓' }}</span>
                <span class="al">{{ a.label }}</span>
                <span v-if="a.durationMs" class="ad">{{ fmt(a.durationMs) }}</span>
              </div>
              <div v-if="a.status === 'failed' && a.reason" class="act-note fail-note">{{ a.reason }}</div>
            </template>
          </div>
        </div></div>
      </div>

      <!-- The work of a run with no plan steps, shown as it happens (conv 1630). -->
      <div v-if="work" class="node collapsible" :data-state="work.state"
           :data-open="stepOpen({ node_id: WORK, state: work.state }) ? 'true' : 'false'" data-test="rt-work">
        <span class="mkr" aria-hidden="true" />
        <div class="head" @click="toggleStep({ node_id: WORK, state: work.state })">
          <span class="lb">{{ work.state === 'active' ? 'Working' : 'Worked' }}</span>
          <span v-if="work.failed" class="attempt-badge" data-test="rt-work-failed">{{ work.failed }} failed</span>
          <span v-if="work.duration_ms" class="dur">{{ fmt(work.duration_ms) }}</span>
          <button class="caret" data-test="rt-toggle-work"
                  :aria-expanded="stepOpen({ node_id: WORK, state: work.state }) ? 'true' : 'false'"
                  @click.stop="toggleStep({ node_id: WORK, state: work.state })">▾</button>
        </div>
        <div class="body"><div class="inner">
          <div class="stack">
            <template v-for="a in work.rows" :key="a.key">
              <div v-if="a.reasoning" class="think" :data-live="a.status === 'running' ? 'true' : 'false'">
                <button type="button" class="think-head" @click="toggle(a.key)">
                  <span class="think-dot" aria-hidden="true" />
                  {{ a.status === 'running' ? 'Thinking…' : 'Thought' }}
                  <span class="think-caret" aria-hidden="true">{{ a.status === 'running' || isOpen(a.key) ? '▾' : '▸' }}</span>
                </button>
                <p v-if="a.status === 'running' || isOpen(a.key)" class="think-text">
                  {{ a.status === 'running' ? reasoningTail(a.reasoning) : a.reasoning }}
                </p>
              </div>
              <template v-else>
                <div class="act" :data-s="a.status === 'failed' ? 'fail' : a.status === 'running' ? 'run' : 'done'">
                  <span class="ic" aria-hidden="true">{{ a.status === 'failed' ? '✕' : a.status === 'running' ? '◌' : '✓' }}</span>
                  <span class="al">{{ a.label }}</span>
                  <span v-if="a.durationMs" class="ad">{{ fmt(a.durationMs) }}</span>
                </div>
                <div v-if="a.status === 'failed' && a.reason" class="act-note fail-note">{{ a.reason }}</div>
              </template>
            </template>
          </div>
        </div></div>
      </div>

      <!-- The plan. Every step lands at once; a retry re-activates the step it belongs to. -->
      <div v-for="s in steps" :key="s.node_id" class="node"
           :class="{ collapsible: hasDetail(s) }"
           :data-state="STATE[s.state] || 'pending'"
           :data-open="stepOpen(s) ? 'true' : 'false'"
           :data-test="`rt-step-${s.node_id}`">
        <span class="mkr" aria-hidden="true" />
        <div class="head" @click="toggleStep(s)">
          <span v-if="s.index" class="num">{{ s.index }}</span>
          <span class="lb">{{ s.label }}</span>
          <span v-if="s.attempt > 1" class="attempt-badge" :data-test="`rt-attempt-${s.node_id}`">
            attempt {{ s.attempt }}
          </span>
          <span v-if="s.duration_ms" class="dur">{{ fmt(s.duration_ms) }}</span>
          <button v-if="hasDetail(s)"
                  class="caret" :data-test="`rt-toggle-${s.node_id}`"
                  :aria-expanded="stepOpen(s) ? 'true' : 'false'"
                  @click.stop="toggleStep(s)">▾</button>
        </div>
        <div class="body"><div class="inner">
          <div class="stack" :data-test="`rt-detail-${s.node_id}`">
            <!-- What the step DID, in order — nested here, never beside the rail. -->
            <!-- Labels only, never a tool's raw name. -->
            <template v-for="a in activitiesFor(s.node_id)" :key="a.key">
              <div v-if="a.reasoning" class="think" :data-live="a.status === 'running' ? 'true' : 'false'"
                   :data-test="`rt-reasoning-${a.key}`">
                <button type="button" class="think-head" @click="toggle(a.key)">
                  <span class="think-dot" aria-hidden="true" />
                  {{ a.status === 'running' ? 'Thinking…' : 'Thought' }}<span v-if="a.durationMs && a.status !== 'running'"
                    class="ad"> for {{ fmt(a.durationMs) }}</span>
                  <span class="think-caret" aria-hidden="true">{{ a.status === 'running' || isOpen(a.key) ? '▾' : '▸' }}</span>
                </button>
                <p v-if="a.status === 'running' || isOpen(a.key)" class="think-text">
                  {{ a.status === 'running' ? reasoningTail(a.reasoning) : a.reasoning }}
                </p>
              </div>
              <div v-else class="act"
                   :data-s="a.status === 'failed' ? 'fail' : a.status === 'running' ? 'run' : 'done'">
                <span class="ic" aria-hidden="true">{{ a.status === 'failed' ? '✕'
                  : a.status === 'running' ? '◌' : '✓' }}</span>
                <span class="al">{{ a.label }}</span>
                <span v-if="a.durationMs" class="ad">{{ fmt(a.durationMs) }}</span>
              </div>
              <div v-if="a.status === 'failed' && a.reason" class="act-note fail-note">{{ a.reason }}</div>
              <!-- What this call produced, right under it. -->
              <div v-if="a.media.length" class="act-media" :data-test="`rt-media-${a.key}`">
                <img v-for="(x, i) in a.media" :key="i" :src="x.url" alt="" loading="lazy" class="act-thumb" />
              </div>
            </template>
            <!-- NO "what the step can use" list. It came from the step's capability BINDING — 286 tools for an
                 image step in prod conv 1622 — so an image step read "Can use: … Reading a web page" though
                 nothing read a page. A permission list is not a plan; a step shows only what it actually did. -->
            <div v-if="s.details || s.failure" class="act-note">
              {{ s.details || s.failure }}
            </div>
          </div>
        </div></div>
      </div>

      <!-- Sources read, live (conv 1738). A research run's pages are fetched by delegated children on
           worker threads, so they never reached this tab until research_progress announced them. -->
      <div v-if="readSources.length" class="node collapsible" :data-state="terminal ? 'done' : 'active'"
           :data-open="sourcesOpen ? 'true' : 'false'" data-test="rt-sources">
        <span class="mkr" aria-hidden="true" />
        <div class="head" @click="_srcOpen = !sourcesOpen">
          <span class="lb">{{ terminal ? 'Read' : 'Reading' }} {{ readSources.length }}
            source{{ readSources.length === 1 ? '' : 's' }}</span>
          <button class="caret" data-test="rt-toggle-sources"
                  :aria-expanded="sourcesOpen ? 'true' : 'false'"
                  @click.stop="_srcOpen = !sourcesOpen">▾</button>
        </div>
        <div class="body"><div class="inner">
          <ul class="srcs">
            <li v-for="x in shownSources" :key="x.ref || x.name" class="src" data-test="rt-source">
              <span class="src-dom">{{ domainOf(x.ref) || x.kind || 'source' }}</span>
              <a v-if="x.ref" :href="x.ref" target="_blank" rel="noopener noreferrer" class="src-name"
                 :title="x.ref">{{ x.name }}</a>
              <span v-else class="src-name">{{ x.name }}</span>
            </li>
          </ul>
          <button v-if="readSources.length > SRC_SHOWN" type="button" class="more" data-test="rt-sources-more"
                  @click="allSources = !allSources">
            {{ allSources ? 'Show fewer' : `Show all ${readSources.length}` }}
          </button>
        </div></div>
      </div>

      <!-- The run as it happened: each answer, then the goal check that judged it. -->
      <template v-for="it in items" :key="it.key">
        <!-- An earlier attempt: one line, openable. -->
        <div v-if="it.kind === 'answer' && it.superseded" class="node" data-state="done"
             :data-test="`rt-answer-${it.id}`">
          <span class="mkr" aria-hidden="true" />
          <div class="msg">
            <button class="disclose" :data-test="`rt-answer-toggle-${it.id}`" @click="toggle(it.id)">
              {{ isOpen(it.id) ? '▾' : '▸' }} Attempt {{ it.segment }} answer
            </button>
            <template v-if="isOpen(it.id)">
              <pre v-if="it.doc" class="jsonbox">{{ it.text }}</pre>
              <div v-else class="mt md" :data-test="`rt-answer-md-${it.id}`" v-html="it.html" @click="onAnswerClick" />
            </template>
          </div>
        </div>
        <!-- The newest answer, while it is being written or checked. -->
        <div v-else-if="it.kind === 'answer' && it.verifying" class="node" data-state="active"
             :data-test="`rt-answer-${it.id}`">
          <span class="mkr" aria-hidden="true" />
          <div class="msg">
            <div class="verifying" :data-test="`rt-verifying-${it.id}`">
              <span class="retry-spin" aria-hidden="true" />
              <span class="retry-lb">{{ it.streaming ? 'Writing the answer…' : 'Verifying results…' }}</span>
              <button v-if="!it.streaming" type="button" class="more" @click="toggle(it.id)">
                {{ isOpen(it.id) ? 'Hide draft' : 'Show draft' }}
              </button>
            </div>
            <div v-if="isOpen(it.id) && !it.doc" class="mt md draft" v-html="it.html" @click="onAnswerClick" />
          </div>
        </div>
        <div v-else-if="it.kind === 'answer'" class="node" :data-state="it.streaming ? 'active' : 'done'"
             :data-test="`rt-answer-${it.id}`">
          <span class="mkr" aria-hidden="true" />
          <div class="msg">
            <template v-if="it.doc">
              <button class="disclose" :data-test="`rt-answer-toggle-${it.id}`" @click="toggle(it.id)">
                {{ isOpen(it.id) ? '▾' : '▸' }} {{ it.summary }}
              </button>
              <pre v-if="isOpen(it.id)" class="jsonbox">{{ it.text }}</pre>
            </template>
            <div v-else class="mt md" :data-test="`rt-answer-md-${it.id}`" v-html="it.html" @click="onAnswerClick" />
            <SourcesList v-if="it.citations.length" :citations="it.citations" />
          </div>
        </div>
        <div v-else class="node" data-state="fail" :data-live="it.retrying ? 'true' : 'false'"
             :data-test="`rt-verdict-${it.key}`">
          <span class="mkr" aria-hidden="true" />
          <div class="head" style="padding-bottom:4px">
            <span class="lb" style="color:var(--warn)">{{ it.label }}</span>
          </div>
          <!-- The reason in one line; the full findings on demand. -->
          <div v-if="it.findings && it.findings.length" class="verdict">
            <p class="verdict-lead">{{ it.findings[0].issue }}</p>
            <button type="button" class="more" :data-test="`rt-verdict-details-${it.key}`" @click="toggle(it.key)">
              {{ isOpen(it.key) ? 'Hide details' : `Details${it.findings.length > 1 ? ` (${it.findings.length})` : ''}` }}
            </button>
            <ul v-if="isOpen(it.key)">
              <li v-for="(f, i) in it.findings" :key="i">
                {{ f.issue }}<span v-if="f.remedy" class="fix"> → {{ f.remedy }}</span>
              </li>
            </ul>
          </div>
          <div v-if="it.retrying" class="retry-live" :data-test="`rt-retry-live-${it.key}`">
            <span class="retry-spin" aria-hidden="true" />
            <span class="retry-lb">Attempt {{ it.nextAttempt }} is running</span>
            <span v-for="a in liveActivity" :key="a.key" class="retry-act" :data-run="a.running ? 'true' : 'false'">
              {{ a.label }}
            </span>
          </div>
        </div>
      </template>

      <!-- One unambiguous end. -->
      <div v-if="terminal" class="node" data-state="done" data-test="rt-terminal">
        <span class="mkr" aria-hidden="true" />
        <div class="terminal">
          <span class="pill" :class="terminalTone" data-test="rt-terminal-state">{{ terminalLabel }}</span>
          <span class="ts">
            <template v-if="terminal.steps">Ran <b>{{ terminal.steps }} step{{ terminal.steps === 1 ? '' : 's' }}</b></template><template
              v-if="terminal.retried">{{ terminal.steps ? ', ' : '' }}<b>{{ terminal.retried }} retried</b></template><template
              v-if="terminal.duration_ms">{{ terminal.steps || terminal.retried ? ' · ' : '' }}{{ fmt(terminal.duration_ms) }}</template><template
              v-if="terminal.total_tokens"> · {{ fmtTokens(terminal.total_tokens) }} tokens</template><template
              v-if="fmtCost(terminal.cost_usd)"> · {{ fmtCost(terminal.cost_usd) }}</template>
          </span>
          <span v-if="finalAnswer" class="end-acts" data-test="rt-end-actions">
            <button type="button" class="icon-btn" :class="{ on: finalAnswer.message.feedback === 'up' }"
                    title="Good response" aria-label="Good response" @click="feedback('up')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
            </button>
            <button type="button" class="icon-btn" :class="{ on: finalAnswer.message.feedback === 'down' }"
                    title="Bad response" aria-label="Bad response" @click="feedback('down')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" /></svg>
            </button>
            <button type="button" class="icon-btn" data-test="rt-copy" :title="copied ? 'Copied' : 'Copy answer'"
                    :aria-label="copied ? 'Copied' : 'Copy answer'" @click="copyFinal">
              <svg v-if="!copied" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            </button>
            <button type="button" class="icon-btn" data-test="rt-share" title="Share" aria-label="Share"
                    @click="chat.openShare(finalAnswer.message.serverId || null)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></svg>
            </button>
            <button type="button" class="icon-btn" data-test="rt-regenerate" title="Regenerate" aria-label="Regenerate"
                    :disabled="chat.isBusy" @click="chat.regenerate(finalAnswer.message.id)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
            </button>
          </span>
        </div>
      </div>
    </div>
    <component :is="FileViewerComp" v-if="FileViewerComp" ref="fileViewer" />
  </div>
</template>
