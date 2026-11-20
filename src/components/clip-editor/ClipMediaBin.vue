<template>
  <!-- The media bin (VIDEO_EDITOR_PRO_PLAN.md section 6): tabs for Media (upload video and pictures, resumable, or
       bring them from the Library), Text (templates), Audio (music made in the Studio, and the person's sound),
       Effects and Transitions (the registry's catalogues, each with a small preview). Everything can be dragged to
       the timeline, and everything has an Add button, so nothing needs a drag (WCAG 2.5.7). -->
  <section class="cb pn" aria-label="Your files and catalogues">
    <div class="cb-tabs" role="tablist" aria-label="Bin" @keydown="tabKey">
      <button v-for="t in TABS" :id="`cb-tab-${t.id}`" :key="t.id" type="button" role="tab" class="cb-tab" :aria-selected="tab === t.id ? 'true' : 'false'"
              :aria-controls="`cb-panel-${t.id}`" :tabindex="tab === t.id ? 0 : -1" :data-test="`bin-tab-${t.id}`" @click="tab = t.id">{{ t.label }}</button>
    </div>

    <div :id="`cb-panel-${tab}`" role="tabpanel" :aria-labelledby="`cb-tab-${tab}`" class="cb-panel">
      <template v-if="tab === 'media' || tab === 'audio'">
        <div class="cb-actions">
          <IconButton :icon="Upload" label="Upload files" primary data-test="bin-upload" @click="fileInput.click()" />
          <IconButton :icon="Library" label="Bring files from your Library" data-test="bin-library" @click="openLibrary($event)" />
          <label class="cb-mode"><span class="st-sr">Add files as</span>
            <select v-model="mode" class="st-input" data-test="bin-mode" title="How Add puts a file on the timeline">
              <option v-for="m in MODES" :key="m.id" :value="m.id">{{ m.label }}</option>
            </select>
          </label>
          <input ref="fileInput" class="st-sr" type="file" :accept="tab === 'audio' ? 'audio/*' : 'video/*,image/*,audio/*'" multiple aria-label="Upload files" @change="choose($event.target.files); $event.target.value = ''" />
        </div>
        <ul v-if="uploads.length" class="cb-uploads" aria-label="Uploads">
          <li v-for="u in uploads" :key="u.key">
            <span class="cb-name">{{ u.name }}</span>
            <progress v-if="u.state === 'sending'" max="1" :value="u.progress" :aria-label="`Uploading ${u.name}`" />
            <span class="cb-state" role="status">{{ uploadLabel(u) }}</span>
            <button v-if="u.state === 'sending'" type="button" class="st-button" @click="u.abort.abort()">Stop</button>
            <button v-else-if="u.state === 'failed'" type="button" class="st-button" @click="retry(u)">Try again</button>
          </li>
        </ul>
      </template>

      <template v-if="tab === 'media'">
        <p v-if="!pictures.length && !uploads.length" class="st-empty"><strong>No video or pictures in this project yet</strong>Upload clips and pictures, or bring them from your Library.</p>
        <ul class="cb-files" aria-label="Video and pictures in this project">
          <li v-for="file in pictures" :key="file.attachment_id" class="cb-file" :draggable="file.state === 'ready'" @dragstart="drag($event, { kind: 'media', id: file.attachment_id })">
            <img v-if="file.thumbnail_url" :src="file.thumbnail_url" alt="" loading="lazy" />
            <span v-else class="cb-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4" /></svg></span>
            <span class="cb-meta"><span class="cb-name">{{ file.name }}</span><span class="cb-sub">{{ fileLabel(file) }}</span></span>
            <IconButton :icon="Plus" :label="`Add ${file.name}: ${modeLabel}`" :disabled="file.state !== 'ready'" @click="$emit('add', file, mode)" />
          </li>
        </ul>
      </template>

      <template v-else-if="tab === 'audio'">
        <template v-for="g in soundGroups" :key="g.id">
          <h4 class="cb-h">{{ g.label }}</h4>
          <p v-if="!g.files.length" class="pn-note">{{ g.empty }}</p>
          <ul class="cb-files" :aria-label="g.label">
            <li v-for="file in g.files" :key="file.attachment_id" class="cb-file" :draggable="file.state === 'ready'" @dragstart="drag($event, { kind: 'media', id: file.attachment_id })">
              <span class="cb-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4" /></svg></span>
              <span class="cb-meta"><span class="cb-name">{{ file.name }}</span><span class="cb-sub">{{ fileLabel(file) }}</span></span>
              <IconButton :icon="Plus" :label="`Add ${file.name}: ${modeLabel}`" :disabled="file.state !== 'ready'" @click="$emit('add', file, mode)" />
            </li>
          </ul>
        </template>
        <p class="pn-note"><router-link :to="studioPath('music')" class="cb-link">Make music in the Studio</router-link>; it lands in this project's sound.</p>
      </template>

      <template v-else-if="tab === 'text'">
        <ul class="cb-cards" aria-label="Text templates">
          <li v-for="t in templates" :key="t.id" class="cb-card" draggable="true" :data-test="`bin-text-${t.id}`" @dragstart="drag($event, { kind: 'text', id: t.id })">
            <span class="cb-sample" :style="sampleStyle(t)" aria-hidden="true">{{ t.text }}</span>
            <span class="cb-name">{{ t.name }}{{ t.builtIn ? '' : ' (yours)' }}</span>
            <IconButton :icon="Plus" :label="`Add ${t.name} at the playhead`" @click="$emit('add-text', t)" />
          </li>
        </ul>
        <p class="pn-note">Save your own from the Text settings of any text.</p>
      </template>

      <template v-else-if="tab === 'effects'">
        <p v-if="!canApply" class="pn-note">Select a video clip or picture to add an effect to it.</p>
        <ul class="cb-cards" aria-label="Effects">
          <li v-for="e in effects" :key="e.id" class="cb-card" draggable="true" :data-test="`bin-effect-${e.id}`" @dragstart="drag($event, { kind: 'effect', id: e.id })">
            <span class="cb-preview" :class="`fx-${e.id}`" aria-hidden="true"><span /></span>
            <span class="cb-name">{{ e.label }}{{ e.paid ? ' (paid, price shown first)' : '' }}</span>
            <IconButton :icon="Plus" :label="`Add ${e.label} to the selected clip`" :disabled="!canApply" @click="$emit('add-effect', e.id)" />
          </li>
        </ul>
      </template>

      <template v-else>
        <p v-if="!canJoin" class="pn-note">Select a video clip that meets the next one to put a transition between them.</p>
        <ul class="cb-cards" aria-label="Transitions">
          <li v-for="t in transitions" :key="t.id" class="cb-card" draggable="true" :data-test="`bin-transition-${t.id}`" @dragstart="drag($event, { kind: 'transition', id: t.id })">
            <span class="cb-preview cb-tr" :class="`tr-${t.id}`" aria-hidden="true"><span /></span>
            <span class="cb-name">{{ t.label }}</span>
            <IconButton :icon="Plus" :label="`Put ${t.label} after the selected clip`" :disabled="!canJoin" @click="$emit('add-transition', t.id)" />
          </li>
        </ul>
      </template>
    </div>
    <VideoLibrary v-if="picker" mode="picker" initial-tab="files" :allowed-kinds="tab === 'audio' ? ['audio'] : ['video', 'image', 'audio']" @pick="linkFromLibrary" @close="closeLibrary" />
    <p v-if="error" class="st-error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup>
import { Library, Plus, Upload } from 'lucide-vue-next'
import IconButton from './panels/IconButton.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import api from '../../services/api'
import { studioPath } from '../../services/studioPaths'
import { lazyComponent } from '../../utils/lazyComponent'
import { uploadFile, uploadStatus } from './resumableUpload'
import * as br from './panels/bridge'
import { BUILT_IN_TEMPLATES, useTextTemplates } from './panels/textTemplates'
import { DRAG_TYPE } from './panels/panelModel'
import './panels/panels.css'
const VideoLibrary = lazyComponent(() => import('../video/VideoLibrary.vue'), { showLoading: false })

const props = defineProps({ projectId: { type: String, required: true }, project: { type: Object, default: null }, media: { type: Object, default: () => ({}) },
  canApply: Boolean, canJoin: Boolean })
const emit = defineEmits(['add', 'add-text', 'add-effect', 'add-transition', 'files-changed', 'media'])
// How Add puts a file on the timeline (VIDEO_EDITOR_PRO_PLAN.md A4); the editor's insertMedia(file, mode) does it.
const MODES = [{ id: 'insert', label: 'Insert at the playhead' }, { id: 'append', label: 'Append at the end' }, { id: 'overwrite', label: 'Overwrite at the playhead' }, { id: 'connect', label: 'Connect at the playhead' }]
const mode = ref('insert')
const modeLabel = computed(() => MODES.find(m => m.id === mode.value).label.toLowerCase())
const TABS = [{ id: 'media', label: 'Media' }, { id: 'text', label: 'Text' }, { id: 'audio', label: 'Audio' }, { id: 'effects', label: 'Effects' }, { id: 'transitions', label: 'Transitions' }]
const tab = ref('media')
const fileInput = ref(null), picker = ref(false), error = ref('')
const uploads = reactive([])
const tpl = useTextTemplates()
let returnTo = null, gone = false
onMounted(() => tpl.load())
onBeforeUnmount(() => { gone = true; uploads.forEach(u => u.abort?.abort()) })

// The project's own files (uploads into it, Library files linked to it, its Studio results), one row per file.
const files = computed(() => {
  const seen = new Set(), out = []
  for (const a of props.project?.assets || []) {
    if (seen.has(a.attachment_id) || !['video', 'image', 'audio'].includes(a.media_type)) continue
    seen.add(a.attachment_id)
    const m = props.media[a.attachment_id] || {}
    out.push({ attachment_id: a.attachment_id, media_type: m.media_type || a.media_type, duration_ms: m.duration_ms, state: m.state || 'pending', role: a.role, source: a.source,
      thumbnail_url: m.thumbnail_url, name: m.name || `${a.media_type} ${String(a.attachment_id).slice(0, 6)}`, error: m.error })
  }
  return out
})
const pictures = computed(() => files.value.filter(f => f.media_type !== 'audio'))
// Music made in the Studio (its role, or its source when the server names it), apart from the person's own sound.
const isStudioMusic = f => f.role === 'music' || f.source === 'studio'
const soundGroups = computed(() => {
  const sound = files.value.filter(f => f.media_type === 'audio')
  return [
    { id: 'studio', label: 'Music made in the Studio', files: sound.filter(isStudioMusic), empty: 'No music made in the Studio for this project yet.' },
    { id: 'mine', label: 'Your sound', files: sound.filter(f => !isStudioMusic(f)), empty: 'Upload sound, or bring it from your Library.' },
  ]
})
const templates = computed(() => [...BUILT_IN_TEMPLATES, ...tpl.state.saved])
const reg = br.registry()
const effects = computed(() => Object.entries(reg.effects).map(([id, e]) => ({ id, label: e.label, paid: br.effectPaid(reg, id) })))
const transitions = reg.transitions
const sampleStyle = t => ({ fontWeight: t.style?.bold ? 700 : 500, fontStyle: t.style?.italic ? 'italic' : 'normal', color: t.style?.color || '#FFFFFF', background: t.style?.box ? t.style.box.slice(0, 7) : 'transparent' })

const length = ms => ms ? `${Math.floor(ms / 60000)}:${String(Math.round(ms / 1000) % 60).padStart(2, '0')}` : ''
function fileLabel(f) {
  if (f.state === 'pending') return 'Preparing…'
  if (f.state === 'failed') return f.error || 'This file cannot be used.'
  return [{ video: 'Video', image: 'Picture', audio: 'Sound' }[f.media_type], length(f.duration_ms)].filter(Boolean).join(', ')
}
function uploadLabel(u) {
  return { sending: `${Math.round(u.progress * 100)}%`, checking: 'Checking and preparing…', failed: u.error, ready: 'Ready' }[u.state] || ''
}
function drag(e, payload) {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload))
}
function tabKey(e) {
  const n = TABS.findIndex(t => t.id === tab.value)
  const to = { ArrowRight: n + 1, ArrowLeft: n - 1, Home: 0, End: TABS.length - 1 }[e.key]
  if (to == null) return
  e.preventDefault()
  tab.value = TABS[(to + TABS.length) % TABS.length].id
  requestAnimationFrame(() => document.getElementById(`cb-tab-${tab.value}`)?.focus())
}

function choose(list) { for (const file of list || []) start({ key: `${file.name}:${file.size}:${Date.now()}`, file, name: file.name }) }
function retry(u) { uploads.splice(uploads.indexOf(u), 1); start({ ...u, key: `${u.key}:again` }) }
async function start(entry) {
  const u = reactive({ ...entry, state: 'sending', progress: 0, error: '', abort: new AbortController() })
  uploads.push(u)
  try {
    const id = await uploadFile(u.file, { projectId: props.projectId, signal: u.abort.signal, onProgress: p => { u.progress = p } })
    u.state = 'checking'
    await follow(u, id)
  } catch (e) {
    if (gone) return
    u.state = 'failed'
    u.error = e?.name === 'AbortError' || e?.code === 'ERR_CANCELED' ? 'Stopped.' : (e?.response?.data?.error?.message || 'The upload could not finish.')
  }
}
// After the last byte the server joins the parts, checks the file from its bytes and prepares it.
async function follow(u, id) {
  for (let i = 0; i < 400 && !gone; i++) {
    const s = await uploadStatus(id)
    if (s.state === 'ready') {
      u.state = 'ready'
      emit('files-changed', s.attachment_id)
      setTimeout(() => { const n = uploads.indexOf(u); if (n >= 0) uploads.splice(n, 1) }, 2500)
      return
    }
    if (['failed', 'expired', 'cancelled'].includes(s.state)) { u.state = 'failed'; u.error = s.error || 'The upload did not finish.'; return }
    await new Promise(r => setTimeout(r, 1500))
  }
}
function openLibrary(e) { returnTo = e.currentTarget; picker.value = true; error.value = '' }
async function closeLibrary() { picker.value = false; await nextTick(); returnTo?.focus() }
// A Library file is linked to the project first (owner-checked on the server), which is what lets its export use it.
async function linkFromLibrary(item) {
  try {
    await api.post(`/video/projects/${props.projectId}/assets/`, { source: 'library', attachment_id: item.attachment_id, role: 'edit_source', pinned: false })
    emit('files-changed', item.attachment_id)
    closeLibrary()
  } catch (e) { error.value = e?.response?.data?.error?.message || 'That file could not be added.' }
}
</script>
<style scoped>
.cb{display:grid;gap:10px;align-content:start;min-width:0}
.cb-tabs{display:flex;gap:2px;overflow-x:auto;border-bottom:1px solid var(--vm-line-2);scrollbar-width:thin}
.cb-tab{flex:none;min-height:32px;padding:6px 8px;border:0;border-bottom:2px solid transparent;background:none;color:var(--vm-ink-soft);font:500 12px/1.3 var(--vm-font-sans);cursor:pointer}
.cb-tab:hover{color:var(--vm-ink)}
.cb-tab[aria-selected="true"]{border-bottom-color:var(--vm-primary);color:var(--vm-ink)}
.cb-panel{display:grid;gap:10px;min-width:0}
.cb-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.cb-mode{flex:1 1 140px;min-width:0}.cb-mode select{width:100%;min-height:30px;font-size:12px}
.cb-card :deep(.ib){justify-self:start}
.cb-h{margin:4px 0 0;font-size:12px;font-weight:600;color:var(--vm-ink-soft)}
.cb-uploads,.cb-files,.cb-cards{display:grid;gap:6px;margin:0;padding:0;list-style:none}
.cb-cards{grid-template-columns:repeat(auto-fill,minmax(104px,1fr))}
.cb-uploads li{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center;padding:8px;border:1px solid var(--vm-line);border-radius:6px;font-size:12px}
.cb-uploads progress{grid-column:1/-1;width:100%;height:6px;accent-color:var(--vm-primary)}
.cb-state{color:var(--vm-ink-soft)}
.cb-file{display:grid;grid-template-columns:52px 1fr auto;gap:8px;align-items:center;padding:6px;border:1px solid var(--vm-line-2);border-radius:6px}
.cb-file img,.cb-glyph{width:52px;height:34px;border-radius:4px;object-fit:cover;background:var(--vm-surface-2)}
.cb-glyph{display:grid;place-items:center}.cb-glyph svg{width:18px;height:18px;fill:none;stroke:var(--vs-ok-ink);stroke-width:1.8;stroke-linecap:round}
.cb-card{display:grid;gap:6px;align-content:start;padding:6px;border:1px solid var(--vm-line-2);border-radius:6px;min-width:0}
.cb-meta{display:grid;min-width:0}
.cb-name{font-size:12px;color:var(--vm-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-card .cb-name{white-space:normal}
.cb-sub{font-size:11px;color:var(--vm-ink-soft)}
.cb-link{color:var(--vm-link)}
/* Previews: a small test picture (sky, ground and a figure) drawn with CSS, changed the way the effect changes it. */
.cb-sample{display:grid;place-items:center;height:48px;padding:0 6px;border-radius:4px;background-clip:padding-box;font-size:13px;line-height:1.1;text-align:center;overflow:hidden;outline:1px solid var(--vm-line-2);background-color:var(--vm-bg)}
.cb-preview{position:relative;display:block;height:48px;border-radius:4px;overflow:hidden;background:linear-gradient(180deg,#6E9BD8 0 55%,#4E7A3C 55% 100%)}
.cb-preview > span{position:absolute;left:38%;top:22%;width:24%;height:60%;border-radius:40% 40% 6px 6px;background:#E8B48E}
.fx-adjust{filter:contrast(1.25) saturate(1.4)}.fx-curves{filter:contrast(1.4) brightness(.95)}.fx-hsl{filter:hue-rotate(40deg)}.fx-lut{filter:sepia(.55) contrast(1.1)}
.fx-blur{filter:blur(2px)}.fx-sharpen{filter:contrast(1.5)}.fx-vignette::after{content:'';position:absolute;inset:0;background:radial-gradient(circle,transparent 40%,rgba(0,0,0,.75) 100%)}
.fx-mask{clip-path:ellipse(40% 45% at 50% 50%)}.fx-chroma_key{background:linear-gradient(180deg,#1FCB4A 0 100%)}.fx-bg_removal{background:repeating-conic-gradient(#3C4A60 0 25%,#20252E 0 50%) 0 0/12px 12px}
.cb-tr{background:linear-gradient(90deg,#6E9BD8 0 50%,#C26A4A 50% 100%)}.cb-tr > span{display:none}
.tr-crossfade,.tr-dissolve{background:linear-gradient(90deg,#6E9BD8,#C26A4A)}.tr-fade_black{background:linear-gradient(90deg,#6E9BD8,#000 50%,#C26A4A)}.tr-fade_white{background:linear-gradient(90deg,#6E9BD8,#FFF 50%,#C26A4A)}
.tr-wipe_up,.tr-wipe_down,.tr-slide_up,.tr-slide_down{background:linear-gradient(180deg,#6E9BD8 0 50%,#C26A4A 50% 100%)}
.tr-circle_open,.tr-circle_close{background:radial-gradient(circle,#C26A4A 0 35%,#6E9BD8 36%)}.tr-radial{background:conic-gradient(#C26A4A 0 35%,#6E9BD8 0)}
.tr-pixelize{background:repeating-linear-gradient(90deg,#6E9BD8 0 6px,#C26A4A 6px 12px)}.tr-zoom_in{background:radial-gradient(circle,#C26A4A 0 20%,#6E9BD8 60%)}.tr-blur{background:linear-gradient(90deg,#6E9BD8,#C26A4A);filter:blur(1.5px)}
.tr-smooth_left,.tr-smooth_right{background:linear-gradient(90deg,#6E9BD8 0 35%,#C26A4A 65% 100%)}
@media (max-width:767px){.cb-uploads .st-button,.cb-tab,.cb-mode select{min-height:44px}}
</style>
