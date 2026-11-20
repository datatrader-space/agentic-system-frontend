// Keyframes (agentic-docs/VIDEO_EDITOR_PRO_CONTRACT.md section 4, ADM-1199): the one evaluator the preview uses. The
// server has its twin in video_studio/services/timeline.py; both are checked against the same table of cases
// (editor_cases/keyframes.json), to 1e-6.
//
// A keyframe is {t_ms, v, ease, bez?}; t_ms is relative to the item's start. The ease of a keyframe shapes the segment
// that STARTS at it. Before the first keyframe the value is the first v; after the last, the last v.

export const EASINGS = ['linear', 'ease_in', 'ease_out', 'ease_in_out', 'hold', 'bezier']
const CURVES = { ease_in: [0.42, 0, 1, 1], ease_out: [0, 0, 0.58, 1], ease_in_out: [0.42, 0, 0.58, 1] }
// Bezier solving exactly as the server's (video_studio/services/timeline.py `_bezier`, BEZIER_EPS and BEZIER_D_EPS), step
// for step, so both sides give the same value: Newton from u = p for at most 8 steps, stopping when |x(u) - p| < 1e-12,
// giving up when |x'(u)| < 1e-6 or u leaves [0, 1]; then bisection on [0, 1] from u = p, at most 64 halvings, stopping
// when |x(u) - p| < 1e-12. The x tolerance is far below the contract's 1e-6 so that the VALUE is within 1e-6 too.
export const BEZIER_EPS = 1e-12
export const BEZIER_D_EPS = 1e-6

// y at x = p of cubic-bezier(x1, y1, x2, y2), in the polynomial form the server uses.
export function cubicBezier(x1, y1, x2, y2, p) {
  const cx = 3.0 * x1, cy = 3.0 * y1
  const bx = 3.0 * (x2 - x1) - cx, by = 3.0 * (y2 - y1) - cy
  const ax = 1.0 - cx - bx, ay = 1.0 - cy - by
  const xAt = u => ((ax * u + bx) * u + cx) * u
  const solve = () => {
    let u = p
    for (let i = 0; i < 8; i++) {
      const x = xAt(u) - p
      if (Math.abs(x) < BEZIER_EPS) return u
      const d = (3.0 * ax * u + 2.0 * bx) * u + cx
      if (Math.abs(d) < BEZIER_D_EPS) break
      u = u - x / d
      if (!(u >= 0.0 && u <= 1.0)) break
    }
    let lo = 0.0, hi = 1.0
    u = p
    for (let i = 0; i < 64; i++) {
      const x = xAt(u)
      if (Math.abs(x - p) < BEZIER_EPS) return u
      if (p > x) lo = u; else hi = u
      u = (hi - lo) * 0.5 + lo
    }
    return u
  }
  const u = solve()
  return ((ay * u + by) * u + cy) * u
}

// The eased share (0..1) of a segment at progress p for a keyframe's ease.
export function eased(key, p) {
  const ease = key.ease || 'linear'
  if (ease === 'hold') return 0
  if (ease === 'linear') return p
  if (ease === 'bezier') {
    const [x1, y1, x2, y2] = Array.isArray(key.bez) && key.bez.length === 4 ? key.bez : [0, 0, 1, 1]
    return cubicBezier(x1, y1, x2, y2, p)
  }
  const c = CURVES[ease]
  return c ? cubicBezier(c[0], c[1], c[2], c[3], p) : p
}

// The value of a sorted list of keyframes at t_ms (relative to the item's start).
export function evaluate(keys, tMs) {
  if (!Array.isArray(keys) || !keys.length) return undefined
  if (tMs <= keys[0].t_ms) return keys[0].v
  const last = keys[keys.length - 1]
  if (tMs >= last.t_ms) return last.v
  let i = 0
  while (i < keys.length - 2 && keys[i + 1].t_ms <= tMs) i++
  const a = keys[i], b = keys[i + 1]
  const span = b.t_ms - a.t_ms
  if (span <= 0) return b.v
  const y = eased(a, (tMs - a.t_ms) / span)
  return a.v + (b.v - a.v) * y
}

// A param's value on an item at t_ms (relative): its keyframes when it has any, else its static value.
export function valueAt(item, path, tMs, staticValue) {
  const keys = item?.keyframes?.[path]
  return Array.isArray(keys) && keys.length ? evaluate(keys, tMs) : staticValue
}

// Whether a path is animated on an item.
export const isAnimated = (item, path) => Array.isArray(item?.keyframes?.[path]) && item.keyframes[path].length > 0
