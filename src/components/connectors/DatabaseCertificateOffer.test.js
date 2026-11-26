// @vitest-environment jsdom
// ADM-1374: "Trust this server's certificate". A failed test's certificate is shown to the owner with its fingerprint;
// trusting asks first, sends the fingerprint that was shown, and a server that now shows another certificate is
// reported, not trusted. The list keeps the card per connection and tests again after trusting.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DatabaseCertificateOffer from './DatabaseCertificateOffer.vue'
import DatabaseConnectionsSection from './DatabaseConnectionsSection.vue'
import { certificateRows, pinsServerCertificate } from './databaseConnectionForm'
import api from '@/services/api'
import { confirm } from '@/composables/useConfirm'
import { notify } from '@/composables/useNotify'

vi.mock('@/services/api', () => ({
  default: {
    getDatabaseConnections: vi.fn(), getDatabaseConnection: vi.fn(), createDatabaseConnection: vi.fn(),
    updateDatabaseConnection: vi.fn(), deleteDatabaseConnection: vi.fn(), testDatabaseConnection: vi.fn(),
    trustDatabaseCertificate: vi.fn(), untrustDatabaseCertificate: vi.fn(), getDatabaseConnectionShares: vi.fn(),
    addDatabaseConnectionShare: vi.fn(), removeDatabaseConnectionShare: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(async () => true) }))

const FP_ROOT = '42:27:49:96:1F:E1:FA:85:67:E6:81:7E:0F:F2:93:09:CD:9F:9C:C3:AD:A5:06:8C:8E:5E:38:B9:80:2C:8E:FC'
const LEAF = { fingerprint_sha256: 'AA:BB', issued_to: 'MySQL_Server_Auto_Generated_Server_Certificate', issued_by: 'MySQL_Server_Auto_Generated_CA_Certificate', not_after: '2033-01-01T00:00:00+00:00', names: [], self_signed: false, expired: false }
const ROOT = { fingerprint_sha256: FP_ROOT, issued_to: 'MySQL_Server_Auto_Generated_CA_Certificate', self_signed: true, not_after: '2033-01-01T00:00:00+00:00' }
const CERT = {
  host: 'mysql-rfam-public.ebi.ac.uk', chain: [LEAF, ROOT], why: 'It is signed by an authority AADML does not know.',
  pinnable: true, reason: '', fingerprint: FP_ROOT, pin: ROOT, checks_name: false, changed_from: null,
  scope: 'Certificates signed by MySQL_Server_Auto_Generated_CA_Certificate will be accepted for this connection only. The name cannot be checked.',
}

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = ''; vi.clearAllMocks() })

describe('the certificate helpers', () => {
  it('describe a certificate in rows and tell the server\'s own from the authority it sends', () => {
    const rows = certificateRows(LEAF)
    expect(rows.map((r) => r.label)).toEqual(['Issued to', 'Issued by', 'Valid until'])
    expect(certificateRows({ ...ROOT, names: ['db.example.com'] }).find((r) => r.label === 'Issued by').value).toBe('itself (self-signed)')
    expect(certificateRows(null)).toEqual([])
    expect(pinsServerCertificate(CERT)).toBe(false)
    expect(pinsServerCertificate({ chain: [ROOT], fingerprint: FP_ROOT })).toBe(true)
  })
})

describe('the certificate card', () => {
  it('shows the fingerprint and what trusting accepts, asks first, and sends the shown fingerprint', async () => {
    api.trustDatabaseCertificate.mockResolvedValue({ data: { connection: { id: 5, has_trusted_certificate: true } } })
    wrapper = mount(DatabaseCertificateOffer, { props: { connectionId: 5, name: 'Rfam', certificate: CERT }, attachTo: document.body })
    const text = wrapper.text()
    expect(text).toContain('AADML does not trust this server\'s certificate.')
    expect(text).toContain(FP_ROOT)
    expect(text).toContain('authority the server sends (MySQL_Server_Auto_Generated_CA_Certificate)')
    expect(text).toContain('The name cannot be checked')
    expect(text).toContain('openssl x509 -noout -fingerprint -sha256 -in ca.pem')
    await wrapper.find('.tp-btn--primary').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0][0].message).toContain(FP_ROOT)
    expect(api.trustDatabaseCertificate).toHaveBeenCalledWith(5, FP_ROOT)
    expect(wrapper.emitted('trusted')[0][0]).toEqual({ id: 5, has_trusted_certificate: true })
  })

  it('trusts nothing when the person cancels', async () => {
    confirm.mockResolvedValueOnce(false)
    wrapper = mount(DatabaseCertificateOffer, { props: { connectionId: 5, certificate: CERT } })
    await wrapper.find('.tp-btn--primary').trigger('click')
    await flushPromises()
    expect(api.trustDatabaseCertificate).not.toHaveBeenCalled()
  })

  it('reports a certificate that changed since it was shown, and trusts nothing', async () => {
    const now = { ...CERT, fingerprint: 'CC:DD' }
    api.trustDatabaseCertificate.mockRejectedValue({ response: { status: 409, data: { error: 'The server now shows a different certificate', code: 'certificate_changed', certificate: now } } })
    wrapper = mount(DatabaseCertificateOffer, { props: { connectionId: 5, certificate: CERT } })
    await wrapper.find('.tp-btn--primary').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('changed')[0][0]).toEqual(now)
    expect(wrapper.emitted('trusted')).toBeUndefined()
    expect(notify.error).toHaveBeenCalled()
  })

  it('gives the reason and no button when the certificate cannot be pinned', () => {
    const cert = { ...CERT, pinnable: false, fingerprint: null, pin: null, reason: 'Paste that authority\'s certificate in CA certificate instead.' }
    wrapper = mount(DatabaseCertificateOffer, { props: { connectionId: 5, certificate: cert } })
    expect(wrapper.text()).toContain('Paste that authority')
    expect(wrapper.find('.tp-btn--primary').exists()).toBe(false)
  })
})

describe('the Databases list', () => {
  const MINE = { id: 5, name: 'Rfam', engine: 'mysql', engine_label: 'MySQL / MariaDB', access: 'read_only', encryption: 'verified', has_ca_certificate: false, has_trusted_certificate: false, mine: true, can_manage: true, last_test: null }
  beforeEach(() => { api.getDatabaseConnections.mockResolvedValue({ data: { connections: [MINE] } }) })

  it('shows the card after a failed test, and after trusting tests again and says so on the chip', async () => {
    api.testDatabaseConnection
      .mockResolvedValueOnce({ data: { ok: false, code: 'certificate_untrusted', message: 'The server\'s certificate is not trusted.', certificate: CERT } })
      .mockResolvedValueOnce({ data: { ok: true, message: 'Connected.' } })
    api.trustDatabaseCertificate.mockResolvedValue({ data: { connection: { ...MINE, has_trusted_certificate: true } } })
    wrapper = mount(DatabaseConnectionsSection, { attachTo: document.body })
    await flushPromises()
    await wrapper.find('.dcs-actions .tp-btn').trigger('click')
    await flushPromises()
    expect(wrapper.find('.dco').exists()).toBe(true)
    await wrapper.find('.dco .tp-btn--primary').trigger('click')
    await flushPromises()
    expect(api.testDatabaseConnection).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.dco').exists()).toBe(false)
    expect(wrapper.text()).toContain('Encrypted · trusted certificate')
  })
})
