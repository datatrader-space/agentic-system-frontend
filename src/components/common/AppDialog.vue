<!--
  One modal dialog for the app, on Reka UI's Dialog (ADM-1333, plan §4). Reka gives the behaviour every hand-written
  modal here used to copy: focus trapped inside, Esc closes, the page behind cannot scroll, everything else is hidden
  from assistive tech, and role="dialog" labelled by the title. This component adds focus RETURNED to the opener when
  the dialog was opened from code (Reka only knows a <DialogTrigger>), aria-modal, and the app's look in both themes.

    <AppDialog v-model:open="show" title="Run with inputs" description="Values for this run only." size="md">
      ...body...
      <template #footer><button @click="show = false">Cancel</button> <button>Run</button></template>
    </AppDialog>

  Slots: default (body), footer, trigger (optional, wrapped in <DialogTrigger as-child>).
  It sits below the global confirm dialog (z 10000) and the HITL modal (9999), so a confirm asked from inside it shows on top.
-->
<template>
  <DialogRoot :open="open" @update:open="setOpen">
    <DialogTrigger v-if="$slots.trigger" as-child><slot name="trigger" /></DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="app-dialog-overlay" />
      <DialogContent
        class="app-dialog"
        :class="`app-dialog--${size}`"
        aria-modal="true"
        v-bind="description ? {} : { 'aria-describedby': undefined }"
        @open-auto-focus="onOpenAutoFocus"
        @close-auto-focus="onCloseAutoFocus"
      >
        <header class="app-dialog__head">
          <div class="app-dialog__titles">
            <DialogTitle class="app-dialog__title">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="app-dialog__desc">{{ description }}</DialogDescription>
          </div>
          <DialogClose class="app-dialog__close" aria-label="Close">
            <Icon icon="lucide:x" aria-hidden="true" />
          </DialogClose>
        </header>
        <div class="app-dialog__body"><slot /></div>
        <footer v-if="$slots.footer" class="app-dialog__foot"><slot name="footer" /></footer>
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
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg', 'full'].includes(v) },
  // The element to focus first; by default Reka focuses the first focusable element in the dialog.
  initialFocus: { type: [Object, Function], default: null },
})
const emit = defineEmits(['update:open'])

const { remember, onOpenAutoFocus, onCloseAutoFocus } = useOpenerFocus(() => props.initialFocus)
watch(() => props.open, (now) => { if (now) remember() }, { immediate: true, flush: 'sync' })

function setOpen(value) { emit('update:open', value) }
</script>

<style scoped>
.app-dialog-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgb(15 23 42 / .45);
}
.app-dialog {
  position: fixed; z-index: 1001; left: 50%; top: 50%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column;
  width: calc(100vw - 32px); max-height: calc(100dvh - 32px);
  background: var(--vm-surface); color: var(--vm-ink);
  border: 1px solid var(--vm-line-2); border-radius: var(--vm-r-l, 10px);
  box-shadow: var(--vm-shadow-l);
  font-family: var(--vm-font-sans, Inter, system-ui, sans-serif); font-size: 13px;
  outline: none;
}
.app-dialog--sm { max-width: 400px; }
.app-dialog--md { max-width: 560px; }
.app-dialog--lg { max-width: 880px; }
.app-dialog--full { max-width: none; width: calc(100vw - 32px); height: calc(100dvh - 32px); }
.app-dialog__head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 14px 16px; border-bottom: 1px solid var(--vm-line); flex-shrink: 0;
}
.app-dialog__titles { min-width: 0; }
.app-dialog__title { margin: 0; font-size: 15px; font-weight: 600; color: var(--vm-ink); }
.app-dialog__desc { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.app-dialog__close {
  display: grid; place-items: center; flex-shrink: 0;
  min-width: 32px; min-height: 32px; border: 0; border-radius: 6px;
  background: none; color: var(--vm-ink-faint); cursor: pointer;
}
.app-dialog__close:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.app-dialog__close :deep(svg) { width: 16px; height: 16px; }
.app-dialog__close:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.app-dialog__body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 14px 16px; }
.app-dialog__foot {
  display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0; flex-wrap: wrap;
  padding: 12px 16px; border-top: 1px solid var(--vm-line); background: var(--vm-surface-soft);
  border-radius: 0 0 var(--vm-r-l, 10px) var(--vm-r-l, 10px);
}
@media (pointer: coarse) { .app-dialog__close { min-width: 44px; min-height: 44px; } }
@media (prefers-reduced-motion: no-preference) {
  .app-dialog-overlay[data-state='open'] { animation: app-dialog-fade .15s ease-out; }
  .app-dialog[data-state='open'] { animation: app-dialog-fade .15s ease-out; }
}
@keyframes app-dialog-fade { from { opacity: 0; } to { opacity: 1; } }
</style>
