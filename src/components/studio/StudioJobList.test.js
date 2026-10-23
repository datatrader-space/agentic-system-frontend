// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Jobs from './StudioJobList.vue'
import { useVideoStore } from '../../stores/useVideoStore'
import api from '../../services/api'
vi.mock('../../services/api',()=>({default:{getStudioJob:vi.fn()}}))
vi.mock('../../composables/useNotify',()=>({notify:{error:vi.fn(),success:vi.fn(),warning:vi.fn()}}))
describe('Media job observation',()=>{
  it('notifies the workflow when a pending job settles, without repeating on remount',async()=>{
    const pinia=createPinia(),video=useVideoStore(pinia)
    video._put({job_id:'j',state:'running'})
    api.getStudioJob.mockResolvedValue({data:{job_id:'j',state:'ready',modality:'audio'}})
    const opts={props:{ids:['j']},global:{plugins:[pinia],stubs:{VideoJobCard:true}}}
    const w=mount(Jobs,opts); await flushPromises(); expect(w.emitted('settled')).toHaveLength(1); w.unmount()
    const again=mount(Jobs,opts); await flushPromises(); expect(again.emitted('settled')).toBeUndefined(); again.unmount()
  })
})
