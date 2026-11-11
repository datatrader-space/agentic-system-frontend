// @vitest-environment jsdom
// Deploy to Vercel (ADM-1203): connect the person's OWN Vercel account, deploy a preview, watch it build (steps and
// live log), open it live, publish to production only after confirming, and manage domains and environment
// variables. The window is teleported to <body>.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/services/api', () => ({
  default: {
    getVercelDeployments: vi.fn(), getVercelDeployment: vi.fn(), getVercelConnection: vi.fn(),
    deleteVercelDeployment: vi.fn(), removeVercelProject: vi.fn(),
    startVercelConnect: vi.fn(), disconnectVercel: vi.fn(), deployToVercel: vi.fn(), cancelVercelDeployment: vi.fn(),
    getVercelDomains: vi.fn(), addVercelDomain: vi.fn(), verifyVercelDomain: vi.fn(), removeVercelDomain: vi.fn(),
    getVercelEnv: vi.fn(), setVercelEnv: vi.fn(), deleteVercelEnv: vi.fn(), importVercelEnv: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))
vi.mock('@/composables/useOAuthPopup', () => ({ runOAuthPopup: vi.fn(() => Promise.resolve({ ok: true, status: 'success' })) }))

import api from '@/services/api'
import { confirm } from '@/composables/useConfirm'
import { notify } from '@/composables/useNotify'
import { runOAuthPopup } from '@/composables/useOAuthPopup'
import DeployButton from './DeployButton.vue'

const CONNECTED = { configured: true, connected: true, account_name: 'alice-v', is_team: false, needs_reconnect: false }
const dep = (over = {}) => ({ id: 1, target: 'preview', state: 'READY', active: false, has_build: true,
  url: 'https://my-app-abc.vercel.app', inspector_url: 'https://vercel.com/x/dpl_1', error: '', files_count: 3,
  skipped_paths: [], started_by: 'button', created_at: '2026-11-10T10:00:00Z', ...over })
const $ = (sel) => document.body.querySelector(sel)
const $$ = (sel) => [...document.body.querySelectorAll(sel)]
const button = (text) => $$('button').find((b) => b.textContent.includes(text))
const click = async (el) => { el.click(); await flushPromises() }

let w
async function openWindow(deployments = [], connection = CONNECTED, props = {}) {
  api.getVercelDeployments.mockResolvedValue({ data: { deployments, connection } })
  api.getVercelDeployment.mockResolvedValue({ data: { ...(deployments[0] || {}), log: [] } })
  w = mount(DeployButton, { props: { repoId: 7, projectName: 'Storefront', branch: 'main', ready: true, ...props }, attachTo: document.body })
  await flushPromises()
  await w.find('.dp-trigger').trigger('click')
  await flushPromises()
  return w
}

describe('DeployButton', () => {
  beforeEach(() => { vi.clearAllMocks(); confirm.mockResolvedValue(true) })
  afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

  it('says when deploys are not set up on the server', async () => {
    await openWindow([], { configured: false, connected: false })
    expect($('.dp-dialog').textContent).toContain('not set up on this server')
    expect($('.dp-foot')).toBeNull()
  })

  it('shows the Connect Vercel card with what AADML may do, and opens the popup in the click', async () => {
    await openWindow([], { configured: true, connected: false })
    const card = $('.cv')
    expect(card.textContent).toContain('Connect Vercel')
    expect($$('.cv-perms li').map((li) => li.textContent.trim())).toEqual([
      'Create and update projects', 'Create deployments', 'Read build logs', 'Add custom domains', 'Set environment variables'])
    await click(button('Continue to Vercel'))
    expect(runOAuthPopup).toHaveBeenCalledTimes(1)
    expect(runOAuthPopup.mock.calls[0][1].messageTypes).toEqual(['vercel_connect_result'])
  })

  it('asks to reconnect when the connection stopped working', async () => {
    await openWindow([], { configured: true, connected: false, needs_reconnect: true })
    expect($('.cv-h').textContent).toBe('Reconnect Vercel')
  })

  it('deploys a preview without a confirmation and shows the steps and the live log', async () => {
    api.deployToVercel.mockResolvedValue({ data: dep({ id: 2, state: 'PREPARING', active: true, has_build: false, url: '' }) })
    await openWindow()
    api.getVercelDeployment.mockResolvedValue({ data: dep({ id: 2, state: 'BUILDING', active: true, url: '',
      log: [{ type: 'stdout', created: 1762768450000, text: 'Running "next build"' }] }) })
    await click(button('Deploy preview'))
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(api.deployToVercel).toHaveBeenCalledWith(7, { target: 'preview' })
    const steps = $$('.steps li').map((li) => li.className)
    expect(steps[0]).toBe('done')
    expect(steps[2]).toBe('now')
    expect($('.term-b').textContent).toContain('Running "next build"')
    expect($('.state-pill').textContent).toContain('Building')
  })

  it('publishes to production only after the person confirms', async () => {
    confirm.mockResolvedValueOnce(false)
    await openWindow()
    await click(button('Publish to production'))
    expect(api.deployToVercel).not.toHaveBeenCalled()
    api.deployToVercel.mockResolvedValue({ data: dep({ id: 3, target: 'production', state: 'PREPARING', active: true }) })
    await click(button('Publish to production'))
    expect(confirm.mock.calls[1][0].danger).toBe(true)
    expect(api.deployToVercel).toHaveBeenCalledWith(7, { target: 'production', confirm: true })
  })

  it('a ready deploy shows the Ready bar, branch, URL, Open preview and the live site', async () => {
    await openWindow([dep()])
    expect($('.ready-bar').textContent).toContain('Ready')
    expect($('.ready-bar').textContent).toContain('main')
    expect($('.url').getAttribute('href')).toBe('https://my-app-abc.vercel.app')
    expect(button('Open preview') || $$('a').find((a) => a.textContent.includes('Open preview'))).toBeTruthy()
    const frame = $('.site iframe')
    expect(frame.getAttribute('src')).toBe('https://my-app-abc.vercel.app')
    expect(frame.getAttribute('sandbox')).not.toContain('allow-top-navigation')
  })

  it('a failed build shows where it stopped and why', async () => {
    await openWindow([dep({ state: 'ERROR', url: '', error: 'Command "npm run build" exited with 1' })])
    expect($('.err').textContent).toContain('exited with 1')
    expect($$('.steps li')[2].className).toBe('bad')
  })

  it('names the secret files left out and leads to environment variables', async () => {
    api.getVercelEnv.mockResolvedValue({ data: { env: [] } })
    await openWindow([dep({ skipped_paths: ['.env', 'id_rsa'] })])
    expect($('.kept').textContent).toContain('2 secret files were not uploaded')
    await click(button('Set environment variables'))
    expect($('#dp-tab-env').getAttribute('aria-selected')).toBe('true')
    expect($('.imp').textContent).toContain('.env')                 // offered for copying; id_rsa is not
    expect($$('.imp')).toHaveLength(1)
  })

  it('can cancel a running deploy', async () => {
    api.cancelVercelDeployment.mockResolvedValue({ data: dep({ state: 'CANCELED', active: false }) })
    await openWindow([dep({ state: 'BUILDING', active: true, url: '' })])
    expect(button('Deploy preview').disabled).toBe(true)
    await click(button('Cancel'))
    expect(api.cancelVercelDeployment).toHaveBeenCalledWith(7, 1)
  })

  it('adds a domain and shows the DNS record to create', async () => {
    api.getVercelDomains.mockResolvedValue({ data: { domains: [] } })
    api.addVercelDomain.mockResolvedValue({ data: { name: 'www.shop.com', verified: true, configured: false,
      dns: [{ type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' }], verification: [] } })
    await openWindow([dep()])
    await click($('#dp-tab-domains'))
    const input = $('#dd-name')
    input.value = 'www.shop.com'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    await click(button('Add'))
    expect(api.addVercelDomain).toHaveBeenCalledWith(7, 'www.shop.com')
    expect($('.dns').textContent).toContain('cname.vercel-dns.com')
  })

  it('saves an environment variable and never shows a value', async () => {
    api.getVercelEnv.mockResolvedValue({ data: { env: [{ id: 'e1', key: 'API_KEY', target: ['production'], type: 'sensitive' }] } })
    api.setVercelEnv.mockResolvedValue({ data: { saved: ['DB_URL'], failed: [] } })
    await openWindow([dep()])
    await click($('#dp-tab-env'))
    expect($('.row').textContent).toContain('API_KEY')
    expect($('#de-val').getAttribute('type')).toBe('password')
    $('#de-key').value = 'DB_URL'; $('#de-key').dispatchEvent(new Event('input'))
    $('#de-val').value = 'postgres://secret'; $('#de-val').dispatchEvent(new Event('input'))
    await flushPromises()
    await click(button('Save'))
    expect(api.setVercelEnv).toHaveBeenCalledWith(7, [{ key: 'DB_URL', value: 'postgres://secret', target: ['production', 'preview'] }])
    expect($('#de-val').value).toBe('')
  })

  it('a refused deploy says why', async () => {
    api.deployToVercel.mockRejectedValue({ response: { data: { error: 'A deploy of this project is already running.', code: 'DEPLOY_RUNNING' } } })
    await openWindow()
    await click(button('Deploy preview'))
    expect(notify.error).toHaveBeenCalledWith('A deploy of this project is already running.')
  })

  it('closes on Escape and gives focus back to the button', async () => {
    await openWindow()
    $('.dp-dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect($('.dp-dialog')).toBeNull()
    expect(document.activeElement).toBe(w.find('.dp-trigger').element)
  })

  it('is disabled while the project is still being prepared', async () => {
    api.getVercelDeployments.mockResolvedValue({ data: { deployments: [], connection: CONNECTED } })
    w = mount(DeployButton, { props: { repoId: 7, ready: false } })
    await flushPromises()
    expect(w.find('.dp-trigger').attributes('disabled')).toBeDefined()
  })

  it('a protected preview shows why and a way to open it, not a broken frame', async () => {
    await openWindow([dep({ embeddable: false, protected: true, protection_url: 'https://vercel.com/t/p/settings/deployment-protection' })])
    expect($('.site iframe')).toBeNull()
    expect($('.site-off').textContent).toContain('This preview is protected by Vercel')
    expect($$('.site-off a').map((a) => a.getAttribute('href'))).toEqual(
      ['https://my-app-abc.vercel.app', 'https://vercel.com/t/p/settings/deployment-protection'])
  })

  it('deletes one deployment from History after confirming', async () => {
    api.deleteVercelDeployment.mockResolvedValue({ data: dep({ state: 'DELETED' }) })
    await openWindow([dep()])
    await click($('#dp-tab-history'))
    await click($('.hist-row .dp-ibtn.danger'))
    expect(confirm.mock.calls[0][0].danger).toBe(true)
    expect(api.deleteVercelDeployment).toHaveBeenCalledWith(7, 1)
    expect($('.hist-row').textContent).toContain('Deleted')
    expect($('.hist-row .dp-ibtn.danger')).toBeNull()
  })

  it('removes the project from Vercel only after confirming', async () => {
    api.removeVercelProject.mockResolvedValue({ data: { removed: true } })
    confirm.mockResolvedValueOnce(false)
    await openWindow([dep()])
    await click($('.dp-more .dp-ibtn'))
    await click(button('Remove from Vercel'))
    expect(api.removeVercelProject).not.toHaveBeenCalled()
    await click($('.dp-more .dp-ibtn'))
    await click(button('Remove from Vercel'))
    expect(api.removeVercelProject).toHaveBeenCalledWith(7)
    expect($('.state-pill').textContent).toContain('Deleted')
  })
})
