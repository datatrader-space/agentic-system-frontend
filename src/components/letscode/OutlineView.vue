<template>
  <div class="ol" data-test="outline">
    <div class="ol-head">
      <span class="ol-file" :title="path">{{ fileName || 'Outline' }}</span>
      <button v-if="rows.length" type="button" class="ol-btn" :aria-label="allOpen ? 'Collapse all' : 'Expand all'"
              :title="allOpen ? 'Collapse all' : 'Expand all'" @click="toggleAll">
        <Icon :icon="allOpen ? 'lucide:chevrons-down-up' : 'lucide:chevrons-up-down'" aria-hidden="true" />
      </button>
    </div>
    <p v-if="!path" class="ol-empty">Open a file to see its outline.</p>
    <p v-else-if="state === 'starting'" class="ol-empty" role="status" aria-live="polite">The language server is starting…</p>
    <p v-else-if="state === 'none'" class="ol-empty" role="status">No outline: no language server answers for this file.</p>
    <p v-else-if="state === 'ready' && !symbols.length" class="ol-empty" role="status">This file has no symbols.</p>
    <ul v-else-if="state === 'ready'" ref="treeEl" class="ol-tree" role="tree" translate="no" :aria-label="`Outline of ${fileName}`" @keydown="onKey">
      <li v-for="r in visible" :key="r.symbol.key" role="treeitem" class="ol-row" :tabindex="r.symbol.key === focusKey ? 0 : -1"
          :data-key="r.symbol.key" :aria-level="r.depth + 1"
          :aria-expanded="r.symbol.children.length ? String(isOpen(r.symbol)) : undefined"
          :aria-current="r.symbol.key === currentKey ? 'true' : undefined"
          :class="{ current: r.symbol.key === currentKey }" :style="{ paddingLeft: `${6 + r.depth * 14}px` }"
          data-test="outline-row" @click="reveal(r.symbol)" @focus="focusKey = r.symbol.key">
        <button v-if="r.symbol.children.length" type="button" class="ol-twist" tabindex="-1"
                :aria-label="isOpen(r.symbol) ? `Collapse ${r.symbol.name}` : `Expand ${r.symbol.name}`"
                @click.stop="toggle(r.symbol)">
          <Icon :icon="isOpen(r.symbol) ? 'lucide:chevron-down' : 'lucide:chevron-right'" aria-hidden="true" />
        </button>
        <span v-else class="ol-twist" aria-hidden="true"></span>
        <Icon class="ol-ic" :icon="symbolIcon(r.symbol.kind)" aria-hidden="true" />
        <span class="ol-name">{{ r.symbol.name }}</span>
        <span class="ol-kind">{{ symbolKind(r.symbol.kind) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
// The Outline view (ADM-1322), as VS Code's: the symbols of the file being edited, from its language server
// (textDocument/documentSymbol). A click, or Enter, shows the symbol in the editor. Up / Down move, Right opens a
// symbol's children, Left closes them. Nothing is listed when no language server answers for the file. Every symbol is
// listed (none is cut off).
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { symbolIcon, symbolKind, flattenSymbols } from '@/utils/editorSymbols'

const props = defineProps({
  path: { type: String, default: '' },
  symbols: { type: Array, default: () => [] },
  state: { type: String, default: 'none' },          // 'starting' | 'ready' | 'none'
  currentKey: { type: String, default: '' },          // the innermost symbol the cursor is in
})
const emit = defineEmits(['reveal'])

const fileName = computed(() => (props.path || '').split('/').pop())
const closed = reactive(new Set())                     // a symbol is open unless closed here
const rows = computed(() => flattenSymbols(props.symbols))
const isOpen = (s) => !closed.has(s.key)
const visible = computed(() => {
  const out = []
  const walk = (list, depth) => {
    for (const s of list) {
      out.push({ symbol: s, depth })
      if (s.children.length && isOpen(s)) walk(s.children, depth + 1)
    }
  }
  walk(props.symbols, 0)
  return out
})
const allOpen = computed(() => !rows.value.some((r) => r.symbol.children.length && closed.has(r.symbol.key)))
watch(() => props.path, () => closed.clear())

const treeEl = ref(null)
const focusKey = ref('')
watch(visible, (v) => { if (!v.some((r) => r.symbol.key === focusKey.value)) focusKey.value = v[0]?.symbol.key || '' }, { immediate: true })

function toggle(s) { if (closed.has(s.key)) closed.delete(s.key); else closed.add(s.key) }
function toggleAll() {
  if (allOpen.value) for (const r of rows.value) { if (r.symbol.children.length) closed.add(r.symbol.key) }
  else closed.clear()
}
function reveal(s) { focusKey.value = s.key; emit('reveal', s) }
function focusRow(key) {
  focusKey.value = key
  nextTick(() => treeEl.value?.querySelector(`[data-key="${key}"]`)?.focus())
}
function onKey(e) {
  const list = visible.value
  const at = list.findIndex((r) => r.symbol.key === focusKey.value)
  const row = list[at]
  if (!row) return
  const s = row.symbol
  const go = {
    ArrowDown: () => list[at + 1] && focusRow(list[at + 1].symbol.key),
    ArrowUp: () => list[at - 1] && focusRow(list[at - 1].symbol.key),
    Home: () => focusRow(list[0].symbol.key),
    End: () => focusRow(list[list.length - 1].symbol.key),
    ArrowRight: () => { if (s.children.length && !isOpen(s)) toggle(s); else if (s.children.length) focusRow(s.children[0].key) },
    ArrowLeft: () => {
      if (s.children.length && isOpen(s)) { toggle(s); return }
      for (let i = at - 1; i >= 0; i--) if (list[i].depth < row.depth) { focusRow(list[i].symbol.key); return }
    },
    Enter: () => reveal(s),
    ' ': () => reveal(s),
  }[e.key]
  if (!go) return
  e.preventDefault()
  go()
}
</script>

<style scoped>
.ol { display: flex; flex-direction: column; min-height: 100%; }
.ol-head { display: flex; align-items: center; gap: 6px; padding: 8px 8px 6px 12px; border-bottom: 1px solid var(--vm-line); }
.ol-file { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink); }
.ol-btn {
  flex: 0 0 auto; display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 6px;
  background: transparent; color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s;
}
.ol-btn :deep(svg) { width: 15px; height: 15px; }
.ol-btn:hover { background: color-mix(in srgb, var(--vm-ink) 6%, transparent); color: var(--vm-ink); }
.ol-btn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.ol-empty { margin: 0; padding: 20px 16px; text-align: center; font-size: 13px; line-height: 1.45; color: var(--vm-ink-faint); }
.ol-tree { list-style: none; margin: 0; padding: 4px 0; }
.ol-row {
  display: flex; align-items: center; gap: 6px; min-height: 26px; padding-right: 10px; cursor: pointer;
  font-size: 13px; color: var(--vm-ink-soft); white-space: nowrap; transition: background-color .1s;
}
/* Every symbol is listed (never cut off): rows off screen are not laid out until they scroll in. */
.ol-row { content-visibility: auto; contain-intrinsic-size: auto 26px; }
.ol-row:hover { background: color-mix(in srgb, var(--vm-ink) 5%, transparent); }
.ol-row:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; border-radius: 4px; }
.ol-row.current { background: var(--vm-violet-soft); }
.ol-row.current .ol-name { color: var(--vm-violet-ink); }
.ol-twist {
  flex: 0 0 auto; display: grid; place-items: center; width: 16px; height: 16px; padding: 0; border: 0; border-radius: 3px;
  background: transparent; color: var(--vm-ink-faint); cursor: pointer;
}
.ol-twist :deep(svg) { width: 13px; height: 13px; }
.ol-twist:hover { background: color-mix(in srgb, var(--vm-ink) 8%, transparent); color: var(--vm-ink); }
.ol-ic { width: 15px; height: 15px; flex: 0 0 auto; color: var(--vm-violet); }
.ol-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--vm-ink); }
.ol-kind { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: 11px; color: var(--vm-ink-faint); }
@media (max-width: 640px) { .ol-row { min-height: 44px; contain-intrinsic-size: auto 44px; } .ol-twist { width: 32px; height: 32px; } .ol-btn { width: 44px; height: 44px; } }
@media (prefers-reduced-motion: reduce) { .ol-row, .ol-btn { transition: none; } }
</style>
