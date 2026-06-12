// Maps an agent run's backend-determined stop_reason + confidence to a small UI badge.
// A clean, confident completion shows NO badge (no noise); anything that ended early, partial,
// or low-confidence shows a chip so the user knows WHY it stopped and how much to trust it.

const LABELS = {
  task_completed: 'Completed',
  insufficient_information: 'Partial — not enough info',
  user_input_required: 'Needs your input',
  blocked_by_policy: 'Blocked by policy',
  tool_failure: 'Stopped — tool failed',
  max_iterations_reached: 'Stopped — reached limit',
  token_budget_reached: 'Stopped — context limit',
  duplicate_loop_detected: 'Stopped — loop detected',
  stopped_by_user: 'Stopped by you',
}

// tone -> tailwind-ish classes (kept generic; the component applies them)
const TONES = {
  high: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  medium: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  low: { dot: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', ring: 'ring-rose-200' },
}

// Reasons that are "clean enough" to NOT badge when confidence is high.
const QUIET = new Set(['task_completed'])

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
