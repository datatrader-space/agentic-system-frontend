// @vitest-environment jsdom
// ADM-1363: a Data Table's rows. Pages come from next_cursor (Load more appends, never a cut list), filters are sent
// as the API reads them, an edit sends only the changed values, Delete all needs the count and the table's name
// typed, a refused CSV lists each row and column, and who may write or delete follows the table's `can`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import TableRowsGrid from './TableRowsGrid.vue'
import api from '@/services/api'
import { confirm } from '@/composables/useConfirm'
import { notify } from '@/composables/useNotify'

vi.mock('@/services/api', () => ({
  default: {
    getWorkflowTableRows: vi.fn(), addWorkflowTableRows: vi.fn(), updateWorkflowTableRow: vi.fn(), deleteWorkflowTableRow: vi.fn(),
    deleteWorkflowTableRows: vi.fn(), deleteAllWorkflowTableRows: vi.fn(), importWorkflowTableCsv: vi.fn(), exportWorkflowTableCsv: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(async () => true) }))

const TABLE = {
  id: 4, name: 'Contacts', row_count: 3, archived: false, can: { read: true, write: true, manage: true },
  columns: [{ key: 'email', label: 'Email', type: 'text', required: true }, { key: 'visits', label: 'Visits', type: 'number' }],
}
const row = (id, email, visits) => ({ id, email, visits, created_at: '2026-11-25T08:00:00Z', updated_at: '2026-11-25T08:00:00Z' })

let wrapper
beforeEach(() => {
  api.getWorkflowTableRows.mockImplementation(async (_id, p) => (p.cursor
    ? { data: { rows: [row(3, 'c@x.com', 0)], count: 3, total: 3, next_cursor: null } }
    : { data: { rows: [row(1, 'a@x.com', 2), row(2, 'b@x.com', 5)], count: 3, total: 3, next_cursor: 'cur-2' } }))
})
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.clearAllMocks() })

async function mountGrid(table = TABLE) {
  wrapper = mount(TableRowsGrid, { props: { table }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const button = (text) => wrapper.findAll('button').find((b) => b.text().includes(text))

describe('TableRowsGrid (ADM-1363)', () => {
  it('reads a page, then Load more appends the next one by its cursor', async () => {
    await mountGrid()
    expect(api.getWorkflowTableRows).toHaveBeenCalledWith(4, { filters: [], match: 'all', order_by: 'id', order: 'asc', page_size: 100 })
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('3 rows, 2 shown')
    await button('Load more rows').trigger('click')
    await flushPromises()
    expect(api.getWorkflowTableRows).toHaveBeenLastCalledWith(4, expect.objectContaining({ cursor: 'cur-2' }))
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(button('Load more rows')).toBeUndefined()
  })

  it('sends the filters, and an "is empty" filter without a value', async () => {
    await mountGrid()
    await button('Filters').trigger('click')
    await button('Add filter').trigger('click')
    await button('Add filter').trigger('click')
    const selects = wrapper.findAll('select[aria-label$="operator"]')
    await selects[1].setValue('is_empty')
    await wrapper.get('input[aria-label="Filter 1: value"]').setValue('a@x.com')
    await wrapper.get('form#trg-filters').trigger('submit')
    await flushPromises()
    expect(api.getWorkflowTableRows).toHaveBeenLastCalledWith(4, expect.objectContaining({
      filters: [{ column: 'email', op: 'eq', value: 'a@x.com' }, { column: 'email', op: 'is_empty' }],
    }))
  })

  it('an edit sends only the changed values', async () => {
    await mountGrid()
    api.updateWorkflowTableRow.mockResolvedValue({ data: { row: row(1, 'a@x.com', 9), changed: true } })
    await wrapper.get('button[aria-label="Edit row 1"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('tr.is-editing input').element)   // focus moves into the row
    await wrapper.get('input[aria-label="Visits, row 1"]').setValue('9')
    await wrapper.get('button[aria-label="Save row 1"]').trigger('click')
    await flushPromises()
    expect(api.updateWorkflowTableRow).toHaveBeenCalledWith(4, 1, { visits: 9 })
    expect(wrapper.text()).toContain('9')
  })

  it('a new row with a wrong value says so and sends nothing', async () => {
    await mountGrid()
    await button('Add row').trigger('click')
    await wrapper.get('input[aria-label="Visits, new row"]').setValue('many')
    await wrapper.get('button[aria-label="Save the new row"]').trigger('click')
    expect(api.addWorkflowTableRows).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Not a number.')
    expect(wrapper.text()).toContain('Required.')
  })

  it('Delete all shows the count and needs the table\'s name typed', async () => {
    await mountGrid()
    api.deleteAllWorkflowTableRows.mockImplementation(async (_id, body) => ({ data: { count: 3, ...body } }))
    await button('Delete all rows').trigger('click')
    await flushPromises()
    expect(api.deleteAllWorkflowTableRows).toHaveBeenCalledWith(4, { dry_run: true })
    const dialog = document.body.querySelector('.app-dialog')
    expect(dialog.textContent).toContain('This deletes 3 rows')
    const confirmBtn = [...dialog.ownerDocument.querySelectorAll('.app-dialog__foot button')].find((b) => b.textContent.includes('Delete all rows'))
    expect(confirmBtn.disabled).toBe(true)
    const input = dialog.querySelector('input')
    input.value = 'contacts'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(confirmBtn.disabled).toBe(true)
    input.value = 'Contacts'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(confirmBtn.disabled).toBe(false)
    confirmBtn.click()
    await flushPromises()
    expect(api.deleteAllWorkflowTableRows).toHaveBeenLastCalledWith(4, { confirm: true })
  })

  it('Delete all never promises "0 rows" when the server gives no count', async () => {
    await mountGrid()
    api.deleteAllWorkflowTableRows.mockResolvedValue({ data: {} })
    await button('Delete all rows').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('.app-dialog')).toBeNull()
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('could not be counted'))
    expect(api.deleteAllWorkflowTableRows).toHaveBeenCalledTimes(1)
  })

  it('deleting the selected rows asks first and sends their ids', async () => {
    await mountGrid()
    api.deleteWorkflowTableRows.mockResolvedValue({ data: { count: 2 } })
    await wrapper.get('input[aria-label="Select every row shown"]').setValue(true)
    await button('Delete 2 selected').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(api.deleteWorkflowTableRows).toHaveBeenCalledWith(4, { row_ids: [1, 2] })
  })

  it('a refused CSV lists each row and column', async () => {
    await mountGrid()
    api.importWorkflowTableCsv.mockRejectedValue({ response: { status: 400, data: { code: 'csv_invalid', error: 'Bad CSV', errors: [{ row: 3, column: 'visits', message: 'not a number' }, { row: 1, column: 'emial', message: 'no such column' }] } } })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['email\n'], 'c.csv', { type: 'text/csv' })] })
    await input.trigger('change')
    await flushPromises()
    const items = [...document.body.querySelectorAll('.app-dialog li')].map((li) => li.textContent)
    expect(items).toEqual(['Header, column emial: no such column', 'Row 3, column visits: not a number'])
  })

  it('a person who may only read sees no write or delete control; an archived table is read only', async () => {
    await mountGrid({ ...TABLE, can: { read: true, write: false, manage: false } })
    expect(button('Add row')).toBeUndefined()
    expect(button('Import CSV')).toBeUndefined()
    expect(button('Delete all rows')).toBeUndefined()
    expect(wrapper.find('button[aria-label="Edit row 1"]').exists()).toBe(false)
    expect(button('Export CSV')).toBeTruthy()
    wrapper.unmount()
    await mountGrid({ ...TABLE, archived: true })
    expect(button('Add row')).toBeUndefined()
    expect(wrapper.find('button[aria-label="Delete row 1"]').exists()).toBe(false)
  })
})
