// What a Work run looks like to the person who asked for it — Work Mode V2, phase 10.
//
// THE PROBLEM, MEASURED ON REAL RUNS. A Work run is many turns, each turn many rounds, each round
// several tool calls. Rendered one row per call, a run that built four pages reported around forty
// rows, of which the reader cared about perhaps six. Worse, the rows that dominated were the ones with
// the least meaning: eleven consecutive "Reading a saved file", the verification dispatches, the
// bookkeeping of which attempt and which segment produced them. The work itself — the pages — was
// three rows buried in the middle.
//
// A long list is not more transparent than a short one. It is less: the reader stops reading it, and
// the one row that said something failed goes by unnoticed.
//
// THE RULE. Fold what repeats, fold what is orchestration, and never fold what went wrong.
//
//   * Consecutive rows with the SAME label become one row carrying a count. Eleven file reads are one
//     fact about the run, not eleven.
//   * Consecutive VERIFICATION rows become one row. Whether the check took one dispatch or four is a
//     question about our machinery, not about the user's work.
//   * A FAILED, INTERRUPTED or RUNNING row is never folded into a neighbour and never swallows one.
//     Folding a failure into a count is how a run reports "Reading files ×12" over an error.
//
// Nothing is hidden: the raw list stays one click away, which is where the attempt numbers, the
// segment counters and the individual receipts belong — available to whoever is debugging, absent for
// everyone else.

//: Phases whose rows are about HOW we checked, not about what was produced.
const ORCHESTRATION_PHASES = new Set(['verifying'])

//: A row in one of these states is always its own row. A count is a summary, and a failure must never
//: be summarised away.
const NEVER_FOLD = new Set(['failed', 'interrupted', 'running'])

/**
 * Is this row about the work, or about our checking of it?
 * @param {object} step
 * @returns {boolean}
 */
export function isOrchestration(step) {
  return !!step && ORCHESTRATION_PHASES.has(step.phase)
}

/**
 * Fold an activity list into the milestones a reader actually wants.
 *
 * Returns NEW row objects — the input is never mutated — each carrying `repeatCount` (1 when the row
 * stands alone) and `foldedIds` (every original stepId it represents, so a click can expand exactly
 * these). `label` is left untouched; the count is rendered beside it, so no wording is invented here.
 *
 * @param {Array<object>} steps  Action rows (reasoning rows are already excluded upstream).
 * @returns {Array<object>}
 */
export function foldMilestones(steps) {
  const out = []
  for (const step of steps || []) {
    if (!step) continue
    const prev = out.length ? out[out.length - 1] : null
    const foldable =
      prev &&
      !NEVER_FOLD.has(step.status) &&
      !NEVER_FOLD.has(prev.status) &&
      // Either the same thing happening again, or two consecutive pieces of orchestration.
      ((prev.label && prev.label === step.label) || (isOrchestration(prev) && isOrchestration(step)))

    if (foldable) {
      prev.repeatCount += 1
      prev.foldedIds.push(step.stepId)
      // Durations add up: "Checking the work · 34s" is true of the fold and useful; the individual
      // splits are in the raw list.
      if (step.durationMs != null) prev.durationMs = (prev.durationMs || 0) + step.durationMs
      continue
    }
    out.push({ ...step, repeatCount: 1, foldedIds: [step.stepId] })
  }
  return out
}

/**
 * Did folding actually remove anything? Drives whether a "show every step" control is offered at all —
 * a toggle that reveals the same list it already shows is noise of its own.
 * @param {Array<object>} folded
 * @param {Array<object>} steps
 * @returns {boolean}
 */
export function wasFolded(folded, steps) {
  return (folded || []).length < (steps || []).length
}

export { ORCHESTRATION_PHASES, NEVER_FOLD }
