// @vitest-environment jsdom
// A refusal says the field and the models that can, in words (live 2026-10-28: "model: Choose a video model first.
// Alternatives: [object Object], [object Object]").
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CreativeError from './CreativeError.vue'

describe('CreativeError', () => {
  it('names the field and the models that can, never [object Object]', () => {
    const w = mount(CreativeError, { props: { error: { field: 'model', message: 'Choose a video model first.',
      alternatives: [{ route_id: 1, model_id: 'a/b', name: 'Kling 3.0 Pro' }, { route_id: 2, model_id: 'c/d', name: 'Kling 3.0 Pro' }, { route_id: 3, model_id: 'x/wan' }] } } })
    expect(w.text()).toBe('Model: Choose a video model first. Models that can: Kling 3.0 Pro, x/wan.')
    expect(w.text()).not.toContain('object')
  })
  it('says a request field in words', () => {
    const w = mount(CreativeError, { props: { error: { field: 'request.upscale_factor', message: 'this model enlarges 1.5× to 3×' } } })
    expect(w.text()).toBe('Upscale factor: this model enlarges 1.5× to 3×')
  })
})
