<template>
  <div class="cs">
    <div class="cs-form">
      <div class="cs-field">
        <input
          ref="inputEl"
          v-model="q"
          type="search"
          class="cs-input"
          aria-label="Search in files"
          placeholder="Search in files"
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
      <label class="cs-check">
        <input v-model="opts.ignored" type="checkbox" />
        Include files git ignores
      </label>
    </div>

    <p class="cs-status" role="status" aria-live="polite">
      <template v-if="busy">{{ waiting ? `The project's sandbox is starting. Searching in ${waiting}s…` : 'Searching…' }}</template>
      <template v-else-if="error"><span class="cs-error">{{ error }}</span></template>
      <template v-else-if="done && !count">No results for “{{ asked }}”.</template>
      <template v-else-if="done">{{ count }} {{ count === 1 ? 'result' : 'results' }} in {{ groups.length }} {{ groups.length === 1 ? 'file' : 'files' }}</template>
    </p>

    <ul v-if="groups.length" class="cs-results" aria-label="Search results">
      <li v-for="g in groups" :key="g.path" class="cs-group">
        <button type="button" class="cs-file" :aria-expanded="isOpen(g) ? 'true' : 'false'" @click="toggle(g)">
          <Icon :icon="isOpen(g) ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="cs-chev" aria-hidden="true" />
          <span class="cs-fname">{{ baseName(g.path) }}</span>
          <span class="cs-fdir">{{ dirName(g.path) }}</span>
          <span class="cs-count">{{ g.matches.length }}</span>
        </button>
        <ul v-if="isOpen(g)" class="cs-lines">
          <li v-for="m in g.matches" :key="`${m.line}:${m.column}`">
            <button type="button" class="cs-line" :title="m.redacted ? undefined : m.text"
                    @click="emit('open', { path: m.path, line: m.line, column: m.column })">
              <span class="cs-ln">{{ m.line }}</span>
              <span v-if="m.redacted" class="cs-text cs-hidden">Not shown: this file holds secrets</span>
              <span v-else class="cs-text"><template v-for="(p, i) in partsOf(m)" :key="i"><mark v-if="p.hit" class="cs-hit">{{ p.text }}</mark><span v-else :class="{ 'cs-ell': p.ellipsis }">{{ p.text }}</span></template></span>
            </button>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<script setup>
// Search inside the project's files, as VS Code's Search view (ADM-1205). The server searches (git grep, in the
// project's sandbox) and returns every match; this panel groups them by file and marks each match on its line.
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { whileSandboxStarts } from '@/utils/sandboxStarting'
import { highlight, inView, byFile } from '@/utils/searchHighlight'

const props = defineProps({
  systemId: { type: Number, required: true },
  repoId: { type: Number, required: true },
})
const emit = defineEmits(['open'])

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

const groups = computed(() => byFile(matches.value))
const count = computed(() => matches.value.length)
const isOpen = (g) => opened.has(g.path) ? opened.get(g.path) : count.value <= OPEN_ALL_UP_TO
const toggle = (g) => opened.set(g.path, !isOpen(g))
const baseName = (p) => p.split('/').pop()
const dirName = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
const partsOf = (m) => inView(highlight(m.text, asked.value, askedOpts.value))

let seq = 0
let timer = null
let unmounted = false
onBeforeUnmount(() => { unmounted = true; clearTimeout(timer) })

async function run() {
  clearTimeout(timer)
  const text = q.value
  if (!text.trim()) { matches.value = []; done.value = false; error.value = ''; busy.value = false; return }
  const mine = ++seq
  const sent = { ...opts }
  busy.value = true
  waiting.value = 0
  error.value = ''
  try {
    const { data } = await whileSandboxStarts(
      () => api.searchRepositoryContents(props.systemId, props.repoId, { q: text, ...sent }),
      { onWaiting: (s) => { if (mine === seq) waiting.value = s }, isCancelled: () => unmounted || mine !== seq })
    if (mine !== seq) return
    matches.value = data.matches || []
    asked.value = text
    askedOpts.value = sent
    opened.clear()
    done.value = true
  } catch (e) {
    if (mine !== seq) return
    matches.value = []
    done.value = false
    error.value = e?.response?.data?.error || 'The search could not run.'
  } finally {
    if (mine === seq) { busy.value = false; waiting.value = 0 }
  }
}

// Typing searches after a short pause; Enter searches at once. A newer search replaces an older answer.
watch(q, () => { clearTimeout(timer); timer = setTimeout(run, 350) })
watch(opts, () => { if (q.value.trim()) run() })

function focus() { inputEl.value?.focus() }
defineExpose({ focus, run })
</script>

<style scoped>
.cs { display: flex; flex-direction: column; min-height: 0; height: 100%; }
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
.cs-results { list-style: none; margin: 0; padding: 0 0 8px; overflow-y: auto; flex: 1 1 auto; min-height: 0; }
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
</style>
