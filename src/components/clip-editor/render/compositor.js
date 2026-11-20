// The preview compositor (plan P1, ADM-1199): draws one frame of the timeline (scene.frameAt) into one WebGL2 canvas,
// pass by pass, in the order the export's ffmpeg graph runs. Text is not drawn here: libass draws it over this canvas
// (render/textRenderer.js), as the export draws it last.
//
// The graph it follows is the export's (video_studio/services/compositor.py, "How one clip on a video track is
// drawn"); each pass's formula is in shaders.js, each effect's filter options in effectParams.js.
//
// Sources are given per frame by the caller: `sources.picture(clip)` returns {el, w, h, key, version, subsampled} for
// a clip's picture (a <video>, <img> or ImageBitmap already at the right time), `sources.image(mediaId)` the same for
// a picture background, `sources.lut(clip, effect)` a parsed .cube, `sources.matte(clip)` the background-removal matte.

import * as S from './shaders'
import { cropBox, even, fitSize, frandTable, overlayXY, rotateSteps, swsFilter, swsFilters } from './ffmpegMath'
import { canvasBlurKernel, effectSteps } from './effectParams'

// compositor.py ROTATE_PAD: the transparent border, holding the picture's edge colours, a picture gets before it turns.
export const ROTATE_PAD = 16
// get_local_pos() of a 4:2:0 colour plane sited at the centre of its block (swscale's default): 128.
const CHROMA_POS = 128

// The SCALE pass's filter texture (R32F, shaders.js SCALE): the across filter (a row of first source columns, then a
// row per tap) above the down filter (the same, for rows).
function swsTable(w, h, ow, oh, chroma = false) {
  const { h: H, v: V } = chroma
    ? { h: swsFilter(w, ow, 1 << 14, 4, 128, CHROMA_POS), v: swsFilter(h, oh, 1 << 12, 2, 128, CHROMA_POS) }
    : swsFilters(w, h, ow, oh)
  const width = Math.max(ow, oh), rows = 2 + H.size + V.size
  const data = new Float32Array(width * rows)
  const put = (F, n, row0) => {
    for (let i = 0; i < n; i++) {
      data[row0 * width + i] = F.pos[i]
      for (let j = 0; j < F.size; j++) data[(row0 + 1 + j) * width + i] = F.w[i * F.size + j]
    }
  }
  put(H, ow, 0); put(V, oh, 1 + H.size)
  return { data, w: width, h: rows, format: 'r32f', meta: { taps: [H.size, V.size] } }
}

export class Compositor {
  constructor(canvas, { preserveDrawingBuffer = false } = {}) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer })
    this.gl = gl
    this.supported = !!gl
    if (!gl) return
    this.float = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))
    this.programs = {}
    this.pool = []               // free framebuffers
    this.textures = new Map()    // source key -> {tex, version}
    this.tables = new Map()      // computed tables (kernels, curves, LUTs) by key
    this.noise = null
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    this.vao = gl.createVertexArray()
    gl.bindVertexArray(this.vao)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    this.width = canvas.width; this.height = canvas.height
    this.exact = false     // true: no simplification anywhere (golden frames, a paused frame)
    this.simplify = false  // true while playback is behind: blur and hblur skip taps (the export never does)
  }

  resize(w, h) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h))
    if (this.canvas.width !== w) this.canvas.width = w
    if (this.canvas.height !== h) this.canvas.height = h
    this.width = w; this.height = h
  }

  // ── GL plumbing ──────────────────────────────────────────────────────────────────────────────────────────────
  program(name) {
    if (this.programs[name]) return this.programs[name]
    const gl = this.gl
    const sh = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader ${name}: ${gl.getShaderInfoLog(s)}`)
      return s
    }
    const p = gl.createProgram()
    gl.attachShader(p, sh(gl.VERTEX_SHADER, S.VERTEX)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, S[name]))
    gl.bindAttribLocation(p, 0, 'a_pos')
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program ${name}: ${gl.getProgramInfoLog(p)}`)
    const u = {}
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size } }
    return (this.programs[name] = { p, u })
  }
  target(w, h) {
    const gl = this.gl
    const i = this.pool.findIndex(t => t.w === w && t.h === h)
    if (i >= 0) return this.pool.splice(i, 1)[0]
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, this.float ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, this.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null)
    this.params(gl.LINEAR)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { tex, fb, w, h }
  }
  release(t) { if (t && !t.keep) { this.pool.push(t); if (this.pool.length > 24) this.free(this.pool.shift()) } }
  free(t) { this.gl.deleteTexture(t.tex); this.gl.deleteFramebuffer(t.fb) }
  params(filter, wrap = this.gl.CLAMP_TO_EDGE) {
    const gl = this.gl
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
  }
  // Runs one pass into `out` (or the canvas when out is null). `inputs`: {uniformName: texture}; `values`: uniforms.
  pass(name, out, inputs = {}, values = {}) {
    const gl = this.gl
    const { p, u } = this.program(name)
    gl.useProgram(p)
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null)
    gl.viewport(0, 0, out ? out.w : this.width, out ? out.h : this.height)
    let unit = 0
    for (const [k, t] of Object.entries(inputs)) {
      if (!u[k]) continue
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(t.is3d ? gl.TEXTURE_3D : gl.TEXTURE_2D, t.tex || t)
      gl.uniform1i(u[k].loc, unit++)
    }
    for (const [k, v] of Object.entries(values)) {
      const info = u[k]
      if (!info) continue
      const T = info.type
      if (T === gl.FLOAT) gl.uniform1f(info.loc, v)
      else if (T === gl.FLOAT_VEC2) gl.uniform2fv(info.loc, v)
      else if (T === gl.FLOAT_VEC3) gl.uniform3fv(info.loc, v)
      else if (T === gl.FLOAT_VEC4) gl.uniform4fv(info.loc, v)
      else if (T === gl.INT && info.size > 1) gl.uniform1iv(info.loc, v)
      else if (T === gl.INT || T === gl.BOOL) gl.uniform1i(info.loc, v)
      else if (T === gl.INT_VEC2) gl.uniform2iv(info.loc, v)
    }
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  // A source element (video, image, bitmap, canvas) as a texture, uploaded again only when its version changes.
  sourceTexture(src) {
    const gl = this.gl
    let e = this.textures.get(src.key)
    if (!e) { e = { tex: gl.createTexture(), version: null }; this.textures.set(src.key, e) }
    e.used = this.frameNo
    if (e.version !== src.version || src.version == null) {
      gl.bindTexture(gl.TEXTURE_2D, e.tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL)
      if (src.pixels) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, src.w, src.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.pixels)
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src.el)
      this.params(gl.LINEAR)
      e.version = src.version
    }
    return e.tex
  }
  // A small float table (kernel) or byte table (curves) as a texture, kept by key.
  table(key, make) {
    let t = this.tables.get(key)
    if (t) return t
    const gl = this.gl
    const { data, w, h, format, meta } = make()
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    if (format === 'r32f') gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, data)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, data)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4)
    this.params(gl.NEAREST)
    t = { tex, meta }
    this.tables.set(key, t)
    if (this.tables.size > 256) { const [k, old] = this.tables.entries().next().value; gl.deleteTexture(old.tex); this.tables.delete(k) }
    return t
  }
  lutTexture(key, lut) {
    let t = this.tables.get(`lut:${key}`)
    if (t) return t
    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_3D, tex)
    const n = lut.size, rgba = new Float32Array(n * n * n * 4)
    for (let i = 0; i < n * n * n; i++) { rgba[i * 4] = lut.data[i * 3]; rgba[i * 4 + 1] = lut.data[i * 3 + 1]; rgba[i * 4 + 2] = lut.data[i * 3 + 2]; rgba[i * 4 + 3] = 1 }
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA32F, n, n, n, 0, gl.RGBA, gl.FLOAT, rgba)
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, p, gl.NEAREST)
    t = { tex, is3d: true }
    this.tables.set(`lut:${key}`, t)
    return t
  }
  noiseTexture(w, h) {
    if (this.noise && this.noise.w === w && this.noise.h === h) return this.noise
    if (this.noise) this.gl.deleteTexture(this.noise.tex)
    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, frandTable(w, h))
    this.params(gl.NEAREST)
    return (this.noise = { tex, w, h })
  }

  // ── a frame ──────────────────────────────────────────────────────────────────────────────────────────────────
  // Draws the frame. The final picture is kept until the next render (readPixels).
  render(frame, sources, { toCanvas = true } = {}) {
    if (!this.supported) return null
    this.frameNo = (this.frameNo || 0) + 1
    this.px = Math.min(this.width, this.height) / 1080
    const base = this.compose(frame, sources)
    if (this.last) this.release(this.last)
    this.last = base
    if (toCanvas) this.pass('PRESENT', null, { u_src: base }, { u_flip: 1, u_chroma420: 0 })
    this.sweep()
    return base
  }
  // A frame's picture (background, then each layer with its blend mode), not shown: the frame, or a compound's.
  compose(frame, sources) {
    const W = this.width, H = this.height
    let base = this.target(W, H)
    this.drawBackground(base, frame, sources)
    for (const layer of frame.layers) {
      const l = this.node(layer.node, sources)
      if (!l) continue
      const next = this.target(W, H)
      this.pass(layer.blend === 'normal' && frame.background.rgba?.[3] === 0 ? 'OVER' : 'BLEND', next, { u_base: base, u_layer: l }, { u_mode: S.BLEND_IDS[layer.blend] ?? 0 })
      this.release(l); this.release(base)
      base = next
    }
    return base
  }
  // The last frame's pixels, top row first (RGBA, 8 bits). chroma420 ('bilinear' or 'nearest') imitates the export's
  // 4:2:0 and the way its PNG was converted (shaders.PRESENT).
  readPixels({ chroma420 = 'off' } = {}) {
    const gl = this.gl
    if (!this.last) return null
    const W = this.width, H = this.height
    const out = { tex: gl.createTexture(), fb: gl.createFramebuffer(), w: W, h: H }
    gl.bindTexture(gl.TEXTURE_2D, out.tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out.tex, 0)
    const mode = S.CHROMA420[chroma420] ?? 0
    let uv = null
    if (mode) {
      const cw = (W + 1) >> 1, ch = (H + 1) >> 1
      const filt = this.table(`sws420:${W}x${H}`, () => swsTable(W, H, cw, ch, true))
      uv = this.target(cw, ch)
      this.pass('CHROMA_DOWN', uv, { u_src: this.last, u_filt: filt }, { u_taps: filt.meta.taps })
    }
    this.pass('PRESENT', out, { u_src: this.last, u_chroma: uv || this.last }, { u_flip: 0, u_chroma420: mode })
    if (uv) this.release(uv)
    const px = new Uint8Array(W * H * 4)
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
    this.free(out)
    return px
  }
  sweep() {
    // Textures of sources not drawn for 300 frames are deleted.
    for (const [k, e] of this.textures) if (this.frameNo - (e.used || 0) > 300) { this.gl.deleteTexture(e.tex); this.textures.delete(k) }
  }

  // compositor._video_graph: a colour (black under a blurred background), or a picture covering the canvas.
  drawBackground(out, frame, sources) {
    const bg = frame.background
    this.pass('FILL', out, {}, { u_color: bg.kind === 'color' ? [bg.rgba[0], bg.rgba[1], bg.rgba[2], bg.rgba[3]] : [0, 0, 0, 1] })
    if (bg.kind !== 'image') return
    const src = sources.image(bg.media)
    if (!src) return
    const pic = this.picture({ fit: 'cover', crop: null, zoom: false }, src)
    this.copy(pic, out)
    this.release(pic)
  }
  copy(from, to) { this.pass('PRESENT', to, { u_src: from }, { u_flip: 0, u_chroma420: 0 }) }
  // A canvas-sized straight-alpha picture (libass text, as the export's `ass` filter draws it last) over the last
  // frame, before readPixels: used by the golden-frame test, where text must be inside the compared picture.
  overlay(src) {
    if (!this.last) return
    const next = this.target(this.width, this.height)
    this.pass('BLEND', next, { u_base: this.last, u_layer: this.sourceTexture(src) }, { u_mode: 0 })
    this.release(this.last)
    this.last = next
  }

  node(node, sources) {
    if (node.op === 'clip') return this.clipLayer(node.clip, sources)
    const a = this.node(node.a, sources), b = this.node(node.b, sources)
    const W = this.width, H = this.height
    const blank = () => { const t = this.target(W, H); this.pass('FILL', t, {}, { u_color: [0, 0, 0, 0] }); return t }
    const A = a || blank(), B = b || blank()
    const out = this.target(W, H)
    const kind = S.XFADE_IDS[node.kind] ?? 0
    const inputs = { u_a: A, u_b: B }
    if (kind === S.XFADE_IDS.dissolve) inputs.u_noise = this.noiseTexture(W, H)
    const size = 1 + Math.trunc(W / 2) * (node.progress <= 0.5 ? node.progress * 2 : (1 - node.progress) * 2)
    const stride = !this.exact && this.simplify && size > 96 ? Math.ceil(size / 96) : 1
    this.pass('XFADE', out, inputs, { u_kind: kind, u_progress: node.progress, u_stride: stride })
    this.release(A); this.release(B)
    return out
  }

  // compositor._clip_layer: a clip on a full-canvas layer. Its picture fitted to the canvas, its effects; behind a
  // main-track clip on a blurred background, that picture covering the canvas, blurred; then flip, opacity, rotation
  // and scale, placed with its centre at (x W, y H).
  clipLayer(clip, sources) {
    let sub = null
    if (clip.kind === 'compound') {
      if (!clip.sub) return null
      sub = this.compose(clip.sub, sources)
    }
    const src = sub ? { tex: sub.tex, w: sub.w, h: sub.h, subsampled: false } : sources.picture(clip)
    if (!src) return null
    const W = this.width, H = this.height
    let pic = this.picture(clip, src)
    if (sub) this.release(sub)
    pic = this.effects(clip, pic, sources)
    let under = null
    if (clip.blurBg) {
      const cover = this.picture({ fit: 'cover', crop: null, zoom: false }, { tex: pic.tex, w: pic.w, h: pic.h })
      under = this.gblur(cover, canvasBlurKernel(clip.blurBg, this.px), `bg${clip.blurBg}:${this.px}`, false)
    }
    const tf = clip.transform
    const rot = ((tf.rotation || 0) % 360) * Math.PI / 180
    const s = tf.scale ?? 1
    const scaled = Math.abs(s - 1) > 1e-9
    let cur = pic, flip = [tf.flip_x ? 1 : 0, tf.flip_y ? 1 : 0], yuv = 0
    if (rot) {
      // rotate onto a square of side hypot(iw, ih), rounded, the picture padded first (ROTATE_PAD)
      const iw = pic.lw + 2 * ROTATE_PAD, ih = pic.lh + 2 * ROTATE_PAD
      const side = Math.trunc(Math.hypot(iw, ih) + 0.5)
      const st = rotateSteps(rot, iw, ih, side, side)
      const t = this.target(side, side)
      t.lw = side; t.lh = side
      this.pass('ROTATE', t, { u_pic: cur }, { u_picSize: [pic.lw, pic.lh], u_pad: ROTATE_PAD, u_step: [st.s, st.c],
        u_start: [st.x0, st.y0], u_flip: flip, u_yuvOut: scaled ? 1 : 0 })
      cur = t; flip = [0, 0]; yuv = scaled ? 1 : 0
    }
    if (scaled) {
      const sized = v => Math.max(2, Math.trunc(v * s / 2) * 2)
      const iw = cur.lw, ih = cur.lh, ow = sized(iw), oh = sized(ih)
      const filt = this.table(`sws:${iw}x${ih}>${ow}x${oh}`, () => swsTable(iw, ih, ow, oh))
      const t = this.target(ow, oh)
      t.lw = ow; t.lh = oh
      this.pass('SCALE', t, { u_in: cur, u_filt: filt }, { u_inSize: [iw, ih], u_taps: filt.meta.taps,
        u_yuvIn: yuv, u_flip: flip })
      if (cur !== pic) this.release(cur)
      cur = t; flip = [0, 0]
    }
    const ow = cur.lw, oh = cur.lh
    const ox = overlayXY(tf.x * W - ow / 2), oy = overlayXY(tf.y * H - oh / 2)
    const placed = this.target(W, H)
    this.pass('PLACE', placed, { u_pic: cur }, { u_picSize: [ow, oh], u_origin: [ox, oy], u_flip: flip,
      u_opacity: Math.min(Math.max(tf.opacity ?? 1, 0), 1) })
    if (cur !== pic) this.release(cur)
    this.release(pic)
    if (!under) return placed
    const out = this.target(W, H)
    this.pass('OVER', out, { u_base: under, u_layer: placed })
    this.release(under); this.release(placed)
    return out
  }

  // compositor._crop_fit: crop (shares of the source), then fitted to the CANVAS: contain (inside it, even sides),
  // cover (fills it, centre-cropped). A keyframed crop is stretched to the box its first frame fits to; a slow-zoom
  // picture fills the canvas (zoompan).
  picture(clip, src) {
    const W = this.width, H = this.height
    const sub = !!src.subsampled
    let c = { x: 0, y: 0, w: src.w, h: src.h }
    if (clip.crop && !clip.zoom) c = clip.cropKeyed ? { x: src.w * clip.crop[0], y: src.h * clip.crop[1], w: src.w * clip.crop[2], h: src.h * clip.crop[3] } : cropBox(src.w, src.h, clip.crop, sub)
    let pw, ph, scaled, off = [0, 0]
    if (clip.fit === 'cover' || clip.zoom) {
      scaled = fitSize(c.w, c.h, W, H, 'increase')
      off = [Math.trunc((scaled[0] - W) / 2) & (sub ? ~1 : ~0), Math.trunc((scaled[1] - H) / 2) & (sub ? ~1 : ~0)]
      pw = W; ph = H
    } else if (clip.cropKeyed) {
      const [c0w, c0h] = [src.w * clip.crop0[2], src.h * clip.crop0[3]]
      const k = Math.min(W / c0w, H / c0h)
      scaled = [even(c0w * k), even(c0h * k)]
      pw = scaled[0]; ph = scaled[1]
    } else {
      scaled = fitSize(c.w, c.h, W, H, 'decrease', 2)
      pw = scaled[0]; ph = scaled[1]
    }
    const out = this.target(pw, ph)
    out.lw = pw; out.lh = ph
    const zoom = clip.zoom ? (this.reducedMotion ? 1.12 : Math.min(1 + 0.0008 * (clip.frameIndex + 1), 1.12)) : 1
    this.pass('PICTURE', out, { u_src: src.tex ? { tex: src.tex } : this.sourceTexture(src) }, { u_srcSize: [src.w, src.h], u_crop: [c.x, c.y, c.w, c.h],
      u_scaled: scaled, u_off: off, u_texScale: [1, 1], u_zoom: zoom })
    return out
  }

  // The clip's effects in their order, each as the ffmpeg filter steps of effectParams.js.
  effects(clip, pic, sources) {
    let cur = pic
    for (const e of clip.effects) {
      const lut = e.kind === 'lut' ? sources.lut?.(clip, e) : null
      const matte = e.kind === 'bg_removal' ? sources.matte?.(clip) : null
      for (const step of effectSteps(e, { px: this.px, lut, matte })) cur = this.step(step, cur, clip)
    }
    return cur
  }
  step(s, input, clip) {
    if (s.op === 'gblur') return this.gblur(input, s.kernel, s.key, s.alpha)
    const out = this.target(input.w, input.h)
    out.lw = input.lw; out.lh = input.lh
    const I = { u_in: input }
    const table = tables => this.table('t:' + tables.map(t => t.join(',')).join('|'), () => {
      const d = new Uint8Array(256 * 3); tables.forEach((t, i) => d.set(t, i * 256)); return { data: d, w: 256, h: 3, format: 'r8' }
    })
    switch (s.op) {
      case 'lutrgb':
      case 'curves': this.pass('CURVES', out, { ...I, u_tables: table(s.tables) }); break
      case 'colorchannelmixer': this.pass('CCM', out, I, { u_r: s.matrix[0], u_g: s.matrix[1], u_b: s.matrix[2] }); break
      case 'vibrance': this.pass('VIBRANCE', out, I, { u_intensity: s.intensity }); break
      case 'huesaturation': this.pass('HUESAT', out, I, { u_m: s.matrix, u_colors: s.colors, u_strength: s.strength }); break
      case 'lut3d': this.pass('LUT3D', out, { ...I, u_lut: this.lutTexture(s.lut.key, s.lut) }, { u_size: s.lut.size, u_domain: s.lut.scale, u_intensity: s.intensity }); break
      case 'unsharp': this.pass('UNSHARP', out, I, { u_amount: s.amount }); break
      case 'vignette': this.pass('VIGNETTE', out, I, { u_angle: s.angle }); break
      case 'mask': this.pass('MASK', out, I, { u_shape: { rect: 0, ellipse: 1, linear: 2, mirror: 3 }[s.shape] ?? 0, u_box: [s.x, s.y, s.w, s.h],
        u_rotation: s.rotation, u_feather: s.feather, u_invert: s.invert ? 1 : 0 }); break
      case 'chromakey': this.pass('CHROMAKEY', out, I, { u_key: s.key, u_similarity: s.similarity, u_blend: s.blend }); break
      case 'despill': this.pass('DESPILL', out, I, { u_blue: s.blue ? 1 : 0, u_mix: s.mix, u_expand: s.expand, u_amount: s.amount }); break
      case 'matte': {
        // The matte is the same source frames, cropped and fitted like the clip.
        const m = this.picture(clip, s.matte)
        this.pass('MATTE', out, { ...I, u_matte: m }); this.release(m); break
      }
      default: this.copy(input, out)
    }
    this.release(input)
    return out
  }
  // gblur as two FIR passes (horizontal, vertical) of the recursive filter's kernel; alpha kept unless `alpha`.
  gblur(input, kernel, key, alpha = false) {
    const k = this.table(`k:${key}:${kernel.length}`, () => ({ data: kernel, w: kernel.length, h: 1, format: 'r32f' }))
    const stride = !this.exact && this.simplify && kernel.length > 48 ? Math.ceil(kernel.length / 48) : 1
    const h = this.target(input.w, input.h)
    this.pass('GBLUR', h, { u_in: input, u_kernel: k }, { u_taps: kernel.length, u_dir: [1, 0], u_stride: stride, u_alpha: alpha ? 1 : 0 })
    const v = this.target(input.w, input.h)
    v.lw = input.lw; v.lh = input.lh
    this.pass('GBLUR', v, { u_in: h, u_kernel: k }, { u_taps: kernel.length, u_dir: [0, 1], u_stride: stride, u_alpha: alpha ? 1 : 0 })
    this.release(h); this.release(input)
    return v
  }

  dispose() {
    if (!this.gl) return
    const gl = this.gl
    for (const t of this.pool) this.free(t)
    if (this.last) this.free(this.last)
    for (const e of this.textures.values()) gl.deleteTexture(e.tex)
    for (const t of this.tables.values()) gl.deleteTexture(t.tex)
    if (this.noise) gl.deleteTexture(this.noise.tex)
    for (const { p } of Object.values(this.programs)) gl.deleteProgram(p)
    this.pool = []; this.textures.clear(); this.tables.clear(); this.programs = {}; this.last = null
  }
}
