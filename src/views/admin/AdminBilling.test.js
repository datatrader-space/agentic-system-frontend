// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({ replace: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' } }))
const api = vi.hoisted(() => ({
  billingAdminSpendSummary: vi.fn(),
  billingAdminCharges: vi.fn(),
  billingAdminChargesCsv: vi.fn(),
  billingAdminSettings: vi.fn(),
  billingAdminSaveSettings: vi.fn(),
  billingAdminWallets: vi.fn(),
  billingAdminWallet: vi.fn(),
  billingAdminAdjust: vi.fn(),
  billingAdminPricingCoverage: vi.fn(),
  billingAdminRevenue: vi.fn(),
}))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('../../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }))

import AdminBilling from './AdminBilling.vue'

const summary = { group_by: 'user', total_charged_usd: '0.7', total_cost_usd: '0.56', total_margin_usd: '0.14',
  groups: [{ key: { wallet__user_id: 7, wallet__user__username: 'ben', wallet__user__email: 'ben@x.com' }, count: 1,
    charged_usd: '0.5', cost_usd: '0.4', margin_usd: '0.1', prompt_tokens: 100, completion_tokens: 50 }] }
const charge = { id: 31, created_at: '2026-10-27T10:00:00Z', kind: 'charge', usage_kind: 'llm', user_id: 7, username: 'ben',
  email: 'ben@x.com', amount_usd: '-0.5', provider_cost_usd: '0.4', markup: '1.25', balance_after_usd: '0.5',
  description: 'AI model: m-a', provider: 'openrouter', model: 'm-a', agent_id: 3, agent_name: 'Helper',
  conversation_id: 12, billing_run_id: 'r1', prompt_tokens: 100, completion_tokens: 50, source_type: 'llm_request_log',
  source_id: '99', llm_request_log_id: 99, reason: '', actor_id: null, idempotency_key: 'llm:99' }

const settings = () => ({ markup: '1.25', min_topup_usd: '5', max_topup_usd: '500', preset_amounts: [10, 25],
  starting_credit_usd: '1', low_balance_usd: '2', training_photo_call_usd: '0.002',
  training_chat_input_per_1m_usd: '0.15', training_chat_output_per_1m_usd: null })

let w
beforeEach(() => {
  vi.clearAllMocks()
  api.billingAdminSpendSummary.mockResolvedValue({ data: summary })
  api.billingAdminCharges.mockResolvedValue({ data: { charges: [charge], next_before: null } })
  api.billingAdminSettings.mockResolvedValue({ data: { settings: settings() } })
  api.billingAdminSaveSettings.mockResolvedValue({ data: { settings: settings() } })
  api.billingAdminWallets.mockResolvedValue({ data: { wallets: [{ wallet_id: 1, user_id: 7, username: 'ben', email: 'ben@example.test', balance_usd: '0.00000017', held_usd: '2', exempt: false }], next_before: null } })
  api.billingAdminWallet.mockResolvedValue({ data: { user: { id: 7, username: 'ben', email: 'ben@example.test' }, wallet: { balance_usd: '0.00000017' }, entries: [charge], holds: [], next_before: null } })
  api.billingAdminPricingCoverage.mockResolvedValue({ data: { total: 3, missing: 1, models: [
    { provider_id: 1, model_id: 'paid', name: 'Paid model', status: 'priced', price: { per_item_usd: '0.01' } },
    { provider_id: 1, model_id: 'missing', name: 'Unpriced model', status: 'missing' },
    { provider_id: 2, model_id: 'local', name: 'Local model', status: 'local_free' },
  ] } })
  api.billingAdminRevenue.mockResolvedValue({ data: { charged_usd: '0.00000017', provider_cost_usd: '0.00000014', by_usage_kind: { llm: { cost_usd: '0.00000014', charged_usd: '0.00000017' } } } })
})
afterEach(() => w?.unmount())

describe('Admin billing: every cent traced', () => {
  it('drops a late usage response after a newer filter request has completed', async () => {
    let resolveOld
    api.billingAdminSpendSummary.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
    w = mount(AdminBilling); await flushPromises()
    api.billingAdminSpendSummary.mockResolvedValueOnce({ data: { ...summary, total_charged_usd: '9' } })
    await w.find('input[placeholder="Anyone"]').setValue('new person')
    await w.find('form.usage-filters').trigger('submit'); await flushPromises()
    expect(w.find('.usage-kpis').text()).toContain('$9.00')
    resolveOld({ data: summary }); await flushPromises()
    expect(w.find('.usage-kpis').text()).toContain('$9.00')
    expect(w.find('.usage-kpis').text()).not.toContain('$0.70')
  })

  it('offers an inline retry for failed usage without showing a false empty state', async () => {
    api.billingAdminCharges.mockRejectedValueOnce(new Error('unavailable'))
    w = mount(AdminBilling); await flushPromises()
    expect(w.get('.billing-load-error').text()).toContain('Could not load usage')
    expect(w.find('[aria-label="Loading usage totals"]').exists()).toBe(false)
    expect(w.text()).not.toContain('No entries.')
    await w.get('.billing-load-error button').trigger('click'); await flushPromises()
    expect(w.find('.billing-load-error').exists()).toBe(false)
    expect(w.find('.usage-kpis').text()).toContain('$0.70')
  })

  it('blocks duplicate adjustments and respects leaving the wallet while a save completes', async () => {
    let finish
    api.billingAdminAdjust.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    w = mount(AdminBilling); await flushPromises()
    await w.find('#tab-wallets').trigger('click'); await flushPromises()
    await w.find('button[aria-label="Open wallet for ben"]').trigger('click'); await flushPromises()
    await w.findAll('.adjust input')[0].setValue('5')
    await w.findAll('.adjust input')[1].setValue('Customer service credit')
    await w.find('.adjust').trigger('submit')
    await w.find('.adjust').trigger('submit')
    expect(api.billingAdminAdjust).toHaveBeenCalledExactlyOnceWith(7, '5', 'Customer service credit')
    await w.find('.back').trigger('click')
    finish({ data: {} }); await flushPromises()
    expect(w.find('.wallet-toolbar').exists()).toBe(true)
    expect(w.find('.who').exists()).toBe(false)
  })
  it('keeps advanced filters in the query and clears them together', async () => {
    w = mount(AdminBilling); await flushPromises()
    await w.find('input[placeholder="e.g. openrouter"]').setValue('openrouter')
    await w.find('input[placeholder="exact model id"]').setValue('model-a')
    await w.find('form.usage-filters').trigger('submit'); await flushPromises()
    expect(api.billingAdminCharges).toHaveBeenLastCalledWith({ kind: 'charge', provider: 'openrouter', model: 'model-a' })
    await w.findAll('button').find(b => b.text() === 'Clear').trigger('click'); await flushPromises()
    expect(api.billingAdminCharges).toHaveBeenLastCalledWith({ kind: 'charge' })
  })

  it('supports keyboard navigation and activates the corresponding panel', async () => {
    w = mount(AdminBilling, { attachTo: document.body }); await flushPromises()
    await w.find('#tab-usage').trigger('keydown', { key: 'End' }); await flushPromises()
    expect(w.find('#tab-revenue').attributes('aria-selected')).toBe('true')
    expect(document.activeElement.id).toBe('tab-revenue')
    expect(w.find('#panel-revenue').exists()).toBe(true)
    await w.find('#tab-revenue').trigger('keydown', { key: 'ArrowRight' }); await flushPromises()
    expect(w.find('#tab-usage').attributes('tabindex')).toBe('0')
    expect(w.find('#tab-settings').attributes('tabindex')).toBe('-1')
  })

  it('opens wallet details without changing a balance and returns to the list', async () => {
    w = mount(AdminBilling); await flushPromises()
    await w.find('#tab-wallets').trigger('click'); await flushPromises()
    await w.find('button[aria-label="Open wallet for ben"]').trigger('click'); await flushPromises()
    expect(w.find('.big').text()).toBe('$0.00000017')
    expect(w.find('.adjust button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(api.billingAdminAdjust).not.toHaveBeenCalled()
    await w.find('.back').trigger('click')
    expect(w.find('.wallet-toolbar').exists()).toBe(true)
  })

  it('separates missing prices from priced and free local models', async () => {
    w = mount(AdminBilling); await flushPromises()
    await w.find('#tab-pricing').trigger('click'); await flushPromises()
    expect(w.findAll('.coverage-kpis strong').map(e => e.text())).toEqual(['3', '1', '1'])
    expect(w.find('#panel-pricing tbody').text()).toContain('Unpriced model')
    expect(w.find('#panel-pricing tbody').text()).not.toContain('Local model')
    await w.findAll('#panel-pricing .chip')[1].trigger('click')
    expect(w.find('#panel-pricing tbody').text()).toContain('Free (local)')
  })

  it('preserves sub-cent revenue and scales comparison bars without invalid widths', async () => {
    w = mount(AdminBilling); await flushPromises()
    await w.find('#tab-revenue').trigger('click'); await flushPromises()
    expect(w.find('.revenue-kpis').text()).toContain('$0.00000017')
    expect(w.find('.revenue-kpis').text()).toContain('$0.00000003')
    expect(w.find('.chart-bar.charged').attributes('style')).toContain('width: 100%')
    api.billingAdminRevenue.mockResolvedValue({ data: { by_usage_kind: {} } })
    await w.find('.days select').setValue(7); await flushPromises()
    expect(api.billingAdminRevenue).toHaveBeenLastCalledWith(7)
    expect(w.find('.usage-chart').exists()).toBe(false)
    expect(w.text()).toContain('No usage in this period.')
  })
  it('opens on Usage & charges with totals, groups and every entry', async () => {
    w = mount(AdminBilling); await flushPromises()
    expect(api.billingAdminSpendSummary).toHaveBeenCalledWith({ kind: 'charge', group_by: 'user' })
    expect(api.billingAdminCharges).toHaveBeenCalledWith({ kind: 'charge' })
    expect(w.text()).toContain('$0.70')                  // charged
    expect(w.text()).toContain('ben (ben@x.com)')
    expect(w.text()).toContain('m-a')
  })

  it('a group narrows the entries to it, and an entry opens its full trace', async () => {
    w = mount(AdminBilling); await flushPromises()
    await w.findAll('tr.clickable')[0].trigger('click')    // the person 'ben'
    await flushPromises()
    expect(api.billingAdminCharges).toHaveBeenLastCalledWith({ kind: 'charge', user: 7 })
    const entry = w.findAll('tr.clickable').find(r => r.text().includes('AI model: m-a'))
    await entry.trigger('click')
    const trace = w.find('.trace').text()
    expect(trace).toContain('request log #99')
    expect(trace).toContain('cost $0.4 × markup 1.25 = -0.5')
    expect(trace).toContain('Helper')
  })
})

describe('Admin billing settings: Training API prices', () => {
  async function openSettings() {
    w = mount(AdminBilling, { attachTo: document.body }); await flushPromises()
    await w.find('#tab-settings').trigger('click'); await flushPromises()
  }

  it('shows the three prices as loaded, each with its label and help', async () => {
    await openSettings()
    expect(w.find('fieldset legend').text()).toBe('Training API prices')
    const photo = w.find('#f-training_photo_call_usd')
    expect(photo.element.value).toBe('0.002')
    expect(w.find('#f-training_chat_input_per_1m_usd').element.value).toBe('0.15')
    expect(w.find('#f-training_chat_output_per_1m_usd').element.value).toBe('')    // null: not set
    expect(w.find('label[for="f-training_photo_call_usd"]').text()).toContain('Cost of one photo call')
    expect(photo.attributes('aria-describedby')).toBe('h-training_photo_call_usd')
    expect(w.find('#h-training_photo_call_usd').text()).toContain('Empty: photo calls are refused.')
    expect(w.find('#h-training_chat_output_per_1m_usd').text()).toContain('Empty: chat calls are refused.')
  })

  it('an emptied price is sent as null, never 0; a set one as its number string', async () => {
    await openSettings()
    await w.find('#f-training_photo_call_usd').setValue('   ')
    await w.find('#f-training_chat_output_per_1m_usd').setValue('0.6')
    await w.find('form.grid-form').trigger('submit'); await flushPromises()
    const sent = api.billingAdminSaveSettings.mock.calls[0][0]
    expect(sent.training_photo_call_usd).toBeNull()
    expect(sent.training_chat_input_per_1m_usd).toBe('0.15')
    expect(sent.training_chat_output_per_1m_usd).toBe('0.6')
    expect(sent.markup).toBe('1.25')                       // the other settings still go with it
  })

  it('a 400 field error is shown next to that field and tied to it', async () => {
    api.billingAdminSaveSettings.mockRejectedValue({ response: { status: 400,
      data: { error: 'invalid', fields: { training_chat_input_per_1m_usd: 'At most 1000.' } } } })
    await openSettings()
    await w.find('#f-training_chat_input_per_1m_usd').setValue('5000')
    await w.find('form.grid-form').trigger('submit'); await flushPromises()
    const err = w.find('#e-training_chat_input_per_1m_usd')
    expect(err.exists()).toBe(true)
    expect(err.text()).toBe('At most 1000.')
    expect(err.attributes('role')).toBe('alert')
    expect(err.element.closest('label').getAttribute('for')).toBe('f-training_chat_input_per_1m_usd')
    const input = w.find('#f-training_chat_input_per_1m_usd')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe('h-training_chat_input_per_1m_usd e-training_chat_input_per_1m_usd')
    expect(w.find('#e-training_photo_call_usd').exists()).toBe(false)
  })
})
