// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Board from './CreativeBoard.vue'
import Marketing from './CreativeMarketing.vue'
import Narrative from './CreativeNarrative.vue'
import InputSlot from './InputSlot.vue'
import api from '../../services/api'
vi.mock('vue-router',()=>({useRoute:()=>({query:{project_id:'p'}}),useRouter:()=>({push:vi.fn()})}))
vi.mock('../../services/api',()=>({default:{get:vi.fn(),post:vi.fn(),patch:vi.fn(),put:vi.fn(),getStoryboard:vi.fn(),getCinemaControls:vi.fn(),getMediaRoutes:vi.fn(),getStudioRecipes:vi.fn(),runStudioRecipe:vi.fn()}}))
vi.mock('../../composables/useNotify',()=>({notify:{error:vi.fn(),success:vi.fn(),warning:vi.fn()}}))
const setup = (component,kind) => mount(component,{props:{kind},global:{plugins:[createPinia()],stubs:{InputSlot:true,RouterLink:true}}})
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
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/jobs/',{operation:'export',project_id:'p',params:{timeline_revision_id:7}})
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
    expect(w.text()).toContain('Review this draft'); expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/brands/read/',{url:'https://example.com'}); w.unmount()
  })
  it('emits a separate approval proposal for every narration scene',async()=>{
    api.getMediaRoutes.mockResolvedValue({data:{routes:[{route_id:'r',name:'Speech',ready:true}]}})
    api.get.mockImplementation(async path=>({data:path.includes('voices')?{voices:[{voice_id:'v',name:'Voice'}]}:{scenes:[]}}))
    api.post.mockResolvedValue({data:{jobs:[{job_id:'one',state:'awaiting_authorization'},{job_id:'two',state:'awaiting_authorization'}]}})
    const w=setup(Narrative,'explainer'); await flushPromises(); await w.get('select').setValue('r'); await flushPromises(); const voice=w.findAll('select').find(s=>s.text().includes('Choose voice')); await voice.setValue('v'); await click(w,'Review narration estimates')
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
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/ads/concepts/', { brand_id: 'b', platform: 'social', product_id: 'product-1', goal: 'awareness', notes: '', n: 3 })
    w.unmount()
  })
  it('saves a new brand with a Library image as its first logo attachment', async () => {
    api.post.mockResolvedValue({ data: { brand_id: 'saved', name: 'New brand' } })
    const w = setup(Marketing, 'ads'); await flushPromises(); await click(w, 'New brand')
    await w.findAll('label').find(label => label.text() === 'name').get('textarea').setValue('New brand')
    const save = w.findAll('button').find(button => button.text() === 'Save reviewed brand')
    expect(save.attributes('disabled')).toBeDefined()
    const images = w.findComponent(InputSlot)
    expect(images.props()).toMatchObject({ kinds: ['image'], limit: 8, allowUpload: false })
    images.vm.$emit('pick', [{ attachment_id: 'logo' }]); await flushPromises()
    expect(save.attributes('disabled')).toBeUndefined()
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
