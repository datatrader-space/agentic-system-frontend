// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../../stores/useChatStore'
import ChatMessageList from '../chat/ChatMessageList.vue'
import { presentStudioMessage, prepareStudioEdit } from '../../services/studioMessagePresentation'
let wrapper
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })
it('shows only authored words while preserving the wire context and message metadata', () => {
  const original = Object.freeze({id:'u1',role:'user',content:'I am on the Image page. I am using my own idea.\n\nhi',attachments:[{name:'reference.png'}],planArtifacts:[{plan_id:'p1'}]})
  const shown = presentStudioMessage(original)
  expect(shown.content).toBe('hi')
  expect(shown.attachments).toBe(original.attachments)
  expect(shown.planArtifacts).toBe(original.planArtifacts)
  expect(original.content).toContain('I am on the Image page.')
  expect(presentStudioMessage({...original,content:'I am on the Video page. My chosen preset is A measured reveal.\n\nKeep the camera still.'}).content).toBe('Keep the camera still.')
})
it('keeps ordinary user text, assistant text and incomplete prefixes unchanged', () => {
  for (const m of [{role:'user',content:'Please explain I am on the Image page.'},{role:'assistant',content:'I am on the Image page. I am using my own idea.\n\nhi'},{role:'user',content:'I am on the Image page. hi'}]) expect(presentStudioMessage(m)).toBe(m)
})
it('keeps attachment-only messages meaningful', () => {
  expect(presentStudioMessage({role:'user',content:'I am on the Image page. I am using my own idea.\n\n',attachments:[{name:'reference.png'}]}).content).toBe('Use these references.')
})
it('the shared list defaults to unchanged messages and opts into presentation without mutating the store', async () => {
  setActivePinia(createPinia())
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}})
  const chat=useChatStore()
  chat.messages=[{id:'u1',role:'user',content:'I am on the Image page. I am using my own idea.\n\nhi',status:'done'}]
  wrapper=mount(ChatMessageList,{global:{stubs:{ChatMessage:true,WorkIterationBar:true,InlinePlanArtifact:true}}})
  const message=()=>wrapper.findComponent({name:'ChatMessage'}).props('message')
  expect(message().content).toBe(chat.messages[0].content)
  const edit=vi.spyOn(chat,'editAndResend').mockImplementation(()=>{})
  wrapper.findComponent({name:'ChatMessage'}).vm.$emit('edit','updated')
  expect(edit).toHaveBeenLastCalledWith('u1','updated')
  await wrapper.setProps({presentMessage:presentStudioMessage,prepareEdit:prepareStudioEdit})
  expect(message().content).toBe('hi')
  wrapper.findComponent({name:'ChatMessage'}).vm.$emit('edit','updated')
  expect(edit).toHaveBeenLastCalledWith('u1','I am on the Image page. I am using my own idea.\n\nupdated')
  expect(chat.messages[0].content).toContain('I am on the Image page.')
})


it('summarizes helper instructions without modifying stored messages', async () => {
  const { presentStudioMessage, studioChatName } = await import('../../services/studioMessagePresentation')
  for (const [instruction, line] of [['Write only an editable creative prompt.', 'You asked for a prompt'], ['Suggest settings only as a JSON object.', 'You asked for settings']]) {
    const content = `I am on the Image page in Manual mode. ${instruction}\nPreset: Quiet tabletop. Inputs: None yet.`
    const original = { role:'user', content }
    expect(presentStudioMessage(original).content).toBe(line)
    expect(original.content).toBe(content)
    expect(studioChatName(content)).toBe('Image chat '+String.fromCharCode(183)+' Quiet tabletop')
  }
})
it('cleans full and truncated chat names with a page fallback', async () => {
  const { studioChatName } = await import('../../services/studioMessagePresentation')
  expect(studioChatName('I am on the Image page. I am using my own idea.')).toBe('Image chat')
  expect(studioChatName('I am on the Video page. My chosen preset is A measured reveal.')).toBe('Video chat '+String.fromCharCode(183)+' A measured reveal')
  expect(studioChatName('I am on the Image page. I am using my own idea.\n\nA blue bottle')).toBe('A blue bottle')
  expect(studioChatName('I am on the Image page in Manual mode.')).toBe('Image chat')
  expect(studioChatName('Original name')).toBe('Original name')
})

it('summarizes only assistant replies belonging to a helper turn without mutating them', () => {
  const request={role:'user',content:'I am on the Image page in Manual mode. Write an editable creative prompt.'}
  for (const [content,expected] of [
    ['{"prompt":null,"question":"**Which** product?"}','The agent asked: Which product?'],
    ['{"prompt":"A detailed bottle photo","question":null}','Prompt written and added to Creative direction'],
    ['Not JSON','The agent could not help with this request'],
    ['[]','The agent could not help with this request'],
    ['{"prompt":42}','The agent could not help with this request'],
  ]) {
    const reply=Object.freeze({id:'a',role:'assistant',content,attachments:[]})
    const shown=presentStudioMessage(reply,[request,reply])
    expect(shown.content).toBe(expected); expect(shown.attachments).toBe(reply.attachments)
    expect(reply.content).toBe(content)
    expect(presentStudioMessage(reply)).toBe(reply)
    expect(presentStudioMessage(reply,[{role:'user',content:'Ordinary question'},reply])).toBe(reply)
    expect(presentStudioMessage(reply,[request,{role:'user',content:'Follow-up question'},reply])).toBe(reply)
  }
})
it('summarizes helper settings in plain words and gives questions priority', () => {
  const request={role:'user',content:'I am on the Video page in Manual mode. Suggest settings only as JSON.'}
  for (const [content,expected] of [
    ['{"model":"11","shape":"16:9","length":5,"count":2,"question":null,"endpoint":"hidden"}','Settings suggested: model 11, shape 16:9, 5 seconds, 2 images'],
    ['{"question":"**Which** format?","shape":"1:1"}','The agent asked: Which format?'],
    ['{}','The agent could not help with this request'],
  ]) {
    const reply={role:'assistant',content}
    expect(presentStudioMessage(reply,[request,reply]).content).toBe(expected)
    expect(reply.content).toBe(content)
  }
})
it('shows the adapted helper reply through the real shared transcript list', () => {
  setActivePinia(createPinia()); vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}})
  const chat=useChatStore()
  chat.messages=[{id:'u',role:'user',content:'I am on the Image page in Manual mode. Write an editable creative prompt.',status:'done'},{id:'a',role:'assistant',content:'{"question":"Which product?","prompt":null}',status:'done'}]
  wrapper=mount(ChatMessageList,{props:{presentMessage:m=>presentStudioMessage(m,chat.messages)},global:{stubs:{ChatMessage:true,WorkIterationBar:true,InlinePlanArtifact:true}}})
  expect(wrapper.findAllComponents({name:'ChatMessage'}).map(c=>c.props('message').content)).toEqual(['You asked for a prompt','The agent asked: Which product?'])
  expect(chat.messages[1].content).toContain('"question"')
})

it('keeps new and legacy helper histories readable and their source unchanged', async () => {
  const {studioPageContext,studioChatName}=await import('../../services/studioMessagePresentation')
  for(const prefix of ['',studioPageContext('Image','Quiet tabletop')]) {
    const user={role:'user',content:prefix+'I am on the Image page in Manual mode. Write an editable creative prompt.\nPreset: Quiet tabletop. Inputs: None yet.'}
    const assistant={role:'assistant',content:'{"prompt":"A product photograph","question":null}'}
    expect(presentStudioMessage(user).content).toBe('You asked for a prompt')
    expect(presentStudioMessage(assistant,[user,assistant]).content).toBe('Prompt written and added to Creative direction')
    expect(studioChatName(user.content)).toBe('Image chat '+String.fromCharCode(183)+' Quiet tabletop')
    expect(user.content).toContain('Manual mode');expect(assistant.content).toContain('"prompt"')
  }
})
