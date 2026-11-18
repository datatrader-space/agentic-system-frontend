<template>
  <div class="creative-form">
    <CreativeError :error="shownError" locate />
    <MediaRoutePicker v-model="routeId" :operation="kind === 'shorts' ? 'transcribe' : 'speech'" />
    <template v-if="kind === 'shorts'">
      <InputSlot label="Source footage" data-field="references" :kinds="['video']" required :allow-upload="false" :items="source ? [source] : []" @pick="source = $event[0]; transcriptId = ''; moments = []" @remove="source = null; transcriptId = ''; moments = []" />
      <label class="st-field" data-field="language">Language (optional)<input v-model="language" class="st-input" /></label><button class="st-button primary" :disabled="busy || !source || !routeId" @click="transcribe">Review transcription estimate</button>
      <p v-if="transcriptId">Transcript: {{ transcriptState }}. Generate on its card in Results to continue.</p>
      <label class="st-field" data-field="n">Moment count<input v-model.number="count" type="number" min="1" max="6" class="st-input" /></label><button class="st-button" :disabled="busy || transcriptState !== 'ready'" @click="findMoments">Find moments</button>
      <label class="st-field" data-field="aspect_ratio">Output shape<select v-model="aspect" class="st-input"><option>9:16</option><option>1:1</option><option>4:5</option></select></label><label><input v-model="captions" type="checkbox" /> Captions</label>
      <div v-for="(m,i) in moments" :key="i" class="creative-card"><label class="st-field" data-field="title">Title<input v-model="m.title" class="st-input" /></label><p>{{ m.why }}</p><p>{{ m.text }}</p><label class="st-field">Start (milliseconds)<input v-model.number="m.start_ms" class="st-input" type="number" min="0" /></label><label class="st-field">End (milliseconds)<input v-model.number="m.end_ms" class="st-input" type="number" min="10000" /></label><button class="st-button" :disabled="busy || m.end_ms - m.start_ms < 10000 || m.end_ms - m.start_ms > 90000" @click="makeShort(m)">Make short (free)</button></div>
    </template>
    <template v-else>
      <label data-field="faceless"><input v-model="faceless" type="checkbox" data-test="explainer-faceless" /> Faceless video: vertical, with no person on screen</label>
      <label class="st-field" data-field="topic">Topic<textarea v-model="topic" class="st-input" rows="4" /></label><label class="st-field" data-field="title">Title<input v-model="title" class="st-input" /></label><label class="st-field" data-field="audience">Audience<input v-model="audience" class="st-input" /></label><label class="st-field" data-field="max_seconds">Maximum seconds<input v-model.number="maxSeconds" type="number" min="15" :max="faceless ? 90 : 300" class="st-input" /></label>
      <label class="st-field" data-field="aspect_ratio">Output shape<select v-model="aspect" class="st-input"><option v-for="s in shapes" :key="s">{{ s }}</option></select></label>
      <button class="st-button" :disabled="busy || !topic.trim()" @click="plan">{{ faceless ? 'Plan faceless video' : 'Plan explainer' }}</button>
      <template v-if="projectId">
        <RouterLink :to="{ path:'/video-studio/storyboard', query:{ project_id:projectId } }" class="st-button">Choose scene pictures in Storyboard</RouterLink>
        <section class="creative-card" data-test="explainer-pictures" aria-labelledby="explainer-pictures-title">
          <h3 id="explainer-pictures-title">Scene pictures</h3>
          <p class="st-muted">One picture for each scene that has none, each with its own estimate.</p>
          <label class="st-field" data-field="kind">Picture kind<select v-model="pictureKind" class="st-input" data-test="picture-kind"><option value="image">Still images</option><option value="video">Video clips as long as each voice</option></select></label>
          <MediaRoutePicker v-if="pictureKind === 'image'" v-model="pictureRoute" operation="image" label="Picture model" />
          <label v-else class="st-field" data-field="picture_route_id">Video model<select v-model="pictureRoute" class="st-input" data-test="picture-video-route" :disabled="!videoRoutes.length"><option v-if="!videoRoutes.length" value="">No video model you can use makes video from words yet</option><option v-for="r in videoRoutes" :key="r.route_id" :value="String(r.route_id)">{{ routeOptionLabel(r) }}</option></select></label>
          <button class="st-button" :disabled="busy || !pictureRoute" @click="pictures">Review picture estimates</button>
        </section>
        <VoicePicker v-model="voiceId" :route-id="routeId" />
        <button class="st-button" :disabled="busy || !routeId || !voiceId" @click="narrate">Review narration estimates</button><button class="st-button" :disabled="busy" @click="refreshStatus">Refresh scene status</button>
        <section class="creative-card" data-test="explainer-music" aria-labelledby="explainer-music-title">
          <h3 id="explainer-music-title">Music (optional)</h3>
          <MediaRoutePicker v-model="musicRoute" operation="music" label="Music model" />
          <label class="st-field" data-field="prompt">What the music sounds like<input v-model="musicPrompt" class="st-input" placeholder="Calm, unobtrusive instrumental" /></label>
          <button class="st-button" :disabled="busy || !musicRoute" @click="music">Review music estimate</button>
        </section>
        <div v-for="s in scenes" :key="s.scene_id" class="creative-card"><h2>Scene {{ s.order + 1 }}</h2><p>{{ s.narration }}</p><p>Picture: {{ s.picture ? 'Ready' : 'Missing' }} · Narration: {{ s.narration_attachment_id ? 'Ready' : 'Missing' }}</p></div>
        <button class="st-button primary" :disabled="busy" @click="cut">Cut the video (free)</button>
      </template>
    </template>
    <RouterLink v-if="resultProject" :to="{ path:'/video-studio/editor', query:{ project_id:resultProject } }">Open the short in the clip editor</RouterLink>
  </div>
</template>
<script setup>
import { useStudioPreparedBrief } from '../../composables/useStudioPreparedBrief'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import { useVideoStore } from '../../stores/useVideoStore'
import { useCreativeForm } from '../../composables/useCreativeForm'
import CreativeError from './CreativeError.vue'
import InputSlot from './InputSlot.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
import VoicePicker from './VoicePicker.vue'
import { modelAliases, studioError, useStudioChat } from './studioForm'
import { routeOptionLabel } from '../../utils/studioPrice'
const props = defineProps({ kind:String }), emit = defineEmits(['job']), route = useRoute(), video = useVideoStore(), { busy,error,run } = useCreativeForm()
const routeId = ref(''), voiceId = ref(''), source = ref(null), language = ref(''), transcriptId = ref(''), count = ref(3), moments = ref([]), aspect = ref(props.kind === 'shorts' ? '9:16' : '16:9'), captions = ref(true), resultProject = ref('')
const topic = ref(''), title = ref(''), audience = ref(''), maxSeconds = ref(90), projectId = ref(route.query.project_id || ''), scenes = ref([])
const transcriptState = computed(() => video.jobs[transcriptId.value]?.state || 'waiting')
// The shared model menu (live 2026-10-29: this one had no price and no model chosen). The voices follow the model in
// the shared VoicePicker: a provider that lists no voices (listed: false) takes a voice ID typed in instead.
onMounted(() => run(async alive => { if (projectId.value) await status(alive) }))
watch(routeId, () => { voiceId.value = '' })
// The transcript and the explainer project belong to the open chat (a Manual page sends no chat message, so the page
// goes with them); shorts, moments, narration and the cut follow the chat of what they build on. An error is shown at
// its field (the model the backend names 'model', 'model_id' or 'route_id' at the model menu), any other one as a
// general message.
const { chatFields } = useStudioChat(() => props.kind)
const shownError = computed(() => studioError(error.value, ['route_id','voice_id','references','language','n','aspect_ratio','title','topic','audience','max_seconds'], { ...modelAliases('route_id'), attachment_id: 'references' }))
function transcribe() { run(async alive => { const {data} = await api.post('/video/shorts/transcribe/',{ attachment_id:source.value.attachment_id, route_id:routeId.value, language:language.value, ...await chatFields() }); if (alive()) { transcriptId.value = data.job_id; moments.value = []; emit('job',data) } }) }
function findMoments() { run(async alive => { const {data} = await api.post('/video/shorts/moments/',{ transcript_job_id:transcriptId.value, n:count.value }); if (alive()) moments.value = data.moments || [] }) }
function makeShort(m) { run(async alive => { const duration = m.end_ms-m.start_ms; if (duration < 10000 || duration > 90000 || m.start_ms < 0) throw Error('Choose a moment lasting 10 to 90 seconds.'); const {data} = await api.post('/video/shorts/',{ transcript_job_id:transcriptId.value, start_ms:m.start_ms, end_ms:m.end_ms, title:m.title, aspect_ratio:aspect.value, captions:captions.value }); if (alive()) { resultProject.value = data.project.project_id; emit('job',data.export) } }) }
async function status(alive) { const {data} = await api.get(`/video/explainers/${projectId.value}/`); if (alive()) scenes.value = data.scenes || [] }
function refreshStatus() { run(status) }
function plan() { run(async alive => { const {data} = await api.post('/video/explainers/',{ topic:topic.value, title:title.value, audience:audience.value, max_seconds:maxSeconds.value, aspect_ratio:aspect.value, ...(faceless.value ? { faceless:true } : {}), ...await chatFields() }); if (alive()) { projectId.value = data.project_id; await status(alive) } }) }
// A faceless video (ADM-1265): the explainer made short and vertical, with no person in its pictures. A look that says
// so (the Faceless short look) ticks it.
const faceless = ref(false)
const shapes = computed(() => faceless.value ? ['9:16','1:1','4:5'] : ['16:9','9:16','1:1','4:5'])
watch(faceless, on => { if (!shapes.value.includes(aspect.value)) aspect.value = shapes.value[0]; if (on && maxSeconds.value >= 90) maxSeconds.value = 60 })
// Scene pictures: one paid picture per scene still without one, on an image model or a video model.
const pictureKind = ref('image'), pictureRoute = ref(''), videoRoutes = ref([])
watch(pictureKind, kind => { pictureRoute.value = ''; if (kind === 'video') run(async alive => { const { data } = await api.getStudioRoutes('text_to_video'); if (!alive()) return; videoRoutes.value = (data.routes || []).filter(r => r.ready !== false); pictureRoute.value = videoRoutes.value[0] ? String(videoRoutes.value[0].route_id) : '' }) })
function pictures() { run(async alive => { const {data} = await api.post(`/video/explainers/${projectId.value}/visuals/`,{ route_id:pictureRoute.value, kind:pictureKind.value, ...await chatFields() }); if (alive()) for (const job of data.jobs || []) emit('job',job) }) }
// The optional music bed, as long as the video; it goes under the voices at the cut.
const musicRoute = ref(''), musicPrompt = ref('')
function music() { run(async alive => { const {data} = await api.post(`/video/explainers/${projectId.value}/music/`,{ route_id:musicRoute.value, prompt:musicPrompt.value, ...await chatFields() }); if (alive()) emit('job',data) }) }
function narrate() { run(async alive => { const {data} = await api.post(`/video/explainers/${projectId.value}/narrate/`,{ route_id:routeId.value, voice_id:voiceId.value }); if (alive()) for (const job of data.jobs || []) emit('job',job) }) }
function cut() { run(async alive => { const {data} = await api.post(`/video/explainers/${projectId.value}/cut/`,{}); if (alive()) { resultProject.value = projectId.value; emit('job',data.export) } }) }
const preparedLook = useStudioPreparedBrief(topic, 'Topic')
watch(preparedLook, look => { if (look?.faceless) faceless.value = true }, { immediate: true })
</script>
