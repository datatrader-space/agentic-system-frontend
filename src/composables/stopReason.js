// Maps an agent run's backend-determined stop_reason + confidence to a small UI badge.
// A clean, confident completion shows NO badge (no noise); anything that ended early, partial,
// or low-confidence shows a chip so the user knows WHY it stopped and how much to trust it.

const LABELS = {
  task_completed: 'Completed',
  insufficient_information: 'Partial — not enough info',
  user_input_required: 'Needs your input',
  blocked_by_policy: 'Blocked by policy',
  tool_failure: 'Stopped — tool failed',
  max_steps_reached: 'Stopped — reached limit',
  max_iterations_reached: 'Stopped — reached limit',   // back-compat: old persisted runs (pre-rename)
  token_budget_reached: 'Stopped — context limit',
  duplicate_loop_detected: 'Stopped — loop detected',
  stopped_by_user: 'Stopped by you',
  // Out of money: the run is paused, and the next message continues it (backend agent/services/budget_pause.py).
  balance_empty: 'Paused — balance ran out',
  cost_budget_reached: 'Paused — budget reached',
}

// tone -> tailwind-ish classes (kept generic; the component applies them)
const TONES = {
  high: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  medium: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  low: { dot: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', ring: 'ring-rose-200' },
}

// Reasons that are "clean enough" to NOT badge when confidence is high.
const QUIET = new Set(['task_completed'])

// THE TURN HEADER (ADM-1284): how the turn ENDED, as Claude Code shows it. The backend sends `final_status` (its
// `stop_reason.turn_status`: completed | paused | waiting | not_verified | failed) and the stop reason behind it; a
// failed call keeps its own red row and never changes the header. `interrupted` and `detached` are this page's own:
// the socket dropped, or this view stopped following a turn that is still running.
const TURN_WORDS = {
  paused: 'Paused',
  waiting: 'Waiting for you',
  not_verified: 'Not verified',
  failed: 'Could not complete',
  interrupted: 'Interrupted — connection lost',
  detached: 'Still running — reopen to follow',
}

// The statuses that are not a plain finish: the header is drawn as a warning, not a green check.
export const TURN_WARN = new Set(['paused', 'waiting', 'not_verified', 'failed', 'interrupted', 'detached'])

// The header's words for a turn that ended with `status` for `reason`; '' for a plain completed turn (the card then
// reads "Thought for Ns" or "Done"). A pause names what ran out ("Paused — balance ran out"), and a turn the person
// stopped says so.
export function turnHeadline(status, reason) {
  if (status === 'paused') return LABELS[reason] && reason !== 'task_completed' ? LABELS[reason] : TURN_WORDS.paused
  if (status === 'not_verified' && reason === 'insufficient_information') return LABELS[reason]
  if (TURN_WORDS[status]) return TURN_WORDS[status]
  if (reason === 'stopped_by_user') return LABELS.stopped_by_user
  return ''
}

export function stopReasonBadge(reason, confidence) {
  if (!reason) return null
  const conf = TONES[confidence] ? confidence : 'low'
  // Hide the badge for a clean, high-confidence completion — no need to label success.
  if (QUIET.has(reason) && conf === 'high') return null
  return {
    label: LABELS[reason] || reason.replace(/_/g, ' '),
    confidence: conf,
    tone: TONES[conf],
    title: `Why it ended: ${LABELS[reason] || reason} · confidence: ${conf}`,
  }
}
