// The preview's sound (plan P11, ADM-1199): every clip's media element goes through its own Web Audio chain, in the
// export's order (compositor._sound_chain): 3-band EQ → voice enhance → level (dB with keyframes, fades, mute and
// solo, ducking) → pan (balance law) → its role's bus → master, with two meters (left, right). The rules are
// mixRules.js. The AudioContext's clock is the one the monitor's picture follows while sound plays (clock()).

import { clipMix, duckDetect, duckGain, EQ_BANDS, panGains, ROLES, VOICE_ENHANCE } from './mixRules'
import { levels } from './meters'

const ramp = (param, v, now) => param.setTargetAtTime(v, now, 0.01)

export class AudioGraph {
  constructor() {
    this.ctx = null
    this.chains = new Map()        // clip id -> its nodes
    this.duckState = 0             // the detector's smoothed square level of the dialogue (speech)
    this.lastT = null
  }
  get supported() { return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext) }
  get running() { return !!this.ctx && this.ctx.state === 'running' }

  // Made on the first play (a user gesture), so the browser lets it start.
  start() {
    if (!this.supported) return null
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      const ctx = this.ctx = new AC({ latencyHint: 'interactive' })
      this.master = ctx.createGain()
      this.buses = Object.fromEntries(ROLES.map(r => { const g = ctx.createGain(); g.connect(this.master); return [r, g] }))
      this.speech = ctx.createAnalyser(); this.speech.fftSize = 1024
      this.buses.dialogue.connect(this.speech)
      const split = ctx.createChannelSplitter(2)
      this.meterL = ctx.createAnalyser(); this.meterR = ctx.createAnalyser()
      this.meterL.fftSize = this.meterR.fftSize = 2048
      this.master.connect(split); split.connect(this.meterL, 0); split.connect(this.meterR, 1)
      this.master.connect(ctx.destination)
      this.bufL = new Float32Array(this.meterL.fftSize); this.bufR = new Float32Array(this.meterR.fftSize)
      this.bufS = new Float32Array(this.speech.fftSize)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    return this.ctx
  }
  // The clock (ms) the picture follows while sound plays.
  clock() { return this.running ? this.ctx.currentTime * 1000 : performance.now() }

  // A clip's element joins the graph once (an element can feed only one MediaElementSource).
  attach(id, el) {
    if (!this.ctx || this.chains.has(id) || !el) return
    const ctx = this.ctx
    let source
    try { source = ctx.createMediaElementSource(el) } catch { return }
    // Mono files become stereo first (aformat=channel_layouts=stereo), so the pan has two channels to weigh.
    const stereo = ctx.createGain()
    stereo.channelCount = 2; stereo.channelCountMode = 'explicit'; stereo.channelInterpretation = 'speakers'
    const eq = EQ_BANDS.map(b => { const f = ctx.createBiquadFilter(); f.type = b.type; f.frequency.value = b.hz; if (b.q) f.Q.value = b.q; f.gain.value = 0; return f })
    const v = VOICE_ENHANCE
    // Web Audio reads a highpass Q in dB.
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = v.highpassHz; hp.Q.value = 20 * Math.log10(v.highpassQ)
    const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = v.presence.hz; pres.Q.value = v.presence.q; pres.gain.value = v.presence.db
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = 20 * Math.log10(v.compressor.threshold); comp.ratio.value = v.compressor.ratio
    comp.attack.value = v.compressor.attackMs / 1000; comp.release.value = v.compressor.releaseMs / 1000; comp.knee.value = 20 * Math.log10(v.compressor.knee)
    const makeup = ctx.createGain(); makeup.gain.value = v.compressor.makeup
    const enhanceIn = ctx.createGain()
    hp.connect(pres); pres.connect(comp); comp.connect(makeup)
    const level = ctx.createGain(); level.gain.value = 0
    makeup.connect(level)
    const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2)
    const gl = ctx.createGain(), gr = ctx.createGain()
    source.connect(stereo)
    let node = stereo
    for (const f of eq) { node.connect(f); node = f }
    node.connect(enhanceIn)
    enhanceIn.connect(level)                 // voice enhance off: straight through
    level.connect(split); split.connect(gl, 0); split.connect(gr, 1); gl.connect(merge, 0, 0); gr.connect(merge, 0, 1)
    this.chains.set(id, { el, source, eq, level, gl, gr, out: merge, enhanceIn, hp, enhanced: false, role: null })
  }
  detach(id) {
    const c = this.chains.get(id)
    if (!c) return
    try { c.source.disconnect(); c.out.disconnect() } catch { /* already gone */ }
    this.chains.delete(id)
  }

  // Sets every chain for timeline time t. `rows` are {item, track} of the clips with sound; `ctx` has tracks, roles,
  // rate (mixRules.audible). Ducked clips are lowered by the export's compressor curve keyed by the dialogue bus.
  update(rows, t, ctx = {}) {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const dt = this.lastT == null ? 16 : Math.max(0, Math.min(250, (now - this.lastT) * 1000))
    this.lastT = now
    this.speech.getFloatTimeDomainData(this.bufS)
    const speech = levels(this.bufS).rms
    this.duckState = duckDetect(this.duckState, speech * speech, dt)
    const duck = duckGain(this.duckState)
    const seen = new Set()
    for (const { item, track } of rows) {
      const c = this.chains.get(item.id)
      if (!c) continue
      seen.add(item.id)
      const m = clipMix(item, track, t, ctx)
      if (c.role !== m.role) { try { c.out.disconnect() } catch { /* new */ } c.out.connect(this.buses[m.role]); c.role = m.role }
      if (c.enhanced !== m.voiceEnhance) {
        try { c.enhanceIn.disconnect() } catch { /* new */ }
        c.enhanceIn.connect(m.voiceEnhance ? c.hp : c.level)
        c.enhanced = m.voiceEnhance
      }
      ramp(c.level.gain, m.gain * (m.duck && m.role !== 'dialogue' ? duck : 1), now)
      const [l, r] = panGains(m.pan)
      ramp(c.gl.gain, l, now); ramp(c.gr.gain, r, now)
      m.eq.forEach((db, i) => ramp(c.eq[i].gain, db, now))
    }
    for (const [id, c] of this.chains) if (!seen.has(id)) ramp(c.level.gain, 0, now)
  }
  // Peak and RMS of both channels now.
  meters() {
    if (!this.ctx) return null
    this.meterL.getFloatTimeDomainData(this.bufL); this.meterR.getFloatTimeDomainData(this.bufR)
    return { left: levels(this.bufL), right: levels(this.bufR) }
  }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}) }
  dispose() {
    for (const id of [...this.chains.keys()]) this.detach(id)
    if (this.ctx) this.ctx.close().catch(() => {})
    this.ctx = null
  }
}
