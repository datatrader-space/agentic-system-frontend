<template>
  <StudioPage :feature="feature" @new="newChat" :new-disabled="chat.isBusy || video.busy || !!chat.hitlRequests?.length" ref="page" :agent-mode="isAgent" :chat-expanded="isAgent && expanded" title="Elements" :purpose="feature.purpose" :active-tab="tab" work-label="Collection" @update:active-tab="tab = $event">
    <template #form><div class="st-tool-options"><StudioModeSwitch /><StudioPresetSelect :model-value="selectedId" :presets="presets" :disabled="chat.isBusy || video.busy" @update:model-value="choose" /></div><p v-if="session.error.value" class="st-error" role="alert">{{ session.error.value }} <button type="button" class="st-button" @click="session.initialize">Try again</button></p><StudioAgentPanel @new="newChat" :look="selected" v-show="isAgent" v-model="draft" v-model:expanded="expanded" label="Elements" :ready="session.ready.value" /><p v-if="!isAgent" class="st-muted">Manage your reusable characters, products, locations and styles in the existing collection. Choosing an Element never starts a generation.</p></template>
    <template #presets><StudioLookDetails v-if="selected" :look="selected" :disabled="chat.isBusy || video.busy" @apply="choose" /><VideoStudioLibrary embedded /></template>
    <template #looks><PresetGallery :presets="presets" :selected="selectedId" @select="choose($event.id)" /></template>
    <template #versions><StudioVersions /></template>
    <template #results><StudioJobList :ids="jobs" /><AgentMadeMedia :conversation-id="chat.conversationId" /></template>
  </StudioPage>
</template>
<script setup>
import { useStudioPresetRoute } from '../composables/useStudioPresetRoute'
const syncPresetRoute = useStudioPresetRoute()
import { useStudioToolDraft } from '../composables/useStudioToolDraft'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getStudioFeature } from '../services/studioFeatures'
import { presetsFor, composePreset } from '../services/studioPresets'
import { useStudioExperience } from '../composables/useStudioExperience'
import { useStudioSession } from '../composables/useStudioSession'
import StudioPage from '../components/studio/StudioPage.vue'
import StudioVersions from '../components/studio/StudioVersions.vue'
import StudioModeSwitch from '../components/studio/StudioModeSwitch.vue'
import StudioPresetSelect from '../components/studio/StudioPresetSelect.vue'
import StudioLookDetails from '../components/studio/StudioLookDetails.vue'
import StudioAgentPanel from '../components/studio/StudioAgentPanel.vue'
import PresetGallery from '../components/studio/PresetGallery.vue'
import StudioJobList from '../components/studio/StudioJobList.vue'
import AgentMadeMedia from '../components/studio/AgentMadeMedia.vue'
import VideoStudioLibrary from './VideoStudioLibrary.vue'
const route = useRoute(), session = useStudioSession('elements', { needsModel: false }), { chat, video } = session
const { isAgent } = useStudioExperience('elements', route.query.mode), feature = getStudioFeature('elements')
const presets = presetsFor('elements'), selectedId = ref(presets.some(p => p.id === route.query.preset) ? route.query.preset : '')
const selected = computed(() => presets.find(p => p.id === selectedId.value)), draft = ref(selected.value ? composePreset(selected.value) : ''), expanded = ref(false), tab = ref('presets')
const page = ref(null), jobs = computed(() => video.jobsFor(chat.conversationId).map(job => job.job_id))
function choose(value) { if (chat.isBusy || video.busy) return; const look = typeof value === 'string' ? presets.find(p=>p.id===value) : value; selectedId.value = look?.id || ''; syncPresetRoute(look?.id, video.studioMode); if (look) draft.value = composePreset(look); if (isAgent.value) page.value?.focusInputs() }
async function newChat() { if (await session.freshStart()) { draft.value = ''; selectedId.value = ''; tab.value = 'presets' } }
useStudioToolDraft('elements', draft, selectedId)
</script>
