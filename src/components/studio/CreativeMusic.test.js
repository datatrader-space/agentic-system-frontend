// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Music from './CreativeMusic.vue'
import api from '../../services/api'
vi.mock('../../services/api', () => ({ default:{ getMediaRoutes:vi.fn(), prepareMediaJob:vi.fn() } }))
describe('Music proposals', () => {
  beforeEach(() => { vi.clearAllMocks(); api.getMediaRoutes.mockResolvedValue({data:{routes:[{route_id:'proven',name:'Music',ready:true},{route_id:'unproven',name:'Unproven',ready:false}]}}) })
  async function form() { const w=mount(Music); await flushPromises(); await w.get('select').setValue('proven'); await w.get('textarea').setValue('Gentle piano'); return w }
  it('prepares exactly one proposal and leaves Generate to its approval card',async () => {
    const job={job_id:'job',state:'awaiting_authorization'}; api.prepareMediaJob.mockResolvedValue({data:job}); const w=await form()
    expect(w.find('option[value="unproven"]').attributes('disabled')).toBeDefined()
    await w.get('form').trigger('submit'); await flushPromises()
    expect(api.prepareMediaJob).toHaveBeenCalledExactlyOnceWith({operation:'music',route_id:'proven',request:{prompt:'Gentle piano',duration:30,instrumental:true}})
    expect(w.emitted('job')).toEqual([[job]]); w.unmount()
  })
  it('shows a provider refusal beside its prompt',async () => {
    api.prepareMediaJob.mockRejectedValue({response:{data:{error:{field:'prompt',message:'Artist names are refused.'}}}})
    const w=await form(); await w.get('form').trigger('submit'); await flushPromises(); expect(w.get('textarea').element.parentElement.nextElementSibling.textContent).toContain('Artist names are refused.'); expect(w.emitted('job')).toBeUndefined(); w.unmount()
  })
  it('blocks duplicate proposals while the first is pending',async () => {
    let resolve; api.prepareMediaJob.mockReturnValue(new Promise(r=>{resolve=r})); const w=await form(); await w.get('form').trigger('submit'); await w.get('form').trigger('submit'); expect(api.prepareMediaJob).toHaveBeenCalledTimes(1); resolve({data:{job_id:'j'}}); await flushPromises(); w.unmount()
  })
})
