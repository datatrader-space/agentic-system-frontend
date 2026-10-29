// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import ModelPicker from './ModelPicker.vue'

const MODELS = [
  { id: 1, name: 'Kling v3.0 Pro', model_id: 'kwaivgi/kling-v3.0-pro', metadata: {} },
  { id: 2, name: 'Veo 3.1', model_id: 'google/veo-3.1', metadata: {} },
  { id: 3, name: 'Seedance 2.0', model_id: 'bytedance/seedance-2.0', metadata: {} },
  { id: 4, name: 'Qwen3 14B', model_id: 'qwen/qwen3-14b', metadata: { description: 'Chat model with tool use' } },
]

async function searchFor(q) {
  const w = mount(ModelPicker, { props: { models: MODELS }, attachTo: document.body })
  await w.find('button').trigger('click')
  await w.find('input').setValue(q)
  await nextTick()
  const names = w.vm.filtered.map((m) => m.name)
  w.unmount()
  return names
}

describe('ModelPicker search finds a model by the words of its name', () => {
  it('matches words that are not adjacent ("kling pro")', async () => {
    expect(await searchFor('kling pro')).toEqual(['Kling v3.0 Pro'])
  })

  it('ignores punctuation in the id ("veo 3.1" finds google/veo-3.1)', async () => {
    expect(await searchFor('veo 3.1')).toEqual(['Veo 3.1'])
  })

  it('matches the vendor as a word ("bytedance")', async () => {
    expect(await searchFor('bytedance')).toEqual(['Seedance 2.0'])
  })

  it('is case-insensitive and needs every word', async () => {
    expect(await searchFor('KLING')).toEqual(['Kling v3.0 Pro'])
    expect(await searchFor('kling veo')).toEqual([])
  })

  it('still matches a description', async () => {
    expect(await searchFor('tool use')).toEqual(['Qwen3 14B'])
  })

  it('shows every model with an empty search', async () => {
    expect((await searchFor('  ')).length).toBe(MODELS.length)
  })
})

describe('ModelPicker is one accessible, keyboard-driven list that names no provider (owner, 2026-10-29)', () => {
  const ROUTED = [
    { id: 1, name: 'OpenAI: GPT-6 Luna', model_id: 'openai/gpt-6-luna', metadata: {} },
    { id: 2, name: 'Flux LoRA', model_id: 'fal-ai/flux-lora', metadata: {} },
    { id: 3, name: 'Claude Opus', model_id: 'anthropic/claude-opus', metadata: {} },
  ]

  it('groups by the model maker, and a model id that starts with a route groups under Other', async () => {
    const w = mount(ModelPicker, { props: { models: ROUTED, ariaLabel: 'Main model' }, attachTo: document.body })
    await w.get('[data-test="model-picker-trigger"]').trigger('click')
    const labels = w.vm.groups.map((g) => g.label)
    expect(labels).toContain('Other')
    expect(labels.join(' ')).not.toMatch(/fal/i)
    w.unmount()
  })

  it('names the field and the pick, opens a listbox, and walks it with the arrow keys and Enter', async () => {
    const w = mount(ModelPicker, { props: { models: ROUTED, modelValue: 1, ariaLabel: 'Main model' }, attachTo: document.body })
    const trigger = w.get('[data-test="model-picker-trigger"]')
    expect(trigger.attributes('aria-label')).toBe('Main model: OpenAI: GPT-6 Luna')
    expect(trigger.attributes('aria-haspopup')).toBe('listbox')
    await trigger.trigger('click')
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(w.find('[role="listbox"]').exists()).toBe(true)
    const search = w.get('[data-test="model-picker-search"]')
    await search.trigger('keydown', { key: 'ArrowDown' })
    expect(search.attributes('aria-activedescendant')).toBeTruthy()
    await search.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')).toBeTruthy()
    expect(w.find('[role="listbox"]').exists()).toBe(false)
    w.unmount()
  })

  it('Escape closes the list', async () => {
    const w = mount(ModelPicker, { props: { models: ROUTED }, attachTo: document.body })
    await w.get('[data-test="model-picker-trigger"]').trigger('click')
    await w.get('[data-test="model-picker-search"]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[role="listbox"]').exists()).toBe(false)
    expect(w.emitted('update:modelValue')).toBeFalsy()
    w.unmount()
  })
})
