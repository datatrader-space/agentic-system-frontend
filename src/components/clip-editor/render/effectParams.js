// Registry effects → the ffmpeg filters the export runs for them, with those filters' own option values (contract
// section 3, plan P3, ADM-1199). The shaders reproduce each ffmpeg filter's formula; THIS file says which filter, in
// which order, with which values a registry param becomes, exactly as the export's builder does
// (video_studio/services/editor_filters.py, BE-RENDER). When editor_filters.py changes, change this file the same way;
// never a shader.
//
// Option values pass through editor_filters.num() (fixed point, 6 decimals) before ffmpeg reads them; num6 does the
// same here, so a table built from them is the table ffmpeg builds.

import { chromakeyUV, curvesTables, gblurKernel, HUE_COLORS, hueSaturationMatrix } from './ffmpegMath'

export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'add', 'difference']
// editor_filters.CANVAS_BLUR_SIGMA: the canvas background's blur strengths 1..4 as gblur sigma at 1080 lines.
export const CANVAS_BLUR_SIGMA = { 1: 10, 2: 20, 3: 40, 4: 80 }
// gblur's steps for the blur effect and the canvas background (editor_filters: steps=3, planes=7).
export const GBLUR_STEPS = 3
// editor_filters.LUMA: saturation's weights (Rec. 709).
const LUMA = [0.2126, 0.7152, 0.0722]

const hex = c => {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(c || ''))
  if (!m) return [0, 0, 0, 1]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) / 255 : 1]
}
export const hexToRgb8 = c => hex(c).slice(0, 3)
export const hexToRgba = c => { const [r, g, b, a] = hex(c); return [r / 255, g / 255, b / 255, a] }
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
// editor_filters.num(): the value ffmpeg is given (6 decimals).
export const num6 = v => { const r = Number(Number(v).toFixed(6)); return Object.is(r, -0) ? 0 : r }
const clip = (v, a, b) => Math.min(Math.max(v, a), b)

// editor_filters.adjust_lut_expr, evaluated by lutrgb for every input value 0..255 (lutrgb stores (int)res).
export function adjustTable(exposure, contrast, highlights, shadows, temperature, tint, channel) {
  const gain = { r: 1 + 0.2 * temperature, g: 1 - 0.2 * tint, b: 1 - 0.2 * temperature }[channel]
  const k = num6(Math.pow(2, exposure) * gain / 255), c = num6(contrast), s = num6(0.5 * shadows), h = num6(0.5 * highlights)
  const t = new Uint8Array(256)
  for (let val = 0; val < 256; val++) {
    const x = clip((val * k - 0.5) * c + 0.5, 0, 1)
    t[val] = Math.trunc(clip(255 * (x + s * Math.pow(1 - x, 2) + h * Math.pow(x, 2)) + 0.5, 0, 255))
  }
  return t
}
// editor_filters.saturation_matrix, as colorchannelmixer gets it (rows: out r, g, b; columns: in r, g, b).
export const saturationMatrix = s => [0, 1, 2].map(i => [0, 1, 2].map(j => num6((1 - s) * LUMA[j] + (i === j ? s : 0))))

// One effect (its params already evaluated at this time) → the filter steps the shaders run.
// `px` is the output's short side / 1080 (pixel sizes are defined at 1080 lines).
export function effectSteps(effect, { px = 1, lut = null, matte = null } = {}) {
  const p = effect.params || {}
  switch (effect.kind) {
    case 'adjust': return adjustSteps(p)
    case 'curves': {
      const pick = pts => (Array.isArray(pts) && pts.length && JSON.stringify(pts.map(q => q.map(Number))) !== '[[0,0],[1,1]]' ? pts.map(q => q.map(num6)) : null)
      const pts = { master: pick(p.master), r: pick(p.r), g: pick(p.g), b: pick(p.b) }
      if (!pts.master && !pts.r && !pts.g && !pts.b) return []
      return [{ op: 'curves', tables: curvesTables(pts) }]
    }
    case 'hsl': {
      // fx_hsl: one huesaturation per colour range changed, in this order, hue = h, saturation = s, intensity = l.
      const out = []
      for (const name of ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta']) {
        const c = p[name] || {}
        const h = num6(num(c.h, 0)), s = num6(num(c.s, 0)), l = num6(num(c.l, 0))
        if (!h && !s && !l) continue
        out.push({ op: 'huesaturation', matrix: hueSaturationMatrix({ hue: h, saturation: s, intensity: l }), colors: HUE_COLORS[name], strength: 1 })
      }
      return out
    }
    case 'lut': return lut ? [{ op: 'lut3d', lut, intensity: Math.min(num6(num(p.intensity, 1)), 1) }] : []
    case 'blur': {
      // fx_blur: gblur sigma = radius * short / 1080, steps 3, colour planes only.
      const sigma = Math.fround(num6(num(p.radius, 0) * px))
      return sigma > 0 ? [{ op: 'gblur', kernel: gblurKernel(sigma, GBLUR_STEPS), alpha: false, key: `${sigma}` }] : []
    }
    case 'sharpen': {
      const amount = num6(num(p.amount, 0))
      return amount > 0 ? [{ op: 'unsharp', amount }] : []    // unsharp=lx=5:ly=5:la=<amount>:cx=5:cy=5:ca=0
    }
    case 'vignette': {
      // editor_filters.vignette_angle: amount (pi / 2) (1.2 - size), at most pi / 2; dither 0; alpha kept.
      const amount = num(p.amount, 0), size = num(p.size, 0.6)
      if (amount <= 0) return []
      return [{ op: 'vignette', angle: num6(Math.min(Math.max(amount, 0) * (Math.PI / 2) * (1.2 - size), Math.PI / 2)) }]
    }
    case 'mask': return [{ op: 'mask', shape: p.shape || 'rect', x: num(p.x, 0.5), y: num(p.y, 0.5), w: num(p.w, 0.5), h: num(p.h, 0.5), rotation: num(p.rotation, 0), feather: num(p.feather, 0), invert: !!p.invert }]
    case 'chroma_key': {
      const rgb = hexToRgb8(p.color || '#00FF00')
      const steps = [{ op: 'chromakey', key: chromakeyUV(rgb), similarity: Math.max(num6(num(p.similarity, 0.1)), 0.00001), blend: num6(num(p.smoothness, 0.05)) }]
      const spill = num6(num(p.spill, 0))
      // despill: type green when G >= B, else blue; mix 0.5, expand 0; the key channel's scale is -spill.
      if (spill > 0) steps.push({ op: 'despill', blue: !(rgb[1] >= rgb[2]), mix: 0.5, expand: 0, amount: spill })
      return steps
    }
    case 'bg_removal': return matte ? [{ op: 'matte', matte }] : []
    default: return []
  }
}

// fx_adjust: lutrgb (exposure, temperature, tint, contrast, highlights, shadows) → colorchannelmixer (saturation) →
// vibrance. A part whose numbers are all neutral is left out, as there.
export function adjustSteps(p) {
  const v = { exposure: num(p.exposure, 0), contrast: num(p.contrast, 1), saturation: num(p.saturation, 1), vibrance: num(p.vibrance, 0),
    temperature: num(p.temperature, 0), tint: num(p.tint, 0), highlights: num(p.highlights, 0), shadows: num(p.shadows, 0) }
  const neutral = { exposure: 0, contrast: 1, saturation: 1, vibrance: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0 }
  const used = k => Math.abs(v[k] - neutral[k]) > 1e-9
  const out = []
  if (['exposure', 'contrast', 'highlights', 'shadows', 'temperature', 'tint'].some(used)) {
    out.push({ op: 'lutrgb', tables: ['r', 'g', 'b'].map(c => adjustTable(v.exposure, v.contrast, v.highlights, v.shadows, v.temperature, v.tint, c)) })
  }
  if (used('saturation')) out.push({ op: 'colorchannelmixer', matrix: saturationMatrix(v.saturation) })
  if (used('vibrance')) out.push({ op: 'vibrance', intensity: num6(v.vibrance) })
  return out
}

// The canvas background's blur (canvas_blur) at this render's scale.
export function canvasBlurKernel(strength, px = 1) {
  const s = CANVAS_BLUR_SIGMA[Math.trunc(strength)] ?? 20
  return gblurKernel(Math.fround(num6(s * px)), GBLUR_STEPS)
}

