// @vitest-environment jsdom
// The switch-provider popup: opens on an error frame marked `provider_switch`, previews what changes, switches
// and re-sends the failed message — or does nothing on Cancel.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProviderSwitchDialog from './ProviderSwitchDialog.vue'
import { useChatStore } from '../../stores/useChatStore'

const api = vi.hoisted(() => ({ getProviderSwitchOptions: vi.fn(), switchProvider: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('../../composables/useNotify', () => ({ notify: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))

const target = {
  to_provider: { id: 5, name: 'OpenAI', provider_type: 'openai' },
  changes: [{ target_name: 'Worker', label: 'Main model', match: 'same', count: 1,
              from_model: { model_id: 'openai/gpt-5.4' }, to_model: { model_id: 'gpt-5.4' } }],
  kept: [],
  warnings: ['Video generation for “Worker” stays on openrouter — OpenAI has no model for it.'],
}

const mountDialog = () => mount(ProviderSwitchDialog, {
  global: { stubs: { Teleport: true, 'router-link': { template: '<a><slot /></a>' } } },
})

describe('ProviderSwitchDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    api.getProviderSwitchOptions.mockReset().mockResolvedValue({ data: { targets: [target] } })
    api.switchProvider.mockReset().mockResolvedValue({ data: { success: true, ...target } })
  })

  it('an error frame marked provider_switch opens it', () => {
    const chat = useChatStore()
    chat._beginAssistant()
    chat._onEvent({ type: 'error', error: 'key limit', retryable: false,
                    provider_switch: { from_provider: 'openrouter', reason: 'key_limit' } })
    expect(chat.providerSwitchOffer).toMatchObject({ from_provider: 'openrouter', reason: 'key_limit' })
  })

  it('an ordinary error does not', () => {
    const chat = useChatStore()
    chat._beginAssistant()
    chat._onEvent({ type: 'error', error: 'timeout', retryable: true })
    expect(chat.providerSwitchOffer).toBe(null)
  })

  it('previews the changes and warnings for the chosen provider', async () => {
    const chat = useChatStore()
    chat.providerSwitchOffer = { from_provider: 'openrouter', reason: 'key_limit' }
    const w = mountDialog()
    await flushPromises()
    expect(api.getProviderSwitchOptions).toHaveBeenCalledWith('openrouter')
    expect(w.text()).toContain('OpenRouter key reached its spending limit')
    expect(w.find('[data-test="provider-switch-change"]').text()).toContain('openai/gpt-5.4 → gpt-5.4')
    expect(w.find('[data-test="provider-switch-warning"]').text()).toContain('Video generation')
  })

  it('Switch applies, closes and re-sends the failed message', async () => {
    const chat = useChatStore()
    const retry = vi.spyOn(chat, 'retryLast').mockImplementation(() => {})
    chat.providerSwitchOffer = { from_provider: 'openrouter', reason: 'key_limit' }
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-test="provider-switch-apply"]').trigger('click')
    await flushPromises()
    expect(api.switchProvider).toHaveBeenCalledWith('openrouter', 5)
    expect(chat.providerSwitchOffer).toBe(null)
    expect(retry).toHaveBeenCalled()
  })

  it('Cancel changes nothing', async () => {
    const chat = useChatStore()
    const retry = vi.spyOn(chat, 'retryLast').mockImplementation(() => {})
    chat.providerSwitchOffer = { from_provider: 'openrouter', reason: 'key_limit' }
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-test="provider-switch-cancel"]').trigger('click')
    expect(api.switchProvider).not.toHaveBeenCalled()
    expect(retry).not.toHaveBeenCalled()
    expect(chat.providerSwitchOffer).toBe(null)
  })

  it('no other working provider says where to add one', async () => {
    api.getProviderSwitchOptions.mockResolvedValue({ data: { targets: [] } })
    const chat = useChatStore()
    chat.providerSwitchOffer = { from_provider: 'openrouter', reason: 'key_limit' }
    const w = mountDialog()
    await flushPromises()
    expect(w.find('[data-test="provider-switch-none"]').text()).toContain('no other working provider')
    expect(w.find('[data-test="provider-switch-apply"]').attributes('disabled')).toBeDefined()
  })
})
