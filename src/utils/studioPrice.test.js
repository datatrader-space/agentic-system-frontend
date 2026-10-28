import { describe, expect, it } from 'vitest'
import { routeOptionLabel, usd } from './studioPrice'

describe('studioPrice', () => {
  it('says money in cents, a third digit only when it says something', () => {
    expect([usd(0.09), usd(0.039), usd(0.002), usd(0.56), usd(1.2)]).toEqual(['$0.09', '$0.039', '$0.002', '$0.56', '$1.20'])
  })
  it('names a model, its connection and its price on one line', () => {
    expect(routeOptionLabel({ name: 'FLUX Video Edit', connection: 'sajid openrouter', price_label: '$0.09 for 3 s' })).toBe('FLUX Video Edit · sajid openrouter · $0.09 for 3 s')
    expect(routeOptionLabel({ model: 'acme/x', provider: 'fal' })).toBe('acme/x · fal')
  })
})
