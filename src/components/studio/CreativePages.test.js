// @vitest-environment jsdom
// The nine pages that were "Coming soon" (CREATIVE_SUITE_PAGES_2_CODEX_BRIEF.md): each sends exactly its request,
// shows the consent step when the backend asks for it and retries the same request, and never starts a job.
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
const chat = vi.hoisted(() => ({ value: null }))
const video = vi.hoisted(() => ({ value: null }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => chat.value }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => video.value }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../../services/api', () => ({ default: Object.fromEntries(['getMediaRoutes','prepareMediaJob','getMediaVoices','recordLikenessConsent','getStudioRoutes','prepareVideoJob','getCharacterTraits','prepareCharacterPortraits','prepareCharacterSheet','saveCharacter','getIdentities','getStudioElements','trainIdentity','deleteIdentity','prepareIdentityImages','uploadConversationFile','getStudioRecipes','runStudioRecipe','get','post'].map(name => [name, vi.fn()])) }))
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
  video.value = reactive({ project: null })
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

describe('Files from the Library', () => {
  it("links a file from another chat to the session's project, unpinned, and sends that project with the job", async () => {
    api.get.mockResolvedValue({ data: { project: null } })
    api.post.mockImplementation(async (url, body) => url === '/video/projects/'
      ? { data: { project_id: 'p1', title: body.title } } : { data: { project_id: 'p1', assets: [] } })
    const w = mountIt(CreativeImageEdit); await flushPromises()
    w.findAllComponents({ name: 'InputSlot' }).find(s => s.props('label') === 'Image to edit').vm.$emit('pick', [{ attachment_id: 'lib1', title: 'shoe.png', media_type: 'image', url: 'https://x/shoe.png' }])
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/video/projects/', { params: { conversation_id: 'c1' } })
    expect(api.post).toHaveBeenCalledWith('/video/projects/', { conversation_id: 'c1', title: 'Image to edit session' })
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
  it("shows a model's refusal of the mask as it comes", async () => {
    api.prepareMediaJob.mockRejectedValue({ response: { data: { error: { code: 'unsupported_input', field: 'references', message: 'This model takes no mask: describe the change in words.' } } } })
    const w = mountIt(CreativeImageEdit); await flushPromises()
    setSlot(w, 'Image to edit', [file('img', 'image')]); await w.get('[data-test="edit-prompt"]').setValue('Change it')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(w.text()).toContain('This model takes no mask: describe the change in words.'); expect(w.emitted('job')).toBeUndefined(); w.unmount()
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
    expect(w.get('[data-test="swap-reference-summary"]').text()).toBe('Edits your video; up to 1 reference image')
    setSlot(w, 'Your video', [file('ad', 'video')]); setSlot(w, 'What to put in', [file('bottle', 'image')]); await flushPromises()
    await w.get('[data-test="swap-prompt"]').setValue('Replace the red bottle with this one')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareVideoJob).toHaveBeenCalledExactlyOnceWith({ operation: 'change', route_id: '31', base_attachment_id: 'ad', prompt: 'Replace the red bottle with this one', references: [{ attachment_id: 'bottle', role: 'subject' }], conversation_id: 'c1' })
    neverStarted(); w.unmount()
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
  it('an image recipe runs on the chosen proven image model', async () => {
    api.getStudioRecipes.mockResolvedValue({ data: { recipes: [{ id: 'relight', title: 'Relight', operation: 'edit_image', ready: true, slots: [{ name: 'image', role: 'edit_source', media_type: 'image', required: true }], options: { light: ['golden hour'] } }] } })
    api.runStudioRecipe.mockResolvedValue({ data: job })
    const w = mountIt(CreativeMarketing, { kind: 'effects' }); await flushPromises()
    await w.get('select').setValue('relight'); await flushPromises()
    w.findAllComponents({ name: 'InputSlot' }).find(s => s.props('label') === 'image').vm.$emit('pick', [{ attachment_id: 'photo' }]); await flushPromises()
    await w.findAll('button').find(b => b.text() === 'Review recipe estimate').trigger('click'); await flushPromises()
    expect(api.runStudioRecipe).toHaveBeenCalledExactlyOnceWith('relight', { route_id: '7', slots: { image: 'photo' }, options: { light: 'golden hour' } })
    w.unmount()
  })
})
