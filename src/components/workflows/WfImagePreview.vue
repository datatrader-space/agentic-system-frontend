<!--
  An image of a workflow run, or the objects found on one (ADM-1351).

    <WfImagePreview :image="{ kind: 'image', id }" label="image" />
    <WfImagePreview :detections="{ kind: 'detections', image, size: [w, h], items }" label="detections" />

  The viewer link (a 15-minute link, utils/wfImages.js) is asked for only when the preview comes into view, and asked
  again when it has expired. A click opens the image full size in a new tab. Detections draw each box (and polygon)
  as an SVG over the image, with its class and confidence as a label, and say "N objects: cat 2, dog 1" in words, so
  nothing is told by the drawing alone. A camera frame has no viewer link here: it is named, "Camera frame #n".
-->
<template>
  <figure ref="root" class="wip" :class="{ 'wip--det': !!detections }">
    <div v-if="frameEvent !== null" class="wip-frame">
      <Icon icon="lucide:cctv" aria-hidden="true" /><span>Camera frame #{{ frameEvent }}</span>
    </div>
    <template v-else-if="imageId">
      <p v-if="error" class="wip-error" role="alert">
        <Icon icon="lucide:image-off" aria-hidden="true" /><span>{{ error }}</span>
        <button type="button" class="wip-btn" @click="load(true)"><Icon icon="lucide:refresh-cw" aria-hidden="true" />Retry</button>
      </p>
      <a
        v-else-if="url" class="wip-link" :class="{ 'has-ratio': !!size }" :style="size ? { '--wip-ratio': size[0] / size[1] } : null" :href="url" target="_blank" rel="noopener noreferrer"
        :aria-label="`${altText}. Opens full size in a new tab`"
      >
        <img
          class="wip-img" :src="url" :alt="altText" :width="size?.[0]" :height="size?.[1]" loading="lazy" decoding="async"
          @error="onImgError"
        >
        <svg
          v-if="detections && size" class="wip-svg" :viewBox="`0 0 ${size[0]} ${size[1]}`" preserveAspectRatio="none"
          aria-hidden="true" focusable="false"
        >
          <template v-for="(it, i) in items" :key="i">
            <polygon v-if="points(it)" class="wip-poly" :points="points(it)" vector-effect="non-scaling-stroke" />
            <!-- A light halo under each box keeps it visible on any photo, also one of the box's own colour. -->
            <rect
              v-if="it.box" class="wip-halo" :x="it.box[0]" :y="it.box[1]" :width="Math.max(it.box[2] - it.box[0], 0)"
              :height="Math.max(it.box[3] - it.box[1], 0)" vector-effect="non-scaling-stroke"
            />
            <rect
              v-if="it.box" class="wip-box" :x="it.box[0]" :y="it.box[1]" :width="Math.max(it.box[2] - it.box[0], 0)"
              :height="Math.max(it.box[3] - it.box[1], 0)" vector-effect="non-scaling-stroke"
            />
          </template>
        </svg>
        <span
          v-for="(l, i) in labels" :key="`l${i}`" class="wip-label" aria-hidden="true"
          :style="{ left: `${l.left}%`, top: `${l.top}%` }"
        >{{ l.text }}</span>
      </a>
      <div v-else class="wip-wait" :style="ratioStyle" role="status">
        <Icon icon="lucide:image" aria-hidden="true" /><span>Loading the image…</span>
      </div>
    </template>
    <figcaption class="wip-cap">
      <code v-if="label" class="wip-path" translate="no">{{ label }}</code>
      <span v-if="detections">{{ summary }}</span>
      <span v-else-if="sizeText" class="wip-dim">{{ sizeText }}</span>
    </figcaption>
  </figure>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { boxPercent, detectionSummary, imageUrl, isImageRef, polygonPoints } from '@/utils/wfImages'

const props = defineProps({
  image: { type: Object, default: null },
  detections: { type: Object, default: null },
  label: { type: String, default: '' },
})

const img = computed(() => (props.detections ? (isImageRef(props.detections.image) ? props.detections.image : null) : props.image))
const imageId = computed(() => (img.value && typeof img.value.id === 'string' ? img.value.id : null))
const frameEvent = computed(() => (img.value && img.value.id === undefined && Number.isInteger(img.value.event) ? img.value.event : null))
const items = computed(() => (Array.isArray(props.detections?.items) ? props.detections.items : []))
const size = computed(() => {
  const s = props.detections?.size
  if (Array.isArray(s) && Number(s[0]) > 0 && Number(s[1]) > 0) return [Number(s[0]), Number(s[1])]
  const w = Number(img.value?.width)
  const h = Number(img.value?.height)
  return w > 0 && h > 0 ? [w, h] : null
})
// The space is kept for the image before it arrives (the placeholder, then the <img>'s width and height), so the pane
// does not jump.
const ratioStyle = computed(() => (size.value ? { aspectRatio: `${size.value[0]} / ${size.value[1]}` } : null))
const summary = computed(() => detectionSummary(props.detections))
const sizeText = computed(() => (size.value ? `${size.value[0]} × ${size.value[1]}` : ''))
const altText = computed(() => {
  if (props.detections) return `Image with the objects found: ${summary.value}`
  return props.label ? `Image ${props.label}` : 'Image'
})
const pct = (n) => Math.min(Math.max(n, 0), 100)
const labels = computed(() => (size.value ? items.value.map((it) => {
  const p = boxPercent(it.box, size.value)
  if (!p) return null
  const score = Number(it.score)
  return { left: pct(p.left), top: pct(p.top), text: `${it.class ?? 'object'}${Number.isFinite(score) ? ` ${Math.round(score * 100)}%` : ''}` }
}).filter(Boolean) : []))
const points = (it) => polygonPoints(it.polygon)

// ── the viewer link, asked for once the preview is in view ──
const root = ref(null)
const url = ref('')
const error = ref('')
let retried = false
let observer = null
let seen = false
async function load(force = false) {
  const id = imageId.value
  if (!id) return
  error.value = ''
  if (force) url.value = ''
  try {
    const next = await imageUrl(id, { force })
    if (id === imageId.value) url.value = next
  } catch (e) {
    if (id === imageId.value) error.value = e.message
  }
}
// The link may have expired while the image was on screen: ask for a new one once, then say what failed.
function onImgError() {
  if (retried) { error.value = 'The image could not be shown.'; return }
  retried = true
  load(true)
}
function show() { if (!seen) { seen = true; load() } }
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !root.value) { show(); return }
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { observer?.disconnect(); observer = null; show() }
  }, { rootMargin: '200px' })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(imageId, () => { url.value = ''; error.value = ''; retried = false; if (seen) load() })
</script>

<style scoped>
.wip { display: grid; gap: 4px; margin: 0; min-width: 0; }
/* The link shrinks to the image, so the SVG over it (inset 0) lies exactly on the picture. */
.wip-link {
  position: relative; display: inline-block; justify-self: start; max-width: 100%; overflow: hidden; line-height: 0;
  border: 1px solid var(--vm-line); border-radius: 6px; background: var(--vm-surface-soft); cursor: zoom-in;
  transition: border-color .15s ease;
}
.wip-link:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.wip-link:hover { border-color: var(--vm-ink-faint); }
.wip-img { display: block; max-width: 100%; width: auto; height: auto; max-height: 320px; }
.wip:not(.wip--det) .wip-img { max-width: min(160px, 100%); max-height: 160px; }
/* With the image's size known, it fills the pane up to the height limit whatever its pixel size (a small image is not
   drawn tiny), keeping its proportions so the boxes stay on it. The link carries the width; the image fills it. */
.wip--det .wip-link.has-ratio { width: min(100%, calc(320px * var(--wip-ratio))); }
.wip:not(.wip--det) .wip-link.has-ratio { width: min(100%, 160px, calc(160px * var(--wip-ratio))); }
.wip .wip-link.has-ratio .wip-img { width: 100%; max-width: 100%; max-height: none; aspect-ratio: var(--wip-ratio); }
.wip-wait { width: 100%; max-height: 320px; border: 1px solid var(--vm-line); border-radius: 6px; background: var(--vm-surface-soft); }
.wip:not(.wip--det) .wip-wait { width: min(160px, 100%); max-height: 160px; }
@media (prefers-reduced-motion: reduce) { .wip-link { transition: none; } }
.wip-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.wip-box, .wip-poly { fill: none; stroke: var(--wf-cat-vision); stroke-width: 2; }
.wip-halo { fill: none; stroke: var(--wf-cat-vision-soft); stroke-width: 4; }
.wip-poly { fill: color-mix(in srgb, var(--wf-cat-vision) 18%, transparent); stroke-width: 1.5; }
.wip-label {
  position: absolute; transform: translateY(-100%); max-width: 60%; padding: 1px 4px; border-radius: 3px 3px 3px 0;
  background: var(--wf-cat-vision); color: var(--wf-cat-vision-soft); font-size: 11px; font-weight: 600; line-height: 1.35;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;
}
.wip-wait, .wip-frame {
  display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 64px; padding: 8px;
  color: var(--vm-ink-faint); font-size: 12px;
}
.wip-frame { justify-content: flex-start; border: 1px dashed var(--vm-line-2); border-radius: 6px; color: var(--vm-ink-soft); }
.wip-wait :deep(svg), .wip-frame :deep(svg), .wip-error :deep(svg), .wip-btn :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.wip-error { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0; font-size: 12px; color: var(--vm-red-ink); }
.wip-btn {
  display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 3px 8px; border: 1px solid var(--vm-line-2);
  border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 12px; cursor: pointer;
}
.wip-btn:hover { background: var(--vm-surface-soft); }
.wip-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.wip-cap { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; font-size: 12px; color: var(--vm-ink-soft); }
.wip-path { font-family: var(--vm-font-mono, ui-monospace, monospace); font-size: 11px; color: var(--vm-ink-faint); }
.wip-dim { color: var(--vm-ink-faint); }
@media (pointer: coarse) { .wip-btn { min-height: 44px; } }
</style>
