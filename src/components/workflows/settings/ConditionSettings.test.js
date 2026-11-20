// @vitest-environment jsdom
// F3 (ADM-1333): the condition step. Rendering writes nothing; rules and the expression are edited through history
// operations, editing one replaces the other; no demo text and no dead "Case sensitive" option.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import ConditionSettings from './ConditionSettings.vue'
import { editorHarness } from '../wfNodeModal.testHarness'

vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }))

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null })

const nodes = (data) => [
  { id: 'score', type: 'llm.call', data: {} },
  { id: 'branch', type: 'logic.condition', data },
]
const edges = [{ id: 'e1', source: 'score', target: 'branch' }]
function mountCondition(data = {}) {
  const ctx = editorHarness({ nodeId: 'branch', nodes: nodes(data), edges, render: () => h(ConditionSettings) })
  wrapper = mount(ctx.Host, { attachTo: document.body })
  return ctx
}
const data = (ctx) => ctx.doc.nodes.value.find((n) => n.id === 'branch').data

describe('ConditionSettings (F3)', () => {
  it('an empty step shows one draft rule WITHOUT writing anything during render', () => {
    const empty = {}
    const ctx = mountCondition(empty)
    expect(wrapper.findAll('fieldset.cs-row')).toHaveLength(1)
    expect(empty).toEqual({})
    expect(data(ctx)).toEqual({})
    expect(ctx.history.past.value).toHaveLength(0)
    expect(wrapper.text()).toContain('nothing is set yet')
  })

  it('has no demo copy and no "Case sensitive" option; it says comparisons are case-sensitive', () => {
    mountCondition({})
    expect(wrapper.text()).not.toContain('Route leads based on score and source')
    expect(wrapper.text()).not.toMatch(/Advanced options/)
    expect(wrapper.find('details').exists()).toBe(false)
    expect(wrapper.text()).toContain('Text comparisons are case-sensitive.')
  })

  it('typing in a rule writes the rows through ONE history entry, and the summary reflects it', async () => {
    const ctx = mountCondition({})
    const field = wrapper.get('fieldset.cs-row textarea, fieldset.cs-row input')
    await field.trigger('focus')
    for (const v of ['{{', '{{nodes.score.output.n}}']) { field.element.value = v; await field.trigger('input') }
    await field.trigger('blur')
    const op = wrapper.get('fieldset.cs-row select')
    await op.setValue('>')
    expect(data(ctx).conditions).toEqual([{ field: '{{nodes.score.output.n}}', operator: '>', value: '' }])
    expect(ctx.history.past.value.map((e) => e.label)).toEqual(['Edit Condition rule 1', 'Edit Condition'])
    expect(wrapper.get('.cs-summary code').text()).toBe('{{nodes.score.output.n}} >')
  })

  it('adding and removing rules are history operations; several rules get a join', async () => {
    const ctx = mountCondition({ conditions: [{ field: 'a', operator: '=', value: '1' }] })
    await wrapper.get('.cs-add').trigger('click')
    expect(data(ctx).conditions).toHaveLength(2)
    expect(data(ctx).join).toBe('AND')
    const join = wrapper.findAll('select').find((s) => s.find('option[value="OR"]').exists())
    await join.setValue('OR')
    expect(data(ctx).join).toBe('OR')
    await wrapper.get('button[aria-label="Remove rule 2"]').trigger('click')
    expect(data(ctx).conditions).toEqual([{ field: 'a', operator: '=', value: '1' }])
    ctx.history.undo()
    expect(data(ctx).conditions).toHaveLength(2)
  })

  it('an expression step opens in expression mode; editing the rules replaces the expression in the same change', async () => {
    const ctx = mountCondition({ expression: "{{trigger.plan}} == 'pro'" })
    expect(wrapper.find('input[value="expression"]').element.checked).toBe(true)
    await wrapper.get('input[value="rules"]').setValue(true)
    expect(wrapper.text()).toContain('Your first change to the rules replaces it')
    await wrapper.get('.cs-add').trigger('click')
    expect(data(ctx).expression).toBeUndefined()
    expect(data(ctx).conditions).toHaveLength(2)
    expect(ctx.history.past.value).toHaveLength(1)
  })
})
