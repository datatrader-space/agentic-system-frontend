<template>
  <!-- The Video panel (prototype screen 2): what the next request will act on is always visible. The chat
       and these controls edit the same project records on the server. -->
  <div class="vp" data-test="video-panel">
    <header class="vp-header">
      <div><p class="vp-eyebrow">VIDEO STUDIO</p><h2>{{ video.project ? video.project.title : 'Your video workspace' }}</h2>
        <p class="vp-header-sub">{{ video.project ? `${scenes.length} scenes ? ${totalSeconds} seconds planned` : 'Preview, refine and keep every version.' }}</p></div>
      <span v-if="active" class="vp-badge">v{{ active.version || 1 }}</span>
    </header>
    <div class="vp-tabs" role="tablist" aria-label="Video panel">
      <button v-for="t in tabs" :key="t.value" type="button" role="tab" class="vp-tab" :class="{ on: video.panelTab === t.value }"
              :aria-selected="video.panelTab === t.value ? 'true' : 'false'" :id="'video-tab-' + t.value" :aria-controls="'video-pane-' + t.value" :tabindex="video.panelTab === t.value ? 0 : -1" @keydown="navigateTab($event, t.value)" :data-test="'video-tab-' + t.value"
              @click="video.panelTab = t.value">{{ t.label }}<span v-if="t.count" class="vp-count">{{ t.count }}</span></button>
    </div>

    <!-- PREVIEW -->
    <section v-show="video.panelTab === 'preview'" class="vp-body" role="tabpanel" id="video-pane-preview" aria-labelledby="video-tab-preview" tabindex="0">
      <div v-if="active" class="vp-player">
        <span v-if="sceneLabel" class="vp-scene-label">{{ sceneLabel }}</span>
        <div class="vp-compare" :class="{ split: !!compare }">
          <video ref="playerEl" :key="active.url" :src="active.url" controls preload="metadata" playsinline class="vp-video"></video>
          <video v-if="compare" :key="compare.url" :src="compare.url" controls preload="metadata" playsinline class="vp-video"></video>
        </div>
        <p class="vp-meta">v{{ active.version || 1 }}<span v-if="compare"> compared with v{{ compare.version }}</span></p>
      </div>
      <div v-else class="vp-empty">
        <span class="vp-empty-icon" aria-hidden="true">?</span><h3>Your next video starts in chat</h3><p>Describe a clip, add a reference, or plan a story. Your preview and editing tools will appear here.</p>
      </div>
      <div class="vp-actions" v-if="active">
        <button type="button" class="vp-btn" @click="editScene">Edit {{ activeScene ? 'scene' : 'video' }}</button>
        <button v-if="video.can.extend" type="button" class="vp-btn" data-test="video-continue" @click="continueClip">Continue</button>
        <button type="button" class="vp-btn" @click="toggleCompare" :disabled="video.versions.length < 2">
          {{ compare ? 'Stop comparing' : 'Compare' }}</button>
        <button type="button" class="vp-btn" data-test="video-save-frame" @click="saveFrame">Save frame</button>
      </div>
      <div v-if="video.project" class="vp-story">
        <h3 class="vp-h">Your story <span class="vp-sub">{{ scenes.length }} scenes · {{ totalSeconds }} seconds</span></h3>
        <ol class="vp-scenes" aria-label="Scenes">
          <li v-for="(s, i) in scenes" :key="s.scene_id" class="vp-scene" :class="{ on: s.scene_id === video.project.active_scene_id }">
            <button type="button" class="vp-scene-btn" :aria-current="s.scene_id === video.project.active_scene_id ? 'true' : 'false'"
                    @click="selectScene(s)">
              <video v-if="s.selected_take" :src="s.selected_take.url" muted preload="metadata" class="vp-thumb" aria-hidden="true"></video>
              <span v-else class="vp-thumb vp-thumb-empty" aria-hidden="true">No take yet</span>
              <span class="vp-scene-title">{{ String(i + 1).padStart(2, '0') }} {{ s.title || 'Scene' }}</span>
              <span class="vp-scene-meta">{{ seconds(s.planned_ms) }} · {{ s.selected_take ? 'Ready' : 'Not rendered' }}
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
        <div v-if="musicAsset" class="vp-music">♪ Music · {{ musicAsset.attachment_id.slice(0, 8) }}</div>
        <div class="vp-next">
          <span class="vp-next-text"><strong>Next edit</strong> {{ activeScene ? (activeScene.title || 'this scene') + ' only' : 'the active video' }} · model and cost after estimate</span>
          <button type="button" class="vp-btn primary" @click="editScene">Get edit estimate ›</button>
        </div>
      </div>
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
          <button type="button" class="vp-btn primary" data-test="video-export" :disabled="!allRendered" @click="exportCut">Export</button>
          <span class="vp-sub" v-if="!allRendered">Every scene needs a take before export.</span>
        </div>
        <fieldset class="vp-aspects"><legend>Export shapes</legend>
          <label v-for="a in ['16:9', '9:16', '1:1']" :key="a"><input type="checkbox" :value="a" v-model="exportAspects" /> {{ a }}</label>
        </fieldset>
      </template>
    </section>

    <!-- ASSETS -->
    <section v-show="video.panelTab === 'assets'" class="vp-body" role="tabpanel" id="video-pane-assets" aria-labelledby="video-tab-assets" tabindex="0">
      <p v-if="!video.project" class="vp-empty">Assets belong to a project. Start a Story video to keep references here.</p>
      <template v-else>
        <ul class="vp-assets">
          <li v-for="a in assets" :key="a.asset_id" class="vp-asset">
            <video v-if="a.media_type === 'video'" :src="a.url" muted preload="metadata" class="vp-thumb"></video>
            <span v-else-if="a.media_type === 'audio'" class="vp-thumb vp-audio" aria-label="Audio file">Audio</span>
            <img v-else :src="a.url" alt="" class="vp-thumb" />
            <span class="vp-asset-role">{{ a.role }}</span>
            <button v-if="a.pinned" type="button" class="vp-mini wide" @click="video.unpin(a)">Unpin</button>
          </li>
        </ul>
        <p v-if="!assets.length" class="vp-help">Pin a reference from this chat to reuse it across your project.</p>
        <h4 class="vp-h4">From this chat</h4>
        <p v-if="!chatMedia.length" class="vp-help">Upload images, video or audio in chat to add them here.</p>
        <ul class="vp-assets">
          <li v-for="m in chatMedia" :key="m.attachment_id" class="vp-asset">
            <video v-if="m.media_type === 'video'" :src="m.url" muted preload="metadata" class="vp-thumb"></video>
            <span v-else-if="m.media_type === 'audio'" class="vp-thumb vp-audio" aria-label="Audio file">Audio</span>
            <img v-else :src="m.url" alt="" class="vp-thumb" />
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
      <div v-if="!video.versions.length" class="vp-empty"><h3>Every take, kept together</h3><p>Generate or edit a video to see its history here. Restore an earlier version without rendering again.</p></div>
      <ul class="vp-versions">
        <li v-for="v in video.versions" :key="v.attachment_id" class="vp-version" :class="{ on: v.is_active }">
          <video :src="v.url" muted preload="metadata" class="vp-thumb"></video>
          <span class="vp-version-text"><strong>v{{ v.version }}</strong> {{ v.title }}
            <span class="vp-sub">{{ v.source_kind }}<span v-if="v.duration_ms"> · {{ seconds(v.duration_ms) }}</span></span></span>
          <span v-if="v.is_active" class="vp-badge">Active</span>
          <div class="vp-version-ops">
            <button type="button" class="vp-mini wide" @click="previewVersion(v)">View</button>
            <button v-if="!v.is_active" type="button" class="vp-mini wide" @click="video.restore(v, { conversationId: chat.conversationId })">Restore</button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import api from '../../services/api'
import { useVideoStore } from '../../stores/useVideoStore'
import { useChatStore } from '../../stores/useChatStore'

const video = useVideoStore()
const chat = useChatStore()
const playerEl = ref(null)
const exportAspects = ref(['16:9'])
const pinRole = reactive({})
const chatMedia = ref([])

const scenes = computed(() => (video.project && video.project.scenes) || [])
const assets = computed(() => (video.project && video.project.assets) || [])
const musicAsset = computed(() => assets.value.find((a) => a.role === 'music'))
const activeScene = computed(() => scenes.value.find((s) => video.project && s.scene_id === video.project.active_scene_id) || null)
const active = computed(() => video.activeVideo)
const compare = computed(() => video.versions.find((v) => v.attachment_id === video.compareAttachmentId) || null)
const sceneLabel = computed(() => activeScene.value ? `Scene ${scenes.value.indexOf(activeScene.value) + 1} · ${activeScene.value.title || ''}` : '')
const totalSeconds = computed(() => Math.round(scenes.value.reduce((t, s) => t + (s.planned_ms || 0), 0) / 1000))
const allRendered = computed(() => scenes.value.length > 0 && scenes.value.every((s) => s.selected_take))
const tabs = computed(() => [
  { value: 'preview', label: 'Preview' }, { value: 'storyboard', label: 'Storyboard' },
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
async function exportCut() {
  await video.local('export', { aspects: exportAspects.value.length ? exportAspects.value : ['16:9'] }, { chat })
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
.vp { container-type: inline-size; min-width: 0; background: var(--vm-surface-2, #f8fafc); display: flex; flex-direction: column; height: 100%; min-height: 0; }
.vp-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 20px 18px 16px; background: var(--vm-surface, #fff); }
.vp-header > div { min-width: 0; }
.vp-eyebrow { margin: 0 0 6px; font-size: 10px; letter-spacing: .14em; font-weight: 700; color: var(--vm-violet-d, #4f46e5); }
.vp-header h2 { margin: 0; font-size: 18px; line-height: 1.3; letter-spacing: -.02em; overflow-wrap: anywhere; color: var(--vm-ink, #0f172a); }
.vp-header-sub { margin: 6px 0 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-soft, #64748b); }
.vp-tabs { flex-shrink: 0; background: var(--vm-surface, #fff); display: flex; gap: 4px; padding: 8px; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); overflow-x: auto; }
.vp-tab { border: none; background: transparent; border-radius: 9px; padding: 8px 14px; min-height: 44px; flex: 1; justify-content: center; white-space: nowrap; font-weight: 700; font-size: 13px;
  color: var(--vm-ink-soft, #64748b); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
.vp-tab.on { background: var(--vm-violet-soft, #eef2ff); color: var(--vm-violet-d, #4f46e5); }
.vp-tab:focus-visible, .vp-btn:focus-visible, .vp-mini:focus-visible, .vp-scene-btn:focus-visible { outline: 2px solid var(--vm-violet-d, #4f46e5); outline-offset: 2px; }
.vp-count { font-size: 11px; background: var(--vm-surface-2, #f1f5f9); border-radius: 999px; padding: 1px 6px; }
.vp-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 18px; display: grid; gap: 12px; align-content: start; }
.vp-player { min-width: 0; position: relative; padding: 8px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 16px; background: var(--vm-surface, #fff); }
.vp-scene-label { position: absolute; z-index: 1; top: 10px; left: 10px; background: rgba(15, 23, 42, .75); color: #fff; font-size: 12.5px; font-weight: 700; padding: 4px 10px; border-radius: 8px; }
.vp-compare.split { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.vp-video { width: 100%; max-height: 52vh; border-radius: 12px; background: #000; }
.vp-meta { padding: 8px 4px 2px; }
.vp-meta, .vp-sub { font-size: 12px; color: var(--vm-ink-soft, #64748b); margin: 0; font-weight: 500; }
.vp-empty { text-align: center; padding: 36px 20px; border: 1px dashed var(--vm-line, #cbd5e1); border-radius: 16px; background: var(--vm-surface, #fff); line-height: 1.6; color: var(--vm-ink-soft, #64748b); font-size: 13px; }
.vp-empty h3 { font-size: 16px; margin: 8px 0; color: var(--vm-ink, #0f172a); }
.vp-empty p { margin: 0; }
.vp-empty-icon { font-size: 32px; color: var(--vm-violet-d, #4f46e5); }
.vp-help { margin: 0; font-size: 12px; line-height: 1.6; color: var(--vm-ink-soft, #64748b); }
.vp-story { display: grid; gap: 14px; min-width: 0; }
.vp-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.vp-btn { min-height: 44px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--vm-line-2, #e5e7eb); background: var(--vm-surface, #fff); font-weight: 600; font-size: 13px; cursor: pointer; }
.vp-btn.primary { background: var(--vm-violet-d, #4f46e5); color: #fff; border-color: transparent; }
.vp-btn:disabled { opacity: .5; cursor: not-allowed; }
.vp-h { flex-wrap: wrap; margin: 0; font-size: 15px; display: flex; gap: 8px; align-items: baseline; }
.vp-h4 { margin: 4px 0 0; font-size: 13px; }
.vp-scenes { list-style: none; margin: 0; padding: 0; display: flex; gap: 10px; overflow-x: auto; }
.vp-scene { flex: 0 0 200px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 12px; padding: 6px; display: grid; gap: 6px; }
.vp-scene.on { border-color: var(--vm-violet-d, #4f46e5); box-shadow: 0 0 0 2px var(--vm-violet-soft, #eef2ff); }
.vp-scene-btn { border: none; background: transparent; text-align: left; display: grid; gap: 4px; cursor: pointer; padding: 0; }
.vp-thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; background: #0f172a; display: grid; place-items: center; color: #94a3b8; font-size: 11px; }
.vp-scene-title { font-weight: 700; font-size: 13px; }
.vp-scene-meta { font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.vp-badge { font-size: 11px; font-weight: 700; background: var(--vm-violet-soft, #eef2ff); color: var(--vm-violet-d, #4f46e5); border-radius: 999px; padding: 1px 7px; }
.vp-scene-ops { display: flex; gap: 4px; }
.vp-mini { min-width: 44px; min-height: 44px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; background: var(--vm-surface, #fff); cursor: pointer; font-size: 13px; }
.vp-mini.wide { padding: 0 10px; }
.vp-mini:disabled { opacity: .4; }
.vp-music { border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 10px; padding: 10px; font-size: 13px; }
.vp-next { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 12px; padding: 10px; }
.vp-next-text { font-size: 12.5px; color: var(--vm-ink-soft, #64748b); }
.vp-field { display: grid; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--vm-ink-soft, #64748b); }
.vp-field input, .vp-field textarea, .vp-board input, .vp-board textarea, .vp-role { width: 100%; min-width: 0; min-height: 44px; box-sizing: border-box; background: var(--vm-surface, #fff); border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; padding: 8px; font: inherit; color: var(--vm-ink, #0f172a); font-weight: 400; }
.vp-board { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.vp-board-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) 80px 44px; gap: 12px; align-items: end; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 14px; padding: 14px; background: var(--vm-surface, #fff); }
.vp-board-title { grid-column: 2 / -1; }
.vp-board-intent { grid-column: 2 / -1; }
.vp-board-len { grid-column: 2 / 4; max-width: 120px; }
.vp-board label { display: grid; gap: 6px; min-width: 0; }
.vp-input-label { font-size: 11px; color: var(--vm-ink-soft, #64748b); font-weight: 600; }
.vp-board-n { grid-column: 1; grid-row: 1; align-self: center; color: var(--vm-violet-d, #4f46e5); }
.vp-board-n { font-weight: 700; padding-top: 8px; }
.vp-aspects { border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 10px; display: flex; flex-wrap: wrap; gap: 14px; padding: 8px 12px; font-size: 13px; }
.vp-aspects label { min-height: 44px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.vp-assets, .vp-versions { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.vp-asset, .vp-version { display: grid; grid-template-columns: 80px minmax(0, 1fr) auto; gap: 12px; align-items: center; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 12px; padding: 10px; background: var(--vm-surface, #fff); }
.vp-version.on { background: var(--vm-violet-soft, #eef2ff); border-radius: 10px; }
.vp-version-text { min-width: 0; overflow-wrap: anywhere; display: grid; font-size: 13px; }
.vp-version-ops { grid-column: 2 / -1; justify-content: flex-end; display: flex; gap: 4px; }
.vp-asset-role { font-size: 12.5px; text-transform: capitalize; }
.vp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.vp input:focus-visible, .vp textarea:focus-visible, .vp select:focus-visible { outline: 2px solid var(--vm-violet-d, #4f46e5); outline-offset: 2px; }
.vp-btn:hover:not(:disabled), .vp-mini:hover:not(:disabled) { border-color: var(--vm-violet-d, #4f46e5); }
@container (max-width: 420px) {
  .vp-header { padding: 16px 12px; }
  .vp-body { padding: 12px; }
  .vp-tab { padding: 8px; font-size: 12px; }
  .vp-compare.split { grid-template-columns: 1fr; }
  .vp-board-row { padding: 12px; gap: 10px; grid-template-columns: 20px minmax(0, 1fr) 60px 44px; }
  .vp-next .vp-btn { width: 100%; }
  .vp-asset, .vp-version { grid-template-columns: 64px minmax(0, 1fr) auto; gap: 8px; }
  .vp-field input, .vp-field textarea, .vp-board input, .vp-board textarea, .vp-role { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .vp * { transition: none !important; } }
</style>
