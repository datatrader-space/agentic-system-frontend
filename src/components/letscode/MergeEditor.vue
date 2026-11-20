<template>
  <!-- The 3-way merge editor for a conflicted file (ADM-1321), as VS Code's: two versions compared above (yours and
       theirs, or either against the base they both started from), the result below, editable. Each conflict is
       accepted one at a time (yours, theirs or both: one undoable edit each, `mergeConflicts.js`), then the result is
       saved into the file and marked resolved in one step. -->
  <div class="mrg">
    <div class="mrg-head">
      <Icon icon="lucide:git-merge" class="mrg-head-ic" aria-hidden="true" />
      <span class="mrg-path" translate="no" :title="path">{{ path }}</span>
      <span v-if="loaded && !note" class="mrg-count" role="status" aria-live="polite">
        {{ blocks.length ? `${blocks.length} ${blocks.length === 1 ? 'conflict' : 'conflicts'} left` : 'No conflicts left' }}
      </span>
      <div class="mrg-tools">
        <label class="sr-only" for="mrg-compare">Compare</label>
        <select v-if="loaded && !note" id="mrg-compare" v-model="compare" class="mrg-select">
          <option value="mine-theirs">Yours ↔ theirs</option>
          <option value="base-mine" :disabled="sides.base === null">Base ↔ yours</option>
          <option value="base-theirs" :disabled="sides.base === null">Base ↔ theirs</option>
        </select>
        <button type="button" class="mrg-btn" title="Open the file as text" :aria-label="`Open ${path} as text`" @click="emit('open-file', path)">
          <Icon icon="lucide:file-text" aria-hidden="true" />
        </button>
        <button v-if="loaded && !note" type="button" class="mrg-btn primary" :disabled="saving || blocks.length > 0"
                :title="blocks.length ? 'Resolve every conflict first' : 'Save the result and mark the file resolved'" @click="markResolved">
          <Icon :icon="saving ? 'lucide:loader' : 'lucide:check'" :class="{ spin: saving }" aria-hidden="true" />
          {{ saving ? 'Saving…' : 'Mark resolved' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="mrg-empty" role="status" aria-live="polite">
      {{ waiting ? `The project's sandbox is starting. Trying again in ${waiting}s…` : 'Loading the versions…' }}
    </div>
    <div v-else-if="error" class="mrg-empty err" role="alert">{{ error }}</div>
    <div v-else-if="note" class="mrg-empty" role="status">
      <Icon :icon="noteIcon" class="mrg-empty-ic" aria-hidden="true" /> {{ note }}
    </div>
    <template v-else-if="loaded">
      <p v-if="!sides.unmerged" class="mrg-note" role="status">
        This file is not in conflict any more. You can still change the result and save it.
      </p>
      <!-- One row per conflict in the result, in order: accept a side, or go to it. -->
      <ol v-if="blocks.length" class="mrg-conflicts" aria-label="Conflicts">
        <li v-for="(b, i) in blocks" :key="b.start" class="mrg-conflict">
          <button type="button" class="mrg-go" :aria-label="`Go to conflict ${i + 1}, line ${b.start}`" @click="reveal(b.start)">
            Conflict {{ i + 1 }} <span class="mrg-line">line {{ b.start }}</span>
          </button>
          <button v-for="c in CHOICES" :key="c.choice" type="button" class="mrg-accept" :class="c.choice"
                  :aria-label="`${c.label} for conflict ${i + 1}`" :title="c.title" @click="accept(b, c.choice)">
            {{ c.label }}
          </button>
        </li>
      </ol>
      <div class="mrg-panes">
        <div class="mrg-pane mrg-compare">
          <div class="mrg-pane-h">
            <span>{{ labels[0] }}</span><span>{{ labels[1] }}</span>
          </div>
          <component :is="diffEditor" v-if="diffEditor" :value="compared[1]" :original="compared[0]" :language="language"
                     :theme="theme" :options="diffOptions" class="mrg-monaco" />
        </div>
        <div class="mrg-pane mrg-result">
          <div class="mrg-pane-h"><span>Result</span><span class="mrg-hint">Edit it here; Mark resolved saves it.</span></div>
          <component :is="editor" v-if="editor" :value="result" :language="language" :theme="theme" :options="resultOptions"
                     class="mrg-monaco" @change="onChange" @editorDidMount="onMount" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { whileSandboxStarts } from '@/utils/sandboxStarting'
import { findConflicts, resolveConflict, acceptConflict, bindConflictActions } from '@/utils/mergeConflicts'

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
  path: { type: String, required: true },
  language: { type: String, default: 'plaintext' },
  // The page's lazily loaded Monaco components and namespace (CodeBrowser), so Monaco is loaded once.
  editor: { type: [Object, Function], default: null },
  diffEditor: { type: [Object, Function], default: null },
  diffOptions: { type: Object, default: () => ({}) },
  editorOptions: { type: Object, default: () => ({}) },
  theme: { type: String, default: 'vs' },
  monaco: { type: Function, default: () => null },
})
// resolved: the file was saved and marked resolved ({path, status}); open-file: open it as ordinary text; edited: the
// result differs from the file as read (closing the tab then asks first).
const emit = defineEmits(['resolved', 'open-file', 'edited'])

const CHOICES = [
  { choice: 'current', label: 'Yours', title: 'Keep your lines' },
  { choice: 'incoming', label: 'Theirs', title: 'Keep their lines' },
  { choice: 'both', label: 'Both', title: 'Keep yours, then theirs' },
]

const loading = ref(false)
const loaded = ref(false)
const waiting = ref(0)
const error = ref('')
const note = ref('')
const noteIcon = ref('lucide:info')
const saving = ref(false)
const sides = ref({ base: null, mine: null, theirs: null, unmerged: false })
const result = ref('')
const compare = ref('mine-theirs')
let gone = false
let resultEditor = null
let release = null

const blocks = computed(() => findConflicts(result.value))
let readResult = ''
watch(result, (v) => emit('edited', loaded.value && v !== readResult))
const compared = computed(() => {
  const { base, mine, theirs } = sides.value
  if (compare.value === 'base-mine') return [base ?? '', mine ?? '']
  if (compare.value === 'base-theirs') return [base ?? '', theirs ?? '']
  return [mine ?? '', theirs ?? '']
})
const labels = computed(() => ({
  'mine-theirs': ['Yours', 'Theirs (incoming)'], 'base-mine': ['Base', 'Yours'], 'base-theirs': ['Base', 'Theirs (incoming)'],
}[compare.value]))
const resultOptions = computed(() => ({ ...props.editorOptions, readOnly: false, glyphMargin: false }))

async function load() {
  loading.value = true
  error.value = ''
  note.value = ''
  try {
    const { data } = await whileSandboxStarts(() => api.getMergeSides(props.systemId, props.repoId, props.path),
      { onWaiting: (s) => { waiting.value = s }, isCancelled: () => gone })
    if (data.redacted) { note.value = 'This file holds secrets, so its versions are not shown. Keep one side from Source control.'; noteIcon.value = 'lucide:lock' }
    else if (data.binary) { note.value = 'This file is not text. Keep one side from Source control.'; noteIcon.value = 'lucide:file-x' }
    else {
      sides.value = { base: data.base ?? null, mine: data.mine ?? null, theirs: data.theirs ?? null, unmerged: !!data.unmerged }
      readResult = data.result ?? ''
      result.value = readResult
    }
    loaded.value = true
  } catch (e) {
    error.value = e?.response?.data?.error || 'The versions of this file could not be loaded.'
  } finally {
    loading.value = false
  }
}

function onChange(value) { result.value = value }
function onMount(ed) {
  resultEditor = ed || null
  if (release) release()
  release = resultEditor ? bindConflictActions({ monaco: props.monaco, editor: () => resultEditor }) : null
}
// In the editor: one undoable edit. Before Monaco has loaded: the same change to the text.
function accept(block, choice) {
  if (resultEditor && acceptConflict(props.monaco(), resultEditor, block.start, choice)) {
    result.value = resultEditor.getModel().getValue()
    return
  }
  result.value = resolveConflict(result.value, block, choice)
}
function reveal(line) {
  try {
    resultEditor?.revealLineInCenter(line)
    resultEditor?.setPosition({ lineNumber: line, column: 1 })
    resultEditor?.focus()
  } catch { /* the editor went away */ }
}

async function markResolved() {
  if (saving.value || blocks.value.length) return
  saving.value = true
  try {
    const { data } = await whileSandboxStarts(() => api.resolveWithContent(props.systemId, props.repoId, props.path, result.value),
      { onWaiting: (s) => { waiting.value = s }, isCancelled: () => gone })
    notify.success(`${props.path} is resolved`)
    readResult = result.value
    emit('edited', false)
    emit('resolved', { path: props.path, status: data })
  } catch (e) {
    notify.error(e?.response?.data?.error || `${props.path} could not be marked resolved. Try again.`)
  } finally {
    saving.value = false
  }
}

onMounted(load)
watch(() => props.path, () => { loaded.value = false; load() })
onBeforeUnmount(() => { gone = true; if (release) release() })
</script>

<style scoped>
.mrg { display: flex; flex-direction: column; height: 100%; min-height: 0; font: 12.5px var(--vm-font-sans); color: var(--vm-ink); background: var(--vm-surface); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.mrg-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--vm-line); }
.mrg-head-ic { width: 14px; height: 14px; color: var(--vm-violet); flex: 0 0 auto; }
.mrg-path { font: 600 12.5px var(--vm-font-mono); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mrg-count { font-size: 12px; color: var(--vm-amber-ink); }
.mrg-tools { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.mrg-select { min-height: 30px; padding: 0 8px; border: 1px solid var(--vm-line-2); border-radius: 7px; background: var(--vm-surface); color: var(--vm-ink); font: 12.5px var(--vm-font-sans); cursor: pointer; }
.mrg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 30px; min-height: 30px; padding: 0 10px; border: 1px solid var(--vm-line-2); border-radius: 7px; background: var(--vm-surface); color: var(--vm-ink); font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s; }
.mrg-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.mrg-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: #fff; }
.mrg-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); }
.mrg-btn:disabled { opacity: .55; cursor: not-allowed; }
.mrg-btn :deep(svg) { width: 14px; height: 14px; }
.mrg-btn:focus-visible, .mrg-select:focus-visible, .mrg-go:focus-visible, .mrg-accept:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.mrg-empty { padding: 16px 12px; display: flex; align-items: center; gap: 6px; color: var(--vm-ink-soft); line-height: 1.45; }
.mrg-empty.err { color: var(--vm-red-ink); }
.mrg-empty-ic { width: 14px; height: 14px; flex: 0 0 auto; }
.mrg-note { margin: 6px 10px 0; font-size: 12px; color: var(--vm-ink-soft); }
.mrg-conflicts { list-style: none; margin: 0; padding: 6px 10px; display: flex; flex-wrap: wrap; gap: 6px; border-bottom: 1px solid var(--vm-line); max-height: 30%; overflow: auto; }
.mrg-conflict { display: inline-flex; align-items: center; gap: 4px; padding: 2px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-amber-soft); }
.mrg-go { border: none; background: transparent; padding: 2px 6px; font: 600 12px var(--vm-font-sans); color: var(--vm-amber-ink); cursor: pointer; border-radius: 6px; }
.mrg-go:hover { text-decoration: underline; }
.mrg-line { font-weight: 400; color: var(--vm-ink-soft); }
.mrg-accept { min-height: 24px; padding: 0 8px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: 600 11.5px var(--vm-font-sans); cursor: pointer; transition: border-color .15s, color .15s; }
.mrg-accept.current:hover { border-color: var(--vm-teal); color: var(--vm-teal-ink); }
.mrg-accept.incoming:hover { border-color: var(--vm-sky); color: var(--vm-ink); }
.mrg-accept.both:hover { border-color: var(--vm-violet); color: var(--vm-violet-ink); }
.mrg-panes { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.mrg-pane { display: flex; flex-direction: column; min-height: 0; }
.mrg-compare { flex: 1 1 45%; border-bottom: 1px solid var(--vm-line); }
.mrg-result { flex: 1 1 55%; }
.mrg-pane-h { display: flex; justify-content: space-between; gap: 8px; padding: 4px 10px; font: 600 11.5px var(--vm-font-sans); color: var(--vm-ink-soft); background: var(--vm-surface-soft); }
.mrg-hint { font-weight: 400; color: var(--vm-ink-faint); }
.mrg-monaco { flex: 1 1 auto; min-height: 120px; }
.spin { animation: mrg-spin 1s linear infinite; } @keyframes mrg-spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .mrg-btn, .mrg-select, .mrg-go, .mrg-accept { min-height: 44px; } .mrg-btn { min-width: 44px; }
  .mrg-tools { margin-left: 0; width: 100%; } .mrg-select { flex: 1 1 auto; font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
