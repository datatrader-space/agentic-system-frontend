// @vitest-environment jsdom
// ADM-1363: Settings > Connectors > Databases. The list says each connection's engine, access and last test, and
// only its owner gets Edit, Share and Delete. The form never shows a secret back, keeps a saved one when its field is
// left empty, warns on a weaker TLS mode, shows the server's read-only advice, and tests after saving.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DatabaseConnectionsSection from './DatabaseConnectionsSection.vue'
import DatabaseConnectionDialog from './DatabaseConnectionDialog.vue'
import api from '@/services/api'
import { confirm } from '@/composables/useConfirm'

vi.mock('@/services/api', () => ({
  default: {
    getDatabaseConnections: vi.fn(), getDatabaseConnection: vi.fn(), createDatabaseConnection: vi.fn(), updateDatabaseConnection: vi.fn(),
    deleteDatabaseConnection: vi.fn(), testDatabaseConnection: vi.fn(), getDatabaseConnectionShares: vi.fn(),
    addDatabaseConnectionShare: vi.fn(), removeDatabaseConnectionShare: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(async () => true) }))

const META = {
  engines: [{ value: 'postgres', label: 'PostgreSQL', default_port: 5432 }, { value: 'mysql', label: 'MySQL / MariaDB', default_port: 3306 }],
  tls_modes: ['require', 'skip_verify', 'disable'], access: ['read_only', 'read_write'],
  read_only_advice: { postgres: 'Use a role with only SELECT: GRANT SELECT ON ALL TABLES …', mysql: 'GRANT SELECT …' },
  outbound_ips: ['203.0.113.7'], outbound_ips_note: 'An IP does not prove the tenant.',
}
const MINE = { id: 1, name: 'Orders', engine: 'postgres', engine_label: 'PostgreSQL', access: 'read_only', tls_mode: 'require', mine: true, can_manage: true, last_test: { at: '2026-11-25T08:00:00Z', ok: true }, ssh_enabled: false }
const SHARED = { id: 2, name: 'Their DB', engine: 'mysql', engine_label: 'MySQL', access: 'read_write', tls_mode: 'skip_verify', mine: false, can_manage: false, owner: { id: 9, email: 'o@x.com', name: 'Olu' }, last_test: null }

let wrapper
beforeEach(() => { api.getDatabaseConnections.mockResolvedValue({ data: { connections: [MINE, SHARED], ...META } }) })
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = ''; vi.clearAllMocks() })

describe('the Databases section', () => {
  it('lists engine, access, last test, and the owner\'s actions only on their own connection', async () => {
    wrapper = mount(DatabaseConnectionsSection, { attachTo: document.body })
    await flushPromises()
    const items = wrapper.findAll('.dcs-item')
    expect(items[0].text()).toContain('PostgreSQL')
    expect(items[0].text()).toContain('Read only')
    expect(items[0].text()).toContain('Test passed')
    expect(items[0].find('button[aria-label="Delete Orders"]').exists()).toBe(true)
    expect(items[1].text()).toContain('Read and write')
    expect(items[1].text()).toContain('Certificate not checked')
    expect(items[1].text()).toContain('Shared by Olu')
    expect(items[1].find('button[aria-label="Edit Their DB"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('203.0.113.7')
    expect(wrapper.text()).toContain('An IP does not prove the tenant.')
  })

  it('tests a connection and deletes one after asking', async () => {
    wrapper = mount(DatabaseConnectionsSection, { attachTo: document.body })
    await flushPromises()
    api.testDatabaseConnection.mockResolvedValue({ data: { ok: false, message: 'password authentication failed', code: 'auth' } })
    await wrapper.findAll('.dcs-item')[1].findAll('button').find((b) => b.text() === 'Test').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.dcs-item')[1].text()).toContain('password authentication failed')
    api.deleteDatabaseConnection.mockResolvedValue({})
    await wrapper.get('button[aria-label="Delete Orders"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(api.deleteDatabaseConnection).toHaveBeenCalledWith(1)
    expect(wrapper.findAll('.dcs-item')).toHaveLength(1)
  })
})

describe('the connection form', () => {
  const q = (sel) => document.body.querySelector(sel)
  const input = async (sel, value) => { const el = q(sel); el.value = value; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); await flushPromises() }
  const footButton = (text) => [...document.body.querySelectorAll('.app-dialog__foot button')].find((b) => b.textContent.includes(text))

  it('adds a connection: the default port, the TLS warning, the advice, and Save and test', async () => {
    api.createDatabaseConnection.mockResolvedValue({ data: { id: 5, name: 'Shop', engine: 'postgres', host: 'db.example.com', has_password: true } })
    api.testDatabaseConnection.mockResolvedValue({ data: { ok: true, message: 'Connected in 40 ms.' } })
    wrapper = mount(DatabaseConnectionDialog, { props: { open: true, connection: null, meta: META, workspace: 3 }, attachTo: document.body })
    await flushPromises()
    expect(q('input[type="number"]').value).toBe('5432')
    expect(document.body.textContent).toContain('Use a role with only SELECT')
    const skip = [...document.body.querySelectorAll('input[type="radio"]')].find((r) => r.value === 'skip_verify')
    skip.checked = true
    skip.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(document.body.textContent).toContain('certificate is not checked')

    const ids = [...document.body.querySelectorAll('.app-dialog input[id]')].map((el) => el.id)
    await input(`#${ids.find((i) => i.endsWith('-name'))}`, 'Shop')
    await input(`#${ids.find((i) => i.endsWith('-host'))}`, 'db.example.com')
    await input(`#${ids.find((i) => i.endsWith('-db'))}`, 'shop')
    await input(`#${ids.find((i) => i.endsWith('-pw'))}`, 's3cret')
    footButton('Save and test').click()
    await flushPromises()
    expect(api.createDatabaseConnection).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Shop', engine: 'postgres', workspace: 3, host: 'db.example.com', port: 5432, database: 'shop', password: 's3cret', tls_mode: 'skip_verify', access: 'read_only',
    }))
    expect(api.testDatabaseConnection).toHaveBeenCalledWith(5)
    expect(document.body.textContent).toContain('Connected in 40 ms.')
    // The password just sent is not kept in the page.
    expect(q(`#${ids.find((i) => i.endsWith('-pw'))}`).value).toBe('')
  })

  it('edits a connection: no secret shown, an empty password is kept, the engine cannot change', async () => {
    api.getDatabaseConnection.mockResolvedValue({ data: { ...MINE, host: 'db.example.com', port: 5432, database: 'shop', username: 'reader', has_password: true, ssh: { enabled: false } } })
    api.updateDatabaseConnection.mockResolvedValue({ data: { connection: { ...MINE, name: 'Orders 2', has_password: true }, changed: ['name'] } })
    wrapper = mount(DatabaseConnectionDialog, { props: { open: true, connection: MINE, meta: META }, attachTo: document.body })
    await flushPromises()
    expect(api.getDatabaseConnection).toHaveBeenCalledWith(1)
    const pw = [...document.body.querySelectorAll('input[type="password"]')][0]
    expect(pw.value).toBe('')
    expect(pw.placeholder).toBe('Leave empty to keep the saved password')
    expect(q('select').disabled).toBe(true)
    const nameId = [...document.body.querySelectorAll('.app-dialog input[id]')].find((el) => el.id.endsWith('-name')).id
    await input(`#${nameId}`, 'Orders 2')
    footButton('Save').click()
    await flushPromises()
    const body = api.updateDatabaseConnection.mock.calls[0][1]
    expect(api.updateDatabaseConnection.mock.calls[0][0]).toBe(1)
    expect(body.name).toBe('Orders 2')
    expect(body).not.toHaveProperty('password')
    expect(body).not.toHaveProperty('engine')
  })
})
