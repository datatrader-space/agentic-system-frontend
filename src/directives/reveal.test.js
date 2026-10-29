// @vitest-environment jsdom
// Phase 6 (ADM-1079): taking over a prerendered page must not hide what is already on screen.
import { describe, it, expect } from 'vitest'
import reveal, { keepOnScreenShown } from './reveal'

const at = (top) => {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ top, bottom: top + 100, left: 0, right: 200, width: 200, height: 100 })
  return el
}

describe('v-reveal', () => {
  it('hides an element until it scrolls into view, as before', () => {
    const el = at(10)
    reveal.mounted(el, {})
    expect(el.classList.contains('vm-reveal')).toBe(true)
  })

  it('while a prerendered page is taken over: leaves on-screen elements shown, still reveals the rest', () => {
    const onScreen = at(10)
    const below = at(window.innerHeight + 50)
    const result = keepOnScreenShown(() => {
      reveal.mounted(onScreen, {})
      reveal.mounted(below, { value: { delay: 120 } })
      return 'mounted'
    })
    expect(result).toBe('mounted')
    expect(onScreen.classList.contains('vm-reveal')).toBe(false)
    expect(below.classList.contains('vm-reveal')).toBe(true)
    expect(below.dataset.revealDelay).toBe('120')
  })

  it('applies only during that mount, also when the mount throws', () => {
    expect(() => keepOnScreenShown(() => { throw new Error('boom') })).toThrow('boom')
    const el = at(10)
    reveal.mounted(el, {})
    expect(el.classList.contains('vm-reveal')).toBe(true)
  })
})
