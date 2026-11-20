// Undo / redo for the workflow document (ADM-1333, plan D1 rule 6): our own command history, not Vue Flow's
// change events (its undo is Pro-only, and 2.x reshapes those events).
//
//   const history = useWorkflowHistory(doc)
//   history.run('Rename step', [{ op: 'update_node', id: 'fetch', data: { label: 'Fetch page' } }])
//   history.undo(); history.redo()
//
// Each entry is one person-sized step: the operations and their inverse (from doc.applyOps). A drag is one step:
// begin('Move') on drag start, run() for each position, end() on drag stop; repeated moves of one node inside a
// batch keep the first inverse and the last position. The history keeps at most `limit` ENTRIES (the oldest go
// first); an entry's operations are never cut. Loading, restoring a version or discarding clears it.
import { shallowRef, computed } from 'vue'

export const HISTORY_LIMIT = 200

export function useWorkflowHistory(doc, { limit = HISTORY_LIMIT } = {}) {
  const past = shallowRef([])     // [{ label, ops, inverse }], oldest first
  const future = shallowRef([])   // undone entries, most recently undone last
  let batch = null                // { label, ops, inverse, depth }

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const undoLabel = computed(() => past.value.at(-1)?.label || '')
  const redoLabel = computed(() => future.value.at(-1)?.label || '')

  function push(entry) {
    const next = [...past.value, entry]
    past.value = next.length > limit ? next.slice(next.length - limit) : next
    future.value = []
  }

  // Inside a batch, a node moved again keeps its first inverse and only its last position.
  function addToBatch(ops, inverse) {
    for (const op of ops) {
      if (op.op === 'move_node') {
        const i = batch.ops.findIndex((o) => o.op === 'move_node' && o.id === op.id)
        if (i !== -1) { batch.ops[i] = op; continue }
      }
      batch.ops.push(op)
    }
    const kept = inverse.filter((inv) => !(inv.op === 'move_node' && batch.inverse.some((o) => o.op === 'move_node' && o.id === inv.id)))
    batch.inverse = [...kept, ...batch.inverse]
  }

  /** Apply `ops` to the document and record them. Throws (and changes nothing) when an operation cannot apply. */
  function run(label, ops) {
    if (!ops || !ops.length) return
    const inverse = doc.applyOps(ops)
    if (batch) addToBatch(ops, inverse)
    else push({ label, ops, inverse })
  }

  function begin(label) {
    if (batch) { batch.depth += 1; return }
    batch = { label, ops: [], inverse: [], depth: 1 }
  }

  function end() {
    if (!batch) return
    batch.depth -= 1
    if (batch.depth > 0) return
    const done = batch
    batch = null
    if (done.ops.length) push({ label: done.label, ops: done.ops, inverse: done.inverse })
  }

  function undo() {
    if (batch) end()
    const entry = past.value.at(-1)
    if (!entry) return false
    doc.applyOps(entry.inverse)
    past.value = past.value.slice(0, -1)
    future.value = [...future.value, entry]
    return true
  }

  function redo() {
    if (batch) end()
    const entry = future.value.at(-1)
    if (!entry) return false
    doc.applyOps(entry.ops)
    future.value = future.value.slice(0, -1)
    past.value = [...past.value, entry]
    return true
  }

  function clear() {
    batch = null
    past.value = []
    future.value = []
  }

  doc.onReset(clear)

  return { run, begin, end, undo, redo, clear, canUndo, canRedo, undoLabel, redoLabel, past, future }
}
