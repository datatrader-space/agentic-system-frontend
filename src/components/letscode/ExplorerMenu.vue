<template>
  <Teleport to="body">
    <div v-if="open" class="xm-scrim" @mousedown="close" @contextmenu.prevent="close" />
    <ul
      v-if="open"
      ref="menuEl"
      class="xm"
      role="menu"
      :data-theme="ideTheme"
      :aria-label="label"
      :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
      @keydown="onKey">
      <template v-for="(item, i) in items" :key="item.id || `sep-${i}`">
        <li v-if="item.separator" class="xm-sep" role="separator" />
        <li v-else role="none">
          <button
            type="button"
            role="menuitem"
            class="xm-item"
            :class="{ danger: item.danger }"
            :disabled="item.disabled"
            @click="choose(item)">
            <Icon :icon="item.icon" class="xm-ic" aria-hidden="true" />
            <span class="xm-label">{{ item.label }}</span>
            <kbd v-if="item.keys" class="xm-keys">{{ item.keys }}</kbd>
          </button>
        </li>
      </template>
    </ul>
  </Teleport>
</template>

<script setup>
// The Let's Code explorer's context menu (ADM-1205): right-click, the Menu key or Shift+F10 on a row, or the row's
// "More" button on a touch screen. Arrow keys move, Enter chooses, Escape closes and focus returns to the row.
import { ref, nextTick, watch, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { useIdeTheme } from '@/composables/useIdeTheme'

const props = defineProps({
  open: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  items: { type: Array, default: () => [] },
  label: { type: String, default: 'File actions' },
})
const emit = defineEmits(['select', 'close'])

// Teleported to the body, outside the editor's container: it carries the editor's own theme itself.
const { theme: ideTheme } = useIdeTheme()
const menuEl = ref(null)
const pos = ref({ x: 0, y: 0 })
let opener = null

const buttons = () => [...(menuEl.value?.querySelectorAll('.xm-item:not(:disabled)') || [])]

// Kept inside the window: a menu opened near the right or bottom edge opens toward the middle instead.
function place() {
  const el = menuEl.value
  if (!el) return
  const m = 8
  const w = el.offsetWidth
  const h = el.offsetHeight
  pos.value = {
    x: Math.max(m, Math.min(props.x, window.innerWidth - w - m)),
    y: Math.max(m, Math.min(props.y, window.innerHeight - h - m)),
  }
}

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  opener = document.activeElement
  pos.value = { x: props.x, y: props.y }
  await nextTick()
  place()
  buttons()[0]?.focus()
  window.addEventListener('resize', close)
  window.addEventListener('blur', close)
}, { immediate: true })

function cleanup() {
  window.removeEventListener('resize', close)
  window.removeEventListener('blur', close)
}
onBeforeUnmount(cleanup)

function close() {
  if (!props.open) return
  cleanup()
  emit('close')
  const back = opener
  opener = null
  nextTick(() => { if (back && document.contains(back)) back.focus() })
}

function choose(item) {
  if (item.disabled) return
  cleanup()
  opener = null                 // the action decides where focus goes (an inline name box, a dialog)
  emit('select', item)
  emit('close')
}

function onKey(e) {
  const list = buttons()
  const at = list.indexOf(document.activeElement)
  if (e.key === 'ArrowDown') { e.preventDefault(); list[(at + 1) % list.length]?.focus() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); list[(at - 1 + list.length) % list.length]?.focus() }
  else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus() }
  else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus() }
  else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close() }
}

defineExpose({ close })
</script>

<style scoped>
.xm-scrim { position: fixed; inset: 0; z-index: 60; }
.xm {
  position: fixed;
  z-index: 61;
  min-width: 208px;
  max-width: min(320px, calc(100vw - 16px));
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--vm-surface);
  border: 1px solid var(--vm-line-2);
  border-radius: 8px;
  box-shadow: var(--vm-shadow-l);
  font: 13px var(--vm-font-sans);
}
.xm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--vm-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.xm-item:hover:not(:disabled), .xm-item:focus-visible {
  background: color-mix(in srgb, var(--vm-violet) 12%, transparent);
  outline: none;
}
.xm-item:focus-visible { box-shadow: inset 0 0 0 2px var(--vm-focus); }
.xm-item:disabled { color: var(--vm-ink-faint); cursor: default; }
.xm-item.danger { color: var(--vm-red-ink); }
.xm-ic { width: 15px; height: 15px; flex: 0 0 auto; color: var(--vm-ink-soft); }
.xm-item.danger .xm-ic { color: var(--vm-red-ink); }
.xm-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xm-keys { flex: 0 0 auto; font: 11px var(--vm-font-sans); color: var(--vm-ink-faint); background: none; border: 0; }
.xm-sep { height: 1px; margin: 4px 6px; background: var(--vm-line); }
@media (pointer: coarse) { .xm-item { min-height: 44px; } }
</style>
