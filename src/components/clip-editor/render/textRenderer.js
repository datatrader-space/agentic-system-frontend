// Text drawn by libass in the browser (contract section 8, plan P4, ADM-1199): the ASS script of each text track
// (assScript.js, identical to the export's) rendered by JASSUB's worker into a canvas laid over the WebGL picture, with
// the same font files as the export (public/fonts/editor = video_studio/fonts).
//
// JASSUB's own front module is NOT used: it imports rvfc-polyfill, which is GPL-3.0, and code the browser runs is never
// GPL (plan P13). This thin client talks to JASSUB's unmodified worker the way that module does (abslink, Apache-2.0),
// for canvas-only rendering: resize, draw at a time, and a pixel capture for the golden-frame test.

import { fontFiles } from './assScript'

let assets = null
const loadAssets = () => (assets ||= Promise.all([import('./jassubAssets.js'), import('abslink'), import('abslink/w3c')]))

// Whether relaxed SIMD WebAssembly runs here (JASSUB's own test, MIT): the faster build needs it.
function simd() {
  try {
    return WebAssembly.validate(Uint8Array.of(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
      0x03, 0x02, 0x01, 0x00, 0x0a, 0x2b, 0x01, 0x29, 0x00, 0xfd, 0x0c, ...new Array(16).fill(0), 0xfd, 0x0c, ...new Array(16).fill(0), 0xfd, 0x80, 0x02, 0x0b))
  } catch { return false }
}

export const textSupported = () => typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof WebAssembly !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype

// The font files a script's styles name (its Fontname, and the bold file when the style is bold), so they are loaded
// before the first frame is drawn: JASSUB otherwise fetches a font only when libass first asks for it, and that frame
// is drawn without the text.
export function fontsFor(script, base = '/fonts/editor/') {
  const files = fontFiles(base), urls = new Set([files['dejavu sans']])
  for (const line of String(script).split(/\n/)) {
    if (!line.startsWith('Style: ')) continue
    const f = line.slice(7).split(',')
    const family = (f[1] || '').trim().toLowerCase(), bold = f[7] === '-1'
    const url = (bold && files[`${family} bold`]) || files[family]
    if (url) urls.add(url)
  }
  return [...urls].filter(Boolean)
}

export class TextRenderer {
  // `canvas` is given over to the worker (it can then only be shown, not drawn on here).
  constructor(canvas, { fontsBase = '/fonts/editor/' } = {}) {
    this.canvas = canvas
    this.fontsBase = fontsBase
    this.ready = null
    this.renderer = null
    this.busy = false
    this.pending = null
    this.size = [0, 0]
    this.script = ''
  }
  async start(script, width, height) {
    if (this.ready) return this.ready
    this.script = script
    this.ready = (async () => {
      const [{ workerUrl, wasmUrl, modernWasmUrl }, { proxy, transfer }, { wrap }] = await loadAssets()
      this.canvas.width = Math.max(1, width); this.canvas.height = Math.max(1, height)
      const ctrl = this.canvas.transferControlToOffscreen()
      this.worker = new Worker(workerUrl, { name: 'jassub-worker', type: 'module' })
      const Renderer = wrap(this.worker)
      this.renderer = await new Renderer({
        wasmUrl: simd() ? modernWasmUrl : wasmUrl, width: ctrl.width, height: ctrl.height, subContent: script, fonts: fontsFor(script, this.fontsBase),
        availableFonts: fontFiles(this.fontsBase), defaultFont: 'dejavu sans', debug: false, libassMemoryLimit: 0, libassGlyphLimit: 0,
        // Fonts come only from the files listed: never the person's own fonts, never a font service.
        queryFonts: false,
      }, proxy(() => undefined), transfer(ctrl, [ctrl]))
      this.loaded = new Set(fontsFor(script, this.fontsBase))
      this.size = [ctrl.width, ctrl.height]
      await this.renderer._resizeCanvas(this.size[0], this.size[1], 0, 0)
    })()
    return this.ready
  }
  async setScript(script) {
    if (!this.renderer || script === this.script) return
    this.script = script
    const fonts = fontsFor(script, this.fontsBase).filter(u => !this.loaded?.has(u))
    if (fonts.length) { await this.renderer.addFonts(fonts); fonts.forEach(u => this.loaded.add(u)) }
    await this.renderer.setTrack(script)
  }
  // Draws the text at `ms` (timeline time). The script's PlayRes is the export's size; the canvas is drawn at
  // width x height (libass scales everything by the same factor).
  async draw(ms, width, height, repaint = false) {
    if (!this.renderer) return
    this.pending = { ms, width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), repaint }
    if (this.busy) return
    this.busy = true
    try {
      while (this.pending) {
        const p = this.pending
        this.pending = null
        if (p.width !== this.size[0] || p.height !== this.size[1]) {
          this.size = [p.width, p.height]
          await this.renderer._resizeCanvas(p.width, p.height, 0, 0)
          p.repaint = true
        }
        await this.renderer._draw(p.ms / 1000, p.repaint)
      }
    } finally { this.busy = false }
  }
  // The pixels of the text at `ms` ({data: RGBA top row first, width, height}), for the golden-frame test.
  async capture(ms) {
    if (!this.renderer) return null
    return this.renderer._drawCapture(ms / 1000)
  }
  async destroy() {
    try { await this.ready } catch { /* never started */ }
    try { this.renderer?.[(await loadAssets())[1].releaseProxy]?.() } catch { /* gone */ }
    this.worker?.terminate()
    this.renderer = null
  }
}
