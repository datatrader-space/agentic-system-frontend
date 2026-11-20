// How the preview mixes sound (plan P11, contract section 1, ADM-1199): the same rules as the export's audio graph
// (video_studio/services/compositor.py _audio_chain and the ducking), as pure functions the Web Audio graph
// (audioGraph.js) applies every frame. Nothing here touches Web Audio, so it is tested directly.
import { audible as trackAudible, ROLES } from '../timelineModel'
import { evaluate } from '../keyframes'
import { clipLength } from '../speedCurve'

export { ROLES }
// The 3-band EQ (contract section 1, editor_filters.eq_filters): low shelf 100 Hz and high shelf 8 kHz with slope
// S = 1, peaking 1 kHz Q 1: RBJ biquads, which Web Audio's lowshelf, peaking and highshelf filters are.
export const EQ_BANDS = [{ key: 'low_db', type: 'lowshelf', hz: 100 }, { key: 'mid_db', type: 'peaking', hz: 1000, q: 1 }, { key: 'high_db', type: 'highshelf', hz: 8000 }]
// The export's ducking: sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400 (knee, detection and link
// at ffmpeg's defaults: 2.82843, rms, average).
export const DUCK = { threshold: 0.03, ratio: 8, attack: 20, release: 400, knee: 2.82843 }
const VOLUME_DB = [-60, 12]

// volume=<dB>dB with the level clipped to -60..12 (editor_filters.volume_expr): gain = 10^(dB / 20).
export const dbToGain = db => Math.pow(10, Math.min(Math.max(db, VOLUME_DB[0]), VOLUME_DB[1]) / 20)
// editor_filters.pan_gains: a balance law, both 1 in the middle: L = min(1, 1 - p), R = min(1, 1 + p).
export const panGains = p => [Math.min(1, 1 - p), Math.min(1, 1 + p)]
// editor_filters.VOICE_ENHANCE: highpass 80 Hz (Q 0.707), presence +3 dB at 3 kHz Q 1, acompressor threshold 0.125
// ratio 3 attack 10 ms release 150 ms makeup 1.5 (knee 2.82843). The preview's compressor is Web Audio's, which
// differs in detail (the monitor says so); noise reduction (afftdn) has no Web Audio equivalent.
export const VOICE_ENHANCE = { highpassHz: 80, highpassQ: Math.SQRT1_2, presence: { hz: 3000, q: 1, db: 3 }, compressor: { threshold: 0.125, ratio: 3, attackMs: 10, releaseMs: 150, makeup: 1.5, knee: 2.82843 } }

// A clip's sound role: its own, else a video clip's sound is dialogue and an audio clip has its track's role.
export function roleOf(item, track) {
  if (ROLES.includes(item.role)) return item.role
  if (track.kind === 'video') return 'dialogue'
  return ROLES.includes(track.role) ? track.role : 'music'
}

// Whether a clip is heard. Tracks and roles can be muted and soloed: when anything is soloed, only soloed tracks or
// roles play. `roles` is the editor's {dialogue: {mute, solo}, ...} (not stored in the timeline). The track part is the
// editor's own rule (timelineModel.audible: mute and solo, version 2's `muted` too).
export function audible(item, track, { tracks = [], roles = {} } = {}) {
  if (item.muted) return false
  if (!trackAudible({ tracks }, track)) return false
  const role = roleOf(item, track)
  if (roles[role]?.mute) return false
  const roleSolo = Object.values(roles).some(r => r?.solo)
  if (roleSolo && !roles[role]?.solo) return false
  return true
}

// The fades a clip's sound has (the export: a video clip's sound also fades across its transitions in and out).
export function fadesOf(item, track) {
  let fin = item.fade_in_ms || 0, fout = item.fade_out_ms || 0
  if (track.kind === 'video') {
    for (const t of track.items) {
      if (t.type !== 'transition') continue
      if (t.between?.[1] === item.id) fin = Math.max(fin, t.ms)
      if (t.between?.[0] === item.id) fout = Math.max(fout, t.ms)
    }
  }
  return { fin, fout }
}

// The fade gain at a time inside the clip (afade's default curve, tri: linear).
export function fadeGain(rel, len, { fin, fout }) {
  let g = 1
  if (fin > 0) g = Math.min(g, Math.min(Math.max(rel / Math.min(fin, len), 0), 1))
  if (fout > 0) { const d = Math.min(fout, len); g = Math.min(g, Math.min(Math.max((len - rel) / d, 0), 1)) }
  return g
}

// The clip's level (dB, with keyframes) and pan at a time inside it.
export function levelAt(item, rel) {
  const keys = item.keyframes?.volume_db
  const db = Array.isArray(keys) && keys.length ? evaluate(keys, rel) : (item.volume_db ?? 0)
  const pk = item.keyframes?.pan
  const pan = Array.isArray(pk) && pk.length ? evaluate(pk, rel) : (item.pan ?? 0)
  return { db: Math.min(Math.max(db, VOLUME_DB[0]), VOLUME_DB[1]), pan: Math.min(Math.max(pan, -1), 1) }
}

// Everything the graph sets on one clip at timeline time t: gain (linear, without ducking), pan, EQ gains (dB).
export function clipMix(item, track, t, ctx = {}) {
  const rate = ctx.rate || 30
  const len = clipLength(item, rate)
  const rel = t - item.start_ms
  const on = rel >= 0 && rel < len && audible(item, track, ctx)
  const { db, pan } = levelAt(item, rel)
  const gain = on ? dbToGain(db) * fadeGain(rel, len, fadesOf(item, track)) : 0
  const eq = item.eq || {}
  return { gain, pan, eq: EQ_BANDS.map(b => Math.min(Math.max(eq[b.key] || 0, -12), 12)), role: roleOf(item, track), duck: !!item.duck, on,
    voiceEnhance: !!item.voice_enhance, denoise: item.denoise > 0 }
}

// libavfilter/hermite.h
function hermite(x, x0, x1, p0, p1, m0, m1) {
  const width = x1 - x0, t = (x - x0) / width
  m0 *= width; m1 *= width
  const t2 = t * t, t3 = t2 * t
  return (2 * p0 + m0 - 2 * p1 + m1) * t3 + (-3 * p0 - 2 * m0 + 3 * p1 - m1) * t2 + m0 * t + p0
}
// af_sidechaincompress's gain for a detector value (rms detection: the smoothed SQUARE of the key's level).
export function duckGain(linSlope, { threshold, ratio, knee } = DUCK) {
  const thres = Math.log(threshold)
  const linKneeStart = threshold / Math.sqrt(knee), linKneeStop = threshold * Math.sqrt(knee)
  const kneeStart = Math.log(linKneeStart), kneeStop = Math.log(linKneeStop)
  const compressedKneeStop = (kneeStop - thres) / ratio + thres
  if (!(linSlope > 0) || !(linSlope > linKneeStart * linKneeStart)) return 1
  const slope = 0.5 * Math.log(linSlope)
  let gain = (slope - thres) / ratio + thres
  if (knee > 1 && slope < kneeStop) gain = hermite(slope, kneeStart, kneeStop, kneeStart, compressedKneeStop, 1, 1 / ratio)
  return Math.exp(gain - slope)
}
// One step of the detector (attack/release smoothing of the squared level) over dtMs of audio at 48 kHz: the filter's
// per-sample coefficient c = min(1, 4000 / (ms x 48000)), applied n = dtMs x 48 times, moves 1 - (1 - c)^n of the way.
export function duckDetect(linSlope, square, dtMs, { attack, release } = DUCK) {
  const c = Math.min(1, 4000 / ((square > linSlope ? attack : release) * 48000))
  return linSlope + (square - linSlope) * (1 - Math.pow(1 - c, dtMs * 48))
}
