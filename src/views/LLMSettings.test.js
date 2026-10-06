// @vitest-environment jsdom
// Settings → AI Providers fetches each tab's data when that tab is first opened. It used to download all
// four tabs' data before showing the first: every model row in full (~900 KB for an OpenRouter account)
// to render ten, a usage report to show its last 15 lines, and the embedding health check.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  getLlmProviders: vi.fn(),
  getLlmModels: vi.fn(),
  getOperationModels: vi.fn(),
  getEmbeddingStatus: vi.fn(),
  getLlmRequests: vi.fn(),
  getLlmStats: vi.fn(),
  updateLlmModel: vi.fn(),
}))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn() }))

import LLMSettings from './LLMSettings.vue'

const providers = [
  { id: 5, name: 'OpenAI', provider_type: 'openai', base_url: '', has_api_key: true, model_count: 93,
    metadata: {}, is_active: true },
  { id: 7, name: 'OpenRouter', provider_type: 'openrouter', base_url: '', has_api_key: false, model_count: 430,
    metadata: {}, is_active: true },
]
const row = (id, provider, name, over = {}) => ({
  id, provider, provider_name: provider === 5 ? 'OpenAI' : 'OpenRouter',
  provider_type: provider === 5 ? 'openai' : 'openrouter', name, model_id: name.toLowerCase(),
  is_active: true, is_embedding: false, ...over,
})
const page = (n) => ({
  count: 523, next: null, previous: null,
  results: Array.from({ length: 10 }, (_, i) => row(n * 100 + i, 5, `Model-${n}-${i}`)),
})

let wrapper
const mountPage = async () => {
  wrapper = mount(LLMSettings, {
    global: { stubs: { OwnerFilter: true, ProviderSwitchCard: true, PageLoader: true } },
  })
  await flushPromises()
}
const openTab = async (label) => {
  await wrapper.findAll('button').find((b) => b.text().startsWith(label)).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getLlmProviders.mockResolvedValue({ data: { count: 2, results: providers } })
  api.getLlmModels.mockImplementation((params = {}) => Promise.resolve({
    data: params.page ? page(params.page) : [row(11, params.provider, 'Chat-A'), row(12, params.provider, 'Chat-B')],
  }))
  api.getOperationModels.mockResolvedValue({ data: {
    ask_llm_model_id: 11, summarize_model_id: null, embedding_model_id: null,
    selected_models: [row(11, 5, 'Chat-A')],
  } })
  api.getEmbeddingStatus.mockResolvedValue({ data: { needs_reindex: false, stale_chunks: 0, total_chunks: 0 } })
  api.getLlmRequests.mockResolvedValue({ data: { count: 1, results: [
    { id: 1, provider: 'openai', model: 'gpt', status: 'success', latency_ms: 12, total_tokens: 5,
      cost_estimate: 0, created_at: '2026-10-06T10:00:00Z' },
  ] } })
})
afterEach(() => wrapper?.unmount())

describe('LLMSettings loads each tab on demand', () => {
  it('fetches only the providers when the page opens', async () => {
    await mountPage()
    expect(api.getLlmProviders).toHaveBeenCalledTimes(1)
    expect(api.getLlmModels).not.toHaveBeenCalled()
    expect(api.getOperationModels).not.toHaveBeenCalled()
    expect(api.getEmbeddingStatus).not.toHaveBeenCalled()
    expect(api.getLlmRequests).not.toHaveBeenCalled()
    expect(api.getLlmStats).not.toHaveBeenCalled()
  })

  it('shows the model count and the key badge from the providers alone', async () => {
    await mountPage()
    const modelsTab = wrapper.findAll('button').find((b) => b.text().startsWith('Models'))
    expect(modelsTab.text()).toContain('523')            // 93 + 430, with no model row downloaded
    expect(wrapper.text()).toContain('Key Set')          // OpenAI: has_api_key
    expect(wrapper.text()).toContain('No Key')           // OpenRouter: no key, and no key value on the page
  })

  it('asks the server for one page of ten when Models is opened, and the next page on Next', async () => {
    await mountPage()
    await openTab('Models')
    expect(api.getLlmModels).toHaveBeenCalledTimes(1)
    expect(api.getLlmModels).toHaveBeenLastCalledWith({ slim: 1, page: 1, page_size: 10 })
    expect(wrapper.text()).toContain('Model-1-0')
    expect(wrapper.text()).toContain('Showing 1–10 of 523')

    await wrapper.findAll('button').find((b) => b.text() === 'Next').trigger('click')
    await flushPromises()
    expect(api.getLlmModels).toHaveBeenLastCalledWith({ slim: 1, page: 2, page_size: 10 })
    expect(wrapper.text()).toContain('Model-2-0')
    expect(wrapper.text()).toContain('Showing 11–20 of 523')
  })

  it('filters by provider on the server and returns to page 1', async () => {
    await mountPage()
    await openTab('Models')
    const filter = wrapper.findAll('select').find((s) => s.text().includes('All Providers'))
    await filter.setValue(7)
    await flushPromises()
    expect(api.getLlmModels).toHaveBeenLastCalledWith({ slim: 1, page: 1, page_size: 10, provider: 7 })
  })

  it('loads the picks and only the providers they sit on when Internal & Embedding is opened', async () => {
    await mountPage()
    await openTab('Internal')
    expect(api.getOperationModels).toHaveBeenCalledTimes(1)
    expect(api.getEmbeddingStatus).toHaveBeenCalledTimes(1)
    // The one saved pick is on provider 5, so that is the one list fetched — never every model.
    expect(api.getLlmModels).toHaveBeenCalledTimes(1)
    expect(api.getLlmModels).toHaveBeenCalledWith({ slim: 1, provider: 5 })
    expect(wrapper.text()).toContain('OpenAI • Chat-A')
  })

  it('fetches another provider\'s models when a picker is pointed at it', async () => {
    await mountPage()
    await openTab('Internal')
    const picker = wrapper.findAll('select').find((s) => s.text().includes('Agent default') && s.text().includes('OpenRouter'))
    await picker.setValue(7)
    await flushPromises()
    expect(api.getLlmModels).toHaveBeenCalledTimes(2)
    expect(api.getLlmModels).toHaveBeenLastCalledWith({ slim: 1, provider: 7 })
  })

  it('reads the last 15 requests when Activity is opened, once', async () => {
    await mountPage()
    await openTab('Activity')
    expect(api.getLlmRequests).toHaveBeenCalledTimes(1)
    expect(api.getLlmRequests).toHaveBeenCalledWith({ page_size: 15 })
    expect(api.getLlmStats).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('openai • gpt')

    await openTab('Providers')
    await openTab('Activity')
    expect(api.getLlmRequests).toHaveBeenCalledTimes(1)
  })
})
