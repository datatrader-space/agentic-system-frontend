<template>
  <!-- The timeline (plan sections 5 and 7): a ruler that seeks on a tap, a playhead slider, and one row per track. Each
       track is one tab stop; the arrow keys move between its items. A clip's two trim handles are sliders too, so
       every drag also has a keyboard way and the inspector has typed times. A selected item's handles join the tab
       order right after it. -->
  <div class="ct" :style="{ '--ct-zoom': zoom }">
    <div ref="scroller" class="ct-scroll" @scroll="scrollLeft = $event.target.scrollLeft">
      <div class="ct-body" :style="{ width: `${widthPx + HEAD}px` }">
        <div class="ct-ruler" :style="{ marginLeft: `${HEAD}px`, width: `${widthPx}px` }" @pointerdown="rulerSeek">
          <span v-for="tick in ticks" :key="tick" class="ct-tick" :style="{ left: `${px(tick)}px` }">{{ label(tick) }}</span>
        </div>
        <div class="ct-playhead" :style="{ left: `${HEAD + px(playhead)}px` }" aria-hidden="true" />
        <div v-for="(track, ti) in doc.tracks" :key="track.id" class="ct-row" :class="[`ct-${track.kind}`, { 'ct-off': track.hidden || track.muted }]">
          <div class="ct-head">
            <span class="ct-name">{{ trackName(track, ti) }}</span>
            <button v-if="track.kind !== 'text'" type="button" class="ct-icon" :aria-pressed="!!track.muted" :aria-label="`${track.muted ? 'Unmute' : 'Mute'} ${trackName(track, ti)}`" @click="$emit('track', { id: track.id, changes: { muted: !track.muted } })">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path v-if="!track.muted" d="M16 9a4 4 0 0 1 0 6" /><path v-else d="m16 9 5 6M21 9l-5 6" /></svg>
            </button>
            <button type="button" class="ct-icon" :aria-pressed="!!track.hidden" :aria-label="`${track.hidden ? 'Show' : 'Hide'} ${trackName(track, ti)}`" @click="$emit('track', { id: track.id, changes: { hidden: !track.hidden } })">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle v-if="!track.hidden" cx="12" cy="12" r="3" /><path v-else d="m4 4 16 16" /></svg>
            </button>
          </div>
          <div class="ct-lane" role="listbox" :aria-label="trackName(track, ti)" aria-multiselectable="true" :style="{ width: `${widthPx}px` }"
               @pointerdown.self="laneTap($event)">
            <div v-for="item in timed(track)" :key="item.id" class="ct-item" role="option" :data-id="item.id"
                 :aria-selected="selection.includes(item.id) ? 'true' : 'false'" :aria-label="itemLabel(track, item)"
                 :tabindex="rovingStop(track, item) ? 0 : -1" :class="{ on: selection.includes(item.id), [`ct-${item.type}`]: true }"
                 :style="itemStyle(track, item)"
                 @pointerdown="startDrag($event, track, item)" @keydown="itemKey($event, track, item)" @focus="focused[track.id] = item.id">
              <span class="ct-strip" v-if="stripStyle(item)" :style="stripStyle(item)" aria-hidden="true" />
              <svg v-if="peaks(item)" class="ct-wave" :viewBox="`0 0 ${peaks(item).length} 100`" preserveAspectRatio="none" aria-hidden="true"><path :d="wavePath(peaks(item))" /></svg>
              <span class="ct-title">{{ itemTitle(item) }}</span>
              <span class="ct-handle start" role="slider" :tabindex="selection.includes(item.id) ? 0 : -1" :aria-label="`Start of ${itemTitle(item)}`" :aria-valuenow="item.start_ms"
                    :aria-valuetext="tc(item.start_ms)" aria-valuemin="0" :aria-valuemax="total" @pointerdown.stop="startTrim($event, item, 'start')" @keydown.stop="trimKey($event, item, 'start')" />
              <span class="ct-handle end" role="slider" :tabindex="selection.includes(item.id) ? 0 : -1" :aria-label="`End of ${itemTitle(item)}`" :aria-valuenow="end(item)"
                    :aria-valuetext="tc(end(item))" aria-valuemin="0" :aria-valuemax="total" @pointerdown.stop="startTrim($event, item, 'end')" @keydown.stop="trimKey($event, item, 'end')" />
            </div>
            <span v-for="tr in transitions(track)" :key="tr.id" class="ct-transition" :class="{ on: selection.includes(tr.id) }" :style="transitionStyle(track, tr)">
              <button type="button" :aria-label="`${tr.kind.replace('_', ' ')} transition, ${tr.ms} ms`" @click="$emit('select', { id: tr.id })"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5l8 7-8 7M12 5l8 7-8 7" /></svg></button>
            </span>
          </div>
        </div>
      </div>
    </div>
    <div class="ct-seek">
      <label class="st-sr" :for="sliderId">Playhead</label>
      <input :id="sliderId" class="ct-slider" type="range" min="0" :max="Math.max(total, 1)" :step="frame" :value="playhead"
             role="slider" :aria-valuetext="tc(playhead)" @input="$emit('seek', Number($event.target.value))" @keydown="playheadKey" />
    </div>
  </div>
</template>
<script setup>
import { computed, reactive, ref, useId } from 'vue'
import * as tl from './timelineModel'

const props = defineProps({
  doc: { type: Object, required: true }, selection: { type: Array, default: () => [] }, playhead: { type: Number, default: 0 },
  zoom: { type: Number, default: 60 }, snapping: { type: Boolean, default: true }, media: { type: Object, default: () => ({}) },
  names: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['select', 'seek', 'move', 'trim', 'track', 'key'])
const HEAD = 92
const scroller = ref(null), scrollLeft = ref(0), sliderId = `ct-seek-${useId()}`
const focused = reactive({})
const rate = computed(() => props.doc.rate || 30)
const frame = computed(() => tl.frameMs(rate.value))
const total = computed(() => tl.totalMs(props.doc))
// A little room after the end, so a clip can be dragged past it.
const widthPx = computed(() => Math.max(px(total.value + 10000), 600))
const px = ms => (ms / 1000) * props.zoom
const msAt = x => (x / props.zoom) * 1000
const tc = ms => tl.timecode(ms, rate.value)
const end = item => tl.itemEnd(item)
const timed = track => tl.ordered(track)
const transitions = track => track.items.filter(i => i.type === 'transition')
const ticks = computed(() => {
  const step = props.zoom >= 120 ? 1000 : props.zoom >= 40 ? 2000 : props.zoom >= 15 ? 5000 : 15000
  const out = []
  for (let t = 0; t <= total.value + 10000; t += step) out.push(t)
  return out
})
const label = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
function trackName(track, ti) {
  const same = props.doc.tracks.slice(0, ti + 1).filter(t => t.kind === track.kind).length
  return track.name || `${{ video: 'Video', text: track.captions ? 'Captions' : 'Text', audio: 'Sound' }[track.kind]} ${same}`
}
function itemTitle(item) { return item.type === 'text' ? item.text : (props.names[item.media] || 'Clip') }
function itemLabel(track, item) {
  const len = tl.clipLength(item)
  return `${itemTitle(item)}, ${tc(item.start_ms)} to ${tc(item.start_ms + len)}${props.selection.includes(item.id) ? ', selected' : ''}`
}
function itemStyle(track, item) { return { left: `${px(item.start_ms)}px`, width: `${Math.max(px(tl.clipLength(item)), 6)}px` } }
function transitionStyle(track, tr) {
  const b = track.items.find(i => i.id === tr.between[1])
  return b ? { left: `${px(b.start_ms)}px`, width: `${Math.max(px(tr.ms), 18)}px` } : { display: 'none' }
}
// The frame strip: each tile is one second of the source, shown from the clip's in point at the timeline's zoom.
function stripStyle(item) {
  const m = props.media[item.media]
  const s = m?.strip
  if (!s || item.hold_ms != null || !s.urls?.length) return null
  const tileW = s.tile_width, tileH = s.tile_height, per = s.cols * s.rows
  const sec = Math.floor((item.source_in_ms || 0) / 1000), sheet = Math.min(Math.floor(sec / per), s.urls.length - 1), idx = sec % per
  return { backgroundImage: `url(${s.urls[sheet]})`, backgroundPosition: `-${(idx % s.cols) * tileW}px -${Math.floor(idx / s.cols) * tileH}px`,
    backgroundSize: `${s.cols * tileW}px ${s.rows * tileH}px` }
}
const peakCache = reactive({})
function peaks(item) {
  const m = props.media[item.media]
  if (!m?.peaks_url || item.type === 'text') return null
  if (!(m.peaks_url in peakCache)) {
    peakCache[m.peaks_url] = null
    fetch(m.peaks_url, { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => { peakCache[m.peaks_url] = d }).catch(() => {})
  }
  const d = peakCache[m.peaks_url]
  if (!d?.peaks?.length) return null
  const per = d.per_second, a = Math.floor((item.source_in_ms || 0) / 1000 * per)
  const b = item.hold_ms != null ? a : Math.ceil((item.source_out_ms || 0) / 1000 * per)
  const slice = d.peaks.slice(a, b)
  // At most one point a pixel: a long sound draws its loudest point in each pixel.
  const width = Math.max(1, Math.round(px(tl.clipLength(item))))
  if (slice.length <= width) return slice
  const step = slice.length / width
  return Array.from({ length: width }, (_, i) => Math.max(...slice.slice(Math.floor(i * step), Math.floor((i + 1) * step)) || [0]))
}
function wavePath(list) { return list.map((v, i) => `M${i} ${50 - v * 50 / 255}V${50 + v * 50 / 255}`).join('') }

// ── keyboard (WCAG 2.1.1): one tab stop per track, arrows move between its items ─────────────────────────────────
function rovingStop(track, item) {
  const list = timed(track)
  const cur = focused[track.id] && list.some(i => i.id === focused[track.id]) ? focused[track.id] : list.find(i => props.selection.includes(i.id))?.id || list[0]?.id
  return cur === item.id
}
function focusItem(id) { scroller.value?.querySelector(`[data-id="${id}"]`)?.focus() }
function itemKey(e, track, item) {
  const list = timed(track), n = list.findIndex(i => i.id === item.id)
  if (e.key === 'ArrowRight' && !e.altKey && list[n + 1]) { e.preventDefault(); focusItem(list[n + 1].id) }
  else if (e.key === 'ArrowLeft' && !e.altKey && list[n - 1]) { e.preventDefault(); focusItem(list[n - 1].id) }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const rows = props.doc.tracks, ti = rows.indexOf(track), next = rows[ti + (e.key === 'ArrowDown' ? 1 : -1)]
    const target = next && timed(next)[0]
    if (target) focusItem(target.id)
  } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emit('select', { id: item.id, add: e.shiftKey || e.ctrlKey || e.metaKey }) }
  else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    // Alt+arrow moves the item a frame (Shift: a second): moving without dragging (WCAG 2.5.7).
    e.preventDefault()
    const step = e.shiftKey ? 1000 : frame.value
    emit('move', { id: item.id, start: item.start_ms + (e.key === 'ArrowLeft' ? -step : step) })
  } else emit('key', e)
}
// A trim handle as a slider: arrows a frame, Page Up/Down a second, Home/End the far ends.
function trimKey(e, item, edge) {
  const cur = edge === 'start' ? item.start_ms : end(item)
  const steps = { ArrowLeft: -frame.value, ArrowDown: -frame.value, ArrowRight: frame.value, ArrowUp: frame.value, PageDown: -1000, PageUp: 1000 }
  let at = null
  if (e.key in steps) at = cur + steps[e.key]
  else if (e.key === 'Home') at = edge === 'start' ? 0 : item.start_ms
  else if (e.key === 'End') at = edge === 'start' ? end(item) : total.value + 60000
  if (at == null) return
  e.preventDefault()
  emit('trim', { id: item.id, edge, at: tl.toFrame(at, rate.value) })
}
function playheadKey(e) {
  const steps = { ArrowLeft: -frame.value, ArrowDown: -frame.value, ArrowRight: frame.value, ArrowUp: frame.value, PageDown: -1000, PageUp: 1000 }
  if (e.key in steps) { e.preventDefault(); emit('seek', tl.toFrame(props.playhead + steps[e.key], rate.value)) }
  else if (e.key === 'Home') { e.preventDefault(); emit('seek', 0) }
  else if (e.key === 'End') { e.preventDefault(); emit('seek', total.value) }
}

// ── pointer: tap to seek, drag to move, drag a handle to trim; snapping to the playhead and clip edges ──────────────
function laneX(e) {
  const lane = e.currentTarget.closest('.ct-row')?.querySelector('.ct-lane') || e.currentTarget
  return e.clientX - lane.getBoundingClientRect().left
}
function rulerSeek(e) { emit('seek', tl.toFrame(msAt(e.clientX - e.currentTarget.getBoundingClientRect().left), rate.value)) }
function laneTap(e) { emit('select', { id: null }); emit('seek', tl.toFrame(msAt(laneX(e)), rate.value)) }
function snapped(ms, exclude) {
  const at = tl.toFrame(ms, rate.value)
  if (!props.snapping) return at
  return tl.snap(at, tl.snapPoints(props.doc, { playhead: props.playhead, exclude }), msAt(8))
}
function trackUnder(e, kind) {
  const row = document.elementsFromPoint?.(e.clientX, e.clientY)?.find(el => el.classList?.contains('ct-row'))
  if (!row) return null
  const ti = [...scroller.value.querySelectorAll('.ct-row')].indexOf(row)
  const track = props.doc.tracks[ti]
  return track && track.kind === kind ? track.id : null
}
let drag = null
function startDrag(e, track, item) {
  if (e.button !== 0) return
  emit('select', { id: item.id, add: e.shiftKey || e.ctrlKey || e.metaKey })
  drag = { id: item.id, kind: track.kind, from: track.id, x0: e.clientX, start0: item.start_ms, len: tl.clipLength(item), moved: false }
  e.currentTarget.setPointerCapture?.(e.pointerId)
  e.currentTarget.addEventListener('pointermove', onDrag)
  e.currentTarget.addEventListener('pointerup', endDrag, { once: true })
}
function onDrag(e) {
  if (!drag) return
  const dx = e.clientX - drag.x0
  if (!drag.moved && Math.abs(dx) < 4) return
  drag.moved = true
  let start = drag.start0 + msAt(dx)
  // Snap whichever edge lands nearer a snap point.
  const a = snapped(start, [drag.id]), b = snapped(start + drag.len, [drag.id]) - drag.len
  start = Math.abs(a - start) <= Math.abs(b - start) ? a : b
  e.currentTarget.style.transform = `translateX(${px(Math.max(0, start)) - px(drag.start0)}px)`
  drag.start = Math.max(0, start)
}
function endDrag(e) {
  e.currentTarget.removeEventListener('pointermove', onDrag)
  e.currentTarget.style.transform = ''
  if (drag?.moved) {
    const to = trackUnder(e, drag.kind)
    emit('move', { id: drag.id, start: drag.start ?? drag.start0, track: to && to !== drag.from ? to : null })
  }
  drag = null
}
let trim = null
function startTrim(e, item, edge) {
  emit('select', { id: item.id })
  trim = { id: item.id, edge, x0: e.clientX, at0: edge === 'start' ? item.start_ms : end(item) }
  const el = e.currentTarget
  el.setPointerCapture?.(e.pointerId)
  const move = ev => { if (trim) trim.at = snapped(trim.at0 + msAt(ev.clientX - trim.x0), [item.id]) }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', () => {
    el.removeEventListener('pointermove', move)
    if (trim?.at != null && trim.at !== trim.at0) emit('trim', { id: trim.id, edge: trim.edge, at: trim.at })
    trim = null
  }, { once: true })
}
defineExpose({ focusItem })
</script>
<style scoped>
.ct{display:grid;gap:6px;min-width:0}
.ct-scroll{position:relative;overflow-x:auto;overflow-y:auto;max-height:340px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-bg);overscroll-behavior-x:contain}
.ct-body{position:relative;padding-bottom:6px}
.ct-ruler{position:relative;height:24px;border-bottom:1px solid var(--vm-line-2);cursor:pointer}
.ct-tick{position:absolute;top:4px;font-size:10px;color:var(--vm-ink-faint);transform:translateX(2px);padding-left:3px;border-left:1px solid var(--vm-line)}
.ct-playhead{position:absolute;top:0;bottom:0;width:2px;background:var(--vs-accent-ink);z-index:3;pointer-events:none}
.ct-row{display:flex;min-height:52px;border-bottom:1px solid var(--vm-line-2)}
.ct-row.ct-text,.ct-row.ct-audio{min-height:40px}
.ct-head{position:sticky;left:0;z-index:4;display:flex;align-items:center;gap:2px;width:92px;flex:none;padding:0 4px 0 8px;background:var(--vm-surface);border-right:1px solid var(--vm-line-2)}
.ct-name{flex:1;min-width:0;font-size:11px;color:var(--vm-ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ct-icon{display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:4px;background:none;color:var(--vm-ink-faint);cursor:pointer}
.ct-icon[aria-pressed="true"]{color:var(--vs-warn-ink)}.ct-icon:hover{background:var(--vm-surface-2)}
.ct-icon svg,.ct-transition svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ct-lane{position:relative;flex:none;cursor:crosshair}
.ct-off .ct-lane{opacity:.45}
.ct-item{position:absolute;top:5px;bottom:5px;display:flex;align-items:flex-end;overflow:hidden;border:1px solid #5f819d;border-radius:5px;background:#2e4c65;color:var(--vm-ink);cursor:grab;touch-action:none;user-select:none}
.ct-text .ct-item{background:#4a3f6b;border-color:#7d70a8}
.ct-audio .ct-item{background:#2c4d43;border-color:#5a9483}
.ct-item.on{border-color:var(--vs-accent-ink);box-shadow:inset 0 0 0 1px var(--vs-accent-ink)}
.ct-item:focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:1px}
.ct-strip{position:absolute;inset:0;background-repeat:repeat-x;opacity:.7}
.ct-wave{position:absolute;inset:4px 0;width:100%;height:calc(100% - 8px)}.ct-wave path{stroke:#9fe3cc;stroke-width:1;vector-effect:non-scaling-stroke}
.ct-title{position:relative;z-index:1;max-width:100%;padding:2px 10px;font-size:11px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:linear-gradient(transparent,rgba(0,0,0,.55))}
.ct-handle{position:absolute;top:0;bottom:0;z-index:2;width:8px;cursor:ew-resize;background:rgba(255,255,255,.08)}
.ct-handle.start{left:0}.ct-handle.end{right:0}.ct-item.on .ct-handle{background:var(--vs-accent-ink)}
.ct-handle:focus-visible{outline:2px solid #fff}
.ct-transition{position:absolute;top:50%;z-index:2;display:flex;justify-content:center;transform:translateY(-50%);pointer-events:none}
.ct-transition button{pointer-events:auto;display:grid;place-items:center;width:24px;height:24px;padding:0;border:1px solid var(--vm-line);border-radius:5px;background:var(--vm-surface);color:var(--vm-ink);cursor:pointer}
.ct-transition.on button{border-color:var(--vs-accent-ink);color:var(--vs-accent-ink)}
.ct-seek{padding:0 2px}.ct-slider{width:100%;accent-color:var(--vm-primary);min-height:24px}
@media (max-width:767px){
  .ct-scroll{max-height:220px}
  .ct-head{width:64px;padding-left:4px}.ct-name{font-size:10px}
  .ct-icon{width:28px;height:28px}
  .ct-row{min-height:56px}.ct-row.ct-text,.ct-row.ct-audio{min-height:48px}
  .ct-handle{width:14px}
  .ct-transition button{width:32px;height:32px}
  .ct-slider{min-height:44px}
}
@media (prefers-reduced-motion:reduce){.ct-scroll{scroll-behavior:auto}}
</style>
