<template>
  <button ref="trigger" type="button" class="st-button spp-trigger" :disabled="blocked" @click="open"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 7h7l2 2h9v11H3V4h7l2 3" /></svg>Add to project</button>
  <dialog ref="dialog" class="spp-dialog" aria-labelledby="spp-title" @close="trigger?.focus()"><header><h2 id="spp-title">Add to project</h2><button type="button" aria-label="Close project picker" :disabled="saving" @click="dialog.close()">×</button></header><p>Keep this conversation and its creative work with an existing project.</p><p v-if="loading" role="status">Loading projects…</p><p v-if="error" role="alert">{{ error }}</p><label v-if="projects.length">Project<select v-model="selected" :disabled="saving"><option value="">Choose a project</option><option v-for="project in projects" :key="project.project_id" :value="String(project.project_id)">{{ project.title || 'Untitled project' }}</option></select></label><p v-else-if="!loading && !error">Your projects will appear here after you create one from Dashboard.</p><footer><button type="button" class="st-button primary" :disabled="!selected || saving || blocked" @click="save">{{ saving ? 'Adding…' : 'Add conversation' }}</button></footer></dialog>
</template>
<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import api from '../../services/api'
import { useChatStore } from '../../stores/useChatStore'
import { useVideoStore } from '../../stores/useVideoStore'
import { notify } from '../../composables/useNotify'
const chat=useChatStore(),video=useVideoStore(),user=inject('studioUser',ref(null))
const trigger=ref(null),dialog=ref(null),projects=ref([]),selected=ref(''),loading=ref(false),saving=ref(false),error=ref('')
let sequence=0
const blocked=computed(()=>chat.isBusy || video.busy || !!chat.hitlRequests?.length || !chat.selectedAgentId)
async function open(){
  if(blocked.value)return
  dialog.value?.showModal();selected.value='';projects.value=[];error.value='';loading.value=true
  const seq=++sequence
  try{const {data}=await api.get('/video/projects/');if(seq===sequence)projects.value=data.projects || []}
  catch{if(seq===sequence)error.value='Projects could not be loaded. Close this window and try again.'}
  finally{if(seq===sequence)loading.value=false}
}
async function save(){
  if(blocked.value || saving.value || !projects.value.some(p=>String(p.project_id)===selected.value))return
  const seq=sequence,projectId=selected.value
  saving.value=true;error.value=''
  try{
    const cid=await chat.ensureConversation()
    if(seq!==sequence || !cid || String(chat.conversationId)!==String(cid))return
    const {data}=await api.post(`/video/projects/${encodeURIComponent(projectId)}/open/`,{conversation_id:cid})
    if(seq!==sequence || String(chat.conversationId)!==String(cid))return
    if(String(data?.project_id)!==projectId)throw new Error('Unexpected project response')
    // Apply only the confirmed response for this account/conversation. A second unscoped
    // project read could otherwise finish after this picker has been invalidated.
    video.conversationId=cid;video.project=data;video.versions=[];video.loadVersions?.()
    dialog.value?.close();notify.success('Conversation added to project.')
  }catch{if(seq===sequence)error.value='This conversation could not be added. Your creative work is unchanged.'}
  finally{saving.value=false}
}
watch(()=>user.value?.id,()=>{sequence++;projects.value=[];selected.value='';dialog.value?.close()})
onBeforeUnmount(()=>{sequence++})
</script>
<style scoped>
.spp-trigger{gap:8px;background:#20252d;border-color:#3a414f;color:#c7d3e5;font-size:12px;min-height:38px}.spp-trigger svg{width:18px;height:18px}.spp-dialog{width:min(520px,calc(100vw - 24px));max-height:85dvh;padding:22px;border:1px solid #435169;border-radius:11px;background:#202733;color:#dce7f5}.spp-dialog::backdrop{background:#080d14cc;backdrop-filter:blur(5px)}.spp-dialog header{display:flex;justify-content:space-between;align-items:center;gap:18px}.spp-dialog h2{font-size:21px;font-weight:500}.spp-dialog header button{width:44px;height:44px;border:0;background:none;color:inherit;font-size:24px;cursor:pointer}.spp-dialog p{font-size:13px;line-height:1.8;margin:16px 0;color:#a4b4ca}.spp-dialog label{display:grid;gap:9px;font-size:12px}.spp-dialog select{width:100%;min-height:44px;padding:10px;background:#182130;color:#dce7f5;border:1px solid #435169;border-radius:7px;font:inherit}.spp-dialog footer{display:flex;justify-content:flex-end;margin-top:22px}@media(max-width:680px){.spp-trigger{font-size:11px;min-height:44px}.spp-dialog select{font-size:16px}}
</style>
