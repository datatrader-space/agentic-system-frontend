<template>
  <div class="rf" data-test="studio-results-feed">
    <p v-if="loading" class="st-status" role="status">Loading this session...</p><div v-if="error" class="st-error" role="alert">{{ error }} <button type="button" class="st-button" @click="refresh">Try again</button></div>
    <HITLModal v-if="showApprovals && chat.hitlRequests.length" :requests="chat.hitlRequests" inline show-stop @respond="respond" @dismiss="chat.dismissHitl" @skip="chat.skipHitl" @stop="chat.stop" />
    <p v-if="chat.isBusy" class="st-status" role="status">The agent is preparing your request. Any paid run will ask for approval here.<button type="button" class="st-button" @click="chat.stop()">Stop</button></p>
    <p v-if="chat.error" class="st-error" role="alert">{{ chat.error }}</p>
    <VideoJobCard v-for="job in pending" :key="job.job_id" :job="job" in-studio />
    <div v-if="!loading && !error && !items.length && !pending.length && !chat.isBusy && !chat.hitlRequests.length" class="st-empty"><strong>No results in this session yet</strong>Choose a preset and fill its inputs. Generate prepares a request. Review the price on its card; image session approval follows your choice on that card.</div>
    <ul v-if="items.length" class="rf-grid" aria-label="Session results"><li v-for="item in items" :key="item.attachment_id" class="rf-card">
      <button type="button" class="rf-preview" :aria-label="`Preview ${item.title}`" @click="viewIndex = items.indexOf(item)"><img v-if="item.thumbnail_url" :src="item.thumbnail_url" alt="" loading="lazy" /><span v-else><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6"/></svg>Open {{ item.media_type }} preview</span></button>
      <div class="rf-title"><strong>{{ item.title }}</strong><span class="st-muted">{{ item.media_type }}</span></div><div class="rf-actions"><UseInMenu :item="item" :conversation-id="conversationId" /><button type="button" class="st-button" @click="emit('recreate', item)">Recreate</button><a :href="item.url" :download="item.title" class="st-button" target="_blank" rel="noopener noreferrer">Download</a></div>
    </li></ul>
    <MediaViewer v-if="viewIndex >= 0 && items[viewIndex]" :items="items" v-model:index="viewIndex" @close="viewIndex = -1" @leave="viewIndex = -1" />
  </div>
</template>
<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import api from '../../services/api'
import { usePoller } from '../../composables/usePoller'
import { rememberStudioOrigin } from '../../services/studioOrigins'
import { useChatStore } from '../../stores/useChatStore'
import { useVideoStore } from '../../stores/useVideoStore'
import HITLModal from '../HITLModal.vue'
import VideoJobCard from '../video/VideoJobCard.vue'
import MediaViewer from '../video/MediaViewer.vue'
import UseInMenu from './UseInMenu.vue'
const props = defineProps({ kind: { type: String, required: true }, conversationId: [String,Number], showApprovals: { type: Boolean, default: true } })
const emit = defineEmits(['recreate','approved'])
const chat = useChatStore(), video = useVideoStore()
const loading = ref(false), error = ref(''), viewIndex = ref(-1)
function respond(event) { chat.respondHitl(event); if (event.response_value === true || event.response_value?.approved === true) emit('approved') }
const localOps = ['trim','crop','retime','caption']
const jobs = computed(() => !props.conversationId ? [] : video.jobsFor(props.conversationId).filter(job => props.kind === 'enhance' ? localOps.includes(job.operation) : !localOps.includes(job.operation)))
const pending = computed(() => props.kind === 'image' ? [] : jobs.value.filter(job => job.state !== 'ready').slice().reverse())
const items = computed(() => props.kind === 'image' ? [...video.sessionImages].sort((a,b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)) : jobs.value.filter(job => job.state === 'ready' && job.output?.attachment_id && job.output?.url).slice().reverse().map(job => ({ ...job.output, title: job.effective_config?.prompt || 'Edited video', media_type: 'video', job, created_at: job.created_at })))
const user = inject('studioUser', ref(null))
watch(() => [user.value?.id, items.value], ([person, rows]) => { if (person) for (const item of rows) rememberStudioOrigin(person, 'attachment', item.attachment_id, props.kind) }, { immediate: true })
let sequence = 0, disposed = false, fetching = false
// A background poll (`{ background: true }`) never shows "Loading this session..." nor replaces the results with
// an error: it only refreshes them. Clicks and session changes still show both.
async function refresh(opts) {
  const background = opts?.background === true
  if (!props.conversationId || fetching || disposed) return
  fetching = true
  const seq = ++sequence, cid = String(props.conversationId)
  if (!background) { loading.value = true; error.value = '' }
  try {
    if (props.kind === 'image') {
      const { data } = await api.getConversationMedia(cid, { source: 'generated', type: 'image' })
      if (disposed || seq !== sequence || String(props.conversationId) !== cid) return
      video.sessionImages = (data.media || []).filter(item => item.attachment_id && item.url).map(item => ({ ...item, media_type: 'image', title: item.title || item.filename || 'Image' }))
    } else {
      const { data } = await api.get('/video/jobs/', { params: { conversation_id: cid } })
      if (disposed || seq !== sequence || String(props.conversationId) !== cid) return
      for (const job of data.jobs || []) if (String(job.conversation_id) === cid) video._put(job)
    }
    if (background) error.value = ''
  } catch { if (!disposed && seq === sequence && !background) error.value = 'Could not load this session. Your inputs are unchanged.' }
  finally { if (seq === sequence) { fetching = false; if (!disposed) loading.value = false } }
}
watch(() => props.conversationId, () => { sequence++; loading.value = false; error.value = ''; viewIndex.value = -1; if (props.kind === 'image') video.sessionImages = []; fetching = false; refresh() }, { immediate: true })
watch(() => chat.isBusy, (now, was) => { if (was && !now) refresh() })
const poller = usePoller(() => (chat.isBusy ? undefined : refresh({ background: true })), { interval: 8000 })
poller.start({ immediate: false })
onBeforeUnmount(() => { disposed = true; sequence++; poller.stop() })
defineExpose({ refresh })
</script>
<style scoped>
.rf{display:grid;gap:18px}.rf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:18px;list-style:none;padding:0;margin:0}.rf-card{min-width:0;display:flex;flex-direction:column;gap:12px;padding:12px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface)}.rf-preview{display:grid;place-items:center;aspect-ratio:4/3;width:100%;padding:0;border:0;border-radius:5px;overflow:hidden;background:var(--vm-bg);color:var(--vm-ink-soft);cursor:pointer}.rf-preview img{width:100%;height:100%;object-fit:contain}.rf-preview>span{display:grid;justify-items:center;gap:12px;font:400 13px var(--vm-font-sans)}.rf-preview svg{width:48px;height:48px}.rf-title{display:flex;align-items:start;gap:8px}.rf-title strong{flex:1;min-width:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:14px;font-weight:500;overflow-wrap:anywhere}.rf-title>span{font-size:11px}.rf-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}.rf-actions>.st-button{font-size:12px;padding-inline:10px}.rf :deep(.hitl-overlay--inline){position:static;inset:auto;display:block;padding:0;background:transparent;backdrop-filter:none;z-index:auto}.rf :deep(.hitl-overlay--inline .hitl-modal){position:static;width:100%;min-width:0;max-width:none;max-height:none;margin:0;box-shadow:none}.rf :deep(.hitl-overlay--inline .modal-body){max-height:400px}.rf :deep(.hitl-overlay--inline .icon){display:none}.rf :deep(.hitl-overlay--inline){color:var(--vm-ink)}
</style>
