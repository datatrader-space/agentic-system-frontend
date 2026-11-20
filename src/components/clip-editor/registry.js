// The editor registry (agentic-docs/VIDEO_EDITOR_PRO_CONTRACT.md section 3; ADM-1199): the server's single list of
// effects and their parameters, transitions, text animations, easings, fonts, blend modes, roles and limits, from
// GET /api/video/editor/registry/. Read once and kept for the rest of the page's session; a failed read is not kept,
// so the next call asks again.
import api from '../../services/api'
import { paramAt, paramDefaults } from './timelineModel'

let cached = null      // the registry once read
let pending = null     // the read in flight

export async function loadRegistry({ force = false } = {}) {
  if (cached && !force) return cached
  if (pending && !force) return pending
  pending = api.get('/video/editor/registry/').then(({ data }) => {
    if (!data || typeof data !== 'object' || !data.effects) throw new Error('The editor registry could not be read.')
    cached = data
    return data
  }).finally(() => { pending = null })
  return pending
}
// The registry already read in this session, or null (for code that cannot wait).
export function registry() { return cached }
// For tests: forget what was read, or take a registry as if read (the fixture from `manage.py editor_registry_export`).
export function resetRegistry() { cached = null; pending = null }
export function setRegistry(data) { cached = data; pending = null }

export function effectSpec(reg, kind) { return reg?.effects?.[kind] || null }
// A param by its name or path ('exposure', 'red.h' for HSL's nested params).
export function paramSpec(reg, kind, param) { return paramAt(reg?.effects?.[kind]?.params, param) }
// A new effect's starting params: each param's default, in the params' shape (HSL: {red: {h, s, l}, ...}).
export function effectDefaults(reg, kind) { return paramDefaults(effectSpec(reg, kind)?.params) }
// A number param kept inside its range and on its step (what a slider or a typed value becomes).
export function clampParam(reg, kind, param, value) {
  const spec = paramSpec(reg, kind, param)
  if (!spec || spec.type !== 'number') return value
  let v = Number(value)
  if (!Number.isFinite(v)) v = spec.default ?? spec.min ?? 0
  v = Math.min(Math.max(v, spec.min ?? -Infinity), spec.max ?? Infinity)
  if (spec.step) v = Math.round((v - (spec.min ?? 0)) / spec.step) * spec.step + (spec.min ?? 0)
  return Number(v.toFixed(6))
}
// Can this keyframe path animate (contract 4)? `fx.<effect id>.<param>` needs the clip's effect and an animatable
// number param; the other paths are fixed.
export function isAnimatable(reg, item, path) {
  const m = /^fx\.([^.]+)\.(.+)$/.exec(path)
  if (!m) return true
  const fx = (item?.effects || []).find(e => e.id === m[1])
  const spec = fx && paramSpec(reg, fx.kind, m[2])
  return !!spec && spec.type === 'number' && spec.animatable !== false
}
export function transitionLabel(reg, id) { return reg?.transitions?.find(t => t.id === id)?.label || String(id || '').replace(/_/g, ' ') }
export function fontFor(reg, id) { return reg?.fonts?.find(f => f.id === id) || null }

// A list of the registry's {id, label} entries (blend modes, roles, easings, LUT looks) as ids.
export const ids = list => (list || []).map(x => (typeof x === 'string' ? x : x.id))
export function labelOf(list, id) { const x = (list || []).find(e => (typeof e === 'string' ? e : e.id) === id); return (x && typeof x === 'object' ? x.label : null) || String(id || '').replace(/_/g, ' ') }
// The server helper an effect needs before it renders (bg_removal: the derived matte), and whether that job is paid.
export function effectDerive(reg, kind) { return reg?.effects?.[kind]?.needs_derived || null }
export function effectPaid(reg, kind) { const op = effectDerive(reg, kind); return !!(op && reg?.derive_ops?.[op]?.paid) }

// The ranges the panels keep values in, read from the registry: its `limits`, `rates`, and the keyframe ranges of the
// clip paths (`keyframe_paths.clip`, which are the static fields' ranges too). Three ranges of the contract are not in
// the registry yet (`eq_db` section 1, `text_size` section 1, `gif_max_ms` section 9); until the server lists them
// under `limits`, the contract's numbers are used.
const CONTRACT_LIMITS = { eq_db: [-12, 12], text_size: [0.02, 0.3], gif_max_ms: 15000 }
export function editorLimits(reg) {
  const l = reg?.limits || {}, kp = reg?.keyframe_paths?.clip || {}
  return {
    ...l, rates: reg?.rates || [],
    volume_db: kp.volume_db, pan: kp.pan, scale: kp['transform.scale'], rotation: kp['transform.rotation'],
    eq_db: l.eq_db ?? CONTRACT_LIMITS.eq_db, text_size: l.text_size ?? CONTRACT_LIMITS.text_size, gif_max_ms: l.gif_max_ms ?? CONTRACT_LIMITS.gif_max_ms,
  }
}
