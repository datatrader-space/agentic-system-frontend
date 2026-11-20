<template>
  <!-- The monitor (plan P1, ADM-1199): every frame drawn by the WebGL compositor in the export's order, text by libass
       (JASSUB) with the export's fonts, sound through Web Audio. "Preview this part exactly" renders on the server. -->
  <section ref="root" class="cm" :class="{ full: isFull }" aria-label="Monitor">
    <div class="cm-frame">
      <div ref="box" class="cm-canvas" :style="{ aspectRatio: ratio, '--cm-r': ratioNumber }" @click="$emit('toggle')">
        <canvas ref="gl" class="cm-layer" aria-hidden="true" />
        <div ref="texts" class="cm-layer cm-texts" aria-hidden="true" />
        <svg v-if="guide" class="cm-layer cm-guide" :viewBox="`0 0 ${size.w} ${size.h}`" preserveAspectRatio="none" aria-hidden="true">
          <rect :x="guide.x * size.w" :y="guide.y * size.h" :width="guide.w * size.w" :height="guide.h * size.h" />
          <text :x="guide.x * size.w + 6" :y="guide.y * size.h + 16">{{ guide.label }}</text>
        </svg>
        <div ref="holder" class="cm-holder" aria-hidden="true" />
        <p v-if="!supported" class="cm-empty">This browser cannot draw the preview: WebGL 2 is turned off or missing. "Preview this part exactly" still works.</p>
        <p v-else-if="!total" class="cm-empty">Add a clip from your files to start.</p>
      </div>
    </div>
    <div class="cm-bar">
      <button type="button" class="cm-btn" :aria-label="playing ? 'Pause' : 'Play'" :data-tip="playing ? 'Pause (Space)' : 'Play (Space)'" @click="$emit('toggle')">
        <Pause v-if="playing" aria-hidden="true" /><Play v-else aria-hidden="true" />
      </button>
      <button type="button" class="cm-btn" aria-label="One frame back" data-tip="One frame back (Left arrow)" @click="$emit('seek', playhead - frame)"><StepBack aria-hidden="true" /></button>
      <button type="button" class="cm-btn" aria-label="One frame forward" data-tip="One frame forward (Right arrow)" @click="$emit('seek', playhead + frame)"><StepForward aria-hidden="true" /></button>
      <button type="button" class="cm-btn" aria-label="Loop" :aria-pressed="looping ? 'true' : 'false'" data-tip="Loop (Ctrl+L)" @click="$emit('toggle-loop')"><Repeat aria-hidden="true" /></button>
      <span class="cm-time" aria-live="off"><b>{{ tc(playhead) }}</b><span> / {{ tc(total) }}</span><em v-if="shuttle !== 1">{{ shuttle > 0 ? `${shuttle}x` : `${-shuttle}x back` }}</em></span>
      <div class="cm-meters" role="img" :aria-label="meterLabel" data-tip="Sound level, left and right">
        <span v-for="(m, i) in meters" :key="i" class="cm-meter" :class="{ clip: m.clipped }">
          <i class="rms" :style="{ width: `${m.rms * 100}%` }" /><i class="peak" :style="{ left: `${m.hold * 100}%` }" />
        </span>
      </div>
      <span class="cm-spacer" />
      <div class="cm-menu-wrap">
        <button ref="guideBtn" type="button" class="cm-btn" aria-label="Safe areas" :aria-pressed="safeArea ? 'true' : 'false'" aria-haspopup="menu"
                :aria-expanded="guideOpen ? 'true' : 'false'" data-tip="Safe areas" @click="guideOpen = !guideOpen"><Frame aria-hidden="true" /></button>
        <div v-if="guideOpen" ref="guideMenu" class="cm-menu" role="menu" aria-label="Safe areas" @keydown.esc.stop="closeGuide">
          <button v-for="o in guideOptions" :key="o.id" type="button" role="menuitemradio" :aria-checked="safeArea === o.id ? 'true' : 'false'" class="cm-menu-item" @click="pickGuide(o.id)">
            <Check class="cm-tick" :class="{ on: safeArea === o.id }" aria-hidden="true" />{{ o.label }}
          </button>
        </div>
      </div>
      <button type="button" class="cm-btn" :aria-label="isFull ? 'Exit full screen' : 'Full screen'" :data-tip="isFull ? 'Exit full screen (F)' : 'Full screen (F)'" @click="toggleFull">
        <Minimize v-if="isFull" aria-hidden="true" /><Maximize v-else aria-hidden="true" />
      </button>
      <button type="button" class="cm-btn cm-exact" :disabled="!total || previewBusy" :aria-busy="previewBusy ? 'true' : 'false'"
              aria-label="Preview this part exactly" :data-tip="previewBusy ? 'Rendering the part…' : 'Preview this part exactly (rendered like the export)'" @click="$emit('preview-exact')">
        <Clapperboard aria-hidden="true" />
      </button>
    </div>
    <p v-if="notes.length" class="cm-note" role="status">{{ notes.join(' ') }}</p>
  </section>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Check, Clapperboard, Frame, Maximize, Minimize, Pause, Play, Repeat, StepBack, StepForward } from 'lucide-vue-next'
import * as tl from './timelineModel'
import { frameAt, clipsOf } from './render/scene'
import { Compositor } from './render/compositor'
import { MediaSources } from './render/sources'
import { assScript } from './render/assScript'
import { SAFE_AREAS, safeBox } from './render/safeAreas'
import { sourceTimeAt, clipLength } from './speedCurve'
import { AudioGraph } from './audio/audioGraph'
import { audible, clipMix } from './audio/mixRules'
import { fill, holdPeak, FLOOR_DB } from './audio/meters'

const props = defineProps({
  doc: { type: Object, required: true }, playhead: { type: Number, default: 0 }, playing: Boolean,
  media: { type: Object, default: () => ({}) }, previewBusy: Boolean,
  // A platform's safe-area guide drawn over the picture (never exported): tiktok, reels, shorts, youtube, or ''.
  safeArea: { type: String, default: '' },
  // The editor's role mute/solo state: {dialogue: {mute, solo}, music: ..., effects: ...}.
  roles: { type: Object, default: () => ({}) },
  // The editor's playback state: rate (1 normal; 2, 4, 8 faster; negative backwards) and loop.
  playback: { type: Object, default: () => ({ rate: 1, loop: false }) },
})
const emit = defineEmits(['tick', 'toggle', 'seek', 'preview-exact', 'toggle-loop', 'update:safeArea'])
const rate = computed(() => props.doc.rate || 30)
const frame = computed(() => 1000 / rate.value)
const total = computed(() => tl.totalMs(props.doc))
const shuttle = computed(() => (Number.isFinite(props.playback?.rate) && props.playback.rate !== 0 ? props.playback.rate : 1))
const looping = computed(() => !!props.playback?.loop)
const tc = ms => tl.timecode(ms, rate.value)
const ratio = computed(() => props.doc.canvas.aspect.replace(':', ' / '))
const ratioNumber = computed(() => { const [w, h] = props.doc.canvas.aspect.split(':').map(Number); return w / h })
// The export's canvas at 1080p (compositor.canvas_size): text scripts are written for it, as the export writes them.
const exportSize = computed(() => {
  const [aw, ah] = props.doc.canvas.aspect.split(':').map(Number)
  const even = n => Math.max(2, Math.trunc(n / 2) * 2)
  return aw >= ah ? { w: even(1080 * aw / ah), h: 1080 } : { w: 1080, h: even(1080 * ah / aw) }
})
const guide = computed(() => safeBox(props.safeArea))
const guideOptions = [{ id: '', label: 'Off' }, ...Object.entries(SAFE_AREAS).map(([id, a]) => ({ id, label: a.label }))]
// The timeline model's track rules: what is drawn (hide) and heard (mute, solo).
const shown = tl.shown
const mixCtx = () => ({ tracks: props.doc.tracks, roles: props.roles, rate: rate.value })

const root = ref(null), gl = ref(null), box = ref(null), texts = ref(null), holder = ref(null), guideBtn = ref(null), guideMenu = ref(null)
const supported = ref(true)
const size = reactive({ w: 16, h: 9 })
const behind = ref(false)
const isFull = ref(false)
const guideOpen = ref(false)
const meters = ref([{ rms: 0, hold: 0, clipped: false }, { rms: 0, hold: 0, clipped: false }])
const meterLabel = computed(() => `Sound level: left ${Math.round(FLOOR_DB * (1 - meters.value[0].hold))} dB, right ${Math.round(FLOOR_DB * (1 - meters.value[1].hold))} dB`)
const textNotes = ref([])
const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

let comp = null, sources = null
const audio = new AudioGraph()
const textRenderers = new Map()   // text track id -> TextRenderer

// ── controls ────────────────────────────────────────────────────────────────────────────────────────────────────
function pickGuide(id) { emit('update:safeArea', id); closeGuide() }
function closeGuide() { guideOpen.value = false; nextTick(() => guideBtn.value?.focus()) }
watch(guideOpen, open => { if (open) nextTick(() => guideMenu.value?.querySelector('[aria-checked="true"]')?.focus()) })
function outside(e) { if (guideOpen.value && !e.target.closest?.('.cm-menu-wrap')) guideOpen.value = false }
function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  else root.value?.requestFullscreen?.().catch(() => {})
}
const onFull = () => { isFull.value = document.fullscreenElement === root.value; queueMicrotask(measure) }

// ── where each clip's picture and sound come from ───────────────────────────────────────────────────────────────
// Every address here is same-origin (the editor media view's preview_url, path, reversed_url, matte_url), so a
// picture can become a WebGL texture and a sound can go through Web Audio without CORS. `url` (which may be another
// origin) is never used for drawing.
function resolve(clip) {
  const m = props.media[clip.media]
  if (!m) return null
  if (clip.kind === 'audio') { const url = m.preview_url || m.path; return url ? { url, kind: m.media_type === 'video' ? 'video' : 'audio' } : null }
  if (clip.kind === 'image' || m.media_type === 'image') return m.path ? { url: m.path, kind: 'image' } : null
  // A reversed clip plays the derived reversed copy (contract section 7) when there is one: the source range [in, out)
  // is [D - out, D - in) of that file (editor_export).
  if (clip.reverse && m.reversed_url && m.duration_ms) return { url: m.reversed_url, kind: 'video', map: ms => Math.max(m.duration_ms - clip.sourceOut, 0) + (ms - clip.sourceIn) }
  const url = m.preview_url || m.path
  return url ? { url, kind: 'video' } : null
}
const fileUrl = id => props.media[id]?.path || null
// A LUT: a platform look (`look:<name>`, the registry's lut_looks) is the frontend's copy of the export's own file
// (public/luts/editor/<name>.cube, the same bytes as video_studio/editor_luts/); the person's own .cube is its path.
const lutUrl = id => (typeof id === 'string' && id.startsWith('look:') ? `/luts/editor/${id.slice(5)}.cube` : fileUrl(id))
const inside = (item, t) => item.type !== 'transition' && item.media && item.start_ms <= t && t < item.start_ms + clipLength(item, rate.value)

// The audio-track clips heard now, with the times their elements should be at.
function soundRows(t) {
  const out = []
  for (const track of props.doc.tracks) {
    if (track.kind !== 'audio') continue
    for (const item of track.items) if (inside(item, t)) { const s = sourceTimeAt(item, t); out.push({ item, track, sourceMs: s.ms, speed: s.speed }) }
  }
  return out
}
// Every clip that sounds (video clips' own sound and audio clips), for the mix.
const mixRows = t => props.doc.tracks.filter(tr => tr.kind !== 'text').flatMap(track => track.items.filter(i => inside(i, t)).map(item => ({ item, track })))

// ── drawing ─────────────────────────────────────────────────────────────────────────────────────────────────────
let tick = 0
function draw(t) {
  if (!comp?.supported) return
  tick++
  const f = frameAt(props.doc, t, { rate: rate.value, media: props.media, shown })
  const forward = props.playing && shuttle.value > 0
  sources.sync(f.layers.flatMap(l => clipsOf(l.node)), soundRows(t), { playing: props.playing, frameMs: frame.value, tick, rate: shuttle.value })
  const mix = mixRows(t)
  const ctx = mixCtx()
  if (audio.running) audio.update(forward ? mix : [], t, ctx)
  else for (const { item, track } of mix) {
    // Without Web Audio the elements play their own sound: level and mute only.
    const el = sources.element(item.id)
    if (!el) continue
    const m = clipMix(item, track, t, ctx)
    el.muted = !forward || !m.on || m.gain === 0
    el.volume = Math.min(1, m.gain)
  }
  comp.render(f, sources)
  drawText(t)
  readMeters()
}
let heldPeaks = [null, null], meterTime = 0
function readMeters() {
  const m = audio.meters()
  if (!m) return
  const now = performance.now(), dt = meterTime ? now - meterTime : 0
  meterTime = now
  meters.value = [m.left, m.right].map((ch, i) => {
    heldPeaks[i] = holdPeak(heldPeaks[i], ch.peakDb, dt)
    return { rms: fill(ch.rmsDb), hold: fill(heldPeaks[i].db), clipped: ch.clipped }
  })
}

// Text: one libass renderer per text track, stacked in track order, each drawing that track's script.
let textModule = null
async function drawText(t) {
  const tracks = props.doc.tracks.filter(tr => tr.kind === 'text' && shown(tr) && tr.items.some(i => i.type === 'text'))
  if (!tracks.length && !textRenderers.size) return
  textModule ||= import('./render/textRenderer')
  const { TextRenderer, textSupported } = await textModule
  if (!textSupported()) { textNotes.value = ['Text shows in the export only: this browser cannot run the text renderer.']; return }
  for (const [id, r] of textRenderers) if (!tracks.some(tr => tr.id === id)) { r.destroy(); r.canvas.remove(); textRenderers.delete(id) }
  for (const track of tracks) {
    const script = assScript(props.doc, track, exportSize.value.w, exportSize.value.h)
    let r = textRenderers.get(track.id)
    if (!r) {
      const c = document.createElement('canvas')
      c.className = 'cm-text-layer'
      texts.value?.appendChild(c)
      r = new TextRenderer(c)
      textRenderers.set(track.id, r)
      r.start(script, size.w, size.h).catch(() => { textNotes.value = ['Text could not be drawn here; the export still has it.'] })
    }
    r.ready?.then(() => r.setScript(script)).then(() => r.draw(t, size.w, size.h, !props.playing)).catch(() => {})
  }
}

// ── the clock: the AudioContext's while sound plays, else the page's; times the shuttle rate ───────────────────
// The monitor reports the time it has played to (`tick`); the editor decides where playback ends, loops or plays a
// range (useClipEditor.tick). When the editor moves the playhead itself (a loop, a range), the clock starts again there.
let raf = 0, startClock = 0, startHead = 0, lastFrame = 0, slow = 0, good = 0
let sent = []      // the last times reported: a playhead that is none of them was moved by the editor
function anchor() { startClock = audio.clock(); startHead = props.playhead; sent = [props.playhead] }
function loop() {
  if (!props.playing) return
  if (!sent.some(x => Math.abs(props.playhead - x) <= 1)) anchor()
  const t = startHead + (audio.clock() - startClock) * shuttle.value
  sent = [...sent.slice(-7), t]
  emit('tick', t)
  draw(Math.min(Math.max(t, 0), total.value))
  // Falling behind: frames drawn or decoded late for a while → effects simplified in the preview only.
  const wall = performance.now()
  if (lastFrame) {
    const late = wall - lastFrame > frame.value * 1.75 || sources.lateness() > 0.25
    slow = late ? slow + 1 : Math.max(0, slow - 1)
    good = late ? 0 : good + 1
    if (slow > 12) behind.value = true
    if (behind.value && good > rate.value * 3) { behind.value = false; slow = 0 }
    comp.simplify = behind.value
  }
  lastFrame = wall
  raf = requestAnimationFrame(loop)
}
watch(() => props.playing, on => {
  cancelAnimationFrame(raf)
  lastFrame = 0
  if (!comp) return
  if (on) {
    if (audio.start()) for (const [key, e] of sources.els) audio.attach(key, e.el)
    anchor()
    comp.exact = false
    raf = requestAnimationFrame(loop)
  } else {
    audio.suspend()
    behind.value = false
    comp.simplify = false
    settleAndDraw()
  }
})
// A new shuttle rate while playing continues from where the picture is.
watch(shuttle, () => { if (props.playing) anchor() })
// A paused frame is drawn at once, then again when every clip shows its exact frame.
let settleSeq = 0
async function settleAndDraw() {
  if (props.playing || !comp) return
  const seq = ++settleSeq
  comp.exact = true
  draw(props.playhead)
  const f = frameAt(props.doc, props.playhead, { rate: rate.value, media: props.media, shown })
  await sources.settled(f.layers.flatMap(l => clipsOf(l.node)))
  if (seq === settleSeq && !props.playing) draw(props.playhead)
}
watch(() => props.playhead, () => { if (!props.playing) settleAndDraw() })
watch(() => [props.doc, props.media, props.roles], () => { if (!props.playing) settleAndDraw() })

// ── size: drawn at its displayed size in device pixels, at most the export's ──────────────────────────────────
let ro = null
function measure() {
  const el = box.value
  if (!el || !comp) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const r = el.getBoundingClientRect()
  const w = Math.min(Math.max(2, Math.round(r.width * dpr)), exportSize.value.w)
  size.w = w; size.h = Math.max(2, Math.round(w / ratioNumber.value))
  comp.resize(size.w, size.h)
  if (!props.playing) settleAndDraw()
}

onMounted(() => {
  comp = new Compositor(gl.value)
  supported.value = comp.supported
  comp.reducedMotion = reduced
  sources = new MediaSources({
    resolve, imageUrl: fileUrl, lutUrl, matteUrl: clip => props.media[clip.media]?.matte_url || null,
    holder: holder.value, onChange: () => { if (!props.playing) settleAndDraw() },
    onCreate: (key, el) => { if (audio.ctx) audio.attach(key, el) },
  })
  sources.onDrop = key => audio.detach(key)
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(measure); ro.observe(box.value) }
  document.addEventListener('fullscreenchange', onFull)
  document.addEventListener('pointerdown', outside)
  measure()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  document.removeEventListener('fullscreenchange', onFull)
  document.removeEventListener('pointerdown', outside)
  for (const r of textRenderers.values()) r.destroy()
  sources?.dispose(); comp?.dispose(); audio.dispose()
})

// What the preview cannot show exactly, said plainly (the export is never affected).
const notes = computed(() => {
  const out = []
  if (behind.value) out.push('Playback is falling behind: blur and some transitions are simplified in this preview. The export is not affected.')
  if (props.playing && shuttle.value < 0) out.push('Playing backwards: sound is off.')
  const ctx = mixCtx()
  const heard = props.doc.tracks.flatMap(t => (t.kind === 'text' ? [] : t.items.filter(i => i.type !== 'transition' && audible(i, t, ctx))))
  if (heard.some(i => i.denoise > 0)) out.push('Noise reduction is heard in the export only.')
  if (heard.some(i => i.voice_enhance)) out.push('Voice enhance sounds close to the export here, not exact.')
  if (heard.some(i => i.reverse && !props.media[i.media]?.reversed_url)) out.push('A reversed clip plays forwards until its reversed copy is ready.')
  return [...out, ...textNotes.value]
})
defineExpose({ toggleFull })
</script>
<style scoped>
.cm{display:grid;gap:8px;min-width:0}
.cm.full{padding:16px;background:#000;align-content:center}
.cm-frame{display:grid;place-items:center;min-height:0;padding:10px;border:1px solid var(--vm-line);border-radius:8px;background:#000}
.cm-canvas{position:relative;width:min(100%,calc(min(52vh,520px) * var(--cm-r)));overflow:hidden;cursor:pointer;background:#000}
.cm.full .cm-canvas{width:min(100%,calc(82vh * var(--cm-r)))}
.cm-layer{position:absolute;inset:0;width:100%;height:100%}
.cm-texts{pointer-events:none}
.cm-texts :deep(.cm-text-layer){position:absolute;inset:0;width:100%;height:100%}
.cm-guide{pointer-events:none}
.cm-guide rect{fill:none;stroke:rgba(255,255,255,.85);stroke-width:1.5;stroke-dasharray:6 4;vector-effect:non-scaling-stroke}
.cm-guide text{fill:#fff;font:500 12px var(--vm-font-sans);paint-order:stroke;stroke:rgba(0,0,0,.6);stroke-width:3px}
.cm-holder{position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none}
.cm-holder :deep(video){width:1px;height:1px}
.cm-empty{position:absolute;inset:0;display:grid;place-items:center;padding:16px;color:#a7b5cb;font-size:13px;text-align:center}
.cm-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cm-spacer{flex:1 1 auto}
/* Icon buttons: 36 px (44 on phones), a visible focus ring, the name and shortcut as a tooltip on hover and focus. */
.cm-btn{position:relative;display:grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface);color:var(--vm-ink);cursor:pointer}
.cm-btn:hover{background:var(--vm-surface-2)}
.cm-btn:focus-visible{outline:2px solid var(--vm-focus);outline-offset:2px}
.cm-btn:disabled{cursor:not-allowed;opacity:.5}
.cm-btn[aria-pressed="true"]{border-color:var(--vm-violet);color:var(--vm-violet-ink);background:var(--vm-violet-soft)}
.cm-btn[aria-busy="true"]{opacity:.7}
.cm-btn svg{width:18px;height:18px}
[data-tip]{position:relative}
[data-tip]::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;translate:-50% 0;z-index:30;padding:4px 8px;border-radius:5px;background:var(--vm-ink);color:var(--vm-surface);font:500 12px/1.3 var(--vm-font-sans);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .12s}
[data-tip]:hover::after,[data-tip]:focus-visible::after{opacity:1}
.cm-exact[data-tip]::after{left:auto;right:0;translate:none}
.cm-time{font-variant-numeric:tabular-nums;font-size:13px;color:var(--vm-ink-soft)}.cm-time b{color:var(--vm-ink);font-weight:500}
.cm-time em{margin-left:6px;font-style:normal;color:var(--vm-violet-ink)}
/* Two meters, left over right, -60..0 dBFS: the bar is the average (RMS) level, the tick the held peak. */
.cm-meters{display:grid;gap:3px;width:96px;margin-left:8px}
.cm-meter{position:relative;height:5px;border-radius:2px;background:var(--vm-surface-2);overflow:hidden}
.cm-meter .rms{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,var(--vm-green-ink) 0 70%,var(--vm-amber-ink) 70% 90%,var(--vm-red-ink) 90%) 0 0/96px 100% no-repeat}
.cm-meter .peak{position:absolute;top:0;bottom:0;width:2px;margin-left:-2px;background:var(--vm-ink)}
.cm-meter.clip{box-shadow:inset 0 0 0 1px var(--vm-danger)}
.cm-menu-wrap{position:relative}
.cm-menu{position:absolute;right:0;bottom:calc(100% + 6px);z-index:40;display:grid;min-width:140px;padding:4px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface);box-shadow:var(--vm-shadow-s)}
.cm-menu-item{display:flex;align-items:center;gap:8px;min-height:32px;padding:4px 10px;border:0;border-radius:5px;background:none;color:var(--vm-ink);font:inherit;font-size:13px;text-align:left;cursor:pointer}
.cm-menu-item:hover{background:var(--vm-surface-2)}
.cm-menu-item:focus-visible{outline:2px solid var(--vm-focus);outline-offset:-2px}
.cm-tick{width:14px;height:14px;opacity:0}.cm-tick.on{opacity:1}
.cm-note{margin:0;font-size:12px;color:var(--vm-ink-soft)}
@media (max-width:767px){.cm-canvas{width:min(100%,calc(36vh * var(--cm-r)))}.cm-btn{width:44px;height:44px}.cm-meters{display:none}.cm-menu-item{min-height:44px}}
@media (prefers-reduced-motion:reduce){[data-tip]::after{transition:none}}
</style>
