// The mask refinement of the Image edit page (ADM-1251): white (255) is the area that changes.
import { describe, expect, it } from 'vitest'
import { boxFrom, edgeStep, fractionOf, fromRGBA, grow, hasArea, invert, shrink, tintRGBA, toRGBA, union } from './maskMath'

// A width x height mask with the cells listed as [x, y] on.
function maskOf(width, height, on = []) {
  const m = new Uint8Array(width * height)
  for (const [x, y] of on) m[y * width + x] = 255
  return m
}
const count = m => m.reduce((n, v) => n + (v ? 1 : 0), 0)

describe('mask math', () => {
  it('inverts, unites and knows whether anything is marked', () => {
    const m = maskOf(3, 1, [[0, 0]])
    expect(Array.from(invert(m))).toEqual([0, 255, 255])
    expect(Array.from(union(m, maskOf(3, 1, [[2, 0]])))).toEqual([255, 0, 255])
    expect(hasArea(m)).toBe(true)
    expect(hasArea(maskOf(3, 1))).toBe(false)
  })

  it('grows a single pixel into a disc of the radius and shrinks it back to nothing', () => {
    const m = maskOf(21, 21, [[10, 10]])
    const grown = grow(m, 21, 21, 3)
    expect(grown[10 * 21 + 13]).toBe(255)                 // 3 px to the right
    expect(grown[10 * 21 + 14]).toBe(0)                   // 4 px: outside
    expect(grown[13 * 21 + 13]).toBe(0)                   // the corner of the square is not in the disc
    expect(count(grown)).toBeGreaterThan(25)
    expect(count(grown)).toBeLessThan(49)
    expect(hasArea(shrink(m, 21, 21, 1))).toBe(false)
    expect(grow(m, 21, 21, 0)).toEqual(m)
  })

  it('shrinks a square evenly from every side', () => {
    const on = []
    for (let y = 2; y < 9; y++) for (let x = 2; x < 9; x++) on.push([x, y])
    const out = shrink(maskOf(11, 11, on), 11, 11, 2)
    expect(count(out)).toBe(9)                            // 7x7 loses 2 on each side: 3x3
    expect(out[5 * 11 + 5]).toBe(255)
    expect(out[3 * 11 + 3]).toBe(0)
  })

  it('reads canvas pixels and writes the black-and-white PNG pixels and the tinted overlay', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 0])
    expect(Array.from(fromRGBA(rgba, 3, 1))).toEqual([255, 0, 0])           // a see-through pixel is not marked
    expect(Array.from(toRGBA(maskOf(2, 1, [[1, 0]])))).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
    expect(Array.from(tintRGBA(maskOf(2, 1, [[0, 0]]), [1, 2, 3, 4]))).toEqual([1, 2, 3, 4, 0, 0, 0, 0])
  })

  it('turns pointer positions into fractions of the shown picture, and a drag into a box', () => {
    const rect = { left: 100, top: 50, width: 200, height: 100 }
    expect(fractionOf(150, 75, rect)).toEqual({ x: 0.25, y: 0.25 })
    expect(fractionOf(400, 0, rect)).toEqual({ x: 1, y: 0 })                 // clamped to the picture
    expect(boxFrom({ x: 0.8, y: 0.6 }, { x: 0.2, y: 0.1 })).toEqual({ x_min: 0.2, y_min: 0.1, x_max: 0.8, y_max: 0.6 })
    expect(boxFrom({ x: 0.5, y: 0.5 }, { x: 0.505, y: 0.9 })).toBeNull()      // a click, not a drag
    expect(edgeStep(4000, 3000)).toBe(20)
    expect(edgeStep(100, 50)).toBe(2)
  })
})
