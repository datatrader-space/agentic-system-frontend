// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlatformLlmPolicy from './PlatformLlmPolicy.vue'

const ABSOLUTE = {
  max_input_tokens: 500000, max_tool_iterations: 50, max_images_per_turn: 20,
  max_image_bytes: 20971520, max_image_width: 8192, max_image_height: 8192,
}

describe('PlatformLlmPolicy', () => {
  it('renders the platform LLM policy fields', () => {
    const w = mount(PlatformLlmPolicy, { props: { modelValue: {}, absolute: ABSOLUTE } })
    expect(w.find('[data-test="plp-max_input_tokens"]').exists()).toBe(true)
    expect(w.find('[data-test="plp-max_tool_iterations"]').exists()).toBe(true)
    expect(w.find('[data-test="plp-max_images_per_turn"]').exists()).toBe(true)
    expect(w.find('[data-test="plp-image_downscale_enabled"]').exists()).toBe(true)
  })

  it('loads current values', () => {
    const w = mount(PlatformLlmPolicy, { props: { modelValue: { max_input_tokens: 250000 }, absolute: ABSOLUTE } })
    const input = w.find('[data-test="plp-max_input_tokens"] input')
    expect(input.element.value).toBe('250000')
  })

  it('emits update:modelValue with the parsed integer when a field changes', async () => {
    const w = mount(PlatformLlmPolicy, { props: { modelValue: {}, absolute: ABSOLUTE } })
    const input = w.find('[data-test="plp-max_input_tokens"] input')
    await input.setValue('250000')
    const last = w.emitted('update:modelValue').at(-1)[0]
    expect(last.max_input_tokens).toBe(250000)
    expect(w.emitted('change')).toBeTruthy()
  })

  it('clears a field (removes the key) when emptied', async () => {
    const w = mount(PlatformLlmPolicy, { props: { modelValue: { max_input_tokens: 250000 }, absolute: ABSOLUTE } })
    const input = w.find('[data-test="plp-max_input_tokens"] input')
    await input.setValue('')
    const last = w.emitted('update:modelValue').at(-1)[0]
    expect('max_input_tokens' in last).toBe(false)   // unset -> falls back to ABSOLUTE
  })

  it('shows the ABSOLUTE default (blank = this) as a read-only hint, plus a description', () => {
    const w = mount(PlatformLlmPolicy, { props: { modelValue: {}, absolute: ABSOLUTE } })
    const field = w.find('[data-test="plp-max_input_tokens"]')
    expect(field.text()).toContain('default 500,000')      // model B: absolute is the DEFAULT when blank
    expect(field.text().toLowerCase()).toContain('sent to the model')  // per-field description present
    // exactly one editable input in the field (the value) — the default is text, not an input
    expect(field.findAll('input').length).toBe(1)
  })

  it('renders validation errors from the API', () => {
    const w = mount(PlatformLlmPolicy, {
      props: { modelValue: {}, absolute: ABSOLUTE, errors: { max_input_tokens: "'max_input_tokens' must be > 0" } },
    })
    expect(w.find('[data-test="err-max_input_tokens"]').exists()).toBe(true)
    expect(w.find('[data-test="err-max_input_tokens"]').text()).toContain('must be > 0')
  })

  it('toggles image downscale', async () => {
    const w = mount(PlatformLlmPolicy, { props: { modelValue: { image_downscale_enabled: true }, absolute: ABSOLUTE } })
    await w.find('[data-test="plp-image_downscale_enabled"] input').setValue(false)
    const last = w.emitted('update:modelValue').at(-1)[0]
    expect(last.image_downscale_enabled).toBe(false)
  })

  it('explains that blank = the absolute default and a set value overrides it', () => {
    const w = mount(PlatformLlmPolicy, { props: { modelValue: {}, absolute: ABSOLUTE } })
    expect(w.text().toLowerCase()).toContain('platform defaults')
    expect(w.text().toLowerCase()).toContain('overrides')
    expect(w.text().toLowerCase()).toContain('tighten')
  })

  it('disables all inputs when disabled (non-admin)', () => {
    const w = mount(PlatformLlmPolicy, { props: { modelValue: {}, absolute: ABSOLUTE, disabled: true } })
    expect(w.findAll('input').every((i) => i.element.disabled)).toBe(true)
  })
})
