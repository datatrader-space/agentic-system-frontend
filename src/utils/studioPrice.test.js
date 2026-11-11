import { describe, expect, it } from 'vitest'
import { priceAmount, priceRule, routeOptionLabel, usd } from './studioPrice'

describe('studioPrice', () => {
  it('says money in cents, a third digit only when it says something', () => {
    expect([usd(0.09), usd(0.039), usd(0.002), usd(0.56), usd(1.2)]).toEqual(['$0.09', '$0.039', '$0.002', '$0.56', '$1.20'])
  })
  it('names a model, its connection and its price on one line', () => {
    expect(routeOptionLabel({ name: 'FLUX Video Edit', connection: 'sajid openrouter', price_label: '$0.09 for 3 s' })).toBe('FLUX Video Edit · sajid openrouter · $0.09 for 3 s')
    // A route with no connection label reads as the platform, never its provider (owner, 2026-10-29).
    expect(routeOptionLabel({ model: 'acme/x', provider: 'fal' })).toBe('acme/x · AADML')
  })
  it('says a live price one way for the price card and the bottom bar (ADM-1170)', () => {
    expect(priceAmount(null)).toBe('')
    // Owner 2026-11-11 (the industry's rule): the person never pays more than the most shown, so "at most" is a promise.
    expect(priceAmount({ status: 'exact', estimate: 0.5, most: 0.5 })).toBe('$0.50')
    expect(priceAmount({ status: 'estimated', estimate: 0.55, most: 0.88 })).toBe('About $0.55, at most $0.88')
    expect(priceAmount({ status: 'range', estimate: '0.30', most: '0.50' })).toBe('About $0.30, at most $0.50')
    expect(priceAmount({ status: 'estimated', estimate: 0.4, most: 0.4 })).toBe('About $0.40')
    expect(priceAmount({ status: 'unknown', estimate: 0, most: 1 })).toBe('No published price')
  })
  it('states the charging rule once, with the most the person can pay', () => {
    expect(priceRule(0.88)).toBe('You pay what it costs, never more than $0.88. A failed render costs nothing.')
  })
})
