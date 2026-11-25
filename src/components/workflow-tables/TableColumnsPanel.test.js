// @vitest-environment jsdom
// ADM-1363: the new-column form on a table's page. An empty Key is not shown as an error before anything is typed;
// a key the table already has is, with the message tied to the field.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TableColumnsPanel from './TableColumnsPanel.vue'

vi.mock('@/services/api', () => ({ default: {} }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(async () => true) }))

const TABLE = { id: 4, name: 'Contacts', archived: false, can: { read: true, write: true, manage: true }, columns: [{ key: 'email', label: 'Email', type: 'text' }] }

let wrapper
afterEach(() => wrapper?.unmount())

describe('TableColumnsPanel new column', () => {
  it('shows an empty Key as invalid only after a key is typed', async () => {
    wrapper = mount(TableColumnsPanel, { props: { table: TABLE } })
    const inputs = wrapper.findAll('form.tcp-add input[type="text"]')
    const key = inputs[1]
    expect(key.attributes('aria-invalid')).toBe('false')
    expect(key.attributes('aria-describedby')).toBeUndefined()
    expect(wrapper.find('.tcp-err').exists()).toBe(false)

    await inputs[0].setValue('Email')
    expect(key.attributes('aria-invalid')).toBe('true')
    const err = wrapper.find('.tcp-err')
    expect(err.text()).toBe('The table already has a column email.')
    expect(key.attributes('aria-describedby')).toBe(err.attributes('id'))

    await inputs[0].setValue('Phone')
    expect(key.attributes('aria-invalid')).toBe('false')
  })
})
