// @vitest-environment jsdom
// The clip editor's state (VIDEO_CLIP_EDITOR_PLAN.md E8, E9; VIDEO_EDITOR_PRO_PLAN.md 3.A and P14): autosave after the
// last edit, each save checked against the revision it started from, the conflict notification that stops saving, an
// edit the server would refuse (or that changes a locked track) never entering the timeline, the tools, the clipboard,
// compounds, J/K/L and loop, and the shortcuts (only with the timeline focused; single keys can be switched off).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useClipEditor } from './useClipEditor'
import * as tl from './timelineModel'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))

const clip = (id, start, out = 2000, extra = {}) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: out, speed: 1, fit: 'contain', transform: { x: 0.5, y: 0.5, scale: 1, opacity: 1 }, ...extra })
// A saved timeline: free placement (magnet off) unless the test says otherwise.
const saved = (revision, items = [clip('a', 0)], extra = {}) => ({ revision, revision_id: 100 + revision, edl: { ...tl.newDoc('9:16'), settings: { magnet: false },
  tracks: [{ id: 'v1', kind: 'video', main: true, items }, { id: 'v2', kind: 'video', items: [] }, { id: 'a1', kind: 'audio', items: [] }], ...extra } })
let timeline = saved(3)

beforeEach(() => {
  vi.useFakeTimers()
  api.get.mockReset(); api.post.mockReset()
  timeline = saved(3)
  api.get.mockImplementation(async url => {
    if (url === '/video/projects/p1/') return { data: { project_id: 'p1', title: 'Cut', aspect_ratio: '9:16', assets: [] } }
    if (url === '/video/projects/p1/timeline/') return { data: timeline }
    if (url.startsWith('/video/editor/media/')) return { data: { attachment_id: 'm1', state: 'ready', media_type: 'video', duration_ms: 5000, has_audio: true } }
    throw new Error(url)
  })
})
afterEach(() => { vi.useRealTimers(); localStorage.clear() })

async function opened(edl = null) {
  if (edl) timeline = { revision: 3, revision_id: 103, edl }
  const ed = useClipEditor({ autosaveMs: 2000 })
  await ed.load('p1')
  return ed
}
const said = async ed => { await Promise.resolve(); return ed.announcement.value }
// A key pressed on an element of the timeline (`cls`), as the timeline passes it on.
function key(ed, k, { cls = 'ct-scroll', ...mods } = {}) {
  const host = document.createElement('div'); host.className = 'ct'
  const el = document.createElement(cls === 'input' ? 'input' : 'div'); if (cls !== 'input') el.className = cls
  host.appendChild(el); document.body.appendChild(host)
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods })
  Object.defineProperty(e, 'target', { value: el })
  const used = ed.handleKey(e)
  host.remove()
  return used
}
const ids = (ed, trackId = 'v1') => tl.ordered(ed.doc.value.tracks.find(t => t.id === trackId)).map(i => i.id)

describe('useClipEditor: saving', () => {
  it('opens the latest revision and the files it uses, read as version 3', async () => {
    timeline = { revision: 3, revision_id: 103, edl: { version: 2, rate: 30, canvas: { aspect: '9:16', background: '#000000' }, tracks: [{ id: 'v1', kind: 'video', items: [clip('a', 0)] }] } }
    const ed = await opened()
    expect([ed.revision.value, ed.revisionId.value, ed.doc.value.tracks[0].items[0].id, ed.doc.value.version, ed.doc.value.tracks[0].main, ed.magnet.value]).toEqual([3, 103, 'a', 3, true, false])
    expect(ed.media.m1.duration_ms).toBe(5000)
    expect(api.get).toHaveBeenCalledWith('/video/editor/media/m1/', { params: { project_id: 'p1' } })
  })

  it('a project with no timeline starts with an empty one in its own shape, magnet on', async () => {
    api.get.mockImplementation(async url => url.endsWith('/timeline/') ? { data: { revision: 0, revision_id: null, edl: null } }
      : { data: { project_id: 'p1', aspect_ratio: '1:1', assets: [] } })
    const ed = await opened()
    expect([ed.revision.value, ed.doc.value.canvas.aspect, ed.doc.value.tracks.map(t => t.kind), ed.magnet.value]).toEqual([0, '1:1', ['video', 'text', 'audio'], true])
  })

  it('autosaves 2 s after the last edit, against the revision the edit started from', async () => {
    const ed = await opened()
    api.post.mockResolvedValue({ data: { revision: 4, revision_id: 104 } })
    ed.edit(tl.moveOps(ed.doc.value, 'a', 500), 'Moved')
    await vi.advanceTimersByTimeAsync(1500)
    ed.edit(tl.moveOps(ed.doc.value, 'a', 700), 'Moved')               // a second edit restarts the wait
    await vi.advanceTimersByTimeAsync(1500)
    expect(api.post).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(600)
    expect(api.post).toHaveBeenCalledTimes(1)
    const [url, body] = api.post.mock.calls[0]
    expect([url, body.base_revision, body.edl.tracks[0].items[0].start_ms, body.edl.version]).toEqual(['/video/projects/p1/timeline/', 3, 700, 3])
    expect([ed.revision.value, ed.revisionId.value, ed.state.dirty]).toEqual([4, 104, false])
    ed.edit(tl.moveOps(ed.doc.value, 'a', 900), 'Moved')
    await vi.advanceTimersByTimeAsync(2100)
    expect(api.post.mock.calls[1][1].base_revision).toBe(4)
  })

  it('when another tab or the agent saved first, it stops saving and says so; nothing is overwritten', async () => {
    const ed = await opened()
    api.post.mockRejectedValue({ response: { status: 409, data: { error: { code: 'conflict' }, timeline: { revision: 5 } } } })
    ed.edit(tl.moveOps(ed.doc.value, 'a', 500), 'Moved')
    await vi.advanceTimersByTimeAsync(2100)
    expect(ed.state.conflict).toEqual({ revision: 5 })
    expect(ed.announcement.value).toMatch(/changed in another tab or by the agent/)
    expect(ed.edit(tl.moveOps(ed.doc.value, 'a', 800), 'Moved')).toBe(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.post).toHaveBeenCalledTimes(1)
    timeline = saved(5, [clip('a', 1200)])
    await ed.reloadLatest()
    expect([ed.state.conflict, ed.revision.value, ed.doc.value.tracks[0].items[0].start_ms, ed.canUndo.value]).toEqual([null, 5, 1200, false])
  })

  it('an edit the server would refuse never enters the timeline', async () => {
    const ed = await opened()
    ed.edit(tl.addClipOps(ed.doc.value, 'v1', 'm1', { start: 3000, info: { media_type: 'video', duration_ms: 2000 } }), 'Added')
    const second = ed.doc.value.tracks[0].items[1].id
    const before = ed.doc.value
    expect(ed.edit(tl.moveOps(ed.doc.value, second, 1000), 'Moved')).toBe(false)
    expect(ed.doc.value).toBe(before)
    expect(await said(ed)).toMatch(/overlap/)
  })

  it('an edit that changes a locked track is refused and says which track', async () => {
    const ed = await opened()
    expect(ed.setTrackFlags('v1', { lock: true })).toBe(true)
    expect(ed.moveItem({ id: 'a', start: 1000 })).toBe(false)
    expect(await said(ed)).toBe('Video 1 is locked. Unlock it to change it.')
    expect(ed.setTrackFlags('v1', { lock: false })).toBe(true)              // the lock itself can always change
    expect(ed.moveItem({ id: 'a', start: 1000 })).toBe(true)
  })

  it('a rate change moves every time onto the new grid in the same edit', async () => {
    const ed = await opened(saved(3, [clip('a', 0, 1000), clip('b', 1033, 1000)]).edl)
    expect(ed.edit([{ op: 'set', path: ['rate'], value: 25 }], 'Frame rate changed')).toBe(true)
    expect([ed.doc.value.rate, tl.find(ed.doc.value, 'b').item.start_ms, tl.problem(ed.doc.value)]).toEqual([25, 1040, ''])
    ed.undo()
    expect([ed.doc.value.rate, tl.find(ed.doc.value, 'b').item.start_ms]).toEqual([30, 1033])
  })

  it('undo and redo walk the history; selection and zoom are not edits', async () => {
    const ed = await opened()
    api.post.mockResolvedValue({ data: { revision: 4, revision_id: 104 } })
    const start = ed.doc.value
    ed.edit(tl.splitOps(ed.doc.value, 'a', 1000), 'Split')
    ed.select('a'); ed.zoom.value = 120
    expect(ed.canUndo.value).toBe(true)
    ed.undo()
    expect(ed.doc.value).toEqual(start)
    expect(ed.canRedo.value).toBe(true)
    ed.redo()
    expect(ed.doc.value.tracks[0].items).toHaveLength(2)
    expect(ed.history.past).toHaveLength(1)
  })

  it('a failed save keeps the edits and says so; the next edit tries again', async () => {
    const ed = await opened()
    api.post.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ data: { revision: 4, revision_id: 104 } })
    ed.edit(tl.moveOps(ed.doc.value, 'a', 500), 'Moved')
    await vi.advanceTimersByTimeAsync(2100)
    expect([ed.state.dirty, !!ed.state.saveError]).toEqual([true, true])
    ed.edit(tl.moveOps(ed.doc.value, 'a', 600), 'Moved')
    await vi.advanceTimersByTimeAsync(2100)
    expect([ed.state.dirty, ed.state.saveError, ed.revision.value]).toEqual([false, '', 4])
  })

  it('the keyboard shortcut setting is remembered and survives blocked storage', async () => {
    const ed = await opened()
    ed.setShortcuts(false)
    expect(ed.shortcuts.value).toBe(false)
    expect(useClipEditor().shortcuts.value).toBe(false)
    ed.setShortcuts(true)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => ed.setShortcuts(false)).not.toThrow()
    spy.mockRestore()
  })
})

describe('useClipEditor: tools and edits', () => {
  it('the Trim tool ripples or rolls; the Select tool trims in place; a trim past the file shows the red edit point', async () => {
    const ed = await opened(saved(3, [clip('a', 0, 2000), clip('b', 2000, 2000, { source_in_ms: 1000, source_out_ms: 3000 }), clip('c', 6000)]).edl)
    ed.trimItem({ id: 'a', edge: 'end', at: 1500 })
    expect([tl.find(ed.doc.value, 'b').item.start_ms, ed.edgeLimit.value]).toEqual([2000, null])
    ed.undo()
    ed.setTool('trim')
    ed.trimItem({ id: 'a', edge: 'end', at: 1500 })                          // ripple
    expect([tl.find(ed.doc.value, 'b').item.start_ms, tl.find(ed.doc.value, 'c').item.start_ms]).toEqual([1500, 5500])
    ed.undo()
    ed.setTrimMode('roll')
    ed.trimItem({ id: 'b', edge: 'start', at: 2500 })                        // the edit point between a and b
    expect([tl.itemEnd(tl.find(ed.doc.value, 'a').item, 30), tl.find(ed.doc.value, 'b').item.start_ms, tl.find(ed.doc.value, 'c').item.start_ms]).toEqual([2500, 2500, 6000])
    ed.undo()
    ed.setTool('select')
    ed.trimItem({ id: 'c', edge: 'end', at: 20000 })                         // the file is 5 s long
    expect([tl.itemEnd(tl.find(ed.doc.value, 'c').item, 30), ed.edgeLimit.value]).toEqual([11000, { id: 'c', edge: 'end' }])
    expect(await said(ed)).toMatch(/the end of the file/)
  })

  it('Alt+arrows slip or slide with those tools; Ctrl+B splits at the playhead; Shift blades every track', async () => {
    const ed = await opened(saved(3, [clip('a', 0, 2000), clip('b', 2000, 2000, { source_in_ms: 500, source_out_ms: 2500 })]).edl)
    ed.setTool('slip')
    ed.nudge('b', 100)                                                         // content follows the pointer: earlier frames
    expect([tl.find(ed.doc.value, 'b').item.source_in_ms, tl.find(ed.doc.value, 'b').item.start_ms]).toEqual([400, 2000])
    ed.setTool('slide')
    ed.nudge('b', 100)
    expect([tl.itemEnd(tl.find(ed.doc.value, 'a').item, 30), tl.find(ed.doc.value, 'b').item.start_ms]).toEqual([2100, 2100])
    ed.seek(1000)
    expect(key(ed, 'b', { ctrlKey: true })).toBe(true)
    expect(ids(ed)).toHaveLength(3)
    ed.select(null)
    ed.edit(tl.addClipOps(ed.doc.value, 'v2', 'm1', { start: 0, info: { media_type: 'video', duration_ms: 3000 } }), 'Added')
    ed.seek(500)
    expect(key(ed, 'B', { ctrlKey: true, shiftKey: true })).toBe(true)
    expect([ids(ed).length, ids(ed, 'v2').length]).toEqual([4, 2])
  })

  it('Q and W trim the clip under the playhead to the playhead, the magnet closing up', async () => {
    const ed = await opened(saved(3, [clip('a', 0, 3000), clip('b', 3000, 2000)], { settings: { magnet: true } }).edl)
    ed.seek(1000)
    key(ed, 'q')
    expect([tl.find(ed.doc.value, 'a').item.source_in_ms, tl.find(ed.doc.value, 'b').item.start_ms, ed.playhead.value]).toEqual([1000, 2000, 0])
    ed.seek(1000)
    key(ed, 'w')
    expect(tl.find(ed.doc.value, 'b').item.start_ms).toBe(1000)
    ed.seek(9000)
    expect(ed.trimToPlayhead('end')).toBe(false)
  })

  it('copy, cut and paste at the playhead; paste attributes asks which, then pastes them', async () => {
    const ed = await opened(saved(3, [clip('a', 0, 2000, { transform: { x: 0.1, y: 0.2, scale: 2, opacity: 1 } }), clip('b', 2000, 2000)]).edl)
    ed.select('a')
    key(ed, 'c', { ctrlKey: true })
    ed.seek(4000)
    key(ed, 'v', { ctrlKey: true })
    expect(ids(ed)).toHaveLength(3)
    const copyId = ed.selection.value[0]
    expect(tl.find(ed.doc.value, copyId).item).toMatchObject({ start_ms: 4000, transform: { scale: 2 } })
    ed.select('b')
    key(ed, 'V', { ctrlKey: true, shiftKey: true })
    expect(ed.pasteAttributesOpen.value).toBe(true)
    expect(ed.attributeChoices.value.map(c => c.id)).toContain('transform')
    ed.pasteAttributes(['transform'])
    expect([tl.find(ed.doc.value, 'b').item.transform.scale, ed.pasteAttributesOpen.value]).toEqual([2, false])
    ed.select(copyId)
    key(ed, 'x', { ctrlKey: true })
    expect(ids(ed)).toEqual(['a', 'b'])
    ed.seek(0)
    ed.select(null)
    ed.paste()                                                                // onto the free video track, a is still there
    expect([ids(ed), ids(ed, 'v2').length]).toEqual([['a', 'b'], 1])
  })

  it('a pasted connected clip stays connected; marquee selects across tracks', async () => {
    const ed = await opened(saved(3, [clip('a', 0, 4000)], { settings: { magnet: true } }).edl)
    ed.edit(tl.addClipOps(ed.doc.value, 'v2', 'm1', { start: 1000, info: { media_type: 'video', duration_ms: 500 } }), 'Added')
    const o = ids(ed, 'v2')[0]
    ed.select(o); ed.connect()
    ed.copy(); ed.seek(2000); ed.paste()
    expect(ids(ed, 'v2')).toHaveLength(2)
    expect(tl.find(ed.doc.value, ed.selection.value[0]).item.anchor).toEqual({ clip: 'a', offset_ms: 2000 })
    expect(ed.selectRange({ trackIds: ['v1', 'v2'], from: 900, to: 1100 })).toEqual(['a', o])
    expect(ed.selectRange({ trackIds: ['v2'], from: 1900, to: 2100 }, { add: true })).toHaveLength(3)
  })

  it('compound clips open for editing, Escape goes back, and undo works inside', async () => {
    const ed = await opened(saved(3, [clip('a', 0), clip('b', 2000), clip('c', 4000)], { settings: { magnet: true } }).edl)
    ed.select('a'); ed.select('b', { add: true })
    key(ed, 'g', { ctrlKey: true })
    const cclip = ed.selection.value[0]
    expect(tl.find(ed.doc.value, cclip).item.compound).toBeTruthy()
    expect(ed.openCompound(cclip)).toBe(true)
    expect(ed.view.value.tracks[0].items.map(i => i.id)).toEqual(['a', 'b'])
    ed.select('b')
    ed.removeSelected()
    const cid = ed.scopeId.value
    expect(ed.doc.value.compounds[cid].tracks[0].items.map(i => i.id)).toEqual(['a'])
    ed.undo()
    expect(ed.doc.value.compounds[cid].tracks[0].items.map(i => i.id)).toEqual(['a', 'b'])
    expect(key(ed, 'Escape')).toBe(true)
    expect([ed.scopeId.value, await said(ed)]).toEqual([null, 'Back on the main timeline'])
    ed.select(cclip)
    key(ed, 'G', { ctrlKey: true, shiftKey: true })
    expect([ids(ed), ed.doc.value.compounds]).toEqual([[expect.any(String), expect.any(String), 'c'], undefined])
  })

  it('markers, split sound, connect and detach, the magnet and track controls announce what they did', async () => {
    const ed = await opened(saved(3, [clip('a', 0, 3000)]).edl)
    ed.seek(1000)
    key(ed, 'm')
    expect(ed.doc.value.markers).toEqual([expect.objectContaining({ at_ms: 1000 })])
    expect(await said(ed)).toBe('Marker added at 0:01.00')
    ed.setMarker(ed.doc.value.markers[0].id, { name: 'Hook', chapter: true })
    expect(ed.doc.value.markers[0]).toMatchObject({ name: 'Hook', chapter: true })
    ed.select('a')
    expect(ed.splitAudio()).toBe(true)
    const s = ed.doc.value.tracks.find(t => t.id === 'a1').items[0]
    expect(s.anchor).toEqual({ clip: 'a', offset_ms: 0 })
    ed.detach([s.id])
    expect(tl.find(ed.doc.value, s.id).item.anchor).toBeUndefined()
    ed.setMagnet(true)
    expect(await said(ed)).toMatch(/Magnet on/)
    ed.setTrackFlags('a1', { mute: true, role: 'dialogue' })
    expect(await said(ed)).toBe('Sound 1 muted, role dialogue')
  })

  it('inserts, overwrites, connects and replaces a file from the project', async () => {
    const ed = await opened(saved(3, [clip('a', 0, 4000)], { settings: { magnet: true } }).edl)
    const file = { attachment_id: 'm2', media_type: 'video', duration_ms: 1000, name: 'b-roll.mp4' }
    ed.seek(2000)
    expect(ed.insertMedia(file, 'insert')).toBe(true)
    expect(tl.ordered(ed.doc.value.tracks[0]).map(i => [i.media, i.start_ms])).toEqual([['m1', 0], ['m2', 2000], ['m1', 3000]])
    expect(ed.insertMedia(file, 'connect')).toBe(true)
    const linked = ed.doc.value.tracks.find(t => t.id === 'v2').items[0]
    expect(linked).toMatchObject({ media: 'm2', start_ms: 2000, anchor: { offset_ms: 0 } })
    ed.select('a')
    expect(ed.insertMedia({ attachment_id: 'm3', media_type: 'video', duration_ms: 500, name: 'short.mp4' }, 'replace')).toBe(false)
    expect(await said(ed)).toMatch(/shorter than the clip/)
    expect(ed.insertMedia({ attachment_id: 'm3', media_type: 'video', duration_ms: 9000, name: 'long.mp4' }, 'replace')).toBe(true)
    expect(tl.find(ed.doc.value, 'a').item.media).toBe('m3')
    expect(ed.insertMedia(file, 'append')).toBe(true)
    expect(tl.ordered(ed.doc.value.tracks[0]).at(-1)).toMatchObject({ media: 'm2', start_ms: 5000 })
  })
})

describe('useClipEditor: playback and shortcuts', () => {
  it('J, K, L shuttle: each press doubles the speed, K stops', async () => {
    const ed = await opened()
    const rates = []
    for (const k of ['l', 'l', 'l', 'l', 'l', 'k', 'j', 'j', 'l']) { key(ed, k); rates.push(ed.playback.rate) }
    expect(rates).toEqual([1, 2, 4, 8, 8, 0, -1, -2, 1])
    expect(ed.playing.value).toBe(true)
  })

  it('plays the selection, stops at its end, or loops it', async () => {
    const ed = await opened(saved(3, [clip('a', 0), clip('b', 2000)]).edl)
    ed.select('b')
    key(ed, '/')
    expect([ed.playhead.value, ed.playback.range, ed.playback.rate]).toEqual([2000, [2000, 4000], 1])
    ed.tick(3000)
    expect(ed.playhead.value).toBe(3000)
    ed.tick(4100)
    expect([ed.playhead.value, ed.playback.rate, ed.playback.range]).toEqual([4000, 0, null])
    key(ed, 'l', { ctrlKey: true })
    ed.playSelection()
    ed.tick(4100)
    expect([ed.playhead.value, ed.playback.rate]).toEqual([2000, 1])
  })

  it('steps frames and jumps between edit points and keyframes', async () => {
    const ed = await opened(saved(3, [clip('a', 0, 2000, { keyframes: { 'transform.x': [{ t_ms: 500, v: 0, ease: 'linear' }, { t_ms: 1500, v: 1, ease: 'linear' }] } }), clip('b', 2000)]).edl)
    key(ed, 'ArrowRight'); key(ed, '.')
    expect(ed.playhead.value).toBe(67)
    key(ed, 'ArrowRight', { shiftKey: true })
    expect(ed.playhead.value).toBe(1067)
    key(ed, 'ArrowDown')
    expect(ed.playhead.value).toBe(2000)
    key(ed, 'ArrowUp')
    expect(ed.playhead.value).toBe(0)
    ed.select('a')
    key(ed, ']'); expect(ed.playhead.value).toBe(500)
    key(ed, ']'); expect(ed.playhead.value).toBe(1500)
    key(ed, '['); expect(ed.playhead.value).toBe(500)
  })

  it('single keys stop when the setting is off; Ctrl shortcuts and Escape still work; never while typing', async () => {
    const ed = await opened()
    expect(key(ed, 'b')).toBe(true)
    expect(ed.tool.value).toBe('blade')
    ed.setShortcuts(false)
    expect(key(ed, 'a')).toBe(false)
    expect(ed.tool.value).toBe('blade')
    ed.edit(tl.moveOps(ed.doc.value, 'a', 500), 'Moved')
    expect(key(ed, 'z', { ctrlKey: true })).toBe(true)
    expect(tl.find(ed.doc.value, 'a').item.start_ms).toBe(0)
    ed.select('a')
    expect(key(ed, 'Escape')).toBe(true)
    expect(ed.selection.value).toEqual([])
    ed.setShortcuts(true)
    expect(key(ed, 'm', { cls: 'input' })).toBe(false)                       // typing a name
    expect(key(ed, 'ArrowRight', { cls: 'ct-item' })).toBe(false)            // on an item the arrows move between items
    expect(key(ed, ' ', { cls: 'ct-item' })).toBe(false)                     // and Space selects it
    expect(key(ed, 'Delete', { cls: 'ct-item' })).toBe(true)
  })
})

describe('useClipEditor: drops from the bin (application/x-aadml-editor {kind, id})', () => {
  it('puts an effect or a transition on the clip it lands on; a paid effect only points to its price card', async () => {
    const { setRegistry } = await import('./registry')
    const { default: fixture } = await import('./__fixtures__/registry.json')
    setRegistry(fixture)
    const ed = await opened(saved(3, [clip('a', 0), clip('b', 2000)]).edl)
    expect(ed.dropFromBin({ kind: 'effect', id: 'blur' }, { trackId: 'v1', itemId: 'a' })).toBe(true)
    expect(ed.doc.value.tracks[0].items.find(i => i.id === 'a').effects).toEqual([{ id: 'fx1', kind: 'blur', enabled: true, params: { radius: 10 } }])
    expect(ed.dropFromBin({ kind: 'effect', id: 'bg_removal' }, { trackId: 'v1', itemId: 'b' })).toBe(false)
    expect(await said(ed)).toContain('price')
    expect(ed.dropFromBin({ kind: 'transition', id: 'wipe_up' }, { trackId: 'v1', itemId: 'a' })).toBe(true)
    expect(ed.doc.value.tracks[0].items.find(i => i.type === 'transition')).toMatchObject({ kind: 'wipe_up', between: ['a', 'b'] })
    expect(ed.dropFromBin({ kind: 'effect', id: 'blur' }, { trackId: 'v1' })).toBe(false)              // not on a clip
  })

  it('places a text template at the drop time on a text track, styled, and refuses a file on the wrong kind of track', async () => {
    const edl = saved(3).edl
    edl.tracks.push({ id: 't1', kind: 'text', items: [] })
    const ed = await opened(edl)
    expect(ed.dropFromBin({ kind: 'text', id: 'lower-third' }, { trackId: 't1', at: 1010 })).toBe(true)
    const t = ed.doc.value.tracks.find(x => x.id === 't1').items[0]
    expect([t.start_ms, t.text, t.style.font]).toEqual([1000, 'Name Surname', 'inter'])
    expect(ed.selection.value).toEqual([t.id])
    expect(ed.dropFromBin({ kind: 'media', id: 'm1' }, { trackId: 'a1', at: 0 })).toBe(false)         // m1 is not in the project's files
  })
})
