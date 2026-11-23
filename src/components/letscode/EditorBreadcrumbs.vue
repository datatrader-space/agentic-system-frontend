<template>
  <nav class="bc" aria-label="Breadcrumbs" data-test="breadcrumbs">
    <ol class="bc-list" translate="no">
      <li v-for="seg in folders" :key="seg.path" class="bc-item">
        <button type="button" class="bc-btn" :title="`Show ${seg.path} in Files`" @click="emit('folder', seg.path)">{{ seg.name }}</button>
        <Icon class="bc-sep" icon="lucide:chevron-right" aria-hidden="true" />
      </li>
      <li class="bc-item bc-file">
        <span class="bc-name" :aria-current="chain.length ? undefined : 'location'">{{ fileName }}</span>
      </li>
      <li v-for="(s, i) in chain" :key="s.key" class="bc-item bc-sym">
        <Icon class="bc-sep" icon="lucide:chevron-right" aria-hidden="true" />
        <button type="button" class="bc-btn" :aria-current="i === chain.length - 1 ? 'location' : undefined"
                :title="`Go to ${s.name}`" @click="emit('symbol', s)">
          <Icon class="bc-ic" :icon="symbolIcon(s.kind)" aria-hidden="true" />{{ s.name }}
        </button>
      </li>
    </ol>
  </nav>
</template>

<script setup>
// The breadcrumbs above a file (ADM-1322), as VS Code's: its folders, its name, then the symbols the cursor is in (from
// the language server's outline; none when no server answers). A folder shows it in the Files view; a symbol moves the
// cursor to it. In a narrow editor the first folders give way first: the file's name and its symbols stay readable.
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { symbolIcon } from '@/utils/editorSymbols'

const props = defineProps({
  path: { type: String, default: '' },
  chain: { type: Array, default: () => [] },
})
const emit = defineEmits(['folder', 'symbol'])

const parts = computed(() => (props.path || '').split('/').filter(Boolean))
const fileName = computed(() => parts.value[parts.value.length - 1] || '')
const folders = computed(() => parts.value.slice(0, -1).map((name, i, all) => ({ name, path: all.slice(0, i + 1).join('/') })))
</script>

<style scoped>
.bc { flex: 0 0 auto; border-bottom: 1px solid var(--vm-line); background: var(--vm-surface); min-width: 0; }
.bc-list { display: flex; align-items: center; margin: 0; padding: 0 8px; list-style: none; min-height: 24px; overflow: hidden; }
.bc-item { display: flex; align-items: center; min-width: 0; flex: 0 1 auto; font: 12px var(--vm-font-sans); color: var(--vm-ink-soft); }
/* The folders shrink first; the file and its symbols keep their room. */
.bc-item:not(.bc-file):not(.bc-sym) { flex-shrink: 4; }
.bc-file, .bc-sym { flex-shrink: 1; }
.bc-btn {
  display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; padding: 2px 4px; border: 0; border-radius: 4px;
  background: transparent; color: inherit; font: inherit; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: background-color .15s, color .15s;
}
.bc-btn:hover { background: color-mix(in srgb, var(--vm-ink) 6%, transparent); color: var(--vm-ink); }
.bc-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -1px; }
.bc-name { padding: 2px 4px; color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-sep { width: 12px; height: 12px; flex: 0 0 auto; color: var(--vm-ink-faint); }
.bc-ic { width: 13px; height: 13px; flex: 0 0 auto; color: var(--vm-violet); }
@media (max-width: 640px) { .bc-list { min-height: 44px; } .bc-btn { min-height: 40px; } }
@media (prefers-reduced-motion: reduce) { .bc-btn { transition: none; } }
</style>
