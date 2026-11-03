// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
vi.mock('../../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { presets: {} } })) } }))
import StudioLookPreview from './StudioLookPreview.vue'
const stubs = { RouterLink: { name: 'RouterLink', props: ['to'], template: '<a data-test="look-see-all" :data-to="JSON.stringify(to)"><slot /></a>' }, StudioLookDetails: true, StudioLookMedia: true }
describe('Look preview', () => {
  it('"See all" opens the Library filtered to this look', () => {
    const w = mount(StudioLookPreview, { props: { look: { id: 'neon-noir', title: 'Neon noir', purpose: 'p' } }, global: { stubs } })
    expect(w.getComponent({ name: 'RouterLink' }).props('to')).toEqual({ path: '/video-studio/library', query: { preset: 'neon-noir' } })
    expect(w.get('[data-test="look-see-all"]').text()).toBe('See all'); w.unmount()
  })
  it('has no "See all" for a look id the backend would refuse', () => {
    const w = mount(StudioLookPreview, { props: { look: { id: 'Bad Id', title: 'x', purpose: 'p' } }, global: { stubs } })
    expect(w.find('[data-test="look-see-all"]').exists()).toBe(false); w.unmount()
  })
})
