<template>
  <!-- Captions made from speech (plan section 2.6): the clip's sound is transcribed on a paid model, whose estimate
       waits on its card for Generate; the words then become caption text on the timeline, to edit like any text. -->
  <section class="cc" aria-label="Captions from speech">
    <h3 class="cc-h">Captions from speech</h3>
    <template v-if="!jobId">
      <MediaRoutePicker v-model="routeId" operation="transcribe" label="Transcription model" />
      <button type="button" class="st-button" :disabled="!routeId || busy" @click="ask">{{ busy ? 'Asking for the estimate…' : 'Review transcription estimate' }}</button>
    </template>
    <template v-else>
      <VideoJobCard v-if="job" :job="job" in-studio />
      <button v-if="job?.state === 'ready'" type="button" class="st-button primary" :disabled="busy" @click="place">Put the captions on the timeline</button>
      <button type="button" class="st-button" @click="reset">{{ job?.state === 'ready' ? 'Done' : 'Choose another model' }}</button>
    </template>
    <p v-if="error" class="st-error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import api from '../../services/api'
import { useVideoStore } from '../../stores/useVideoStore'
import MediaRoutePicker from '../studio/MediaRoutePicker.vue'
import VideoJobCard from '../video/VideoJobCard.vue'

const props = defineProps({ projectId: { type: String, required: true }, clip: { type: Object, required: true }, rate: { type: Number, default: 30 } })
const emit = defineEmits(['captions'])
const video = useVideoStore()
const routeId = ref(''), jobId = ref(''), busy = ref(false), error = ref('')
const job = computed(() => jobId.value ? video.jobs[jobId.value] : null)
let timer = null
function reset() { clearInterval(timer); jobId.value = ''; error.value = '' }
watch(() => props.clip.media, reset)
onBeforeUnmount(() => clearInterval(timer))

async function ask() {
  busy.value = true; error.value = ''
  try {
    const { data } = await api.post('/video/shorts/transcribe/', { attachment_id: props.clip.media, route_id: routeId.value, project_id: props.projectId })
    video._put(data); jobId.value = data.job_id
    timer = setInterval(async () => { await video.refreshJob(jobId.value); if (['ready', 'failed', 'cancelled'].includes(job.value?.state)) clearInterval(timer) }, 4000)
  } catch (e) { error.value = e?.response?.data?.error?.message || 'The estimate could not be made.' }
  finally { busy.value = false }
}
// The transcript's words inside the clip's part of its file, a few to a caption, placed at the clip's time.
async function place() {
  busy.value = true; error.value = ''
  try {
    const c = props.clip, speed = c.speed || 1
    const { data } = await api.get('/video/editor/captions/', { params: { transcript_job_id: jobId.value, start_ms: c.source_in_ms, end_ms: c.source_out_ms } })
    const items = (data.cues || []).map(q => ({ text: q.text, start_ms: Math.round(c.start_ms + q.start_ms / speed), end_ms: Math.round(c.start_ms + q.end_ms / speed) }))
      .filter(q => q.end_ms - q.start_ms >= 40)
    if (!items.length) error.value = 'No speech was found in this part of the clip.'
    else emit('captions', items)
  } catch (e) { error.value = e?.response?.data?.error?.message || 'The captions could not be read.' }
  finally { busy.value = false }
}
</script>
<style scoped>
.cc{display:grid;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid var(--vm-line-2)}
.cc-h{font-size:13px;font-weight:600}
@media (max-width:767px){.cc .st-button{min-height:44px}}
</style>
