<template>
  <Teleport to="body">
    <div v-if="open" class="qo-scrim" :data-theme="ideTheme" @mousedown.self="close">
      <div class="qo" role="dialog" aria-modal="true" aria-label="Go to file">
        <input ref="input" v-model="raw" class="qo-in" type="text" role="combobox" aria-autocomplete="list"
               aria-controls="qo-list" :aria-expanded="items.length ? 'true' : 'false'"
               :aria-activedescendant="items.length ? `qo-list-${active}` : undefined"
               placeholder="Go to file by name (add :line to jump to a line)" spellcheck="false" autocomplete="off"
               @keydown="onKey($event, { pick, close })" />
        <p class="qo-status" role="status" aria-live="polite">{{ status }}</p>
        <div v-if="items.length" ref="listEl" class="qo-listwrap">
          <FileResultList list-id="qo-list" :items="items" :active="active" :highlight="highlight"
                          :recent-tag="!query.text" @hover="active = $event" @pick="pick" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// Go to file (Ctrl+P / Ctrl+E), as VS Code's quick open (ADM-1205, phase A). With nothing typed it lists the files
// opened most recently; typing searches every file's name in the project. Up / Down move, Enter opens, Escape closes.
// The search, the list and the keys are the ones an @ mention in the chat uses (useFileSearch, FileResultList).
import { ref, computed, watch, nextTick } from 'vue'
import { useIdeTheme } from '@/composables/useIdeTheme'
import { useFileSearch } from '@/composables/useFileSearch'
import { parseQuery } from '@/utils/quickOpen'
import FileResultList from './FileResultList.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  systemId: { type: Number, required: true },
  repoId: { type: Number, required: true },
})
const emit = defineEmits(['close', 'pick'])
const { theme: ideTheme } = useIdeTheme()

const input = ref(null)
const raw = ref('')
const query = computed(() => parseQuery(raw.value))
const nameText = computed(() => query.value.text)
const { items, found, busy, error, recent, active, highlight, listEl, reset, onKey } = useFileSearch({
  systemId: () => props.systemId, repoId: () => props.repoId, text: nameText,
})

const status = computed(() => {
  if (error.value) return error.value
  if (!query.value.text) return recent.value.length ? '' : 'Type a file name.'
  if (busy.value && !found.value.length) return 'Searching…'
  const n = items.value.length
  return n ? `${n} ${n === 1 ? 'file' : 'files'}${query.value.line ? `, line ${query.value.line}` : ''}` : 'No file has that name.'
})

watch(() => props.open, async (open) => {
  if (!open) return
  raw.value = ''
  reset()
  await nextTick()
  input.value?.focus()
}, { immediate: true })

function close() { emit('close') }
function pick(f) {
  if (!f) return
  emit('pick', { path: f.path, line: query.value.line })
  emit('close')
}
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
.qo-listwrap { min-height: 0; overflow-y: auto; }
@media (max-width: 640px) { .qo-scrim { padding-top: 16px; } }
</style>
