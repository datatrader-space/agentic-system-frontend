<template>
  <!-- The Video panel (prototype screen 2): what the next request will act on is always visible. The chat
       and these controls edit the same project records on the server. -->
  <div class="vp" :class="{ bare }" data-test="video-panel">
    <header v-if="!bare" class="vp-header">
      <div><h2>{{ video.project ? video.project.title : 'Video' }}</h2>
        <p class="vp-header-sub">{{ video.project ? `${scenes.length} scenes, ${totalSeconds} s planned` : 'Preview, refine and keep every version.' }}</p></div>
      <span v-if="active" class="vp-badge">v{{ active.version || 1 }}</span>
    </header>
    <div class="vp-tabs" role="tablist" aria-label="Video panel">
      <button v-for="t in tabs" :key="t.value" type="button" role="tab" class="vp-tab" :class="{ on: video.panelTab === t.value }"
              :aria-selected="video.panelTab === t.value ? 'true' : 'false'" :id="'video-tab-' + t.value" :aria-controls="'video-pane-' + t.value" :tabindex="video.panelTab === t.value ? 0 : -1" @keydown="navigateTab($event, t.value)" :data-test="'video-tab-' + t.value"
              @click="video.panelTab = t.value">{{ t.label }}<span v-if="t.count" class="vp-count">{{ t.count }}</span></button>
    </div>

    <!-- PREVIEW -->
    <section v-show="video.panelTab === 'preview'" class="vp-body" role="tabpanel" id="video-pane-preview" aria-labelledby="video-tab-preview" tabindex="0">
      <div class="vp-viewer" :style="{ '--ar': monitorRatio }">
        <div v-if="active" class="vp-monitor" :class="{ split: !!compare }" data-test="video-monitor">
          <video ref="playerEl" :key="active.url" :src="active.url" controls preload="metadata" playsinline class="vp-video"
                 @timeupdate="onTime" @loadedmetadata="onTime"></video>
          <video v-if="compare" :key="compare.url" :src="compare.url" controls preload="metadata" playsinline class="vp-video"></video>
        </div>
        <div v-else class="vp-monitor vp-slate" data-test="video-monitor-empty">
          <span class="vp-safe" aria-hidden="true"></span>
          <div class="vp-slate-text">
            <p class="vp-slate-title">No take yet</p>
            <p>Describe the video to the agent. The first take plays here.</p>
          </div>
        </div>
        <p v-if="active" class="vp-readout">
          <span class="vp-tc" aria-label="Playback position">{{ clock(pos) }} / {{ clock(dur) }}</span>
          <span>Version {{ active.version || 1 }}<template v-if="compare">, compared with version {{ compare.version }}</template></span>
          <span v-if="sceneLabel" class="vp-readout-scene">{{ sceneLabel }}</span>
        </p>
      </div>
      <div class="vp-actions" v-if="active">
        <button type="button" class="vp-btn" @click="editScene">Edit {{ activeScene ? 'scene' : 'video' }}</button>
        <button v-if="video.can.extend" type="button" class="vp-btn" data-test="video-continue" @click="continueClip">Continue</button>
        <button type="button" class="vp-btn" @click="toggleCompare" :disabled="video.versions.length < 2">
          {{ compare ? 'Stop comparing' : 'Compare' }}</button>
        <button type="button" class="vp-btn" data-test="video-save-frame" @click="saveFrame">Save frame</button>
      </div>
      <div v-if="video.project" class="vp-story">
        <h3 class="vp-h">Your story <span class="vp-sub">{{ scenes.length }} scenes, {{ totalSeconds }} s</span></h3>
        <ol class="vp-scenes" aria-label="Scenes">
          <li v-for="(s, i) in scenes" :key="s.scene_id" class="vp-scene" :class="{ on: s.scene_id === video.project.active_scene_id }">
            <button type="button" class="vp-scene-btn" :aria-current="s.scene_id === video.project.active_scene_id ? 'true' : 'false'"
                    @click="selectScene(s)">
              <MediaThumb v-if="s.selected_take" :item="{ ...s.selected_take, media_type: 'video' }" :src="s.selected_take.url" class="vp-thumb" aria-hidden="true" />
              <span v-else class="vp-thumb vp-thumb-empty" aria-hidden="true">No take yet</span>
              <span class="vp-scene-title">{{ String(i + 1).padStart(2, '0') }} {{ s.title || 'Scene' }}</span>
              <span class="vp-scene-meta">{{ seconds(s.planned_ms) }}, {{ s.selected_take ? 'ready' : 'not rendered' }}
                <span v-if="s.selected_take && s.selected_take.version > 1" class="vp-badge">v{{ s.selected_take.version }}</span></span>
            </button>
            <div class="vp-scene-ops">
              <button type="button" class="vp-mini" :aria-label="'Move scene ' + (i + 1) + ' left'" :disabled="i === 0"
                      @click="video.moveScene(i, -1)">‹</button>
              <button type="button" class="vp-mini" :aria-label="'Move scene ' + (i + 1) + ' right'" :disabled="i === scenes.length - 1"
                      @click="video.moveScene(i, 1)">›</button>
              <button type="button" class="vp-mini wide" @click="renderScene(s)">{{ s.selected_take ? 'New take' : 'Render' }}</button>
            </div>
          </li>
        </ol>
        <div v-if="tl.music.attachment_id" class="vp-music">Music on the timeline: {{ musicLabel(tl.music.attachment_id) }}</div>
        <div class="vp-next">
          <span class="vp-next-text">The next edit changes {{ activeScene ? (activeScene.title || 'this scene') + ' only' : 'the active video' }}. The model and cost come with the estimate.</span>
          <button type="button" class="vp-btn" @click="editScene">Describe the edit</button>
        </div>
      </div>
    </section>

    <!-- IMAGES (D14): what Image mode made in this session -->
    <section v-show="video.panelTab === 'images'" class="vp-body" role="tabpanel" id="video-pane-images" aria-labelledby="video-tab-images" tabindex="0">
      <VideoImageResults />
    </section>

    <!-- STORYBOARD -->
    <section v-show="video.panelTab === 'storyboard'" class="vp-body" role="tabpanel" id="video-pane-storyboard" aria-labelledby="video-tab-storyboard" tabindex="0">
      <p v-if="!video.project" class="vp-empty">Start a Story video to plan scenes here.</p>
      <template v-else>
        <label class="vp-field"><span>Title</span>
          <input :value="video.project.title" @change="video.patchProject({ title: $event.target.value })" /></label>
        <label class="vp-field"><span>Goal and audience</span>
          <textarea rows="2" :value="(video.project.brief || {}).goal"
                    @change="video.patchProject({ brief: { ...(video.project.brief || {}), goal: $event.target.value } })"></textarea></label>
        <label class="vp-field"><span>Spending limit per render without asking (USD, blank = always ask)</span>
          <input type="number" min="0" step="0.5" :value="video.project.approved_cap_usd || ''"
                 @change="video.patchProject({ approved_cap_usd: $event.target.value || null })" /></label>
        <p v-if="!scenes.length" class="vp-help">Plan your story in chat, or add your first scene below.</p>
        <ol class="vp-board">
          <li v-for="(s, i) in scenes" :key="s.scene_id" class="vp-board-row">
            <span class="vp-board-n">{{ i + 1 }}</span>
            <label class="vp-board-title"><span class="vp-input-label">Scene title</span><input :value="s.title" :aria-label="'Scene ' + (i + 1) + ' title'"
                   @change="saveScene(i, { title: $event.target.value })" /></label>
            <label class="vp-board-intent"><span class="vp-input-label">What happens</span><textarea rows="2" :value="s.intent" :aria-label="'Scene ' + (i + 1) + ' description'"
                      @change="saveScene(i, { intent: $event.target.value })"></textarea></label>
            <label class="vp-board-len"><span class="vp-input-label">Seconds</span><input type="number" min="1" max="120" :value="Math.round((s.planned_ms || 4000) / 1000)"
                   :aria-label="'Scene ' + (i + 1) + ' seconds'" @change="saveScene(i, { planned_ms: Number($event.target.value) * 1000 })" /></label>
            <button type="button" class="vp-mini" :aria-label="'Remove scene ' + (i + 1)" @click="removeScene(i)">×</button>
          </li>
        </ol>
        <div class="vp-actions">
          <button type="button" class="vp-btn" @click="addScene">Add scene</button>
          <span class="vp-sub" v-if="!allRendered">Every scene needs a take before the timeline and export.</span>
        </div>

        <!-- TIMELINE: the cut that is exported. Trims, captions and music are saved as a revision; the server
             pins each scene to its take at that moment, and Export renders exactly that revision. -->
        <section v-if="allRendered" class="vp-timeline" aria-labelledby="vp-tl-title" data-test="video-timeline">
          <h3 id="vp-tl-title" class="vp-h">Timeline <span class="vp-sub">{{ tlSummary }}</span></h3>
          <ol class="vp-tl-clips" aria-label="Clips in order">
            <li v-for="(c, i) in tl.clips" :key="c.scene_id" class="vp-tl-clip">
              <span class="vp-tl-name">{{ String(i + 1).padStart(2, '0') }} {{ c.title || 'Scene' }}
                <span class="vp-sub">{{ seconds(c.duration_ms) }} take</span></span>
              <label><span class="vp-input-label">Start at (s)</span>
                <input type="number" min="0" step="0.1" :max="c.duration_ms / 1000" :value="c.in_s"
                       :aria-label="'Scene ' + (i + 1) + ' start in seconds'" @change="setClip(i, 'in_s', $event.target.value)" /></label>
              <label><span class="vp-input-label">End at (s)</span>
                <input type="number" min="0" step="0.1" :max="c.duration_ms / 1000" :value="c.out_s"
                       :aria-label="'Scene ' + (i + 1) + ' end in seconds'" @change="setClip(i, 'out_s', $event.target.value)" /></label>
            </li>
          </ol>
          <fieldset class="vp-tl-group"><legend>Captions</legend>
            <p v-if="!tl.cues.length" class="vp-help">Add exact text: a price, a line of dialogue, a call to action.</p>
            <div v-for="(q, i) in tl.cues" :key="i" class="vp-tl-cue">
              <label class="vp-tl-cue-text"><span class="vp-input-label">Text</span>
                <input :value="q.text" maxlength="300" :aria-label="'Caption ' + (i + 1) + ' text'" @change="setCue(i, 'text', $event.target.value)" /></label>
              <label><span class="vp-input-label">From (s)</span>
                <input type="number" min="0" step="0.1" :value="q.start_s" :aria-label="'Caption ' + (i + 1) + ' start'" @change="setCue(i, 'start_s', $event.target.value)" /></label>
              <label><span class="vp-input-label">To (s)</span>
                <input type="number" min="0" step="0.1" :value="q.end_s" :aria-label="'Caption ' + (i + 1) + ' end'" @change="setCue(i, 'end_s', $event.target.value)" /></label>
              <button type="button" class="vp-mini" :aria-label="'Remove caption ' + (i + 1)" @click="removeCue(i)">×</button>
            </div>
            <div class="vp-actions">
              <button type="button" class="vp-btn" data-test="video-tl-add-caption" @click="addCue">Add caption</button>
              <label class="vp-field vp-tl-pos"><span>Position</span>
                <select v-model="tl.position" @change="dirty = true"><option value="bottom">Bottom</option><option value="top">Top</option><option value="center">Center</option></select></label>
            </div>
          </fieldset>
          <fieldset class="vp-tl-group"><legend>Music</legend>
            <p v-if="!musicOptions.length" class="vp-help">Pin an audio file as Music in Assets to add a soundtrack.</p>
            <template v-else>
              <label class="vp-field"><span>Track</span>
                <select v-model="tl.music.attachment_id" data-test="video-tl-music" @change="dirty = true">
                  <option value="">No music</option>
                  <option v-for="m in musicOptions" :key="m.attachment_id" :value="m.attachment_id">{{ musicLabel(m.attachment_id) }}</option>
                </select></label>
              <div v-if="tl.music.attachment_id" class="vp-tl-music">
                <label class="vp-field"><span>Volume (dB)</span>
                  <input type="number" min="-30" max="6" step="1" v-model.number="tl.music.gain_db" @change="dirty = true" /></label>
                <label class="vp-check"><input type="checkbox" v-model="tl.music.duck" @change="dirty = true" /> Lower music under speech</label>
                <label class="vp-check"><input type="checkbox" v-model="tl.music.mute_original" @change="dirty = true" /> Mute the clips' own sound</label>
              </div>
            </template>
          </fieldset>
          <p v-if="tlError" class="vp-error" role="alert">{{ tlError }}</p>
          <div class="vp-actions">
            <button type="button" class="vp-btn" data-test="video-tl-save" :disabled="!!tlError || savingTl" @click="saveTimeline">
              {{ savingTl ? 'Saving…' : 'Save timeline' }}</button>
            <span class="vp-sub" role="status">{{ savedLabel }}</span>
          </div>

          <BottomSheet label="Export" :summary="exportAspects.join(', ')" test-id="video-export-sheet" ref="exportSheet">
            <div class="vp-export">
              <fieldset class="vp-aspects"><legend>Export shapes</legend>
                <label v-for="a in ['16:9', '9:16', '1:1']" :key="a"><input type="checkbox" :value="a" v-model="exportAspects" /> {{ a }}</label>
              </fieldset>
              <button type="button" class="vp-btn primary" data-test="video-export" :disabled="!!tlError || exporting" @click="exportCut">
                {{ exporting ? 'Starting export…' : 'Export this cut' }}</button>
              <span class="vp-sub">Export renders the saved timeline exactly; changing a take later does not change it.</span>
            </div>
          </BottomSheet>
        </section>
      </template>
    </section>

    <!-- ASSETS -->
    <section v-show="video.panelTab === 'assets'" class="vp-body" role="tabpanel" id="video-pane-assets" aria-labelledby="video-tab-assets" tabindex="0">
      <div class="vp-actions">
        <button type="button" class="vp-btn primary" data-test="video-open-library" @click="video.libraryOpen = true">Open Library</button>
        <span class="vp-sub">Everything you uploaded or made, in every chat, and your ingredients.</span>
      </div>
      <p v-if="!video.project" class="vp-empty">Assets belong to a project. Use a file from the Library, or start a Story video, to keep references here.</p>
      <template v-else>
        <ul class="vp-assets">
          <li v-for="a in assets" :key="a.asset_id" class="vp-asset">
            <span v-if="a.media_type === 'audio'" class="vp-thumb vp-audio" aria-label="Audio file">Audio</span>
            <MediaThumb v-else :item="a" :src="a.url" class="vp-thumb" />
            <span class="vp-asset-role">{{ a.role }}</span>
            <button v-if="a.pinned" type="button" class="vp-mini wide" @click="video.unpin(a)">Unpin</button>
          </li>
        </ul>
        <p v-if="!assets.length" class="vp-help">Pin a reference from this chat to reuse it across your project.</p>
        <h4 class="vp-h4">From this chat</h4>
        <p v-if="!chatMedia.length" class="vp-help">Upload images, video or audio in chat to add them here.</p>
        <ul class="vp-assets">
          <li v-for="m in chatMedia" :key="m.attachment_id" class="vp-asset">
            <span v-if="m.media_type === 'audio'" class="vp-thumb vp-audio" aria-label="Audio file">Audio</span>
            <MediaThumb v-else :item="m" :src="m.url" class="vp-thumb" />
            <label class="vp-sr" :for="'pin-' + m.attachment_id">Role</label>
            <select :id="'pin-' + m.attachment_id" v-model="pinRole[m.attachment_id]" class="vp-role">
              <option value="subject">Subject</option><option value="style">Style</option><option value="music">Music</option>
            </select>
            <button type="button" class="vp-mini wide" @click="video.pin(m, pinRole[m.attachment_id] || 'subject', chat.conversationId)">Pin</button>
          </li>
        </ul>
      </template>
    </section>

    <!-- VERSIONS -->
    <section v-show="video.panelTab === 'versions'" class="vp-body" role="tabpanel" id="video-pane-versions" aria-labelledby="video-tab-versions" tabindex="0">
      <div v-if="!video.versions.length" class="vp-empty"><h3>No versions yet</h3><p>Every take you render or edit is kept here. Restore an earlier one without rendering again.</p></div>
      <ul class="vp-versions">
        <li v-for="v in video.versions" :key="v.attachment_id" class="vp-version" :class="{ on: v.is_active }">
          <MediaThumb :item="{ ...v, media_type: v.media_type || 'video' }" :src="v.url" class="vp-thumb" />
          <span class="vp-version-text"><strong>v{{ v.version }}</strong> {{ v.title }}
            <span class="vp-sub">{{ v.source_kind }}<span v-if="v.duration_ms">, {{ seconds(v.duration_ms) }}</span></span></span>
          <span v-if="v.is_active" class="vp-badge">Active</span>
          <div class="vp-version-ops">
            <button type="button" class="vp-mini wide" @click="previewVersion(v)">View</button>
            <button v-if="!v.is_active" type="button" class="vp-mini wide" @click="video.restore(v, { conversationId: chat.conversationId })">Restore</button>
          </div>
        </li>
      </ul>
    </section>
    <!-- In Video Studio (bare) the page mounts the Library, so it opens before the first message too. -->
    <VideoLibrary v-if="video.libraryOpen && !bare" />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import MediaThumb from '../common/MediaThumb.vue'
import api from '../../services/api'
import { useVideoStore } from '../../stores/useVideoStore'
import { useChatStore } from '../../stores/useChatStore'
import { notify } from '../../composables/useNotify'
import BottomSheet from './BottomSheet.vue'
import VideoLibrary from './VideoLibrary.vue'
import VideoImageResults from './VideoImageResults.vue'

// bare: the host shows the project title itself and frames the panel (Video Studio's canvas).
defineProps({ bare: { type: Boolean, default: false } })
const video = useVideoStore()
const chat = useChatStore()
const playerEl = ref(null)
const exportAspects = ref(['16:9'])
const pinRole = reactive({})
const chatMedia = ref([])

const scenes = computed(() => (video.project && video.project.scenes) || [])
const assets = computed(() => (video.project && video.project.assets) || [])
// A soundtrack is any pinned Music asset or audio file (the server mixes audio or a video's sound).
const musicOptions = computed(() => assets.value.filter((a) => a.role === 'music' || a.media_type === 'audio'))
const activeScene = computed(() => scenes.value.find((s) => video.project && s.scene_id === video.project.active_scene_id) || null)
const active = computed(() => video.activeVideo)
const compare = computed(() => video.versions.find((v) => v.attachment_id === video.compareAttachmentId) || null)
const sceneLabel = computed(() => activeScene.value ? `Scene ${scenes.value.indexOf(activeScene.value) + 1}${activeScene.value.title ? ': ' + activeScene.value.title : ''}` : '')
// The monitor takes the project's shape (16:9 until a project says otherwise).
const monitorRatio = computed(() => {
  const m = /^(\d+):(\d+)$/.exec((video.project && video.project.aspect_ratio) || '')
  return m && Number(m[2]) ? Number(m[1]) / Number(m[2]) : 16 / 9
})
const pos = ref(0)
const dur = ref(0)
function onTime(e) { pos.value = e.target.currentTime || 0; dur.value = Number.isFinite(e.target.duration) ? e.target.duration : 0 }
watch(() => active.value && active.value.url, () => { pos.value = 0; dur.value = 0 })
// m:ss.t: the position a person reads off the monitor (no frame count: the clip's frame rate is not known here).
function clock(t) {
  const tenths = Math.floor((t || 0) * 10)
  const m = Math.floor(tenths / 600)
  const sec = Math.floor((tenths % 600) / 10)
  return `${m}:${String(sec).padStart(2, '0')}.${tenths % 10}`
}
const totalSeconds = computed(() => Math.round(scenes.value.reduce((t, s) => t + (s.planned_ms || 0), 0) / 1000))
const allRendered = computed(() => scenes.value.length > 0 && scenes.value.every((s) => s.selected_take))
const tabs = computed(() => [
  { value: 'preview', label: 'Preview' }, { value: 'images', label: 'Images', count: video.sessionImages.length || 0 },
  { value: 'storyboard', label: 'Storyboard' },
  { value: 'assets', label: 'Assets' }, { value: 'versions', label: 'Versions', count: video.versions.length || 0 },
])

function navigateTab(event, current) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()
  const values = tabs.value.map((t) => t.value)
  const index = values.indexOf(current)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + values.length) % values.length
  video.panelTab = values[next]
  event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus()
}

function seconds(ms) { return ms ? `${Math.round(ms / 100) / 10} s` : '–' }
function currentMs() { return playerEl.value ? Math.round((playerEl.value.currentTime || 0) * 1000) : 0 }

function editScene() {
  const where = activeScene.value ? `Edit scene ${scenes.value.indexOf(activeScene.value) + 1}: ` : 'Edit the active video: '
  window.dispatchEvent(new CustomEvent('video-compose', { detail: { text: where } }))
}
async function continueClip() {
  if (!active.value) return
  await video.request({ prompt: 'Continue this clip: carry the action on naturally from its last moment.',
                        chat, task: 'extend', baseAttachmentId: active.value.attachment_id })
}
async function saveFrame() {
  if (!active.value) return
  await video.local('frame', { at_ms: currentMs() }, { chat, baseAttachmentId: active.value.attachment_id })
}
function toggleCompare() {
  if (compare.value) { video.compareAttachmentId = null; return }
  const other = video.versions.find((v) => active.value && v.attachment_id !== active.value.attachment_id)
  video.compareAttachmentId = other ? other.attachment_id : null
}
function previewVersion(v) {
  video.previewAttachmentId = v.attachment_id
  video.panelTab = 'preview'
}
async function selectScene(s) {
  if (s.selected_take) await video.restore({ attachment_id: s.selected_take.attachment_id, version: s.selected_take.version },
                                           { conversationId: chat.conversationId, sceneId: s.scene_id })
}
async function renderScene(s) {
  await video.request({ prompt: `Render the scene "${s.title || 'Untitled'}": ${s.intent || s.title || ''}`.trim(),
                        chat, task: 'quick', sceneId: s.scene_id })
}
function sceneList(override = {}) {
  return scenes.value.map((x, i) => ({ scene_id: x.scene_id, title: x.title, intent: x.intent, planned_ms: x.planned_ms,
                                       references: x.references, ...(override[i] || {}) }))
}
function saveScene(i, changes) { video.patchProject({ scenes: sceneList({ [i]: changes }) }) }
function addScene() { video.patchProject({ scenes: [...sceneList(), { title: `Scene ${scenes.value.length + 1}`, intent: '', planned_ms: 4000, references: [] }] }) }
function removeScene(i) { video.patchProject({ scenes: sceneList().filter((_, j) => j !== i) }) }
// ── timeline (the exported cut) ─────────────────────────────────────────────────────────────────────
const tl = reactive({ clips: [], cues: [], position: 'bottom',
                      music: { attachment_id: '', gain_db: -6, duck: true, mute_original: false } })
const dirty = ref(false)
const savingTl = ref(false)
const exporting = ref(false)
const exportSheet = ref(null)
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : 0 }

// Load the saved revision once per project, then keep the clip list in step with the scenes (a trim
// survives a reorder; a new scene arrives untrimmed).
let loadedFor = null
function syncTimeline() {
  const p = video.project
  if (!p) return
  const saved = (p.timeline && p.timeline.edl) || null
  if (loadedFor !== p.project_id) {
    loadedFor = p.project_id
    const text = saved && saved.tracks.find((t) => t.kind === 'text')
    const audio = saved && saved.tracks.find((t) => t.kind === 'audio')
    tl.cues = ((text && text.cues) || []).map((q) => ({ text: q.text, start_s: q.start_ms / 1000, end_s: q.end_ms / 1000 }))
    tl.position = (text && text.position) || 'bottom'
    const a = audio && audio.clips && audio.clips[0]
    tl.music = a ? { attachment_id: a.attachment_id, gain_db: a.gain_db, duck: !!a.duck, mute_original: !!a.mute_original }
      : { attachment_id: '', gain_db: -6, duck: true, mute_original: false }
    tl.clips = []
    dirty.value = false
  }
  const savedClips = saved ? (saved.tracks.find((t) => t.kind === 'video') || { clips: [] }).clips : []
  const prior = Object.fromEntries(tl.clips.map((c) => [c.scene_id, c]))
  tl.clips = scenes.value.filter((s) => s.selected_take).map((s) => {
    const take = s.selected_take
    const dur = take.duration_ms || s.planned_ms || 4000
    const before = prior[s.scene_id] || savedClips.find((c) => c.scene_id === s.scene_id)
    const inS = before ? (before.in_s ?? (before.in_ms || 0) / 1000) : 0
    const outS = before ? (before.out_s ?? (before.out_ms != null ? before.out_ms / 1000 : dur / 1000)) : dur / 1000
    return { scene_id: s.scene_id, title: s.title, duration_ms: dur, in_s: inS, out_s: outS }
  })
}
watch(() => [video.project && video.project.project_id, scenes.value], syncTimeline, { immediate: true, deep: true })

function setClip(i, key, value) { tl.clips[i][key] = num(value); dirty.value = true }
function addCue() {
  const total = tl.clips.reduce((t, c) => t + Math.max(0, c.out_s - c.in_s), 0)
  tl.cues.push({ text: '', start_s: 0, end_s: Math.min(3, Math.round(total * 10) / 10 || 3) })
  dirty.value = true
}
function setCue(i, key, value) { tl.cues[i][key] = key === 'text' ? value : num(value); dirty.value = true }
function removeCue(i) { tl.cues.splice(i, 1); dirty.value = true }
function musicLabel(id) {
  const a = assets.value.find((x) => x.attachment_id === id)
  return a ? `${a.role === 'music' ? 'Music' : 'Audio'} ${String(id).slice(0, 8)}` : String(id).slice(0, 8)
}

const tlTotal = computed(() => tl.clips.reduce((t, c) => t + Math.max(0, c.out_s - c.in_s), 0))
const tlSummary = computed(() => `${tl.clips.length} clips, ${Math.round(tlTotal.value * 10) / 10} s`
  + (tl.cues.length ? `, ${tl.cues.length} caption${tl.cues.length === 1 ? '' : 's'}` : '') + (tl.music.attachment_id ? ', music' : ''))
const tlError = computed(() => {
  for (const [i, c] of tl.clips.entries()) {
    if (c.out_s <= c.in_s) return `Scene ${i + 1}: the end must be after the start.`
    if (c.out_s * 1000 > c.duration_ms + 50) return `Scene ${i + 1}: the take is only ${seconds(c.duration_ms)} long.`
  }
  for (const [i, q] of tl.cues.entries()) {
    if (!q.text.trim()) return `Caption ${i + 1} has no text.`
    if (q.end_s <= q.start_s) return `Caption ${i + 1}: the end must be after the start.`
    if (q.end_s > tlTotal.value + 0.05) return `Caption ${i + 1} ends after the video (${Math.round(tlTotal.value * 10) / 10} s).`
  }
  return ''
})
const savedLabel = computed(() => {
  const t = video.project && video.project.timeline
  if (dirty.value) return 'Unsaved changes'
  return t ? `Saved as revision ${t.revision}` : 'Not saved yet'
})

function buildEdl() {
  const tracks = [{ kind: 'video', clips: tl.clips.map((c) => {
    const clip = { scene_id: c.scene_id }
    if (c.in_s > 0) clip.in_ms = Math.round(c.in_s * 1000)
    if (c.out_s * 1000 < c.duration_ms - 50) clip.out_ms = Math.round(c.out_s * 1000)
    return clip
  }) }]
  if (tl.cues.length) {
    tracks.push({ kind: 'text', position: tl.position, cues: tl.cues.map((q) => ({
      text: q.text.trim(), start_ms: Math.round(q.start_s * 1000), end_ms: Math.round(q.end_s * 1000) })) })
  }
  if (tl.music.attachment_id) tracks.push({ kind: 'audio', clips: [{ ...tl.music }] })
  return { tracks }
}
async function saveTimeline() {
  if (tlError.value) return null
  savingTl.value = true
  try {
    const saved = await video.saveTimeline(buildEdl())
    if (saved) dirty.value = false
    return saved
  } finally { savingTl.value = false }
}
// Export renders the SAVED revision: unsaved edits are saved first, so what is on screen is what renders.
async function exportCut() {
  if (tlError.value || exporting.value) return
  exporting.value = true
  try {
    let rev = video.project && video.project.timeline
    if (dirty.value || !rev) rev = await saveTimeline()
    if (!rev) return
    const job = await video.exportTimeline(exportAspects.value, { chat, revisionId: rev.revision_id })
    if (job) {
      notify.success(`Exporting revision ${rev.revision} in ${(exportAspects.value.length ? exportAspects.value : ['16:9']).join(', ')}.`)
      exportSheet.value?.hide()
    }
  } finally { exporting.value = false }
}

async function loadChatMedia() {
  if (!chat.conversationId || video.panelTab !== 'assets') return
  try {
    const res = await api.getConversationMedia(chat.conversationId)
    chatMedia.value = (res.data.media || []).filter((m) => m.attachment_id)
      .map((m) => ({ attachment_id: m.attachment_id, url: m.url, media_type: m.type || m.media_type, title: m.title }))
  } catch { chatMedia.value = [] }
}
watch(() => [video.panelTab, chat.conversationId], loadChatMedia, { immediate: true })
</script>

<style scoped>
/* The canvas. Colours come from the --vm-* tokens, so it reads right in the chat dock (light) and in Video Studio
   (the grading-suite greys); --vs-* only for status colours, with light fallbacks. */
.vp { container-type: inline-size; min-width: 0; display: flex; flex-direction: column; height: 100%; min-height: 0;
  background: var(--vm-surface-2, #f8fafc); color: var(--vm-ink, #0f172a); }
.vp.bare { background: transparent; }
.vp-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 18px 12px; background: var(--vm-surface, #fff); }
.vp-header > div { min-width: 0; }
.vp-header h2 { margin: 0; font-size: 16px; line-height: 1.3; font-weight: 600; letter-spacing: -.01em; overflow-wrap: anywhere; }
.vp-header-sub { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-soft, #64748b); }
.vp-tabs { flex-shrink: 0; display: flex; gap: 4px; padding: 0 14px; overflow-x: auto; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); }
.vp:not(.bare) .vp-tabs { background: var(--vm-surface, #fff); }
.vp-tab { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 10px; border: 0; border-bottom: 2px solid transparent;
  background: transparent; color: var(--vm-ink-soft, #64748b); font: inherit; font-size: 13.5px; font-weight: 500; white-space: nowrap; cursor: pointer; }
.vp-tab:hover { color: var(--vm-ink, #0f172a); }
.vp-tab.on { color: var(--vm-ink, #0f172a); border-bottom-color: var(--vm-violet, #4f46e5); }
.vp-count { font-size: 11.5px; color: var(--vm-ink-faint, #64748b); font-variant-numeric: tabular-nums; }
.vp-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 20px; display: grid; gap: 14px; align-content: start; }

/* The monitor: a black frame of the project's shape, centred in the canvas; its readout sits on its left edge. */
.vp-viewer { width: min(100%, calc(60vh * var(--ar, 1.7778))); margin: 0 auto; display: grid; gap: 8px; min-width: 0; }
.vp-monitor { position: relative; width: 100%; aspect-ratio: var(--ar, 1.7778); background: #000; border-radius: 2px; overflow: hidden; }
.vp-monitor.split { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
.vp-video { display: block; width: 100%; height: 100%; object-fit: contain; background: #000; }
.vp-slate { display: grid; place-items: center; background: #111214; }
.vp-safe { position: absolute; inset: 7%; pointer-events: none;
  background:
    linear-gradient(#5b5c63, #5b5c63) left top / 18px 1px no-repeat, linear-gradient(#5b5c63, #5b5c63) left top / 1px 18px no-repeat,
    linear-gradient(#5b5c63, #5b5c63) right top / 18px 1px no-repeat, linear-gradient(#5b5c63, #5b5c63) right top / 1px 18px no-repeat,
    linear-gradient(#5b5c63, #5b5c63) left bottom / 18px 1px no-repeat, linear-gradient(#5b5c63, #5b5c63) left bottom / 1px 18px no-repeat,
    linear-gradient(#5b5c63, #5b5c63) right bottom / 18px 1px no-repeat, linear-gradient(#5b5c63, #5b5c63) right bottom / 1px 18px no-repeat; }
.vp-slate-text { position: relative; max-width: 30em; padding: 0 12%; text-align: center; color: #a7a8ae; font-size: 13.5px; line-height: 1.55; }
.vp-slate-text p { margin: 0; }
.vp-slate-title { margin-bottom: 4px !important; color: #ededef; font-size: 17px; font-weight: 600; letter-spacing: -.01em; }
.vp-readout { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 18px; margin: 0; font-size: 12.5px; color: var(--vm-ink-soft, #64748b); }
.vp-tc { font-size: 15px; font-weight: 600; color: var(--vm-ink, #0f172a); font-variant-numeric: tabular-nums; letter-spacing: .01em; }
.vp-readout-scene { color: var(--vm-ink, #0f172a); }

.vp-meta, .vp-sub { margin: 0; font-size: 12px; font-weight: 400; color: var(--vm-ink-soft, #64748b); }
.vp-empty { padding: 28px 20px; border: 1px dashed var(--vm-line, #cbd5e1); border-radius: 8px; color: var(--vm-ink-soft, #64748b); font-size: 13.5px; line-height: 1.6; }
.vp-empty h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; color: var(--vm-ink, #0f172a); }
.vp-empty p { margin: 0; }
.vp-help { margin: 0; font-size: 12.5px; line-height: 1.6; color: var(--vm-ink-soft, #64748b); }
.vp-story { display: grid; gap: 14px; min-width: 0; padding-top: 6px; border-top: 1px solid var(--vm-line-2, #e5e7eb); }
.vp-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.vp-viewer + .vp-actions { justify-content: center; }
.vp-btn { min-height: 40px; padding: 0 14px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 6px; background: transparent; color: var(--vm-ink, #0f172a);
  font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: background-color .15s; }
.vp-btn:hover:not(:disabled) { background: var(--vm-surface, #fff); }
.vp-btn.primary { background: var(--vm-violet-d, #4f46e5); border-color: transparent; color: #fff; font-weight: 600; }
.vp-btn.primary:hover:not(:disabled) { background: var(--vm-violet, #6366f1); }
.vp-btn:disabled { opacity: .45; cursor: not-allowed; }
.vp-h { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; margin: 0; font-size: 14px; font-weight: 600; }
.vp-h4 { margin: 4px 0 0; font-size: 13px; font-weight: 600; }
.vp-scenes { list-style: none; margin: 0; padding: 0 0 4px; display: flex; gap: 10px; overflow-x: auto; }
.vp-scene { flex: 0 0 200px; display: grid; gap: 6px; padding: 6px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; }
.vp-scene.on { border-color: var(--vm-violet, #4f46e5); box-shadow: inset 0 0 0 1px var(--vm-violet, #4f46e5); }
.vp-scene-btn { display: grid; gap: 4px; padding: 0; border: none; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.vp-thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 4px; background: #000; display: grid; place-items: center; color: #a7a8ae; font-size: 11.5px; }
.vp-scene-title { font-weight: 600; font-size: 13px; }
.vp-scene-meta { font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.vp-badge { font-size: 11.5px; font-weight: 600; color: var(--vs-accent-ink, var(--vm-violet-d, #4f46e5)); font-variant-numeric: tabular-nums; }
.vp-scene-ops { display: flex; gap: 4px; }
.vp-mini { min-width: 40px; min-height: 40px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 6px; background: transparent; color: var(--vm-ink, #0f172a);
  font: inherit; font-size: 13px; cursor: pointer; }
.vp-mini.wide { padding: 0 10px; }
.vp-mini:hover:not(:disabled) { background: var(--vm-surface, #fff); }
.vp-mini:disabled { opacity: .4; cursor: not-allowed; }
.vp-music { padding: 10px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 6px; font-size: 13px; }
.vp-timeline { display: grid; gap: 12px; min-width: 0; padding-top: 14px; border-top: 1px solid var(--vm-line-2, #e5e7eb); }
.vp-tl-clips { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.vp-tl-clip { display: grid; grid-template-columns: minmax(0, 1fr) 96px 96px; gap: 10px; align-items: end; }
.vp-tl-name { display: grid; gap: 2px; min-width: 0; font-weight: 600; font-size: 13px; overflow-wrap: anywhere; }
.vp-tl-group { display: grid; gap: 10px; min-width: 0; margin: 0; padding: 10px 12px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 6px; }
.vp-tl-group legend { padding: 0 4px; font-size: 12.5px; font-weight: 600; }
.vp-tl-cue { display: grid; grid-template-columns: minmax(0, 1fr) 84px 84px 40px; gap: 8px; align-items: end; }
.vp-tl-music { display: grid; gap: 4px; }
.vp-tl-pos { min-width: 140px; }
.vp-timeline label { display: grid; gap: 6px; min-width: 0; }
.vp-timeline input, .vp-timeline select, .vp-field input, .vp-field textarea, .vp-board input, .vp-board textarea, .vp-role {
  width: 100%; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 8px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 6px;
  background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a); font: inherit; font-size: 13.5px; font-weight: 400; }
.vp-timeline .vp-check { display: inline-flex; grid-auto-flow: column; align-items: center; gap: 8px; min-height: 40px; font-size: 13px; }
.vp-timeline .vp-check input { width: 18px; min-height: 18px; }
.vp-error { margin: 0; font-size: 12.5px; color: var(--vs-bad-ink, #b91c1c); }
.vp-export { display: grid; gap: 10px; }
.vp-next { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
.vp-next-text { font-size: 12.5px; line-height: 1.5; color: var(--vm-ink-soft, #64748b); }
.vp-field { display: grid; gap: 6px; font-size: 12.5px; font-weight: 500; color: var(--vm-ink-soft, #64748b); }
.vp-board { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.vp-board-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) 80px 40px; gap: 12px; align-items: end; padding: 12px;
  border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; }
.vp-board-title, .vp-board-intent { grid-column: 2 / -1; }
.vp-board-len { grid-column: 2 / 4; max-width: 120px; }
.vp-board label { display: grid; gap: 6px; min-width: 0; }
.vp-input-label { font-size: 11.5px; font-weight: 500; color: var(--vm-ink-soft, #64748b); }
.vp-board-n { grid-column: 1; grid-row: 1; align-self: center; padding-top: 8px; font-weight: 600; color: var(--vm-ink-soft, #64748b); font-variant-numeric: tabular-nums; }
.vp-aspects { display: flex; flex-wrap: wrap; gap: 14px; padding: 8px 12px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 6px; font-size: 13px; }
.vp-aspects label { min-height: 40px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.vp-assets, .vp-versions { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.vp-asset, .vp-version { display: grid; grid-template-columns: 96px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 8px;
  border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; }
.vp-version.on { border-color: var(--vm-violet, #4f46e5); }
.vp-version-text { display: grid; min-width: 0; font-size: 13px; overflow-wrap: anywhere; }
.vp-version-ops { grid-column: 2 / -1; display: flex; justify-content: flex-end; gap: 4px; }
.vp-asset-role { font-size: 12.5px; text-transform: capitalize; }
.vp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.vp-tab:focus-visible, .vp-btn:focus-visible, .vp-mini:focus-visible, .vp-scene-btn:focus-visible, .vp-body:focus-visible,
.vp input:focus-visible, .vp textarea:focus-visible, .vp select:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }
@media (pointer: coarse) { .vp-btn, .vp-mini, .vp-timeline input, .vp-timeline select, .vp-field input, .vp-board input, .vp-role { min-height: 44px; } .vp-mini { min-width: 44px; } }
@container (max-width: 420px) {
  .vp-header { padding: 14px 12px 10px; }
  .vp-body { padding: 12px; }
  .vp-tabs { padding: 0 6px; }
  .vp-tab { padding: 0 8px; font-size: 12.5px; }
  .vp-monitor.split { grid-template-columns: 1fr; aspect-ratio: auto; }
  .vp-board-row { padding: 10px; gap: 10px; grid-template-columns: 20px minmax(0, 1fr) 60px 40px; }
  .vp-next .vp-btn { width: 100%; }
  .vp-asset, .vp-version { grid-template-columns: 72px minmax(0, 1fr) auto; gap: 8px; }
  .vp-tl-clip { grid-template-columns: 1fr 1fr; }
  .vp-tl-name { grid-column: 1 / -1; }
  .vp-tl-cue { grid-template-columns: 1fr 1fr 44px; }
  .vp-tl-cue-text { grid-column: 1 / -1; }
  .vp-timeline input, .vp-timeline select, .vp-field input, .vp-field textarea, .vp-board input, .vp-board textarea, .vp-role { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .vp * { transition: none !important; } }
</style>
