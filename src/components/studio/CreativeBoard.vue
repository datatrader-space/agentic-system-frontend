<template>
  <div class="creative-form">
    <label class="st-field" data-field="project_id">Project<select v-model="projectId" class="st-input" @change="open"><option value="">{{ kind === 'cinema' ? 'Standalone shot' : 'Choose project' }}</option><option v-for="p in projects" :key="p.project_id" :value="p.project_id">{{ p.title }}</option></select></label>
    <CreativeError :error="shownError" locate />
    <template v-if="!projectId && kind !== 'cinema'"><label class="st-field" data-field="title">New project title<input v-model="newTitle" class="st-input" /></label><button class="st-button" :disabled="busy || !newTitle.trim()" @click="createProject">Create project</button></template>
    <template v-if="projectId"><label class="st-field">New scene description<textarea v-model="newIntent" class="st-input" /></label><button class="st-button" :disabled="busy || !project || !newIntent.trim()" @click="addScene">Add scene</button></template>
    <RouterLink v-if="projectId && kind === 'storyboard'" class="st-button" data-test="board-edit-cut" :to="{ path: studioPath('editor'), query: { project_id: projectId } }">Edit the cut in the clip editor</RouterLink>
    <template v-if="kind">
      <label class="st-field" data-field="route_id">{{ projectId ? 'Keyframe model' : 'Video model' }}<select v-model="routeId" class="st-input" data-test="board-route"><option value="">Choose model</option><option v-for="r in routes" :key="r.route_id" :value="r.route_id" :disabled="!r.ready">{{ routeLabel(r) }}{{ r.ready === false ? ' — Not yet proven' : '' }}</option></select></label>
      <p v-if="routeSummary" class="st-muted" data-test="board-reference-summary">{{ routeSummary }}</p>
      <label v-if="projectId" class="st-field" data-field="n">Keyframes per scene<input v-model.number="count" type="number" min="1" max="4" class="st-input" /></label>
      <label v-if="projectId" class="st-field" data-field="video_route_id">Scene video model<select v-model="videoRouteId" class="st-input" data-test="board-video-route"><option value="">Choose model</option><option v-for="r in videoRoutes" :key="r.route_id" :value="r.route_id">{{ routeLabel(r) }}</option></select></label>
      <div v-if="lengths.length || resolutions.length" class="creative-pair"><label v-if="lengths.length" class="st-field" data-field="duration">Length<select v-model.number="duration" class="st-input" data-test="board-duration"><option v-for="s in lengths" :key="s" :value="s">{{ s }} seconds</option></select></label><label v-if="resolutions.length" class="st-field" data-field="resolution">Resolution<select v-model="resolution" class="st-input" data-test="board-resolution"><option v-for="r in resolutions" :key="r" :value="r">{{ r }}</option></select></label></div>
      <template v-if="kind === 'cinema' && !projectId">
        <label class="st-field" data-field="prompt">Shot description<textarea v-model="prompt" class="st-input" /></label>
        <label v-for="control in controls" :key="control.control" class="st-field">{{ control.label }}<select v-model="cinema[control.control]" class="st-input"><option value="">Default</option><option v-for="v in control.values" :key="v.value" :value="v.value" :title="v.phrase || undefined">{{ v.label || v.phrase }}</option></select></label>
        <p>{{ cinemaPhrase }}</p><LivePrice v-bind="shotPrice" v-model:accepted="shotQuote.accepted.value" empty="Choose the model and describe the shot to see the price." /><button class="st-button" :disabled="busy || !routeId || !prompt.trim() || shotQuote.blocked.value" @click="prepareShot">Review shot estimate</button>
      </template>
      <div v-for="scene in board?.scenes || []" :key="scene.scene_id" class="creative-card">
        <h2>{{ scene.order + 1 }}. {{ scene.title }}</h2><p>{{ scene.intent }}</p><p>{{ scene.cinema_phrase }}</p>
        <template v-if="kind === 'cinema'"><label v-for="control in controls" :key="control.control" class="st-field">{{ control.label }}<select v-model="scene.cinema[control.control]" class="st-input"><option value="">Default</option><option v-for="v in control.values" :key="v.value" :value="v.value" :title="v.phrase || undefined">{{ v.label || v.phrase }}</option></select></label><button class="st-button" :disabled="busy" @click="saveCinema(scene)">Save camera choices</button></template>
        <label class="st-field">Scene description<textarea v-model="scene.intent" class="st-input" /></label><button class="st-button" :disabled="busy || !project" @click="saveScene(scene)">Save description</button>
        <div class="creative-thumbnails"><button v-for="frame in scene.keyframes" :key="frame.attachment_id" class="st-button" :aria-pressed="scene.keyframe_attachment_id === frame.attachment_id" :disabled="busy" @click="chooseFrame(scene,frame)"><MediaThumb :item="{ ...frame, media_type: frame.media_type || 'image' }" :src="frame.url" alt="Choose keyframe" /></button></div>
        <p v-if="scene.keyframe_jobs_pending?.length">Keyframes pending. Review their approval cards in Results.</p>
        <button class="st-button" :disabled="busy || !routeId" @click="keyframes(scene)">Review keyframe estimate</button>
        <button class="st-button primary" v-if="scene.next_step === 'render'" :disabled="busy || !videoRouteId" @click="render(scene)">Review scene estimate</button><p v-if="scene.next_step === 'render' && !videoRouteId" class="st-muted">Choose the scene video model first.</p><p>Next: {{ scene.next_step }}</p>
        <div v-for="take in scene.takes" :key="take.take_id"><video :src="take.url" :poster="thumbnailFor({ ...take, media_type: 'video' }) || undefined" controls preload="none" /><button class="st-button" :aria-pressed="take.selected" :disabled="busy || take.selected" @click="chooseTake(scene,take)">Use take</button></div>
      </div>
      <button v-if="projectId" class="st-button" :disabled="busy" @click="refreshBoard">Refresh storyboard</button>
    </template>
  </div>
</template>
<script setup>
import { useStudioPreparedBrief } from '../../composables/useStudioPreparedBrief'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MediaThumb from '../common/MediaThumb.vue'
import { thumbnailFor } from '../../utils/mediaThumb'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import { routeOptionLabel } from '../../utils/studioPrice'
import { useLivePrice } from '../../composables/useLivePrice'
import LivePrice from './LivePrice.vue'
import CreativeError from './CreativeError.vue'
import { useCreativeForm } from '../../composables/useCreativeForm'
import { useVideoStore } from '../../stores/useVideoStore'
import { useChatStore } from '../../stores/useChatStore'
import { modelAliases, studioError, useStudioChat } from './studioForm'
import { studioPath } from '../../services/studioPaths'
const props = defineProps({ kind: String }), emit = defineEmits(['job']), route = useRoute()
// What the chosen video model takes as references (the backend's per-model data), shown under the picker.
const routeSummary = computed(() => routes.value.find(r => String(r.route_id) === String(routeId.value))?.inputs?.spec?.summary || '')
const projects = ref([]), projectId = ref(route.query.project_id || route.query.project || ''), board = ref(null), project = ref(null), routes = ref([]), routeId = ref(''), count = ref(1), controls = ref([]), cinema = ref({}), prompt = ref('')
const newTitle = ref(''), newIntent = ref('')
const { busy, error, run } = useCreativeForm()
// Each request carries the open chat and this page (a Manual page sends no chat message), so its results stay in the
// chat. An error is shown at its field; the model the backend names ('model', 'model_id', 'route_id') is the menu of
// the step that failed (the keyframe or shot model, or the scene video model).
const { chatFields } = useStudioChat(() => props.kind), modelField = ref('route_id')
const shownError = computed(() => studioError(error.value, ['project_id','title','route_id','video_route_id','n','duration','resolution','prompt'], modelAliases(modelField.value)))
// A shot or a scene video is made on a video model: in a project, a model that starts from the scene's keyframe
// (image to video); a standalone shot, one that makes video from words. Its own lengths and sizes are offered, the
// cheapest size first, so nothing is quoted at a size the person did not choose (2026-10-28: $0.70 at 1080p).
const videoRoutes = ref([]), videoRouteId = ref(''), duration = ref(null), resolution = ref('')
const renderRoute = computed(() => projectId.value ? videoRoutes.value.find(r => String(r.route_id) === String(videoRouteId.value)) : routes.value.find(r => String(r.route_id) === String(routeId.value)))
const lengths = computed(() => renderRoute.value?.schema?.properties?.duration?.enum || [])
const resolutions = computed(() => renderRoute.value?.schema?.properties?.resolution?.enum || [])
watch(renderRoute, r => { const d = r?.schema?.properties?.duration; duration.value = d ? (d.default ?? d.enum?.[0] ?? null) : null; resolution.value = resolutions.value[0] || '' })
const renderParams = () => Object.fromEntries(Object.entries({ duration: duration.value, resolution: resolution.value }).filter(([, v]) => v !== null && v !== ''))
const routeLabel = routeOptionLabel
// A keyframe or a scene video the page asked for: when it is ready, the storyboard is read again to show it.
const store = useVideoStore(), waiting = ref([])
watch(() => waiting.value.map(id => store.jobs[id]?.state), states => {
  if (!states.some(s => ['ready', 'failed', 'cancelled'].includes(s))) return
  waiting.value = waiting.value.filter((id, i) => !['ready', 'failed', 'cancelled'].includes(states[i]))
  refreshBoard()
})
// The project this chat has open is opened here when none is chosen: the one the agent made or opened
// (UPDATE_VIDEO_PROJECT) once its turn ends (live 2026-10-28: the menu still said "Choose project"), and the chat's
// project when the page is loaded again (live 2026-10-29: a reload lost it). A page's empty session project is not one
// of the person's projects (the menus leave it out), so it is not opened either.
const chat = useChatStore()
async function adoptChatProject() {
  const cid = chat.conversationId
  if (projectId.value || !cid) return false
  try {
    const { data } = await api.get('/video/projects/', { params: { conversation_id: cid } })
    const p = data?.project
    if (!p?.project_id || projectId.value || cid !== chat.conversationId) return false
    if (p.brief?.session && !(p.scenes || []).length) return false
    if (!projects.value.some(row => row.project_id === p.project_id)) projects.value.push({ project_id: p.project_id, title: p.title })
    projectId.value = p.project_id
    return true
  } catch { return false }   // the menu still lists it
}
watch(() => chat.isBusy, async (busy, was) => { if (was && !busy && await adoptChatProject()) await open() })
watch(() => chat.conversationId, async () => { if (await adoptChatProject()) await open() })
function track(job) { if (job?.job_id) waiting.value = [...waiting.value, job.job_id]; emit('job', job) }
async function loadRoutes(alive) {
  const [pictures, videos] = await Promise.all(projectId.value
    ? [api.getMediaRoutes('image'), api.get('/video/routes/', { params: { task: 'image_to_video' } })]
    : [api.get('/video/routes/', { params: { task: 'text_to_video' } })])
  if (!alive()) return
  // The cheapest proven model is chosen (the lists come cheapest first); "Choose model" left the page waiting on a
  // choice most people make the same way (UX pass, live 2026-10-29).
  routes.value = (pictures.data.routes || []).map(r => ({ ...r, ready: r.ready !== false }))
  routeId.value = routes.value.find(r => r.ready)?.route_id ?? ''
  videoRoutes.value = videos ? videos.data.routes || [] : []
  videoRouteId.value = videoRoutes.value.find(r => r.ready !== false)?.route_id ?? ''
}
const unset = () => Object.fromEntries(controls.value.map(c => [c.control, '']))
const chosenCinema = value => Object.fromEntries(Object.entries(value || {}).filter(([,v]) => v))
const cinemaPhrase = computed(() => controls.value.flatMap(c => c.values.filter(v => cinema.value[c.control] === v.value).map(v => v.phrase)).filter(Boolean).join(', '))
async function loadProject(alive) {
  if (!projectId.value) { board.value = null; project.value = null; return }
  const id = projectId.value
  const [p,b] = await Promise.all([api.get(`/video/projects/${id}/`), api.getStoryboard(id)])
  if (!alive() || id !== projectId.value) return
  project.value = p.data; board.value = b.data
  for (const s of board.value.scenes || []) s.cinema = { ...unset(), ...(s.cinema || {}) }   // every control shows "Default" until chosen
}
// Opening a project (choosing, creating, or the page's first load) reads its storyboard and its model lists. It is not
// one of `run`'s exclusive actions, which drop a call made while another runs: a project chosen while the page was
// still loading was never opened (live 2026-10-28). The newest opening wins; an older one writes nothing.
let opening = 0, boardReads = 0, gone = false
onBeforeUnmount(() => { gone = true })
const failed = e => { error.value = e.response?.data?.error || { message: e.message || 'The project could not be opened. Try again.' } }
async function open() {
  const mine = ++opening, alive = () => !gone && mine === opening
  try { await loadProject(alive); await loadRoutes(alive) } catch (e) { if (alive()) failed(e) }
}
// The storyboard again, keeping the models chosen (a finished keyframe or take, Refresh storyboard).
async function refreshBoard() {
  const mine = ++boardReads, alive = () => !gone && mine === boardReads
  try { await loadProject(alive) } catch (e) { if (alive()) failed(e) }
}
onMounted(() => run(async alive => {
  const [p,c] = await Promise.all([api.get('/video/projects/'), api.getCinemaControls()])
  if (!alive()) return
  projects.value = p.data.projects || []; controls.value = Array.isArray(c.data?.controls) ? c.data.controls : Array.isArray(c.data) ? c.data : []; cinema.value = { ...unset(), ...cinema.value }
  await adoptChatProject()
  await open()
}))
function sceneAction(scene, suffix, data, method = 'post') { return run(async alive => {
  try { const body = typeof data === 'function' ? await data() : data; const result = await api[method](`/video/projects/${projectId.value}/scenes/${scene.scene_id}/${suffix}/`, body); if (alive()) { if (result.data.job_id) track(result.data); else board.value = result.data } }
  catch (e) { if (alive() && e.response?.status === 409) { if (e.response.data.storyboard) board.value = e.response.data.storyboard; project.value = null; throw Error('Someone changed this project. Review the current storyboard before trying again.', { cause: e }) } throw e }
}) }
function chooseFrame(s,f) { sceneAction(s,'keyframe',{ attachment_id: f.attachment_id, revision: board.value.revision }) }
function keyframes(s) { modelField.value = 'route_id'; sceneAction(s,'keyframes',async () => ({ route_id: routeId.value, n: count.value, conversation_id: (await chatFields()).conversation_id })) }
function saveCinema(s) { sceneAction(s,'cinema',{ cinema: chosenCinema(s.cinema), revision: board.value.revision },'put') }
function render(s) { modelField.value = 'video_route_id'; run(async alive => { const { data } = await api.post('/video/jobs/',{ project_id: projectId.value, scene_id: s.scene_id, operation: 'generate', route_id: videoRouteId.value, prompt: s.intent, params: renderParams(), ...await chatFields() }); if (alive()) track(data) }) }
function saveScene(s) { if (!project.value) return; run(async alive => { const scenes = (project.value.scenes || []).map(row => row.scene_id === s.scene_id ? { ...row, intent: s.intent } : row); const { data } = await patchScenes(scenes, alive); if (alive()) { project.value = data; await loadProject(alive) } }) }
// The shot's price; adjustments the model needs are accepted here before the estimate is asked for, and sent with it.
const shotQuote = useLivePrice(() => props.kind === 'cinema' && !projectId.value && routeId.value && prompt.value.trim()
  ? { kind: 'video', route_id: routeId.value, prompt: prompt.value.trim(), cinema: chosenCinema(cinema.value), params: renderParams(), ...(chat.conversationId ? { conversation_id: chat.conversationId } : {}) } : null)
const shotPrice = computed(() => ({ price: shotQuote.price.value, loading: shotQuote.loading.value, problem: shotQuote.problem.value, code: shotQuote.code.value }))
function prepareShot() { if (shotQuote.blocked.value) return; modelField.value = 'route_id'; const accept = shotQuote.acceptFields.value; run(async alive => { const { data } = await api.post('/video/jobs/',{ operation: 'generate', route_id: routeId.value, prompt: prompt.value, cinema: chosenCinema(cinema.value), params: renderParams(), ...(accept.length ? { accept } : {}), ...await chatFields() }); if (alive()) emit('job',data) }) }
async function patchScenes(scenes, alive) {
  try { return await api.patch(`/video/projects/${projectId.value}/`, { revision: board.value.revision, scenes }) }
  catch (e) { if (e.response?.status === 409) { await loadProject(alive); throw Error('Someone changed this project. Review the current storyboard before trying again.', { cause: e }) } throw e }
}
// The model lists change with a project (keyframe pictures, scene videos): opened, as choosing one is.
function createProject() { run(async alive => { const {data} = await api.post('/video/projects/',{ title:newTitle.value, conversation_id:(await chatFields()).conversation_id }); if (alive()) { projects.value.push(data); projectId.value = data.project_id; await open() } }) }
function addScene() { if (!project.value) return; run(async alive => { await patchScenes([...(project.value.scenes || []), { title:`Scene ${(project.value.scenes || []).length+1}`, intent:newIntent.value, planned_ms:5000 }], alive); if (alive()) { newIntent.value = ''; await loadProject(alive) } }) }
function chooseTake(scene,take) { run(async alive => { await api.post('/video/selection/',{ project_id:projectId.value, scene_id:scene.scene_id, attachment_id:take.attachment_id, expected_revision:board.value.revision }); if (alive()) await loadProject(alive) }) }
useStudioPreparedBrief(newIntent)
const preparedLook = useStudioPreparedBrief(prompt)
// A Cinema look that names its controls (genre, era, speed ramp...) sets them on the standalone shot, each value checked
// against the backend's own table; anything the table does not have is left alone.
watch([preparedLook, controls], ([look]) => {
  if (props.kind !== 'cinema' || !look?.cinema) return
  for (const [key, value] of Object.entries(look.cinema)) if (controls.value.some(c => c.control === key && c.values.some(v => v.value === value))) cinema.value[key] = value
}, { immediate: true })
</script>


