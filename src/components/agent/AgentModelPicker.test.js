// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AgentModelPicker from './AgentModelPicker.vue'

// What the page load receives: the current pick and how many models there are, never a provider.
const MODELS = [
  {
    id: 12, name: 'Sonnet 4.5', model_id: 'claude-sonnet-4-5',
    // Per-TOKEN decimals, exactly as the backend stores them in LLMModel.metadata.
    context_window: 200000, pricing_input: '0.000003', pricing_output: '0.000015',
  },
  { id: 13, name: 'Opus 4.1', model_id: 'claude-opus-4-1', context_window: 200000 },
  { id: 21, name: 'GPT-5', model_id: 'gpt-5', context_window: 0, pricing_input: '0', pricing_output: '0' },
]
const payload = {
  current: { id: 12, name: 'Sonnet 4.5', model_id: 'claude-sonnet-4-5', yours: true },
  source: 'override',
  admin_default: { model_name: 'GPT-5' },
  model_count: 3,
}
const withModels = (models = MODELS) => ({ ...payload, model_count: models.length, models })

const api = vi.hoisted(() => ({
  getAgentModelOptions: vi.fn(),
  selectAgentModel: vi.fn(),
  getAgentReasoningOptions: vi.fn(),
}))

vi.mock('../../services/api', () => ({ default: api }))

const mountPicker = () => mount(AgentModelPicker, {
  props: { agentId: 7 },
  global: {
    stubs: {
      RouterLink: { template: '<a><slot /></a>' },
      Icon: { props: ['icon'], template: '<i class="icon-stub" :data-icon="icon" />' },
    },
  },
})

beforeEach(() => {
  // AgentModelPicker renders EffortSlider, which calls useChatStore() at setup. Without an active
  // pinia this file only passed when some earlier test file in the same worker happened to create
  // one — so it failed whenever it ran first or in isolation.
  setActivePinia(createPinia())
  api.getAgentModelOptions.mockReset().mockImplementation((_id, params) =>
    Promise.resolve({ data: params?.models ? withModels() : payload }))
  api.selectAgentModel.mockReset().mockResolvedValue({ data: payload })
  api.getAgentReasoningOptions.mockReset().mockResolvedValue({ data: { enabled: true, supported: true, levels: ['low', 'medium', 'high'] } })
})

async function openModels(wrapper) {
  await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')
  await wrapper.get('[data-test="model-picker-models"]').trigger('click')
  await flushPromises()
  return wrapper.get('[data-test="model-picker-model-flyout"]')
}
const names = (wrapper) => wrapper.findAll('.amp-model .amp-model-name').map((el) => el.text())

describe('AgentModelPicker', () => {
  it('shows a compact summary that names no provider', async () => {
    const wrapper = mountPicker()
    await flushPromises()

    expect(wrapper.get('[data-test="model-picker-trigger"]').text()).toContain('Sonnet 4.5')
    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')

    const menu = wrapper.get('[data-test="model-picker-menu"]')
    expect(menu.text()).toContain('Your pick')
    expect(menu.text()).toContain('3 available')
    expect(menu.text()).not.toMatch(/provider|anthropic|openai|openrouter/i)
    expect(wrapper.find('[data-test="model-picker-model-flyout"]').exists()).toBe(false)
  })

  it('opens ONE list of every model, with no provider step', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    const list = await openModels(wrapper)
    expect(names(wrapper)).toEqual(['Sonnet 4.5', 'Opus 4.1', 'GPT-5'])
    expect(list.find('[aria-selected="true"]').text()).toContain('Sonnet 4.5')
    expect(wrapper.find('.amp-provider').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/provider/i)
  })

  it('searches by model name and model id', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await openModels(wrapper)
    const search = wrapper.get('[data-test="model-search"]')
    await search.setValue('opus')
    expect(names(wrapper)).toEqual(['Opus 4.1'])
    await search.setValue('claude-sonnet-4-5')
    expect(names(wrapper)).toEqual(['Sonnet 4.5'])
    await search.setValue('not-a-real-model')
    expect(wrapper.findAll('.amp-model')).toHaveLength(0)
    expect(wrapper.get('[data-test="model-search-empty"]').text()).toBe('No matching models')
  })

  it('selects the first search result with Enter', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await openModels(wrapper)
    const search = wrapper.get('[data-test="model-search"]')
    await search.setValue('opus')
    await search.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(api.selectAgentModel).toHaveBeenCalledWith(7, 13)
  })

  it('selects a model and closes the menu', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await openModels(wrapper)
    await wrapper.get('[data-test="model-option-13"]').trigger('click')
    await flushPromises()
    expect(api.selectAgentModel).toHaveBeenCalledWith(7, 13)
    expect(wrapper.find('[data-test="model-picker-menu"]').exists()).toBe(false)
    expect(wrapper.emitted('changed')).toBeTruthy()
  })

  it('shows each model context window and per-1M price', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await openModels(wrapper)
    const rows = wrapper.findAll('.amp-model')
    expect(rows[0].text()).toContain('200K ctx')
    expect(rows[0].text()).toContain('$3.00/$15.00 per 1M')
    expect(rows[1].text()).toContain('200K ctx')
    expect(rows[1].text()).not.toContain('per 1M')
    expect(rows[1].text()).not.toContain('·')
    expect(rows[2].text()).toContain('Free')
    expect(rows[2].text()).not.toContain('ctx')
  })

  it('closes the menu and the list with Escape', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await openModels(wrapper)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="model-picker-menu"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="model-picker-trigger"]').attributes('aria-expanded')).toBe('false')
  })
})

describe('AgentModelPicker — models load on demand and a long list never freezes the page', () => {
  const many = Array.from({ length: 533 }, (_, i) => ({ id: 1000 + i, name: `Model ${i}`, model_id: `vendor/model-${i}` }))
  const answer = () => api.getAgentModelOptions.mockReset().mockImplementation((_id, params) =>
    Promise.resolve({ data: params?.models ? withModels(many) : { ...payload, model_count: 533 } }))

  it('loads the models only when the list is opened, once', async () => {
    answer()
    const wrapper = mountPicker()
    await flushPromises()
    expect(api.getAgentModelOptions).toHaveBeenCalledTimes(1)
    expect(api.getAgentModelOptions.mock.calls[0][1]).toBeUndefined()

    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')
    expect(wrapper.get('[data-test="model-picker-models"]').text()).toContain('533 available')
    await wrapper.get('[data-test="model-picker-models"]').trigger('click')
    await flushPromises()
    expect(api.getAgentModelOptions).toHaveBeenLastCalledWith(7, { models: 1 })

    await wrapper.get('[data-test="model-picker-model-flyout"] .amp-model-back').trigger('click')
    await wrapper.get('[data-test="model-picker-models"]').trigger('click')
    await flushPromises()
    expect(api.getAgentModelOptions).toHaveBeenCalledTimes(2)
  })

  it('draws at most 60 rows and says how to reach the rest; search covers all of them', async () => {
    answer()
    const wrapper = mountPicker()
    await flushPromises()
    await openModels(wrapper)
    expect(wrapper.findAll('.amp-model')).toHaveLength(60)
    expect(wrapper.get('[data-test="model-more"]').text()).toContain('Showing 60 of 533')

    await wrapper.get('[data-test="model-search"]').setValue('model-532')
    expect(names(wrapper)).toEqual(['Model 532'])
    expect(wrapper.find('[data-test="model-more"]').exists()).toBe(false)
  })
})

describe('AgentModelPicker — reasoning options follow the picked model', () => {
  it('loads them for the agent and reloads after a model pick', async () => {
    const w = mountPicker()
    await flushPromises()
    expect(api.getAgentReasoningOptions).toHaveBeenCalledWith(7)
    const before = api.getAgentReasoningOptions.mock.calls.length
    await w.vm.$.setupState.pick({ id: 21 })
    await flushPromises()
    expect(api.getAgentReasoningOptions.mock.calls.length).toBeGreaterThan(before)
  })
})
