// Video mode store: settings and features follow the chosen model, requests go through the agent, frames
// mirror the server.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    uploadConversationFile: vi.fn(),
  },
}))
vi.mock('../composables/useNotify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

import api from '../services/api'
import { notify } from '../composables/useNotify'
import { useVideoStore } from './useVideoStore'

const KLING = {
  route_id: 7, model_id: 'kwaivgi/kling-v3.0-pro', name: 'Kling Pro', via: 'openrouter', state: 'active',
  connections: [{ route_id: 7, connection_id: 1, connection: 'or' }],
  outputs: { durations: [3, 4, 5, 10], resolutions: ['720p'], aspect_ratios: ['16:9', '9:16'], audio: false },
}
const chatStub = (over = {}) => ({
  selectedAgentId: 5, conversationId: 'c1', ensureConversation: vi.fn(() => Promise.resolve('c1')),
  sendMessage: vi.fn(() => Promise.resolve(true)), ...over,
})
const job = (over = {}) => ({ job_id: 'j1', state: 'awaiting_authorization', operation: 'generate',
                              conversation_id: 'c1', created_at: '2026-10-15T10:00:00Z', ...over })

describe('useVideoStore', () => {
  let video
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    video = useVideoStore()
  })

  it('offers only what the chosen model declares and fixes incompatible settings', async () => {
    api.get.mockResolvedValue({ data: { routes: [KLING], default_route_id: 7 } })
    video.settings.duration = 12
    video.settings.aspect_ratio = '1:1'
    video.settings.sound = true
    await video.loadCapabilities(5)
    expect(video.options.durations).toEqual([3, 4, 5, 10])
    expect(video.settings.duration).toBe(5)
    expect(video.settings.aspect_ratio).toBe('16:9')
    expect(video.settings.sound).toBe(false)
  })

  it('a request goes to the agent as the person\'s message, with the panel\'s choices beside it', async () => {
    // Like Create-Image: the agent writes the video prompt; the request and its result stay in the thread.
    api.get.mockResolvedValue({ data: { routes: [KLING], default_route_id: 7 } })
    await video.loadCapabilities(5)
    api.uploadConversationFile.mockResolvedValue({ data: { attachment_id: 'att-1' } })
    video.pickRoute('7')
    video.settings.duration = 4
    video.settings.resolution = '720p'
    video.addRef(new File(['x'], 'shoe.png', { type: 'image/png' }), 'first_frame')
    const chat = chatStub()
    const sent = await video.request({ prompt: 'a shoe on a rock', chat })
    expect(sent).toBe(true)
    expect(api.post).not.toHaveBeenCalled()            // no direct estimate: the agent makes the call
    expect(chat.sendMessage).toHaveBeenCalledWith('a shoe on a rock', { videoRequest: {
      task: 'quick', route_id: '7', duration: 4, aspect_ratio: '16:9', resolution: '720p', sound: undefined,
      references: [{ attachment_id: 'att-1', role: 'first_frame' }], base_attachment_id: undefined,
      scene_id: undefined } })
    expect(video.refs).toEqual([])
  })

  it('continuing a clip names the video and the extend task', async () => {
    const chat = chatStub()
    await video.request({ prompt: 'Continue this clip', chat, task: 'extend', baseAttachmentId: 'vid-1' })
    const [, opts] = chat.sendMessage.mock.calls[0]
    expect(opts.videoRequest.task).toBe('extend')
    expect(opts.videoRequest.base_attachment_id).toBe('vid-1')
  })

  it('edit footage needs a source video, and nothing is sent without one', async () => {
    video.setTask('edit')
    const chat = chatStub()
    const sent = await video.request({ prompt: 'warmer', chat })
    expect(sent).toBe(false)
    expect(notify.warning).toHaveBeenCalled()
    expect(chat.sendMessage).not.toHaveBeenCalled()
  })

  it('nothing is sent without a description', async () => {
    const chat = chatStub()
    expect(await video.request({ prompt: '  ', chat })).toBe(false)
    expect(chat.sendMessage).not.toHaveBeenCalled()
  })

  it('the panel offers only the features the chosen model has', async () => {
    api.get.mockResolvedValue({ data: { routes: [
      { ...KLING, offered: ['text_to_video', 'image_to_video'] },
      { ...KLING, route_id: 9, model_id: 'seedance', connections: [{ route_id: 9 }],
        offered: ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video', 'edit_uploaded'] },
    ], default_route_id: 7 } })
    await video.loadCapabilities(5)
    expect(video.can).toEqual({ references: false, startFrame: true, endFrame: false, edit: false, extend: true })
    video.pickRoute('9')
    expect(video.can).toEqual({ references: true, startFrame: true, endFrame: true, edit: true, extend: true })
  })

  it('a start frame replaces the previous one', () => {
    video.addRef(new File(['a'], 'a.png', { type: 'image/png' }), 'first_frame')
    video.addRef(new File(['b'], 'b.png', { type: 'image/png' }), 'first_frame')
    expect(video.refs.filter((r) => r.role === 'first_frame').map((r) => r.name)).toEqual(['b.png'])
  })

  it('frames update the job and filter by conversation', () => {
    video.onFrame(job())
    video.onFrame(job({ job_id: 'j2', conversation_id: 'other' }))
    video.onFrame(job({ state: 'running', phase: 'Rendering' }))
    expect(video.jobsFor('c1').map((j) => [j.job_id, j.state])).toEqual([['j1', 'running']])
  })

  it('a stale project edit shows the latest instead of overwriting it', async () => {
    video.project = { project_id: 'p1', revision: 3, scenes: [] }
    api.patch.mockRejectedValue({ response: { status: 409, data: { project: { project_id: 'p1', revision: 4, scenes: [] } } } })
    await video.patchProject({ title: 'x' })
    expect(video.project.revision).toBe(4)
    expect(notify.warning).toHaveBeenCalled()
  })

  it('a story is planned by the assistant without rendering', async () => {
    api.post.mockResolvedValue({ data: { project_id: 'p1', revision: 0, scenes: [] } })
    const chat = chatStub()
    await video.planStory({ prompt: 'launch story', chat })
    expect(api.post.mock.calls[0][0]).toBe('/video/projects/')
    expect(chat.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Do not render anything yet.'))
    expect(video.panelOpen).toBe(true)
  })

  it('a chat with no project lists its own versions, and the restored one is the active video', async () => {
    // Live 2026-10-16: a chat's clip and its trim never showed in Versions (project-only), so no restore.
    const versions = [{ attachment_id: 'v2', version: 2, is_active: false, url: '/v2.mp4' },
                      { attachment_id: 'v1', version: 1, is_active: true, url: '/v1.mp4' }]
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/video/projects/'
      ? { project: null } : { versions } }))
    await video.loadProject('c1')
    await Promise.resolve()
    expect(api.get).toHaveBeenCalledWith('/video/versions/', { params: { conversation_id: 'c1' } })
    expect(video.versions).toHaveLength(2)
    expect(video.activeVideo.attachment_id).toBe('v1')
  })

  it('a free edit that arrives already finished refreshes the chat\'s versions', async () => {
    api.get.mockResolvedValue({ data: { project: null, versions: [] } })
    await video.loadProject('c1')
    api.get.mockClear()
    video.onFrame(job({ job_id: 'trim', operation: 'trim', state: 'ready', output: { url: '/t.mp4' } }))
    expect(api.get).toHaveBeenCalledWith('/video/versions/', { params: { conversation_id: 'c1' } })
  })

  it('clip lengths are offered shortest first', async () => {
    api.get.mockResolvedValue({ data: { routes: [{ ...KLING, outputs: { ...KLING.outputs, durations: [8, 4, 6] } }],
                                        default_route_id: 7 } })
    await video.loadCapabilities(5)
    expect(video.options.durations).toEqual([4, 6, 8])
  })
})


it('keeps a selected version when studio polling sees an already completed job again', () => {
  setActivePinia(createPinia())
  const video = useVideoStore()
  const ready = { job_id: 'saved', state: 'ready', operation: 'generate', output: { url: '/clip.mp4' } }
  video._put(ready)
  video.previewAttachmentId = 'earlier-version'
  video._put(ready)
  expect(video.previewAttachmentId).toBe('earlier-version')
})
