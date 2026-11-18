// @vitest-environment jsdom
// The nine pages that were "Coming soon" (CREATIVE_SUITE_PAGES_2_CODEX_BRIEF.md): each sends exactly its request,
// shows the consent step when the backend asks for it and retries the same request, and never starts a job.
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import api from '../../services/api'
import CreativeAudio from './CreativeAudio.vue'
import CreativeImageEdit from './CreativeImageEdit.vue'
import CreativeLikeness from './CreativeLikeness.vue'
import CreativeSwap from './CreativeSwap.vue'
import CreativeCharacters from './CreativeCharacters.vue'
import CreativeIdentity from './CreativeIdentity.vue'
import CreativeMarketing from './CreativeMarketing.vue'
import MaskCanvas from './MaskCanvas.vue'
import MediaSlot from './MediaSlot.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
const chat = vi.hoisted(() => ({ value: null }))
const video = vi.hoisted(() => ({ value: null }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => chat.value }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => video.value }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../../services/api', () => ({ default: Object.fromEntries(['getMediaRoutes','prepareMediaJob','getMediaVoices','recordLikenessConsent','getStudioRoutes','prepareVideoJob','getCharacterTraits','prepareCharacterPortraits','prepareCharacterSheet','saveCharacter','getIdentities','getStudioElements','trainIdentity','deleteIdentity','prepareIdentityImages','uploadConversationFile','getStudioRecipes','runStudioRecipe','getStudioJob','getStudioJobMask','getStudioQuote','get','post'].map(name => [name, vi.fn()])) }))
const stubs = { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }, VideoLibrary: true }
const job = { job_id: 'j1', state: 'awaiting_authorization' }
const consentRefusal = (ids) => ({ response: { data: { error: { code: 'consent_required', field: 'references', message: 'Confirm you have the consent of the person shown or heard.', alternatives: ids.map(id => ({ attachment_id: id, statement: 'I confirm that the person shown or heard in this file is me.', statement_version: '2026-10-22' })) } } } })
const file = (id, media_type, name = `${id}.file`) => ({ attachment_id: id, name, media_type, url: `blob:${id}` })
const mountIt = (component, props = {}) => mount(component, { props, global: { stubs, provide: { studioMonitor: '' } } })
function setSlot(w, label, items) { w.findAllComponents(MediaSlot).find(s => s.props('label') === label).vm.$emit('update:modelValue', items) }
const neverStarted = () => expect([...api.post.mock.calls, ...api.prepareMediaJob.mock.calls].some(call => String(call[0]).includes('/start/'))).toBe(false)
beforeEach(() => {
  vi.clearAllMocks()
  chat.value = reactive({ conversationId: 'c1', ensureConversation: vi.fn(async () => 'c1') })
  video.value = reactive({ loadIngredientSchema: async () => null, project: null })
  api.getMediaRoutes.mockResolvedValue({ data: { routes: [{ route_id: 7, name: 'Proven', ready: true, provider: 'elevenlabs', model: 'm' }, { route_id: 8, name: 'Unproven', ready: false, provider: 'x', model: 'n' }] } })
  api.getMediaVoices.mockResolvedValue({ data: { listed: true, voices: [{ voice_id: 'v1', name: 'Ava' }], next_page_token: '' } })
  api.prepareMediaJob.mockResolvedValue({ data: job })
  api.recordLikenessConsent.mockResolvedValue({ data: {} })
})

describe('Voice & audio', () => {
  it('sends a speech job with the full script and the chosen voice, and leaves Generate to its card', async () => {
    const w = mountIt(CreativeAudio); await flushPromises()
    expect(w.get('[data-test="media-route"]').element.value).toBe('7')
    expect(w.find('option[value="8"]').attributes('disabled')).toBeDefined()
    const script = 'A long script. '.repeat(500)
    await w.get('[data-test="audio-script"]').setValue(script)
    await w.get('input[type="radio"][value="v1"]').setValue(true)
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob).toHaveBeenCalledExactlyOnceWith({ operation: 'speech', route_id: '7', request: { prompt: script, voice_id: 'v1' }, references: [], conversation_id: 'c1' })
    expect(w.emitted('job')).toEqual([[job]]); neverStarted(); w.unmount()
  })
  it('sends the page with the job, so the chat is named after the page (Manual sends no chat message)', async () => {
    chat.value.studioContext = { page: 'audio' }
    const w = mountIt(CreativeAudio); await flushPromises()
    await w.get('[data-test="audio-script"]').setValue('Hello')
    await w.get('input[type="radio"][value="v1"]').setValue(true)
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls[0][0].studio_context).toEqual({ page: 'audio' })
    w.unmount()
  })
  it('asks for consent on a voice change, records it, and sends the same request again', async () => {
    api.prepareMediaJob.mockRejectedValueOnce(consentRefusal(['a1'])).mockResolvedValueOnce({ data: job })
    const w = mountIt(CreativeAudio); await flushPromises()
    await w.get('[data-test="audio-voice_change"]').trigger('click'); await flushPromises()
    setSlot(w, 'Recording', [file('a1', 'audio', 'take.wav')]); await flushPromises()
    await w.get('input[type="radio"][value="v1"]').setValue(true)
    await w.get('form').trigger('submit'); await flushPromises()
    const step = w.get('[data-test="consent-step"]')
    expect(step.text()).toContain('take.wav'); expect(step.text()).toContain('I confirm that the person shown or heard')
    expect(w.get('[data-test="consent-confirm"]').attributes('disabled')).toBeDefined()     // nothing pre-ticked
    await w.get('[data-test="consent-name"]').setValue('Sam')
    await w.get('[data-test="consent-self"]').setValue(true)
    await w.get('[data-test="consent-agree"]').setValue(true)
    await w.get('[data-test="consent-confirm"]').trigger('click'); await flushPromises()
    expect(api.recordLikenessConsent).toHaveBeenCalledExactlyOnceWith({ attachment_id: 'a1', subject_name: 'Sam', basis: 'self' })
    expect(api.prepareMediaJob).toHaveBeenCalledTimes(2)
    expect(api.prepareMediaJob.mock.calls[1]).toEqual(api.prepareMediaJob.mock.calls[0])
    expect(api.prepareMediaJob.mock.calls[0][0]).toEqual({ operation: 'voice_change', route_id: '7', request: { voice_id: 'v1', remove_background_noise: false }, references: [{ attachment_id: 'a1', role: 'audio' }], conversation_id: 'c1' })
    expect(w.emitted('job')).toEqual([[job]]); neverStarted(); w.unmount()
  })
  it('sends nothing more when the consent step is cancelled', async () => {
    api.prepareMediaJob.mockRejectedValueOnce(consentRefusal(['a1']))
    const w = mountIt(CreativeAudio); await flushPromises()
    await w.get('[data-test="audio-voice_change"]').trigger('click'); await flushPromises()
    setSlot(w, 'Recording', [file('a1', 'audio')]); await w.get('input[type="radio"][value="v1"]').setValue(true)
    await w.get('form').trigger('submit'); await flushPromises()
    await w.get('[data-test="consent-cancel"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="consent-step"]').exists()).toBe(false)
    expect(api.recordLikenessConsent).not.toHaveBeenCalled(); expect(api.prepareMediaJob).toHaveBeenCalledTimes(1); w.unmount()
  })
})

describe('Voice & audio: sound effects', () => {
  it('sends a length with every sound effect, 5 s unless changed, so it can be priced (ADM-1170)', async () => {
    const w = mountIt(CreativeAudio); await flushPromises()
    await w.get('[data-test="audio-sound"]').trigger('click'); await flushPromises()
    await w.get('textarea[data-test="audio-sound"]').setValue('Rain on a tin roof')
    const length = w.get('[data-field="duration"] input')
    expect(Number(length.element.value)).toBe(5)
    await length.setValue('')
    expect(w.get('[data-test="audio-prepare"]').attributes('disabled')).toBeDefined()
    await length.setValue('8')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls[0][0].request).toEqual({ prompt: 'Rain on a tin roof', duration: 8 })
    w.unmount()
  })
})

describe('Files from the Library', () => {
  it("links a file from another chat to the session's project, unpinned, and sends that project with the job", async () => {
    api.get.mockResolvedValue({ data: { project: null } })
    api.post.mockImplementation(async (url, body) => url === '/video/projects/'
      ? { data: { project_id: 'p1', title: body.title } } : { data: { project_id: 'p1', assets: [] } })
    const w = mountIt(CreativeImageEdit); await flushPromises()
    w.findAllComponents({ name: 'InputSlot' }).find(s => s.props('label') === 'Image to edit').vm.$emit('pick', [{ attachment_id: 'lib1', title: 'shoe.png', media_type: 'image', url: 'https://x/shoe.png' }])
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/video/projects/', { params: { conversation_id: 'c1' } })
    expect(api.post).toHaveBeenCalledWith('/video/projects/', { conversation_id: 'c1', title: 'Image to edit session', brief: { session: true } })
    expect(api.post).toHaveBeenCalledWith('/video/projects/p1/assets/', { attachment_id: 'lib1', role: 'subject', source: 'library', pinned: false })
    await w.get('[data-test="edit-prompt"]').setValue('Make it blue')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls[0][0]).toMatchObject({ references: [{ attachment_id: 'lib1', role: 'edit_source' }], conversation_id: 'c1', project_id: 'p1' })
    w.unmount()
  })
})

describe('Image edit', () => {
  it('sends the image as the edit source, with no mask when nothing is painted', async () => {
    const w = mountIt(CreativeImageEdit); await flushPromises()
    setSlot(w, 'Image to edit', [file('img', 'image')]); await flushPromises()
    await w.get('[data-test="edit-prompt"]').setValue('Make the mug blue')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob).toHaveBeenCalledExactlyOnceWith({ operation: 'edit_image', route_id: '7', request: { prompt: 'Make the mug blue' }, references: [{ attachment_id: 'img', role: 'edit_source' }], conversation_id: 'c1' })
    expect(api.uploadConversationFile).not.toHaveBeenCalled(); neverStarted(); w.unmount()
  })
  it('"Edit" on a picture opens with it in "Image to edit" (the store’s edit_source)', async () => {
    video.value = reactive({ loadIngredientSchema: async () => null, project: null, refs: [{ key: 'pic1edit_source', role: 'edit_source', name: 'beach.png', url: '/beach.png', attachment_id: 'pic1', isVideo: false, thumbnail_url: '/beach-small.png' }] })
    const w = mountIt(CreativeImageEdit); await flushPromises()
    const slot = w.findAllComponents(MediaSlot).find(s => s.props('label') === 'Image to edit')
    expect(slot.props('modelValue')).toEqual([{ attachment_id: 'pic1', name: 'beach.png', media_type: 'image', url: '/beach.png', thumbnail_url: '/beach-small.png' }])
    await w.get('[data-test="edit-prompt"]').setValue('Add a sunset')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls[0][0]).toMatchObject({ operation: 'edit_image', references: [{ attachment_id: 'pic1', role: 'edit_source' }] })
    w.unmount()
  })
  it('a queued video is not taken as the image to edit', async () => {
    video.value = reactive({ loadIngredientSchema: async () => null, project: null, refs: [{ role: 'edit_source', name: 'clip.mp4', url: '/clip.mp4', attachment_id: 'v1', isVideo: true }] })
    const w = mountIt(CreativeImageEdit); await flushPromises()
    expect(w.findAllComponents(MediaSlot).find(s => s.props('label') === 'Image to edit').props('modelValue')).toEqual([]); w.unmount()
  })
  it('hides the mask painter for a model that edits from the description alone (takes_mask: false)', async () => {
    api.getMediaRoutes.mockResolvedValue({ data: { routes: [{ route_id: 7, name: 'Nano Banana', ready: true, provider: 'openrouter', model: 'google/gemini-2.5-flash-image', takes_mask: false }] } })
    const w = mountIt(CreativeImageEdit); await flushPromises()
    setSlot(w, 'Image to edit', [file('img', 'image')]); await flushPromises()
    expect(w.find('[data-test="mask-paint"]').exists()).toBe(false)
    expect(w.get('[data-test="no-mask-note"]').text()).toContain('does not take a painted area')
    w.unmount()
    api.getMediaRoutes.mockResolvedValue({ data: { routes: [{ route_id: 8, name: 'Ideogram', ready: true, provider: 'ideogram', model: 'V_3', takes_mask: true }] } })
    const withMask = mountIt(CreativeImageEdit); await flushPromises()
    setSlot(withMask, 'Image to edit', [file('img', 'image')]); await flushPromises()
    expect(withMask.find('[data-test="mask-paint"]').exists()).toBe(true)
    expect(withMask.find('[data-test="no-mask-note"]').exists()).toBe(false)
    withMask.unmount()
  })
  it("shows a model's refusal of the mask as it comes", async () => {
    api.prepareMediaJob.mockRejectedValue({ response: { data: { error: { code: 'unsupported_input', field: 'references', message: 'This model takes no mask: describe the change in words.' } } } })
    const w = mountIt(CreativeImageEdit); await flushPromises()
    setSlot(w, 'Image to edit', [file('img', 'image')]); await w.get('[data-test="edit-prompt"]').setValue('Change it')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(w.text()).toContain('This model takes no mask: describe the change in words.'); expect(w.emitted('job')).toBeUndefined(); w.unmount()
  })
})

describe('Image edit: click to select an area (ADM-1251)', () => {
  // A stand-in for the canvas (jsdom draws nothing): it records what the page asks of it.
  const canvasCalls = { value: null }
  const MaskStub = {
    name: 'MaskCanvas', props: ['src', 'brush', 'mode', 'points', 'box'], emits: ['change', 'size', 'point', 'box'],
    template: '<div data-test="mask-stub" :data-mode="mode" />',
    setup(_, { expose }) { expose(canvasCalls.value); return {} },
  }
  const FILL = { route_id: 9, name: 'FLUX.1 [pro] Fill', ready: true, provider: 'fal', model: 'fal-ai/flux-pro/v1/fill', takes_mask: true, requires_mask: true, needs: { prompt: true, mask: true } }
  const SAM = { route_id: 21, name: 'Segment Anything Model 3', ready: true, provider: 'fal', model: 'fal-ai/sam-3/image' }
  let target
  beforeEach(() => {
    canvasCalls.value = { setMask: vi.fn(async () => true), toBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })), invert: vi.fn(), grow: vi.fn(), shrink: vi.fn(), undo: vi.fn(), clear: vi.fn() }
    api.getMediaRoutes.mockImplementation(async op => ({ data: { routes: op === 'segment' ? [SAM] : [FILL] } }))
    api.getStudioQuote.mockResolvedValue({ data: { estimate_usd: '0.006', max_usd: '0.006', pricing_status: 'exact' } })
    target = document.createElement('div'); target.id = 'mon'; document.body.appendChild(target)
  })
  afterEach(() => { target?.remove() })
  const mountEdit = () => mount(CreativeImageEdit, { attachTo: document.body, global: { stubs: { ...stubs, MaskCanvas: MaskStub }, provide: { studioMonitor: 'mon' } } })
  const mask = w => w.findComponent({ name: 'MaskCanvas' })
  async function ready() {
    const w = mountEdit(); await flushPromises()
    setSlot(w, 'Image to edit', [file('pic', 'image')]); await flushPromises()
    return w
  }

  it('clicks and a box become the selection, priced first, and finding it waits for Generate on its card', async () => {
    const w = await ready()
    expect(w.get('[data-test="mask-select"]').attributes('aria-checked')).toBe('true')
    expect(w.get('[data-test="mask-find"]').attributes('disabled')).toBeDefined()           // nothing selected yet
    mask(w).vm.$emit('point', { x: 0.5, y: 0.4, label: 1 })
    mask(w).vm.$emit('point', { x: 0.9, y: 0.1, label: 0 })
    await w.get('[data-test="mask-box"]').trigger('click')
    mask(w).vm.$emit('box', { x_min: 0.2, y_min: 0.2, x_max: 0.7, y_max: 0.8 }); await flushPromises()
    expect(w.get('[data-test="mask-selection"]').text()).toBe('Selected: 1 point on it, 1 point off it, a box.')
    expect(mask(w).props('points')).toHaveLength(2)
    await new Promise(r => setTimeout(r, 750)); await flushPromises()
    expect(api.getStudioQuote).toHaveBeenCalledWith(expect.objectContaining({ kind: 'media', operation: 'segment', route_id: 21 }))
    expect(w.get('[data-test="mask-price"]').text()).toBe('$0.006')
    api.prepareMediaJob.mockResolvedValueOnce({ data: { job_id: 's1', state: 'awaiting_authorization', quote: { estimate_usd: '0.006' } } })
    await w.get('[data-test="mask-find"]').trigger('click'); await flushPromises()
    expect(api.prepareMediaJob).toHaveBeenCalledExactlyOnceWith({ operation: 'segment', route_id: 21,
      request: { points: [{ x: 0.5, y: 0.4, label: 1 }, { x: 0.9, y: 0.1, label: 0 }], box: { x_min: 0.2, y_min: 0.2, x_max: 0.7, y_max: 0.8 } },
      references: [{ attachment_id: 'pic', role: 'edit_source' }], conversation_id: 'c1' })
    expect(w.get('[data-test="mask-estimate"]').text()).toContain('Finding this area costs $0.006.')
    neverStarted()                                                                           // only the card starts it
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      api.post.mockResolvedValueOnce({ data: { job_id: 's1', state: 'queued' } })
      api.getStudioJob.mockResolvedValueOnce({ data: { job_id: 's1', state: 'ready' } })
      const png = new Blob(['mask'], { type: 'image/png' })
      api.getStudioJobMask.mockResolvedValueOnce({ data: png })
      await w.get('[data-test="mask-generate"]').trigger('click'); await flushPromises()
      expect(api.post).toHaveBeenCalledWith('/video/jobs/s1/start/', { accept: true })
      expect(w.get('[data-test="mask-finding"]').text()).toBe('Finding the area…')
      await vi.advanceTimersByTimeAsync(1100); await flushPromises()
      expect(api.getStudioJobMask).toHaveBeenCalledWith('s1')
      expect(canvasCalls.value.setMask).toHaveBeenCalledWith(png)
      expect(mask(w).props('mode')).toBe('paint')                                            // refine it with the brush
    } finally { vi.useRealTimers() }
    w.unmount()
  })

  it('words alone can find the area, and Decline ends the card at no cost', async () => {
    const w = await ready()
    await w.get('[data-test="mask-words"]').setValue('the mug')
    api.prepareMediaJob.mockResolvedValueOnce({ data: { job_id: 's2', state: 'awaiting_authorization', quote: { estimate_usd: '0.006' } } })
    await w.get('[data-test="mask-find"]').trigger('click'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls[0][0].request).toEqual({ prompt: 'the mug' })
    api.post.mockResolvedValueOnce({ data: { job_id: 's2', state: 'cancelled' } })
    await w.get('[data-test="mask-decline"]').trigger('click'); await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/video/jobs/s2/decline/', {})
    expect(w.find('[data-test="mask-estimate"]').exists()).toBe(false)
    w.unmount()
  })

  it('refines the marked area with Invert, Grow, Shrink, Undo and Clear', async () => {
    const w = await ready()
    for (const name of ['invert', 'grow', 'shrink', 'clear']) expect(w.get(`[data-test="mask-${name}"]`).attributes('disabled')).toBeDefined()
    mask(w).vm.$emit('change', true); await flushPromises()
    for (const name of ['invert', 'grow', 'shrink', 'undo', 'clear']) await w.get(`[data-test="mask-${name}"]`).trigger('click')
    for (const name of ['invert', 'grow', 'shrink', 'undo', 'clear']) expect(canvasCalls.value[name]).toHaveBeenCalledOnce()
    w.unmount()
  })

  it('a model that edits only a marked area asks for it, then sends the mask with the edit', async () => {
    api.uploadConversationFile.mockResolvedValue({ data: { attachment_id: 'mask1' } })
    const w = await ready()
    await w.get('[data-test="edit-prompt"]').setValue('A glass of water')
    expect(w.get('[data-test="edit-prepare"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Select or paint the area to change first.')
    mask(w).vm.$emit('change', true); await flushPromises()
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob).toHaveBeenCalledExactlyOnceWith({ operation: 'edit_image', route_id: '9', request: { prompt: 'A glass of water' },
      references: [{ attachment_id: 'pic', role: 'edit_source' }, { attachment_id: 'mask1', role: 'mask' }], conversation_id: 'c1' })
    neverStarted(); w.unmount()
  })

  it('a model that edits only a marked area is offered only where a mask is sent', async () => {
    api.getMediaRoutes.mockResolvedValue({ data: { routes: [FILL, { route_id: 7, name: 'Nano Banana', ready: true, provider: 'openrouter', model: 'g', takes_mask: false }] } })
    const plain = mount(MediaRoutePicker, { props: { operation: 'edit_image' }, global: { stubs } }); await flushPromises()
    expect(plain.findAll('option').map(o => o.element.value)).toEqual(['7'])
    const masked = mount(MediaRoutePicker, { props: { operation: 'edit_image', masked: true }, global: { stubs } }); await flushPromises()
    expect(masked.findAll('option').map(o => o.element.value)).toEqual(['9', '7'])
    plain.unmount(); masked.unmount()
  })

  it('without a selection model the area is painted, and the click tools are not offered', async () => {
    api.getMediaRoutes.mockImplementation(async op => ({ data: { routes: op === 'segment' ? [{ ...SAM, ready: false }] : [FILL] } }))
    const w = await ready()
    expect(w.find('[data-test="mask-select"]').exists()).toBe(false)
    expect(w.get('[data-test="mask-paint"]').attributes('aria-checked')).toBe('true')
    expect(w.get('[data-test="mask-no-select"]').text()).toContain('paint it instead')
    w.unmount()
  })
})

describe('The mask canvas: clicks, a box and a selection', () => {
  function canvasEnv() {
    const ctx = { putImageData: vi.fn(), getImageData: vi.fn(), drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 })
    HTMLCanvasElement.prototype.toBlob = function (cb, type) { cb(new Blob(['x'], { type })) }
    if (typeof globalThis.ImageData === 'undefined') globalThis.ImageData = class { constructor(data, width, height) { Object.assign(this, { data, width, height }) } }
    return ctx
  }
  async function mounted(props) {
    const w = mount(MaskCanvas, { props: { src: 'blob:img', ...props } })
    const img = w.get('img').element
    Object.defineProperty(img, 'naturalWidth', { value: 20 }); Object.defineProperty(img, 'naturalHeight', { value: 10 })
    await w.get('img').trigger('load')
    return w
  }
  const fire = (w, type, x, y, extra = {}) => w.get('canvas').element.dispatchEvent(Object.assign(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, ...extra }), { pointerId: 1 }))

  it('a click in Select is a point on it, Alt-click and "Not this" are points off it, as fractions of the picture', async () => {
    canvasEnv()
    const w = await mounted({ mode: 'select' })
    fire(w, 'pointerdown', 50, 25)
    fire(w, 'pointerdown', 100, 50, { altKey: true })
    await w.setProps({ mode: 'remove' }); fire(w, 'pointerdown', 200, 100)
    expect(w.emitted('point')).toEqual([[{ x: 0.25, y: 0.25, label: 1 }], [{ x: 0.5, y: 0.5, label: 0 }], [{ x: 1, y: 1, label: 0 }]])
    await w.setProps({ points: [{ x: 0.25, y: 0.25, label: 1 }, { x: 0.5, y: 0.5, label: 0 }] })
    expect(w.findAll('[data-test="mask-point"]').map(p => p.text())).toEqual(['+', '−'])
    expect(await w.vm.toBlob()).toBeNull()                                                   // a point marks nothing yet
    w.unmount(); vi.restoreAllMocks()
  })

  it('a drag in Box is a box; a click is not', async () => {
    canvasEnv()
    const w = await mounted({ mode: 'box' })
    fire(w, 'pointerdown', 20, 10); fire(w, 'pointermove', 120, 60); fire(w, 'pointerup', 180, 90)
    fire(w, 'pointerdown', 50, 50); fire(w, 'pointerup', 50, 50)
    expect(w.emitted('box')).toEqual([[{ x_min: 0.1, y_min: 0.1, x_max: 0.9, y_max: 0.9 }]])
    w.unmount(); vi.restoreAllMocks()
  })

  it("a selection's mask is laid on at the picture's size, refined, undone, and saved as the PNG", async () => {
    canvasEnv()
    const w = await mounted({ mode: 'paint' })
    const half = new Uint8Array(10 * 5); for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) half[y * 10 + x] = 255
    expect(w.vm.setMaskData(half, 10, 5)).toBe(true)                                         // scaled 2x to 20 x 10
    const marked = w.vm.maskData()
    expect([marked[0], marked[9], marked[10], marked[9 * 20 + 9], marked[19]]).toEqual([255, 255, 0, 255, 0])
    expect(w.emitted('change').at(-1)).toEqual([true])
    w.vm.invert()
    expect(w.vm.maskData()[0]).toBe(0)
    w.vm.undo()
    expect(w.vm.maskData()[0]).toBe(255)
    w.vm.grow()
    expect(w.vm.maskData()[11]).toBe(255)                                                    // 2 px wider
    const blob = await w.vm.toBlob()
    expect(blob.type).toBe('image/png')
    w.vm.clear()
    expect(w.emitted('change').at(-1)).toEqual([false])
    expect(await w.vm.toBlob()).toBeNull()
    w.unmount(); vi.restoreAllMocks()
  })

  it('paints and erases with the brush, straight into the mask', async () => {
    canvasEnv()
    const w = await mounted({ mode: 'paint', brush: 4 })                                     // 4 px shown = 0.4 px here
    fire(w, 'pointerdown', 0, 0); fire(w, 'pointermove', 190, 0); fire(w, 'pointerup', 190, 0)
    expect(w.vm.maskData()[0]).toBe(255)
    expect(w.vm.maskData()[18]).toBe(255)
    expect(w.emitted('change').at(-1)).toEqual([true])
    await w.setProps({ mode: 'erase' })
    fire(w, 'pointerdown', 0, 0); fire(w, 'pointermove', 190, 0); fire(w, 'pointerup', 190, 0)
    expect(w.emitted('change').at(-1)).toEqual([false])
    w.unmount(); vi.restoreAllMocks()
  })
})

describe('The mask canvas', () => {
  it("keeps the mask at the image's own size and gives no file until something is painted", async () => {
    const ctx = { fillRect: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), putImageData: vi.fn(), getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(16) })) }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    const w = mount(MaskCanvas, { props: { src: 'blob:img' } })
    const img = w.get('img').element
    Object.defineProperty(img, 'naturalWidth', { value: 1600 }); Object.defineProperty(img, 'naturalHeight', { value: 900 })
    await w.get('img').trigger('load')
    expect(w.emitted('size')).toEqual([[{ width: 1600, height: 900 }]])
    const overlay = w.get('canvas').element
    expect([overlay.width, overlay.height]).toEqual([1600, 900])
    expect(await w.vm.toBlob()).toBeNull()
    w.unmount(); vi.restoreAllMocks()
  })
})

describe('Likeness pages', () => {
  it('a talking avatar from a script sends the photo, the script and its voice', async () => {
    const w = mountIt(CreativeLikeness, { kind: 'avatar' }); await flushPromises()
    setSlot(w, 'Presenter photo', [file('face', 'image')]); await flushPromises()
    await w.get('[data-test="likeness-script"]').setValue('Welcome to the shop.')
    await w.get('[data-test="likeness-voice"]').setValue('voice-9')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob).toHaveBeenCalledExactlyOnceWith({ operation: 'avatar', route_id: '7', request: { prompt: 'Welcome to the shop.', voice_id: 'voice-9' }, references: [{ attachment_id: 'face', role: 'subject' }], conversation_id: 'c1' })
    neverStarted(); w.unmount()
  })
  it("follows the chosen model's needs: motion orientation, a named voice, a lip-sync direction", async () => {
    const route = needs => ({ data: { routes: [{ route_id: 7, name: 'fal model', ready: true, provider: 'fal', model: 'm', needs }] } })
    api.getMediaRoutes.mockResolvedValueOnce(route({ choices: { character_orientation: ['image', 'video'] } }))
    let w = mountIt(CreativeLikeness, { kind: 'motion' }); await flushPromises()
    setSlot(w, 'Character', [file('who', 'image')]); setSlot(w, 'Clip with the movement', [file('dance', 'video')]); await flushPromises()
    expect(w.get('[data-test="likeness-prepare"]').attributes('disabled')).toBeDefined()            // orientation needed
    await w.get('[data-test="orientation-video"]').setValue(true)
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls.at(-1)[0].request).toEqual({ character_orientation: 'video' })
    w.unmount()
    api.getMediaRoutes.mockResolvedValueOnce(route({ prompt: true, choices: { voice: ['Aria', 'Roger'] } }))
    w = mountIt(CreativeLikeness, { kind: 'avatar' }); await flushPromises()
    setSlot(w, 'Presenter photo', [file('face', 'image')]); await flushPromises()
    expect(w.find('[data-test="likeness-voice"]').exists()).toBe(false)                            // a list, not free text
    await w.get('[data-test="likeness-script"]').setValue('Welcome.')
    await w.get('[data-test="likeness-voice-choice"]').setValue('Roger')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls.at(-1)[0].request).toEqual({ prompt: 'Welcome.', voice_id: 'Roger' })
    w.unmount()
    api.getMediaRoutes.mockResolvedValueOnce(route({ prompt: true }))
    w = mountIt(CreativeLikeness, { kind: 'lipsync' }); await flushPromises()
    setSlot(w, 'Footage or photo of the person', [file('clip', 'video')]); setSlot(w, 'Voice track', [file('voice', 'audio')]); await flushPromises()
    await w.get('[data-test="likeness-direction"]').setValue('Speaks calmly.')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls.at(-1)[0].request).toEqual({ prompt: 'Speaks calmly.' })
    w.unmount()
  })
  it('a talking avatar from a voice track sends the photo, the track and a short direction', async () => {
    const w = mountIt(CreativeLikeness, { kind: 'avatar' }); await flushPromises()
    setSlot(w, 'Presenter photo', [file('face', 'image')]); setSlot(w, 'Voice track', [file('take', 'audio')]); await flushPromises()
    expect(w.find('[data-test="likeness-script"]').exists()).toBe(false)
    expect(w.get('[data-test="likeness-prepare"]').attributes('disabled')).toBeDefined()     // the direction is needed
    await w.get('[data-test="likeness-direction"]').setValue('Looks at the camera, calm.')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob).toHaveBeenCalledExactlyOnceWith({ operation: 'avatar', route_id: '7', request: { prompt: 'Looks at the camera, calm.' }, references: [{ attachment_id: 'face', role: 'subject' }, { attachment_id: 'take', role: 'audio' }], conversation_id: 'c1' })
    w.unmount()
  })
  it('lip-sync sends the footage and the voice track, and motion transfer the character and the movement', async () => {
    let w = mountIt(CreativeLikeness, { kind: 'lipsync' }); await flushPromises()
    setSlot(w, 'Footage or photo of the person', [file('clip', 'video')]); setSlot(w, 'Voice track', [file('voice', 'audio')]); await flushPromises()
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls[0][0]).toEqual({ operation: 'lipsync', route_id: '7', request: {}, references: [{ attachment_id: 'clip', role: 'edit_source' }, { attachment_id: 'voice', role: 'audio' }], conversation_id: 'c1' })
    w.unmount()
    w = mountIt(CreativeLikeness, { kind: 'motion' }); await flushPromises()
    setSlot(w, 'Character', [file('who', 'image')]); setSlot(w, 'Clip with the movement', [file('dance', 'video')]); await flushPromises()
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls[1][0]).toEqual({ operation: 'motion', route_id: '7', request: {}, references: [{ attachment_id: 'who', role: 'subject' }, { attachment_id: 'dance', role: 'motion' }], conversation_id: 'c1' })
    neverStarted(); w.unmount()
  })
})

describe('Swap & restyle', () => {
  it("changes the person's own video on a model that edits footage, within that model's reference limit", async () => {
    api.getStudioRoutes.mockResolvedValue({ data: { routes: [{ route_id: 31, name: 'Aleph', connection: 'AADML', inputs: { spec: { images: 1, summary: 'Edits your video; up to 1 reference image' } } }] } })
    api.prepareVideoJob.mockResolvedValue({ data: job })
    const w = mountIt(CreativeSwap); await flushPromises()
    expect(api.getStudioRoutes).toHaveBeenCalledWith('edit_uploaded')
    expect(api.getStudioRoutes).toHaveBeenCalledWith('edit_generated')
    expect(w.findAll('[data-test="swap-route"] option')).toHaveLength(1)     // the same model from both answers, once
    expect(w.get('[data-test="swap-reference-summary"]').text()).toBe('Edits your video; up to 1 reference image')
    setSlot(w, 'Your video', [file('ad', 'video')]); setSlot(w, 'What to put in', [file('bottle', 'image')]); await flushPromises()
    await w.get('[data-test="swap-prompt"]').setValue('Replace the red bottle with this one')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareVideoJob).toHaveBeenCalledExactlyOnceWith({ operation: 'change', route_id: '31', base_attachment_id: 'ad', prompt: 'Replace the red bottle with this one', references: [{ attachment_id: 'bottle', role: 'subject' }], conversation_id: 'c1' })
    neverStarted(); w.unmount()
  })
  it('lists a model proven only on Studio results, since a Library clip made here is one', async () => {
    // Live 2026-10-28: Seedance 2.0 Mini edits Studio results only, and the page asked for uploads alone: "No model".
    api.getStudioRoutes.mockImplementation(task => Promise.resolve({ data: { routes: task === 'edit_generated'
      ? [{ route_id: 70, name: 'Seedance 2.0 Mini', connection: 'sajid openrouter', inputs: { spec: {} } }] : [] } }))
    const w = mountIt(CreativeSwap); await flushPromises()
    expect(w.findAll('[data-test="swap-route"] option').map(o => o.text())).toEqual(['Seedance 2.0 Mini · sajid openrouter'])
    w.unmount()
  })
})

describe('Characters and identity training', () => {
  it('asks for portraits from the chosen traits only', async () => {
    api.getCharacterTraits.mockResolvedValue({ data: { traits: { style: ['photorealistic', 'anime'], age: ['adult'] }, details_max: 300 } })
    api.prepareCharacterPortraits.mockResolvedValue({ data: job })
    const w = mountIt(CreativeCharacters); await flushPromises()
    await w.get('select').setValue('anime')
    await w.get('[data-test="character-step-portraits"]').trigger('click'); await flushPromises()
    await w.get('[data-test="character-portraits"]').trigger('click'); await flushPromises()
    expect(api.prepareCharacterPortraits).toHaveBeenCalledExactlyOnceWith({ route_id: '7', traits: { style: 'anime' }, n: 4, conversation_id: 'c1' })
    expect(w.emitted('job')).toEqual([[job]]); w.unmount()
  })
  it('trains only a character with four images and a valid trigger word', async () => {
    api.getIdentities.mockResolvedValue({ data: { identities: [] } })
    api.getStudioElements.mockResolvedValue({ data: { ingredients: [{ ingredient_id: 'ch1', kind: 'character', name: 'Mara', files: [1, 2, 3, 4].map(i => ({ attachment_id: `f${i}` })) }, { ingredient_id: 'p1', kind: 'product', name: 'Mug', files: [] }] } })
    api.trainIdentity.mockResolvedValue({ data: { identity_id: 'i1', job } })
    const w = mountIt(CreativeIdentity); await flushPromises()
    expect(w.findAll('[data-test="identity-character"] option').map(o => o.text())).toEqual(['Choose a character', 'Mara (4 images)'])
    await w.get('[data-test="identity-character"]').setValue('ch1')
    await w.get('[data-test="identity-trigger"]').setValue('9bad')
    expect(w.get('[data-test="identity-train"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="identity-trigger"]').setValue('mara_keeper')
    await w.get('[data-test="identity-train"]').trigger('click'); await flushPromises()
    expect(api.trainIdentity).toHaveBeenCalledExactlyOnceWith({ character_id: 'ch1', route_id: '7', trigger_word: 'mara_keeper', conversation_id: 'c1' })
    expect(w.emitted('job')).toEqual([[job]]); w.unmount()
  })
})

describe('Effects recipes', () => {
  it('a video edit recipe runs on a model the person chooses, at the size chosen, the smallest first', async () => {
    // Live 2026-10-28: Ad remix had no model choice; the Studio default (Kling 3.0 Pro) cannot edit an upload.
    api.getStudioRecipes.mockResolvedValue({ data: { recipes: [{ id: 'remix-style', title: 'New look', operation: 'change', task: 'edit_uploaded', ready: true, slots: [{ name: 'video', role: 'edit_source', media_type: 'video', required: true }], options: { style: ['a retro film look'] } }] } })
    const edit = { route_id: 76, name: 'FLUX Video Edit', connection: 'sajid openrouter', schema: { properties: { resolution: { enum: ['720p', '1080p'] } } } }
    api.getStudioRoutes.mockImplementation(task => Promise.resolve({ data: { routes: task === 'edit_generated' ? [edit, { route_id: 70, name: 'Seedance 2.0 Mini', connection: 'sajid openrouter' }] : [edit] } }))
    api.runStudioRecipe.mockResolvedValue({ data: job })
    const w = mountIt(CreativeMarketing, { kind: 'ad-remix' }); await flushPromises()
    await w.get('select').setValue('remix-style'); await w.get('select').trigger('change'); await flushPromises()
    expect(api.getStudioRoutes).toHaveBeenCalledWith('edit_uploaded'); expect(api.getStudioRoutes).toHaveBeenCalledWith('edit_generated')
    expect(w.findAll('[data-test="recipe-video-route"] option').map(o => o.text())).toEqual(['FLUX Video Edit · sajid openrouter', 'Seedance 2.0 Mini · sajid openrouter'])
    expect(w.get('[data-test="recipe-resolution"]').element.value).toBe('720p')
    w.findAllComponents({ name: 'InputSlot' }).find(s => s.props('label') === 'Your video').vm.$emit('pick', [{ attachment_id: 'ad' }]); await flushPromises()
    await w.findAll('button').find(b => b.text() === 'Review recipe estimate').trigger('click'); await flushPromises()
    expect(api.runStudioRecipe).toHaveBeenCalledExactlyOnceWith('remix-style', { route_id: '76', params: { resolution: '720p' }, slots: { video: 'ad' }, options: { style: 'a retro film look' }, conversation_id: 'c1', studio_context: { page: 'ad-remix', preset: '', preset_title: '' } })
    w.unmount()
  })
  it('an image recipe runs on the chosen proven image model', async () => {
    api.getStudioRecipes.mockResolvedValue({ data: { recipes: [{ id: 'relight', title: 'Relight', operation: 'edit_image', ready: true, slots: [{ name: 'image', role: 'edit_source', media_type: 'image', required: true }], options: { light: ['golden hour'] } }] } })
    api.runStudioRecipe.mockResolvedValue({ data: job })
    const w = mountIt(CreativeMarketing, { kind: 'effects' }); await flushPromises()
    await w.get('select').setValue('relight'); await flushPromises()
    expect(w.findAll('label').map(l => l.text())).toContain('Lightgolden hour')            // "light" said as "Light"
    w.findAllComponents({ name: 'InputSlot' }).find(s => s.props('label') === 'Photo').vm.$emit('pick', [{ attachment_id: 'photo' }]); await flushPromises()
    await w.findAll('button').find(b => b.text() === 'Review recipe estimate').trigger('click'); await flushPromises()
    expect(api.runStudioRecipe).toHaveBeenCalledExactlyOnceWith('relight', { route_id: '7', slots: { image: 'photo' }, options: { light: 'golden hour' }, conversation_id: 'c1', studio_context: { page: 'effects', preset: '', preset_title: '' } })
    w.unmount()
  })
})
