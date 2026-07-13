/**
 * Canonical agent run mode.
 *
 * The product exposes ONE field — `agent_run_mode` — with exactly four values. There is no longer a
 * separate (execution_mode, plan_mode_enabled, plan_approval_required) triple in the UI or payloads.
 *
 *   manual                  = you approve each tool / question
 *   autonomous              = the agent chooses and runs tools automatically
 *   plan_review_manual      = plan first (you approve the plan), then you approve each action
 *   plan_review_autonomous  = plan first (reviewed), then run autonomously
 *
 * Kept as a pure module (no Vue) so it is the single source of truth AND unit-testable.
 */

export const RUN_MODES = ['manual', 'autonomous', 'plan_review_manual', 'plan_review_autonomous']

/** Coerce any value to a valid run mode (defaults to 'manual'). */
export function normalizeRunMode(mode) {
  return RUN_MODES.includes(mode) ? mode : 'manual'
}

/** True when the mode runs tools without per-action approval. */
export function isAutonomous(mode) {
  const m = normalizeRunMode(mode)
  return m === 'autonomous' || m === 'plan_review_autonomous'
}

/** True when the mode drafts a plan for review before acting. */
export function isPlanReview(mode) {
  const m = normalizeRunMode(mode)
  return m === 'plan_review_manual' || m === 'plan_review_autonomous'
}

/** The canonical mode key (identity after normalization). */
export function modeKey(mode) {
  return normalizeRunMode(mode)
}

/** Short label shown on pickers / badges. */
export function modeLabel(mode) {
  return {
    manual: 'Manual',
    autonomous: 'Autonomous',
    plan_review_manual: 'Plan review → Manual',
    plan_review_autonomous: 'Plan review → Autonomous',
  }[normalizeRunMode(mode)]
}

/** The dot color class for the picker button. */
export function modeDotClass(mode) {
  if (isAutonomous(mode)) return 'amp-dot-auto'
  if (isPlanReview(mode)) return 'amp-dot-plan'
  return 'amp-dot-manual'
}

/** The four menu options, each carrying the exact backend patch it persists. */
export const MODE_OPTIONS = [
  { key: 'manual', icon: '✋', title: 'Manual', desc: 'You approve each tool / question.',
    patch: { agent_run_mode: 'manual' } },
  { key: 'autonomous', icon: '⚡', title: 'Autonomous',
    desc: 'AI chooses and runs tools automatically; risky actions are reviewed by the AI safety policy.',
    patch: { agent_run_mode: 'autonomous' } },
  { key: 'plan_review_manual', icon: '📋', title: 'Plan review → Manual',
    desc: 'Plan first (you approve the plan), then you approve each action.',
    patch: { agent_run_mode: 'plan_review_manual' } },
  { key: 'plan_review_autonomous', icon: '🤖', title: 'Plan review → Autonomous',
    desc: 'Plan first (reviewed), then run autonomously.',
    patch: { agent_run_mode: 'plan_review_autonomous' } },
]
