// The clip editor's timeline model (VIDEO_CLIP_EDITOR_PLAN.md section 4 and E9): placement, trim and split
// arithmetic, ripple delete, transitions, snapping, and undo and redo restoring the document exactly.
import { describe, expect, it } from 'vitest'
import * as tl from './timelineModel'

const clip = (id, start, out = 2000, extra = {}) => ({ type: 'clip', id, media: 'm', start_ms: start, source_in_ms: 0, source_out_ms: out, speed: 1, fit: 'contain', transform: { x: 0.5, y: 0.5, scale: 1, opacity: 1 }, ...extra })
const docWith = (...items) => ({ ...tl.newDoc('16:9'), tracks: [{ id: 'v1', kind: 'video', items }, { id: 't1', kind: 'text', captions: true, items: [] }, { id: 'a1', kind: 'audio', items: [] }] })
const run = (doc, ops) => tl.applyOps(doc, ops).doc
const item = (doc, id) => tl.find(doc, id)?.item

describe('reading a timeline', () => {
  it('measures clips, pictures, text and the whole length', () => {
    const doc = docWith(clip('a', 0, 4000, { speed: 2 }), { type: 'clip', id: 'p', media: 'pic', start_ms: 2000, hold_ms: 1500 })
    expect(tl.clipLength(item(doc, 'a'))).toBe(2000)
    expect(tl.itemEnd(item(doc, 'p'))).toBe(3500)
    expect(tl.totalMs(doc)).toBe(3500)
    expect(tl.totalMs(tl.newDoc())).toBe(0)
  })

  it('snaps to frames and to the nearest edge within the threshold', () => {
    expect(tl.toFrame(1010, 30)).toBe(1000)
    expect(tl.toFrame(1020, 30)).toBe(1033)
    const doc = docWith(clip('a', 0), clip('b', 3000))
    const pts = tl.snapPoints(doc, { playhead: 2500, exclude: ['b'] })
    expect(pts).toEqual([0, 2000, 2500])
    expect(tl.snap(2090, pts, 100)).toBe(2000)
    expect(tl.snap(2460, pts, 100)).toBe(2500)
    expect(tl.snap(2250, pts, 100)).toBe(2250)
  })

  it('reads and writes typed times and shows a time code', () => {
    expect(tl.parseTime('12.5')).toBe(12500)
    expect(tl.parseTime('1:02.5')).toBe(62500)
    expect(Number.isNaN(tl.parseTime('soon'))).toBe(true)
    expect(tl.timecode(62533, 30)).toBe('1:02.15')
  })
})

describe('edits', () => {
  it('trims the start edge with the in point, so the picture stays where it was', () => {
    const doc = docWith(clip('a', 1000, 4000, { source_in_ms: 500 }))
    const out = run(doc, tl.trimOps(doc, 'a', 'start', 1600))
    expect([item(out, 'a').start_ms, item(out, 'a').source_in_ms, tl.itemEnd(item(out, 'a'))]).toEqual([1600, 1100, 4500])
    // Never before the file's first frame.
    const early = run(doc, tl.trimOps(doc, 'a', 'start', 0))
    expect([item(early, 'a').start_ms, item(early, 'a').source_in_ms]).toEqual([500, 0])
  })

  it('trims the end edge within the file and never below a frame', () => {
    const doc = docWith(clip('a', 0, 2000, { speed: 2 }))
    expect(item(run(doc, tl.trimOps(doc, 'a', 'end', 500)), 'a').source_out_ms).toBe(1000)      // 2x: 0.5 s is 1 s of file
    expect(item(run(doc, tl.trimOps(doc, 'a', 'end', 9000, { durationMs: 3000 })), 'a').source_out_ms).toBe(3000)
    expect(tl.clipLength(item(run(doc, tl.trimOps(doc, 'a', 'end', 0)), 'a'))).toBeGreaterThanOrEqual(tl.MIN_ITEM_MS)
  })

  it('splits a clip at the playhead into two that play back to back', () => {
    const doc = docWith(clip('a', 1000, 5000, { source_in_ms: 1000, fade_in_ms: 300, fade_out_ms: 400 }))
    const out = run(doc, tl.splitOps(doc, 'a', 2500))
    const [first, second] = tl.ordered(out.tracks[0])
    expect([first.id, first.start_ms, first.source_in_ms, first.source_out_ms, first.fade_out_ms]).toEqual(['a', 1000, 1000, 2500, undefined])
    expect([second.start_ms, second.source_in_ms, second.source_out_ms, second.fade_in_ms, second.fade_out_ms]).toEqual([2500, 2500, 5000, undefined, 400])
    expect(tl.itemEnd(first)).toBe(second.start_ms)
    expect(tl.splitOps(doc, 'a', 1010)).toEqual([])                       // too near an edge
  })

  it('splitting moves the transition out of the clip to its second part', () => {
    let doc = docWith(clip('a', 0, 4000), clip('b', 4000, 2000))
    doc = run(doc, tl.addTransitionOps(doc, 'a', 'wipe', 500))
    doc = run(doc, tl.splitOps(doc, 'a', 1000))
    const tr = doc.tracks[0].items.find(i => i.type === 'transition')
    expect(tr.between[0]).not.toBe('a')
    expect(tr.between[1]).toBe('b')
    expect(tl.problem(doc)).toBe('')
  })

  it('a transition overlaps its two clips by its length and goes away cleanly', () => {
    let doc = docWith(clip('a', 0), clip('b', 2000), clip('c', 4000))
    doc = run(doc, tl.addTransitionOps(doc, 'a', 'crossfade', 500))
    expect([item(doc, 'b').start_ms, item(doc, 'c').start_ms, tl.totalMs(doc)]).toEqual([1500, 3500, 5500])
    expect(tl.problem(doc)).toBe('')
    const tr = doc.tracks[0].items.find(i => i.type === 'transition')
    doc = run(doc, tl.setTransitionMsOps(doc, tr.id, 800))
    expect(item(doc, 'b').start_ms).toBe(1200)
    doc = run(doc, tl.removeTransitionOps(doc, tr.id))
    expect([item(doc, 'b').start_ms, item(doc, 'c').start_ms]).toEqual([2000, 4000])
    expect(tl.addTransitionOps(docWith(clip('a', 0), clip('b', 2500)), 'a')).toEqual([])          // they do not meet
    expect(tl.addTransitionOps(docWith(clip('a', 0, 400), clip('b', 400)), 'a', 'crossfade', 500)).toEqual([])  // too long
  })

  it('deletes, or deletes and closes the gap on that track only', () => {
    const doc = { ...docWith(clip('a', 0), clip('b', 2000), clip('c', 4000)), tracks: [...docWith(clip('a', 0), clip('b', 2000), clip('c', 4000)).tracks.slice(0, 2), { id: 'a1', kind: 'audio', items: [clip('m', 5000)] }] }
    const plain = run(doc, tl.deleteOps(doc, ['b']))
    expect([item(plain, 'b'), item(plain, 'c').start_ms]).toEqual([undefined, 4000])
    const ripple = run(doc, tl.deleteOps(doc, ['b'], { ripple: true }))
    expect([item(ripple, 'c').start_ms, item(ripple, 'm').start_ms]).toEqual([2000, 5000])
  })

  it('deleting a clip removes its transitions with it', () => {
    let doc = docWith(clip('a', 0), clip('b', 2000))
    doc = run(doc, tl.addTransitionOps(doc, 'a'))
    doc = run(doc, tl.deleteOps(doc, ['b']))
    expect(doc.tracks[0].items.map(i => i.id)).toEqual(['a'])
  })

  it('duplicates into free space and moves across tracks of the same kind', () => {
    let doc = docWith(clip('a', 0), clip('b', 2000))
    doc = run(doc, tl.duplicateOps(doc, 'a'))
    const copy = tl.ordered(doc.tracks[0]).at(-1)
    expect([copy.start_ms, copy.id === 'a']).toEqual([4000, false])
    doc = run(doc, tl.addTrackOps(doc, 'video'))
    expect(doc.tracks.map(t => t.id)).toEqual(['v1', 'v2', 't1', 'a1'])     // a new video track goes above the others
    doc = run(doc, tl.moveOps(doc, 'b', 500, 'v2'))
    expect([tl.find(doc, 'b').track.id, item(doc, 'b').start_ms]).toEqual(['v2', 500])
    expect(tl.moveOps(doc, 'b', 0, 'a1')).toEqual([])                       // a clip never lands on a sound track
  })

  it('reports an overlap the server would refuse', () => {
    const doc = docWith(clip('a', 0), clip('b', 2000))
    expect(tl.problem(run(doc, tl.moveOps(doc, 'b', 1500)))).toMatch(/overlap/)
  })

  it('adds clips of each kind and text', () => {
    let doc = tl.newDoc('9:16')
    doc = run(doc, tl.addClipOps(doc, 'v1', 'vid', { info: { media_type: 'video', duration_ms: 4200 } }))
    doc = run(doc, tl.addClipOps(doc, 'v1', 'pic', { info: { media_type: 'image' } }))
    doc = run(doc, tl.addClipOps(doc, 'a1', 'song', { start: 1000, info: { media_type: 'audio', duration_ms: 9000 } }))
    doc = run(doc, tl.addTextOps(doc, 't1', { start: 500, captions: true, text: 'Hi' }))
    const [v, p] = tl.ordered(doc.tracks[0])
    expect([v.source_out_ms, p.start_ms, p.hold_ms]).toEqual([4200, 4200, 3000])
    expect(doc.tracks[2].items[0]).toMatchObject({ start_ms: 1000, source_out_ms: 9000 })
    expect(doc.tracks[2].items[0].transform).toBeUndefined()
    expect(doc.tracks[1].items[0]).toMatchObject({ text: 'Hi', start_ms: 500, end_ms: 3500, y: 0.88 })
  })
})

describe('undo and redo (E9)', () => {
  it('restore the document exactly, edit after edit, and a new edit clears redo', () => {
    const h = tl.createHistory()
    const start = docWith(clip('a', 0, 4000), clip('b', 4000))
    let doc = start
    const states = [doc]
    doc = tl.commit(h, doc, tl.splitOps(doc, 'a', 1000), 'Split'); states.push(doc)
    doc = tl.commit(h, doc, tl.addTransitionOps(doc, 'a', 'dissolve', 300), 'Transition'); states.push(doc)
    doc = tl.commit(h, doc, tl.deleteOps(doc, ['b'], { ripple: true }), 'Delete'); states.push(doc)
    doc = tl.commit(h, doc, tl.setOps(doc, 'a', { transform: { x: 0.2, y: 0.3, scale: 0.5, opacity: 1 }, muted: true }), 'Move'); states.push(doc)
    for (let i = states.length - 2; i >= 0; i--) {
      const r = tl.undo(h, doc)
      doc = r.doc
      expect(doc).toEqual(states[i])
    }
    expect(doc).toEqual(start)
    expect(tl.undo(h, doc).doc).toBe(doc)                                 // nothing more to undo
    for (let i = 1; i < states.length; i++) { doc = tl.redo(h, doc).doc; expect(doc).toEqual(states[i]) }
    doc = tl.undo(h, doc).doc
    doc = tl.commit(h, doc, tl.duplicateOps(doc, 'a'), 'Duplicate')
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
