<template>
  <StudioPage :title="feature.label" :purpose="feature.purpose" :active-tab="tab" @update:active-tab="tab = $event">
    <template #form>
      <p v-if="loading" role="status">Checking availability…</p>
      <p v-if="failure" class="st-error" role="alert">{{ failure }} <button class="st-button" @click="load">Try again</button></p>
      <template v-if="availability && !availability.ready">
        <p role="status">{{ availability.reason }}</p>
        <RouterLink v-if="providerNeeded" to="/dashboard/settings/providers">Settings → AI providers</RouterLink>
      </template>
      <template v-if="availability?.ready">
        <CreativeMusic v-if="featureId === 'music'" @job="addJob" />
        <CreativeMarketing v-else-if="['marketing','ad-remix'].includes(featureId)" :kind="featureId" @job="addJob" />
        <RouterLink v-else-if="featureId === 'canvas'" class="st-button" to="/dashboard/workflow-builder">Open workflow builder</RouterLink>
      </template>
    </template>
    <template #presets>
      <p class="st-muted">{{ feature.purpose }} Review every paid proposal in Results, then choose Generate or Decline on its card.</p>
      <template v-if="availability?.ready">
        <CreativeBoard v-if="['storyboard','cinema','editor'].includes(featureId)" :kind="featureId" @job="addJob" />
        <CreativeMarketing v-else-if="featureId === 'ads'" :kind="featureId" @job="addJob" />
        <CreativeNarrative v-else-if="['shorts','explainer'].includes(featureId)" :kind="featureId" @job="addJob" />
      </template>
    </template>
    <template #results><StudioJobList :ids="ids" /></template>
  </StudioPage>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import api from '../services/api'
import { getStudioFeature, studioFeatures } from '../services/studioFeatures'
import { useVideoStore } from '../stores/useVideoStore'
import StudioPage from '../components/studio/StudioPage.vue'
import StudioJobList from '../components/studio/StudioJobList.vue'
import CreativeMusic from '../components/studio/CreativeMusic.vue'
import CreativeBoard from '../components/studio/CreativeBoard.vue'
import CreativeMarketing from '../components/studio/CreativeMarketing.vue'
import CreativeNarrative from '../components/studio/CreativeNarrative.vue'
const props = defineProps({ featureId: { type: String, required: true } })
const feature = computed(() => getStudioFeature(props.featureId)), availability = ref(null), loading = ref(false), failure = ref(''), tab = ref('presets'), ids = ref([]), video = useVideoStore()
const providerNeeded = computed(() => ['no_proven_model','no_image_model','no_video_model'].includes(availability.value?.code))
let sequence = 0
async function load() {
  const seq = ++sequence
  availability.value = null; loading.value = true; failure.value = ''
  try {
    const { data } = await api.getStudioFeatures()
    if (seq !== sequence) return
    const rows = data.features || []
    availability.value = rows.find(row => row.id === props.featureId) || { ready: false, reason: 'This page is not available on this server.' }
    studioFeatures.value = studioFeatures.value.map(row => ({ ...row, ...(rows.find(item => item.id === row.id) || {}), route: row.route }))
  } catch { if (seq === sequence) failure.value = 'Could not check availability. Try again.' }
  finally { if (seq === sequence) loading.value = false }
}
function addJob(job) { if (!job?.job_id) return; video._put(job); if (!ids.value.includes(job.job_id)) ids.value.push(job.job_id); tab.value = 'results' }
watch(() => props.featureId, () => { ids.value = []; tab.value = 'presets'; load() }, { immediate: true })
onBeforeUnmount(() => { sequence++ })
</script>
