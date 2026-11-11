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
  { slot: 'fast_model', label: 'Fast model', model: null, options: [luna, gemini] },
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

describe('the Fast model slot (AGENT_ENGINE_CAPABILITIES_PLAN.md section 9, D5)', () => {
  it('is listed with what it is for, and saves like every other slot', async () => {
    api.put.mockResolvedValue({ data: payload() })
    const w = mount(AdminModelDefaults, { global: { stubs } })
    await flushPromises()
    const fast = w.get('[data-test="default-fast_model"]')
    expect(fast.text()).toContain('Fast model')
    expect(fast.text()).toContain('Small steps: summaries, notes, Explore subagents.')
    await fast.get('select').setValue('2')
    await w.get('[data-test="defaults-save"]').trigger('click')
    await flushPromises()
    expect(api.put).toHaveBeenCalledExactlyOnceWith('/admin/platform-model-defaults/', { fast_model: 2 })
  })

  it('is still named when the server sends no label for it', async () => {
    api.get.mockResolvedValue({ data: { slots: [{ slot: 'fast_model', label: '', model: null, options: [] }] } })
    const w = mount(AdminModelDefaults, { global: { stubs } })
    await flushPromises()
    expect(w.get('[data-test="default-fast_model"] .md-label').text()).toBe('Fast model')
  })
})
