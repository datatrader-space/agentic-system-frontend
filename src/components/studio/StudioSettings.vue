<template>
  <BottomSheet label="Model and settings" :summary="kind === 'image' ? `${video.image.aspect_ratio}, ${video.image.n} image(s)` : `${video.settings.duration} s, ${video.settings.aspect_ratio}`" test-id="studio-settings" v-slot="{ sheet }">
    <!-- One form for every model, built from the chosen model's own schema (GET /api/video/routes/, F1): a setting
         the model does not declare is not offered, and its values are only the ones it declares. -->
    <div class="ss" role="group" aria-label="Model and settings"><VideoModelPicker two-line :kind="kind" :in-sheet="sheet" />
      <template v-for="field in fields" :key="field.key">
        <VideoChoice v-if="field.kind === 'choice'" :model-value="target[field.key]" :options="optionsOf(field)" :label="labelOf(field)" :in-sheet="sheet" :test-id="testIdOf(field)" @update:model-value="value => target[field.key] = value" />
        <button v-else type="button" class="st-button" :aria-pressed="!!target[field.key]" :data-test="testIdOf(field)" @click="target[field.key] = !target[field.key]">{{ target[field.key] ? `${labelOf(field)} on` : `${labelOf(field)} off` }}</button>
      </template>
      <button v-if="kind === 'video' && model && !fields.some(f => f.key === 'sound')" type="button" class="st-button" disabled>Silent video</button>
    </div>
    <p v-if="loading" class="st-muted ss-note" role="status" data-test="studio-settings-loading">Loading this model's settings…</p>
    <p v-else-if="failure" class="st-error ss-note" role="alert" data-test="studio-settings-error">{{ failure }} <button type="button" class="st-link ss-retry" @click="load">Try again</button></p>
    <p v-else-if="!model && pickedId" class="st-muted ss-note" role="status" data-test="studio-settings-none">This model has no settings to choose; it uses its own defaults.</p>
    <p v-if="kind === 'video' && video.referenceLimits?.summary" class="st-muted ss-refs" data-test="studio-reference-summary">{{ video.referenceLimits.summary }}</p>
    <div v-if="video.pendingSwitch" class="st-error" role="alert" data-test="studio-model-change"><strong>Review the model change</strong><p v-for="change in video.pendingSwitch.changes" :key="change.field">{{ change.label }}: {{ change.from }} to {{ change.toLabel }}</p><p v-for="reference in video.pendingSwitch.unusable" :key="reference.key">{{ reference.name }}: {{ reference.reason }}</p><div class="ss-actions"><button type="button" class="st-button" @click="video.keepCurrentModel()">Keep current model</button><button type="button" class="st-button" @click="video.applySwitch()">Switch and apply changes</button></div></div>
  </BottomSheet>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'
import { loadStudioRoutes, routeFor, schemaFields } from '../../services/studioModelRoutes'
import BottomSheet from '../video/BottomSheet.vue'
import VideoChoice from '../video/VideoChoice.vue'
import VideoModelPicker from '../video/VideoModelPicker.vue'
const props = defineProps({ kind: { type: String, required: true } })
const video = useVideoStore()
// The person's words for the settings every model shares; any other setting keeps its schema title.
const LABELS = { aspect_ratio: 'Shape', n: 'How many', duration: 'Clip length', resolution: 'Resolution', sound: 'Sound' }
const TEST_IDS = { image: { aspect_ratio: 'image-aspect', n: 'image-count' }, video: { aspect_ratio: 'video-aspect', duration: 'video-length', resolution: 'video-resolution', sound: 'video-sound' } }
const routes = ref([]), loading = ref(false), failure = ref('')
let seq = 0, disposed = false
async function load() {
  const mine = ++seq
  loading.value = true; failure.value = ''
  try {
    const list = await loadStudioRoutes([props.kind === 'image' ? 'text_to_image' : ''])
    if (!disposed && mine === seq) routes.value = list.filter(r => r.kind === props.kind)
  } catch { if (!disposed && mine === seq) { routes.value = []; failure.value = "Could not load this model's settings." } }
  finally { if (!disposed && mine === seq) loading.value = false }
}
watch(() => props.kind, load, { immediate: true })
onBeforeUnmount(() => { disposed = true })
const pickedId = computed(() => props.kind === 'image' ? (video.imageModel?.model_id ?? '') : (video.routeId || video.defaultRouteId || ''))
const model = computed(() => routeFor(routes.value, props.kind === 'image' ? { modelId: pickedId.value } : { routeId: pickedId.value }))
const fields = computed(() => schemaFields(model.value))
const target = computed(() => props.kind === 'image' ? video.image : video.settings)
const labelOf = field => LABELS[field.key] || field.title
const testIdOf = field => TEST_IDS[props.kind]?.[field.key] || `${props.kind}-${field.key}`
const optionsOf = field => field.values.map(value => ({ value, label: String(value) + (field.unit ? ` ${field.unit}` : '') }))
</script>
<style scoped>
.ss{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ss-refs,.ss-note{margin-top:8px;font-size:12px;line-height:1.55}.ss-retry{padding:0;border:0;background:none;font:inherit;color:inherit;text-decoration:underline;cursor:pointer}.ss>:first-child{flex-basis:100%}.ss-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.ss :deep(.vmp){min-width:0;max-width:100%}.ss :deep(.vmp-pill){max-width:100%}.ss :deep(.vmp-panel){width:min(400px,calc(100vw - 50px))}.ss :deep(.vc-pill){max-width:100%}@media(max-width:767px){.ss{display:grid;grid-template-columns:minmax(0,1fr)}.ss :deep(button){min-height:44px}}
</style>
