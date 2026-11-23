// @vitest-environment jsdom
// The node window (ADM-1333, plan §3.3): three resizable panes, edits only through history operations (one entry per
// field edit), tests of the DRAFT up to a node (D4), the keyboard pick, the channel secret, and a waiting sub-workflow.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import WfNodeModal from './WfNodeModal.vue'
import { fakeCatalog, fakeDoc, fakeRun } from './wfNodeModal.testHarness'
import { useWorkflowHistory } from '@/composables/useWorkflowHistory'

const people = vi.hoisted(() => ({ results: [] }))
const peopleApi = vi.hoisted(() => vi.fn(async () => ({ data: { results: people.results } })))
vi.mock('@/services/api', () => ({ default: { get: vi.fn(async () => ({ data: [] })), getMediaRoutes: vi.fn(), getWorkflowPeople: peopleApi } }))

const tick = async () => { await flushPromises(); await nextTick(); await new Promise((r) => setTimeout(r, 0)); await nextTick() }

const baseNodes = [
  { id: 'start', type: 'trigger.manual', data: { inputs: [{ key: 'city', default: 'Oslo' }] } },
  { id: 'fetch', type: 'action.tool', data: { tool: 'T', params_json: '{}' } },
  { id: 'think', type: 'llm.call', data: { prompt: '', output_mode: 'text' } },
]
const baseEdges = [{ id: 'e1', source: 'start', target: 'fetch' }, { id: 'e2', source: 'fetch', target: 'think' }]

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

function mountModal({ nodeId = 'think', nodes = baseNodes, edges = baseEdges, vars = {}, lastRun = null, nodeStates = {}, viewed = null, validation = null, readOnly = false, canRun = true, live = null, owner = null } = {}) {
  const doc = fakeDoc({ nodes, edges, vars })
  doc.meta.owner = owner
  const history = useWorkflowHistory(doc)
  const run = fakeRun({ lastRun, nodeStates, viewed })
  run.live.value = live
  const catalog = fakeCatalog(['T'])
  const open = ref(true)
  const Host = defineComponent({
    setup: () => () => h(WfNodeModal, {
      open: open.value, 'onUpdate:open': (v) => { open.value = v }, nodeId, doc, history, run, catalog, validation, readOnly, canRun,
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

  // Live check 2026-11-20: viewing run #218506 the pane said "Values from run #218507", the newest finished run.
  it('names the run on screen when a past run is viewed, not the newest finished one', async () => {
    const nodes = { fetch: { status: 'succeeded', output: { text: 'ok' } } }
    mountModal({ lastRun: { runId: 3, status: 'success', draftChangedSince: false, nodes }, viewed: { id: 2, status: 'failed', node_runs: [] } })
    await tick()
    expect(document.body.textContent).toContain('Values from run #2 (failed), the run on screen.')
    expect(document.body.textContent).not.toContain('Values from run #3')
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

  describe('approval step: approvers are people (ADM-1339)', () => {
    const approval = (data = {}) => [{ id: 'ok', type: 'logic.approval', data: { message: 'Go?', ...data } }]
    const PEOPLE = [
      { user_id: 1, email: 'owner@x.test', name: 'Olga Owner', role: 'owner' },
      { user_id: 7, email: 'ann@x.test', name: 'Ann', role: 'viewer' },
      { user_id: 9, email: 'bo@x.test', name: '', role: 'editor' },
    ]
    const box = (name) => qa('.apf-row').find((r) => r.textContent.includes(name)).querySelector('input')

    it('lists the people who can see the workflow; ticking stores their user ids, one history entry each', async () => {
      people.results = PEOPLE
      const { doc, history } = mountModal({ nodeId: 'ok', nodes: approval(), edges: [] })
      await tick()
      expect(peopleApi).toHaveBeenCalledWith(1)
      expect(qa('.apf-row').map((r) => [...r.querySelectorAll('.apf-name, .apf-email, .apf-role')].map((e) => e.textContent).join(' '))).toEqual([
        'Olga Owner owner@x.test Owner', 'Ann ann@x.test Viewer', 'bo@x.test Editor'])
      expect(q('.apf').textContent).toContain('Nobody ticked: the owner decides.')
      box('Ann').click()
      await tick()
      box('bo@x.test').click()
      await tick()
      expect(doc.nodes.value[0].data.approvers).toEqual([7, 9])
      expect(history.past.value.map((e) => e.label)).toEqual(['Edit Approvers', 'Edit Approvers'])
      expect(q('.apf').textContent).toContain('Any one of the people ticked')
      box('Ann').click()
      await tick()
      expect(doc.nodes.value[0].data.approvers).toEqual([9])
    })

    it('an old free-text value asks to pick again, and the first person ticked replaces it', async () => {
      people.results = PEOPLE
      const { doc } = mountModal({ nodeId: 'ok', nodes: approval({ approvers: 'ann@x.test, bo@x.test' }), edges: [] })
      await tick()
      const note = q('.apf-msg--warn')
      expect(note.getAttribute('role')).toBe('alert')
      expect(note.textContent).toContain('Pick the approvers again; free-text emails are no longer read.')
      expect(note.textContent).toContain('ann@x.test, bo@x.test')
      expect(qa('.apf-row input').every((i) => !i.checked)).toBe(true)
      box('Ann').click()
      await tick()
      expect(doc.nodes.value[0].data.approvers).toEqual([7])
      expect(q('.apf-msg--warn')).toBeNull()
    })

    it('a person who lost access stays listed and ticked so they can be cleared; the server finding shows beside the field', async () => {
      people.results = PEOPLE
      const validation = { errors: [{ node_id: 'ok', path: 'data.approvers', code: 'approvers.unknown', message: '1 approver cannot see this workflow.' }], warnings: [] }
      const { doc } = mountModal({ nodeId: 'ok', nodes: approval({ approvers: [7, 44] }), edges: [], validation })
      await tick()
      expect(box('Person #44').checked).toBe(true)
      expect(q('.apf').textContent).toContain('No longer has access')
      expect(q('.apf .apf-msg--err').textContent).toContain('1 approver cannot see this workflow.')
      expect(q('.wfm-issues')).toBeNull()
      box('Person #44').click()
      await tick()
      expect(doc.nodes.value[0].data.approvers).toEqual([7])
    })

    it('a failed people list shows the server sentence and offers Try again', async () => {
      peopleApi.mockRejectedValueOnce({ response: { status: 403, data: { error: 'Only people who can see this workflow can list them.', code: 'forbidden_role' } } })
      people.results = PEOPLE
      mountModal({ nodeId: 'ok', nodes: approval(), edges: [] })
      await tick()
      expect(q('.apf [role="alert"]').textContent).toContain('Only people who can see this workflow can list them.')
      button('Try again').click()
      await tick()
      expect(qa('.apf-row')).toHaveLength(3)
    })

    it('Approve and Reject only when the server says this person may decide', async () => {
      people.results = PEOPLE
      const waiting = (output) => ({ ok: { status: 'waiting', output } })
      const { run } = mountModal({
        nodeId: 'ok', nodes: approval({ approvers: [7] }), edges: [], live: { id: 5, status: 'waiting' },
        nodeStates: waiting({ approvers: [{ user_id: 7, email: 'ann@x.test', name: 'Ann' }], can_decide: false }),
      })
      await tick()
      expect(q('[aria-label="Approval decision"]').textContent).toContain('Waiting for Ann to decide.')
      expect(button('Approve')).toBeUndefined()
      run.nodeStates.value = waiting({ approvers: [], can_decide: true })
      await tick()
      button('Approve').click()
      expect(run.decide).toHaveBeenCalledWith('ok', 'approve')
    })

    it('with no approvers, anyone else is told the owner decides, by name', async () => {
      people.results = PEOPLE
      mountModal({
        nodeId: 'ok', nodes: approval(), edges: [], live: { id: 5, status: 'waiting' }, owner: { id: 1, email: 'owner@x.test', name: 'Olga Owner' },
        nodeStates: { ok: { status: 'waiting', output: { approvers: [], can_decide: false } } },
      })
      await tick()
      expect(q('[aria-label="Approval decision"]').textContent).toContain('Waiting for the owner, Olga Owner, to decide.')
      expect(button('Approve')).toBeUndefined()
    })
  })

  describe('read only (a viewer or runner, ADM-1339)', () => {
    it('a viewer sees the settings disabled, nothing is written, and the tests are hidden', async () => {
      people.results = []
      const { doc, history } = mountModal({ readOnly: true, canRun: false })
      await tick()
      expect(document.body.textContent).toContain('Your role on this workflow lets you see this step, not change it.')
      const prompt = q('textarea[placeholder^="Extract the decisions"]')
      expect(prompt.closest('fieldset').disabled).toBe(true)
      await type(prompt, ['changed'])
      expect(doc.nodes.value.find((n) => n.id === 'think').data.prompt).toBe('')
      expect(history.past.value).toHaveLength(0)
      expect(button('Test this step')).toBeUndefined()
      expect(button('Run upstream (test)')).toBeUndefined()
    })

    it('a trigger address the server keeps from a viewer or runner is explained, not "save first"', async () => {
      mountModal({ nodeId: 'hook', nodes: [{ id: 'hook', type: 'trigger.webhook', data: {} }], edges: [], readOnly: true, canRun: true })
      await tick()
      expect(q('.iu-empty').textContent).toBe('Only the owner and editors of this workflow see this address.')
    })

    it('a runner keeps the tests of the draft', async () => {
      const { run } = mountModal({ readOnly: true, canRun: true })
      await tick()
      expect(button('Run upstream (test)')).toBeTruthy()
      button('Test this step').click()
      await tick()
      expect(run.start).toHaveBeenCalledWith({ dryRun: true, untilNode: 'think', payload: { city: 'Oslo' } })
    })

    it('an approver who is a viewer can still decide: the decision sits outside the disabled settings', async () => {
      people.results = []
      const { run } = mountModal({
        nodeId: 'ok', nodes: [{ id: 'ok', type: 'logic.approval', data: { message: 'Go?', approvers: [3] } }], edges: [],
        readOnly: true, canRun: false, live: { id: 5, status: 'waiting' }, nodeStates: { ok: { status: 'waiting', output: { can_decide: true } } },
      })
      await tick()
      const approve = button('Approve')
      expect(approve.disabled).toBe(false)
      expect(approve.closest('fieldset')).toBeNull()
      approve.click()
      expect(run.decide).toHaveBeenCalledWith('ok', 'approve')
    })
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
