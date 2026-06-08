/**
 * Shared constants + pure helpers for the soft "Behavioral Rules" (agent_rules) editor.
 * Kept in a plain module (not the .vue) so both AgentRulesEditor and AgentBuilder import the SAME
 * limits/logic, and so the validation is unit-testable without mounting a component.
 *
 * Keep in sync with the backend: agent/approval/rules.py (MAX_RULES / MAX_RULE_LEN).
 */
export const MAX_RULES = 20
export const MAX_RULE_LEN = 200

/** Trim every rule, drop empty/whitespace-only entries, clamp to MAX_RULES. Safe for any input. */
export function cleanRules(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((r) => (typeof r === 'string' ? r.trim() : ''))
    .filter((r) => r.length > 0)
    .slice(0, MAX_RULES)
}

/** True when the rules are within limits (count <= MAX_RULES and each <= MAX_RULE_LEN). */
export function rulesValid(arr) {
  const list = Array.isArray(arr) ? arr : []
  if (list.length > MAX_RULES) return false
  return list.every((r) => (r || '').length <= MAX_RULE_LEN)
}
