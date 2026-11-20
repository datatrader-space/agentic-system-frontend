<template>
  <figure class="mk" :class="`mk-${mode}`">
    <div class="mk-frame">
      <img ref="image" :src="src" alt="The image to edit" class="mk-image" draggable="false" @load="ready" />
      <canvas ref="overlay" class="mk-overlay" data-test="mask-canvas" role="img" :aria-label="caption" @pointerdown="start" @pointermove="move" @pointerup="stop" @pointercancel="cancel" @pointerleave="stop" />
      <span v-for="(p, i) in points" :key="i" class="mk-point" :class="p.label ? 'is-in' : 'is-out'" :style="{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }" data-test="mask-point" aria-hidden="true">{{ p.label ? '+' : '−' }}</span>
      <span v-if="shownBox" class="mk-box" :style="boxStyle" data-test="mask-box" aria-hidden="true" />
    </div>
    <figcaption class="st-muted">{{ caption }}</figcaption>
  </figure>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ON, boxFrom, edgeStep, fractionOf, fromRGBA, grow, hasArea, invert, shrink, tintRGBA, toRGBA } from './maskMath'
// The mask is kept at the image's own size, one byte a pixel (maskMath): white where the picture changes. It is
// refined here (a brush and an eraser, Invert, Grow, Shrink, Undo) and shown tinted over the picture; the picture
// itself is never drawn or read. In Select, "Not this" and Box the pointer says what SAM 3 should find (the page
// sends it): each click is a point, a drag a box, as fractions of the picture.
const props = defineProps({
  src: { type: String, required: true },
  brush: { type: Number, default: 40 },
  // 'select' | 'remove' | 'box' | 'paint' | 'erase'
  mode: { type: String, default: 'paint' },
  points: { type: Array, default: () => [] },
  box: { type: Object, default: null },
})
const emit = defineEmits(['change', 'size', 'point', 'box'])
const image = ref(null), overlay = ref(null), painted = ref(false), dragBox = ref(null)
let mask = null, width = 0, height = 0, drawing = false, last = null, boxStart = null, history = [], tint = [124, 92, 255, 140]
const HISTORY = 20
const caption = computed(() => ({
  select: 'Click the part of the picture to change. Each click adds to the area.',
  remove: 'Click a part that should stay as it is.',
  box: 'Drag a box around the part to change.',
  erase: 'Rub out the parts that should stay as they are.',
}[props.mode] || (painted.value ? 'Marked areas change; the rest of the picture stays as it is.' : 'Paint over the part of the picture to change.')))
const shownBox = computed(() => dragBox.value || props.box)
const boxStyle = computed(() => { const b = shownBox.value; return b ? { left: `${b.x_min * 100}%`, top: `${b.y_min * 100}%`, width: `${(b.x_max - b.x_min) * 100}%`, height: `${(b.y_max - b.y_min) * 100}%` } : {} })

function ctx2d(canvas) { return canvas?.getContext?.('2d') || null }
function ready() {
  const img = image.value, w = img.naturalWidth, h = img.naturalHeight
  if (!w || !h) return
  // The Studio accent (--vm-violet) at a little over half strength, so the picture stays readable under the area.
  const accent = getComputedStyle(overlay.value).getPropertyValue('--vm-violet').trim()
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(accent)
  if (m) tint = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 140]
  width = w; height = h; mask = new Uint8Array(w * h)
  overlay.value.width = w; overlay.value.height = h
  history = []; render(); changed()
  emit('size', { width: w, height: h })
}
// The overlay for the whole mask, or only the rectangle a stroke touched.
function render(x0 = 0, y0 = 0, x1 = width, y1 = height) {
  const ctx = ctx2d(overlay.value)
  if (!ctx || !mask || typeof ImageData === 'undefined') return
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(width, Math.ceil(x1)); y1 = Math.min(height, Math.ceil(y1))
  const w = x1 - x0, h = y1 - y0
  if (w <= 0 || h <= 0) return
  const part = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) part.set(mask.subarray((y0 + y) * width + x0, (y0 + y) * width + x1), y * w)
  ctx.putImageData(new ImageData(tintRGBA(part, tint), w, h), x0, y0)
}
function changed() { painted.value = !!mask && hasArea(mask); emit('change', painted.value) }
function remember() { if (!mask) return; history.push(Uint8Array.from(mask)); if (history.length > HISTORY) history.shift() }
function replace(next) { remember(); mask = next; render(); changed() }
const round = v => Math.round(v * 10000) / 10000
function where(event) {
  const box = overlay.value.getBoundingClientRect()
  const f = fractionOf(event.clientX, event.clientY, box)
  return { ...f, px: f.x * (width - 1), py: f.y * (height - 1), r: (props.brush / 2) * (box.width ? width / box.width : 1) }
}
// A round brush stamped along the stroke, straight into the mask.
function stamp(from, to) {
  const value = props.mode === 'erase' ? 0 : ON, r = Math.max(1, to.r), r2 = r * r
  const steps = Math.max(1, Math.ceil(Math.hypot(to.px - from.px, to.py - from.py) / Math.max(1, r / 2)))
  for (let s = 0; s <= steps; s++) {
    const cx = from.px + ((to.px - from.px) * s) / steps, cy = from.py + ((to.py - from.py) * s) / steps
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(height - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(width - 1, Math.ceil(cx + r)); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) mask[y * width + x] = value
      }
    }
  }
  render(Math.min(from.px, to.px) - r - 1, Math.min(from.py, to.py) - r - 1, Math.max(from.px, to.px) + r + 2, Math.max(from.py, to.py) + r + 2)
}
function start(event) {
  if (!mask) return
  event.preventDefault()
  if (props.mode === 'select' || props.mode === 'remove') {
    const at = where(event)
    // Alt (Option) flips it: a quick "not this" while selecting, and the reverse.
    const inside = (props.mode === 'select') !== !!event.altKey
    emit('point', { x: round(at.x), y: round(at.y), label: inside ? 1 : 0 })
    return
  }
  overlay.value.setPointerCapture?.(event.pointerId)
  if (props.mode === 'box') { boxStart = where(event); dragBox.value = null; return }
  remember(); drawing = true; last = where(event); stamp(last, last)
}
function move(event) {
  if (boxStart) { dragBox.value = boxFrom(boxStart, where(event), 0); return }
  if (!drawing) return
  const next = where(event); stamp(last, next); last = next
}
function stop(event) {
  if (boxStart) {
    const b = boxFrom(boxStart, where(event))
    boxStart = null; dragBox.value = null
    if (b) emit('box', { x_min: round(b.x_min), y_min: round(b.y_min), x_max: round(b.x_max), y_max: round(b.y_max) })
    return
  }
  if (!drawing) return
  drawing = false; changed()
}
function cancel() { boxStart = null; dragBox.value = null; if (drawing) { drawing = false; changed() } }
watch(() => props.src, () => { mask = null; history = []; painted.value = false; emit('change', false) })
onBeforeUnmount(() => { mask = null })

// A selection's mask (any size: it is scaled to the picture's, nearest pixel) as this mask.
function setMaskData(data, w = width, h = height) {
  if (!mask) return false
  if (w === width && h === height) { replace(Uint8Array.from(data, v => (v ? ON : 0))); return true }
  const next = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const sy = Math.min(h - 1, Math.floor((y * h) / height))
    for (let x = 0; x < width; x++) next[y * width + x] = data[sy * w + Math.min(w - 1, Math.floor((x * w) / width))] ? ON : 0
  }
  replace(next); return true
}
defineExpose({
  clear() { if (!mask) return; replace(new Uint8Array(width * height)) },
  undo() { const prev = history.pop(); if (!prev || !mask) return; mask = prev; render(); changed() },
  invert() { if (mask) replace(invert(mask)) },
  grow() { if (mask) replace(grow(mask, width, height, edgeStep(width, height))) },
  shrink() { if (mask) replace(shrink(mask, width, height, edgeStep(width, height))) },
  edgeStep: () => (width ? edgeStep(width, height) : 0),
  maskData: () => (mask ? Uint8Array.from(mask) : null),
  setMaskData,
  // The mask a selection made (a PNG Blob), read through a canvas of its own size.
  async setMask(blob) {
    if (!mask || !blob || typeof createImageBitmap !== 'function') return false
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
    const ctx = ctx2d(canvas)
    if (!ctx) return false
    ctx.drawImage(bitmap, 0, 0)
    return setMaskData(fromRGBA(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.width, bitmap.height), bitmap.width, bitmap.height)
  },
  // The black-and-white PNG at the image's size, or null when nothing is marked.
  toBlob() {
    return new Promise(resolve => {
      if (!mask || !painted.value) return resolve(null)
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
      const ctx = ctx2d(canvas)
      if (!ctx || typeof ImageData === 'undefined') return resolve(null)
      ctx.putImageData(new ImageData(toRGBA(mask), width, height), 0, 0)
      canvas.toBlob(resolve, 'image/png')
    })
  },
})
</script>
<style scoped>
.mk{display:grid;gap:10px;margin:0;min-width:0}
.mk-frame{position:relative;justify-self:center;max-width:100%;line-height:0;border:1px solid var(--vm-line);background:var(--vm-bg)}
.mk-image{display:block;max-width:100%;max-height:min(62vh,640px);object-fit:contain;user-select:none}
.mk-overlay{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;touch-action:none}
.mk-erase .mk-overlay{cursor:cell}
.mk-point{position:absolute;display:grid;place-items:center;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:2px solid var(--vm-surface);font:700 14px/1 var(--vm-font-sans);pointer-events:none;box-shadow:var(--vm-shadow-s)}
.mk-point.is-in{background:var(--vm-violet);color:var(--vm-surface)}
.mk-point.is-out{background:var(--vm-red-ink);color:var(--vm-surface)}
.mk-box{position:absolute;border:2px dashed var(--vm-violet);background:var(--vm-violet-soft);pointer-events:none;opacity:.85}
.mk figcaption{font-size:12px;line-height:1.55;text-align:center}
</style>
