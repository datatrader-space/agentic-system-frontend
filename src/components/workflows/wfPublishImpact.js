// What runs a workflow now, as the builder shows it before publishing (ADM-1351 phase 4; VISION_WORKFLOWS_PLAN.md 4.6).
// GET /api/workflow-graphs/<id>/impact/ answers
//   { workflow, items: [{ kind, id, name, state, version, ... }], counts: { stream, batch, app, trigger, parent },
//     not_shown: { stream, batch, app }, total, confirm, message, notes }
// The SERVER decides what is listed and what is only counted (a stream of a project the person is not in is counted
// under not_shown, never named), and whether the person is asked first (`confirm`: a live stream uses it). This file
// only groups and words what it sent.

// The order the groups are shown in, and their words. A stream or batch keeps the version it started with; the others
// run the new version from their next run (the server's `message` says so).
export const IMPACT_KINDS = ['stream', 'batch', 'app', 'trigger', 'parent']
const KIND_WORDS = {
  stream: { title: 'Live streams', one: 'live stream', many: 'live streams', icon: 'lucide:radio' },
  batch: { title: 'Batches in progress', one: 'batch in progress', many: 'batches in progress', icon: 'lucide:images' },
  app: { title: 'Connected Apps', one: 'Connected App', many: 'Connected Apps', icon: 'lucide:plug' },
  trigger: { title: 'Triggers', one: 'trigger', many: 'triggers', icon: 'lucide:zap' },
  parent: { title: 'Workflows that run this one', one: 'workflow that runs it', many: 'workflows that run it', icon: 'lucide:workflow' },
}

const count = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0)
const plural = (n, kind) => `${n} ${n === 1 ? KIND_WORDS[kind].one : KIND_WORDS[kind].many}`

// A state word as a person reads it: the server sends the record's own state (queued, running, active, disabled,
// published, paused, draft).
const STATE_WORDS = {
  queued: 'Queued', running: 'Running', starting: 'Starting', active: 'Active', disabled: 'Turned off',
  published: 'Published', paused: 'Paused', draft: 'Draft', archived: 'Archived',
}
export function impactStateLabel(state) {
  if (!state) return ''
  const s = String(state)
  return STATE_WORDS[s] || s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

/**
 * The groups to show, in IMPACT_KINDS order, only those with something in them:
 * [{ kind, title, icon, items, hidden, count }]. `hidden` is how many the server counted but did not name.
 */
export function impactGroups(impact) {
  const items = Array.isArray(impact?.items) ? impact.items : []
  const counts = impact?.counts || {}
  const hiddenOf = impact?.not_shown || {}
  const out = []
  for (const kind of IMPACT_KINDS) {
    const rows = items.filter((i) => i?.kind === kind)
    const hidden = count(hiddenOf[kind])
    const total = Math.max(count(counts[kind]), rows.length + hidden)
    if (!total) continue
    out.push({ kind, title: KIND_WORDS[kind].title, icon: KIND_WORDS[kind].icon, items: rows, hidden, count: total })
  }
  return out
}

/** "N more you cannot see" for a group, or '' when the server named every one. */
export function hiddenLine(hidden) {
  const n = count(hidden)
  return n ? `${n} more you cannot see` : ''
}

/**
 * The short "Used by" line after a publish that needed no question: "Used by 2 triggers and 1 Connected App." or ''
 * when nothing uses the workflow (total 0).
 */
export function usedBySummary(impact) {
  if (!count(impact?.total)) return ''
  const parts = impactGroups(impact).map((g) => plural(g.count, g.kind))
  if (!parts.length) return ''
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `Used by ${list}.`
}
