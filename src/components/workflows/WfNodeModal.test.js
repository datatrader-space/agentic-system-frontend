// @vitest-environment jsdom
// The node window (ADM-1333, plan §3.3): three resizable panes, edits only through history operations (one entry per
// field edit), tests of the DRAFT up to a node (D4), the keyboard pick, the channel secret, and a waiting sub-workflow.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import WfNodeModal from './WfNodeModal.vue'
import { fakeCatalog, fakeDoc, fakeRun } from './wfNodeModal.testHarness'
import { useWorkflowHistory } from '@/composables/useWorkflowHistory'

vi.mock('@/services/api', () => ({ default: { get: vi.fn(async () => ({ data: [] })), getMediaRoutes: vi.fn() } }))

const tick = async () => { await flushPromises(); await nextTick(); await new Promise((r) => setTimeout(r, 0)); await nextTick() }

const baseNodes = [
  { id: 'start', type: 'trigger.manual', data: { inputs: [{ key: 'city', default: 'Oslo' }] } },
  { id: 'fetch', type: 'action.tool', data: { tool: 'T', params_json: '{}' } },
  { id: 'think', type: 'llm.call', data: { prompt: '', output_mode: 'text' } },
]
const baseEdges = [{ id: 'e1', source: 'start', target: 'fetch' }, { id: 'e2', source: 'fetch', target: 'think' }]

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

function mountModal({ nodeId = 'think', nodes = baseNodes, edges = baseEdges, vars = {}, lastRun = null, nodeStates = {}, validation = null } = {}) {
  const doc = fakeDoc({ nodes, edges, vars })
  const history = useWorkflowHistory(doc)
  const run = fakeRun({ lastRun, nodeStates })
  const catalog = fakeCatalog(['T'])
  const open = ref(true)
  const Host = defineComponent({
    setup: () => () => h(WfNodeModal, {
      open: open.value, 'onUpdate:open': (v) => { open.value = v }, nodeId, doc, history, run, catalog, validation,
    }),
  })
  wrapper = mount(Host, { attachTo: document.body, global: { stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } } })
  return { doc, history, run, catalog, open }
}
const q = (sel) => document.body.querySelector(sel)
const qa = (sel) => [...document.body.querySelectorAll(sel)]
const button = (text) => qa('button').find((b) => b.textContent.trim().includes(text))
async function type(el, values) {
  el.focus()
  el.dispatchEvent(new Event('focus'))
  for (const v of values) { el.value = v; el.dispatchEvent(new Event('input')) }
  el.dispatchEvent(new Event('blur'))
  await tick()
}

describe('WfNodeModal', () => {
  it('opens as a labelled dialog with three panes and two keyboard-movable separators', async () => {
    const { run, catalog } = mountModal()
    await tick()
    const dialog = q('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog.textContent).toContain('Model call')
    expect(qa('[role="separator"]')).toHaveLength(2)
    expect(qa('[role="separator"]').map((s) => s.getAttribute('aria-label'))).toEqual([
      'Resize the Input and Settings panes', 'Resize the Settings and Output panes'])
    expect(run.loadLastRun).toHaveBeenCalledTimes(1)
    expect(catalog.load).toHaveBeenCalled()
  })

  it('edits only through history operations: typing in one field is ONE entry', async () => {
    const { doc, history } = mountModal()
    await tick()
    const prompt = q('textarea[placeholder^="Extract the decisions"]')
    await type(prompt, ['S', 'Su', 'Summarise {{nodes.fetch.output.text}}'])
    expect(doc.nodes.value.find((n) => n.id === 'think').data.prompt).toBe('Summarise {{nodes.fetch.output.text}}')
    expect(history.past.value).toHaveLength(1)
    expect(history.past.value[0].label).toBe('Edit Prompt')
    expect(history.past.value[0].ops.every((o) => o.op === 'update_node' && o.id === 'think')).toBe(true)
  })

  it('"Test this step" runs the draft as a dry run up to this node, with the inputs\' defaults', async () => {
    const { run } = mountModal()
    await tick()
    button('Test this step').click()
    await tick()
    expect(run.start).toHaveBeenCalledWith({ dryRun: true, untilNode: 'think', payload: { city: 'Oslo' } })
  })

  it('offers "Run upstream (test)" when nothing has run, up to the PARENT node', async () => {
    const { run } = mountModal()
    await tick()
    button('Run upstream (test)').click()
    await tick()
    expect(run.start).toHaveBeenCalledWith({ dryRun: true, untilNode: 'fetch', payload: { city: 'Oslo' } })
  })

  it('offers it again when the draft changed since the last run, and not when the last run is current', async () => {
    const nodes = { fetch: { status: 'succeeded', output: { text: 'ok' } } }
    mountModal({ lastRun: { runId: 3, status: 'success', draftChangedSince: true, nodes } })
    await tick()
    expect(button('Run upstream (test)')).toBeTruthy()
    wrapper.unmount(); document.body.innerHTML = ''
    mountModal({ lastRun: { runId: 3, status: 'success', draftChangedSince: false, nodes } })
    await tick()
    expect(button('Run upstream (test)')).toBeUndefined()
    expect(document.body.textContent).toContain('Values from run #3')
  })

  it('keyboard pick: Enter (a click) on a key in the Input pane inserts it into the field focused last', async () => {
    const { doc } = mountModal({ nodeStates: { fetch: { status: 'succeeded', output: { text: 'ok', result: { n: 1 } } } } })
    await tick()
    const prompt = q('textarea[placeholder^="Extract the decisions"]')
    prompt.focus()
    prompt.dispatchEvent(new Event('focus'))
    prompt.dispatchEvent(new Event('blur'))
    const key = qa('.otree-insert').find((b) => b.dataset.token === '{{nodes.fetch.output.result.n}}')
    expect(key).toBeTruthy()
    key.click()
    await tick()
    expect(doc.nodes.value.find((n) => n.id === 'think').data.prompt).toBe('{{nodes.fetch.output.result.n}}')
    expect(document.body.textContent).toContain('Inserted {{nodes.fetch.output.result.n}} into Prompt.')
  })

  it('the Input pane lists only ancestors (never a step that runs later)', async () => {
    const nodes = [...baseNodes, { id: 'later', type: 'action.http', data: {} }]
    mountModal({ nodeId: 'fetch', nodes, edges: [...baseEdges, { id: 'e3', source: 'think', target: 'later' }] })
    await tick()
    const labels = qa('.ip-src-label').map((e) => e.textContent.trim())
    expect(labels).toEqual(['Trigger', 'Variables'])
  })

  it('channel trigger: the secret picker offers only SECRET variables and shows Validate\'s warning and error beside it', async () => {
    const nodes = [{ id: 'chan', type: 'trigger.channel', data: { platform: 'slack', channel: '' } }]
    const vars = { slack_secret: { secret: true }, plain: { default: 'x' } }
    const validation = {
      errors: [{ node_id: 'chan', path: 'data.secret_var', code: 'config.secret_var_unknown', message: "Secret variable 'nope' is not declared as a secret variable." }],
      warnings: [{ node_id: 'chan', path: 'data.secret_var', code: 'config.secret_missing', message: 'Slack signs its deliveries: choose the secret variable.' }],
    }
    const { doc, history } = mountModal({ nodeId: 'chan', nodes, edges: [], vars, validation })
    await tick()
    const select = q('.csf select')
    expect([...select.options].map((o) => o.value)).toEqual(['', 'slack_secret'])
    expect(q('.csf').textContent).toContain("Slack: the app's signing secret. Telegram: the webhook secret token.")
    expect(q('.csf-msg--warn').textContent).toContain('Slack signs its deliveries')
    expect(q('.csf-msg--err').textContent).toContain('not declared as a secret variable')
    expect(q('.wfm-issues')).toBeNull()
    select.value = 'slack_secret'
    select.dispatchEvent(new Event('change'))
    await tick()
    expect(doc.nodes.value[0].data.secret_var).toBe('slack_secret')
    expect(history.past.value.map((e) => e.label)).toEqual(['Edit Signing secret'])
  })

  it('the approval step has no approvers field (ADM-1339)', async () => {
    mountModal({ nodeId: 'ok', nodes: [{ id: 'ok', type: 'logic.approval', data: { message: 'Go?' } }], edges: [] })
    await tick()
    expect(document.body.textContent.toLowerCase()).not.toContain('approver')
  })

  it('a sub-workflow step waiting on its child run links to that run', async () => {
    const nodeStates = { sub: { status: 'waiting', output: { awaiting_subworkflow: true, sub_run_id: 77 } } }
    mountModal({ nodeId: 'sub', nodes: [{ id: 'sub', type: 'action.subworkflow', data: { graph_id: 5 } }], edges: [], nodeStates })
    await tick()
    const note = q('.op-sub')
    expect(note.textContent).toContain('Waiting for the sub-workflow run')
    const link = note.querySelector('a')
    expect(link.textContent).toContain('Open run #77')
    expect(JSON.parse(link.dataset.to)).toEqual({ name: 'dashboard-workflow-runs', query: { run: '77' } })
  })

  it('below 900px wide the panes become one pane at a time, chosen with pressed buttons', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    try {
      mountModal()
      await tick()
      expect(qa('[role="separator"]')).toHaveLength(0)
      const input = qa('.wfm-tab').find((b) => b.textContent.trim() === 'Input')
      expect(qa('.wfm-tab').find((b) => b.textContent.trim() === 'Settings').getAttribute('aria-pressed')).toBe('true')
      input.click()
      await tick()
      expect(input.getAttribute('aria-pressed')).toBe('true')
      expect(qa('.ip-src-label').length).toBeGreaterThan(0)
    } finally {
      delete window.matchMedia
    }
  })

  it('works when the browser refuses storage, and Done closes it (closing any open edit)', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    const { open, history } = mountModal()
    await tick()
    expect(q('[role="dialog"]')).not.toBeNull()
    const prompt = q('textarea[placeholder^="Extract the decisions"]')
    prompt.focus()
    prompt.dispatchEvent(new Event('focus'))
    prompt.value = 'x'
    prompt.dispatchEvent(new Event('input'))
    button('Done').click()
    await tick()
    expect(open.value).toBe(false)
    expect(history.past.value).toHaveLength(1)
    getItem.mockRestore()
    setItem.mockRestore()
  })
})
