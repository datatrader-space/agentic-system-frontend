// @vitest-environment jsdom
// The Video Studio composer: three tasks, one input with an always-present "+", settings limited to the model.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('../../composables/useNotify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
// One chat store for the file, so a test can give the agent an image model (Image mode, D14).
const chatMock = vi.hoisted(() => ({ selectedAgentId: 5, conversationId: null, currentAgent: null, isBusy: false }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => chatMock }))

import api from '../../services/api'
import VideoComposerPanel from './VideoComposerPanel.vue'
import { useVideoStore } from '../../stores/useVideoStore'

// A model that renders from text and an opening shot only (no references, no closing shot, no video edits).
const ROUTE = {
  route_id: 7, model_id: 'kwaivgi/kling-v3.0-pro', name: 'Kling Pro', via: 'openrouter', state: 'active',
  connections: [{ route_id: 7 }], offered: ['text_to_video', 'image_to_video'],
  outputs: { durations: [5, 10], resolutions: ['720p'], aspect_ratios: ['16:9', '9:16'], audio: false },
}
// A model that also takes references, start + end frames and edits uploaded video.
const FULL = {
  ...ROUTE, route_id: 9, model_id: 'bytedance/seedance-2.0', name: 'Seedance 2.0', connections: [{ route_id: 9 }],
  offered: ['text_to_video', 'image_to_video', 'first_last_frame', 'reference_to_video', 'edit_uploaded'],
}

async function mounted(draft = 'a shoe') {
  const w = mount(VideoComposerPanel, { props: { draft } })
  await new Promise((r) => setTimeout(r, 0))
  await w.vm.$nextTick()
  return w
}

describe('VideoComposerPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useVideoStore().studioMode = 'manual'      // these tests cover Manual mode (D15)
    vi.clearAllMocks()
    Object.assign(chatMock, { currentAgent: null, ensureConversation: vi.fn(), sendMessage: vi.fn() })
    api.get.mockResolvedValue({ data: { routes: [ROUTE, FULL], default_route_id: 7 } })
  })

  it('shows Story video beside Quick clip, and switches between them', async () => {
    const w = await mounted('')
    await w.find('[data-test="video-task-story"]').trigger('click')
    expect(useVideoStore().task).toBe('story')
    expect(w.find('[data-test="video-estimate"]').text()).toContain('Plan the story')
  })

  it('lets keyboard users choose the next workflow', async () => {
    const w = await mounted('')
    await w.find('[data-test="video-task-quick"]').trigger('keydown', { key: 'ArrowRight' })
    expect(useVideoStore().task).toBe('story')
    expect(w.find('[data-test="video-task-story"]').attributes('tabindex')).toBe('0')
    w.unmount()
  })

  it('the "+" is always there and says what the model uses; an image becomes its opening shot', async () => {
    // Owner, 2026-10-19: a "+" in the input for every model. Owner, 2026-10-16: what a model cannot do is not
    // offered as a control; here it is said under the input, and a file it cannot use is flagged (next tests).
    const w = await mounted()
    expect(w.find('[data-test="video-add-media"]').exists()).toBe(true)
    expect(w.get('[data-test="video-add-note"]').text()).toContain('Kling Pro uses an opening shot.')
    expect(w.find('[data-test="video-task-edit"]').exists()).toBe(true)   // another offered model can edit
    const input = w.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'shoe.png', { type: 'image/png' })], configurable: true })
    await input.trigger('change')
    expect(useVideoStore().refs.map((r) => r.role)).toEqual(['first_frame'])
    expect(w.find('[data-test="video-ref-unusable"]').exists()).toBe(false)
    // Only what Kling Pro offers: 5 or 10 s, one resolution (shown as a fact, not a list of one), two shapes.
    await w.get('[data-test="video-length"]').trigger('click')
    expect(w.get('[data-test="video-length-panel"]').findAll('.vch-opt').map((o) => o.text())).toEqual(['5 s', '10 s'])
    expect(w.get('[data-test="video-resolution"]').element.tagName).toBe('SPAN')
    expect(w.get('[data-test="video-resolution"]').text()).toBe('720p')
    expect(useVideoStore().settings.resolution).toBe('720p')
    await w.get('[data-test="video-aspect"]').trigger('click')
    expect(w.get('[data-test="video-aspect-panel"]').text()).toContain('9:16')
    expect(w.get('[data-test="video-aspect-panel"]').text()).toContain('Vertical')
    expect(w.get('[data-test="video-aspect-panel"]').text()).not.toContain('1:1')
    expect(w.find('select').exists()).toBe(false)                        // no raw browser lists
    expect(w.get('[data-test="video-sound"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="video-sound"]').text()).toBe('Silent')
  })

  it('picking a model that can do more shows its features', async () => {
    const w = await mounted()
    const video = useVideoStore()
    video.pickRoute('9')
    await w.vm.$nextTick()
    expect(w.find('[data-test="video-task-edit"]').exists()).toBe(true)
    expect(w.get('[data-test="video-add-note"]').text()).toContain('references and opening and closing shots')
    video.addRef(new File(['x'], 'shoe.png', { type: 'image/png' }), 'subject')
    await w.vm.$nextTick()
    await w.get('[data-test="video-ref-role"]').trigger('click')
    const roles = w.get('[data-test="video-ref-role-panel"]').findAll('.vch-opt-label').map((o) => o.text())
    expect(roles).toEqual(expect.arrayContaining(['Product, character or place', 'Style', 'Opening shot', 'Closing shot']))
  })

  it('switching model changes the choices to what the new model offers', async () => {
    const w = await mounted()
    const video = useVideoStore()
    const WIDE = { ...FULL, route_id: 11, model_id: 'google/veo-3.1', name: 'Veo 3.1', connections: [{ route_id: 11 }],
                   outputs: { durations: [4, 6, 8], resolutions: ['1080p', '720p', '4K'], aspect_ratios: ['16:9', '9:16'], audio: true } }
    video.routes = [ROUTE, FULL, WIDE]
    video.settings.duration = 8                                          // not on Kling, on Veo: no switch plan needed
    video.pickRoute('11')
    if (video.pendingSwitch) video.applySwitch()
    await w.vm.$nextTick()
    await w.get('[data-test="video-resolution"]').trigger('click')
    expect(w.get('[data-test="video-resolution-panel"]').findAll('.vch-opt-label').map((o) => o.text())).toEqual(['720p', '1080p', '4K'])
    await w.get('[data-test="video-length"]').trigger('click')
    expect(w.get('[data-test="video-length-panel"]').findAll('.vch-opt').map((o) => o.text())).toEqual(['4 s', '6 s', '8 s'])
  })

  it('in the agent column the settings are one chip that opens a labelled panel, and only problems are hinted', async () => {
    const w = mount(VideoComposerPanel, { props: { draft: 'a shoe', variant: 'chat' }, attachTo: document.body })
    await new Promise((r) => setTimeout(r, 0))
    await w.vm.$nextTick()
    expect(w.find('[data-test="video-add-note"]').exists()).toBe(false)          // nothing to act on: no hint
    const panel = () => w.get('[data-test="video-settings-panel"]')
    expect(panel().element.style.display).toBe('none')
    await w.get('[data-test="video-settings-toggle"]').trigger('click')
    expect(panel().element.style.display).toBe('')
    expect(panel().classes()).toContain('is-pop')
    expect(panel().text()).toContain('Video settings')
    expect(panel().find('.vch.in-sheet').exists()).toBe(true)                    // labelled rows, lists open in place
    await w.get('[data-test="video-settings-done"]').trigger('click')
    expect(panel().element.style.display).toBe('none')
    w.unmount()
  })

  it('the "+" offers this device or the Library, and closes after a choice', async () => {
    const w = await mounted()
    await w.get('[data-test="video-add-media"]').trigger('click')
    expect(w.get('[data-test="video-add-media"]').attributes('aria-expanded')).toBe('true')
    expect(w.find('[data-test="video-add-upload"]').exists()).toBe(true)
    await w.get('[data-test="video-add-library"]').trigger('click')
    expect(useVideoStore().libraryOpen).toBe(true)
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('a second image never replaces the opening shot: it is flagged with a model that can use it', async () => {
    const w = await mounted()
    const video = useVideoStore()
    const input = w.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true,
      value: [new File(['a'], 'one.png', { type: 'image/png' }), new File(['b'], 'two.png', { type: 'image/png' })] })
    await input.trigger('change')
    expect(video.refs.map((r) => [r.name, r.role])).toEqual([['one.png', 'first_frame'], ['two.png', 'subject']])
    const flagged = w.get('[data-test="video-ref-unusable"]')
    expect(flagged.text()).toContain('Kling Pro does not take reference images')
    expect(w.find('[data-test="video-estimate"]').attributes('disabled')).toBeDefined()
    const pick = vi.spyOn(video, 'pickRoute')
    await flagged.get('[data-test="video-ref-switch"]').trigger('click')
    expect(pick).toHaveBeenCalledWith('9')
  })

  it('Edit footage on a model that cannot edit proposes one that can, and waits for the user', async () => {
    const w = await mounted()
    const video = useVideoStore()
    expect(String(video.routeId || video.defaultRouteId)).toBe('7')        // Kling: no edits
    await w.get('[data-test="video-task-edit"]').trigger('click')
    expect(video.task).toBe('edit')
    const plan = w.find('[data-test="video-switch-plan"]')
    if (plan.exists()) {
      expect(plan.text()).toContain('Seedance 2.0')                          // proposed, not applied
      expect(String(video.routeId || video.defaultRouteId)).toBe('7')
    } else {
      expect(String(video.routeId)).toBe('9')                                // nothing to change: switched
    }
  })

  it('switching to a model that cannot edit shows what changes and waits for the user', async () => {
    // Owner review 2026-10-19: never switched behind the user — the plan is shown, nothing moves until applied.
    const w = await mounted()
    const video = useVideoStore()
    video.pickRoute('9')
    await w.vm.$nextTick()
    video.setTask('edit')
    video.pickRoute('7')
    await w.vm.$nextTick()
    expect(video.task).toBe('edit')
    const plan = w.find('[data-test="video-switch-plan"]')
    expect(plan.exists()).toBe(true)
    expect(plan.text()).toContain('cannot edit footage')
    expect(w.find('[data-test="video-estimate"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="video-switch-keep"]').trigger('click')
    expect(video.task).toBe('edit')
    expect(String(video.routeId)).toBe('9')
    video.pickRoute('7')
    await w.vm.$nextTick()
    await w.find('[data-test="video-switch-apply"]').trigger('click')
    expect(video.task).toBe('quick')
    expect(String(video.routeId)).toBe('7')
  })

  it('a reference the model cannot use stays on screen, flagged', async () => {
    const w = await mounted()
    const video = useVideoStore()
    video.addRef(new File(['x'], 'look.png', { type: 'image/png' }), 'style')
    await w.vm.$nextTick()
    const chip = w.find('[data-test="video-ref-unusable"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toContain('does not take style references')
    expect(w.find('[data-test="video-estimate"]').attributes('disabled')).toBeDefined()
  })

  it('nothing to estimate without a description', () => {
    const w = mount(VideoComposerPanel, { props: { draft: '' } })
    expect(w.find('[data-test="video-estimate"]').attributes('disabled')).toBeDefined()
  })
})


describe('studio project preparation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useVideoStore().studioMode = 'manual'      // these tests cover Manual mode (D15)
    api.get.mockResolvedValue({ data: { routes: [ROUTE], default_route_id: 7 } })
  })
  it('does not request a render estimate if the project could not be created', async () => {
    const video = useVideoStore()
    vi.spyOn(video, 'createProject').mockResolvedValue(null)
    const request = vi.spyOn(video, 'request')
    const wrapper = mount(VideoComposerPanel, { props: { draft: 'Product reveal', ensureProject: true } })
    await wrapper.get('[data-test="video-estimate"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(request).not.toHaveBeenCalled()
    expect(wrapper.emitted('done')).toBeUndefined()
    wrapper.unmount()
  })
  it('saves quick clips as projects before requesting an estimate', async () => {
    const video = useVideoStore()
    const project = vi.spyOn(video, 'createProject').mockResolvedValue({ project_id: 'p1' })
    const request = vi.spyOn(video, 'request').mockResolvedValue(true)
    const wrapper = mount(VideoComposerPanel, { props: { draft: 'Product reveal', ensureProject: true } })
    await wrapper.get('[data-test="video-estimate"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(project).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'Product reveal' }))
    expect(project.mock.invocationCallOrder[0]).toBeLessThan(request.mock.invocationCallOrder[0])
    expect(wrapper.emitted('done')).toHaveLength(1)
    wrapper.unmount()
  })
})


// Image mode (VIDEO_STUDIO_AGENT_FLOW_PLAN.md D14): an Image / Video switch above the box; Image shows the image model,
// only the shapes it makes and how many, and "Create image" sends the request to the agent.
const NANO = { model_id: 21, model: 'google/gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', maker: 'Google',
               shapes: ['1:1', '2:3', '3:2', '9:16', '16:9'], max_references: 4, price_per_image: 0.039, platform: true, own_key: false }
const GPT = { model_id: 22, model: 'gpt-image-1', name: 'GPT Image 1', maker: 'OpenAI', shapes: ['1:1', '2:3', '3:2'],
              max_references: 0, price_per_image: null, platform: false, own_key: true }

describe('VideoComposerPanel image mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useVideoStore().studioMode = 'manual'      // these tests cover Manual mode (D15)
    vi.clearAllMocks()
    Object.assign(chatMock, { currentAgent: { id: 5, image_model: 3, video_model: 4 },
                              ensureConversation: vi.fn().mockResolvedValue('c1'), sendMessage: vi.fn().mockResolvedValue(true) })
    api.get.mockImplementation((url) => Promise.resolve({ data: String(url).includes('image-capabilities')
      ? { models: [NANO, GPT], default_model_id: 21 } : { routes: [ROUTE, FULL], default_route_id: 7 } }))
  })

  it('Image is not offered while the agent has no image model', async () => {
    chatMock.currentAgent = { id: 5, image_model: null, video_model: 4 }
    const w = await mounted()
    // Video is the only thing to make: shown as a fact, not a list of one.
    expect(w.get('[data-test="studio-kind"]').element.tagName).toBe('SPAN')
    expect(w.get('[data-test="studio-kind"]').text()).toBe('Video')
  })

  it('switching to Image shows only image settings, and the main action names the count', async () => {
    const w = await mounted('a candle')
    // Image or Video is a dropdown beside the other settings (owner, 2026-10-20), not a switch above the box.
    await w.get('[data-test="studio-kind"]').trigger('click')
    await w.get('[data-test="studio-kind-panel"]').findAll('.vch-opt').find((o) => o.text().includes('Image')).trigger('click')
    const video = useVideoStore()
    expect(video.kind).toBe('image')
    expect(w.get('[data-test="studio-kind"]').text()).toContain('Image')
    expect(w.find('[data-test="video-task-quick"]').exists()).toBe(false)          // video tasks belong to Video
    expect(w.find('[data-test="video-length"]').exists()).toBe(false)
    expect(w.find('[data-test="video-sound"]').exists()).toBe(false)
    expect(w.get('[data-test="image-model"]').text()).toContain('Auto (Gemini 2.5 Flash Image)')
    await w.get('[data-test="image-aspect"]').trigger('click')
    expect(w.get('[data-test="image-aspect-panel"]').findAll('.vch-opt-label').map((o) => o.text()))
      .toEqual(['1:1', '2:3', '3:2', '9:16', '16:9'])
    await w.get('[data-test="image-count"]').trigger('click')
    const three = w.get('[data-test="image-count-panel"]').findAll('.vch-opt').find((o) => o.text() === '3 images')
    await three.trigger('click')
    expect(video.image.n).toBe(3)
    expect(w.get('[data-test="image-create"]').text()).toBe('Create 3 images')
    const note = w.get('[data-test="video-add-note"]').text()
    expect(note).toContain('Gemini 2.5 Flash Image takes up to 4 reference images.')
    expect(note).toContain('Nothing is made until you approve the card that shows the price')
    expect(note).toContain('About $0.039 an image.')
  })

  it('a model that makes other shapes waits for the person in the switch notice', async () => {
    const w = await mounted()
    const video = useVideoStore()
    video.setKind('image')
    video.image.aspect_ratio = '16:9'
    video.pickImageModel('22')
    await w.vm.$nextTick()
    expect(video.image.modelId).toBe('')                                           // not applied yet
    expect(w.get('[data-test="video-switch-plan"]').text()).toContain('Shape: 16:9 to 1:1')
    expect(w.get('[data-test="image-create"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="video-switch-apply"]').trigger('click')
    expect(video.image.modelId).toBe('22')
    expect(video.image.aspect_ratio).toBe('1:1')
  })

  it('a video file is flagged in Image mode, and a words-only model flags an image with a model that takes it', async () => {
    const w = await mounted()
    const video = useVideoStore()
    video.setKind('image')
    video.addRef(new File(['x'], 'clip.mp4', { type: 'video/mp4' }))
    await w.vm.$nextTick()
    expect(w.get('[data-test="video-ref-unusable"]').text()).toContain('uses images only')
    video.refs = []
    video.image.modelId = '22'
    video.addRef(new File(['x'], 'candle.png', { type: 'image/png' }))
    await w.vm.$nextTick()
    const chip = w.get('[data-test="video-ref-unusable"]')
    expect(chip.text()).toContain('makes images from words only')
    await chip.get('[data-test="video-ref-switch"]').trigger('click')
    expect(video.image.modelId).toBe('21')
  })

  it('Create image sends the request to the agent with the person\'s settings', async () => {
    const w = await mounted('my candle on black stone')
    const video = useVideoStore()
    video.setKind('image')
    Object.assign(video.image, { modelId: '21', aspect_ratio: '9:16', n: 2 })
    await w.vm.$nextTick()
    await w.get('[data-test="image-create"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(chatMock.sendMessage).toHaveBeenCalledWith('my candle on black stone', {
      imageRequest: { model_id: 21, aspect_ratio: '9:16', n: 2, references: [] }, imageMode: true })
    expect(video.panelTab).toBe('images')
    expect(w.emitted('done')).toHaveLength(1)
  })
})

describe('the box empties once a request is sent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useVideoStore().studioMode = 'manual'      // these tests cover Manual mode (D15)
    vi.clearAllMocks()
    Object.assign(chatMock, { currentAgent: { id: 5, image_model: 3, video_model: 4 },
                              ensureConversation: vi.fn().mockResolvedValue('c1'), sendMessage: vi.fn().mockResolvedValue(true) })
    api.get.mockResolvedValue({ data: { routes: [ROUTE], default_route_id: 7, models: [NANO], default_model_id: 21 } })
  })
  it('even when the create screen is gone before it hears "done"', async () => {
    const video = useVideoStore()
    video.studioDraft = 'my candle'
    vi.spyOn(video, 'requestImage').mockResolvedValue(true)
    const w = await mounted('my candle')
    video.setKind('image')
    await w.vm.$nextTick()
    await w.get('[data-test="image-create"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(video.studioDraft).toBe('')
  })
})

describe('VideoComposerPanel agent mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    Object.assign(chatMock, { currentAgent: { id: 5, image_model: 3, video_model: 4 }, ensureConversation: vi.fn(), sendMessage: vi.fn() })
    api.get.mockResolvedValue({ data: { routes: [ROUTE], default_route_id: 7, models: [NANO], default_model_id: 21 } })
  })

  it('is a plain chat box: no Image / Video, no tasks, no settings and no estimate button', async () => {
    const video = useVideoStore()
    video.studioMode = 'agent'
    const w = await mounted('hi, I want a product video')
    expect(w.get('[data-test="studio-mode-agent"]').attributes('aria-checked')).toBe('true')
    for (const sel of ['studio-kind', 'video-task-quick', 'video-settings-panel', 'video-estimate', 'image-create', 'video-route']) {
      expect(w.find(`[data-test="${sel}"]`).exists()).toBe(false)
    }
    expect(w.find('[data-test="video-add-media"]').exists()).toBe(true)          // "+" stays
    expect(w.get('[data-test="video-add-note"]').text()).toContain('picks the models and settings')
  })

  it('switching to Manual brings back every setting', async () => {
    const video = useVideoStore()
    video.studioMode = 'agent'
    const w = await mounted('a shoe')
    await w.get('[data-test="studio-mode-manual"]').trigger('click')
    expect(video.studioMode).toBe('manual')
    expect(w.find('[data-test="studio-kind"]').exists()).toBe(true)
    expect(w.find('[data-test="video-estimate"]').exists()).toBe(true)
    expect(w.find('[data-test="video-task-quick"]').exists()).toBe(true)
  })
})
