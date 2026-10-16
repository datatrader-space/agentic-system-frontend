// Video mode store: settings follow the chosen model, estimates never spend, frames mirror the server.
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
  outputs: { durations: [3, 4, 5, 10], resolutions: ['720p'], aspect_ratios: ['16:9', '9:16'], audio: false,
             frame_roles: ['first_frame'] },
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

  it('an estimate uploads references, names them by id with roles, and spends nothing', async () => {
    api.get.mockResolvedValue({ data: { routes: [KLING], default_route_id: 7 } })
    await video.loadCapabilities(5)
    api.uploadConversationFile.mockResolvedValue({ data: { attachment_id: 'att-1' } })
    api.post.mockResolvedValue({ data: job() })
    video.addRef(new File(['x'], 'shoe.png', { type: 'image/png' }), 'first_frame')
    const chat = chatStub()
    const out = await video.estimate({ prompt: 'a shoe on a rock', chat })
    expect(out.state).toBe('awaiting_authorization')
    const [url, body, cfg] = api.post.mock.calls[0]
    expect(url).toBe('/video/jobs/')
    expect(body.references).toEqual([{ attachment_id: 'att-1', role: 'first_frame' }])
    expect(body.operation).toBe('generate')
    expect(body.agent_id).toBe(5)
    expect(cfg.headers['Idempotency-Key']).toMatch(/^est-c1-/)
    expect(video.refs).toEqual([])
  })

  it('edit footage needs a source video', async () => {
    video.setTask('edit')
    const out = await video.estimate({ prompt: 'warmer', chat: chatStub() })
    expect(out).toBeNull()
    expect(notify.warning).toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('shows the server refusal with the models that can do it', async () => {
    api.post.mockRejectedValue({ response: { status: 400, data: { error: {
      code: 'task_not_offered', message: 'Reference images is not supported for x.',
      alternatives: [{ name: 'Veo 3.1', model_id: 'google/veo-3.1' }] } } } })
    await video.estimate({ prompt: 'x', chat: chatStub() })
    expect(notify.error).toHaveBeenCalledWith('Reference images is not supported for x. Models that can do it: Veo 3.1.')
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
})
