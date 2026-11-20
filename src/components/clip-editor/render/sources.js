// The pictures and sounds the monitor draws (plan P1 and P11, ADM-1199): one media element per clip (two clips of the
// same file in a transition each need their own frame), kept at the time the timeline says. Video frames are
// scheduled with requestVideoFrameCallback where the browser has it, so a texture is uploaded only for a new frame
// and the monitor knows when frames fall behind. Pictures and .cube files are loaded once per address.
//
// Every address must be same-origin or served with CORS: a picture from another origin without it cannot become a
// WebGL texture (the browser refuses a "tainted" source).

import { parseCube } from './ffmpegMath'

const RATE_LIMITS = [0.0625, 16]
const hasRvfc = typeof HTMLVideoElement !== 'undefined' && 'requestVideoFrameCallback' in HTMLVideoElement.prototype

export class MediaSources {
  // resolve(clip) → {url, kind: 'video' | 'image' | 'audio', map?: ms => ms} or null; lutUrl(mediaId), matteUrl(clip)
  // holder: an element the media elements live in (in the page, so frames keep coming); onCreate(key, el) when one is made.
  constructor({ resolve, imageUrl = () => null, lutUrl = () => null, matteUrl = () => null, onChange = () => {}, holder = null, onCreate = null } = {}) {
    Object.assign(this, { resolve, imageUrl, lutUrl, matteUrl, onChange, holder, onCreate })
    this.els = new Map()      // key -> entry {el, url, kind, version, presented, late}
    this.images = new Map()   // url -> {img, ok}
    this.luts = new Map()     // url -> {lut | error | loading}
    this.stats = { frames: 0, late: 0 }
  }

  // ── elements ───────────────────────────────────────────────────────────────────────────────────────────────────
  entry(key, url, kind) {
    let e = this.els.get(key)
    if (e && e.url === url) return e
    if (e) this.drop(key)
    const el = document.createElement(kind === 'audio' ? 'audio' : 'video')
    el.crossOrigin = 'anonymous'
    el.preload = 'auto'
    el.playsInline = true
    el.disablePictureInPicture = true
    el.src = url
    e = { key, el, url, kind, version: 0, presented: -1, want: 0, used: 0 }
    const bump = () => { e.version++; this.onChange() }
    el.addEventListener('loadeddata', bump)
    el.addEventListener('seeked', bump)
    if (hasRvfc && kind !== 'audio') {
      const tick = (now, meta) => {
        if (!this.els.has(key) || this.els.get(key) !== e) return
        e.version++
        e.presented = meta.mediaTime
        this.stats.frames++
        if (!el.paused && Math.abs(meta.mediaTime - e.want) > 0.1) this.stats.late++
        el.requestVideoFrameCallback(tick)
      }
      el.requestVideoFrameCallback(tick)
    }
    this.els.set(key, e)
    this.holder?.appendChild(el)
    this.onCreate?.(key, el)
    return e
  }
  drop(key) {
    const e = this.els.get(key)
    if (!e) return
    e.el.pause(); e.el.removeAttribute('src'); e.el.load(); e.el.remove()
    this.els.delete(key)
    this.onDrop?.(key, e.el)
  }
  element(id) { return this.els.get(id)?.el || null }

  // Keeps each clip's element where the timeline says at time t. `clips` are scene clip states (pictures) and
  // `sounds` {item, track, sourceMs, speed} of sound-only clips; elements not needed now are paused, and dropped after
  // a while. Returns nothing; draw with picture().
  // `rate` is the editor's shuttle rate (J/K/L: 2, 4, 8, negative backwards): elements play at speed x rate; backwards
  // they are paused and put on each frame instead (a media element cannot play backwards).
  sync(clips, sounds, { playing = false, frameMs = 33, tick = 0, rate: shuttle = 1 } = {}) {
    const wanted = new Set()
    const keep = (key, url, kind, sourceMs, speed) => {
      const e = this.entry(key, url, kind)
      wanted.add(key)
      e.used = tick
      const want = sourceMs / 1000
      e.want = want
      const el = e.el
      if (playing && speed > 0 && shuttle > 0) {
        const rate = Math.min(Math.max(speed * shuttle, RATE_LIMITS[0]), RATE_LIMITS[1])
        if (Math.abs(el.playbackRate - rate) > 1e-3) el.playbackRate = rate
        // Within a few frames the element plays on; further off, it is put back in place.
        if (Math.abs(el.currentTime - want) > Math.max(0.15, 4 * frameMs / 1000) && !el.seeking) el.currentTime = want
        if (el.paused) el.play?.()?.catch(() => {})
      } else {
        if (!el.paused) el.pause()
        if (Math.abs(el.currentTime - want) > frameMs / 2000 && !el.seeking) { try { el.currentTime = want } catch { /* not loaded */ } }
      }
    }
    for (const c of clips) {
      const r = this.resolve(c)
      if (!r || r.kind === 'image') continue
      keep(c.id, r.url, 'video', r.map ? r.map(c.sourceMs) : c.sourceMs, c.freeze ? 0 : c.speed)
      const matte = c.effects.some(e => e.kind === 'bg_removal') ? this.matteUrl(c) : null
      if (matte) keep(`${c.id}:matte`, matte, 'video', c.sourceMs, c.speed)
    }
    for (const s of sounds) {
      const r = this.resolve({ id: s.item.id, media: s.item.media, kind: 'audio' })
      if (r) keep(s.item.id, r.url, r.kind === 'video' ? 'video' : 'audio', s.sourceMs, s.speed)
    }
    for (const [key, e] of this.els) {
      if (wanted.has(key)) continue
      if (!e.el.paused) e.el.pause()
      if (tick - e.used > 600) this.drop(key)
    }
  }
  // Starts loading clips that will be needed soon (the next cut), at their first frame.
  prepare(clips) {
    for (const c of clips) {
      const r = this.resolve(c)
      if (!r || r.kind === 'image' || this.els.has(c.id)) continue
      const e = this.entry(c.id, r.url, 'video')
      try { e.el.currentTime = (r.map ? r.map(c.sourceMs) : c.sourceMs) / 1000 } catch { /* not loaded */ }
    }
  }

  // ── what the compositor draws ────────────────────────────────────────────────────────────────────────────────
  // A clip's picture now: {el, w, h, key, version, subsampled} or null while it is not ready.
  picture(clip) {
    const r = this.resolve(clip)
    if (!r) return null
    if (r.kind === 'image') return this.imageSource(r.url)
    const e = this.els.get(clip.id)
    if (!e || e.el.readyState < 2 || !e.el.videoWidth) return null
    return { el: e.el, w: e.el.videoWidth, h: e.el.videoHeight, key: `v:${clip.id}:${e.url}`, version: hasRvfc ? e.version : null, subsampled: true }
  }
  matte(clip) {
    const e = this.els.get(`${clip.id}:matte`)
    if (!e || e.el.readyState < 2 || !e.el.videoWidth) return null
    return { el: e.el, w: e.el.videoWidth, h: e.el.videoHeight, key: `m:${clip.id}:${e.url}`, version: hasRvfc ? e.version : null, subsampled: true }
  }
  image(mediaId) { const url = this.imageUrl(mediaId); return url ? this.imageSource(url) : null }
  imageSource(url) {
    let i = this.images.get(url)
    if (!i) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      i = { img, ok: false }
      img.onload = () => { i.ok = true; this.onChange() }
      img.onerror = () => { i.error = true }
      img.src = url
      this.images.set(url, i)
    }
    return i.ok ? { el: i.img, w: i.img.naturalWidth, h: i.img.naturalHeight, key: `i:${url}`, version: 1, subsampled: false } : null
  }
  // The parsed .cube of a lut effect (null while it loads; an error is kept and reported by lutError).
  lut(clip, effect) {
    const url = this.lutUrl(effect.params?.media)
    if (!url) return null
    let l = this.luts.get(url)
    if (!l) {
      l = { loading: true }
      this.luts.set(url, l)
      fetch(url, { credentials: 'same-origin' }).then(r => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then(text => { const lut = parseCube(text); lut.key = url; l.lut = lut })
        .catch(e => { l.error = e.message || 'The LUT could not be read.' })
        .finally(() => { l.loading = false; this.onChange() })
    }
    return l.lut || null
  }

  // Whether every listed clip shows the frame of its time (for a paused frame, "exact" and golden frames).
  async settled(clips, { timeoutMs = 4000 } = {}) {
    const waits = []
    for (const c of clips) {
      const r = this.resolve(c)
      if (!r) continue
      if (r.kind === 'image') {
        const i = this.images.get(r.url) || (this.imageSource(r.url), this.images.get(r.url))
        if (!i.ok && !i.error) waits.push(new Promise(res => { i.img.addEventListener('load', res, { once: true }); i.img.addEventListener('error', res, { once: true }) }))
        continue
      }
      const e = this.els.get(c.id)
      if (!e) continue
      waits.push(frameReady(e.el))
    }
    await Promise.race([Promise.all(waits), new Promise(res => setTimeout(res, timeoutMs))])
  }
  // The share of frames that came late since the last call (0..1), for the "falling behind" notice.
  lateness() {
    const { frames, late } = this.stats
    this.stats = { frames: 0, late: 0 }
    return frames ? late / frames : 0
  }
  dispose() { for (const k of [...this.els.keys()]) this.drop(k); this.images.clear(); this.luts.clear() }
}

// Resolves once the element has decoded the frame at its current time (after a seek): on the next presented frame,
// or — where a paused element presents none (some headless browsers) — a moment after the seek completes.
export function frameReady(el, { graceMs = 120 } = {}) {
  return new Promise(res => {
    let done = false
    const finish = () => { if (!done) { done = true; res() } }
    const afterSeek = () => {
      if (el.readyState >= 2) {
        if (hasRvfc) el.requestVideoFrameCallback(finish)
        setTimeout(finish, graceMs)
      } else el.addEventListener('loadeddata', finish, { once: true })
    }
    if (el.seeking) el.addEventListener('seeked', afterSeek, { once: true })
    else afterSeek()
  })
}
