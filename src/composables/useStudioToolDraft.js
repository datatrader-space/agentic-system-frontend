import { computed, inject, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { studioDraftKey, readLocalDraft, keepLocalDraft, dropLocalDraft } from '../services/studioDrafts'
// A creative page's unsent agent text and chosen look, kept on this device for the signed-in person, this page and
// this conversation (services/studioDrafts.js): text and the look id only, never a file or a URL. forget() is called
// when the text is sent and when New chat starts fresh.
export function useStudioToolDraft(page, draft, selectedId) {
  const user=inject('studioUser',ref(null)),route=useRoute()
  const key=computed(()=>studioDraftKey(user.value?.id,page,route?.query?.conversation))
  // Every key the text on screen was written under since it was last sent or cleared: a send can give the chat its
  // conversation (a new key) before the composer empties, and the sent text must not stay under the old key.
  let restoring=false, scopedUser=user.value?.id
  const written=new Set()
  watch(key,(value,previous)=>{
    restoring=true
    const accountChanged=scopedUser!==user.value?.id
    scopedUser=user.value?.id
    const saved=value&&!accountChanged?readLocalDraft(value):null
    if(accountChanged){draft.value='';selectedId.value='';written.clear()}
    else if(saved&&!route?.query?.preset){draft.value=saved.agentDraft || '';selectedId.value=saved.preset || ''}
    else if(previous&&previous!==value&&!route?.query?.preset){draft.value='';selectedId.value=''}
    restoring=false
  },{immediate:true,flush:'sync'})
  watch([draft,selectedId,key],()=>{
    if(restoring||!key.value) return
    if(String(draft.value || '').trim()){keepLocalDraft(key.value,{agentDraft:draft.value,preset:selectedId.value || ''});written.add(key.value)}
    else dropLocalDraft(key.value)
  },{flush:'post'})
  function forget(){dropLocalDraft(key.value,...written);written.clear()}
  return { forget }
}
