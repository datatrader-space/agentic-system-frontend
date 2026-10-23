// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRouter: () => ({ currentRoute: { value: { fullPath: '/dashboard', path: '/dashboard' } }, push: vi.fn() }),
}))
vi.mock('../../services/api', () => ({ default: { post: vi.fn(() => Promise.resolve({})) } }))

import GuidedTourOverlay from './GuidedTourOverlay.vue'
import { useGuidedTour } from '../../composables/useGuidedTour'

const { state } = useGuidedTour()
let wrapper
afterEach(() => {
  wrapper?.unmount()
  state.active = false
  state.steps = []
  state.index = 0
  document.body.innerHTML = ''
})

function start(steps) {
  state.steps = steps
  state.index = 0
  state.active = true
}

describe('GuidedTourOverlay — overlays must not swallow clicks', () => {
  it('lets clicks through the dim when the step target is not on this screen', async () => {
    start([{ title: 'Open Agents', body: 'x', target_selector: '#not-here' }])
    wrapper = mount(GuidedTourOverlay, { global: { stubs: { Icon: true } } })
    await flushPromises()
    const dim = wrapper.find('.gt-dim')
    expect(dim.exists()).toBe(true)
    expect(dim.classes()).toContain('gt-dim--passive')
  })

  it('a step with no target keeps the blocking dim', async () => {
    start([{ title: 'Welcome', body: 'x' }])
    wrapper = mount(GuidedTourOverlay, { global: { stubs: { Icon: true } } })
    await flushPromises()
    expect(wrapper.find('.gt-dim').classes()).not.toContain('gt-dim--passive')
  })

  it('does not scroll the page from the scroll handler', async () => {
    const el = document.createElement('div')
    el.id = 'here'
    el.getBoundingClientRect = () => ({ top: 10, left: 10, width: 50, height: 20 })
    el.scrollIntoView = vi.fn()
    document.body.appendChild(el)
    start([{ title: 'Here', body: 'x', target_selector: '#here' }])
    wrapper = mount(GuidedTourOverlay, { global: { stubs: { Icon: true } } })
    await flushPromises()
    const afterLocate = el.scrollIntoView.mock.calls.length
    expect(afterLocate).toBeGreaterThanOrEqual(1)   // the step was brought into view once
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll'))
    expect(el.scrollIntoView.mock.calls.length).toBe(afterLocate)
  })
})
