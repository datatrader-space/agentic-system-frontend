// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import Music from './CreativeMusic.vue'
import api from '../../services/api'
vi.mock('../../services/api', () => ({ default:{ getMediaRoutes:vi.fn(), prepareMediaJob:vi.fn() } }))
const chat = vi.hoisted(() => ({ value: null }))
const video = vi.hoisted(() => ({ value: null }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => chat.value }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => video.value }))
describe('Music proposals', () => {
  beforeEach(() => { vi.clearAllMocks(); chat.value = reactive({ conversationId: 'c1', studioContext: { page: 'music' }, ensureConversation: vi.fn(async () => 'c1') }); video.value = reactive({ project: null }); api.getMediaRoutes.mockResolvedValue({data:{routes:[{route_id:'proven',name:'Music',ready:true},{route_id:'unproven',name:'Unproven',ready:false}]}}) })
  async function form() { const w=mount(Music); await flushPromises(); await w.get('select').setValue('proven'); await w.get('textarea').setValue('Gentle piano'); return w }
  it('prepares exactly one proposal and leaves Generate to its approval card',async () => {
    const job={job_id:'job',state:'awaiting_authorization'}; api.prepareMediaJob.mockResolvedValue({data:job}); const w=await form()
    expect(w.find('option[value="unproven"]').attributes('disabled')).toBeDefined()
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob).toHaveBeenCalledExactlyOnceWith({operation:'music',route_id:'proven',request:{prompt:'Gentle piano',duration:30,instrumental:true},conversation_id:'c1',studio_context:{page:'music'}})
    expect(w.emitted('job')).toEqual([[job]]); w.unmount()
  })
  it('shows a provider refusal beside its prompt',async () => {
    api.prepareMediaJob.mockRejectedValue({response:{data:{error:{field:'prompt',message:'Artist names are refused.'}}}})
    const w=await form(); await w.get('form').trigger('submit'); await flushPromises(); expect(w.get('textarea').element.parentElement.nextElementSibling.textContent).toContain('Artist names are refused.'); expect(w.emitted('job')).toBeUndefined(); w.unmount()
  })
  it('follows each model\'s length: Lyria Clip sends none, Lyria Pro sends an optional one, ElevenLabs needs one', async () => {
    api.getMediaRoutes.mockResolvedValue({data:{routes:[
      {route_id:'clip',name:'Lyria 3 Clip',ready:true,length:{fixed_seconds:30}},
      {route_id:'pro',name:'Lyria 3 Pro',ready:true,length:{by_description:true,min:10,max:300}}]}})
    api.prepareMediaJob.mockResolvedValue({data:{job_id:'j'}})
    const w=mount(Music); await flushPromises()
    await w.get('select').setValue('clip'); await w.get('textarea').setValue('A bright ukulele loop')
    expect(w.find('[data-test="music-duration"]').exists()).toBe(false)
    expect(w.get('[data-test="music-fixed-length"]').text()).toContain('30 seconds')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls[0][0]).toEqual({operation:'music',route_id:'clip',request:{prompt:'A bright ukulele loop',instrumental:true},conversation_id:'c1',studio_context:{page:'music'}})
    await w.get('select').setValue('pro')
    await w.get('[data-test="music-duration"]').setValue('')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls[1][0].request).toEqual({prompt:'A bright ukulele loop',instrumental:true})
    await w.get('[data-test="music-duration"]').setValue('120')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls[2][0].request).toEqual({prompt:'A bright ukulele loop',instrumental:true,duration:120})
    w.unmount()
  })
  it('names each model with its connection and price and chooses the first proven one (live 2026-10-29)', async () => {
    api.getMediaRoutes.mockResolvedValue({data:{routes:[
      {route_id:187,name:'Lyria 3 Clip',connection:'sajid openrouter',price_label:'$0.04 a piece',ready:true},
      {route_id:211,name:'Music v1',connection:'Eleven Lab',price_label:'$0.15 a minute',ready:false}]}})
    api.prepareMediaJob.mockResolvedValue({data:{job_id:'j'}})
    const w=mount(Music); await flushPromises()
    expect(w.get('select').element.value).toBe('187')
    expect(w.findAll('option').map(o=>o.text())).toEqual(['Lyria 3 Clip · sajid openrouter · $0.04 a piece','Music v1 · Eleven Lab · $0.15 a minute'])
    await w.get('textarea').setValue('A bright ukulele loop'); await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob.mock.calls[0][0].route_id).toBe('187'); w.unmount()
  })
  it('blocks duplicate proposals while the first is pending',async () => {
    let resolve; api.prepareMediaJob.mockReturnValue(new Promise(r=>{resolve=r})); const w=await form(); await w.get('form').trigger('submit'); await w.get('form').trigger('submit'); expect(api.prepareMediaJob).toHaveBeenCalledTimes(1); resolve({data:{job_id:'j'}}); await flushPromises(); w.unmount()
  })
})
