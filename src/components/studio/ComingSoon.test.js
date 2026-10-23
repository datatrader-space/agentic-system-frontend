// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { createPinia } from 'pinia'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import ComingSoon from './ComingSoon.vue'
import { getStudioFeature } from '../../services/studioFeatures'
describe('ComingSoon', () => {
  it('shows the actual planned inputs and phase, links to a working page, and cannot submit', () => {
    const w = mount(ComingSoon, { props: { feature: getStudioFeature('motion') }, global: { plugins: [createPinia()], stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    expect(w.get('h1').text()).toBe('Motion transfer')
    expect(w.text()).toContain('Arrives with Phase P2')
    expect(w.text()).toContain('Source video')
    expect(w.get('a').attributes('href')).toBe('/video-studio/video')
    const generate = w.get('[data-test="studio-generate"]')
    expect(generate.attributes('disabled')).toBeDefined()
    expect(generate.classes()).not.toContain('primary')
    expect(generate.attributes('aria-describedby')).toBe(w.get('.qb-reason').attributes('id'))
    expect(w.get('.qb-reason').text()).toBe('Available with Phase P2')
    expect(w.get('fieldset').attributes('disabled')).toBeDefined()
    w.unmount()
  })
})

it('remembers a phase-aware first-visit hint independently for every planned page', async () => {
  localStorage.clear()
  const options=id=>({props:{feature:getStudioFeature(id)},global:{plugins:[createPinia()],provide:{studioUser:ref({id:'round5-owner'})},stubs:{RouterLink:{template:'<a><slot /></a>'}}}})
  let w=mount(ComingSoon,options('motion'))
  expect(w.get('[data-test="studio-first-visit"]').text()).toContain('Phase P2')
  await w.get('[data-test="studio-first-visit"] button').trigger('click');w.unmount()
  w=mount(ComingSoon,options('motion'));expect(w.find('[data-test="studio-first-visit"]').exists()).toBe(false);w.unmount()
  w=mount(ComingSoon,options('audio'));expect(w.get('[data-test="studio-first-visit"]').text()).toContain('Phase P0')
  expect(w.get('[data-test="studio-generate"]').attributes('disabled')).toBeDefined();w.unmount()
  localStorage.clear()
})
