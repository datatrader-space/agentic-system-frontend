// Workflow Builder: pure helpers for workflow template tokens, the engine's own `{{ … }}` syntax (plan D3):
// nodes.<id>.output.<path>, trigger.<path>, vars.<path>, item, with nested keys and [index].

// Splice `insert` into `text` replacing [start,end) (caret-aware insert; appends when caret unknown).
export function insertAt(text, start, end, insert) {
  const s = (typeof text === 'string' ? text : '')
  const a = start == null ? s.length : start
  const b = end == null ? a : end
  return s.slice(0, a) + insert + s.slice(b)
}

// The same into a field that holds a LIST of references separated by `sep` (a "Model call" step's Images,
// ADM-1351 phase 3): the separator is added before the token when something stands before it, and after it when
// something follows, so a second reference never runs into the first. Returns { text, caret } (caret after the token).
export function insertListItem(text, start, end, token, sep = ', ') {
  const s = (typeof text === 'string' ? text : '')
  const a = start == null ? s.length : start
  const b = end == null ? a : end
  const mark = sep.trim()
  let before = s.slice(0, a)
  let after = s.slice(b)
  if (before.trim() && !before.trimEnd().endsWith(mark)) before = `${before.trimEnd()}${sep}`
  if (after.trim() && !after.trimStart().startsWith(mark)) after = `${sep}${after.trimStart()}`
  return { text: before + token + after, caret: before.length + token.length }
}

// ── Template tokens (plan D3: one syntax, the engine's) ─────────────────────────────────────────────
//
// The same pattern as the engine's `_TPL` (agent/services/workflow_graph/executor.py) and the same roots as its
// `_resolve_expr`: nodes (and the legacy `node`), trigger, vars, inputs, item and run. A root the engine does not
// know is left as literal braces at run time, so the builder marks it instead of letting it pass silently.
const TEMPLATE_RE = /\{\{\s*([^}]+?)\s*\}\}/g
export const TEMPLATE_ROOTS = ['nodes', 'node', 'trigger', 'vars', 'inputs', 'item', 'run']

// Every `{{…}}` in `text`: [{ start, end, raw, expr, root, nodeId, field, path }].
//   {{nodes.fetch.output.items[0]}} → root 'nodes', nodeId 'fetch', field 'output', path 'items[0]'
//   {{nodes.fetch.status}}          → field 'status', path ''
//   {{trigger.body.email}}          → root 'trigger', nodeId null, field null, path 'body.email'
export function parseTemplateTokens(text) {
  const out = []
  if (typeof text !== 'string' || !text) return out
  for (const m of text.matchAll(TEMPLATE_RE)) {
    const expr = m[1]
    const dot = expr.indexOf('.')
    const root = dot === -1 ? expr : expr.slice(0, dot)
    const rest = dot === -1 ? '' : expr.slice(dot + 1)
    const token = { start: m.index, end: m.index + m[0].length, raw: m[0], expr, root, nodeId: null, field: null, path: rest }
    if (root === 'nodes' || root === 'node') {
      const d2 = rest.indexOf('.')
      token.nodeId = (d2 === -1 ? rest : rest.slice(0, d2)) || null
      const tail = d2 === -1 ? '' : rest.slice(d2 + 1)
      const d3 = tail.indexOf('.')
      token.field = (d3 === -1 ? tail : tail.slice(0, d3)) || null
      token.path = d3 === -1 ? '' : tail.slice(d3 + 1)
    }
    out.push(token)
  }
  return out
}

// The ids of every node upstream of `nodeId` (its ancestors over `edges`). The engine lets a node read only
// these (compile.py: "No forward references"), so a pill naming any other node is marked.
export function ancestorIds(nodeId, edges) {
  const parents = new Map()
  for (const e of edges || []) {
    if (!parents.has(e.target)) parents.set(e.target, [])
    parents.get(e.target).push(e.source)
  }
  const seen = new Set()
  const stack = [...(parents.get(nodeId) || [])]
  while (stack.length) {
    const id = stack.pop()
    if (seen.has(id) || id === nodeId) continue
    seen.add(id)
    stack.push(...(parents.get(id) || []))
  }
  return seen
}

// Each token of `text` with `problem` (null when it resolves at run time) and a `message` for the person:
//   unknown_root  the root is not one the engine resolves (it would stay as literal braces)
//   missing_node  `{{nodes.}}` without a node id
//   unknown_node  the node id is not in this workflow
//   self          the node reads its own output
//   not_upstream  the node exists but is not an ancestor, so the engine refuses the reference
export function checkTemplateTokens(text, { nodeId = null, nodeIds = [], edges = [] } = {}) {
  const known = new Set(nodeIds)
  const upstream = nodeId ? ancestorIds(nodeId, edges) : null
  return parseTemplateTokens(text).map((t) => {
    let problem = null
    let message = ''
    if (!TEMPLATE_ROOTS.includes(t.root)) {
      problem = 'unknown_root'
      message = `"${t.root}" is not something a workflow can read. Use nodes, trigger, vars, inputs, item or run.`
    } else if (t.root === 'nodes' || t.root === 'node') {
      if (!t.nodeId) { problem = 'missing_node'; message = 'Name the node to read, as nodes.<id>.output.' }
      else if (!known.has(t.nodeId)) { problem = 'unknown_node'; message = `There is no node "${t.nodeId}" in this workflow.` }
      else if (nodeId && t.nodeId === nodeId) { problem = 'self'; message = 'A node cannot read its own output.' }
      else if (upstream && !upstream.has(t.nodeId)) {
        problem = 'not_upstream'
        message = `"${t.nodeId}" does not run before this node. Connect it upstream to use its output.`
      }
    }
    return { ...t, problem, message }
  })
}

// ── Ids (plan D3, F13) ──────────────────────────────────────────────────────────────────────────────
//
// A node id must match the condition grammar's name rule (expr.py `_TOKEN_RE` <name>), or no condition could
// reference it. New ids read like the node's type: `agent_run`, then `agent_run_2`, ...
export const NODE_ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
export function isValidNodeId(id) { return typeof id === 'string' && NODE_ID_RE.test(id) }

function uniqueId(base, taken) {
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`
    if (!taken.has(candidate)) return candidate
  }
}

export function newNodeId(type, existingIds = []) {
  let base = String(type || 'node').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'node'
  if (!/^[A-Za-z_]/.test(base)) base = `n_${base}`
  return uniqueId(base, new Set(existingIds))
}

// Edge ids are always ours (D1 rule 4), never Vue Flow's generated `vueflow__edge-…` (or 2.x's `xy-edge__…`).
export function newEdgeId(source, target, existingIds = [], sourceHandle = null) {
  const base = ['e', source, sourceHandle, target].filter(Boolean).join('_').replace(/[^A-Za-z0-9_]+/g, '_')
  return uniqueId(base, new Set(existingIds))
}
