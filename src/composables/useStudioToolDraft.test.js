// @vitest-environment jsdom
import { defineComponent, h, provide, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { useStudioToolDraft } from './useStudioToolDraft'
import { clearStudioDraftMemory } from '../services/studioDraftMemory'
const state=vi.hoisted(()=>({route:{query:{}}}))
vi.mock('vue-router',()=>({useRoute:()=>state.route}))
it('keeps unsent text in existing tab memory and clears the current draft across accounts',async()=>{
  clearStudioDraftMemory();const user=ref({id:'one'});let draft,selected
  const Child=defineComponent({setup(){draft=ref('');selected=ref('');useStudioToolDraft('music',draft,selected);return()=>h('textarea',{value:draft.value})}})
  const Parent=defineComponent({setup(){provide('studioUser',user);return()=>h(Child)}})
  let w=mount(Parent);draft.value='My unsent direction';selected.value='music-look-1';await nextTick();w.unmount()
  w=mount(Parent);expect(draft.value).toBe('My unsent direction');user.value={id:'two'};await nextTick();expect(draft.value).toBe('');expect(selected.value).toBe('');w.unmount();clearStudioDraftMemory()
})
it('clears a customized brief on account change even when a public preset remains in the URL',async()=>{
  clearStudioDraftMemory();state.route.query={preset:'music-look-1'}
  const user=ref({id:'one'});let draft,selected
  const Child=defineComponent({setup(){draft=ref('Private customized direction');selected=ref('music-look-1');useStudioToolDraft('music',draft,selected);return()=>h('textarea',{value:draft.value})}})
  const w=mount(defineComponent({setup(){provide('studioUser',user);return()=>h(Child)}}))
  user.value={id:'two'};await nextTick();expect(draft.value).toBe('');expect(selected.value).toBe('')
  w.unmount();state.route.query={};clearStudioDraftMemory()
})
