// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TourSpotlight from './TourSpotlight.vue'

let wrapper
let target
afterEach(() => { wrapper?.unmount(); target?.remove(); document.body.innerHTML = '' })

function addTarget() {
  target = document.createElement('button')
  target.id = 'tour-target'
  target.scrollIntoView = () => {}
  target.getBoundingClientRect = () => ({ top: 100, left: 200, width: 80, height: 30, right: 280, bottom: 130 })
  Object.defineProperty(target, 'offsetParent', { get: () => document.body })
  document.body.appendChild(target)
}

describe('TourSpotlight — the highlighted control stays clickable', () => {
  it('covers everything AROUND the hole with four panels, not the hole itself', async () => {
    addTarget()
    wrapper = mount(TourSpotlight, {
      attachTo: document.body,
      props: { step: { target: '#tour-target', title: 'Click this', description: '' }, index: 0, total: 2 },
    })
    await flushPromises()
    const panels = document.querySelectorAll('.tour-catcher--panel')
    expect(panels.length).toBe(4)
    // No full-screen catcher on top of the target.
    expect(document.querySelectorAll('.tour-catcher:not(.tour-catcher--panel)').length).toBe(0)
    // The panels leave the padded target rect (top 92, left 192, 96x46) uncovered.
    const [top, bottom, left, right] = [...panels].map((p) => p.style)
    expect(top.height).toBe('92px')
    expect(bottom.top).toBe('138px')
    expect(left.width).toBe('192px')
    expect(right.left).toBe('288px')
  })

  it('keeps a full catcher for a step with no target (centered card)', async () => {
    wrapper = mount(TourSpotlight, {
      attachTo: document.body,
      props: { step: { title: 'Welcome', description: '' }, index: 0, total: 2 },
    })
    await flushPromises()
    expect(document.querySelectorAll('.tour-catcher--panel').length).toBe(0)
    expect(document.querySelectorAll('.tour-catcher').length).toBe(1)
  })
})
