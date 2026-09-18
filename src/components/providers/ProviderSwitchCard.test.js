// @vitest-environment jsdom
// The MANUAL provider switch on Settings → AI Providers: which provider the models run on, why they are on it,
// which providers cannot be picked and why, and the switch itself — the same backend call the chat popup makes,
// available when nothing is broken and in either direction.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProviderSwitchCard from './ProviderSwitchCard.vue'

const api = vi.hoisted(() => ({
  getProviderSwitchState: vi.fn(),
  getProviderSwitchOptions: vi.fn(),
  switchProvider: vi.fn(),
}))
vi.mock('../../services/api', () => ({ default: api }))

const target = {
  to_provider: { id: 7, name: 'OpenRouter', provider_type: 'openrouter' },
  changes: [{ target_name: 'Worker', label: 'Main model', match: 'same', count: 1,
              from_model: { model_id: 'gpt-5.4' }, to_model: { model_id: 'openai/gpt-5.4' } }],
  kept: [],
  warnings: [],
}

const state = (over = {}) => ({
  current: { provider_type: 'openai', slots: 2, total: 2, mixed: false, usage: { openai: 2 } },
  providers: [
    { id: 5, name: 'OpenAI', provider_type: 'openai', is_active: true, model_count: 3,
      available: false, unavailable_reason: 'This is the provider you are on.', is_current: true },
    { id: 7, name: 'OpenRouter', provider_type: 'openrouter', is_active: true, model_count: 9,
      available: true, unavailable_reason: '', is_current: false },
    { id: 9, name: 'Anthropic (todo)', provider_type: 'anthropic', is_active: true, model_count: 1,
      available: false, unavailable_reason: 'No API key configured — add one before switching to it.', is_current: false },
  ],
  last_switch: { from_provider: 'openrouter', to_provider_type: 'openai', to_provider_id: 5,
                 to_provider_name: 'OpenAI', origin: 'auto', reason: 'key_limit',
                 changed_count: 4, kept_count: 1, at: '2026-09-18T10:00:00Z' },
  ...over,
})

const mountCard = () => mount(ProviderSwitchCard, { global: { stubs: { Teleport: true } } })

describe('ProviderSwitchCard', () => {
  beforeEach(() => {
    api.getProviderSwitchState.mockReset().mockResolvedValue({ data: state() })
    api.getProviderSwitchOptions.mockReset().mockResolvedValue({ data: { from_provider: 'openai', targets: [target] } })
    api.switchProvider.mockReset().mockResolvedValue({ data: { success: true, ...target, to_provider: target.to_provider } })
  })

  it('names the provider in use and says an automatic switch put it there', async () => {
    const w = mountCard()
    await flushPromises()
    expect(w.find('[data-test="provider-switch-current"]').text()).toContain('OpenAI')
    const why = w.find('[data-test="provider-switch-why"]').text()
    expect(why).toContain('Switched automatically')
    expect(why).toContain('OpenRouter reached its spending limit')
    expect(why).toContain('4 models moved to OpenAI')
  })

  it('says so plainly when nothing was switched automatically', async () => {
    api.getProviderSwitchState.mockResolvedValue({ data: state({ last_switch: null }) })
    const w = mountCard()
    await flushPromises()
    expect(w.find('[data-test="provider-switch-why"]').text()).toContain('models you chose')
    expect(w.find('[data-test="provider-switch-back-hint"]').exists()).toBe(false)
  })

  it('a provider with no key is shown unavailable with the reason, not as a choice', async () => {
    const w = mountCard()
    await flushPromises()
    const anthropic = w.find('[data-test="provider-switch-option-anthropic"]')
    expect(anthropic.text()).toContain('No API key configured')
    // The picker only ever lists what the backend says is switchable — anthropic is not among the targets.
    await w.find('[data-test="provider-switch-open"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="provider-switch-target-anthropic"]').exists()).toBe(false)
    expect(w.find('[data-test="provider-switch-target-openrouter"]').exists()).toBe(true)
  })

  it('offers switching back once the old provider works again', async () => {
    const w = mountCard()
    await flushPromises()
    expect(w.find('[data-test="provider-switch-back-hint"]').text()).toContain('OpenRouter')
  })

  it('previews the changes, then switches through the same endpoint the popup uses', async () => {
    const w = mountCard()
    await flushPromises()
    await w.find('[data-test="provider-switch-open"]').trigger('click')
    await flushPromises()
    expect(api.getProviderSwitchOptions).toHaveBeenCalledWith('openai')
    expect(w.find('[data-test="provider-switch-change"]').text()).toContain('gpt-5.4 → openai/gpt-5.4')

    await w.find('[data-test="provider-switch-dialog-apply"]').trigger('click')
    await flushPromises()
    // No `from`: the server switches away from the provider the models are actually on, so the page and the
    // backend cannot disagree about the source. origin='manual' is what separates this from the chat popup.
    expect(api.switchProvider).toHaveBeenCalledWith('', 7, 'manual', '')
    expect(w.emitted('switched')).toBeTruthy()
    expect(w.find('[data-test="provider-switch-dialog"]').exists()).toBe(false)
    expect(api.getProviderSwitchState).toHaveBeenCalledTimes(2)   // re-read after the write
  })

  it('a refused switch keeps the dialog open and says nothing changed', async () => {
    api.switchProvider.mockRejectedValue({ response: { data: { error: 'That provider is not one of your working providers to switch to.' } } })
    const w = mountCard()
    await flushPromises()
    await w.find('[data-test="provider-switch-open"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="provider-switch-dialog-apply"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="provider-switch-error"]').text()).toContain('not one of your working providers')
    expect(w.find('[data-test="provider-switch-dialog"]').exists()).toBe(true)
    expect(w.emitted('switched')).toBeFalsy()
  })

  it('Cancel writes nothing', async () => {
    const w = mountCard()
    await flushPromises()
    await w.find('[data-test="provider-switch-open"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="provider-switch-dialog-cancel"]').trigger('click')
    expect(api.switchProvider).not.toHaveBeenCalled()
    expect(w.find('[data-test="provider-switch-dialog"]').exists()).toBe(false)
  })

  it('models spread across providers are reported, because a switch only moves one of them', async () => {
    api.getProviderSwitchState.mockResolvedValue({ data: state({
      current: { provider_type: 'openai', slots: 2, total: 3, mixed: true, usage: { openai: 2, gemini: 1 } } }) })
    const w = mountCard()
    await flushPromises()
    expect(w.find('[data-test="provider-switch-mixed"]').text()).toContain('Google Gemini × 1')
  })
})
