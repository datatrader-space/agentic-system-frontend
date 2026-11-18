// The clip editor's timeline model (agentic-docs/VIDEO_CLIP_EDITOR_PLAN.md section 4, ADM-1199): the server's format
// version 2, and every edit as a list of operations with their inverse (E9: undo and redo are patches, never
// snapshots). Pure functions only: no Vue, no network. The server checks every save with the same rules
// (video_studio/services/timeline.py); the checks here only stop an edit the server would refuse.
//
// Time is whole milliseconds. Items on a track are placed by start_ms; they may not overlap except two neighbouring
// clips across a transition, which overlaps both by exactly its length.

export const VERSION = 2
export const ASPECTS = ['16:9', '9:16', '1:1', '4:5']
export const RATES = [24, 25, 30]
export const TRANSITIONS = ['crossfade', 'fade_black', 'fade_white', 'wipe', 'slide', 'dissolve']
export const TRANSITION_MS = [100, 2000]
export const FONTS = [{ id: 'sans', label: 'Sans' }, { id: 'sans-bold', label: 'Sans bold' }, { id: 'serif', label: 'Serif' }, { id: 'mono', label: 'Mono' }]
export const MIN_ITEM_MS = 40
const DEFAULT_TRANSFORM = { x: 0.5, y: 0.5, scale: 1, opacity: 1 }

export function newDoc(aspect = '16:9', rate = 30) {
  return { version: VERSION, rate, canvas: { aspect: ASPECTS.includes(aspect) ? aspect : '16:9', background: '#000000' },
    tracks: [{ id: 'v1', kind: 'video', items: [] }, { id: 't1', kind: 'text', captions: true, items: [] }, { id: 'a1', kind: 'audio', items: [] }] }
}

// ── reading ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function clipLength(item) {
  if (item.type === 'text') return item.end_ms - item.start_ms
  if (item.hold_ms != null) return item.hold_ms
  return Math.round((item.source_out_ms - item.source_in_ms) / (item.speed || 1))
}
export const itemEnd = item => item.start_ms + clipLength(item)
export const isTimed = item => item && item.type !== 'transition'
export function totalMs(doc) {
  let end = 0
  for (const t of doc?.tracks || []) for (const i of t.items) if (isTimed(i)) end = Math.max(end, itemEnd(i))
  return end
}
export function frameMs(rate) { return 1000 / (rate || 30) }
// A time on the timeline's frame grid (E3: the editor snaps to frames at the revision's rate).
export function toFrame(ms, rate) { const f = frameMs(rate); return Math.max(0, Math.round(Math.round(ms / f) * f)) }
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
export function uid(doc, prefix) {
  const used = new Set(doc.tracks.flatMap(t => [t.id, ...t.items.map(i => i.id)]))
  let n = 1
  while (used.has(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}
// Everything showing at a time, top track first (what the monitor draws).
export function itemsAt(doc, ms) {
  const out = []
  doc.tracks.forEach((t, ti) => { if (!t.hidden) for (const i of t.items) if (isTimed(i) && i.start_ms <= ms && ms < itemEnd(i)) out.push({ track: t, ti, item: i }) })
  return out
}

// ── snapping ────────────────────────────────────────────────────────────────────────────────────────────────────
export function snapPoints(doc, { playhead = null, exclude = [] } = {}) {
  const pts = [0]
  if (playhead != null) pts.push(playhead)
  for (const t of doc.tracks) for (const i of t.items) if (isTimed(i) && !exclude.includes(i.id)) pts.push(i.start_ms, itemEnd(i))
  return [...new Set(pts)].sort((a, b) => a - b)
}
// The nearest snap point within `threshold` ms, else the time itself.
export function snap(ms, points, threshold) {
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

// Undo and redo (E9): each entry is an edit's operations and their inverse. Selection, zoom and the playhead are not
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

// ── edits: each returns the operations it makes (an empty list when there is nothing to do) ───────────────────────
const itemPath = (ti, ii, ...rest) => ['tracks', ti, 'items', ii, ...rest]

function removeOps(doc, ids) {
  // Indexes are taken highest first, so each removal leaves the others' paths valid.
  const rows = []
  doc.tracks.forEach((t, ti) => t.items.forEach((i, ii) => {
    if (ids.includes(i.id) || (i.type === 'transition' && i.between.some(x => ids.includes(x)))) rows.push([ti, ii])
  }))
  return rows.sort((a, b) => b[0] - a[0] || b[1] - a[1]).map(([ti, ii]) => ({ op: 'remove', path: itemPath(ti, ii) }))
}

// A clip of a file at a time on a track: a video (its whole length, or from..to), a picture held 3 s, a sound.
export function addClipOps(doc, trackId, media, { start = null, info = {} } = {}) {
  const ti = trackOf(doc, trackId)
  if (ti < 0) return []
  const track = doc.tracks[ti]
  const at = start == null ? ordered(track).reduce((e, i) => Math.max(e, itemEnd(i)), 0) : Math.max(0, Math.round(start))
  const id = uid(doc, track.kind === 'audio' ? 'm' : 'c')
  let item
  if (info.media_type === 'image') {
    item = { type: 'clip', id, media, start_ms: at, hold_ms: 3000, fit: 'contain', transform: { ...DEFAULT_TRANSFORM } }
  } else {
    const len = Math.max(info.duration_ms || 5000, MIN_ITEM_MS)
    item = { type: 'clip', id, media, start_ms: at, source_in_ms: 0, source_out_ms: len, volume_db: 0 }
    if (track.kind === 'video') Object.assign(item, { speed: 1, fit: 'contain', transform: { ...DEFAULT_TRANSFORM } })
  }
  return [{ op: 'insert', path: itemPath(ti, track.items.length), value: item }]
}
export function addTextOps(doc, trackId, { start = 0, length = 3000, text = 'Your text', captions = false } = {}) {
  const ti = trackOf(doc, trackId)
  if (ti < 0) return []
  const id = uid(doc, captions ? 'q' : 'x')
  const item = { type: 'text', id, start_ms: Math.max(0, Math.round(start)), end_ms: Math.max(0, Math.round(start)) + length, text,
    style: { font: 'sans', size: captions ? 0.045 : 0.07, color: '#FFFFFF', box: captions ? '#0000008C' : null }, x: 0.5, y: captions ? 0.88 : 0.5 }
  return [{ op: 'insert', path: itemPath(ti, doc.tracks[ti].items.length), value: item }]
}
export function addTrackOps(doc, kind) {
  const prefix = { video: 'v', text: 't', audio: 'a' }[kind]
  const track = { id: uid(doc, prefix), kind, items: [] }
  // A new video track goes above the other video tracks (it is drawn over them); others go last.
  const lastVideo = doc.tracks.map(t => t.kind).lastIndexOf('video')
  const at = kind === 'video' ? lastVideo + 1 : doc.tracks.length
  return [{ op: 'insert', path: ['tracks', at], value: track }]
}
export function removeTrackOps(doc, trackId) {
  const ti = trackOf(doc, trackId)
  return ti < 0 ? [] : [{ op: 'remove', path: ['tracks', ti] }]
}

// Move a clip (or text) to a start time, on its track or another track of the same kind. Its transitions go: a moved
// clip no longer meets its old neighbour.
export function moveOps(doc, id, start, toTrackId = null) {
  const f = find(doc, id)
  if (!f || !isTimed(f.item)) return []
  start = Math.max(0, Math.round(start))
  const target = toTrackId ? trackOf(doc, toTrackId) : f.ti
  if (target < 0 || doc.tracks[target].kind !== f.track.kind) return []
  if (target === f.ti && start === f.item.start_ms) return []
  const links = transitionsOf(f.track, id).map(t => t.id)
  if (target === f.ti) {
    const ops = removeOps(doc, links)
    // Removing transitions shifts indexes on this track: find the item again after them.
    const after = applyOps(doc, ops).doc
    const g = find(after, id)
    return [...ops, { op: 'set', path: itemPath(g.ti, g.ii, 'start_ms'), value: start }]
  }
  const ops = removeOps(doc, links)
  const mid = applyOps(doc, ops).doc
  const g = find(mid, id)
  const moved = { ...g.item, start_ms: start }
  return [...ops, { op: 'remove', path: itemPath(g.ti, g.ii) },
    { op: 'insert', path: itemPath(target, mid.tracks[target].items.length), value: moved }]
}

// Trim one edge to a time on the timeline. The start edge moves the clip's start and its in point together (the
// picture stays where it was); the end edge moves its out point. Bounded by the file (`durationMs`) and one frame.
export function trimOps(doc, id, edge, at, { durationMs = null, rate = 30 } = {}) {
  const f = find(doc, id)
  if (!f || !isTimed(f.item)) return []
  const it = f.item, p = (...k) => itemPath(f.ti, f.ii, ...k)
  const minLen = Math.max(MIN_ITEM_MS, Math.ceil(frameMs(rate)))
  at = Math.round(at)
  if (it.type === 'text') {
    if (edge === 'start') return [{ op: 'set', path: p('start_ms'), value: Math.min(Math.max(0, at), it.end_ms - minLen) }]
    return [{ op: 'set', path: p('end_ms'), value: Math.max(at, it.start_ms + minLen) }]
  }
  if (it.hold_ms != null) {
    if (edge === 'start') {
      const start = Math.min(Math.max(0, at), itemEnd(it) - minLen)
      return [{ op: 'set', path: p('start_ms'), value: start }, { op: 'set', path: p('hold_ms'), value: itemEnd(it) - start }]
    }
    return [{ op: 'set', path: p('hold_ms'), value: Math.max(at - it.start_ms, minLen) }]
  }
  const speed = it.speed || 1
  if (edge === 'start') {
    // Earliest: the file's first frame. Latest: one frame before the end.
    let delta = at - it.start_ms
    delta = Math.max(delta, -Math.floor(it.source_in_ms / speed))
    delta = Math.min(delta, clipLength(it) - minLen)
    if (it.start_ms + delta < 0) delta = -it.start_ms
    if (!delta) return []
    return [{ op: 'set', path: p('start_ms'), value: it.start_ms + delta },
      { op: 'set', path: p('source_in_ms'), value: Math.round(it.source_in_ms + delta * speed) }]
  }
  let out = Math.round(it.source_in_ms + (at - it.start_ms) * speed)
  out = Math.max(out, it.source_in_ms + Math.ceil(minLen * speed))
  if (durationMs) out = Math.min(out, durationMs)
  return out === it.source_out_ms ? [] : [{ op: 'set', path: p('source_out_ms'), value: out }]
}

// Split at a time inside the item: the first part keeps its id and its transition in; the second gets a new id and
// the transition out.
export function splitOps(doc, id, at, { rate = 30 } = {}) {
  const f = find(doc, id)
  if (!f || !isTimed(f.item)) return []
  const it = f.item, minLen = Math.max(MIN_ITEM_MS, Math.ceil(frameMs(rate)))
  at = Math.round(at)
  if (at - it.start_ms < minLen || itemEnd(it) - at < minLen) return []
  const nid = uid(doc, it.type === 'text' ? 'x' : (f.track.kind === 'audio' ? 'm' : 'c'))
  const p = (...k) => itemPath(f.ti, f.ii, ...k)
  let second, firstOps
  if (it.type === 'text') {
    second = { ...it, id: nid, start_ms: at, style: { ...it.style } }
    firstOps = [{ op: 'set', path: p('end_ms'), value: at }]
  } else if (it.hold_ms != null) {
    second = { ...it, id: nid, start_ms: at, hold_ms: itemEnd(it) - at, transform: it.transform && { ...it.transform } }
    firstOps = [{ op: 'set', path: p('hold_ms'), value: at - it.start_ms }]
  } else {
    const cut = Math.round(it.source_in_ms + (at - it.start_ms) * (it.speed || 1))
    second = { ...it, id: nid, start_ms: at, source_in_ms: cut, transform: it.transform && { ...it.transform } }
    delete second.fade_in_ms
    firstOps = [{ op: 'set', path: p('source_out_ms'), value: cut }, { op: 'set', path: p('fade_out_ms'), value: undefined }]
  }
  const ops = [...firstOps, { op: 'insert', path: itemPath(f.ti, f.track.items.length), value: second }]
  const out = f.track.items.findIndex(i => i.type === 'transition' && i.between[0] === id)
  if (out >= 0) ops.push({ op: 'set', path: itemPath(f.ti, out, 'between'), value: [nid, f.track.items[out].between[1]] })
  return ops
}

// Delete items (and the transitions they had). `ripple` closes each gap: later items on the same track move back by
// the deleted item's length.
export function deleteOps(doc, ids, { ripple = false } = {}) {
  const ops = removeOps(doc, ids)
  if (!ripple) return ops
  let next = applyOps(doc, ops).doc
  const shifts = []
  for (const id of ids) {
    const f = find(doc, id)
    if (!f || !isTimed(f.item)) continue
    shifts.push({ track: f.track.id, from: f.item.start_ms, by: clipLength(f.item) })
  }
  const all = [...ops]
  for (const s of shifts.sort((a, b) => b.from - a.from)) {
    const ti = trackOf(next, s.track)
    const more = []
    next.tracks[ti].items.forEach((i, ii) => { if (isTimed(i) && i.start_ms >= s.from) more.push({ op: 'set', path: itemPath(ti, ii, 'start_ms'), value: Math.max(0, i.start_ms - s.by) }) })
    next = applyOps(next, more).doc
    all.push(...more)
  }
  return all
}

// A copy right after the item when that space is free, else at the end of its track.
export function duplicateOps(doc, id) {
  const f = find(doc, id)
  if (!f || !isTimed(f.item)) return []
  const len = clipLength(f.item)
  const nid = uid(doc, f.item.type === 'text' ? 'x' : (f.track.kind === 'audio' ? 'm' : 'c'))
  let at = itemEnd(f.item)
  const clash = ordered(f.track).some(i => i.id !== id && i.start_ms < at + len && itemEnd(i) > at)
  if (clash) at = ordered(f.track).reduce((e, i) => Math.max(e, itemEnd(i)), 0)
  const copy = JSON.parse(JSON.stringify(f.item))
  copy.id = nid
  if (copy.type === 'text') { copy.start_ms = at; copy.end_ms = at + len } else copy.start_ms = at
  return [{ op: 'insert', path: itemPath(f.ti, f.track.items.length), value: copy }]
}

// Change an item's settings: `changes` are { key: value } on the item (an object value replaces that object).
export function setOps(doc, id, changes) {
  const f = find(doc, id)
  if (!f) return []
  return Object.entries(changes).filter(([k, v]) => JSON.stringify(f.item[k]) !== JSON.stringify(v))
    .map(([k, v]) => ({ op: 'set', path: itemPath(f.ti, f.ii, k), value: v }))
}
export function setTrackOps(doc, trackId, changes) {
  const ti = trackOf(doc, trackId)
  if (ti < 0) return []
  return Object.entries(changes).map(([k, v]) => ({ op: 'set', path: ['tracks', ti, k], value: v || undefined }))
}
export function setCanvasOps(doc, changes) {
  return Object.entries(changes).map(([k, v]) => ({ op: 'set', path: ['canvas', k], value: v }))
}

// A transition between a clip and the next one on its video track. They must meet (the second starts where the first
// ends); the second clip and everything after it on the track move back by its length, so both overlap by it.
export function addTransitionOps(doc, clipId, kind = 'crossfade', ms = 500) {
  const f = find(doc, clipId)
  if (!f || f.track.kind !== 'video') return []
  const list = ordered(f.track), n = list.findIndex(i => i.id === clipId), next = list[n + 1]
  if (!next || next.start_ms !== itemEnd(f.item) || transitionInto(f.track, next.id)) return []
  ms = Math.min(Math.max(Math.round(ms), TRANSITION_MS[0]), TRANSITION_MS[1])
  if (ms >= Math.min(clipLength(f.item), clipLength(next))) return []
  const ops = []
  f.track.items.forEach((i, ii) => { if (isTimed(i) && i.start_ms >= next.start_ms) ops.push({ op: 'set', path: itemPath(f.ti, ii, 'start_ms'), value: i.start_ms - ms }) })
  ops.push({ op: 'insert', path: itemPath(f.ti, f.track.items.length), value: { type: 'transition', id: uid(doc, 'x'), kind, ms, between: [clipId, next.id] } })
  return ops
}
// Remove a transition: the clips after it move forward again, so the two clips meet end to start.
export function removeTransitionOps(doc, transitionId) {
  const f = find(doc, transitionId)
  if (!f || f.item.type !== 'transition') return []
  const second = f.track.items.find(i => i.id === f.item.between[1])
  const ops = []
  if (second) f.track.items.forEach((i, ii) => { if (isTimed(i) && i.start_ms >= second.start_ms) ops.push({ op: 'set', path: itemPath(f.ti, ii, 'start_ms'), value: i.start_ms + f.item.ms }) })
  ops.push({ op: 'remove', path: itemPath(f.ti, f.ii) })
  return ops
}
// A transition's length: the clips after it move by the difference, keeping the overlap equal to its length.
export function setTransitionMsOps(doc, transitionId, ms) {
  const f = find(doc, transitionId)
  if (!f || f.item.type !== 'transition') return []
  const a = f.track.items.find(i => i.id === f.item.between[0]), b = f.track.items.find(i => i.id === f.item.between[1])
  ms = Math.min(Math.max(Math.round(ms), TRANSITION_MS[0]), TRANSITION_MS[1])
  if (!a || !b || ms >= Math.min(clipLength(a), clipLength(b)) || ms === f.item.ms) return []
  const d = ms - f.item.ms, ops = []
  f.track.items.forEach((i, ii) => { if (isTimed(i) && i.start_ms >= b.start_ms) ops.push({ op: 'set', path: itemPath(f.ti, ii, 'start_ms'), value: i.start_ms - d }) })
  ops.push({ op: 'set', path: itemPath(f.ti, f.ii, 'ms'), value: ms })
  return ops
}

// ── checks the server makes too ─────────────────────────────────────────────────────────────────────────────────
// The first reason this timeline would be refused, or ''.
export function problem(doc) {
  for (const t of doc.tracks) {
    const list = ordered(t)
    for (let n = 1; n < list.length; n++) {
      const a = list[n - 1], b = list[n], overlap = itemEnd(a) - b.start_ms
      const tr = t.items.find(i => i.type === 'transition' && i.between[0] === a.id && i.between[1] === b.id)
      if (!tr && overlap > 0) return `Two items overlap on a ${t.kind} track. Move one, or join them with a transition.`
      if (tr && overlap !== tr.ms) return 'A transition must overlap both of its clips by its length.'
    }
    for (const i of list) if (clipLength(i) < MIN_ITEM_MS) return 'An item is shorter than a frame.'
  }
  return ''
}

// Timeline time as m:ss.ff (frames at the rate), for labels and announcements.
export function timecode(ms, rate = 30) {
  ms = Math.max(0, Math.round(ms || 0))
  const totalFrames = Math.floor(ms / frameMs(rate) + 1e-6)
  const fr = totalFrames % rate, s = Math.floor(totalFrames / rate) % 60, m = Math.floor(totalFrames / rate / 60)
  return `${m}:${String(s).padStart(2, '0')}.${String(fr).padStart(2, '0')}`
}
// Typed time: "12.5" (seconds), "1:02.5" (minutes:seconds), "1:02.15f" frames not accepted. NaN when unreadable.
export function parseTime(text) {
  const t = String(text || '').trim()
  const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(t)
  if (!m) return NaN
  return Math.round(((Number(m[1] || 0) * 60) + Number(m[2])) * 1000)
}
