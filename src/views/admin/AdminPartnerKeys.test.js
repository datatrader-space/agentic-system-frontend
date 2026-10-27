// @vitest-environment jsdom
// Partner Agent API admin page — the "own sign-ins per agent" switch and a key's return addresses (ADM-1082).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  getPartnerKeys: vi.fn(), setPartnerAccountSwitch: vi.fn(), setPartnerReturnOrigins: vi.fn(),
}))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())

vi.mock('../../services/api', () => ({ default: api }))
vi.mock('../../composables/useNotify', () => ({ notify }))
vi.mock('../../composables/useConfirm', () => ({ confirm, useConfirm: () => confirm }))

import AdminPartnerKeys from './AdminPartnerKeys.vue'

const KEY = { id: 3, name: 'Kurumera', key_hint: '…ab12', revoked: false, request_count: 5, user_id: 213,
              user_label: 'waqar@example.test', is_partner_account: false, allowed_return_origins: [] }

const mountPage = async (key = KEY) => {
  api.getPartnerKeys.mockResolvedValue({ data: { keys: [key], base_url: '/api/partner/agents/' } })
  const w = mount(AdminPartnerKeys)
  await flushPromises()
  return w
}
const button = (w, text) => w.findAll('button').find(b => b.text().trim().startsWith(text))

beforeEach(() => { vi.clearAllMocks() })

describe('own sign-ins per agent', () => {
  it('shows the switch as an accessible switch, off', async () => {
    const w = await mountPage()
    const sw = w.get('[role="switch"]')
    expect(sw.attributes('aria-checked')).toBe('false')
    expect(sw.attributes('aria-label')).toContain('waqar@example.test')
  })

  it('asks first, then turns it on for the partner account', async () => {
    confirm.mockResolvedValue(true)
    api.setPartnerAccountSwitch.mockResolvedValue({ data: { is_partner_account: true } })
    const w = await mountPage()
    await w.get('[role="switch"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0][0].confirmText).toBe('Turn on')
    expect(api.setPartnerAccountSwitch).toHaveBeenCalledWith(213, true)
    expect(notify.success).toHaveBeenCalled()
  })

  it('changes nothing when the confirmation is declined', async () => {
    confirm.mockResolvedValue(false)
    const w = await mountPage()
    await w.get('[role="switch"]').trigger('click')
    await flushPromises()
    expect(api.setPartnerAccountSwitch).not.toHaveBeenCalled()
  })

  it('turning it off is marked as the riskier choice', async () => {
    confirm.mockResolvedValue(true)
    api.setPartnerAccountSwitch.mockResolvedValue({ data: {} })
    const w = await mountPage({ ...KEY, is_partner_account: true })
    expect(w.get('[role="switch"]').attributes('aria-checked')).toBe('true')
    await w.get('[role="switch"]').trigger('click')
    await flushPromises()
    expect(confirm.mock.calls[0][0].danger).toBe(true)
    expect(api.setPartnerAccountSwitch).toHaveBeenCalledWith(213, false)
  })
})

describe('return addresses', () => {
  it('saves one address per line, without blanks', async () => {
    api.setPartnerReturnOrigins.mockResolvedValue({ data: {} })
    const w = await mountPage()
    await button(w, 'Return addresses').trigger('click')
    await w.get('textarea').setValue(' https://*.kurumera.com \n\nhttps://shop.example.com\n')
    await button(w, 'Save addresses').trigger('click')
    await flushPromises()
    expect(api.setPartnerReturnOrigins).toHaveBeenCalledWith(3, ['https://*.kurumera.com', 'https://shop.example.com'])
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('keeps the dialog open and says why when the server refuses an address', async () => {
    api.setPartnerReturnOrigins.mockRejectedValue({ response: { data: { detail: '"http://x" must be an https origin' } } })
    const w = await mountPage()
    await button(w, 'Return addresses').trigger('click')
    await w.get('textarea').setValue('http://x')
    await button(w, 'Save addresses').trigger('click')
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(true)
    expect(w.get('[role="alert"]').text()).toContain('https origin')
  })

  it('shows how many addresses a key has', async () => {
    const w = await mountPage({ ...KEY, allowed_return_origins: ['https://a.test', 'https://b.test'] })
    expect(button(w, 'Return addresses').text()).toContain('(2)')
  })
})

describe('connect a connector without the chat', () => {
  it('lists the four routes as full addresses and copies one as it is', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = await mountPage()
    const rows = w.findAll('.pk-copy-row')
    expect(rows.map(r => r.get('.pk-q-k').text()))
      .toEqual(['List connectors', 'Get a sign-in link', 'Check one sign-in', 'Remove a sign-in'])
    const link = rows[1].get('code').text()
    expect(link).toContain(`POST ${window.location.origin}/api/partner/agents/<agent_id>/connections/connect/`)
    await rows[1].get('button').trigger('click')
    expect(writeText).toHaveBeenCalledWith(link)
    expect(notify.success).toHaveBeenCalledWith('Copied')
  })
})
