// @vitest-environment jsdom
// ADM-1363: the external database steps' settings. The connection picker offers only the step's engines, with their
// access; a write on a Read only connection is flagged; tables and columns come from the connection's schema, and a
// new connection clears them in the same entry; a raw query refuses {{ }} in its text and numbers its parameters.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import DatabaseStepSettings from './DatabaseStepSettings.vue'
import { editorHarness } from '../wfNodeModal.testHarness'
import { resetDataLists } from './dataLists'
import api from '@/services/api'

vi.mock('@/services/api', () => ({ default: { getDatabaseConnections: vi.fn(), getDatabaseConnectionSchema: vi.fn() } }))

const CONNECTIONS = [
  { id: 1, name: 'Orders', engine: 'postgres', engine_label: 'PostgreSQL', access: 'read_only', last_test: { at: '2026-11-25T08:00:00Z', ok: true } },
  { id: 2, name: 'Shop', engine: 'mysql', engine_label: 'MySQL', access: 'read_write', last_test: null },
  { id: 3, name: 'Cache', engine: 'redis', engine_label: 'Redis', access: 'read_only' },
]
const SCHEMA = {
  1: [{ name: 'public.orders', schema: 'public', table: 'orders', kind: 'table', columns: [{ name: 'id', type: 'integer' }, { name: 'status', type: 'text' }] }],
  2: [{ name: 'customers', schema: '', table: 'customers', kind: 'table', columns: [{ name: 'email', type: 'varchar' }] }],
}

let wrapper
beforeEach(() => {
  resetDataLists()
  api.getDatabaseConnections.mockResolvedValue({ data: { connections: CONNECTIONS } })
  api.getDatabaseConnectionSchema.mockImplementation(async (id) => ({ data: { tables: SCHEMA[id] || [] } }))
})
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.clearAllMocks() })

async function mountStep(type, data) {
  const ctx = editorHarness({ nodeId: 's1', nodes: [{ id: 's1', type, position: { x: 0, y: 0 }, data }], edges: [], render: () => h(DatabaseStepSettings) })
  ctx.doc.meta.workspace = 5
  wrapper = mount(ctx.Host, { attachTo: document.body, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
  await flushPromises()
  return ctx
}
const stepData = (ctx) => ctx.doc.nodes.value[0].data
const selectWith = (text) => wrapper.findAll('select').find((s) => s.findAll('option').some((o) => o.text().includes(text)))

describe('DatabaseStepSettings (ADM-1363)', () => {
  it('offers only the SQL connections, with their access, from the workflow\'s workspace', async () => {
    await mountStep('data.sql', { connection: '', operation: 'select', table: '' })
    expect(api.getDatabaseConnections).toHaveBeenCalledWith({ workspace: 5 })
    const conn = selectWith('Orders')
    const labels = conn.findAll('option').map((o) => o.text())
    expect(labels).toContain('Orders (PostgreSQL, read only)')
    expect(labels).toContain('Shop (MySQL, read and write)')
    expect(labels.some((l) => l.startsWith('Cache'))).toBe(false)
  })

  it('flags a write on a Read only connection, never a read', async () => {
    await mountStep('data.sql', { connection: 1, operation: 'select', table: 'public.orders' })
    expect(wrapper.text()).toContain('Read only')
    expect(wrapper.text()).not.toContain('refused by the database. Choose')
    wrapper.unmount()
    await mountStep('data.sql', { connection: 1, operation: 'insert', table: 'public.orders', values: [] })
    expect(wrapper.text()).toContain('This connection is Read only, so this operation is refused by the database')
  })

  it('tables and columns come from the schema; a new connection clears them in one entry', async () => {
    const ctx = await mountStep('data.sql', { connection: 1, operation: 'select', table: 'public.orders', columns: 'status', filters: [] })
    expect(api.getDatabaseConnectionSchema).toHaveBeenCalledWith(1, { fresh: false })
    expect(selectWith('public.orders')).toBeTruthy()
    const chips = wrapper.findAll('.wcp-chip').map((c) => c.text())
    expect(chips).toEqual(['id', 'status'])
    expect(wrapper.find('.wcp-chip.on').text()).toBe('status')

    const conn = selectWith('Orders')
    const shopIndex = conn.findAll('option').findIndex((o) => o.text().startsWith('Shop'))
    await conn.setValue(conn.findAll('option')[shopIndex].element.value)
    expect(stepData(ctx)).toMatchObject({ connection: 2, table: '', columns: '' })
    expect(ctx.history.past.value).toHaveLength(1)
  })

  it('a table the schema does not have is said', async () => {
    await mountStep('data.sql', { connection: 1, operation: 'select', table: 'public.gone' })
    expect(wrapper.text()).toContain('public.gone is not in the database\'s schema')
  })

  it('a raw query: {{ }} is refused in the text, and missing parameters are added as $n rows', async () => {
    const ctx = await mountStep('data.sql', { connection: 1, operation: 'query', query: 'SELECT * FROM t WHERE a = $1 AND b = $2', params: [] })
    expect(wrapper.text()).toContain('The query uses $1, $2 without a parameter.')
    expect(wrapper.text()).toContain('never written into the SQL text')
    await wrapper.findAll('button').find((b) => b.text() === 'Add them').trigger('click')
    expect(stepData(ctx).params).toEqual([{ value: '' }, { value: '' }])
    expect(wrapper.findAll('.wcr-num').map((n) => n.text())).toEqual(['$1', '$2'])

    const sql = wrapper.get('textarea.dbs-sql')
    await sql.setValue("SELECT * FROM t WHERE a = '{{trigger.a}}'")
    expect(sql.attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('in the query text is refused')
    expect(wrapper.text()).toContain('$1, $2 are not used in the query.')
  })

  it('a database trigger picks its cursor column from the table', async () => {
    const ctx = await mountStep('trigger.database', { connection: 1, table: 'public.orders', cursor_column: '', every: 5, mode: 'per_row' })
    const cursor = selectWith('Choose a column')
    expect(cursor.findAll('option').map((o) => o.text())).toEqual(['Choose a column…', 'id · integer', 'status · text'])
    await cursor.setValue('id')
    expect(stepData(ctx).cursor_column).toBe('id')
  })

  it('says when there is no connection of the step\'s engine', async () => {
    await mountStep('data.mongo', { connection: '', operation: 'find', collection: '' })
    expect(wrapper.text()).toContain('No MongoDB connection in this workspace yet.')
  })
})
