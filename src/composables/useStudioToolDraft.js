import { computed, inject, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { readStudioDraft, keepStudioDraft } from '../services/studioDraftMemory'
// Reuse existing tab-memory draft storage. No prompt, media or signed URL goes to browser persistence.
export function useStudioToolDraft(page, draft, selectedId) {
  const user=inject('studioUser',ref(null)),route=useRoute()
  const key=computed(()=>user.value?.id?`${user.value.id}:tool:${page}:${route?.query?.conversation || 'new'}`:'')
  let restoring=false, scopedUser=user.value?.id
  watch(key,(value,previous)=>{
    restoring=true
    const accountChanged=scopedUser!==user.value?.id
    scopedUser=user.value?.id
    const saved=value?readStudioDraft(value):null
    if(accountChanged){draft.value='';selectedId.value=''}
    else if(saved&&!route?.query?.preset){draft.value=saved.agentDraft || '';selectedId.value=saved.preset || ''}
    else if(previous&&previous!==value&&!route?.query?.preset){draft.value='';selectedId.value=''}
    restoring=false
  },{immediate:true,flush:'sync'})
  watch([draft,selectedId,key],()=>{if(!restoring&&key.value)keepStudioDraft(key.value,{agentDraft:draft.value,preset:selectedId.value})},{flush:'post'})
}
