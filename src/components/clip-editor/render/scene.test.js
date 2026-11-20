// The frame plan: what the monitor draws at a time, following the export's graph (compositor._video_graph).
import { describe, expect, it } from 'vitest'
import { background, clipsOf, clipState, frameAt, runsOf, xfadeProgress } from './scene'

const clip = (id, start, len, extra = {}) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: len, ...extra })
const doc = (tracks, canvas = { aspect: '16:9', background: '#102030' }) => ({ version: 3, rate: 30, canvas, tracks })

describe('scene', () => {
  it('reads a version 2 background and the v3 kinds', () => {
    expect(background({ canvas: { background: '#FF0000' } })).toEqual({ kind: 'color', rgba: [1, 0, 0, 1] })
    expect(background({ canvas: { background: { kind: 'blur' } } })).toEqual({ kind: 'blur', strength: 2 })
    expect(background({ canvas: { background: { kind: 'image', media: 'p' } } })).toEqual({ kind: 'image', media: 'p' })
  })
  it('joins clips by transitions into runs; a transition that does not meet the previous clip starts a new run', () => {
    const t = { id: 'v1', kind: 'video', items: [clip('a', 0, 2000), clip('b', 1500, 2000), clip('c', 4000, 1000), { type: 'transition', id: 'x1', kind: 'wipe', ms: 500, between: ['a', 'b'] }] }
    expect(runsOf(t).map(r => r.map(x => x.item.id))).toEqual([['a', 'b'], ['c']])
  })
  it('mixes a transition with xfade\'s progress (1 at its first frame) and reads v2 kind names', () => {
    const t = { id: 'v1', kind: 'video', main: true, items: [clip('a', 0, 2000), clip('b', 1500, 2000), { type: 'transition', id: 'x1', kind: 'wipe', ms: 500, between: ['a', 'b'] }] }
    const f = frameAt(doc([t]), 1733)          // frame 52, 7 frames into a 15-frame transition
    expect(f.layers).toHaveLength(1)
    expect(f.layers[0].node.op).toBe('xfade')
    expect(f.layers[0].node.kind).toBe('wipe_left')
    expect(f.layers[0].node.progress).toBe(Math.fround(1 - Math.fround(7 / 15)))
    expect(xfadeProgress(1500, 1500, 500)).toBe(1)
    expect(xfadeProgress(2100, 1500, 500)).toBe(0)
    expect(clipsOf(f.layers[0].node).map(c => c.id)).toEqual(['a', 'b'])
  })
  it('draws tracks bottom first, skips hidden ones, and blurs the canvas behind main-track clips only', () => {
    const v1 = { id: 'v1', kind: 'video', main: true, items: [clip('a', 0, 3000)] }
    const v2 = { id: 'v2', kind: 'video', items: [clip('b', 0, 3000, { blend: 'screen' })] }
    const v3 = { id: 'v3', kind: 'video', hide: true, items: [clip('c', 0, 3000)] }
    const f = frameAt(doc([v1, v2, v3], { aspect: '9:16', background: { kind: 'blur', strength: 3 } }), 100)
    expect(f.layers.map(l => [l.track, l.blend])).toEqual([['v1', 'normal'], ['v2', 'screen']])
    expect(f.layers[0].node.clip.blurBg).toBe(3)
    expect(f.layers[1].node.clip.blurBg).toBe(0)
  })
  it('evaluates keyframes relative to the clip, effect params by id (HSL by colour), and the source time', () => {
    const item = clip('a', 1000, 4000, {
      transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, flip_x: true, opacity: 1 },
      keyframes: { 'transform.scale': [{ t_ms: 0, v: 1 }, { t_ms: 1000, v: 2 }], 'fx.e1.exposure': [{ t_ms: 0, v: 0 }, { t_ms: 2000, v: 1 }],
        'fx.e2.red.h': [{ t_ms: 0, v: 0 }, { t_ms: 1000, v: 20 }], 'crop.w': [{ t_ms: 0, v: 0.5 }, { t_ms: 1000, v: 1 }] },
      effects: [{ id: 'e1', kind: 'adjust', params: { exposure: 0.3, contrast: 1.1 } }, { id: 'e2', kind: 'hsl', params: { red: { s: 0.2 } } }, { id: 'e3', kind: 'blur', enabled: false, params: { radius: 3 } }],
      speed: 2, source_in_ms: 500, source_out_ms: 8500,
    })
    const s = clipState(item, { id: 'v1', kind: 'video' }, 1500)
    expect(s.transform.scale).toBeCloseTo(1.5, 9)
    expect(s.transform.flip_x).toBe(true)
    expect(s.effects.map(e => e.id)).toEqual(['e1', 'e2'])
    expect(s.effects[0].params).toEqual({ exposure: 0.25, contrast: 1.1 })
    expect(s.effects[1].params.red).toEqual({ s: 0.2, h: 10 })
    expect(s.cropKeyed).toBe(true)
    expect(s.crop[2]).toBeCloseTo(0.75, 9)
    expect(s.crop0[2]).toBe(0.5)
    expect(s.sourceMs).toBe(1500)
    expect(s.speed).toBe(2)
  })
  it('a picture holds; a freeze frame shows its source time', () => {
    expect(clipState({ type: 'clip', id: 'p', media: 'i', start_ms: 0, hold_ms: 3000, zoom: true }, { id: 'v1' }, 500).kind).toBe('image')
    const fr = clipState({ type: 'clip', id: 'f', media: 'v', start_ms: 0, hold_ms: 2000, freeze_at_ms: 1234 }, { id: 'v1' }, 500)
    expect([fr.kind, fr.sourceMs, fr.freeze]).toEqual(['video', 1234, true])
  })
  it('a compound clip shows the compound tracks at its source time, with prefixed ids; cycles stop', () => {
    const inner = { id: 'iv', kind: 'video', items: [clip('i1', 0, 5000)] }
    const d = { ...doc([{ id: 'v1', kind: 'video', main: true, items: [{ type: 'clip', id: 'k', compound: 'cp1', start_ms: 1000, source_in_ms: 2000, source_out_ms: 4000 }] }]),
      compounds: { cp1: { name: 'Nest', tracks: [inner] }, cp2: { tracks: [{ id: 'x', kind: 'video', items: [{ type: 'clip', id: 'loop', compound: 'cp2', start_ms: 0, source_in_ms: 0, source_out_ms: 1000 }] }] } } }
    const f = frameAt(d, 1500)
    const c = f.layers[0].node.clip
    expect(c.kind).toBe('compound')
    expect(c.sub.background.rgba[3]).toBe(0)
    expect(clipsOf(f.layers[0].node).map(x => [x.id, x.sourceMs])).toEqual([['k', 2500], ['k/i1', 2500]])
    const loop = frameAt({ ...d, tracks: [{ id: 'v', kind: 'video', items: [{ type: 'clip', id: 'z', compound: 'cp2', start_ms: 0, source_in_ms: 0, source_out_ms: 1000 }] }] }, 10)
    expect(clipsOf(loop.layers[0].node).length).toBe(9)
  })
  it('the editor decides which tracks show', () => {
    const v1 = { id: 'v1', kind: 'video', items: [clip('a', 0, 3000)] }
    expect(frameAt(doc([v1]), 10, { shown: () => false }).layers).toEqual([])
  })
})
