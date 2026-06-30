// Local-only learning-path progress (Phase 2). Persists per-path completed steps +
// the path's total step count in localStorage so the list and detail pages can show
// a progress bar without backend per-user progress (deferred to a later phase).
const KEY = 'help_path_progress_v1'

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}
function saveAll(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* quota/disabled */ }
}

function entry(pathSlug) {
  const all = loadAll()
  return all[pathSlug] || { done: [], total: 0 }
}

export function setPathTotal(pathSlug, total) {
  const all = loadAll()
  const e = all[pathSlug] || { done: [], total: 0 }
  e.total = total
  all[pathSlug] = e
  saveAll(all)
}

export function isStepDone(pathSlug, stepSlug) {
  return entry(pathSlug).done.includes(stepSlug)
}

export function getCompleted(pathSlug) {
  return entry(pathSlug).done
}

export function toggleStep(pathSlug, stepSlug, done) {
  const all = loadAll()
  const e = all[pathSlug] || { done: [], total: 0 }
  const set = new Set(e.done)
  if (done) set.add(stepSlug)
  else set.delete(stepSlug)
  e.done = [...set]
  all[pathSlug] = e
  saveAll(all)
  return e.done
}

export function pathProgressPercent(pathSlug) {
  const e = entry(pathSlug)
  if (!e.total) return 0
  return Math.round((e.done.length / e.total) * 100)
}
