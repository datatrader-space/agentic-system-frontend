<template>
  <div class="creative-form">
    <CreativeError :error="error" locate />
    <MediaRoutePicker v-model="routeId" :operation="kind === 'shorts' ? 'transcribe' : 'speech'" />
    <template v-if="kind === 'shorts'">
      <InputSlot label="Source footage" :kinds="['video']" required :allow-upload="false" :items="source ? [source] : []" @pick="source = $event[0]; transcriptId = ''; moments = []" @remove="source = null; transcriptId = ''; moments = []" />
      <label class="st-field" data-field="language">Language (optional)<input v-model="language" class="st-input" /></label><button class="st-button primary" :disabled="busy || !source || !routeId" @click="transcribe">Review transcription estimate</button>
      <p v-if="transcriptId">Transcript: {{ transcriptState }}. Generate on its card in Results to continue.</p>
      <label class="st-field" data-field="n">Moment count<input v-model.number="count" type="number" min="1" max="6" class="st-input" /></label><button class="st-button" :disabled="busy || transcriptState !== 'ready'" @click="findMoments">Find moments</button>
      <label class="st-field" data-field="aspect_ratio">Output shape<select v-model="aspect" class="st-input"><option>9:16</option><option>1:1</option><option>4:5</option></select></label><label><input v-model="captions" type="checkbox" /> Captions</label>
      <div v-for="(m,i) in moments" :key="i" class="creative-card"><label class="st-field" data-field="title">Title<input v-model="m.title" class="st-input" /></label><p>{{ m.why }}</p><p>{{ m.text }}</p><label class="st-field">Start (milliseconds)<input v-model.number="m.start_ms" class="st-input" type="number" min="0" /></label><label class="st-field">End (milliseconds)<input v-model.number="m.end_ms" class="st-input" type="number" min="10000" /></label><button class="st-button" :disabled="busy || m.end_ms - m.start_ms < 10000 || m.end_ms - m.start_ms > 90000" @click="makeShort(m)">Make short (free)</button></div>
    </template>
    <template v-else>
      <label class="st-field" data-field="topic">Topic<textarea v-model="topic" class="st-input" rows="4" /></label><label class="st-field" data-field="title">Title<input v-model="title" class="st-input" /></label><label class="st-field" data-field="audience">Audience<input v-model="audience" class="st-input" /></label><label class="st-field" data-field="max_seconds">Maximum seconds<input v-model.number="maxSeconds" type="number" min="15" max="300" class="st-input" /></label>
      <label class="st-field" data-field="aspect_ratio">Output shape<select v-model="aspect" class="st-input"><option>16:9</option><option>9:16</option><option>1:1</option><option>4:5</option></select></label>
      <button class="st-button" :disabled="busy || !topic.trim()" @click="plan">Plan explainer</button>
      <template v-if="projectId">
        <RouterLink :to="{ path:'/video-studio/storyboard', query:{ project_id:projectId } }" class="st-button">Choose scene pictures in Storyboard</RouterLink>
        <label class="st-field" data-field="voice_id">Voice<select v-model="voiceId" class="st-input"><option value="">Choose voice</option><option v-for="v in voices" :key="v.voice_id || v.id" :value="v.voice_id || v.id">{{ v.name }}</option></select></label>
        <button class="st-button" :disabled="busy || !routeId || !voiceId" @click="narrate">Review narration estimates</button><button class="st-button" :disabled="busy" @click="refreshStatus">Refresh scene status</button>
        <div v-for="s in scenes" :key="s.scene_id" class="creative-card"><h2>Scene {{ s.order + 1 }}</h2><p>{{ s.narration }}</p><p>Picture: {{ s.picture ? 'Ready' : 'Missing' }} · Narration: {{ s.narration_attachment_id ? 'Ready' : 'Missing' }}</p></div>
        <button class="st-button primary" :disabled="busy" @click="cut">Cut explainer (free)</button>
      </template>
    </template>
    <RouterLink v-if="resultProject" :to="{ path:'/video-studio/editor', query:{ project_id:resultProject } }">Open resulting project in Editor</RouterLink>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import { useVideoStore } from '../../stores/useVideoStore'
import { useCreativeForm } from '../../composables/useCreativeForm'
import CreativeError from './CreativeError.vue'
import InputSlot from './InputSlot.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
const props = defineProps({ kind:String }), emit = defineEmits(['job']), route = useRoute(), video = useVideoStore(), { busy,error,run } = useCreativeForm()
const routeId = ref(''), voices = ref([]), voiceId = ref(''), source = ref(null), language = ref(''), transcriptId = ref(''), count = ref(3), moments = ref([]), aspect = ref(props.kind === 'shorts' ? '9:16' : '16:9'), captions = ref(true), resultProject = ref('')
const topic = ref(''), title = ref(''), audience = ref(''), maxSeconds = ref(90), projectId = ref(route.query.project_id || ''), scenes = ref([])
const transcriptState = computed(() => video.jobs[transcriptId.value]?.state || 'waiting')
// The shared model menu (live 2026-10-29: this one had no price and no model chosen); the voices follow the model.
onMounted(() => run(async alive => { if (projectId.value) await status(alive) }))
watch(routeId, loadVoices)
// Not through run(): the menu chooses its model while the page's first load is still running, and run() drops a call
// made while busy, so the voices never came. The newest model's answer wins.
let voiceSeq = 0, gone = false
onBeforeUnmount(() => { gone = true })
async function loadVoices() {
  if (props.kind !== 'explainer') return
  const mine = ++voiceSeq; voiceId.value = ''; voices.value = []
  if (!routeId.value) return
  try { const {data} = await api.get('/video/media/voices/',{ params:{ route_id:routeId.value } }); if (!gone && mine === voiceSeq) voices.value = data.voices || [] }
  catch (e) { if (!gone && mine === voiceSeq) error.value = e.response?.data?.error || { message: 'Could not load the voices.' } }
}
function transcribe() { run(async alive => { const {data} = await api.post('/video/shorts/transcribe/',{ attachment_id:source.value.attachment_id, route_id:routeId.value, language:language.value }); if (alive()) { transcriptId.value = data.job_id; moments.value = []; emit('job',data) } }) }
function findMoments() { run(async alive => { const {data} = await api.post('/video/shorts/moments/',{ transcript_job_id:transcriptId.value, n:count.value }); if (alive()) moments.value = data.moments || [] }) }
function makeShort(m) { run(async alive => { const duration = m.end_ms-m.start_ms; if (duration < 10000 || duration > 90000 || m.start_ms < 0) throw Error('Choose a moment lasting 10 to 90 seconds.'); const {data} = await api.post('/video/shorts/',{ transcript_job_id:transcriptId.value, start_ms:m.start_ms, end_ms:m.end_ms, title:m.title, aspect_ratio:aspect.value, captions:captions.value }); if (alive()) { resultProject.value = data.project.project_id; emit('job',data.export) } }) }
async function status(alive) { const {data} = await api.get(`/video/explainers/${projectId.value}/`); if (alive()) scenes.value = data.scenes || [] }
function refreshStatus() { run(status) }
function plan() { run(async alive => { const {data} = await api.post('/video/explainers/',{ topic:topic.value, title:title.value, audience:audience.value, max_seconds:maxSeconds.value, aspect_ratio:aspect.value }); if (alive()) { projectId.value = data.project_id; await status(alive) } }) }
function narrate() { run(async alive => { const {data} = await api.post(`/video/explainers/${projectId.value}/narrate/`,{ route_id:routeId.value, voice_id:voiceId.value }); if (alive()) for (const job of data.jobs || []) emit('job',job) }) }
function cut() { run(async alive => { const {data} = await api.post(`/video/explainers/${projectId.value}/cut/`,{}); if (alive()) { resultProject.value = projectId.value; emit('job',data.export) } }) }
</script>
