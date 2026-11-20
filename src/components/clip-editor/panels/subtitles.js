// Captions as files and as lines (plan F27): SRT and VTT read and written, word times kept or spread over a caption,
// and long captions split by length. Times are timeline milliseconds. Pure functions: no Vue, no network.
import * as tl from '../timelineModel'

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/
function readTime(s) {
  const m = TIME.exec(s)
  if (!m) return NaN
  return ((Number(m[1] || 0) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4].padEnd(3, '0'))
}
function writeTime(ms, sep) {
  ms = Math.max(0, Math.round(ms))
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, f = ms % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(f).padStart(3, '0')}`
}
// SRT or VTT (told apart by the WEBVTT header). Tags and cue settings are dropped; lines of one cue join with a space.
export function parseSubtitles(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  const cues = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('-->')) continue
    const [a, b] = lines[i].split('-->')
    const start = readTime(a), end = readTime(b)
    const body = []
    for (i++; i < lines.length && lines[i].trim() !== ''; i++) body.push(lines[i].trim())
    const words = body.join(' ').replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim()
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && words) cues.push({ start_ms: start, end_ms: end, text: words.slice(0, 500) })
  }
  return cues
}
export function toSrt(cues) { return cues.map((c, n) => `${n + 1}\n${writeTime(c.start_ms, ',')} --> ${writeTime(c.end_ms, ',')}\n${c.text}\n`).join('\n') }
export function toVtt(cues) { return `WEBVTT\n\n${cues.map(c => `${writeTime(c.start_ms, '.')} --> ${writeTime(c.end_ms, '.')}\n${c.text}\n`).join('\n')}` }

// Words spread over a caption's time by their length in letters (for a caption with no word times, or edited text).
export function spreadWords(text, start, end) {
  const parts = String(text).split(/\s+/).filter(Boolean)
  const total = parts.reduce((n, w) => n + w.length + 1, 0) || 1
  let at = start
  return parts.map((w, n) => {
    const to = n === parts.length - 1 ? end : Math.round(at + (end - start) * (w.length + 1) / total)
    const word = { text: w, start_ms: Math.round(at), end_ms: to }
    at = to
    return word
  })
}
// A caption longer than `maxChars` becomes several, cut between words; each keeps its words' own times.
// A caption on the frame grid of `rate` (contract section 2): its start and end snapped, at least one frame long, its
// word times kept inside it.
export function onGrid(cue, rate) {
  const start = tl.snap(cue.start_ms, rate), end = Math.max(tl.snap(cue.end_ms, rate), tl.frameTime(tl.frameOf(start, rate) + 1, rate))
  const out = { ...cue, start_ms: start, end_ms: end }
  if (cue.words?.length) out.words = cue.words.map(w => ({ ...w, start_ms: Math.min(Math.max(w.start_ms, start), end), end_ms: Math.min(Math.max(w.end_ms, start), end) }))
  return out
}
export function splitByLength(cue, maxChars) {
  const words = cue.words?.length ? cue.words : spreadWords(cue.text, cue.start_ms, cue.end_ms)
  if (cue.text.length <= maxChars || words.length < 2) return [cue]
  const out = []
  let group = []
  const flush = () => { if (group.length) out.push({ ...cue, text: group.map(w => w.text).join(' '), start_ms: group[0].start_ms, end_ms: group[group.length - 1].end_ms, words: group }); group = [] }
  for (const w of words) {
    const len = group.reduce((n, g) => n + g.text.length + 1, 0) + w.text.length
    if (group.length && len > maxChars) flush()
    group.push(w)
  }
  flush()
  // Each piece runs until the next starts, so nothing flickers between them; the last keeps the caption's end.
  out.forEach((c, n) => { c.end_ms = n < out.length - 1 ? out[n + 1].start_ms : cue.end_ms; if (n === 0) c.start_ms = cue.start_ms })
  return out
}
