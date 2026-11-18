// The mask of an image edit (ADM-1251), as one byte per pixel: 255 where the picture changes, 0 where it is kept.
// That is the platform's one convention (backend video_studio/services/masks.py): the painter, SAM 3's selection and
// FLUX Fill all read white as the area to change. Pure functions, so the refinement (invert, grow, shrink) is instant,
// free and tested without a browser canvas.

export const ON = 255

// A mask from canvas pixels (RGBA): white where the red channel is bright and the pixel is not transparent.
export function fromRGBA(data, width, height) {
  const out = new Uint8Array(width * height)
  for (let i = 0, p = 0; p < out.length; i += 4, p++) out[p] = data[i + 3] > 127 && data[i] > 127 ? ON : 0
  return out
}

// Canvas pixels (RGBA) for a mask: opaque white and black, the PNG the edit sends.
export function toRGBA(mask) {
  const out = new Uint8ClampedArray(mask.length * 4)
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) { const v = mask[p] ? 255 : 0; out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255 }
  return out
}

// The tinted overlay shown over the picture: the colour where the mask is on, see-through elsewhere.
export function tintRGBA(mask, [r, g, b, a]) {
  const out = new Uint8ClampedArray(mask.length * 4)
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) if (mask[p]) { out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a }
  return out
}

export function hasArea(mask) {
  for (let p = 0; p < mask.length; p++) if (mask[p]) return true
  return false
}

export function invert(mask) {
  const out = new Uint8Array(mask.length)
  for (let p = 0; p < mask.length; p++) out[p] = mask[p] ? 0 : ON
  return out
}

// The union of two masks of the same size (a new selection added to what is already marked).
export function union(a, b) {
  const out = new Uint8Array(a.length)
  for (let p = 0; p < a.length; p++) out[p] = a[p] || b[p] ? ON : 0
  return out
}

// The distance (in pixels, chamfer 3-4 so close to the true distance) from each pixel to the nearest pixel that is ON.
function distanceToOn(mask, width, height) {
  const INF = 1e9, d = new Float64Array(mask.length)
  for (let p = 0; p < mask.length; p++) d[p] = mask[p] ? 0 : INF
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x
    if (!d[p]) continue
    let v = d[p]
    if (x > 0) v = Math.min(v, d[p - 1] + 3)
    if (y > 0) { v = Math.min(v, d[p - width] + 3); if (x > 0) v = Math.min(v, d[p - width - 1] + 4); if (x < width - 1) v = Math.min(v, d[p - width + 1] + 4) }
    d[p] = v
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const p = y * width + x
    if (!d[p]) continue
    let v = d[p]
    if (x < width - 1) v = Math.min(v, d[p + 1] + 3)
    if (y < height - 1) { v = Math.min(v, d[p + width] + 3); if (x < width - 1) v = Math.min(v, d[p + width + 1] + 4); if (x > 0) v = Math.min(v, d[p + width - 1] + 4) }
    d[p] = v
  }
  return d
}

// The area widened by `radius` pixels on every side.
export function grow(mask, width, height, radius) {
  const r = Math.max(0, Math.round(radius))
  if (!r || !hasArea(mask)) return Uint8Array.from(mask)
  const d = distanceToOn(mask, width, height), limit = r * 3, out = new Uint8Array(mask.length)
  for (let p = 0; p < mask.length; p++) out[p] = d[p] <= limit ? ON : 0
  return out
}

// The area narrowed by `radius` pixels on every side: the kept part grown into it.
export function shrink(mask, width, height, radius) {
  return invert(grow(invert(mask), width, height, radius))
}

// One step of Grow or Shrink for a picture: about half a percent of its longer side, at least 2 pixels.
export function edgeStep(width, height) {
  return Math.max(2, Math.round(Math.max(width, height) / 200))
}

// A point of the pointer on the shown picture as a fraction of it (0 to 1 from the top-left), whatever its display size.
export function fractionOf(clientX, clientY, rect) {
  const clamp = v => Math.min(1, Math.max(0, v))
  if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 }
  return { x: clamp((clientX - rect.left) / rect.width), y: clamp((clientY - rect.top) / rect.height) }
}

// The box two corners make, as fractions; null when it has no width or height to speak of (a click, not a drag).
export function boxFrom(a, b, minimum = 0.01) {
  const box = { x_min: Math.min(a.x, b.x), y_min: Math.min(a.y, b.y), x_max: Math.max(a.x, b.x), y_max: Math.max(a.y, b.y) }
  return box.x_max - box.x_min < minimum || box.y_max - box.y_min < minimum ? null : box
}
