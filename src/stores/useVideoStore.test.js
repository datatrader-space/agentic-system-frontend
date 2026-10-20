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
  connections: [{ route_id: 7, connection_id: 1, connection: 'or' }], offered: ['text_to_video', 'image_to_video'],
  outputs: { durations: [3, 4, 5, 10], resolutions: ['720p'], aspect_ratios: ['16:9', '9:16'], audio: false },
}
// Takes references and makes 8 s clips only, with sound.
const VEO = {
  route_id: 8, model_id: 'google/veo-3.1-lite', name: 'Veo 3.1 Lite', via: 'openrouter', state: 'active',
  connections: [{ route_id: 8 }], offered: ['text_to_video', 'reference_to_video'],
  outputs: { durations: [8], resolutions: ['720p'], aspect_ratios: ['16:9'], audio: true },
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
    useVideoStore().studioMode = 'manual'      // these tests cover Manual mode (D15)
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

  it('switching model never changes settings or drops references without asking', async () => {
    // Owner review 2026-10-19: the spec requires explaining required changes, not silently dropping inputs.
    api.get.mockResolvedValue({ data: { routes: [VEO, KLING], default_route_id: 8 } })
    await video.loadCapabilities(5)
    video.settings.duration = 8
    video.addRef(new File(['x'], 'shoe.png', { type: 'image/png' }), 'subject')
    video.pickRoute('7')
    expect(video.routeId).toBe('')                       // not switched yet
    expect(video.settings.duration).toBe(8)
    expect(video.refs).toHaveLength(1)
    const plan = video.pendingSwitch
    expect(plan.changes.map((c) => [c.field, c.toLabel])).toEqual([['duration', '5 s']])
    expect(plan.unusable.map((r) => r.name)).toEqual(['shoe.png'])
    expect(plan.unusable[0].reason).toContain('does not take reference images')
    // A request waits while the change is undecided.
    expect(await video.request({ prompt: 'a shoe', chat: chatStub() })).toBe(false)
    video.keepCurrentModel()
    expect(video.pendingSwitch).toBe(null)
    expect(video.refs).toHaveLength(1)
    video.pickRoute('7')
    video.applySwitch()
    expect(video.routeId).toBe('7')
    expect(video.settings.duration).toBe(5)
    expect(video.refs).toEqual([])
  })

  it('a compatible model is switched to at once', async () => {
    api.get.mockResolvedValue({ data: { routes: [VEO, KLING], default_route_id: 8 } })
    await video.loadCapabilities(5)
    video.settings.duration = 5
    video.pickRoute('7')
    expect(video.pendingSwitch).toBe(null)
    expect(video.routeId).toBe('7')
  })

  it('a reference the current model cannot use is flagged and blocks the request, never removed', async () => {
    api.get.mockResolvedValue({ data: { routes: [KLING], default_route_id: 7 } })
    await video.loadCapabilities(5)
    video.addRef(new File(['x'], 'style.png', { type: 'image/png' }), 'style')
    expect(video.unusableRefs.map((r) => r.name)).toEqual(['style.png'])
    const chat = chatStub()
    expect(await video.request({ prompt: 'a shoe', chat })).toBe(false)
    expect(chat.sendMessage).not.toHaveBeenCalled()
    expect(video.refs).toHaveLength(1)
  })

  it('a saved timeline revision is what the export renders', async () => {
    video.project = { project_id: 'p1', scenes: [], timeline: null }
    api.post.mockResolvedValueOnce({ data: { revision: 3, revision_id: 41, edl: { tracks: [] } } })
    const saved = await video.saveTimeline({ tracks: [{ kind: 'video', clips: [{ scene_id: 's1', out_ms: 2000 }] }] })
    expect(api.post).toHaveBeenCalledWith('/video/projects/p1/timeline/', expect.objectContaining({ edl: expect.any(Object) }))
    expect(saved.revision_id).toBe(41)
    expect(video.project.timeline.revision).toBe(3)
    api.post.mockResolvedValueOnce({ data: { job_id: 'e1', state: 'queued', operation: 'export' } })
    await video.exportTimeline(['9:16'], { chat: chatStub(), revisionId: 41 })
    expect(api.post).toHaveBeenLastCalledWith('/video/jobs/', expect.objectContaining({
      operation: 'export', params: { aspects: ['9:16'], timeline_revision_id: 41 }, project_id: 'p1' }))
  })

  it('the Library loads every chat\'s files and pages on', async () => {
    api.get.mockResolvedValueOnce({ data: { items: [{ attachment_id: 'a1' }], page: 1, has_more: true } })
    video.library.type = 'image'
    await video.loadLibrary()
    expect(api.get).toHaveBeenCalledWith('/video/library/', { params: { type: 'image', source: 'all', q: undefined, page: 1, limit: 40 } })
    api.get.mockResolvedValueOnce({ data: { items: [{ attachment_id: 'a2' }], page: 2, has_more: false } })
    await video.loadLibrary({ more: true })
    expect(video.library.items.map((i) => i.attachment_id)).toEqual(['a1', 'a2'])
    expect(video.library.hasMore).toBe(false)
  })

  it('using a Library file links it to the project, then adds it to the composer', async () => {
    video.project = { project_id: 'p1', scenes: [] }
    api.post.mockResolvedValueOnce({ data: { project_id: 'p1', scenes: [], assets: [{ attachment_id: 'a1' }] } })
    const ok = await video.useLibraryItem({ attachment_id: 'a1', title: 'shoe.png', media_type: 'image', url: '/a1.png' },
                                          'subject', { chat: chatStub() })
    expect(ok).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/video/projects/p1/assets/', { attachment_id: 'a1', role: 'subject', source: 'library' })
    expect(video.refs.map((r) => [r.attachment_id, r.role])).toEqual([['a1', 'subject']])
  })

  it('with no project open, using a Library file creates one first', async () => {
    api.post.mockResolvedValueOnce({ data: { project_id: 'p9', scenes: [] } })               // createProject
      .mockResolvedValueOnce({ data: { project_id: 'p9', scenes: [], assets: [] } })          // pin
    video.panelTab = 'assets'
    await video.useLibraryItem({ attachment_id: 'a1', title: 'shoe.png', media_type: 'image' }, 'style', { chat: chatStub() })
    expect(api.post.mock.calls[0][0]).toBe('/video/projects/')
    expect(api.post.mock.calls[1][0]).toBe('/video/projects/p9/assets/')
    expect(video.panelTab).toBe('assets')                                                       // the user stays where they were
  })

  it('an ingredient is used with its role and saved, renamed and deleted', async () => {
    video.project = { project_id: 'p1', scenes: [] }
    const ing = { ingredient_id: 'i1', name: 'Nova', role: 'subject', files: [{ attachment_id: 'f1', title: 'nova.png', media_type: 'image' }] }
    api.post.mockResolvedValueOnce({ data: { project: { project_id: 'p1', scenes: [] }, references: [] } })
    await video.useIngredient(ing, { chat: chatStub() })
    expect(api.post).toHaveBeenCalledWith('/video/ingredients/i1/use/', { project_id: 'p1' })
    expect(video.refs[0]).toMatchObject({ attachment_id: 'f1', role: 'subject' })
    api.post.mockResolvedValueOnce({ data: { ...ing, ingredient_id: 'i2', name: 'Red sneaker' } })
    await video.createIngredient({ kind: 'product', name: 'Red sneaker', description: '', attachmentIds: ['f1'] })
    expect(api.post).toHaveBeenLastCalledWith('/video/ingredients/', { kind: 'product', name: 'Red sneaker', description: '', attachment_ids: ['f1'] })
    api.patch.mockResolvedValueOnce({ data: { ...ing, ingredient_id: 'i2', name: 'Hero sneaker' } })
    await video.updateIngredient('i2', { name: 'Hero sneaker' })
    expect(video.ingredients[0].name).toBe('Hero sneaker')
    api.delete.mockResolvedValueOnce({})
    await video.deleteIngredient('i2')
    expect(video.ingredients).toEqual([])
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

// Image mode (VIDEO_STUDIO_AGENT_FLOW_PLAN.md D14).
describe('useVideoStore image mode', () => {
  const NANO = { model_id: 21, name: 'Gemini 2.5 Flash Image', shapes: ['1:1', '9:16', '16:9'], max_references: 4 }
  const GPT = { model_id: 22, name: 'GPT Image 1', shapes: ['1:1', '2:3', '3:2'], max_references: 0 }
  let video
  beforeEach(() => {
    setActivePinia(createPinia())
    useVideoStore().studioMode = 'manual'      // these tests cover Manual mode (D15)
    vi.clearAllMocks()
    video = useVideoStore()
  })

  it('loads the image models and keeps the shape one the default model makes', async () => {
    api.get.mockResolvedValue({ data: { models: [GPT, NANO], default_model_id: 22 } })
    video.image.aspect_ratio = '16:9'
    await video.loadImageCapabilities(5)
    expect(api.get).toHaveBeenCalledWith('/video/image-capabilities/', { params: { agent_id: 5 } })
    expect(video.imageModel.name).toBe('GPT Image 1')
    expect(video.image.aspect_ratio).toBe('1:1')
  })

  it('Image keeps a file as the thing to show; a video role has no image meaning', () => {
    video.refs = [{ key: 'a', role: 'first_frame', name: 'a.png' }, { key: 'b', role: 'style', name: 'b.png' }]
    video.setKind('image')
    expect(video.refs.map((r) => r.role)).toEqual(['subject', 'style'])
  })

  it('sends the image request through the agent, with uploads named by id', async () => {
    Object.assign(video.image, { models: [NANO], defaultModelId: 21, modelId: '21', aspect_ratio: '9:16', n: 4 })
    video.setKind('image')
    video.addRef(new File(['x'], 'candle.png', { type: 'image/png' }))
    api.uploadConversationFile.mockResolvedValue({ data: { attachment_id: 'att-9' } })
    const chat = chatStub()
    expect(await video.requestImage({ prompt: 'my candle', chat })).toBe(true)
    expect(chat.sendMessage).toHaveBeenCalledWith('my candle', {
      imageRequest: { model_id: 21, aspect_ratio: '9:16', n: 4, references: [{ attachment_id: 'att-9', role: 'subject' }] },
      imageMode: true })
    expect(video.refs).toEqual([])
  })

  it('a file the model cannot use stops the request with a reason', async () => {
    Object.assign(video.image, { models: [GPT], defaultModelId: 22 })
    video.setKind('image')
    video.addRef(new File(['x'], 'candle.png', { type: 'image/png' }))
    const chat = chatStub()
    expect(await video.requestImage({ prompt: 'my candle', chat })).toBe(false)
    expect(chat.sendMessage).not.toHaveBeenCalled()
    expect(notify.warning).toHaveBeenCalledWith(expect.stringContaining('makes images from words only'))
  })

  it('lists the images this chat made, newest first as the server gives them', async () => {
    api.getConversationMedia = vi.fn().mockResolvedValue({ data: { media: [
      { attachment_id: 'i2', url: '/2.png', title: 'Two', type: 'image' }, { attachment_id: null, url: '/x.png' }] } })
    await video.loadSessionImages('c1')
    expect(api.getConversationMedia).toHaveBeenCalledWith('c1', { source: 'generated', type: 'image' })
    expect(video.sessionImages).toEqual([{ attachment_id: 'i2', url: '/2.png', title: 'Two', media_type: 'image', created_at: undefined }])
  })
})

// Agent mode (VIDEO_STUDIO_AGENT_FLOW_PLAN.md D15): a plain message, with the files added by "+" sent as chat
// attachments; the agent picks every setting, so nothing is flagged here.
describe('useVideoStore agent mode', () => {
  let video
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    try { localStorage.removeItem('aadml.studio.mode') } catch { /* no storage */ }
    video = useVideoStore()
  })
  const agentChat = (sent = true) => {
    const chat = { pendingAttachments: [], sendMessage: vi.fn(() => Promise.resolve(sent)) }
    chat.addAttachments = vi.fn((files) => files.forEach((file) => chat.pendingAttachments.push({ file, name: file.name })))
    chat.addExistingMedia = vi.fn((items) => items.forEach((m) => chat.pendingAttachments.push({ attachment_id: m.attachment_id, existing: true })))
    return chat
  }

  it('Agent is the default, and the choice is remembered', () => {
    expect(video.studioMode).toBe('agent')
    video.setStudioMode('manual')
    expect(video.studioMode).toBe('manual')
    let saved = null
    try { saved = localStorage.getItem('aadml.studio.mode') } catch { /* no storage */ }
    if (saved !== null) expect(saved).toBe('manual')
  })

  it('sends the words with the files as attachments, and never flags a file', async () => {
    video.addRef(new File(['x'], 'candle.png', { type: 'image/png' }))
    video.addExistingRef({ attachment_id: 'att-1', title: 'clip', url: '/c.mp4', media_type: 'video' }, 'first_frame')
    expect(video.unusableRefs).toEqual([])
    const chat = agentChat()
    expect(await video.sendAgentMessage({ prompt: 'make a reel of my candle', chat })).toBe(true)
    expect(chat.sendMessage).toHaveBeenCalledWith('make a reel of my candle')
    expect(chat.addAttachments).toHaveBeenCalledTimes(1)
    expect(chat.addExistingMedia).toHaveBeenCalledWith([expect.objectContaining({ attachment_id: 'att-1', type: 'video' })])
    expect(video.refs).toEqual([])
  })

  it('a message that did not go keeps the files in the box and leaves no stray attachments', async () => {
    video.addRef(new File(['x'], 'candle.png', { type: 'image/png' }))
    const chat = agentChat(false)
    expect(await video.sendAgentMessage({ prompt: 'hi', chat })).toBe(false)
    expect(video.refs).toHaveLength(1)
    expect(chat.pendingAttachments).toEqual([])
  })
})
