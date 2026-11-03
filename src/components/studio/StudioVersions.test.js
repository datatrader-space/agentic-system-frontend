// @vitest-environment jsdom
import { reactive } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Versions from './StudioVersions.vue'
const state = vi.hoisted(() => ({ chat:null,video:null }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => state.chat }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
beforeEach(() => { state.chat=reactive({conversationId:'owned',isBusy:false});state.video=reactive({conversationId:'owned',busy:false,versions:[{attachment_id:4,title:'Earlier take',version:1,is_active:false}],loadVersions:vi.fn().mockResolvedValue(),restore:vi.fn().mockResolvedValue()}) })
it('loading versions is read-only and only an explicit selection invokes the existing free restore path', async () => {
  const w=mount(Versions);await flushPromises();expect(state.video.restore).not.toHaveBeenCalled();await w.findAll('button').find(b=>b.text().includes('Use this version')).trigger('click');await flushPromises();expect(state.video.loadVersions).toHaveBeenCalledWith({type:'video',more:false});expect(state.video.restore).toHaveBeenCalledWith(state.video.versions[0],{conversationId:'owned',type:'video'});w.unmount()
})
it('does not show or restore records belonging to a different open conversation', async () => {
  state.video.conversationId='other';const w=mount(Versions);await flushPromises();expect(w.find('button').exists()).toBe(false);expect(w.text()).not.toContain('Earlier take');expect(state.video.loadVersions).not.toHaveBeenCalled();expect(state.video.restore).not.toHaveBeenCalled();w.unmount()
})

it('an image page lists image versions, restores one for free and pages older ones', async () => {
  state.video.imageVersions=[{attachment_id:'i2',media_type:'image',url:'/i2.png',version:2,is_active:true},{attachment_id:'i1',media_type:'image',url:'/i1.png',version:1,is_active:false}]
  state.video.versionsMeta={image:{page:1,hasMore:true,loading:false,error:''},video:{}}
  const w=mount(Versions,{props:{type:'image'}});await flushPromises()
  expect(state.video.loadVersions).toHaveBeenCalledWith({type:'image',more:false})
  expect(w.text()).not.toContain('Preview and compare')
  expect(w.text()).not.toContain('only')
  expect(w.findAll('li img').map(i=>i.attributes('src'))).toEqual(['/api/library/i2/thumbnail/','/api/library/i1/thumbnail/'])
  await w.findAll('button').find(b=>b.text().includes('Use this version')).trigger('click');await flushPromises()
  expect(state.video.restore).toHaveBeenCalledWith(state.video.imageVersions[1],{conversationId:'owned',type:'image'})
  await w.get('[data-test="versions-more"]').trigger('click')
  expect(state.video.loadVersions).toHaveBeenLastCalledWith({type:'image',more:true});w.unmount()
})
it('an unreachable versions read shows an error with Try again, not an empty list', async () => {
  state.video.versions=[];state.video.versionsMeta={video:{page:0,hasMore:false,loading:false,error:'Could not load versions. Try again.'}}
  const w=mount(Versions);await flushPromises()
  expect(w.get('[data-test="versions-error"]').text()).toContain('Could not load versions')
  expect(w.text()).not.toContain('No video takes yet')
  state.video.loadVersions.mockClear();await w.get('[data-test="versions-error"] button').trigger('click')
  expect(state.video.loadVersions).toHaveBeenCalledWith({type:'video',more:false});w.unmount()
})
