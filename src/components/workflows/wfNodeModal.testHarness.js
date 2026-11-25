// Test doubles for the node window's tests (ADM-1333). The document applies operations with the REAL
// applyWorkflowOps and the history is the REAL useWorkflowHistory, so the tests see exactly the entries a person
// would undo. The run is a stand-in with useWorkflowRun's shape.
import { defineComponent, h, reactive, ref, shallowRef } from 'vue'
import { vi } from 'vitest'
import { applyWorkflowOps } from '@/composables/useWorkflowDoc'
import { useWorkflowHistory } from '@/composables/useWorkflowHistory'
import { createNodeEditor, provideNodeEditor } from './settings/nodeEditor'

export function fakeDoc({ nodes = [], edges = [], vars = {}, triggers = [], agents = [], graphs = [], scripts = [], issues = {} } = {}) {
  const doc = {
    name: ref('Workflow'),
    nodes: shallowRef(nodes),
    edges: shallowRef(edges),
    vars: shallowRef(vars),
    issues: shallowRef(issues),
    meta: reactive({ id: 1, publicId: 'wf_1', triggers }),
    agents: shallowRef(agents),
    agentsError: ref(''),
    allGraphs: shallowRef(graphs),
    scripts: shallowRef(scripts),
    onReset: () => () => {},
  }
  doc.applyOps = (ops) => {
    const { state, inverse } = applyWorkflowOps(
      { name: doc.name.value, nodes: doc.nodes.value, edges: doc.edges.value, vars: doc.vars.value }, ops)
    doc.name.value = state.name
    doc.nodes.value = state.nodes
    doc.edges.value = state.edges
    doc.vars.value = state.vars
    return inverse
  }
  return doc
}

export function fakeRun({ lastRun = null, nodeStates = {}, viewed = null } = {}) {
  return {
    lastRun: shallowRef(lastRun),
    nodeStates: shallowRef(nodeStates),
    viewed: shallowRef(viewed),
    live: shallowRef(null),
    running: ref(false),
    starting: ref(false),
    deciding: ref(false),
    viewingPast: ref(!!viewed),
    startError: shallowRef(null),
    start: vi.fn(async () => ({ ok: true, runId: 9 })),
    decide: vi.fn(async () => true),
    loadLastRun: vi.fn(async () => lastRun),
  }
}

export function fakeCatalog(toolNames = []) {
  return { toolNames: shallowRef(toolNames), load: vi.fn(async () => true) }
}

/** { doc, history, run, catalog, editor, Host }: Host provides the editor of `nodeId` to `render()`. */
export function editorHarness({ nodeId, render, validation = null, askInputs = null, readOnly = false, ...docOptions }) {
  const doc = fakeDoc(docOptions)
  const history = useWorkflowHistory(doc)
  const run = fakeRun(docOptions)
  const catalog = fakeCatalog(docOptions.tools || [])
  const ctx = { doc, history, run, catalog, editor: null }
  const Host = defineComponent({
    setup() {
      ctx.editor = createNodeEditor({ nodeId: ref(nodeId), doc, history, run, catalog, validation: () => validation, askInputs, readOnly: () => readOnly })
      provideNodeEditor(ctx.editor)
      return () => h('div', render ? render(ctx.editor) : null)
    },
  })
  ctx.Host = Host
  return ctx
}
