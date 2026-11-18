<template>
  <!-- The clip editor (agentic-docs/VIDEO_CLIP_EDITOR_PLAN.md, ADM-1199), under Edit & enhance. Desktop: files, monitor
       and settings side by side over the timeline. Tablet: files and settings open from the toolbar. Phone: the
       monitor, a short timeline that scrolls sideways in its own box, and a toolbar; every gesture has a button. -->
  <div class="ve" :class="{ 'is-phone': phone }" @keydown="shortcut">
    <header class="ve-head">
      <h1 class="ve-title">{{ editor.project.value?.title || 'Clip editor' }}</h1>
      <label class="ve-project"><span class="st-sr">Project</span>
        <select class="st-input" :value="projectId" @change="openProject($event.target.value)">
          <option value="">Choose a project</option>
          <option v-for="p in projects" :key="p.project_id" :value="p.project_id">{{ p.title || 'Untitled video' }}</option>
        </select>
      </label>
      <span class="ve-save" role="status">{{ saveLabel }}</span>
    </header>

    <div v-if="editor.state.conflict" class="ve-conflict" role="alert">
      <p><strong>This project was changed in another tab or by the agent.</strong> Saving has stopped, so nothing is overwritten. Reload to work on the newest timeline (revision {{ editor.state.conflict.revision ?? 'newer' }}); the edits made here since your last save are not kept.</p>
      <button type="button" class="st-button primary" @click="editor.reloadLatest()">Reload the newest timeline</button>
    </div>
    <p v-if="editor.state.saveError" class="st-error" role="alert">{{ editor.state.saveError }}</p>

    <p v-if="notReady" class="st-error" role="status" data-test="studio-not-ready">{{ notReady }}</p>
    <section v-if="!projectId" class="ve-start">
      <h2>Edit your own clips, pictures and sound</h2>
      <p class="st-muted">Choose a project above, or start a new one. Uploads, Library files and Studio results all go on the same timeline, and Export is free.</p>
      <form class="ve-new" @submit.prevent="createProject">
        <label class="st-field">New project name<input v-model="newTitle" class="st-input" maxlength="200" required /></label>
        <label class="st-field">Shape<select v-model="newAspect" class="st-input"><option v-for="a in tl.ASPECTS" :key="a" :value="a">{{ a }}</option></select></label>
        <button type="submit" class="st-button primary" :disabled="!newTitle.trim() || creating">Start editing</button>
      </form>
      <p v-if="startError" class="st-error" role="alert">{{ startError }}</p>
    </section>

    <p v-else-if="editor.state.loading" class="st-status" role="status">Opening the project…</p>
    <div v-else-if="editor.state.error" class="st-error" role="alert">{{ editor.state.error }} <button type="button" class="st-button" @click="openProject(projectId)">Try again</button></div>

    <template v-else-if="editor.doc.value">
      <div class="ve-top">
        <BottomSheet label="Files" :summary="`${(editor.project.value?.assets || []).length}`" test-id="ve-bin" :breakpoint="1024" class="ve-bin">
          <ClipMediaBin :project-id="projectId" :project="editor.project.value" :media="editor.media" @add="addFile" @files-changed="editor.refreshProject" />
        </BottomSheet>
        <ClipMonitor class="ve-monitor" :doc="editor.doc.value" :playhead="editor.playhead.value" :playing="playing" :media="editor.media"
                     :preview-busy="!!previewJob && !finished(previewJob)" @tick="editor.playhead.value = $event" @toggle="playing = !playing"
                     @ended="playing = false" @seek="seek" @preview-exact="previewExact" />
        <BottomSheet label="Settings" :summary="selectedLabel" test-id="ve-inspector" :breakpoint="1024" class="ve-inspector">
          <ClipInspector :doc="editor.doc.value" :selected-id="editor.selection.value[0] || ''" :media="editor.media" @ops="apply($event.ops, $event.label)" @select="id => editor.select(id)" />
          <ClipCaptions v-if="captionSource" :project-id="projectId" :clip="captionSource" :rate="editor.rate.value" @captions="addCaptions" />
        </BottomSheet>
      </div>
      <div v-if="previewJob" class="ve-preview" role="status">
        <VideoJobCard :job="video.jobs[previewJob] || { job_id: previewJob, state: 'queued' }" in-studio />
        <button type="button" class="st-button" @click="previewJob = ''">Close the preview</button>
      </div>

      <div class="ve-tools" role="toolbar" aria-label="Edit">
        <button type="button" class="st-button" :disabled="!editor.selection.value.length" @click="split">Split</button>
        <button type="button" class="st-button" :disabled="!editor.selection.value.length" @click="remove(false)">Delete</button>
        <button type="button" class="st-button" :disabled="!editor.selection.value.length" @click="remove(true)">Delete and close the gap</button>
        <button type="button" class="st-button" :disabled="editor.selection.value.length !== 1" @click="duplicate">Duplicate</button>
        <button type="button" class="st-button" :disabled="editor.selection.value.length !== 1" aria-label="Move earlier by one second" @click="nudge(-1000)">Earlier</button>
        <button type="button" class="st-button" :disabled="editor.selection.value.length !== 1" aria-label="Move later by one second" @click="nudge(1000)">Later</button>
        <button type="button" class="st-button" :disabled="!editor.canUndo.value" @click="editor.undo()">Undo</button>
        <button type="button" class="st-button" :disabled="!editor.canRedo.value" @click="editor.redo()">Redo</button>
        <span class="ve-sep" aria-hidden="true" />
        <button type="button" class="st-button" @click="addText(false)">Add text</button>
        <button type="button" class="st-button" @click="addText(true)">Add caption</button>
        <button type="button" class="st-button" :disabled="!canAddVideoTrack" @click="addTrack('video')">Add video track</button>
        <button type="button" class="st-button" @click="addTrack('audio')">Add sound track</button>
        <span class="ve-sep" aria-hidden="true" />
        <button type="button" class="st-button" :aria-pressed="editor.snapping.value ? 'true' : 'false'" @click="editor.snapping.value = !editor.snapping.value">Snap</button>
        <button type="button" class="st-button" aria-label="Zoom out" @click="zoomBy(1 / 1.5)">−</button>
        <button type="button" class="st-button" aria-label="Zoom in" @click="zoomBy(1.5)">+</button>
        <label class="ve-keys"><input type="checkbox" :checked="editor.shortcuts.value" @change="editor.setShortcuts($event.target.checked)" /> Keyboard shortcuts</label>
        <button type="button" class="st-button primary ve-export" :disabled="!editor.total.value" @click="exportOpen = true">Export</button>
      </div>

      <ClipTimeline ref="timelineEl" :doc="editor.doc.value" :selection="editor.selection.value" :playhead="editor.playhead.value" :zoom="editor.zoom.value"
                    :snapping="editor.snapping.value" :media="editor.media" :names="names"
                    @select="e => editor.select(e.id, { add: e.add })" @seek="seek" @move="move" @trim="trim" @track="e => apply(tl.setTrackOps(editor.doc.value, e.id, e.changes), 'Track changed')"
                    @touchstart.passive="pinchStart" @touchmove.passive="pinchMove" />
      <p v-if="editor.shortcuts.value" class="ve-hint st-muted">With the timeline focused: Space plays, S splits at the playhead, Delete deletes (Shift+Delete closes the gap), D duplicates, Alt+arrows move a clip, Ctrl+Z undoes and Ctrl+Shift+Z redoes.</p>
    </template>

    <ClipExportDialog v-if="exportOpen" :doc="editor.doc.value" :busy="exporting" :job="exportJob ? (video.jobs[exportJob] || null) : null" :error="exportError"
                      :note="downloadNote" @close="exportOpen = false" @export="runExport" @lottie="downloadLottie" @webpage="downloadWebPage" />
    <div class="st-sr" aria-live="polite">{{ editor.announcement.value }}</div>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
import { getStudioFeature, loadStudioFeatures } from '../services/studioFeatures'
import { useVideoStore } from '../stores/useVideoStore'
import { useClipEditor } from '../components/clip-editor/useClipEditor'
import * as tl from '../components/clip-editor/timelineModel'
import ClipTimeline from '../components/clip-editor/ClipTimeline.vue'
import ClipMonitor from '../components/clip-editor/ClipMonitor.vue'
import ClipInspector from '../components/clip-editor/ClipInspector.vue'
import ClipMediaBin from '../components/clip-editor/ClipMediaBin.vue'
import ClipCaptions from '../components/clip-editor/ClipCaptions.vue'
import ClipExportDialog from '../components/clip-editor/ClipExportDialog.vue'
import BottomSheet from '../components/video/BottomSheet.vue'
import VideoJobCard from '../components/video/VideoJobCard.vue'

defineProps({ featureId: { type: String, default: 'editor' } })
const route = useRoute(), router = useRouter(), video = useVideoStore()
const editor = useClipEditor()
const projects = ref([]), projectId = ref(String(route.query.project_id || route.query.project || ''))
const newTitle = ref(''), newAspect = ref('9:16'), creating = ref(false), startError = ref('')
const playing = ref(false), timelineEl = ref(null)
const exportOpen = ref(false), exporting = ref(false), exportJob = ref(''), exportError = ref(''), previewJob = ref('')
const phoneQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 767px)') : null
const phone = ref(!!phoneQuery?.matches)
const onPhone = e => { phone.value = e.matches }

// The server's word on this page (ffmpeg present on its workers): when it cannot export, the editor says so up front.
const notReady = ref('')
onMounted(async () => {
  phoneQuery?.addEventListener?.('change', onPhone)
  loadStudioFeatures().then(() => { const f = getStudioFeature('editor'); if (f && f.ready === false) notReady.value = f.reason || 'Export is not available on this server right now.' }).catch(() => {})
  try { projects.value = (await api.get('/video/projects/')).data.projects || [] } catch { projects.value = [] }
  if (projectId.value) await editor.load(projectId.value)
})
onBeforeUnmount(() => { phoneQuery?.removeEventListener?.('change', onPhone); editor.save(); editor.dispose(); stopPolls() })

async function openProject(id) {
  if (editor.state.dirty) await editor.save()
  projectId.value = id
  playing.value = false
  router.replace({ query: { ...route.query, project_id: id || undefined, project: undefined } })
  if (id) await editor.load(id)
}
async function createProject() {
  creating.value = true; startError.value = ''
  try {
    const { data } = await api.post('/video/projects/', { title: newTitle.value.trim(), aspect_ratio: newAspect.value })
    projects.value = [data, ...projects.value]
    await openProject(data.project_id)
  } catch (e) { startError.value = e?.response?.data?.error?.message || 'The project could not be made. Try again.' }
  finally { creating.value = false }
}

const saveLabel = computed(() => {
  const s = editor.state
  if (!projectId.value || !editor.doc.value) return ''
  if (s.conflict) return 'Saving stopped'
  if (s.saving) return 'Saving…'
  if (s.dirty) return 'Unsaved changes'
  return editor.revision.value ? `Saved, revision ${editor.revision.value}` : 'Nothing saved yet'
})
const names = computed(() => Object.fromEntries(Object.entries(editor.media).map(([id, m]) => [id, m.name || ({ video: 'Video', image: 'Picture', audio: 'Sound' })[m.media_type] || 'Clip'])))
const selectedLabel = computed(() => { const s = editor.selected.value[0]; return s ? (s.item.type === 'text' ? 'Text' : s.item.type === 'transition' ? 'Transition' : 'Clip') : 'Video' })
const canAddVideoTrack = computed(() => editor.doc.value.tracks.filter(t => t.kind === 'video').length < (phone.value ? 2 : 4))
// "Make captions from speech" offers itself for a selected clip that has sound.
const captionSource = computed(() => {
  const s = editor.selected.value[0]
  if (!s || s.item.type !== 'clip' || s.item.source_out_ms == null) return null
  const m = editor.media[s.item.media]
  return m && (m.has_audio || m.media_type === 'audio') ? s.item : null
})

function apply(ops, label) { return editor.edit(ops, label) }
function seek(ms) { editor.seek(tl.toFrame(ms, editor.rate.value)) }
function firstTrack(kind) { return editor.doc.value.tracks.find(t => t.kind === kind) }
function trackFor(kind) {
  if (!firstTrack(kind)) apply(tl.addTrackOps(editor.doc.value, kind), '')
  return firstTrack(kind)
}
// A file goes at the playhead on the first track of its kind when that space is free, else after that track's last item.
function addFile(file) {
  const kind = file.media_type === 'audio' ? 'audio' : 'video'
  const track = trackFor(kind)
  const len = file.media_type === 'image' ? 3000 : file.duration_ms || 5000, at = editor.playhead.value
  const free = !tl.ordered(track).some(i => i.start_ms < at + len && tl.itemEnd(i) > at)
  apply(tl.addClipOps(editor.doc.value, track.id, file.attachment_id, { start: free ? at : null, info: file }), `${file.name} added`)
}
function addText(captions) {
  let track = editor.doc.value.tracks.find(t => t.kind === 'text' && !!t.captions === captions)
  if (!track) { apply([...tl.addTrackOps(editor.doc.value, 'text')], ''); track = editor.doc.value.tracks.filter(t => t.kind === 'text').pop(); if (captions) apply(tl.setTrackOps(editor.doc.value, track.id, { captions: true }), '') }
  const at = editor.playhead.value
  const free = !tl.ordered(track).some(i => i.start_ms < at + 3000 && tl.itemEnd(i) > at)
  const start = free ? at : tl.ordered(track).reduce((e, i) => Math.max(e, tl.itemEnd(i)), 0)
  if (apply(tl.addTextOps(editor.doc.value, track.id, { start, captions, text: captions ? 'Caption' : 'Your text' }), captions ? 'Caption added' : 'Text added')) {
    const t = editor.doc.value.tracks.find(x => x.id === track.id)
    editor.select(t.items[t.items.length - 1].id)
  }
}
function addTrack(kind) { apply(tl.addTrackOps(editor.doc.value, kind), `${kind === 'video' ? 'Video' : 'Sound'} track added`) }
function split() {
  const at = editor.playhead.value
  const ids = editor.selection.value.filter(id => { const f = tl.find(editor.doc.value, id); return f && tl.isTimed(f.item) && f.item.start_ms < at && at < tl.itemEnd(f.item) })
  if (!ids.length) { editor.announce('Move the playhead inside the selected clip to split it.'); return }
  let doc = editor.doc.value
  const ops = []
  for (const id of ids) { const o = tl.splitOps(doc, id, at, { rate: editor.rate.value }); ops.push(...o); doc = tl.applyOps(doc, o).doc }
  apply(ops, `Split at ${tl.timecode(at, editor.rate.value)}`)
}
function remove(ripple) { apply(tl.deleteOps(editor.doc.value, editor.selection.value, { ripple }), ripple ? 'Deleted and closed the gap' : 'Deleted'); editor.select(null) }
function duplicate() { apply(tl.duplicateOps(editor.doc.value, editor.selection.value[0]), 'Duplicated') }
function nudge(by) { const f = tl.find(editor.doc.value, editor.selection.value[0]); if (f && tl.isTimed(f.item)) move({ id: f.item.id, start: f.item.start_ms + by }) }
function move({ id, start, track = null }) {
  const ok = apply(tl.moveOps(editor.doc.value, id, tl.toFrame(start, editor.rate.value), track), `Moved to ${tl.timecode(start, editor.rate.value)}`)
  if (ok) requestAnimationFrame(() => timelineEl.value?.focusItem(id))
}
function trim({ id, edge, at }) {
  const f = tl.find(editor.doc.value, id)
  apply(tl.trimOps(editor.doc.value, id, edge, at, { durationMs: editor.media[f?.item.media]?.duration_ms, rate: editor.rate.value }), `Trimmed the ${edge} to ${tl.timecode(at, editor.rate.value)}`)
}
function zoomBy(f) { editor.zoom.value = Math.min(Math.max(editor.zoom.value * f, 4), 400) }
let pinch = 0
function pinchStart(e) { if (e.touches.length === 2) pinch = Math.abs(e.touches[0].clientX - e.touches[1].clientX) }
function pinchMove(e) {
  if (e.touches.length !== 2 || !pinch) return
  const d = Math.abs(e.touches[0].clientX - e.touches[1].clientX)
  if (Math.abs(d - pinch) > 12) { zoomBy(d / pinch); pinch = d }
}
function addCaptions(items) {
  let track = editor.doc.value.tracks.find(t => t.kind === 'text' && t.captions)
  if (!track) { apply(tl.addTrackOps(editor.doc.value, 'text'), ''); track = editor.doc.value.tracks.filter(t => t.kind === 'text').pop(); apply(tl.setTrackOps(editor.doc.value, track.id, { captions: true }), '') }
  // Captions that would overlap ones already there are left out; the person sees how many were added.
  let doc = editor.doc.value
  const ops = []
  for (const c of items) {
    const t = doc.tracks.find(x => x.id === track.id)
    if (tl.ordered(t).some(i => i.start_ms < c.end_ms && tl.itemEnd(i) > c.start_ms)) continue
    const o = tl.addTextOps(doc, track.id, { start: c.start_ms, length: c.end_ms - c.start_ms, text: c.text, captions: true })
    ops.push(...o); doc = tl.applyOps(doc, o).doc
  }
  apply(ops, `${ops.length} caption${ops.length === 1 ? '' : 's'} added from speech`)
}

// ── keyboard shortcuts (WCAG 2.1.4): only while the timeline or the editor's own controls have focus, never while
// typing, and switched off by the setting ───────────────────────────────────────────────────────────────────────
function shortcut(e) {
  if (!editor.shortcuts.value || !editor.doc.value) return
  const tag = e.target?.tagName
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !(tag === 'INPUT' && e.target.type === 'range')) return
  const inTimeline = !!e.target?.closest?.('.ct')
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? editor.redo() : editor.undo(); return }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); editor.redo(); return }
  if (!inTimeline || mod || e.altKey) return
  if (e.key === ' ' && !e.target.closest('.ct-item')) { e.preventDefault(); playing.value = !playing.value }
  else if (e.key === 's' || e.key === 'S') { e.preventDefault(); split() }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(e.shiftKey) }
  else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); duplicate() }
  else if (e.key === '+' || e.key === '=') zoomBy(1.5)
  else if (e.key === '-') zoomBy(1 / 1.5)
}

// ── export and "Preview this part exactly": the existing free export job (E10, P4) ──────────────────────────────
const finished = id => ['ready', 'failed', 'cancelled'].includes(video.jobs[id]?.state)
const polls = new Map()
function follow(id) {
  if (polls.has(id)) return
  polls.set(id, setInterval(async () => { await video.refreshJob(id); if (finished(id)) { clearInterval(polls.get(id)); polls.delete(id) } }, 4000))
}
function stopPolls() { for (const t of polls.values()) clearInterval(t); polls.clear() }
async function startExport(params) {
  if (editor.state.dirty) await editor.save()
  if (editor.state.conflict) throw new Error('Saving stopped: reload the newest timeline first.')
  if (!editor.revisionId.value) throw new Error('Add something to the timeline first.')
  const { data } = await api.post('/video/jobs/', { operation: 'export', project_id: projectId.value, params: { timeline_revision_id: editor.revisionId.value, title: editor.project.value?.title, ...params } })
  video._put(data); follow(data.job_id)
  return data.job_id
}
// Two free downloads (ADM-1252, P8): the saved timeline's text and image overlays as a Lottie file (what Lottie cannot
// hold is said, not dropped), and the project's video as a self-contained web page.
const downloadNote = ref('')
function saveBlob(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
function fileTitle() { return (editor.project.value?.title || 'timeline').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'timeline' }
async function downloadLottie() {
  downloadNote.value = ''
  try {
    if (!editor.revisionId.value) throw new Error('Add something to the timeline first.')
    const { data } = await api.getTimelineLottie(projectId.value, editor.revisionId.value)
    saveBlob(new Blob([JSON.stringify(data.lottie)], { type: 'application/json' }), `${fileTitle()}.lottie.json`)
    const left = (data.not_represented || []).map(x => typeof x === 'string' ? x : (x.what || x.kind || x.reason || '')).filter(Boolean)
    downloadNote.value = left.length ? `Lottie cannot hold: ${left.join(', ')}.` : 'Lottie file downloaded.'
  } catch (e) { downloadNote.value = e?.response?.data?.error || e?.message || 'The Lottie file could not be made.' }
}
async function downloadWebPage() {
  downloadNote.value = ''
  try {
    const video = editor.project.value?.active_video
    if (!video?.attachment_id) throw new Error('Export the video first; the web page carries the finished video.')
    const { data } = await api.downloadWebPage({ video_id: video.attachment_id, project_id: projectId.value, title: editor.project.value?.title })
    saveBlob(data, 'video-page.zip'); downloadNote.value = 'Web page downloaded.'
  } catch (e) { downloadNote.value = e?.response?.data?.error || e?.message || 'The web page could not be made.' }
}
async function runExport({ aspects, resolution }) {
  exporting.value = true; exportError.value = ''
  try { exportJob.value = await startExport({ aspects, resolution }); editor.announce('Export started. It lands in your Library and this project.') }
  catch (e) { exportError.value = e?.response?.data?.error?.message || e.message || 'The export could not start.' }
  finally { exporting.value = false }
}
// The selected clip's time, or ten seconds around the playhead, rendered exactly as the export draws it (720p).
async function previewExact() {
  const s = editor.selected.value.find(x => tl.isTimed(x.item))
  const a = s ? s.item.start_ms : Math.max(0, editor.playhead.value - 5000)
  const b = s ? tl.itemEnd(s.item) : Math.min(editor.total.value, a + 10000)
  try { previewJob.value = await startExport({ range_ms: [Math.round(a), Math.round(b)], resolution: '720p' }) }
  catch (e) { editor.announce(e?.response?.data?.error?.message || e.message) ; editor.state.saveError = e?.response?.data?.error?.message || e.message }
}
watch(() => route.query.project_id, id => { if (id && String(id) !== projectId.value) openProject(String(id)) })
</script>
<style scoped>
.ve{display:grid;gap:12px;align-content:start;min-width:0;padding:16px 20px 28px;color:var(--vm-ink)}
.ve-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.ve-title{font-size:18px;font-weight:600;margin:0;min-width:0;overflow-wrap:anywhere}
.ve-project{min-width:200px}.ve-save{margin-left:auto;font-size:12px;color:var(--vm-ink-soft)}
.ve-conflict{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px;border:1px solid var(--vs-warn-line);border-radius:8px;background:var(--vs-warn-bg);color:var(--vs-warn-ink);font-size:13px;line-height:1.55}
.ve-conflict p{flex:1 1 320px;margin:0}.ve-conflict strong{color:var(--vm-ink)}
.ve-start{display:grid;gap:12px;max-width:560px;padding:24px;border:1px dashed var(--vm-line);border-radius:10px}
.ve-start h2{font-size:17px;font-weight:600}.ve-new{display:grid;gap:10px}
.ve-top{display:grid;grid-template-columns:minmax(220px,260px) minmax(0,1fr) minmax(240px,300px);gap:12px;align-items:start;min-width:0}
.ve-top > :deep(.bs-host){min-width:0;max-height:min(62vh,640px);overflow:auto;padding:10px;border:1px solid var(--vm-line-2);border-radius:8px;background:var(--vm-surface)}
.ve-preview{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}.ve-preview > :first-child{flex:1 1 320px}
.ve-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ve-tools .st-button{min-height:34px;padding:6px 10px;font-size:12px}
.ve-tools .st-button[aria-pressed="true"]{border-color:var(--vm-primary);background:var(--vm-primary-soft)}
.ve-sep{width:1px;height:22px;background:var(--vm-line)}
.ve-keys{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--vm-ink-soft)}
.ve-export{margin-left:auto}
.ve-hint{font-size:12px;line-height:1.5}
@media (max-width:1023px){
  .ve-top{grid-template-columns:1fr}
  .ve-top > :deep(.bs-host){max-height:none;overflow:visible;padding:0;border:0;background:none}
  .ve-monitor{order:-1}
}
@media (max-width:767px){
  .ve{padding:12px 16px 20px;gap:10px}
  .ve-project{min-width:0;flex:1 1 100%}.ve-save{margin-left:0}
  .ve-top{display:flex;flex-direction:column}
  .ve-tools{position:sticky;bottom:0;z-index:5;padding:8px 0;background:var(--vm-bg);overflow-x:auto;flex-wrap:nowrap}
  .ve-tools .st-button{min-height:44px;flex:none}
  .ve-sep,.ve-keys,.ve-hint{display:none}
  .ve-export{margin-left:0}
}
</style>
