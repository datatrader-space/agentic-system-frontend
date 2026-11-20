<template>
  <div class="cs">
    <div class="cs-form">
      <div class="cs-query">
        <button type="button" class="cs-toggle cs-rep-toggle" :aria-expanded="showReplace ? 'true' : 'false'"
                aria-label="Toggle Replace" title="Toggle Replace" @click="showReplace = !showReplace">
          <Icon :icon="showReplace ? 'lucide:chevron-down' : 'lucide:chevron-right'" aria-hidden="true" />
        </button>
        <div class="cs-fields">
          <div class="cs-field">
            <input
              ref="inputEl"
              v-model="q"
              type="search"
              name="search-query"
              class="cs-input"
              aria-label="Search in files"
              placeholder="Search in files…"
              spellcheck="false"
              autocomplete="off"
              @keydown.enter.prevent="run" />
            <div class="cs-toggles">
              <button v-for="t in TOGGLES" :key="t.key" type="button" class="cs-toggle" :class="{ on: opts[t.key] }"
                      :aria-pressed="opts[t.key] ? 'true' : 'false'" :aria-label="t.label" :title="t.label"
                      @click="opts[t.key] = !opts[t.key]">
                <Icon :icon="t.icon" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div v-if="showReplace" class="cs-field">
            <input
              v-model="rep"
              name="search-replace"
              type="text"
              class="cs-input cs-input-rep"
              aria-label="Replace"
              :placeholder="opts.regex ? 'Replace: $1 is a group, $& the whole match…' : 'Replace…'"
              spellcheck="false"
              autocomplete="off"
              @keydown.enter.prevent="canReplace && replaceAll()" />
            <div class="cs-toggles">
              <button type="button" class="cs-toggle" :disabled="!canReplace" aria-label="Replace all"
                      title="Replace all" @click="replaceAll">
                <Icon icon="lucide:replace-all" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="cs-opts">
        <label class="cs-check">
          <input v-model="opts.ignored" type="checkbox" />
          Include files git ignores
        </label>
        <button type="button" class="cs-toggle" :class="{ on: include || exclude }"
                :aria-expanded="showDetails ? 'true' : 'false'" aria-label="Toggle files to include and exclude"
                title="Files to include and exclude" @click="showDetails = !showDetails">
          <Icon icon="lucide:ellipsis" aria-hidden="true" />
        </button>
      </div>
      <div v-if="showDetails" class="cs-details">
        <label class="cs-lbl">
          <span>Files to include</span>
          <input v-model="include" name="search-include" type="text" class="cs-input cs-plain" placeholder="e.g. *.ts, src…"
                 spellcheck="false" autocomplete="off" @keydown.enter.prevent="run" />
        </label>
        <label class="cs-lbl">
          <span>Files to exclude</span>
          <input v-model="exclude" name="search-exclude" type="text" class="cs-input cs-plain" placeholder="e.g. node_modules, *.min.js…"
                 spellcheck="false" autocomplete="off" @keydown.enter.prevent="run" />
        </label>
      </div>
    </div>

    <p class="cs-status" role="status" aria-live="polite">
      <template v-if="replacing">Replacing… {{ progress.done }} of {{ progress.total }} {{ progress.total === 1 ? 'file' : 'files' }}</template>
      <template v-else-if="busy">{{ waiting ? `The project's sandbox is starting. Searching in ${waiting}s…` : 'Searching…' }}</template>
      <template v-else-if="error"><span class="cs-error">{{ error }}</span></template>
      <template v-else-if="done && !count">No results for “{{ asked }}”.</template>
      <template v-else-if="done">{{ count }} {{ count === 1 ? 'result' : 'results' }} in {{ groups.length }} {{ groups.length === 1 ? 'file' : 'files' }}</template>
    </p>
    <p v-if="showReplace && replaceError && !busy" class="cs-status cs-error" role="alert">Replace is off for this pattern: {{ replaceError }}</p>

    <div class="cs-body">
      <section v-if="summary" class="cs-note" aria-label="Last replace">
        <p class="cs-note-head">
          <span>Replaced {{ summary.count }} {{ summary.count === 1 ? 'line' : 'lines' }} in {{ summary.files }} {{ summary.files === 1 ? 'file' : 'files' }}.<template v-if="summary.skipped.length"> Not replaced: {{ summary.skipped.length }} {{ summary.skipped.length === 1 ? 'file' : 'files' }}.</template></span>
          <button type="button" class="cs-act cs-act-on" aria-label="Close the replace summary" title="Close" @click="summary = null">
            <Icon icon="lucide:x" aria-hidden="true" />
          </button>
        </p>
        <ul v-if="summary.skipped.length" class="cs-note-list">
          <li v-for="s in summary.skipped" :key="s.path"><span class="cs-note-path" translate="no">{{ s.path }}</span> {{ s.reason }}</li>
        </ul>
      </section>

      <ul v-if="groups.length" class="cs-results" aria-label="Search results">
        <li v-for="g in groups" :key="g.path" class="cs-group">
          <div class="cs-row">
            <button type="button" class="cs-file" :aria-expanded="isOpen(g) ? 'true' : 'false'" @click="toggle(g)">
              <Icon :icon="isOpen(g) ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="cs-chev" aria-hidden="true" />
              <span class="cs-fname" translate="no">{{ baseName(g.path) }}</span>
              <span class="cs-fdir" translate="no">{{ dirName(g.path) }}</span>
              <span class="cs-count">{{ g.matches.length }}</span>
            </button>
            <button v-if="previewOn && replaceableIn(g).length" type="button" class="cs-act" :disabled="!canReplace"
                    :aria-label="`Replace all in ${g.path}`" title="Replace all in this file" @click="replaceFile(g)">
              <Icon icon="lucide:replace-all" aria-hidden="true" />
            </button>
          </div>
          <ul v-if="isOpen(g)" class="cs-lines">
            <li v-for="m in g.matches" :key="`${m.line}:${m.column}`" class="cs-row">
              <button type="button" class="cs-line" :title="titleOf(m)"
                      @click="emit('open', { path: m.path, line: m.line, column: m.column })">
                <span class="cs-ln">{{ m.line }}</span>
                <span v-if="m.redacted" class="cs-text cs-hidden">Not shown: this file holds secrets{{ previewOn ? ', and is never replaced' : '' }}</span>
                <span v-else-if="previewOn && m.preview" class="cs-text" translate="no"><template v-for="(p, i) in previewOf(m)" :key="i"><del v-if="p.del" class="cs-del">{{ p.text }}</del><ins v-else-if="p.ins" class="cs-ins">{{ p.text }}</ins><span v-else :class="{ 'cs-ell': p.ellipsis }">{{ p.text }}</span></template></span>
                <span v-else class="cs-text" translate="no"><template v-for="(p, i) in partsOf(m)" :key="i"><mark v-if="p.hit" class="cs-hit">{{ p.text }}</mark><span v-else :class="{ 'cs-ell': p.ellipsis }">{{ p.text }}</span></template></span>
              </button>
              <button v-if="previewOn && m.preview" type="button" class="cs-act" :disabled="!canReplace"
                      :aria-label="`Replace line ${m.line} of ${m.path}`" title="Replace" @click="replaceLine(m)">
                <Icon icon="lucide:replace" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </li>
      </ul>

      <section v-if="binary.length" class="cs-note" aria-label="Binary files that match">
        <p class="cs-note-head">Binary files that match: never shown{{ showReplace ? ' or replaced' : '' }}.</p>
        <ul class="cs-note-list">
          <li v-for="p in binary" :key="p"><span class="cs-note-path" translate="no">{{ p }}</span></li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
// Search inside the project's files, as VS Code's Search view (ADM-1205). The server searches (git grep, in the
// project's sandbox) and returns every match; this panel groups them by file and marks each match on its line.
//
// REPLACE (ADM-1320). The server makes each line's new text (the same rules the write uses, read as git grep reads
// the pattern) and sends it as a preview; changing the Replace text searches again for new previews. A replace sends
// the lines as the search showed them and each file's version from that search: a file that changed since is skipped
// and named, never overwritten. Replace all goes in batches, so no request runs long. Files to include / exclude
// are VS Code's comma-separated patterns.
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { confirm } from '@/composables/useConfirm'
import { notify } from '@/composables/useNotify'
import { whileSandboxStarts } from '@/utils/sandboxStarting'
import { highlight, inView, byFile, replaceBatches } from '@/utils/searchHighlight'

const props = defineProps({
  systemId: { type: Number, required: true },
  repoId: { type: Number, required: true },
  // (path) => true when the file is open in a tab with edits that are not saved: asked about before replacing in it.
  isUnsaved: { type: Function, default: () => false },
})
// 'written': [paths] the replace changed, so open tabs without unsaved edits read them again.
const emit = defineEmits(['open', 'written'])

const TOGGLES = [
  { key: 'matchCase', label: 'Match case', icon: 'lucide:case-sensitive' },
  { key: 'wholeWord', label: 'Match whole word', icon: 'lucide:whole-word' },
  { key: 'regex', label: 'Use regular expression', icon: 'lucide:regex' },
]
// Every group's lines are shown when the whole search is this size or smaller; above it each file opens on a click,
// so a very large result stays quick. Every match is there either way.
const OPEN_ALL_UP_TO = 2000

const inputEl = ref(null)
const q = ref('')
const opts = reactive({ matchCase: false, wholeWord: false, regex: false, ignored: false })
const matches = ref([])
const asked = ref('')
const askedOpts = ref({})
const busy = ref(false)
const waiting = ref(0)
const error = ref('')
const done = ref(false)
const opened = reactive(new Map())
const showReplace = ref(false)
const rep = ref('')
const showDetails = ref(false)
const include = ref('')
const exclude = ref('')
const binary = ref([])
const versions = ref({})
const replaceError = ref('')
// The Replace text the shown previews were made with; null when the search ran without Replace.
const askedRep = ref(null)
const replacing = ref(false)
const progress = reactive({ done: 0, total: 0 })
const summary = ref(null)

const groups = computed(() => byFile(matches.value))
const count = computed(() => matches.value.length)
const isOpen = (g) => opened.has(g.path) ? opened.get(g.path) : count.value <= OPEN_ALL_UP_TO
const toggle = (g) => opened.set(g.path, !isOpen(g))
const baseName = (p) => p.split('/').pop()
const dirName = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
const partsOf = (m) => inView(highlight(m.text, asked.value, askedOpts.value))
// The preview's pieces in the same narrow view as a plain match: what goes and what comes count as the match.
const previewOf = (m) => inView(m.preview.map((p) => ({ ...p, hit: !!(p.del || p.ins) })))
const previewOn = computed(() => showReplace.value && askedRep.value !== null && !replaceError.value)
const titleOf = (m) => (m.redacted ? undefined : (previewOn.value && m.preview ? `${m.text}\n→ ${m.after}` : m.text))
const replaceableIn = (g) => g.matches.filter((m) => m.preview)
// Replace only with the previews on screen: never while a search runs or after the Replace text changed.
const canReplace = computed(() => previewOn.value && done.value && !busy.value && !replacing.value
  && askedRep.value === rep.value && matches.value.some((m) => m.preview))

let seq = 0
let timer = null
let unmounted = false
onBeforeUnmount(() => { unmounted = true; clearTimeout(timer) })

async function run({ keepSummary = false } = {}) {
  clearTimeout(timer)
  const text = q.value
  if (!keepSummary) summary.value = null
  if (!text.trim()) {
    matches.value = []; binary.value = []; done.value = false; error.value = ''; busy.value = false
    askedRep.value = null
    return
  }
  const mine = ++seq
  const sent = { ...opts }
  const withReplace = showReplace.value ? rep.value : undefined
  busy.value = true
  waiting.value = 0
  error.value = ''
  try {
    const { data } = await whileSandboxStarts(
      () => api.searchRepositoryContents(props.systemId, props.repoId, {
        q: text, ...sent, include: include.value.trim(), exclude: exclude.value.trim(), replace: withReplace,
      }),
      { onWaiting: (s) => { if (mine === seq) waiting.value = s }, isCancelled: () => unmounted || mine !== seq })
    if (mine !== seq) return
    matches.value = data.matches || []
    binary.value = data.binary || []
    versions.value = data.versions || {}
    replaceError.value = data.replace_error || ''
    askedRep.value = withReplace ?? null
    asked.value = text
    askedOpts.value = sent
    opened.clear()
    done.value = true
  } catch (e) {
    if (mine !== seq) return
    matches.value = []
    binary.value = []
    askedRep.value = null
    done.value = false
    error.value = e?.response?.data?.error || 'The search could not run.'
  } finally {
    if (mine === seq) { busy.value = false; waiting.value = 0 }
  }
}

const later = () => { clearTimeout(timer); timer = setTimeout(run, 350) }
// Typing searches after a short pause; Enter searches at once. A newer search replaces an older answer.
watch(q, later)
watch(opts, () => { if (q.value.trim()) run() })
// New Replace text, a file pattern, or Replace opened or closed: the previews and the files are searched again.
watch([rep, include, exclude], () => { if (q.value.trim()) later() })
watch(showReplace, () => { if (q.value.trim()) run() })

// ── Replace ────────────────────────────────────────────────────────────────────────────────────────────────────
function replaceLine(m) { return replaceIn([{ path: m.path, matches: [m] }]) }
function replaceFile(g) { return replaceIn([g]) }
async function replaceAll() {
  if (!canReplace.value) return
  const lines = matches.value.filter((m) => m.preview).length
  const files = groups.value.filter((g) => replaceableIn(g).length).length
  const ok = await confirm({
    title: 'Replace in every file?',
    message: `Replace ${lines} matching ${lines === 1 ? 'line' : 'lines'} in ${files} ${files === 1 ? 'file' : 'files'} with “${rep.value}”? Files that changed since the search are left as they are and named.`,
    confirmText: 'Replace all',
  })
  if (ok) await replaceIn(groups.value)
}

async function replaceIn(targets) {
  if (!canReplace.value) return
  // The lines as the search showed them, each file with the version the search read. A protected file goes too, so
  // the server names it as never replaced.
  const files = targets
    .map((g) => ({ path: g.path, sha: versions.value[g.path] || '', protected: g.matches.some((m) => m.redacted),
      lines: g.matches.filter((m) => m.preview).map((m) => ({ line: m.line, text: m.text })) }))
    .filter((f) => f.lines.length || f.protected)
    .map(({ protected: _p, ...f }) => f)
  if (!files.some((f) => f.lines.length)) return
  const unsaved = files.filter((f) => f.lines.length && props.isUnsaved(f.path)).map((f) => f.path)
  if (unsaved.length) {
    const names = unsaved.length === 1 ? unsaved[0] : `${unsaved[0]} and ${unsaved.length - 1} more`
    const ok = await confirm({
      title: unsaved.length === 1 ? 'This file has unsaved edits' : 'Some files have unsaved edits',
      message: `${names} ${unsaved.length === 1 ? 'is' : 'are'} open with edits that are not saved. The replace changes the saved ${unsaved.length === 1 ? 'file' : 'files'}; your tab keeps your edits, and saving it later asks which version to keep.`,
      confirmText: 'Replace anyway',
    })
    if (!ok) return
  }
  const sent = { q: asked.value, ...askedOpts.value, replace: askedRep.value }
  const replaced = []
  const skipped = []
  let lines = 0
  let failure = ''
  replacing.value = true
  progress.done = 0
  progress.total = files.length
  try {
    for (const batch of replaceBatches(files)) {
      let data
      try {
        ;({ data } = await whileSandboxStarts(
          () => api.replaceRepositoryContents(props.systemId, props.repoId, { ...sent, files: batch }),
          { isCancelled: () => unmounted }))
      } catch (e) {
        const body = e?.response?.data
        if (e?.response?.status === 409 && body?.skipped) data = body       // the batch's files all changed
        else { failure = body?.error || 'The replace could not run.'; break }
      }
      replaced.push(...(data.replaced || []))
      skipped.push(...(data.skipped || []))
      lines += data.count || 0
      progress.done += batch.length
    }
  } finally {
    replacing.value = false
  }
  if (unmounted) return
  if (replaced.length) emit('written', replaced.map((r) => r.path))
  summary.value = { count: lines, files: replaced.length, skipped }
  if (failure) notify.error(`${failure}${replaced.length ? ` ${replaced.length} ${replaced.length === 1 ? 'file was' : 'files were'} replaced before it stopped.` : ''}`)
  else if (skipped.length) notify.warning(`Replaced in ${replaced.length} ${replaced.length === 1 ? 'file' : 'files'}; ${skipped.length} not replaced (listed in Search).`)
  else notify.success(`Replaced ${lines} ${lines === 1 ? 'line' : 'lines'} in ${replaced.length} ${replaced.length === 1 ? 'file' : 'files'}`)
  await run({ keepSummary: true })                          // what the files say now, with fresh versions
}

function focus() { inputEl.value?.focus() }
defineExpose({ focus, run, replaceAll })
</script>

<style scoped>
.cs { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.cs button { touch-action: manipulation; }
.cs-form { padding: 8px; border-bottom: 1px solid var(--vm-line); display: flex; flex-direction: column; gap: 8px; }
.cs-field { position: relative; display: flex; align-items: center; }
.cs-input {
  width: 100%;
  padding: 6px 92px 6px 10px;
  background: var(--vm-surface);
  border: 1px solid var(--vm-line-2);
  border-radius: 6px;
  color: var(--vm-ink);
  font-size: 13px;
}
.cs-input::placeholder { color: var(--vm-ink-faint); }
.cs-input:focus { outline: none; border-color: var(--vm-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vm-focus) 20%, transparent); }
.cs-toggles { position: absolute; right: 4px; display: flex; gap: 2px; }
.cs-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 24px; border: 1px solid transparent; border-radius: 4px;
  background: transparent; color: var(--vm-ink-soft); cursor: pointer;
}
.cs-toggle :deep(svg) { width: 15px; height: 15px; }
.cs-toggle:hover { background: color-mix(in srgb, var(--vm-ink) 6%, transparent); color: var(--vm-ink); }
.cs-toggle:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.cs-toggle.on { color: var(--vm-violet-ink); background: var(--vm-violet-soft); border-color: color-mix(in srgb, var(--vm-violet) 45%, transparent); }
.cs-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--vm-ink-soft); cursor: pointer; }
.cs-check input { accent-color: var(--vm-violet); }
.cs-status { margin: 0; padding: 8px 10px 4px; font-size: 12px; color: var(--vm-ink-soft); min-height: 1.5em; }
.cs-error { color: var(--vm-red-ink); }
.cs-body { overflow-y: auto; flex: 1 1 auto; min-height: 0; padding-bottom: 8px; }
.cs-results { list-style: none; margin: 0; padding: 0; }
.cs-query { display: flex; align-items: flex-start; gap: 4px; }
.cs-rep-toggle { flex: 0 0 auto; margin-top: 3px; }
.cs-fields { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.cs-input-rep { padding-right: 36px; }
.cs-opts { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cs-details { display: flex; flex-direction: column; gap: 6px; }
.cs-lbl { display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; color: var(--vm-ink-soft); }
.cs-input.cs-plain { padding-right: 10px; }
.cs-toggle:disabled { opacity: .4; cursor: not-allowed; background: transparent; }
.cs-row { display: flex; align-items: center; min-width: 0; }
.cs-row > .cs-file, .cs-row > .cs-line { flex: 1 1 auto; min-width: 0; }
.cs-act {
  flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 22px; margin-right: 4px; border: 0; border-radius: 4px;
  background: transparent; color: var(--vm-ink-soft); cursor: pointer; opacity: 0;
  transition: opacity 120ms ease, background-color 120ms ease;
}
.cs-act :deep(svg) { width: 14px; height: 14px; }
.cs-row:hover > .cs-act, .cs-row:focus-within > .cs-act, .cs-act.cs-act-on { opacity: 1; }
.cs-act:hover:not(:disabled) { background: color-mix(in srgb, var(--vm-ink) 8%, transparent); color: var(--vm-ink); }
.cs-act:focus-visible { opacity: 1; outline: 2px solid var(--vm-focus); outline-offset: -1px; }
.cs-act:disabled { cursor: not-allowed; color: var(--vm-ink-faint); }
.cs-del { text-decoration: line-through; background: var(--vm-red-soft); color: var(--vm-red-ink); border-radius: 2px; padding: 0 1px; }
.cs-ins { text-decoration: none; background: var(--vm-green-soft); color: var(--vm-green-ink); border-radius: 2px; padding: 0 1px; box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--vm-green) 60%, transparent); }
.cs-note { margin: 6px 8px; padding: 6px 8px; border: 1px solid var(--vm-line); border-radius: 6px; font-size: 12px; color: var(--vm-ink-soft); }
.cs-note-head { margin: 0; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.cs-note-list { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.cs-note-path { font-family: var(--vm-font-mono); font-size: 11.5px; color: var(--vm-ink); overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) { .cs-act { transition: none; } }
.cs-group { margin: 0; }
.cs-lines { list-style: none; margin: 0; padding: 0; }
.cs-file, .cs-line {
  display: flex; align-items: center; gap: 6px; width: 100%;
  border: 0; background: transparent; text-align: left; cursor: pointer; font: inherit;
}
.cs-file { padding: 4px 8px; font-size: 13px; color: var(--vm-ink); }
.cs-line { padding: 2px 8px 2px 28px; font-size: 12.5px; color: var(--vm-ink-soft); }
.cs-file:hover, .cs-line:hover { background: color-mix(in srgb, var(--vm-ink) 5%, transparent); }
.cs-file:focus-visible, .cs-line:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; border-radius: 4px; }
.cs-chev { width: 13px; height: 13px; flex: 0 0 auto; color: var(--vm-ink-faint); }
.cs-fname { flex: 0 0 auto; font-weight: 600; }
.cs-fdir { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; color: var(--vm-ink-faint); }
.cs-count {
  flex: 0 0 auto; font-size: 10.5px; font-weight: 700; line-height: 16px; min-width: 18px; padding: 0 5px;
  text-align: center; border-radius: 8px; background: color-mix(in srgb, var(--vm-ink-faint) 18%, transparent); color: var(--vm-ink-soft);
  font-variant-numeric: tabular-nums;
}
.cs-ln { flex: 0 0 auto; min-width: 2.5em; text-align: right; font: 11px var(--vm-font-mono); color: var(--vm-ink-faint); }
.cs-text { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: pre; font-family: var(--vm-font-mono); font-size: 12px; }
.cs-hidden { font-family: var(--vm-font-sans); font-style: italic; color: var(--vm-ink-faint); white-space: nowrap; }
.cs-ell { color: var(--vm-ink-faint); }
.cs-hit {
  background: var(--vm-amber-soft); color: var(--vm-amber-ink);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vm-amber) 55%, transparent);
  border-radius: 2px; padding: 0 1px;
}
@media (pointer: coarse) { .cs-line, .cs-file { min-height: 40px; } .cs-toggle { width: 36px; height: 32px; } .cs-input { padding-right: 120px; } }
/* Touch and narrow widths: every control is a 44 px target, and a row's replace button is always shown. */
@media (pointer: coarse), (max-width: 640px) {
  .cs-line, .cs-file { min-height: 44px; }
  .cs-toggle, .cs-act { width: 44px; height: 44px; }
  .cs-act { opacity: 1; }
  .cs-input { min-height: 44px; padding-right: 140px; }
  .cs-input-rep { padding-right: 52px; }
  .cs-input.cs-plain { padding-right: 10px; }
  .cs-input { font-size: 16px; }
  .cs-check { min-height: 44px; }
}
</style>
