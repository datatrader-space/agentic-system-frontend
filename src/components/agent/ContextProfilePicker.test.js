// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ContextProfilePicker from './ContextProfilePicker.vue'

const PROFILES = [
  { key: 'fast', label: 'Fast', description: 'Short answers.' },
  { key: 'balanced', label: 'Balanced', description: 'Default mode.' },
  { key: 'code_repo', label: 'Code / Repo', description: 'Code tasks.' },
]
const PREVIEW = {
  profile: 'code_repo', profile_source: 'agent_policy', model_context_window: 1000000,
  hard_input_limit: 500000, target_input_tokens: 300000, history_budget: 225000, memory_budget: 1500,
  vector_budget: 16000, tool_result_budget_per_iter: 12000, total_tool_context_budget: 60000,
  max_tool_iterations: 25, turn_cost_ceiling_usd: 5.0,
  image: { max_images_per_turn: 4, max_image_width: 2048, max_image_height: 2048, estimator: 'openrouter_anthropic' },
  sources: { hard_input_limit: 'platform_absolute', max_tool_iterations: 'deprecated_env_fallback:LLM_MAX_TOOL_ITERATIONS',
             turn_cost_ceiling_usd: 'env_floor' },
}

const optionValues = (w) => w.findAll('option').map((o) => o.attributes('value'))

describe('ContextProfilePicker', () => {
  it('renders a <select> with an Automatic option and all API profiles', () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '', profiles: PROFILES } })
    expect(w.find('select').exists()).toBe(true)
    const values = optionValues(w)
    expect(values).toContain('')          // Automatic (Recommended)
    expect(values).toContain('fast')
    expect(values).toContain('code_repo')
    // the Automatic option carries the friendly recommended label
    const auto = w.findAll('option').find((o) => o.attributes('value') === '')
    expect(auto.text()).toContain('Automatic')
    // no raw env/token-knob inputs
    expect(w.findAll('input').length).toBe(0)
    expect(w.html()).not.toMatch(/LLM_[A-Z_]+/)   // no env var names leaked into the UI
  })

  it('selects Automatic (empty value) when modelValue is empty', () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '', profiles: PROFILES } })
    expect(w.find('select').element.value).toBe('')
  })

  it('loads the current profile as the selected value', () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: 'code_repo', profiles: PROFILES } })
    expect(w.find('select').element.value).toBe('code_repo')
  })

  it('emits update:modelValue with the profile key when a new option is chosen', async () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '', profiles: PROFILES } })
    await w.find('select').setValue('fast')
    expect(w.emitted('update:modelValue')[0]).toEqual(['fast'])
  })

  it('emits empty string when Automatic is chosen (clears override)', async () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: 'fast', profiles: PROFILES } })
    await w.find('select').setValue('')
    expect(w.emitted('update:modelValue')[0]).toEqual([''])
  })

  it('renders the effective preview rows when a preview is provided', async () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: 'code_repo', profiles: PROFILES, preview: PREVIEW } })
    // previewRows are inside the details popover — open it first.
    await w.find('.ctx-details-btn').trigger('click')
    const live = w.find('.ctx-live-preview')
    expect(live.exists()).toBe(true)
    expect(live.text()).toContain('Effective profile')
    expect(live.text()).toContain('Hard input limit')
    expect(live.text()).toContain('500,000')   // hard_input_limit formatted via toLocaleString
    // no raw env var names leaked into the preview
    expect(live.html()).not.toMatch(/LLM_[A-Z_]+/)
  })

  it('does not render the live preview section when no preview is provided', () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '', profiles: PROFILES } })
    expect(w.find('.ctx-live-preview').exists()).toBe(false)
  })

  it('does not emit when disabled', async () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '', profiles: PROFILES, disabled: true } })
    expect(w.find('select').attributes('disabled')).toBeDefined()
    await w.find('select').setValue('fast')
    expect(w.emitted('update:modelValue')).toBeFalsy()
  })

  it('falls back to a built-in profile list when none passed', () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '' } })
    const values = optionValues(w)
    expect(values).toContain('deep_research')
    expect(values).toContain('data_analysis')
    expect(values).toContain('fast')
    expect(values).toContain('code_repo')
  })
})
