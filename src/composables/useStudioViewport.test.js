// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useStudioViewport } from './useStudioViewport'

let wrapper
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })
function setup(viewport) {
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerHeight', 844)
  wrapper = mount({ setup: useStudioViewport, template: '<div />' })
}
it('fits the visible keyboard area, restores height on dismissal and removes listeners', () => {
  const viewport = new EventTarget()
  Object.assign(viewport, { height: 844, scale: 1 })
  const remove = vi.spyOn(viewport, 'removeEventListener')
  setup(viewport)
  expect(wrapper.vm.height).toBe('844px')
  expect(wrapper.vm.keyboardOpen).toBe(false)
  viewport.height = 430
  viewport.dispatchEvent(new Event('resize'))
  expect(wrapper.vm.height).toBe('430px')
  expect(wrapper.vm.keyboardOpen).toBe(true)
  viewport.height = 844
  viewport.dispatchEvent(new Event('resize'))
  expect(wrapper.vm.keyboardOpen).toBe(false)
  wrapper.unmount(); wrapper = null
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
})
it('does not treat pinch zoom as a keyboard or resize the layout around it', () => {
  const viewport = new EventTarget()
  Object.assign(viewport, { height: 400, scale: 2 })
  setup(viewport)
  expect(wrapper.vm.height).toBe(null)
  expect(wrapper.vm.keyboardOpen).toBe(false)
})
it('keeps the CSS viewport fallback when the browser has no visualViewport API', () => {
  setup(undefined)
  expect(wrapper.vm.height).toBe(null)
  expect(wrapper.vm.keyboardOpen).toBe(false)
})
