// Whether a plan snapshot is worth putting on screen at all.
//
// REPORTED FROM PRODUCTION (conversation 1427). The user asked agent 3316 a plain question — "do you
// understand the process?" — and got a plan card whose single step restated the question back:
//
//     The user wants to understand if the agent understands a complex multi-step proces…   Active  0/1
//     ● understand process: image processing, coordinate extraction, rendering, and iterative refinement flow
//     Active plan 0/1
//
// A one-step plan tells the reader nothing they did not just type. It re-states the request, occupies
// the width of the thread, and puts a progress meter on something with no progress to report. Two
// separate pieces of chrome for it — the inline card and the composer chip — is worse again.
//
// THE EXCEPTION IS THE WHOLE REASON THIS IS A FUNCTION. A single-step plan that is waiting on the user,
// blocked, or failed is not noise: it is the only place the decision or the failure is shown. Hiding a
// plan the user is meant to approve would strand the run behind a gate with no gate on screen — a far
// worse bug than the clutter this removes. So the rule is narrow: hide a trivial plan only while it is
// uneventful, and let every state that asks something of the reader through.

//: Plan states that must always render, however small the plan. `awaiting_approval` and `revised` carry
//: the approve/reject controls; `blocked` and `failed` are the only report of why a run stopped.
const ALWAYS_SHOW = new Set(['awaiting_approval', 'revised', 'blocked', 'failed', 'paused'])

//: Below this many steps a plan is a restatement, not a plan.
const MIN_INTERESTING_STEPS = 2

/**
 * @param {object|null} plan  A plan snapshot (the shape `InlinePlanCard` renders).
 * @param {string} state      The resolved user-facing plan state.
 * @returns {boolean}         True when the plan should be rendered.
 */
export function planIsWorthShowing(plan, state) {
  if (!plan) return false
  if (ALWAYS_SHOW.has(state)) return true
  // A roadmap is a deliberate artifact the user asked for; it stands whatever its size.
  if (plan.plan_purpose === 'roadmap') return true
  const total = plan.total_step_count ?? (Array.isArray(plan.steps) ? plan.steps.length : 0)
  return total >= MIN_INTERESTING_STEPS
}

export { ALWAYS_SHOW, MIN_INTERESTING_STEPS }
