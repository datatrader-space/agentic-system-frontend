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

const clip = (id, start) => ({ type: 'clip', id, media: 'm1', start_ms: start, source_in_ms: 0, source_out_ms: 2000, speed: 1, fit: 'contain', transform: { x: 0.5, y: 0.5, scale: 1, opacity: 1 } })
const timeline = (revision = 2) => ({ revision, revision_id: 40 + revision, edl: { ...tl.newDoc('9:16'), tracks: [{ id: 'v1', kind: 'video', items: [clip('a', 0)] }, { id: 't1', kind: 'text', captions: true, items: [] }, { id: 'a1', kind: 'audio', items: [] }] } })

function stubApi() {
  api.get.mockImplementation(async (url) => {
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

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); stubApi(); routeState.query = { project_id: 'p1' } })
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

  it('splits at the playhead from the toolbar and from the keyboard, and undoes', async () => {
    await open()
    await w.get('[data-id="a"]').trigger('keydown', { key: 'Enter' })
    await w.get('.ct-slider').setValue('1000')
    await button('Split').trigger('click')
    expect(w.findAll('.ct-row')[0].findAll('[role="option"]')).toHaveLength(2)
    expect(w.text()).toContain('Unsaved changes')
    await button('Undo').trigger('click')
    expect(w.findAll('.ct-row')[0].findAll('[role="option"]')).toHaveLength(1)
    w.get('[data-id="a"]').element.focus()
    await w.get('[data-id="a"]').trigger('keydown', { key: 's' })
    expect(w.findAll('.ct-row')[0].findAll('[role="option"]')).toHaveLength(2)
  })

  // ISSUE-13: Split with the playhead where nothing can be cut says why, on screen, and changes nothing.
  it('says why Split cannot cut when the playhead is not inside a selected clip', async () => {
    await open()
    await w.get('[data-id="a"]').trigger('keydown', { key: 'Enter' })
    await w.get('.ct-slider').setValue('0')
    expect(w.find('[data-test="ve-split-note"]').exists()).toBe(false)
    await button('Split').trigger('click')
    expect(w.get('[data-test="ve-split-note"]').text()).toBe('Move the playhead inside a selected clip to split it.')
    expect(w.get('[data-test="ve-split"]').attributes('aria-describedby')).toBe('ve-split-note')
    expect(w.findAll('.ct-row')[0].findAll('[role="option"]')).toHaveLength(1)
    expect(w.get('[aria-live="polite"]').text()).toBe('Move the playhead inside a selected clip to split it.')
    // Moving the playhead clears the note; a cut inside the clip works.
    await w.get('.ct-slider').setValue('1000')
    expect(w.find('[data-test="ve-split-note"]').exists()).toBe(false)
    await button('Split').trigger('click')
    expect(w.findAll('.ct-row')[0].findAll('[role="option"]')).toHaveLength(2)
    expect(w.find('[data-test="ve-split-note"]').exists()).toBe(false)
  })

  it('single-key shortcuts work only with the timeline focused and can be switched off', async () => {
    await open()
    await w.get('[data-id="a"]').trigger('keydown', { key: 'Enter' })
    await w.get('.ct-slider').setValue('1000')
    await w.get('.ve-tools').trigger('keydown', { key: 's' })                            // not the timeline
    expect(w.findAll('.ct-row')[0].findAll('[role="option"]')).toHaveLength(1)
    await w.get('.ve-keys input').setValue(false)
    await w.get('[data-id="a"]').trigger('keydown', { key: 's' })
    expect(w.findAll('.ct-row')[0].findAll('[role="option"]')).toHaveLength(1)
    expect(localStorage.getItem('aadml.clipEditor.shortcuts')).toBe('off')
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

  it('exports the saved revision in the shapes and resolution chosen', async () => {
    await open()
    api.post.mockResolvedValueOnce({ data: { job_id: 'e1', state: 'queued', operation: 'export' } })
    await button('Export').trigger('click')
    const dialog = w.get('[role="dialog"]')
    await dialog.findAll('input[type="checkbox"]').find(i => i.element.value === '16:9').setValue(true)
    await dialog.findAll('input[type="radio"]').find(i => i.element.value === '720p').setValue(true)
    await dialog.findAll('button').find(b => b.text() === 'Export').trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/jobs/', { operation: 'export', project_id: 'p1',
      params: { timeline_revision_id: 42, title: 'Launch', aspects: ['9:16', '16:9'], resolution: '720p' } })
    expect(useVideoStore().jobs.e1).toBeTruthy()
    expect(w.get('[role="dialog"] .job').text()).toBe('queued')
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
