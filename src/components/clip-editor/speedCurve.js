// Speed curves (agentic-docs/VIDEO_EDITOR_PRO_CONTRACT.md sections 2 and 5, ADM-1199): the preview's twin of the
// server's evaluator, checked against the same cases (editor_cases/speed.json).
//
// A curve is 2..16 points {x, y}: x a share of the clip's SOURCE range (first 0, last 1, strictly increasing), y the
// speed there (0.1..10); the speed is linear in x between points. With S the source range in ms, a piece from
// (x0, v0) to (x1, v1) lasts S (x1 - x0) ln(v1 / v0) / (v1 - v0) ms on the timeline, or S (x1 - x0) / v0 when the two
// speeds are equal. Source times here are offsets from the clip's source_in_ms (0..S).

const SAME = 1e-12

// The frame grid (contract section 2): frame n is at F(n) = floor(n * 1000 / rate + 0.5); snap(ms) = F(round(ms *
// rate / 1000)), rounding half up.
export const frameAt = (n, rate) => Math.floor(n * 1000 / rate + 0.5)
// frame(ms) = round(ms * rate / 1000), half up (timeline.py `frames`; works for a raw, fractional length too).
export function frameOf(ms, rate) { return Math.floor(ms * rate / 1000 + 0.5) }
export const snapMs = (ms, rate) => frameAt(frameOf(ms, rate), rate)

function pieceLength(S, x0, v0, x1, v1) {
  const dx = S * (x1 - x0)
  return Math.abs(v1 - v0) < SAME ? dx / v0 : dx * Math.log(v1 / v0) / (v1 - v0)
}

// Each piece with its timeline start t0, length, and source start s0 (all ms).
export function pieces(points, sourceMs) {
  const out = []
  let t = 0
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1]
    const len = pieceLength(sourceMs, a.x, a.y, b.x, b.y)
    out.push({ t0: t, len, s0: sourceMs * a.x, s1: sourceMs * b.x, v0: a.y, v1: b.y })
    t += len
  }
  return out
}

// The raw (unsnapped) timeline length of a source range of sourceMs played through the curve.
export function curveLength(points, sourceMs) {
  return pieces(points, sourceMs).reduce((sum, p) => sum + p.len, 0)
}

// The source offset (ms from source_in) shown at timeline time t (ms from the clip's start), and the speed there.
export function sourceAt(points, sourceMs, t) {
  const list = pieces(points, sourceMs)
  if (!list.length) return { source: 0, speed: 1 }
  if (t <= 0) return { source: 0, speed: list[0].v0 }
  let p = list[list.length - 1]
  for (const q of list) if (t < q.t0 + q.len) { p = q; break }
  const dt = Math.min(t - p.t0, p.len)
  const range = p.s1 - p.s0
  if (range <= 0) return { source: p.s0, speed: p.v0 }
  const a = (p.v1 - p.v0) / range
  if (Math.abs(a) < SAME) return { source: Math.min(p.s0 + p.v0 * dt, sourceMs), speed: p.v0 }
  const v = p.v0 * Math.exp(a * dt)
  return { source: Math.min(p.s0 + (v - p.v0) / a, sourceMs), speed: v }
}

// A clip's raw (unsnapped) length: its source range over its speed, or the speed curve's exact integral (contract 5).
export function rawLength(item) {
  const S = (item.source_out_ms || 0) - (item.source_in_ms || 0)
  return Array.isArray(item.speed_curve) && item.speed_curve.length >= 2 ? curveLength(item.speed_curve, S) : S / (item.speed || 1)
}
// A clip's length in whole frames (contract section 2, the 2026-11-19 correction): L = round(raw * rate / 1000).
export function clipFrames(item, rate = 30) { return frameOf(rawLength(item), rate) }
// Where a clip ends: F(frame(start_ms) + L) — arithmetic in frames, so ms sums never drift. A picture or a freeze
// frame ends at start + hold_ms, text at end_ms.
export function clipEnd(item, rate = 30) {
  if (item.type === 'text') return item.end_ms
  if (item.hold_ms != null) return item.start_ms + item.hold_ms
  return frameAt(frameOf(item.start_ms, rate) + clipFrames(item, rate), rate)
}
// A clip's length on the timeline in ms (its end less its start).
export const clipLength = (item, rate = 30) => clipEnd(item, rate) - item.start_ms

// The source time (ms, in the file) a clip shows at timeline time tMs (absolute), and its playback speed there.
// Reverse plays the source range backwards (from the derived reversed file: the caller maps the time into that file).
export function sourceTimeAt(item, tMs) {
  const rel = Math.max(0, tMs - item.start_ms)
  if (item.freeze_at_ms != null) return { ms: item.freeze_at_ms, speed: 0 }
  if (item.hold_ms != null) return { ms: 0, speed: 0 }
  const S = (item.source_out_ms || 0) - (item.source_in_ms || 0)
  let off, speed
  if (Array.isArray(item.speed_curve) && item.speed_curve.length >= 2) {
    const r = sourceAt(item.speed_curve, S, rel)
    off = r.source; speed = r.speed
  } else {
    speed = item.speed || 1
    off = Math.min(rel * speed, S)
  }
  return { ms: (item.source_in_ms || 0) + off, speed }
}
