// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('How often a job is read', () => {
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
  it('a card waiting for a decision is not re-read on every update, and only about every 30 seconds', async () => {
    // Live 2026-10-28: a waiting card was read 39 times a minute (a new id list on every job update re-read it).
    vi.useFakeTimers()
    const pinia = createPinia(), video = useVideoStore(pinia)
    video._put({ job_id: 'w', state: 'awaiting_authorization' }); video._put({ job_id: 'r', state: 'running' })
    api.getStudioJob.mockImplementation(id => Promise.resolve({ data: { job_id: id, state: id === 'w' ? 'awaiting_authorization' : 'running' } }))
    const w = mount(Jobs, { props: { ids: ['w', 'r'] }, global: { plugins: [pinia], stubs: { VideoJobCard: true } } })
    await flushPromises()
    api.getStudioJob.mockClear()
    for (let i = 0; i < 5; i++) { await w.setProps({ ids: ['w', 'r'] }); await flushPromises() }     // new arrays, same ids
    expect(api.getStudioJob).not.toHaveBeenCalled()
    for (let i = 0; i < 7; i++) { await vi.advanceTimersByTimeAsync(4000) }                          // 28 s
    const reads = id => api.getStudioJob.mock.calls.filter(([x]) => x === id).length
    expect([reads('w'), reads('r')]).toEqual([0, 7])
    await vi.advanceTimersByTimeAsync(4000)                                                        // 32 s
    expect(reads('w')).toBe(1)
    await w.setProps({ ids: ['w', 'r', 'n'] }); await flushPromises()
    expect(api.getStudioJob.mock.calls.at(-1)[0]).toBe('n')                                       // a new one at once
    w.unmount()
  })
})
