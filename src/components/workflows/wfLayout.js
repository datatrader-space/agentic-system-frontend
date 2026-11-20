// "Tidy up" (plan §3.1): lay the workflow out left to right with dagre, on the canvas's 16 px grid.
// Pure: it returns the move operations for the nodes whose place changes, and the caller runs them through the
// history, so a tidy up is one undoable step.
import dagre from '@dagrejs/dagre'

export const GRID = 16
export const NODE_WIDTH = 200
export const NODE_HEIGHT = 64

const snap = (v) => Math.round(v / GRID) * GRID

/** A connection whose target sits left of its source is drawn as a loop under the source (plan §3.2). */
export function isBackwards(sourceX, targetX) { return targetX < sourceX - 24 }

/** [path, labelX, labelY] of a backwards connection: out to the right, under both cards, in from the left. */
export function loopPath(sx, sy, tx, ty) {
  const drop = Math.max(sy, ty) + 72
  const d = `M ${sx} ${sy} C ${sx + 64} ${sy}, ${sx + 64} ${drop}, ${sx} ${drop} L ${tx} ${drop} C ${tx - 64} ${drop}, ${tx - 64} ${ty}, ${tx} ${ty}`
  return [d, (sx + tx) / 2, drop]
}

/**
 * Move operations that lay `nodes` out left to right. `sizeOf(node)` returns the measured { width, height } or
 * null (then the card's own size is used). Nodes with no connection keep the order they have.
 */
export function tidyOps(nodes, edges, sizeOf = () => null) {
  if (!nodes.length) return []
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 96, marginx: 0, marginy: 0 })
  g.setDefaultEdgeLabel(() => ({}))
  const ids = new Set(nodes.map((n) => n.id))
  for (const n of nodes) {
    const s = sizeOf(n) || { width: NODE_WIDTH, height: NODE_HEIGHT }
    g.setNode(n.id, { width: s.width, height: s.height })
  }
  for (const e of edges) if (ids.has(e.source) && ids.has(e.target)) g.setEdge(e.source, e.target)
  dagre.layout(g)

  // Keep the graph where it was on the canvas: the laid-out box starts at the old top-left corner.
  const minX = Math.min(...nodes.map((n) => n.position.x))
  const minY = Math.min(...nodes.map((n) => n.position.y))
  const laid = nodes.map((n) => {
    const p = g.node(n.id)
    return { id: n.id, x: p.x - p.width / 2, y: p.y - p.height / 2 }
  })
  const lx = Math.min(...laid.map((p) => p.x))
  const ly = Math.min(...laid.map((p) => p.y))
  const ops = []
  for (const p of laid) {
    const position = { x: snap(minX + p.x - lx), y: snap(minY + p.y - ly) }
    const old = nodes.find((n) => n.id === p.id).position
    if (old.x !== position.x || old.y !== position.y) ops.push({ op: 'move_node', id: p.id, position })
  }
  return ops
}
