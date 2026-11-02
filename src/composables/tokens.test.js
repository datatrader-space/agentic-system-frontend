import { describe, it, expect } from 'vitest'
import { fmtTokens, fmtCost, normalizeUsage, shownCost } from './tokens'

describe('tokens — formatting', () => {
  it('fmtTokens uses k-notation, dropping a trailing .0', () => {
    expect(fmtTokens(950)).toBe('950')
    expect(fmtTokens(4215)).toBe('4.2k')
    expect(fmtTokens(24600)).toBe('24.6k')
    expect(fmtTokens(1000)).toBe('1k')
    expect(fmtTokens(0)).toBe('0')
    expect(fmtTokens(null)).toBe('0')
  })

  it('fmtCost shows 3 decimals for small amounts, 2 for larger, "" for null', () => {
    expect(fmtCost(0.012)).toBe('$0.012')
    expect(fmtCost(1.2)).toBe('$1.20')
    expect(fmtCost(0)).toBe('$0.00')
    expect(fmtCost(null)).toBe('')
    expect(fmtCost(undefined)).toBe('')
  })

  it('normalizeUsage derives total + carries cached/cost, null when empty', () => {
    expect(normalizeUsage(null)).toBeNull()
    expect(normalizeUsage({})).toBeNull()
    const u = normalizeUsage({ prompt_tokens: 3212, completion_tokens: 1003, cached_tokens: 1120, cost_usd: 0.012 })
    expect(u.total).toBe(4215)
    expect(u.cached).toBe(1120)
    expect(u.cost).toBe(0.012)
    // honours provider input/output naming + explicit total
    const u2 = normalizeUsage({ input_tokens: 10, output_tokens: 5, total_tokens: 15 })
    expect(u2.total).toBe(15)
    expect(u2.prompt).toBe(10)
  })
})

describe('tokens — the person is shown the price, not the provider cost (2026-11-02)', () => {
  it('prefers price_usd / turn_price_usd and falls back to the cost', () => {
    expect(shownCost({ cost_usd: 0.041, price_usd: 0.0492 })).toBe(0.0492)
    expect(shownCost({ cost_usd: 0.041 })).toBe(0.041)
    expect(shownCost({ cost_usd: 0.01, price_usd: 0.012, turn_cost_usd: 0.041, turn_price_usd: 0.0492 },
      { turn: true })).toBe(0.0492)
    expect(shownCost({ cost_usd: 0.01, turn_cost_usd: 0.041 }, { turn: true })).toBe(0.041)
    expect(shownCost(null)).toBeNull()
    expect(shownCost({ total_tokens: 3 })).toBeNull()
  })

  it('normalizeUsage shows the whole turn at its price', () => {
    const u = normalizeUsage({ total_tokens: 900, cost_usd: 0.01, price_usd: 0.012, turn_total_tokens: 35900,
      turn_cost_usd: 0.041, turn_price_usd: 0.0492 })
    expect(u.cost).toBe(0.0492)
    expect(normalizeUsage({ total_tokens: 900, cost_usd: 0.01, price_usd: 0.012 }).cost).toBe(0.012)
  })
})
