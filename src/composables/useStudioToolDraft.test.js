// @vitest-environment jsdom
// A creative page's unsent text stays on this device (localStorage) for the signed-in person, page and conversation.
import { defineComponent, h, provide, ref, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { useStudioToolDraft } from './useStudioToolDraft'
import { clearStudioDrafts, studioDraftKey, keepLocalDraft, STUDIO_DRAFT_MAX_AGE_MS } from '../services/studioDrafts'
const state=vi.hoisted(()=>({route:null}))
vi.mock('vue-router',()=>({useRoute:()=>state.route}))
beforeEach(()=>{localStorage.clear();state.route=reactive({query:{}})})
function setup(user=ref({id:'one'})){
  const t={user,draft:null,selected:null,api:null}
  const Child=defineComponent({setup(){t.draft=ref('');t.selected=ref('');t.api=useStudioToolDraft('music',t.draft,t.selected);return()=>h('textarea',{value:t.draft.value})}})
  t.Parent=defineComponent({setup(){provide('studioUser',user);return()=>h(Child)}})
  t.w=mount(t.Parent)
  return t
}
const key=(conversation='')=>studioDraftKey('one','music',conversation)

it('keeps unsent text on this device and brings it back after a remount (a reload or a closed tab)',async()=>{
  const t=setup();t.draft.value='My unsent direction';t.selected.value='music-look-1';await nextTick()
  expect(JSON.parse(localStorage.getItem(key())).draft).toEqual({agentDraft:'My unsent direction',preset:'music-look-1'})
  t.w.unmount()
  const again=setup();expect(again.draft.value).toBe('My unsent direction');expect(again.selected.value).toBe('music-look-1');again.w.unmount()
})

it('keeps each conversation\'s draft apart',async()=>{
  const t=setup();t.draft.value='New chat text';await nextTick()
  state.route.query={conversation:'c1'};await nextTick();expect(t.draft.value).toBe('')
  t.draft.value='Chat one text';await nextTick()
  state.route.query={};await nextTick();expect(t.draft.value).toBe('New chat text')
  expect(JSON.parse(localStorage.getItem(key('c1'))).draft.agentDraft).toBe('Chat one text');t.w.unmount()
})

it('clears the draft when it is sent, even when the send gives the chat its conversation first',async()=>{
  const t=setup();t.draft.value='Make a calm piano loop';await nextTick()
  state.route.query={conversation:'c9'};await nextTick()   // the new chat got its conversation before the composer emptied
  t.draft.value='';t.api.forget();await nextTick()
  expect(localStorage.getItem(key())).toBeNull();expect(localStorage.getItem(key('c9'))).toBeNull()
  t.w.unmount();state.route.query={}
  const again=setup();expect(again.draft.value).toBe('');again.w.unmount()
})

it('clears the draft when New chat starts fresh',async()=>{
  state.route.query={conversation:'c3'}
  const t=setup();t.draft.value='Text in an open chat';await nextTick()
  state.route.query={mode:'agent'};await nextTick()   // New chat: the page drops the conversation
  t.draft.value='';t.selected.value='';t.api.forget();await nextTick()
  expect(localStorage.length).toBe(0);t.w.unmount()
})

it('an emptied composer leaves nothing behind',async()=>{
  const t=setup();t.draft.value='Something';await nextTick();t.draft.value='  ';await nextTick()
  expect(localStorage.getItem(key())).toBeNull();t.w.unmount()
})

it('sign-out removes the person\'s drafts, so a later visit starts empty',async()=>{
  const t=setup();t.draft.value='Private direction';await nextTick();t.w.unmount()
  clearStudioDrafts('one')
  expect(localStorage.length).toBe(0)
  const again=setup();expect(again.draft.value).toBe('');again.w.unmount()
})

it('drops a draft older than 7 days instead of showing it',async()=>{
  keepLocalDraft(key(),{agentDraft:'Old text',preset:''},Date.now()-STUDIO_DRAFT_MAX_AGE_MS-1000)
  const t=setup();expect(t.draft.value).toBe('');expect(localStorage.getItem(key())).toBeNull();t.w.unmount()
})

it('clears the current draft across accounts and never shows one person\'s draft to another',async()=>{
  const user=ref({id:'one'});const t=setup(user);t.draft.value='My unsent direction';t.selected.value='music-look-1';await nextTick()
  user.value={id:'two'};await nextTick();expect(t.draft.value).toBe('');expect(t.selected.value).toBe('')
  expect(localStorage.getItem(studioDraftKey('two','music',''))).toBeNull()
  t.w.unmount()
  const other=setup(ref({id:'two'}));expect(other.draft.value).toBe('');other.w.unmount()
  const signedOut=setup(ref(null));expect(signedOut.draft.value).toBe('');signedOut.draft.value='No account';await nextTick()
  expect(Object.keys(localStorage)).toEqual([key()]);signedOut.w.unmount()
})

it('clears a customized brief on account change even when a public preset remains in the URL',async()=>{
  state.route.query={preset:'music-look-1'}
  const user=ref({id:'one'});let draft,selected
  const Child=defineComponent({setup(){draft=ref('Private customized direction');selected=ref('music-look-1');useStudioToolDraft('music',draft,selected);return()=>h('textarea',{value:draft.value})}})
  const w=mount(defineComponent({setup(){provide('studioUser',user);return()=>h(Child)}}))
  user.value={id:'two'};await nextTick();expect(draft.value).toBe('');expect(selected.value).toBe('')
  w.unmount()
})
