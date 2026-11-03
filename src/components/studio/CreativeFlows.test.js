// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useVideoStore } from '../../stores/useVideoStore'
import Board from './CreativeBoard.vue'
import Marketing from './CreativeMarketing.vue'
import Narrative from './CreativeNarrative.vue'
import InputSlot from './InputSlot.vue'
import api from '../../services/api'
import { useChatStore } from '../../stores/useChatStore'
const routeQuery = vi.hoisted(() => ({ project_id: 'p' }))
vi.mock('vue-router',()=>({useRoute:()=>({query:routeQuery}),useRouter:()=>({push:vi.fn()})}))
vi.mock('../../services/api',()=>({default:{get:vi.fn(),post:vi.fn(),patch:vi.fn(),put:vi.fn(),getStoryboard:vi.fn(),getCinemaControls:vi.fn(),getMediaRoutes:vi.fn(),getStudioRecipes:vi.fn(),runStudioRecipe:vi.fn(),getMediaVoices:vi.fn(),getStudioQuote:vi.fn()}}))
vi.mock('../../composables/useNotify',()=>({notify:{error:vi.fn(),success:vi.fn(),warning:vi.fn()}}))
// The page's Studio session has its chat open (useStudioSession), so each request goes into that chat.
const setup = (component,kind) => { const pinia = createPinia(); setActivePinia(pinia); useChatStore(pinia).conversationId = 'c1'; return mount(component,{props:{kind},global:{plugins:[pinia],stubs:{InputSlot:true,RouterLink:true}}}) }
const inChat = page => ({ conversation_id: 'c1', studio_context: { page, preset: '', preset_title: '' } })
const click = async (w,text) => { await w.findAll('button').find(b=>b.text()===text).trigger('click'); await flushPromises() }
describe('Creative flow boundaries',()=>{
  beforeEach(()=>{
    vi.clearAllMocks()
    api.getCinemaControls.mockResolvedValue({data:{controls:[]}})
    api.getMediaRoutes.mockResolvedValue({data:{routes:[]}})
    api.getStoryboard.mockResolvedValue({data:{revision:4,scenes:[{scene_id:'s',order:0,title:'Scene',intent:'A tree',cinema:{},keyframes:[{attachment_id:'frame',url:'/frame'}],takes:[],next_step:'keyframe'}]}})
    api.get.mockImplementation(async path=>({data:path==='/video/projects/'?{projects:[{project_id:'p',title:'Project'}]}:path==='/video/projects/p/'?{project_id:'p',revision:4,scenes:[{scene_id:'s',intent:'A tree'}],timeline:{revision_id:7,edl:{tracks:[{kind:'video',clips:[{attachment_id:'v'}]}]}}}:path==='/video/ads/options/'?{platforms:[],goals:[]}:path==='/video/brands/'?{brands:[]}:path==='/video/ingredients/'?{ingredients:[]}:path==='/video/explainers/p/'?{scenes:[]}:{} }))
  })
  it('exports the immutable saved timeline revision',async()=>{
    api.post.mockResolvedValue({data:{job_id:'export',operation:'export',state:'queued'}})
    const w=setup(Board,'editor'); await flushPromises(); await click(w,'Export saved timeline')
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/jobs/',{operation:'export',project_id:'p',params:{timeline_revision_id:7},...inChat('editor')})
    expect(w.emitted('job')[0][0].job_id).toBe('export'); w.unmount()
  })
  it('shows the current storyboard on a conflicting keyframe choice without retrying',async()=>{
    api.post.mockRejectedValue({response:{status:409,data:{storyboard:{revision:5,scenes:[{scene_id:'new',title:'Current server scene',cinema:{},takes:[],keyframes:[]}]}}}})
    const w=setup(Board,'storyboard'); await flushPromises(); await w.get('img').element.parentElement.click(); await flushPromises()
    expect(w.text()).toContain('Someone changed this project'); expect(w.text()).toContain('Current server scene'); expect(api.post).toHaveBeenCalledTimes(1); w.unmount()
  })
  it('reads a brand into an editable draft without saving it',async()=>{
    api.post.mockResolvedValue({data:{name:'Draft brand',website:'https://example.com',colors:['#fff'],images:[]}})
    const w=setup(Marketing,'ads'); await flushPromises(); await w.get('input[type="url"]').setValue('https://example.com'); await click(w,'Read website')
    expect(w.text()).toContain('Review this draft'); expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/brands/read/',{url:'https://example.com',...inChat('ads')}); w.unmount()
  })
  it('emits a separate approval proposal for every narration scene',async()=>{
    api.getMediaRoutes.mockResolvedValue({data:{routes:[{route_id:'r',name:'Speech',ready:true}]}})
    api.getMediaVoices.mockResolvedValue({data:{listed:true,voices:[{voice_id:'v',name:'Voice'}]}})
    api.get.mockImplementation(async ()=>({data:{scenes:[]}}))
    api.post.mockResolvedValue({data:{jobs:[{job_id:'one',state:'awaiting_authorization'},{job_id:'two',state:'awaiting_authorization'}]}})
    const w=setup(Narrative,'explainer'); await flushPromises()
    // The model is chosen for the person while the page's first load runs, and its voices still come (live 2026-10-29).
    expect(w.get('[data-test="media-route"]').element.value).toBe('r'); expect(api.getMediaVoices).toHaveBeenCalledWith(expect.objectContaining({route_id:'r'})); await w.get('input[type="radio"][value="v"]').setValue(true); await click(w,'Review narration estimates')
    expect(w.emitted('job').map(row=>row[0].job_id)).toEqual(['one','two']); expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/explainers/p/narrate/',{route_id:'r',voice_id:'v'}); w.unmount()
  })
  it('offers and sends exactly the seven supported overlay positions', async () => {
    api.post.mockResolvedValue({ data: { revision_id: 8 } })
    const w = setup(Board, 'editor'); await flushPromises()
    w.findAllComponents(InputSlot).find(slot => slot.props('label') === 'Image overlays').vm.$emit('pick', [{ attachment_id: 'logo' }])
    await flushPromises()
    const position = w.findAll('label').find(label => label.text().startsWith('Position')).get('select')
    const positions = ['top-left','top','top-right','center','bottom-left','bottom','bottom-right']
    expect(position.findAll('option').map(option => option.element.value)).toEqual(positions)
    for (const value of positions) {
      await position.setValue(value); await click(w, 'Save timeline')
      const edl = api.post.mock.calls.at(-1)[1].edl
      expect(edl.tracks.find(track => track.kind === 'overlay').items[0]).toEqual({ attachment_id: 'logo', position: value, scale: 0.18 })
    }
    w.unmount()
  })
  it('does not show a pending notice for an empty job list and numbers scenes from one', async () => {
    api.getStoryboard.mockResolvedValue({ data: { revision: 4, scenes: [{ scene_id: 's', order: 0, title: 'Scene 1', cinema: {}, keyframes: [], takes: [], keyframe_jobs_pending: [] }] } })
    const w = setup(Board, 'storyboard'); await flushPromises()
    expect(w.text()).not.toContain('Keyframes pending')
    expect(w.get('h2').text()).toBe('1. Scene 1')
    api.getStoryboard.mockResolvedValue({ data: { revision: 4, scenes: [{ scene_id: 's', order: 0, title: 'Scene 1', cinema: {}, keyframes: [], takes: [], keyframe_jobs_pending: ['job'] }] } })
    await click(w, 'Refresh storyboard'); expect(w.text()).toContain('Keyframes pending'); w.unmount()
  })
  it('omits cleared numeric values from every timeline record while preserving zero and false', async () => {
    const get = api.get.getMockImplementation()
    api.get.mockImplementation(path => path !== '/video/projects/p/' ? get(path) : Promise.resolve({ data: {
      project_id: 'p', scenes: [], timeline: { revision_id: 7, edl: { tracks: [
        { kind: 'video', clips: [{ attachment_id: 'v', in_ms: 1, out_ms: 2000, hold_ms: 0, empty: null, transition: { kind: 'crossfade', ms: 500 } }] },
        { kind: 'audio', clips: [{ attachment_id: 'a', start_ms: 0, in_ms: 1, out_ms: 2000, gain_db: 0, duck: false, mute_original: false }] },
        { kind: 'overlay', items: [{ attachment_id: 'logo', position: 'top', scale: 0.18, start_ms: 1, end_ms: 2000 }] },
        { kind: 'text', cues: [{ text: 'Caption', start_ms: 1, end_ms: 2000 }] },
      ] } },
    } }))
    api.post.mockResolvedValue({ data: { revision_id: 8 } })
    const w = setup(Board, 'editor'); await flushPromises()
    for (const input of w.findAll('input[type="number"]')) await input.setValue('')
    await click(w, 'Save timeline')
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/projects/p/timeline/', { edl: { tracks: [
      { kind: 'video', clips: [{ attachment_id: 'v', hold_ms: 0, transition: { kind: 'crossfade' } }] },
      { kind: 'audio', clips: [{ attachment_id: 'a', duck: false, mute_original: false }] },
      { kind: 'overlay', items: [{ attachment_id: 'logo', position: 'top' }] },
      { kind: 'text', cues: [{ text: 'Caption' }], position: 'bottom' },
    ] } })
    w.unmount()
  })
  it('sends the selected product ingredient id when developing concepts', async () => {
    const get = api.get.getMockImplementation()
    api.get.mockImplementation(path => path === '/video/ingredients/' ? Promise.resolve({ data: { ingredients: [{ ingredient_id: 'product-1', name: 'Product', kind: 'product' }] } })
      : path === '/video/brands/' ? Promise.resolve({ data: { brands: [{ brand_id: 'b', name: 'Brand' }] } })
      : path === '/video/ads/options/' ? Promise.resolve({ data: { platforms: [{ id: 'social', label: 'Social' }], goals: ['awareness'] } }) : get(path))
    api.post.mockResolvedValue({ data: { concepts: [] } })
    const w = setup(Marketing, 'ads'); await flushPromises()
    await w.get('[data-field="brand_id"] select').setValue('b')
    await w.get('[data-field="product_id"] select').setValue('product-1')
    await click(w, 'Develop concepts')
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/ads/concepts/', { brand_id: 'b', platform: 'social', product_id: 'product-1', goal: 'awareness', notes: '', n: 3, ...inChat('ads') })
    w.unmount()
  })
  it('saves a new brand with a Library image as its first logo attachment', async () => {
    api.post.mockResolvedValue({ data: { brand_id: 'saved', name: 'New brand' } })
    const w = setup(Marketing, 'ads'); await flushPromises(); await click(w, 'New brand')
    // The fields are named in words, and a disabled Save says what it still needs (live 2026-10-28: raw "name",
    // "voice", and a Save that stayed disabled without a word).
    expect(w.findAll('label').map(label => label.text())).toEqual(expect.arrayContaining(['Name', 'How the brand speaks', 'Who it is for']))
    await w.findAll('label').find(label => label.text() === 'Name').get('textarea').setValue('New brand')
    const save = w.findAll('button').find(button => button.text() === 'Save reviewed brand')
    expect(save.attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="brand-save-needs"]').text()).toBe('Add at least one brand image, the logo first to save it.')
    const images = w.findComponent(InputSlot)
    expect(images.props()).toMatchObject({ kinds: ['image'], limit: 8, allowUpload: false })
    images.vm.$emit('pick', [{ attachment_id: 'logo' }]); await flushPromises()
    expect(save.attributes('disabled')).toBeUndefined()
    expect(w.find('[data-test="brand-save-needs"]').exists()).toBe(false)
    await click(w, 'Save reviewed brand')
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/brands/', { name: 'New brand', description: '', traits: { colors: [], website: '', tagline: '', voice: '', audience: '' }, attachment_ids: ['logo'] })
    w.unmount()
  })
  it('numbers explainer scenes from one', async () => {
    const get = api.get.getMockImplementation()
    api.get.mockImplementation(path => path === '/video/explainers/p/' ? Promise.resolve({ data: { scenes: [{ scene_id: 's', order: 0, narration: 'Hello' }] } }) : get(path))
    const w = setup(Narrative, 'explainer'); await flushPromises()
    expect(w.get('h2').text()).toBe('Scene 1'); w.unmount()
  })
})

// Live 2026-10-28: Storyboard listed video models as keyframe models after Create project, sent its scene video with
// no model ("Choose a video model first"), showed a finished keyframe only after Refresh; Cinema had no length or size.
describe('Storyboard and Cinema make a video on the model, length and size chosen', () => {
  const video = { route_id: 89, name: 'Kling 3.0 Pro', connection: 'sajid openrouter', schema: { properties: { duration: { enum: [5, 10], default: 5 }, resolution: { enum: ['480p', '720p'] } } } }
  let pinia
  const mountBoard = kind => { pinia = createPinia(); setActivePinia(pinia); useChatStore(pinia).conversationId = 'c1'; return mount(Board, { props: { kind }, global: { plugins: [pinia], stubs: { InputSlot: true, RouterLink: true } } }) }
  beforeEach(() => {
    vi.clearAllMocks(); routeQuery.project_id = 'p'
    api.getCinemaControls.mockResolvedValue({ data: { controls: [] } })
    api.getMediaRoutes.mockResolvedValue({ data: { routes: [{ route_id: 290, name: 'Nano Banana', connection: 'sajid openrouter', ready: true }, { route_id: 360, name: 'Nano Banana', connection: 'waqar openrouter', ready: true }] } })
    api.getStoryboard.mockResolvedValue({ data: { revision: 4, scenes: [{ scene_id: 's', order: 0, title: 'Scene', intent: 'A bottle', cinema: {}, keyframes: [], takes: [], next_step: 'render' }] } })
    api.get.mockImplementation(async (path, opts) => ({ data: path === '/video/projects/' ? { projects: [{ project_id: 'p', title: 'Project' }] } : path === '/video/projects/p/' ? { project_id: 'p', revision: 4, scenes: [] } : path === '/video/routes/' ? { routes: opts?.params?.task === 'image_to_video' || opts?.params?.task === 'text_to_video' ? [video] : [] } : {} }))
  })
  afterEach(() => { routeQuery.project_id = 'p' })
  it('a scene video is made on the scene video model, at the chosen length and the cheapest size by default', async () => {
    api.post.mockResolvedValue({ data: { job_id: 'take', state: 'awaiting_authorization' } })
    const w = mountBoard('storyboard'); await flushPromises()
    expect(w.findAll('[data-test="board-route"] option').map(o => o.text())).toEqual(['Choose model', 'Nano Banana · sajid openrouter', 'Nano Banana · waqar openrouter'])
    expect(api.get).toHaveBeenCalledWith('/video/routes/', { params: { task: 'image_to_video' } })
    // The cheapest proven model is chosen in both menus (UX pass, live 2026-10-29).
    expect(w.get('[data-test="board-route"]').element.value).toBe('290')
    expect(w.get('[data-test="board-video-route"]').element.value).toBe('89')
    expect(w.text()).not.toContain('Choose the scene video model first.')
    expect(w.get('[data-test="board-resolution"]').element.value).toBe('480p')
    await w.get('[data-test="board-duration"]').setValue('10')
    await click(w, 'Review scene estimate')
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/jobs/', { project_id: 'p', scene_id: 's', operation: 'generate', route_id: 89, prompt: 'A bottle', params: { duration: 10, resolution: '480p' }, ...inChat('storyboard') })
    w.unmount()
  })
  it('a finished keyframe or take is shown without a refresh', async () => {
    api.post.mockResolvedValue({ data: { job_id: 'k1', state: 'awaiting_authorization' } })
    const w = mountBoard('storyboard'); await flushPromises()
    await w.get('[data-test="board-route"]').setValue('290')
    await click(w, 'Review keyframe estimate')
    const reads = api.getStoryboard.mock.calls.length
    useVideoStore(pinia)._put({ job_id: 'k1', state: 'running' }); await flushPromises()
    expect(api.getStoryboard.mock.calls.length).toBe(reads)
    useVideoStore(pinia)._put({ job_id: 'k1', state: 'ready' }); await flushPromises()
    expect(api.getStoryboard.mock.calls.length).toBe(reads + 1)
    w.unmount()
  })
  it('a new project reads the keyframe models at once', async () => {
    delete routeQuery.project_id
    api.post.mockResolvedValue({ data: { project_id: 'p', title: 'New' } })
    const w = mountBoard('storyboard'); await flushPromises()
    expect(api.getMediaRoutes).not.toHaveBeenCalled()
    await w.get('input').setValue('New'); await click(w, 'Create project')
    expect(api.getMediaRoutes).toHaveBeenCalledWith('image')
    expect(w.findAll('[data-test="board-route"] option').map(o => o.text())).toContain('Nano Banana · sajid openrouter')
    w.unmount()
  })
  it('a project chosen while the page is still loading is opened, and the late answer does not undo it', async () => {
    // Live 2026-10-28: the choice was dropped while the first model list was loading; the keyframe list then held
    // video models and the scene video list was empty.
    delete routeQuery.project_id
    let lateAnswer
    const base = api.get.getMockImplementation()
    api.get.mockImplementation((path, opts) => opts?.params?.task === 'text_to_video' ? new Promise(resolve => { lateAnswer = resolve }) : base(path, opts))
    const w = mountBoard('storyboard'); await flushPromises()
    await w.get('select').setValue('p'); await flushPromises()
    lateAnswer({ data: { routes: [{ ...video, route_id: 1, name: 'Late text-to-video' }] } }); await flushPromises()
    expect(w.findAll('[data-test="board-route"] option').map(o => o.text())).toEqual(['Choose model', 'Nano Banana · sajid openrouter', 'Nano Banana · waqar openrouter'])
    expect(w.findAll('[data-test="board-video-route"] option').map(o => o.text())).toEqual(['Choose model', 'Kling 3.0 Pro · sajid openrouter'])
    w.unmount()
  })
  it('opens the project the agent made in this chat once its turn ends', async () => {
    // Live 2026-10-28: the agent created the storyboard and the Workspace still said "Choose project".
    delete routeQuery.project_id
    const w = mountBoard('storyboard'); await flushPromises()
    const { useChatStore } = await import('../../stores/useChatStore')
    const chat = useChatStore(pinia)
    chat.conversationId = 'c9'
    const base = api.get.getMockImplementation()
    api.get.mockImplementation((path, opts) => path === '/video/projects/' && opts?.params?.conversation_id === 'c9'
      ? Promise.resolve({ data: { project: { project_id: 'p', title: 'Agent ad' } } }) : base(path, opts))
    chat.isStreaming = true; await flushPromises(); chat.isStreaming = false; await flushPromises()
    expect(w.get('select').element.value).toBe('p')
    expect(api.getStoryboard).toHaveBeenCalledWith('p')
    w.unmount()
  })
  it('reopens the chat\'s project when the page is loaded again, but not a page\'s empty session project', async () => {
    // Live 2026-10-29: after a reload the menu said "Choose project" although the chat had one open.
    delete routeQuery.project_id
    pinia = createPinia(); setActivePinia(pinia)
    const { useChatStore } = await import('../../stores/useChatStore')
    useChatStore(pinia).conversationId = 'c9'
    const base = api.get.getMockImplementation()
    let open = { project_id: 'p', title: 'Agent ad', scenes: [{ scene_id: 's' }] }
    api.get.mockImplementation((path, opts) => path === '/video/projects/' && opts?.params?.conversation_id === 'c9'
      ? Promise.resolve({ data: { project: open } }) : base(path, opts))
    const mountHere = () => mount(Board, { props: { kind: 'storyboard' }, global: { plugins: [pinia], stubs: { InputSlot: true, RouterLink: true } } })
    let w = mountHere(); await flushPromises()
    expect(w.get('select').element.value).toBe('p')
    expect(api.getStoryboard).toHaveBeenCalledWith('p')
    w.unmount(); api.getStoryboard.mockClear()
    open = { project_id: 'sess', title: 'Enhance session', brief: { session: true }, scenes: [] }
    w = mountHere(); await flushPromises()
    expect(w.get('select').element.value).toBe('')
    expect(api.getStoryboard).not.toHaveBeenCalled()
    w.unmount()
  })
  it('a standalone Cinema shot is quoted at the length and size chosen', async () => {
    delete routeQuery.project_id
    api.post.mockResolvedValue({ data: { job_id: 'shot' } })
    const w = mountBoard('cinema'); await flushPromises()
    await w.get('[data-test="board-route"]').setValue('89'); await flushPromises()
    await w.get('textarea').setValue('A bottle of oil')
    expect(w.get('[data-test="board-resolution"]').element.value).toBe('480p')
    await click(w, 'Review shot estimate')
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/jobs/', { operation: 'generate', route_id: 89, prompt: 'A bottle of oil', cinema: {}, params: { duration: 5, resolution: '480p' }, ...inChat('cinema') })
    w.unmount()
  })
})

// Manual pages keep their chat (a Manual page sends no chat message): the requests that make something carry the open
// chat and the page, with the preset chosen there. Errors land at their field; a 429 says when to try again.
describe('Manual Storyboard, Marketing and Explainer keep their chat', () => {
  const mountIn = (component, kind, provide = {}) => { const pinia = createPinia(); setActivePinia(pinia); useChatStore(pinia).conversationId = 'c1'; return mount(component, { props: { kind }, global: { plugins: [pinia], provide, stubs: { InputSlot: true, RouterLink: true } } }) }
  beforeEach(() => {
    vi.clearAllMocks(); delete routeQuery.project_id
    api.getCinemaControls.mockResolvedValue({ data: { controls: [] } })
    api.getMediaRoutes.mockResolvedValue({ data: { routes: [{ route_id: 'r', name: 'Speech', ready: true }] } })
    api.get.mockImplementation(async (path, opts) => ({ data: path === '/video/projects/' ? { projects: [] } : path === '/video/routes/' ? { routes: [{ route_id: 89, name: 'Kling', ready: true }] } : path === '/video/ads/options/' ? { platforms: [{ id: 'social', label: 'Social' }], goals: ['awareness'] } : path === '/video/brands/' ? { brands: [{ brand_id: 'b', name: 'Brand' }] } : path === '/video/ingredients/' ? { ingredients: [] } : path === '/video/explainers/p/' ? { scenes: [] } : {} }))
  })
  afterEach(() => { routeQuery.project_id = 'p' })
  it('sends the preset chosen on the page with the request', async () => {
    api.post.mockResolvedValue({ data: { concepts: [] } })
    const look = { value: { id: 'ads-launch', title: 'Product launch' } }
    const w = mountIn(Marketing, 'ads', { studioPreparedLook: look }); await flushPromises()
    await w.get('[data-field="brand_id"] select').setValue('b'); await click(w, 'Develop concepts')
    expect(api.post.mock.calls[0][1]).toMatchObject({ conversation_id: 'c1', studio_context: { page: 'ads', preset: 'ads-launch', preset_title: 'Product launch' } })
    w.unmount()
  })
  it('the explainer plan carries the chat; a provider with no voice list takes a typed Voice ID', async () => {
    api.getMediaVoices.mockResolvedValue({ data: { listed: false, voices: [] } })
    api.post.mockImplementation(async path => ({ data: path === '/video/explainers/' ? { project_id: 'p' } : { jobs: [{ job_id: 'n1' }] } }))
    const w = mountIn(Narrative, 'explainer'); await flushPromises()
    await w.get('[data-field="topic"] textarea').setValue('Why the sky is blue'); await click(w, 'Plan explainer')
    expect(api.post).toHaveBeenCalledWith('/video/explainers/', { topic: 'Why the sky is blue', title: '', audience: '', max_seconds: 90, aspect_ratio: '16:9', conversation_id: 'c1', studio_context: { page: 'explainer', preset: '', preset_title: '' } })
    await w.get('[data-test="voice-id"]').setValue('  voice-123 '); await click(w, 'Review narration estimates')
    expect(api.post).toHaveBeenLastCalledWith('/video/explainers/p/narrate/', { route_id: 'r', voice_id: 'voice-123' })
    w.unmount()
  })
  it('the shorts transcript carries the chat; moments and the short follow it', async () => {
    api.post.mockResolvedValue({ data: { job_id: 't1' } })
    const w = mountIn(Narrative, 'shorts'); await flushPromises()
    w.findComponent(InputSlot).vm.$emit('pick', [{ attachment_id: 'clip' }]); await flushPromises()
    await click(w, 'Review transcription estimate')
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/shorts/transcribe/', { attachment_id: 'clip', route_id: 'r', language: '', conversation_id: 'c1', studio_context: { page: 'shorts', preset: '', preset_title: '' } })
    w.unmount()
  })
  it('a model error is shown at the model menu; another field as a general message; a 429 says when to try again', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 400, data: { error: { code: 'not_verified', field: 'route_id', message: "This model's billing is still being checked." } } } })
    const w = mountIn(Narrative, 'shorts'); await flushPromises()
    w.findComponent(InputSlot).vm.$emit('pick', [{ attachment_id: 'clip' }]); await flushPromises()
    await click(w, 'Review transcription estimate'); await flushPromises()
    expect(w.get('.mrp[data-field="route_id"] .st-error').text()).toBe("This model's billing is still being checked.")
    api.post.mockRejectedValueOnce({ response: { status: 429, data: { error: { code: 'rate_limited', field: 'request', message: 'Too many requests.', retry_after: 30 } } } })
    await click(w, 'Review transcription estimate'); await flushPromises()
    const general = w.findAll('p.st-error').map(p => p.text())
    expect(general).toContain('Too many requests. Try again in 30 seconds.')
    w.unmount()
  })
  it('a Cinema shot whose model must change a setting waits for the person to accept it, then sends the acceptance', async () => {
    vi.useFakeTimers()
    try {
      api.getStudioQuote.mockResolvedValue({ data: { estimate_usd: '0.50', max_usd: '0.50', pricing_status: 'exact', reason: '', lines: [], adjustments: [{ field: 'duration', requested: 7, proposed: 5, reason: 'Kling renders 5, 10 s' }], needs_acceptance: true } })
      api.post.mockResolvedValue({ data: { job_id: 'shot' } })
      const w = mountIn(Board, 'cinema'); await flushPromises()
      await w.get('[data-test="board-route"]').setValue('89'); await w.get('[data-field="prompt"] textarea').setValue('A bottle')
      await vi.advanceTimersByTimeAsync(800); await flushPromises()
      expect(api.getStudioQuote.mock.calls.at(-1)[0]).toMatchObject({ kind: 'video', route_id: 89, conversation_id: 'c1' })
      expect(w.get('[data-test="live-price-adjustments"]').text()).toContain('Duration: you asked for 7; it would use 5 (Kling renders 5, 10 s).')
      const button = () => w.findAll('button').find(b => b.text() === 'Review shot estimate')
      expect(button().attributes('disabled')).toBeDefined()
      await w.get('[data-test="live-price-accept"]').setValue(true)
      expect(button().attributes('disabled')).toBeUndefined()
      await button().trigger('click'); await flushPromises()
      expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/jobs/', { operation: 'generate', route_id: 89, prompt: 'A bottle', cinema: {}, params: {}, accept: ['duration'], conversation_id: 'c1', studio_context: { page: 'cinema', preset: '', preset_title: '' } })
      w.unmount()
    } finally { vi.useRealTimers() }
  })
})
