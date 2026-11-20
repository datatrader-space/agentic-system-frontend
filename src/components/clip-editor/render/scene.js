// What the monitor draws at one time (plan P1, contract sections 1 to 5, ADM-1199): a pure description built from the
// timeline document, so it can be tested without WebGL. The compositor (compositor.js) draws exactly this.
//
// It follows the export's graph (video_studio/services/compositor.py _video_graph): a canvas background; then each
// video track, bottom first; on a track, each run of clips joined by transitions is one layer, where every clip is
// drawn on a full-canvas picture and the run's clips are mixed by xfade; the layer goes over what is below with its
// blend mode. Text is drawn last, over everything (libass, render/assScript.js).

import { evaluate } from '../keyframes'
import { sourceTimeAt } from '../speedCurve'
import { TRANSITIONS, clipLength, isTimed, itemEnd, shown as trackShown } from '../timelineModel'
import { hexToRgba } from './effectParams'

// Version 2 names (contract section 1).
const OLD_TRANSITION = { wipe: 'wipe_left', slide: 'slide_left' }
const DEFAULT_TRANSFORM = { x: 0.5, y: 0.5, scale: 1, rotation: 0, flip_x: false, flip_y: false, opacity: 1 }


// The canvas background as {kind, ...}; a version 2 '#RRGGBB' string reads as a colour.
export function background(doc) {
  const bg = doc?.canvas?.background
  if (typeof bg === 'string' || bg == null) return { kind: 'color', rgba: hexToRgba(bg || '#000000') }
  if (bg.kind === 'blur') return { kind: 'blur', strength: Math.min(Math.max(Math.round(bg.strength || 2), 1), 4) }
  if (bg.kind === 'image' && bg.media) return { kind: 'image', media: bg.media }
  return { kind: 'color', rgba: hexToRgba(bg.color || '#000000') }
}


// The value of an animatable param: its keyframes at the item-relative time, else its static value.
function animated(item, path, rel, fallback) {
  const keys = item.keyframes?.[path]
  return Array.isArray(keys) && keys.length ? evaluate(keys, rel) : fallback
}

// A clip's state at timeline time t: where its picture comes from and how it is drawn.
export function clipState(item, track, t, { rate = 30, media = {}, blurBg = 0, compounds = {}, prefix = '', depth = 0, shown = trackShown } = {}) {
  const rel = t - item.start_ms
  const base = { ...DEFAULT_TRANSFORM, ...(item.transform || {}) }
  const transform = {}
  for (const k of ['x', 'y', 'scale', 'rotation', 'opacity']) transform[k] = animated(item, `transform.${k}`, rel, base[k])
  transform.flip_x = !!base.flip_x
  transform.flip_y = !!base.flip_y
  // A keyframed crop is stretched to the box its FIRST frame fits to (compositor._fixed_box).
  let crop = null, crop0 = null
  const cropKeyed = ['x', 'y', 'w', 'h'].some(k => item.keyframes?.[`crop.${k}`]?.length)
  if (item.crop || cropKeyed) {
    const c = { x: 0, y: 0, w: 1, h: 1, ...(item.crop || {}) }
    crop = ['x', 'y', 'w', 'h'].map(k => animated(item, `crop.${k}`, rel, c[k]))
    if (cropKeyed) crop0 = ['x', 'y', 'w', 'h'].map(k => animated(item, `crop.${k}`, 0, c[k]))
  }
  const info = media[item.media] || {}
  const still = item.freeze_at_ms == null && item.hold_ms != null
  const src = sourceTimeAt(item, t)
  // A compound clip shows its compound's own tracks at the compound time its source range gives (PROVISIONAL until
  // the export's builder draws compounds: a transparent canvas-sized picture of them, then this clip's effects and
  // transform as for any clip). Nested ids are prefixed by the clip's, so every use has its own elements.
  let kind = still ? 'image' : 'video', sub = null
  if (item.compound) {
    kind = 'compound'
    const c = compounds?.[item.compound]
    if (c && depth < 8) {
      sub = frameAt({ rate, canvas: { background: { kind: 'color', color: '#00000000' } }, compounds, tracks: c.tracks || [] }, src.ms,
        { rate, media, prefix: `${prefix}${item.id}/`, depth: depth + 1, shown })
    }
  }
  const effects = (item.effects || []).filter(e => e && e.enabled !== false).map(e => {
    // fx.<effect id>.<param>, or fx.<effect id>.<colour>.<h|s|l> for HSL (editor_filters.fx_hsl).
    const params = JSON.parse(JSON.stringify(e.params || {}))
    const prefix = `fx.${e.id}.`
    for (const [path, keys] of Object.entries(item.keyframes || {})) {
      if (!path.startsWith(prefix) || !Array.isArray(keys) || !keys.length) continue
      const parts = path.slice(prefix.length).split('.')
      let at = params
      for (const k of parts.slice(0, -1)) { if (typeof at[k] !== 'object' || at[k] === null) at[k] = {}; at = at[k] }
      at[parts[parts.length - 1]] = evaluate(keys, rel)
    }
    return { id: e.id, kind: e.kind, params }
  })
  return {
    id: prefix + item.id, track: track.id, media: item.media, kind, mediaType: info.media_type || (still ? 'image' : 'video'), sub,
    sourceMs: src.ms, speed: src.speed, sourceIn: item.source_in_ms || 0, sourceOut: item.source_out_ms || 0,
    reverse: !!item.reverse, freeze: item.freeze_at_ms != null,
    fit: item.fit === 'cover' ? 'cover' : 'contain', crop, cropKeyed, crop0, transform, effects, blend: item.blend || 'normal',
    zoom: !!item.zoom && still, frameIndex: Math.max(0, Math.round(rel * rate / 1000)), lengthMs: clipLength(item, rate),
    blurBg,     // the canvas blur strength drawn behind this clip (main track only), 0 = none
  }
}

// A track's runs: clips joined by transitions (a clip with no transition into it starts a new run).
export function runsOf(track) {
  const into = new Map()
  for (const i of track.items) if (i.type === 'transition') into.set(i.between?.[1], i)
  const runs = []
  for (const c of track.items.filter(isTimed).sort((a, b) => a.start_ms - b.start_ms)) {
    const tr = into.get(c.id)
    if (runs.length && tr && tr.between?.[0] === runs[runs.length - 1][runs[runs.length - 1].length - 1].item.id) {
      runs[runs.length - 1].push({ item: c, transition: tr })
    } else runs.push([{ item: c, transition: null }])
  }
  return runs
}

// xfade's progress at time t for a transition into a clip that starts at `start` and lasts `ms`: 1 at its first
// frame (all the outgoing clip), falling to 0. vf_xfade.c computes it in float from whole time-base units after the
// export's fps filter (time base 1/rate): progress = 1 - (float)(frame - first frame) / duration in frames.
export function xfadeProgress(t, start, ms, rate = 30) {
  const n = Math.round(t * rate / 1000) - Math.round(start * rate / 1000)
  const d = Math.max(1, Math.round(ms * rate / 1000))
  const p = Math.fround(1 - Math.fround(Math.fround(n) / Math.fround(d)))
  return Math.min(Math.max(p, 0), 1)
}

// The layer tree of one run at time t, or null when nothing of it shows.
export function runNode(run, track, t, ctx) {
  const rate = ctx.rate || 30
  const active = run.filter(r => r.item.start_ms <= t && t < itemEnd(r.item, rate))
  if (!active.length) return null
  let node = { op: 'clip', clip: clipState(active[0].item, track, t, ctx) }
  for (let k = 1; k < active.length; k++) {
    const r = active[k]
    const kind = OLD_TRANSITION[r.transition.kind] || r.transition.kind
    node = { op: 'xfade', kind: TRANSITIONS.includes(kind) ? kind : 'crossfade', progress: xfadeProgress(t, r.item.start_ms, r.transition.ms, rate),
      a: node, b: { op: 'clip', clip: clipState(r.item, track, t, ctx) } }
  }
  return node
}

// The clips in a layer tree (for loading their pictures).
export function clipsOf(node, out = []) {
  if (!node) return out
  if (node.op === 'clip') {
    out.push(node.clip)
    for (const l of node.clip.sub?.layers || []) clipsOf(l.node, out)
  } else { clipsOf(node.a, out); clipsOf(node.b, out) }
  return out
}

// The whole frame at time t. With a blurred canvas background, every main-track clip carries its own blurred copy
// behind it (compositor._clip_layer), over a black canvas. `shown(track)` says whether a track is drawn (the editor
// passes timelineModel's, which knows hide and solo).
export function frameAt(doc, t, { rate = doc?.rate || 30, media = {}, prefix = '', depth = 0, shown = trackShown } = {}) {
  const bg = background(doc)
  const layers = []
  const videoTracks = (doc?.tracks || []).filter(tr => tr.kind === 'video')
  const main = videoTracks.find(tr => tr.main) || videoTracks[0] || null
  for (const track of videoTracks) {
    if (!shown(track)) continue
    const ctx = { rate, media, blurBg: bg.kind === 'blur' && track === main ? bg.strength : 0, compounds: doc?.compounds || {}, prefix, depth, shown }
    for (const run of runsOf(track)) {
      const node = runNode(run, track, t, ctx)
      // The run's blend mode is its first clip's (the export places and blends a run as one picture).
      if (node) layers.push({ track: track.id, node, blend: run[0].item.blend || 'normal' })
    }
  }
  return { t, rate, background: bg, layers }
}

