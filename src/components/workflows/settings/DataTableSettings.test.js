// @vitest-environment jsdom
// ADM-1363: the Data table step's settings. The table picker reads the WORKFLOW's workspace's tables, the values and
// filters choose their column from the chosen table, and choosing Exists rewires the step's connections onto its
// exists / missing outputs in the same history entry (Undo brings them back).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import DataTableSettings from './DataTableSettings.vue'
import { editorHarness } from '../wfNodeModal.testHarness'
import { resetDataLists } from './dataLists'
import { wfBranchHandles } from '@/config/wfNodeDefinitions'
import api from '@/services/api'

vi.mock('@/services/api', () => ({ default: { getWorkflowTables: vi.fn() } }))

const CONTACTS = {
  id: 11, name: 'Contacts', row_count: 2, bytes: 100, archived: false, can: { read: true, write: true, manage: true },
  columns: [
    { key: 'email', label: 'Email', type: 'text', required: true, unique: true },
    { key: 'visits', label: 'Visits', type: 'number', required: false, unique: false },
  ],
}

let wrapper
beforeEach(() => {
  resetDataLists()
  api.getWorkflowTables.mockResolvedValue({ data: { workspace: { id: 5, name: 'Team' }, can_create: true, tables: [CONTACTS], usage: {} } })
})
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.clearAllMocks() })

async function mountStep(data, { edges = [], workspace = 5 } = {}) {
  const nodes = [
    { id: 't1', type: 'data.table', position: { x: 0, y: 0 }, data },
    { id: 'n2', type: 'action.http', position: { x: 300, y: 0 }, data: {} },
    { id: 'n3', type: 'action.http', position: { x: 300, y: 120 }, data: {} },
  ]
  const ctx = editorHarness({ nodeId: 't1', nodes, edges, render: () => h(DataTableSettings) })
  ctx.doc.meta.workspace = workspace
  wrapper = mount(ctx.Host, { attachTo: document.body, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
  await flushPromises()
  return ctx
}
const stepData = (ctx) => ctx.doc.nodes.value.find((n) => n.id === 't1').data
const opSelect = () => wrapper.findAll('select').find((s) => s.findAll('option').some((o) => o.text() === 'If a row exists'))

describe('DataTableSettings (ADM-1363)', () => {
  it('reads the tables of the workflow\'s own workspace and offers them', async () => {
    await mountStep({ operation: 'insert', table: null, values: [] })
    expect(api.getWorkflowTables).toHaveBeenCalledWith({ workspace: 5 })
    const tableSelect = wrapper.findAll('select').find((s) => s.findAll('option').some((o) => o.text() === 'Contacts'))
    expect(tableSelect).toBeTruthy()
  })

  it('values choose their column from the table; "Add every column" is one history entry', async () => {
    const ctx = await mountStep({ operation: 'insert', table: 11, values: [] })
    expect(wrapper.text()).toContain('Required: email')
    const addAll = wrapper.findAll('button').find((b) => b.text().startsWith('Add every column'))
    await addAll.trigger('click')
    expect(stepData(ctx).values).toEqual([{ column: 'email', value: '' }, { column: 'visits', value: '' }])
    expect(ctx.history.past.value).toHaveLength(1)
    const colSelect = wrapper.get('select[aria-label="Values 1: column"]')
    expect(colSelect.findAll('option').map((o) => o.text())).toEqual(['Column…', 'Email (email) · text, required, unique', 'Visits (visits) · number'])
    expect(colSelect.attributes('title')).toBe('Email (email) · text, required, unique')   // the clipped label, in full on hover
    expect(wrapper.text()).not.toContain('Required: email')
  })

  it('a saved column the table no longer has stays, marked', async () => {
    await mountStep({ operation: 'update', table: 11, values: [{ column: 'phone', value: '1' }], filters: [] })
    const colSelect = wrapper.get('select[aria-label="Values 1: column"]')
    expect(colSelect.element.value).toBe('__saved__')
    expect(colSelect.text()).toContain('phone (not in the table)')
  })

  it('filters offer the row columns too, and an "is empty" filter has no value field', async () => {
    const ctx = await mountStep({ operation: 'get_rows', table: 11, filters: [{ column: 'id', op: 'is_empty', value: '' }] })
    const col = wrapper.get('select[aria-label="Filters 1: column"]')
    expect(col.findAll('option').map((o) => o.element.value)).toEqual(['', 'email', 'visits', 'id', 'created_at', 'updated_at'])
    expect(wrapper.text()).toContain('No value needed')
    await wrapper.get('select[aria-label="Filters 1: op"]').setValue('eq')
    expect(stepData(ctx).filters).toEqual([{ column: 'id', op: 'eq', value: '' }])
  })

  it('choosing Exists moves the plain connections onto "exists" in ONE entry, and back again', async () => {
    const edges = [{ id: 'e1', source: 't1', target: 'n2' }]
    const ctx = await mountStep({ operation: 'get_rows', table: 11, filters: [] }, { edges })
    await opSelect().setValue('exists')
    expect(stepData(ctx).operation).toBe('exists')
    expect(ctx.doc.edges.value).toEqual([{ id: 'e1', source: 't1', target: 'n2', sourceHandle: 'exists' }])
    expect(wfBranchHandles('data.table', stepData(ctx))).toEqual(['exists', 'missing'])
    expect(ctx.history.past.value).toHaveLength(1)
    expect(wrapper.find('.dts-branches').element.textContent).toMatch(/^\s*Two outputs: exists runs when/)

    ctx.history.undo()
    expect(stepData(ctx).operation).toBe('get_rows')
    expect(ctx.doc.edges.value).toEqual(edges)
  })

  it('leaving Exists moves exists / missing connections onto the one output', async () => {
    const edges = [
      { id: 'e1', source: 't1', target: 'n2', sourceHandle: 'exists' },
      { id: 'e2', source: 't1', target: 'n3', sourceHandle: 'missing' },
    ]
    const ctx = await mountStep({ operation: 'exists', table: 11, filters: [] }, { edges })
    await opSelect().setValue('count')
    expect(ctx.doc.edges.value.map((e) => e.sourceHandle)).toEqual([undefined, undefined])
    expect(wfBranchHandles('data.table', stepData(ctx))).toEqual([])
  })

  it('says when the saved table is gone, and when the workspace has none', async () => {
    await mountStep({ operation: 'insert', table: 99, values: [] })
    expect(wrapper.text()).toContain('This workspace has no table 99 any more')
    wrapper.unmount()
    resetDataLists()
    api.getWorkflowTables.mockResolvedValue({ data: { tables: [], usage: {} } })
    await mountStep({ operation: 'insert', table: null, values: [] })
    expect(wrapper.text()).toContain('This workspace has no tables yet.')
  })

  it('a viewer changes nothing', async () => {
    const edges = [{ id: 'e1', source: 't1', target: 'n2' }]
    const nodes = [{ id: 't1', type: 'data.table', position: { x: 0, y: 0 }, data: { operation: 'get_rows', table: 11 } }, { id: 'n2', type: 'action.http', position: { x: 1, y: 1 }, data: {} }]
    const ctx = editorHarness({ nodeId: 't1', nodes, edges, readOnly: true, render: () => h(DataTableSettings) })
    wrapper = mount(ctx.Host, { attachTo: document.body, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    await opSelect().setValue('exists')
    expect(ctx.doc.nodes.value[0].data.operation).toBe('get_rows')
    expect(ctx.doc.edges.value).toEqual(edges)
  })
})
