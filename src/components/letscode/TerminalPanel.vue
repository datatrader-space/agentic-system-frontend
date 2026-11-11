<template>
  <!-- The Terminal tab of a Let's Code project (ADM-1196; as VS Code's terminal since ADM-1211). "Coding Agent" shows
       the commands the agent ran; up to three of the person's own shells in the project's sandbox, each named after
       its shell and the folder it is in, kept running when the page is left (it reattaches) and ended by its close
       button. -->
  <div class="tp">
    <div class="tp-bar">
      <div class="tp-tabs" role="tablist" aria-label="Terminals">
        <button type="button" role="tab" class="tp-tab" :class="{ on: current === 'agent' }"
                :aria-selected="current === 'agent' ? 'true' : 'false'" @click="current = 'agent'">
          <Icon icon="lucide:sparkles" aria-hidden="true" /> Coding Agent
          <span v-if="agentCommands.length" class="tp-count">{{ agentCommands.length }}</span>
        </button>
        <div v-for="s in shells" :key="s.n" class="tp-tabwrap" :class="{ on: current === s.n }">
          <button type="button" role="tab" class="tp-tab" :aria-selected="current === s.n ? 'true' : 'false'"
                  :title="tooltipOf(s)" @click="current = s.n">
            <Icon icon="lucide:square-terminal" aria-hidden="true" />
            <span class="tp-name">{{ labelOf(s) }}</span>
            <span v-if="folderOf(s)" class="tp-dir">{{ folderOf(s) }}</span>
          </button>
          <button type="button" class="tp-x" :aria-label="`End ${labelOf(s)}`" title="End this terminal" @click="endShell(s.n)">
            <Icon icon="lucide:x" aria-hidden="true" />
          </button>
        </div>
        <div v-if="shells.length < MAX" class="tp-addwrap">
          <button type="button" class="tp-add" aria-label="New terminal (bash)" title="New terminal (bash)" @click="addShell()">
            <Icon icon="lucide:plus" aria-hidden="true" />
          </button>
          <button ref="pickBtn" type="button" class="tp-add tp-pick" aria-label="Choose a shell for a new terminal"
                  title="Choose a shell" aria-haspopup="menu" @click="openShellMenu">
            <Icon icon="lucide:chevron-down" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div class="tp-tools" role="toolbar" aria-label="Terminal actions">
        <button type="button" class="tp-tool" title="Find (Ctrl+F)" aria-label="Find in the terminal" @click="openFind">
          <Icon icon="lucide:search" aria-hidden="true" />
        </button>
        <button type="button" class="tp-tool" title="Clear" aria-label="Clear the terminal" @click="clearCurrent">
          <Icon icon="lucide:eraser" aria-hidden="true" />
        </button>
        <button type="button" class="tp-tool" :disabled="current === 'agent'" :title="current === 'agent' ? 'The Coding Agent\'s list cannot be ended' : 'End this terminal'"
                aria-label="End this terminal" @click="endShell(current)">
          <Icon icon="lucide:trash-2" aria-hidden="true" />
        </button>
        <button type="button" class="tp-tool" :aria-pressed="maximized ? 'true' : 'false'"
                :title="maximized ? 'Restore the panel' : 'Maximize the panel'"
                :aria-label="maximized ? 'Restore the panel' : 'Maximize the panel'" @click="emit('maximize')">
          <Icon :icon="maximized ? 'lucide:minimize-2' : 'lucide:maximize-2'" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div class="tp-body">
      <!-- Find in the terminal: every match is counted. Enter next, Shift+Enter previous, Escape closes. -->
      <div v-if="findOpen" class="tp-find" role="search">
        <input ref="findInput" v-model="findText" class="tp-find-in" type="text" aria-label="Find in the terminal"
               placeholder="Find" spellcheck="false" @input="runFind(false, true)" @keydown="onFindKey" />
        <button v-for="t in FIND_TOGGLES" :key="t.key" type="button" class="tp-ft" :class="{ on: findOpts[t.key] }"
                :aria-pressed="findOpts[t.key] ? 'true' : 'false'" :title="t.label" :aria-label="t.label"
                @click="findOpts[t.key] = !findOpts[t.key]; runFind(false, true)">
          <Icon :icon="t.icon" aria-hidden="true" />
        </button>
        <span class="tp-find-n" aria-live="polite">{{ findSummary }}</span>
        <button type="button" class="tp-ft" title="Previous (Shift+Enter)" aria-label="Previous match" @click="runFind(true)">
          <Icon icon="lucide:arrow-up" aria-hidden="true" />
        </button>
        <button type="button" class="tp-ft" title="Next (Enter)" aria-label="Next match" @click="runFind(false)">
          <Icon icon="lucide:arrow-down" aria-hidden="true" />
        </button>
        <button type="button" class="tp-ft" title="Close (Escape)" aria-label="Close find" @click="closeFind">
          <Icon icon="lucide:x" aria-hidden="true" />
        </button>
      </div>
      <ProjectTerminal v-show="current === 'agent'" :ref="(el) => setRef('agent', el)" mode="agent" :repo-id="repoId"
                       :entries="agentCommands" :active="current === 'agent'" :font-size="fontSize"
                       @find="openFind" @font="setFont" @menu="openTermMenu" @results="findResults = $event" />
      <ProjectTerminal v-for="s in shells" v-show="current === s.n" :key="`${repoId}-${s.n}`"
                       :ref="(el) => setRef(s.n, el)" mode="shell" :repo-id="repoId" :n="s.n" :shell="s.shell || ''"
                       :active="current === s.n" :font-size="fontSize"
                       @info="onInfo(s.n, $event)" @cwd="onCwd(s.n, $event)" @find="openFind" @font="setFont"
                       @menu="openTermMenu" @results="findResults = $event" />
      <p v-if="!ready" class="tp-wait">The terminal opens when the project is ready.</p>
    </div>
    <ExplorerMenu :open="menu.open" :x="menu.x" :y="menu.y" :items="menu.items" :label="menu.label"
                  @select="onMenu" @close="menu.open = false" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import ProjectTerminal from './ProjectTerminal.vue'
import ExplorerMenu from './ExplorerMenu.vue'

const props = defineProps({
  repoId: { type: Number, required: true },
  ready: { type: Boolean, default: false },
  agentCommands: { type: Array, default: () => [] },
  maximized: { type: Boolean, default: false },
})
const emit = defineEmits(['maximize'])

const MAX = 3
// The shells a new terminal can start (the server accepts only these names; bash is VS Code's default on Linux).
const SHELLS = [
  { id: 'bash', label: 'bash', icon: 'lucide:square-terminal' },
  { id: 'zsh', label: 'zsh', icon: 'lucide:square-terminal' },
  { id: 'sh', label: 'sh', icon: 'lucide:square-terminal' },
]
const DEFAULT_SHELL = 'bash'

// {n, shell}: terminal n of this project, and the shell it runs (what the server says once connected).
const shells = ref([])
const current = ref('agent')
const refs = {}
function setRef(key, el) { if (el) refs[key] = el; else delete refs[key] }
// What each terminal is and where it is: {shell, root, project, cwd} by terminal number.
const where = reactive({})

function addShell(shell = DEFAULT_SHELL) {
  if (!props.ready || shells.value.length >= MAX) return
  const n = [1, 2, 3].find(x => !shells.value.some(s => s.n === x))
  shells.value = [...shells.value, { n, shell }].sort((a, b) => a.n - b.n)
  where[n] = { shell }
  current.value = n
}
function endShell(n) {
  if (n === 'agent') return
  try { refs[n]?.end() } catch { /* already gone */ }
  shells.value = shells.value.filter(s => s.n !== n)
  delete where[n]
  if (current.value === n) current.value = shells.value.length ? shells.value[shells.value.length - 1].n : 'agent'
}
function onInfo(n, info) {
  where[n] = { ...(where[n] || {}), ...info }
  shells.value = shells.value.map(s => (s.n === n && info.shell ? { ...s, shell: info.shell } : s))
}
function onCwd(n, cwd) { where[n] = { ...(where[n] || {}), cwd } }

// "bash", and "bash (2)" when two terminals run the same shell, as VS Code numbers them.
function labelOf(s) {
  const name = (where[s.n]?.shell || s.shell || 'terminal')
  const same = shells.value.filter(x => (where[x.n]?.shell || x.shell || 'terminal') === name)
  return same.length > 1 ? `${name} (${same.findIndex(x => x.n === s.n) + 1})` : name
}
// The folder the shell is in, from the project's top: "shop/app/api" shows as "app/api"; the top shows nothing.
function relOf(s) {
  const w = where[s.n] || {}
  if (!w.cwd) return ''
  if (w.root && (w.cwd === w.root || w.cwd.startsWith(`${w.root}/`))) return w.cwd.slice(w.root.length + 1)
  return w.cwd
}
function folderOf(s) {
  const rel = relOf(s)
  if (!rel) return ''
  const parts = rel.split('/').filter(Boolean)
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : parts.join('/')
}
function tooltipOf(s) {
  const w = where[s.n] || {}
  const rel = relOf(s)
  const place = w.project ? `${w.project}${rel ? `/${rel}` : ''}` : (rel || 'the project folder')
  return `${labelOf(s)} in ${place}`
}

// Font size for every terminal of the editor (Ctrl+= / Ctrl+- / Ctrl+0), kept in this browser.
const FONT_KEY = 'lets-code:terminal-font'
const FONT_MIN = 9
const FONT_MAX = 28
const FONT_DEFAULT = 13
function storedFont() {
  try {
    const v = Number(localStorage.getItem(FONT_KEY))
    return v >= FONT_MIN && v <= FONT_MAX ? v : FONT_DEFAULT
  } catch { return FONT_DEFAULT }
}
const fontSize = ref(storedFont())
function setFont(delta) {
  const next = delta === 0 ? FONT_DEFAULT : Math.min(FONT_MAX, Math.max(FONT_MIN, fontSize.value + delta))
  fontSize.value = next
  try { localStorage.setItem(FONT_KEY, String(next)) } catch { /* kept for this visit */ }
}

function clearCurrent() { refs[current.value]?.clear?.() }

// Find in the terminal shown.
const FIND_TOGGLES = [
  { key: 'caseSensitive', label: 'Match case', icon: 'lucide:case-sensitive' },
  { key: 'wholeWord', label: 'Match whole word', icon: 'lucide:whole-word' },
  { key: 'regex', label: 'Use regular expression', icon: 'lucide:regex' },
]
const findOpen = ref(false)
const findText = ref('')
const findOpts = reactive({ caseSensitive: false, wholeWord: false, regex: false })
const findResults = ref({ index: -1, count: 0 })
const findInput = ref(null)
const findSummary = computed(() => {
  if (!findText.value) return ''
  const { index, count } = findResults.value
  if (!count) return 'No results'
  return index >= 0 ? `${index + 1} of ${count}` : `${count} found`
})
function openFind() {
  findOpen.value = true
  nextTick(() => { findInput.value?.focus(); findInput.value?.select() })
}
function runFind(back = false, fromStart = false) {
  const t = refs[current.value]
  if (!t?.find) return
  if (fromStart) t.find(findText.value, findOpts, false)
  else t.find(findText.value, findOpts, back)
}
function closeFind() {
  findOpen.value = false
  findText.value = ''
  refs[current.value]?.clearFind?.()
}
function onFindKey(e) {
  if (e.key === 'Enter') { e.preventDefault(); runFind(e.shiftKey) }
  else if (e.key === 'Escape') { e.preventDefault(); closeFind() }
}
watch(current, () => { if (findOpen.value && findText.value) nextTick(() => runFind(false, true)) })

// Menus: the shell picker ("+ ▾") and the terminal's right-click menu.
const menu = reactive({ open: false, x: 0, y: 0, items: [], label: '', kind: '' })
const pickBtn = ref(null)
function openShellMenu() {
  const r = pickBtn.value?.getBoundingClientRect()
  menu.kind = 'shell'
  menu.label = 'New terminal with'
  menu.items = SHELLS.map(s => ({ id: s.id, label: s.id === DEFAULT_SHELL ? `${s.label} (default)` : s.label, icon: s.icon }))
  menu.x = r ? r.left : 0
  menu.y = r ? r.bottom : 0
  menu.open = true
}
function openTermMenu({ x, y }) {
  const t = refs[current.value]
  const shell = current.value !== 'agent'
  menu.kind = 'term'
  menu.label = 'Terminal'
  menu.items = [
    { id: 'copy', label: 'Copy', icon: 'lucide:copy', keys: 'Ctrl+Shift+C', disabled: !t?.hasSelection?.() },
    ...(shell ? [{ id: 'paste', label: 'Paste', icon: 'lucide:clipboard-paste', keys: 'Ctrl+V' }] : []),
    { id: 'select-all', label: 'Select all', icon: 'lucide:text-select' },
    { separator: true },
    { id: 'find', label: 'Find', icon: 'lucide:search', keys: 'Ctrl+F' },
    { id: 'clear', label: 'Clear', icon: 'lucide:eraser' },
  ]
  menu.x = x
  menu.y = y
  menu.open = true
}
function onMenu(item) {
  if (menu.kind === 'shell') { addShell(item.id); return }
  const t = refs[current.value]
  if (item.id === 'copy') t?.copy?.()
  else if (item.id === 'paste') t?.paste?.()
  else if (item.id === 'select-all') t?.selectAll?.()
  else if (item.id === 'find') openFind()
  else if (item.id === 'clear') t?.clear?.()
}

// Which shells were open, per project, so a reload reattaches all of them: a shell keeps running on the server
// (`lc-<repo>-<user>-<n>`) and only Terminal 1 came back, leaving 2 and 3 running with no tab (ADM-1200). Kept as
// [{n, shell}]; a list kept before ADM-1211 holds numbers only (the server says each one's shell on reattach).
const storeKey = (repo) => `lets-code:terminals:${repo}`
function remembered(repo) {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(repo)) || 'null')
    if (!Array.isArray(v)) return null
    const seen = new Set()
    return v.map(x => (typeof x === 'number' ? { n: x, shell: '' } : x))
      .filter(x => x && [1, 2, 3].includes(x.n) && !seen.has(x.n) && seen.add(x.n))
      .map(x => ({ n: x.n, shell: SHELLS.some(s => s.id === x.shell) ? x.shell : '' }))
      .sort((a, b) => a.n - b.n)
  } catch { return null }
}
function remember(repo, list) {
  try { localStorage.setItem(storeKey(repo), JSON.stringify(list)) } catch { /* storage blocked: nothing kept */ }
}
watch(shells, (list) => remember(props.repoId, list))

// Open what was open; the first visit opens one bash terminal, as VS Code does. Once the project is ready.
function restore() {
  const list = remembered(props.repoId)
  if (list && list.length) {
    shells.value = list
    for (const s of list) where[s.n] = { shell: s.shell }
    current.value = list[0].n
  } else addShell()
}
watch(() => props.ready, (r) => { if (r && !shells.value.length) restore() }, { immediate: true })
// Another project: its own terminals.
watch(() => props.repoId, () => {
  shells.value = []
  for (const k of Object.keys(where)) delete where[k]
  current.value = 'agent'
  if (props.ready) restore()
})

defineExpose({ addShell })
</script>

<style scoped>
.tp { display: flex; flex-direction: column; height: 100%; }
.tp-bar { display: flex; align-items: flex-end; gap: 8px; padding: 4px 8px 0; flex: 0 0 auto; min-width: 0; }
.tp-tabs { display: flex; align-items: center; gap: 2px; flex: 1 1 auto; min-width: 0; overflow-x: auto; }
.tp-tabwrap { display: inline-flex; align-items: center; border-radius: 6px 6px 0 0; min-width: 0; }
.tp-tab {
  display: inline-flex; align-items: center; gap: 6px; background: transparent; border: none; color: var(--vm-ink-soft);
  font: 600 12px var(--vm-font-sans); padding: 6px 10px; cursor: pointer; border-radius: 6px 6px 0 0; white-space: nowrap;
  transition: color .15s, background-color .15s; min-width: 0;
}
.tp-tab :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; }
.tp-tab:hover { color: var(--vm-ink); }
.tp-tab.on, .tp-tabwrap.on .tp-tab { color: var(--vm-ink); background: var(--vm-surface-soft); }
.tp-tabwrap.on { background: var(--vm-surface-soft); }
.tp-name { flex: 0 0 auto; }
/* The folder the shell is in, quieter than the shell's name (the full place is the tab's tooltip). */
.tp-dir { font-weight: 500; color: var(--vm-ink-faint); max-width: 16ch; overflow: hidden; text-overflow: ellipsis; }
.tp-count { background: var(--vm-violet); color: var(--cb-on-solid, #fff); font-size: 10px; font-weight: 700; border-radius: 8px; padding: 0 5px; line-height: 16px; min-width: 16px; text-align: center; }
.tp-addwrap { display: inline-flex; align-items: center; flex: 0 0 auto; }
.tp-x, .tp-add, .tp-tool, .tp-ft {
  display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 4px; background: transparent;
  color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s; flex: 0 0 auto;
}
.tp-pick { width: 18px; }
.tp-x:hover, .tp-add:hover, .tp-tool:hover:not(:disabled), .tp-ft:hover { background: color-mix(in srgb, var(--vm-ink) 8%, transparent); color: var(--vm-ink); }
.tp-tool:disabled { color: var(--vm-ink-faint); cursor: default; opacity: .6; }
.tp-x :deep(svg), .tp-add :deep(svg), .tp-tool :deep(svg), .tp-ft :deep(svg) { width: 14px; height: 14px; }
.tp-tools { display: flex; align-items: center; gap: 2px; padding-bottom: 3px; flex: 0 0 auto; }
.tp-tab:focus-visible, .tp-x:focus-visible, .tp-add:focus-visible, .tp-tool:focus-visible, .tp-ft:focus-visible {
  outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 1px;
}
.tp-body { position: relative; flex: 1; min-height: 0; border-top: 1px solid var(--vm-line); }
.tp-body > .pt { position: absolute; inset: 0; }
.tp-wait { position: absolute; left: 14px; top: 10px; margin: 0; color: var(--vm-ink-faint); font-size: 13px; }
/* Find: a small bar over the terminal's top right, as in VS Code. */
.tp-find {
  position: absolute; top: 6px; right: 14px; z-index: 5; display: flex; align-items: center; gap: 2px;
  padding: 4px; background: var(--vm-surface); border: 1px solid var(--vm-line-2); border-radius: 6px;
  box-shadow: var(--vm-shadow-m); max-width: calc(100% - 28px);
}
.tp-find-in {
  width: 180px; min-width: 80px; padding: 3px 8px; font: 12.5px var(--vm-font-sans); color: var(--vm-ink);
  background: var(--vm-surface-soft); border: 1px solid var(--vm-line-2); border-radius: 4px;
}
.tp-find-in:focus { outline: none; border-color: var(--vm-focus); box-shadow: 0 0 0 2px color-mix(in srgb, var(--vm-focus) 22%, transparent); }
.tp-ft.on { color: var(--vm-violet-ink); background: var(--vm-violet-soft); }
.tp-find-n { min-width: 7ch; padding: 0 6px; font: 12px var(--vm-font-sans); color: var(--vm-ink-soft); white-space: nowrap; }
@media (max-width: 640px) {
  .tp-tab { min-height: 44px; }
  .tp-x, .tp-add, .tp-tool, .tp-ft { width: 40px; height: 40px; }
  .tp-find-in { width: 120px; }
  .tp-dir { display: none; }
}
</style>
