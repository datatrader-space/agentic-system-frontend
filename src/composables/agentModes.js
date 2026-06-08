/**
 * Canonical mapping between the four product modes and the two backend booleans.
 *
 * The four modes are exactly the 2×2 of (execution_mode, plan_mode_enabled) — there is no separate
 * "mode" field. See the backend decision record agentic-docs/detailed_doc/router-vs-v3-authority.md.
 *
 *   Manual     = manual     + plan OFF
 *   Auto       = autonomous + plan OFF
 *   Plan       = manual     + plan ON
 *   Plan+Auto  = autonomous + plan ON
 *
 * Kept as a pure module (no Vue) so it is the single source of truth AND unit-testable.
 */

export function isAutonomous(executionMode) {
  return executionMode === 'autonomous'
}

/** The active mode key for a given (execution_mode, plan_mode_enabled) pair. */
export function modeKey(executionMode, planMode) {
  const auto = isAutonomous(executionMode)
  const plan = !!planMode
  if (auto && plan) return 'plan_auto'
  if (auto) return 'auto'
  if (plan) return 'plan'
  return 'manual'
}

/** Short label shown on the picker button. */
export function modeLabel(executionMode, planMode) {
  return {
    manual: 'Manual mode', auto: 'Auto mode', plan: 'Plan mode', plan_auto: 'Plan + Auto',
  }[modeKey(executionMode, planMode)]
}

/** The dot color class for the picker button. */
export function modeDotClass(executionMode, planMode) {
  if (isAutonomous(executionMode)) return 'amp-dot-auto'
  return planMode ? 'amp-dot-plan' : 'amp-dot-manual'
}

/** The four menu options, each carrying the exact backend patch it persists. */
export const MODE_OPTIONS = [
  { key: 'manual', icon: '✋', title: 'Manual mode', desc: 'You approve each tool / question.',
    patch: { execution_mode: 'manual', plan_mode_enabled: false } },
  { key: 'auto', icon: '⚡', title: 'Auto mode', desc: 'AI policy resolves stops; scheduled runs don’t hang.',
    patch: { execution_mode: 'autonomous', plan_mode_enabled: false } },
  { key: 'plan', icon: '📋', title: 'Planning mode', desc: 'Plan first, then act (you approve the plan).',
    patch: { execution_mode: 'manual', plan_mode_enabled: true } },
  { key: 'plan_auto', icon: '🤖', title: 'Plan + Auto', desc: 'AI plans, reviews, and runs autonomously.',
    patch: { execution_mode: 'autonomous', plan_mode_enabled: true } },
]
