// CPU-side ports of the ffmpeg filter maths the preview shaders need (ffmpeg 7.1, the production build; plan P3,
// ADM-1199). Each function names the ffmpeg source it follows. Tables and matrices are computed here once and handed
// to the shaders as uniforms or textures, so a shader only does the per-pixel part of the same formula.
//
// Float32 steps are kept where ffmpeg computes in float (Math.fround), so the results agree with the C code.

const f = Math.fround

// ── libavfilter/vf_huesaturation.c: the 4x4 colour matrix, as the integer matrix the filter applies ─────────────
const DENOM = 0x10000
export const HUE_COLORS = { red: 1, yellow: 2, green: 4, cyan: 8, blue: 16, magenta: 32 }
export const HUE_ALL = 0x3f
const identity = () => [0, 1, 2, 3].map(y => [0, 1, 2, 3].map(x => (y === x ? 1 : 0)))
// matrix_multiply(a, b, c): c = b x a (row vectors), float.
function mul(a, b) {
  const t = identity()
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) t[y][x] = f(f(f(f(b[y][0] * a[0][x]) + f(b[y][1] * a[1][x])) + f(b[y][2] * a[2][x])) + f(b[y][3] * a[3][x]))
  return t
}
const m4 = rows => rows.map(r => r.map(f))
function colorscale(m, r, g, b) { return mul(m4([[r, 0, 0, 0], [0, g, 0, 0], [0, 0, b, 0], [0, 0, 0, 1]]), m) }
function saturationM(m, s, rw, gw, bw) {
  const k = f(1 - s)
  const a = f(k * rw + s), bb = f(k * rw), c = f(k * rw), d = f(k * gw), e = f(k * gw + s), ff = f(k * gw), g = f(k * bw), h = f(k * bw), i = f(k * bw + s)
  return mul(m4([[a, bb, c, 0], [d, e, ff, 0], [g, h, i, 0], [0, 0, 0, 1]]), m)
}
const xrot = (m, rs, rc) => mul(m4([[1, 0, 0, 0], [0, rc, rs, 0], [0, -rs, rc, 0], [0, 0, 0, 1]]), m)
const yrot = (m, rs, rc) => mul(m4([[rc, 0, -rs, 0], [0, 1, 0, 0], [rs, 0, rc, 0], [0, 0, 0, 1]]), m)
const zrot = (m, rs, rc) => mul(m4([[rc, rs, 0, 0], [-rs, rc, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]), m)
const zshear = (m, dx, dy) => mul(m4([[1, 0, dx, 0], [0, 1, dy, 0], [0, 0, 1, 0], [0, 0, 0, 1]]), m)
function transformPoint(m, x, y, z) {
  x = y // as in ffmpeg's transform_point
  return [f(x * m[0][0] + y * m[1][0] + z * m[2][0] + m[3][0]), f(x * m[0][1] + y * m[1][1] + z * m[2][1] + m[3][1]), f(x * m[0][2] + y * m[1][2] + z * m[2][2] + m[3][2])]
}
function hueRotate(m, rotation, rw, gw, bw) {
  let mag = f(Math.SQRT2)
  const xrs = f(1 / mag), xrc = f(1 / mag)
  m = xrot(m, xrs, xrc)
  mag = f(Math.sqrt(3))
  const yrs = f(-1 / mag), yrc = f(Math.SQRT2 / mag)
  m = yrot(m, yrs, yrc)
  const [lx, ly, lz] = transformPoint(m, rw, gw, bw)
  const zsx = f(lx / lz), zsy = f(ly / lz)
  m = zshear(m, zsx, zsy)
  const a = f(rotation * Math.PI / 180)
  m = zrot(m, f(Math.sin(a)), f(Math.cos(a)))
  m = zshear(m, -zsx, -zsy)
  m = yrot(m, -yrs, yrc)
  return xrot(m, -xrs, xrc)
}
function shueRotate(m, rotation) {
  let mag = f(Math.SQRT2)
  const xrs = f(1 / mag), xrc = f(1 / mag)
  m = xrot(m, xrs, xrc)
  mag = f(Math.sqrt(3))
  const yrs = f(-1 / mag), yrc = f(Math.SQRT2 / mag)
  m = yrot(m, yrs, yrc)
  const a = f(rotation * Math.PI / 180)
  m = zrot(m, f(Math.sin(a)), f(Math.cos(a)))
  m = yrot(m, -yrs, yrc)
  return xrot(m, -xrs, xrc)
}
// The integer matrix (scaled by 65536) of huesaturation=hue:saturation:intensity[:rw:gw:bw:lightness]; row vectors:
// r' = (r m00 + g m10 + b m20) >> 16.
export function hueSaturationMatrix({ hue = 0, saturation = 0, intensity = 0, rw = 0.333, gw = 0.334, bw = 0.333, lightness = false } = {}) {
  let m = identity()
  const i = f(1 + intensity), s = f(1 + saturation)
  m = colorscale(m, i, i, i)
  m = saturationM(m, s, f(rw), f(gw), f(bw))
  m = lightness ? hueRotate(m, f(hue), f(rw), f(gw), f(bw)) : shueRotate(m, f(hue))
  const out = []
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) out.push(Math.round(f(m[y][x] * DENOM)))
  return out // [m00, m01, m02, m10, m11, m12, m20, m21, m22]
}

// ── libavfilter/vf_curves.c: interpolate() (natural cubic spline) into an 8-bit table ────────────────────────────
const clip8 = v => Math.min(Math.max(Math.trunc(v), 0), 255)
// points: [[x, y], ...] in 0..1, strictly increasing in x (as the filter requires). An empty list is the identity.
export function curvesTable(points) {
  const scale = 255
  const y = new Uint8Array(256)
  const n = points?.length || 0
  if (n === 0) { for (let i = 0; i < 256; i++) y[i] = i; return y }
  if (n === 1) { y.fill(clip8(points[0][1] * scale)); return y }
  const h = [], r = new Array(n).fill(0), mat = Array.from({ length: n }, () => [0, 0, 0])
  for (let i = 0; i < n - 1; i++) h.push(points[i + 1][0] - points[i][0])
  for (let i = 1; i < n - 1; i++) {
    const yp = points[i - 1][1], yc = points[i][1], yn = points[i + 1][1]
    r[i] = 6 * ((yn - yc) / h[i] - (yc - yp) / h[i - 1])
  }
  mat[0][1] = mat[n - 1][1] = 1
  for (let i = 1; i < n - 1; i++) { mat[i][0] = h[i - 1]; mat[i][1] = 2 * (h[i - 1] + h[i]); mat[i][2] = h[i] }
  for (let i = 1; i < n; i++) {
    const den = mat[i][1] - mat[i][0] * mat[i - 1][2]
    const k = den ? 1 / den : 1
    mat[i][2] *= k
    r[i] = (r[i] - mat[i][0] * r[i - 1]) * k
  }
  for (let i = n - 2; i >= 0; i--) r[i] = r[i] - mat[i][2] * r[i + 1]
  for (let i = 0; i < Math.trunc(points[0][0] * scale); i++) y[i] = clip8(points[0][1] * scale)
  for (let i = 0; i < n - 1; i++) {
    const yc = points[i][1], yn = points[i + 1][1]
    const a = yc, b = (yn - yc) / h[i] - h[i] * r[i] / 2 - h[i] * (r[i + 1] - r[i]) / 6, c = r[i] / 2, d = (r[i + 1] - r[i]) / (6 * h[i])
    const xs = Math.trunc(points[i][0] * scale), xe = Math.trunc(points[i + 1][0] * scale)
    for (let x = xs; x <= xe; x++) {
      const xx = (x - xs) / scale
      y[x] = clip8((a + b * xx + c * xx * xx + d * xx * xx * xx) * scale)
    }
  }
  for (let i = Math.trunc(points[n - 1][0] * scale); i < 256; i++) y[i] = clip8(points[n - 1][1] * scale)
  return y
}
// The curves filter's three output tables (r, g, b): each channel's own curve, then the master curve over it.
export function curvesTables({ master = null, r = null, g = null, b = null } = {}) {
  const m = master?.length ? curvesTable(master) : null
  return [r, g, b].map(pts => {
    const t = curvesTable(pts || [])
    if (m) for (let j = 0; j < 256; j++) t[j] = m[t[j]]
    return t
  })
}

// ── libavfilter/vf_gblur.c + vf_gblur_init.h: the recursive filter's impulse response, as an FIR kernel ──────────
// gblur runs `steps` passes of a first-order filter forwards and backwards (Alvarez-Mazorra) and scales by
// postscale. Away from the edges that equals a convolution with this kernel (one axis). Returned: the centre weight
// first, then the weights at distance 1, 2, ... (symmetric), cut where a weight falls below 1e-5 of the centre.
export function gblurKernel(sigma, steps = 1, maxRadius = 1023) {
  if (!(sigma > 0)) return new Float32Array([1])
  const lambda = (sigma * sigma) / (2 * steps)
  const dnu = (1 + 2 * lambda - Math.sqrt(1 + 4 * lambda)) / (2 * lambda)
  let post = Math.pow(dnu / lambda, steps)
  if (!Number.isFinite(post) || post === 0) post = 1
  const nu = f(dnu)
  const R = maxRadius, N = 2 * R + 1
  const buf = new Float32Array(N)
  buf[R] = 1
  for (let s = 0; s < steps; s++) {
    for (let x = 1; x < N; x++) buf[x] = f(buf[x] + f(nu * buf[x - 1]))
    for (let x = N - 1; x > 0; x--) buf[x - 1] = f(buf[x - 1] + f(nu * buf[x]))
  }
  const centre = buf[R] * post
  const out = [centre]
  for (let d = 1; d <= R; d++) {
    const w = buf[R + d] * post
    if (w < centre * 1e-5) break
    out.push(w)
  }
  return new Float32Array(out)
}

// ── libavfilter/vf_chromakey.c: the key colour's U and V (RGB_TO_U/RGB_TO_V, full-range BT.601, 10-bit fixed) ───
const FIX = x => Math.round(x * 1024)
export function chromakeyUV([r, g, b]) {
  const u = ((-FIX(0.16874) * r - FIX(0.33126) * g + FIX(0.5) * b + (1 << 9) - 1) >> 10) + 128
  const v = ((FIX(0.5) * r - FIX(0.41869) * g - FIX(0.08131) * b + (1 << 9) - 1) >> 10) + 128
  return [u, v]
}

// ── libavfilter/vf_xfade.c: frand(), the dissolve pattern, computed in float32 like the C code ───────────────────
const K1 = f(12.9898), K2 = f(78.233), K3 = f(43758.545)
export function frand(x, y) {
  const r = f(f(Math.sin(f(f(x * K1) + f(y * K2)))) * K3)
  return f(r - Math.floor(r))
}
export function frandTable(width, height) {
  const t = new Float32Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) t[y * width + x] = frand(x, y)
  return t
}

// ── libavfilter/vf_lut3d.c: parse_cube() ────────────────────────────────────────────────────────────────────────
// The table in file order (red fastest, then green, then blue) and the filter's domain scale. As in ffmpeg the domain
// minimum is not subtracted (scale = clip(1 / (max - min), 0, 1)).
export function parseCube(text) {
  const lines = String(text || '').split(/\r?\n/)
  let size = 0
  const min = [0, 0, 0], max = [1, 1, 1], values = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('TITLE')) continue
    if (line.startsWith('LUT_3D_SIZE')) { size = parseInt(line.slice(11), 10); continue }
    if (line.startsWith('LUT_1D_SIZE')) throw new Error('A 1D LUT is not supported here; use a 3D .cube file.')
    if (line.startsWith('DOMAIN_MIN')) { line.slice(10).trim().split(/\s+/).slice(0, 3).forEach((v, i) => { min[i] = Number(v) }); continue }
    if (line.startsWith('DOMAIN_MAX')) { line.slice(10).trim().split(/\s+/).slice(0, 3).forEach((v, i) => { max[i] = Number(v) }); continue }
    if (/^[A-Z_]/.test(line)) continue
    const p = line.split(/\s+/)
    if (p.length >= 3 && size) values.push(Number(p[0]), Number(p[1]), Number(p[2]))
  }
  if (!(size >= 2 && size <= 256)) throw new Error('This .cube file has no LUT_3D_SIZE between 2 and 256.')
  if (values.length < size * size * size * 3 || values.some(v => !Number.isFinite(v))) throw new Error('This .cube file is incomplete.')
  const scale = [0, 1, 2].map(i => Math.min(Math.max(1 / (max[i] - min[i]), 0), 1))
  return { size, data: new Float32Array(values.slice(0, size * size * size * 3)), scale }
}

// ── libavfilter/scale_eval.c ff_scale_adjust_dimensions, and the crop and overlay rounding ───────────────────────
const rescale = (a, b, c) => { const v = a * b / c; return v < 0 ? -Math.round(-v) : Math.round(v) }
// The size `scale=bw:bh:force_original_aspect_ratio=<decrease|increase>[:force_divisible_by=2]` gives a picture of
// iw x ih.
export function fitSize(iw, ih, bw, bh, mode, divisibleBy = 1) {
  const d = divisibleBy
  const tw = rescale(bh, iw, ih * d) * d, th = rescale(bw, ih, iw * d) * d
  let w, h
  if (mode === 'decrease') {
    w = Math.min(tw, bw); h = Math.min(th, bh)
    if (d > 1) { w = Math.trunc(w / d) * d; h = Math.trunc(h / d) * d }
  } else {
    w = Math.max(tw, bw); h = Math.max(th, bh)
    if (d > 1) { w = Math.trunc((w + d - 1) / d) * d; h = Math.trunc((h + d - 1) / d) * d }
  }
  return [Math.max(1, w), Math.max(1, h)]
}
// compositor.py _even: at least 2, rounded down to even.
export const even = n => Math.max(2, Math.trunc(n / 2) * 2)
// vf_crop: the crop box in pixels, aligned to the chroma grid (2) for a subsampled (video) source.
export function cropBox(iw, ih, [cx, cy, cw, ch], subsampled) {
  const a = subsampled ? ~1 : ~0
  return { x: Math.trunc(iw * cx) & a, y: Math.trunc(ih * cy) & a, w: Math.max(1, Math.trunc(iw * cw) & a), h: Math.max(1, Math.trunc(ih * ch) & a) }
}
// vf_overlay normalize_xy: the overlay position truncated (toward zero). The export places a clip with a 4:4:4
// overlay (compositor._clip_layer), so there is no chroma grid to align to.
export const overlayXY = v => Math.trunc(v)

const cdiv = (a, b) => Math.trunc(a / b)   // C integer division (toward zero)

// ── libavfilter/vf_rotate.c: the fixed-point rotation ───────────────────────────────────────────────────────────
// The preview's ROTATE pass does the per-pixel part (shaders.js); rotatePlane is the same on the CPU, for the tests.
const FIXP = 1 << 16, FIXP2 = 1 << 20, INT_PI = 3294199
// int_sin(): input scaled by FIXP2, output by FIXP. The C code works in int64; every value here fits a double exactly.
export function intSin(a) {
  let res = 0
  if (a < 0) a = INT_PI - a
  a %= 2 * INT_PI
  if (a >= cdiv(INT_PI * 3, 2)) a -= 2 * INT_PI
  if (a >= cdiv(INT_PI, 2)) a = INT_PI - a
  const a2 = cdiv(a * a, FIXP2)
  for (let i = 2; i < 11; i += 2) { res += a; a = cdiv(-a * a2, FIXP2 * i * (i + 1)) }
  return Math.floor((res + 8) / 16)
}
// filter_frame + filter_slice: output pixel (i, j) reads the source at x = x0 + j s + i c, y = y0 + j c - i s
// (16.16 fixed point, pixel centres at whole numbers).
export function rotateSteps(angle, inw, inh, outw, outh) {
  const ai = Math.trunc(angle * FIXP * 16)
  const s = intSin(ai), c = intSin(ai + cdiv(INT_PI, 2))
  return { s, c,
    x0: cdiv(-(outh - 1) * s, 2) + cdiv(-(outw - 1) * c, 2) + cdiv(FIXP * (inw - 1), 2),
    y0: cdiv(-(outh - 1) * c, 2) + cdiv((outw - 1) * s, 2) + cdiv(FIXP * (inh - 1), 2) }
}
// One 8-bit plane rotated as vf_rotate does it (bilinear, fill colour `fill` where nothing is read). A pixel is
// written when its source position is within one pixel of the picture; interpolate_bilinear8 clamps to the edge.
export function rotatePlane(src, inw, inh, outw, outh, angle, fill) {
  const { s, c, x0, y0 } = rotateSteps(angle, inw, inh, outw, outh)
  const out = new Uint8Array(outw * outh).fill(fill)
  const at = (x, y) => src[y * inw + x]
  for (let j = 0; j < outh; j++) for (let i = 0; i < outw; i++) {
    const x = x0 + j * s + i * c, y = y0 + j * c - i * s
    const x1 = x >> 16, y1 = y >> 16
    if (x1 < -1 || x1 > inw || y1 < -1 || y1 > inh) continue
    const ix = Math.min(Math.max(x1, 0), inw - 1), iy = Math.min(Math.max(y1, 0), inh - 1)
    const ix1 = Math.min(ix + 1, inw - 1), iy1 = Math.min(iy + 1, inh - 1)
    const fx = x & 0xffff, fy = y & 0xffff
    const s0 = (FIXP - fx) * at(ix, iy) + fx * at(ix1, iy), s1 = (FIXP - fx) * at(ix, iy1) + fx * at(ix1, iy1)
    out[j * outw + i] = Math.floor(((FIXP - fy) * s0 + fy * s1) / 2 ** 32)
  }
  return out
}

// ── libswscale/utils.c initFilter(), SWS_BICUBIC (vf_scale's default flags), as built on x86 ─────────────────────
// For each output pixel: the first source index (pos) and `size` integer weights (w) summing to `one`: 1 << 14 across,
// 1 << 12 down. The border fix has already folded the taps past either end onto the edge pixel. `align` is x86's
// filterAlign (4 across, 2 down): it only pads with zero taps, but it decides where the border fix moves them.
// srcPos and dstPos are get_local_pos(): 128 for a plane at full size, and for a 4:2:0 colour plane sited at the
// centre of its 2 x 2 block.
const log2i = n => (n < 1 ? 0 : Math.floor(Math.log2(n)))
export function swsFilter(srcW, dstW, one, align, srcPos = 128, dstPos = 128) {
  const xInc = Math.floor((srcW * 65536 + (dstW >> 1)) / dstW)
  const fone = 2 ** (54 - Math.min(log2i(Math.trunc(srcW / dstW)), 8))
  const pos = new Array(dstW)
  let size, raw
  if (Math.abs(xInc - 65536) < 10 && srcPos === dstPos) {   // unscaled
    size = 1; raw = new Float64Array(dstW).fill(fone)
    for (let i = 0; i < dstW; i++) pos[i] = i
  } else {
    size = xInc <= 65536 ? 5 : 1 + cdiv(4 * srcW + dstW - 1, dstW)
    size = Math.max(Math.min(size, srcW - 2), 1)
    raw = new Float64Array(dstW * size)
    const C = Math.trunc(0.6 * (1 << 24))             // B = 0
    let xDst = Math.floor(dstPos * xInc / 128) - Math.floor(srcPos * 65536 / 128)
    for (let i = 0; i < dstW; i++) {
      let xx = cdiv(xDst - (size - 2) * 65536, 131072)
      pos[i] = xx
      for (let j = 0; j < size; j++, xx++) {
        let d = Math.abs(xx * 131072 - xDst) * 8192
        if (xInc > 65536) d = cdiv(d * dstW, srcW)
        let coeff = 0
        if (d < 2 ** 31) {
          const dd = Math.floor(d * d / 2 ** 30), ddd = Math.floor(dd * d / 2 ** 30)
          coeff = d < 2 ** 30
            ? (12 * 2 ** 24 - 6 * C) * ddd + (-18 * 2 ** 24 + 6 * C) * dd + 6 * 2 ** 24 * 2 ** 30
            : (-6 * C) * ddd + (30 * C) * dd + (-48 * C) * d + (24 * C) * 2 ** 30
          coeff = cdiv(coeff, 2 ** 54 / fone)
        }
        raw[i * size + j] = coeff
      }
      xDst += 2 * xInc
    }
  }
  // step 1: drop near-zero taps on the left (shifting), and find the widest row's size without those on the right
  const cut = 0.002 * fone                              // SWS_MAX_REDUCE_CUTOFF
  let minSize = 0
  for (let i = dstW - 1; i >= 0; i--) {
    const o = i * size
    let min = size, cutOff = 0
    for (let j = 0; j < size; j++) {
      cutOff += Math.abs(raw[o])
      if (cutOff > cut) break
      if (i < dstW - 1 && pos[i] >= pos[i + 1]) break
      for (let k = 1; k < size; k++) raw[o + k - 1] = raw[o + k]
      raw[o + size - 1] = 0
      pos[i]++
    }
    cutOff = 0
    for (let j = size - 1; j > 0; j--) {
      cutOff += Math.abs(raw[o + j])
      if (cutOff > cut) break
      min--
    }
    if (min > minSize) minSize = min
  }
  if (minSize === 1 && align === 2) align = 1          // x86: unscaled vertical filtering
  const fs = (minSize + align - 1) & ~(align - 1)
  const f = new Float64Array(dstW * fs)
  for (let i = 0; i < dstW; i++) for (let j = 0; j < Math.min(fs, size); j++) f[i * fs + j] = raw[i * size + j]
  // fix borders
  for (let i = 0; i < dstW; i++) {
    const o = i * fs
    if (pos[i] < 0) {
      for (let j = 1; j < fs; j++) { const left = Math.max(j + pos[i], 0); f[o + left] += f[o + j]; f[o + j] = 0 }
      pos[i] = 0
    }
    if (pos[i] + fs > srcW) {
      const shift = pos[i] + Math.min(fs - srcW, 0)
      let acc = 0
      for (let j = fs - 1; j >= 0; j--) if (pos[i] + j >= srcW) { acc += f[o + j]; f[o + j] = 0 }
      for (let j = fs - 1; j >= 0; j--) f[o + j] = j < shift ? 0 : f[o + j - shift]
      pos[i] -= shift
      f[o + srcW - 1 - pos[i]] += acc
    }
  }
  // normalize to `one`, rounding with the error carried to the next tap
  const w = new Int32Array(dstW * fs)
  for (let i = 0; i < dstW; i++) {
    const o = i * fs
    let sum = 0
    for (let j = 0; j < fs; j++) sum += f[o + j]
    sum = Math.trunc((sum + one / 2) / one) || 1
    let error = 0
    for (let j = 0; j < fs; j++) {
      const v = f[o + j] + error
      const intV = cdiv(v >= 0 ? v + Math.floor(sum / 2) : v - Math.floor(sum / 2), sum)
      w[o + j] = intV
      error = v - intV * sum
    }
  }
  return { size: fs, pos: Int32Array.from(pos), w }
}
// swsFilter's two filters for a scale from w x h to ow x oh (the preview's SCALE pass reads them as one texture).
export const swsFilters = (w, h, ow, oh) => ({ h: swsFilter(w, ow, 1 << 14, 4), v: swsFilter(h, oh, 1 << 12, 2) })
// One 8-bit plane scaled as swscale scales it: across into 15 bits (hScale8To15), then down with rounding
// (yuv2planeX, no dither for an 8-bit source). The preview's SCALE pass does the same per pixel.
export function swsScalePlane(src, w, h, ow, oh) {
  const { h: H, v: V } = swsFilters(w, h, ow, oh)
  const mid = new Int32Array(ow * h), out = new Uint8Array(ow * oh)
  for (let y = 0; y < h; y++) for (let i = 0; i < ow; i++) {
    let v = 0
    for (let j = 0; j < H.size; j++) v += src[y * w + Math.min(H.pos[i] + j, w - 1)] * H.w[i * H.size + j]
    mid[y * ow + i] = Math.min(v >> 7, 32767)
  }
  for (let y = 0; y < oh; y++) for (let i = 0; i < ow; i++) {
    let v = 64 << 12
    for (let k = 0; k < V.size; k++) v += mid[Math.min(V.pos[y] + k, h - 1) * ow + i] * V.w[y * V.size + k]
    out[y * ow + i] = Math.min(Math.max(v >> 19, 0), 255)
  }
  return out
}
