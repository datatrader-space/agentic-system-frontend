<!--
  A side or bottom drawer (sheet) on Reka UI's Dialog (ADM-1333, plan §4): the run history, versions, shortcuts and,
  at 768-1023 px, the builder's console. Same guarantees as AppDialog (focus trapped and returned to the opener, Esc
  closes, scroll lock, role="dialog" + aria-modal, labelled by its title), drawn against one edge of the screen.

    <AppSheet v-model:open="showRuns" title="Run history" side="right" size="md">...</AppSheet>

  side: right | left | bottom. size: sm | md | lg (the width of a side sheet, the height of a bottom one).
  Slots: default (body), footer, header-actions (buttons beside the title), trigger (optional).
  Reka's own Drawer (swipe, snap points) is not used: these panels need no gestures, and Dialog is the same
  primitive AppDialog is tested on.
-->
<template>
  <DialogRoot :open="open" @update:open="setOpen">
    <DialogTrigger v-if="$slots.trigger" as-child><slot name="trigger" /></DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="app-sheet-overlay" />
      <DialogContent
        class="app-sheet"
        :class="[`app-sheet--${side}`, `app-sheet--${size}`]"
        aria-modal="true"
        v-bind="description ? {} : { 'aria-describedby': undefined }"
        @open-auto-focus="onOpenAutoFocus"
        @close-auto-focus="onCloseAutoFocus"
      >
        <header class="app-sheet__head">
          <div class="app-sheet__titles">
            <DialogTitle class="app-sheet__title">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="app-sheet__desc">{{ description }}</DialogDescription>
          </div>
          <div class="app-sheet__actions">
            <slot name="header-actions" />
            <DialogClose class="app-sheet__close" aria-label="Close">
              <Icon icon="lucide:x" aria-hidden="true" />
            </DialogClose>
          </div>
        </header>
        <div class="app-sheet__body"><slot /></div>
        <footer v-if="$slots.footer" class="app-sheet__foot"><slot name="footer" /></footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup>
import { watch } from 'vue'
import { DialogRoot, DialogTrigger, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'
import { Icon } from '@iconify/vue'
import { useOpenerFocus } from './appOverlayFocus'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  side: { type: String, default: 'right', validator: (v) => ['right', 'left', 'bottom'].includes(v) },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg'].includes(v) },
  initialFocus: { type: [Object, Function], default: null },
})
const emit = defineEmits(['update:open'])

const { remember, onOpenAutoFocus, onCloseAutoFocus } = useOpenerFocus(() => props.initialFocus)
watch(() => props.open, (now) => { if (now) remember() }, { immediate: true, flush: 'sync' })

function setOpen(value) { emit('update:open', value) }
</script>

<style scoped>
.app-sheet-overlay { position: fixed; inset: 0; z-index: 1000; background: rgb(15 23 42 / .35); }
.app-sheet {
  position: fixed; z-index: 1001;
  display: flex; flex-direction: column;
  background: var(--vm-surface); color: var(--vm-ink);
  box-shadow: var(--vm-shadow-l);
  font-family: var(--vm-font-sans, Inter, system-ui, sans-serif); font-size: 13px;
  outline: none;
}
.app-sheet--right, .app-sheet--left { top: 0; bottom: 0; max-width: 100vw; }
.app-sheet--right { right: 0; border-left: 1px solid var(--vm-line-2); }
.app-sheet--left { left: 0; border-right: 1px solid var(--vm-line-2); }
.app-sheet--right.app-sheet--sm, .app-sheet--left.app-sheet--sm { width: 360px; }
.app-sheet--right.app-sheet--md, .app-sheet--left.app-sheet--md { width: 440px; }
.app-sheet--right.app-sheet--lg, .app-sheet--left.app-sheet--lg { width: 640px; }
.app-sheet--bottom {
  left: 0; right: 0; bottom: 0; max-height: calc(100dvh - 48px);
  border-top: 1px solid var(--vm-line-2); border-radius: var(--vm-r-l, 10px) var(--vm-r-l, 10px) 0 0;
}
.app-sheet--bottom.app-sheet--sm { height: 30dvh; }
.app-sheet--bottom.app-sheet--md { height: 50dvh; }
.app-sheet--bottom.app-sheet--lg { height: 80dvh; }
.app-sheet__head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 14px 16px; border-bottom: 1px solid var(--vm-line); flex-shrink: 0;
}
.app-sheet__titles { min-width: 0; }
.app-sheet__title { margin: 0; font-size: 14px; font-weight: 600; color: var(--vm-ink); }
.app-sheet__desc { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.app-sheet__actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.app-sheet__close {
  display: grid; place-items: center; min-width: 32px; min-height: 32px;
  border: 0; border-radius: 6px; background: none; color: var(--vm-ink-faint); cursor: pointer;
}
.app-sheet__close:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.app-sheet__close :deep(svg) { width: 16px; height: 16px; }
.app-sheet__close:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.app-sheet__body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.app-sheet__foot {
  display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0;
  padding: 12px 16px; border-top: 1px solid var(--vm-line); background: var(--vm-surface-soft);
}
@media (max-width: 640px) {
  .app-sheet--right, .app-sheet--left { width: 100vw !important; }
}
@media (pointer: coarse) { .app-sheet__close { min-width: 44px; min-height: 44px; } }
@media (prefers-reduced-motion: no-preference) {
  .app-sheet-overlay[data-state='open'] { animation: app-sheet-fade .15s ease-out; }
  /* A fade only: nothing slides, zooms or shakes anywhere in the app (owner rule, src/noMotion.test.js). */
  .app-sheet[data-state='open'] { animation: app-sheet-fade .18s ease-out; }
}
@keyframes app-sheet-fade { from { opacity: 0; } to { opacity: 1; } }
</style>
