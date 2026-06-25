// Workflow Builder — pure helpers for the output-tree variable selector (Phase 2A).
//
// These build the SAME `{{ … }}` expressions the backend resolver already understands
// (nodes.<id>.output.<path> / trigger.<path> / vars.<path> / item, nested keys, [index]).
// IMPORTANT: the runtime resolver supports numeric array indexes (`items[0]`) but NOT a `.first`
// keyword — so the "first" helper emits `[0]` (a real, resolvable index), just labelled "first".
// No backend / graph-JSON change.

export function valType(v) {
  if (Array.isArray(v)) return 'array'
  if (v === null) return 'null'
  return typeof v   // 'string' | 'number' | 'boolean' | 'object' | 'undefined'
}

export function isExpandable(v) {
  const t = valType(v)
  return (t === 'object' && Object.keys(v).length > 0) || (t === 'array' && v.length > 0)
}

export function previewValue(v) {
  if (v === null) return 'null'
  if (v === undefined) return ''
  if (Array.isArray(v)) return `[ ${v.length} ]`
  if (typeof v === 'object') return `{ ${Object.keys(v).length} }`
  const s = typeof v === 'string' ? v : String(v)
  return s.length > 48 ? s.slice(0, 48) + '…' : s
}

// Path building (relative to a base like `nodes.<id>.output`)
export function joinKey(parentPath, key) { return parentPath ? `${parentPath}.${key}` : String(key) }
export function joinIndex(parentPath, i) { return `${parentPath || ''}[${i}]` }
export function firstOf(parentPath) { return joinIndex(parentPath, 0) }   // ".first" sugar → [0]

// Full `{{ … }}` expression for a base + relative path. Whitespace-free to match existing emissions.
export function varExpr(base, path) {
  const full = path ? `${base}.${path}` : base
  return `{{${full}}}`
}

// Splice `insert` into `text` replacing [start,end) (caret-aware insert; appends when caret unknown).
export function insertAt(text, start, end, insert) {
  const s = (typeof text === 'string' ? text : '')
  const a = start == null ? s.length : start
  const b = end == null ? a : end
  return s.slice(0, a) + insert + s.slice(b)
}
