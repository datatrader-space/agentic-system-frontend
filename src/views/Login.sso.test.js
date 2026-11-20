// @vitest-environment jsdom
// Single sign-on on the sign-in page (ADM-1248): the work email finds the organization's identity provider; a password
// sign-in refused because the organization requires SSO offers to continue with it.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ name: 'login', query: {}, fullPath: '/login' }),
}))
vi.mock('../services/api', () => ({
  default: { login: vi.fn(), register: vi.fn(), resendVerification: vi.fn(), post: vi.fn(), get: vi.fn(() => Promise.resolve({ data: { providers: [] } })) },
}))
import api from '../services/api'
import Login from './Login.vue'

const stubs = { BrandMark: true, RouterLink: { template: '<a><slot /></a>' } }
let assigned = ''
beforeEach(() => {
  vi.clearAllMocks(); assigned = ''
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, hash: '', pathname: '/login', search: '', set href(v) { assigned = v }, get href() { return assigned } } })
})

describe('Login — single sign-on', () => {
  it('sends a work email with SSO to its identity provider', async () => {
    api.post.mockResolvedValue({ data: { sso: true, redirect_url: '/api/auth/sso/oidc/acme-okta/login/?process=login' } })
    const w = mount(Login, { global: { stubs } }); await flushPromises()
    await w.get('[data-test="login-sso"]').trigger('click')
    await w.get('#sso-email').setValue('pat@acme.com')
    await w.get('[data-test="login-sso-form"]').trigger('submit'); await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/auth/sso/discover/', { email: 'pat@acme.com' })
    expect(assigned).toBe('/api/auth/sso/oidc/acme-okta/login/?process=login')
  })

  it('says when an email has no SSO', async () => {
    api.post.mockResolvedValue({ data: { sso: false } })
    const w = mount(Login, { global: { stubs } }); await flushPromises()
    await w.get('[data-test="login-sso"]').trigger('click')
    await w.get('#sso-email').setValue('pat@gmail.com')
    await w.get('[data-test="login-sso-form"]').trigger('submit'); await flushPromises()
    expect(w.get('[data-test="login-sso-message"]').text()).toContain('not set up for this email')
    expect(assigned).toBe('')
  })

  it('offers SSO when the password sign-in is refused because the organization requires it', async () => {
    api.login.mockRejectedValue({ response: { status: 403, data: { error: 'Your organization requires single sign-on.', code: 'sso_required', redirect_url: '/api/auth/sso/saml/acme/login/' } } })
    const w = mount(Login, { global: { stubs } }); await flushPromises()
    await w.find('input[type=text]').setValue('pat@acme.com')
    await w.find('input[type=password]').setValue('Secret-2026!x')
    await w.find('form.login-form').trigger('submit.prevent'); await flushPromises()
    expect(w.text()).toContain('Your organization requires single sign-on.')
    await w.get('[data-test="login-sso-form"]').trigger('submit'); await flushPromises()
    expect(assigned).toBe('/api/auth/sso/saml/acme/login/')
    expect(api.post).not.toHaveBeenCalled()
  })
})
