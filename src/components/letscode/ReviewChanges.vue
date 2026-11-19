<!--
  ReviewChanges: the editor's Review tab (ADM-1314, ADM-1329). It shows what the Coding Agent changed since one of the
  person's messages (the turn that message started, and later edits too), one file and one change at a time, beside
  the editor's own diff (Monaco's DiffEditor, read-only). Each change can be kept (marked reviewed, remembered per
  message in this browser) or undone (the file is written with that change put back, naming the version read, so a
  file that changed meanwhile is never overwritten). A comment can be left on any line; the comments go to the chat
  that made the change as ONE message. No native dialogs: useConfirm and useNotify only.
-->
<template>
  <div class="rv" data-test="review" @keydown="onKeydown">
    <div v-if="loading && !files.length" class="rv-state" role="status" aria-live="polite">
      <Icon icon="lucide:loader-2" class="rv-state-ic spin" aria-hidden="true" />
      <p>{{ waiting ? `The project's sandbox is starting. Trying again in ${waiting}s…` : 'Loading the changes…' }}</p>
    </div>
    <div v-else-if="error && !files.length" class="rv-state" :role="error.kind === 'none' ? 'status' : 'alert'" data-test="review-error">
      <Icon :icon="error.kind === 'none' ? 'lucide:check-circle-2' : 'lucide:file-warning'" class="rv-state-ic" aria-hidden="true" />
      <p>{{ error.text }}</p>
      <button v-if="error.kind !== 'none'" type="button" class="rv-btn" @click="load()">
        <Icon icon="lucide:refresh-cw" aria-hidden="true" /> Try again
      </button>
    </div>
    <template v-else>
      <!-- The changed files: status, path, and how many changes in each are still open. -->
      <aside class="rv-files" aria-label="Changed files">
        <div class="rv-files-head">
          <span class="rv-files-title">{{ files.length }} {{ files.length === 1 ? 'file' : 'files' }} changed</span>
          <button type="button" class="rv-icon" title="Load the changes again" aria-label="Load the changes again"
                  :disabled="loading || !!busy" @click="load({ keep: selectedPath })">
            <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" aria-hidden="true" />
          </button>
        </div>
        <p v-if="allReviewed" class="rv-done" role="status" data-test="review-all-done">
          <Icon icon="lucide:check-check" aria-hidden="true" /> All changes reviewed
        </p>
        <ul class="rv-list">
          <li v-for="f in files" :key="f.path">
            <button type="button" class="rv-file" :class="{ active: f.path === selectedPath }" data-test="review-file"
                    :aria-current="f.path === selectedPath ? 'true' : undefined" :title="f.path" @click="select(f.path)">
              <span class="rv-badge" :class="f.status" :aria-label="statusWord(f.status)">{{ statusLetter(f.status) }}</span>
              <span class="rv-path" translate="no">{{ f.path }}</span>
              <span v-if="openCount(f)" class="rv-count" :aria-label="`${openCount(f)} open ${openCount(f) === 1 ? 'change' : 'changes'}`">{{ openCount(f) }}</span>
              <Icon v-else icon="lucide:check" class="rv-ok" role="img" aria-label="Reviewed" />
            </button>
          </li>
        </ul>
        <div class="rv-files-foot">
          <button type="button" class="rv-btn" :disabled="allReviewed || !!busy" data-test="review-keep-all" @click="keepAll">
            <Icon icon="lucide:check-check" aria-hidden="true" /> Keep all
          </button>
        </div>
      </aside>

      <section class="rv-main" :aria-label="selected ? `Changes in ${selected.path}` : 'Changes'">
        <template v-if="selected">
          <div class="rv-bar">
            <div class="rv-bar-file">
              <span class="rv-badge" :class="selected.status" :aria-label="statusWord(selected.status)">{{ statusLetter(selected.status) }}</span>
              <span class="rv-path" translate="no" :title="selected.path">{{ selected.path }}</span>
            </div>
            <div class="rv-bar-actions">
              <button v-if="hasText(selected)" type="button" class="rv-btn" :aria-pressed="sideBySide ? 'true' : 'false'"
                      :title="sideBySide ? 'Show the changes inline' : 'Show the changes side by side'" data-test="review-layout"
                      @click="toggleLayout">
                <Icon :icon="sideBySide ? 'lucide:rows-2' : 'lucide:columns-2'" aria-hidden="true" />
                {{ sideBySide ? 'Inline' : 'Side by side' }}
              </button>
              <button v-if="selected.status !== 'deleted'" type="button" class="rv-btn" data-test="review-open-file"
                      @click="emit('open-file', selected.path)">
                <Icon icon="lucide:file-code" aria-hidden="true" /> Open file
              </button>
              <button type="button" class="rv-btn" :disabled="fileReviewed(selected) || !!busy" data-test="review-keep-file" @click="keepFile(selected)">
                <Icon icon="lucide:check" aria-hidden="true" /> Keep file
              </button>
              <button v-if="canUndoFile(selected)" type="button" class="rv-btn danger" :disabled="!!busy" data-test="review-undo-file" @click="undoFile(selected)">
                <Icon icon="lucide:undo-2" aria-hidden="true" /> Undo file
              </button>
            </div>
          </div>

          <!-- One change at a time: where it is, keep it, undo it, or comment on a line. -->
          <div v-if="hasText(selected)" class="rv-bar rv-hunkbar" data-test="review-hunkbar">
            <span class="rv-hunk-label" role="status" aria-live="polite" data-test="review-hunk-label">
              <template v-if="hunks.length">
                Change {{ hunkIndex + 1 }} of {{ hunks.length }}<span v-if="currentKept" class="rv-kept"> · Kept</span>
              </template>
              <template v-else>No changes left in this file.</template>
            </span>
            <div class="rv-bar-actions">
              <button type="button" class="rv-icon" aria-label="Previous change" title="Previous change"
                      :disabled="hunks.length < 2" data-test="review-prev" @click="go(-1)">
                <Icon icon="lucide:chevron-up" aria-hidden="true" />
              </button>
              <button type="button" class="rv-icon" aria-label="Next change" title="Next change"
                      :disabled="hunks.length < 2" data-test="review-next" @click="go(1)">
                <Icon icon="lucide:chevron-down" aria-hidden="true" />
              </button>
              <button type="button" class="rv-btn" :disabled="!hunks.length || currentKept || !!busy" data-test="review-keep" @click="keepHunk">
                <Icon icon="lucide:check" aria-hidden="true" /> Keep
              </button>
              <button type="button" class="rv-btn danger" :disabled="!hunks.length || !!busy" data-test="review-undo" @click="undoHunk">
                <Icon icon="lucide:undo-2" aria-hidden="true" /> Undo
              </button>
              <button type="button" class="rv-btn" :disabled="!!draft" title="Comment on the line the cursor is on (Ctrl+Alt+M)"
                      aria-keyshortcuts="Control+Alt+M" data-test="review-comment" @click="startComment()">
                <Icon icon="lucide:message-square-plus" aria-hidden="true" /> Comment on line
              </button>
            </div>
          </div>

          <!-- The comment being written: in the page, never a browser prompt. -->
          <form v-if="draft" class="rv-draft" data-test="review-draft" @submit.prevent="addDraft">
            <label class="rv-draft-label" :for="draftId">Comment on <span translate="no">{{ draft.path }}:{{ draft.line }}</span></label>
            <pre v-if="draft.snippet" class="rv-snippet" translate="no">{{ draft.snippet }}</pre>
            <textarea :id="draftId" ref="draftEl" v-model="draft.text" class="rv-input" rows="3"
                      placeholder="What should the Coding Agent change here?" @keydown="onDraftKey"></textarea>
            <p v-if="draft.error" class="rv-err" role="alert">{{ draft.error }}</p>
            <div class="rv-draft-actions">
              <button type="submit" class="rv-btn primary" data-test="review-draft-add">Add comment</button>
              <button type="button" class="rv-btn" @click="draft = null">Cancel</button>
            </div>
          </form>

          <div class="rv-diff">
            <div v-if="selected.redacted" class="rv-state" role="status" data-test="review-redacted">
              <Icon icon="lucide:lock" class="rv-state-ic" aria-hidden="true" />
              <p>This file holds secrets, so its values are not shown.</p>
            </div>
            <div v-else-if="selected.binary" class="rv-state" role="status" data-test="review-binary">
              <Icon icon="lucide:file-diff" class="rv-state-ic" aria-hidden="true" />
              <p>Binary file. There is no text to compare.</p>
            </div>
            <component
              :is="diffEditor"
              v-else-if="diffEditor"
              :value="selected.after ?? ''"
              :original="selected.before ?? ''"
              :language="language"
              :theme="theme"
              :options="options"
              class="rv-monaco"
              @editorDidMount="onDiffMount"
            />
          </div>
        </template>
        <div v-else class="rv-state"><p>Pick a file to see its changes.</p></div>

        <!-- ADM-1329: the comments, until they are sent to the chat that made the change. -->
        <div v-if="comments.length" class="rv-tray" data-test="review-tray">
          <div class="rv-tray-head">
            <span class="rv-tray-title">{{ comments.length }} {{ comments.length === 1 ? 'comment' : 'comments' }}</span>
            <button type="button" class="rv-btn primary" :disabled="sending || !!editingId" data-test="review-send" @click="sendComments">
              <Icon :icon="sending ? 'lucide:loader-2' : 'lucide:send'" :class="{ spin: sending }" aria-hidden="true" />
              Send to agent ({{ comments.length }})
            </button>
          </div>
          <ul class="rv-tray-list">
            <li v-for="c in comments" :key="c.id" class="rv-comment" data-test="review-tray-item">
              <div class="rv-comment-head">
                <button type="button" class="rv-where" translate="no" :title="`Show ${c.path}:${c.line}`" @click="showComment(c)">{{ c.path }}:{{ c.line }}</button>
                <div class="rv-bar-actions">
                  <button v-if="editingId !== c.id" type="button" class="rv-icon" :aria-label="`Edit the comment on ${c.path}:${c.line}`" title="Edit"
                          data-test="review-tray-edit" @click="startEdit(c)">
                    <Icon icon="lucide:pencil" aria-hidden="true" />
                  </button>
                  <button type="button" class="rv-icon" :aria-label="`Remove the comment on ${c.path}:${c.line}`" title="Remove"
                          data-test="review-tray-remove" @click="removeComment(c)">
                    <Icon icon="lucide:trash-2" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <pre v-if="c.snippet" class="rv-snippet" translate="no">{{ c.snippet }}</pre>
              <form v-if="editingId === c.id" class="rv-edit" @submit.prevent="saveEdit(c)">
                <label class="sr-only" :for="`rv-edit-${c.id}`">Edit the comment on {{ c.path }}:{{ c.line }}</label>
                <textarea :id="`rv-edit-${c.id}`" v-model="editText" class="rv-input" rows="3" data-test="review-tray-input"
                          @keydown.esc.prevent="editingId = null"></textarea>
                <p v-if="editError" class="rv-err" role="alert">{{ editError }}</p>
                <div class="rv-draft-actions">
                  <button type="submit" class="rv-btn primary" data-test="review-tray-save">Save</button>
                  <button type="button" class="rv-btn" @click="editingId = null">Cancel</button>
                </div>
              </form>
              <p v-else class="rv-comment-text">{{ c.text }}</p>
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { whileSandboxStarts } from '@/utils/sandboxStarting'
import { languageFor } from '@/utils/editorLanguage'
import { diffLines, fromMonaco, revertHunk, hunkKey, fileKey, snippetAround, reviewMessage, splitLines } from '@/utils/reviewHunks'

const props = defineProps({
  systemId: { type: Number, required: true },
  repoId: { type: Number, required: true },
  // The person's message whose turn made the change ("since this message": later edits are in it too).
  messageId: { type: [String, Number], required: true },
  // The chat that message is in: the comments go there.
  conversationId: { type: [String, Number], default: null },
  // The editor's lazily loaded DiffEditor and its options (CodeBrowser's own, so both diffs look the same).
  diffEditor: { type: [Object, Function], default: null },
  diffOptions: { type: Object, default: () => ({}) },
  theme: { type: String, default: 'vs' },
  // Monaco's namespace once it has loaded (languages, key codes), or null.
  monaco: { type: Function, default: () => null },
  // Whether a tab of this file has edits that are not saved: an undo asks first.
  isUnsaved: { type: Function, default: () => false },
  // Sends the comments' message to the chat; resolves true once the chat took it.
  send: { type: Function, default: null },
})
// written(path): a file was written or deleted (the editor reloads it); loaded(count): the review's files;
// comments(count): the comments not sent yet; open-file(path).
const emit = defineEmits(['written', 'loaded', 'comments', 'open-file'])

const files = ref([])
const loading = ref(false)
const waiting = ref(0)
const error = ref(null)                  // { kind: 'none' | 'error', text }
const selectedPath = ref('')
const hunkIndex = ref(0)
const busy = ref('')                     // the path being written
let unmounted = false

const selected = computed(() => files.value.find((f) => f.path === selectedPath.value) || null)
const hasText = (f) => !!f && !f.binary && !f.redacted

// ── The changes of a file: the editor's own (what it highlights) once it has compared this file, else ours ──
const monacoHunks = ref(null)            // { path, before, after, list }
const ownHunks = new WeakMap()           // a file read from the server -> our diff of it
function hunksOf(f) {
  if (!hasText(f)) return []
  const m = monacoHunks.value
  if (m && m.path === f.path && m.before === (f.before ?? '') && m.after === (f.after ?? '')) return m.list
  if (!ownHunks.has(f)) ownHunks.set(f, diffLines(f.before ?? '', f.after ?? ''))
  return ownHunks.get(f)
}
const hunksByPath = computed(() => {
  const out = {}
  for (const f of files.value) out[f.path] = hunksOf(f)
  return out
})
const hunks = computed(() => (selected.value ? hunksByPath.value[selected.value.path] || [] : []))
const keyOf = (f, h) => hunkKey(f.path, f.before ?? '', f.after ?? '', h)

// ── Kept: remembered per message, in this browser ──
const storeKey = () => `aadml.lc.review.${props.repoId}.${props.messageId}`
function readKept() {
  try { return new Set(JSON.parse(localStorage.getItem(storeKey()) || '[]')) } catch { return new Set() }
}
const kept = ref(readKept())
function saveKept(next) {
  kept.value = next
  try { localStorage.setItem(storeKey(), JSON.stringify([...next])) } catch { /* private window: kept for this visit only */ }
}
function openCount(f) {
  if (!hasText(f)) return kept.value.has(fileKey(f)) ? 0 : 1
  return (hunksByPath.value[f.path] || []).filter((h) => !kept.value.has(keyOf(f, h))).length
}
const fileReviewed = (f) => openCount(f) === 0
const allReviewed = computed(() => files.value.length > 0 && files.value.every(fileReviewed))
const currentKept = computed(() => {
  const h = hunks.value[hunkIndex.value]
  return !!(h && selected.value && kept.value.has(keyOf(selected.value, h)))
})
function keepKeys(keys) {
  const next = new Set(kept.value)
  for (const k of keys) next.add(k)
  saveKept(next)
}
function keepHunk() {
  const f = selected.value
  const h = hunks.value[hunkIndex.value]
  if (!f || !h) return
  keepKeys([keyOf(f, h)])
  nextOpen()
}
function keepFile(f) {
  keepKeys([fileKey(f), ...(hunksByPath.value[f.path] || []).map((h) => keyOf(f, h))])
  const next = files.value.find((x) => !fileReviewed(x))
  if (next && next.path !== f.path) select(next.path)
}
function keepAll() {
  const keys = []
  for (const f of files.value) keys.push(fileKey(f), ...(hunksByPath.value[f.path] || []).map((h) => keyOf(f, h)))
  keepKeys(keys)
}
// After a change is kept: the next one still open in this file, else stay.
function nextOpen() {
  const f = selected.value
  const list = hunks.value
  for (let step = 1; step <= list.length; step++) {
    const i = (hunkIndex.value + step) % list.length
    if (!kept.value.has(keyOf(f, list[i]))) { hunkIndex.value = i; reveal(); return }
  }
}

// ── Loading the review ──
const errText = (e, fallback) => {
  const err = e?.response?.data?.error
  return (typeof err === 'string' ? err : err?.message) || fallback
}
async function load({ keep = '' } = {}) {
  loading.value = true
  error.value = null
  try {
    const { data } = await whileSandboxStarts(() => api.getLetsCodeMessageReview(props.repoId, props.messageId),
      { onWaiting: (s) => { waiting.value = s }, isCancelled: () => unmounted })
    if (unmounted) return
    files.value = Array.isArray(data?.files) ? data.files : []
    emit('loaded', files.value.length)
    const still = (p) => p && files.value.some((f) => f.path === p)
    const firstOpen = files.value.find((f) => !fileReviewed(f))
    const pick = still(keep) ? keep : still(selectedPath.value) ? selectedPath.value : (firstOpen || files.value[0])?.path || ''
    select(pick, { keepIndex: pick === selectedPath.value })
  } catch (e) {
    const r = e?.response
    files.value = []
    if (r?.status === 409 && r.data?.code === 'NO_CHECKPOINT') {
      error.value = { kind: 'none', text: 'This message changed no files, so there is nothing to review.' }
    } else if (r?.status === 404) {
      error.value = { kind: 'error', text: 'These changes could not be found. The message may have been removed.' }
    } else if (r?.status === 503 && r.data?.code === 'SANDBOX_NOT_ANSWERING') {
      error.value = { kind: 'error', text: errText(e, "The project's sandbox did not answer in time. Try again.") }
    } else {
      error.value = { kind: 'error', text: errText(e, 'The changes could not be loaded. Try again.') }
    }
    emit('loaded', 0)
  } finally {
    loading.value = false
  }
}

function select(path, { keepIndex = false } = {}) {
  const same = path === selectedPath.value
  selectedPath.value = path
  if (!same) { monacoHunks.value = null; draft.value = null }
  const f = selected.value
  const list = f ? hunksOf(f) : []
  if (keepIndex && same) hunkIndex.value = Math.min(hunkIndex.value, Math.max(0, list.length - 1))
  else {
    const first = f ? list.findIndex((h) => !kept.value.has(keyOf(f, h))) : -1
    hunkIndex.value = first < 0 ? 0 : first
  }
  nextTick(() => { applyLanguage(); reveal() })
}
function go(step) {
  const n = hunks.value.length
  if (!n) return
  hunkIndex.value = (hunkIndex.value + step + n) % n
  reveal()
}

// ── Undo: the file is written with the change put back, naming the version read (ADM-1323) ──
function canUndoFile(f) {
  if (!f || f.redacted) return false
  if (f.binary) return f.status === 'added'               // a binary file's bytes are not here to write back
  return true
}
async function unsavedOk(f) {
  if (!props.isUnsaved(f.path)) return true
  return confirm({
    title: `${baseName(f.path)} has unsaved edits`,
    message: `Your unsaved edits to ${f.path} stay in its tab. Undoing writes the file in the project, so saving those `
      + 'edits later will ask which version to keep.',
    confirmText: 'Undo anyway',
    cancelText: 'Cancel',
    danger: true,
  })
}
async function write(f, call, done) {
  busy.value = f.path
  try {
    await whileSandboxStarts(call, { onWaiting: (s) => { waiting.value = s }, isCancelled: () => unmounted })
    notify.success(done)
    emit('written', f.path)
    await load({ keep: f.path })
  } catch (e) {
    if (e?.response?.status === 409 && ['CHANGED_ON_DISK', 'EXISTS'].includes(e.response.data?.code)) {
      notify.warning(`${f.path} changed in the project after this review was loaded, so nothing was written. `
        + 'The review now shows the file as it is.')
      await load({ keep: f.path })
    } else {
      notify.error(errText(e, `${f.path} could not be changed. Try again.`))
    }
  } finally {
    busy.value = ''
  }
}
async function undoHunk() {
  const f = selected.value
  const h = hunks.value[hunkIndex.value]
  if (!f || !h || busy.value) return
  // An added or deleted file is one change: undoing it is undoing the file.
  if (f.status !== 'modified') return undoFile(f)
  if (!(await unsavedOk(f))) return
  const text = revertHunk(f.after ?? '', f.before ?? '', h)
  await write(f, () => api.saveFileContent(props.systemId, props.repoId, f.path, text, f.sha || undefined), 'Change undone')
}
async function undoFile(f) {
  if (!canUndoFile(f) || busy.value) return
  if (!(await unsavedOk(f))) return
  if (f.status === 'added') {
    const ok = await confirm({
      title: `Delete ${baseName(f.path)}?`,
      message: `The Coding Agent created ${f.path}. Undoing it deletes the file from the project.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    })
    if (!ok) return
    await write(f, () => api.deleteRepositoryEntry(props.systemId, props.repoId, f.path, f.sha || undefined), `Deleted ${baseName(f.path)}`)
  } else if (f.status === 'deleted') {
    // It is not on disk, so there is no version to name: it is written only while it is still not there.
    await write(f, () => api.saveFileContent(props.systemId, props.repoId, f.path, f.before ?? '', undefined, { newFile: true }), `Restored ${baseName(f.path)}`)
  } else {
    await write(f, () => api.saveFileContent(props.systemId, props.repoId, f.path, f.before ?? '', f.sha || undefined), `Undid the changes in ${baseName(f.path)}`)
  }
}

// ── The diff editor ──
const sideBySide = ref(readLayout())
function readLayout() {
  try { return localStorage.getItem('aadml.lc.review.layout') !== 'inline' } catch { return true }
}
function toggleLayout() {
  sideBySide.value = !sideBySide.value
  try { localStorage.setItem('aadml.lc.review.layout', sideBySide.value ? 'side' : 'inline') } catch { /* not remembered */ }
  try { diffInst?.updateOptions?.({ renderSideBySide: sideBySide.value }) } catch { /* disposed */ }
}
const options = computed(() => ({
  ...props.diffOptions,
  readOnly: true,
  originalEditable: false,
  renderSideBySide: sideBySide.value,
  ignoreTrimWhitespace: false,           // every change the agent made is a change to review, spaces too
}))
const editorReady = ref(0)               // Monaco has loaded: its own language list can be read
const language = computed(() => {
  void editorReady.value
  const ns = props.monaco()
  let langs = null
  try { langs = ns ? ns.languages.getLanguages() : null } catch { langs = null }
  return selected.value ? languageFor(selected.value.path, langs) : 'plaintext'
})
let diffInst = null
const disposers = []
function onDiffMount(ed) {
  diffInst = ed || null
  if (!diffInst) return
  editorReady.value++
  try { disposers.push(diffInst.onDidUpdateDiff(readLineChanges)) } catch { /* an editor without the event: our diff */ }
  addCommentAction(diffInst.getModifiedEditor?.(), 'after')
  addCommentAction(diffInst.getOriginalEditor?.(), 'before')
  applyLanguage()
  readLineChanges()
  reveal()
}
function readLineChanges() {
  const f = selected.value
  if (!diffInst || !hasText(f)) return
  let changes = null
  let pair = null
  try { changes = diffInst.getLineChanges(); pair = diffInst.getModel() } catch { return }
  if (!changes || !pair) return
  // Only when the editor holds this file's two sides (it may still show the file picked before).
  if (pair.original?.getValue?.() !== (f.before ?? '') || pair.modified?.getValue?.() !== (f.after ?? '')) return
  monacoHunks.value = { path: f.path, before: f.before ?? '', after: f.after ?? '', list: fromMonaco(changes) }
  if (hunkIndex.value >= monacoHunks.value.list.length) hunkIndex.value = Math.max(0, monacoHunks.value.list.length - 1)
}
// The editor's component never re-reads its language: set it on both models.
function applyLanguage() {
  const ns = props.monaco()
  if (!ns || !diffInst) return
  try {
    const pair = diffInst.getModel()
    for (const m of [pair?.original, pair?.modified]) {
      if (m && m.getLanguageId() !== language.value) ns.editor.setModelLanguage(m, language.value)
    }
  } catch { /* disposed */ }
}
function reveal() {
  const h = hunks.value[hunkIndex.value]
  if (!diffInst || !h) return
  try {
    const f = selected.value
    const onAfter = f && f.after != null
    const ed = onAfter ? diffInst.getModifiedEditor() : diffInst.getOriginalEditor()
    const line = Math.max(1, onAfter ? h.mStart : h.oStart)
    ed.revealLineInCenter(line)
    ed.setPosition({ lineNumber: line, column: 1 })
  } catch { /* disposed */ }
}
function addCommentAction(ed, side) {
  const ns = props.monaco()
  if (!ed || !ns || typeof ed.addAction !== 'function') return
  try {
    disposers.push(ed.addAction({
      id: `lets-code.review-comment-${side}`,
      label: 'Comment on this line',
      keybindings: [ns.KeyMod.CtrlCmd | ns.KeyMod.Alt | ns.KeyCode.KeyM],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 0.5,
      run: (e) => startComment({ side, line: e?.getPosition?.()?.lineNumber }),
    }))
  } catch { /* an editor that cannot take actions keeps the toolbar button */ }
}
watch(language, () => nextTick(applyLanguage))
watch(() => [selectedPath.value, selected.value && selected.value.after, selected.value && selected.value.before],
  () => nextTick(readLineChanges))

// ── ADM-1329: comments ──
const comments = ref([])
const draft = ref(null)                   // { path, side, line, snippet, text, error }
const draftEl = ref(null)
const draftId = `rv-draft-${Math.random().toString(36).slice(2, 8)}`
const editingId = ref(null)
const editText = ref('')
const editError = ref('')
const sending = ref(false)
let commentSeq = 0
watch(() => comments.value.length, (n) => emit('comments', n))

function cursorLine(side) {
  try {
    const ed = side === 'after' ? diffInst?.getModifiedEditor() : diffInst?.getOriginalEditor()
    return ed?.getPosition?.()?.lineNumber || 0
  } catch { return 0 }
}
// The line the cursor is on, on the side the file has now (the side before, for a deleted file).
function startComment({ side = '', line = 0 } = {}) {
  const f = selected.value
  if (!hasText(f)) return
  const s = side || (f.after != null ? 'after' : 'before')
  const text = s === 'after' ? (f.after ?? '') : (f.before ?? '')
  const count = text ? splitLines(text).length : 1
  const h = hunks.value[hunkIndex.value]
  let n = line || cursorLine(s) || (h ? (s === 'after' ? h.mStart : h.oStart) : 1)
  n = Math.min(Math.max(1, n), count)
  draft.value = { path: f.path, side: s, line: n, snippet: snippetAround(text, n), text: '', error: '' }
  nextTick(() => draftEl.value?.focus?.())
}
function addDraft() {
  const d = draft.value
  if (!d) return
  if (!d.text.trim()) { d.error = 'Type a comment first.'; return }
  comments.value = [...comments.value, { id: ++commentSeq, path: d.path, side: d.side, line: d.line, snippet: d.snippet, text: d.text.trim() }]
  draft.value = null
}
function onDraftKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); draft.value = null }
  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addDraft() }
}
function startEdit(c) { editingId.value = c.id; editText.value = c.text; editError.value = '' }
function saveEdit(c) {
  if (!editText.value.trim()) { editError.value = 'Type a comment, or remove it.'; return }
  comments.value = comments.value.map((x) => (x.id === c.id ? { ...x, text: editText.value.trim() } : x))
  editingId.value = null
}
function removeComment(c) {
  comments.value = comments.value.filter((x) => x.id !== c.id)
  if (editingId.value === c.id) editingId.value = null
}
function showComment(c) {
  if (c.path !== selectedPath.value) select(c.path)
  nextTick(() => {
    try {
      const ed = c.side === 'after' ? diffInst?.getModifiedEditor() : diffInst?.getOriginalEditor()
      ed?.revealLineInCenter(c.line)
      ed?.setPosition({ lineNumber: c.line, column: 1 })
      ed?.focus?.()
    } catch { /* disposed */ }
  })
}
async function sendComments() {
  if (sending.value || editingId.value) return
  const list = comments.value.filter((c) => c.text.trim())
  const text = reviewMessage(list)
  if (!text) { notify.warning('Add a comment before sending.'); return }
  if (!props.send) { notify.error('The Coding Agent chat is not open here.'); return }
  sending.value = true
  try {
    const ok = await props.send({ conversationId: props.conversationId, text })
    if (ok) {
      comments.value = []
      notify.success(list.length === 1 ? 'Comment sent to the Coding Agent' : `${list.length} comments sent to the Coding Agent`)
    } else {
      notify.error('The comments were not sent. They are still here; try again.')
    }
  } catch {
    notify.error('The comments were not sent. They are still here; try again.')
  } finally {
    sending.value = false
  }
}

function onKeydown(e) {
  // Ctrl+Alt+M anywhere in the review (Monaco takes it itself while it has focus).
  if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key || '').toLowerCase() === 'm') {
    e.preventDefault()
    startComment()
  }
}

const baseName = (p) => String(p).split('/').pop()
const LETTER = { added: 'A', modified: 'M', deleted: 'D' }
const WORD = { added: 'Added', modified: 'Modified', deleted: 'Deleted' }
const statusLetter = (s) => LETTER[s] || 'M'
const statusWord = (s) => WORD[s] || 'Changed'

onMounted(() => load())
onBeforeUnmount(() => {
  unmounted = true
  for (const d of disposers) { try { d?.dispose?.() } catch { /* gone */ } }
})

defineExpose({ load, startComment, comments, files })
</script>

<style scoped>
.rv { position: absolute; inset: 0; display: grid; grid-template-columns: minmax(200px, 260px) minmax(0, 1fr); min-height: 0; background: var(--vm-surface); color: var(--vm-ink); font: 13px var(--vm-font-sans); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.rv-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; padding: 24px; text-align: center; color: var(--vm-ink-soft); }
.rv-state p { margin: 0; font-size: 13px; }
.rv-state-ic { width: 32px; height: 32px; color: var(--vm-ink-faint); }

/* ── The changed files ── */
.rv-files { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--vm-line); background: var(--vm-surface); }
.rv-files-head { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--vm-line); }
.rv-files-title { flex: 1; font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink-soft); }
.rv-done { display: flex; align-items: center; gap: 6px; margin: 8px 10px 0; padding: 6px 8px; border-radius: 8px; background: var(--vm-violet-soft); color: var(--vm-violet); font-weight: 600; font-size: 12.5px; }
.rv-done :deep(svg) { width: 15px; height: 15px; }
.rv-list { list-style: none; margin: 0; padding: 4px 0; flex: 1; min-height: 0; overflow-y: auto; }
.rv-file { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 32px; padding: 4px 10px; border: none; background: transparent; color: var(--vm-ink); text-align: left; cursor: pointer; transition: background-color .12s; }
.rv-file:hover { background: var(--vm-surface-soft); }
.rv-file.active { background: var(--vm-violet-soft); }
.rv-file:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: -2px; }
.rv-path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 12.5px var(--vm-font-mono); }
.rv-badge { flex: 0 0 auto; width: 16px; text-align: center; font: 700 11px var(--vm-font-mono); color: var(--vm-ink-soft); }
.rv-badge.modified { color: color-mix(in srgb, var(--vm-amber) 70%, var(--vm-ink)); }
.rv-badge.added { color: color-mix(in srgb, var(--vm-green) 65%, var(--vm-ink)); }
.rv-badge.deleted { color: var(--vm-red-ink); }
.rv-count { flex: 0 0 auto; min-width: 18px; padding: 0 5px; border-radius: 9999px; background: var(--vm-line-2); color: var(--vm-ink); font: 600 11px var(--vm-font-sans); text-align: center; line-height: 18px; font-variant-numeric: tabular-nums; }
.rv-ok { flex: 0 0 auto; width: 14px; height: 14px; color: color-mix(in srgb, var(--vm-green) 65%, var(--vm-ink)); }
.rv-files-foot { padding: 8px 10px; border-top: 1px solid var(--vm-line); }
.rv-files-foot .rv-btn { width: 100%; }

/* ── The file's changes ── */
.rv-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.rv-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--vm-line); }
.rv-bar-file { display: flex; align-items: center; gap: 7px; flex: 1 1 200px; min-width: 0; }
.rv-bar-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.rv-hunkbar { background: var(--vm-surface-soft); }
.rv-hunk-label { flex: 1 1 auto; font-weight: 600; color: var(--vm-ink-soft); font-variant-numeric: tabular-nums; }
.rv-kept { color: color-mix(in srgb, var(--vm-green) 65%, var(--vm-ink)); }
.rv-diff { position: relative; flex: 1; min-height: 160px; }
.rv-monaco { position: absolute; inset: 0; width: 100%; height: 100%; }

.rv-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: 7px; background: var(--vm-surface); color: var(--vm-ink); font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s, border-color .15s; touch-action: manipulation; }
.rv-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.rv-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: #fff; }
.rv-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); }
.rv-btn.danger { color: var(--vm-red-ink); }
.rv-btn:disabled { opacity: .55; cursor: not-allowed; }
.rv-btn:focus-visible, .rv-icon:focus-visible, .rv-where:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.rv-btn :deep(svg) { width: 14px; height: 14px; }
.rv-icon { display: grid; place-items: center; width: 32px; height: 32px; border: none; border-radius: 7px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s; touch-action: manipulation; }
.rv-icon:hover:not(:disabled) { background: var(--vm-surface-soft); color: var(--vm-ink); }
.rv-icon:disabled { opacity: .45; cursor: not-allowed; }
.rv-icon :deep(svg) { width: 16px; height: 16px; }

/* ── The comment being written, and the tray ── */
.rv-draft { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-bottom: 1px solid var(--vm-line); background: var(--vm-bg); }
.rv-draft-label { font-weight: 600; color: var(--vm-ink-soft); }
.rv-draft-actions { display: flex; gap: 6px; }
.rv-input { width: 100%; box-sizing: border-box; resize: vertical; min-height: 60px; padding: 8px 10px; border: 1.5px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 13px var(--vm-font-sans); line-height: 1.5; }
.rv-input:focus { outline: none; border-color: var(--vm-focus, var(--vm-violet)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vm-focus, var(--vm-violet)) 18%, transparent); }
.rv-err { margin: 0; color: var(--vm-red-ink); font-size: 12.5px; }
.rv-snippet { margin: 0; padding: 6px 8px; border: 1px solid var(--vm-line); border-radius: 6px; background: var(--vm-surface-soft); font: 12px/1.5 var(--vm-font-mono); color: var(--vm-ink-soft); white-space: pre; overflow-x: auto; }
.rv-tray { flex: 0 0 auto; max-height: 40%; display: flex; flex-direction: column; min-height: 0; border-top: 1px solid var(--vm-line); background: var(--vm-surface); }
.rv-tray-head { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--vm-line); }
.rv-tray-title { flex: 1; font-weight: 600; color: var(--vm-ink-soft); }
.rv-tray-list { list-style: none; margin: 0; padding: 6px 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.rv-comment { display: flex; flex-direction: column; gap: 6px; }
.rv-comment-head { display: flex; align-items: center; gap: 6px; }
.rv-where { flex: 1; min-width: 0; padding: 0; border: none; background: transparent; color: var(--vm-violet); font: 600 12.5px var(--vm-font-mono); text-align: left; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rv-where:hover { text-decoration: underline; }
.rv-comment-text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.rv-edit { display: flex; flex-direction: column; gap: 6px; }

.spin { animation: rvspin 1s linear infinite; }
@keyframes rvspin { to { transform: rotate(360deg); } }

/* ── A narrow screen (ADM-1128 one-pane layout): the file list above the diff, every button reachable ── */
@media (max-width: 640px) {
  .rv { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); overflow-y: auto; }
  .rv-files { border-right: none; border-bottom: 1px solid var(--vm-line); max-height: 40vh; }
  .rv-file { min-height: 44px; }
  .rv-btn { min-height: 44px; }
  .rv-icon { width: 44px; height: 44px; }
  .rv-where { min-height: 44px; }
  .rv-diff { min-height: 50vh; }
  .rv-input { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
