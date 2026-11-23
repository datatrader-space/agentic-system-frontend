<script setup>
// Mask shapes drawn as masks (ADM-1344, LABEL_EDITOR_TOOLS_PLAN.md 2.1 and contract C8).
//
// Place it inside the editor's .canvas-stage, between the photo and the SVG overlay: it fills its parent
// (position absolute, inset 0), so it follows the stage's zoom (the stage's width) and pan (the stage's transform)
// exactly as the SVG does, and it never takes a pointer event.
//
// Props:
//   shapes       [{id, kind, mask: {size: [h, w], counts}}]   shapes without a mask are skipped (polygons stay SVG)
//   colorOf      (kind) => css colour                          the class colour
//   selected     id | null                                     gets a 1 px contrast edge traced from its boundary
//   hidden       Set of ids                                    not drawn
//   photoWidth, photoHeight                                    the photo's own pixels (the masks' size)
//   live         brush.live (useBrush.js) | null               the mask being painted, drawn in place of its shape
// No events. Exposed: redraw() (composite again now) and stats ({decoded, lastDrawMs}) for checks.
//
// The fill is one canvas at the photo's own resolution scaled by CSS with image-rendering: pixelated, so every mask
// pixel keeps an exact square edge at any zoom: the class colour at 0.55 alpha, no outline, no corner handles. Each
// mask is made once into a tile the size of its box (maskRaster.tileOf), cached by id + counts + colour; a change
// remakes only the masks that changed, then the tiles are composited (a GPU copy each). Tiles and the selected edge
// are made in a worker (maskWorker.js) where the browser has one, so a 12 MP mask never holds up the page; until a
// new tile is ready the previous one stays on screen. Without a worker (tests) they are made here. The selected edge
// is an SVG path along the pixel edges with a non-scaling stroke: 1 px white over a navy halo, visible on any class
// colour and any photo.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { edgePathOf, packRgb, rgbOf, tileOf } from '../maskRaster.js';

const props = defineProps({
  shapes: { type: Array, default: () => [] },
  colorOf: { type: Function, default: () => '#8b5cf6' },
  selected: { type: [String, Number], default: null },
  hidden: { type: Set, default: () => new Set() },
  photoWidth: { type: Number, required: true },
  photoHeight: { type: Number, required: true },
  live: { type: Object, default: null },
});

const ALPHA = 0.55;
const FALLBACK = [139, 92, 246];
const fill = ref(null);
const edgePath = shallowRef('');
const stats = { decoded: 0, lastDrawMs: 0 };
const tiles = new Map();      // id -> {key, box, canvas (a canvas or an ImageBitmap) | null, pending}
let edgeKey = '';
let liveTile = null;          // {id, canvas, ctx} while a stroke is painted
let handoff = null;           // {id, canvas}: the finished stroke, shown until its new tile is ready
let worker = null, workerOff = false, jobs = 0;
const waiting = new Map();    // job -> callback
let unmounted = false;

const masks = computed(() => props.shapes.filter(s => s && s.mask && typeof s.mask.counts === 'string' && Array.isArray(s.mask.size)));
const fits = mask => mask.size[0] === props.photoHeight && mask.size[1] === props.photoWidth;

function colourBytes(colour) {
  const rgb = rgbOf(colour);
  if (rgb) return rgb;
  const probe = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;   // a named colour
  if (probe) { probe.fillStyle = '#000001'; probe.fillStyle = String(colour); return rgbOf(probe.fillStyle) || FALLBACK; }
  return FALLBACK;
}
function canvasOf(width, height) { const c = document.createElement('canvas'); c.width = width; c.height = height; return c; }

function workerFor() {
  if (worker || workerOff) return worker;
  if (typeof Worker !== 'function' || typeof createImageBitmap !== 'function') { workerOff = true; return null; }
  try {
    worker = new Worker(new URL('../maskWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = event => { const done = waiting.get(event.data.job); waiting.delete(event.data.job); if (done) done(event.data); };
    worker.onerror = () => { stopWorker(); remakeAll(); };          // a worker that cannot start: make tiles here instead
  } catch { workerOff = true; worker = null; }
  return worker;
}
function stopWorker() { workerOff = true; if (worker) worker.terminate(); worker = null; waiting.clear(); }
function ask(message, done) { const job = ++jobs; waiting.set(job, done); worker.postMessage({ job, ...message }); }

// Made here, on the page (no worker): the same tile as the worker's, put into a canvas.
function tileHere(mask, rgba) {
  const tile = tileOf(mask, rgba);
  if (!tile) return { box: null, canvas: null };
  const canvas = canvasOf(tile.width, tile.height), ctx = canvas.getContext('2d');
  if (!ctx) return { box: tile.box, canvas: null };
  const image = ctx.createImageData(tile.width, tile.height);
  image.data.set(new Uint8ClampedArray(tile.pixels.buffer));
  ctx.putImageData(image, 0, 0);
  return { box: tile.box, canvas };
}

function makeTile(shape, key) {
  const rgba = packRgb(colourBytes(props.colorOf(shape.kind)));
  const old = tiles.get(shape.id);
  stats.decoded++;
  const mask = { size: [...shape.mask.size], counts: shape.mask.counts };
  if (workerFor()) {
    tiles.set(shape.id, { key, pending: true, box: old?.box || null, canvas: old?.canvas || null });
    ask({ type: 'tile', mask, rgba }, reply => {
      const tile = tiles.get(shape.id);
      if (unmounted || !tile || tile.key !== key) { reply.bitmap?.close?.(); return; }
      if (reply.error) { tiles.set(shape.id, { key, box: null, canvas: null }); composite(); return; }
      tiles.set(shape.id, { key, box: reply.box, canvas: reply.bitmap || null });
      if (handoff && handoff.id === shape.id) handoff = null;
      composite();
    });
    return;
  }
  try { tiles.set(shape.id, { key, ...tileHere(mask, rgba) }); }
  catch { tiles.set(shape.id, { key, box: null, canvas: null }); }
  if (handoff && handoff.id === shape.id) handoff = null;
}

function remakeAll() { tiles.clear(); edgeKey = ''; redraw(); }

// The mask being painted: a canvas the size of the photo for the stroke. It starts from the shape's tile (a GPU
// copy) and each move puts in only the pixels it changed.
function drawLive(live) {
  const { width, height } = live;
  if (width !== props.photoWidth || height !== props.photoHeight) return null;
  if (!liveTile || liveTile.id !== live.id || liveTile.version > live.version) {
    const canvas = canvasOf(width, height), ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    const tile = tiles.get(live.id);
    if (tile && tile.canvas && tile.box) { ctx.setTransform(0, 1, 1, 0, tile.box[0], tile.box[1]); ctx.drawImage(tile.canvas, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); }
    liveTile = { id: live.id, canvas, ctx, version: 0, fresh: true };
  }
  const rgba = packRgb(colourBytes(props.colorOf(live.kind)));
  // A fresh stroke puts in everything it has changed so far; then each move its own part.
  const part = liveTile.fresh ? live.box : (live.dirty || live.box);
  if (part) {
    const [x0, y0, x1, y1] = part, w = x1 - x0 + 1, h = y1 - y0 + 1;
    const image = liveTile.ctx.createImageData(w, h), px = new Uint32Array(image.data.buffer);
    for (let y = 0, o = 0; y < h; y++) for (let x = 0, i = (y0 + y) * width + x0; x < w; x++, i++, o++) px[o] = live.data[i] ? rgba : 0;
    liveTile.ctx.putImageData(image, x0, y0);
  }
  liveTile.fresh = false;
  liveTile.version = live.version;
  return liveTile.canvas;
}

function composite() {
  const canvas = fill.value;
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = ALPHA;
  ctx.imageSmoothingEnabled = false;
  const live = props.live ? drawLive(props.live) : null;
  for (const shape of masks.value) {
    if (props.hidden.has(shape.id) || (live && props.live.id === shape.id)) continue;
    const tile = tiles.get(shape.id);
    if (handoff && handoff.id === shape.id && tile?.pending) { ctx.drawImage(handoff.canvas, 0, 0); continue; }
    if (!tile || !tile.canvas || !tile.box) continue;
    ctx.setTransform(0, 1, 1, 0, tile.box[0], tile.box[1]);
    ctx.drawImage(tile.canvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (live && !props.hidden.has(props.live.id)) ctx.drawImage(live, 0, 0);
  ctx.globalAlpha = 1;
}

function updateEdge() {
  const shape = props.selected == null || props.hidden.has(props.selected) ? null : masks.value.find(s => s.id === props.selected);
  const key = shape && fits(shape.mask) ? `${shape.id}|${shape.mask.counts}|${props.photoWidth}x${props.photoHeight}` : '';
  if (key === edgeKey) return;
  edgeKey = key;
  if (!key) { edgePath.value = ''; return; }
  const mask = { size: [...shape.mask.size], counts: shape.mask.counts };
  if (workerFor()) {
    ask({ type: 'edge', mask }, reply => { if (!unmounted && edgeKey === key) edgePath.value = reply.error ? '' : reply.path; });
    return;
  }
  try { edgePath.value = edgePathOf(mask); } catch { edgePath.value = ''; }
}

function redraw() {
  const started = performance.now();
  const seen = new Set();
  for (const shape of masks.value) {
    seen.add(shape.id);
    if (!fits(shape.mask)) { tiles.delete(shape.id); continue; }
    const key = `${shape.mask.counts}|${shape.mask.size}|${props.colorOf(shape.kind)}`;
    if (tiles.get(shape.id)?.key !== key) makeTile(shape, key);
  }
  for (const id of [...tiles.keys()]) if (!seen.has(id)) tiles.delete(id);
  if (!props.live && liveTile) { handoff = tiles.get(liveTile.id)?.pending ? { id: liveTile.id, canvas: liveTile.canvas } : null; liveTile = null; }
  composite();
  updateEdge();
  stats.lastDrawMs = performance.now() - started;
}

watch(() => [masks.value.map(s => [s.id, s.kind, s.mask.counts, s.mask.size]), props.selected, [...props.hidden], props.colorOf,
              props.photoWidth, props.photoHeight, props.live, props.live?.version],
      redraw, { flush: 'post' });
watch(() => [props.photoWidth, props.photoHeight], () => { tiles.clear(); handoff = null; liveTile = null; });
onMounted(redraw);
onBeforeUnmount(() => { unmounted = true; stopWorker(); tiles.clear(); liveTile = null; handoff = null; });
defineExpose({ redraw: composite, stats });
</script>

<template>
  <div class="mask-layer" aria-hidden="true">
    <canvas ref="fill" class="mask-fill" :width="photoWidth" :height="photoHeight"></canvas>
    <svg v-if="edgePath" class="mask-edge" :viewBox="`0 0 ${photoWidth} ${photoHeight}`" preserveAspectRatio="none">
      <path class="mask-edge-halo" :d="edgePath"/>
      <path class="mask-edge-line" :d="edgePath"/>
    </svg>
  </div>
</template>

<style scoped>
.mask-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;line-height:0}
.mask-fill{position:absolute;inset:0;width:100%;height:100%;image-rendering:crisp-edges;image-rendering:pixelated}
.mask-edge{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.mask-edge path{fill:none;vector-effect:non-scaling-stroke;stroke-linejoin:miter;shape-rendering:crispEdges}
.mask-edge-halo{stroke:rgba(15,23,42,.85);stroke-width:3px}
.mask-edge-line{stroke:#fff;stroke-width:1px}
</style>
