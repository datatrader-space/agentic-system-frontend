<template>
  <!-- An icon-only button (owner's rule for the editor, 2026-11-19): a lucide icon, its name for screen readers, and a
       tooltip with the name and its shortcut, e.g. "Split (Ctrl+B)". At least 24 px (44 px on phones), with a visible
       focus ring. Text buttons stay only where an icon would be unclear (Export, confirm and cancel, price cards). -->
  <button type="button" class="ib" :class="{ 'is-on': pressed === true, 'is-primary': primary }" :aria-label="label" :data-tip="tip"
          :aria-keyshortcuts="ariaKeys" :aria-pressed="pressed == null ? undefined : (pressed ? 'true' : 'false')">
    <component :is="icon" :size="size" :stroke-width="1.8" aria-hidden="true" />
  </button>
</template>
<script setup>
import { computed } from 'vue'

const props = defineProps({ icon: { type: [Object, Function], required: true }, label: { type: String, required: true }, shortcut: { type: String, default: '' },
  pressed: { type: Boolean, default: null }, primary: Boolean, size: { type: Number, default: 16 } })
const tip = computed(() => props.shortcut ? `${props.label} (${props.shortcut})` : props.label)
// The shortcut in ARIA's form ("Ctrl+Shift+Z" → "Control+Shift+Z", "Left" → "ArrowLeft").
const KEY = { Ctrl: 'Control', Esc: 'Escape', Left: 'ArrowLeft', Right: 'ArrowRight', Up: 'ArrowUp', Down: 'ArrowDown', '+': 'Plus' }
const ariaKeys = computed(() => (props.shortcut ? props.shortcut.split(/\+(?!$)/).map(k => KEY[k] || k).join('+') : undefined))
</script>
<style scoped>
.ib{display:inline-grid;place-items:center;flex:none;min-width:28px;min-height:28px;padding:4px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface);color:var(--vm-ink);cursor:pointer}
.ib:hover:not(:disabled){background:var(--vm-surface-2)}
.ib:disabled{opacity:.45;cursor:not-allowed}
.ib.is-on{border-color:var(--vm-primary);background:var(--vm-primary-soft)}
.ib.is-primary{border-color:var(--vm-violet);background:var(--vm-violet-soft)}
.ib:focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:2px}
/* The name and shortcut as a tooltip, on hover and on keyboard focus (a native title shows on hover only). It is laid
   out only while shown: a hidden one still took space past its container's edge, so a button at the right of a
   scrolling box (the export dialog's Close) gave that box a horizontal scrollbar (live, 2026-11-20). */
.ib{position:relative}
.ib::after{content:attr(data-tip);display:none;position:absolute;bottom:calc(100% + 6px);left:50%;translate:-50% 0;z-index:30;padding:4px 8px;border-radius:5px;background:var(--vm-ink);color:var(--vm-surface);font:500 12px/1.3 var(--vm-font-sans);white-space:nowrap;pointer-events:none}
.ib:hover::after,.ib:focus-visible::after{display:block}
@media (max-width:767px){.ib{min-width:44px;min-height:44px}}
</style>
