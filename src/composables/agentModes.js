/**
 * Canonical agent run mode.
 *
 * The product exposes ONE field — `agent_run_mode` — with exactly two values (ADM-1306):
 *
 *   manual      = the agent asks before risky changes
 *   autonomous  = the agent chooses and runs tools automatically
 *
 * There is no agent-level plan-review mode: planning first is chosen per message with Plan in the chat box
 * (TurnModeSwitch), and the approved plan then runs in the agent's own mode. A row saved before that may still
 * hold `plan_review_manual` / `plan_review_autonomous` until the one-time backend command rewrites it; it reads
 * as the mode it becomes (RETIRED_RUN_MODES), so the page shows it the same way.
 *
 * Kept as a pure module (no Vue) so it is the single source of truth AND unit-testable.
 */

export const RUN_MODES = ['manual', 'autonomous']

/** Each retired plan-review mode and the mode it becomes (the backend's retire_plan_review_agent_modes). */
export const RETIRED_RUN_MODES = { plan_review_manual: 'manual', plan_review_autonomous: 'autonomous' }

/** Coerce any value to a valid run mode: a retired mode to the mode it becomes, anything else unknown to 'manual'. */
export function normalizeRunMode(mode) {
  if (RUN_MODES.includes(mode)) return mode
  return RETIRED_RUN_MODES[mode] || 'manual'
}

/** True when the mode runs tools without per-action approval. */
export function isAutonomous(mode) {
  return normalizeRunMode(mode) === 'autonomous'
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
  }[normalizeRunMode(mode)]
}

/** The dot color class for the picker button. */
export function modeDotClass(mode) {
  return isAutonomous(mode) ? 'amp-dot-auto' : 'amp-dot-manual'
}

/** The two menu options, each carrying the exact backend patch it persists. */
export const MODE_OPTIONS = [
  { key: 'manual', icon: '✋', title: 'Manual', desc: 'You approve each tool / question.',
    patch: { agent_run_mode: 'manual' } },
  { key: 'autonomous', icon: '⚡', title: 'Autonomous',
    desc: 'AI chooses and runs tools automatically; risky actions are reviewed by the AI safety policy.',
    patch: { agent_run_mode: 'autonomous' } },
]
