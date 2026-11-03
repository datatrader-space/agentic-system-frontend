// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ billingAdminInfraCost: vi.fn(), billingAdminInfraCostRefresh: vi.fn() }))
const notify = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('../../composables/useNotify', () => ({ notify }))
vi.mock('vue-chartjs', () => ({ Bar: { props: ['data', 'options'], template: '<canvas class="bar-stub" />' } }))

import AdminInfraCost from './AdminInfraCost.vue'

const figures = (extra = {}) => ({
  currency: 'USD', total_usd: '23.00', shared_usd: '1.25', account_total_usd: '32.40',
  by_service: [{ name: 'Amazon EC2', label: 'Amazon EC2', usd: '20.50' }],
  shared_by_service: [{ name: 'Amazon S3', label: 'Amazon S3', usd: '1.25' }],
  by_tag: { platform: [{ name: 'aadml', label: 'AADML', usd: '23.00' }, { name: 'kurumera', label: "Kurumera (not AADML's)", usd: '7.00' }] },
  daily: [{ date: '2026-11-01', usd: '13.00', shared_usd: '1.25' }, { date: '2026-11-02', usd: '10.00', shared_usd: '0.00' }],
  forecast: { usd: '120.00', error: '' }, ...extra,
})
const page = (over = {}) => ({
  month: '2026-11', current_month: true, months: ['2026-11', '2026-10'], fresh_seconds: 21600,
  refresh: { min_interval_seconds: 1800, wait_seconds: 0, next_allowed_at: null },
  accounts: [
    { key: 'aadml', name: 'AADML account', account_id: '627073650116', region: 'us-west-1', holds: 'Production box',
      tag_keys: ['platform'], own_tag: { key: 'platform', value: 'aadml' }, status: 'ok', error_code: '', error: '',
      fetched_at: '2026-11-03T10:00:00Z', final: false, requests: 2, figures: figures(),
      customers: { usage_kinds: ['sandbox'], charged_usd: '0.10', recorded_cost_usd: '0.08', by_usage_kind: {}, held_now_usd: '0.00' } },
    { key: 'ml', name: 'AADML ML account', account_id: '392894085225', region: 'us-west-2', holds: 'SageMaker',
      tag_keys: ['aadml-kind', 'project'], own_tag: null, status: 'error', error_code: 'permission_missing',
      error: 'The role aadml-control is not allowed to read Cost Explorer: it needs ce:GetCostAndUsage.',
      fetched_at: null, final: false, requests: 1, figures: null,
      customers: { usage_kinds: ['training', 'serving'], charged_usd: '0.50', recorded_cost_usd: '0.40', by_usage_kind: {} } },
  ],
  ...over,
})

beforeEach(() => { vi.clearAllMocks(); api.billingAdminInfraCost.mockResolvedValue({ data: page() }) })

describe('AdminInfraCost', () => {
  it('shows both accounts side by side, AADML’s own share with shared apart, and a missing permission in words', async () => {
    const w = mount(AdminInfraCost)
    await flushPromises()
    expect(api.billingAdminInfraCost).toHaveBeenCalledTimes(1)
    const text = w.text()
    expect(text).toContain('AADML account')
    expect(text).toContain('AADML ML account')
    expect(text).toContain("AADML's own")
    expect(text).toContain('$23.00')
    expect(text).toContain('$1.25')
    expect(text).toContain("Kurumera (not AADML's)")
    expect(text).toContain('needs ce:GetCostAndUsage')
    expect(text).toContain('Not read yet')
    expect(w.findAll('.bar-stub')).toHaveLength(1)
    expect(w.find('[role="alert"]').exists()).toBe(true)
  })

  it('picks another month and asks the server for it', async () => {
    const w = mount(AdminInfraCost)
    await flushPromises()
    await w.find('select').setValue('2026-10')
    await flushPromises()
    expect(api.billingAdminInfraCost).toHaveBeenLastCalledWith('2026-10')
  })

  it('a refused refresh says when it may run again and turns the button off', async () => {
    api.billingAdminInfraCostRefresh.mockRejectedValue({ response: { status: 429, data: {
      error: 'refresh_too_soon', retry_after_seconds: 600, detail: 'Try again in 10 minutes.' } } })
    const w = mount(AdminInfraCost)
    await flushPromises()
    const button = w.find('button.btn.primary')
    await button.trigger('click')
    await flushPromises()
    expect(api.billingAdminInfraCostRefresh).toHaveBeenCalledWith('2026-11')
    expect(notify.error).toHaveBeenCalledWith('Try again in 10 minutes.')
    expect(w.find('button.btn.primary').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Refresh is available again in 10 minutes')
  })
})
