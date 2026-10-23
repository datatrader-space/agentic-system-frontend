// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import VideoStudioSoon from './VideoStudioSoon.vue'
import { studioFeatures } from '../services/studioFeatures'
describe('Unavailable creative-suite pages', () => {
  it.each(studioFeatures.value.filter(feature => feature.status === 'soon'))('renders $label with its real phase and a disabled action', feature => {
    const w = mount(VideoStudioSoon, { props: { featureId: feature.id }, global: { plugins: [createPinia()], stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    expect(w.get('h1').text()).toBe(feature.label); expect(w.text()).toContain(`Arrives with Phase ${feature.phase}`)
    expect(w.get('[data-test="studio-generate"]').attributes('disabled')).toBeDefined()
    expect(w.get('a').attributes('href')).toBe(feature.liveAlternative)
    w.unmount()
  })
})
