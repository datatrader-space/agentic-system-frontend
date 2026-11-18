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
          <span class="vp-sub" v-if="!allRendered">Every scene needs a take before the cut can be edited.</span>
        </div>

        <!-- The cut is edited in the clip editor (VIDEO_CLIP_EDITOR_PLAN.md E1): one timeline screen, not two. -->
        <div v-if="allRendered && video.project" class="vp-actions" data-test="video-timeline">
          <RouterLink class="vp-btn primary" data-test="video-edit-cut" :to="{ path: '/video-studio/editor', query: { project_id: video.project.project_id } }">Edit the cut</RouterLink>
          <span class="vp-sub">Trim, reorder, add text, captions and music, then export, in the clip editor.</span>
        </div>
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
import VideoLibrary from './VideoLibrary.vue'
import VideoImageResults from './VideoImageResults.vue'

// bare: the host shows the project title itself and frames the panel (Video Studio's canvas).
defineProps({ bare: { type: Boolean, default: false } })
const video = useVideoStore()
const chat = useChatStore()
const playerEl = ref(null)
const pinRole = reactive({})
const chatMedia = ref([])

const scenes = computed(() => (video.project && video.project.scenes) || [])
const assets = computed(() => (video.project && video.project.assets) || [])
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
.vp-field input, .vp-field textarea, .vp-board input, .vp-board textarea, .vp-role {
  width: 100%; min-width: 0; min-height: 40px; box-sizing: border-box; padding: 8px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 6px;
  background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a); font: inherit; font-size: 13.5px; font-weight: 400; }
.vp-error { margin: 0; font-size: 12.5px; color: var(--vs-bad-ink, #b91c1c); }
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
@media (pointer: coarse) { .vp-btn, .vp-mini, .vp-field input, .vp-board input, .vp-role { min-height: 44px; } .vp-mini { min-width: 44px; } }
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
  .vp-field input, .vp-field textarea, .vp-board input, .vp-board textarea, .vp-role { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .vp * { transition: none !important; } }
</style>
