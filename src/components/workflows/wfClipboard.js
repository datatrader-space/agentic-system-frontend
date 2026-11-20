// Copy, cut, paste and duplicate (plan §3.5): steps travel as JSON on the SYSTEM clipboard, so they can be pasted into
// another workflow or another tab. Pure helpers: the page reads and writes the clipboard and runs the operations
// through the history.
//
// A password field (a bot token) is never written to the clipboard: the pasted step asks for it again.
import { newEdgeId, newNodeId } from '@/utils/wfVarExpr'
import { secretKeys } from './wfNodeData'

export const CLIP_KIND = 'aadml.workflow.steps'
export const CLIP_VERSION = 1

const clone = (v) => JSON.parse(JSON.stringify(v))

/**
 * The steps `ids` and the connections between them, as clipboard JSON text. Null when nothing is selected.
 * `keepSecrets` is for Duplicate, whose text never leaves the page; the system clipboard never gets them.
 */
export function copyText(nodes, edges, ids, { keepSecrets = false } = {}) {
  const set = new Set(ids)
  const picked = nodes.filter((n) => set.has(n.id))
  if (!picked.length) return null
  const out = picked.map((n) => {
    const data = clone(n.data || {})
    if (!keepSecrets) for (const k of secretKeys(n.type)) delete data[k]
    return { id: n.id, type: n.type, position: { ...n.position }, data }
  })
  const inner = edges.filter((e) => set.has(e.source) && set.has(e.target)).map((e) => clone(e))
  return JSON.stringify({ kind: CLIP_KIND, version: CLIP_VERSION, nodes: out, edges: inner })
}

/** Read clipboard text. Throws an Error saying why when it is not copied workflow steps. */
export function parseClip(text) {
  let v
  try { v = JSON.parse(text) } catch { throw new Error('The clipboard does not hold workflow steps.') }
  if (!v || v.kind !== CLIP_KIND || !Array.isArray(v.nodes) || !Array.isArray(v.edges)) {
    throw new Error('The clipboard does not hold workflow steps.')
  }
  if (v.version !== CLIP_VERSION) throw new Error('These steps were copied from a different version of the builder.')
  return v
}

/**
 * Operations that add `clip`'s steps with fresh ids, moved by `offset`, and their internal connections.
 * Returns { ops, nodeIds } (the new ids, for selecting them).
 */
export function pasteOps(clip, { nodeIds = [], edgeIds = [], offset = { x: 32, y: 32 } } = {}) {
  const takenNodes = [...nodeIds]
  const takenEdges = [...edgeIds]
  const idMap = new Map()
  const ops = []
  for (const n of clip.nodes) {
    const id = newNodeId(n.type, takenNodes)
    takenNodes.push(id)
    idMap.set(n.id, id)
    ops.push({ op: 'add_node', node: { id, type: n.type, position: { x: n.position.x + offset.x, y: n.position.y + offset.y }, data: clone(n.data || {}) } })
  }
  for (const e of clip.edges) {
    const source = idMap.get(e.source)
    const target = idMap.get(e.target)
    if (!source || !target) continue
    const id = newEdgeId(source, target, takenEdges, e.sourceHandle || null)
    takenEdges.push(id)
    const edge = { ...clone(e), id, source, target }
    ops.push({ op: 'add_edge', edge })
  }
  return { ops, nodeIds: [...idMap.values()] }
}
