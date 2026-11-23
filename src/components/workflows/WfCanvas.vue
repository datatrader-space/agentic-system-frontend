<!--
  The workflow canvas (plan §3.1, §3.2, D1). Vue Flow only DRAWS the document: nodes and edges are copied from
  useWorkflowDoc on every change and every edit goes back through useWorkflowHistory, so nothing is changed in place
  and every change can be undone (D1 rules 1 and 6). Run state comes only from useWorkflowRun.

  Large graphs render only what is visible (F18). Connections are strict (source to target, D1 rule 3) and carry ids of
  our own (D1 rule 4). The agent's proposed steps are drawn as "ghosts" next to the document's own: not draggable,
  not editable, each with Accept and Reject.
-->
<template>
  <div ref="wrap" class="wfb-canvas" @focusin="onFocusIn">
    <VueFlow
      :id="flowId"
      class="wfb-flow"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      connection-mode="strict"
      :snap-to-grid="true"
      :snap-grid="[GRID, GRID]"
      :only-render-visible-elements="true"
      :delete-key-code="null"
      :disable-keyboard-a11y="true"
      :zoom-on-double-click="false"
      :min-zoom="0.2"
      :max-zoom="2"
      :nodes-focusable="true"
      :edges-focusable="true"
      :edges-updatable="false"
      :is-valid-connection="isValidConnection"
      @connect="onConnect"
      @connect-start="onConnectStart"
      @connect-end="onConnectEnd"
      @node-drag-start="onDragStart"
      @node-drag-stop="onDragStop"
      @node-double-click="onNodeDoubleClick"
      @move-start="showMinimap"
      @move="showMinimap"
      @move-end="onMoveEnd"
      @nodes-initialized="onNodesInitialized"
    >
      <Background variant="dots" :gap="GRID" :size="1.4" />
      <MiniMap
        class="wfb-minimap"
        :class="{ 'is-visible': minimapVisible }"
        position="bottom-left"
        :pannable="true"
        :zoomable="true"
        :node-class-name="minimapClass"
        :node-border-radius="4"
        aria-label="Workflow overview map"
        @mouseenter="holdMinimap(true)"
        @mouseleave="holdMinimap(false)"
      />
    </VueFlow>
    <p :id="helpId" class="wf-sr">Press Enter to open a step, Delete to remove the selection, and the arrow keys to go to the neighbouring step.</p>
  </div>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, provide, ref, unref, useId, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import WfNode from './WfNode.vue'
import WfEdge from './WfEdge.vue'
import { WF_CANVAS } from './wfCanvasContext'
import { GRID, tidyOps } from './wfLayout'
import { nodeTitle } from './wfNodeData'
import { WF_TYPES, wfCategory } from '@/config/wfNodeDefinitions'
import { nodeStatusState, nodeAriaLabel } from '@/utils/wfNodeView'
import { ancestorIds, newEdgeId } from '@/utils/wfVarExpr'
import * as wf from '@/utils/wfFlow'
import { notify } from '@/composables/useNotify'

const props = defineProps({
  doc: { type: Object, required: true },
  history: { type: Object, required: true },
  run: { type: Object, required: true },
  proposal: { type: Object, default: null },
  // While the page is loading or failed to load, nothing on the canvas may be edited.
  readOnly: { type: Boolean, default: false },
  // False for a viewer (ADM-1339): no "Test up to here" on a step. The server refuses a viewer's run anyway.
  canRun: { type: Boolean, default: true },
})
const emit = defineEmits(['open', 'pick', 'test-until', 'rename', 'duplicate', 'remove', 'announce'])

const uid = useId()
const flowId = `wfb-${uid}`
const helpId = `wfb-node-help-${uid}`
const flow = useVueFlow(flowId)
const wrap = ref(null)

const nodeTypes = Object.fromEntries(WF_TYPES.map((t) => [t, markRaw(WfNode)]))
const edgeTypes = { wf: markRaw(WfEdge) }

// ── what is drawn ──
const docNodes = computed(() => props.doc.nodes.value)
const docEdges = computed(() => props.doc.edges.value)
const ghostNodes = computed(() => unref(props.proposal?.ghostNodes) || [])
const ghostEdges = computed(() => unref(props.proposal?.ghostEdges) || [])
const nodeMarks = computed(() => unref(props.proposal?.nodeMarks) || {})
const edgeMarks = computed(() => unref(props.proposal?.edgeMarks) || {})
// The pending change about each node or edge: `hunks[i].target` names it (useWorkflowProposal). A connection that
// goes away with a removed step has a mark but no change of its own: it is accepted with the step.
const hunkById = computed(() => {
  const out = {}
  for (const h of unref(props.proposal?.hunks) || []) {
    if (h?.state === 'pending' && h.target?.id != null && out[h.target.id] == null) out[h.target.id] = h.index
  }
  return out
})
const ghostNodeIds = computed(() => new Set(ghostNodes.value.map((n) => n.id)))
const ghostEdgeIds = computed(() => new Set(ghostEdges.value.map((e) => e.id)))
const states = computed(() => props.run.nodeStates.value || {})

const nodeViews = computed(() => {
  const issues = props.doc.issues.value || {}
  const connected = {}
  for (const e of docEdges.value) (connected[e.source] ||= new Set()).add(e.sourceHandle || '')
  const running = !!props.run.running.value
  const out = {}
  const all = [...docNodes.value.map((n) => [n, false]), ...ghostNodes.value.map((n) => [n, true])]
  for (const [n, ghost] of all) {
    const s = ghost ? null : states.value[n.id]
    out[n.id] = {
      state: nodeStatusState(n.type, n.data, { status: s?.status || null, invalid: !ghost && !!issues[n.id] }),
      issue: ghost ? '' : (issues[n.id] || ''),
      error: s?.error || '',
      mark: nodeMarks.value[n.id] || (ghost ? 'add' : null),
      hunk: hunkById.value[n.id] ?? null,
      ghost,
      readOnly: props.readOnly,
      canRun: props.canRun,
      running,
      connected: connected[n.id] || new Set(),
    }
  }
  return out
})
const EMPTY_VIEW = { state: 'configured', issue: '', error: '', mark: null, hunk: null, ghost: false, readOnly: true, running: false, connected: new Set() }

function itemsOf(output) {
  if (Array.isArray(output)) return output.length
  if (Array.isArray(output?.items)) return output.items.length
  if (Array.isArray(output?.result)) return output.result.length
  return null
}
const edgeViews = computed(() => {
  const out = {}
  for (const e of [...docEdges.value, ...ghostEdges.value]) {
    const ghost = ghostEdgeIds.value.has(e.id)
    const src = states.value[e.source]
    const ran = !ghost && src?.status === 'succeeded' && !!states.value[e.target]?.status
    out[e.id] = {
      ghost, readOnly: props.readOnly, ran, from: titleOf(e.source), to: titleOf(e.target),
      items: ran ? itemsOf(src.output) : null,
      mark: edgeMarks.value[e.id] || (ghost ? 'add' : null),
      hunk: hunkById.value[e.id] ?? null,
    }
  }
  return out
})

const titleOf = (id) => {
  const n = docNodes.value.find((x) => x.id === id) || ghostNodes.value.find((x) => x.id === id)
  return n ? nodeTitle(n.type, n.data) : id
}

const flowNodes = computed(() => [
  ...docNodes.value.map((n) => ({
    id: n.id, type: n.type, position: { ...n.position }, data: n.data,
    draggable: !props.readOnly, connectable: !props.readOnly,
    ariaLabel: nodeAriaLabel(n.type, n.data, nodeViews.value[n.id].state),
    domAttributes: { 'aria-describedby': helpId },
  })),
  ...ghostNodes.value.map((n) => ({
    id: n.id, type: n.type, position: { ...n.position }, data: n.data,
    draggable: false, selectable: false, connectable: false, focusable: false, class: 'is-ghost-node',
    ariaLabel: `Proposed ${nodeAriaLabel(n.type, n.data, 'configured')}`,
  })),
])
const flowEdges = computed(() => [
  ...docEdges.value.map((e) => ({
    id: e.id, source: e.source, target: e.target, type: 'wf',
    sourceHandle: e.sourceHandle || null, targetHandle: e.targetHandle || null, label: e.label || '',
    ariaLabel: `Connection from ${titleOf(e.source)}${e.sourceHandle ? ` (${e.sourceHandle})` : ''} to ${titleOf(e.target)}`,
  })),
  ...ghostEdges.value.map((e) => ({
    id: e.id, source: e.source, target: e.target, type: 'wf',
    sourceHandle: e.sourceHandle || null, targetHandle: e.targetHandle || null, label: e.label || '',
    selectable: false, focusable: false, ariaLabel: `Proposed connection from ${titleOf(e.source)} to ${titleOf(e.target)}`,
  })),
])
// Nodes first, then edges, in one pass: an edge set before its nodes is refused by Vue Flow.
watch([flowNodes, flowEdges], ([nodes, edges], old) => {
  if (!old || nodes !== old[0]) wf.setNodes(flow, nodes)
  if (!old || edges !== old[1]) wf.setEdges(flow, edges)
}, { immediate: true })

// ── the context the cards read ──
provide(WF_CANVAS, {
  nodeView: (id) => nodeViews.value[id] || EMPTY_VIEW,
  edgeView: (id) => edgeViews.value[id] || { ghost: false, readOnly: true, ran: false, items: null, mark: null, hunk: null },
  singleSelected: (id) => {
    const sel = flow.getSelectedNodes.value
    return sel.length === 1 && sel[0].id === id
  },
  open: (id) => emit('open', id),
  pick: (ctx) => { if (!props.readOnly) emit('pick', ctx) },
  testUntil: (id) => { if (props.canRun) emit('test-until', id) },
  rename: (id) => emit('rename', id),
  duplicate: (id) => emit('duplicate', id),
  remove: (target) => { if (!props.readOnly) emit('remove', target) },
  accept: (i) => props.proposal?.accept(i),
  reject: (i) => props.proposal?.reject(i),
})

// ── connecting ──
// Vue Flow asks this for a connection being drawn AND for every edge it is given (setEdges). An edge it is given is
// already in the document (or proposed) and is drawn as it is; only a new connection is judged.
function isValidConnection(c) {
  if (c.id && (docEdges.value.some((e) => e.id === c.id) || ghostEdgeIds.value.has(c.id))) return true
  if (props.readOnly || !c.source || !c.target || c.source === c.target) return false
  if (ghostNodeIds.value.has(c.source) || ghostNodeIds.value.has(c.target)) return false
  const handle = c.sourceHandle || null
  if (docEdges.value.some((e) => e.source === c.source && e.target === c.target && (e.sourceHandle || null) === handle)) return false
  // No loops: the engine runs a graph without cycles, so a connection back to an ancestor is refused here.
  return !ancestorIds(c.source, docEdges.value).has(c.target)
}

let connecting = null
function onConnectStart({ nodeId, handleId, handleType }) { connecting = { nodeId, handleId: handleId || null, handleType, made: false } }
function onConnect(c) {
  if (connecting) connecting.made = true
  if (!isValidConnection(c)) return
  const edge = { id: newEdgeId(c.source, c.target, docEdges.value.map((e) => e.id), c.sourceHandle || null), source: c.source, target: c.target }
  if (c.sourceHandle) edge.sourceHandle = c.sourceHandle
  if (c.targetHandle) edge.targetHandle = c.targetHandle
  try {
    props.history.run('Connect', [{ op: 'add_edge', edge }])
    emit('announce', `Connected ${titleOf(c.source)} to ${titleOf(c.target)}.`)
  } catch (e) {
    notify.error(e.message)
  }
}
// A connection dropped on the empty canvas opens the picker there and connects the new step (plan §3.1).
function onConnectEnd(event) {
  const start = connecting
  connecting = null
  if (!start || start.made || props.readOnly || !event) return
  const target = event.target instanceof Element ? event.target : null
  if (!target || !target.closest('.vue-flow__pane') || target.closest('.vue-flow__node, .vue-flow__handle')) return
  const pt = event.changedTouches?.[0] || event
  const p = wf.toFlowPosition(flow, { x: pt.clientX, y: pt.clientY })
  if (start.handleType === 'source') {
    emit('pick', { mode: 'from', source: { nodeId: start.nodeId, handle: start.handleId }, position: { x: p.x, y: p.y - 32 } })
  } else {
    emit('pick', { mode: 'into', target: { nodeId: start.nodeId, handle: start.handleId }, position: { x: p.x - 200, y: p.y - 32 } })
  }
}

// ── moving: one undo step per drag ──
function onDragStart() { props.history.begin('Move') }
function onDragStop({ nodes }) {
  try {
    const ops = []
    for (const n of nodes || []) {
      const was = docNodes.value.find((x) => x.id === n.id)
      if (!was) continue
      const position = { x: Math.round(n.position.x), y: Math.round(n.position.y) }
      if (was.position.x !== position.x || was.position.y !== position.y) ops.push({ op: 'move_node', id: n.id, position })
    }
    if (ops.length) {
      props.history.run('Move', ops)
      emit('announce', ops.length === 1 ? `Moved ${titleOf(ops[0].id)}.` : `Moved ${ops.length} steps.`)
    }
  } finally {
    props.history.end()
  }
}
function onNodeDoubleClick({ node }) { if (!ghostNodeIds.value.has(node.id)) emit('open', node.id) }

// ── viewport and minimap ──
const minimapVisible = ref(false)
let minimapTimer = null
let minimapHeld = false
// Shown while the canvas moves; it fades 1 s after the last movement (every move event restarts the second).
function showMinimap() {
  minimapVisible.value = true
  hideMinimapSoon()
}
function hideMinimapSoon() {
  clearTimeout(minimapTimer)
  minimapTimer = setTimeout(() => { if (!minimapHeld) minimapVisible.value = false }, 1000)
}
function holdMinimap(on) {
  minimapHeld = on
  if (on) showMinimap()
  else hideMinimapSoon()
}
function onMoveEnd() {
  props.doc.setViewport(wf.viewport(flow))
  hideMinimapSoon()
}
onBeforeUnmount(() => clearTimeout(minimapTimer))
const minimapClass = (node) => `wf-mm wf-mm--${wfCategory(node.type)}`

// The first view of a loaded workflow: its saved viewport on a wide screen, else the whole graph in view.
let initialViewPending = true
const stopResetWatch = props.doc.onReset(() => { initialViewPending = true })
onBeforeUnmount(stopResetWatch)
function onNodesInitialized() {
  if (!initialViewPending) return
  initialViewPending = false
  const saved = props.doc.viewport.value
  if (saved && window.innerWidth >= 1000) wf.setViewport(flow, saved)
  else wf.fitView(flow)
}

// ── focus, selection, announcements ──
const nodeEl = (id) => wrap.value?.querySelector(`.vue-flow__node[data-id="${CSS.escape(id)}"]`)
function onFocusIn(event) {
  const el = event.target instanceof Element ? event.target.closest('.vue-flow__node') : null
  if (el?.dataset.id) emit('announce', el.getAttribute('aria-label') || '')
}
watch(() => flow.getSelectedNodes.value.map((n) => n.id).join(','), (ids) => {
  if (!ids) return
  const list = ids.split(',')
  emit('announce', list.length === 1 ? `Selected ${titleOf(list[0])}.` : `${list.length} steps selected.`)
})

/** The id of the node or edge the focus is on, from a DOM element. */
function focusedItem(el) {
  if (!(el instanceof Element) || !wrap.value?.contains(el)) return null
  const node = el.closest('.vue-flow__node')
  if (node?.dataset.id) return { kind: 'node', id: node.dataset.id }
  const edge = el.closest('.vue-flow__edge')
  if (edge?.dataset.id) return { kind: 'edge', id: edge.dataset.id }
  return { kind: 'pane', id: null }
}

async function focusNode(id) {
  const n = wf.allNodes(flow).find((x) => x.id === id)
  if (!n) return false
  if (!nodeEl(id)) {
    await wf.centerOn(flow, n)
    await nextTick()
  }
  const el = nodeEl(id)
  if (!el) return false
  el.focus()
  return true
}

function tidy() {
  const ops = tidyOps(docNodes.value, docEdges.value, (n) => wf.nodeSize(wf.findNode(flow, n.id)))
  if (!ops.length) return 0
  props.history.run('Tidy up', ops)
  nextTick(() => wf.fitView(flow))
  return ops.length
}

defineExpose({
  flow,
  fit: () => wf.fitView(flow),
  zoomIn: () => wf.zoomIn(flow),
  zoomOut: () => wf.zoomOut(flow),
  resetZoom: () => wf.resetZoom(flow),
  tidy,
  selectAll: () => wf.selectAll(flow),
  clearSelection: () => wf.clearSelection(flow),
  select: (ids) => wf.selectNodes(flow, ids),
  // The document's own selected ids (never a proposed ghost).
  selectedIds: () => {
    const { nodeIds, edgeIds } = wf.selectedIds(flow)
    return { nodeIds: nodeIds.filter((id) => !ghostNodeIds.value.has(id)), edgeIds: edgeIds.filter((id) => !ghostEdgeIds.value.has(id)) }
  },
  visibleCenter: () => wf.visibleCenter(flow),
  sizeOf: (id) => wf.nodeSize(wf.findNode(flow, id)),
  focusNode,
  focusedItem,
  contains: (el) => !!wrap.value && wrap.value.contains(el),
})
</script>
