<template>
  <StudioPage :chat-expanded="isAgent && chatExpanded" title="Enhance" :purpose="feature.purpose" :active-tab="tab" @update:active-tab="tab = $event">
    <template #form>
      <StudioModeSwitch /><StudioFirstVisit :hidden="hintHidden" @dismiss="dismissHint" />
      <p v-if="loading" class="st-status" role="status">Opening your session...</p><div v-if="error" class="st-error" role="alert">{{ error }}<button type="button" class="st-button" @click="initialize">Try again</button></div>
      <InputSlot label="Source video" required :kinds="['video']" :limit="1" :allow-upload="false" :items="source ? [source] : []" @pick="pick" @remove="source = null" />
      <StudioAgentPanel v-show="isAgent" v-model="agentDraft" v-model:expanded="chatExpanded" label="Enhance" :purpose="feature.purpose" :ready="ready" @approved="tab = 'results'" />
      <div v-show="!isAgent" class="se-manual">
      <div class="se-tools" role="group" aria-label="Tools"><button v-for="tool in tools" :key="tool.id" type="button" class="st-button" :aria-pressed="operation === tool.id" :class="{ primary: operation === tool.id }" @click="chooseTool(tool)">{{ tool.label }}</button></div>
      <div v-if="operation === 'trim'" class="se-fields"><label class="st-field">Start (seconds)<input v-model.number="start" class="st-input" type="number" min="0" step="0.1" /></label><label class="st-field">End (seconds)<input v-model.number="end" class="st-input" type="number" min="0.1" step="0.1" /></label></div>
      <label v-if="operation === 'crop'" class="st-field">Output shape<select v-model="aspect" class="st-input"><option>16:9</option><option>9:16</option><option>1:1</option><option>4:5</option></select></label>
      <label v-if="operation === 'retime'" class="st-field">Playback speed<select v-model.number="factor" class="st-input"><option :value="0.5">0.5x</option><option :value="1">1x</option><option :value="1.5">1.5x</option><option :value="2">2x</option></select></label>
      <div v-if="operation === 'caption'" class="se-captions"><div v-for="(cue,index) in cues" :key="index" class="se-cue"><label class="st-field">Caption {{ index + 1 }}<textarea v-model="cue.text" class="st-input" maxlength="300" rows="2" /></label><div class="se-fields"><label class="st-field">Start (seconds)<input v-model.number="cue.start" class="st-input" type="number" min="0" step="0.1" /></label><label class="st-field">End (seconds)<input v-model.number="cue.end" class="st-input" type="number" min="0.1" step="0.1" /></label></div><button v-if="cues.length > 1" type="button" class="st-button" @click="cues.splice(index,1)">Remove caption</button></div><button type="button" class="st-button" @click="cues.push({ text: '', start: 0, end: 5 })">Add caption</button></div>
      <template v-if="operation === 'upscale'"><MediaRoutePicker v-model="upscaleRoute" operation="upscale" /><div class="se-fields"><label class="st-field">Enlarge by<select v-model.number="upscaleFactor" class="st-input" data-test="enhance-upscale-factor"><option :value="1.5">1.5×</option><option :value="2">2×</option><option :value="3">3×</option></select></label><label class="st-field">Detail<select v-model="upscaleMode" class="st-input" data-test="enhance-upscale-mode"><option value="precise">Precise</option><option value="creative">Creative</option></select></label></div><LivePrice v-bind="upscalePrice" empty="Choose the video and the model to see the price." /><p class="st-muted se-cost" data-test="enhance-upscale-mode-note">{{ upscaleMode === 'creative' ? 'Creative adds fine detail the footage did not have.' : 'Precise keeps the picture as it is, only larger.' }}</p></template>
      <template v-if="operation === 'extend'"><label class="st-field" data-field="route_id">Model<select v-model="extendRoute" class="st-input" required :disabled="extendLoading || !extendRoutes.length" data-test="enhance-extend-route"><option v-if="extendLoading" value="">Loading models…</option><option v-else-if="!extendRoutes.length" value="">No model you can use continues a clip yet</option><option v-for="r in extendRoutes" :key="r.route_id" :value="String(r.route_id)">{{ routeOptionLabel(r) }}</option></select></label><p v-if="extendFailure" class="st-error" role="alert">{{ extendFailure }}</p><label class="st-field">What happens next<textarea v-model="extendPrompt" class="st-input" rows="3" maxlength="1000" data-test="enhance-extend-prompt" /></label><label class="st-field">Added length<select v-model.number="extendSeconds" class="st-input" data-test="enhance-extend-length"><option :value="5">5 seconds</option><option :value="8">8 seconds</option><option :value="10">10 seconds</option></select></label><label v-if="extendResolutions.length" class="st-field">Resolution<select v-model="extendResolution" class="st-input" data-test="enhance-extend-resolution"><option v-for="r in extendResolutions" :key="r" :value="r">{{ r }}</option></select></label></template>
      <p class="st-muted se-cost">{{ currentTool?.paid ? 'This runs on a paid model. Its estimate waits in My results for your Generate; Decline spends nothing.' : 'A free edit on this server. The original stays in the Library.' }}</p>
      </div>
      <p v-if="formError" class="st-error" role="alert">{{ formError }}</p>
    </template>
    <template #presets><div class="se-intro"><h2>A finishing pass, one edit at a time</h2><p class="st-muted">Choose footage from your Library, then trim, reframe, retime or caption it for free, or upscale or extend it on a paid model. The original stays in the Library.</p><ul><li v-for="tool in tools" :key="tool.id"><button type="button" class="se-tool" @click="chooseTool(tool)"><strong>{{ tool.label }}</strong><span>{{ tool.purpose }}</span><span class="st-pill">{{ tool.paid ? 'Paid, estimate first' : 'Free local edit' }}</span></button></li></ul></div></template>
    <template #results><ResultsFeed v-if="ready" kind="enhance" :conversation-id="video.conversationId" @recreate="recreate" /></template>
    <template #quote><p v-if="isAgent" class="se-note st-muted">Ask the agent about your edit. Review any paid proposal on its card.</p><QuoteBar v-else :summary="`${currentTool?.label || 'Edit'} video`" :price-usd="currentTool?.paid ? null : 0" :shuffle="false" :action-label="currentTool?.paid ? 'Review estimate' : 'Apply edit'" :busy="busy || paidBusy" :disabled-reason="disabledReason" @generate="apply" /></template>
  </StudioPage>
</template>
<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import api from '../services/api'
import { routeOptionLabel } from '../utils/studioPrice'
import { useLivePrice } from '../composables/useLivePrice'
import LivePrice from '../components/studio/LivePrice.vue'
import { getStudioFeature } from '../services/studioFeatures'
import { useStudioSession } from '../composables/useStudioSession'
import StudioPage from '../components/studio/StudioPage.vue'
import StudioModeSwitch from '../components/studio/StudioModeSwitch.vue'
import StudioFirstVisit from '../components/studio/StudioFirstVisit.vue'
import StudioAgentPanel from '../components/studio/StudioAgentPanel.vue'
import { useStudioExperience } from '../composables/useStudioExperience'
import { useSessionProject } from '../composables/useSessionProject'
import InputSlot from '../components/studio/InputSlot.vue'
import QuoteBar from '../components/studio/QuoteBar.vue'
import MediaRoutePicker from '../components/studio/MediaRoutePicker.vue'
import { useMediaJob } from '../composables/useMediaJob'
import { useVideoStore } from '../stores/useVideoStore'
const ResultsFeed = defineAsyncComponent(() => import('../components/studio/ResultsFeed.vue'))
const { route, chat, video, ready, loading, error, initialize } = useStudioSession('video', { needsModel: false, page: 'enhance' })
const { isAgent, hintHidden, dismissHint } = useStudioExperience('enhance', route?.query?.useIn ? route.query.mode : null)
const agentDraft = ref(''), chatExpanded = ref(false)
watch(isAgent, agent => { if (!agent) chatExpanded.value = false })
const feature = getStudioFeature('enhance'), tab = ref('presets'), operation = ref('trim'), busy = ref(false), formError = ref('')
const queued = video.refs.find(ref => ref.role === 'edit_source' && ref.attachment_id)
const source = ref(queued ? { ...queued, title: queued.name, media_type: 'video' } : null)
const start = ref(0), end = ref(5), aspect = ref('9:16'), factor = ref(1), cues = ref([{ text: '', start: 0, end: 5 }]), records = new Map()
// The chosen tool goes to the agent with every message as the page's preset (studio_context), never as text.
watch([ready, operation], ([isReady]) => { if (isReady) chat.studioContext = { page: 'enhance', preset: operation.value, preset_title: tools.find(t => t.id === operation.value)?.label || '' } })
const tools = [{ id: 'trim', label: 'Trim', purpose: 'Keep the part between two times.' }, { id: 'crop', label: 'Crop / reframe', purpose: 'Fit the footage to a different shape.' }, { id: 'retime', label: 'Retime', purpose: 'Change the playback speed.' }, { id: 'caption', label: 'Captions', purpose: 'Add text at the times you choose.' },
  { id: 'upscale', label: 'Upscale', purpose: 'Enlarge the footage 1.5 to 3 times, at its own length.', paid: true }, { id: 'extend', label: 'Extend', purpose: 'Continue the clip from its last moment.', paid: true }]
const currentTool = computed(() => tools.find(tool => tool.id === operation.value))
// Upscale is a media job on a proven upscaler; Extend is a render on a model that continues a clip, or that starts a
// new shot from its last frame (the card then says so and asks). Both wait on their card for the person's Generate.
const store = useVideoStore()
const upscaleRoute = ref(''), upscaleFactor = ref(2), upscaleMode = ref('precise')
const extendRoutes = ref([]), extendRoute = ref(''), extendLoading = ref(false), extendFailure = ref(''), extendPrompt = ref('Continue the action naturally from its last moment.'), extendSeconds = ref(5)
const { busy: paidBusy, error: paidError, submit } = useMediaJob(job => { if (job?.job_id) { store._put(job); tab.value = 'results' } })
watch(paidError, e => { if (e) formError.value = e.response?.data?.error?.message || e.message || String(e) })
let extendLoaded = false, disposed = false
onBeforeUnmount(() => { disposed = true })
async function loadExtendRoutes() {
  if (extendLoaded) return
  extendLoaded = true; extendLoading.value = true; extendFailure.value = ''
  try {
    const answers = await Promise.all(['native_extend', 'image_to_video'].map(task => api.getStudioRoutes(task)))
    if (disposed) return
    const seen = new Set()
    extendRoutes.value = answers.flatMap(({ data }) => data.routes || []).filter(r => !seen.has(r.route_id) && seen.add(r.route_id))
    extendRoute.value = extendRoutes.value[0] ? String(extendRoutes.value[0].route_id) : ''
  } catch { if (!disposed) { extendFailure.value = 'Could not load the models.'; extendLoaded = false } }
  finally { if (!disposed) extendLoading.value = false }
}
watch(operation, op => { if (op === 'extend') loadExtendRoutes() }, { immediate: true })
// The size it is made at, the smallest first (live 2026-10-28: with none sent, quoted at 1080p, $0.71 for 5 s).
const extendResolution = ref('')
const extendResolutions = computed(() => extendRoutes.value.find(r => String(r.route_id) === extendRoute.value)?.schema?.properties?.resolution?.enum || [])
watch(extendResolutions, list => { extendResolution.value = list[0] || '' })
const { linkFromLibrary } = useSessionProject()
// A Library video from another chat is linked to this session's project (unpinned) before it is used, as on every
// creative page: the server then lets this chat's edit read it (2026-10-27: "no file with that id is available here").
async function pick(items) {
  const chosen = (items || [])[0]
  if (!chosen?.attachment_id) return
  formError.value = ''
  try { await linkFromLibrary([chosen], 'Enhance session') }
  catch (e) { formError.value = e.response?.data?.error?.message || e.message || 'That video could not be used here.'; return }
  source.value = chosen
}
function chooseTool(tool) { operation.value = tool.id; if (isAgent.value) agentDraft.value = `Use this preset: ${tool.label}.` }
watch(source, item => { if (item?.attachment_id && !video.refs.some(r => r.attachment_id === item.attachment_id)) video.addExistingRef(item, 'edit_source') })
const validTimes = (from,to) => Number.isFinite(Number(from)) && Number.isFinite(Number(to)) && Number(from) >= 0 && Number(to) > Number(from)
const disabledReason = computed(() => {
  if (!ready.value) return loading.value ? 'Wait for this session to open.' : 'Open a working Studio session first.'
  if (!source.value?.attachment_id) return 'Choose a source video from the Library.'
  if (!currentTool.value) return 'Choose a tool.'
  if (operation.value === 'upscale' && !upscaleRoute.value) return 'Choose a model that upscales.'
  if (operation.value === 'extend' && !extendRoute.value) return 'Choose a model that continues a clip.'
  if (operation.value === 'extend' && !extendPrompt.value.trim()) return 'Say what happens next.'
  if (operation.value === 'trim' && !validTimes(start.value,end.value)) return 'End must be after start, with a start of zero or more.'
  if (operation.value === 'caption' && cues.value.some(cue => !cue.text.trim() || !validTimes(cue.start,cue.end))) return 'Give every caption text and a valid start and end time.'
  if (operation.value === 'retime' && ![0.5,1,1.5,2].includes(factor.value)) return 'Choose a supported playback speed.'
  return ''
})
function params() {
  if (operation.value === 'trim') return { start_ms: Math.round(start.value*1000), end_ms: Math.round(end.value*1000) }
  if (operation.value === 'crop') return { aspect_ratio: aspect.value, focal_x: 0.5, focal_y: 0.5 }
  if (operation.value === 'retime') return { factor: factor.value, keep_pitch: true }
  return { cues: cues.value.map(cue => ({ text: cue.text.trim(), start_ms: Math.round(cue.start*1000), end_ms: Math.round(cue.end*1000) })), position: 'bottom' }
}
const upscaleQuote = useLivePrice(() => operation.value === 'upscale' && upscaleRoute.value && source.value?.attachment_id
  ? { kind: 'media', operation: 'upscale', route_id: upscaleRoute.value, request: { upscale_factor: upscaleFactor.value, mode: upscaleMode.value }, references: [{ attachment_id: source.value.attachment_id, role: 'edit_source' }], ...(video.conversationId ? { conversation_id: video.conversationId } : {}) } : null)
const upscalePrice = computed(() => ({ price: upscaleQuote.price.value, loading: upscaleQuote.loading.value, problem: upscaleQuote.problem.value }))
function applyPaid() {
  const base = source.value.attachment_id
  if (operation.value === 'upscale') return submit(s => api.prepareMediaJob({ operation: 'upscale', route_id: upscaleRoute.value, request: { upscale_factor: upscaleFactor.value, mode: upscaleMode.value }, references: [{ attachment_id: base, role: 'edit_source' }], ...s }))
  return submit(s => api.prepareVideoJob({ operation: 'extend', route_id: extendRoute.value, base_attachment_id: base, prompt: extendPrompt.value.trim(), params: { duration: extendSeconds.value, ...(extendResolution.value ? { resolution: extendResolution.value } : {}) }, references: [], ...s }))
}
async function apply() {
  if (disabledReason.value || busy.value || paidBusy.value) return
  formError.value = ''
  if (currentTool.value?.paid) return applyPaid()
  busy.value = true
  try {
    const record = { operation: operation.value, source: { ...source.value }, start: start.value, end: end.value, aspect: aspect.value, factor: factor.value, cues: cues.value.map(cue => ({ ...cue })) }
    const job = await video.local(operation.value, params(), { chat, baseAttachmentId: source.value.attachment_id })
    if (!job) { formError.value = 'The local edit could not start. Your choices are unchanged.'; return }
    records.set(job.job_id, record); tab.value = 'results'
  } catch { formError.value = 'The local edit could not start. Try again.' } finally { busy.value = false }
}
function recreate(item) {
  const record = records.get(item.job?.job_id)
  if (!record) { formError.value = 'Choose the source and set this edit again before applying.'; return }
  operation.value = record.operation; source.value = record.source; start.value = record.start; end.value = record.end; aspect.value = record.aspect; factor.value = record.factor; cues.value = record.cues.map(cue => ({ ...cue })); tab.value = 'presets'
}
</script>
<style scoped>
.se-manual{display:grid;gap:18px}.se-note{padding:16px;font-size:12px}.se-cost{font-size:12px;line-height:1.55}.se-tools{display:flex;flex-wrap:wrap;gap:7px}.se-tools button{font-size:12px;padding:8px 10px}.se-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.se-captions{display:grid;gap:14px}.se-cue{display:grid;gap:10px;padding:12px;border:1px solid var(--vm-line);border-radius:6px}.se-intro{display:grid;gap:15px;max-width:850px}.se-intro ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:0;margin:12px 0 0;list-style:none}.se-tool{display:flex;flex-direction:column;align-items:flex-start;gap:12px;width:100%;height:100%;min-height:180px;padding:22px;border:1px solid var(--vm-line);border-radius:7px;background:var(--vm-surface);color:var(--vm-ink);font:inherit;text-align:left;cursor:pointer}.se-tool:hover{background:var(--vm-surface-2)}.se-tool strong{font-size:18px;font-weight:600}.se-tool>span:not(.st-pill){color:var(--vm-ink-soft);font-size:13px}.se-tool .st-pill{margin-top:auto}@media(max-width:767px){.se-intro ul{gap:10px}.se-tool{padding:14px}.se-tool strong{font-size:16px}.se-tool>span:not(.st-pill){font-size:16px}}
</style>
