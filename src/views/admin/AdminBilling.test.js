// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({ replace: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' } }))
const api = vi.hoisted(() => ({
  billingAdminSpendSummary: vi.fn(),
  billingAdminCharges: vi.fn(),
  billingAdminChargesCsv: vi.fn(),
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

let w
beforeEach(() => {
  vi.clearAllMocks()
  api.billingAdminSpendSummary.mockResolvedValue({ data: summary })
  api.billingAdminCharges.mockResolvedValue({ data: { charges: [charge], next_before: null } })
})
afterEach(() => w?.unmount())

describe('Admin billing: every cent traced', () => {
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
