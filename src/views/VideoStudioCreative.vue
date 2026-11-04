<template>
  <StudioPage :feature="feature" @new="newChat" :new-disabled="chat.isBusy || video.busy || !!chat.hitlRequests?.length" :agent-mode="isAgent" ref="page" :chat-expanded="isAgent && chatExpanded" :title="isAgent && selected ? selected.title : feature.label" :purpose="isAgent && selected ? selected.purpose : feature.purpose" :active-tab="tab" :work-label="isAgent ? 'Preview' : hasMonitor ? 'Preview' : 'Workspace'" @update:active-tab="tab = $event">
    <template #form>
      <div class="st-tool-options"><StudioModeSwitch /><StudioPresetSelect :model-value="selectedId" :presets="presets" :disabled="chat.isBusy || video.busy" @update:model-value="choosePreset" /></div>

      <p v-if="loading" class="st-status" role="status">Checking availability…</p>
      <p v-if="failure" class="st-error" role="alert">{{ failure }} <button type="button" class="st-button" @click="load">Try again</button></p>
      <div v-if="availability && !availability.ready" class="sc-blocked" role="status" data-test="studio-not-ready">
        <p>{{ availability.reason }}</p>
        <p v-if="providerNeeded" class="st-muted">The platform's models for this are added by a platform administrator.</p>
      </div>
      <p v-if="templateMessage" class="st-error" role="alert" data-test="studio-template-message">{{ templateMessage }}</p>
      <p v-if="session.error.value" class="st-error" role="alert">{{ session.error.value }} <button type="button" class="st-button" @click="session.initialize">Try again</button></p>
      <StudioAgentPanel @new="newChat" @sent="toolDraft.forget()" :look="selected" v-show="isAgent" v-model="agentDraft" v-model:expanded="chatExpanded" :label="feature.label" :purpose="feature.purpose" :ready="session.ready.value" @approved="tab = 'results'" />
      <div v-show="!isAgent" class="sc-manual" data-test="studio-manual">
        <template v-if="availability?.ready">
          <CreativeMusic v-if="featureId === 'music'" @job="addJob" />
          <CreativeAudio v-else-if="featureId === 'audio'" @job="addJob" />
          <CreativeImageEdit v-else-if="featureId === 'edit'" @job="addJob" />
          <CreativeCharacters v-else-if="featureId === 'characters'" @job="addJob" />
          <CreativeIdentity v-else-if="featureId === 'identity-training'" @job="addJob" />
          <CreativeLikeness v-else-if="['motion','avatar','lipsync'].includes(featureId)" :kind="featureId" @job="addJob" />
          <CreativeSwap v-else-if="featureId === 'swap'" @job="addJob" />
          <CreativeMarketing v-else-if="['marketing','ad-remix','effects'].includes(featureId)" :kind="featureId" @job="addJob" />
          <RouterLink v-else-if="featureId === 'canvas'" class="st-button" to="/dashboard/workflow-builder">Open workflow builder</RouterLink>
        </template>
      </div>
    </template>
    <template #presets>
      <template v-if="isAgent"><StudioLookPreview v-if="selected" :look="selected" @select="choosePreset($event)" /><StudioCreativeCanvas v-else /></template>
      <div v-show="!isAgent">
      <template v-if="hasMonitor">
        <div :id="monitorId" class="sc-monitor" />
        <p v-if="!availability?.ready" class="st-empty"><strong>Nothing on the monitor yet</strong>{{ feature.purpose }} The files you work on show here once this page can run.</p>
      </template>
      <template v-else>
        <p class="st-muted">{{ feature.purpose }} Review every paid proposal in My results, then choose Generate or Decline on its card.</p>
        <template v-if="availability?.ready">
          <CreativeBoard v-if="['storyboard','cinema','editor'].includes(featureId)" :kind="featureId" @job="addJob" />
          <CreativeMarketing v-else-if="featureId === 'ads'" :kind="featureId" @job="addJob" />
          <CreativeNarrative v-else-if="['shorts','explainer'].includes(featureId)" :kind="featureId" @job="addJob" />
        </template>
      </template>
      </div>
    </template>
    <template #looks><PresetGallery :presets="presets" :selected="selectedId" @select="choosePreset($event)" /></template>
    <template #versions><StudioVersions :type="versionType" /></template>
    <template #results><StudioJobList :ids="jobIds" /><AgentMadeMedia :conversation-id="chat.conversationId" :exclude="jobOutputs" @count="agentMade = $event" /><p v-if="!jobIds.length && !agentMade" class="st-empty"><strong>No results yet</strong>Each estimate you ask for appears here with its approval card. Nothing is spent until you choose Generate.</p></template>
    <template #quote><p class="sc-note st-muted">{{ isAgent ? 'Tell the agent what to make. Review any price on its approval card.' : 'Each estimate waits in My results for your Generate. Decline spends nothing.' }}</p></template>
  </StudioPage>
</template>
<script setup>
import { useStudioPresetRoute } from '../composables/useStudioPresetRoute'
const syncPresetRoute = useStudioPresetRoute()
import { useStudioToolDraft } from '../composables/useStudioToolDraft'
import { computed, onBeforeUnmount, provide, ref, useId, watch } from 'vue'
import { getStudioFeature, loadStudioFeatures } from '../services/studioFeatures'
import { useStudioSession } from '../composables/useStudioSession'
import { useRoute, useRouter } from 'vue-router'
import { useStudioTemplates, templateLook } from '../composables/useStudioTemplates'
import { presetsFor, composePreset } from '../services/studioPresets'
import { LOOK_ID } from '../services/studioLooks'
import StudioPresetSelect from '../components/studio/StudioPresetSelect.vue'
import StudioCreativeCanvas from '../components/studio/StudioCreativeCanvas.vue'
import StudioLookPreview from '../components/studio/StudioLookPreview.vue'
import PresetGallery from '../components/studio/PresetGallery.vue'
import { useStudioExperience } from '../composables/useStudioExperience'
import StudioPage from '../components/studio/StudioPage.vue'
import StudioVersions from '../components/studio/StudioVersions.vue'
import StudioJobList from '../components/studio/StudioJobList.vue'
import AgentMadeMedia from '../components/studio/AgentMadeMedia.vue'
import StudioModeSwitch from '../components/studio/StudioModeSwitch.vue'
import StudioAgentPanel from '../components/studio/StudioAgentPanel.vue'
import CreativeMusic from '../components/studio/CreativeMusic.vue'
import CreativeAudio from '../components/studio/CreativeAudio.vue'
import CreativeImageEdit from '../components/studio/CreativeImageEdit.vue'
import CreativeCharacters from '../components/studio/CreativeCharacters.vue'
import CreativeIdentity from '../components/studio/CreativeIdentity.vue'
import CreativeLikeness from '../components/studio/CreativeLikeness.vue'
import CreativeSwap from '../components/studio/CreativeSwap.vue'
import CreativeBoard from '../components/studio/CreativeBoard.vue'
import CreativeMarketing from '../components/studio/CreativeMarketing.vue'
import CreativeNarrative from '../components/studio/CreativeNarrative.vue'
// Every making page has both modes: Agent (a chat with the Video Studio agent, told which page this is) and Manual
// (the page's own form). Either way a paid step is a job waiting for the person's Generate on its card.
const MONITOR_PAGES = ['audio','edit','characters','identity-training','motion','swap','effects','marketing','ad-remix','avatar','lipsync']
const props = defineProps({ featureId: { type: String, required: true } })
const feature = computed(() => getStudioFeature(props.featureId))
const session = useStudioSession(props.featureId, { needsModel: false, page: props.featureId })
const { chat, video } = session
const route = useRoute()
const { isAgent } = useStudioExperience(props.featureId, route.query.mode)
const page = ref(null), availability = ref(null), loading = ref(false), failure = ref(''), tab = ref('presets'), ids = ref([]), agentDraft = ref(''), chatExpanded = ref(false)
const presets = computed(() => presetsFor(props.featureId))
const selectedId = ref(presets.value.some(p => p.id === route.query.preset) ? route.query.preset : '')
const preparedLook = ref(null)
provide('studioPreparedLook', preparedLook)
// A template used here keeps its look's id with its own texts.
const selectedOverride = ref(null)
const selected = computed(() => selectedOverride.value && selectedOverride.value.id === selectedId.value ? selectedOverride.value : presets.value.find(p => p.id === selectedId.value))
function choosePreset(value) { if (chat.isBusy || video.busy) return; const preset = typeof value === 'string' ? presets.value.find(p => p.id === value) : value; selectedOverride.value = null; selectedId.value = preset?.id || ''; preparedLook.value = preset || null; syncPresetRoute(preset?.id, video.studioMode); if (preset) agentDraft.value = composePreset(preset); if (isAgent.value) page.value?.focusInputs() }
if (selected.value) { agentDraft.value = composePreset(selected.value); preparedLook.value = selected.value }
const hasMonitor = computed(() => MONITOR_PAGES.includes(props.featureId))
// The pages that make pictures list image versions; every other page lists video takes.
const versionType = computed(() => ['edit','characters'].includes(props.featureId) ? 'image' : 'video')
const monitorId = `studio-monitor-${useId()}`.replace(/[^a-zA-Z0-9_-]/g, '')
provide('studioMonitor', MONITOR_PAGES.includes(props.featureId) ? monitorId : '')
const providerNeeded = computed(() => ['no_proven_model','no_image_model','no_video_model'].includes(availability.value?.code))
// Results: the estimates asked for here, and every job of this Studio session (the agent's included).
const jobIds = computed(() => [...new Set([...ids.value, ...video.jobsFor(chat.conversationId).map(job => job.job_id)])])
const agentMade = ref(0)
// Every file a job card already shows (its result and, beside it, a picture job's other pictures), kept out of the
// agent's list so none is listed twice.
const jobOutputs = computed(() => jobIds.value.flatMap(id => { const j = video.jobs[id]; return [j?.output?.attachment_id, ...(j?.extra_outputs || []).map(x => x?.attachment_id)] }).filter(Boolean))
watch(isAgent, agent => { if (!agent) chatExpanded.value = false })
// What the agent and each Manual request are told about this page: the page, and the look or preset chosen on it
// (only an id the backend accepts; a look whose id it would refuse is sent as the page alone).
const pageContext = () => ({ page: props.featureId, ...(selected.value && LOOK_ID.test(selected.value.id || '') ? { preset: selected.value.id, preset_title: String(selected.value.title || '').slice(0, 200) } : {}) })
watch([session.ready, selectedId], ([ready]) => { if (ready) chat.studioContext = pageContext() }, { immediate: true })
let sequence = 0
async function load() {
  const seq = ++sequence
  availability.value = null; loading.value = true; failure.value = ''
  try {
    await loadStudioFeatures({ force: true })
    if (seq !== sequence) return
    availability.value = getStudioFeature(props.featureId)?.ready === undefined
      ? { ready: false, reason: 'This page is not available on this server.' } : getStudioFeature(props.featureId)
  } catch { if (seq === sequence) failure.value = 'Could not check availability. Try again.' }
  finally { if (seq === sequence) loading.value = false }
}
function addJob(job) { if (!job?.job_id) return; video._put(job); if (!ids.value.includes(job.job_id)) ids.value.push(job.job_id); tab.value = 'results' }
watch(() => session.ready.value && chat.conversationId, cid => { if (cid) video.loadJobs(cid) })
watch(() => props.featureId, () => { ids.value = []; tab.value = 'presets'; load() }, { immediate: true })
onBeforeUnmount(() => { sequence++ })
// A fresh chat starts without the previous look: neither the chosen preset nor the prepared look is sent again.
async function newChat() { if (await session.freshStart()) { agentDraft.value = ''; selectedId.value = ''; selectedOverride.value = null; preparedLook.value = null; templateMessage.value = ''; toolDraft.forget(); chat.studioContext = pageContext(); tab.value = 'presets' } }
const toolDraft = useStudioToolDraft(props.featureId, agentDraft, selectedId)
// "Use" on one of My templates opens this page with ?template=<id>: its prompt fills the agent's message and its
// texts fill the look's fields and the Manual form, as a look's prepared brief does. Nothing is sent, run or spent.
const myTemplates = useStudioTemplates(), templateMessage = ref('')
const router = useRouter()
let usedTemplate = ''
watch([() => myTemplates.ready.value, () => route.query.template], async ([listed, id]) => {
  if (!id) { usedTemplate = ''; return }
  if (!listed || usedTemplate === String(id)) return
  usedTemplate = String(id)
  const template = myTemplates.find(id)
  const base = template ? presets.value.find(p => p.id === template.base_look) : null
  if (!template || template.page !== props.featureId) templateMessage.value = 'This template is not on your account, or it is for another page.'
  else if (chat.isBusy || video.busy) templateMessage.value = 'Finish or stop the current request, then use the template again.'
  else {
    templateMessage.value = ''
    const look = templateLook(template, base)
    selectedOverride.value = base ? look : null; selectedId.value = base?.id || ''; preparedLook.value = look; agentDraft.value = template.prompt
    if (isAgent.value) page.value?.focusInputs()
  }
  await router.replace({ path: route.path, query: { ...route.query, template: undefined, preset: selectedId.value || undefined } })
}, { immediate: true })
</script>
<style scoped>
.sc-manual{display:grid;gap:18px}.sc-blocked{display:grid;gap:6px;padding:12px;border:1px solid var(--vm-line);border-radius:7px;background:var(--vm-surface-2);font-size:13px;line-height:1.55}.sc-note{padding:16px 24px;font-size:12px;line-height:1.6}.sc-monitor{min-width:0}@media(max-width:767px){.sc-note{padding:12px 16px}}
</style>
