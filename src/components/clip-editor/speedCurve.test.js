// Speed curves against the shared case table (contract section 5). The table comes from an independent numeric
// reference (the time integral of 1 / speed by the midpoint rule over 200 000 steps), so the closed forms are checked.
import { describe, expect, it } from 'vitest'
import cases from './__cases__/speed.json'
import { clipEnd, clipFrames, clipLength, curveLength, frameAt, snapMs, sourceAt, sourceTimeAt } from './speedCurve'

describe('speed curves: shared cases', () => {
  for (const [n, c] of cases.entries()) {
    // The server's case table (video_studio/editor_cases/speed.json): expected_length_ms is the raw integral,
    // expected_snapped_ms the clip's length on the grid at `rate`, samples [timeline ms, source ms].
    it(`case ${n}: ${c.name}`, () => {
      expect(Math.abs(curveLength(c.points, c.source_ms) - c.expected_length_ms)).toBeLessThan(1e-3)
      const item = { type: 'clip', start_ms: 0, source_in_ms: 1000, source_out_ms: 1000 + c.source_ms, speed_curve: c.points }
      expect(clipLength(item, c.rate)).toBe(c.expected_snapped_ms)
      for (const [t, src] of c.samples) expect(Math.abs(sourceAt(c.points, c.source_ms, t).source - src)).toBeLessThan(0.05)
    })
  }
})

describe('the frame grid and clip lengths', () => {
  it('frames at 30 fps land on whole milliseconds, rounding half up', () => {
    expect([0, 1, 2, 3].map(n => frameAt(n, 30))).toEqual([0, 33, 67, 100])
    expect(snapMs(50, 30)).toBe(67)
    expect(snapMs(49, 30)).toBe(33)
    expect(snapMs(1000, 24)).toBe(1000)
  })
  it('a constant speed divides the source range, then snaps', () => {
    expect(clipLength({ start_ms: 0, source_in_ms: 0, source_out_ms: 1000, speed: 3 }, 30)).toBe(333)
    expect(clipLength({ start_ms: 0, hold_ms: 1500 }, 30)).toBe(1500)
  })
  it('a clip ends in whole frames: F(frame(start) + L), never start + snap(length) (2026-11-19 correction)', () => {
    const item = { start_ms: 33, source_in_ms: 0, source_out_ms: 33 }
    expect(clipFrames(item, 30)).toBe(1)
    expect(clipEnd(item, 30)).toBe(67)
    expect(clipLength(item, 30)).toBe(34)
    expect(clipEnd({ start_ms: 1000, source_in_ms: 0, source_out_ms: 1000, speed: 3 }, 30)).toBe(1333)
  })
  it('the source time follows the speed, curve, freeze and picture rules', () => {
    expect(sourceTimeAt({ start_ms: 1000, source_in_ms: 500, source_out_ms: 2500, speed: 2 }, 1500)).toEqual({ ms: 1500, speed: 2 })
    expect(sourceTimeAt({ start_ms: 0, source_in_ms: 0, source_out_ms: 4000, freeze_at_ms: 1234, hold_ms: 2000 }, 500).ms).toBe(1234)
    const curve = { start_ms: 0, source_in_ms: 0, source_out_ms: 6000, speed_curve: [{ x: 0, y: 1 }, { x: 1, y: 1 }] }
    expect(sourceTimeAt(curve, 2500).ms).toBeCloseTo(2500, 6)
  })
})
