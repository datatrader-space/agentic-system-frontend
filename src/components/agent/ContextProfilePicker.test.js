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

describe('ContextProfilePicker', () => {
  it('renders the picker with an Automatic option and all profiles', () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '', profiles: PROFILES } })
    expect(w.find('[data-test="profile-automatic"]').exists()).toBe(true)
    expect(w.find('[data-test="profile-fast"]').exists()).toBe(true)
    expect(w.find('[data-test="profile-code_repo"]').exists()).toBe(true)
    // no raw env/token-knob inputs
    expect(w.findAll('input').length).toBe(0)
    expect(w.html()).not.toMatch(/LLM_[A-Z_]+/)   // no env var names leaked into the UI
  })

  it('highlights Automatic when modelValue is empty', () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '', profiles: PROFILES } })
    expect(w.find('[data-test="profile-automatic"]').classes()).toContain('active')
    expect(w.find('[data-test="profile-fast"]').classes()).not.toContain('active')
  })

  it('loads the current profile as selected', () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: 'code_repo', profiles: PROFILES } })
    expect(w.find('[data-test="profile-code_repo"]').classes()).toContain('active')
  })

  it('emits update:modelValue with the profile key when a card is clicked', async () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '', profiles: PROFILES } })
    await w.find('[data-test="profile-fast"]').trigger('click')
    expect(w.emitted('update:modelValue')[0]).toEqual(['fast'])
  })

  it('emits empty string when Automatic is chosen (clears override)', async () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: 'fast', profiles: PROFILES } })
    await w.find('[data-test="profile-automatic"]').trigger('click')
    expect(w.emitted('update:modelValue')[0]).toEqual([''])
  })

  it('renders the effective policy preview with source labels', () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: 'code_repo', profiles: PROFILES, preview: PREVIEW } })
    const prev = w.find('[data-test="policy-preview"]')
    expect(prev.exists()).toBe(true)
    expect(prev.text()).toContain('500,000')          // hard input limit formatted
    expect(prev.text()).toContain('Agent policy')     // profile source label
    expect(prev.text()).toContain('env fallback')     // deprecated env source shown as friendly label
  })

  it('does not render the preview when none is provided', () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '', profiles: PROFILES } })
    expect(w.find('[data-test="policy-preview"]').exists()).toBe(false)
  })

  it('does not emit when disabled', async () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '', profiles: PROFILES, disabled: true } })
    await w.find('[data-test="profile-fast"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeFalsy()
  })

  it('falls back to a built-in profile list when none passed', () => {
    const w = mount(ContextProfilePicker, { props: { modelValue: '' } })
    expect(w.find('[data-test="profile-deep_research"]').exists()).toBe(true)
    expect(w.find('[data-test="profile-data_analysis"]').exists()).toBe(true)
  })
})
