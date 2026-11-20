// The preview's mixing rules and meters (pure parts of the Web Audio graph), against the export's formulas.
import { describe, expect, it } from 'vitest'
import { audible, clipMix, dbToGain, duckDetect, duckGain, fadeGain, fadesOf, panGains, roleOf } from './mixRules'
import { fill, holdPeak, levels } from './meters'

const video = { id: 'v1', kind: 'video', items: [] }
const music = { id: 'a1', kind: 'audio', role: 'music', items: [] }

describe('mix rules', () => {
  it('roles: own, else dialogue for a video clip and the track role for an audio clip', () => {
    expect(roleOf({}, video)).toBe('dialogue')
    expect(roleOf({}, music)).toBe('music')
    expect(roleOf({ role: 'effects' }, video)).toBe('effects')
    expect(roleOf({}, { kind: 'audio' })).toBe('music')
  })
  it('mute and solo by track and role', () => {
    const tracks = [video, { ...music, solo: true }]
    expect(audible({}, video, { tracks })).toBe(false)
    expect(audible({}, tracks[1], { tracks })).toBe(true)
    expect(audible({}, video, { tracks: [video], roles: { dialogue: { mute: true } } })).toBe(false)
    expect(audible({}, video, { tracks: [video], roles: { music: { solo: true } } })).toBe(false)
    expect(audible({ muted: true }, video, {})).toBe(false)
  })
  it('level in dB (clipped -60..12), balance pan, linear fades that follow transitions', () => {
    expect(dbToGain(0)).toBe(1)
    expect(dbToGain(-6)).toBeCloseTo(0.501187, 6)
    expect(dbToGain(40)).toBeCloseTo(Math.pow(10, 12 / 20), 9)
    expect(panGains(0)).toEqual([1, 1])
    expect(panGains(0.5)).toEqual([0.5, 1])
    expect(panGains(-1)).toEqual([1, 0])
    const t = { ...video, items: [{ type: 'transition', ms: 400, between: ['a', 'b'] }] }
    expect(fadesOf({ id: 'b', fade_in_ms: 100 }, t)).toEqual({ fin: 400, fout: 0 })
    expect(fadeGain(200, 1000, { fin: 400, fout: 0 })).toBe(0.5)
    expect(fadeGain(900, 1000, { fin: 0, fout: 200 })).toBe(0.5)
  })
  it('a clip\'s mix at a time, with keyframed volume and pan', () => {
    const item = { id: 'm', start_ms: 1000, source_in_ms: 0, source_out_ms: 4000, volume_db: -3, eq: { low_db: 20, mid_db: -2 },
      keyframes: { volume_db: [{ t_ms: 0, v: -20 }, { t_ms: 1000, v: 0 }], pan: [{ t_ms: 0, v: -1 }, { t_ms: 2000, v: 1 }] } }
    const m = clipMix(item, music, 1500, { tracks: [music] })
    expect(m.gain).toBeCloseTo(dbToGain(-10), 9)
    expect(m.pan).toBeCloseTo(-0.5, 9)
    expect(m.eq).toEqual([12, -2, 0])
    expect(clipMix(item, music, 6000, {}).gain).toBe(0)
  })
  it('ducking follows sidechaincompress: no reduction below the knee, deep reduction for loud speech', () => {
    expect(duckGain(0)).toBe(1)
    expect(duckGain(0.01 * 0.01)).toBe(1)
    const g = duckGain(0.5 * 0.5)
    expect(g).toBeLessThan(0.2)
    expect(g).toBeGreaterThan(0)
    // the detector rises faster (attack 20 ms) than it falls (release 400 ms)
    const up = duckDetect(0, 1, 20), down = duckDetect(1, 0, 20)
    expect(up).toBeGreaterThan(1 - down)
  })
})

describe('meters', () => {
  it('peak and RMS of a block', () => {
    const l = levels(new Float32Array([0.5, -0.5, 0.5, -0.5]))
    expect(l.peak).toBe(0.5)
    expect(l.rms).toBeCloseTo(0.5, 9)
    expect(l.peakDb).toBeCloseTo(-6.0206, 3)
    expect(levels(new Float32Array(8)).rmsDb).toBe(-60)
    expect(levels(new Float32Array([1])).clipped).toBe(true)
  })
  it('the held peak waits, then falls; the fill maps -60..0 dB to 0..1', () => {
    let s = holdPeak(null, -6, 16)
    s = holdPeak(s, -30, 500)
    expect(s.db).toBe(-6)
    s = holdPeak(s, -30, 600)
    expect(s.db).toBeCloseTo(-18, 6)
    expect(fill(-60)).toBe(0)
    expect(fill(0)).toBe(1)
    expect(fill(-30)).toBe(0.5)
  })
})
