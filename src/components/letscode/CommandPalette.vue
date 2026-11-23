<template>
  <Teleport to="body">
    <div v-if="open" class="cp-scrim" :data-theme="ideTheme" @mousedown.self="close">
      <div class="cp" role="dialog" aria-modal="true" aria-label="Command palette">
        <input ref="input" v-model="query" class="cp-in" type="text" role="combobox" aria-autocomplete="list"
               aria-controls="cp-list" :aria-expanded="items.length ? 'true' : 'false'"
               :aria-activedescendant="items.length ? `cp-item-${active}` : undefined"
               placeholder="Type a command…" aria-label="Type a command" name="command" spellcheck="false" autocomplete="off"
               data-test="cp-input"
               @keydown="onKey" />
        <p class="cp-status" role="status" aria-live="polite">{{ status }}</p>
        <ul v-if="items.length" id="cp-list" ref="listEl" class="cp-list" role="listbox" aria-label="Commands" translate="no">
          <li v-for="(c, i) in items" :id="`cp-item-${i}`" :key="c.id" role="option" class="cp-item"
              :class="{ on: i === active }" :aria-selected="i === active ? 'true' : 'false'" data-test="cp-item"
              @mousemove="active = i" @click="run(c)">
            <Icon class="cp-ic" :icon="c.icon || 'lucide:chevron-right'" aria-hidden="true" />
            <span class="cp-label"><span v-if="c.group" class="cp-group">{{ c.group }}: </span>{{ c.label }}</span>
            <kbd v-if="c.keys" class="cp-keys">{{ c.keys }}</kbd>
          </li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// The editor's command palette (Ctrl+Shift+P, ADM-1322), as VS Code's: every command the editor has now, searched by
// what is typed. Up / Down / Home / End / Page Up / Page Down move, Enter runs, Escape closes. The editor gives the
// commands (each with what it does); a command that cannot run now (no file open, no change to save) is not given.
// Monaco's own list of editor commands stays on F1, and is one of the commands here.
import { ref, computed, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useIdeTheme } from '@/composables/useIdeTheme'
import { filterCommands } from '@/utils/commandPalette'

const props = defineProps({
  open: { type: Boolean, default: false },
  commands: { type: Array, default: () => [] },     // [{ id, label, group?, keys?, icon? }]
})
const emit = defineEmits(['close', 'run'])
const { theme: ideTheme } = useIdeTheme()

const input = ref(null)
const listEl = ref(null)
const query = ref('')
const active = ref(0)
const items = computed(() => filterCommands(props.commands, query.value))
const status = computed(() => {
  if (!query.value.trim()) return ''
  const n = items.value.length
  return n ? `${n} ${n === 1 ? 'command' : 'commands'}` : 'No command matches.'
})

watch(query, () => { active.value = 0 })
watch(() => props.open, async (open) => {
  if (!open) return
  query.value = ''
  active.value = 0
  await nextTick()
  input.value?.focus()
}, { immediate: true })

function close() { emit('close') }
function run(c) {
  if (!c) return
  emit('run', c.id)
}
function show(i) {
  const n = items.value.length
  if (!n) return
  active.value = Math.max(0, Math.min(n - 1, i))
  nextTick(() => listEl.value?.querySelector(`#cp-item-${active.value}`)?.scrollIntoView?.({ block: 'nearest' }))
}
const PAGE = 8
function onKey(e) {
  const keys = {
    ArrowDown: () => show(active.value + 1 >= items.value.length ? 0 : active.value + 1),
    ArrowUp: () => show(active.value - 1 < 0 ? items.value.length - 1 : active.value - 1),
    PageDown: () => show(active.value + PAGE),
    PageUp: () => show(active.value - PAGE),
    Enter: () => run(items.value[active.value]),
    Escape: () => close(),
  }
  if (e.key === 'Home' && e.ctrlKey) keys.Home = () => show(0)
  if (e.key === 'End' && e.ctrlKey) keys.End = () => show(items.value.length - 1)
  const fn = keys[e.key]
  if (!fn) return
  e.preventDefault()
  e.stopPropagation()
  fn()
}
</script>

<style scoped>
.cp-scrim { position: fixed; inset: 0; z-index: 70; display: flex; justify-content: center; align-items: flex-start; padding-top: 12vh; background: color-mix(in srgb, #000 18%, transparent); }
.cp {
  width: min(640px, calc(100vw - 32px)); max-height: 60vh; display: flex; flex-direction: column;
  background: var(--vm-surface); color: var(--vm-ink); border: 1px solid var(--vm-line-2); border-radius: 10px;
  box-shadow: var(--vm-shadow-l); overflow: hidden; font: 13px var(--vm-font-sans);
}
.cp-in {
  margin: 8px; padding: 8px 10px; font: 14px var(--vm-font-sans); color: var(--vm-ink);
  background: var(--vm-surface-soft); border: 1px solid var(--vm-focus); border-radius: 6px; outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vm-focus) 20%, transparent);
}
.cp-status { margin: 0; padding: 0 12px 6px; font-size: 12px; color: var(--vm-ink-faint); min-height: 1.4em; }
.cp-status:empty { display: none; }
.cp-list { list-style: none; margin: 0; padding: 0 0 6px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.cp-item {
  display: flex; align-items: center; gap: 10px; min-height: 32px; padding: 0 12px; cursor: pointer;
  color: var(--vm-ink-soft); transition: background-color .12s, color .12s;
}
.cp-item { content-visibility: auto; contain-intrinsic-size: auto 32px; }
.cp-item.on { background: var(--vm-violet-soft); color: var(--vm-violet-ink); }
.cp-ic { width: 15px; height: 15px; flex: 0 0 auto; color: var(--vm-ink-faint); }
.cp-item.on .cp-ic { color: inherit; }
.cp-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink); }
.cp-item.on .cp-label { color: inherit; }
.cp-group { color: var(--vm-ink-soft); }
.cp-keys {
  flex: 0 0 auto; padding: 1px 6px; border: 1px solid var(--vm-line-2); border-radius: 4px; background: var(--vm-surface-soft);
  font: 11px var(--vm-font-mono); color: var(--vm-ink-soft);
}
@media (max-width: 640px) { .cp-scrim { padding-top: 16px; } .cp-item { min-height: 44px; } .cp-keys { display: none; } }
@media (prefers-reduced-motion: reduce) { .cp-item { transition: none; } }
</style>
