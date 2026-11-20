// The ONE adapter over the Vue Flow APIs that @xyflow/vue 2.x renames or reshapes (ADM-1333, plan D1 rule 2).
//
// Builder code never calls these Vue Flow members directly; it calls the functions here with the `useVueFlow()`
// instance. The move to 2.x (ADM-1336) then changes this file, not the canvas:
//   node size           1.x `node.dimensions`          → 2.x `node.measured`
//   screen → flow       1.x `screenToFlowCoordinate`    → 2.x `screenToFlowPosition`
//   node lookup         1.x `findNode`                  → 2.x `getNode`
//   delete              1.x removeNodes/removeEdges     → 2.x `deleteElements` + `onBeforeDelete`
// Only this file, WfCanvas and WfNode (for <Handle> and <NodeToolbar>) import `@vue-flow/*`; WfEdge takes its drawing
// helpers from the re-exports below.
//
// Deleting (D1 rule 7): every delete goes through `deleteSelection`, which asks the person, includes every edge
// connected to a deleted node, and hands the change to the document's history as operations, so it can be undone.
import { confirm as askConfirm } from '@/composables/useConfirm'

/** A screen point (clientX/clientY) as a position on the canvas. */
export function toFlowPosition(flow, point) {
  return flow.screenToFlowCoordinate({ x: point.x, y: point.y })
}

/** The canvas position at the centre of the visible canvas. Throws while the canvas is not mounted. */
export function visibleCenter(flow) {
  const el = flow.vueFlowRef.value
  if (!el) throw new Error('The canvas is not on screen yet.')
  const r = el.getBoundingClientRect()
  return toFlowPosition(flow, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
}

/** A node's measured size, or null before Vue Flow has measured it. */
export function nodeSize(node) {
  const d = node?.dimensions
  return d && d.width > 0 && d.height > 0 ? { width: d.width, height: d.height } : null
}

/** The live node with this id, or undefined. */
export function findNode(flow, id) {
  return flow.findNode(id)
}

/** Fit the graph in view: padded, never zoomed in past 100 %. */
export function fitView(flow, options = {}) {
  return flow.fitView({ padding: 0.2, maxZoom: 1, ...options })
}

// Immutable updates (D1 rule 1): a node is never changed in place.
export function updateNodeData(flow, id, patch) { flow.updateNodeData(id, patch) }
export function replaceNodeData(flow, id, data) { flow.updateNodeData(id, data, { replace: true }) }
export function updateNode(flow, id, patch) { flow.updateNode(id, patch) }
export function setNodes(flow, nodes) { flow.setNodes(nodes) }
export function setEdges(flow, edges) { flow.setEdges(edges) }

// Selection. 2.x keeps these names; they are wrapped so the canvas never reaches past this file.
// `flow.nodes` is every node: `getNodes` holds only the ones on screen while only-visible rendering is on (F18).
export function allNodes(flow) { return flow.nodes.value }
export function selectNodes(flow, ids) {
  const set = new Set(ids)
  flow.removeSelectedElements()
  flow.addSelectedNodes(allNodes(flow).filter((n) => set.has(n.id)))
}
export function selectAll(flow) { flow.addSelectedNodes(allNodes(flow).filter((n) => n.selectable !== false)) }
export function clearSelection(flow) { flow.removeSelectedElements() }

// Viewport.
export function zoomIn(flow) { return flow.zoomIn({ duration: 150 }) }
export function zoomOut(flow) { return flow.zoomOut({ duration: 150 }) }
export function resetZoom(flow) { return flow.zoomTo(1, { duration: 150 }) }
export function viewport(flow) { const v = flow.viewport.value; return { x: v.x, y: v.y, zoom: v.zoom } }
export function setViewport(flow, v) { return flow.setViewport({ x: v.x, y: v.y, zoom: v.zoom }) }
/** Bring a node into the middle of the view, keeping the zoom. */
export function centerOn(flow, node) {
  const s = nodeSize(node) || { width: 200, height: 64 }
  return flow.setCenter(node.position.x + s.width / 2, node.position.y + s.height / 2, { zoom: flow.viewport.value.zoom, duration: 150 })
}

// Edge drawing for WfEdge (2.x keeps these exports; they are re-exported here so WfEdge does not import @vue-flow).
export { BaseEdge, EdgeLabelRenderer, getBezierPath, Position } from '@vue-flow/core'

/** The ids of the selected nodes and edges. */
export function selectedIds(flow) {
  return {
    nodeIds: flow.getSelectedNodes.value.map((n) => n.id),
    edgeIds: flow.getSelectedEdges.value.map((e) => e.id),
  }
}

/**
 * What deleting `target` removes: the nodes, the edges asked for, and every edge connected to one of the nodes.
 * `edgeIds` are the edges asked for directly (not connected to a deleted node); `connectedEdgeIds` go with a node.
 */
export function deletionSet(edges, { nodeIds = [], edgeIds = [] } = {}) {
  const nodes = new Set(nodeIds)
  const connected = edges.filter((e) => nodes.has(e.source) || nodes.has(e.target)).map((e) => e.id)
  const connectedSet = new Set(connected)
  return {
    nodeIds: [...nodes],
    edgeIds: [...new Set(edgeIds)].filter((id) => !connectedSet.has(id)),
    connectedEdgeIds: connected,
  }
}

function deleteQuestion({ nodeIds, edgeIds, connectedEdgeIds }) {
  const n = nodeIds.length
  const e = edgeIds.length + connectedEdgeIds.length
  const parts = []
  if (n) parts.push(n === 1 ? '1 step' : `${n} steps`)
  if (e) parts.push(e === 1 ? '1 connection' : `${e} connections`)
  return {
    title: `Delete ${parts.join(' and ')}?`,
    message: 'You can undo this with Ctrl+Z until you leave the page.',
    confirmText: 'Delete',
    danger: true,
  }
}

/**
 * Delete the selection (or `target`) after asking. `apply(ops)` receives the document operations
 * (`remove_edge` for each edge asked for, then `remove_node`, which takes the node's connected edges with it) and
 * must run them through the history, e.g. `(ops) => history.run('Delete', ops)`.
 * Returns the deletion set, or null when there was nothing to delete or the person said no.
 */
// `edges` are the document's connections (the canvas also draws proposed ones that are not in the document yet).
export async function deleteSelection(flow, { apply, target = selectedIds(flow), confirm = askConfirm, edges = flow.getEdges.value } = {}) {
  if (typeof apply !== 'function') throw new Error('deleteSelection needs apply(ops) to record the change.')
  const set = deletionSet(edges, target)
  if (!set.nodeIds.length && !set.edgeIds.length) return null
  if (!(await confirm(deleteQuestion(set)))) return null
  apply([
    ...set.edgeIds.map((id) => ({ op: 'remove_edge', id })),
    ...set.nodeIds.map((id) => ({ op: 'remove_node', id })),
  ])
  return set
}
