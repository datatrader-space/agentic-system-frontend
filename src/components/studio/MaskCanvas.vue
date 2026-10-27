<template>
  <figure class="mk" :class="{ erasing: mode === 'erase' }">
    <div class="mk-frame">
      <img ref="image" :src="src" alt="The image to edit" class="mk-image" draggable="false" @load="ready" />
      <canvas ref="overlay" class="mk-overlay" data-test="mask-canvas" aria-label="Paint over the area to change" role="img" @pointerdown="start" @pointermove="draw" @pointerup="stop" @pointercancel="stop" @pointerleave="stop" />
    </div>
    <figcaption class="st-muted">{{ painted ? 'Painted areas change; the rest of the image stays as it is.' : 'Paint over the part of the image to change. Leave it unpainted to let the model edit the whole image.' }}</figcaption>
  </figure>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
// The mask is kept at the image's own size: black everywhere, white where the person painted (the area to change).
// The overlay shows those strokes tinted over the image. The image itself is never drawn or read.
const props = defineProps({ src: { type: String, required: true }, brush: { type: Number, default: 40 }, mode: { type: String, default: 'paint' } })
const emit = defineEmits(['change','size'])
const image = ref(null), overlay = ref(null), painted = ref(false)
let mask = null, drawing = false, last = null, history = [], tint = 'rgba(59,130,246,.55)'
function ready() {
  const img = image.value, w = img.naturalWidth, h = img.naturalHeight
  if (!w || !h) return
  // The Studio accent (--vm-violet), at half strength so the image stays readable under the strokes.
  const accent = getComputedStyle(overlay.value).getPropertyValue('--vm-violet').trim()
  if (/^#[0-9a-f]{6}$/i.test(accent)) tint = `${accent}8c`
  mask = document.createElement('canvas'); mask.width = w; mask.height = h
  const m = mask.getContext('2d'); m.fillStyle = '#000'; m.fillRect(0, 0, w, h)
  overlay.value.width = w; overlay.value.height = h
  painted.value = false; history = []
  emit('size', { width: w, height: h }); emit('change', false)
}
function point(event) {
  const box = overlay.value.getBoundingClientRect(), scale = overlay.value.width / box.width
  return { x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale, r: (props.brush / 2) * scale }
}
function stroke(ctx, from, to, color, composite) {
  ctx.globalCompositeOperation = composite; ctx.strokeStyle = color; ctx.lineWidth = to.r * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
}
function paint(from, to) {
  const erase = props.mode === 'erase'
  stroke(mask.getContext('2d'), from, to, erase ? '#000' : '#fff', 'source-over')
  stroke(overlay.value.getContext('2d'), from, to, tint, erase ? 'destination-out' : 'source-over')
}
function start(event) {
  if (!mask) return
  event.preventDefault(); overlay.value.setPointerCapture?.(event.pointerId)
  history.push([mask.getContext('2d').getImageData(0, 0, mask.width, mask.height), overlay.value.getContext('2d').getImageData(0, 0, mask.width, mask.height)])
  if (history.length > 20) history.shift()
  drawing = true; last = point(event); paint(last, last)
}
function draw(event) { if (!drawing) return; const next = point(event); paint(last, next); last = next }
function stop() { if (!drawing) return; drawing = false; changed() }
function changed() {
  const data = mask.getContext('2d').getImageData(0, 0, mask.width, mask.height).data
  let any = false
  for (let i = 0; i < data.length; i += 16) if (data[i] > 127) { any = true; break }
  painted.value = any; emit('change', any)
}
watch(() => props.src, () => { mask = null; painted.value = false; emit('change', false) })
onBeforeUnmount(() => { mask = null })
defineExpose({
  clear() { if (!mask) return; const m = mask.getContext('2d'); m.fillStyle = '#000'; m.fillRect(0, 0, mask.width, mask.height); overlay.value.getContext('2d').clearRect(0, 0, mask.width, mask.height); history = []; changed() },
  undo() { const last = history.pop(); if (!last) return; mask.getContext('2d').putImageData(last[0], 0, 0); overlay.value.getContext('2d').putImageData(last[1], 0, 0); changed() },
  // The black-and-white PNG at the image's size, or null when nothing is painted.
  toBlob() { return new Promise(resolve => (!mask || !painted.value) ? resolve(null) : mask.toBlob(resolve, 'image/png')) },
})
</script>
<style scoped>
.mk{display:grid;gap:10px;margin:0;min-width:0}.mk-frame{position:relative;justify-self:center;max-width:100%;line-height:0;border:1px solid var(--vm-line);background:var(--vm-bg)}.mk-image{display:block;max-width:100%;max-height:min(62vh,640px);object-fit:contain;user-select:none}.mk-overlay{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;touch-action:none}.erasing .mk-overlay{cursor:cell}.mk figcaption{font-size:12px;line-height:1.55;text-align:center}
</style>
