// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import Bar from './StudioWorkspaceBar.vue'
import api from '../../services/api'
// The Image page's looks are served by the Recipe API (F-D4); one of them is searched for below.
vi.mock('../../services/api',()=>({default:{get:vi.fn(),post:vi.fn(),getStudioRecipes:vi.fn(page=>Promise.resolve({data:{presets:page==='image'?[{id:'image-look-1',feature:'image',title:'Softbox product portrait',purpose:'A clean campaign image.',category:'Images',slots:[],settings:{},promptTemplate:'x',variants:['a'],clientOnly:true}]:[]}}))}}))
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
  await w.get('[data-test="swb-jobs"]').trigger('click');await flushPromises()
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
  const w=render();await w.get('[data-test="swb-jobs"]').trigger('click');await flushPromises()
  expect(w.get('[data-test="swb-recent"] [role="alert"]').text()).toContain('could not be loaded')
  w.unmount()
})

it('the jobs button names no count when there are no jobs (ADM-1170: "0 jobs")', async () => {
  const w=render()
  const button=w.get('[data-test="swb-jobs"]')
  expect(button.text()).toContain('Jobs')
  expect(button.text()).not.toContain('0 jobs')
  expect(button.attributes('aria-label')).toBe('Jobs')
  w.unmount()
})

it('the tray shows a picture result as a picture and never scrolls sideways at phone width (live 2026-11-17)', async () => {
  // Live at 375 px: a "Save frame" job from an MCP client showed a video player at 0:00, and a Music card's <audio>
  // (300 px wide by default) made the list scroll sideways.
  const frame = { job_id: 'frame', conversation_id: null, operation: 'frame', modality: 'video', state: 'ready', references: [],
                  origin: { label: 'From MCP: Claude' }, effective_config: {},
                  output: { attachment_id: 'f1', url: '/media/f1.png', media_type: 'image', mime_type: 'image/png' } }
  const music = { job_id: 'music', conversation_id: null, operation: 'music', modality: 'audio', state: 'ready', references: [],
                  output: { attachment_id: 's1', url: '/media/s1.mp3', media_type: 'audio', mime_type: 'audio/mpeg' } }
  api.get.mockResolvedValue({ data: { jobs: [frame, music], page: 1, has_more: false } })
  const w = mount(Bar, { props: { title: 'Video', user: { id: 'one', username: 'Maker' } }, global: { stubs: { RouterLink: stubs.RouterLink } } })
  for (const dialog of w.findAll('dialog')) { dialog.element.showModal = vi.fn(); dialog.element.close = vi.fn() }
  await w.get('[data-test="swb-jobs"]').trigger('click'); await flushPromises()
  const cards = w.get('[data-test="swb-recent"]').findAll('article')
  expect(cards).toHaveLength(2)
  expect(cards[0].find('video').exists()).toBe(false)
  expect(cards[0].get('img').attributes('alt')).toBe('Saved frame')
  expect(cards[0].text()).toContain('From MCP: Claude')
  expect(cards[1].find('audio.vjc-audio').exists()).toBe(true)
  // The list and its recent section are one shrinkable column, so no card content can be wider than the list.
  const src = (await import('./StudioWorkspaceBar.vue?raw')).default
  expect(src).toMatch(/\.swb-job-list\{[^}]*grid-template-columns:minmax\(0,1fr\)/)
  expect(src).toMatch(/\.swb-recent\{[^}]*grid-template-columns:minmax\(0,1fr\)/)
  w.unmount()
})

it('says "Not available yet" on a tool the server says cannot run yet, still linked to its page (ISSUE-8)',async()=>{
  const { studioFeatures } = await import('../../services/studioFeatures')
  const before = studioFeatures.value
  studioFeatures.value = before.map(f => f.id === 'lipsync' ? { ...f, ready: false, reason: 'No model for this page has been proven yet.' } : f.id === 'image' ? { ...f, ready: true } : f)
  try {
    api.get.mockResolvedValue({data:{projects:[]}})
    const w=render();await w.get('[aria-label="Search templates, tools and projects"]').trigger('click');await flushPromises()
    await w.get('input').setValue('Lip-sync')
    expect(w.get('[data-test="swb-badge-lipsync"]').text()).toBe('Not available yet')
    expect(w.get('.swb-results a').attributes('data-to')).toContain('/dashboard/video-studio/lipsync')
    await w.get('input').setValue('Image edit')
    expect(w.find('[data-test="swb-badge-edit"]').exists()).toBe(false)
    w.unmount()
  } finally { studioFeatures.value = before }
})
