// The node window's editing context (ADM-1333, plan §3.3 and D1 rule 1). WfNodeModal creates it and provides it;
// every settings component, SchemaForm and WfVarField read it with useNodeEditor().
//
// EVERY EDIT IS A HISTORY OPERATION. A node is never changed in place: a field writes
//   history.run('Edit <field>', [{ op: 'update_node', id, data: { <key>: <value> } }])
// and nested values (a condition's rows, a for-each's inner step) are written whole. Typing in one field is ONE
// history entry: the field opens a batch on focus (history.begin) and closes it on blur (history.end); a select or a
// button writes one entry per change.
//
// READ ONLY (ADM-1339). A person shared the workflow as viewer or runner sees the settings but cannot change them:
// NodeSettings disables its fields, and `patch` writes nothing. The server refuses such a save anyway.
//
// KEYBOARD PICK (WCAG 2.5.7). The text field focused last registers itself here; Enter on a key in the Input pane
// inserts that key's token into it at the caret it had.
import { computed, inject, provide, ref, shallowRef } from 'vue'
import { checkTemplateTokens } from '@/utils/wfVarExpr'
import { wfDef } from '@/config/wfNodeDefinitions'
import { buildSources, mergeNodeStates, pickerItems, secretVarNames, tokenResolves } from '../wfNodeModalModel'

const NODE_EDITOR = Symbol('wfNodeEditor')

export function createNodeEditor({ nodeId, doc, history, run, catalog = null, validation = () => null, readOnly = () => false, canRun = () => true }) {
  const isReadOnly = computed(() => !!readOnly())
  const mayRun = computed(() => !!canRun())
  const node = computed(() => doc.nodes.value.find((n) => n.id === nodeId.value) || null)
  const data = computed(() => node.value?.data || {})
  const type = computed(() => node.value?.type || '')
  const def = computed(() => wfDef(type.value))

  // ── writing ──
  let batchOpen = false
  function patch(values, title) {
    if (!node.value || isReadOnly.value) return
    history.run(`Edit ${title}`, [{ op: 'update_node', id: node.value.id, data: values }])
  }
  function set(key, value, title = key) { patch({ [key]: value }, title) }
  function begin(title) {
    if (batchOpen) return
    batchOpen = true
    history.begin(`Edit ${title}`)
  }
  function end() {
    if (!batchOpen) return
    batchOpen = false
    history.end()
  }

  /** v-bind for a WfVarField (or any text control) bound to `data[key]`: one history entry per focus. */
  function bindText(key, title) {
    return {
      modelValue: data.value[key] ?? '',
      'onUpdate:modelValue': (v) => set(key, v, title),
      onFocus: () => begin(title),
      onBlur: () => end(),
    }
  }
  /** The same for a value that is not a direct key (a row of a list, a for-each's inner field). */
  function bindCustom(title, get, put) {
    return {
      modelValue: get() ?? '',
      'onUpdate:modelValue': (v) => put(v),
      onFocus: () => begin(title),
      onBlur: () => end(),
    }
  }

  // ── what the Input pane and the pills read ──
  const states = computed(() => mergeNodeStates(run.lastRun.value?.nodes, run.nodeStates.value))
  const sources = computed(() => buildSources({
    nodeId: nodeId.value, nodes: doc.nodes.value, edges: doc.edges.value, vars: doc.vars.value, states: states.value,
  }))
  const varKeys = computed(() => pickerItems(sources.value))
  const checkContext = computed(() => ({
    nodeId: nodeId.value, nodeIds: doc.nodes.value.map((n) => n.id), edges: doc.edges.value,
  }))
  function tokenState(token) {
    if (token.problem) return 'error'
    return tokenResolves(token, { states: states.value, sources: sources.value }) ? 'ok' : 'plain'
  }
  function checkText(text) {
    return checkTemplateTokens(text, checkContext.value).map((t) => ({ ...t, state: tokenState(t) }))
  }

  // ── keyboard pick ──
  const activeField = shallowRef(null)      // { insert(token), label }
  const announcement = ref('')
  function registerField(api) { activeField.value = api }
  function unregisterField(api) { if (activeField.value === api) activeField.value = null }
  function announce(text) {
    // The same text twice must be read twice: clear, then set on the next tick of the live region.
    announcement.value = ''
    queueMicrotask(() => { announcement.value = text })
  }
  function insertIntoActive(token) {
    const field = activeField.value
    if (!field) {
      announce('Choose a field in Settings first, then pick a key.')
      return false
    }
    field.insert(token)
    announce(`Inserted ${token} into ${field.label}.`)
    return true
  }

  // ── problems found on save or Validate for this node ──
  const issues = computed(() => {
    const out = []
    const msg = doc.issues.value?.[nodeId.value]
    if (msg) out.push({ level: 'error', code: null, path: '', message: msg })
    const v = validation()
    for (const e of v?.errors || []) if (e?.node_id === nodeId.value && e.message !== msg) out.push({ level: 'error', code: e.code || null, path: e.path || '', message: e.message })
    for (const w of v?.warnings || []) if (w?.node_id === nodeId.value) out.push({ level: 'warning', code: w.code || null, path: w.path || '', message: w.message })
    return out
  })
  const issuesAt = (path) => issues.value.filter((i) => i.path === path)

  const lists = computed(() => ({
    graphs: (doc.allGraphs.value || [])
      .filter((g) => String(g.id) !== String(doc.meta.id) && String(g.public_id) !== String(doc.meta.publicId))
      .map((g) => [g.id, g.name]),
    scripts: (doc.scripts.value || []).map((s) => [s.id, s.name || s.file_path || `Script #${s.id}`]),
    agents: doc.agents.value || [],
    secretVars: secretVarNames(doc.vars.value),
    tools: catalog?.toolNames?.value || [],
  }))

  // ── tests run the DRAFT as a dry run up to a node (D4); the draft is saved first by useWorkflowRun ──
  const manualInputs = computed(() => {
    const m = doc.nodes.value.find((n) => n.type === 'trigger.manual')
    return (Array.isArray(m?.data?.inputs) ? m.data.inputs : []).filter((i) => i && i.key)
  })
  /** Each manual input's declared default, the payload a test from the node window uses. */
  function testPayload() { return Object.fromEntries(manualInputs.value.map((i) => [i.key, i.default ?? ''])) }
  function testUpTo(untilNode) {
    end()
    if (!mayRun.value) return Promise.resolve({ ok: false, reason: 'not_allowed' })
    return run.start({ dryRun: true, untilNode, payload: testPayload() })
  }

  return {
    node, data, type, def, manualInputs, testUpTo, readOnly: isReadOnly, canRun: mayRun, states, sources, varKeys, checkContext, checkText, tokenState,
    set, patch, begin, end, bindText, bindCustom,
    activeField, registerField, unregisterField, insertIntoActive, announce, announcement,
    issues, issuesAt, lists, doc, history, run, catalog,
  }
}

export function provideNodeEditor(editor) { provide(NODE_EDITOR, editor) }

/** The editor of the node window this component is in. Throws outside one: a settings field must never edit blind. */
export function useNodeEditor() {
  const editor = inject(NODE_EDITOR, null)
  if (!editor) throw new Error('This workflow setting is shown outside the node window (no node editor).')
  return editor
}

/** The editor when there is one (WfVarField also works on its own, with its props). */
export function useOptionalNodeEditor() { return inject(NODE_EDITOR, null) }
