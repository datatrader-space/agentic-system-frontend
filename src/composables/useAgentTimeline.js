// useAgentTimeline — render model for AgentRunner *rich streaming* events.
//
// The backend (flag AGENTRUNNER_RICH_STREAMING_ENABLED) emits a safe, tier-redacted
// activity stream alongside the existing raw events:
//   agent_status         { phase, label }
//   agent_step_started   { step_id, phase, label, tool_call_id?, tool?, coalesced_count? }
//   agent_step_completed { step_id, label, status, tool_call_id?, summary?, duration_ms? }
//   agent_step_failed    { step_id, label, reason, tool_call_id?, next_action? }
//   source_citation      { kind, name, ref? }
//   agent_turn_summary   { final_status, tools_used_count?, sources_used_count?, had_failures?, had_approval?, duration_ms? }
//
// This composable turns that stream into a clean render model (status line + step
// timeline + sources + turn summary). It ONLY consumes the 6 rich events — when the
// backend flag is OFF none of them arrive and the host UI behaves exactly as before.
//
// We render ONLY backend-provided, already-safe fields (label/status/summary/reason/
// next_action/duration). No raw args, prompts, reasoning, secrets, model internals, or
// private debug fields are ever read or shown here.

import { ref, computed } from 'vue'

const RICH_EVENT_TYPES = new Set([
  'agent_status',
  'agent_step_started',
  'agent_step_completed',
  'agent_step_failed',
  'source_citation',
  'agent_turn_summary',
])

// True if `evt` is one of the rich streaming events this composable handles.
export function isRichEvent(evt) {
  return !!evt && RICH_EVENT_TYPES.has(evt.type)
}

// Dedup key for a source citation. Prefer the explicit ref when present so two distinct
// docs/records with the same display name still count separately; collapse otherwise.
function sourceKey(s) {
  return [s.kind || '', s.name || '', s.ref || ''].join('|')
}

// Map the backend's final_status → a friendly, user-tier line (New Chat / Emulator). Public copy is
// overridden in the component (AgentActivityTimeline) so customer-facing wording stays simple + safe.
function finalStatusLabel(status, hasFailures) {
  switch (status) {
    case 'failed':
      return 'Failed safely'
    case 'interrupted':
      return 'Interrupted'
    case 'completed_with_warnings':
      return 'Completed with warnings'
    case 'completed':
      return hasFailures ? 'Completed with warnings' : 'Completed'
    default:
      return status ? String(status) : 'Completed'
  }
}

export function useAgentTimeline() {
  const currentStatus = ref(null) // { phase, label } | null — the live "what it's doing now" line
  const steps = ref([]) // [{ stepId, toolCallId, phase, tool, label, status, summary, durationMs, reason, nextAction, coalescedCount }]
  const sources = ref([]) // [{ kind, name, ref }] — deduped
  const summary = ref(null) // { finalStatus, label, toolsUsedCount, sourcesUsedCount, hadFailures, hadApproval, durationMs } | null
  const isComplete = ref(false)
  const interrupted = ref(false) // socket dropped / cancelled mid-turn (no backend terminal event)

  // step status vocabulary: 'running' | 'ok' | 'failed'
  const activeStep = computed(() => {
    for (let i = steps.value.length - 1; i >= 0; i--) {
      if (steps.value[i].status === 'running') return steps.value[i]
    }
    return null
  })

  const hasFailures = computed(
    () => steps.value.some((s) => s.status === 'failed') || !!(summary.value && summary.value.hadFailures),
  )

  function reset() {
    currentStatus.value = null
    steps.value = []
    sources.value = []
    summary.value = null
    isComplete.value = false
    interrupted.value = false
  }

  function _find(stepId) {
    if (!stepId) return null
    return steps.value.find((s) => s.stepId === stepId) || null
  }

  const _now = () => Date.now()

  // A "phase row" is a non-tool timeline row for a status phase (Thinking / Searching the knowledge
  // base / Generating response). It renders identically to a tool step so the timeline reads as one
  // consistent sequence of rows — instead of a single replacing status line that morphs the UI.
  function _phaseRow(phase, label) {
    return {
      stepId: `phase_${phase || 'x'}_${steps.value.length}`,
      toolCallId: '', phase: phase || '', tool: '', argsPreview: '',
      label: label || 'Working', status: 'running', summary: '',
      durationMs: null, reason: '', nextAction: '', coalescedCount: 0,
      isPhase: true, startedAt: _now(),
    }
  }

  function _closeRow(s, status = 'ok') {
    if (!s || s.status !== 'running') return
    s.status = status
    if (s.durationMs == null && s.startedAt) s.durationMs = Math.max(0, _now() - s.startedAt)
  }

  // Consume one event. Returns true iff it was a rich event we handled (so the host can
  // `return` early and avoid double-processing). Out-of-order completes are fine — we match
  // by step_id, never by arrival order.
  function ingest(evt) {
    // Streamed model reasoning (reasoning_delta/_done) isn't a "rich" event, but we fold it INTO the
    // one unified panel by attaching the text to the reasoning ("Thinking") step. The backend never
    // sends reasoning on the public tier, so public timelines never carry it.
    if (evt && (evt.type === 'reasoning_delta' || evt.type === 'reasoning_done')) {
      if (isComplete.value) return true
      let s = null
      for (let i = steps.value.length - 1; i >= 0; i--) {
        if (steps.value[i].phase === 'reasoning') { s = steps.value[i]; break }
      }
      if (!s) { s = _phaseRow('reasoning', 'Thinking'); steps.value.push(s) }
      // Strip any <think> tags the backend wrapped native reasoning in, so they never show literally.
      if (evt.type === 'reasoning_delta' && evt.text) {
        s.reasoningText = ((s.reasoningText || '') + evt.text).replace(/<\/?think>/gi, '')
      }
      return true
    }
    if (!isRichEvent(evt)) return false
    switch (evt.type) {
      case 'agent_status': {
        // Don't overwrite the final state with a late status tick.
        if (isComplete.value) return true
        const phase = evt.phase || ''
        const label = evt.label || ''
        currentStatus.value = { phase, label }
        if (!label) return true
        // Reflect the phase as an accumulating ROW so the timeline reads as a clean sequence
        // (Thinking → Searching the knowledge base → Generating response) instead of one replacing
        // status line. If the current running row already covers this phase (a phase row OR the tool
        // step the normalizer emits for it), just relabel — never duplicate.
        const last = steps.value[steps.value.length - 1]
        if (last && last.status === 'running' && last.phase === phase) {
          if (last.isPhase) last.label = label
          return true
        }
        if (last && last.status === 'running' && last.isPhase) _closeRow(last, 'ok')
        steps.value.push(_phaseRow(phase, label))
        return true
      }

      case 'agent_step_started': {
        const existing = _find(evt.step_id)
        if (existing) {
          // Re-entrant safety: a duplicate start just refreshes the live step.
          existing.label = evt.label || existing.label
          existing.status = 'running'
          if (evt.coalesced_count) existing.coalescedCount = evt.coalesced_count
          if (evt.tool) existing.tool = evt.tool
          if (evt.args_preview) existing.argsPreview = evt.args_preview
          return true
        }
        // If the live phase row already represents this phase (the normalizer emits agent_status for
        // the same phase as the tool), UPGRADE it into the concrete tool step rather than adding a
        // duplicate row — keeps the timeline one clean sequence.
        const lastRow = steps.value[steps.value.length - 1]
        if (lastRow && lastRow.isPhase && lastRow.status === 'running' && lastRow.phase === (evt.phase || '')) {
          lastRow.stepId = evt.step_id
          lastRow.toolCallId = evt.tool_call_id || ''
          lastRow.tool = evt.tool || ''
          lastRow.argsPreview = evt.args_preview || ''
          lastRow.label = evt.label || lastRow.label
          lastRow.isPhase = false
          if (evt.coalesced_count) lastRow.coalescedCount = evt.coalesced_count
        } else {
          if (lastRow && lastRow.isPhase && lastRow.status === 'running') _closeRow(lastRow, 'ok')
          steps.value.push({
            stepId: evt.step_id,
            toolCallId: evt.tool_call_id || '',
            phase: evt.phase || '',
            // Builder tier only — the backend omits these on the user/public tiers, so they
            // are simply absent there (we never reconstruct them on the frontend).
            tool: evt.tool || '',
            argsPreview: evt.args_preview || '',
            label: evt.label || 'Working',
            status: 'running',
            summary: '',
            durationMs: null,
            reason: '',
            nextAction: '',
            coalescedCount: evt.coalesced_count || 0,
          })
        }
        return true
      }

      case 'agent_step_completed': {
        const s = _find(evt.step_id)
        if (s) {
          s.status = !evt.status || evt.status === 'ok' ? 'ok' : evt.status
          if (evt.label) s.label = evt.label
          if (evt.summary) s.summary = evt.summary
          // Prefer the backend duration; otherwise fall back to client-side elapsed so EVERY row
          // (incl. KB searches, whose tool_result omits duration_ms) shows a time.
          if (evt.duration_ms != null) s.durationMs = evt.duration_ms
          else if (s.durationMs == null && s.startedAt) s.durationMs = Math.max(0, _now() - s.startedAt)
        }
        return true
      }

      case 'agent_step_failed': {
        const s = _find(evt.step_id)
        if (s) {
          s.status = 'failed'
          if (evt.label) s.label = evt.label
          s.reason = evt.reason || ''
          s.nextAction = evt.next_action || ''
        } else {
          // A failure for a step we never saw start — record it so nothing is lost.
          steps.value.push({
            stepId: evt.step_id || `failed_${steps.value.length}`,
            toolCallId: evt.tool_call_id || '',
            phase: 'failed',
            tool: '',
            label: evt.label || 'Step failed',
            status: 'failed',
            summary: '',
            durationMs: null,
            reason: evt.reason || '',
            nextAction: evt.next_action || '',
            coalescedCount: 0,
          })
        }
        return true
      }

      case 'source_citation': {
        const src = { kind: evt.kind || '', name: evt.name || '', ref: evt.ref || '' }
        if (!src.name && !src.kind) return true
        const key = sourceKey(src)
        if (!sources.value.some((x) => sourceKey(x) === key)) sources.value.push(src)
        return true
      }

      case 'agent_turn_summary': {
        const status = evt.final_status || 'completed'
        const failed = evt.had_failures != null ? evt.had_failures : steps.value.some((s) => s.status === 'failed')
        summary.value = {
          finalStatus: status,
          label: finalStatusLabel(status, failed),
          toolsUsedCount: evt.tools_used_count != null ? evt.tools_used_count : null,
          sourcesUsedCount: evt.sources_used_count != null ? evt.sources_used_count : null,
          hadFailures: evt.had_failures != null ? evt.had_failures : null,
          hadApproval: evt.had_approval != null ? evt.had_approval : null,
          durationMs: evt.duration_ms != null ? evt.duration_ms : null,
        }
        // Close any still-running rows (the final phase row, e.g. "Generating response") so they
        // settle to ✓ with a duration instead of spinning forever.
        for (const s of steps.value) if (s.status === 'running') _closeRow(s, 'ok')
        isComplete.value = true
        currentStatus.value = null
        return true
      }

      default:
        return false
    }
  }

  // Close the live status line when the turn ends without a summary (e.g. the answer
  // finished before a turn summary arrived). Marks complete so the spinner stops.
  function finalize() {
    for (const s of steps.value) if (s.status === 'running') _closeRow(s, 'ok')
    isComplete.value = true
    currentStatus.value = null
  }

  // The turn ended ABNORMALLY (socket dropped, network error, user cancelled) — the backend never
  // sent a terminal event. Stop every spinner: any still-running step becomes 'interrupted', the live
  // status line clears, and a minimal interrupted summary is set so the UI never spins forever. The
  // component maps the wording per tier (public stays customer-safe). Idempotent.
  function interrupt(note = '') {
    for (const s of steps.value) {
      if (s.status === 'running') {
        s.status = 'interrupted'
        if (s.durationMs == null && s.startedAt) s.durationMs = Math.max(0, _now() - s.startedAt)
        if (note && !s.reason) s.reason = note
      }
    }
    currentStatus.value = null
    isComplete.value = true
    interrupted.value = true
    if (!summary.value || summary.value.finalStatus === 'completed') {
      summary.value = {
        finalStatus: 'interrupted',
        label: finalStatusLabel('interrupted', hasFailures.value),
        toolsUsedCount: null,
        sourcesUsedCount: null,
        hadFailures: null,
        hadApproval: null,
        durationMs: null,
      }
    }
  }

  // A plain, deep-copied snapshot for pinning the finished timeline onto a chat message
  // (so it persists after the live refs are reset for the next turn).
  function snapshot() {
    return {
      statusLabel: '',
      steps: steps.value.map((s) => ({ ...s })),
      sources: sources.value.map((s) => ({ ...s })),
      summary: summary.value ? { ...summary.value } : null,
      isComplete: true,
      hasFailures: hasFailures.value,
      interrupted: interrupted.value,
    }
  }

  // True if anything worth rendering has been received this turn.
  function hasActivity() {
    return steps.value.length > 0 || sources.value.length > 0 || !!currentStatus.value || !!summary.value
  }

  return {
    currentStatus,
    steps,
    activeStep,
    sources,
    summary,
    hasFailures,
    isComplete,
    interrupted,
    ingest,
    reset,
    finalize,
    interrupt,
    snapshot,
    hasActivity,
    isRichEvent,
  }
}

export default useAgentTimeline
