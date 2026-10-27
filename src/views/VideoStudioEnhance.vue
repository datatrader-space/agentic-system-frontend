<template>
  <StudioPage :chat-expanded="isAgent && chatExpanded" title="Enhance" :purpose="feature.purpose" :active-tab="tab" @update:active-tab="tab = $event">
    <template #form>
      <StudioModeSwitch /><StudioFirstVisit :hidden="hintHidden" @dismiss="dismissHint" />
      <p v-if="loading" class="st-status" role="status">Opening your session...</p><div v-if="error" class="st-error" role="alert">{{ error }}<button type="button" class="st-button" @click="initialize">Try again</button></div>
      <InputSlot label="Source video" required :kinds="['video']" :limit="1" :allow-upload="false" :items="source ? [source] : []" @pick="pick" @remove="source = null" />
      <StudioAgentPanel v-show="isAgent" v-model="agentDraft" v-model:expanded="chatExpanded" label="Enhance" :purpose="feature.purpose" :ready="ready" @approved="tab = 'results'" />
      <div v-show="!isAgent" class="se-manual">
      <div class="se-tools" role="group" aria-label="Free local tools"><button v-for="tool in tools" :key="tool.id" type="button" class="st-button" :aria-pressed="operation === tool.id" :class="{ primary: operation === tool.id }" @click="chooseTool(tool)">{{ tool.label }}</button></div>
      <div v-if="operation === 'trim'" class="se-fields"><label class="st-field">Start (seconds)<input v-model.number="start" class="st-input" type="number" min="0" step="0.1" /></label><label class="st-field">End (seconds)<input v-model.number="end" class="st-input" type="number" min="0.1" step="0.1" /></label></div>
      <label v-if="operation === 'crop'" class="st-field">Output shape<select v-model="aspect" class="st-input"><option>16:9</option><option>9:16</option><option>1:1</option><option>4:5</option></select></label>
      <label v-if="operation === 'retime'" class="st-field">Playback speed<select v-model.number="factor" class="st-input"><option :value="0.5">0.5x</option><option :value="1">1x</option><option :value="1.5">1.5x</option><option :value="2">2x</option></select></label>
      <div v-if="operation === 'caption'" class="se-captions"><div v-for="(cue,index) in cues" :key="index" class="se-cue"><label class="st-field">Caption {{ index + 1 }}<textarea v-model="cue.text" class="st-input" maxlength="300" rows="2" /></label><div class="se-fields"><label class="st-field">Start (seconds)<input v-model.number="cue.start" class="st-input" type="number" min="0" step="0.1" /></label><label class="st-field">End (seconds)<input v-model.number="cue.end" class="st-input" type="number" min="0.1" step="0.1" /></label></div><button v-if="cues.length > 1" type="button" class="st-button" @click="cues.splice(index,1)">Remove caption</button></div><button type="button" class="st-button" @click="cues.push({ text: '', start: 0, end: 5 })">Add caption</button></div>
      <p class="st-muted">These edits use the existing local tools. They do not call a paid generation provider.</p><div class="se-soon"><button type="button" class="st-button" disabled>Upscale <span class="st-pill">Soon</span></button><button type="button" class="st-button" disabled>Extend <span class="st-pill">Soon</span></button></div>
      </div>
      <p v-if="formError" class="st-error" role="alert">{{ formError }}</p>
    </template>
    <template #presets><div class="se-intro"><h2>A finishing pass, one edit at a time</h2><p class="st-muted">Choose footage from your Library, then set a trim, reframe, playback speed or timed captions. The original stays in the Library.</p><ul><li v-for="tool in tools" :key="tool.id"><button type="button" class="se-tool" @click="chooseTool(tool)"><strong>{{ tool.label }}</strong><span>{{ tool.purpose }}</span><span class="st-pill">Free local edit</span></button></li></ul></div></template>
    <template #results><ResultsFeed v-if="ready" kind="enhance" :conversation-id="video.conversationId" @recreate="recreate" /></template>
    <template #quote><p v-if="isAgent" class="se-note st-muted">Ask the agent about your edit. Review any paid proposal on its card.</p><QuoteBar v-else :summary="`${tools.find(tool => tool.id === operation)?.label || 'Edit'} video`" :price-usd="0" :shuffle="false" action-label="Apply edit" :busy="busy" :disabled-reason="disabledReason" @generate="apply" /></template>
  </StudioPage>
</template>
<script setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue'
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
const tools = [{ id: 'trim', label: 'Trim', purpose: 'Keep the part between two times.' }, { id: 'crop', label: 'Crop / reframe', purpose: 'Fit the footage to a different shape.' }, { id: 'retime', label: 'Retime', purpose: 'Change the playback speed.' }, { id: 'caption', label: 'Captions', purpose: 'Add text at the times you choose.' }]
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
  if (!tools.some(tool => tool.id === operation.value)) return 'Choose a free local tool.'
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
async function apply() {
  if (disabledReason.value || busy.value) return
  busy.value = true; formError.value = ''
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
.se-manual{display:grid;gap:18px}.se-note{padding:16px;font-size:12px}.se-tools,.se-soon{display:flex;flex-wrap:wrap;gap:7px}.se-tools button{font-size:12px;padding:8px 10px}.se-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.se-captions{display:grid;gap:14px}.se-cue{display:grid;gap:10px;padding:12px;border:1px solid var(--vm-line);border-radius:6px}.se-intro{display:grid;gap:15px;max-width:850px}.se-intro ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:0;margin:12px 0 0;list-style:none}.se-tool{display:flex;flex-direction:column;align-items:flex-start;gap:12px;width:100%;height:100%;min-height:180px;padding:22px;border:1px solid var(--vm-line);border-radius:7px;background:var(--vm-surface);color:var(--vm-ink);font:inherit;text-align:left;cursor:pointer}.se-tool:hover{background:var(--vm-surface-2)}.se-tool strong{font-size:18px;font-weight:600}.se-tool>span:not(.st-pill){color:var(--vm-ink-soft);font-size:13px}.se-tool .st-pill{margin-top:auto}@media(max-width:767px){.se-intro ul{gap:10px}.se-tool{padding:14px}.se-tool strong{font-size:16px}.se-tool>span:not(.st-pill){font-size:16px}}
</style>
