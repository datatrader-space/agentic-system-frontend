// Text and captions as ASS scripts (contract section 8, plan P4, ADM-1199): a port of the export's
// video_studio/services/editor_ass.py (BE-RENDER). Both must give IDENTICAL strings for the shared cases
// (editor_cases/ass.json): the preview draws this script with libass (JASSUB) and the same font files, the export with
// ffmpeg's `ass` filter. Change editor_ass.py first, then this file, line for line; the format is specified in that
// file's docstring.

import { evaluate } from '../keyframes'
import { frameAt as frameMs } from '../speedCurve'

// id → [label, family name in the file, files] (editor_ass.FONTS)
export const FONTS = {
  inter: ['Inter', 'Inter', ['Inter-Variable.ttf']],
  roboto: ['Roboto', 'Roboto', ['Roboto-Variable.ttf']],
  montserrat: ['Montserrat', 'Montserrat', ['Montserrat-Regular.ttf', 'Montserrat-Bold.ttf']],
  poppins: ['Poppins', 'Poppins', ['Poppins-Regular.ttf', 'Poppins-Bold.ttf']],
  oswald: ['Oswald', 'Oswald', ['Oswald-Variable.ttf']],
  'bebas-neue': ['Bebas Neue', 'Bebas Neue', ['BebasNeue-Regular.ttf']],
  anton: ['Anton', 'Anton', ['Anton-Regular.ttf']],
  'playfair-display': ['Playfair Display', 'Playfair Display', ['PlayfairDisplay-Variable.ttf']],
  lora: ['Lora', 'Lora', ['Lora-Variable.ttf']],
  merriweather: ['Merriweather', 'Merriweather', ['Merriweather-Regular.ttf', 'Merriweather-Bold.ttf']],
  'dm-serif-display': ['DM Serif Display', 'DM Serif Display', ['DMSerifDisplay-Regular.ttf']],
  'source-code-pro': ['Source Code Pro', 'Source Code Pro', ['SourceCodePro-Regular.ttf', 'SourceCodePro-Bold.ttf']],
  pacifico: ['Pacifico', 'Pacifico', ['Pacifico-Regular.ttf']],
  'permanent-marker': ['Permanent Marker', 'Permanent Marker', ['PermanentMarker-Regular.ttf']],
  caveat: ['Caveat', 'Caveat', ['Caveat-Variable.ttf']],
  'noto-sans': ['Noto Sans', 'Noto Sans', ['NotoSans-Variable.ttf']],
  sans: ['DejaVu Sans', 'DejaVu Sans', ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']],
  'sans-bold': ['DejaVu Sans Bold', 'DejaVu Sans', ['DejaVuSans-Bold.ttf']],
  serif: ['DejaVu Serif', 'DejaVu Serif', ['DejaVuSerif.ttf', 'DejaVuSerif-Bold.ttf']],
  mono: ['DejaVu Sans Mono', 'DejaVu Sans Mono', ['DejaVuSansMono.ttf', 'DejaVuSansMono-Bold.ttf']],
}

const STYLE_FORMAT = 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, ' +
  'Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, ' +
  'Alignment, MarginL, MarginR, MarginV, Encoding'
const EVENT_FORMAT = 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'

export const IN_KINDS = ['fade', 'slide_up', 'slide_down', 'slide_left', 'slide_right', 'pop', 'zoom', 'rise', 'typewriter']
export const LOOP_KINDS = ['none', 'pulse', 'float']
const SLIDE_SHARE = 0.05, RISE_SHARE = 0.02, FLOAT_SHARE = 0.01
const PULSE_SCALE = 108, POP_SCALE = 115, ZOOM_FROM = 40, LOOP_PERIOD_MS = 1000, DEFAULT_LINE_SPACING = 1.2
const ALIGN = { left: 4, center: 5, right: 6 }

export const rnd = v => Math.floor(v + 0.5)
const idiv = (a, b) => Math.floor(a / b)

// Python's f'{v:.2f}': the exact binary value rounded to 2 decimals, an exact tie to the even digit. toFixed agrees
// except on exact ties, which can only be fractions of eighths (x.125, x.375, x.625, x.875).
function fixed2(v) {
  if (Number.isInteger(v * 8) && !Number.isInteger(v * 4)) {
    const k = Math.floor(v * 100)       // the lower of the two candidates (v * 100 is exact here)
    const n = k % 2 === 0 ? k : k + 1
    const s = (Math.abs(n) / 100).toFixed(2)
    return (n < 0 ? '-' : '') + s
  }
  return v.toFixed(2)
}
export function num2(v) {
  let s = fixed2(Number(v))
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' || s === '' ? '0' : s
}
export function assTime(ms) {
  const cs = idiv(Math.trunc(ms) + 5, 10)
  const p2 = n => String(n).padStart(2, '0')
  return `${idiv(cs, 360000)}:${p2(idiv(cs, 6000) % 60)}:${p2(idiv(cs, 100) % 60)}.${p2(cs % 100)}`
}
export function assColor(color, def = '#FFFFFF') {
  const c = (color || def).replace(/^#+/, '').toUpperCase()
  const alpha = c.length === 8 ? 255 - parseInt(c.slice(6, 8), 16) : 0
  return `&H${alpha.toString(16).toUpperCase().padStart(2, '0')}${c.slice(4, 6)}${c.slice(2, 4)}${c.slice(0, 2)}`
}
const colorTag = color => { const c = color.replace(/^#+/, '').toUpperCase(); return `&H${c.slice(4, 6)}${c.slice(2, 4)}${c.slice(0, 2)}&` }
const alphaTag = opacity => `&H${(255 - rnd(255 * Math.min(Math.max(opacity, 0), 1))).toString(16).toUpperCase().padStart(2, '0')}&`
export const escape = text => text.replace(/\\/g, '\\⁠').replace(/\{/g, '\\{').replace(/\}/g, '\\}')
const fl = (v, d) => Number(v || d)

function style(item) {
  const s = { ...(item.style || {}) }
  let font = s.font || 'sans'
  if (!(font in FONTS)) font = 'sans'
  const cap = item.caption_style || {}
  return {
    font, size: fl(s.size, 0.06), color: (s.color || '#FFFFFF').toUpperCase(),
    box: (s.box || '').toUpperCase() || null, stroke_color: (s.stroke_color || '#000000').toUpperCase(),
    stroke_width: fl(s.stroke_width, 0), shadow_color: (s.shadow_color || '#000000').toUpperCase(),
    shadow_x: fl(s.shadow_x, 0), shadow_y: fl(s.shadow_y, 0), letter_spacing: fl(s.letter_spacing, 0),
    line_spacing: fl(s.line_spacing, DEFAULT_LINE_SPACING),
    align: ['left', 'center', 'right'].includes(s.align) ? s.align : 'center',
    bold: !!s.bold || font === 'sans-bold', italic: !!s.italic,
    mode: item.words?.length && ['word', 'karaoke', 'box'].includes(cap.mode) ? cap.mode : 'none',
    highlight: (cap.highlight_color || '#FFD400').toUpperCase(),
  }
}
function styleLine(name, st, H) {
  const size = rnd(st.size * H)
  const primary = st.mode === 'karaoke' ? st.highlight : st.color
  let border, outline, outlineColour
  if (st.box) { border = 3; outline = size / 4; outlineColour = st.box } else { border = 1; outline = st.stroke_width * H; outlineColour = st.stroke_color }
  const family = FONTS[st.font][1]
  const fields = [name, family, String(size), assColor(primary), assColor(st.color), assColor(outlineColour), assColor(st.shadow_color),
    st.bold ? '-1' : '0', st.italic ? '-1' : '0', '0', '0', '100', '100', num2(st.letter_spacing * size), '0', String(border), num2(outline), '0',
    String(ALIGN[st.align]), '0', '0', '0', '1']
  return 'Style: ' + fields.join(',')
}
const styleKey = st => JSON.stringify(Object.keys(st).sort().map(k => [k, st[k]]))

// ── animations ──────────────────────────────────────────────────────────────────────────────────────────────────
function anim(item) {
  const a = item.anim || {}
  const length = Math.trunc(item.end_ms) - Math.trunc(item.start_ms)
  let ik = (a.in || {}).kind, im = Math.trunc(Number((a.in || {}).ms || 0))
  let ok = (a.out || {}).kind, om = Math.trunc(Number((a.out || {}).ms || 0))
  if (!IN_KINDS.includes(ik)) { ik = null; im = 0 }
  if (!IN_KINDS.includes(ok)) { ok = null; om = 0 }
  if (im + om > length) { const total = im + om; im = Math.floor(length * im / total); om = length - im }
  const loop = (a.loop || {}).kind
  return [ik, im, ok, om, LOOP_KINDS.includes(loop) ? loop : 'none']
}
function offset(kind, W, H, entering) {
  const s = SLIDE_SHARE, r = RISE_SHARE
  if (kind === 'slide_up') return entering ? [0, rnd(s * H)] : [0, -rnd(s * H)]
  if (kind === 'slide_down') return entering ? [0, -rnd(s * H)] : [0, rnd(s * H)]
  if (kind === 'slide_left') return entering ? [rnd(s * W), 0] : [-rnd(s * W), 0]
  if (kind === 'slide_right') return entering ? [-rnd(s * W), 0] : [rnd(s * W), 0]
  if (kind === 'rise') return entering ? [0, rnd(r * H)] : [0, -rnd(r * H)]
  return [0, 0]
}
const MOVING = ['slide_up', 'slide_down', 'slide_left', 'slide_right', 'rise']
function inTags(kind, d, X, Y, W, H) {
  if (kind === 'fade') return `\\pos(${X},${Y})\\fad(${d},0)`
  if (MOVING.includes(kind)) { const [ox, oy] = offset(kind, W, H, true); return `\\move(${X + ox},${Y + oy},${X},${Y},0,${d})\\fad(${d},0)` }
  if (kind === 'pop') { const p = rnd(d * 0.6); return `\\pos(${X},${Y})\\fscx0\\fscy0\\t(0,${p},\\fscx${POP_SCALE}\\fscy${POP_SCALE})\\t(${p},${d},\\fscx100\\fscy100)` }
  if (kind === 'zoom') return `\\pos(${X},${Y})\\fscx${ZOOM_FROM}\\fscy${ZOOM_FROM}\\fad(${d},0)\\t(0,${d},\\fscx100\\fscy100)`
  return `\\pos(${X},${Y})`
}
function outTags(kind, d, X, Y, W, H) {
  if (kind === 'fade') return `\\pos(${X},${Y})\\fad(0,${d})`
  if (MOVING.includes(kind)) { const [ox, oy] = offset(kind, W, H, false); return `\\move(${X},${Y},${X + ox},${Y + oy},0,${d})\\fad(0,${d})` }
  if (kind === 'pop') { const p = rnd(d * 0.4); return `\\pos(${X},${Y})\\t(0,${p},\\fscx${POP_SCALE}\\fscy${POP_SCALE})\\t(${p},${d},\\fscx0\\fscy0)` }
  if (kind === 'zoom') return `\\pos(${X},${Y})\\fad(0,${d})\\t(0,${d},\\fscx${ZOOM_FROM}\\fscy${ZOOM_FROM})`
  return `\\pos(${X},${Y})`
}
function typewriter(text, d, entering) {
  const chars = Array.from(text)
  const n = Math.max(chars.length, 1)
  return chars.map((ch, i) => {
    const t = Math.floor((entering ? i : n - 1 - i) * d / n)
    return entering ? `{\\alpha&HFF&\\t(${t},${t + 1},\\alpha&H00&)}${escape(ch)}` : `{\\t(${t},${t + 1},\\alpha&HFF&)}${escape(ch)}`
  }).join('')
}
const shadowTags = (st, H) => (!st.shadow_x && !st.shadow_y ? '' : `\\xshad${num2(st.shadow_x * H)}\\yshad${num2(st.shadow_y * H)}`)

// ── word-timed captions ─────────────────────────────────────────────────────────────────────────────────────────
const wordsOf = item => (item.words || []).filter(w => String(w.text ?? '').trim())
function segments(item, words) {
  const start = Math.trunc(item.start_ms), end = Math.trunc(item.end_ms)
  const cuts = new Set([start, end])
  for (const w of words) for (const t of [Math.trunc(w.start_ms), Math.trunc(w.end_ms)]) if (start < t && t < end) cuts.add(t)
  const sorted = [...cuts].sort((a, b) => a - b)
  const segs = []
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i], b = sorted[i + 1]
    let idx = words.findIndex(w => Math.trunc(w.start_ms) <= a && a < Math.trunc(w.end_ms))
    if (idx < 0) idx = null
    if (segs.length && segs[segs.length - 1][2] === idx) segs[segs.length - 1] = [segs[segs.length - 1][0], b, idx]
    else segs.push([a, b, idx])
  }
  return segs
}
function wordsText(words, active, st, H) {
  const size = rnd(st.size * H)
  return words.map((w, i) => {
    let t = escape(String(w.text).trim())
    if (i === active && st.mode === 'word') t = `{\\1c${colorTag(st.highlight)}}${t}{\\1c${colorTag(st.color)}}`
    else if (i === active && st.mode === 'box') {
      const baseBord = num2(st.box ? size / 4 : st.stroke_width * H)
      const baseCol = st.box || st.stroke_color
      t = `{\\3c${colorTag(st.highlight)}\\bord${num2(size * 0.18)}}${t}{\\3c${colorTag(baseCol.slice(0, 7))}\\bord${baseBord}}`
    }
    return t
  }).join(' ')
}
function karaokeText(item, words, offsetMs) {
  const c = ms => Math.floor((Math.trunc(ms) - offsetMs + 5) / 10)
  const out = []
  let at = c(Math.trunc(item.start_ms))
  words.forEach((w, i) => {
    const s = c(Math.max(Math.trunc(w.start_ms), Math.trunc(item.start_ms))), e = c(Math.min(Math.trunc(w.end_ms), Math.trunc(item.end_ms)))
    const gap = i ? ' ' : ''
    if (s > at || gap) { out.push(`{\\k${Math.max(s - at, 0)}}${gap}`); at = Math.max(s, at) }
    out.push(`{\\k${Math.max(e - at, 0)}}${escape(String(w.text).trim())}`)
    at = Math.max(e, at)
  })
  return out.join('')
}

// ── events ──────────────────────────────────────────────────────────────────────────────────────────────────────
const dialogue = (a, b, st, text) => `Dialogue: 0,${assTime(a)},${assTime(b)},${st},,0,0,0,,${text}`
const linesOf = item => String(item.text || '').split('\n')
const lineY = (Y, i, k, st, H) => rnd(Y + (i - (k - 1) / 2) * rnd(st.size * H) * st.line_spacing)
const posOf = (item, k, d) => Number(item[k] ?? d)

function tagEvents(item, st, sty, W, H) {
  const start = Math.trunc(item.start_ms), end = Math.trunc(item.end_ms)
  const X = rnd(posOf(item, 'x', 0.5) * W), Yc = posOf(item, 'y', 0.85) * H
  const an = `\\an${ALIGN[st.align]}`
  const shad = shadowTags(st, H)
  const words = wordsOf(item)
  if (st.mode !== 'none' && words.length) {
    const Y = rnd(Yc)
    if (st.mode === 'karaoke') return [dialogue(start, end, sty, `{${an}\\pos(${X},${Y})${shad}}` + karaokeText(item, words, start))]
    return segments(item, words).map(([a, b, idx]) => dialogue(a, b, sty, `{${an}\\pos(${X},${Y})${shad}}` + wordsText(words, idx, st, H)))
  }
  const [ik, im, ok, om, loop] = anim(item)
  const parts = []
  if (ik && im) parts.push(['in', start, start + im])
  const midA = start + im, midB = end - om
  if (midB > midA) {
    if (loop === 'float') {
      let t = midA, j = 0
      while (t < midB) { parts.push([`float${j % 2}`, t, Math.min(t + LOOP_PERIOD_MS / 2, midB)]); t += LOOP_PERIOD_MS / 2; j++ }
    } else parts.push(['mid', midA, midB])
  }
  if (ok && om) parts.push(['out', end - om, end])
  const lines = linesOf(item)
  const out = []
  for (const [kind, a, b] of parts) {
    const d = b - a
    lines.forEach((line, li) => {
      const Y = lineY(Yc, li, lines.length, st, H)
      let tags, body
      if (kind === 'in') { tags = inTags(ik, d, X, Y, W, H); body = ik === 'typewriter' ? typewriter(line, d, true) : escape(line) }
      else if (kind === 'out') { tags = outTags(ok, d, X, Y, W, H); body = ok === 'typewriter' ? typewriter(line, d, false) : escape(line) }
      else if (kind.startsWith('float')) {
        const o = rnd(FLOAT_SHARE * H)
        const [y0, y1] = kind === 'float0' ? [Y, Y - o] : [Y - o, Y]
        tags = `\\move(${X},${y0},${X},${y1},0,${d})`; body = escape(line)
      } else {
        tags = `\\pos(${X},${Y})`; body = escape(line)
        if (loop === 'pulse') {
          const half = LOOP_PERIOD_MS / 2, steps = Math.ceil(d / half)
          for (let k = 0; k < steps; k++) { const s = k % 2 === 0 ? PULSE_SCALE : 100; tags += `\\t(${k * half},${(k + 1) * half},\\fscx${s}\\fscy${s})` }
        }
      }
      out.push(dialogue(a, b, sty, `{${an}${tags}${shad}}${body}`))
    })
  }
  return out
}

const kf = (keys, t, d) => (keys && keys.length ? evaluate(keys, t) : d)

function frameAnim(item, t, W, H) {
  const [ik, im, ok, om, loop] = anim(item)
  const length = Math.trunc(item.end_ms) - Math.trunc(item.start_ms)
  let alpha = 1, dx = 0, dy = 0, scale = 100, tw = null
  const ramp = (kind, p, entering) => {
    const q = entering ? p : 1 - p
    if (['fade', ...MOVING, 'zoom'].includes(kind)) alpha *= q
    if (MOVING.includes(kind)) { const [ox, oy] = offset(kind, W, H, entering); dx = rnd(ox * (1 - q)); dy = rnd(oy * (1 - q)) }
    if (kind === 'zoom') scale = rnd(ZOOM_FROM + (100 - ZOOM_FROM) * q)
    if (kind === 'pop') {
      const cut = entering ? 0.6 : 0.4
      if (entering) scale = p < cut ? rnd(POP_SCALE * p / cut) : rnd(POP_SCALE + (100 - POP_SCALE) * (p - cut) / (1 - cut))
      else scale = p < cut ? rnd(100 + (POP_SCALE - 100) * p / cut) : rnd(POP_SCALE * (1 - (p - cut) / (1 - cut)))
    }
    if (kind === 'typewriter') tw = [entering ? 'in' : 'out', p]
  }
  if (ik && im && t < im) ramp(ik, t / im, true)
  else if (ok && om && t >= length - om) ramp(ok, (t - (length - om)) / om, false)
  else {
    const m = t - im
    const half = LOOP_PERIOD_MS / 2
    const phase = (((m % LOOP_PERIOD_MS) + LOOP_PERIOD_MS) % LOOP_PERIOD_MS) / half
    const tri = phase <= 1 ? phase : 2 - phase
    if (loop === 'pulse') scale = rnd(100 + (PULSE_SCALE - 100) * tri)
    else if (loop === 'float') dy = -rnd(rnd(FLOAT_SHARE * H) * tri)
  }
  return [alpha, dx, dy, scale, tw]
}

function frameEvents(item, st, sty, W, H, rate) {
  const start = Math.trunc(item.start_ms), end = Math.trunc(item.end_ms)
  const kfs = item.keyframes || {}
  const an = `\\an${ALIGN[st.align]}`
  const shad = shadowTags(st, H)
  const words = wordsOf(item)
  const lines = linesOf(item)
  const streams = new Map()
  for (let n = 0; ; n++) {
    const a = start + frameMs(n, rate)
    if (a >= end) break
    const b = Math.min(start + frameMs(n + 1, rate), end)
    const t = a - start
    const x = kf(kfs.x, t, posOf(item, 'x', 0.5)), y = kf(kfs.y, t, posOf(item, 'y', 0.85)), op = kf(kfs.opacity, t, 1)
    const worded = st.mode !== 'none' && words.length > 0
    const [fa, dx, dy, scale, tw] = worded ? [1, 0, 0, 100, null] : frameAnim(item, t, W, H)
    const X = rnd(x * W) + dx
    const texts = []
    if (worded) {
      const Y = rnd(y * H) + dy
      let body
      if (st.mode === 'karaoke') {
        body = words.map(w => (Math.trunc(w.start_ms) <= a ? `{\\1c${colorTag(st.highlight)}}` : `{\\1c${colorTag(st.color)}}`) + escape(String(w.text).trim())).join(' ')
      } else {
        let idx = words.findIndex(w => Math.trunc(w.start_ms) <= a && a < Math.trunc(w.end_ms))
        if (idx < 0) idx = null
        body = wordsText(words, idx, st, H)
      }
      texts.push([Y, body])
    } else {
      lines.forEach((line, li) => {
        const Y = lineY(y * H, li, lines.length, st, H) + dy
        let body
        if (tw) {
          const chars = Array.from(line)
          let k = Math.floor(tw[1] * chars.length + 1e-9)
          if (tw[0] === 'out') k = chars.length - k
          body = escape(chars.slice(0, k).join(''))
          if (k < chars.length) body += '{\\alpha&HFF&}' + escape(chars.slice(k).join(''))
        } else body = escape(line)
        texts.push([Y, body])
      })
    }
    const sc = scale !== 100 ? `\\fscx${scale}\\fscy${scale}` : ''
    const al = `\\alpha${alphaTag(op * fa)}`
    texts.forEach(([Y, body], li) => {
      const text = `{${an}\\pos(${X},${Y})${al}${sc}${shad}}${body}`
      if (!streams.has(li)) streams.set(li, [])
      const stream = streams.get(li)
      const last = stream[stream.length - 1]
      if (last && last[2] === text && last[1] === a) last[1] = b
      else stream.push([a, b, text])
    })
  }
  const rows = []
  for (const [li, stream] of streams) for (const ev of stream) rows.push([ev[0], li, ev])
  rows.sort((p, q) => p[0] - q[0] || p[1] - q[1])
  return rows.map(([, , ev]) => dialogue(ev[0], ev[1], sty, ev[2]))
}

const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// The ASS script of one text track.
export function assScript(doc, track, width, height) {
  const W = Math.trunc(width), H = Math.trunc(height)
  const rate = Math.trunc(doc?.rate || 30)
  const items = (track.items || []).filter(i => (i.type ?? 'text') === 'text')
    .sort((p, q) => Math.trunc(p.start_ms) - Math.trunc(q.start_ms) || cmpStr(String(p.id || ''), String(q.id || '')))
  const styles = new Map()
  const styleLines = [], events = []
  for (const item of items) {
    const st = style(item)
    const key = styleKey(st)
    if (!styles.has(key)) { styles.set(key, `S${styles.size + 1}`); styleLines.push(styleLine(styles.get(key), st, H)) }
    const kfs = item.keyframes || {}
    if (['x', 'y', 'opacity'].some(k => kfs[k]?.length)) events.push(...frameEvents(item, st, styles.get(key), W, H, rate))
    else events.push(...tagEvents(item, st, styles.get(key), W, H))
  }
  const out = ['[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 2',
    'ScaledBorderAndShadow: yes', 'YCbCr Matrix: None', '', '[V4+ Styles]', STYLE_FORMAT, ...styleLines, '',
    '[Events]', EVENT_FORMAT, ...events]
  return out.join('\n') + '\n'
}

// The font files a script's tracks need, as JASSUB's availableFonts (family, "family bold" → address).
export function fontFiles(base = '/fonts/editor/') {
  const dirOf = f => f.replace(/-(Variable|Regular|Bold)\.ttf$/, '').replace(/\.ttf$/, '').toLowerCase().replace(/[^a-z]/g, '')
  const map = {}
  for (const [, family, files] of Object.values(FONTS)) {
    for (const f of files) {
      const dir = /^DejaVu/.test(f) ? 'dejavu' : dirOf(f)
      const bold = /Bold/.test(f)
      const key = (bold ? `${family} bold` : family).toLowerCase()
      if (!map[key]) map[key] = `${base}${dir}/${f}`
    }
  }
  return map
}
