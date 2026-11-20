// The clip editor's timeline model (agentic-docs/VIDEO_EDITOR_PRO_CONTRACT.md sections 1, 2 and 6; ADM-1199): the
// server's format version 3, and every edit as a list of operations with their inverse (undo and redo are patches,
// never snapshots). Pure functions only: no Vue, no network. The server checks every save with the same rules
// (video_studio/services/timeline.py); the checks here stop an edit the server would refuse.
//
// Time is whole milliseconds on the frame grid (contract section 2). Items on a track are placed by start_ms; they may
// not overlap except two neighbouring clips across a transition, which overlaps both by exactly its length. With the
// magnet on, the main track's clips are contiguous from 0; connected clips (an `anchor`) follow their main-track parent.
//
// Every public edit returns operations for `applyOps` that already include the editor rules (`finish`): the magnet
// ripple of the main track, connected clips following their parent, and keyframes kept inside their clip.

import * as sc from './speedCurve'
import { evaluate } from './keyframes'

export const VERSION = 3
export const ASPECTS = ['16:9', '9:16', '1:1', '4:5']
export const RATES = [24, 25, 30, 60]
export const TRANSITIONS = ['crossfade', 'dissolve', 'fade_black', 'fade_white', 'wipe_left', 'wipe_right', 'wipe_up', 'wipe_down',
  'slide_left', 'slide_right', 'slide_up', 'slide_down', 'smooth_left', 'smooth_right', 'circle_open', 'circle_close', 'radial',
  'pixelize', 'zoom_in', 'blur']
export const TRANSITION_MS = [100, 2000]
export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'add', 'difference']
export const ROLES = ['dialogue', 'music', 'effects']
export const EFFECT_KINDS = ['adjust', 'curves', 'hsl', 'lut', 'blur', 'sharpen', 'vignette', 'mask', 'chroma_key', 'bg_removal']
export const EASES = ['linear', 'ease_in', 'ease_out', 'ease_in_out', 'hold', 'bezier']
export const MARKER_COLORS = ['#F2B341', '#E5484D', '#46A758', '#3E9BFF', '#A06BFF', '#E8E8E8']
export const LIMITS = { markers: 64, compounds: 8, effects: 20, keyframes: 200, markerName: 80, compoundName: 60, trackName: 40, trackHeight: [32, 160] }
export const MIN_ITEM_MS = 40
// The groups "Paste attributes" offers (contract 6 `pasteAttributesOps`). Keyframes travel with their group.
export const ATTRIBUTE_GROUPS = {
  transform: { label: 'Position, size, rotation and opacity', fields: ['transform'], keys: /^transform\./, on: 'picture' },
  crop: { label: 'Crop', fields: ['crop'], keys: /^crop\./, on: 'picture' },
  blend: { label: 'Blend mode', fields: ['blend'], keys: null, on: 'picture' },
  effects: { label: 'Colour and effects', fields: ['effects'], keys: /^fx\./, on: 'picture' },
  speed: { label: 'Speed', fields: ['speed', 'speed_curve', 'keep_pitch'], keys: null, on: 'source' },
  audio: { label: 'Sound: volume, pan, EQ, noise, voice', fields: ['volume_db', 'pan', 'eq', 'denoise', 'voice_enhance'], keys: /^(volume_db|pan)$/, on: 'sound' },
  fades: { label: 'Fades', fields: ['fade_in_ms', 'fade_out_ms'], keys: null, on: 'clip' },
  text: { label: 'Text style and position', fields: ['style', 'x', 'y'], keys: /^(x|y|opacity)$/, on: 'text' },
}
const DEFAULT_TRANSFORM = { x: 0.5, y: 0.5, scale: 1, opacity: 1 }
const LEGACY_FLAG = { mute: 'muted', hide: 'hidden' }

export function newDoc(aspect = '16:9', rate = 30) {
  return { version: VERSION, rate: RATES.includes(rate) ? rate : 30,
    canvas: { aspect: ASPECTS.includes(aspect) ? aspect : '16:9', background: { kind: 'color', color: '#000000' } },
    settings: { magnet: true },
    tracks: [{ id: 'v1', kind: 'video', main: true, items: [] }, { id: 't1', kind: 'text', captions: true, items: [] }, { id: 'a1', kind: 'audio', items: [] }] }
}

// ── the frame grid (contract 2) ───────────────────────────────────────────────────────────────────────────────────
// Frame n is at F(n) = floor(n * 1000 / rate + 0.5); a time's frame is round half up of ms * rate / 1000. The one copy
// of this arithmetic is speedCurve.js (the same plain floors as the server's timeline.py, pinned by editor_cases/grid.json).
const R = doc => doc?.rate || 30
export function frameOf(ms, rate = 30) { return sc.frameOf(ms, rate) }
export function frameTime(n, rate = 30) { return sc.frameAt(n, rate) }
// snap(ms) = F(round(ms * rate / 1000)), round half up.
export function snap(ms, rate = 30) { return sc.snapMs(ms, rate) }
export const onGrid = (ms, rate = 30) => Number.isInteger(ms) && snap(ms, rate) === ms
export function frameMs(rate) { return 1000 / (rate || 30) }
// A time on the grid, never before 0 (what the ruler, the playhead and typed times use).
export function toFrame(ms, rate) { return Math.max(0, snap(Number(ms) || 0, rate || 30)) }
const gridCeil = (ms, rate) => { const s = snap(ms, rate); return s >= ms - 1e-9 ? s : frameTime(frameOf(s, rate) + 1, rate) }
const gridFloor = (ms, rate) => { const s = snap(ms, rate); return s <= ms + 1e-9 ? s : frameTime(frameOf(s, rate) - 1, rate) }
// The shortest whole-millisecond run of frames (3 frames at 24, 30 and 60 fps; 1 at 25). A transition is a multiple of
// it, so a clip that starts on the grid and overlaps its neighbour by the transition still starts on the grid.
export function gridPeriod(rate = 30) { return (rate / gcd(rate, 1000)) * 1000 / rate }
function gcd(a, b) { return b ? gcd(b, a % b) : a }
export function transitionMs(ms, rate = 30) {
  const p = gridPeriod(rate), lo = Math.ceil(TRANSITION_MS[0] / p) * p, hi = Math.floor(TRANSITION_MS[1] / p) * p
  return Math.min(Math.max(Math.round(ms / p) * p, lo), hi)
}
const minLenMs = rate => Math.max(MIN_ITEM_MS, Math.ceil(frameMs(rate)))

// ── reading ─────────────────────────────────────────────────────────────────────────────────────────────────────
// A clip's raw length: its source range over its speed, or the speed curve's exact integral (contract 5; speedCurve.js).
export const rawLength = sc.rawLength
// Source milliseconds a timeline millisecond plays, on average (exact for a constant speed). The share of the source
// range a speed curve spans stays the same when the range changes, so this ratio holds through a trim.
const effSpeed = item => { const raw = rawLength(item); return raw > 0 ? ((item.source_out_ms - item.source_in_ms) / raw) : (item.speed || 1) }
// Where an item ends, in whole frames: F(frame(start) + L) (contract 2, the 2026-11-19 correction; speedCurve.clipEnd).
export function itemEnd(item, rate = 30) { return sc.clipEnd(item, rate || 30) }
export function clipLength(item, rate = 30) { return itemEnd(item, rate) - item.start_ms }
export const isTimed = item => item && item.type !== 'transition'
export function totalMs(doc) {
  let end = 0
  for (const t of doc?.tracks || []) for (const i of t.items) if (isTimed(i)) end = Math.max(end, itemEnd(i, R(doc)))
  return end
}
export function find(doc, id) {
  for (let ti = 0; ti < doc.tracks.length; ti++) {
    const ii = doc.tracks[ti].items.findIndex(i => i.id === id)
    if (ii >= 0) return { track: doc.tracks[ti], ti, item: doc.tracks[ti].items[ii], ii }
  }
  return null
}
export function trackOf(doc, id) { return doc.tracks.findIndex(t => t.id === id) }
// The timed items of a track in time order.
export function ordered(track) { return track.items.filter(isTimed).sort((a, b) => a.start_ms - b.start_ms) }
export function transitionsOf(track, clipId) { return track.items.filter(i => i.type === 'transition' && i.between.includes(clipId)) }
export function transitionInto(track, clipId) { return track.items.find(i => i.type === 'transition' && i.between[1] === clipId) || null }
const transitionBetween = (track, a, b) => track.items.find(i => i.type === 'transition' && i.between[0] === a && i.between[1] === b) || null
// A new id no item, track, compound, marker or effect in the document uses.
export function uid(doc, prefix) {
  const used = new Set()
  const root = doc._root || doc
  const addTracks = tracks => { for (const t of tracks || []) { used.add(t.id); for (const i of t.items) { used.add(i.id); for (const e of i.effects || []) used.add(e.id) } } }
  addTracks(doc.tracks); addTracks(root.tracks)
  for (const [cid, c] of Object.entries(root.compounds || {})) { used.add(cid); addTracks(c.tracks) }
  for (const m of root.markers || []) used.add(m.id)
  let n = 1
  while (used.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}
const prefixFor = (track, item) => item.type === 'text' ? 'x' : (track.kind === 'audio' ? 'm' : 'c')

// ── tracks ──────────────────────────────────────────────────────────────────────────────────────────────────────
// A track flag (lock, mute, hide, solo); version 2's `muted` and `hidden` read as `mute` and `hide`.
export function flag(track, name) { return !!(track?.[name] ?? track?.[LEGACY_FLAG[name]]) }
export function mainTrack(doc) { return doc.tracks.find(t => t.kind === 'video' && t.main) || null }
export const isMain = track => !!(track && track.kind === 'video' && track.main)
export const magnetOn = doc => !!doc?.settings?.magnet && !doc._scope
// Heard in the preview and the export: not muted, and when any track is soloed, only the soloed ones.
export function audible(doc, track) {
  if (track.kind === 'text' || flag(track, 'mute')) return false
  const solo = doc.tracks.some(t => flag(t, 'solo'))
  return !solo || flag(track, 'solo')
}
export function shown(track) { return !flag(track, 'hide') }
export function trackRole(track) { return track.kind === 'audio' ? (track.role || 'music') : null }
// A track's name: its own, else its kind and number ("Video 1", "Captions 1", "Sound 2").
export function trackName(doc, track) {
  if (track?.name) return track.name
  const ti = doc.tracks.indexOf(track)
  const same = doc.tracks.slice(0, ti + 1).filter(t => t.kind === track.kind).length
  return `${{ video: 'Video', text: track.captions ? 'Captions' : 'Text', audio: 'Sound' }[track.kind]} ${same}`
}
// Everything showing at a time, top track first (what the monitor draws).
export function itemsAt(doc, ms) {
  const out = []
  doc.tracks.forEach((t, ti) => { if (shown(t)) for (const i of t.items) if (isTimed(i) && i.start_ms <= ms && ms < itemEnd(i, R(doc))) out.push({ track: t, ti, item: i }) })
  return out
}
// The canvas background as a colour, for a page that shows one (version 2 stored a string).
export function backgroundColor(doc) { const b = doc?.canvas?.background; return typeof b === 'string' ? b : (b?.kind === 'color' ? b.color : '#000000') }

// ── version 2 reads as version 3 (contract 1) ─────────────────────────────────────────────────────────────────────
// version 3; background string → {kind: 'color'}; wipe → wipe_left, slide → slide_left; magnet off for an old
// timeline (it may have gaps); the first video track is the main one; every time on the frame grid. Also repairs a
// version 3 document with no main track. A document that is already right comes back as it is (the same object).
export function upgrade(doc) {
  if (!doc || !Array.isArray(doc.tracks)) return doc
  const v2 = (doc.version || 2) < 3
  const out = clone(doc)
  out.version = VERSION
  if (!RATES.includes(out.rate)) out.rate = 30
  out.canvas = out.canvas || { aspect: '16:9' }
  if (typeof out.canvas.background === 'string' || out.canvas.background == null) out.canvas.background = { kind: 'color', color: out.canvas.background || '#000000' }
  if (!out.settings) out.settings = { magnet: !v2 }
  const rename = { wipe: 'wipe_left', slide: 'slide_left' }
  const fix = tracks => { for (const t of tracks) for (const i of t.items) if (i.type === 'transition' && rename[i.kind]) i.kind = rename[i.kind] }
  fix(out.tracks)
  for (const c of Object.values(out.compounds || {})) fix(c.tracks)
  if (!out.tracks.some(isMain)) { const v = out.tracks.find(t => t.kind === 'video'); if (v) v.main = true }
  const fixed = regrid(out)
  return JSON.stringify(fixed) === JSON.stringify(doc) ? doc : fixed
}

// Every time back on the grid of the document's rate (after a rate change, and for a version 2 document): starts,
// text ends, picture ends, keyframes, markers, anchor offsets; a transition keeps the overlap its clips now have.
export function regrid(doc) {
  const rate = R(doc), out = clone(doc)
  const fixTracks = tracks => {
    for (const t of tracks) {
      for (const i of t.items) {
        if (!isTimed(i)) continue
        const end = itemEnd(i, rate)
        i.start_ms = Math.max(0, snap(i.start_ms, rate))
        const next = gridCeil(i.start_ms + 1, rate)
        if (i.type === 'text') i.end_ms = Math.max(next, snap(end, rate))
        else if (i.hold_ms != null) i.hold_ms = Math.max(next, snap(end, rate)) - i.start_ms
        if (i.anchor) i.anchor.offset_ms = snap(i.anchor.offset_ms, rate)
        if (i.keyframes) { const k = shiftKeys(i.keyframes, 0, rate); if (k) i.keyframes = k; else delete i.keyframes }
      }
      for (const tr of t.items.filter(i => i.type === 'transition')) {
        const a = t.items.find(i => i.id === tr.between[0]), b = t.items.find(i => i.id === tr.between[1])
        if (a && b) tr.ms = itemEnd(a, rate) - b.start_ms
      }
      t.items = t.items.filter(tr => tr.type !== 'transition' || tr.ms > 0)
    }
  }
  fixTracks(out.tracks)
  for (const c of Object.values(out.compounds || {})) fixTracks(c.tracks)
  for (const m of out.markers || []) m.at_ms = Math.max(0, snap(m.at_ms, rate))
  return applyOps(out, applyAnchors(out)).doc
}
// The same as operations, for an edit that changes the rate.
export function regridOps(doc) {
  const g = regrid(doc), ops = []
  for (const k of ['tracks', 'markers', 'compounds']) if (doc[k] !== undefined && JSON.stringify(g[k]) !== JSON.stringify(doc[k])) ops.push(S([k], g[k]))
  return ops
}
// Change the frame rate: every time moves to the new grid.
export function setRateOps(doc, rate) {
  if (!RATES.includes(rate) || rate === doc.rate) return []
  return finish(doc, [S(['rate'], rate), ...regridOps({ ...doc, rate })])
}

// ── snapping to edges ───────────────────────────────────────────────────────────────────────────────────────────
export function snapPoints(doc, { playhead = null, exclude = [], markers = true } = {}) {
  const pts = [0]
  if (playhead != null) pts.push(playhead)
  for (const t of doc.tracks) for (const i of t.items) if (isTimed(i) && !exclude.includes(i.id)) pts.push(i.start_ms, itemEnd(i, R(doc)))
  if (markers) for (const m of doc.markers || []) pts.push(m.at_ms)
  return [...new Set(pts)].sort((a, b) => a - b)
}
// The nearest snap point within `threshold` ms, else the time itself.
export function snapToPoints(ms, points, threshold) {
  let best = ms, dist = threshold + 1
  for (const p of points) { const d = Math.abs(p - ms); if (d <= threshold && d < dist) { best = p; dist = d } }
  return best
}

// ── operations and their inverse ────────────────────────────────────────────────────────────────────────────────
// An operation: { op: 'set', path, value } | { op: 'insert', path, value } (path ends at an array index) |
// { op: 'remove', path }. Applying returns the new document (unchanged parts shared) and the inverse operations.
function getAt(obj, path) { return path.reduce((o, k) => (o == null ? undefined : o[k]), obj) }
function withAt(obj, path, fn) {
  if (!path.length) return fn(obj)
  const [k, ...rest] = path
  const copy = Array.isArray(obj) ? obj.slice() : { ...obj }
  copy[k] = withAt(obj[k], rest, fn)
  return copy
}
export function applyOps(doc, ops) {
  let cur = doc
  const inverse = []
  for (const o of ops) {
    const parent = o.path.slice(0, -1), key = o.path[o.path.length - 1]
    if (o.op === 'set') {
      const old = getAt(cur, o.path)
      cur = withAt(cur, parent, p => { const c = Array.isArray(p) ? p.slice() : { ...p }; if (o.value === undefined) delete c[key]; else c[key] = o.value; return c })
      inverse.unshift({ op: 'set', path: o.path, value: old })
    } else if (o.op === 'insert') {
      cur = withAt(cur, parent, a => { const c = a.slice(); c.splice(key, 0, o.value); return c })
      inverse.unshift({ op: 'remove', path: o.path })
    } else if (o.op === 'remove') {
      const old = getAt(cur, o.path)
      cur = withAt(cur, parent, a => { const c = a.slice(); c.splice(key, 1); return c })
      inverse.unshift({ op: 'insert', path: o.path, value: old })
    } else throw new Error(`unknown operation ${o.op}`)
  }
  return { doc: cur, inverse }
}
const S = (path, value) => ({ op: 'set', path, value })
const itemPath = (ti, ii, ...rest) => ['tracks', ti, 'items', ii, ...rest]
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))
// Operations built one after another, each against the document the earlier ones made.
function chain(doc) {
  const c = { doc, ops: [], add(o) { if (o && o.length) { c.ops.push(...o); c.doc = applyOps(c.doc, o).doc } return c } }
  return c
}

// Undo and redo: each entry is an edit's operations and their inverse. Selection, zoom and the playhead are not
// edits and never enter the history.
export function createHistory(limit = 500) {
  return { past: [], future: [], limit }
}
export function commit(history, doc, ops, label = '') {
  if (!ops.length) return doc
  const { doc: next, inverse } = applyOps(doc, ops)
  history.past.push({ ops, inverse, label })
  if (history.past.length > history.limit) history.past.shift()
  history.future.length = 0
  return next
}
export function undo(history, doc) {
  const e = history.past.pop()
  if (!e) return { doc, label: '' }
  history.future.push(e)
  return { doc: applyOps(doc, e.inverse).doc, label: e.label }
}
export function redo(history, doc) {
  const e = history.future.pop()
  if (!e) return { doc, label: '' }
  history.past.push(e)
  return { doc: applyOps(doc, e.ops).doc, label: e.label }
}

// ── compounds: editing inside one (contract 1 `compounds`) ────────────────────────────────────────────────────────
// The document as seen inside a compound: its tracks are the compound's. Edits made against this view are turned into
// edits of the whole document by `scopeOps`. Paths outside the tracks (canvas, settings, markers, compounds) are the
// whole document's and pass through unchanged.
export function viewOf(doc, compoundId) {
  if (!compoundId) return doc
  const c = doc.compounds?.[compoundId]
  if (!c) return doc
  return { ...doc, tracks: c.tracks, _root: doc, _scope: compoundId }
}
export function scopeOps(ops, compoundId) {
  if (!compoundId) return ops
  return ops.map(o => (o.path[0] === 'tracks' ? { ...o, path: ['compounds', compoundId, ...o.path] } : o))
}
export function compoundLength(doc, compoundId) {
  const root = doc._root || doc, c = root.compounds?.[compoundId]
  return c ? totalMs({ rate: R(root), tracks: c.tracks }) : 0
}
export function compoundName(doc, compoundId) { return (doc._root || doc).compounds?.[compoundId]?.name || 'Compound clip' }
// Does compound `a` contain compound `b`, directly or through another compound?
function reaches(root, a, b, seen = new Set()) {
  if (a === b) return true
  if (seen.has(a)) return false
  seen.add(a)
  for (const t of root.compounds?.[a]?.tracks || []) for (const i of t.items) if (i.compound && reaches(root, i.compound, b, seen)) return true
  return false
}
function durationOf(doc, item, opts = {}) {
  if (item.compound) return compoundLength(doc, item.compound)
  return opts.durations?.[item.media] ?? opts.durationMs ?? null
}

// ── the editor rules every edit ends with ─────────────────────────────────────────────────────────────────────────
// Magnet (contract 2): the main track's clips are contiguous from 0, in time order, overlapping only under a
// transition; a transition between clips that no longer meet goes away. Returns the operations (none when it holds).
export function rippleAll(doc) {
  if (!magnetOn(doc)) return []
  const ti = doc.tracks.findIndex(isMain)
  if (ti < 0) return []
  return packOps(doc, ti, ordered(doc.tracks[ti]).map(i => i.id))
}
// The main track's clips one after another in `order`.
function packOps(doc, ti, order) {
  const c = chain(doc)
  const pos = new Map(order.map((id, n) => [id, n]))
  const stale = doc.tracks[ti].items.filter(i => i.type === 'transition' && !(pos.has(i.between[0]) && pos.get(i.between[1]) === pos.get(i.between[0]) + 1))
  c.add(removeRows(doc, stale.map(i => i.id)))
  const track = c.doc.tracks[ti], rate = R(doc), ops = []
  let t = 0
  order.forEach((id, n) => {
    const ii = track.items.findIndex(i => i.id === id)
    if (ii < 0) return
    const it = track.items[ii]
    if (n > 0) { const tr = transitionBetween(track, order[n - 1], id); if (tr) t -= tr.ms }
    if (it.start_ms !== t) ops.push(S(itemPath(ti, ii, 'start_ms'), t))
    if (it.anchor) ops.push(S(itemPath(ti, ii, 'anchor'), undefined))
    t = itemEnd({ ...it, start_ms: t }, rate)
  })
  c.add(ops)
  return c.ops
}
// Connected items (contract 6 `apply_anchors`, timeline.py `anchored_start`): every anchored item starts at
// F(frame(parent.start_ms) + frame(offset_ms)), counted in frames (contract 2), and a text keeps its length in frames.
// An anchor whose parent is gone or no longer on the main track is removed, so the item stays where it is. Inside every
// compound too, against the compound's own main track.
export function anchoredStart(parentStart, offset, rate = 30) { return frameTime(frameOf(parentStart, rate) + frameOf(offset, rate), rate) }
export function applyAnchors(doc) {
  const rate = R(doc), ops = []
  const place = (tracks, path) => {
    const main = tracks.find(isMain)
    tracks.forEach((t, ti) => t.items.forEach((i, ii) => {
      if (!isTimed(i) || !i.anchor) return
      const at = (...k) => [...path, ti, 'items', ii, ...k]
      const parent = !isMain(t) && main ? main.items.find(p => p.id === i.anchor.clip && isTimed(p)) : null
      if (!parent) { ops.push(S(at('anchor'), undefined)); return }
      const start = anchoredStart(parent.start_ms, i.anchor.offset_ms, rate)
      if (start === i.start_ms) return
      ops.push(S(at('start_ms'), start))
      if (i.type === 'text') ops.push(S(at('end_ms'), frameTime(frameOf(start, rate) + frameOf(i.end_ms, rate) - frameOf(i.start_ms, rate), rate)))
    }))
  }
  place(doc.tracks, ['tracks'])
  // The whole document (not a compound's view): each compound's tracks as well.
  if (!doc._scope) for (const [cid, c] of Object.entries(doc.compounds || {})) if (Array.isArray(c?.tracks)) place(c.tracks, ['compounds', cid, 'tracks'])
  return ops
}
// Keyframes stay inside their clip (a shorter clip drops the ones past its end); an effect's keyframes go with it.
function keyframeFitOps(doc) {
  const rate = R(doc), ops = []
  doc.tracks.forEach((t, ti) => t.items.forEach((i, ii) => {
    if (!isTimed(i) || !i.keyframes) return
    const len = clipLength(i, rate), fx = new Set((i.effects || []).map(e => e.id))
    const next = {}
    let changed = false
    for (const [k, list] of Object.entries(i.keyframes)) {
      const m = /^fx\.([^.]+)\./.exec(k)
      if (m && !fx.has(m[1])) { changed = true; continue }
      const keep = list.filter(f => f.t_ms >= 0 && f.t_ms <= len)
      if (keep.length !== list.length) { changed = true; const b = boundaryKey(list, len, 'end'); if (b) keep.push(b) }
      if (keep.length) next[k] = keep
    }
    if (changed) ops.push(S(itemPath(ti, ii, 'keyframes'), Object.keys(next).length ? next : undefined))
  }))
  return ops
}
// An edit's operations plus the rules above.
export function finish(doc, ops) {
  if (!ops || !ops.length) return []
  const c = chain(doc).add(ops)
  c.add(rippleAll(c.doc))
  c.add(applyAnchors(c.doc))
  c.add(keyframeFitOps(c.doc))
  return c.ops
}

// ── edits: each returns the operations it makes (an empty list when there is nothing to do) ───────────────────────
// Rows to remove (with the transitions of removed clips), highest index first so each removal leaves the others valid.
function removeRows(doc, ids) {
  const rows = []
  doc.tracks.forEach((t, ti) => t.items.forEach((i, ii) => {
    if (ids.includes(i.id) || (i.type === 'transition' && i.between.some(x => ids.includes(x)))) rows.push([ti, ii])
  }))
  return rows.sort((a, b) => b[0] - a[0] || b[1] - a[1]).map(([ti, ii]) => ({ op: 'remove', path: itemPath(ti, ii) }))
}
const childrenOf = (doc, ids) => doc.tracks.flatMap(t => t.items.filter(i => i.anchor && ids.includes(i.anchor.clip)).map(i => i.id))
// A keyframed value cut at relative time t (a split, a trim) keeps its value there: when keys lie on both sides of t and
// none is at t, a boundary key at t holds the value the one evaluator (keyframes.js) gives. A key that starts the kept
// part takes the ease of the segment it cuts (exact for linear and hold; an eased segment restarts its curve there).
function boundaryKey(list, t, side) {
  if (!Number.isFinite(t) || list.some(f => f.t_ms === t) || !list.some(f => f.t_ms < t) || !list.some(f => f.t_ms > t)) return null
  const prev = [...list].reverse().find(f => f.t_ms < t)
  const key = { t_ms: t, v: evaluate(list, t), ease: side === 'start' ? (prev.ease || 'linear') : 'linear' }
  if (key.ease === 'bezier' && prev.bez) key.bez = [...prev.bez]
  return key
}
// Keyframe times moved by `by` (only those in [from, to] kept, with boundary keys at a finite from and to), on the grid,
// once each.
function shiftKeys(keys, by, rate, from = -Infinity, to = Infinity) {
  const out = {}
  for (const [k, list] of Object.entries(keys || {})) {
    const seen = new Set()
    const kept = list.filter(f => f.t_ms >= from && f.t_ms <= to)
    const a = boundaryKey(list, from, 'start'), b = boundaryKey(list, to, 'end')
    if (a) kept.unshift(a)
    if (b) kept.push(b)
    const l = kept.map(f => ({ ...f, t_ms: snap(f.t_ms + by, rate) }))
      .filter(f => f.t_ms >= 0 && !seen.has(f.t_ms) && seen.add(f.t_ms))
    if (l.length) out[k] = l
  }
  return Object.keys(out).length ? out : undefined
}
// A parent's head moved by d: its children stay on the same frame (contract 6: offset_ms -= d) and its keyframes stay
// on the same picture.
function headTrimFx(doc, id, d) {
  if (!d) return []
  const ops = [], f = find(doc, id), rate = R(doc)
  doc.tracks.forEach((t, ti) => t.items.forEach((i, ii) => { if (i.anchor?.clip === id) ops.push(S(itemPath(ti, ii, 'anchor'), { ...i.anchor, offset_ms: snap(i.anchor.offset_ms - d, rate) })) }))
  if (f?.item.keyframes) ops.push(S(itemPath(f.ti, f.ii, 'keyframes'), shiftKeys(f.item.keyframes, -d, rate, d > 0 ? d : -Infinity)))
  return ops
}

// A clip of a file: a video (its whole length), a picture held 3 s, a sound.
export function newClip(doc, trackKind, media, info = {}) {
  const id = uid(doc, trackKind === 'audio' ? 'm' : 'c')
  if (info.media_type === 'image') return { type: 'clip', id, media, start_ms: 0, hold_ms: 3000, fit: 'contain', transform: { ...DEFAULT_TRANSFORM } }
  const len = Math.max(info.duration_ms || 5000, MIN_ITEM_MS)
  const item = { type: 'clip', id, media, start_ms: 0, source_in_ms: 0, source_out_ms: len, volume_db: 0 }
  if (trackKind === 'video') Object.assign(item, { speed: 1, fit: 'contain', transform: { ...DEFAULT_TRANSFORM } })
  return item
}
const lastEnd = (track, rate) => ordered(track).reduce((e, i) => Math.max(e, itemEnd(i, rate)), 0)
// At a time on a track, or (no time) after the track's last item. On the main track with the magnet on, it goes at the
// edit point nearest that time and the clips after it move along.
export function addClipOps(doc, trackId, media, { start = null, info = {} } = {}) {
  const ti = trackOf(doc, trackId)
  if (ti < 0) return []
  const track = doc.tracks[ti], rate = R(doc)
  const item = newClip(doc, track.kind, media, info)
  if (magnetOn(doc) && isMain(track)) {
    const list = ordered(track)
    const n = start == null ? list.length : list.filter(i => i.start_ms + clipLength(i, rate) / 2 <= start).length
    const order = list.map(i => i.id)
    order.splice(n, 0, item.id)
    const c = chain(doc).add([{ op: 'insert', path: itemPath(ti, track.items.length), value: item }])
    return finish(doc, c.add(packOps(c.doc, ti, order)).ops)
  }
  item.start_ms = start == null ? lastEnd(track, rate) : Math.max(0, snap(start, rate))
  return finish(doc, [{ op: 'insert', path: itemPath(ti, track.items.length), value: item }])
}
export function addTextOps(doc, trackId, { start = 0, length = 3000, text = 'Your text', captions = false } = {}) {
  const ti = trackOf(doc, trackId)
  if (ti < 0) return []
  const rate = R(doc), id = uid(doc, captions ? 'q' : 'x')
  const s = Math.max(0, snap(start, rate)), e = Math.max(gridCeil(s + 1, rate), snap(s + length, rate))
  const item = { type: 'text', id, start_ms: s, end_ms: e, text,
    style: { font: 'sans', size: captions ? 0.045 : 0.07, color: '#FFFFFF', box: captions ? '#0000008C' : null }, x: 0.5, y: captions ? 0.88 : 0.5 }
  return finish(doc, [{ op: 'insert', path: itemPath(ti, doc.tracks[ti].items.length), value: item }])
}
export function addTrackOps(doc, kind, { name = '', role = null } = {}) {
  const prefix = { video: 'v', text: 't', audio: 'a' }[kind]
  if (!prefix) return []
  const track = { id: uid(doc, prefix), kind, items: [] }
  if (kind === 'video' && !doc.tracks.some(isMain) && !doc._scope) track.main = true
  if (name) track.name = String(name).slice(0, LIMITS.trackName)
  if (kind === 'audio' && ROLES.includes(role)) track.role = role
  // A new video track goes above the other video tracks (it is drawn over them); others go last.
  const lastVideo = doc.tracks.map(t => t.kind).lastIndexOf('video')
  const at = kind === 'video' ? lastVideo + 1 : doc.tracks.length
  return [{ op: 'insert', path: ['tracks', at], value: track }]
}
// Removing a track deletes its items and the clips connected to them; removing the main track makes the next video
// track the main one.
export function removeTrackOps(doc, trackId) {
  const ti = trackOf(doc, trackId)
  if (ti < 0) return []
  const t = doc.tracks[ti]
  const c = chain(doc).add(removeRows(doc, childrenOf(doc, t.items.map(i => i.id))))
  c.add([{ op: 'remove', path: ['tracks', trackOf(c.doc, trackId)] }])
  if (isMain(t) && !doc._scope) { const v = c.doc.tracks.findIndex(x => x.kind === 'video'); if (v >= 0) c.add([S(['tracks', v, 'main'], true)]) }
  return finish(doc, c.ops)
}

// Move a clip (or text) to a start time, on its track or another track of the same kind. Its transitions go: a moved
// clip no longer meets its old neighbour. On the main track with the magnet on, the clip goes to the edit point nearest
// that time (the others close up around it). A connected clip keeps its parent, at its new offset.
export function moveOps(doc, id, start, toTrackId = null) {
  const f = find(doc, id)
  if (!f || !isTimed(f.item)) return []
  const rate = R(doc)
  start = Math.max(0, snap(start, rate))
  const target = toTrackId ? trackOf(doc, toTrackId) : f.ti
  if (target < 0 || doc.tracks[target].kind !== f.track.kind) return []
  if (target === f.ti && start === f.item.start_ms) return []
  const magnetMain = magnetOn(doc) && isMain(doc.tracks[target])
  const c = chain(doc).add(removeRows(doc, transitionsOf(f.track, id).map(t => t.id)))
  const g = find(c.doc, id)
  const moved = { ...g.item, start_ms: start }
  if (moved.type === 'text') moved.end_ms = start + g.item.end_ms - g.item.start_ms
  if (isMain(c.doc.tracks[target])) delete moved.anchor
  else if (moved.anchor) {
    const parent = find(c.doc, moved.anchor.clip)?.item
    if (parent) moved.anchor = { ...moved.anchor, offset_ms: snap(start - parent.start_ms, rate) }
  }
  if (target === g.ti) c.add([S(itemPath(g.ti, g.ii), moved)])
  else c.add([{ op: 'remove', path: itemPath(g.ti, g.ii) }, { op: 'insert', path: itemPath(target, c.doc.tracks[target].items.length), value: moved }])
  if (magnetMain) {
    const others = ordered(c.doc.tracks[target]).filter(i => i.id !== id)
    const n = others.filter(i => i.start_ms + clipLength(i, rate) / 2 <= start).length
    const order = others.map(i => i.id)
    order.splice(n, 0, id)
    c.add(packOps(c.doc, target, order))
  }
  const ops = finish(doc, c.ops)
  return sameDoc(doc, ops) ? [] : ops
}
const sameDoc = (doc, ops) => JSON.stringify(applyOps(doc, ops).doc) === JSON.stringify(doc)

// Trim one edge to a time on the timeline. The start edge moves the clip's start and its in point together (the
// picture stays where it was); the end edge moves its out point. Bounded by the file and one frame. `ripple`: the items
// after it on the track move by the change (the start edge then keeps the clip's start). On the main track with the
// magnet on every trim ripples. Connected clips of a trimmed head stay on the same frame.
// opts: { durations: {media id: ms}, durationMs (this clip's file), ripple }
export function trimOps(doc, id, edge, at, opts = {}) { return finish(doc, trimRaw(doc, id, edge, at, opts)) }
function trimRaw(doc, id, edge, at, opts = {}) {
  const f = find(doc, id)
  if (!f || !isTimed(f.item)) return []
  const { item: it, ti, ii } = f, rate = R(doc), p = (...k) => itemPath(ti, ii, ...k)
  const r = trimRange(doc, id, edge, opts)
  const to = Math.min(Math.max(snap(at, rate), r.min), r.max)
  const start = it.start_ms, end = itemEnd(it, rate)
  const c = chain(doc)
  if (edge === 'start') {
    const d = to - start
    if (!d) return []
    const ripple = !!opts.ripple
    const newStart = ripple ? start : to
    if (it.type === 'text') c.add([S(p('start_ms'), newStart), ...(ripple ? [S(p('end_ms'), it.end_ms - d)] : [])])
    else if (it.hold_ms != null) c.add([S(p('start_ms'), newStart), S(p('hold_ms'), end - to)])
    else c.add([S(p('start_ms'), newStart), S(p('source_in_ms'), Math.max(0, it.source_in_ms + Math.round(d * effSpeed(it))))])
    c.add(headTrimFx(c.doc, id, d))
    if (ripple) c.add(shiftAfter(c.doc, ti, id, start, -d))
    return c.ops
  }
  if (to === end) return []
  if (it.type === 'text') c.add([S(p('end_ms'), to)])
  else if (it.hold_ms != null) c.add([S(p('hold_ms'), to - start)])
  else c.add([S(p('source_out_ms'), it.source_in_ms + Math.round((to - start) * effSpeed(it)))])
  if (opts.ripple) c.add(shiftAfter(c.doc, ti, id, end, to - end))
  return c.ops
}
// Where an edge can go: [min, max] on the timeline, and whether the bound is the end of the file (the red edit point).
export function trimRange(doc, id, edge, opts = {}) {
  const f = find(doc, id)
  if (!f || !isTimed(f.item)) return { min: 0, max: 0, mediaMin: false, mediaMax: false }
  const it = f.item, rate = R(doc), minLen = minLenMs(rate), start = it.start_ms, end = itemEnd(it, rate)
  if (edge === 'start') {
    let min = 0, mediaMin = false
    if (it.type !== 'text' && it.hold_ms == null) {
      const m = gridCeil(start - it.source_in_ms / effSpeed(it), rate)
      if (m >= 0) { min = m; mediaMin = true }
    }
    return { min, max: gridFloor(end - minLen, rate), mediaMin, mediaMax: false }
  }
  const dur = it.type === 'text' || it.hold_ms != null ? null : durationOf(doc, it, opts)
  const lo = gridCeil(start + minLen, rate)
  const max = dur != null ? gridFloor(start + (dur - it.source_in_ms) / effSpeed(it), rate) : Infinity
  return { min: lo, max: Math.max(max, lo), mediaMin: false, mediaMax: dur != null }
}
// Is the edge at the end of its file (shown as the red edit point)?
export function atMediaEnd(doc, id, edge, opts = {}) {
  const f = find(doc, id), r = trimRange(doc, id, edge, opts)
  if (!f) return false
  const at = edge === 'start' ? f.item.start_ms : itemEnd(f.item, R(doc))
  return edge === 'start' ? (r.mediaMin && at <= r.min) : (r.mediaMax && at >= r.max)
}
// Items on a track that start at or after `from` move by `by` (not the item `except`).
function shiftAfter(doc, ti, except, from, by) {
  if (!by) return []
  const ops = []
  doc.tracks[ti].items.forEach((i, ii) => {
    if (!isTimed(i) || i.id === except || i.start_ms < from) return
    ops.push(S(itemPath(ti, ii, 'start_ms'), Math.max(0, i.start_ms + by)))
    if (i.type === 'text') ops.push(S(itemPath(ti, ii, 'end_ms'), i.end_ms + by))
  })
  return ops
}

// Split at a time inside the item: the first part keeps its id and its transition in; the second gets a new id, the
// transition out, the keyframes after the cut and the connected clips after the cut.
export function splitOps(doc, id, at) { return finish(doc, splitRaw(doc, id, at)) }
function splitRaw(doc, id, at) {
  const f = find(doc, id)
  if (!f || !isTimed(f.item)) return []
  const rate = R(doc), it = f.item, minLen = minLenMs(rate), end = itemEnd(it, rate)
  at = snap(at, rate)
  if (at - it.start_ms < minLen || end - at < minLen) return []
  const cutT = at - it.start_ms
  const nid = uid(doc, prefixFor(f.track, it))
  const p = (...k) => itemPath(f.ti, f.ii, ...k)
  const second = clone(it)
  second.id = nid
  second.start_ms = at
  const firstOps = []
  if (it.type === 'text') firstOps.push(S(p('end_ms'), at))
  else if (it.hold_ms != null) { second.hold_ms = end - at; firstOps.push(S(p('hold_ms'), cutT)) }
  else {
    const cut = it.source_in_ms + Math.round(cutT * effSpeed(it))
    second.source_in_ms = cut
    delete second.fade_in_ms
    firstOps.push(S(p('source_out_ms'), cut), S(p('fade_out_ms'), undefined))
  }
  if (it.keyframes) {
    firstOps.push(S(p('keyframes'), shiftKeys(it.keyframes, 0, rate, -Infinity, cutT)))
    second.keyframes = shiftKeys(it.keyframes, -cutT, rate, cutT)
    if (!second.keyframes) delete second.keyframes
  }
  if (second.anchor) second.anchor = { ...second.anchor, offset_ms: snap(second.anchor.offset_ms + cutT, rate) }
  const ops = [...firstOps, { op: 'insert', path: itemPath(f.ti, f.track.items.length), value: second }]
  const out = f.track.items.findIndex(i => i.type === 'transition' && i.between[0] === id)
  if (out >= 0) ops.push(S(itemPath(f.ti, out, 'between'), [nid, f.track.items[out].between[1]]))
  doc.tracks.forEach((t, ti) => t.items.forEach((i, ii) => {
    if (i.anchor?.clip === id && i.anchor.offset_ms >= cutT) ops.push(S(itemPath(ti, ii, 'anchor'), { clip: nid, offset_ms: snap(i.anchor.offset_ms - cutT, rate) }))
  }))
  return ops
}
// Split every item under a time, on every track (or the tracks named), skipping locked tracks (contract 6 `bladeOps`).
export function bladeOps(doc, at, { trackIds = null } = {}) {
  const rate = R(doc), c = chain(doc)
  at = snap(at, rate)
  for (const t of doc.tracks) {
    if (flag(t, 'lock') || (trackIds && !trackIds.includes(t.id))) continue
    for (const i of ordered(t)) if (i.start_ms < at && at < itemEnd(i, rate)) c.add(splitRaw(c.doc, i.id, at))
  }
  return finish(doc, c.ops)
}

// Delete items (with their transitions and the clips connected to them). `ripple` closes each gap: later items on the
// same track move back by the deleted item's length. On the main track with the magnet on the gap always closes.
export function deleteOps(doc, ids, { ripple = false } = {}) {
  const all = [...new Set([...ids, ...childrenOf(doc, ids)])]
  const c = chain(doc).add(removeRows(doc, all))
  if (ripple) {
    const shifts = []
    for (const id of ids) {
      const f = find(doc, id)
      if (f && isTimed(f.item)) shifts.push({ track: f.track.id, from: f.item.start_ms, by: clipLength(f.item, R(doc)) })
    }
    for (const s of shifts.sort((a, b) => b.from - a.from)) { const ti = trackOf(c.doc, s.track); c.add(shiftAfter(c.doc, ti, null, s.from, -s.by)) }
  }
  return finish(doc, c.ops)
}

// A copy right after the item when that space is free, else at the end of its track. On the main track with the magnet
// on, the copy goes right after it and the rest moves along.
export function duplicateOps(doc, id) {
  const f = find(doc, id)
  if (!f || !isTimed(f.item)) return []
  const rate = R(doc), len = clipLength(f.item, rate)
  const copy = clone(f.item)
  copy.id = uid(doc, prefixFor(f.track, f.item))
  let at = itemEnd(f.item, rate)
  const magnet = magnetOn(doc) && isMain(f.track)
  if (!magnet && ordered(f.track).some(i => i.id !== id && i.start_ms < at + len && itemEnd(i, rate) > at)) at = lastEnd(f.track, rate)
  copy.start_ms = at
  if (copy.type === 'text') copy.end_ms = at + len
  if (copy.anchor) { const parent = find(doc, copy.anchor.clip)?.item; if (parent) copy.anchor.offset_ms = snap(at - parent.start_ms, rate) }
  const c = chain(doc).add([{ op: 'insert', path: itemPath(f.ti, f.track.items.length), value: copy }])
  if (magnet) {
    const order = ordered(f.track).map(i => i.id)
    order.splice(order.indexOf(id) + 1, 0, copy.id)
    c.add(packOps(c.doc, f.ti, order))
  }
  return finish(doc, c.ops)
}

// Change an item's settings: `changes` are { key: value } on the item (an object value replaces that object).
export function setOps(doc, id, changes) {
  const f = find(doc, id)
  if (!f) return []
  return finish(doc, Object.entries(changes).filter(([k, v]) => JSON.stringify(f.item[k]) !== JSON.stringify(v))
    .map(([k, v]) => S(itemPath(f.ti, f.ii, k), v)))
}
// Track settings as pages sent them in version 2: `muted` and `hidden` are the flags `mute` and `hide`; the track
// controls go through `setTrackFlagsOps`; other keys (`captions`) are set as they are.
export function setTrackOps(doc, trackId, changes) {
  const ti = trackOf(doc, trackId)
  if (ti < 0) return []
  const flags = {}, rest = {}
  for (const [k, v] of Object.entries(changes)) {
    const name = Object.entries(LEGACY_FLAG).find(([, old]) => old === k)?.[0] || k
    if (['lock', 'mute', 'hide', 'solo', 'height', 'name', 'role', 'main'].includes(name)) flags[name] = v
    else rest[k] = v
  }
  const c = chain(doc).add(Object.entries(rest).map(([k, v]) => S(['tracks', ti, k], v || undefined)))
  c.add(setTrackFlagsOps(c.doc, trackId, flags))
  return c.ops
}
// Track controls (contract 1 Track, 6 `setTrackFlagsOps`): lock, mute, hide, solo (true, or removed when false),
// height 32..160, name up to 40 characters, role on a sound track, and `main` on a video track (only one is main: the
// old main's connected clips are freed and the new main track's clips lose their anchors).
export function setTrackFlagsOps(doc, trackId, flags) {
  const ti = trackOf(doc, trackId)
  if (ti < 0) return []
  const t = doc.tracks[ti], c = chain(doc)
  for (const [k, v] of Object.entries(flags)) {
    if (['lock', 'mute', 'hide', 'solo'].includes(k)) {
      if (k === 'solo' && t.kind === 'text') continue
      const legacy = LEGACY_FLAG[k] && t[LEGACY_FLAG[k]] !== undefined
      if (!!t[k] !== !!v || legacy) {
        c.add([S(['tracks', ti, k], v ? true : undefined)])
        if (legacy) c.add([S(['tracks', ti, LEGACY_FLAG[k]], undefined)])
      }
    } else if (k === 'height') {
      const h = v == null || v === '' ? undefined : Math.min(Math.max(Math.round(Number(v)), LIMITS.trackHeight[0]), LIMITS.trackHeight[1])
      if (h !== t.height && !Number.isNaN(h)) c.add([S(['tracks', ti, 'height'], h)])
    } else if (k === 'name') {
      const name = String(v || '').trim().slice(0, LIMITS.trackName) || undefined
      if (name !== t.name) c.add([S(['tracks', ti, 'name'], name)])
    } else if (k === 'role') {
      if (t.kind === 'audio' && ROLES.includes(v) && v !== t.role) c.add([S(['tracks', ti, 'role'], v)])
    } else if (k === 'main') {
      if (!v || t.kind !== 'video' || t.main || doc._scope) continue
      const old = doc.tracks.findIndex(isMain)
      if (old >= 0) {
        c.add([S(['tracks', old, 'main'], undefined)])
        const ids = doc.tracks[old].items.map(i => i.id), ops = []
        c.doc.tracks.forEach((x, xi) => x.items.forEach((i, ii) => { if (i.anchor && ids.includes(i.anchor.clip)) ops.push(S(itemPath(xi, ii, 'anchor'), undefined)) }))
        c.add(ops)
      }
      c.add([S(['tracks', ti, 'main'], true)])
      c.add(c.doc.tracks[ti].items.flatMap((i, ii) => (i.anchor ? [S(itemPath(ti, ii, 'anchor'), undefined)] : [])))
    }
  }
  return finish(doc, c.ops)
}
export function setCanvasOps(doc, changes) {
  return Object.entries(changes).map(([k, v]) => S(['canvas', k], v))
}
// The magnet (an editor setting kept in the document): turning it on closes the main track up.
export function setMagnetOps(doc, on) {
  if (!!doc.settings?.magnet === !!on) return []
  const op = doc.settings ? S(['settings', 'magnet'], !!on) : S(['settings'], { magnet: !!on })
  return finish(doc, [op])
}

// A transition between a clip and the next one on its video track. They must meet (the second starts where the first
// ends); the second clip and everything after it on the track move back by its length, so both overlap by it. Its
// length is a whole number of grid periods (`transitionMs`).
export function addTransitionOps(doc, clipId, kind = 'crossfade', ms = 500) {
  const f = find(doc, clipId)
  if (!f || f.track.kind !== 'video' || !TRANSITIONS.includes(kind)) return []
  const rate = R(doc)
  const list = ordered(f.track), n = list.findIndex(i => i.id === clipId), next = list[n + 1]
  if (!next || next.start_ms !== itemEnd(f.item, rate) || transitionInto(f.track, next.id)) return []
  ms = transitionMs(ms, rate)
  if (ms >= Math.min(clipLength(f.item, rate), clipLength(next, rate))) return []
  const ops = []
  f.track.items.forEach((i, ii) => { if (isTimed(i) && i.start_ms >= next.start_ms) ops.push(S(itemPath(f.ti, ii, 'start_ms'), i.start_ms - ms)) })
  ops.push({ op: 'insert', path: itemPath(f.ti, f.track.items.length), value: { type: 'transition', id: uid(doc, 'x'), kind, ms, between: [clipId, next.id] } })
  return finish(doc, ops)
}
// Remove a transition: the clips after it move forward again, so the two clips meet end to start.
export function removeTransitionOps(doc, transitionId) {
  const f = find(doc, transitionId)
  if (!f || f.item.type !== 'transition') return []
  const second = f.track.items.find(i => i.id === f.item.between[1])
  const ops = []
  if (second) f.track.items.forEach((i, ii) => { if (isTimed(i) && i.start_ms >= second.start_ms) ops.push(S(itemPath(f.ti, ii, 'start_ms'), i.start_ms + f.item.ms)) })
  ops.push({ op: 'remove', path: itemPath(f.ti, f.ii) })
  return finish(doc, ops)
}
// A transition's length: the clips after it move by the difference, keeping the overlap equal to its length.
export function setTransitionMsOps(doc, transitionId, ms) {
  const f = find(doc, transitionId)
  if (!f || f.item.type !== 'transition') return []
  const rate = R(doc)
  const a = f.track.items.find(i => i.id === f.item.between[0]), b = f.track.items.find(i => i.id === f.item.between[1])
  ms = transitionMs(ms, rate)
  if (!a || !b || ms >= Math.min(clipLength(a, rate), clipLength(b, rate)) || ms === f.item.ms) return []
  const d = ms - f.item.ms, ops = []
  f.track.items.forEach((i, ii) => { if (isTimed(i) && i.start_ms >= b.start_ms) ops.push(S(itemPath(f.ti, ii, 'start_ms'), i.start_ms - d)) })
  ops.push(S(itemPath(f.ti, f.ii, 'ms'), ms))
  return finish(doc, ops)
}

// ── professional edits (contract 6) ───────────────────────────────────────────────────────────────────────────────
// An item to put on a track from a template (a clip from `newClip`, a copied clip, a text item): a fresh id, at a time.
function placed(doc, track, template, at) {
  const it = clone(template)
  it.id = uid(doc, prefixFor(track, it))
  const len = it.type === 'text' ? it.end_ms - it.start_ms : null
  it.start_ms = at
  if (it.type === 'text') it.end_ms = at + len
  delete it.anchor
  return it
}
function templateLength(doc, template) {
  return clipLength({ ...template, start_ms: 0, ...(template.type === 'text' ? { end_ms: template.end_ms - template.start_ms } : {}) }, R(doc))
}
const fits = (track, template) => !!template && (template.type === 'text') === (track.kind === 'text') && !(track.kind === 'audio' && template.hold_ms != null)
// Insert: the item goes in at the time and everything after it on the track moves later by its length; an item under
// the time is split there first (on the main track with the magnet on, this is the magnetic insert).
export function insertOps(doc, trackId, template, at) {
  const ti = trackOf(doc, trackId)
  if (ti < 0 || !fits(doc.tracks[ti], template)) return []
  const rate = R(doc), track = doc.tracks[ti]
  at = Math.max(0, snap(at, rate))
  const c = chain(doc)
  // A transition the time falls inside goes (its clips no longer meet).
  const inside = track.items.filter(tr => tr.type === 'transition' && (() => { const b = track.items.find(x => x.id === tr.between[1]); return b && b.start_ms <= at && at < b.start_ms + tr.ms })())
  c.add(removeRows(c.doc, inside.map(t => t.id)))
  const under = ordered(c.doc.tracks[ti]).find(i => i.start_ms < at && at < itemEnd(i, rate))
  if (under) {
    const s = splitRaw(c.doc, under.id, at)
    if (s.length) c.add(s)
    else at = (at - under.start_ms < itemEnd(under, rate) - at) ? under.start_ms : itemEnd(under, rate)
  }
  c.add(shiftAfter(c.doc, ti, null, at, templateLength(doc, template)))
  const item = placed(c.doc, track, template, at)
  c.add([{ op: 'insert', path: itemPath(ti, c.doc.tracks[ti].items.length), value: item }])
  return finish(doc, c.ops)
}
// Overwrite: the item takes the time range from `at`; whatever was there is cut away (nothing else moves).
export function overwriteOps(doc, trackId, template, at) {
  const ti = trackOf(doc, trackId)
  if (ti < 0 || !fits(doc.tracks[ti], template)) return []
  const rate = R(doc)
  at = Math.max(0, snap(at, rate))
  const to = snap(at + templateLength(doc, template), rate)
  const c = chain(doc)
  for (const cut of [at, to]) {
    const under = ordered(c.doc.tracks[ti]).find(i => i.start_ms < cut && cut < itemEnd(i, rate))
    if (under) c.add(splitRaw(c.doc, under.id, cut))
  }
  const gone = ordered(c.doc.tracks[ti]).filter(i => i.start_ms < to && itemEnd(i, rate) > at).map(i => i.id)
  c.add(removeRows(c.doc, [...gone, ...childrenOf(c.doc, gone)]))
  const ti2 = trackOf(c.doc, trackId)
  const item = placed(c.doc, doc.tracks[ti], template, at)
  c.add([{ op: 'insert', path: itemPath(ti2, c.doc.tracks[ti2].items.length), value: item }])
  return finish(doc, c.ops)
}
// Replace a clip's file and keep its place, length, speed, volume, fades, effects, keyframes and connections. A file
// shorter than the clip is refused (`replaceProblem` says why).
export function replaceOps(doc, id, media, info = {}) {
  if (replaceProblem(doc, id, info)) return []
  const f = find(doc, id), rate = R(doc), it = f.item, len = clipLength(it, rate)
  const next = clone(it)
  next.media = media
  delete next.compound
  delete next.freeze_at_ms
  if (info.media_type === 'image') {
    for (const k of ['source_in_ms', 'source_out_ms', 'speed', 'speed_curve', 'reverse', 'keep_pitch']) delete next[k]
    next.hold_ms = len
  } else {
    delete next.hold_ms
    const sp = it.hold_ms != null || it.compound ? 1 : effSpeed(it)
    next.source_in_ms = 0
    next.source_out_ms = Math.round(len * sp)
    if (f.track.kind === 'video' && next.speed == null && !next.speed_curve) next.speed = 1
  }
  return finish(doc, [S(itemPath(f.ti, f.ii), next)])
}
export function replaceProblem(doc, id, info = {}) {
  const f = find(doc, id)
  if (!f || f.item.type !== 'clip') return 'Choose a clip to replace.'
  if (info.media_type === 'image') return f.track.kind === 'audio' ? 'A picture cannot go on a sound track.' : ''
  const it = f.item, len = clipLength(it, R(doc))
  const sp = it.hold_ms != null || it.compound ? 1 : effSpeed(it)
  if (info.duration_ms != null && info.duration_ms < Math.round(len * sp)) return 'The new file is shorter than the clip. Trim the clip first, or choose a longer file.'
  return ''
}
// Roll: the edit point between a clip and the clip right after it moves to `at`; one gets longer as the other gets
// shorter, so nothing else moves. Bounded by both files and one frame each.
export function rollOps(doc, leftId, at, opts = {}) {
  const f = find(doc, leftId)
  if (!f || !isTimed(f.item)) return []
  const rate = R(doc), end = itemEnd(f.item, rate)
  const tr = f.track.items.find(i => i.type === 'transition' && i.between[0] === leftId)
  const right = tr ? f.track.items.find(i => i.id === tr.between[1]) : ordered(f.track).find(i => i.id !== leftId && i.start_ms === end)
  if (!right) return []
  const l = trimRange(doc, leftId, 'end', opts), r = trimRange(doc, right.id, 'start', opts)
  const overlap = tr ? tr.ms : 0
  const to = Math.min(Math.max(snap(at, rate), l.min, r.min + overlap), l.max, r.max + overlap)
  const d = to - end
  if (!d) return []
  const c = chain(doc).add(trimRaw(doc, leftId, 'end', to, opts))
  c.add(trimRaw(c.doc, right.id, 'start', right.start_ms + d, opts))
  return finish(doc, c.ops)
}
// Roll's other side: the clip right before `rightId`, if they meet.
export function neighbourBefore(doc, id) {
  const f = find(doc, id)
  if (!f) return null
  const tr = transitionInto(f.track, id)
  if (tr) return f.track.items.find(i => i.id === tr.between[0]) || null
  return ordered(f.track).find(i => i.id !== id && itemEnd(i, R(doc)) === f.item.start_ms) || null
}
// Slip: which part of the file plays changes by `delta` ms of timeline (positive shows later frames); the clip keeps
// its place and length. Bounded by the file.
export function slipOps(doc, id, delta, opts = {}) {
  const f = find(doc, id)
  if (!f || f.item.type !== 'clip' || f.item.hold_ms != null) return []
  const it = f.item, sp = effSpeed(it), dur = durationOf(doc, it, opts)
  let shift = Math.round(snap(delta, R(doc)) * sp)
  shift = Math.max(shift, -it.source_in_ms)
  if (dur != null) shift = Math.min(shift, dur - it.source_out_ms)
  if (!shift) return []
  return finish(doc, [S(itemPath(f.ti, f.ii, 'source_in_ms'), it.source_in_ms + shift), S(itemPath(f.ti, f.ii, 'source_out_ms'), it.source_out_ms + shift)])
}
// Slide: the clip moves by `delta` between its neighbours; a neighbour it touches gets longer or shorter so nothing
// else moves. Without a touching neighbour on a side, the free space on that side bounds it.
export function slideOps(doc, id, delta, opts = {}) {
  const f = find(doc, id)
  if (!f || !isTimed(f.item)) return []
  const rate = R(doc), it = f.item, start = it.start_ms, end = itemEnd(it, rate)
  const list = ordered(f.track), n = list.findIndex(i => i.id === id)
  const prev = list[n - 1], next = list[n + 1]
  const trIn = transitionInto(f.track, id), trOut = f.track.items.find(i => i.type === 'transition' && i.between[0] === id)
  const prevTouch = !!prev && (trIn ? trIn.between[0] === prev.id : itemEnd(prev, rate) === start)
  const nextTouch = !!next && (trOut ? trOut.between[1] === next.id : next.start_ms === end)
  let lo = -start, hi = Infinity
  if (prevTouch) { const r = trimRange(doc, prev.id, 'end', opts), e = itemEnd(prev, rate); lo = Math.max(lo, r.min - e); hi = Math.min(hi, r.max - e) }
  else if (prev) lo = Math.max(lo, itemEnd(prev, rate) - start)
  if (nextTouch) { const r = trimRange(doc, next.id, 'start', opts); lo = Math.max(lo, r.min - next.start_ms); hi = Math.min(hi, r.max - next.start_ms) }
  else if (next) hi = Math.min(hi, next.start_ms - end)
  if (magnetOn(doc) && isMain(f.track) && !prevTouch) { lo = Math.max(lo, 0); hi = Math.min(hi, 0) }
  const d = Math.min(Math.max(snap(delta, rate), lo), hi)
  if (!d || !Number.isFinite(d)) return []
  const c = chain(doc)
  if (prevTouch) c.add(trimRaw(c.doc, prev.id, 'end', itemEnd(prev, rate) + d, opts))
  if (nextTouch) c.add(trimRaw(c.doc, next.id, 'start', next.start_ms + d, opts))
  const g = find(c.doc, id)
  c.add([S(itemPath(g.ti, g.ii, 'start_ms'), start + d), ...(it.type === 'text' ? [S(itemPath(g.ti, g.ii, 'end_ms'), it.end_ms + d)] : [])])
  if (g.item.anchor) { const parent = find(c.doc, g.item.anchor.clip)?.item; if (parent) c.add([S(itemPath(g.ti, g.ii, 'anchor'), { ...g.item.anchor, offset_ms: snap(start + d - parent.start_ms, rate) })]) }
  return finish(doc, c.ops)
}
// Connect a clip on another video track, a sound clip or a text item to the main-track clip at its start (or the one
// named). The server allows an anchor on text items too (timeline.py `_anchor_tracks`).
export function connectOps(doc, id, parentId = null) {
  const f = find(doc, id), main = mainTrack(doc)
  if (!f || !main || !isTimed(f.item) || isMain(f.track)) return []
  const rate = R(doc), list = ordered(main)
  const parent = parentId ? list.find(i => i.id === parentId)
    : list.find(i => i.start_ms <= f.item.start_ms && f.item.start_ms < itemEnd(i, rate)) || list.filter(i => i.start_ms <= f.item.start_ms).pop() || list[0]
  if (!parent) return []
  const anchor = { clip: parent.id, offset_ms: snap(f.item.start_ms - parent.start_ms, rate) }
  if (JSON.stringify(anchor) === JSON.stringify(f.item.anchor)) return []
  return finish(doc, [S(itemPath(f.ti, f.ii, 'anchor'), anchor)])
}
export function detachOps(doc, id) {
  const f = find(doc, id)
  return f?.item.anchor ? [S(itemPath(f.ti, f.ii, 'anchor'), undefined)] : []
}
const SOUND_FIELDS = ['volume_db', 'pan', 'eq', 'denoise', 'voice_enhance']
// Split audio from video (J and L cuts): the video clip's sound becomes its own sound clip, connected to it when it is
// on the main track, and the video clip is muted. The sound goes on the named sound track, else the first one with
// room, else a new sound track.
export function splitAudioOps(doc, id, { trackId = null } = {}) {
  const f = find(doc, id)
  if (!f || f.item.type !== 'clip' || f.track.kind !== 'video' || f.item.hold_ms != null || f.item.compound || f.item.muted) return []
  const rate = R(doc), it = f.item, start = it.start_ms, end = itemEnd(it, rate)
  const c = chain(doc)
  const free = t => t.kind === 'audio' && !flag(t, 'lock') && !ordered(t).some(i => i.start_ms < end && itemEnd(i, rate) > start)
  let target = trackId ? doc.tracks.find(t => t.id === trackId && free(t)) : doc.tracks.find(free)
  if (!target) { c.add(addTrackOps(c.doc, 'audio')); target = c.doc.tracks[c.doc.tracks.length - 1] }
  const sound = { type: 'clip', id: uid(c.doc, 'm'), media: it.media, start_ms: start, source_in_ms: it.source_in_ms, source_out_ms: it.source_out_ms }
  for (const k of ['speed', 'speed_curve', 'keep_pitch', 'reverse', 'fade_in_ms', 'fade_out_ms', ...SOUND_FIELDS]) if (it[k] !== undefined) sound[k] = clone(it[k])
  if (sound.volume_db === undefined) sound.volume_db = 0
  sound.role = it.role || 'dialogue'
  const keys = {}, keep = {}
  for (const [k, list] of Object.entries(it.keyframes || {})) (/^(volume_db|pan)$/.test(k) ? keys : keep)[k] = list
  if (Object.keys(keys).length) sound.keyframes = keys
  if (isMain(f.track) && !doc._scope) sound.anchor = { clip: id, offset_ms: 0 }
  const g = find(c.doc, id), p = (...k) => itemPath(g.ti, g.ii, ...k)
  c.add([S(p('muted'), true), ...[...SOUND_FIELDS, 'role'].filter(k => it[k] !== undefined).map(k => S(p(k), undefined))])
  if (Object.keys(keys).length) c.add([S(p('keyframes'), Object.keys(keep).length ? keep : undefined)])
  const ti = trackOf(c.doc, target.id)
  c.add([{ op: 'insert', path: itemPath(ti, c.doc.tracks[ti].items.length), value: sound }])
  return finish(doc, c.ops)
}

// Markers on the ruler (contract 1 `markers`): add {at_ms, name, color, chapter}, set {id, changes}, remove {id}.
// Kept in time order.
export function markerOps(doc, action, arg = {}) {
  const rate = R(doc), list = doc.markers || []
  const slot = (l, at) => l.filter(m => m.at_ms <= at).length
  const clean = m => ({ id: m.id, at_ms: Math.max(0, snap(Number(m.at_ms) || 0, rate)), name: String(m.name || '').trim().slice(0, LIMITS.markerName),
    color: /^#[0-9A-Fa-f]{6}$/.test(m.color || '') ? m.color.toUpperCase() : MARKER_COLORS[0], chapter: !!m.chapter })
  if (action === 'add') {
    if (list.length >= LIMITS.markers) return []
    const m = clean({ ...arg, id: uid(doc, 'k') })
    if (!doc.markers) return [S(['markers'], [m])]
    return [{ op: 'insert', path: ['markers', slot(list, m.at_ms)], value: m }]
  }
  const n = list.findIndex(m => m.id === arg.id)
  if (n < 0) return []
  if (action === 'remove') return [{ op: 'remove', path: ['markers', n] }]
  if (action === 'set') {
    const m = clean({ ...list[n], ...arg.changes, id: list[n].id })
    if (JSON.stringify(m) === JSON.stringify(list[n])) return []
    if (m.at_ms === list[n].at_ms) return [S(['markers', n], m)]
    return [{ op: 'remove', path: ['markers', n] }, { op: 'insert', path: ['markers', slot(list.filter((_, i) => i !== n), m.at_ms)], value: m }]
  }
  return []
}

// Compound clips (contract 1 `compounds`, 6 `compoundOps`):
//  make {ids, name}: the items become one clip of a new compound (the transitions between them go inside);
//  open {id}: nothing changes in the document (the editor then shows the compound's tracks, `viewOf`): returns [];
//  flatten {id}: the compound clip is replaced by what it shows, in place; the compound goes when nothing uses it.
export function compoundOps(doc, action, arg = {}) {
  if (action === 'make') return makeCompound(doc, arg)
  if (action === 'flatten') return flattenCompound(doc, arg)
  return []
}
export function compoundProblem(doc, ids) {
  const root = doc._root || doc
  const rows = ids.map(id => find(doc, id)).filter(f => f && isTimed(f.item))
  if (!rows.length) return 'Select the clips to nest.'
  if (Object.keys(root.compounds || {}).length >= LIMITS.compounds) return `A timeline holds at most ${LIMITS.compounds} compound clips.`
  if (rows.every(r => r.track.kind === 'text')) return 'A compound clip needs a video or sound clip.'
  if (doc._scope && rows.some(r => r.item.compound && reaches(root, r.item.compound, doc._scope))) return 'A compound clip cannot contain itself.'
  return ''
}
function makeCompound(doc, { ids = [], name = '' }) {
  if (compoundProblem(doc, ids)) return []
  const root = doc._root || doc, rate = R(doc)
  const rows = ids.map(id => find(doc, id)).filter(f => f && isTimed(f.item))
  const chosen = new Set(rows.map(r => r.item.id))
  const t0 = Math.min(...rows.map(r => r.item.start_ms)), t1 = Math.max(...rows.map(r => itemEnd(r.item, rate)))
  const cid = uid(doc, 'cp')
  // One compound track for each track the items come from, in the same order; the main track's items stay main.
  const srcTracks = doc.tracks.filter(t => t.items.some(i => chosen.has(i.id)))
  const scratch = { ...doc, tracks: [...doc.tracks] }
  const tracks = srcTracks.map(t => {
    const nt = { id: uid(scratch, { video: 'v', text: 't', audio: 'a' }[t.kind]), kind: t.kind, items: [] }
    scratch.tracks = [...scratch.tracks, nt]
    for (const k of ['captions', 'role', 'name']) if (t[k] !== undefined) nt[k] = t[k]
    for (const i of t.items) {
      if (i.type === 'transition') { if (chosen.has(i.between[0]) && chosen.has(i.between[1])) nt.items.push(clone(i)); continue }
      if (!chosen.has(i.id)) continue
      const x = clone(i)
      x.start_ms = i.start_ms - t0
      if (x.type === 'text') x.end_ms = i.end_ms - t0
      if (x.anchor && !chosen.has(x.anchor.clip)) delete x.anchor
      nt.items.push(x)
    }
    return nt
  })
  const fromMain = rows.some(r => isMain(r.track))
  const mainIdx = srcTracks.findIndex(isMain), videoIdx = tracks.findIndex(t => t.kind === 'video')
  if (mainIdx >= 0 || videoIdx >= 0) tracks[mainIdx >= 0 ? mainIdx : videoIdx].main = true
  // Where the compound clip goes: the main track when an item came from it, else the top video track used, else the
  // first sound track used.
  const home = fromMain ? doc.tracks.find(isMain) : (srcTracks.find(t => t.kind === 'video') || srcTracks.find(t => t.kind === 'audio'))
  const clip = { type: 'clip', id: uid(scratch, 'c'), compound: cid, start_ms: t0, source_in_ms: 0, source_out_ms: t1 - t0 }
  if (home.kind === 'video') Object.assign(clip, { speed: 1, fit: 'contain', transform: { ...DEFAULT_TRANSFORM } })
  const def = { name: String(name || `Compound ${Object.keys(root.compounds || {}).length + 1}`).slice(0, LIMITS.compoundName), tracks }
  // Clips connected to a nested main-track clip (and not nested themselves) connect to the compound clip instead.
  const orphans = doc.tracks.flatMap(t => t.items.filter(i => i.anchor && chosen.has(i.anchor.clip) && !chosen.has(i.id)).map(i => i.id))
  const c = chain(doc).add(removeRows(doc, [...chosen]))
  c.add([root.compounds ? S(['compounds', cid], def) : S(['compounds'], { [cid]: def })])
  const hi = trackOf(c.doc, home.id)
  c.add([{ op: 'insert', path: itemPath(hi, c.doc.tracks[hi].items.length), value: clip }])
  for (const id of orphans) {
    const g = find(c.doc, id)
    c.add([S(itemPath(g.ti, g.ii, 'anchor'), fromMain ? { clip: clip.id, offset_ms: snap(g.item.start_ms - t0, rate) } : undefined)])
  }
  return finish(doc, c.ops)
}
// The part of an item inside [a, b) of the timeline, or null.
function cutToRange(item, a, b, rate) {
  const s = item.start_ms, e = itemEnd(item, rate)
  if (e <= a || s >= b) return null
  const x = clone(item)
  if (s < a) {
    const d = a - s
    x.start_ms = a
    if (x.hold_ms != null) x.hold_ms -= d
    else if (x.type !== 'text') x.source_in_ms += Math.round(d * effSpeed(item))
    if (x.keyframes) x.keyframes = shiftKeys(x.keyframes, -d, rate)
    delete x.fade_in_ms
  }
  if (e > b) {
    if (x.type === 'text') x.end_ms = b
    else if (x.hold_ms != null) x.hold_ms = b - x.start_ms
    else x.source_out_ms = x.source_in_ms + Math.round((b - x.start_ms) * effSpeed(item))
    delete x.fade_out_ms
  }
  if (!x.keyframes) delete x.keyframes
  return x
}
function flattenCompound(doc, { id }) {
  const f = find(doc, id), root = doc._root || doc
  if (!f || !f.item.compound || !root.compounds?.[f.item.compound]) return []
  const rate = R(doc), it = f.item, def = root.compounds[it.compound]
  const a = it.source_in_ms, b = it.source_in_ms + clipLength(it, rate), shift = it.start_ms - a
  // Each compound track lands on a track of the same kind: the compound's main track (or its first track of the clip's
  // kind) on the clip's own track, the others on other tracks of that kind (new tracks when there are none).
  const used = new Set([f.track.id]), targets = def.tracks.map(() => null)
  let home = def.tracks.findIndex(t => t.main && t.kind === f.track.kind)
  if (home < 0) home = def.tracks.findIndex(t => t.kind === f.track.kind)
  if (home >= 0) targets[home] = f.track.id
  def.tracks.forEach((t, n) => {
    if (targets[n]) return
    const ex = doc.tracks.find(x => x.kind === t.kind && !used.has(x.id) && !isMain(x))
    if (ex) { used.add(ex.id); targets[n] = ex.id }
  })
  const linked = childrenOf(doc, [id])
  const c = chain(doc).add(removeRows(doc, [id]))
  const idMap = new Map()
  const fresh = (items, prefix) => uid({ ...c.doc, tracks: [...c.doc.tracks, { id: '_', items }] }, prefix)
  def.tracks.forEach((t, n) => {
    let tid = targets[n]
    if (!tid) { c.add(addTrackOps(c.doc, t.kind)); tid = c.doc.tracks.filter(x => x.kind === t.kind).pop().id }
    const items = []
    for (const i of t.items) {
      if (i.type === 'transition') continue
      const x = cutToRange(i, a, b, rate)
      if (!x) continue
      x.id = fresh(items, prefixFor(t, i))
      idMap.set(i.id, x.id)
      x.start_ms += shift
      if (x.type === 'text') x.end_ms += shift
      items.push(x)
    }
    for (const tr of t.items.filter(i => i.type === 'transition')) {
      if (idMap.has(tr.between[0]) && idMap.has(tr.between[1])) items.push({ ...clone(tr), id: fresh(items, 'x'), between: tr.between.map(x => idMap.get(x)) })
    }
    const ti = trackOf(c.doc, tid)
    for (const x of items) {
      if (x.anchor) { if (idMap.has(x.anchor.clip) && isMain(f.track)) x.anchor = { ...x.anchor, clip: idMap.get(x.anchor.clip) }; else delete x.anchor }
      c.add([{ op: 'insert', path: itemPath(ti, c.doc.tracks[ti].items.length), value: x }])
    }
  })
  // Clips that were connected to the compound clip connect to what is now under their start.
  for (const lid of linked) {
    const g = find(c.doc, lid), main = mainTrack(c.doc)
    const parent = main && ordered(main).find(p => p.start_ms <= g.item.start_ms && g.item.start_ms < itemEnd(p, rate))
    c.add([S(itemPath(g.ti, g.ii, 'anchor'), parent ? { clip: parent.id, offset_ms: snap(g.item.start_ms - parent.start_ms, rate) } : undefined)])
  }
  // The compound goes when nothing uses it any more (inside a compound it is kept: other uses are not all in view).
  if (!doc._scope && !allClips(c.doc).some(i => i.compound === it.compound)) {
    const rest = { ...root.compounds }
    delete rest[it.compound]
    c.add([S(['compounds'], Object.keys(rest).length ? rest : undefined)])
  }
  return finish(doc, c.ops)
}
function allClips(root) {
  const out = root.tracks.flatMap(t => t.items)
  for (const c of Object.values(root.compounds || {})) out.push(...c.tracks.flatMap(t => t.items))
  return out
}

// Keyframes (contract 4): on a clip `transform.x|y|scale|rotation|opacity`, `crop.x|y|w|h`, `volume_db`, `pan`,
// `fx.<effect id>.<param>`; on text `x|y|opacity`. `t_ms` is relative to the clip's start, on the grid, inside the
// clip. `ease` is one of EASES, or {ease: 'bezier', bez: [x1, y1, x2, y2]}.
// An effect param may be nested one level, as HSL's are: `fx.<id>.<colour>.<h|s|l>`.
const CLIP_KEY = /^(transform\.(x|y|scale|rotation|opacity)|crop\.(x|y|w|h)|volume_db|pan|fx\.[A-Za-z0-9_-]+\.[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)?)$/
const TEXT_KEY = /^(x|y|opacity)$/
export function keyframePathOk(item, path, registry = null) {
  if (!item || !isTimed(item)) return false
  if (item.type === 'text') return TEXT_KEY.test(path)
  if (!CLIP_KEY.test(path)) return false
  const m = /^fx\.([^.]+)\.(.+)$/.exec(path)
  if (!m) return true
  const fx = (item.effects || []).find(e => e.id === m[1])
  if (!fx) return false
  if (!registry) return true
  const spec = paramAt(registry.effects?.[fx.kind]?.params, m[2])
  return !!spec && spec.type === 'number' && spec.animatable !== false
}
// The registry's params of an effect are specs ({type, min, max, default, ...}); a `group` spec (HSL's colours) holds
// named number specs one level down in its own `params` (editor_registry.py: params.red = {type: 'group', params: {h,
// s, l}}). A param name is its path: 'exposure', 'red.h'.
const isSpec = x => !!x && typeof x === 'object' && typeof x.type === 'string'
const isGroup = x => isSpec(x) && x.type === 'group' && !!x.params && typeof x.params === 'object'
export function paramAt(params, name) {
  let v = params
  for (const k of String(name || '').split('.')) {
    if (isGroup(v)) v = v.params[k]
    else if (v && !isSpec(v)) v = v[k]
    else return null
  }
  return isSpec(v) && !isGroup(v) ? v : null
}
// Every param's default, in the same shape as the params (a group becomes an object of its params' defaults).
export function paramDefaults(params) {
  const out = {}
  for (const [k, v] of Object.entries(params || {})) {
    if (isGroup(v)) { const d = paramDefaults(v.params); if (Object.keys(d).length) out[k] = d }
    else if (isSpec(v)) { if (v.default !== undefined) out[k] = clone(v.default) }
    else if (v && typeof v === 'object') { const d = paramDefaults(v); if (Object.keys(d).length) out[k] = d }
  }
  return out
}
// Params merged into the old ones; a group (an object, not a list) merges its own keys.
function mergeParams(a = {}, b = {}) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? mergeParams(a[k], v) : v
  return out
}
export function keyframeCount(item) { return Object.values(item.keyframes || {}).reduce((n, l) => n + l.length, 0) }
// Every keyframe time of an item, relative to its start, once each (what the timeline marks with diamonds).
export function keyframeTimes(item) { return [...new Set(Object.values(item.keyframes || {}).flat().map(k => k.t_ms))].sort((a, b) => a - b) }
export function setKeyframeOps(doc, id, path, t_ms, v, ease = 'linear', { registry = null } = {}) {
  const f = find(doc, id)
  if (!f || !keyframePathOk(f.item, path, registry) || v === null || v === '' || !Number.isFinite(Number(v))) return []
  const rate = R(doc), len = clipLength(f.item, rate)
  const t = Math.min(Math.max(snap(Number(t_ms) || 0, rate), 0), gridFloor(len, rate))
  const e = typeof ease === 'string' ? { ease } : { ease: ease?.ease, bez: ease?.bez }
  if (!EASES.includes(e.ease)) return []
  const key = { t_ms: t, v: Number(v), ease: e.ease }
  if (e.ease === 'bezier') {
    const bz = (e.bez || []).map(Number)
    if (bz.length !== 4 || bz.some(x => !Number.isFinite(x)) || bz[0] < 0 || bz[0] > 1 || bz[2] < 0 || bz[2] > 1) return []
    key.bez = bz
  }
  const keys = clone(f.item.keyframes) || {}
  const before = keys[path] || []
  const list = before.filter(k => k.t_ms !== t)
  if (list.length === before.length && keyframeCount(f.item) >= LIMITS.keyframes) return []
  list.push(key)
  list.sort((a, b) => a.t_ms - b.t_ms)
  keys[path] = list
  if (JSON.stringify(keys) === JSON.stringify(f.item.keyframes)) return []
  return [S(itemPath(f.ti, f.ii, 'keyframes'), keys)]
}
export function removeKeyframeOps(doc, id, path, t_ms) {
  const f = find(doc, id)
  const list = f?.item.keyframes?.[path]
  if (!list || !list.some(k => k.t_ms === t_ms)) return []
  const keys = clone(f.item.keyframes)
  keys[path] = list.filter(k => k.t_ms !== t_ms)
  if (!keys[path].length) delete keys[path]
  return [S(itemPath(f.ti, f.ii, 'keyframes'), Object.keys(keys).length ? keys : undefined)]
}

// Effects (contract 1 `effects`, 3): an ordered list of {id, kind, enabled, params} on a video-track clip, at most 20.
// With the registry, the kind must be one of its effects and the params start at its defaults.
export function addEffectOps(doc, id, kind, { params = null, registry = null, index = null } = {}) {
  const f = find(doc, id)
  if (!f || f.item.type !== 'clip' || f.track.kind !== 'video') return []
  if (registry ? !registry.effects?.[kind] : !EFFECT_KINDS.includes(kind)) return []
  const list = f.item.effects || []
  if (list.length >= LIMITS.effects) return []
  // Ids fx1, fx2, ... as the server gives an effect saved without one (timeline.py).
  const fx = { id: uid(doc, 'fx'), kind, enabled: true, params: mergeParams(paramDefaults(registry?.effects?.[kind]?.params), params || {}) }
  if (!f.item.effects) return [S(itemPath(f.ti, f.ii, 'effects'), [fx])]
  const at = index == null ? list.length : Math.min(Math.max(index, 0), list.length)
  return [{ op: 'insert', path: itemPath(f.ti, f.ii, 'effects', at), value: fx }]
}
export function setEffectOps(doc, id, effectId, changes = {}) {
  const f = find(doc, id)
  const n = (f?.item.effects || []).findIndex(e => e.id === effectId)
  if (n < 0) return []
  const cur = f.item.effects[n]
  const next = { ...cur, ...(changes.enabled !== undefined ? { enabled: !!changes.enabled } : {}), params: mergeParams(cur.params, changes.params || {}) }
  if (JSON.stringify(next) === JSON.stringify(cur)) return []
  return [S(itemPath(f.ti, f.ii, 'effects', n), next)]
}
// Removing an effect removes its keyframes too.
export function removeEffectOps(doc, id, effectId) {
  const f = find(doc, id)
  const n = (f?.item.effects || []).findIndex(e => e.id === effectId)
  if (n < 0) return []
  return finish(doc, [f.item.effects.length === 1 ? S(itemPath(f.ti, f.ii, 'effects'), undefined) : { op: 'remove', path: itemPath(f.ti, f.ii, 'effects', n) }])
}
export function moveEffectOps(doc, id, effectId, toIndex) {
  const f = find(doc, id)
  const list = f?.item.effects || [], n = list.findIndex(e => e.id === effectId)
  const to = Math.min(Math.max(Math.round(toIndex), 0), list.length - 1)
  if (n < 0 || to === n) return []
  return [{ op: 'remove', path: itemPath(f.ti, f.ii, 'effects', n) }, { op: 'insert', path: itemPath(f.ti, f.ii, 'effects', to), value: list[n] }]
}

// Paste attributes (choose which): the groups of ATTRIBUTE_GROUPS named in `which`, with their keyframes, from one item
// onto others. A group that does not apply to a target (sound settings on a picture, text style on a clip) is skipped.
export function attributeGroupsFor(item, trackKind) {
  if (!item || !isTimed(item)) return []
  return Object.entries(ATTRIBUTE_GROUPS).filter(([, g]) => appliesTo(g, item, { kind: trackKind })).map(([k]) => k)
}
function appliesTo(g, item, track) {
  if (item.type === 'text') return g.on === 'text'
  if (g.on === 'text') return false
  if (g.on === 'picture') return track.kind === 'video'
  if (g.on === 'source') return item.hold_ms == null
  if (g.on === 'sound') return track.kind === 'audio' || (track.kind === 'video' && item.hold_ms == null && !item.muted)
  return true
}
export function pasteAttributesOps(doc, fromId, toIds, which = []) {
  const src = find(doc, fromId)
  if (!src || !isTimed(src.item)) return []
  return pasteFrom(doc, src.item, src.track.kind, toIds, which)
}
// The same from an item that is not in the document (the clipboard's copy), with the kind of track it came from.
export function pasteAttributesFromOps(doc, item, trackKind, toIds, which = []) { return pasteFrom(doc, item, trackKind, toIds, which) }
function pasteFrom(doc, source, srcKind, toIds, which) {
  const c = chain(doc)
  for (const id of toIds) {
    const f = find(c.doc, id)
    if (!f || !isTimed(f.item) || f.item.id === source.id) continue
    const groups = which.filter(k => ATTRIBUTE_GROUPS[k] && appliesTo(ATTRIBUTE_GROUPS[k], f.item, f.track) && appliesTo(ATTRIBUTE_GROUPS[k], source, { kind: srcKind }))
    if (!groups.length) continue
    const next = clone(f.item)
    for (const k of groups) {
      const g = ATTRIBUTE_GROUPS[k]
      for (const field of g.fields) { if (source[field] === undefined) delete next[field]; else next[field] = clone(source[field]) }
      if (g.keys) {
        const keys = { ...(next.keyframes || {}) }
        for (const p of Object.keys(keys)) if (g.keys.test(p)) delete keys[p]
        for (const [p, list] of Object.entries(source.keyframes || {})) if (g.keys.test(p)) keys[p] = clone(list)
        if (Object.keys(keys).length) next.keyframes = keys; else delete next.keyframes
      }
    }
    if (next.speed_curve) delete next.speed
    if (JSON.stringify(next) !== JSON.stringify(f.item)) c.add([S(itemPath(f.ti, f.ii), next)])
  }
  return finish(doc, c.ops)
}

// ── checks the server makes too ─────────────────────────────────────────────────────────────────────────────────
// The first reason this timeline would be refused, or ''.
export function problem(doc) {
  const rate = R(doc)
  const videos = doc.tracks.filter(t => t.kind === 'video')
  if (videos.length && videos.filter(t => t.main).length !== 1) return 'One video track must be the main track.'
  const why = tracksProblem(doc.tracks, rate)
  if (why) return why
  for (const [cid, c] of Object.entries(doc.compounds || {})) {
    const w = tracksProblem(c.tracks, rate)
    if (w) return w
    if (c.tracks.some(t => t.items.some(i => i.compound && reaches(doc, i.compound, cid)))) return 'A compound clip cannot contain itself.'
  }
  if (Object.keys(doc.compounds || {}).length > LIMITS.compounds) return `A timeline holds at most ${LIMITS.compounds} compound clips.`
  for (const i of allClips(doc)) if (i.compound && !doc.compounds?.[i.compound]) return 'A compound clip is missing its contents.'
  if ((doc.markers || []).length > LIMITS.markers) return `A timeline holds at most ${LIMITS.markers} markers.`
  for (const m of doc.markers || []) if (m.at_ms < 0 || !onGrid(m.at_ms, rate)) return 'A marker is not on a frame.'
  const main = doc.tracks.find(isMain)
  if (main && doc.settings?.magnet) {
    const list = ordered(main)
    let t = 0
    for (let n = 0; n < list.length; n++) {
      const tr = n ? transitionBetween(main, list[n - 1].id, list[n].id) : null
      if (list[n].start_ms !== t - (tr ? tr.ms : 0)) return 'With the magnet on, the main track has no gaps.'
      t = itemEnd(list[n], rate)
    }
  }
  for (const t of doc.tracks) for (const i of t.items) {
    if (!i.anchor || !isTimed(i)) continue
    if (isMain(t)) return 'A clip on the main track cannot be connected to another.'
    const parent = main?.items.find(p => p.id === i.anchor.clip)
    if (!parent) return 'A connected clip must connect to a clip on the main track.'
    if (!onGrid(i.anchor.offset_ms, rate) || i.start_ms !== anchoredStart(parent.start_ms, i.anchor.offset_ms, rate)) return 'A connected clip is not where its parent puts it.'
  }
  return ''
}
function tracksProblem(tracks, rate) {
  for (const t of tracks) {
    const list = ordered(t)
    for (let n = 1; n < list.length; n++) {
      const a = list[n - 1], b = list[n], overlap = itemEnd(a, rate) - b.start_ms
      const tr = t.items.find(i => i.type === 'transition' && i.between[0] === a.id && i.between[1] === b.id)
      if (!tr && overlap > 0) return `Two items overlap on a ${t.kind} track. Move one, or join them with a transition.`
      if (tr && overlap !== tr.ms) return 'A transition must overlap both of its clips by its length.'
      if (tr && tr.ms >= Math.min(clipLength(a, rate), clipLength(b, rate))) return 'A transition must be shorter than both of its clips.'
    }
    for (const tr of t.items.filter(i => i.type === 'transition')) if (!list.some(i => i.id === tr.between[0]) || !list.some(i => i.id === tr.between[1])) return 'A transition is missing one of its clips.'
    for (const i of list) {
      if (i.start_ms < 0) return 'An item starts before the beginning of the timeline.'
      const len = clipLength(i, rate)
      if (len < MIN_ITEM_MS) return 'An item is shorter than a frame.'
      if (!onGrid(i.start_ms, rate) || (i.type === 'text' && !onGrid(i.end_ms, rate)) || (i.hold_ms != null && !onGrid(i.start_ms + i.hold_ms, rate))) return 'An item is not on a frame.'
      if ((i.effects || []).length > LIMITS.effects) return `A clip holds at most ${LIMITS.effects} effects.`
      if (keyframeCount(i) > LIMITS.keyframes) return `A clip holds at most ${LIMITS.keyframes} keyframes.`
      for (const keys of Object.values(i.keyframes || {})) {
        for (let k = 0; k < keys.length; k++) {
          if (keys[k].t_ms < 0 || keys[k].t_ms > len || !onGrid(keys[k].t_ms, rate)) return 'A keyframe is outside its clip.'
          if (k && keys[k - 1].t_ms >= keys[k].t_ms) return 'Keyframes must be in time order.'
        }
      }
    }
  }
  return ''
}

// Timeline time as m:ss.ff (the frame a grid time is), for labels and announcements.
export function timecode(ms, rate = 30) {
  ms = Math.max(0, Math.round(ms || 0))
  const totalFrames = frameOf(ms, rate)
  const fr = totalFrames % rate, s = Math.floor(totalFrames / rate) % 60, m = Math.floor(totalFrames / rate / 60)
  return `${m}:${String(s).padStart(2, '0')}.${String(fr).padStart(2, '0')}`
}
// Typed time: "12.5" (seconds), "1:02.5" (minutes:seconds). NaN when unreadable.
export function parseTime(text) {
  const t = String(text || '').trim()
  const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(t)
  if (!m) return NaN
  return Math.round(((Number(m[1] || 0) * 60) + Number(m[2])) * 1000)
}
