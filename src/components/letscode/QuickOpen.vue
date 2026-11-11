<template>
  <Teleport to="body">
    <div v-if="open" class="qo-scrim" :data-theme="ideTheme" @mousedown.self="close">
      <div class="qo" role="dialog" aria-modal="true" aria-label="Go to file">
        <input ref="input" v-model="raw" class="qo-in" type="text" role="combobox" aria-autocomplete="list"
               aria-controls="qo-list" :aria-expanded="items.length ? 'true' : 'false'"
               :aria-activedescendant="items.length ? `qo-${active}` : undefined"
               placeholder="Go to file by name (add :line to jump to a line)" spellcheck="false" autocomplete="off"
               @keydown="onKey" />
        <p class="qo-status" role="status" aria-live="polite">{{ status }}</p>
        <ul v-if="items.length" id="qo-list" ref="list" class="qo-list" role="listbox" aria-label="Files">
          <li v-for="(f, i) in items" :id="`qo-${i}`" :key="f.path" role="option" class="qo-item"
              :class="{ on: i === active }" :aria-selected="i === active ? 'true' : 'false'"
              @mousemove="active = i" @mousedown.prevent="pick(f)">
            <Icon icon="lucide:file" class="qo-ic" aria-hidden="true" />
            <span class="qo-name"><template v-for="(p, k) in mark(f.name, highlight)" :key="k"><mark v-if="p.hit" class="qo-hit">{{ p.text }}</mark><span v-else>{{ p.text }}</span></template></span>
            <span class="qo-path">{{ dirOf(f.path) }}</span>
            <span v-if="!query.text" class="qo-tag">recently opened</span>
          </li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// Go to file (Ctrl+P / Ctrl+E), as VS Code's quick open (ADM-1205, phase A). With nothing typed it lists the files
// opened most recently; typing searches every file's name in the project. Up / Down move, Enter opens, Escape closes.
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { useIdeTheme } from '@/composables/useIdeTheme'
import { parseQuery, searchTerm, rank, mark, recentFiles } from '@/utils/quickOpen'

const props = defineProps({
  open: { type: Boolean, default: false },
  systemId: { type: Number, required: true },
  repoId: { type: Number, required: true },
})
const emit = defineEmits(['close', 'pick'])
const { theme: ideTheme } = useIdeTheme()

const input = ref(null)
const list = ref(null)
const raw = ref('')
const found = ref([])
const busy = ref(false)
const error = ref('')
const active = ref(0)
const query = computed(() => parseQuery(raw.value))
const highlight = computed(() => searchTerm(query.value.text))
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')

const recent = ref([])
const items = computed(() => {
  if (!query.value.text) return recent.value.map((path) => ({ path, name: path.split('/').pop() }))
  return rank(found.value, query.value.text)
})
const status = computed(() => {
  if (error.value) return error.value
  if (!query.value.text) return recent.value.length ? '' : 'Type a file name.'
  if (busy.value && !found.value.length) return 'Searching…'
  const n = items.value.length
  return n ? `${n} ${n === 1 ? 'file' : 'files'}${query.value.line ? `, line ${query.value.line}` : ''}` : 'No file has that name.'
})

let seq = 0
let timer = null
async function search() {
  const term = searchTerm(query.value.text)
  const mine = ++seq
  if (!term) { found.value = []; busy.value = false; return }
  busy.value = true
  error.value = ''
  try {
    const { data } = await api.getRepositoryFiles(props.systemId, props.repoId, { search: term })
    if (mine !== seq) return
    found.value = (data.entries || []).filter((e) => e.type !== 'directory')
  } catch (e) {
    if (mine !== seq) return
    found.value = []
    error.value = e?.response?.data?.error || 'The files could not be searched.'
  } finally {
    if (mine === seq) busy.value = false
  }
}
// The server is asked again only when the searched word changes ("app.py" then "app.py:4" reuses the answer).
watch(highlight, () => { clearTimeout(timer); timer = setTimeout(search, 120) })
watch(items, () => { active.value = 0 })
onBeforeUnmount(() => clearTimeout(timer))

watch(() => props.open, async (open) => {
  if (!open) return
  raw.value = ''
  found.value = []
  error.value = ''
  recent.value = recentFiles(props.repoId)
  active.value = 0
  await nextTick()
  input.value?.focus()
}, { immediate: true })

function close() { emit('close') }
function pick(f) {
  if (!f) return
  emit('pick', { path: f.path, line: query.value.line })
  emit('close')
}
function onKey(e) {
  const n = items.value.length
  if (e.key === 'ArrowDown') { e.preventDefault(); if (n) active.value = (active.value + 1) % n; scroll() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) active.value = (active.value - 1 + n) % n; scroll() }
  else if (e.key === 'Enter') { e.preventDefault(); pick(items.value[active.value]) }
  else if (e.key === 'Escape') { e.preventDefault(); close() }
}
function scroll() { nextTick(() => list.value?.querySelector('.qo-item.on')?.scrollIntoView?.({ block: 'nearest' })) }
</script>

<style scoped>
.qo-scrim { position: fixed; inset: 0; z-index: 70; display: flex; justify-content: center; align-items: flex-start; padding-top: 12vh; background: color-mix(in srgb, #000 18%, transparent); }
.qo {
  width: min(640px, calc(100vw - 32px)); max-height: 60vh; display: flex; flex-direction: column;
  background: var(--vm-surface); color: var(--vm-ink); border: 1px solid var(--vm-line-2); border-radius: 10px;
  box-shadow: var(--vm-shadow-l); overflow: hidden; font: 13px var(--vm-font-sans);
}
.qo-in {
  margin: 8px; padding: 8px 10px; font: 14px var(--vm-font-sans); color: var(--vm-ink);
  background: var(--vm-surface-soft); border: 1px solid var(--vm-focus); border-radius: 6px; outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vm-focus) 20%, transparent);
}
.qo-status { margin: 0; padding: 0 12px 6px; font-size: 12px; color: var(--vm-ink-faint); min-height: 1.4em; }
.qo-status:empty { display: none; }
.qo-list { list-style: none; margin: 0; padding: 0 4px 6px; overflow-y: auto; }
.qo-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; min-width: 0; }
.qo-item.on { background: color-mix(in srgb, var(--vm-violet) 14%, transparent); }
.qo-ic { width: 15px; height: 15px; flex: 0 0 auto; color: var(--vm-ink-faint); }
.qo-name { flex: 0 0 auto; color: var(--vm-ink); font-weight: 500; }
.qo-hit { background: transparent; color: var(--vm-link); font-weight: 700; padding: 0; }
.qo-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink-faint); font-size: 12px; }
.qo-tag { flex: 0 0 auto; font-size: 11px; color: var(--vm-ink-faint); }
@media (pointer: coarse) { .qo-item { min-height: 44px; } }
@media (max-width: 640px) { .qo-scrim { padding-top: 16px; } }
</style>
