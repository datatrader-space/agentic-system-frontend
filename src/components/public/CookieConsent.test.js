// @vitest-environment jsdom
// The consent banner appears only once the web font is in (page-speed plan Phase 6, ADM-1079): shown earlier it
// re-wrapped when Inter replaced the fallback and grew, a layout shift Lighthouse counted on /features.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('../../composables/useAnalytics', () => ({
  consentState: () => localStorage.getItem('aadml_consent'),
  setConsent: (granted) => localStorage.setItem('aadml_consent', granted ? 'granted' : 'denied'),
  trackPageview: vi.fn(),
}))
import CookieConsent from './CookieConsent.vue'

const stubs = { 'router-link': { template: '<a><slot /></a>' } }
let fontsReady
function withFonts(ready) {
  Object.defineProperty(document, 'fonts', { configurable: true, value: ready === undefined ? undefined : { ready } })
}

beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); delete document.fonts })

describe('CookieConsent', () => {
  it('waits for the web font, then appears at its final size', async () => {
    withFonts(new Promise((resolve) => { fontsReady = resolve }))
    const w = mount(CookieConsent, { global: { stubs } })
    await flushPromises()
    expect(w.find('.cc').exists()).toBe(false)
    fontsReady()
    await flushPromises()
    expect(w.find('.cc').exists()).toBe(true)
  })

  it('appears after 3 s when the font never loads', async () => {
    withFonts(new Promise(() => {}))
    const w = mount(CookieConsent, { global: { stubs } })
    await vi.advanceTimersByTimeAsync(2900)
    expect(w.find('.cc').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(w.find('.cc').exists()).toBe(true)
  })

  it('appears at once without the font API', async () => {
    withFonts(undefined)
    const w = mount(CookieConsent, { global: { stubs } })
    await flushPromises()
    expect(w.find('.cc').exists()).toBe(true)
  })

  it('never appears once a choice is saved', async () => {
    localStorage.setItem('aadml_consent', 'denied')
    withFonts(Promise.resolve())
    const w = mount(CookieConsent, { global: { stubs } })
    await vi.advanceTimersByTimeAsync(4000)
    expect(w.find('.cc').exists()).toBe(false)
  })

  it('Accept saves the choice and hides it', async () => {
    withFonts(Promise.resolve())
    const w = mount(CookieConsent, { global: { stubs } })
    await flushPromises()
    await w.find('.cc-btn.primary').trigger('click')
    expect(localStorage.getItem('aadml_consent')).toBe('granted')
    expect(w.find('.cc').exists()).toBe(false)
  })
})
