// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AgentModelPicker from './AgentModelPicker.vue'

const payload = {
  current: { id: 12, name: 'Sonnet 4.5', model_id: 'claude-sonnet-4-5', provider_type: 'anthropic' },
  source: 'override',
  admin_default: { provider_type: 'openai', model_name: 'GPT-5' },
  providers: [
    {
      id: 1,
      name: 'Anthropic',
      provider_type: 'anthropic',
      models: [
        {
          id: 12, name: 'Sonnet 4.5', model_id: 'claude-sonnet-4-5',
          // Per-TOKEN decimals, exactly as the backend stores them in LLMModel.metadata.
          context_window: 200000, pricing_input: '0.000003', pricing_output: '0.000015',
        },
        { id: 13, name: 'Opus 4.1', model_id: 'claude-opus-4-1', context_window: 200000 },
      ],
    },
    {
      id: 2,
      name: 'OpenAI',
      provider_type: 'openai',
      models: [{ id: 21, name: 'GPT-5', model_id: 'gpt-5',
                 context_window: 0, pricing_input: '0', pricing_output: '0' }],
    },
  ],
}

const api = vi.hoisted(() => ({
  getAgentModelOptions: vi.fn(),
  selectAgentModel: vi.fn(),
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
  api.getAgentModelOptions.mockReset().mockResolvedValue({ data: payload })
  api.selectAgentModel.mockReset().mockResolvedValue({ data: payload })
})

describe('AgentModelPicker', () => {
  it('shows a compact summary before opening the model flyout', async () => {
    const wrapper = mountPicker()
    await flushPromises()

    expect(wrapper.get('[data-test="model-picker-trigger"]').text()).toContain('Sonnet 4.5')
    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')

    const menu = wrapper.get('[data-test="model-picker-menu"]')
    expect(menu.text()).toContain('Anthropic · Your pick')
    expect(menu.text()).toContain('Providers')
    expect(wrapper.find('[data-test="model-picker-provider-flyout"]').exists()).toBe(false)
  })

  it('opens a provider card before showing any models', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')
    await wrapper.get('[data-test="model-picker-providers"]').trigger('click')

    const providers = wrapper.get('[data-test="model-picker-provider-flyout"]')
    expect(providers.text()).toContain('Anthropic')
    expect(providers.text()).toContain('2 chat models')
    expect(providers.text()).toContain('OpenAI')
    expect(wrapper.find('[data-test="model-picker-model-flyout"]').exists()).toBe(false)
  })

  it('uses real brand icons for known providers', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')
    await wrapper.get('[data-test="model-picker-providers"]').trigger('click')

    const icons = wrapper.findAll('.amp-provider-mark').map((icon) => icon.attributes('data-provider-icon'))
    expect(icons).toEqual(['logos:anthropic-icon', 'logos:openai-icon'])
  })

  it('opens only the selected provider models in a third card', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')
    await wrapper.get('[data-test="model-picker-providers"]').trigger('click')
    const anthropic = wrapper.findAll('.amp-provider').find((item) => item.text().includes('Anthropic'))
    await anthropic.trigger('click')

    const models = wrapper.get('[data-test="model-picker-model-flyout"]')
    expect(models.text()).toContain('Sonnet 4.5')
    expect(models.text()).toContain('Opus 4.1')
    expect(models.findAll('.amp-model').some((item) => item.text().includes('GPT-5'))).toBe(false)
    expect(models.find('[aria-selected="true"]').text()).toContain('Sonnet 4.5')
  })

  it('searches the selected provider by model name and model id', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')
    await wrapper.get('[data-test="model-picker-providers"]').trigger('click')
    await wrapper.findAll('.amp-provider')[0].trigger('click')

    // Rows now carry a context/price meta line under the name, so match on the NAME element —
    // the assertion is about which models survive the filter, not about row chrome.
    const names = () => wrapper.findAll('.amp-model .amp-model-name').map((el) => el.text())
    const search = wrapper.get('[data-test="model-search"]')
    await search.setValue('opus')
    expect(names()).toEqual(['Opus 4.1'])

    await search.setValue('claude-sonnet-4-5')
    expect(names()).toEqual(['Sonnet 4.5'])

    await search.setValue('not-a-real-model')
    expect(wrapper.findAll('.amp-model')).toHaveLength(0)
    expect(wrapper.get('[data-test="model-search-empty"]').text()).toBe('No matching models')
  })

  it('selects the first search result with Enter', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')
    await wrapper.get('[data-test="model-picker-providers"]').trigger('click')
    await wrapper.findAll('.amp-provider')[0].trigger('click')

    const search = wrapper.get('[data-test="model-search"]')
    await search.setValue('opus')
    await search.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(api.selectAgentModel).toHaveBeenCalledWith(7, 13)
  })

  it('selects a model and closes both cards', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')
    await wrapper.get('[data-test="model-picker-providers"]').trigger('click')
    const anthropic = wrapper.findAll('.amp-provider').find((item) => item.text().includes('Anthropic'))
    await anthropic.trigger('click')

    const opus = wrapper.findAll('.amp-model').find((item) => item.text().includes('Opus 4.1'))
    await opus.trigger('click')
    await flushPromises()

    expect(api.selectAgentModel).toHaveBeenCalledWith(7, 13)
    expect(wrapper.find('[data-test="model-picker-menu"]').exists()).toBe(false)
    expect(wrapper.emitted('changed')).toBeTruthy()
  })

  it('shows each model’s context window and per-1M price', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')
    await wrapper.get('[data-test="model-picker-providers"]').trigger('click')
    await wrapper.findAll('.amp-provider')[0].trigger('click')

    const rows = wrapper.findAll('.amp-model')
    // Per-token decimals are rendered per 1M, same formatting as the agent editor's picker.
    expect(rows[0].text()).toContain('200K ctx')
    expect(rows[0].text()).toContain('$3.00/$15.00 per 1M')
    // Context known but no pricing → context only, no dangling separator.
    expect(rows[1].text()).toContain('200K ctx')
    expect(rows[1].text()).not.toContain('per 1M')
    expect(rows[1].text()).not.toContain('·')
  })

  it('labels a zero-cost model Free and omits an unknown context window', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')
    await wrapper.get('[data-test="model-picker-providers"]').trigger('click')
    await wrapper.findAll('.amp-provider')[1].trigger('click')

    const row = wrapper.findAll('.amp-model')[0]
    expect(row.text()).toContain('Free')
    expect(row.text()).not.toContain('ctx')
  })

  it('closes the menu and flyout with Escape', async () => {
    const wrapper = mountPicker()
    await flushPromises()
    await wrapper.get('[data-test="model-picker-trigger"]').trigger('click')
    await wrapper.get('[data-test="model-picker-providers"]').trigger('click')
    await wrapper.findAll('.amp-provider')[0].trigger('click')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-test="model-picker-menu"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="model-picker-trigger"]').attributes('aria-expanded')).toBe('false')
  })
})
