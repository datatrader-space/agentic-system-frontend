// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import Bar from './StudioWorkspaceBar.vue'
import api from '../../services/api'
vi.mock('../../services/api',()=>({default:{get:vi.fn(),post:vi.fn()}}))
const stubs={RouterLink:{props:['to'],template:'<a :data-to="JSON.stringify(to)"><slot /></a>'},VideoJobCard:true}
beforeEach(()=>{setActivePinia(createPinia());vi.clearAllMocks()})
function render(){const w=mount(Bar,{props:{title:'Video',user:{id:'one',username:'Maker'}},global:{stubs}});for(const dialog of w.findAll('dialog')){dialog.element.showModal=vi.fn();dialog.element.close=vi.fn()}return w}
it('searches existing project reads and links to agent-ready looks without executing work',async()=>{
  api.get.mockResolvedValue({data:{projects:[{project_id:'p1',title:'My campaign',conversation_id:'c1'}]}})
  const w=render();expect(api.get).not.toHaveBeenCalled()
  await w.get('[aria-label="Search templates, tools and projects"]').trigger('click');await flushPromises()
  expect(api.get).toHaveBeenCalledWith('/video/projects/')
  await w.get('input').setValue('My campaign');expect(w.text()).toContain('My campaign')
  expect(w.get('.swb-results a').attributes('data-to')).toContain('"conversation":"c1"')
  await w.get('input').setValue('Softbox product portrait');expect(w.get('.swb-results a').attributes('data-to')).toContain('"mode":"agent"')
  expect(api.post).not.toHaveBeenCalled();w.unmount()
})
it('ignores an old account project response after the signed-in user changes',async()=>{
  let complete;api.get.mockReturnValue(new Promise(resolve=>{complete=resolve}))
  const w=render();await w.get('[aria-label="Search templates, tools and projects"]').trigger('click')
  await w.setProps({user:{id:'two'}});complete({data:{projects:[{project_id:'private',title:'Old account project'}]}});await flushPromises()
  expect(w.text()).not.toContain('Old account project');expect(api.post).not.toHaveBeenCalled();w.unmount()
})

it('the jobs queue reads the account list only when opened and shows recent jobs of other chats',async()=>{
  api.get.mockImplementation((url,{params}={})=>Promise.resolve({data:url==='/video/jobs/'?(params.page===1
    ?{jobs:[{job_id:'here',conversation_id:'open',state:'ready'},{job_id:'elsewhere',conversation_id:'other',state:'ready'}],page:1,has_more:true}
    :{jobs:[{job_id:'older',conversation_id:'other',state:'failed'}],page:2,has_more:false}):{projects:[]}}))
  const w=mount(Bar,{props:{title:'Video',user:{id:'one',username:'Maker'}},global:{stubs:{...stubs,VideoJobCard:{props:['job'],template:'<div class="card">{{ job.job_id }}</div>'}}}})
  for(const dialog of w.findAll('dialog')){dialog.element.showModal=vi.fn();dialog.element.close=vi.fn()}
  const { useChatStore } = await import('../../stores/useChatStore'), { useVideoStore } = await import('../../stores/useVideoStore')
  useChatStore().conversationId='open';useVideoStore()._put({job_id:'here',conversation_id:'open',state:'ready'})
  expect(api.get).not.toHaveBeenCalled()
  await w.get('[aria-label="Open jobs for this conversation"]').trigger('click');await flushPromises()
  expect(api.get).toHaveBeenCalledWith('/video/jobs/',{params:{page:1}})
  expect(w.get('[data-test="swb-recent"]').findAll('.card').map(c=>c.text())).toEqual(['elsewhere'])
  await w.get('[data-test="swb-recent-more"]').trigger('click');await flushPromises()
  expect(api.get).toHaveBeenLastCalledWith('/video/jobs/',{params:{page:2}})
  expect(w.get('[data-test="swb-recent"]').findAll('.card').map(c=>c.text())).toEqual(['elsewhere','older'])
  expect(w.find('[data-test="swb-recent-more"]').exists()).toBe(false)
  // The account list never enters the store, so another chat's result cannot become this chat's preview.
  expect(useVideoStore().jobs.elsewhere).toBeUndefined()
  expect(api.post).not.toHaveBeenCalled();w.unmount()
})
it('a failed account jobs read says so with Try again',async()=>{
  api.get.mockRejectedValue(new Error('down'))
  const w=render();await w.get('[aria-label="Open jobs for this conversation"]').trigger('click');await flushPromises()
  expect(w.get('[data-test="swb-recent"] [role="alert"]').text()).toContain('could not be loaded')
  w.unmount()
})
