// @vitest-environment jsdom
// OutputTree (ADM-1333): nothing is cut (the old tree showed five items of a list), large values scroll virtually,
// every addressable row can be inserted by Enter/click or dragged, and the drag source stays mounted (F19).
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VueJsonPretty from 'vue-json-pretty'
import OutputTree from './OutputTree.vue'
import { WF_VAR_MIME } from './wfNodeModalModel'

const big = Array.from({ length: 1000 }, (_, i) => ({ sku: `sku-${i}` }))

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null })

describe('OutputTree', () => {
  it('hands the WHOLE 1,000-item list to the tree and scrolls it virtually instead of cutting it', () => {
    wrapper = mount(OutputTree, { props: { value: { result: big }, base: 'nodes.fetch.output' } })
    const tree = wrapper.getComponent(VueJsonPretty)
    expect(tree.props('data').result).toHaveLength(1000)
    expect(tree.props('data').result[999]).toEqual({ sku: 'sku-999' })
    expect(tree.props('virtual')).toBe(true)
  })

  it('draws every one of the 1,000 items when drawn without virtual scrolling', () => {
    const list = Array.from({ length: 1000 }, (_, i) => `row-${i}`)
    wrapper = mount(OutputTree, { props: { value: list, base: 'nodes.fetch.output', virtualThreshold: Infinity } })
    const tokens = wrapper.findAll('.otree-insert').map((b) => b.attributes('data-token'))
    expect(tokens.filter((t) => /output\[\d+\]\}\}$/.test(t))).toHaveLength(1000)
    expect(tokens).toContain('{{nodes.fetch.output[999]}}')
    expect(wrapper.text()).toContain('row-999')
  }, 30000)

  it('Enter or a click on a row emits the engine token for its path', async () => {
    wrapper = mount(OutputTree, { props: { value: { text: 'hi', result: { rows: [{ id: 7 }] } }, base: 'nodes.fetch.output' } })
    const btn = wrapper.findAll('.otree-insert').find((b) => b.attributes('data-token') === '{{nodes.fetch.output.result.rows[0].id}}')
    expect(btn.attributes('aria-label')).toBe('Insert {{nodes.fetch.output.result.rows[0].id}}')
    await btn.trigger('click')
    expect(wrapper.emitted('pick')).toEqual([['{{nodes.fetch.output.result.rows[0].id}}']])
  })

  it('the schema view lists a list once, as its merged item', () => {
    wrapper = mount(OutputTree, { props: { value: { rows: [{ a: 1 }, { b: 'x' }] }, base: 'trigger', mode: 'schema' } })
    const tokens = wrapper.findAll('.otree-insert').map((b) => b.attributes('data-token'))
    expect(tokens).toEqual(['{{trigger}}', '{{trigger.rows}}', '{{trigger.rows[0]}}', '{{trigger.rows[0].a}}', '{{trigger.rows[0].b}}'])
  })

  it('a drag carries the token and leaves its source mounted (F19)', async () => {
    wrapper = mount(OutputTree, { props: { value: { text: 'hi' }, base: 'nodes.fetch.output' }, attachTo: document.body })
    const btn = wrapper.findAll('.otree-insert').find((b) => b.attributes('data-token') === '{{nodes.fetch.output.text}}')
    const set = new Map()
    const dataTransfer = { setData: (t, v) => set.set(t, v), effectAllowed: 'none' }
    await btn.trigger('dragstart', { dataTransfer })
    expect(set.get(WF_VAR_MIME)).toBe('{{nodes.fetch.output.text}}')
    expect(set.get('text/plain')).toBe('{{nodes.fetch.output.text}}')
    expect(btn.element.isConnected).toBe(true)
    expect(wrapper.emitted('drag-start')).toEqual([['{{nodes.fetch.output.text}}']])
  })

  it('offers no insert buttons when it only displays (insertable false)', () => {
    wrapper = mount(OutputTree, { props: { value: { text: 'hi' }, insertable: false } })
    expect(wrapper.findAll('.otree-insert')).toHaveLength(0)
    expect(wrapper.text()).toContain('hi')
  })
})
