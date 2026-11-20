// @vitest-environment jsdom
// The clip editor page (VIDEO_CLIP_EDITOR_PLAN.md P2 to P4): it opens the project named in the address, edits go
// through the toolbar and the keyboard (only with the timeline focused, and only while shortcuts are on), a change
// saved elsewhere stops saving with a notification and a reload, and Export starts the free export of the saved
// revision with the shapes and resolution chosen.
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as tl from '../components/clip-editor/timelineModel'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), head: vi.fn(), delete: vi.fn(), getTimelineLottie: vi.fn(), downloadWebPage: vi.fn() }))
const routeState = vi.hoisted(() => ({ query: { project_id: 'p1' } }))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('vue-router', () => ({ useRoute: () => routeState, useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }))
vi.mock('../services/studioFeatures', () => ({ loadStudioFeatures: vi.fn(async () => []), getStudioFeature: vi.fn(() => ({ id: 'editor', ready: true })) }))
import VideoClipEditor from './VideoClipEditor.vue'
import { useVideoStore } from '../stores/useVideoStore'
import { resetRegistry } from '../components/clip-editor/registry'
// The registry as the server serves it (written by `manage.py editor_registry_export`).
import registryFixture from '../components/clip-editor/__fixtures__/registry.json'

const clip = (id, start) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: 2000, speed: 1, fit: 'contain', transform: { x: 0.5, y: 0.5, scale: 1, opacity: 1 } })
const timeline = (revision = 2) => ({ revision, revision_id: 40 + revision, edl: { ...tl.newDoc('9:16'), settings: { magnet: false }, tracks: [{ id: 'v1', kind: 'video', items: [clip('a', 0)] }, { id: 't1', kind: 'text', captions: true, items: [] }, { id: 'a1', kind: 'audio', items: [] }] } })

function stubApi() {
  api.get.mockImplementation(async (url) => {
    if (url === '/video/editor/registry/') return { data: registryFixture }
    if (url === '/video/projects/') return { data: { projects: [{ project_id: 'p1', title: 'Launch' }] } }
    if (url === '/video/projects/p1/') return { data: { project_id: 'p1', title: 'Launch', aspect_ratio: '9:16', assets: [{ attachment_id: 'm1', media_type: 'video', role: 'edit_source' }] } }
    if (url === '/video/projects/p1/timeline/') return { data: timeline() }
    if (url.startsWith('/video/editor/media/')) return { data: { attachment_id: 'm1', state: 'ready', media_type: 'video', duration_ms: 6000, name: 'beach.mp4', preview_url: '/p.mp4' } }
    if (url.startsWith('/video/jobs/')) return { data: { job_id: 'e1', state: 'running', operation: 'export' } }
    throw new Error(`unexpected ${url}`)
  })
}
let w
async function open() {
  setActivePinia(createPinia())
  w = mount(VideoClipEditor, { attachTo: document.body, global: { stubs: { VideoJobCard: { props: ['job'], template: '<div class="job">{{ job.state }}</div>' }, VideoLibrary: true, MediaRoutePicker: true } } })
  await flushPromises()
  return w
}
const button = text => w.findAll('button').find(b => b.text() === text)

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); resetRegistry(); stubApi(); routeState.query = { project_id: 'p1' } })
afterEach(() => { w?.unmount(); vi.useRealTimers() })

describe('VideoClipEditor', () => {
  it('opens the project in the address with its timeline, files and monitor', async () => {
    await open()
    expect(w.get('.ve-title').text()).toBe('Launch')
    expect(w.get('[data-id="a"]').attributes('aria-label')).toContain('beach.mp4')
    expect(w.text()).toContain('Saved, revision 2')
    expect(w.find('[aria-label="Monitor"]').exists()).toBe(true)
    expect(w.findAll('.cb-file').map(f => f.text())).toEqual([expect.stringContaining('beach.mp4')])
  })

  it('the toolbar is icon buttons, each named with its shortcut in its tooltip; Delete and Undo edit the timeline', async () => {
    await open()
    const del = w.get('[data-test="ve-delete"]')
    expect([del.attributes('aria-label'), del.attributes('data-tip'), del.attributes('aria-keyshortcuts')]).toEqual(['Delete', 'Delete (Delete)', 'Delete'])
    expect(w.get('[data-test="ve-undo"]').attributes('data-tip')).toBe('Undo (Ctrl+Z)')
    expect(w.get('[data-test="ve-undo"]').attributes('aria-keyshortcuts')).toBe('Control+Z')
    expect(w.get('[data-test="ve-duplicate"]').attributes('data-tip')).toBe('Duplicate (D)')
    // One Split, one Snap, one Loop: Split and Snap on the timeline's tools bar, Loop on the monitor.
    expect(w.find('[data-test="ve-split"]').exists()).toBe(false)
    expect(w.findAll('[data-test="ct-split"]')).toHaveLength(1)
    expect(w.findAll('[data-test="ct-snap"]')).toHaveLength(1)
    expect(w.findAll('button[aria-label="Loop"]')).toHaveLength(1)
    await w.get('[data-id="a"]').trigger('keydown', { key: 'Enter' })
    await del.trigger('click')
    expect(w.findAll('.ct-row')[0].findAll('[role="option"]')).toHaveLength(0)
    await w.get('[data-test="ve-undo"]').trigger('click')
    expect(w.findAll('.ct-row')[0].findAll('[role="option"]')).toHaveLength(1)
  })

  it('adds a file from the bin through the editor, in the way chosen there', async () => {
    await open()
    const main = () => w.findAll('.ct-row')[0].findAll('[role="option"]').map(o => o.attributes('data-id'))
    await w.get('.cb-file button').trigger('click')                               // insert at the playhead (0)
    expect(main()).toHaveLength(2)
    expect(w.get('.st-sr[aria-live="polite"]').exists()).toBe(true)
    await w.get('[data-test="bin-mode"]').setValue('append')
    await w.get('.cb-file button').trigger('click')
    expect(main()).toHaveLength(3)
  })

  it('takes a file dropped from the bin onto a track, at the drop time', async () => {
    await open()
    const lane = w.findAll('.ct-row')[0].get('.ct-lane')
    const payload = JSON.stringify({ kind: 'media', id: 'm1' })
    const dataTransfer = { types: ['application/x-aadml-editor'], getData: () => payload, dropEffect: '' }
    await lane.trigger('dragover', { dataTransfer })
    expect(lane.classes()).toContain('ct-drop')
    await lane.trigger('drop', { dataTransfer, clientX: 0 })
    expect(lane.classes()).not.toContain('ct-drop')
    expect(w.findAll('.ct-row')[0].findAll('[role="option"]')).toHaveLength(2)
  })

  it('plays through the editor: the monitor reports time, the editor owns play, pause and loop', async () => {
    await open()
    const play = w.get('[aria-label="Monitor"] button[aria-label="Play"]')
    await play.trigger('click')
    expect(w.find('[aria-label="Monitor"] button[aria-label="Pause"]').exists()).toBe(true)
    const loop = w.get('[aria-label="Monitor"] button[aria-label="Loop"]')
    await loop.trigger('click')
    expect(loop.attributes('aria-pressed')).toBe('true')
  })

  it('says when the registry cannot be read, and reads it again on Try again', async () => {
    const base = api.get.getMockImplementation()
    api.get.mockImplementation(async url => { if (url === '/video/editor/registry/') throw new Error('down'); return base(url) })
    await open()
    expect(w.get('[data-test="ve-registry-error"]').text()).toContain('could not be read')
    expect(w.find('.ct').exists()).toBe(false)
    api.get.mockImplementation(base)
    await w.get('[data-test="ve-registry-error"] button').trigger('click')
    await flushPromises()
    expect(w.find('.ct').exists()).toBe(true)
  })

  it('a change saved in another tab or by the agent stops saving and offers the newest timeline', async () => {
    vi.useFakeTimers()
    await open()
    api.post.mockRejectedValueOnce({ response: { status: 409, data: { error: { code: 'conflict' }, timeline: { revision: 3 } } } })
    await w.get('[data-id="a"]').trigger('keydown', { key: 'ArrowRight', altKey: true, shiftKey: true })
    await vi.advanceTimersByTimeAsync(2100)
    await flushPromises()
    expect(api.post.mock.calls[0][1].base_revision).toBe(2)
    expect(w.text()).toContain('This project was changed in another tab or by the agent.')
    expect(w.text()).toContain('Saving stopped')
    api.get.mockImplementation(async url => url === '/video/projects/p1/timeline/' ? { data: timeline(3) }
      : url === '/video/projects/p1/' ? { data: { project_id: 'p1', title: 'Launch', assets: [] } } : { data: { state: 'ready' } })
    await button('Reload the newest timeline').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Saved, revision 3')
    expect(w.find('.ve-conflict').exists()).toBe(false)
  })

  it('exports the saved revision with the shapes, resolution, rate, quality, outputs and loudness chosen', async () => {
    await open()
    api.post.mockResolvedValueOnce({ data: { job_id: 'e1', state: 'queued', operation: 'export' } })
    await button('Export').trigger('click')
    const dialog = w.get('[role="dialog"]')
    await dialog.get('[data-test="cx-shape-16:9"]').setValue(true)
    await dialog.get('[data-test="cx-resolution"]').setValue('720p')
    expect(dialog.findAll('[data-test="cx-resolution"] option').map(o => o.element.value)).toEqual(['720p', '1080p'])   // no source above 1080p
    await dialog.get('[data-test="cx-rate"]').setValue('60')
    await dialog.get('[data-test="cx-quality"]').setValue('high')
    await dialog.get('[data-test="cx-out-audio_mp3"]').setValue(true)
    await dialog.get('[data-test="cx-loudness"]').setValue('-14')
    await dialog.get('[data-test="cx-export"]').trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/jobs/', { operation: 'export', project_id: 'p1',
      params: { timeline_revision_id: 42, title: 'Launch', aspects: ['9:16', '16:9'], resolution: '720p', rate: 60, quality: 'high', outputs: ['video', 'audio_mp3'], loudness: '-14' } })
    expect(useVideoStore().jobs.e1).toBeTruthy()
    expect(w.get('[role="dialog"] .job').text()).toBe('queued')
  })

  it('an export refused for helper files not made yet lists each one with the way to make it', async () => {
    const base = api.get.getMockImplementation()
    api.get.mockImplementation(async url => {
      if (url === '/video/projects/p1/timeline/') { const t = timeline(); t.edl.tracks[0].items[0].reverse = true; return { data: t } }
      return base(url)
    })
    await open()
    api.post.mockRejectedValueOnce({ response: { status: 409, data: { error: { code: 'derived_missing', message: 'These are not made yet: the reversed copy of clip a. Make them in the editor (each is kept once made), then export.' } } } })
    await button('Export').trigger('click')
    await w.get('[data-test="cx-export"]').trigger('click')
    await flushPromises()
    const dialog = w.get('[role="dialog"]')
    expect(dialog.text()).toContain('These are not made yet: the reversed copy of clip a.')
    expect(dialog.get('[data-test="cx-missing"]').text()).toContain('The reversed copy of beach.mp4')
    api.post.mockResolvedValueOnce({ data: { id: 'r1', op: 'reverse', state: 'running', progress: 0.1 } })
    await dialog.get('[data-test="cx-make-reverse"]').trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenLastCalledWith('/video/editor/derive/', { media: 'm1', op: 'reverse', params: {} })
    expect(w.get('[data-test="cx-make-reverse"]').text()).toContain('Making the reversed copy')
  })

  it('downloads the saved revision as Lottie from Export and says what Lottie cannot hold', async () => {
    await open()
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x'); globalThis.URL.revokeObjectURL = vi.fn()
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    api.getTimelineLottie.mockResolvedValue({ data: { lottie: { v: '5.12.2', layers: [] }, not_represented: ['1 video clip: Lottie has no video layer'] } })
    await button('Export').trigger('click')
    await w.get('[data-test="cx-lottie"]').trigger('click'); await flushPromises()
    expect(api.getTimelineLottie).toHaveBeenCalledWith('p1', 42)
    expect(clicked).toHaveBeenCalledOnce()
    expect(w.get('[role="dialog"]').text()).toContain('Lottie cannot hold: 1 video clip')
    clicked.mockRestore()
  })

  it("downloads the project's current video as a web page from Export, and says when there is none yet", async () => {
    await open()
    await button('Export').trigger('click')
    await w.get('[data-test="cx-webpage"]').trigger('click'); await flushPromises()
    expect(api.downloadWebPage).not.toHaveBeenCalled()
    expect(w.get('[role="dialog"]').text()).toContain('Export the video first')
  })

  it('without a project, it offers to start one', async () => {
    routeState.query = {}
    await open()
    expect(w.text()).toContain('Edit your own clips, pictures and sound')
    api.post.mockResolvedValueOnce({ data: { project_id: 'p1', title: 'Launch' } })
    await w.get('.ve-new input').setValue('Launch')
    await w.get('.ve-new').trigger('submit')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/projects/', { title: 'Launch', aspect_ratio: '9:16' })
    expect(w.get('.ve-title').text()).toBe('Launch')
  })
})
