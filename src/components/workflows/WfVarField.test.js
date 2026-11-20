// @vitest-environment jsdom
// WfVarField (ADM-1333, plan §3.3): the field stays plain text; pills are drawn behind it; tokens are inserted by the
// {{ picker, by Enter on a key in the Input pane (WCAG 2.5.7), and by drop, all at the caret, each through the history.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import WfVarField from './WfVarField.vue'
import { editorHarness } from './wfNodeModal.testHarness'
import { WF_VAR_MIME } from './wfNodeModalModel'

vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }))

const nodes = [
  { id: 'start', type: 'trigger.manual', data: {} },
  { id: 'fetch', type: 'action.tool', data: {} },
  { id: 'think', type: 'llm.call', data: { prompt: '' } },
  { id: 'later', type: 'action.http', data: {} },
]
const edges = [
  { id: 'e1', source: 'start', target: 'fetch' },
  { id: 'e2', source: 'fetch', target: 'think' },
  { id: 'e3', source: 'think', target: 'later' },
]
const nodeStates = { fetch: { status: 'succeeded', output: { text: 'ok', result: { rows: [1, 2] } } } }

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

function mountField(prompt = '', extra = {}) {
  const ctx = editorHarness({
    nodeId: 'think', nodes: nodes.map((n) => (n.id === 'think' ? { ...n, data: { prompt } } : n)), edges, nodeStates, ...extra,
    render: (editor) => [
      h(WfVarField, { id: 'f-prompt', label: 'Prompt', multiline: true, ...editor.bindText('prompt', 'Prompt') }),
      h('button', { id: 'elsewhere' }, 'Elsewhere'),
    ],
  })
  wrapper = mount(ctx.Host, { attachTo: document.body })
  return ctx
}
const prompt = (ctx) => ctx.doc.nodes.value.find((n) => n.id === 'think').data.prompt
const pills = () => [...wrapper.findAll('.wvf-pill')].map((p) => ({ text: p.text(), cls: p.classes().find((c) => c.startsWith('is-')) }))

describe('WfVarField pills', () => {
  it('keeps the field plain text and draws each token as a pill: coloured when it resolves, neutral when it has no value yet', () => {
    mountField('Rows: {{nodes.fetch.output.result.rows}} and {{nodes.fetch.output.result.none}}')
    expect(wrapper.get('textarea').element.value).toBe('Rows: {{nodes.fetch.output.result.rows}} and {{nodes.fetch.output.result.none}}')
    expect(pills()).toEqual([
      { text: '{{nodes.fetch.output.result.rows}}', cls: 'is-ok' },
      { text: '{{nodes.fetch.output.result.none}}', cls: 'is-plain' },
    ])
    expect(wrapper.find('.wvf-mirror').attributes('aria-hidden')).toBe('true')
  })

  it.each([
    ['{{steps.fetch.output}}', 'unknown_root', 'is not something a workflow can read'],
    ['{{nodes.ghost.output}}', 'unknown_node', 'There is no node "ghost"'],
    ['{{nodes.later.output}}', 'not_upstream', 'does not run before this node'],
    ['{{nodes.think.output}}', 'self', 'cannot read its own output'],
  ])('marks %s red (%s) and says why', (text, _problem, message) => {
    mountField(text)
    expect(pills()[0].cls).toBe('is-error')
    expect(wrapper.find('.wvf-pill').attributes('data-problem')).toContain(message)
    const list = wrapper.get('.wvf-problems')
    expect(list.text()).toContain(message)
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('textarea').attributes('aria-describedby')).toContain(list.attributes('id'))
  })
})

describe('WfVarField inserting', () => {
  it('typing {{ opens a picker of the upstream keys; picking one replaces the {{ with the token, as one history entry', async () => {
    const ctx = mountField('Hi ')
    const ta = wrapper.get('textarea')
    await ta.trigger('focus')
    ta.element.value = 'Hi {{'
    ta.element.setSelectionRange(5, 5)
    await ta.trigger('input')
    await ta.trigger('blur')
    expect(wrapper.find('.wvf-picker').exists()).toBe(true)
    const option = wrapper.findAll('[role="option"]').find((o) => o.text().includes('{{nodes.fetch.output.result.rows}}'))
    expect(option).toBeTruthy()
    expect(wrapper.findAll('[role="option"]').some((o) => o.text().includes('nodes.later'))).toBe(false)
    await option.trigger('click')
    await flushPromises()
    expect(prompt(ctx)).toBe('Hi {{nodes.fetch.output.result.rows}}')
    expect(wrapper.find('.wvf-picker').exists()).toBe(false)
    expect(ctx.history.past.value.map((e) => e.label)).toEqual(['Edit Prompt', 'Edit Prompt'])
  })

  it('Esc closes the picker without closing anything around it', async () => {
    mountField('')
    const ta = wrapper.get('textarea')
    ta.element.value = '@'
    ta.element.setSelectionRange(1, 1)
    await ta.trigger('input')
    const outer = vi.fn()
    window.addEventListener('keydown', outer)
    await wrapper.get('.wvf-picker').trigger('keydown', { key: 'Escape' })
    window.removeEventListener('keydown', outer)
    expect(wrapper.find('.wvf-picker').exists()).toBe(false)
    expect(outer).not.toHaveBeenCalled()
  })

  it('keyboard pick: the key goes into the field focused last, at the caret it had', async () => {
    const ctx = mountField('Hello world')
    const ta = wrapper.get('textarea')
    ta.element.focus()
    await ta.trigger('focus')
    ta.element.setSelectionRange(6, 6)
    document.getElementById('elsewhere').focus()
    await ta.trigger('blur')
    expect(ctx.editor.insertIntoActive('{{trigger.name}}')).toBe(true)
    await nextTick()
    expect(prompt(ctx)).toBe('Hello {{trigger.name}}world')
    expect(ctx.history.past.value).toHaveLength(1)
    expect(ctx.history.past.value[0].ops).toEqual([{ op: 'update_node', id: 'think', data: { prompt: 'Hello {{trigger.name}}world' } }])
  })

  it('a keyboard pick with no field chosen inserts nothing and says what to do', async () => {
    const ctx = mountField('x')
    expect(ctx.editor.insertIntoActive('{{trigger.name}}')).toBe(false)
    await flushPromises()
    expect(ctx.editor.announcement.value).toContain('Choose a field')
    expect(prompt(ctx)).toBe('x')
  })

  it('a dropped key is inserted at the caret', async () => {
    const ctx = mountField('ab')
    const ta = wrapper.get('textarea')
    ta.element.focus()
    ta.element.setSelectionRange(1, 1)
    const data = new Map([[WF_VAR_MIME, '{{nodes.fetch.output.text}}']])
    const dataTransfer = { types: [WF_VAR_MIME, 'text/plain'], getData: (t) => data.get(t) || '', dropEffect: 'none' }
    const over = new Event('dragover', { bubbles: true, cancelable: true })
    over.dataTransfer = dataTransfer
    ta.element.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(true)
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    drop.dataTransfer = dataTransfer
    ta.element.dispatchEvent(drop)
    await nextTick()
    expect(drop.defaultPrevented).toBe(true)
    expect(prompt(ctx)).toBe('a{{nodes.fetch.output.text}}b')
  })

  it('a drag that carries no workflow key is left to the browser', () => {
    mountField('ab')
    const over = new Event('dragover', { bubbles: true, cancelable: true })
    over.dataTransfer = { types: ['Files'], getData: () => '' }
    wrapper.get('textarea').element.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(false)
  })
})
