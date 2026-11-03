// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia,setActivePinia } from 'pinia'
import { useVideoStore } from './useVideoStore'
import api from '../services/api'
vi.mock('../services/api',()=>({default:{get:vi.fn()}}))
beforeEach(()=>{setActivePinia(createPinia());vi.clearAllMocks()})
it('ignores a late version response after the open conversation changes',async()=>{
  let finish;api.get.mockImplementation(()=>new Promise(resolve=>{finish=resolve}));const video=useVideoStore();video.conversationId='previous';const pending=video.loadVersions();video.conversationId='current';video.versions=[{attachment_id:'current-take'}];finish({data:{versions:[{attachment_id:'previous-take'}]}});await pending;expect(video.versions).toEqual([{attachment_id:'current-take'}])
})
