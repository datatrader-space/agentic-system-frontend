// The node window's pure logic (ADM-1333, plan §3.3): what the Input pane lists, how a key becomes the engine's token,
// whether a token resolves against the last run, and the schema view of a value. No DOM and no Vue, so it is tested
// on its own.
//
// ONE SYNTAX (D3). Every token built here is the engine's own: {{nodes.<id>.output.<path>}}, {{trigger.<path>}},
// {{vars.<key>}} or {{item.<path>}}. Paths follow the engine's resolver (executor.py `resolve_path`, `_PATH_TOKEN`):
// a key is any run of characters other than `.`, `[` and `]`, and an index is `[n]`.
//
// NOTHING IS CUT (owner's rule). A value is listed whole; a large value is drawn with virtual scrolling by OutputTree.
import { ancestorIds } from '@/utils/wfVarExpr'
import { wfDef, wfOutputSample } from '@/config/wfNodeDefinitions'

// The drag payload type of a key dragged from the Input pane (its value is the token text).
export const WF_VAR_MIME = 'application/x-wf-var'

// executor.py `_PATH_TOKEN = r"([^.\[\]]+)|\[(\d+)\]"`
const PATH_TOKEN = /([^.[\]]+)|\[(\d+)\]/g

/** The value at `path` in `obj`, read the way the engine reads it. `undefined` when any step is missing. */
export function resolvePath(obj, path) {
  if (!path) return obj
  let cur = obj
  for (const m of String(path).matchAll(PATH_TOKEN)) {
    const [, key, idx] = m
    if (idx !== undefined) {
      if (!Array.isArray(cur)) return undefined
      const i = Number(idx)
      cur = i < cur.length ? cur[i] : undefined
    } else if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
      cur = Object.prototype.hasOwnProperty.call(cur, key) ? cur[key] : undefined
    } else {
      return undefined
    }
    if (cur === undefined || cur === null) return cur === null ? null : undefined
  }
  return cur
}

/** A key the engine can address: no `.`, `[`, `]` (path syntax) and no `{` or `}` (template braces). */
export function isAddressableKey(key) {
  const k = String(key)
  return k.length > 0 && !/[.[\]{}]/.test(k) && k.trim() === k
}

/** `base` + a relative path: `nodes.a.output` + `items[0].sku`, or + `[2]` for a list at the root. */
export function joinPath(base, path) {
  if (!path) return base
  if (!base) return path
  return path.startsWith('[') ? `${base}${path}` : `${base}.${path}`
}

export const tokenFor = (base, path) => `{{${joinPath(base, path)}}}`

/**
 * vue-json-pretty's node path (`root.a[1].b`, `root["x-y"]`) → the engine's relative path (`a[1].b`, `x-y`).
 * Returns null when a key on the way cannot be addressed by the engine, so no token is offered for it.
 */
export function prettyPathToEngine(prettyPath, rootPath = 'root') {
  const p = String(prettyPath ?? '')
  if (p === rootPath) return ''
  if (!p.startsWith(rootPath)) return null
  let rest = p.slice(rootPath.length)
  const parts = []
  while (rest.length) {
    if (rest[0] === '.') {
      const m = rest.slice(1).match(/^[^.[]+/)
      if (!m) return null
      if (!isAddressableKey(m[0])) return null
      parts.push(`.${m[0]}`)
      rest = rest.slice(1 + m[0].length)
    } else if (rest.startsWith('["')) {
      // A JSON string inside brackets: find its closing quote (escaped quotes are skipped).
      let i = 2
      while (i < rest.length && !(rest[i] === '"' && rest[i - 1] !== '\\')) i += 1
      if (rest[i + 1] !== ']') return null
      let key
      try { key = JSON.parse(rest.slice(1, i + 1)) } catch { return null }
      if (!isAddressableKey(key)) return null
      parts.push(`.${key}`)
      rest = rest.slice(i + 2)
    } else if (rest[0] === '[') {
      const m = rest.match(/^\[(\d+)\]/)
      if (!m) return null
      parts.push(`[${m[1]}]`)
      rest = rest.slice(m[0].length)
    } else {
      return null
    }
  }
  const joined = parts.join('')
  return joined.startsWith('.') ? joined.slice(1) : joined
}

// ── Schema view ─────────────────────────────────────────────────────────────────────────────────────

const typeName = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)

function mergeSchemas(a, b) {
  if (a === undefined) return b
  if (b === undefined) return a
  const aObj = a && typeof a === 'object' && !Array.isArray(a)
  const bObj = b && typeof b === 'object' && !Array.isArray(b)
  if (aObj && bObj) {
    const out = { ...a }
    for (const [k, v] of Object.entries(b)) out[k] = mergeSchemas(out[k], v)
    return out
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (!a.length) return b
    if (!b.length) return a
    return [mergeSchemas(a[0], b[0])]
  }
  if (typeof a === 'string' && typeof b === 'string') {
    const names = new Set([...a.split(' | '), ...b.split(' | ')])
    return [...names].join(' | ')
  }
  // An object in one item and a scalar in another: say both.
  const describe = (s) => (Array.isArray(s) ? 'array' : s && typeof s === 'object' ? 'object' : String(s))
  return [...new Set([...describe(a).split(' | '), ...describe(b).split(' | ')])].join(' | ')
}

/**
 * The shape of a value: every key with its type, lists as one merged item (`[ { sku: 'string' } ]`), so the
 * schema view's paths are `items[0].sku`. Every item of a list is read, so a key that appears only in a later
 * item is still listed.
 */
export function schemaOf(value) {
  const t = typeName(value)
  if (t === 'array') {
    let merged
    for (const item of value) merged = mergeSchemas(merged, schemaOf(item))
    return merged === undefined ? [] : [merged]
  }
  if (t === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = schemaOf(v)
    return out
  }
  return t
}

/** How many rows a value draws (used to switch OutputTree to virtual scrolling). Counts everything. */
export function countRows(value) {
  if (Array.isArray(value)) return value.reduce((n, v) => n + countRows(v), 2)
  if (value && typeof value === 'object') return Object.values(value).reduce((n, v) => n + countRows(v), 2)
  return 1
}

/**
 * Every path a picker offers for a value: each key and each list (as `list` and its merged item `list[0].key`).
 * Built from the schema, so a 1,000-item list offers its shape once, not 1,000 rows; nothing in the data is cut.
 */
export function schemaPaths(value) {
  const out = []
  const walk = (schema, path) => {
    if (Array.isArray(schema)) {
      if (path) out.push({ path, type: 'array' })
      if (schema.length) walk(schema[0], `${path}[0]`)
      return
    }
    if (schema && typeof schema === 'object') {
      if (path) out.push({ path, type: 'object' })
      for (const [k, v] of Object.entries(schema)) {
        if (!isAddressableKey(k)) continue
        walk(v, path ? `${path}.${k}` : k)
      }
      return
    }
    if (path) out.push({ path, type: String(schema) })
  }
  walk(schemaOf(value), '')
  return out
}

// ── The Input pane's sources ────────────────────────────────────────────────────────────────────────

const RUN_STATE_KEYS = ['status', 'output', 'error']

/**
 * Every node's latest state: the live or viewed run (useWorkflowRun().nodeStates) over the last finished run
 * (contract C4, useWorkflowRun().lastRun.nodes). A node the live run has not produced an output for keeps its
 * last-run output, marked `fromLastRun`.
 */
export function mergeNodeStates(lastRunNodes = {}, liveNodes = {}) {
  const out = {}
  for (const [id, s] of Object.entries(lastRunNodes || {})) out[id] = { ...s, fromLastRun: true }
  for (const [id, s] of Object.entries(liveNodes || {})) {
    if (!s) continue
    const prev = out[id]
    const hasOutput = s.output !== null && s.output !== undefined
    out[id] = {
      ...(prev || {}),
      ...Object.fromEntries(RUN_STATE_KEYS.filter((k) => k in s).map((k) => [k, s[k]])),
      ...(hasOutput || !prev ? { output: s.output ?? null, fromLastRun: false } : {}),
      attempt: s.attempt ?? prev?.attempt ?? null,
    }
  }
  return out
}

const TRIGGER_TYPES = (type) => String(type || '').startsWith('trigger.')

function manualInputs(nodes) {
  const manual = nodes.find((n) => n.type === 'trigger.manual')
  return (Array.isArray(manual?.data?.inputs) ? manual.data.inputs : []).filter((i) => i && i.key)
}

/** The workflow's variables as the Input pane shows them: a secret's value is never shown. */
export function varsValue(vars, nodes) {
  const out = {}
  for (const [k, decl] of Object.entries(vars || {})) {
    if (decl && typeof decl === 'object' && decl.secret === true) out[k] = '(secret)'
    else if (decl && typeof decl === 'object') out[k] = decl.default ?? decl.value ?? ''
    else out[k] = decl ?? ''
  }
  for (const input of manualInputs(nodes)) if (!(input.key in out)) out[input.key] = input.default ?? ''
  return out
}

/** The names of the workflow's SECRET variables (for the channel trigger's secret picker). */
export function secretVarNames(vars) {
  return Object.entries(vars || {})
    .filter(([, decl]) => decl && typeof decl === 'object' && decl.secret === true)
    .map(([k]) => k)
}

function designSample(node) {
  if (node.type === 'agent.run' && Array.isArray(node.data?.output_schema) && node.data.output_schema.length) {
    const sample = { text: '(text)', agent: '(agent name)' }
    for (const f of node.data.output_schema) if (f?.name) sample[f.name] = `(${f.type || 'string'})`
    return sample
  }
  return wfOutputSample(node.type)
}

/**
 * What the Input pane lists for `nodeId`, in this order: the trigger, the workflow's variables, each ANCESTOR node
 * (the engine accepts nothing else, compile.py "no forward references"), and `item` for a for-each node's inner
 * step. Each source: { id, label, base, value, real, nodeId?, type?, status? }. `real` is false when the value is a
 * design-time sample (the node has not run yet).
 */
export function buildSources({ nodeId, nodes = [], edges = [], vars = {}, states = {} }) {
  const out = []
  const self = nodes.find((n) => n.id === nodeId)
  const upstream = nodeId ? ancestorIds(nodeId, edges) : new Set()
  const ancestors = nodes.filter((n) => upstream.has(n.id))

  // The trigger payload: the output a trigger node produced in the run ({ text, trigger }).
  const triggerNodes = ancestors.filter((n) => TRIGGER_TYPES(n.type))
  const fired = triggerNodes.map((n) => states[n.id]).find((s) => s?.output && typeof s.output === 'object' && 'trigger' in s.output)
  const inputs = manualInputs(nodes)
  if (fired) {
    out.push({ id: 'trigger', label: 'Trigger', base: 'trigger', value: fired.output.trigger, real: true })
  } else if (triggerNodes.length || TRIGGER_TYPES(self?.type)) {
    const sample = {}
    for (const i of inputs) sample[i.key] = i.default ?? ''
    out.push({ id: 'trigger', label: 'Trigger', base: 'trigger', value: sample, real: false })
  }

  const v = varsValue(vars, nodes)
  if (Object.keys(v).length) out.push({ id: 'vars', label: 'Variables', base: 'vars', value: v, real: true })

  for (const n of ancestors) {
    if (TRIGGER_TYPES(n.type)) continue
    const s = states[n.id]
    const hasOutput = s && s.output !== null && s.output !== undefined
    out.push({
      id: `node:${n.id}`, nodeId: n.id, type: n.type, status: s?.status || null,
      label: n.data?.label || wfDef(n.type)?.label || n.type,
      base: `nodes.${n.id}.output`,
      value: hasOutput ? s.output : designSample(n),
      real: !!hasOutput,
      fromLastRun: !!s?.fromLastRun,
    })
  }

  if (self?.type === 'logic.foreach') {
    out.push({ id: 'item', label: 'Current item', base: 'item', value: '(each item of the list)', real: false })
  }
  return out
}

/** The picker's entries for `sources`: one per path, grouped by source. */
export function pickerItems(sources) {
  const items = []
  for (const src of sources) {
    items.push({ id: `{{${src.base}}}`, label: `{{${src.base}}}`, group: src.id, description: src.label })
    for (const p of schemaPaths(src.value)) {
      const expr = tokenFor(src.base, p.path)
      items.push({ id: expr, label: expr, group: src.id, description: p.type, keywords: [src.label, p.path] })
    }
  }
  return items
}

/**
 * Whether a token reads a value in the last run. `found` true: the path resolves; false: it is well formed but the
 * last run has no value there (or nothing has run).
 */
export function tokenResolves(token, { states = {}, sources = [] } = {}) {
  if (token.root === 'nodes' || token.root === 'node') {
    const s = states[token.nodeId]
    if (!s) return false
    if (token.root === 'node') return resolvePath(s.output, token.path ? `${token.field}.${token.path}` : token.field || 'text') != null
    if (token.field === 'status') return !!s.status
    if (token.field === 'error') return s.error != null
    if (!token.field) return s.output != null
    if (token.field === 'output') return resolvePath(s.output, token.path) != null
    return resolvePath(s.output, token.path ? `${token.field}.${token.path}` : token.field) != null
  }
  const src = sources.find((x) => x.base === token.root)
  if (!src || !src.real) return false
  return resolvePath(src.value, token.path) != null
}

/** The direct parents of a node (the "Run upstream" targets), in document order. */
export function parentIds(nodeId, nodes, edges) {
  const set = new Set((edges || []).filter((e) => e.target === nodeId).map((e) => e.source))
  return (nodes || []).filter((n) => set.has(n.id)).map((n) => n.id)
}

// ── Number settings (F5) ────────────────────────────────────────────────────────────────────────────

/** null when `raw` is a valid entry for a number setting, else the reason, said for the person. */
export function numberProblem(raw, { min, max, minExclusive, integer, optional, label }) {
  if (raw === '' || raw === null) return optional ? null : `${label} needs a number.`
  const n = Number(raw)
  if (!Number.isFinite(n)) return `${label} must be a number.`
  if (integer && !Number.isInteger(n)) return `${label} must be a whole number.`
  if (min !== null && min !== undefined && (minExclusive ? n <= min : n < min)) {
    return minExclusive ? `${label} must be more than ${min}.` : `${label} must be ${min} or more.`
  }
  if (max !== null && max !== undefined && n > max) return `${label} must be ${max} or less.`
  return null
}

