import { describe, expect, it } from 'vitest'
import { balanceText } from './money'

describe('balanceText', () => {
  it('rounds down, never up', () => {
    expect(balanceText('0.99851375')).toBe('$0.99')
    expect(balanceText('1')).toBe('$1.00')
    expect(balanceText('12.349')).toBe('$12.34')
    expect(balanceText('0.29')).toBe('$0.29')        // no float drift below the real value
  })
  it('says "under $0.01" for a balance that rounds down to nothing', () => {
    expect(balanceText('0.004')).toBe('under $0.01')
  })
  it('shows a debt as negative, rounded toward more debt', () => {
    expect(balanceText('-0.5')).toBe('−$0.50')
    expect(balanceText('-0.501')).toBe('−$0.51')
  })
  it('shows $0.00 for nothing or a missing value', () => {
    expect(balanceText('0')).toBe('$0.00')
    expect(balanceText(undefined)).toBe('$0.00')
  })
})
