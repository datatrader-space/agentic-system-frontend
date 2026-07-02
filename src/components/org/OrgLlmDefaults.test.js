// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OrgLlmDefaults from './OrgLlmDefaults.vue'

const PLATFORM = { max_input_tokens: 250000, max_tool_iterations: 50 }
const ABSOLUTE = {
  max_input_tokens: 500000, max_tool_iterations: 50, max_images_per_turn: 20,
  max_image_bytes: 20971520, max_image_width: 8192, max_image_height: 8192,
}
const PREVIEW = {
  profile: 'deep_research', profile_source: 'org_policy',
  hard_input_limit: 120000, max_tool_iterations: 8, total_tool_context_budget: 30000,
  sources: { hard_input_limit: 'org_policy', max_tool_iterations: 'org_policy', total_tool_context_budget: 'org_policy' },
}

function mountIt(props = {}) {
  return mount(OrgLlmDefaults, {
    props: { modelValue: {}, platform: PLATFORM, absolute: ABSOLUTE, preview: PREVIEW, ...props },
  })
}

describe('OrgLlmDefaults', () => {
  it('renders the default-profile dropdown and numeric fields', () => {
    const w = mountIt()
    expect(w.find('[data-test="old-default_context_profile"]').exists()).toBe(true)
    expect(w.find('[data-test="old-max_input_tokens"]').exists()).toBe(true)
    expect(w.find('[data-test="old-max_tool_iterations"]').exists()).toBe(true)
    expect(w.find('[data-test="old-image_downscale_enabled"]').exists()).toBe(true)
  })

  it('lists all five context profiles plus the no-default option', () => {
    const w = mountIt()
    const opts = w.find('[data-test="old-default_context_profile"] select').findAll('option')
    // 5 profiles + 1 "no org default"
    expect(opts.length).toBe(6)
    const values = opts.map((o) => o.element.value)
    expect(values).toEqual(['', 'fast', 'balanced', 'deep_research', 'code_repo', 'data_analysis'])
  })

  it('loads the current default profile', () => {
    const w = mountIt({ modelValue: { default_context_profile: 'code_repo' } })
    const sel = w.find('[data-test="old-default_context_profile"] select')
    expect(sel.element.value).toBe('code_repo')
  })

  it('emits the chosen profile', async () => {
    const w = mountIt()
    await w.find('[data-test="old-default_context_profile"] select').setValue('deep_research')
    const last = w.emitted('update:modelValue').at(-1)[0]
    expect(last.default_context_profile).toBe('deep_research')
    expect(w.emitted('change')).toBeTruthy()
  })

  it('clears the profile key when "no org default" is selected', async () => {
    const w = mountIt({ modelValue: { default_context_profile: 'fast' } })
    await w.find('[data-test="old-default_context_profile"] select').setValue('')
    const last = w.emitted('update:modelValue').at(-1)[0]
    expect('default_context_profile' in last).toBe(false)
  })

  it('loads a current numeric value', () => {
    const w = mountIt({ modelValue: { max_input_tokens: 120000 } })
    expect(w.find('[data-test="old-max_input_tokens"] input').element.value).toBe('120000')
  })

  it('emits the parsed integer when a numeric field changes', async () => {
    const w = mountIt()
    await w.find('[data-test="old-max_input_tokens"] input').setValue('120000')
    const last = w.emitted('update:modelValue').at(-1)[0]
    expect(last.max_input_tokens).toBe(120000)
  })

  it('removes the key when a numeric field is emptied (inherit platform)', async () => {
    const w = mountIt({ modelValue: { max_input_tokens: 120000 } })
    await w.find('[data-test="old-max_input_tokens"] input').setValue('')
    const last = w.emitted('update:modelValue').at(-1)[0]
    expect('max_input_tokens' in last).toBe(false)
  })

  it('caps the input max at min(platform, absolute)', () => {
    const w = mountIt()
    // platform 250000 < absolute 500000 -> ceiling 250000
    const input = w.find('[data-test="old-max_input_tokens"] input')
    expect(input.attributes('max')).toBe('250000')
    expect(w.find('[data-test="old-max_input_tokens"]').text()).toContain('max 250,000')
  })

  it('shows the platform ceiling as the placeholder hint', () => {
    const w = mountIt()
    const input = w.find('[data-test="old-max_input_tokens"] input')
    expect(input.attributes('placeholder')).toContain('platform: 250,000')
  })

  it('falls back to the ABSOLUTE default in the placeholder + max when platform is unset', () => {
    // max_image_bytes has no platform ceiling here -> show the absolute default (20,971,520)
    const w = mountIt()
    const field = w.find('[data-test="old-max_image_bytes"]')
    const input = field.find('input')
    expect(input.attributes('placeholder')).toContain('absolute default: 20,971,520')
    expect(input.attributes('max')).toBe('20971520')
    expect(field.text()).toContain('max 20,971,520')
    expect(field.text()).toContain('absolute default')
  })

  it('still shows the max cap from baked-in ABSOLUTE defaults when the API sends no platform/absolute', () => {
    const w = mount(OrgLlmDefaults, { props: { modelValue: {}, platform: {}, absolute: {}, preview: null } })
    const field = w.find('[data-test="old-max_input_tokens"]')
    const input = field.find('input')
    expect(input.attributes('placeholder')).toContain('absolute default: 500,000')
    expect(input.attributes('max')).toBe('500000')
    expect(field.text()).toContain('max 500,000')
    // and every numeric field has a concrete cap, never "no limit"
    expect(w.find('[data-test="old-max_tool_iterations"] input').attributes('placeholder')).toContain('absolute default: 50')
    expect(w.find('[data-test="old-max_image_bytes"] input').attributes('max')).toBe('20971520')
  })

  it('clamps a value above the cap down to the cap and shows a notice', async () => {
    const w = mountIt()
    const input = w.find('[data-test="old-max_input_tokens"] input')
    await input.setValue('999999')                     // above platform 250,000
    const last = w.emitted('update:modelValue').at(-1)[0]
    expect(last.max_input_tokens).toBe(250000)         // clamped to platform ceiling
    expect(w.find('[data-test="capped-max_input_tokens"]').exists()).toBe(true)
    expect(w.find('[data-test="capped-max_input_tokens"]').text()).toContain('250,000')
  })

  it('renders per-key validation errors from the API', () => {
    const w = mountIt({ errors: { max_input_tokens: "'max_input_tokens' (400000) exceeds the platform limit (250000)" } })
    expect(w.find('[data-test="err-max_input_tokens"]').exists()).toBe(true)
    expect(w.find('[data-test="err-max_input_tokens"]').text()).toContain('exceeds the platform limit')
  })

  it('renders the effective preview with the binding source', () => {
    const w = mountIt()
    const prof = w.find('[data-test="preview-profile"]')
    expect(prof.text()).toContain('deep_research')
    expect(prof.text()).toContain('org_policy')
    const inputRow = w.find('[data-test="preview-hard_input_limit"]')
    expect(inputRow.text()).toContain('120,000')     // final resolved
    expect(inputRow.text()).toContain('org_policy')  // source
  })

  it('preview shows platform vs org vs final for a ceiling', () => {
    const w = mountIt({ modelValue: { max_input_tokens: 120000 } })
    const row = w.find('[data-test="preview-hard_input_limit"]')
    expect(row.text()).toContain('250,000')  // platform
    expect(row.text()).toContain('120,000')  // org + final
  })

  it('disables all inputs when disabled=true', () => {
    const w = mountIt({ disabled: true })
    expect(w.find('[data-test="old-default_context_profile"] select').element.disabled).toBe(true)
    expect(w.find('[data-test="old-max_input_tokens"] input').element.disabled).toBe(true)
  })
})
