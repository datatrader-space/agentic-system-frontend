<template>
  <BottomSheet label="Model and settings" :summary="kind === 'image' ? `${video.image.aspect_ratio}, ${video.image.n} image(s)` : `${video.settings.duration} s, ${video.settings.aspect_ratio}`" test-id="studio-settings" v-slot="{ sheet }">
    <div class="ss" role="group" aria-label="Model and settings"><VideoModelPicker two-line :kind="kind" :in-sheet="sheet" />
      <template v-if="kind === 'image'"><VideoChoice v-model="video.image.aspect_ratio" :options="imageShapes" label="Shape" :in-sheet="sheet" test-id="image-aspect" /><VideoChoice v-model="video.image.n" :options="counts" label="How many" :in-sheet="sheet" test-id="image-count" /></template>
      <template v-else><VideoChoice v-if="video.options.aspectRatios.length" v-model="video.settings.aspect_ratio" :options="choices(video.options.aspectRatios)" label="Shape" :in-sheet="sheet" test-id="video-aspect" /><VideoChoice v-if="video.options.durations.length" v-model="video.settings.duration" :options="choices(video.options.durations, ' s')" label="Clip length" :in-sheet="sheet" test-id="video-length" /><VideoChoice v-if="video.options.resolutions.length" v-model="video.settings.resolution" :options="choices(video.options.resolutions)" label="Resolution" :in-sheet="sheet" test-id="video-resolution" /><button type="button" class="st-button" :disabled="!video.options.audio" :aria-pressed="video.options.audio && video.settings.sound" @click="video.settings.sound = !video.settings.sound">{{ !video.options.audio ? 'Silent video' : video.settings.sound ? 'Sound on' : 'Sound off' }}</button></template>
    </div>
    <div v-if="video.pendingSwitch" class="st-error" role="alert" data-test="studio-model-change"><strong>Review the model change</strong><p v-for="change in video.pendingSwitch.changes" :key="change.field">{{ change.label }}: {{ change.from }} to {{ change.toLabel }}</p><p v-for="reference in video.pendingSwitch.unusable" :key="reference.key">{{ reference.name }}: {{ reference.reason }}</p><div class="ss-actions"><button type="button" class="st-button" @click="video.keepCurrentModel()">Keep current model</button><button type="button" class="st-button" @click="video.applySwitch()">Switch and apply changes</button></div></div>
  </BottomSheet>
</template>
<script setup>
import { computed } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'
import BottomSheet from '../video/BottomSheet.vue'
import VideoChoice from '../video/VideoChoice.vue'
import VideoModelPicker from '../video/VideoModelPicker.vue'
defineProps({ kind: { type: String, required: true } })
const video = useVideoStore()
const choices = (values, suffix = '') => values.map(value => ({ value, label: String(value) + suffix }))
const imageShapes = computed(() => choices(video.imageShapes))
const counts = choices([1,2,3,4])
</script>
<style scoped>
.ss{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ss>:first-child{flex-basis:100%}.ss-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.ss :deep(.vmp){min-width:0;max-width:100%}.ss :deep(.vmp-pill){max-width:100%}.ss :deep(.vmp-panel){width:min(400px,calc(100vw - 50px))}.ss :deep(.vc-pill){max-width:100%}@media(max-width:767px){.ss{display:grid;grid-template-columns:minmax(0,1fr)}.ss :deep(button){min-height:44px}}
</style>
