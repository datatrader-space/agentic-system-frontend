// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LivePrice from './LivePrice.vue'
describe('LivePrice', () => {
  it('puts the no-spend note on its own line, without a stray separator (live 2026-10-29)', () => {
    const w = mount(LivePrice, { props: { price: { status: 'exact', estimate: 0.04, most: 0.04 } } })
    expect(w.get('strong').text()).toBe('About $0.04')
    expect(w.get('.lp-note').text()).toBe('Nothing is spent until you press Generate on its card.')
    w.unmount()
  })

  it('says the price is an estimate, never "at most" (owner, 2026-11-03: the provider bills the final price)', () => {
    let w = mount(LivePrice, { props: { price: { status: 'range', estimate: 0.13, most: 0.17 } } })
    // Its own line, like the note: a wrapped line must not start with a stray separator (live 2026-11-03).
    expect(w.get('.lp-est').text()).toBe('An estimate: you pay what the provider bills.')
    expect(w.text()).not.toContain('·')
    expect(w.text()).not.toContain('at most')
    w.unmount()
    w = mount(LivePrice, { props: { price: { status: 'unknown', estimate: 0, most: 2 } } })
    expect(w.get('strong').text()).toBe('No published price')
    expect(w.text()).toContain('$2.00 is held')
    expect(w.text()).not.toContain('at most')
    w.unmount()
  })
})
