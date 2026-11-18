<template>
  <!-- The monitor (plan E4): each clip's light preview copy plays in its own <video>, pictures and text are drawn over
       it in the canvas's shape, and a clock switches clips at their edges. It is close to the export, not exact; the
       export, and "Preview this part exactly", are rendered on the server. -->
  <section class="cm" aria-label="Monitor">
    <div class="cm-frame">
      <div class="cm-canvas" :style="{ aspectRatio: ratio, '--cm-r': ratioNumber, background: doc.canvas.background }" @click="$emit('toggle')">
        <template v-for="row in visible" :key="row.item.id">
          <div v-if="row.item.type === 'text'" class="cm-text" :style="textStyle(row.item)">{{ row.item.text }}</div>
          <div v-else-if="row.track.kind === 'video'" class="cm-layer" :style="layerStyle(row)">
            <img v-if="kindOf(row.item) === 'image'" :src="srcOf(row.item)" alt="" :class="['cm-media', fitClass(row.item), { zoom: row.item.zoom }]" :style="cropStyle(row.item)" draggable="false" />
            <video v-else :ref="el => bind(row.item.id, el)" :src="srcOf(row.item)" :class="['cm-media', fitClass(row.item)]" :style="cropStyle(row.item)"
                   preload="auto" playsinline :muted="silent(row)" disablepictureinpicture />
          </div>
          <audio v-else-if="row.track.kind === 'audio' && srcOf(row.item)" :ref="el => bind(row.item.id, el)" :src="srcOf(row.item)" preload="auto" :muted="silent(row)" />
        </template>
        <p v-if="!visible.length" class="cm-empty">{{ total ? 'Nothing at this time: a gap shows the background.' : 'Add a clip from your files to start.' }}</p>
      </div>
    </div>
    <div class="cm-bar">
      <button type="button" class="cm-btn" :aria-label="playing ? 'Pause' : 'Play'" @click="$emit('toggle')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path v-if="playing" d="M7 5h4v14H7zM13 5h4v14h-4z" /><path v-else d="M7 4l13 8-13 8V4Z" /></svg>
      </button>
      <button type="button" class="cm-btn" aria-label="One frame back" @click="$emit('seek', playhead - frame)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7M6 5v14" /></svg></button>
      <button type="button" class="cm-btn" aria-label="One frame forward" @click="$emit('seek', playhead + frame)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7M18 5v14" /></svg></button>
      <span class="cm-time" aria-live="off"><b>{{ tc(playhead) }}</b><span> / {{ tc(total) }}</span></span>
      <button type="button" class="st-button cm-exact" :disabled="!total || previewBusy" @click="$emit('preview-exact')">{{ previewBusy ? 'Rendering the part…' : 'Preview this part exactly' }}</button>
    </div>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'
import * as tl from './timelineModel'

const props = defineProps({ doc: { type: Object, required: true }, playhead: { type: Number, default: 0 }, playing: Boolean,
  media: { type: Object, default: () => ({}) }, previewBusy: Boolean })
const emit = defineEmits(['tick', 'toggle', 'seek', 'ended', 'preview-exact'])
const rate = computed(() => props.doc.rate || 30)
const frame = computed(() => tl.frameMs(rate.value))
const total = computed(() => tl.totalMs(props.doc))
const tc = ms => tl.timecode(ms, rate.value)
const ratio = computed(() => props.doc.canvas.aspect.replace(':', ' / '))
const ratioNumber = computed(() => { const [w, h] = props.doc.canvas.aspect.split(':').map(Number); return w / h })
// Bottom track first, so a higher video track is drawn over a lower one.
const visible = computed(() => tl.itemsAt(props.doc, props.playhead))
const kindOf = item => item.hold_ms != null ? 'image' : (props.media[item.media]?.media_type || 'video')
// A video plays from its preview copy; a picture or a sound from the file itself.
const srcOf = item => { const m = props.media[item.media]; return m ? (m.preview_url || m.url || '') : '' }
const fitClass = item => item.fit === 'cover' ? 'cover' : 'contain'
const silent = row => !!(row.item.muted || row.track.muted)

// The opacity a clip has at this moment: its own, ramped in across a transition into it.
function alphaOf(row) {
  const t = row.track.items.find(i => i.type === 'transition' && i.between[1] === row.item.id)
  let a = row.item.transform?.opacity ?? 1
  if (t && props.playhead < row.item.start_ms + t.ms) a *= Math.max(0, (props.playhead - row.item.start_ms) / t.ms)
  return a
}
function layerStyle(row) {
  const tf = row.item.transform || { x: 0.5, y: 0.5, scale: 1 }
  return { left: `${(tf.x - tf.scale / 2) * 100}%`, top: `${(tf.y - tf.scale / 2) * 100}%`, width: `${tf.scale * 100}%`, height: `${tf.scale * 100}%`, opacity: alphaOf(row) }
}
function cropStyle(item) {
  const c = item.crop
  return c ? { objectViewBox: `inset(${c.y * 100}% ${(1 - c.x - c.w) * 100}% ${(1 - c.y - c.h) * 100}% ${c.x * 100}%)` } : {}
}
const FONT = { sans: '"DejaVu Sans", Verdana, sans-serif', 'sans-bold': '"DejaVu Sans", Verdana, sans-serif', serif: '"DejaVu Serif", Georgia, serif', mono: '"DejaVu Sans Mono", Consolas, monospace' }
function textStyle(item) {
  const s = item.style || {}
  const box = s.box ? `#${s.box.slice(1, 7)}${s.box.length > 7 ? s.box.slice(7) : 'ff'}` : 'transparent'
  return { left: `${item.x * 100}%`, top: `${item.y * 100}%`, fontFamily: FONT[s.font] || FONT.sans, fontWeight: s.font === 'sans-bold' ? 700 : 400,
    fontSize: `calc(var(--cm-h) * ${s.size || 0.06})`, color: s.color || '#fff', background: box, padding: s.box ? `calc(var(--cm-h) * ${(s.size || 0.06) / 4})` : 0 }
}

// ── the clock: plays each visible clip's element at the place the playhead says ──────────────────────────────────
const elements = new Map()
function bind(id, el) { if (el) elements.set(id, el); else elements.delete(id) }
function desired(row) {
  const item = row.item
  return ((item.source_in_ms || 0) + (props.playhead - item.start_ms) * (item.speed || 1)) / 1000
}
function sync(hard) {
  for (const row of visible.value) {
    const el = elements.get(row.item.id)
    if (!el) continue
    const want = desired(row)
    el.playbackRate = row.item.speed || 1
    el.volume = Math.min(1, Math.pow(10, (row.item.volume_db || 0) / 20))
    if (hard || Math.abs(el.currentTime - want) > 0.25) { try { el.currentTime = want } catch { /* not loaded yet */ } }
    if (props.playing && el.paused) el.play?.().catch(() => {})
    if (!props.playing && !el.paused) el.pause()
  }
  for (const [id, el] of elements) if (!visible.value.some(r => r.item.id === id) && !el.paused) el.pause()
}
let raf = 0, last = 0
function loop(now) {
  if (!props.playing) return
  const dt = last ? now - last : 0
  last = now
  const next = props.playhead + dt
  if (next >= total.value) { emit('tick', total.value); emit('ended'); return }
  emit('tick', next)
  raf = requestAnimationFrame(loop)
}
watch(() => props.playing, on => {
  cancelAnimationFrame(raf); last = 0
  if (on) raf = requestAnimationFrame(loop)
  queueMicrotask(() => sync(true))
})
watch(() => props.playhead, () => queueMicrotask(() => sync(!props.playing)))
watch(visible, () => queueMicrotask(() => sync(true)))
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>
<style scoped>
.cm{display:grid;gap:8px;min-width:0}
.cm-frame{display:grid;place-items:center;min-height:0;padding:10px;border:1px solid var(--vm-line);border-radius:8px;background:#000}
.cm-canvas{--cm-h:100cqh;position:relative;container-type:size;width:min(100%,calc(min(52vh,520px) * var(--cm-r)));overflow:hidden;cursor:pointer}
@supports not (container-type:size){.cm-canvas{--cm-h:40vh}}
.cm-layer{position:absolute;overflow:hidden}
.cm-media{position:absolute;inset:0;width:100%;height:100%;user-select:none}
.cm-media.contain{object-fit:contain}.cm-media.cover{object-fit:cover}
/* A clip with the zoom effect is previewed at its zoomed framing, still: no zooming animation anywhere in the app
   (owner rule, src/noMotion.test.js). The rendered video zooms. */
.cm-media.zoom{transform:scale(1.12)}
.cm-text{position:absolute;transform:translate(-50%,-50%);max-width:94%;line-height:1.2;white-space:pre-wrap;pointer-events:none}
.cm-empty{position:absolute;inset:0;display:grid;place-items:center;padding:16px;color:#a7b5cb;font-size:13px;text-align:center}
.cm-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cm-btn{display:grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface);color:var(--vm-ink);cursor:pointer}
.cm-btn:hover{background:var(--vm-surface-2)}
.cm-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}
.cm-btn:first-child svg{fill:currentColor;stroke:none}
.cm-time{font-variant-numeric:tabular-nums;font-size:13px;color:var(--vm-ink-soft)}.cm-time b{color:var(--vm-ink);font-weight:500}
.cm-exact{margin-left:auto}
@media (max-width:767px){.cm-canvas{width:min(100%,calc(36vh * var(--cm-r)))}.cm-btn{width:44px;height:44px}.cm-exact{margin-left:0;min-height:44px;flex:1 1 100%}}
@media (prefers-reduced-motion:reduce){.cm-media.zoom{animation:none}}
</style>
