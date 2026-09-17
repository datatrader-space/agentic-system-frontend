// @vitest-environment jsdom
// The Effort control offers only what is true for the agent's model and configuration (2026-09-17):
//   * a model that cannot reason → no control at all
//   * reasoning off in the agent's settings → a fixed "Off", nothing to pick
//   * otherwise → Auto + exactly the levels this provider accepts
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EffortSlider from './EffortSlider.vue'
import { useChatStore } from '../../stores/useChatStore'

const dots = (w) => w.findAll('.eff-dot').map((d) => d.attributes('data-test'))

describe('EffortSlider — offers what the model accepts', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('unknown options keep the full range (never hides a setting the backend may accept)', () => {
    const w = mount(EffortSlider, { props: { options: null } })
    expect(dots(w)).toEqual(['effort-auto', 'effort-off', 'effort-minimal', 'effort-low', 'effort-medium', 'effort-high'])
  })

  it('a model that cannot reason shows no control', () => {
    const w = mount(EffortSlider, { props: { options: { enabled: true, supported: false, levels: [] } } })
    expect(w.find('[data-test="composer-effort"]').exists()).toBe(false)
  })

  it('reasoning off in the agent config shows a fixed Off and clears any pick', () => {
    const chat = useChatStore()
    chat.reasoningEffort = 'high'
    const w = mount(EffortSlider, { props: { options: { enabled: false, supported: true, levels: ['low', 'medium', 'high'] } } })
    expect(w.find('[data-test="effort-locked-off"]').text()).toBe('(Off)')
    expect(w.find('[role="slider"]').exists()).toBe(false)
    expect(chat.reasoningEffort).toBe('')
  })

  it('reasoning on offers Auto plus the provider levels only', () => {
    const w = mount(EffortSlider, { props: { options: { enabled: true, supported: true, levels: ['low', 'high'] } } })
    expect(dots(w)).toEqual(['effort-auto', 'effort-low', 'effort-high'])
  })

  it('a stored level the model does not accept falls back to Auto', () => {
    const chat = useChatStore()
    chat.reasoningEffort = 'medium'
    mount(EffortSlider, { props: { options: { enabled: true, supported: true, levels: ['low', 'high'] } } })
    expect(chat.reasoningEffort).toBe('')
  })

  it('keyboard End picks the highest offered level', async () => {
    const chat = useChatStore()
    const w = mount(EffortSlider, { props: { options: { enabled: true, supported: true, levels: ['low', 'medium', 'high'] } } })
    await w.find('[role="slider"]').trigger('keydown', { key: 'End' })
    expect(chat.reasoningEffort).toBe('high')
  })
})
