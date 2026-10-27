// @vitest-environment jsdom
import { reactive } from 'vue'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
const state = vi.hoisted(() => ({ chat:null, video:null }))
vi.mock('../../stores/useChatStore', () => ({ useChatStore: () => state.chat }))
vi.mock('../../stores/useVideoStore', () => ({ useVideoStore: () => state.video }))
import StudioAgentPanel from './StudioAgentPanel.vue'
let w
beforeEach(() => { state.chat = reactive({ messages:[], hitlRequests:[], isBusy:false, error:'', respondHitl:vi.fn() }); state.video = reactive({ refs:[], sendAgentMessage:vi.fn().mockResolvedValue(true) }) })
afterEach(() => w?.unmount())
const stubs = { ChatMessageList:true, VideoJobsTray:true, HITLModal:true, VideoLibrary:true, ProviderSwitchDialog:true, VideoComposerPanel:{ template:'<div><slot/><slot name="actions"/></div>' } }
it('sends only the person\'s words: the page and preset travel as the studio_context field, never as text', async () => {
  w = mount(StudioAgentPanel, { props:{ modelValue:'Use this preset: Quiet tabletop.', label:'Image', preset:'Quiet tabletop', ready:true }, global:{stubs} })
  expect(state.video.sendAgentMessage).not.toHaveBeenCalled()
  await w.get('[data-test="studio-agent-send"]').trigger('click'); await flushPromises()
  expect(state.video.sendAgentMessage).toHaveBeenCalledWith({ prompt:'Use this preset: Quiet tabletop.', chat:state.chat })
  expect(w.emitted('update:modelValue')).toEqual([['']])
})
it('keeps the draft after a failed send and blocks sending until the session is ready', async () => {
  state.video.sendAgentMessage.mockResolvedValue(false)
  w = mount(StudioAgentPanel, { props:{modelValue:'Synthetic direction', label:'Video',ready:false},global:{stubs} })
  expect(w.get('[data-test="studio-agent-send"]').attributes('disabled')).toBeDefined()
  await w.setProps({ready:true}); await w.get('[data-test="studio-agent-send"]').trigger('click'); await flushPromises()
  expect(w.emitted('update:modelValue')).toBeUndefined()
})

it('sends an attached reference without requiring text, and keeps Shift+Enter for a newline', async () => {
  state.video.refs = [{key:'reference', name:'product.png'}]
  w = mount(StudioAgentPanel, {props:{modelValue:'',label:'Image',ready:true},global:{stubs}})
  expect(w.get('textarea').classes()).not.toContain('st-input')
  expect(w.get('textarea').attributes('placeholder')).toBe('What do you want to make?')
  await w.get('textarea').trigger('keydown', {key:'Enter',shiftKey:true})
  expect(state.video.sendAgentMessage).not.toHaveBeenCalled()
  await w.get('textarea').trigger('keydown', {key:'Enter'}); await flushPromises()
  expect(state.video.sendAgentMessage).toHaveBeenCalledWith({prompt:'',chat:state.chat})
})

it('keeps the composer outside the scrollable conversation and approval area', async () => {
  state.chat.messages = [{id:'message',role:'assistant',content:'Synthetic response'}]
  state.chat.hitlRequests = [{id:'approval'}]
  w = mount(StudioAgentPanel, {props:{label:'Image',ready:true},global:{stubs}})
  expect(w.find('.sap-scroll chat-message-list-stub').exists()).toBe(true)
  expect(w.get('.sap-scroll').findComponent({name:'HITLModal'}).exists()).toBe(true)
  expect(w.find('.sap-scroll textarea').exists()).toBe(false)
  expect(w.find('.sap-composer textarea').exists()).toBe(true)
  expect(state.video.sendAgentMessage).not.toHaveBeenCalled()
})

it('offers Stop while busy and keeps only the compact agent heading after a conversation starts', async () => {
  state.chat.messages=[{id:'u1',role:'user',content:'hi'}]
  state.chat.isBusy=true; state.chat.stop=vi.fn()
  w=mount(StudioAgentPanel,{props:{label:'Image',ready:true},global:{stubs}})
  expect(w.get('.sap-head h2').text()).toBe('Image agent')
  expect(w.find('.sap-intro').exists()).toBe(false)
  expect(w.find('[data-test="studio-agent-send"]').exists()).toBe(false)
  await w.get('.sap-stop').trigger('click')
  expect(state.chat.stop).toHaveBeenCalledOnce()
  expect(w.get('textarea').attributes('rows')).toBe('2')
})

it('expands and collapses with an accessible icon and Escape without sending or clearing the draft', async () => {
  w=mount(StudioAgentPanel,{props:{label:'Image',modelValue:'Keep my direction',ready:true},global:{stubs}})
  const toggle=w.get('[data-test="studio-agent-expand"]')
  expect(toggle.attributes('aria-label')).toBe('Expand chat')
  expect(toggle.attributes('aria-controls')).toBe(w.attributes('id'))
  await toggle.trigger('click')
  expect(w.emitted('update:expanded')[0]).toEqual([true])
  await w.setProps({expanded:true})
  expect(toggle.attributes('aria-expanded')).toBe('true')
  expect(toggle.attributes('aria-label')).toBe('Collapse chat')
  await toggle.trigger('keydown',{key:'Escape'})
  expect(w.emitted('update:expanded').at(-1)).toEqual([false])
  expect(w.get('textarea').element.value).toBe('Keep my direction')
  expect(state.video.sendAgentMessage).not.toHaveBeenCalled()
})

it('passes the full original thread to the display adapter for helper replies', () => {
  state.chat.messages=[{id:'u',role:'user',content:'I am on the Image page in Manual mode. Write an editable creative prompt.'},{id:'a',role:'assistant',content:'{"prompt":null,"question":"Which product?"}'}]
  w=mount(StudioAgentPanel,{props:{label:'Image',ready:true},global:{stubs:{...stubs,ChatMessageList:{name:'ChatMessageList',props:['presentMessage'],template:'<div />'}}}})
  const present=w.findComponent({name:'ChatMessageList'}).props('presentMessage')
  expect(present(state.chat.messages[1]).content).toBe('The agent asked: Which product?')
  expect(state.chat.messages[1].content).toContain('"question"')
})

it('never adds page text, on the first message or after New clears the conversation', async () => {
  state.chat.conversationId='first-chat'
  w=mount(StudioAgentPanel,{props:{label:'Image',preset:'Quiet tabletop',modelValue:'First idea',ready:true},global:{stubs}})
  await w.get('[data-test="studio-agent-send"]').trigger('click');await flushPromises()
  await w.setProps({modelValue:'Next message'})
  await w.get('[data-test="studio-agent-send"]').trigger('click');await flushPromises()
  expect(state.video.sendAgentMessage.mock.calls[1][0].prompt).toBe('Next message')
  state.chat.conversationId=null;state.chat.messages=[]
  await w.setProps({modelValue:'A fresh idea',preset:'Window-light portrait'})
  await w.get('[data-test="studio-agent-send"]').trigger('click');await flushPromises()
  expect(state.video.sendAgentMessage.mock.calls[0][0].prompt).toBe('First idea')
  expect(state.video.sendAgentMessage.mock.calls[2][0].prompt).toBe('A fresh idea')
})
