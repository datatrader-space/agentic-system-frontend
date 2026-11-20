// The clip editor's timeline model (VIDEO_EDITOR_PRO_CONTRACT.md sections 1, 2, 6): the frame grid, version 2 read as
// version 3, the magnet and connected clips, every professional edit (insert, overwrite, replace, roll, slip, slide,
// blade, connect, detach, split audio, markers, compounds, keyframes, effects, paste attributes, track controls), the
// checks the server makes, and undo and redo restoring the document exactly after each of them.
import { describe, expect, it } from 'vitest'
import * as tl from './timelineModel'
import gridCases from './__cases__/grid.json'
import anchorCases from './__cases__/anchors.json'
import registry from './__fixtures__/registry.json'

const clip = (id, start, out = 2000, extra = {}) => ({ type: 'clip', id, media: 'm', start_ms: start, source_in_ms: 0, source_out_ms: out, speed: 1, fit: 'contain', transform: { x: 0.5, y: 0.5, scale: 1, opacity: 1 }, ...extra })
const sound = (id, start, out = 2000, extra = {}) => ({ type: 'clip', id, media: 's', start_ms: start, source_in_ms: 0, source_out_ms: out, volume_db: 0, ...extra })
// Free placement (magnet off), as the first editor had it.
const docWith = (...items) => ({ ...tl.newDoc('16:9'), settings: { magnet: false }, tracks: [{ id: 'v1', kind: 'video', main: true, items }, { id: 't1', kind: 'text', captions: true, items: [] }, { id: 'a1', kind: 'audio', items: [] }] })
// Magnet on, with an overlay track and a sound track.
const magnetDoc = (main, overlay = [], sounds = [], rate = 30) => ({ ...tl.newDoc('16:9', rate), tracks: [
  { id: 'v1', kind: 'video', main: true, items: main }, { id: 'v2', kind: 'video', items: overlay }, { id: 't1', kind: 'text', items: [] }, { id: 'a1', kind: 'audio', items: sounds }] })
const run = (doc, ops) => tl.applyOps(doc, ops).doc
const item = (doc, id) => tl.find(doc, id)?.item
const starts = (doc, trackId) => tl.ordered(doc.tracks.find(t => t.id === trackId)).map(i => [i.id, i.start_ms])
// An edit, checked: the result passes the server's checks, and undo then redo give back each document exactly.
function edit(doc, ops) {
  expect(ops.length).toBeGreaterThan(0)
  const h = tl.createHistory()
  const next = tl.commit(h, doc, ops, 'edit')
  expect(tl.problem(next)).toBe('')
  expect(tl.undo(h, next).doc).toEqual(doc)
  expect(tl.redo(h, doc).doc).toEqual(next)
  return next
}

// The server's case tables (video_studio/editor_cases/grid.json and anchors.json): the same files pass in
// test_timeline_v3 on the Python side.
describe('the frame grid (contract 2, shared cases)', () => {
  it.each(gridCases.snap)('snap($ms) at $rate fps is $snap (frame $frames)', ({ rate, ms, frames, snap, on_grid }) => {
    expect(tl.snap(ms, rate)).toBe(snap)
    expect(tl.frameOf(ms, rate)).toBe(frames)
    expect(tl.onGrid(ms, rate)).toBe(on_grid)
  })
  it.each(gridCases.frame_time)('frame $n at $rate fps starts at $ms', ({ rate, n, ms }) => {
    expect(tl.frameTime(n, rate)).toBe(ms)
  })
  it.each(gridCases.clip_end)('a clip from $start_ms lasting $raw_ms raw ms at $rate fps ends at $end_ms', ({ rate, start_ms, raw_ms, end_ms }) => {
    // A clip whose raw length is raw_ms (its source range at speed 1).
    const c = { type: 'clip', start_ms, source_in_ms: 0, source_out_ms: raw_ms, speed: 1 }
    expect(tl.itemEnd(c, rate)).toBe(end_ms)
  })

  it('frames and their times agree, and toFrame never goes before 0', () => {
    for (const rate of tl.RATES) for (let n = 0; n < 200; n++) expect(tl.frameOf(tl.frameTime(n, rate), rate)).toBe(n)
    expect(tl.toFrame(1010, 30)).toBe(1000)
    expect(tl.toFrame(1020, 30)).toBe(1033)
    expect(tl.toFrame(-40, 30)).toBe(0)
    expect([tl.onGrid(33, 30), tl.onGrid(34, 30), tl.onGrid(40, 25)]).toEqual([true, false, true])
  })

  it('a clip ends on the grid; a transition is a whole number of grid periods', () => {
    expect(tl.itemEnd(clip('a', 33, 1000), 30)).toBe(1033)
    expect(tl.itemEnd(clip('a', 33, 33), 30)).toBe(67)                     // 33 + snap(33) = 66 is not a frame; 67 is
    expect(tl.itemEnd(clip('a', 0, 2500, { speed: 3 }), 24)).toBe(833)
    expect([tl.gridPeriod(24), tl.gridPeriod(25), tl.gridPeriod(30), tl.gridPeriod(60)]).toEqual([125, 40, 100, 50])
    expect([tl.transitionMs(500, 30), tl.transitionMs(500, 25), tl.transitionMs(330, 24), tl.transitionMs(10, 60), tl.transitionMs(9000, 30)]).toEqual([500, 520, 375, 100, 2000])
  })

  it('measures clips, pictures, speed curves, text and the whole length', () => {
    const doc = docWith(clip('a', 0, 4000, { speed: 2 }), { type: 'clip', id: 'p', media: 'pic', start_ms: 2000, hold_ms: 1500 })
    expect(tl.clipLength(item(doc, 'a'), 30)).toBe(2000)
    expect(tl.itemEnd(item(doc, 'p'), 30)).toBe(3500)
    expect(tl.totalMs(doc)).toBe(3500)
    // A curve from 1x to 1x is the source length; 1x to 2x over 6 s of source is 6000 * ln 2 = 4158.9 ms.
    expect(tl.rawLength(clip('c', 0, 6000, { speed_curve: [{ x: 0, y: 1 }, { x: 1, y: 1 }] }))).toBe(6000)
    expect(tl.rawLength(clip('c', 0, 6000, { speed_curve: [{ x: 0, y: 1 }, { x: 1, y: 2 }] }))).toBeCloseTo(6000 * Math.log(2), 6)
    expect(tl.totalMs(tl.newDoc())).toBe(0)
  })

  it('snaps to the nearest edge or marker within the threshold', () => {
    const doc = { ...docWith(clip('a', 0), clip('b', 3000)), markers: [{ id: 'k1', at_ms: 2700, name: '', color: '#F2B341', chapter: false }] }
    const pts = tl.snapPoints(doc, { playhead: 2500, exclude: ['b'] })
    expect(pts).toEqual([0, 2000, 2500, 2700])
    expect(tl.snapToPoints(2090, pts, 100)).toBe(2000)
    expect(tl.snapToPoints(2460, pts, 100)).toBe(2500)
    expect(tl.snapToPoints(2250, pts, 100)).toBe(2250)
  })

  it('reads and writes typed times and shows a time code', () => {
    expect(tl.parseTime('12.5')).toBe(12500)
    expect(tl.parseTime('1:02.5')).toBe(62500)
    expect(Number.isNaN(tl.parseTime('soon'))).toBe(true)
    expect(tl.timecode(62500, 30)).toBe('1:02.15')
    expect(tl.timecode(33, 30)).toBe('0:00.01')                           // the grid time of frame 1 is frame 1
  })
})

describe('version 2 reads as version 3 (contract 1)', () => {
  const v2 = () => ({ version: 2, rate: 30, canvas: { aspect: '9:16', background: '#112233' }, tracks: [
    { id: 'v1', kind: 'video', muted: true, items: [clip('a', 10, 2000), clip('b', 2010, 2000), { type: 'transition', id: 'x1', kind: 'wipe', between: ['a', 'b'], ms: 0 }] },
    { id: 't1', kind: 'text', items: [{ type: 'text', id: 'q1', start_ms: 5, end_ms: 1010, text: 'Hi', style: {} }] }] })

  it('converts exactly as the contract says', () => {
    const doc = tl.upgrade(v2())
    expect(doc.version).toBe(3)
    expect(doc.canvas.background).toEqual({ kind: 'color', color: '#112233' })
    expect(doc.settings).toEqual({ magnet: false })
    expect(doc.tracks[0].main).toBe(true)
    expect(doc.tracks[0].muted).toBe(true)                                 // nothing else changes
    expect([item(doc, 'a').start_ms, item(doc, 'b').start_ms, item(doc, 'q1').start_ms, item(doc, 'q1').end_ms]).toEqual([0, 2000, 0, 1000])
    expect(tl.problem(doc)).toBe('')
    expect(tl.flag(doc.tracks[0], 'mute')).toBe(true)
  })

  it('renames the old transition kinds', () => {
    const d = v2()
    d.tracks[0].items[1].start_ms = 1510
    d.tracks[0].items[2].ms = 500
    const doc = tl.upgrade(d)
    expect(doc.tracks[0].items[2]).toMatchObject({ kind: 'wipe_left', ms: 500 })
    d.tracks[0].items[2].kind = 'slide'
    expect(tl.upgrade(d).tracks[0].items[2].kind).toBe('slide_left')
  })

  it('leaves a correct version 3 document as it is', () => {
    const doc = tl.newDoc('9:16')
    expect(tl.upgrade(doc)).toBe(doc)
    const fixed = tl.upgrade({ ...doc, tracks: doc.tracks.map(t => ({ ...t, main: undefined })) })
    expect(fixed.tracks[0].main).toBe(true)
  })

  it('a rate change moves every time to the new grid', () => {
    const doc = docWith(clip('a', 0, 1000), clip('b', 1000, 1000))
    const next = edit(doc, tl.setRateOps(doc, 24))
    expect([next.rate, item(next, 'b').start_ms]).toEqual([24, 1000])
    const odd = { ...docWith(clip('a', 0, 1000), clip('b', 1033, 1000)) }
    expect(item(run(odd, tl.setRateOps(odd, 25)), 'b').start_ms).toBe(1040)
  })
})

describe('connected clips (contract 6 anchors)', () => {
  // An item anywhere: on the timeline or inside a compound.
  const anyItem = (d, id) => [d.tracks, ...Object.values(d.compounds || {}).map(c => c.tracks)].flat().flatMap(t => t.items).find(i => i.id === id)
  it.each(anchorCases)('$name', ({ doc, expected, expected_end }) => {
    const next = run(doc, tl.applyAnchors(doc))
    for (const [id, start] of Object.entries(expected)) expect(anyItem(next, id).start_ms).toBe(start)
    for (const [id, end] of Object.entries(expected_end || {})) expect(anyItem(next, id).end_ms).toBe(end)
    expect(tl.applyAnchors(next)).toEqual([])
  })

  it('the editor frees an anchor whose parent is not on the main track (the server keeps it and refuses the save)', () => {
    const c = anchorCases.find(x => /not on the main track/.test(x.name))
    const next = run(c.doc, tl.applyAnchors(c.doc))
    expect([anyItem(next, 'o2').anchor, anyItem(next, 'o3').anchor]).toEqual([undefined, undefined])
  })

  it('moving a parent moves its children; deleting it deletes them; detach frees one', () => {
    let doc = magnetDoc([clip('p1', 0), clip('p2', 2000)], [clip('c1', 2500, 500, { anchor: { clip: 'p2', offset_ms: 500 } })])
    doc = edit(doc, tl.moveOps(doc, 'p2', 0))                              // p2 goes first; the magnet closes up
    expect(starts(doc, 'v1')).toEqual([['p2', 0], ['p1', 2000]])
    expect(item(doc, 'c1').start_ms).toBe(500)
    const freed = edit(doc, tl.detachOps(doc, 'c1'))
    expect(item(freed, 'c1').anchor).toBeUndefined()
    const gone = edit(doc, tl.deleteOps(doc, ['p2']))
    expect([item(gone, 'c1'), starts(gone, 'v1')]).toEqual([undefined, [['p1', 0]]])
  })

  it('trimming a parent\'s head keeps its children on the same frame', () => {
    // Magnet on: the parent stays in its slot, so the child moves left with the picture it was on.
    let doc = magnetDoc([clip('p1', 0, 2000), clip('p2', 2000, 3000)], [clip('c1', 3000, 500, { anchor: { clip: 'p2', offset_ms: 1000 } })])
    let next = edit(doc, tl.trimOps(doc, 'p2', 'start', 2500))
    expect([item(next, 'p2').start_ms, item(next, 'p2').source_in_ms, item(next, 'c1').anchor.offset_ms, item(next, 'c1').start_ms]).toEqual([2000, 500, 500, 2500])
    // Magnet off: the parent's start moves, the child stays where it is.
    doc = { ...doc, settings: { magnet: false } }
    next = edit(doc, tl.trimOps(doc, 'p2', 'start', 2500))
    expect([item(next, 'p2').start_ms, item(next, 'c1').start_ms, item(next, 'c1').anchor.offset_ms]).toEqual([2500, 3000, 500])
  })

  it('connects a clip, a sound or a text to the main-track clip under its start, never a main-track clip', () => {
    const doc = magnetDoc([clip('p1', 0), clip('p2', 2000)], [clip('c1', 2600, 500)], [sound('s1', 100, 500)])
    doc.tracks[2].items.push({ type: 'text', id: 'x1', text: 'Hi', start_ms: 2300, end_ms: 3000 })
    const next = edit(doc, tl.connectOps(doc, 'c1'))
    expect(item(next, 'c1').anchor).toEqual({ clip: 'p2', offset_ms: 600 })
    expect(item(edit(doc, tl.connectOps(doc, 's1')), 's1').anchor).toEqual({ clip: 'p1', offset_ms: 100 })
    expect(tl.connectOps(doc, 'p1')).toEqual([])
    // A text (the server allows an anchor on text items): it follows its parent and keeps its length in frames.
    let d = edit(doc, tl.connectOps(doc, 'x1'))
    expect(item(d, 'x1').anchor).toEqual({ clip: 'p2', offset_ms: 300 })
    d = edit(d, tl.moveOps(d, 'p2', 0))                                      // p2 first; the magnet closes up
    expect([item(d, 'x1').start_ms, item(d, 'x1').end_ms]).toEqual([300, 1000])
    d = edit(d, tl.deleteOps(d, ['p2']))                                     // deleting the parent deletes the text
    expect(item(d, 'x1')).toBeUndefined()
  })

  it('a split keeps a keyframed value at the cut: each part gets a boundary key from the one evaluator', () => {
    const keys = { 'transform.opacity': [{ t_ms: 0, v: 0, ease: 'linear' }, { t_ms: 2000, v: 1, ease: 'linear' }] }
    const doc = magnetDoc([clip('p1', 0, 4000, { keyframes: keys })])
    const next = edit(doc, tl.splitOps(doc, 'p1', 1000))
    const [a, b] = tl.ordered(next.tracks[0])
    expect(a.keyframes['transform.opacity']).toEqual([{ t_ms: 0, v: 0, ease: 'linear' }, { t_ms: 1000, v: 0.5, ease: 'linear' }])
    expect(b.keyframes['transform.opacity']).toEqual([{ t_ms: 0, v: 0.5, ease: 'linear' }, { t_ms: 1000, v: 1, ease: 'linear' }])
  })

  it('splitting a parent hands the children after the cut to the second part', () => {
    const doc = magnetDoc([clip('p1', 0, 4000)], [clip('c1', 500, 300, { anchor: { clip: 'p1', offset_ms: 500 } }), clip('c2', 3000, 300, { anchor: { clip: 'p1', offset_ms: 3000 } })])
    const next = edit(doc, tl.splitOps(doc, 'p1', 2000))
    const second = tl.ordered(next.tracks[0])[1]
    expect([item(next, 'c1').anchor, item(next, 'c2').anchor]).toEqual([{ clip: 'p1', offset_ms: 500 }, { clip: second.id, offset_ms: 1000 }])
    expect(item(next, 'c2').start_ms).toBe(3000)
  })
})

describe('the magnet (contract 2)', () => {
  it('delete, trim, add and duplicate close up the main track; other tracks keep their gaps', () => {
    let doc = magnetDoc([clip('a', 0), clip('b', 2000), clip('c', 4000)], [clip('o', 5000, 500)])
    doc = edit(doc, tl.deleteOps(doc, ['b']))
    expect(starts(doc, 'v1')).toEqual([['a', 0], ['c', 2000]])
    doc = edit(doc, tl.trimOps(doc, 'a', 'end', 1000))
    expect(starts(doc, 'v1')).toEqual([['a', 0], ['c', 1000]])
    doc = edit(doc, tl.addClipOps(doc, 'v1', 'new', { start: 900, info: { media_type: 'video', duration_ms: 500 } }))
    expect(starts(doc, 'v1').map(r => r[1])).toEqual([0, 1000, 1500])
    doc = edit(doc, tl.duplicateOps(doc, 'a'))
    expect(starts(doc, 'v1').map(r => r[1])).toEqual([0, 1000, 2000, 2500])
    expect(starts(doc, 'v2')).toEqual([['o', 5000]])
  })

  it('turning the magnet on closes the gaps; off keeps them', () => {
    const doc = docWith(clip('a', 500), clip('b', 4000))
    const on = edit(doc, tl.setMagnetOps(doc, true))
    expect(starts(on, 'v1')).toEqual([['a', 0], ['b', 2000]])
    expect(tl.problem({ ...doc, settings: { magnet: true } })).toMatch(/no gaps/)
    expect(tl.setMagnetOps(on, true)).toEqual([])
  })

  it('a moved main-track clip goes to the nearest edit point and its old transitions go', () => {
    let doc = magnetDoc([clip('a', 0), clip('b', 2000), clip('c', 4000)])
    doc = edit(doc, tl.addTransitionOps(doc, 'a', 'crossfade', 500))
    expect(starts(doc, 'v1')).toEqual([['a', 0], ['b', 1500], ['c', 3500]])
    doc = edit(doc, tl.moveOps(doc, 'a', 5000))
    expect(starts(doc, 'v1')).toEqual([['b', 0], ['c', 2000], ['a', 4000]])
    expect(doc.tracks[0].items.some(i => i.type === 'transition')).toBe(false)
    expect(tl.moveOps(magnetDoc([clip('a', 0)]), 'a', 1000)).toEqual([])  // a lone clip stays at 0
  })
})

describe('edits', () => {
  it('trims the start edge with the in point, so the picture stays where it was', () => {
    const doc = docWith(clip('a', 1000, 4000, { source_in_ms: 500 }))
    const out = edit(doc, tl.trimOps(doc, 'a', 'start', 1600))
    expect([item(out, 'a').start_ms, item(out, 'a').source_in_ms, tl.itemEnd(item(out, 'a'), 30)]).toEqual([1600, 1100, 4500])
    const early = edit(doc, tl.trimOps(doc, 'a', 'start', 0))             // never before the file's first frame
    expect([item(early, 'a').start_ms, item(early, 'a').source_in_ms]).toEqual([500, 0])
  })

  it('trims the end edge within the file and never below a frame; says when the file runs out', () => {
    const doc = docWith(clip('a', 0, 2000, { speed: 2 }))
    expect(item(run(doc, tl.trimOps(doc, 'a', 'end', 500)), 'a').source_out_ms).toBe(1000)      // 2x: 0.5 s is 1 s of file
    const full = run(doc, tl.trimOps(doc, 'a', 'end', 9000, { durations: { m: 3000 } }))
    expect(item(full, 'a').source_out_ms).toBe(3000)
    expect(tl.atMediaEnd(full, 'a', 'end', { durations: { m: 3000 } })).toBe(true)
    expect(tl.atMediaEnd(doc, 'a', 'end', { durations: { m: 3000 } })).toBe(false)
    expect(tl.atMediaEnd(doc, 'a', 'start')).toBe(true)                    // in point 0
    expect(tl.clipLength(item(run(doc, tl.trimOps(doc, 'a', 'end', 0)), 'a'), 30)).toBeGreaterThanOrEqual(tl.MIN_ITEM_MS)
  })

  it('ripple trim moves what comes after on that track', () => {
    const doc = docWith(clip('a', 0), clip('b', 2000), clip('c', 5000))
    const end = edit(doc, tl.trimOps(doc, 'a', 'end', 1500, { ripple: true }))
    expect(starts(end, 'v1')).toEqual([['a', 0], ['b', 1500], ['c', 4500]])
    const head = edit(doc, tl.trimOps(doc, 'b', 'start', 2500, { ripple: true }))
    expect([item(head, 'b').start_ms, item(head, 'b').source_in_ms, item(head, 'c').start_ms]).toEqual([2000, 500, 4500])
  })

  it('splits a clip into two that play back to back, with the keyframes on each side', () => {
    const doc = docWith(clip('a', 1000, 5000, { source_in_ms: 1000, fade_in_ms: 300, fade_out_ms: 400,
      keyframes: { 'transform.scale': [{ t_ms: 0, v: 1, ease: 'linear' }, { t_ms: 1000, v: 1.2, ease: 'ease_out' }, { t_ms: 3000, v: 2, ease: 'linear' }] } }))
    const out = edit(doc, tl.splitOps(doc, 'a', 2500))
    const [first, second] = tl.ordered(out.tracks[0])
    expect([first.id, first.start_ms, first.source_in_ms, first.source_out_ms, first.fade_out_ms]).toEqual(['a', 1000, 1000, 2500, undefined])
    expect([second.start_ms, second.source_in_ms, second.source_out_ms, second.fade_in_ms, second.fade_out_ms]).toEqual([2500, 2500, 5000, undefined, 400])
    // Each side keeps the value at the cut by a boundary key (1.2 + 0.8 * ease_out(0.25) there).
    expect(first.keyframes['transform.scale'].map(k => k.t_ms)).toEqual([0, 1000, 1500])
    expect(second.keyframes['transform.scale'].map(k => k.t_ms)).toEqual([0, 1500])
    expect(second.keyframes['transform.scale'][0]).toEqual({ ...first.keyframes['transform.scale'][2], t_ms: 0, ease: 'ease_out' })
    expect(tl.itemEnd(first, 30)).toBe(second.start_ms)
    expect(tl.splitOps(doc, 'a', 1010)).toEqual([])                       // too near an edge
  })

  it('splitting moves the transition out of the clip to its second part', () => {
    let doc = docWith(clip('a', 0, 4000), clip('b', 4000, 2000))
    doc = edit(doc, tl.addTransitionOps(doc, 'a', 'wipe_left', 500))
    doc = edit(doc, tl.splitOps(doc, 'a', 1000))
    const tr = doc.tracks[0].items.find(i => i.type === 'transition')
    expect(tr.between[0]).not.toBe('a')
    expect(tr.between[1]).toBe('b')
  })

  it('a transition overlaps its two clips by its length and goes away cleanly', () => {
    let doc = docWith(clip('a', 0), clip('b', 2000), clip('c', 4000))
    doc = edit(doc, tl.addTransitionOps(doc, 'a', 'crossfade', 500))
    expect([item(doc, 'b').start_ms, item(doc, 'c').start_ms, tl.totalMs(doc)]).toEqual([1500, 3500, 5500])
    const tr = doc.tracks[0].items.find(i => i.type === 'transition')
    doc = edit(doc, tl.setTransitionMsOps(doc, tr.id, 800))
    expect(item(doc, 'b').start_ms).toBe(1200)
    doc = edit(doc, tl.removeTransitionOps(doc, tr.id))
    expect([item(doc, 'b').start_ms, item(doc, 'c').start_ms]).toEqual([2000, 4000])
    expect(tl.addTransitionOps(docWith(clip('a', 0), clip('b', 2500)), 'a')).toEqual([])           // they do not meet
    expect(tl.addTransitionOps(docWith(clip('a', 0, 400), clip('b', 400)), 'a', 'crossfade', 500)).toEqual([])  // too long
    expect(tl.addTransitionOps(docWith(clip('a', 0), clip('b', 2000)), 'a', 'spin')).toEqual([])   // not a kind
  })

  it('deletes, or deletes and closes the gap on that track only', () => {
    const doc = { ...docWith(clip('a', 0), clip('b', 2000), clip('c', 4000)) }
    doc.tracks = [...doc.tracks.slice(0, 2), { id: 'a1', kind: 'audio', items: [sound('m', 5000)] }]
    const plain = edit(doc, tl.deleteOps(doc, ['b']))
    expect([item(plain, 'b'), item(plain, 'c').start_ms]).toEqual([undefined, 4000])
    const ripple = edit(doc, tl.deleteOps(doc, ['b'], { ripple: true }))
    expect([item(ripple, 'c').start_ms, item(ripple, 'm').start_ms]).toEqual([2000, 5000])
  })

  it('duplicates into free space and moves across tracks of the same kind', () => {
    let doc = docWith(clip('a', 0), clip('b', 2000))
    doc = edit(doc, tl.duplicateOps(doc, 'a'))
    const copy = tl.ordered(doc.tracks[0]).at(-1)
    expect([copy.start_ms, copy.id === 'a']).toEqual([4000, false])
    doc = run(doc, tl.addTrackOps(doc, 'video'))
    expect(doc.tracks.map(t => t.id)).toEqual(['v1', 'v2', 't1', 'a1'])   // a new video track goes above the others
    expect(doc.tracks[1].main).toBeUndefined()                            // and is not the main one
    doc = edit(doc, tl.moveOps(doc, 'b', 500, 'v2'))
    expect([tl.find(doc, 'b').track.id, item(doc, 'b').start_ms]).toEqual(['v2', 500])
    expect(tl.moveOps(doc, 'b', 0, 'a1')).toEqual([])                     // a clip never lands on a sound track
  })

  it('reports an overlap the server would refuse', () => {
    const doc = docWith(clip('a', 0), clip('b', 2000))
    expect(tl.problem(run(doc, tl.moveOps(doc, 'b', 1500)))).toMatch(/overlap/)
  })

  it('adds clips of each kind and text, on the grid', () => {
    let doc = { ...tl.newDoc('9:16'), settings: { magnet: false } }
    doc = edit(doc, tl.addClipOps(doc, 'v1', 'vid', { info: { media_type: 'video', duration_ms: 4200 } }))
    doc = edit(doc, tl.addClipOps(doc, 'v1', 'pic', { info: { media_type: 'image' } }))
    doc = edit(doc, tl.addClipOps(doc, 'a1', 'song', { start: 1010, info: { media_type: 'audio', duration_ms: 9000 } }))
    doc = edit(doc, tl.addTextOps(doc, 't1', { start: 517, captions: true, text: 'Hi' }))
    const [v, p] = tl.ordered(doc.tracks[0])
    expect([v.source_out_ms, p.start_ms, p.hold_ms]).toEqual([4200, 4200, 3000])
    expect(doc.tracks[2].items[0]).toMatchObject({ start_ms: 1000, source_out_ms: 9000 })
    expect(doc.tracks[2].items[0].transform).toBeUndefined()
    expect(doc.tracks[1].items[0]).toMatchObject({ text: 'Hi', start_ms: 533, end_ms: 3533, y: 0.88 })
  })
})

describe('professional edits', () => {
  it('insert splits the clip under the time and pushes the rest later', () => {
    const doc = docWith(clip('a', 0, 4000), clip('b', 4000))
    const next = edit(doc, tl.insertOps(doc, 'v1', tl.newClip(doc, 'video', 'new', { media_type: 'video', duration_ms: 1000 }), 1500))
    expect(starts(next, 'v1').map(r => r[1])).toEqual([0, 1500, 2500, 5000])
    expect(tl.ordered(next.tracks[0])[1].media).toBe('new')
    expect(tl.insertOps(doc, 't1', clip('z', 0), 0)).toEqual([])           // a clip never goes on a text track
  })

  it('overwrite takes the time range and cuts away what was there, moving nothing else', () => {
    const doc = docWith(clip('a', 0, 2000), clip('b', 2000, 2000), clip('c', 4000, 2000))
    const next = edit(doc, tl.overwriteOps(doc, 'v1', tl.newClip(doc, 'video', 'new', { media_type: 'video', duration_ms: 2000 }), 1000))
    const list = tl.ordered(next.tracks[0])
    expect(list.map(i => [i.media, i.start_ms, tl.itemEnd(i, 30)])).toEqual([['m', 0, 1000], ['new', 1000, 3000], ['m', 3000, 4000], ['m', 4000, 6000]])
  })

  it('replace keeps place, length, speed, volume, fades and effects; a shorter file is refused', () => {
    const doc = docWith(clip('a', 0, 4000, { speed: 2, volume_db: -6, fade_in_ms: 200, effects: [{ id: 'e1', kind: 'blur', enabled: true, params: { radius: 4 } }] }))
    const next = edit(doc, tl.replaceOps(doc, 'a', 'other', { media_type: 'video', duration_ms: 10000 }))
    expect(item(next, 'a')).toMatchObject({ media: 'other', start_ms: 0, source_in_ms: 0, source_out_ms: 4000, speed: 2, volume_db: -6, fade_in_ms: 200 })
    expect(item(next, 'a').effects).toEqual(item(doc, 'a').effects)
    expect(tl.replaceProblem(doc, 'a', { media_type: 'video', duration_ms: 3000 })).toMatch(/shorter/)
    expect(tl.replaceOps(doc, 'a', 'other', { media_type: 'video', duration_ms: 3000 })).toEqual([])
    const pic = edit(doc, tl.replaceOps(doc, 'a', 'still', { media_type: 'image' }))
    expect([item(pic, 'a').hold_ms, item(pic, 'a').source_in_ms]).toEqual([2000, undefined])
  })

  it('roll moves the edit point between two clips; nothing else moves; bounded by the files', () => {
    const doc = docWith(clip('a', 0, 2000), clip('b', 2000, 2000, { source_in_ms: 500 }), clip('c', 4000))
    const next = edit(doc, tl.rollOps(doc, 'a', 2400, { durations: { m: 3000 } }))
    expect([tl.itemEnd(item(next, 'a'), 30), item(next, 'b').start_ms, item(next, 'b').source_in_ms, item(next, 'c').start_ms]).toEqual([2400, 2400, 900, 4000])
    const back = edit(doc, tl.rollOps(doc, 'a', 0, { durations: { m: 3000 } }))
    expect(tl.itemEnd(item(back, 'a'), 30)).toBe(1500)                     // b's file starts 500 ms before its in point
    const far = edit(doc, tl.rollOps(doc, 'a', 3900, { durations: { m: 2200 } }))
    expect(tl.itemEnd(item(far, 'a'), 30)).toBe(2200)                      // a's file ends at 2.2 s
    expect(tl.rollOps(doc, 'c', 7000)).toEqual([])                         // nothing after c
  })

  it('slip changes the part of the file that plays, within the file', () => {
    const doc = docWith(clip('a', 1000, 2500, { source_in_ms: 500 }))
    const next = edit(doc, tl.slipOps(doc, 'a', 300, { durations: { m: 3000 } }))
    expect([item(next, 'a').start_ms, item(next, 'a').source_in_ms, item(next, 'a').source_out_ms]).toEqual([1000, 800, 2800])
    expect(item(run(doc, tl.slipOps(doc, 'a', 5000, { durations: { m: 3000 } })), 'a').source_out_ms).toBe(3000)
    expect(item(run(doc, tl.slipOps(doc, 'a', -5000)), 'a').source_in_ms).toBe(0)
  })

  it('slide moves a clip between its neighbours, which give and take the time', () => {
    const doc = docWith(clip('a', 0, 2000), clip('b', 2000, 2000, { source_in_ms: 1000, source_out_ms: 3000 }), clip('c', 4000, 2000, { source_in_ms: 1000, source_out_ms: 3000 }))
    const next = edit(doc, tl.slideOps(doc, 'b', 500, { durations: { m: 5000 } }))
    expect([tl.itemEnd(item(next, 'a'), 30), item(next, 'b').start_ms, item(next, 'b').source_in_ms, item(next, 'c').start_ms, item(next, 'c').source_in_ms])
      .toEqual([2500, 2500, 1000, 4500, 1500])
    const left = edit(doc, tl.slideOps(doc, 'b', -5000, { durations: { m: 5000 } }))
    expect(item(left, 'b').start_ms).toBe(1000)                            // c's file starts 1 s before its in point
    const magnet = { ...doc, settings: { magnet: true } }
    expect(starts(run(magnet, tl.slideOps(magnet, 'b', 500, { durations: { m: 5000 } })), 'v1').map(r => r[1])).toEqual([0, 2500, 4500])
  })

  it('blade splits every track at a time, except locked ones', () => {
    const doc = { ...docWith(clip('a', 0, 4000)) }
    doc.tracks = [doc.tracks[0], { id: 'v2', kind: 'video', items: [clip('o', 1000, 3000)] }, { id: 'a1', kind: 'audio', lock: true, items: [sound('s', 0, 4000)] }]
    const next = edit(doc, tl.bladeOps(doc, 2000))
    expect([next.tracks[0].items.length, next.tracks[1].items.length, next.tracks[2].items.length]).toEqual([2, 2, 1])
  })

  it('split audio from video: the sound becomes its own connected clip and the video is muted', () => {
    const doc = magnetDoc([clip('a', 0, 3000, { volume_db: -3, pan: 0.5, keyframes: { volume_db: [{ t_ms: 0, v: -3, ease: 'linear' }], 'transform.x': [{ t_ms: 0, v: 0.5, ease: 'linear' }] } })])
    const next = edit(doc, tl.splitAudioOps(doc, 'a'))
    const s = next.tracks.find(t => t.id === 'a1').items[0]
    expect(s).toMatchObject({ media: 'm', start_ms: 0, source_in_ms: 0, source_out_ms: 3000, volume_db: -3, pan: 0.5, role: 'dialogue', anchor: { clip: 'a', offset_ms: 0 } })
    expect(s.keyframes).toEqual({ volume_db: [{ t_ms: 0, v: -3, ease: 'linear' }] })
    expect(item(next, 'a')).toMatchObject({ muted: true })
    expect([item(next, 'a').volume_db, item(next, 'a').pan, Object.keys(item(next, 'a').keyframes)]).toEqual([undefined, undefined, ['transform.x']])
    expect(tl.splitAudioOps(next, 'a')).toEqual([])                        // already split
    // A J cut: the sound starts earlier than the picture by trimming it alone.
    const busy = magnetDoc([clip('a', 0, 3000)], [], [sound('x', 0, 5000)])
    expect(edit(busy, tl.splitAudioOps(busy, 'a')).tracks.filter(t => t.kind === 'audio')).toHaveLength(2)
  })

  it('markers are added in time order on the grid, renamed, recoloured, made chapters and removed', () => {
    let doc = docWith()
    doc = edit(doc, tl.markerOps(doc, 'add', { at_ms: 4010, name: 'Hook' }))
    doc = edit(doc, tl.markerOps(doc, 'add', { at_ms: 1000, name: 'Intro', color: '#46a758', chapter: true }))
    expect(doc.markers.map(m => [m.name, m.at_ms, m.color, m.chapter])).toEqual([['Intro', 1000, '#46A758', true], ['Hook', 4000, '#F2B341', false]])
    const hook = doc.markers[1].id
    doc = edit(doc, tl.markerOps(doc, 'set', { id: hook, changes: { at_ms: 500, name: 'x'.repeat(200), color: 'red' } }))
    expect([doc.markers[0].id, doc.markers[0].name.length, doc.markers[0].color]).toEqual([hook, 80, '#F2B341'])
    doc = edit(doc, tl.markerOps(doc, 'remove', { id: hook }))
    expect(doc.markers.map(m => m.name)).toEqual(['Intro'])
    const full = { ...doc, markers: Array.from({ length: 64 }, (_, n) => ({ id: `k${n + 10}`, at_ms: 0, name: '', color: '#F2B341', chapter: false })) }
    expect(tl.markerOps(full, 'add', { at_ms: 0 })).toEqual([])
  })
})

describe('compound clips', () => {
  const base = () => magnetDoc([clip('a', 0), clip('b', 2000), clip('c', 4000)], [clip('o', 2500, 500, { anchor: { clip: 'b', offset_ms: 500 } }), clip('p', 4200, 300, { anchor: { clip: 'c', offset_ms: 200 } })])

  it('makes a compound of selected clips, shown as one clip, and the rest closes up around it', () => {
    let doc = base()
    doc = edit(doc, tl.addTransitionOps(doc, 'a', 'crossfade', 500))
    const next = edit(doc, tl.compoundOps(doc, 'make', { ids: ['a', 'b', 'o'], name: 'Opening' }))
    const [cid] = Object.keys(next.compounds)
    const def = next.compounds[cid]
    expect(def.name).toBe('Opening')
    expect(def.tracks.map(t => [t.kind, !!t.main, t.items.map(i => i.id)])).toEqual([['video', true, ['a', 'b', 'x1']], ['video', false, ['o']]])
    const cclip = tl.ordered(next.tracks[0])[0]
    expect(cclip).toMatchObject({ compound: cid, start_ms: 0, source_in_ms: 0, source_out_ms: 3500 })
    expect(starts(next, 'v1').map(r => r[1])).toEqual([0, 3500])
    expect(item(next, 'p').start_ms).toBe(3700)                            // still connected to c
    expect(tl.compoundOps(doc, 'open', { id: cclip.id })).toEqual([])
  })

  it('edits inside a compound change it for every use; flatten puts its clips back', () => {
    const doc = base()
    const made = edit(doc, tl.compoundOps(doc, 'make', { ids: ['a', 'b'] }))
    const [cid] = Object.keys(made.compounds)
    const view = tl.viewOf(made, cid)
    expect(view.tracks).toBe(made.compounds[cid].tracks)
    const inside = edit(made, tl.scopeOps(tl.trimOps(view, 'a', 'end', 1000), cid))
    expect(tl.clipLength(inside.compounds[cid].tracks[0].items[0], 30)).toBe(1000)
    const cclip = tl.ordered(made.tracks[0])[0]
    const flat = edit(made, tl.compoundOps(made, 'flatten', { id: cclip.id }))
    expect(flat.compounds).toBeUndefined()
    expect(tl.ordered(flat.tracks[0]).map(i => [i.start_ms, i.source_in_ms, i.source_out_ms])).toEqual([[0, 0, 2000], [2000, 0, 2000], [4000, 0, 2000]])
    expect(item(flat, 'o').anchor.clip).toBe(tl.ordered(flat.tracks[0])[1].id)
  })

  it('flatten of a trimmed compound keeps only what it showed', () => {
    const doc = base()
    const made = edit(doc, tl.compoundOps(doc, 'make', { ids: ['a', 'b'] }))
    const cclip = tl.ordered(made.tracks[0])[0]
    const trimmed = edit(made, tl.trimOps(made, cclip.id, 'start', 1000))
    const flat = edit(trimmed, tl.compoundOps(trimmed, 'flatten', { id: cclip.id }))
    expect(tl.ordered(flat.tracks[0]).map(i => [i.start_ms, i.source_in_ms, i.source_out_ms])).toEqual([[0, 1000, 2000], [1000, 0, 2000], [3000, 0, 2000]])
  })

  it('refuses a compound that contains itself and more than eight', () => {
    const doc = base()
    const made = edit(doc, tl.compoundOps(doc, 'make', { ids: ['a'] }))
    const [cid] = Object.keys(made.compounds)
    const cclip = tl.ordered(made.tracks[0])[0]
    // Inside the compound, a clip that uses the same compound would contain itself.
    const view = tl.viewOf(made, cid)
    const selfUse = { ...view, tracks: [{ ...view.tracks[0], items: [...view.tracks[0].items] }] }
    selfUse.tracks[0].items.push({ ...cclip, id: 'self', start_ms: 2000 })
    expect(tl.compoundProblem({ ...selfUse, _root: made, _scope: cid }, ['self'])).toMatch(/itself/)
    const full = { ...made, compounds: Object.fromEntries(Array.from({ length: 8 }, (_, n) => [`cp${n + 1}`, { name: 'x', tracks: [] }])) }
    expect(tl.compoundProblem(full, ['b'])).toMatch(/at most 8/)
  })
})

describe('keyframes and effects', () => {
  it('sets keyframes on the grid inside the clip, in order, replacing one at the same time', () => {
    let doc = docWith(clip('a', 0, 2000))
    doc = edit(doc, tl.setKeyframeOps(doc, 'a', 'transform.scale', 1010, 1.2, 'ease_out'))
    doc = edit(doc, tl.setKeyframeOps(doc, 'a', 'transform.scale', 0, 1))
    doc = edit(doc, tl.setKeyframeOps(doc, 'a', 'transform.scale', 99999, 2, { ease: 'bezier', bez: [0.2, 0, 0.3, 1] }))
    doc = edit(doc, tl.setKeyframeOps(doc, 'a', 'transform.scale', 1000, 1.5, 'hold'))
    expect(item(doc, 'a').keyframes['transform.scale']).toEqual([
      { t_ms: 0, v: 1, ease: 'linear' }, { t_ms: 1000, v: 1.5, ease: 'hold' }, { t_ms: 2000, v: 2, ease: 'bezier', bez: [0.2, 0, 0.3, 1] }])
    doc = edit(doc, tl.removeKeyframeOps(doc, 'a', 'transform.scale', 1000))
    expect(tl.keyframeTimes(item(doc, 'a'))).toEqual([0, 2000])
    expect(tl.setKeyframeOps(doc, 'a', 'transform.skew', 0, 1)).toEqual([])
    expect(tl.setKeyframeOps(doc, 'a', 'fx.e9.radius', 0, 1)).toEqual([])  // no such effect
    expect(tl.setKeyframeOps(doc, 'a', 'transform.x', 0, 1, { ease: 'bezier', bez: [2, 0, 0, 1] })).toEqual([])
    expect(tl.setKeyframeOps(doc, 'a', 'transform.x', 0, 1, 'wobble')).toEqual([])
  })

  it('keeps at most 200 keyframes on a clip and drops the ones past a shortened end', () => {
    const keys = { 'transform.x': Array.from({ length: 200 }, (_, n) => ({ t_ms: tl.frameTime(n, 30), v: 0, ease: 'linear' })) }
    const doc = docWith(clip('a', 0, 10000, { keyframes: keys }))
    expect(tl.setKeyframeOps(doc, 'a', 'transform.y', 0, 1)).toEqual([])
    const short = edit(doc, tl.trimOps(doc, 'a', 'end', 1000))
    expect(item(short, 'a').keyframes['transform.x'].at(-1).t_ms).toBe(1000)
    const head = edit(doc, tl.trimOps(doc, 'a', 'start', 100))
    expect(item(head, 'a').keyframes['transform.x'][0]).toEqual({ t_ms: 0, v: 0, ease: 'linear' })
    expect(tl.problem({ ...doc, tracks: [{ ...doc.tracks[0], items: [clip('a', 0, 1000, { keyframes: { 'transform.x': [{ t_ms: 5000, v: 0, ease: 'linear' }] } })] }] })).toMatch(/keyframe/)
  })

  it('adds effects with the registry\'s defaults, changes, reorders and removes them with their keyframes', () => {
    let doc = docWith(clip('a', 0, 2000))
    doc = edit(doc, tl.addEffectOps(doc, 'a', 'adjust', { registry }))
    doc = edit(doc, tl.addEffectOps(doc, 'a', 'blur', { registry, params: { radius: 8 } }))
    const [adj, blur] = item(doc, 'a').effects
    expect(adj).toMatchObject({ kind: 'adjust', enabled: true, params: { exposure: 0, contrast: 1, saturation: 1 } })
    expect(blur.params).toEqual({ radius: 8 })
    doc = edit(doc, tl.setEffectOps(doc, 'a', adj.id, { enabled: false, params: { exposure: 0.5 } }))
    expect(item(doc, 'a').effects[0]).toMatchObject({ enabled: false, params: { exposure: 0.5, contrast: 1 } })
    doc = edit(doc, tl.setKeyframeOps(doc, 'a', `fx.${blur.id}.radius`, 0, 2, 'linear', { registry }))
    expect(tl.setKeyframeOps(doc, 'a', `fx.${adj.id}.nothing`, 0, 2, 'linear', { registry })).toEqual([])
    doc = edit(doc, tl.moveEffectOps(doc, 'a', blur.id, 0))
    expect(item(doc, 'a').effects.map(e => e.kind)).toEqual(['blur', 'adjust'])
    doc = edit(doc, tl.removeEffectOps(doc, 'a', blur.id))
    expect([item(doc, 'a').effects.map(e => e.kind), item(doc, 'a').keyframes]).toEqual([['adjust'], undefined])
    expect(tl.addEffectOps(doc, 'a', 'sparkles', { registry })).toEqual([])
    const full = docWith(clip('a', 0, 2000, { effects: Array.from({ length: 20 }, (_, n) => ({ id: `e${n + 1}`, kind: 'blur', enabled: true, params: {} })) }))
    expect(tl.addEffectOps(full, 'a', 'blur')).toEqual([])
  })

  it('pastes the attributes chosen, with their keyframes, and skips what does not apply', () => {
    const from = clip('a', 0, 2000, { transform: { x: 0.2, y: 0.3, scale: 2, opacity: 1 }, effects: [{ id: 'e1', kind: 'blur', enabled: true, params: { radius: 3 } }], volume_db: -9,
      keyframes: { 'transform.scale': [{ t_ms: 0, v: 1, ease: 'linear' }, { t_ms: 1900, v: 2, ease: 'linear' }], volume_db: [{ t_ms: 0, v: -9, ease: 'linear' }] } })
    const doc = { ...docWith(from, clip('b', 2000, 1000)) }
    doc.tracks[2] = { id: 'a1', kind: 'audio', items: [sound('s', 0, 1000)] }
    const next = edit(doc, tl.pasteAttributesOps(doc, 'a', ['b', 's'], ['transform', 'effects']))
    expect(item(next, 'b')).toMatchObject({ transform: from.transform, effects: from.effects })
    // Past b's end dropped, with a boundary key at its end holding the value there.
    expect(item(next, 'b').keyframes).toEqual({ 'transform.scale': [{ t_ms: 0, v: 1, ease: 'linear' }, { t_ms: 1000, v: 1 + 1000 / 1900, ease: 'linear' }] })
    expect(item(next, 's')).toEqual(item(doc, 's'))                         // a picture setting on a sound
    const vol = edit(doc, tl.pasteAttributesOps(doc, 'a', ['s'], ['audio']))
    expect([item(vol, 's').volume_db, item(vol, 's').keyframes]).toEqual([-9, { volume_db: [{ t_ms: 0, v: -9, ease: 'linear' }] }])
    expect(tl.attributeGroupsFor(from, 'video')).toEqual(['transform', 'crop', 'blend', 'effects', 'speed', 'audio', 'fades'])
    expect(tl.attributeGroupsFor({ type: 'text', id: 'q', start_ms: 0, end_ms: 100 }, 'text')).toEqual(['text'])
  })
})

describe('HSL: nested effect params (params.<colour>.<h|s|l>)', () => {
  it('starts from the nested defaults, merges a change into its colour, and animates fx.<id>.<colour>.<h|s|l>', () => {
    let doc = docWith(clip('a', 0, 2000))
    doc = edit(doc, tl.addEffectOps(doc, 'a', 'hsl', { registry }))
    const fx = item(doc, 'a').effects[0]
    expect(fx.params.red).toEqual({ h: 0, s: 0, l: 0 })
    expect(Object.keys(fx.params).sort()).toEqual(['blue', 'cyan', 'green', 'magenta', 'red', 'yellow'])
    doc = edit(doc, tl.setEffectOps(doc, 'a', fx.id, { params: { red: { h: 12 } } }))
    expect(item(doc, 'a').effects[0].params.red).toEqual({ h: 12, s: 0, l: 0 })
    doc = edit(doc, tl.setKeyframeOps(doc, 'a', `fx.${fx.id}.red.h`, 0, 5, 'linear', { registry }))
    expect(item(doc, 'a').keyframes[`fx.${fx.id}.red.h`]).toEqual([{ t_ms: 0, v: 5, ease: 'linear' }])
    expect(tl.keyframePathOk(item(doc, 'a'), `fx.${fx.id}.blue.l`, registry)).toBe(true)
    expect(tl.keyframePathOk(item(doc, 'a'), `fx.${fx.id}.red`, registry)).toBe(false)        // a group, not a number
    expect(tl.keyframePathOk(item(doc, 'a'), `fx.${fx.id}.red.q`, registry)).toBe(false)
    expect(tl.keyframePathOk(item(doc, 'a'), `fx.${fx.id}.red.h.x`, registry)).toBe(false)
    expect([tl.paramAt(registry.effects.hsl.params, 'green.s').max, tl.paramAt(registry.effects.adjust.params, 'exposure').min]).toEqual([1, -2])
  })
})

describe('track controls', () => {
  it('lock, mute, hide and solo are true or absent; version 2 names give way to them', () => {
    let doc = docWith()
    doc.tracks[0] = { ...doc.tracks[0], muted: true }
    doc = edit(doc, tl.setTrackFlagsOps(doc, 'v1', { mute: false, lock: true, solo: true }))
    expect(doc.tracks[0]).toMatchObject({ lock: true, solo: true })
    expect(['mute', 'muted'].map(k => doc.tracks[0][k])).toEqual([undefined, undefined])
    doc = edit(doc, tl.setTrackOps(doc, 'a1', { muted: true, hidden: true }))
    expect([doc.tracks[2].mute, doc.tracks[2].hide, tl.audible(doc, doc.tracks[2]), tl.audible(doc, doc.tracks[0])]).toEqual([true, true, false, true])
    expect(tl.setTrackFlagsOps(doc, 't1', { solo: true })).toEqual([])      // a text track has no sound
  })

  it('height, name and role are kept inside their limits', () => {
    let doc = docWith()
    doc = edit(doc, tl.setTrackFlagsOps(doc, 'v1', { height: 999, name: `  ${'n'.repeat(60)}  ` }))
    expect([doc.tracks[0].height, doc.tracks[0].name.length]).toEqual([160, 40])
    doc = edit(doc, tl.setTrackFlagsOps(doc, 'a1', { role: 'dialogue', height: 4 }))
    expect([doc.tracks[2].role, doc.tracks[2].height, tl.trackRole(doc.tracks[2])]).toEqual(['dialogue', 32, 'dialogue'])
    expect(tl.setTrackFlagsOps(doc, 'a1', { role: 'shouting' })).toEqual([])
    expect(tl.trackRole({ kind: 'audio' })).toBe('music')
  })

  it('making another video track the main one frees the old main\'s connected clips', () => {
    const doc = magnetDoc([clip('p', 0, 2000)], [clip('o', 1000, 500), clip('k', 3000, 500)], [sound('s', 500, 500, { anchor: { clip: 'p', offset_ms: 500 } })])
    const next = edit(doc, tl.setTrackFlagsOps(doc, 'v2', { main: true }))
    expect([next.tracks[0].main, next.tracks[1].main, item(next, 's').anchor]).toEqual([undefined, true, undefined])
    expect(starts(next, 'v2')).toEqual([['o', 0], ['k', 500]])               // the magnet closes up the new main track
  })
})

describe('the server\'s checks', () => {
  it('refuses off-grid times, a missing main track and a misplaced connected clip', () => {
    expect(tl.problem(docWith(clip('a', 34)))).toMatch(/frame/)
    const none = docWith(clip('a', 0))
    none.tracks[0] = { ...none.tracks[0], main: undefined }
    expect(tl.problem(none)).toMatch(/main track/)
    const off = magnetDoc([clip('p', 0)], [clip('o', 700, 300, { anchor: { clip: 'p', offset_ms: 500 } })])
    expect(tl.problem(off)).toMatch(/connected clip/)
    expect(tl.problem(magnetDoc([clip('p', 0, 2000, { anchor: { clip: 'p', offset_ms: 0 } })]))).toMatch(/main track cannot/)
  })
})

describe('undo and redo', () => {
  it('restore the document exactly, edit after edit, and a new edit clears redo', () => {
    const h = tl.createHistory()
    const start = magnetDoc([clip('a', 0, 4000), clip('b', 4000)], [clip('o', 4500, 500)])
    let doc = start
    const states = [doc]
    const steps = [
      d => tl.splitOps(d, 'a', 1000),
      d => tl.addTransitionOps(d, 'a', 'dissolve', 300),
      d => tl.connectOps(d, 'o'),
      d => tl.splitAudioOps(d, 'b'),
      d => tl.markerOps(d, 'add', { at_ms: 2000, name: 'Beat' }),
      d => tl.setKeyframeOps(d, 'b', 'transform.opacity', 0, 0),
      d => tl.addEffectOps(d, 'b', 'vignette', { registry }),
      d => tl.compoundOps(d, 'make', { ids: [tl.ordered(d.tracks[0])[0].id] }),
      d => tl.setTrackFlagsOps(d, 'v2', { lock: true, height: 80 }),
      d => tl.deleteOps(d, ['b']),
      d => tl.setMagnetOps(d, false),
    ]
    for (const step of steps) {
      const ops = step(doc)
      expect(ops.length).toBeGreaterThan(0)
      doc = tl.commit(h, doc, ops, 'step')
      expect(tl.problem(doc)).toBe('')
      states.push(doc)
    }
    for (let i = states.length - 2; i >= 0; i--) { doc = tl.undo(h, doc).doc; expect(doc).toEqual(states[i]) }
    expect(doc).toEqual(start)
    expect(tl.undo(h, doc).doc).toBe(doc)                                 // nothing more to undo
    for (let i = 1; i < states.length; i++) { doc = tl.redo(h, doc).doc; expect(doc).toEqual(states[i]) }
    doc = tl.undo(h, doc).doc
    doc = tl.commit(h, doc, tl.duplicateOps(doc, tl.ordered(doc.tracks[0])[0].id), 'Duplicate')  // o went with its parent b
    expect(h.future).toHaveLength(0)
  })

  it('leave the parts an edit did not touch shared, and an empty edit adds nothing', () => {
    const h = tl.createHistory()
    const doc = docWith(clip('a', 0))
    const next = tl.commit(h, doc, tl.setTrackOps(doc, 'a1', { muted: true }), 'Mute')
    expect(next.tracks[0]).toBe(doc.tracks[0])
    expect(tl.commit(h, next, [], 'Nothing')).toBe(next)
    expect(h.past).toHaveLength(1)
  })
})
