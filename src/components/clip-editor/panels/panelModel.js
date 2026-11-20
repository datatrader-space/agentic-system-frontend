// What the inspector panels read and change on one item (VIDEO_EDITOR_PRO_CONTRACT.md sections 1, 4, 5): a value is
// named by its keyframe path (`transform.x`, `crop.w`, `volume_db`, `fx.fx1.exposure`, on text `x`), read as its
// static value or, when it has keyframes, its value at the playhead. Changing an animated value sets the keyframe at
// the playhead (as CapCut and Final Cut do). Pure functions: no Vue, no network.
import * as tl from '../timelineModel'
import * as br from './bridge'

export const DEFAULT_TRANSFORM = { x: 0.5, y: 0.5, scale: 1, rotation: 0, flip_x: false, flip_y: false, opacity: 1 }
export const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 }
const ITEM_DEFAULTS = { volume_db: 0, pan: 0, x: 0.5, y: 0.5, opacity: 1, denoise: 0 }
// Static settings kept in an object on the item: text `style.size`, sound `eq.low_db`.
const OBJECT_HEADS = ['style', 'eq']

// What the bin puts on a drag, for the timeline to read on drop: JSON {kind: media|text|effect|transition, id}.
export const DRAG_TYPE = 'application/x-aadml-editor'

export const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

// The playhead as a time inside the item, on the frame grid; null when the playhead is outside it.
export function relTime(item, playhead, rate) {
  if (!item || playhead == null) return null
  const t = playhead - item.start_ms, len = tl.clipLength(item, rate)
  if (t < 0 || t > len) return null
  return clamp(br.snap(t, rate), 0, len)
}

function effectOf(item, fxId) { return (item.effects || []).find(e => e.id === fxId) }
// An effect param by its path inside the params ('exposure', HSL's 'red.h'), and the params object that sets it.
const paramIn = (params, rest) => rest.reduce((o, k) => (o == null ? undefined : o[k]), params)
const nested = (rest, v) => rest.reduceRight((acc, k) => ({ [k]: acc }), v)
export function staticValue(item, path, fallback) {
  const [head, a, ...rest] = path.split('.')
  let v
  if (head === 'transform') v = item.transform?.[a] ?? DEFAULT_TRANSFORM[a]
  else if (head === 'crop') v = (item.crop || FULL_CROP)[a]
  else if (head === 'fx') v = paramIn(effectOf(item, a)?.params, rest)
  else if (OBJECT_HEADS.includes(head)) v = item[head]?.[a]
  else v = item[head] ?? ITEM_DEFAULTS[head]
  return v ?? fallback
}
export function currentValue(item, path, tRel, fallback) {
  const keys = item.keyframes?.[path]
  if (keys?.length) return br.evaluate(keys, tRel ?? 0)
  return staticValue(item, path, fallback)
}
export function keyAt(item, path, tRel) { return tRel == null ? null : (item.keyframes?.[path] || []).find(k => k.t_ms === tRel) || null }

export function staticOps(doc, item, path, v) {
  const [head, a, ...rest] = path.split('.')
  if (head === 'transform') return tl.setOps(doc, item.id, { transform: { ...DEFAULT_TRANSFORM, ...item.transform, [a]: v } })
  if (head === 'crop') {
    const c = { ...FULL_CROP, ...(item.crop || {}), [a]: v }
    return tl.setOps(doc, item.id, { crop: c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1 ? undefined : c })
  }
  if (head === 'fx') return effectOf(item, a) ? br.setEffectOps(doc, item.id, a, { params: nested(rest, v) }) : []
  if (OBJECT_HEADS.includes(head)) return tl.setOps(doc, item.id, { [head]: { ...(item[head] || {}), [a]: v } })
  return tl.setOps(doc, item.id, { [head]: v })
}
// The ease argument of setKeyframeOps for a keyframe: its name, or {ease: 'bezier', bez} for a custom curve.
export const easeOf = k => (!k ? 'linear' : k.ease === 'bezier' ? { ease: 'bezier', bez: k.bez } : (k.ease || 'linear'))
// A keyframe at tRel on an item (the op API checks the path against the registry); a key already there keeps its ease.
export function keyOps(doc, item, path, tRel, v, ease = easeOf(keyAt(item, path, tRel))) {
  return br.setKeyframeOps(doc, item.id, path, tRel, v, ease, { registry: br.registry() })
}
// A changed value: on an animated value, the keyframe at the playhead (none can be set with the playhead outside).
export function valueOps(doc, item, path, v, tRel) {
  if (item.keyframes?.[path]?.length) return tRel == null ? [] : keyOps(doc, item, path, tRel, v)
  return staticOps(doc, item, path, v)
}
// The one count of an item's keyframes (timelineModel).
export const keyframeCount = tl.keyframeCount

// ── speed ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const SPEED_PRESETS = [
  { id: 'montage', label: 'Montage', points: [[0, 1], [0.2, 3], [0.4, 0.5], [0.6, 0.5], [0.8, 3], [1, 1]] },
  { id: 'hero', label: 'Hero', points: [[0, 1], [0.35, 1], [0.5, 0.3], [0.65, 1], [1, 1]] },
  { id: 'bullet', label: 'Bullet', points: [[0, 3], [0.4, 0.2], [0.6, 0.2], [1, 3]] },
  { id: 'jump_cut', label: 'Jump cut', points: [[0, 1], [0.45, 1], [0.5, 5], [0.55, 1], [1, 1]] },
  { id: 'flash_in', label: 'Flash in', points: [[0, 0.5], [0.7, 1], [1, 5]] },
  { id: 'flash_out', label: 'Flash out', points: [[0, 5], [0.3, 1], [1, 0.5]] },
].map(p => ({ ...p, points: p.points.map(([x, y]) => ({ x, y })) }))

// The first reason a speed curve would be refused (contract section 1), or ''.
export function curveProblem(points, limits = br.editorLimits(br.registry())) {
  const [lo, hi] = limits.speed_curve_points, [ymin, ymax] = limits.speed_curve_y
  if (!Array.isArray(points) || points.length < lo || points.length > hi) return `A speed curve has ${lo} to ${hi} points.`
  if (points[0].x !== 0 || points[points.length - 1].x !== 1) return 'The first point is at the start of the clip and the last at its end.'
  for (let i = 1; i < points.length; i++) if (!(points[i].x > points[i - 1].x)) return 'Each point must come after the one before it.'
  if (points.some(p => !(p.y >= ymin && p.y <= ymax))) return `Speeds go from ${ymin}× to ${ymax}×.`
  return ''
}

// Freeze: the clip becomes a still of the frame under the playhead, for the same length (split first to freeze a part).
export function freezeOps(doc, item, playhead) {
  if (!item || item.source_out_ms == null) return []
  const t = clamp(playhead - item.start_ms, 0, tl.clipLength(item, doc.rate))
  const at = Math.round(item.source_in_ms + t * (item.speed || 1))
  return tl.setOps(doc, item.id, { freeze_at_ms: clamp(at, item.source_in_ms, item.source_out_ms), hold_ms: tl.clipLength(item, doc.rate), speed_curve: undefined })
}
export function unfreezeOps(doc, item) { return tl.setOps(doc, item.id, { freeze_at_ms: undefined, hold_ms: undefined }) }

// ── cutting by source time (silences, filler words, edit by transcript) ───────────────────────────────────────────
// Removes the given parts of the clip's FILE (source ms) and closes each gap: the kept parts become clips one after
// another from the clip's start (in whole frames), and later items on the same track move back by the time removed.
// The first part keeps the clip's id, its transition in, fade in and keyframes; the last keeps the fade out and the
// transition out. Plain operations: the editor's rules (the magnet, connected clips) follow when the edit is made.
export function cutSourceRangesOps(doc, clipId, ranges, { rate = doc.rate || 30 } = {}) {
  const f = tl.find(doc, clipId)
  if (!f || f.item.type !== 'clip' || f.item.source_out_ms == null || f.item.speed_curve) return []
  const c = f.item, speed = c.speed || 1, minSrc = Math.ceil(Math.max(tl.MIN_ITEM_MS, 1000 / rate) * speed)
  const cuts = ranges.map(r => [Math.max(c.source_in_ms, r.start_ms), Math.min(c.source_out_ms, r.end_ms)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0])
  const merged = []
  for (const r of cuts) { const last = merged[merged.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r]) }
  const keep = []
  let from = c.source_in_ms
  for (const [a, b] of merged) { if (a - from >= minSrc) keep.push([from, a]); from = Math.max(from, b) }
  if (c.source_out_ms - from >= minSrc) keep.push([from, c.source_out_ms])
  if (!merged.length) return []
  if (keep.length === 1 && keep[0][0] === c.source_in_ms && keep[0][1] === c.source_out_ms) return []
  const oldEnd = tl.itemEnd(c, rate), ti = f.ti
  const later = tl.ordered(f.track).filter(i => i.id !== c.id && i.start_ms >= oldEnd).map(i => i.id)
  let cur = doc
  const ops = []
  const push = o => { ops.push(...o); cur = tl.applyOps(cur, o).doc }
  const at0 = (id, ...k) => ['tracks', ti, 'items', cur.tracks[ti].items.findIndex(i => i.id === id), ...k]
  let at = c.start_ms, lastId = c.id
  keep.forEach(([a, b], n) => {
    let piece
    if (n === 0) {
      push([{ op: 'set', path: at0(c.id, 'source_in_ms'), value: a }, { op: 'set', path: at0(c.id, 'source_out_ms'), value: b },
        ...(keep.length > 1 && c.fade_out_ms !== undefined ? [{ op: 'set', path: at0(c.id, 'fade_out_ms'), value: undefined }] : [])])
      piece = tl.find(cur, c.id).item
    } else {
      piece = { ...JSON.parse(JSON.stringify(c)), id: tl.uid(cur, f.track.kind === 'audio' ? 'm' : 'c'), source_in_ms: a, source_out_ms: b, start_ms: at }
      delete piece.fade_in_ms; delete piece.keyframes
      if (n < keep.length - 1) delete piece.fade_out_ms
      push([{ op: 'insert', path: ['tracks', ti, 'items', cur.tracks[ti].items.length], value: piece }])
      lastId = piece.id
    }
    at = tl.itemEnd(piece, rate)
  })
  // The transition out of the clip now leaves its last part.
  const out = cur.tracks[ti].items.findIndex(i => i.type === 'transition' && i.between[0] === c.id)
  if (out >= 0 && lastId !== c.id) push([{ op: 'set', path: ['tracks', ti, 'items', out, 'between'], value: [lastId, cur.tracks[ti].items[out].between[1]] }])
  const removed = oldEnd - at
  for (const id of later) {
    const g = tl.find(cur, id), start = Math.max(0, g.item.start_ms - removed)
    push([{ op: 'set', path: at0(id, 'start_ms'), value: start }, ...(g.item.type === 'text' ? [{ op: 'set', path: at0(id, 'end_ms'), value: g.item.end_ms - (g.item.start_ms - start) }] : [])])
  }
  return ops
}

// Split a clip at times in its FILE (scene cuts). The latest cut first, so the original id keeps the earlier part.
export function splitAtSourceOps(doc, clipId, sourceTimes, { rate = doc.rate || 30 } = {}) {
  const f = tl.find(doc, clipId)
  if (!f || f.item.source_out_ms == null) return []
  const c = f.item, speed = c.speed || 1
  const times = sourceTimes.filter(s => s > c.source_in_ms && s < c.source_out_ms).map(s => br.snap(c.start_ms + (s - c.source_in_ms) / speed, rate))
  let cur = doc
  const ops = []
  for (const t of [...new Set(times)].sort((a, b) => b - a)) { const o = tl.splitOps(cur, clipId, t, { rate }); ops.push(...o); cur = tl.applyOps(cur, o).doc }
  return ops
}

// Cut to the beat: the chosen clips, in time order on their track, are laid one after another from the first one's
// start, each ending on the last beat that its own length still reaches.
export function cutToBeatOps(doc, clipIds, beats, { rate = doc.rate || 30, media = {} } = {}) {
  const rows = clipIds.map(id => tl.find(doc, id)).filter(f => f && f.item.type === 'clip')
  if (!rows.length || !beats.length) return []
  const track = rows[0].track.id
  const clips = rows.filter(f => f.track.id === track).map(f => f.item).sort((a, b) => a.start_ms - b.start_ms)
  const minLen = Math.max(tl.MIN_ITEM_MS, Math.ceil(1000 / rate))
  const sorted = [...beats].sort((a, b) => a - b)
  let cur = doc, cursor = clips[0].start_ms
  const ops = []
  const push = o => { ops.push(...o); cur = tl.applyOps(cur, o).doc }
  for (const c of clips) {
    if (tl.find(cur, c.id).item.start_ms !== cursor) push(tl.moveOps(cur, c.id, cursor))
    const it = tl.find(cur, c.id).item, reach = cursor + tl.clipLength(it, rate)
    const beat = [...sorted].reverse().find(b => b <= reach && b - cursor >= minLen)
    if (beat != null && beat < reach) push(tl.trimOps(cur, c.id, 'end', beat, { durationMs: media[it.media]?.duration_ms, rate }))
    cursor = tl.itemEnd(tl.find(cur, c.id).item, rate)
  }
  return ops
}

// Timeline time of a time in a clip's file (constant speed).
export function sourceToTimeline(clip, sourceMs, rate) { return br.snap(clip.start_ms + (sourceMs - clip.source_in_ms) / (clip.speed || 1), rate) }

// ── effects ────────────────────────────────────────────────────────────────────────────────────────────────────
// The item's first effect of a kind. When it has none, a view of the document with one added (registry defaults),
// and the ops that add it: a panel shows its controls at once and the first change adds the effect in the same edit.
export function withEffect(doc, item, kind) {
  const fx = (item.effects || []).find(e => e.kind === kind)
  if (fx) return { doc, item, fx, pre: [] }
  const pre = br.addEffectOps(doc, item.id, kind, { registry: br.registry() })
  if (!pre.length) return null
  const next = tl.applyOps(doc, pre).doc, it = tl.find(next, item.id).item
  return { doc: next, item: it, fx: it.effects[it.effects.length - 1], pre }
}
export const COLOUR_KINDS = ['adjust', 'curves', 'hsl', 'lut']
