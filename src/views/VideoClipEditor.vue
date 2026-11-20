<template>
  <!-- The clip editor (agentic-docs/VIDEO_CLIP_EDITOR_PLAN.md and VIDEO_EDITOR_PRO_PLAN.md section 6, ADM-1199), under
       Edit & enhance. Desktop (1280 px and wider): the bin, the monitor and the inspector side by side over the
       full-width timeline. Tablet (768 to 1279 px): the monitor full width, the bin and the inspector open as panels
       from the buttons under it. Phone (below 768 px): the reduced editor; the monitor, a short timeline that scrolls
       sideways in its own box, a toolbar, and bottom sheets; 44 px targets; every gesture has a button. -->
  <div class="ve" :class="{ 'is-phone': phone }">
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
    <!-- The editor's registry (effects, transitions, fonts and their ranges) comes from the server once; the panels
         wait for it, and a failed read says so with a way to ask again. -->
    <div v-else-if="registryError" class="st-error" role="alert" data-test="ve-registry-error">{{ registryError }} <button type="button" class="st-button" @click="readRegistry">Try again</button></div>
    <p v-else-if="!registryReady" class="st-status" role="status">Opening the editor…</p>

    <template v-else-if="editor.doc.value">
      <div class="ve-top">
        <BottomSheet label="Media and catalogues" :summary="`${(editor.project.value?.assets || []).length} files`" test-id="ve-bin" :breakpoint="DESKTOP" class="ve-bin">
          <ClipMediaBin :project-id="projectId" :project="editor.project.value" :media="editor.media" :can-apply="!!effectTarget" :can-join="canJoin"
                        @add="addFile" @add-text="addTemplate" @add-effect="addEffect" @add-transition="addTransition" @files-changed="editor.refreshProject" />
        </BottomSheet>
        <ClipMonitor v-model:safe-area="safeArea" class="ve-monitor" :doc="editor.view.value" :playhead="editor.playhead.value" :playing="editor.playing.value"
                     :playback="editor.playback" :media="editor.media" :preview-busy="!!previewJob && !finished(previewJob)"
                     @tick="editor.tick" @toggle="editor.togglePlay()" @toggle-loop="editor.toggleLoop()" @seek="seek" @preview-exact="previewExact" />
        <BottomSheet label="Settings" :summary="selectedLabel" test-id="ve-inspector" :breakpoint="DESKTOP" class="ve-inspector">
          <ClipInspector :doc="editor.view.value" :selected-id="editor.selection.value[0] || ''" :media="editor.media" :playhead="editor.playhead.value"
                         :project-id="projectId" :names="names" :compact="phone" :request-tab="requestTab"
                         @ops="apply($event.ops, $event.label)" @select="id => editor.select(id)" @seek="seek" @refresh-media="id => editor.loadMedia(id)" />
          <ClipCaptions :project-id="projectId" :doc="editor.view.value" :clip="captionSource" :rate="editor.rate.value" @captions="addCaptions" @ops="apply($event.ops, $event.label)" />
          <ClipHelpers :doc="editor.view.value" :clip="selectedClip" :selection="editor.selection.value" :media="editor.media" @ops="apply($event.ops, $event.label)" />
        </BottomSheet>
      </div>
      <div v-if="previewJob" class="ve-preview" role="status">
        <VideoJobCard :job="video.jobs[previewJob] || { job_id: previewJob, state: 'queued' }" in-studio />
        <IconButton :icon="X" label="Close the preview" @click="previewJob = ''" />
      </div>

      <!-- The page's own toolbar: icon buttons (owner's rule, 2026-11-19), each named and with its shortcut in its
           tooltip. Split, Snap and the other cutting tools are on the timeline's own tools bar (ClipTimeline). -->
      <div class="ve-tools" role="toolbar" aria-label="Edit">
        <IconButton :icon="Trash2" label="Delete" shortcut="Delete" :disabled="!editor.selection.value.length" data-test="ve-delete" @click="editor.removeSelected(false)" />
        <IconButton :icon="ArrowLeftToLine" label="Delete and close the gap" shortcut="Shift+Delete" :disabled="!editor.selection.value.length" data-test="ve-ripple" @click="editor.removeSelected(true)" />
        <IconButton :icon="CopyPlus" label="Duplicate" shortcut="D" :disabled="editor.selection.value.length !== 1" data-test="ve-duplicate" @click="editor.duplicateSelected()" />
        <IconButton :icon="MoveLeft" label="Move earlier by one second" shortcut="Alt+Shift+Left" :disabled="editor.selection.value.length !== 1" @click="nudge(-1000)" />
        <IconButton :icon="MoveRight" label="Move later by one second" shortcut="Alt+Shift+Right" :disabled="editor.selection.value.length !== 1" @click="nudge(1000)" />
        <IconButton :icon="Undo2" label="Undo" shortcut="Ctrl+Z" :disabled="!editor.canUndo.value" data-test="ve-undo" @click="editor.undo()" />
        <IconButton :icon="Redo2" label="Redo" shortcut="Ctrl+Shift+Z" :disabled="!editor.canRedo.value" data-test="ve-redo" @click="editor.redo()" />
        <span class="ve-sep" aria-hidden="true" />
        <IconButton :icon="Type" label="Add text at the playhead" data-test="ve-add-text" @click="addText(false)" />
        <IconButton :icon="Captions" label="Add a caption at the playhead" data-test="ve-add-caption" @click="addText(true)" />
        <IconButton :icon="Film" label="Add a video track" :disabled="!canAddVideoTrack" @click="addTrack('video')" />
        <IconButton :icon="AudioLines" label="Add a sound track" @click="addTrack('audio')" />
        <span class="ve-sep" aria-hidden="true" />
        <IconButton :icon="ZoomOut" label="Zoom out" shortcut="-" @click="editor.zoomBy(1 / 1.5)" />
        <IconButton :icon="ZoomIn" label="Zoom in" shortcut="+" @click="editor.zoomBy(1.5)" />
        <label class="ve-keys"><input type="checkbox" :checked="editor.shortcuts.value" @change="editor.setShortcuts($event.target.checked)" /> Keyboard shortcuts</label>
        <button type="button" class="st-button primary ve-export" :disabled="!editor.total.value" @click="exportOpen = true">Export</button>
      </div>

      <!-- With the editor passed in, the timeline edits, selects, seeks and takes drops from the bin through it. -->
      <ClipTimeline ref="timelineEl" :editor="editor" :media="editor.media" :names="names" @touchstart.passive="pinchStart" @touchmove.passive="pinchMove" />
    </template>

    <ClipExportDialog v-if="exportOpen" :doc="editor.doc.value" :missing="missingHelpers" :helper="helper.state.status === 'idle' ? '' : helper.state.status" @make-helper="makeHelper" :media="editor.media" :selection-range="selectionRange" :playhead="editor.playhead.value" :busy="exporting" :job="exportJob ? (video.jobs[exportJob] || null) : null" :error="exportError"
                      :note="downloadNote" @close="exportOpen = false" @export="runExport" @lottie="downloadLottie" @webpage="downloadWebPage" />
    <div class="st-sr" aria-live="polite">{{ editor.announcement.value }}</div>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'
// The Studio's shared form styles (st-field, st-input, st-button): opened straight from a link, no other Studio page
// has loaded them yet, and the start form showed as bare boxes (live 2026-11-18).
import '../components/studio/studio.css'
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
import ClipHelpers from '../components/clip-editor/panels/ClipHelpers.vue'
import * as br from '../components/clip-editor/panels/bridge'
import { COLOUR_KINDS } from '../components/clip-editor/panels/panelModel'
import { applyTemplateChanges } from '../components/clip-editor/panels/textTemplates'
import { onGrid } from '../components/clip-editor/panels/subtitles'
import { useDerive } from '../components/clip-editor/panels/useDerive'
import IconButton from '../components/clip-editor/panels/IconButton.vue'
import { ArrowLeftToLine, AudioLines, Captions, CopyPlus, Film, MoveLeft, MoveRight, Redo2, Trash2, Type, Undo2, X, ZoomIn, ZoomOut } from 'lucide-vue-next'
import BottomSheet from '../components/video/BottomSheet.vue'
import VideoJobCard from '../components/video/VideoJobCard.vue'

defineProps({ featureId: { type: String, default: 'editor' } })
const route = useRoute(), router = useRouter(), video = useVideoStore()
const editor = useClipEditor()
const projects = ref([]), projectId = ref(String(route.query.project_id || route.query.project || ''))
const newTitle = ref(''), newAspect = ref('9:16'), creating = ref(false), startError = ref('')
const timelineEl = ref(null)
const exportOpen = ref(false), exporting = ref(false), exportJob = ref(''), exportError = ref(''), previewJob = ref('')
// The layouts of VIDEO_EDITOR_PRO_PLAN.md section 6: desktop from 1280 px; tablet 768 to 1279 px; phone below 768 px.
const DESKTOP = 1280
const safeArea = ref('')                 // a monitor-only guide (TikTok, Reels, Shorts, YouTube); never exported
const requestTab = ref(null)             // {tab, n}: the inspector opens that tab (a catalogue's Add that needs it)
const phoneQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 767px)') : null
const phone = ref(!!phoneQuery?.matches)
const onPhone = e => { phone.value = e.matches }

// The editor registry (contract section 3): read once from the server before the panels show.
const registryReady = ref(!!br.registry()), registryError = ref('')
async function readRegistry() {
  registryError.value = ''
  try { await br.loadRegistry(); registryReady.value = true }
  catch (e) { registryError.value = e?.response?.data?.error?.message || "The editor's list of effects, transitions and fonts could not be read." }
}
// The server's word on this page (ffmpeg present on its workers): when it cannot export, the editor says so up front.
const notReady = ref('')
onMounted(async () => {
  phoneQuery?.addEventListener?.('change', onPhone)
  if (!registryReady.value) readRegistry()
  loadStudioFeatures().then(() => { const f = getStudioFeature('editor'); if (f && f.ready === false) notReady.value = f.reason || 'Export is not available on this server right now.' }).catch(() => {})
  try { projects.value = (await api.get('/video/projects/')).data.projects || [] } catch { projects.value = [] }
  if (projectId.value) await editor.load(projectId.value)
})
onBeforeUnmount(() => { phoneQuery?.removeEventListener?.('change', onPhone); editor.save(); editor.dispose(); stopPolls() })

async function openProject(id) {
  if (editor.state.dirty) await editor.save()
  projectId.value = id
  if (editor.playing.value) editor.togglePlay()
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
const canAddVideoTrack = computed(() => editor.view.value.tracks.filter(t => t.kind === 'video').length < (phone.value ? 2 : 4))
// "Make captions from speech" offers itself for a selected clip that has sound.
const captionSource = computed(() => {
  const s = editor.selected.value[0]
  if (!s || s.item.type !== 'clip' || s.item.source_out_ms == null) return null
  const m = editor.media[s.item.media]
  return m && (m.has_audio || m.media_type === 'audio') ? s.item : null
})

// The selected clip for helpers and effects, the selection's time span for "export the selection".
const selectedClip = computed(() => { const s = editor.selected.value.find(x => x.item.type === 'clip'); return s ? s.item : null })
const effectTarget = computed(() => { const s = editor.selected.value[0]; return s && s.item.type === 'clip' && s.track.kind === 'video' ? s.item : null })
const canJoin = computed(() => {
  const s = editor.selected.value[0]
  if (!s || s.item.type !== 'clip' || s.track.kind !== 'video') return false
  const list = tl.ordered(s.track), next = list[list.findIndex(i => i.id === s.item.id) + 1]
  return !!next && next.start_ms === tl.itemEnd(s.item, editor.rate.value) && !tl.transitionInto(s.track, next.id)
})
const selectionRange = computed(() => {
  const timed = editor.selected.value.filter(x => tl.isTimed(x.item))
  if (!timed.length) return null
  return [Math.min(...timed.map(x => x.item.start_ms)), Math.max(...timed.map(x => tl.itemEnd(x.item, editor.rate.value)))]
})

function apply(ops, label) { return editor.edit(ops, label) }
function openTab(tab) { requestTab.value = { tab, n: (requestTab.value?.n || 0) + 1 } }
// From the bin: a text template at the playhead, an effect on the selected clip, a transition after it.
function addTemplate(t) {
  addText(false)
  const s = editor.selected.value[0]
  if (s?.item.type === 'text') apply(tl.setOps(editor.view.value, s.item.id, applyTemplateChanges(t, { keepText: false })), `${t.name} added`)
}
function addEffect(kind) {
  const clip = effectTarget.value
  if (!clip) { editor.announce('Select a video clip or picture first.'); return }
  // Background removal is paid: it opens where its price card is, and nothing runs before Generate.
  const reg = br.registry()
  if (br.effectPaid(reg, kind)) { openTab('effects'); editor.announce('Background removal shows its price in Settings, Effects, before it runs.'); return }
  if (apply(br.addEffectOps(editor.view.value, clip.id, kind, { registry: reg }), `${reg.effects[kind]?.label || kind} added`)) openTab(COLOUR_KINDS.includes(kind) ? 'colour' : 'effects')
  else editor.announce(`That effect could not be added: a clip holds at most ${reg.limits.effects_per_clip} effects.`)
}
function addTransition(kind) {
  const s = editor.selected.value[0]
  const label = br.transitionLabel(br.registry(), kind)
  if (!s || !apply(tl.addTransitionOps(editor.view.value, s.item.id, kind, 500), `${label} added`)) editor.announce('Select a video clip whose next clip starts where it ends.')
}
function seek(ms) { editor.seek(tl.toFrame(ms, editor.rate.value)) }
// A file from the bin, placed as the person chose there (insert, append, overwrite or connect): the editor's edit.
function addFile(file, mode = 'insert') { editor.insertMedia(file, mode) }
function addText(captions) {
  const V = () => editor.view.value
  let track = V().tracks.find(t => t.kind === 'text' && !!t.captions === captions)
  if (!track) { apply([...tl.addTrackOps(V(), 'text')], ''); track = V().tracks.filter(t => t.kind === 'text').pop(); if (captions) apply(tl.setTrackOps(V(), track.id, { captions: true }), '') }
  const at = editor.playhead.value
  const free = !tl.ordered(track).some(i => i.start_ms < at + 3000 && tl.itemEnd(i, editor.rate.value) > at)
  const start = free ? at : tl.ordered(track).reduce((e, i) => Math.max(e, tl.itemEnd(i, editor.rate.value)), 0)
  if (apply(tl.addTextOps(V(), track.id, { start, captions, text: captions ? 'Caption' : 'Your text' }), captions ? 'Caption added' : 'Text added')) {
    const t = V().tracks.find(x => x.id === track.id)
    editor.select(t.items[t.items.length - 1].id)
  }
}
function addTrack(kind) { apply(tl.addTrackOps(editor.view.value, kind), `${kind === 'video' ? 'Video' : 'Sound'} track added`) }
// The toolbar's move by a second (the same as Alt+Shift+arrow on a focused item, with the Select tool).
function nudge(by) {
  const f = tl.find(editor.view.value, editor.selection.value[0])
  if (!f || !tl.isTimed(f.item)) return
  if (editor.moveItem({ id: f.item.id, start: tl.toFrame(f.item.start_ms + by, editor.rate.value) })) requestAnimationFrame(() => timelineEl.value?.focusItem(f.item.id))
}
let pinch = 0
function pinchStart(e) { if (e.touches.length === 2) pinch = Math.abs(e.touches[0].clientX - e.touches[1].clientX) }
function pinchMove(e) {
  if (e.touches.length !== 2 || !pinch) return
  const d = Math.abs(e.touches[0].clientX - e.touches[1].clientX)
  if (Math.abs(d - pinch) > 12) { editor.zoomBy(d / pinch); pinch = d }
}
function addCaptions(items) {
  const V = () => editor.view.value
  let track = V().tracks.find(t => t.kind === 'text' && t.captions)
  if (!track) { apply(tl.addTrackOps(V(), 'text'), ''); track = V().tracks.filter(t => t.kind === 'text').pop(); apply(tl.setTrackOps(V(), track.id, { captions: true }), '') }
  // Captions that would overlap ones already there are left out; the person sees how many were added.
  let doc = V()
  const ops = []
  for (const c of items) {
    const t = doc.tracks.find(x => x.id === track.id)
    if (tl.ordered(t).some(i => i.start_ms < c.end_ms && tl.itemEnd(i, editor.rate.value) > c.start_ms)) continue
    const o = tl.addTextOps(doc, track.id, { start: c.start_ms, length: c.end_ms - c.start_ms, text: c.text, captions: true })
    // Word times and the caption style come with captions made from speech (contract section 1, caption items); the
    // words stay inside the caption once its edges are on the frame grid.
    if (c.words?.length) o[0].value = { ...o[0].value, words: onGrid({ ...o[0].value, words: c.words }, editor.rate.value).words }
    if (c.caption_style) o[0].value = { ...o[0].value, caption_style: c.caption_style }
    ops.push(...o); doc = tl.applyOps(doc, o).doc
  }
  apply(ops, `${ops.length} caption${ops.length === 1 ? '' : 's'} added`)
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
// The helper files an export needs (contract section 7): a reversed clip's reversed copy, a background removal's matte.
// The server refuses an export without them (409 derived_missing, its message naming each); the dialog lists them here,
// read from the timeline and the media views, each with the way to make it.
const missingHelpers = ref([])
const helper = useDerive()
function helpersMissing() {
  const out = [], root = editor.doc.value
  const walk = tracks => { for (const t of tracks || []) for (const i of t.items) {
    if (i.type !== 'clip' || !i.media) continue
    const m = editor.media[i.media] || {}
    if (i.reverse && !m.reversed_url) out.push({ clip: i.id, media: i.media, op: 'reverse', name: names.value[i.media] })
    if ((i.effects || []).some(e => e.kind === 'bg_removal' && e.enabled !== false) && !m.matte_url) out.push({ clip: i.id, media: i.media, op: 'bg_removal', name: names.value[i.media] })
  } }
  walk(root?.tracks)
  for (const c of Object.values(root?.compounds || {})) walk(c.tracks)
  return out
}
function makeHelper(m) {
  if (m.op === 'reverse') { helper.start(m.media, 'reverse', {}); return }
  // Background removal is paid: its price card is in Settings, Effects, on that clip.
  exportOpen.value = false
  editor.select(m.clip)
  openTab('effects')
}
watch(() => helper.state.status, async s => {
  if (s !== 'ready') return
  await Promise.all([...new Set(missingHelpers.value.map(m => m.media))].map(id => editor.loadMedia(id)))
  missingHelpers.value = helpersMissing()
  if (!missingHelpers.value.length) exportError.value = ''
})
// The dialog's choices are the export job's params (contract section 9).
async function runExport(params) {
  exporting.value = true; exportError.value = ''
  try { exportJob.value = await startExport(params); editor.announce('Export started. It lands in your Library and this project.') }
  catch (e) {
    exportError.value = e?.response?.data?.error?.message || e.message || 'The export could not start.'
    missingHelpers.value = e?.response?.status === 409 && e.response.data?.error?.code === 'derived_missing' ? helpersMissing() : []
  }
  finally { exporting.value = false }
}
// The selected clip's time, or ten seconds around the playhead, rendered exactly as the export draws it (720p).
async function previewExact() {
  const s = editor.selected.value.find(x => tl.isTimed(x.item))
  const a = s ? s.item.start_ms : Math.max(0, editor.playhead.value - 5000)
  const b = s ? tl.itemEnd(s.item, editor.rate.value) : Math.min(editor.total.value, a + 10000)
  try { previewJob.value = await startExport({ range_ms: [Math.round(a), Math.round(b)], resolution: '720p' }) }
  catch (e) { editor.announce(e?.response?.data?.error?.message || e.message) ; editor.state.saveError = e?.response?.data?.error?.message || e.message }
}
watch(() => route.query.project_id, id => { if (id && String(id) !== projectId.value) openProject(String(id)) })
</script>
<style scoped>
.ve{display:grid;gap:12px;align-content:start;min-width:0;max-width:100%;overflow-x:clip;padding:16px 20px 28px;color:var(--vm-ink)}
.ve :is(button,a,input,select,textarea,summary):focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:2px}
.ve-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.ve-title{font-size:18px;font-weight:600;margin:0;min-width:0;overflow-wrap:anywhere}
.ve-project{min-width:200px}.ve-save{margin-left:auto;font-size:12px;color:var(--vm-ink-soft)}
.ve-conflict{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px;border:1px solid var(--vs-warn-line);border-radius:8px;background:var(--vs-warn-bg);color:var(--vs-warn-ink);font-size:13px;line-height:1.55}
.ve-conflict p{flex:1 1 320px;margin:0}.ve-conflict strong{color:var(--vm-ink)}
.ve-start{display:grid;gap:12px;max-width:560px;padding:24px;border:1px dashed var(--vm-line);border-radius:10px}
.ve-start h2{font-size:17px;font-weight:600}.ve-new{display:grid;gap:10px}
.ve-top{display:grid;grid-template-columns:minmax(240px,280px) minmax(0,1fr) minmax(300px,340px);gap:12px;align-items:start;min-width:0}
.ve-top > :deep(.bs-host){min-width:0;max-height:min(66vh,720px);overflow:auto;overscroll-behavior:contain;padding:10px;border:1px solid var(--vm-line-2);border-radius:8px;background:var(--vm-surface)}
.ve-preview{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}.ve-preview > :first-child{flex:1 1 320px}
.ve-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ve-tools .st-button{min-height:34px;padding:6px 10px;font-size:12px}
.ve-tools .st-button[aria-pressed="true"]{border-color:var(--vm-primary);background:var(--vm-primary-soft)}
.ve-sep{width:1px;height:22px;background:var(--vm-line)}
.ve-keys{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--vm-ink-soft)}
.ve-export{margin-left:auto}
/* Tablet: the monitor across the top, the bin and the inspector as two panel buttons under it. */
@media (max-width:1279px){
  .ve-top{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ve-top > :deep(.bs-host){max-height:none;overflow:visible;padding:0;border:0;background:none}
  .ve-top > :deep(.bs-host .bs-trigger){width:100%;min-height:44px}
  .ve-monitor{order:-1;grid-column:1/-1}
}
@media (max-width:767px){
  .ve{padding:12px 16px 20px;gap:10px}
  .ve-project{min-width:0;flex:1 1 100%}.ve-save{margin-left:0}
  .ve-top{display:flex;flex-direction:column}
  .ve-tools{position:sticky;bottom:0;z-index:5;padding:8px 0;background:var(--vm-bg);overflow-x:auto;flex-wrap:nowrap}
  .ve-tools .st-button{min-height:44px;flex:none}
  .ve-sep,.ve-keys{display:none}
  .ve-export{margin-left:0}
}
</style>
