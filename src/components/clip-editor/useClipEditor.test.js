// @vitest-environment jsdom
// The clip editor's state (VIDEO_CLIP_EDITOR_PLAN.md E8, E9): autosave after the last edit, each save checked against
// the revision it started from, the conflict notification that stops saving instead of overwriting, and an edit the
// server would refuse never entering the timeline.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useClipEditor } from './useClipEditor'
import * as tl from './timelineModel'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))

const clip = (id, start) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: 2000, speed: 1, fit: 'contain', transform: { x: 0.5, y: 0.5, scale: 1, opacity: 1 } })
const saved = (revision, items = [clip('a', 0)]) => ({ revision, revision_id: 100 + revision, edl: { ...tl.newDoc('9:16'), tracks: [{ id: 'v1', kind: 'video', items }] } })

beforeEach(() => {
  vi.useFakeTimers()
  api.get.mockReset(); api.post.mockReset()
  api.get.mockImplementation(async url => {
    if (url === '/video/projects/p1/') return { data: { project_id: 'p1', title: 'Cut', aspect_ratio: '9:16', assets: [] } }
    if (url === '/video/projects/p1/timeline/') return { data: saved(3) }
    if (url.startsWith('/video/editor/media/')) return { data: { attachment_id: 'm1', state: 'ready', media_type: 'video', duration_ms: 5000 } }
    throw new Error(url)
  })
})
afterEach(() => { vi.useRealTimers() })

async function opened() {
  const ed = useClipEditor({ autosaveMs: 2000 })
  await ed.load('p1')
  return ed
}

describe('useClipEditor', () => {
  it('opens the latest revision and the files it uses', async () => {
    const ed = await opened()
    expect([ed.revision.value, ed.revisionId.value, ed.doc.value.tracks[0].items[0].id]).toEqual([3, 103, 'a'])
    expect(ed.media.m1.duration_ms).toBe(5000)
    expect(api.get).toHaveBeenCalledWith('/video/editor/media/m1/', { params: { project_id: 'p1' } })
  })

  it('a project with no timeline starts with an empty one in its own shape', async () => {
    api.get.mockImplementation(async url => url.endsWith('/timeline/') ? { data: { revision: 0, revision_id: null, edl: null } }
      : { data: { project_id: 'p1', aspect_ratio: '1:1', assets: [] } })
    const ed = await opened()
    expect([ed.revision.value, ed.doc.value.canvas.aspect, ed.doc.value.tracks.map(t => t.kind)]).toEqual([0, '1:1', ['video', 'text', 'audio']])
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
    expect([url, body.base_revision, body.edl.tracks[0].items[0].start_ms]).toEqual(['/video/projects/p1/timeline/', 3, 700])
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
    // No more edits or saves until the newest timeline is opened.
    expect(ed.edit(tl.moveOps(ed.doc.value, 'a', 800), 'Moved')).toBe(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.post).toHaveBeenCalledTimes(1)
    api.get.mockImplementation(async url => url.endsWith('/timeline/') ? { data: saved(5, [clip('a', 1200)]) }
      : url.startsWith('/video/editor/media/') ? { data: { state: 'ready' } } : { data: { project_id: 'p1', assets: [] } })
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
    await Promise.resolve()
    expect(ed.announcement.value).toMatch(/overlap/)
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
