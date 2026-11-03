<template>
  <header class="swb">
    <div class="swb-crumb"><span>Workspace</span><i>/</i><b>{{ title }}</b></div>
    <div class="swb-actions"><button ref="searchTrigger" type="button" class="swb-search" aria-label="Search templates, tools and projects" @click="openSearch">⌕ <span>Search templates, tools, projects</span><kbd>Ctrl K</kbd></button><button type="button" @click="emit('history', $event)">◷ <span>Chats</span></button><button ref="jobsTrigger" type="button" aria-label="Open jobs for this conversation" @click="openJobs">◴ <span>{{ currentJobs.length }} jobs</span></button><span class="swb-avatar" aria-label="Your workspace">{{ initials }}</span></div>
  </header>
  <dialog ref="searchDialog" class="swb-dialog" aria-labelledby="swb-search-title" @close="finishSearch"><header><h2 id="swb-search-title">Find your next starting point.</h2><button type="button" aria-label="Close search" @click="searchDialog.close()">×</button></header><label class="swb-query"><span class="st-sr">Search Studio</span><input ref="searchInput" v-model="query" type="search" placeholder="A tool, look or project…" /></label><p v-if="projectError" class="swb-note">{{ projectError }}</p><div class="swb-results"><section v-for="group in results" :key="group.label"><h3>{{ group.label }}</h3><RouterLink v-for="item in group.items" :key="item.id" :to="item.to" @click="searchDialog.close()"><span>{{ item.label }}<small>{{ item.description }}</small></span><span>↗</span></RouterLink></section><p v-if="!results.length" class="swb-note">No matches. Try a different phrase.</p></div><footer>Tools and ready-made looks · {{ projects.length }} loaded projects</footer></dialog>
  <dialog ref="jobsDialog" class="swb-dialog" aria-labelledby="swb-jobs-title" @close="jobsTrigger?.focus()"><header><div><h2 id="swb-jobs-title">Your generation queue.</h2><p>Jobs in the open conversation, then your recent ones in other chats.</p></div><button type="button" aria-label="Close jobs" @click="jobsDialog.close()">×</button></header><div class="swb-job-list"><VideoJobCard v-for="job in currentJobs" :key="job.job_id" :job="job" in-studio @open="openResult(job, $event)" /><p v-if="!currentJobs.length" class="swb-empty">No jobs in this conversation yet. Start with an idea or a ready-made look.</p><section v-if="recentJobs.length || recent.loading || recent.error" class="swb-recent" aria-labelledby="swb-recent-title" data-test="swb-recent"><h3 id="swb-recent-title">Recent in your account</h3><VideoJobCard v-for="job in recentJobs" :key="job.job_id" :job="job" in-studio @open="openResult(job, $event)" /><p v-if="recent.loading" class="swb-note" role="status">Loading your recent jobs…</p><p v-if="recent.error" class="swb-note" role="alert">{{ recent.error }} <button type="button" @click="loadRecent(recent.page + 1)">Try again</button></p><button v-if="recent.hasMore && !recent.loading && !recent.error" type="button" data-test="swb-recent-more" @click="loadRecent(recent.page + 1)">Show older jobs</button></section></div></dialog>
  <MediaViewer v-if="previewItems.length" :items="previewItems" v-model:index="previewIndex" @close="previewJob = null" @leave="previewJob = null" />
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { studioFeatures } from '../../services/studioFeatures'
import { studioLooks } from '../../services/studioLooks'
import { useChatStore } from '../../stores/useChatStore'
import { useVideoStore } from '../../stores/useVideoStore'
import VideoJobCard from '../video/VideoJobCard.vue'
import api from '../../services/api'
import { lazyComponent } from '../../utils/lazyComponent'
const MediaViewer = lazyComponent(() => import('../video/MediaViewer.vue'))
const previewJob = ref(null), previewIndex = ref(0)
// A job's result and the other pictures of the same request (extra_outputs), in that order.
const previewItems = computed(() => { const job = previewJob.value; if (!job) return []; const kind = job.modality || (job.operation === 'frame' ? 'image' : 'video'); return [job.output, ...(job.extra_outputs || [])].filter(x => x?.url).map(x => ({ ...x, media_type: kind })) })
const props = defineProps({ title: String, user: Object })
const emit = defineEmits(['history'])
const chat = useChatStore(), video = useVideoStore()
const query = ref(''), projects = ref([]), projectError = ref(''), searchDialog = ref(null), jobsDialog = ref(null), searchInput = ref(null), searchTrigger = ref(null), jobsTrigger = ref(null)
let sequence = 0
const initials = computed(() => String(props.user?.username || props.user?.email || 'You').slice(0,2).toUpperCase())
const currentJobs = computed(() => chat.conversationId ? video.jobsFor(chat.conversationId).slice().reverse() : [])
// The person's recent jobs in any of their chats (GET /video/jobs/ with no conversation, newest first), read when the
// queue opens. Kept here, not in the store, so another chat's result never becomes this chat's preview.
const recent = ref({ ids: [], rows: {}, page: 0, hasMore: false, loading: false, error: '' })
let recentSequence = 0
const recentJobs = computed(() => { const here = new Set(currentJobs.value.map(job => job.job_id)); return recent.value.ids.filter(id => !here.has(id)).map(id => video.jobs[id] || recent.value.rows[id]).filter(Boolean) })
async function loadRecent(page = 1) {
  const seq = ++recentSequence
  recent.value = { ...(page === 1 ? { ids: [], rows: {} } : recent.value), page: page === 1 ? 0 : recent.value.page, hasMore: false, loading: true, error: '' }
  try {
    const res = await video.fetchJobs({ page })
    if (seq !== recentSequence) return
    const rows = { ...recent.value.rows }, ids = [...recent.value.ids]
    for (const job of res.jobs) if (job?.job_id) { if (!rows[job.job_id]) ids.push(job.job_id); rows[job.job_id] = job }
    recent.value = { ids, rows, page: res.page, hasMore: res.hasMore && res.jobs.length > 0, loading: false, error: '' }
  } catch { if (seq === recentSequence) recent.value = { ...recent.value, loading: false, error: 'Your recent jobs could not be loaded.' } }
}
const results = computed(() => {
  const q = query.value.trim().toLowerCase(), match = value => value.toLowerCase().includes(q)
  return [
    { label: 'Tools', items: studioFeatures.value.filter(f => f.id !== 'home' && match(f.label+' '+f.purpose)).map(f => ({id:f.id,label:f.label,description:f.purpose,to:{path:f.route,query:{mode:'agent'}}})) },
    { label: 'Ready-made looks', items: studioLooks.filter(l => match(l.title+' '+l.purpose)).map(l => ({id:l.id,label:l.title,description:l.purpose,to:{path:'/video-studio/'+l.feature,query:{preset:l.id,mode:'agent'}}})) },
    { label: 'Projects', items: projects.value.filter(p => match(p.title || '')).map(p => ({id:p.project_id,label:p.title || 'Untitled project',description:'Continue your project',to:{path:'/video-studio/dashboard',query:p.conversation_id?{conversation:String(p.conversation_id)}:{project:p.project_id}}})) },
  ].map(g => ({...g,items:g.items.slice(0,q?15:5)})).filter(g=>g.items.length)
})
async function openSearch() {
  searchDialog.value?.showModal(); await nextTick(); searchInput.value?.focus()
  const seq = ++sequence; projects.value=[]; projectError.value=''
  try { const {data}=await api.get('/video/projects/'); if(seq===sequence) projects.value=data.projects || [] }
  catch { if(seq===sequence) projectError.value='Projects could not be loaded. Tools and looks are still available.' }
}
function finishSearch() { sequence++; searchTrigger.value?.focus() }
defineExpose({ openSearch })
function openJobs() { jobsDialog.value?.showModal(); loadRecent(1) }
function openResult(job, index) { jobsDialog.value?.close(); previewJob.value = job; previewIndex.value = Number.isInteger(index) ? index : 0 }
function shortcut(event) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='k' && !event.altKey) { event.preventDefault(); openSearch() } }
watch(()=>props.user?.id,()=>{sequence++;recentSequence++;recent.value={ids:[],rows:{},page:0,hasMore:false,loading:false,error:''};projects.value=[];query.value='';previewJob.value=null;searchDialog.value?.close();jobsDialog.value?.close()})
watch(()=>chat.conversationId,()=>{previewJob.value=null;jobsDialog.value?.close()})
onMounted(()=>window.addEventListener('keydown',shortcut))
onBeforeUnmount(()=>{sequence++;recentSequence++;window.removeEventListener('keydown',shortcut)})
</script>
<style scoped>
.swb{display:flex;align-items:center;justify-content:space-between;gap:16px;height:66px;flex-shrink:0;padding:0 30px;border-bottom:1px solid var(--vm-line-2);background:var(--vm-bg)}.swb-crumb{display:flex;gap:14px;align-items:center;font-size:11px;color:var(--vm-ink-faint)}.swb-crumb b{font-weight:500;color:var(--vm-ink)}.swb-crumb i{font-style:normal;opacity:.4}.swb-actions{display:flex;gap:10px;align-items:center}.swb button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:36px;padding:8px 11px;border:1px solid var(--vm-line);border-radius:7px;background:var(--vm-surface);color:var(--vm-ink-soft);font:500 11px var(--vm-font-sans);cursor:pointer}.swb .swb-search{border-color:transparent;background:none}.swb kbd{font:inherit;font-size:9px;border:1px solid var(--vm-line);padding:3px 5px;border-radius:4px}.swb-avatar{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:var(--vm-surface-2);border:1px solid var(--vm-line);font-size:9px;color:var(--vm-ink-soft)}.swb-dialog{width:min(680px,calc(100vw - 24px));max-height:85dvh;padding:0;border:1px solid var(--vm-line);border-radius:12px;background:var(--vm-surface);color:var(--vm-ink);box-shadow:0 30px 100px #0008}.swb-dialog::backdrop{background:#080d14bd;backdrop-filter:blur(5px)}.swb-dialog header{padding:20px;display:flex;align-items:center;justify-content:space-between;gap:15px;border-bottom:1px solid var(--vm-line)}.swb-dialog h2{font-size:19px;margin:0;font-weight:500}.swb-dialog header button{border:0;background:none;color:inherit;font-size:22px;width:44px;height:44px;cursor:pointer}.swb-query{display:block;padding:16px 20px}.swb-query input{width:100%;padding:13px;border:1px solid var(--vm-line);border-radius:7px;background:var(--vm-bg);color:var(--vm-ink);font:inherit}.swb-results{overflow:auto;max-height:54dvh;padding:0 20px 20px}.swb-results h3{font-size:10px;color:var(--vm-ink-faint);text-transform:uppercase;letter-spacing:.1em;margin:15px 0 8px}.swb-results a{display:flex;justify-content:space-between;gap:20px;padding:12px 10px;border-radius:6px;color:var(--vm-ink);text-decoration:none;font-size:13px}.swb-results a:hover{background:var(--vm-surface-2)}.swb-results small{display:block;font-size:11px;color:var(--vm-ink-soft);margin-top:5px;line-height:1.6}.swb-note,.swb-empty{padding:20px;font-size:12px;color:var(--vm-ink-soft);line-height:1.8}.swb-dialog footer{padding:15px 20px;border-top:1px solid var(--vm-line);font-size:10px;color:var(--vm-ink-faint)}.swb-job-list{padding:20px;display:grid;gap:15px;max-height:60dvh;overflow:auto}.swb-dialog header p{font-size:12px;color:var(--vm-ink-soft);margin-top:5px}.swb-recent{display:grid;gap:15px;padding-top:15px;border-top:1px solid var(--vm-line)}.swb-recent h3{font-size:10px;color:var(--vm-ink-faint);text-transform:uppercase;letter-spacing:.1em;margin:0}.swb-recent>button{justify-self:start;min-height:44px}@media(max-width:1023px){.swb{height:56px;padding:0 12px 0 54px}.swb-crumb>span,.swb-crumb>i{display:none}.swb-actions{gap:5px}.swb button{min-height:40px;min-width:40px;padding:7px}.swb-search span,.swb kbd,.swb-avatar{display:none}.swb-dialog input{font-size:16px}}@media(max-width:480px){.swb-actions button>span{font-size:10px}.swb-crumb{max-width:105px;overflow:hidden;white-space:nowrap}.swb-crumb b{overflow:hidden;text-overflow:ellipsis}}
</style>
