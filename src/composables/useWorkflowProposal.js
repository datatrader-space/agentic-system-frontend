// The agent bar's proposal on the canvas (ADM-1333, plan §3.4 and D6). The agent never saves: WORKFLOW_PROPOSE_CHANGE
// sends a `workflow_proposal` frame, this composable turns each of its operations into a HUNK the canvas draws, and the
// person accepts or rejects each one. Accepting applies it to the draft through the history, so it can be undone, and
// the draft becomes unsaved; the person saves.
//
//   const proposal = useWorkflowProposal(doc, history)
//   proposal.receive(frame)            // the bar calls it on each workflow_proposal frame
//   proposal.hunks                     // [{ index, op, target: {kind, id}, mark, error, state, summary, ... }]
//   proposal.nodeMarks / edgeMarks     // { id: 'add' | 'change' | 'remove' } for the pending hunks
//   proposal.ghostNodes / ghostEdges   // added items not yet in the document, for the canvas to draw
//   proposal.accept(i) / reject(i) / acceptAll() / rejectAll() / clear()
//
// THE FRAME (backend docs/FRONTEND_INTEGRATION.md, "Workflow Builder — agent bar events"): `{graph_id, proposal_id,
// operations, errors}`. An error whose `path` is `operations[<i>]` means that operation was not applied on the server's
// copy: its hunk is REFUSED and shown with the message. Every other error is the Publish validation of the draft with the
// proposal applied, shown as `issues`.
//
// HIDDEN VALUES. The agent sees secrets as `__redacted__`. A string that is exactly `__redacted__` in update_node or
// set_vars means "keep the value that is there": a top-level key drops out of the patch, a nested one takes the stored
// value. Any other marker (in a new node or edge, inside a longer string or a list, `[redacted:...]`, or `__redacted__`
// with nothing stored to keep) refuses the hunk. A marker is never written into the document.
//
// STALE TARGETS. The person may edit the canvas after the proposal arrived. Accepting checks the target first: a step to
// change or remove that is gone, or a connection whose ends are missing, refuses the hunk with the reason. A connection
// to a step that this same proposal adds, still waiting, asks the person to accept that step first.
import { ref, computed } from 'vue'
import { applyWorkflowOps } from '@/composables/useWorkflowDoc'
import { confirm as askConfirm } from '@/composables/useConfirm'
import { notify as defaultNotify } from '@/composables/useNotify'
import { freeWorkflowPosition } from '@/utils/workflowNodePlacement'

export const REDACTED = '__redacted__'
const OPERATION_PATH = /^operations\[(\d+)\]$/
// Room between a step and a new one placed after it, when the agent gave no position.
const NEXT_STEP_DX = 280

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

class HiddenValueError extends Error {
  constructor(where) {
    super(`"${where}" holds a hidden value (__redacted__) that cannot be written. Ask the agent to leave that field out.`)
    this.code = 'redaction_marker'
  }
}

/** True when `value` carries a redaction marker anywhere (a string containing one, at any depth). */
export function hasRedactionMarker(value) {
  if (typeof value === 'string') return value.includes(REDACTED) || value.includes('[redacted:')
  if (Array.isArray(value)) return value.some(hasRedactionMarker)
  if (isObject(value)) return Object.values(value).some(hasRedactionMarker)
  return false
}

// `incoming` with each exact placeholder replaced by the value stored at the same place (the backend's _keep_hidden).
// Throws HiddenValueError for a marker that cannot be resolved.
function keepHidden(incoming, existing, where) {
  if (typeof incoming === 'string') {
    if (incoming === REDACTED) {
      if (existing === undefined || existing === null) throw new HiddenValueError(where)
      return clone(existing)
    }
    if (hasRedactionMarker(incoming)) throw new HiddenValueError(where)
    return incoming
  }
  if (Array.isArray(incoming)) {
    // A list is written whole, so a placeholder inside one has no single stored value to keep.
    if (hasRedactionMarker(incoming)) throw new HiddenValueError(where)
    return clone(incoming)
  }
  if (isObject(incoming)) {
    const out = {}
    for (const [k, v] of Object.entries(incoming)) out[k] = keepHidden(v, isObject(existing) ? existing[k] : undefined, `${where}.${k}`)
    return out
  }
  return clone(incoming)
}

function targetOf(op) {
  switch (op?.op) {
    case 'add_node': return { kind: 'node', id: op.node?.id ?? null }
    case 'update_node':
    case 'remove_node': return { kind: 'node', id: op.id ?? null }
    case 'add_edge': return { kind: 'edge', id: op.edge?.id ?? null }
    case 'remove_edge': return { kind: 'edge', id: op.id ?? null }
    case 'set_vars': return { kind: 'vars', id: isObject(op.vars) ? Object.keys(op.vars).join(', ') : null }
    default: return { kind: 'node', id: null }
  }
}

function markOf(op, vars) {
  switch (op?.op) {
    case 'add_node':
    case 'add_edge': return 'add'
    case 'remove_node':
    case 'remove_edge': return 'remove'
    case 'set_vars': {
      const entries = isObject(op.vars) ? Object.entries(op.vars) : []
      if (entries.length && entries.every(([, d]) => d === null)) return 'remove'
      if (entries.length && entries.every(([n]) => !Object.prototype.hasOwnProperty.call(vars || {}, n))) return 'add'
      return 'change'
    }
    default: return 'change'
  }
}

function summaryOf(op) {
  switch (op?.op) {
    case 'add_node': return `Add step “${op.node?.id ?? '?'}”${op.node?.type ? ` (${op.node.type})` : ''}`
    case 'update_node': {
      const keys = isObject(op.data) ? Object.keys(op.data) : []
      return `Change step “${op.id ?? '?'}”${keys.length ? `: ${keys.join(', ')}` : ''}`
    }
    case 'remove_node': return `Remove step “${op.id ?? '?'}” and its connections`
    case 'add_edge': {
      const e = op.edge || {}
      return `Connect “${e.source ?? '?'}”${e.sourceHandle ? ` (${e.sourceHandle})` : ''} to “${e.target ?? '?'}”`
    }
    case 'remove_edge': return `Remove connection “${op.id ?? '?'}”`
    case 'set_vars': {
      const entries = isObject(op.vars) ? Object.entries(op.vars) : []
      const removed = entries.filter(([, d]) => d === null).map(([n]) => n)
      const set = entries.filter(([, d]) => d !== null).map(([n]) => n)
      return [set.length ? `Set variables: ${set.join(', ')}` : '', removed.length ? `Remove variables: ${removed.join(', ')}` : '']
        .filter(Boolean).join('; ') || 'Change variables'
    }
    default: return `Unknown change “${op?.op ?? '?'}”`
  }
}

// The node ids an operation needs to be in the document.
function needsNodes(op) {
  if (op?.op === 'update_node' || op?.op === 'remove_node') return [op.id]
  if (op?.op === 'add_edge') return [op.edge?.source, op.edge?.target]
  return []
}

export function useWorkflowProposal(doc, history, { confirm = askConfirm, notify = defaultNotify } = {}) {
  const proposalId = ref(null)
  const graphId = ref(null)
  const hunks = ref([])
  const issues = ref([])          // the proposal's errors that are not about one operation (Publish validation)

  const docState = () => ({ name: doc.name?.value, nodes: doc.nodes.value, edges: doc.edges.value, vars: doc.vars.value })
  const pending = computed(() => hunks.value.filter((h) => h.state === 'pending'))
  const pendingCount = computed(() => pending.value.length)

  // ── turning one operation into the document's operations, against `state` ────────────────────────────────────────
  function updatePatch(op, node) {
    if (!isObject(op.data)) throw new Error('This change has no fields to set.')
    const old = node.data || {}
    const stored = {}
    for (const [k, v] of Object.entries(op.data)) {
      if (v === REDACTED) continue                 // keep the value that is there: the key drops out of the patch
      stored[k] = keepHidden(v, old[k], k)
    }
    // The document holds the EDITED shape of a node (its hydrated data, e.g. params as JSON text). The agent writes the
    // stored shape, so the edited fields derived from a changed key are carried too; a derived field whose source the
    // agent did not touch keeps what the person may have typed.
    const base = doc.toEditableNode({ id: node.id, type: node.type, data: old }).data || {}
    const next = doc.toEditableNode({ id: node.id, type: node.type, data: { ...old, ...stored } }).data || {}
    const patch = {}
    for (const k of new Set([...Object.keys(stored), ...Object.keys(next)])) {
      if (!(k in next)) { if (k in old) patch[k] = undefined; continue }
      if (k in stored || !same(next[k], base[k])) patch[k] = next[k]
    }
    for (const k of Object.keys(patch)) if (same(patch[k], old[k])) delete patch[k]
    return patch
  }

  function docOps(hunk, state) {
    const { op } = hunk
    const hasNode = (id) => state.nodes.some((n) => n.id === id)
    switch (op.op) {
      case 'add_node': {
        if (hasRedactionMarker(op.node)) throw new HiddenValueError('node')
        if (hasNode(op.node.id)) throw new Error(`A step “${op.node.id}” is already in the workflow.`)
        return [{ op: 'add_node', node: doc.toEditableNode({ ...clone(op.node), position: placedAt(hunk) }) }]
      }
      case 'update_node': {
        const node = state.nodes.find((n) => n.id === op.id)
        if (!node) throw new Error(`The step “${op.id}” is no longer in the workflow.`)
        const data = updatePatch(op, node)
        return Object.keys(data).length ? [{ op: 'update_node', id: op.id, data }] : []
      }
      case 'remove_node': {
        if (!hasNode(op.id)) throw new Error(`The step “${op.id}” is no longer in the workflow.`)
        return [{ op: 'remove_node', id: op.id }]
      }
      case 'add_edge': {
        const edge = op.edge || {}
        if (hasRedactionMarker(edge)) throw new HiddenValueError('edge')
        for (const end of [edge.source, edge.target]) {
          if (!hasNode(end)) throw new Error(`The connection needs the step “${end}”, which is not in the workflow.`)
        }
        if (state.edges.some((e) => e.id === edge.id)) throw new Error(`A connection “${edge.id}” is already in the workflow.`)
        const fresh = {}
        for (const [k, v] of Object.entries(edge)) if (v !== undefined && v !== null) fresh[k] = clone(v)
        return [{ op: 'add_edge', edge: fresh }]
      }
      case 'remove_edge': {
        if (!state.edges.some((e) => e.id === op.id)) throw new Error(`The connection “${op.id}” is no longer in the workflow.`)
        return [{ op: 'remove_edge', id: op.id }]
      }
      case 'set_vars': {
        if (!isObject(op.vars)) throw new Error('This change has no variables to set.')
        const vars = clone(state.vars || {})
        for (const [name, decl] of Object.entries(op.vars)) {
          if (decl === null) { delete vars[name]; continue }
          if (decl === REDACTED) {
            if (!Object.prototype.hasOwnProperty.call(vars, name)) throw new HiddenValueError(`vars.${name}`)
            continue
          }
          vars[name] = keepHidden(decl, vars[name], `vars.${name}`)
        }
        return same(vars, state.vars || {}) ? [] : [{ op: 'set_vars', vars }]
      }
      default:
        throw new Error(`Unknown change “${op.op}”.`)
    }
  }

  // A pending add_node of this proposal that the hunk depends on, or ''.
  function waitingOn(hunk) {
    const adds = new Set(pending.value.filter((h) => h !== hunk && h.op.op === 'add_node').map((h) => h.op.node?.id))
    return needsNodes(hunk.op).find((id) => adds.has(id) && !doc.nodes.value.some((n) => n.id === id)) || ''
  }

  function refuse(hunk, error) {
    hunk.state = 'refused'
    hunk.error = { node_id: hunk.target.kind === 'node' ? String(hunk.target.id ?? '') : '', path: `operations[${hunk.index}]`,
      code: error?.code || 'stale', message: error?.message || String(error) }
  }

  // ── actions ──────────────────────────────────────────────────────────────────────────────────────────────────────
  function accept(i) {
    const hunk = hunks.value[i]
    if (!hunk || hunk.state !== 'pending') return false
    let ops
    try {
      ops = docOps(hunk, docState())
      if (ops.length) history.run('Agent change', ops)
    } catch (e) {
      const dep = !(e instanceof HiddenValueError) && waitingOn(hunk)
      if (dep) {
        notify.warning(`Accept the new step “${dep}” first.`)
        return false
      }
      refuse(hunk, e)
      notify.error(`This change cannot be applied: ${hunk.error.message}`)
      return false
    }
    hunk.state = 'accepted'
    return true
  }

  function reject(i) {
    const hunk = hunks.value[i]
    if (!hunk || hunk.state !== 'pending') return false
    hunk.state = 'rejected'
    return true
  }

  /** Apply every pending hunk that still fits, in order, as ONE history entry. Returns how many were applied. */
  function acceptAll() {
    let state = docState()
    const ops = []
    const applied = []
    const refused = []
    for (const hunk of pending.value) {
      try {
        const next = docOps(hunk, state)
        if (next.length) state = applyWorkflowOps(state, next).state
        ops.push(...next)
        applied.push(hunk)
      } catch (e) {
        refused.push([hunk, e])
      }
    }
    try {
      if (ops.length) history.run('Agent changes', ops)
    } catch (e) {
      notify.error(`The changes could not be applied: ${e.message}`)
      return 0
    }
    for (const hunk of applied) hunk.state = 'accepted'
    for (const [hunk, e] of refused) refuse(hunk, e)
    if (refused.length) {
      notify.error(`${refused.length} change${refused.length === 1 ? '' : 's'} could not be applied: ${refused.map(([h]) => h.error.message).join(' ')}`)
    }
    return applied.length
  }

  function rejectAll() {
    let n = 0
    for (const hunk of pending.value) { hunk.state = 'rejected'; n += 1 }
    return n
  }

  function clear() {
    proposalId.value = null
    graphId.value = null
    hunks.value = []
    issues.value = []
  }

  // The canvas position of a proposed step: the free spot `placeNewSteps` chose, else the agent's own.
  const placedAt = (hunk) => hunk.position || hunk.op.node?.position || { x: 0, y: 0 }

  // Where each new step goes. The agent's position, when it gives one, is only where it would LIKE the step: a new step
  // never lands on one already on the canvas (live 2026-11-20: a delay put "between" two steps 300 px apart covered
  // both, the cards being 200 px wide). Without a position: after the step that connects to it, else right of the
  // graph. The person's existing steps are never moved.
  function placeNewSteps(ops, list) {
    const placed = []
    const positionOf = (id) => doc.nodes.value.find((n) => n.id === id)?.position || placed.find((n) => n.id === id)?.position
    for (const hunk of list) {
      if (hunk.op.op !== 'add_node' || hunk.state !== 'pending') continue
      const node = hunk.op.node
      const from = ops.find((o) => o?.op === 'add_edge' && o.edge?.target === node.id && positionOf(o.edge.source))
      let preferred
      if (Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y)) {
        preferred = { x: node.position.x, y: node.position.y }
      } else if (from) {
        const p = positionOf(from.edge.source)
        preferred = { x: p.x + NEXT_STEP_DX, y: p.y }
      } else {
        const all = [...doc.nodes.value, ...placed]
        const right = all.reduce((best, n) => (!best || (n.position?.x ?? 0) > (best.position?.x ?? 0) ? n : best), null)
        preferred = right ? { x: (right.position?.x ?? 0) + NEXT_STEP_DX, y: right.position?.y ?? 0 } : { x: 0, y: 120 }
      }
      hunk.position = freeWorkflowPosition([...doc.nodes.value, ...placed], preferred)
      placed.push({ id: node.id, position: hunk.position })
    }
  }

  /**
   * Show a new proposal. When hunks of the current one are still waiting, the person is asked first; keeping the
   * earlier one ignores the new frame. Resolves true when the new proposal is shown.
   */
  async function receive(frame) {
    if (!frame || frame.type !== 'workflow_proposal' || !frame.proposal_id || !Array.isArray(frame.operations)) return false
    if (frame.proposal_id === proposalId.value) return false
    if (pendingCount.value > 0) {
      const n = pendingCount.value
      const ok = await confirm({
        title: 'Replace the earlier proposal?',
        message: `The agent sent a new proposal. ${n} change${n === 1 ? '' : 's'} from the earlier one ${n === 1 ? 'is' : 'are'} still waiting; replacing it drops ${n === 1 ? 'it' : 'them'}. Changes you already accepted stay.`,
        confirmText: 'Show the new proposal',
        cancelText: 'Keep the earlier one',
      })
      if (!ok) return false
    }
    const errors = Array.isArray(frame.errors) ? frame.errors : []
    const byOp = new Map()
    const rest = []
    for (const err of errors) {
      const m = OPERATION_PATH.exec(String(err?.path || ''))
      if (m) {
        const i = Number(m[1])
        byOp.set(i, [...(byOp.get(i) || []), err])
      } else {
        rest.push(err)
      }
    }
    const vars = doc.vars.value || {}
    const list = frame.operations.map((op, index) => {
      const errs = byOp.get(index) || []
      const hunk = {
        index,
        op: clone(op),
        target: targetOf(op),
        mark: markOf(op, vars),
        summary: summaryOf(op),
        error: errs.length ? { ...errs[0], message: errs.map((e) => e.message).filter(Boolean).join(' ') || errs[0].code || 'Refused.' } : null,
        state: errs.length ? 'refused' : 'pending',
        position: null,
      }
      // Defence in depth: never offer a hunk that could write a marker, nor one the document cannot read.
      if (hunk.state === 'pending') {
        if (!op || !['add_node', 'update_node', 'remove_node', 'add_edge', 'remove_edge', 'set_vars'].includes(op.op)) {
          refuse(hunk, { code: 'operation.unknown', message: `Unknown change “${op?.op}”.` })
        } else if ((op.op === 'add_node' && (!isObject(op.node) || hasRedactionMarker(op.node)))
                   || (op.op === 'add_edge' && (!isObject(op.edge) || hasRedactionMarker(op.edge)))) {
          refuse(hunk, isObject(op.node) || isObject(op.edge) ? new HiddenValueError(op.op === 'add_node' ? 'node' : 'edge')
            : { code: 'operation.invalid', message: 'This change is incomplete.' })
        }
      }
      return hunk
    })
    placeNewSteps(frame.operations, list)
    proposalId.value = frame.proposal_id
    graphId.value = frame.graph_id ?? null
    hunks.value = list
    issues.value = rest
    return true
  }

  // ── what the canvas draws ────────────────────────────────────────────────────────────────────────────────────────
  const nodeMarks = computed(() => {
    const out = {}
    for (const h of pending.value) {
      if (h.target.kind !== 'node' || h.target.id == null) continue
      if (!out[h.target.id] || h.mark === 'remove') out[h.target.id] = h.mark
    }
    return out
  })

  const edgeMarks = computed(() => {
    const out = {}
    for (const h of pending.value) {
      if (h.op.op === 'remove_node') {
        // Its connections go with it.
        for (const e of doc.edges.value) if (e.source === h.op.id || e.target === h.op.id) out[e.id] = 'remove'
        continue
      }
      if (h.target.kind !== 'edge' || h.target.id == null) continue
      if (!out[h.target.id] || h.mark === 'remove') out[h.target.id] = h.mark
    }
    return out
  })

  const ghostNodes = computed(() => pending.value
    .filter((h) => h.op.op === 'add_node' && !doc.nodes.value.some((n) => n.id === h.op.node.id))
    .map((h) => {
      return { ...doc.toEditableNode({ ...h.op.node, position: placedAt(h) }), hunkIndex: h.index }
    }))

  const ghostEdges = computed(() => {
    const ids = new Set([...doc.nodes.value.map((n) => n.id), ...ghostNodes.value.map((n) => n.id)])
    return pending.value
      .filter((h) => h.op.op === 'add_edge' && h.op.edge?.id && !doc.edges.value.some((e) => e.id === h.op.edge.id)
        && ids.has(h.op.edge.source) && ids.has(h.op.edge.target))
      .map((h) => ({ ...clone(h.op.edge), hunkIndex: h.index }))
  })

  return {
    proposalId, graphId, hunks, issues, pendingCount,
    nodeMarks, edgeMarks, ghostNodes, ghostEdges,
    receive, accept, reject, acceptAll, rejectAll, clear,
  }
}
