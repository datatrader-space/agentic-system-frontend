// The golden-frame test's page logic (contract section 10, plan P3, ADM-1199). For one sample and one time: load its
// media, put each clip's element on its exact frame, draw the frame with the editor's compositor (the monitor's code),
// lay the text over it with libass (JASSUB) as the export does, imitate the export's yuv420p, and compare with the
// reference PNG by PSNR. Everything runs in the page; Node only reads the files list.
import { clipsOf, frameAt } from '/src/components/clip-editor/render/scene.js'
import { Compositor } from '/src/components/clip-editor/render/compositor.js'
import { parseCube } from '/src/components/clip-editor/render/ffmpegMath.js'
import { assScript } from '/src/components/clip-editor/render/assScript.js'
import { frameReady } from '/src/components/clip-editor/render/sources.js'

const kindOf = file => (/\.(png|jpe?g|webp|gif)$/i.test(file) ? 'image' : /\.cube$/i.test(file) ? 'lut' : 'video')
const load = (el, ev) => new Promise((res, rej) => { el.addEventListener(ev, res, { once: true }); el.addEventListener('error', () => rej(new Error(`cannot load ${el.src}`)), { once: true }) })

// A plain canvas, not an OffscreenCanvas: the harness runs in every browser the test is pointed at (GOLDEN_BROWSER).
function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

async function pixelsOf(url, w, h) {
  const img = new Image()
  img.src = url
  await load(img, 'load')
  const c = newCanvas(w || img.naturalWidth, h || img.naturalHeight)
  const g = c.getContext('2d', { colorSpace: 'srgb' })
  g.drawImage(img, 0, 0, c.width, c.height)
  return { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }
}

// PSNR over R, G and B (dB; Infinity when identical).
function psnr(a, b) {
  let se = 0, n = 0
  for (let i = 0; i < a.length; i += 4) for (let c = 0; c < 3; c++) { const d = a[i + c] - b[i + c]; se += d * d; n++ }
  return se === 0 ? Infinity : 10 * Math.log10((255 * 255) / (se / n))
}

// The step it is at, for a test that times out.
const step = name => { window.goldenStep = name }

// One video element per (clip, file), on the exact frame of `ms`.
async function videoAt(url, name, ms) {
  step(`video ${name}`)
  const v = document.createElement('video')
  v.muted = true; v.preload = 'auto'; v.src = url
  document.body.appendChild(v)
  await load(v, 'loadeddata').catch(() => { throw new Error(`this browser cannot play ${name} (run with GOLDEN_CHANNEL=chrome for H.264)`) })
  // A hair past the frame's time, so the frame shown is the one ffmpeg's fps filter takes for it.
  v.currentTime = Math.max(ms, 0) / 1000 + 0.0005
  step(`seek ${name} to ${ms} ms`)
  await frameReady(v)
  return v
}

// args: base (the reference folder's address), sample, t, reference (PNG file name), media ({id: file}),
// derived ({"<id>:<op>": <media id>}: the reversed copy, the background-removal matte), chroma420 ('nearest' as
// swscale's default rgb24 conversion of the backend's PNGs, 'bilinear', or 'off').
window.golden = async function golden({ base, sample, t, reference, media = {}, derived = {}, chroma420 = 'nearest' }) {
  step('reference')
  const ref = await pixelsOf(`${base}/${reference}`)
  const W = ref.w, H = ref.h
  const canvas = document.getElementById('gl')
  canvas.width = W; canvas.height = H
  const comp = new Compositor(canvas, { preserveDrawingBuffer: true })
  if (!comp.supported) throw new Error('WebGL 2 is not available in this browser')
  comp.resize(W, H)
  comp.exact = true
  const files = { ...media, ...(sample.media || {}) }
  const urlOf = id => (files[id] ? `${base}/${files[id]}` : null)
  const doc = sample.doc
  const frame = frameAt(doc, t, { rate: doc.rate || 30, media: Object.fromEntries(Object.entries(files).map(([id, f]) => [id, { media_type: kindOf(f) }])) })

  // Each clip's element on its exact frame.
  const pictures = new Map(), mattes = new Map(), images = new Map(), luts = new Map()
  for (const clip of frame.layers.flatMap(l => clipsOf(l.node))) {
    if (clip.kind === 'compound') continue
    const url = urlOf(clip.media)
    if (!url) throw new Error(`sample ${sample.id}: no file for media ${clip.media}`)
    if (kindOf(files[clip.media]) === 'image') {
      if (!images.has(url)) { const img = new Image(); img.src = url; await load(img, 'load'); images.set(url, img) }
      pictures.set(clip.id, { el: images.get(url), w: images.get(url).naturalWidth, h: images.get(url).naturalHeight, key: `i:${url}`, version: 1, subsampled: false })
      continue
    }
    let v
    const reversed = clip.reverse && derived[`${clip.media}:reverse`]
    if (reversed) {
      // editor_export: the source range [in, out) is [dur - out, dur - in) of the reversed file.
      const r = await videoAt(urlOf(reversed), files[reversed], 0)
      const dur = Math.round(r.duration * 1000)
      r.remove()
      v = await videoAt(urlOf(reversed), files[reversed], Math.max(dur - clip.sourceOut, 0) + (clip.sourceMs - clip.sourceIn))
    } else v = await videoAt(url, files[clip.media], clip.sourceMs)
    pictures.set(clip.id, { el: v, w: v.videoWidth, h: v.videoHeight, key: `v:${clip.id}:${t}`, version: null, subsampled: true })
    const matte = clip.effects.some(e => e.kind === 'bg_removal') && derived[`${clip.media}:bg_removal`]
    if (matte) {
      const m = await videoAt(urlOf(matte), files[matte], clip.sourceMs)
      mattes.set(clip.id, { el: m, w: m.videoWidth, h: m.videoHeight, key: `m:${clip.id}:${t}`, version: null, subsampled: true })
    }
    for (const e of clip.effects) {
      if (e.kind !== 'lut' || luts.has(e.params?.media)) continue
      const lut = parseCube(await (await fetch(urlOf(e.params.media))).text())
      lut.key = e.params.media
      luts.set(e.params.media, lut)
    }
  }
  if (frame.background.kind === 'image') {
    const url = urlOf(frame.background.media)
    const img = new Image(); img.src = url; await load(img, 'load'); images.set(url, img)
  }
  const sources = {
    picture: clip => pictures.get(clip.id) || null,
    image: id => { const img = images.get(urlOf(id)); return img ? { el: img, w: img.naturalWidth, h: img.naturalHeight, key: `bg:${id}`, version: 1 } : null },
    lut: (clip, e) => luts.get(e.params?.media) || null,
    matte: clip => mattes.get(clip.id) || null,
  }
  step('render')
  comp.render(frame, sources, { toCanvas: false })

  // Text tracks, drawn last in track order, like the export's `ass` filters.
  const textTracks = (doc.tracks || []).filter(tr => tr.kind === 'text' && !tr.hide && (tr.items || []).length)
  if (textTracks.length) {
    const { TextRenderer } = await import('/src/components/clip-editor/render/textRenderer.js')
    for (const track of textTracks) {
      step(`text ${track.id}`)
      const r = new TextRenderer(document.createElement('canvas'), { fontsBase: '/fonts/editor/' })
      await r.start(assScript(doc, track, W, H), W, H)
      await r.draw(t, W, H, true)
      const cap = await r.capture(t)
      if (cap) comp.overlay({ pixels: new Uint8Array(cap.data.buffer || cap.data), w: cap.width, h: cap.height, key: `t:${track.id}`, version: null })
      await r.destroy()
    }
  }
  const ours = comp.readPixels({ chroma420: chroma420 === true ? 'nearest' : chroma420 || 'off' })
  const score = psnr(ours, ref.data)
  // The rendered frame as a PNG (kept by the test when it fails).
  const out = newCanvas(W, H)
  out.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(ours.buffer), W, H), 0, 0)
  const blob = await new Promise(res => out.toBlob(res, 'image/png'))
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  const png = btoa(bin)
  comp.dispose()
  document.querySelectorAll('video').forEach(v => v.remove())
  return { psnr: score === Infinity ? 999 : score, width: W, height: H, png }
}
window.goldenReady = true
