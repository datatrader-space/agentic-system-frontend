<template>
  <div class="creative-form">
    <label class="st-field" data-field="project_id">Project<select v-model="projectId" class="st-input" @change="open"><option value="">{{ kind === 'cinema' ? 'Standalone shot' : 'Choose project' }}</option><option v-for="p in projects" :key="p.project_id" :value="p.project_id">{{ p.title }}</option></select></label>
    <CreativeError :error="error" locate />
    <template v-if="!projectId && kind !== 'cinema'"><label class="st-field">New project title<input v-model="newTitle" class="st-input" /></label><button class="st-button" :disabled="busy || !newTitle.trim()" @click="createProject">Create project</button></template>
    <template v-if="projectId && kind !== 'editor'"><label class="st-field">New scene description<textarea v-model="newIntent" class="st-input" /></label><button class="st-button" :disabled="busy || !project || !newIntent.trim()" @click="addScene">Add scene</button></template>
    <template v-if="kind === 'editor' && projectId">
      <p class="st-muted">Arrange your clips, sounds and images. Times are in milliseconds.</p>
      <InputSlot label="Video clips" :kinds="['video']" :limit="50" :allow-upload="false" @pick="addClips('video', $event)" />
      <div v-for="(clip,i) in videoClips" :key="i" class="creative-card">
        <span>Clip {{ i + 1 }}</span><button class="st-button" @click="move(i,-1)" :disabled="i === 0">Move earlier</button><button class="st-button" @click="videoClips.splice(i,1)">Remove</button>
        <label class="st-field">In<input v-model.number="clip.in_ms" type="number" min="0" class="st-input" /></label><label class="st-field">Out<input v-model.number="clip.out_ms" type="number" min="1" class="st-input" /></label>
        <label class="st-field">Transition<select v-model="clip.transition.kind" class="st-input"><option v-for="t in transitions" :key="t">{{ t }}</option></select></label><label v-if="clip.transition.kind !== 'cut'" class="st-field">Transition duration<input v-model.number="clip.transition.ms" class="st-input" type="number" min="100" max="2000" /></label>
      </div>
      <InputSlot label="Sounds" :kinds="['audio']" :limit="8" :items="sounds" :allow-upload="false" @pick="addClips('audio',$event)" @remove="sounds.splice(sounds.indexOf($event),1)" />
      <div v-for="(sound,i) in sounds" :key="i" class="creative-card"><label v-for="field in ['start_ms','in_ms','out_ms','gain_db']" :key="field" class="st-field">{{ field }}<input v-model.number="sound[field]" class="st-input" type="number" :min="field === 'gain_db' ? -40 : 0" :max="field === 'gain_db' ? 12 : undefined" /></label><label><input type="checkbox" v-model="sound.duck" /> Duck</label><label><input type="checkbox" v-model="sound.mute_original" /> Mute original</label></div>
      <InputSlot label="Image overlays" :kinds="['image']" :limit="8" :items="overlays" :allow-upload="false" @pick="addClips('overlay',$event)" @remove="overlays.splice(overlays.indexOf($event),1)" />
      <div v-for="(image,i) in overlays" :key="i" class="creative-card"><label class="st-field">Position<select v-model="image.position" class="st-input"><option v-for="pos in positions" :key="pos">{{ pos }}</option></select></label><label class="st-field">Scale<input v-model.number="image.scale" class="st-input" type="number" min="0.02" max="1" step="0.01" /></label><label class="st-field">Start<input v-model.number="image.start_ms" class="st-input" type="number" min="0" /></label><label class="st-field">End<input v-model.number="image.end_ms" class="st-input" type="number" min="1" /></label></div>
      <button class="st-button" :disabled="busy" @click="saveTimeline">Save timeline</button><button class="st-button primary" :disabled="busy || !revisionId" @click="exportTimeline">Export saved timeline</button><p v-if="revisionId" role="status">Saved revision {{ revisionId }}. Save changes again before exporting them.</p>
      <h2>Captions</h2><div v-for="(cue,i) in captionCues" :key="i" class="creative-card"><label class="st-field">Text<input v-model="cue.text" class="st-input" maxlength="300" /></label><label class="st-field">Start<input v-model.number="cue.start_ms" type="number" min="0" class="st-input" /></label><label class="st-field">End<input v-model.number="cue.end_ms" type="number" min="1" class="st-input" /></label><button class="st-button" @click="captionCues.splice(i,1)">Remove caption</button></div><button class="st-button" @click="captionCues.push({text:'',start_ms:0,end_ms:5000})">Add caption</button>
    </template>
    <template v-else>
      <label class="st-field" data-field="route_id">{{ projectId ? 'Keyframe model' : 'Video model' }}<select v-model="routeId" class="st-input"><option value="">Choose model</option><option v-for="r in routes" :key="r.route_id" :value="r.route_id" :disabled="!r.ready">{{ r.name || r.model }}{{ r.ready === false ? ' — Not yet proven' : '' }}</option></select></label>
      <p v-if="routeSummary" class="st-muted" data-test="board-reference-summary">{{ routeSummary }}</p>
      <label v-if="projectId" class="st-field">Keyframes per scene<input v-model.number="count" type="number" min="1" max="4" class="st-input" /></label>
      <template v-if="kind === 'cinema' && !projectId">
        <label class="st-field" data-field="prompt">Shot description<textarea v-model="prompt" class="st-input" /></label>
        <label v-for="control in controls" :key="control.control" class="st-field">{{ control.label }}<select v-model="cinema[control.control]" class="st-input"><option value="">Default</option><option v-for="v in control.values" :key="v.value" :value="v.value">{{ v.phrase }}</option></select></label>
        <p>{{ cinemaPhrase }}</p><button class="st-button" :disabled="busy || !routeId || !prompt.trim()" @click="prepareShot">Review shot estimate</button>
      </template>
      <div v-for="scene in board?.scenes || []" :key="scene.scene_id" class="creative-card">
        <h2>{{ scene.order + 1 }}. {{ scene.title }}</h2><p>{{ scene.intent }}</p><p>{{ scene.cinema_phrase }}</p>
        <template v-if="kind === 'cinema'"><label v-for="control in controls" :key="control.control" class="st-field">{{ control.label }}<select v-model="scene.cinema[control.control]" class="st-input"><option value="">Default</option><option v-for="v in control.values" :key="v.value" :value="v.value">{{ v.phrase }}</option></select></label><button class="st-button" :disabled="busy" @click="saveCinema(scene)">Save camera choices</button></template>
        <label class="st-field">Scene description<textarea v-model="scene.intent" class="st-input" /></label><button class="st-button" :disabled="busy || !project" @click="saveScene(scene)">Save description</button>
        <div class="creative-thumbnails"><button v-for="frame in scene.keyframes" :key="frame.attachment_id" class="st-button" :aria-pressed="scene.keyframe_attachment_id === frame.attachment_id" :disabled="busy" @click="chooseFrame(scene,frame)"><MediaThumb :item="{ ...frame, media_type: frame.media_type || 'image' }" :src="frame.url" alt="Choose keyframe" /></button></div>
        <p v-if="scene.keyframe_jobs_pending?.length">Keyframes pending. Review their approval cards in Results.</p>
        <button class="st-button" :disabled="busy || !routeId" @click="keyframes(scene)">Review keyframe estimate</button>
        <button class="st-button primary" v-if="scene.next_step === 'render'" :disabled="busy" @click="render(scene)">Review scene estimate</button><p>Next: {{ scene.next_step }}</p>
        <div v-for="take in scene.takes" :key="take.take_id"><video :src="take.url" :poster="thumbnailFor({ ...take, media_type: 'video' }) || undefined" controls preload="none" /><button class="st-button" :aria-pressed="take.selected" :disabled="busy || take.selected" @click="chooseTake(scene,take)">Use take</button></div>
      </div>
      <button v-if="projectId" class="st-button" :disabled="busy" @click="open">Refresh storyboard</button>
    </template>
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import MediaThumb from '../common/MediaThumb.vue'
import { thumbnailFor } from '../../utils/mediaThumb'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import InputSlot from './InputSlot.vue'
import CreativeError from './CreativeError.vue'
import { useCreativeForm } from '../../composables/useCreativeForm'
const props = defineProps({ kind: String }), emit = defineEmits(['job']), route = useRoute()
// What the chosen video model takes as references (the backend's per-model data), shown under the picker.
const routeSummary = computed(() => routes.value.find(r => String(r.route_id) === String(routeId.value))?.inputs?.spec?.summary || '')
const projects = ref([]), projectId = ref(route.query.project_id || route.query.project || ''), board = ref(null), project = ref(null), routes = ref([]), routeId = ref(''), count = ref(1), controls = ref([]), cinema = ref({}), prompt = ref('')
const videoClips = ref([]), sounds = ref([]), overlays = ref([]), texts = ref([]), revisionId = ref(null)
const newTitle = ref(''), newIntent = ref('')
const captionCues = ref([])
const transitions = ['cut','crossfade','fade_black','fade_white','wipe','slide','dissolve'], positions = ['top-left','top','top-right','center','bottom-left','bottom','bottom-right']
const { busy, error, run } = useCreativeForm()
const unset = () => Object.fromEntries(controls.value.map(c => [c.control, '']))
const chosenCinema = value => Object.fromEntries(Object.entries(value || {}).filter(([,v]) => v))
const cinemaPhrase = computed(() => controls.value.flatMap(c => c.values.filter(v => cinema.value[c.control] === v.value).map(v => v.phrase)).join(', '))
async function loadProject(alive) {
  if (!projectId.value) { board.value = null; project.value = null; return }
  const id = projectId.value
  const [p,b] = await Promise.all([api.get(`/video/projects/${id}/`), api.getStoryboard(id)])
  if (!alive() || id !== projectId.value) return
  project.value = p.data; board.value = b.data
  for (const s of board.value.scenes || []) s.cinema = { ...unset(), ...(s.cinema || {}) }   // every control shows "Default" until chosen
  const tracks = p.data.timeline?.edl?.tracks || []
  videoClips.value = (tracks.find(t => t.kind === 'video')?.clips || []).map(c => ({ ...c, transition: c.transition || { kind: 'cut', ms: 500 } }))
  sounds.value = tracks.filter(t => t.kind === 'audio').flatMap(t => t.clips || [])
  overlays.value = tracks.filter(t => t.kind === 'overlay').flatMap(t => t.items || [])
  texts.value = tracks.filter(t => t.kind === 'text'); revisionId.value = p.data.timeline?.revision_id || null
  captionCues.value = texts.value.flatMap(t => t.cues || [])
}
function open() { run(async alive => { await loadProject(alive); const { data } = await (projectId.value ? api.getMediaRoutes('image') : api.get('/video/routes/', { params: { task: 'text_to_video' } })); if (alive()) { routes.value = (data.routes || []).map(r => ({ ...r, ready: r.ready !== false })); routeId.value = '' } }) }
onMounted(() => run(async alive => {
  const [p,c] = await Promise.all([api.get('/video/projects/'), api.getCinemaControls()])
  if (!alive()) return
  projects.value = p.data.projects || []; controls.value = Array.isArray(c.data?.controls) ? c.data.controls : Array.isArray(c.data) ? c.data : []; cinema.value = { ...unset(), ...cinema.value }
  await loadProject(alive)
  const { data } = await (projectId.value ? api.getMediaRoutes('image') : api.get('/video/routes/', { params: { task: 'text_to_video' } })); if (alive()) routes.value = (data.routes || []).map(r => ({ ...r, ready: r.ready !== false }))
}))
function sceneAction(scene, suffix, data, method = 'post') { return run(async alive => {
  try { const result = await api[method](`/video/projects/${projectId.value}/scenes/${scene.scene_id}/${suffix}/`, data); if (alive()) { if (result.data.job_id) emit('job',result.data); else board.value = result.data } }
  catch (e) { if (alive() && e.response?.status === 409) { if (e.response.data.storyboard) board.value = e.response.data.storyboard; project.value = null; throw Error('Someone changed this project. Review the current storyboard before trying again.') } throw e }
}) }
function chooseFrame(s,f) { sceneAction(s,'keyframe',{ attachment_id: f.attachment_id, revision: board.value.revision }) }
function keyframes(s) { sceneAction(s,'keyframes',{ route_id: routeId.value, n: count.value }) }
function saveCinema(s) { sceneAction(s,'cinema',{ cinema: chosenCinema(s.cinema), revision: board.value.revision },'put') }
function render(s) { run(async alive => { const { data } = await api.post('/video/jobs/',{ project_id: projectId.value, scene_id: s.scene_id, operation: 'generate', prompt: s.intent }); if (alive()) emit('job',data) }) }
function saveScene(s) { if (!project.value) return; run(async alive => { const scenes = (project.value.scenes || []).map(row => row.scene_id === s.scene_id ? { ...row, intent: s.intent } : row); const { data } = await patchScenes(scenes, alive); if (alive()) { project.value = data; await loadProject(alive) } }) }
function prepareShot() { run(async alive => { const { data } = await api.post('/video/jobs/',{ operation: 'generate', route_id: routeId.value, prompt: prompt.value, cinema: chosenCinema(cinema.value) }); if (alive()) emit('job',data) }) }
function addClips(kind,items) { for (const item of items) { const id = item.attachment_id; if (kind === 'video') videoClips.value.push({ attachment_id: id, in_ms: 0, transition: { kind: 'cut', ms: 500 } }); if (kind === 'audio' && sounds.value.length < 8) sounds.value.push({ attachment_id: id, start_ms: 0, gain_db: 0, duck: false, mute_original: false }); if (kind === 'overlay' && overlays.value.length < 8) overlays.value.push({ attachment_id: id, position: 'top-right', scale: 0.18 }) } }
function move(i,delta) { const clips = videoClips.value; [clips[i],clips[i+delta]] = [clips[i+delta],clips[i]] }
function cleanTimelineItem(item) {
  return Object.fromEntries(Object.entries(item)
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => [key, typeof value === 'object' && !Array.isArray(value) ? cleanTimelineItem(value) : value]))
}
function saveTimeline() {
  run(async alive => {
    const edl = { tracks: [
      { kind: 'video', clips: videoClips.value.map(c => cleanTimelineItem({ ...c, transition: c.transition.kind === 'cut' ? undefined : c.transition })) },
      { kind: 'audio', clips: sounds.value.map(cleanTimelineItem) },
      { kind: 'overlay', items: overlays.value.map(cleanTimelineItem) },
      { kind: 'text', cues: captionCues.value.map(cleanTimelineItem), position: 'bottom' },
    ] }
    const { data } = await api.post(`/video/projects/${projectId.value}/timeline/`, { edl })
    if (alive()) revisionId.value = data.revision_id
  })
}
function exportTimeline() { run(async alive => { const { data } = await api.post('/video/jobs/',{ operation:'export', project_id:projectId.value, params:{ timeline_revision_id:revisionId.value } }); if (alive()) emit('job',data) }) }
async function patchScenes(scenes, alive) {
  try { return await api.patch(`/video/projects/${projectId.value}/`, { revision: board.value.revision, scenes }) }
  catch (e) { if (e.response?.status === 409) { await loadProject(alive); throw Error('Someone changed this project. Review the current storyboard before trying again.') } throw e }
}
function createProject() { run(async alive => { const {data} = await api.post('/video/projects/',{ title:newTitle.value }); if (alive()) { projects.value.push(data); projectId.value = data.project_id; await loadProject(alive) } }) }
function addScene() { if (!project.value) return; run(async alive => { await patchScenes([...(project.value.scenes || []), { title:`Scene ${(project.value.scenes || []).length+1}`, intent:newIntent.value, planned_ms:5000 }], alive); if (alive()) { newIntent.value = ''; await loadProject(alive) } }) }
function chooseTake(scene,take) { run(async alive => { await api.post('/video/selection/',{ project_id:projectId.value, scene_id:scene.scene_id, attachment_id:take.attachment_id, expected_revision:board.value.revision }); if (alive()) await loadProject(alive) }) }
</script>
