// @vitest-environment jsdom
// The agent editor must let you choose a web-search model.
//
// FOUND LIVE, production 2026-09-16: `/api/models/web-search/` returned 114 verified models (109
// usable) and the per-agent `/agents/<id>/web-intelligence/` endpoint accepted a choice — but NO
// component called either. `getWebSearchModels` and `updateAgentWebIntelligence` sat in the API client
// with no caller, so the only agent with a search model (3338) had been set by hand and every other
// agent silently had none.
//
// This is NOT an AgentProfile column like the capability pickers beside it. It saves through its own
// validated endpoint on change, so a model the server refuses must surface as a message and must not
// stay selected as though it had been saved.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

const SEARCH_MODELS = [
  { provider: 'openrouter', provider_label: 'OpenRouter', model_id: 'google/gemini-2.5-flash', display_name: 'gemini-2.5-flash', available: true },
  { provider: 'openai', provider_label: 'OpenAI', model_id: 'gpt-5.1', display_name: 'gpt-5.1', available: true },
  { provider: 'anthropic', provider_label: 'Anthropic', model_id: 'claude-sonnet-4-6', display_name: 'claude-sonnet-4-6', available: false, unavailable_reason: 'provider credentials not configured' },
]

const api = vi.hoisted(() => ({
  get: vi.fn(),
  getAgentEffectivePolicy: vi.fn(),
  getWebSearchModels: vi.fn(),
  getAgentWebIntelligence: vi.fn(),
  updateAgentWebIntelligence: vi.fn(),
}))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('vue-router', () => ({ RouterLink: { template: '<a><slot/></a>' } }))

import DefineBrainStep from './DefineBrainStep.vue'

const stubs = {
  ModelPicker: { template: '<div class="model-picker-stub" />' },
  ContextProfilePicker: { template: '<div />' },
  RouterLink: { template: '<a><slot/></a>' },
}

async function mountExpanded({ config = {}, editable = true, agent = {} } = {}) {
  api.getAgentWebIntelligence.mockResolvedValue({ data: { config, effective: {}, editable } })
  const a = { id: 3316, ...agent }
  const w = mount(DefineBrainStep, { props: { agent: a }, global: { stubs } })
  await flushPromises()
  await w.find('.model-card .edit-btn').trigger('click')
  await nextTick()
  await w.find('.model-card select').setValue('1')   // choose a provider so the capability rows render
  await nextTick()
  await flushPromises()
  return w
}

const row = (w) => w.find('[data-test="cap-web_search_model"]')
const select = (w) => row(w).find('select')

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockImplementation((url) => String(url).includes('providers')
    ? Promise.resolve({ data: [{ id: 1, name: 'P', provider_type: 'openai' }] })
    : Promise.resolve({ data: [{ id: 10, name: 'gpt', model_id: 'gpt', provider: 1, metadata: {} }] }))
  api.getAgentEffectivePolicy.mockResolvedValue({ data: {} })
  api.getWebSearchModels.mockResolvedValue({ data: { models: SEARCH_MODELS } })
  api.updateAgentWebIntelligence.mockResolvedValue({ data: { config: {}, effective: {}, editable: true } })
})

describe('DefineBrainStep — web search model', () => {
  it('renders a Web search selector populated from the verified model list', async () => {
    const w = await mountExpanded()
    expect(row(w).exists()).toBe(true)
    expect(row(w).text()).toContain('Web search')
    const values = select(w).findAll('option').map((o) => o.element.value)
    expect(values).toContain('')                                   // Auto
    expect(values).toContain('openrouter::google/gemini-2.5-flash')
    expect(values).toContain('openai::gpt-5.1')
  })

  it('groups by provider and puts providers with a usable model first', async () => {
    const w = await mountExpanded()
    const labels = select(w).findAll('optgroup').map((g) => g.attributes('label'))
    expect(labels[labels.length - 1]).toBe('Anthropic')           // no credentials → sinks
  })

  it('marks a model that is listed but cannot run', async () => {
    const w = await mountExpanded()
    const anth = select(w).findAll('option').find((o) => o.element.value === 'anthropic::claude-sonnet-4-6')
    expect(anth.text()).toContain('unavailable')
  })

  it("shows the agent's OWN choice, not the inherited effective default", async () => {
    const w = await mountExpanded({ config: { search_model: { provider: 'openrouter', model_id: 'google/gemini-2.5-flash' } } })
    expect(select(w).element.value).toBe('openrouter::google/gemini-2.5-flash')
  })

  it('reads as Auto when the agent has no choice of its own', async () => {
    const w = await mountExpanded({ config: {} })
    expect(select(w).element.value).toBe('')
  })

  it('saves a choice through the validated endpoint as provider + model_id', async () => {
    const w = await mountExpanded()
    await select(w).setValue('openai::gpt-5.1')
    await flushPromises()
    expect(api.updateAgentWebIntelligence).toHaveBeenCalledWith(3316, {
      search_model: { provider: 'openai', model_id: 'gpt-5.1' },
    })
  })

  it('Reset to Auto clears the choice with null (the endpoint unsets on null)', async () => {
    const w = await mountExpanded({ config: { search_model: { provider: 'openai', model_id: 'gpt-5.1' } } })
    await row(w).find('button').trigger('click')
    await flushPromises()
    expect(api.updateAgentWebIntelligence).toHaveBeenCalledWith(3316, { search_model: null })
    expect(select(w).element.value).toBe('')
  })

  it('reverts and explains when the server refuses the model', async () => {
    api.updateAgentWebIntelligence.mockRejectedValue({
      response: { data: { error: 'WEB_SEARCH_MODEL_UNSUPPORTED', detail: 'not a verified web-search model' } },
    })
    const w = await mountExpanded({ config: {} })
    await select(w).setValue('openai::gpt-5.1')
    await flushPromises()
    expect(select(w).element.value).toBe('')                      // did NOT pretend it stuck
    expect(row(w).text()).toContain('not a verified web-search model')
  })

  it('is disabled with a reason on a shared agent the viewer cannot edit', async () => {
    const w = await mountExpanded({ editable: false })
    expect(select(w).attributes('disabled')).toBeDefined()
    expect(row(w).text()).toContain('only its owner or an administrator')
  })

  it('is not offered before the agent exists (the endpoint needs an id)', async () => {
    api.getAgentWebIntelligence.mockResolvedValue({ data: { config: {}, editable: true } })
    const w = mount(DefineBrainStep, { props: { agent: { id: null } }, global: { stubs } })
    await flushPromises()
    await w.find('.model-card .edit-btn').trigger('click')
    await nextTick()
    await w.find('.model-card select').setValue('1')
    await nextTick()
    expect(row(w).exists()).toBe(false)
    expect(api.getAgentWebIntelligence).not.toHaveBeenCalled()
  })
})
