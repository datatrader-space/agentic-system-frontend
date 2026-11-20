// The clip editor's state (agentic-docs/VIDEO_EDITOR_PRO_PLAN.md 3.A and P14, VIDEO_EDITOR_PRO_CONTRACT.md 6; ADM-1199):
// the timeline document (version 3), its undo and redo history, the compound being edited, the tools, the selection
// and clipboard, the playhead, shuttle and loop, the files in the project, the keyboard shortcuts, and the save rules:
// autosave 2 s after the last edit, every save checked against the revision it started from. When the server says
// another tab or the agent saved first, the editor stops saving and says so; nothing is overwritten.
import { computed, reactive, ref, shallowRef } from 'vue'
import api from '../../services/api'
import * as tl from './timelineModel'
import { effectPaid, registry } from './registry'
import { BUILT_IN_TEMPLATES, applyTemplateChanges, useTextTemplates } from './panels/textTemplates'

export const AUTOSAVE_MS = 2000
export const TOOLS = [
  { id: 'select', label: 'Select', key: 'A' }, { id: 'blade', label: 'Blade', key: 'B' }, { id: 'trim', label: 'Trim', key: 'T' },
  { id: 'slip', label: 'Slip', key: 'Y' }, { id: 'slide', label: 'Slide', key: 'U' }]
export const SHUTTLE_MAX = 8
const SHORTCUTS_KEY = 'aadml.clipEditor.shortcuts'
const TOOL_KEYS = { a: 'select', b: 'blade', t: 'trim', y: 'slip', u: 'slide' }

function readShortcuts() { try { return localStorage.getItem(SHORTCUTS_KEY) !== 'off' } catch { return true } }
function errorText(e, fallback) { return e?.response?.data?.error?.message || e?.message || fallback }
const clone = v => JSON.parse(JSON.stringify(v))

export function useClipEditor({ autosaveMs = AUTOSAVE_MS } = {}) {
  const projectId = ref('')
  const project = shallowRef(null)
  const doc = shallowRef(null)          // the whole document (what is saved)
  const revision = ref(0)               // the revision this editor's edits build on
  const revisionId = ref(null)          // its id, which an export names
  const history = reactive(tl.createHistory())
  const scope = ref([])                 // the compounds opened, innermost last
  const selection = ref([])
  const playhead = ref(0)
  const zoom = ref(60)                  // pixels a second on the timeline
  const snapping = ref(true)
  const shortcuts = ref(readShortcuts())
  const tool = ref('select')
  const trimMode = ref('ripple')        // the Trim tool's edge drag: 'ripple' or 'roll'
  const clipboard = shallowRef(null)    // { items: [{ item, trackId, kind }], t0 }
  const playback = reactive({ rate: 0, loop: false, range: null })   // rate: 0 paused, 1 play, 2/4/8 faster, negative backwards
  const edgeLimit = ref(null)           // { id, edge } when the last trim ran out of media (the red edit point)
  const pasteAttributesOpen = ref(false)
  const media = reactive({})            // attachment id → the server's prepared-media view (length, previews, strip)
  const state = reactive({ loading: false, saving: false, dirty: false, error: '', conflict: null, saveError: '' })
  const announcement = ref('')
  let timer = null, saveSeq = 0

  const scopeId = computed(() => scope.value[scope.value.length - 1] || null)
  // What the timeline shows and edits act on: the document, or the compound being edited.
  const view = computed(() => (doc.value ? tl.viewOf(doc.value, scopeId.value) : null))
  const rate = computed(() => doc.value?.rate || 30)
  const total = computed(() => (view.value ? tl.totalMs(view.value) : 0))
  const selected = computed(() => selection.value.map(id => view.value && tl.find(view.value, id)).filter(Boolean))
  const canUndo = computed(() => history.past.length > 0)
  const canRedo = computed(() => history.future.length > 0)
  const magnet = computed(() => !!doc.value?.settings?.magnet)
  const playing = computed(() => playback.rate !== 0)
  const durations = computed(() => Object.fromEntries(Object.entries(media).filter(([, m]) => m?.duration_ms != null).map(([id, m]) => [id, m.duration_ms])))
  const attributeChoices = computed(() => {
    const src = clipboard.value?.items?.[0]
    return src ? tl.attributeGroupsFor(src.item, src.kind).map(k => ({ id: k, label: tl.ATTRIBUTE_GROUPS[k].label })) : []
  })
  const tc = ms => tl.timecode(ms, rate.value)
  const opts = () => ({ durations: durations.value })

  function announce(text) { announcement.value = ''; queueMicrotask(() => { announcement.value = text }) }

  async function load(id) {
    projectId.value = String(id || '')
    state.loading = true; state.error = ''; state.conflict = null; state.saveError = ''
    try {
      const [p, t] = await Promise.all([api.get(`/video/projects/${projectId.value}/`), api.get(`/video/projects/${projectId.value}/timeline/`)])
      project.value = p.data
      revision.value = t.data.revision || 0
      revisionId.value = t.data.revision_id || null
      doc.value = tl.upgrade(t.data.edl) || tl.newDoc(p.data.aspect_ratio || '16:9')
      history.past.length = 0; history.future.length = 0
      scope.value = []; selection.value = []; playhead.value = 0; state.dirty = false
      playback.rate = 0; playback.range = null; edgeLimit.value = null
      await Promise.all([...new Set([...usedMedia(), ...(p.data.assets || []).filter(a => ['video', 'image', 'audio', 'lut'].includes(a.media_type)).map(a => a.attachment_id)])].map(m => loadMedia(m)))
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
  // Every file the timeline names: clips, the picture background, and the person's own LUT files (a `look:` id is
  // a platform look, not a file).
  function usedMedia() {
    const ids = new Set()
    const add = tracks => {
      for (const t of tracks || []) for (const i of t.items) {
        if (i.media) ids.add(i.media)
        for (const e of i.effects || []) { const m = e.kind === 'lut' ? e.params?.media : null; if (typeof m === 'string' && m && !m.startsWith('look:')) ids.add(m) }
      }
    }
    const bg = doc.value?.canvas?.background
    if (bg && typeof bg === 'object' && bg.kind === 'image' && bg.media) ids.add(bg.media)
    add(doc.value?.tracks)
    for (const c of Object.values(doc.value?.compounds || {})) add(c.tracks)
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
  // Every change to the timeline goes through here. `ops` are against `view` (the document, or the compound being
  // edited). The editor rules are applied (magnet, connected clips, a rate change regrids everything); an edit that
  // changes a locked track, or that the server would refuse, is not made and the reason is announced. Otherwise it is
  // recorded for undo and saved shortly after.
  function edit(ops, label) {
    if (!doc.value || !ops?.length || state.conflict) return false
    const before = doc.value
    let all = tl.scopeOps(tl.finish(view.value, ops), scopeId.value)
    let next = tl.applyOps(before, all).doc
    if (next.rate !== before.rate) {
      const g = tl.finish(next, tl.regridOps(next))
      all = [...all, ...g]
      next = tl.applyOps(next, g).doc
    }
    const locked = lockedChange(before, next)
    if (locked) { announce(`${locked} is locked. Unlock it to change it.`); return false }
    const why = tl.problem(next)
    if (why) { announce(why); return false }
    doc.value = tl.commit(history, before, all, label)
    keepValid()
    if (label) announce(label)
    changed()
    // A file the edit brought in (a clip, a picture background, a look file) gets its editor view for the monitor.
    for (const id of usedMedia()) if (!media[id]) loadMedia(id)
    return true
  }
  // The name of a locked track whose items this edit changes, or ''.
  function lockedChange(before, next) {
    const check = (a, b) => {
      for (const t of a?.tracks || []) {
        if (!tl.flag(t, 'lock')) continue
        const u = b?.tracks?.find(x => x.id === t.id)
        if (!u || u.items !== t.items) return tl.trackName(a, t)
      }
      return ''
    }
    return check(before, next) || (scopeId.value ? check(tl.viewOf(before, scopeId.value), tl.viewOf(next, scopeId.value)) : '')
  }
  function keepValid() {
    scope.value = scope.value.filter(id => doc.value.compounds?.[id])
    selection.value = selection.value.filter(id => tl.find(view.value, id))
  }
  function undo() {
    if (!canUndo.value || state.conflict) return
    const r = tl.undo(history, doc.value)
    doc.value = r.doc
    keepValid()
    announce(r.label ? `Undid: ${r.label}` : 'Undid the last edit'); changed()
  }
  function redo() {
    if (!canRedo.value || state.conflict) return
    const r = tl.redo(history, doc.value)
    doc.value = r.doc
    keepValid()
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

  // ── selection ─────────────────────────────────────────────────────────────────────────────────────────────────
  function select(id, { add = false } = {}) {
    if (!id) { selection.value = []; return }
    selection.value = add ? (selection.value.includes(id) ? selection.value.filter(x => x !== id) : [...selection.value, id]) : [id]
  }
  function selectAll() {
    selection.value = view.value ? view.value.tracks.flatMap(t => tl.ordered(t).map(i => i.id)) : []
    announce(`${selection.value.length} item${selection.value.length === 1 ? '' : 's'} selected`)
  }
  // Marquee: the items on the tracks named that overlap [from, to).
  function selectRange({ trackIds = [], from = 0, to = 0 } = {}, { add = false } = {}) {
    const a = Math.min(from, to), b = Math.max(from, to)
    const ids = (view.value?.tracks || []).filter(t => trackIds.includes(t.id))
      .flatMap(t => tl.ordered(t).filter(i => i.start_ms < b && tl.itemEnd(i, rate.value) > a).map(i => i.id))
    selection.value = add ? [...new Set([...selection.value, ...ids])] : ids
    announce(`${selection.value.length} item${selection.value.length === 1 ? '' : 's'} selected`)
    return selection.value
  }
  const timedSelection = () => selected.value.filter(r => tl.isTimed(r.item))

  // ── playhead and playback ─────────────────────────────────────────────────────────────────────────────────────
  function seek(ms) { playhead.value = Math.min(Math.max(0, tl.toFrame(ms, rate.value)), Math.max(total.value, 0)) }
  function stepFrames(n) { seek(tl.frameTime(tl.frameOf(playhead.value, rate.value) + n, rate.value)) }
  function togglePlay() { playback.rate = playback.rate ? 0 : 1; if (!playback.rate) playback.range = null }
  // J, K, L: L plays forward and doubles the speed each press (up to 8x), J the same backwards, K stops.
  function shuttle(key) {
    const k = String(key).toLowerCase()
    if (k === 'k') playback.rate = 0
    else if (k === 'l') playback.rate = playback.rate <= 0 ? 1 : Math.min(playback.rate * 2, SHUTTLE_MAX)
    else if (k === 'j') playback.rate = playback.rate >= 0 ? -1 : Math.max(playback.rate * 2, -SHUTTLE_MAX)
    else return
    announce(playback.rate === 0 ? 'Stopped' : `Playing ${playback.rate < 0 ? 'backwards' : 'forwards'} at ${Math.abs(playback.rate)}x`)
  }
  // Play the selected items' time (looping when loop is on).
  function playSelection() {
    const rows = timedSelection()
    if (!rows.length) { announce('Select a clip to play its part of the timeline.'); return false }
    const a = Math.min(...rows.map(r => r.item.start_ms)), b = Math.max(...rows.map(r => tl.itemEnd(r.item, rate.value)))
    playback.range = [a, b]
    seek(a)
    playback.rate = 1
    announce(`Playing ${tc(a)} to ${tc(b)}`)
    return true
  }
  function toggleLoop() { playback.loop = !playback.loop; announce(playback.loop ? 'Loop on' : 'Loop off') }
  // The monitor reports the time it has played to: the range (or the timeline) ends there, or starts again on loop.
  function tick(ms) {
    const a = playback.range ? playback.range[0] : 0, b = playback.range ? playback.range[1] : total.value
    if (playback.rate > 0 && ms >= b) {
      if (playback.loop) { playhead.value = a; return }
      playhead.value = b; playback.rate = 0; playback.range = null; return
    }
    if (playback.rate < 0 && ms <= a) {
      if (playback.loop) { playhead.value = b; return }
      playhead.value = a; playback.rate = 0; playback.range = null; return
    }
    playhead.value = Math.min(Math.max(0, Math.round(ms)), Math.max(total.value, 0))
  }
  // The previous or next edit point (an item's start or end, a marker).
  function jumpEdit(dir) {
    const pts = tl.snapPoints(view.value).concat(total.value)
    const p = dir > 0 ? pts.find(x => x > playhead.value) : [...pts].reverse().find(x => x < playhead.value)
    if (p != null) seek(p)
  }
  // The previous or next keyframe of the selected item.
  function jumpKeyframe(dir) {
    const r = timedSelection()[0]
    if (!r) return
    const times = tl.keyframeTimes(r.item).map(t => r.item.start_ms + t)
    const p = dir > 0 ? times.find(x => x > playhead.value) : [...times].reverse().find(x => x < playhead.value)
    if (p != null) { seek(p); announce(`Keyframe at ${tc(p)}`) } else announce(dir > 0 ? 'No keyframe after the playhead.' : 'No keyframe before the playhead.')
  }
  function zoomBy(f) { zoom.value = Math.min(Math.max(zoom.value * f, 4), 400) }

  // ── edits by name (what the toolbar, the keyboard and the pointer do) ─────────────────────────────────────────
  function setTool(id) {
    if (!TOOLS.some(t => t.id === id)) return
    tool.value = id
    announce(`${TOOLS.find(t => t.id === id).label} tool`)
  }
  function setTrimMode(mode) { if (mode === 'ripple' || mode === 'roll') { trimMode.value = mode; announce(mode === 'roll' ? 'Trim rolls the edit point' : 'Trim ripples') } }
  function setMagnet(on) { return edit(tl.setMagnetOps(doc.value, on), on ? 'Magnet on: the main track closes up' : 'Magnet off') }
  function moveItem({ id, start, track = null }) { return edit(tl.moveOps(view.value, id, start, track), `Moved to ${tc(start)}`) }
  // Trim an edge. mode: 'plain' (the Select tool), 'ripple' or 'roll' (the Trim tool); default from the tool.
  function trimItem({ id, edge, at, mode = null }) {
    const m = mode || (tool.value === 'trim' ? trimMode.value : 'plain')
    const v = view.value
    if (m === 'roll') {
      const leftId = edge === 'end' ? id : tl.neighbourBefore(v, id)?.id
      if (leftId) return edit(tl.rollOps(v, leftId, at, opts()), `Rolled the edit point to ${tc(at)}`)
    }
    const r = tl.trimRange(v, id, edge, opts())
    const ran = edge === 'start' ? (r.mediaMin && at < r.min) : (r.mediaMax && at > r.max)
    edgeLimit.value = ran ? { id, edge } : null
    const ok = edit(tl.trimOps(v, id, edge, at, { ...opts(), ripple: m === 'ripple' }), `Trimmed the ${edge} to ${tc(Math.min(Math.max(at, r.min), r.max))}${ran ? ', the end of the file' : ''}`)
    if (!ok && ran) announce('The file ends here.')
    return ok
  }
  function slip(id, delta) { return edit(tl.slipOps(view.value, id, delta, opts()), 'Slipped') }
  function slide(id, delta) { return edit(tl.slideOps(view.value, id, delta, opts()), 'Slid') }
  // Alt+arrows on an item: a move, or with the Slip or Slide tool, a slip or slide.
  function nudge(id, by) {
    const f = tl.find(view.value, id)
    if (!f || !tl.isTimed(f.item)) return false
    if (tool.value === 'slip') return slip(id, -by)
    if (tool.value === 'slide') return slide(id, by)
    return moveItem({ id, start: f.item.start_ms + by })
  }
  const SPLIT_REASON = 'Move the playhead inside a clip to split it.'
  // Ctrl+B: the selected items under the playhead, or the main track's clip there.
  function splitAtPlayhead() {
    const at = playhead.value, v = view.value
    const inside = r => tl.isTimed(r.item) && r.item.start_ms < at && at < tl.itemEnd(r.item, rate.value) && !tl.flag(r.track, 'lock')
    let ids = timedSelection().filter(inside).map(r => r.item.id)
    if (!ids.length && !selection.value.length) {
      const main = v.tracks.find(tl.isMain) || v.tracks.find(t => t.kind === 'video')
      const under = main && tl.ordered(main).find(i => inside({ item: i, track: main }))
      if (under) ids = [under.id]
    }
    if (!ids.length) { announce(SPLIT_REASON); return false }
    let d = v
    const ops = []
    for (const id of ids) { const o = tl.splitOps(d, id, at); ops.push(...o); d = tl.applyOps(d, o).doc }
    return edit(ops, `Split at ${tc(at)}`)
  }
  function splitAt(id, at) { return edit(tl.splitOps(view.value, id, at), `Split at ${tc(at)}`) }
  // Ctrl+Shift+B: every unlocked track at the playhead.
  function blade(at = playhead.value) {
    const ok = edit(tl.bladeOps(view.value, at), `Split every track at ${tc(at)}`)
    if (!ok) announce('Nothing is under the playhead to split.')
    return ok
  }
  // Q and W: trim the start or the end of the clip under the playhead to the playhead.
  function trimToPlayhead(edge) {
    const at = playhead.value, v = view.value
    const inside = r => tl.isTimed(r.item) && r.item.start_ms < at && at < tl.itemEnd(r.item, rate.value)
    let row = timedSelection().find(inside)
    if (!row) {
      const main = v.tracks.find(tl.isMain) || v.tracks.find(t => t.kind === 'video')
      const under = main && tl.ordered(main).find(i => inside({ item: i }))
      row = under && { item: under }
    }
    if (!row) { announce('Move the playhead inside a clip to trim it.'); return false }
    const ok = edit(tl.trimOps(v, row.item.id, edge, at, opts()), edge === 'start' ? 'Trimmed the start to the playhead' : 'Trimmed the end to the playhead')
    if (ok && edge === 'start') { const f = tl.find(view.value, row.item.id); if (f) seek(f.item.start_ms) }
    return ok
  }
  function removeSelected(ripple = false) {
    const ids = selection.value.filter(id => tl.find(view.value, id))
    if (!ids.length) return false
    const ok = edit(tl.deleteOps(view.value, ids, { ripple }), ripple ? 'Deleted and closed the gap' : 'Deleted')
    if (ok) selection.value = []
    return ok
  }
  function duplicateSelected() {
    const id = timedSelection()[0]?.item.id
    return id ? edit(tl.duplicateOps(view.value, id), 'Duplicated') : false
  }
  // Insert a file from the project (the bin): 'append' (end of the main track), 'insert' or 'overwrite' at the
  // playhead on the main track (or the track named), 'connect' (on the first free track above, connected to the main
  // clip there), 'replace' (the selected clip).
  function insertMedia(file, mode = 'append', { trackId = null } = {}) {
    if (!file?.attachment_id) return false
    const v = view.value, kind = file.media_type === 'audio' ? 'audio' : 'video'
    const name = file.name || 'The file'
    if (mode === 'replace') {
      const r = timedSelection()[0]
      if (!r) { announce('Select the clip to replace.'); return false }
      const why = tl.replaceProblem(v, r.item.id, file)
      if (why) { announce(why); return false }
      return edit(tl.replaceOps(v, r.item.id, file.attachment_id, file), `Replaced with ${name}`)
    }
    let track = trackId ? v.tracks.find(t => t.id === trackId) : null
    if (!track) track = kind === 'audio' ? v.tracks.find(t => t.kind === 'audio' && !tl.flag(t, 'lock')) : (mode === 'connect' ? null : v.tracks.find(tl.isMain) || v.tracks.find(t => t.kind === 'video'))
    const template = tl.newClip(v, kind, file.attachment_id, file)
    const len = tl.clipLength(template, rate.value), at = playhead.value
    if (mode === 'connect' || (!track && kind === 'video')) {
      const free = t => t.kind === kind && !tl.isMain(t) && !tl.flag(t, 'lock') && !tl.ordered(t).some(i => i.start_ms < at + len && tl.itemEnd(i, rate.value) > at)
      let ops = []
      let target = v.tracks.find(free)
      let d = v
      if (!target) { ops = tl.addTrackOps(v, kind); d = tl.applyOps(v, ops).doc; target = kind === 'video' ? d.tracks[d.tracks.map(t => t.kind).lastIndexOf('video')] : d.tracks[d.tracks.length - 1] }
      const place = tl.overwriteOps(d, target.id, template, at)
      d = tl.applyOps(d, place).doc
      const placedId = d.tracks.find(t => t.id === target.id).items.at(-1).id
      const link = tl.connectOps(d, placedId)
      return edit([...ops, ...place, ...link], `${name} connected at ${tc(at)}`)
    }
    if (!track) { announce('Add a track for this file first.'); return false }
    if (mode === 'insert') return edit(tl.insertOps(v, track.id, template, at), `${name} inserted at ${tc(at)}`)
    if (mode === 'overwrite') return edit(tl.overwriteOps(v, track.id, template, at), `${name} placed over ${tc(at)}`)
    return edit(tl.addClipOps(v, track.id, file.attachment_id, { info: file }), `${name} added at the end`)
  }
  // A drop from the bin (ClipMediaBin's drag, `application/x-aadml-editor`: {kind: media|text|effect|transition, id})
  // on the timeline: a file at the drop time on that track (inserted on the main track, placed over what is there on
  // any other), a text template on a text track at that time, an effect or a transition onto the clip it lands on.
  function dropFromBin(payload, { trackId = null, at = null, itemId = null } = {}) {
    const v = view.value
    if (!v || !payload || typeof payload !== 'object') return false
    const track = trackId ? v.tracks.find(t => t.id === trackId) : null
    const target = itemId ? tl.find(v, itemId) : null
    if (track && tl.flag(track, 'lock')) { announce(`${tl.trackName(v, track)} is locked. Unlock it to change it.`); return false }
    if (payload.kind === 'media') {
      const a = (project.value?.assets || []).find(x => x.attachment_id === payload.id)
      const m = media[payload.id] || {}
      if (!a || m.state !== 'ready') { announce('That file is not ready yet.'); return false }
      const file = { ...a, ...m, attachment_id: payload.id, media_type: m.media_type || a.media_type }
      const sound = file.media_type === 'audio'
      if (track && (track.kind === 'text' || (track.kind === 'audio') !== sound)) { announce(sound ? 'Drop sound on a sound track.' : 'Drop a video or picture on a video track.'); return false }
      if (at != null) seek(at)
      return insertMedia(file, track && tl.isMain(track) ? 'insert' : 'overwrite', { trackId: track?.id || null })
    }
    if (payload.kind === 'text') {
      const t = [...BUILT_IN_TEMPLATES, ...useTextTemplates().state.saved].find(x => x.id === payload.id)
      if (!t) return false
      const text = track?.kind === 'text' ? track : v.tracks.find(x => x.kind === 'text' && !x.captions && !tl.flag(x, 'lock'))
      if (!text) { announce('Drop a text template on a text track.'); return false }
      const start = at != null ? tl.toFrame(at, rate.value) : playhead.value
      const add = tl.addTextOps(v, text.id, { start, text: t.text })
      if (!add.length) { announce('There is no room for the text there.'); return false }
      const d = tl.applyOps(v, add).doc, row = d.tracks.find(x => x.id === text.id), placed = row.items.find(i => !tl.find(v, i.id))
      const ok = edit([...add, ...(placed ? tl.setOps(d, placed.id, applyTemplateChanges(t, { keepText: false })) : [])], `${t.name} added at ${tc(start)}`)
      if (ok && placed) select(placed.id)
      return ok
    }
    if (payload.kind === 'effect' || payload.kind === 'transition') {
      if (!target || target.item.type !== 'clip' || target.track.kind !== 'video') { announce('Drop it on a video clip or picture.'); return false }
      if (payload.kind === 'transition') {
        const ok = edit(tl.addTransitionOps(v, target.item.id, payload.id, 500), 'Transition added')
        if (!ok) announce('A transition joins a clip to the next one, which must start where it ends.')
        return ok
      }
      const reg = registry()
      if (effectPaid(reg, payload.id)) { select(target.item.id); announce('Background removal shows its price in Settings, Effects, before it runs.'); return false }
      const ok = edit(tl.addEffectOps(v, target.item.id, payload.id, { registry: reg }), `${reg?.effects?.[payload.id]?.label || payload.id} added`)
      if (!ok) announce(`That effect could not be added: a clip holds at most ${tl.LIMITS.effects} effects.`)
      else select(target.item.id)
      return ok
    }
    return false
  }
  // Markers.
  function addMarker(fields = {}) {
    const at = fields.at_ms ?? playhead.value
    const ops = tl.markerOps(doc.value, 'add', { ...fields, at_ms: at })
    if (!ops.length) { announce(`A timeline holds at most ${tl.LIMITS.markers} markers.`); return null }
    if (!edit(ops, `Marker added at ${tc(at)}`)) return null
    return ops[0].value?.id || ops[0].value?.[0]?.id || null
  }
  function setMarker(id, changes, label = 'Marker changed') { return edit(tl.markerOps(doc.value, 'set', { id, changes }), label) }
  function removeMarker(id) { return edit(tl.markerOps(doc.value, 'remove', { id }), 'Marker removed') }
  // Connected clips.
  function connect(ids = selection.value) {
    let d = view.value
    const ops = []
    for (const id of ids) { const o = tl.connectOps(d, id); ops.push(...o); d = tl.applyOps(d, o).doc }
    if (!ops.length) { announce('Only a clip, a sound or a text off the main track can be connected to it.'); return false }
    return edit(ops, 'Connected to the main track')
  }
  function detach(ids = selection.value) {
    let d = view.value
    const ops = []
    for (const id of ids) { const o = tl.detachOps(d, id); ops.push(...o); d = tl.applyOps(d, o).doc }
    return ops.length ? edit(ops, 'Detached') : false
  }
  function splitAudio(id = timedSelection()[0]?.item.id) {
    const f = id && tl.find(view.value, id)
    if (!f) { announce('Select a video clip to split its sound.'); return false }
    const m = media[f.item.media]
    if (m && m.has_audio === false) { announce('This clip has no sound.'); return false }
    const ok = edit(tl.splitAudioOps(view.value, id), 'Sound split from the video')
    if (!ok && f.item.muted) announce('This clip is muted; its sound is already apart or off.')
    return ok
  }
  // Compound clips.
  function makeCompound(name = '') {
    const ids = timedSelection().map(r => r.item.id)
    const why = tl.compoundProblem(view.value, ids)
    if (why) { announce(why); return false }
    const ok = edit(tl.compoundOps(view.value, 'make', { ids, name }), 'Compound clip made')
    if (ok) {
      const made = view.value.tracks.flatMap(t => t.items).filter(i => i.compound).pop()
      if (made) selection.value = [made.id]
    }
    return ok
  }
  function openCompound(clipId) {
    const f = tl.find(view.value, clipId)
    if (!f?.item.compound || !doc.value.compounds?.[f.item.compound]) return false
    scope.value = [...scope.value, f.item.compound]
    selection.value = []
    playhead.value = 0
    announce(`Editing ${tl.compoundName(doc.value, f.item.compound)}. Escape goes back.`)
    return true
  }
  function closeCompound() {
    if (!scope.value.length) return false
    scope.value = scope.value.slice(0, -1)
    selection.value = []
    announce(scopeId.value ? `Editing ${tl.compoundName(doc.value, scopeId.value)}` : 'Back on the main timeline')
    return true
  }
  function flattenCompound(clipId = timedSelection().find(r => r.item.compound)?.item.id) {
    if (!clipId) { announce('Select a compound clip to break it apart.'); return false }
    return edit(tl.compoundOps(view.value, 'flatten', { id: clipId }), 'Compound clip broken apart')
  }
  // Track controls.
  function setTrackFlags(trackId, flags, label = null) {
    const t = view.value.tracks.find(x => x.id === trackId)
    if (!t) return false
    const name = tl.trackName(view.value, t)
    const said = label || Object.entries(flags).map(([k, v]) => ({ lock: v ? 'locked' : 'unlocked', mute: v ? 'muted' : 'unmuted', hide: v ? 'hidden' : 'shown',
      solo: v ? 'soloed' : 'not soloed', main: 'is now the main track', height: `height ${v} pixels`, name: `renamed to ${v}`, role: `role ${v}` })[k]).filter(Boolean).join(', ')
    return edit(tl.setTrackFlagsOps(view.value, trackId, flags), `${name} ${said}`)
  }
  // Clipboard: copy, cut, paste at the playhead, paste attributes.
  function copy() {
    const rows = timedSelection()
    if (!rows.length) { announce('Select something to copy.'); return false }
    const t0 = Math.min(...rows.map(r => r.item.start_ms))
    clipboard.value = { t0, items: rows.map(r => ({ item: clone(r.item), trackId: r.track.id, kind: r.track.kind, main: tl.isMain(r.track) })) }
    announce(`Copied ${rows.length} item${rows.length === 1 ? '' : 's'}`)
    return true
  }
  function cut() {
    if (!copy()) return false
    const ok = edit(tl.deleteOps(view.value, selection.value), 'Cut')
    if (ok) selection.value = []
    return ok
  }
  function paste() {
    const cb = clipboard.value
    if (!cb?.items.length) { announce('Copy something first.'); return false }
    const at = playhead.value
    let d = view.value
    const ops = [], pasted = []
    for (const c of [...cb.items].sort((a, b) => a.item.start_ms - b.item.start_ms)) {
      const when = at + c.item.start_ms - cb.t0
      let track = d.tracks.find(t => t.id === c.trackId && t.kind === c.kind && !tl.flag(t, 'lock')) || d.tracks.find(t => t.kind === c.kind && !tl.flag(t, 'lock') && tl.isMain(t) === c.main) || d.tracks.find(t => t.kind === c.kind && !tl.flag(t, 'lock'))
      const len = c.item.type === 'text' ? c.item.end_ms - c.item.start_ms : tl.clipLength({ ...c.item, start_ms: 0 }, rate.value)
      const busy = t => tl.ordered(t).some(i => i.start_ms < when + len && tl.itemEnd(i, rate.value) > when)
      // With the magnet on, a paste on the main track is an insert; anywhere else it needs free room, else another track.
      const magnetic = t => tl.isMain(t) && tl.magnetOn(d)
      if (!track || (!magnetic(track) && busy(track))) {
        const free = d.tracks.find(t => t.kind === c.kind && !magnetic(t) && !tl.flag(t, 'lock') && !busy(t))
        if (free) track = free
        else { const o = tl.addTrackOps(d, c.kind); ops.push(...o); d = tl.applyOps(d, o).doc; track = c.kind === 'video' ? d.tracks[d.tracks.map(t => t.kind).lastIndexOf('video')] : d.tracks[d.tracks.length - 1] }
      }
      const o = magnetic(track) ? tl.insertOps(d, track.id, c.item, when) : tl.overwriteOps(d, track.id, c.item, when)
      if (!o.length) continue
      const had = new Set(d.tracks.flatMap(x => x.items.map(i => i.id)))
      ops.push(...o); d = tl.applyOps(d, o).doc
      // The pasted item is the new one on that track that starts at the paste time (a split may make another new one).
      const fresh = d.tracks.find(x => x.id === track.id).items.filter(i => tl.isTimed(i) && !had.has(i.id))
      const placed = fresh.find(i => i.start_ms === tl.toFrame(when, rate.value) && i.media === c.item.media && i.compound === c.item.compound) || fresh.at(-1)
      if (placed) {
        pasted.push(placed.id)
        if (c.item.anchor) { const link = tl.connectOps(d, placed.id); ops.push(...link); d = tl.applyOps(d, link).doc }
      }
    }
    if (!ops.length || !edit(ops, `Pasted ${pasted.length} item${pasted.length === 1 ? '' : 's'} at ${tc(at)}`)) return false
    selection.value = pasted.filter(id => tl.find(view.value, id))
    return true
  }
  function openPasteAttributes() {
    if (!clipboard.value?.items.length) { announce('Copy a clip first; its attributes can then be pasted onto others.'); return false }
    if (!timedSelection().length) { announce('Select the clips to paste onto.'); return false }
    pasteAttributesOpen.value = true
    return true
  }
  function pasteAttributes(which, targets = selection.value) {
    const src = clipboard.value?.items?.[0]
    pasteAttributesOpen.value = false
    if (!src || !which?.length) return false
    const ok = edit(tl.pasteAttributesFromOps(view.value, src.item, src.kind, targets, which), `Pasted ${which.map(k => tl.ATTRIBUTE_GROUPS[k]?.label.toLowerCase()).join(', ')}`)
    if (!ok) announce('Those attributes do not apply to the selected items.')
    return ok
  }

  // ── keyboard (plan P14, WCAG 2.1.4) ───────────────────────────────────────────────────────────────────────────
  // CapCut-style shortcuts, for the timeline to call while it has focus. Never while typing in a field. Single-key
  // shortcuts follow the setting; Ctrl/Cmd shortcuts always work. Returns true when the key was used.
  function handleKey(e) {
    if (!doc.value || e.defaultPrevented) return false
    const t = e.target, tag = t?.tagName
    if ((['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !(tag === 'INPUT' && t.type === 'range')) || t?.isContentEditable) return false
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
    const onItem = !!t?.closest?.('.ct-item'), onControl = !!t?.closest?.('[role="toolbar"],[role="slider"],input,button,[role="dialog"],.ct-marker')
    const done = fn => { e.preventDefault(); fn(); return true }
    if (mod && e.altKey) return k === 'v' ? done(openPasteAttributes) : false
    if (mod) {
      if (k === 'z') return done(() => (e.shiftKey ? redo() : undo()))
      if (k === 'y') return done(redo)
      if (k === 'b') return done(() => (e.shiftKey ? blade() : splitAtPlayhead()))
      if (k === 'c') return done(copy)
      if (k === 'x') return done(cut)
      if (k === 'v') return done(() => (e.shiftKey ? openPasteAttributes() : paste()))
      if (k === 'a') return done(selectAll)
      if (k === 'l') return done(toggleLoop)
      if (k === 'g') return done(() => (e.shiftKey ? flattenCompound() : makeCompound()))
      return false
    }
    if (e.altKey) return false
    if (k === 'Escape') {
      if (pasteAttributesOpen.value) return done(() => { pasteAttributesOpen.value = false })
      if (scopeId.value) return done(closeCompound)
      if (selection.value.length) return done(() => select(null))
      return false
    }
    if (!shortcuts.value) return false
    const free = !onItem && !onControl
    switch (k) {
      case ' ': return onItem || tag === 'BUTTON' ? false : done(togglePlay)
      case 'j': case 'k': case 'l': return done(() => shuttle(k))
      case 'q': return done(() => trimToPlayhead('start'))
      case 'w': return done(() => trimToPlayhead('end'))
      case 'm': return done(() => addMarker())
      case 's': return done(splitAtPlayhead)
      case 'd': return done(duplicateSelected)
      case 'Delete': case 'Backspace': return done(() => removeSelected(e.shiftKey))
      case 'a': case 'b': case 't': case 'y': case 'u': return done(() => setTool(TOOL_KEYS[k]))
      case 'n': return done(() => { snapping.value = !snapping.value; announce(snapping.value ? 'Snapping on' : 'Snapping off') })
      case '+': case '=': return done(() => zoomBy(1.5))
      case '-': return done(() => zoomBy(1 / 1.5))
      case ',': return done(() => stepFrames(-1))
      case '.': return done(() => stepFrames(1))
      case '<': return done(() => stepFrames(-10))
      case '>': return done(() => stepFrames(10))
      case '[': return done(() => jumpKeyframe(-1))
      case ']': return done(() => jumpKeyframe(1))
      case '/': return done(playSelection)
      case 'ArrowLeft': case 'ArrowRight': return free ? done(() => stepFrames((k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? rate.value : 1))) : false
      case 'ArrowUp': case 'ArrowDown': return free ? done(() => jumpEdit(k === 'ArrowDown' ? 1 : -1)) : false
      case 'Home': return free ? done(() => seek(0)) : false
      case 'End': return free ? done(() => seek(total.value)) : false
      default: return false
    }
  }
  function dispose() { clearTimeout(timer) }

  return { projectId, project, doc, view, scope, scopeId, revision, revisionId, history, selection, selected, playhead, zoom, snapping, shortcuts,
    tool, trimMode, magnet, clipboard, attributeChoices, pasteAttributesOpen, playback, playing, edgeLimit, media, durations, state,
    announcement, rate, total, canUndo, canRedo,
    load, loadMedia, refreshProject, edit, undo, redo, save, reloadLatest, setShortcuts, select, selectAll, selectRange, seek, stepFrames,
    togglePlay, shuttle, playSelection, toggleLoop, tick, jumpEdit, jumpKeyframe, zoomBy, announce, dispose,
    setTool, setTrimMode, setMagnet, moveItem, trimItem, slip, slide, nudge, splitAtPlayhead, splitAt, blade, trimToPlayhead, removeSelected,
    duplicateSelected, insertMedia, dropFromBin, addMarker, setMarker, removeMarker, connect, detach, splitAudio, makeCompound, openCompound, closeCompound,
    flattenCompound, setTrackFlags, copy, cut, paste, openPasteAttributes, pasteAttributes, handleKey }
}
