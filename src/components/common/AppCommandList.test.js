// @vitest-environment jsdom
// AppCommandList (ADM-1333): search, arrow keys, Enter and groups on Reka's Listbox.
import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import AppCommandList from './AppCommandList.vue'
import { filterCommandItems, groupCommandItems } from './appCommandItems'

const ITEMS = [
  { id: 'agent.run', label: 'Run agent', description: 'Ask one of your agents', group: 'agent', icon: 'lucide:bot' },
  { id: 'llm.call', label: 'Call a model', description: 'One model call', group: 'agent', keywords: ['prompt', 'gpt'] },
  { id: 'action.http', label: 'HTTP request', description: 'Call any URL', group: 'action' },
  { id: 'logic.delay', label: 'Wait', description: 'Pause the run', group: 'logic', disabled: true },
]
const GROUPS = [{ id: 'action', label: 'Actions' }, { id: 'agent', label: 'AI' }]

describe('filterCommandItems', () => {
  it('returns every item for an empty search', () => {
    expect(filterCommandItems(ITEMS, '  ')).toBe(ITEMS)
  })
  it('matches every word, in any order and case, across label, description and keywords', () => {
    expect(filterCommandItems(ITEMS, 'GPT model').map((i) => i.id)).toEqual(['llm.call'])
    expect(filterCommandItems(ITEMS, 'call').map((i) => i.id)).toEqual(['llm.call', 'action.http'])
    expect(filterCommandItems(ITEMS, 'nothing-like-this')).toEqual([])
  })
  it('never cuts the result list', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ id: `t${i}`, label: `Tool ${i}` }))
    expect(filterCommandItems(many, 'tool')).toHaveLength(500)
  })
})

describe('groupCommandItems', () => {
  it('orders groups as listed, unknown groups after, ungrouped first without a heading', () => {
    const sections = groupCommandItems([...ITEMS, { id: 'x', label: 'Loose' }], GROUPS)
    expect(sections.map((s) => s.id)).toEqual(['__ungrouped', 'action', 'agent', 'logic'])
    expect(sections.map((s) => s.label)).toEqual(['', 'Actions', 'AI', 'logic'])
  })
})

let wrapper
// jsdom has no layout, so no scrollIntoView; Reka scrolls the highlighted option into view with it.
beforeAll(() => { if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {} })
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

const tick = async () => { await flushPromises(); await nextTick(); await new Promise((r) => setTimeout(r, 5)); await nextTick() }
function mountList(props = {}) {
  wrapper = mount(AppCommandList, { attachTo: document.body, props: { items: ITEMS, groups: GROUPS, label: 'Add a node', placeholder: 'Search nodes', ...props } })
  return wrapper
}
const input = () => document.body.querySelector('input')
const key = (k) => input().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
const highlighted = () => document.body.querySelector('[role="option"][data-highlighted]')

describe('AppCommandList', () => {
  it('is a labelled listbox with labelled groups and a labelled search box that takes focus', async () => {
    mountList()
    await tick()
    const listbox = document.body.querySelector('[role="listbox"]')
    expect(listbox.getAttribute('aria-label')).toBe('Add a node')
    expect(input().getAttribute('aria-label')).toBe('Search nodes')
    expect(input().getAttribute('aria-controls')).toBe(listbox.id)
    expect(document.activeElement).toBe(input())
    const labels = [...document.body.querySelectorAll('.app-cmd__group-label')].map((n) => n.textContent)
    expect(labels).toEqual(['Actions', 'AI', 'logic'])
    expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(4)
  })

  it('typing filters the list and highlights the first match', async () => {
    mountList()
    await tick()
    input().value = 'model'
    input().dispatchEvent(new Event('input'))
    await tick()
    const options = [...document.body.querySelectorAll('[role="option"]')]
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining('Call a model')])
    expect(highlighted()?.textContent).toContain('Call a model')
    expect(wrapper.emitted('update:search').at(-1)).toEqual(['model'])
  })

  it('arrow keys move the highlight and Enter selects the highlighted item', async () => {
    mountList()
    await tick()
    key('ArrowDown')
    await tick()
    const first = highlighted()
    expect(first).not.toBeNull()
    key('ArrowDown')
    await tick()
    expect(highlighted()).not.toBe(first)
    const label = highlighted().textContent
    key('Enter')
    await tick()
    const selected = wrapper.emitted('select')
    expect(selected).toHaveLength(1)
    expect(label).toContain(selected[0][0].label)
    expect(input().getAttribute('aria-activedescendant')).toBe(highlighted().id)
  })

  it('a click selects; a disabled item never does', async () => {
    mountList()
    await tick()
    const options = [...document.body.querySelectorAll('[role="option"]')]
    options.find((o) => o.textContent.includes('HTTP request')).click()
    options.find((o) => o.textContent.includes('Wait')).click()
    await tick()
    expect(wrapper.emitted('select').map((e) => e[0].id)).toEqual(['action.http'])
    // A disabled option says so to assistive technology (Reka marks it only with data-disabled).
    expect(options.find((o) => o.textContent.includes('Wait')).getAttribute('aria-disabled')).toBe('true')
    expect(options.find((o) => o.textContent.includes('HTTP request')).hasAttribute('aria-disabled')).toBe(false)
  })

  it('shows the empty text, and the search in it, when nothing matches', async () => {
    mountList()
    await tick()
    input().value = 'zzz'
    input().dispatchEvent(new Event('input'))
    await tick()
    expect(document.body.querySelector('[role="status"]').textContent).toContain('zzz')
  })

  it('with filter=false it shows the items as given (the caller searches)', async () => {
    mountList({ filter: false, search: 'model' })
    await tick()
    expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(4)
    expect(input().value).toBe('model')
  })

  it('shows a busy status while loading', async () => {
    mountList({ loading: true, loadingText: 'Loading tools...' })
    await tick()
    expect(document.body.querySelector('[role="status"]').textContent).toBe('Loading tools...')
    expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(0)
  })
})
