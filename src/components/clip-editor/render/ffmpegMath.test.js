// The CPU ports of ffmpeg's filter maths against ffmpeg itself (__cases__/ffmpeg_ref.json, made by running ffmpeg's
// curves, gblur and xfade=dissolve) and against the export's builder (__cases__/filters_ref.json, from
// video_studio/services/editor_filters.py, with ffmpeg evaluating its lutrgb expressions) and against ffmpeg's rotate
// and scale (__cases__/geometry_ref.json, small yuva444p pictures through the filters).
import { describe, expect, it } from 'vitest'
import ref from '../__cases__/ffmpeg_ref.json'
import be from '../__cases__/filters_ref.json'
import geom from '../__cases__/geometry_ref.json'
import { chromakeyUV, cropBox, curvesTables, even, fitSize, frand, gblurKernel, hueSaturationMatrix, overlayXY, parseCube, rotatePlane, swsFilter, swsScalePlane } from './ffmpegMath'
import { adjustTable, effectSteps, saturationMatrix } from './effectParams'

describe('curves (vf_curves natural spline)', () => {
  it('gives the table ffmpeg gives, channel curve then master', () => {
    const s = ref.curves.spec
    expect(curvesTables({ master: s.master, r: s.r, g: s.g, b: s.b }).map(t => Array.from(t))).toEqual(ref.curves.tables)
  })
  it('an empty curve is the identity', () => { expect(Array.from(curvesTables({})[1])).toEqual([...Array(256).keys()]) })
})

describe('gblur (the recursive filter as a kernel)', () => {
  for (const [key, row] of Object.entries(ref.gblur)) {
    it(`matches ffmpeg's impulse response, sigma:steps ${key}`, () => {
      const [sigma, steps] = key.split(':').map(Number)
      const k = gblurKernel(Math.fround(sigma), steps)
      for (let d = 0; d < Math.min(row.length, k.length); d++) expect(Math.abs(k[d] - row[d])).toBeLessThan(2e-6)
      const sum = k[0] + 2 * k.slice(1).reduce((a, b) => a + b, 0)
      expect(sum).toBeGreaterThan(0.999)
      expect(sum).toBeLessThan(1.001)
    })
  }
})

describe('xfade dissolve (frand in float32)', () => {
  it('reproduces ffmpeg\'s pattern', () => {
    const { w, h, progress, white } = ref.dissolve
    let wrong = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const showsA = frand(x, y) * 2 + progress * 2 - 1.5 >= 0.5
      if ((showsA ? 0 : 1) !== white[y * w + x]) wrong++
    }
    expect(wrong / (w * h)).toBeLessThan(0.002)
  })
})

describe('the export builder\'s values', () => {
  it('Adjust: the lutrgb tables ffmpeg evaluates from editor_filters.adjust_lut_expr', () => {
    for (const { params: p, tables } of be.adjust) {
      const ours = ['r', 'g', 'b'].map(c => Array.from(adjustTable(p.exposure, p.contrast, p.highlights, p.shadows, p.temperature, p.tint, c)))
      expect(ours).toEqual(tables)
    }
  })
  it('huesaturation: the float matrix of editor_filters.huesaturation_matrix, as the filter holds it (x 65536)', () => {
    for (const { args: [hue, saturation, intensity], matrix } of be.huesaturation) {
      const m = hueSaturationMatrix({ hue, saturation, intensity })
      matrix.flat().forEach((v, i) => expect(Math.abs(m[i] - Math.round(v * 65536))).toBeLessThanOrEqual(2))
    }
  })
  it('saturation matrix and vignette angle', () => {
    saturationMatrix(be.saturation_matrix.s).flat().forEach((v, i) => expect(v).toBeCloseTo(be.saturation_matrix.m.flat()[i], 6))
    for (const [amount, size, angle] of be.vignette_angle) {
      expect(effectSteps({ kind: 'vignette', params: { amount, size } })[0].angle).toBeCloseTo(angle, 6)
    }
  })
})

describe('the other ports', () => {
  it('chromakey: the key colour\'s U and V (RGB_TO_U/V)', () => {
    expect(chromakeyUV([0, 255, 0])).toEqual([44, 21])
    expect(chromakeyUV([0, 0, 255])).toEqual([255, 107])
  })
  it('scale and crop rounding', () => {
    expect(fitSize(1920, 1080, 1080, 1920, 'decrease', 2)).toEqual([1080, 608])
    expect(fitSize(1920, 1080, 1080, 1920, 'increase')).toEqual([3413, 1920])
    expect(even(7.9)).toBe(6)
    expect(cropBox(1920, 1080, [0.1, 0.1, 0.5, 0.5], true)).toEqual({ x: 192, y: 108, w: 960, h: 540 })
    expect(cropBox(101, 101, [0.33, 0, 0.33, 1], true)).toEqual({ x: 32, y: 0, w: 32, h: 100 })
    expect(overlayXY(-3.5)).toBe(-3)
    expect(overlayXY(7.9)).toBe(7)
  })
  it('rotate: every plane as ffmpeg turns it (fixed-point sin, bilinear, transparent fill)', () => {
    for (const r of geom.rotate) {
      r.src.forEach((plane, p) => {
        const fill = [16, 128, 128, 0][p]
        expect(Array.from(rotatePlane(plane, r.w, r.h, r.ow, r.oh, r.angle, fill)), `angle ${r.angle} plane ${p}`).toEqual(r.out[p])
      })
    }
  })
  it('scale: every plane as swscale scales it (bicubic), within one level', () => {
    for (const r of geom.scale) {
      r.src.forEach((plane, p) => {
        const ours = swsScalePlane(plane, r.w, r.h, r.ow, r.oh)
        const worst = Math.max(...r.out[p].map((v, i) => Math.abs(v - ours[i])))
        expect(worst, `${r.w}x${r.h} -> ${r.ow}x${r.oh} plane ${p}`).toBeLessThanOrEqual(1)
      })
    }
  })
  it('scale: the weights of a row sum to one, every tap inside the picture', () => {
    for (const [s, d, one, align] of [[367, 220, 1 << 14, 4], [220, 367, 1 << 12, 2], [400, 7, 1 << 14, 4], [9, 9, 1 << 12, 2]]) {
      const f = swsFilter(s, d, one, align)
      for (let i = 0; i < d; i++) {
        expect(f.w.slice(i * f.size, (i + 1) * f.size).reduce((a, b) => a + b, 0)).toBe(one)
        expect(f.pos[i]).toBeGreaterThanOrEqual(0)
        for (let j = 0; j < f.size; j++) if (f.w[i * f.size + j]) expect(f.pos[i] + j).toBeLessThan(s)
      }
    }
  })
  it('.cube: size, data in file order, domain scale; refuses broken files', () => {
    const lines = ['TITLE "x"', 'LUT_3D_SIZE 2', 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1']
    for (let b = 0; b < 2; b++) for (let g = 0; g < 2; g++) for (let r = 0; r < 2; r++) lines.push(`${r} ${g} ${b}`)
    const lut = parseCube(lines.join('\n'))
    expect(lut.size).toBe(2)
    expect(Array.from(lut.data.slice(0, 6))).toEqual([0, 0, 0, 1, 0, 0])
    expect(lut.scale).toEqual([1, 1, 1])
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 0')).toThrow()
    expect(() => parseCube('LUT_1D_SIZE 4')).toThrow()
  })
})
