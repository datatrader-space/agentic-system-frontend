// @vitest-environment jsdom
// The OAuth providers admin page (ADM-1151): it replaced the provider controls of the retired Connections page.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  getConnectionProviders: vi.fn(), updateProvider: vi.fn(), configureProvider: vi.fn(), deleteProvider: vi.fn(),
}))
const router = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('vue-router', () => ({ useRouter: () => router }))
import AdminOAuthProviders from './AdminOAuthProviders.vue'

const GOOGLE = { slug: 'google', name: 'Google', category: 'productivity', icon: 'logos:google-icon', enabled: true,
  has_credentials: true, authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_url: 'https://oauth2.googleapis.com/token', default_scopes: ['openid'],
  available_scopes: [{ scope: 'openid', label: 'Sign in', risk: 'low' }, { scope: 'email', label: 'Email', risk: 'low' }],
  extra_auth_params: { prompt: 'consent' }, services: [{ id: 27, name: 'Google', slug: 'google' }], connection_count: 1 }
const SLACK = { slug: 'slack', name: 'Slack', icon: '', enabled: false, has_credentials: false,
  authorization_url: 'https://slack.com/oauth/v2/authorize', token_url: 'https://slack.com/api/oauth.v2.access',
  default_scopes: [], available_scopes: [], extra_auth_params: {}, services: [], connection_count: 0 }

let wrapper
const notify = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  api.getConnectionProviders.mockResolvedValue({ data: [GOOGLE, SLACK] })
  api.updateProvider.mockResolvedValue({ data: {} })
  api.deleteProvider.mockResolvedValue({ data: {} })
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

async function render() {
  wrapper = mount(AdminOAuthProviders, { attachTo: document.body,
    global: { provide: { notify }, stubs: { Icon: { template: '<i />' } } } })
  await flushPromises()
  return wrapper
}

describe('OAuth providers admin page', () => {
  it('lists each provider with what uses it, its client and its status', async () => {
    const w = await render()
    const google = w.get('[data-provider="google"]').text()
    expect(google).toContain('Google')
    expect(google).toContain('Set')
    expect(google).toContain('Enabled')
    const slack = w.get('[data-provider="slack"]').text()
    expect(slack).toContain('No connector')
    expect(slack).toContain('Missing')
    expect(slack).toContain('Disabled')
  })

  it('does not offer to delete a provider a connector signs in through', async () => {
    const w = await render()
    await w.get('[aria-label="Delete Google"]').trigger('click')
    const dialog = w.get('[role="dialog"]')
    expect(dialog.text()).toContain('can’t be deleted while these connectors sign in through it')
    expect(dialog.findAll('button').map(b => b.text())).not.toContain('Delete')
  })

  it('deletes a provider nothing uses', async () => {
    const w = await render()
    await w.get('[aria-label="Delete Slack"]').trigger('click')
    const del = w.get('[role="dialog"]').findAll('button').find(b => b.text() === 'Delete')
    await del.trigger('click')
    await flushPromises()
    expect(api.deleteProvider).toHaveBeenCalledWith('slack')
  })

  it('saves an edit with its scopes and extra parameters', async () => {
    const w = await render()
    await w.get('[aria-label="Edit Google"]').trigger('click')
    await w.get('#op-name').setValue('Google Workspace')
    await w.get('form[role="dialog"]').trigger('submit')
    await flushPromises()
    const [slug, body] = api.updateProvider.mock.calls[0]
    expect(slug).toBe('google')
    expect(body.name).toBe('Google Workspace')
    expect(body.default_scopes).toEqual(['openid'])
    expect(body.available_scopes.map(s => s.scope)).toEqual(['openid', 'email'])
    expect(body.extra_auth_params).toEqual({ prompt: 'consent' })
  })

  it('shows the server’s refusal in the form', async () => {
    api.updateProvider.mockRejectedValueOnce({ response: { data: { error: 'token_url must be an https:// URL' } } })
    const w = await render()
    await w.get('[aria-label="Edit Google"]').trigger('click')
    await w.get('form[role="dialog"]').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('token_url must be an https:// URL')
  })

  it('refuses extra parameters that are not a JSON object', async () => {
    const w = await render()
    await w.get('[aria-label="Edit Google"]').trigger('click')
    await w.get('#op-extra').setValue('[1, 2]')
    await w.get('form[role="dialog"]').trigger('submit')
    await flushPromises()
    expect(api.updateProvider).not.toHaveBeenCalled()
    expect(w.get('[role="alert"]').text()).toContain('JSON object')
  })

  it('saves a new client', async () => {
    api.configureProvider.mockResolvedValue({ data: {} })
    const w = await render()
    await w.get('[aria-label="Set the client for Slack"]').trigger('click')
    await w.get('#op-cid').setValue('cid-1')
    await w.get('#op-csecret').setValue('secret-1')
    await w.get('form[role="dialog"]').trigger('submit')
    await flushPromises()
    expect(api.configureProvider).toHaveBeenCalledWith('slack', { client_id: 'cid-1', client_secret: 'secret-1' })
  })
})
