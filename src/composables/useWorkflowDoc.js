// The workflow document the builder edits (ADM-1333, plan §4 and D1 rule 1): load, save with the etag, dirty,
// discard, publish, restore a version, and the unsaved-changes guard. It holds the document; Vue Flow only draws it.
//
//   const doc = useWorkflowDoc(route.params.id, { hydrateNode, serializeNode })
//   await doc.load()
//   doc.applyOps([{ op: 'update_node', id: 'fetch', data: { url: 'https://…' } }])   // through useWorkflowHistory
//   await doc.save()
//
// NODES AND EDGES ARE NEVER CHANGED IN PLACE. Every change is an operation applied by `applyOps`, which replaces
// the changed objects and returns the inverse operations, so useWorkflowHistory can undo it. The operations are the
// agent bar's proposal operations (contract C6) plus the canvas's own:
//   add_node {node, index?}   remove_node {id} (takes its connected edges)   update_node {id, data} (merges;
//   a key set to undefined is removed)   move_node {id, position}   add_edge {edge, index?}   remove_edge {id}
//   update_edge {id, patch}   set_vars {vars}   set_name {name}
// A batch is applied whole or not at all: an operation that names a missing node fails the batch with the reason
// and leaves the document as it was.
//
// SAVING. The server refuses a content save without the etag it last handed out (428) or with a stale one (409),
// so two tabs cannot overwrite each other. A conflict is reported and the returned etag is NOT adopted, or the next
// click would overwrite the edit the person was just warned about. Save, Run and Publish may all ask to save; a
// second request while one is in flight joins it.
import { ref, shallowRef, reactive, computed } from 'vue'
import defaultApi from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { useUnsavedGuard } from '@/composables/useUnsavedGuard'
import { WorkflowInputError } from '@/utils/workflowInput'
import { isValidNodeId } from '@/utils/wfVarExpr'
import { fetchAllAgents } from '@/utils/workflowRunPolling'
import { workflowRole } from '@/utils/workflowAccess'

export const WORKFLOW_LEAVE_QUESTION = {
  title: 'Leave with unsaved changes?',
  message: 'Your workflow changes are not saved. Save them first with Ctrl+S, or leave without saving.',
  confirmText: 'Leave without saving',
  cancelText: 'Stay',
  danger: true,
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))

// A node saved without a canvas place (by the AADML MCP or the API) is dropped by Vue Flow without a word and the
// workflow showed "0 nodes" (ADM-1135); such a node is laid out left to right.
function placed(nodes) {
  return nodes.map((n, i) => (Number.isFinite(n?.position?.x) && Number.isFinite(n?.position?.y)
    ? n : { ...n, position: { x: i * 260, y: 120 } }))
}

// A patch's values are cloned one by one: a whole-patch JSON clone would drop the `undefined` that removes a key.
function patchObject(obj, patch) {
  const out = { ...obj }
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === undefined) delete out[k]
    else out[k] = clone(v)
  }
  return out
}
function previousValues(obj, patch) {
  const prev = {}
  for (const k of Object.keys(patch || {})) prev[k] = Object.prototype.hasOwnProperty.call(obj, k) ? clone(obj[k]) : undefined
  return prev
}

/**
 * Apply `ops` to a { name, nodes, edges, vars } state without touching it. Returns { state, inverse }.
 * Throws an Error naming the problem when an operation cannot apply.
 */
export function applyWorkflowOps(state, ops) {
  let { name, nodes, edges, vars } = state
  const inverse = []
  const nodeIndex = (id) => nodes.findIndex((n) => n.id === id)
  const edgeIndex = (id) => edges.findIndex((e) => e.id === id)
  const needNode = (id) => {
    const i = nodeIndex(id)
    if (i === -1) throw new Error(`There is no step "${id}" in this workflow.`)
    return i
  }
  const needEdge = (id) => {
    const i = edgeIndex(id)
    if (i === -1) throw new Error(`There is no connection "${id}" in this workflow.`)
    return i
  }

  for (const op of ops) {
    switch (op.op) {
      case 'add_node': {
        const node = op.node
        if (!node || !isValidNodeId(node.id)) {
          throw new Error(`"${node?.id}" cannot be a step id: use letters, digits and _, not starting with a digit.`)
        }
        if (nodeIndex(node.id) !== -1) throw new Error(`A step "${node.id}" already exists.`)
        if (!node.type) throw new Error(`Step "${node.id}" has no type.`)
        const fresh = { id: node.id, type: node.type, position: { ...(node.position || { x: 0, y: 0 }) }, data: clone(node.data || {}) }
        const at = Number.isInteger(op.index) ? Math.min(Math.max(op.index, 0), nodes.length) : nodes.length
        nodes = [...nodes.slice(0, at), fresh, ...nodes.slice(at)]
        inverse.unshift({ op: 'remove_node', id: node.id })
        break
      }
      case 'remove_node': {
        const i = needNode(op.id)
        const node = nodes[i]
        const connected = edges.map((e, index) => ({ e, index })).filter(({ e }) => e.source === op.id || e.target === op.id)
        edges = edges.filter((e) => e.source !== op.id && e.target !== op.id)
        nodes = nodes.filter((_, j) => j !== i)
        inverse.unshift(
          { op: 'add_node', node: clone(node), index: i },
          ...connected.map(({ e, index }) => ({ op: 'add_edge', edge: clone(e), index })),
        )
        break
      }
      case 'update_node': {
        const i = needNode(op.id)
        const node = nodes[i]
        inverse.unshift({ op: 'update_node', id: op.id, data: previousValues(node.data || {}, op.data) })
        nodes = nodes.map((n, j) => (j === i ? { ...n, data: patchObject(n.data || {}, op.data) } : n))
        break
      }
      case 'move_node': {
        const i = needNode(op.id)
        inverse.unshift({ op: 'move_node', id: op.id, position: { ...nodes[i].position } })
        nodes = nodes.map((n, j) => (j === i ? { ...n, position: { x: op.position.x, y: op.position.y } } : n))
        break
      }
      case 'add_edge': {
        const edge = op.edge
        if (!edge?.id) throw new Error('A connection needs an id.')
        if (edgeIndex(edge.id) !== -1) throw new Error(`A connection "${edge.id}" already exists.`)
        needNode(edge.source)
        needNode(edge.target)
        const at = Number.isInteger(op.index) ? Math.min(Math.max(op.index, 0), edges.length) : edges.length
        edges = [...edges.slice(0, at), clone(edge), ...edges.slice(at)]
        inverse.unshift({ op: 'remove_edge', id: edge.id })
        break
      }
      case 'remove_edge': {
        const i = needEdge(op.id)
        inverse.unshift({ op: 'add_edge', edge: clone(edges[i]), index: i })
        edges = edges.filter((_, j) => j !== i)
        break
      }
      case 'update_edge': {
        const i = needEdge(op.id)
        if (op.patch && ('id' in op.patch || 'source' in op.patch || 'target' in op.patch)) {
          throw new Error('Reconnect a connection by removing it and adding a new one.')
        }
        inverse.unshift({ op: 'update_edge', id: op.id, patch: previousValues(edges[i], op.patch) })
        edges = edges.map((e, j) => (j === i ? patchObject(e, op.patch) : e))
        break
      }
      case 'set_vars': {
        inverse.unshift({ op: 'set_vars', vars: clone(vars) })
        vars = clone(op.vars || {})
        break
      }
      case 'set_name': {
        const next = String(op.name || '').trim()
        if (!next) throw new Error('A workflow needs a name.')
        inverse.unshift({ op: 'set_name', name })
        name = next
        break
      }
      default:
        throw new Error(`Unknown change "${op?.op}".`)
    }
  }
  return { state: { name, nodes, edges, vars }, inverse }
}

export function useWorkflowDoc(graphId, {
  api = defaultApi,
  hydrateNode = (type, data) => data,      // stored node data → the shape the node window edits
  serializeNode = (type, data) => data,    // edited shape → stored data; throws WorkflowInputError on bad input
} = {}) {
  const loading = ref(false)
  const loadError = ref('')
  const saving = ref(false)
  const conflict = ref('')               // the server's reason when a save was refused as a conflict

  const name = ref('')
  const nodes = shallowRef([])           // [{ id, type, position, data }] in the edited shape
  const edges = shallowRef([])           // [{ id, source, target, sourceHandle?, targetHandle?, label? }]
  const vars = shallowRef({})
  const viewport = shallowRef(null)      // { x, y, zoom } or null: canvas state, saved but never "unsaved"
  let graphRest = {}                     // every other key of the stored graph (input_schema, output_schema, ...)

  // `myRole` and `owner` come from the server (ADM-1339): what the page offers follows the role; the server enforces it.
  const meta = reactive({
    id: null, publicId: null, version: 1, etag: '', status: 'draft', triggers: [], lastRun: null, publishedVersionId: null,
    myRole: 'viewer', owner: null,
  })
  const agents = shallowRef([])
  const agentsError = ref('')
  const allGraphs = shallowRef([])
  const scripts = shallowRef([])

  // Problems found on save or validation, by node id: { nodeId: message }. Shown on the node, never in its data.
  const issues = shallowRef({})

  const signature = () => JSON.stringify({ name: name.value, nodes: nodes.value, edges: edges.value, vars: vars.value })
  const saved = shallowRef(null)         // the edited state as last loaded or saved, for dirty and discard
  const savedSignature = ref('')
  const dirty = computed(() => !!saved.value && signature() !== savedSignature.value)

  const resetListeners = new Set()
  function onReset(fn) { resetListeners.add(fn); return () => resetListeners.delete(fn) }

  function setState(state) {
    name.value = state.name
    nodes.value = state.nodes
    edges.value = state.edges
    vars.value = state.vars
  }

  function markSaved() {
    saved.value = clone({ name: name.value, nodes: nodes.value, edges: edges.value, vars: vars.value })
    savedSignature.value = signature()
  }

  function adoptGraph(graphName, graph) {
    const g = graph || {}
    const { nodes: gNodes = [], edges: gEdges = [], vars: gVars = {}, viewport: gViewport = null, ...rest } = g
    graphRest = rest
    setState({
      name: graphName,
      nodes: placed(gNodes).map((n) => ({ id: n.id, type: n.type, position: { ...n.position }, data: hydrateNode(n.type, clone(n.data || {})) })),
      edges: clone(gEdges),
      vars: clone(gVars || {}),
    })
    viewport.value = Number.isFinite(gViewport?.zoom) ? gViewport : null
    issues.value = {}
    conflict.value = ''
    markSaved()
    for (const fn of resetListeners) fn()
  }

  // Applies whatever the server returned so the next save carries a fresh token.
  function absorb(data) {
    if (!data) return
    if (data.version) meta.version = data.version
    if (data.etag) meta.etag = data.etag
    if (data.status) meta.status = data.status
    if (Array.isArray(data.triggers)) meta.triggers = data.triggers
    if ('published_version_id' in data) meta.publishedVersionId = data.published_version_id
    if ('my_role' in data) meta.myRole = workflowRole(data.my_role)
    if (data.owner) meta.owner = data.owner
  }

  async function load() {
    loading.value = true
    loadError.value = ''
    try {
      const { data } = await api.getWorkflowGraphBundle(graphId)
      const g = data.graph
      meta.id = g.id
      meta.publicId = g.public_id || null
      meta.version = g.version || 1
      meta.etag = g.etag || ''
      meta.status = g.status || 'draft'
      meta.triggers = g.triggers || []
      meta.lastRun = g.last_run || null
      meta.publishedVersionId = g.published_version_id ?? null
      meta.myRole = workflowRole(g.my_role)
      meta.owner = g.owner || null
      allGraphs.value = data.all_graphs?.results || data.all_graphs || []
      scripts.value = data.scripts?.results || data.scripts || []
      agentsError.value = ''
      const ag = data.agents
      agents.value = ag?.results || ag || []
      // The bundle carries the FIRST page of the agent list. Past it the agent picker would miss agents, so the
      // whole list is read; if that fails the picker says so instead of quietly showing a part.
      if (ag && !Array.isArray(ag) && ag.next) {
        try {
          agents.value = await fetchAllAgents(api)
        } catch {
          agentsError.value = 'Only some of your agents could be loaded. Reload the page to see them all.'
        }
      }
      adoptGraph(g.name, g.graph)
      return true
    } catch {
      loadError.value = 'Could not load this workflow. Your saved workflow has not been changed.'
      return false
    } finally {
      loading.value = false
    }
  }

  /** The stored graph for the current state. Throws WorkflowInputError naming the node, and records the issue. */
  function currentGraph() {
    const out = []
    for (const n of nodes.value) {
      try {
        out.push({ id: n.id, type: n.type, position: { ...n.position }, data: serializeNode(n.type, clone(n.data)) })
      } catch (error) {
        const message = error instanceof WorkflowInputError ? error.message : 'Enter valid JSON in this step.'
        issues.value = { ...issues.value, [n.id]: message }
        const err = new WorkflowInputError(message)
        err.nodeId = n.id
        throw err
      }
    }
    return {
      ...clone(graphRest),
      nodes: out,
      edges: edges.value.map((e) => clone(e)),
      vars: clone(vars.value),
      viewport: viewport.value ? { ...viewport.value } : {},
    }
  }

  function reportError(e, fallback) {
    if (e instanceof WorkflowInputError) { notify.error(e.message); return }
    const s = e?.response?.status
    const d = e?.response?.data || {}
    if (s === 409 || s === 428) {
      conflict.value = d.error || 'This workflow changed elsewhere. Reload it before saving.'
      notify.error(conflict.value)
      return
    }
    if (s === 400 && Array.isArray(d.errors) && d.errors.length) {
      const next = {}
      for (const x of d.errors) if (x?.node_id) next[x.node_id] = x.message || String(x)
      issues.value = next
      notify.error(`${d.error || 'The workflow has problems'}: ${d.errors.map((x) => (x.node_id ? `${x.node_id}: ` : '') + (x.message || x)).join('; ')}`)
      return
    }
    notify.error(d.error || fallback)
  }

  let savePromise = null
  async function doSave() {
    saving.value = true
    try {
      const graph = currentGraph()
      const sentName = name.value
      const sent = clone({ name: sentName, nodes: nodes.value, edges: edges.value, vars: vars.value })
      const sentSignature = JSON.stringify(sent)
      const { data } = await api.saveWorkflowGraph(graphId, { name: sentName, graph, etag: meta.etag })
      absorb(data)
      saved.value = sent
      savedSignature.value = sentSignature
      conflict.value = ''
      issues.value = {}
      // What the save found that does not block it (runbook B4, 2026-11-24: an unconnected step's warning was shown
      // nowhere): said with the step it is about, so the person sees it without pressing Validate.
      const warnings = data?.validation?.warnings || []
      if (warnings.length) {
        notify.warning(`Workflow saved, with ${warnings.length === 1 ? 'a warning' : `${warnings.length} warnings`}: `
          + warnings.map((w) => (w?.node_id ? `${w.node_id}: ` : '') + (w?.message || w)).join('; '))
      } else {
        notify.success('Workflow saved')
      }
      return true
    } catch (e) {
      reportError(e, 'The workflow could not be saved. Try again.')
      return false
    } finally {
      saving.value = false
    }
  }

  function save() {
    if (loading.value || loadError.value) return Promise.resolve(false)
    if (!savePromise) savePromise = doSave().finally(() => { savePromise = null })
    return savePromise
  }

  /** Save when there are unsaved changes. Resolves true when the server now has the current state. */
  async function saveIfDirty() {
    if (!dirty.value) return true
    if (!(await save())) return false
    return !dirty.value
  }

  // Publishing freezes an immutable version, which is what a triggered run executes. The server validates on
  // publish, so the draft is saved first or it would validate the previously saved version. `note` is added to the
  // "Published" message: what uses the workflow (useWorkflowPublish asks the server before publishing).
  async function publish({ note = '' } = {}) {
    if (!(await saveIfDirty())) return false
    saving.value = true
    try {
      const { data } = await api.saveWorkflowGraph(graphId, { status: 'published' })
      absorb(data)
      if (note) notify.success(`Published (v${meta.version}). ${note}`, { timeout: 9000 })
      else notify.success(`Published (v${meta.version})`)
      return true
    } catch (e) {
      reportError(e, 'The workflow could not be published. Try again.')
      return false
    } finally {
      saving.value = false
    }
  }

  // Pause stops NEW runs starting; runs already in flight are left alone.
  async function setStatus(next) {
    saving.value = true
    try {
      const { data } = await api.saveWorkflowGraph(graphId, { status: next })
      absorb(data)
      return true
    } catch (e) {
      reportError(e, `The workflow could not be set to ${next}.`)
      return false
    } finally {
      saving.value = false
    }
  }

  // Restoring lands on the DRAFT; triggered runs keep executing the published version until it is published.
  async function restoreVersion(versionId) {
    saving.value = true
    try {
      const { data } = await api.restoreWorkflowGraphVersion(graphId, versionId)
      absorb(data)
      adoptGraph(data.name ?? name.value, data.graph)
      return true
    } catch (e) {
      reportError(e, 'The version could not be restored.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function discard() {
    if (!dirty.value || !saved.value) return false
    const ok = await confirm({
      title: 'Discard unsaved changes?', message: 'The workflow goes back to how it was last saved.',
      confirmText: 'Discard', danger: true,
    })
    if (!ok) return false
    setState(clone(saved.value))
    issues.value = {}
    for (const fn of resetListeners) fn()
    return true
  }

  /** Apply operations atomically; returns their inverse. Use useWorkflowHistory.run() so they can be undone. */
  function applyOps(ops) {
    const { state, inverse } = applyWorkflowOps(
      { name: name.value, nodes: nodes.value, edges: edges.value, vars: vars.value }, ops)
    setState(state)
    // A step's problem from the last save no longer describes it once the step is changed or removed (runbook S6,
    // 2026-11-24: a fixed schedule step still showed the error of the save before). The next save says it again if
    // it still holds.
    const touched = (ops || []).filter((o) => o?.op === 'update_node' || o?.op === 'remove_node').map((o) => o.id)
    if (touched.some((id) => id in issues.value)) {
      const next = { ...issues.value }
      for (const id of touched) delete next[id]
      issues.value = next
    }
    return inverse
  }

  function setViewport(v) { viewport.value = v ? { x: v.x, y: v.y, zoom: v.zoom } : null }
  function setIssues(next) { issues.value = { ...(next || {}) } }
  function toEditableNode(node) {
    return { id: node.id, type: node.type, position: { ...(node.position || { x: 0, y: 0 }) }, data: hydrateNode(node.type, clone(node.data || {})) }
  }

  // The shared unsaved-changes guard: route leave and the browser's own "leave site?" question.
  const guard = useUnsavedGuard(() => (dirty.value ? 1 : 0), WORKFLOW_LEAVE_QUESTION)

  return {
    // state
    loading, loadError, saving, conflict, dirty, issues,
    name, nodes, edges, vars, viewport, meta,
    agents, agentsError, allGraphs, scripts,
    // actions
    load, save, saveIfDirty, publish, setStatus, restoreVersion, discard,
    applyOps, setViewport, setIssues, currentGraph, toEditableNode, onReset,
    mayLeave: guard.mayLeave,
  }
}
