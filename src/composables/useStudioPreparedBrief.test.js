// @vitest-environment jsdom
import { defineComponent, h, provide, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import { useStudioPreparedBrief } from './useStudioPreparedBrief'
import { studioLooks } from '../services/studioLooks'
it('keeps spoken words separate from direction and never fills a script from a sound-effect prompt',async()=>{
  const selected=ref(null), script=ref('Existing script')
  const Child=defineComponent({setup(){useStudioPreparedBrief(script,'Script');return()=>h('textarea',{value:script.value})}})
  const w=mount(defineComponent({setup(){provide('studioPreparedLook',selected);return()=>h(Child)}}))
  selected.value=studioLooks.find(l=>l.id==='audio-look-2');await nextTick();expect(script.value).toBe('Existing script')
  selected.value=studioLooks.find(l=>l.id==='audio-look-1');await nextTick();expect(script.value).toBe('A little care makes all the difference.')
  expect(script.value).not.toContain('Create a voice');w.unmount()
})
