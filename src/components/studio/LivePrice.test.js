// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LivePrice from './LivePrice.vue'
const price = over => ({ status: 'exact', estimate: 0.04, most: 0.04, reason: '', adjustments: [], needsAcceptance: false, ...over })
describe('LivePrice', () => {
  it('puts the no-spend note on its own line, without a stray separator (live 2026-10-29)', () => {
    const w = mount(LivePrice, { props: { price: price() } })
    expect(w.get('strong').text()).toBe('$0.04')
    expect(w.findAll('.lp-note').at(-1).text()).toBe('Nothing is spent until you press Generate on its card.')
    // Owner 2026-11-11 (the industry's rule): what it costs, never more than the most shown, nothing for a failure.
    expect(w.get('.lp-est').text()).toBe('You pay what it costs, never more than $0.04. A failed render costs nothing.')
    w.unmount()
  })
  it('an estimated price is shown as about the estimate, at most the most it can cost', () => {
    const w = mount(LivePrice, { props: { price: price({ status: 'estimated', estimate: 0.2, most: 0.6 }) } })
    expect(w.get('strong').text()).toBe('About $0.20, at most $0.60')
    expect(w.get('.lp-est').text()).toBe('You pay what it costs, never more than $0.60. A failed render costs nothing.')
    w.unmount()
  })
  it('an unknown price says why, and never $0', () => {
    const w = mount(LivePrice, { props: { price: price({ status: 'unknown', estimate: 0, most: null, reason: 'priced per token, known once made' }) } })
    expect(w.get('strong').text()).toBe('No published price')
    expect(w.get('[data-test="live-price-reason"]').text()).toBe('Priced per token, known once made.')
    expect(w.text()).not.toContain('$0')
    w.unmount()
  })
  it('shows the adjustments and asks the person to accept them', async () => {
    const w = mount(LivePrice, { props: { price: price({ adjustments: [{ field: 'aspect_ratio', requested: '21:9', proposed: '16:9', reason: 'the model supports 16:9, 9:16' }], needsAcceptance: true }), accepted: false } })
    expect(w.get('[data-test="live-price-adjustments"] li').text()).toBe('Aspect ratio: you asked for 21:9; it would use 16:9 (the model supports 16:9, 9:16).')
    expect(w.text()).toContain('Accept the changes, or change the settings, to continue.')
    await w.get('[data-test="live-price-accept"]').setValue(true)
    expect(w.emitted('update:accepted')).toEqual([[true]])
    await w.setProps({ accepted: true })
    expect(w.text()).not.toContain('Accept the changes, or change the settings')
    w.unmount()
  })
  it('a model that cannot be charged for says so and to choose another', () => {
    const w = mount(LivePrice, { props: { problem: 'This model has no price, so it cannot be used.', code: 'not_priced' } })
    expect(w.get('[data-test="live-price-problem"]').text()).toBe('This model has no price, so it cannot be used.')
    expect(w.text()).toContain('Choose another model to continue.')
    w.unmount()
  })

  it('the rule is its own line, and an unpriced model is capped at its hold', () => {
    let w = mount(LivePrice, { props: { price: { status: 'range', estimate: 0.13, most: 0.17 } } })
    // Its own line, like the note: a wrapped line must not start with a stray separator (live 2026-11-03).
    expect(w.get('.lp-est').text()).toBe('You pay what it costs, never more than $0.17. A failed render costs nothing.')
    expect(w.text()).not.toContain('·')
    w.unmount()
    w = mount(LivePrice, { props: { price: { status: 'unknown', estimate: 0, most: 2 } } })
    expect(w.get('[data-test="live-price"]').text()).toContain('No published price, at most $2.00')
    expect(w.get('.lp-est').text()).toBe('You pay what it costs, never more than $2.00. A failed render costs nothing.')
    w.unmount()
  })
})
