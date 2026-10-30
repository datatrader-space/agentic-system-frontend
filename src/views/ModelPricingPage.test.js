// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ModelPricingPage from './ModelPricingPage.vue'

const api = vi.hoisted(() => ({ getModelPricing: vi.fn(), setModelPricing: vi.fn(), syncOpenRouterPricing: vi.fn() }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('../composables/useNotify', () => ({ notify }))

let wrapper
const row = (id, status, pricing) => ({ id, model_id: `model-${id}`, display_name: `Model ${id}`,
  provider_name: 'Provider', provider_type: 'fal', pricing_status: status, is_active: true, pricing })
async function mountPage(models) {
  api.getModelPricing.mockResolvedValue({ data: { providers: [], models } })
  wrapper = mount(ModelPricingPage, { global: { stubs: { PageLoader: true } } })
  await flushPromises()
  return wrapper
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => wrapper?.unmount())

describe('Model pricing — published billing units', () => {
  it('shows a per-second price without inventing token prices', async () => {
    const w = await mountPage([row(1, 'exact', { cost_unit: 'second', cost_per_unit: '0.126',
      published_rates: [{ label: 'Usage', amount: '0.126', unit: 'second' }] })])
    expect(w.text()).toContain('$0.126 / second')
    expect(w.find('tbody tr .badge').text()).toBe('Priced')
    expect(w.find('tbody tr input[type="number"]').element.value).toBe('')
  })

  it('counts a dimensional rate card as published and keeps its values separate', async () => {
    const w = await mountPage([row(1, 'rate_card', { published_rates: [
      { label: '480p', amount: '0.005', unit: 'second' },
      { label: '720p', amount: '0.01', unit: 'second' },
    ] })])
    expect(w.find('tbody tr .badge').text()).toBe('Published rate card')
    expect(w.find('details').text()).toContain('480p: $0.005 / second')
    expect(w.find('details').text()).toContain('720p: $0.01 / second')
    expect(w.findAll('.stat-card')[1].find('.stat-value').text()).toBe('0')
    expect(w.findAll('.stat-card')[2].find('.stat-value').text()).toBe('1')
  })

  it('does not replace a unit price with the token-only editor after a notes edit', async () => {
    const w = await mountPage([row(1, 'exact', { cost_unit: 'minute', cost_per_unit: '0.12',
      published_rates: [{ label: 'Usage', amount: '0.12', unit: 'minute' }] })])
    await w.find('tbody input.notes').setValue('A note')
    expect(w.find('button.btn-save').attributes('disabled')).toBeDefined()
    expect(api.setModelPricing).not.toHaveBeenCalled()
  })

  it('retains the staff guard when the API refuses access', async () => {
    api.getModelPricing.mockRejectedValue({ response: { status: 403 } })
    wrapper = mount(ModelPricingPage)
    await flushPromises()
    expect(wrapper.text()).toContain('Not authorized')
    expect(wrapper.find('table').exists()).toBe(false)
  })
})
