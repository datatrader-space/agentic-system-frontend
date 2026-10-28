// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const query = vi.hoisted(() => ({ value: {} }))
const replace = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => ({ query: query.value }), useRouter: () => ({ replace }) }))
const api = vi.hoisted(() => ({
  billingWallet: vi.fn(),
  billingEntries: vi.fn(() => Promise.resolve({ data: { entries: [], next_before: null } })),
  billingTopUp: vi.fn(),
  billingTopUpStatus: vi.fn(),
}))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }))

import Billing from './Billing.vue'

const wallet = (balance, extra = {}) => ({ data: {
  wallet: { balance_usd: balance, balance_exact_usd: balance, held_usd: '0.00', available_usd: balance, exempt: false },
  settings: { min_topup_usd: '5.00', max_topup_usd: '500.00', preset_amounts: [5, 10, 25, 50], low_balance_usd: '1.00' },
  payments_configured: true, topups: [], ...extra } })

let w
beforeEach(() => { vi.clearAllMocks(); query.value = {} })
afterEach(() => w?.unmount())

describe('Billing', () => {
  it('shows the balance and says when it is empty', async () => {
    api.billingWallet.mockResolvedValue(wallet('0.00'))
    w = mount(Billing); await flushPromises()
    expect(w.find('.balance').text()).toBe('$0.00')
    expect(w.text()).toContain('Your balance is empty')
  })

  it('tops up a preset amount through Stripe, and never credits by itself', async () => {
    api.billingWallet.mockResolvedValue(wallet('3.00'))
    api.billingTopUp.mockReturnValue(new Promise(() => {}))
    w = mount(Billing); await flushPromises()
    await w.findAll('.preset')[2].trigger('click')                  // $25
    expect(w.find('button[type="submit"]').text()).toContain('Add $25')
    await w.find('form').trigger('submit')
    expect(api.billingTopUp).toHaveBeenCalledWith('25')
    expect(w.find('.balance').text()).toBe('$3.00')
  })

  it('refuses a custom amount outside the limits before asking the server', async () => {
    api.billingWallet.mockResolvedValue(wallet('3.00'))
    w = mount(Billing); await flushPromises()
    const input = w.find('#topup-amount')
    await input.trigger('focus'); await input.setValue('2'); await input.trigger('blur')
    expect(w.text()).toContain('The smallest top-up is $5.00.')
    expect(w.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await input.setValue('12.345'); await input.trigger('blur')
    expect(w.text()).toContain('Enter dollars')
  })

  it('has no top-up form when payments are not configured', async () => {
    api.billingWallet.mockResolvedValue(wallet('1.00', { payments_configured: false }))
    w = mount(Billing); await flushPromises()
    expect(w.find('form').exists()).toBe(false)
    expect(w.text()).toContain('Payments are not configured yet')
  })

  it('back from Stripe, it waits for the confirmation before saying the money arrived', async () => {
    query.value = { status: 'success', topup: '7' }
    api.billingWallet.mockResolvedValue(wallet('1.00'))
    api.billingTopUpStatus.mockResolvedValue({ data: { topup: { status: 'paid', amount_usd: '10.00' },
      wallet: { balance_usd: '11.00', balance_exact_usd: '11', held_usd: '0.00', available_usd: '11.00' } } })
    w = mount(Billing); await flushPromises()
    expect(api.billingTopUpStatus).toHaveBeenCalledWith('7')
    expect(w.text()).toContain('$10.00 was added to your balance.')
    expect(w.find('.balance').text()).toBe('$11.00')
  })
})
