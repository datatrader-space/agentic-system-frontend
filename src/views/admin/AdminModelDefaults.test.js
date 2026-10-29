// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminModelDefaults from './AdminModelDefaults.vue'

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))

const luna = { id: 1, name: 'GPT-6 Luna', model_id: 'openai/gpt-6-luna', provider_name: 'Platform OpenRouter', pricing_input: '0.000001', pricing_output: '0.000004' }
const gemini = { id: 2, name: 'Gemini 2.5 Flash', model_id: 'google/gemini-2.5-flash', provider_name: 'Platform OpenRouter' }
const payload = (main = luna) => ({ slots: [
  { slot: 'default_model', label: 'Main model', model: main, options: [luna, gemini] },
  { slot: 'video_input_model', label: 'Video input', model: gemini, options: [gemini] },
  { slot: 'audio_model', label: 'Audio generation', model: null, options: [] },
] })

const stubs = {
  ModelPicker: {
    props: ['modelValue', 'models', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<select class="picker" :value="modelValue ?? \'\'" @change="$emit(\'update:modelValue\', $event.target.value ? Number($event.target.value) : null)"><option value="">{{ placeholder }}</option><option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option></select>',
  },
}

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({ data: payload() })
  api.put.mockReset()
})

describe('AdminModelDefaults (PLATFORM_MODEL_DEFAULTS_PLAN.md)', () => {
  it('shows each job with its default, its price, and says when no model can do it', async () => {
    const w = mount(AdminModelDefaults, { global: { stubs } })
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/admin/platform-model-defaults/')
    const main = w.get('[data-test="default-default_model"]')
    expect(main.text()).toContain('Main model')
    expect(main.text()).toContain('$1.00 in / $4.00 out per 1M tokens')
    expect(w.get('[data-test="default-audio_model"]').text()).toContain('No platform model can do this yet')
    expect(w.get('[data-test="defaults-save"]').attributes('disabled')).toBeDefined()   // nothing changed yet
  })

  it('saves only what changed', async () => {
    api.put.mockResolvedValue({ data: payload(gemini) })
    const w = mount(AdminModelDefaults, { global: { stubs } })
    await flushPromises()
    await w.get('[data-test="default-default_model"] select').setValue('2')
    await w.get('[data-test="defaults-save"]').trigger('click')
    await flushPromises()
    expect(api.put).toHaveBeenCalledExactlyOnceWith('/admin/platform-model-defaults/', { default_model: 2 })
    expect(w.text()).toContain('Saved')
  })

  it('shows why a default was refused, next to it', async () => {
    api.put.mockRejectedValue({ response: { data: { error: { message: 'Some defaults were not saved.', fields: { default_model: 'openai/x cannot do the Main model job.' } } } } })
    const w = mount(AdminModelDefaults, { global: { stubs } })
    await flushPromises()
    await w.get('[data-test="default-default_model"] select').setValue('2')
    await w.get('[data-test="defaults-save"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="default-default_model"]').text()).toContain('cannot do the Main model job')
    expect(w.text()).toContain('Some defaults were not saved.')
  })
})
