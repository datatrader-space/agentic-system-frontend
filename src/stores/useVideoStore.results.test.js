// Results, versions and jobs against the backend contracts: paged job lists, paged image and video versions with a
// visible read failure, a free restore for either kind, only the job actions the server allows, Use again and Edit.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import api from '../services/api'
import { notify } from '../composables/useNotify'
import { useVideoStore } from './useVideoStore'

let video
beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); video = useVideoStore() })

describe('jobs', () => {
  it('a reopened chat follows has_more so older results are not lost', async () => {
    api.get.mockImplementation((url, { params }) => Promise.resolve({ data: {
      jobs: [{ job_id: `j${params.page}`, conversation_id: 'c1', state: 'ready', created_at: `2026-10-0${4 - params.page}T00:00:00Z` }],
      page: params.page, page_size: 1, has_more: params.page < 3 } }))
    expect(await video.loadJobs('c1')).toBe(true)
    expect(api.get.mock.calls.map(([url, o]) => [url, o.params])).toEqual([
      ['/video/jobs/', { page: 1, conversation_id: 'c1' }], ['/video/jobs/', { page: 2, conversation_id: 'c1' }], ['/video/jobs/', { page: 3, conversation_id: 'c1' }]])
    expect(video.jobsFor('c1').map((j) => j.job_id)).toEqual(['j3', 'j2', 'j1'])
  })
  it('a background read takes the newest page only, and a failed read reports false', async () => {
    api.get.mockResolvedValue({ data: { jobs: [{ job_id: 'a', conversation_id: 'c1' }], page: 1, has_more: true } })
    expect(await video.loadJobs('c1', { pages: 1 })).toBe(true)
    expect(api.get).toHaveBeenCalledTimes(1)
    api.get.mockRejectedValue(new Error('down'))
    expect(await video.loadJobs('c1')).toBe(false)
  })
  it('the account list is read with no conversation', async () => {
    api.get.mockResolvedValue({ data: { jobs: [], page: 1, has_more: false } })
    expect(await video.fetchJobs({ page: 1 })).toEqual({ jobs: [], page: 1, hasMore: false })
    expect(api.get).toHaveBeenCalledWith('/video/jobs/', { params: { page: 1 } })
  })
  it('sends only an action the server allows on this job', async () => {
    api.post.mockResolvedValue({ data: { job_id: 'j', state: 'cancelled', allowed_actions: [] } })
    expect(await video.jobAction({ job_id: 'j', allowed_actions: ['decline'] }, 'start')).toBeNull()
    expect(await video.jobAction({ job_id: 'j' }, 'stop')).toBeNull()
    expect(await video.jobAction({ job_id: 'j', allowed_actions: ['../x'] }, '../x')).toBeNull()
    expect(api.post).not.toHaveBeenCalled()
    await video.jobAction({ job_id: 'j', allowed_actions: ['start'] }, 'start')
    expect(api.post).toHaveBeenLastCalledWith('/video/jobs/j/start/', { accept: true })
    await video.jobAction({ job_id: 'j', allowed_actions: ['stop'] }, 'stop')
    expect(api.post).toHaveBeenLastCalledWith('/video/jobs/j/stop/')
  })
})

describe('versions', () => {
  it('image versions are read with type=image, kept apart from video takes, and older pages are added', async () => {
    video.conversationId = 'c1'
    api.get.mockImplementation((url, { params }) => Promise.resolve({ data: params.page === 1
      ? { versions: [{ attachment_id: 'i3', is_active: true }, { attachment_id: 'i2' }], page: 1, page_size: 50, has_more: true, active_attachment_id: 'i3' }
      : { versions: [{ attachment_id: 'i1' }], page: 2, page_size: 50, has_more: false, active_attachment_id: 'i3' } }))
    await video.loadVersions({ type: 'image' })
    expect(api.get).toHaveBeenCalledWith('/video/versions/', { params: { conversation_id: 'c1', type: 'image', page: 1, page_size: 50 } })
    expect(video.versions).toEqual([])
    expect(video.versionsMeta.image).toMatchObject({ page: 1, hasMore: true, error: '', activeAttachmentId: 'i3' })
    await video.loadVersions({ type: 'image', more: true })
    expect(api.get).toHaveBeenLastCalledWith('/video/versions/', { params: { conversation_id: 'c1', type: 'image', page: 2, page_size: 50 } })
    expect(video.imageVersions.map((v) => v.attachment_id)).toEqual(['i3', 'i2', 'i1'])
    expect(video.versionsMeta.image.hasMore).toBe(false)
    expect(video.activeVideo).toBeNull()
  })
  it('the takes of a project are paged too: older pages are added while has_more, and the active take is kept', async () => {
    video.conversationId = 'c1'; video.project = { project_id: 'p1', scenes: [] }
    api.get.mockImplementation((url, { params }) => Promise.resolve({ data: params.page === 1
      ? { versions: [{ attachment_id: 'v3' }, { attachment_id: 'v2' }], page: 1, page_size: 50, has_more: true, active_attachment_id: 'v2' }
      : { versions: [{ attachment_id: 'v2' }, { attachment_id: 'v1' }], page: 2, page_size: 50, has_more: false, active_attachment_id: 'v2' } }))
    await video.loadVersions()
    expect(api.get).toHaveBeenCalledWith('/video/projects/p1/versions/', { params: { page: 1, page_size: 50 } })
    expect(video.versionsMeta.video).toMatchObject({ page: 1, hasMore: true, activeAttachmentId: 'v2' })
    await video.loadVersions({ more: true })
    expect(api.get).toHaveBeenLastCalledWith('/video/projects/p1/versions/', { params: { page: 2, page_size: 50 } })
    // A take already listed is not listed twice.
    expect(video.versions.map((v) => v.attachment_id)).toEqual(['v3', 'v2', 'v1'])
    expect(video.versionsMeta.video).toMatchObject({ page: 2, hasMore: false, activeAttachmentId: 'v2' })
  })
  it('an unreachable versions read is an error, not an empty list', async () => {
    video.conversationId = 'c1'
    api.get.mockRejectedValue(new Error('down'))
    await video.loadVersions()
    expect(video.versions).toEqual([])
    expect(video.versionsMeta.video.error).toBe('Could not load versions. Try again.')
    expect(video.versionsMeta.video.loading).toBe(false)
  })
  it('restoring an image moves the active pointer only, for free, and keeps the loaded pages', async () => {
    video.conversationId = 'c1'
    video.imageVersions = [{ attachment_id: 'i2', is_active: true, version: 2 }, { attachment_id: 'i1', is_active: false, version: 1 }]
    api.post.mockResolvedValue({ data: { ok: true, active_attachment_id: 'i1', media_type: 'image' } })
    expect(await video.restore(video.imageVersions[1], { conversationId: 'c1', type: 'image' })).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/video/selection/', { attachment_id: 'i1', conversation_id: 'c1' })
    expect(video.imageVersions.map((v) => v.is_active)).toEqual([false, true])
    expect(api.get).not.toHaveBeenCalled()
    expect(notify.success).toHaveBeenCalledWith('Version v1 is now the active image.')
  })
  it('a refused restore says so and changes nothing', async () => {
    video.versions = [{ attachment_id: 'v2', is_active: true }, { attachment_id: 'v1', is_active: false }]
    api.post.mockResolvedValue({ data: { ok: false } })
    expect(await video.restore(video.versions[1], { conversationId: 'c1' })).toBe(false)
    expect(video.versions.map((v) => v.is_active)).toEqual([true, false])
    expect(notify.error).toHaveBeenCalled()
  })
})

describe('Use again and Edit', () => {
  it('Use again restores a video prompt and the settings its route offers, and sends nothing', () => {
    video.routes = [{ route_id: 7, state: 'active', connections: [{ route_id: 7 }], outputs: { durations: [5, 10], resolutions: ['720p'], aspect_ratios: ['16:9', '9:16'], audio: true } }]
    expect(video.useAgain({ modality: 'video', route_id: 7, prompt: 'A slow pan', settings: { duration: 10, aspect_ratio: '9:16', resolution: '4K', audio: true } })).toBe(true)
    expect(video.studioDraft).toBe('A slow pan')
    expect(video.routeId).toBe('7')
    expect(video.settings).toMatchObject({ duration: 10, aspect_ratio: '9:16', sound: true })
    expect(video.settings.resolution).toBe('')                // a value the route does not offer is not set
    expect(api.post).not.toHaveBeenCalled(); expect(api.get).not.toHaveBeenCalled()
    expect(video.useAgain(null)).toBe(false)
  })
  it('Edit makes this result the edit base', () => {
    video.refs = [{ key: 'old', attachment_id: 'old', role: 'subject' }]
    expect(video.editFrom({ attachment_id: 'r1', media_type: 'image', url: '/r1.png' }, { conversationId: 'c1' }))
      .toEqual({ path: '/video-studio/edit', query: { conversation: 'c1', useIn: '1', mode: video.studioMode } })
    expect(video.refs).toEqual([expect.objectContaining({ attachment_id: 'r1', role: 'edit_source', base_attachment_id: 'r1' })])
    expect(video.editFrom({ attachment_id: 'r2', media_type: 'video', url: '/r2.mp4' }).path).toBe('/video-studio/enhance')
  })
})
