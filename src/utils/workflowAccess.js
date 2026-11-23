// Who may do what with a workflow, as the server says (ADM-1339, WF_1339 contract). The SERVER decides every
// ability: these helpers only choose which controls the builder and the list show, so a person is not offered a
// button the server will refuse. Nothing here grants anything.
//
//   const role = workflowRole(graph.my_role)        // 'owner' | 'editor' | 'runner' | 'viewer'
//   workflowCan(role, 'edit')                       // false for a runner
//   approvalDecider(nodeState.output, doc.meta.owner) // { canDecide, text } for a waiting approval step
//
// Roles, from least to most: viewer (read) < runner (+ Test, Run) < editor (+ edit, validate, publish, pause,
// restore) < owner (+ share, archive, delete). A value the server did not send, or one this page does not know, is
// read as `viewer` (fail closed): the page then offers less, never more.

export const WORKFLOW_ROLES = ['viewer', 'runner', 'editor', 'owner']
/** The roles an owner can give someone (the owner role itself is never given). */
export const SHARE_ROLES = ['viewer', 'runner', 'editor']

export const ROLE_LABELS = { viewer: 'Viewer', runner: 'Runner', editor: 'Editor', owner: 'Owner' }
export const ROLE_HELP = {
  viewer: 'Sees the workflow, its versions and runs.',
  runner: 'Also tests and runs it.',
  editor: 'Also edits, validates, publishes and pauses it.',
  owner: 'Also shares, archives and deletes it.',
}

// The least role that has each ability (contract "Roles").
const NEEDS = { read: 'viewer', run: 'runner', edit: 'editor', share: 'owner', archive: 'owner' }

export function workflowRole(value) {
  return WORKFLOW_ROLES.includes(value) ? value : 'viewer'
}

export function workflowCan(role, ability) {
  const need = NEEDS[ability]
  if (!need) return false
  return WORKFLOW_ROLES.indexOf(workflowRole(role)) >= WORKFLOW_ROLES.indexOf(need)
}

/** { read, run, edit, share, archive } for a role. */
export function workflowAbilities(role) {
  return Object.fromEntries(Object.keys(NEEDS).map((a) => [a, workflowCan(role, a)]))
}

/** The display name of a person row ({ name, email }). */
export function personName(p) {
  if (!p) return ''
  return String(p.name || '').trim() || String(p.email || '').trim() || (p.user_id != null ? `Person #${p.user_id}` : '')
}

function joinNames(names) {
  if (names.length <= 1) return names[0] || ''
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
}

/**
 * Who may decide a waiting approval step, from the node run's output (contract "Approval step": `approvers` and
 * `can_decide` for the caller). Approve and Reject are offered only when the server says `can_decide: true`.
 */
export function approvalDecider(output, owner = null) {
  const canDecide = output?.can_decide === true
  if (canDecide) return { canDecide, text: '' }
  const names = (Array.isArray(output?.approvers) ? output.approvers : []).map(personName).filter(Boolean)
  if (names.length) return { canDecide, text: `Waiting for ${joinNames(names)} to decide.` }
  const ownerName = personName(owner)
  return { canDecide, text: ownerName ? `Waiting for the owner, ${ownerName}, to decide.` : 'Waiting for the owner to decide.' }
}

/**
 * The approval step's stored `approvers`, read as the engine reads it: a list of user ids, or `legacy` when it is the
 * old free text (emails, comma-separated), which the engine no longer reads (validate code approvers.legacy_text).
 */
export function readApprovers(value) {
  if (Array.isArray(value)) {
    const ids = []
    for (const v of value) {
      const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN)
      if (Number.isInteger(n) && !ids.includes(n)) ids.push(n)
    }
    return { ids, legacy: '' }
  }
  if (typeof value === 'string' && value.trim()) return { ids: [], legacy: value.trim() }
  return { ids: [], legacy: '' }
}

// The share endpoints' refusals (contract "Shares"), used when the server sends a code without a sentence.
const SHARE_ERROR_TEXT = {
  not_workspace_member: 'That person is not a member of this workflow\'s workspace, so it cannot be shared with them.',
  already_shared: 'This workflow is already shared with that person. Change their role in the list instead.',
  bad_role: 'Choose Viewer, Runner or Editor.',
  is_owner: 'That person owns this workflow.',
  forbidden_role: 'Your role on this workflow does not allow that.',
}

/** The server's own sentence for a refused request, else a plain one for its code or status. */
export function serverSentence(e, fallback) {
  const d = e?.response?.data
  if (d && typeof d.error === 'string' && d.error.trim()) return d.error
  if (d && typeof d.detail === 'string' && d.detail.trim()) return d.detail
  if (d?.code && SHARE_ERROR_TEXT[d.code]) return SHARE_ERROR_TEXT[d.code]
  if (e?.response?.status) return `${fallback} (error ${e.response.status}).`
  return `${fallback}. Check your connection and try again.`
}
