// @vitest-environment jsdom
// Single sign-on settings (ADM-1248): domains are verified by a DNS TXT record; a connection's secret is write-only;
// people who are not the organization's owners or admins are told so.
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
import api from '../../services/api'
import OrgSsoSettings from './OrgSsoSettings.vue'

const domain = { id: 4, domain: 'acme.com', verified: false, verified_at: null, txt_name: '_aadml-verification.acme.com', txt_value: 'aadml-verification=abc', last_error: '' }
const conn = { id: 5, protocol: 'oidc', name: 'Acme Okta', slug: 'acme-okta', enabled: true, enforced: false, default_role: 'member', issuer_url: 'https://acme.okta.com', client_id: 'cid', has_client_secret: true, redirect_uri: 'https://aadml.com/api/auth/sso/oidc/acme-okta/login/callback/' }
function route(url) {
  if (url.endsWith('/domains/')) return Promise.resolve({ data: { domains: [domain] } })
  if (url.endsWith('/sso/')) return Promise.resolve({ data: { connections: [conn] } })
  return Promise.reject(new Error(url))
}

describe('OrgSsoSettings', () => {
  beforeEach(() => { vi.clearAllMocks(); api.get.mockImplementation(route) })

  it('shows the TXT record to add and verifies the domain', async () => {
    api.post.mockResolvedValue({ data: { ...domain, verified: true, verified_at: '2026-11-17T00:00:00Z' } })
    const w = mount(OrgSsoSettings, { props: { orgSlug: 'acme' } }); await flushPromises()
    expect(w.text()).toContain('_aadml-verification.acme.com'); expect(w.text()).toContain('aadml-verification=abc')
    await w.get('[data-test="sso-verify"]').trigger('click'); await flushPromises()
    expect(api.post.mock.calls[0][0]).toBe('/v2/orgs/acme/domains/4/verify/')
    expect(w.text()).toContain('acme.com is verified.')
  })

  it('shows the redirect URI to register and keeps the saved secret when it is left blank', async () => {
    api.patch.mockResolvedValue({ data: conn })
    const w = mount(OrgSsoSettings, { props: { orgSlug: 'acme' } }); await flushPromises()
    expect(w.text()).toContain(conn.redirect_uri)
    await w.findAll('button').find(b => b.text() === 'Edit').trigger('click')
    expect(w.get('input[type="password"]').attributes('placeholder')).toContain('Leave blank to keep it')
    await w.get('[data-test="sso-form"]').trigger('submit'); await flushPromises()
    const body = api.patch.mock.calls[0][1]
    expect(api.patch.mock.calls[0][0]).toBe('/v2/orgs/acme/sso/5/')
    expect(body).not.toHaveProperty('client_secret')
    expect(body.issuer_url).toBe('https://acme.okta.com')
  })

  it('warns what requiring SSO does before it is saved', async () => {
    const w = mount(OrgSsoSettings, { props: { orgSlug: 'acme' } }); await flushPromises()
    await w.get('[data-test="sso-new"]').trigger('click')
    const checks = w.findAll('[data-test="sso-form"] input[type="checkbox"]')
    await checks[1].setValue(true)
    expect(w.text()).toContain('owners can still sign in with their password')
  })

  it('tells someone who is not an owner or admin', async () => {
    api.get.mockRejectedValue({ response: { status: 403, data: { error: 'permission_denied' } } })
    const w = mount(OrgSsoSettings, { props: { orgSlug: 'acme' } }); await flushPromises()
    expect(w.get('[data-test="sso-forbidden"]').text()).toContain('Only this organization’s owners and admins')
  })
})
