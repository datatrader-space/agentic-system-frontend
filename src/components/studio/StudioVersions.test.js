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
  expect(w.text()).toContain('Preview and compare pictures')
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
it('two or more picture versions compare side by side in the media viewer, like video takes do', async () => {
  state.video.imageVersions=[{attachment_id:'i3',media_type:'image',url:'/i3.png',version:3,is_active:true},{attachment_id:'i2',media_type:'image',url:'/i2.png',version:2},{attachment_id:'i1',media_type:'image',url:'/i1.png',version:1}]
  state.video.versionsMeta={image:{page:1,hasMore:false,loading:false,error:''},video:{}}
  const w=mount(Versions,{props:{type:'image'},attachTo:document.body,global:{stubs:{RouterLink:true}}});await flushPromises()
  await w.get('[data-test="versions-compare-pictures"]').trigger('click')
  await vi.waitFor(()=>expect(document.body.querySelector('[data-test="media-viewer"]')).toBeTruthy())
  const pair=document.body.querySelector('[data-test="media-viewer-compare"]')
  expect(pair).toBeTruthy()
  expect([...pair.querySelectorAll('img')].map(i=>[i.getAttribute('src'),i.getAttribute('alt')])).toEqual([['/i3.png','Picture, version 3 (active)'],['/i2.png','Picture, version 2']])
  expect(document.body.querySelector('.mv-count').textContent.trim()).toBe('1 and 2 of 3')
  // The arrows move the pair; nothing is made or restored by comparing.
  document.body.querySelector('[aria-label="Next file"]').click();await flushPromises()
  expect([...document.body.querySelectorAll('[data-test="media-viewer-compare"] img')].map(i=>i.getAttribute('src'))).toEqual(['/i2.png','/i1.png'])
  expect(state.video.restore).not.toHaveBeenCalled()
  document.body.querySelector('[data-test="media-viewer-close"]').click();await flushPromises()
  expect(document.body.querySelector('[data-test="media-viewer"]')).toBe(null)
  w.unmount()
})
it('a single picture version previews alone; video takes keep the video compare', async () => {
  state.video.imageVersions=[{attachment_id:'i1',media_type:'image',url:'/i1.png',version:1,is_active:true}]
  state.video.versionsMeta={image:{page:1,hasMore:false,loading:false,error:''},video:{}}
  const w=mount(Versions,{props:{type:'image'},attachTo:document.body,global:{stubs:{RouterLink:true}}});await flushPromises()
  expect(w.get('[data-test="versions-compare-pictures"]').text()).toBe('Preview this picture')
  await w.get('[data-test="versions-compare-pictures"]').trigger('click')
  await vi.waitFor(()=>expect(document.body.querySelector('[data-test="media-viewer"]')).toBeTruthy())
  expect(document.body.querySelector('[data-test="media-viewer-compare"]')).toBe(null)
  expect(document.body.querySelector('[data-test="media-viewer-image"]').getAttribute('src')).toBe('/i1.png')
  w.unmount()
  const v=mount(Versions,{props:{type:'video'}});await flushPromises()
  expect(v.find('[data-test="versions-compare-pictures"]').exists()).toBe(false);v.unmount()
})
