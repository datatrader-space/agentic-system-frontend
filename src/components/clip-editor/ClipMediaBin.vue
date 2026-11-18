<template>
  <!-- The media bin (plan section 2.1): upload video, pictures and sound (resumable, with progress), or bring files
       from the Library, Studio results and the project. Each file shows its picture, its length, and whether it is
       still being prepared. -->
  <section class="cb" aria-label="Your files">
    <div class="cb-actions">
      <button type="button" class="st-button primary" @click="fileInput.click()">Upload</button>
      <button type="button" class="st-button" @click="openLibrary($event)">From Library</button>
      <input ref="fileInput" class="st-sr" type="file" accept="video/*,image/*,audio/*" multiple aria-label="Upload files" @change="choose($event.target.files); $event.target.value = ''" />
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
    <p v-if="!files.length && !uploads.length" class="st-empty"><strong>No files in this project yet</strong>Upload clips, pictures and sound, or bring them from your Library.</p>
    <ul class="cb-files" aria-label="Files in this project">
      <li v-for="file in files" :key="file.attachment_id" class="cb-file">
        <img v-if="file.thumbnail_url" :src="file.thumbnail_url" alt="" loading="lazy" />
        <span v-else class="cb-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4" /></svg></span>
        <span class="cb-meta"><span class="cb-name">{{ file.name }}</span><span class="cb-sub">{{ fileLabel(file) }}</span></span>
        <button type="button" class="st-button" :disabled="file.state !== 'ready'" :aria-label="`Add ${file.name} at the playhead`" @click="$emit('add', file)">Add</button>
      </li>
    </ul>
    <VideoLibrary v-if="picker" mode="picker" initial-tab="files" :allowed-kinds="['video', 'image', 'audio']" @pick="linkFromLibrary" @close="closeLibrary" />
    <p v-if="error" class="st-error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import api from '../../services/api'
import { lazyComponent } from '../../utils/lazyComponent'
import { uploadFile, uploadStatus } from './resumableUpload'
const VideoLibrary = lazyComponent(() => import('../video/VideoLibrary.vue'), { showLoading: false })

const props = defineProps({ projectId: { type: String, required: true }, project: { type: Object, default: null }, media: { type: Object, default: () => ({}) } })
const emit = defineEmits(['add', 'files-changed', 'media'])
const fileInput = ref(null), picker = ref(false), error = ref('')
const uploads = reactive([])
let returnTo = null, gone = false
onBeforeUnmount(() => { gone = true; uploads.forEach(u => u.abort?.abort()) })

// The project's own files (uploads into it, Library files linked to it, its Studio results), one row per file.
const files = computed(() => {
  const seen = new Set(), out = []
  for (const a of props.project?.assets || []) {
    if (seen.has(a.attachment_id) || !['video', 'image', 'audio'].includes(a.media_type)) continue
    seen.add(a.attachment_id)
    const m = props.media[a.attachment_id] || {}
    out.push({ attachment_id: a.attachment_id, media_type: m.media_type || a.media_type, duration_ms: m.duration_ms, state: m.state || 'pending',
      thumbnail_url: m.thumbnail_url, name: m.name || `${a.media_type} ${String(a.attachment_id).slice(0, 6)}`, error: m.error })
  }
  return out
})
const length = ms => ms ? `${Math.floor(ms / 60000)}:${String(Math.round(ms / 1000) % 60).padStart(2, '0')}` : ''
function fileLabel(f) {
  if (f.state === 'pending') return 'Preparing…'
  if (f.state === 'failed') return f.error || 'This file cannot be used.'
  return [{ video: 'Video', image: 'Picture', audio: 'Sound' }[f.media_type], length(f.duration_ms)].filter(Boolean).join(', ')
}
function uploadLabel(u) {
  return { sending: `${Math.round(u.progress * 100)}%`, checking: 'Checking and preparing…', failed: u.error, ready: 'Ready' }[u.state] || ''
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
.cb-actions{display:flex;gap:6px;flex-wrap:wrap}
.cb-uploads,.cb-files{display:grid;gap:6px;margin:0;padding:0;list-style:none}
.cb-uploads li{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center;padding:8px;border:1px solid var(--vm-line);border-radius:6px;font-size:12px}
.cb-uploads progress{grid-column:1/-1;width:100%;height:6px;accent-color:var(--vm-primary)}
.cb-state{color:var(--vm-ink-soft)}
.cb-file{display:grid;grid-template-columns:52px 1fr auto;gap:8px;align-items:center;padding:6px;border:1px solid var(--vm-line-2);border-radius:6px}
.cb-file img,.cb-glyph{width:52px;height:34px;border-radius:4px;object-fit:cover;background:var(--vm-surface-2)}
.cb-glyph{display:grid;place-items:center}.cb-glyph svg{width:18px;height:18px;fill:none;stroke:var(--vs-ok-ink);stroke-width:1.8;stroke-linecap:round}
.cb-meta{display:grid;min-width:0}
.cb-name{font-size:12px;color:var(--vm-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cb-sub{font-size:11px;color:var(--vm-ink-soft)}
.cb-file .st-button{min-height:32px;padding:4px 10px;font-size:12px}
@media (max-width:767px){.cb-file .st-button,.cb-actions .st-button,.cb-uploads .st-button{min-height:44px}}
</style>
