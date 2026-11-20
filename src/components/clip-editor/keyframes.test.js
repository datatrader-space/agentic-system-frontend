// The keyframe evaluator against the shared case table (contract section 4). The table's expected values come from an
// independent reference (plain bisection to 2^-200), so this checks the Newton solver and its fallback, to 1e-6.
import { describe, expect, it } from 'vitest'
import cases from './__cases__/keyframes.json'
import { cubicBezier, evaluate, valueAt, isAnimated } from './keyframes'

describe('keyframes: shared cases', () => {
  it('has cases', () => { expect(cases.length).toBeGreaterThan(20) })
  for (const [n, c] of cases.entries()) {
    it(`case ${n}: t=${c.t_ms} over ${c.keys.length} key(s)`, () => {
      expect(Math.abs(evaluate(c.keys, c.t_ms) - c.expected)).toBeLessThan(1e-6)
    })
  }
})

describe('keyframes: rules', () => {
  it('the CSS easings at known points', () => {
    expect(cubicBezier(0.42, 0, 0.58, 1, 0.5)).toBeCloseTo(0.5, 9)
    expect(cubicBezier(0, 0, 1, 1, 0.3)).toBeCloseTo(0.3, 6)
    expect(cubicBezier(0.42, 0, 1, 1, 0)).toBe(0)
    expect(cubicBezier(0.42, 0, 1, 1, 1)).toBe(1)
  })
  it('hold keeps the value until the next key, which then applies at once', () => {
    const keys = [{ t_ms: 0, v: 1, ease: 'hold' }, { t_ms: 100, v: 2 }]
    expect(evaluate(keys, 99.9)).toBe(1)
    expect(evaluate(keys, 100)).toBe(2)
  })
  it('a param with keyframes ignores its static value; one without uses it', () => {
    const item = { keyframes: { 'transform.scale': [{ t_ms: 0, v: 1 }, { t_ms: 1000, v: 2 }] } }
    expect(valueAt(item, 'transform.scale', 500, 9)).toBe(1.5)
    expect(valueAt(item, 'transform.x', 500, 0.25)).toBe(0.25)
    expect(isAnimated(item, 'transform.scale')).toBe(true)
    expect(isAnimated(item, 'transform.x')).toBe(false)
  })
  it('no keyframes reads as undefined', () => { expect(evaluate([], 10)).toBeUndefined() })
})
