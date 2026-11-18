// The clip editor's state (agentic-docs/VIDEO_CLIP_EDITOR_PLAN.md P2, ADM-1199): the timeline document, its undo and
// redo history, the selection, the playhead and zoom, the files in the project, and the save rules: autosave 2 s after
// the last edit, every save checked against the revision it started from (E8). When the server says another tab or the
// agent saved first, the editor stops saving and says so; nothing is overwritten.
import { computed, reactive, ref, shallowRef } from 'vue'
import api from '../../services/api'
import * as tl from './timelineModel'

export const AUTOSAVE_MS = 2000
const SHORTCUTS_KEY = 'aadml.clipEditor.shortcuts'

function readShortcuts() { try { return localStorage.getItem(SHORTCUTS_KEY) !== 'off' } catch { return true } }
function errorText(e, fallback) { return e?.response?.data?.error?.message || e?.message || fallback }

export function useClipEditor({ autosaveMs = AUTOSAVE_MS } = {}) {
  const projectId = ref('')
  const project = shallowRef(null)
  const doc = shallowRef(null)
  const revision = ref(0)               // the revision this editor's edits build on
  const revisionId = ref(null)          // its id, which an export names
  const history = reactive(tl.createHistory())
  const selection = ref([])
  const playhead = ref(0)
  const zoom = ref(60)                  // pixels a second on the timeline
  const snapping = ref(true)
  const shortcuts = ref(readShortcuts())
  const media = reactive({})            // attachment id → the server's prepared-media view (length, previews, strip)
  const state = reactive({ loading: false, saving: false, dirty: false, error: '', conflict: null, saveError: '' })
  const announcement = ref('')
  let timer = null, saveSeq = 0

  const rate = computed(() => doc.value?.rate || 30)
  const total = computed(() => doc.value ? tl.totalMs(doc.value) : 0)
  const selected = computed(() => selection.value.map(id => doc.value && tl.find(doc.value, id)).filter(Boolean))
  const canUndo = computed(() => history.past.length > 0)
  const canRedo = computed(() => history.future.length > 0)

  function announce(text) { announcement.value = ''; queueMicrotask(() => { announcement.value = text }) }

  async function load(id) {
    projectId.value = String(id || '')
    state.loading = true; state.error = ''; state.conflict = null; state.saveError = ''
    try {
      const [p, t] = await Promise.all([api.get(`/video/projects/${projectId.value}/`), api.get(`/video/projects/${projectId.value}/timeline/`)])
      project.value = p.data
      revision.value = t.data.revision || 0
      revisionId.value = t.data.revision_id || null
      doc.value = t.data.edl || tl.newDoc(p.data.aspect_ratio || '16:9')
      history.past.length = 0; history.future.length = 0
      selection.value = []; playhead.value = 0; state.dirty = false
      await Promise.all([...new Set([...usedMedia(), ...(p.data.assets || []).filter(a => ['video', 'image', 'audio'].includes(a.media_type)).map(a => a.attachment_id)])].map(m => loadMedia(m)))
    } catch (e) {
      state.error = e?.response?.status === 404 ? 'This project is not on your account.' : errText(e)
    } finally { state.loading = false }
  }
  const errText = e => errorText(e, 'The project could not be opened. Try again.')
  // The project's files again (after an upload or a file linked from the Library), and the new file's editor view.
  async function refreshProject(attachmentId = null) {
    const { data } = await api.get(`/video/projects/${projectId.value}/`)
    project.value = data
    const ids = (data.assets || []).map(a => a.attachment_id).filter(id => !media[id])
    if (attachmentId && !ids.includes(attachmentId)) ids.push(attachmentId)
    await Promise.all(ids.map(id => loadMedia(id)))
  }
  function usedMedia() {
    const ids = new Set()
    for (const t of doc.value?.tracks || []) for (const i of t.items) if (i.media) ids.add(i.media)
    return [...ids]
  }
  // A file's editor view (its length, preview copy, frame strip, waveform). Made on the server once; asked again
  // while it is still being prepared.
  async function loadMedia(attachmentId, { wait = true } = {}) {
    try {
      const { data } = await api.get(`/video/editor/media/${attachmentId}/`, { params: { project_id: projectId.value } })
      media[attachmentId] = data
      if (wait && data.state === 'pending') setTimeout(() => loadMedia(attachmentId), 3000)
      return data
    } catch (e) {
      media[attachmentId] = { attachment_id: attachmentId, state: 'failed', error: errorText(e, 'This file cannot be used here.') }
      return media[attachmentId]
    }
  }

  // ── editing ───────────────────────────────────────────────────────────────────────────────────────────────────
  // Every change to the timeline goes through here: refused when the result would break a rule the server checks
  // (the reason is announced), else recorded for undo and saved shortly after.
  function edit(ops, label) {
    if (!doc.value || !ops?.length || state.conflict) return false
    const { doc: next } = tl.applyOps(doc.value, ops)
    const why = tl.problem(next)
    if (why) { announce(why); return false }
    doc.value = tl.commit(history, doc.value, ops, label)
    selection.value = selection.value.filter(id => tl.find(doc.value, id))
    if (label) announce(label)
    changed()
    return true
  }
  function undo() {
    if (!canUndo.value || state.conflict) return
    const r = tl.undo(history, doc.value)
    doc.value = r.doc
    selection.value = selection.value.filter(id => tl.find(doc.value, id))
    announce(r.label ? `Undid: ${r.label}` : 'Undid the last edit'); changed()
  }
  function redo() {
    if (!canRedo.value || state.conflict) return
    const r = tl.redo(history, doc.value)
    doc.value = r.doc
    announce(r.label ? `Redid: ${r.label}` : 'Redid the edit'); changed()
  }
  function changed() {
    state.dirty = true
    clearTimeout(timer)
    timer = setTimeout(save, autosaveMs)
  }

  // ── saving ────────────────────────────────────────────────────────────────────────────────────────────────────
  async function save() {
    clearTimeout(timer)
    if (!doc.value || !state.dirty || state.conflict || !projectId.value) return null
    if (state.saving) { timer = setTimeout(save, 300); return null }
    const sent = doc.value, seq = ++saveSeq
    state.saving = true; state.saveError = ''
    try {
      const { data } = await api.post(`/video/projects/${projectId.value}/timeline/`, { edl: sent, base_revision: revision.value })
      revision.value = data.revision
      revisionId.value = data.revision_id
      if (doc.value === sent && seq === saveSeq) state.dirty = false
      return data
    } catch (e) {
      if (e?.response?.status === 409) {
        state.conflict = e.response.data?.timeline || { revision: null }
        announce('This project was changed in another tab or by the agent. Saving stopped.')
      } else state.saveError = errorText(e, 'The timeline could not be saved. Your edits are kept here; saving tries again after your next edit.')
      return null
    } finally { state.saving = false }
  }
  // After a conflict: open the newest revision (the edits made here since the last save are dropped, as the person chose).
  async function reloadLatest() { clearTimeout(timer); await load(projectId.value) }

  function setShortcuts(on) {
    shortcuts.value = !!on
    try { localStorage.setItem(SHORTCUTS_KEY, on ? 'on' : 'off') } catch { /* the choice lasts this visit */ }
  }
  function select(id, { add = false } = {}) {
    if (!id) { selection.value = []; return }
    selection.value = add ? (selection.value.includes(id) ? selection.value.filter(x => x !== id) : [...selection.value, id]) : [id]
  }
  function seek(ms) { playhead.value = Math.min(Math.max(0, Math.round(ms)), Math.max(total.value, 0)) }
  function dispose() { clearTimeout(timer) }

  return { projectId, project, doc, revision, revisionId, history, selection, selected, playhead, zoom, snapping, shortcuts, media, state,
    announcement, rate, total, canUndo, canRedo, load, loadMedia, refreshProject, edit, undo, redo, save, reloadLatest, setShortcuts,
    select, seek, announce, dispose }
}
