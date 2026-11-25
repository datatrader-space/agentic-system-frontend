<!--
  BackgroundTasksSheet: the background-tasks list opened from the count pill above the chat's composer (ADM-1360
  release), as Claude Code's "Background tasks" sheet: Close at the left, the title in the middle, then the Running and
  Finished groups of cards. Wide: a popover over the composer, beside the bottom panel's Background tab. 640 px and
  less: a full-width bottom sheet with 44 px targets; swiping its handle down closes it too. Esc closes both, and the
  focus goes back to the pill. Lazy: loaded the first time the pill is pressed.
-->
<template>
  <div class="bgs-wrap">
    <div class="bgs-backdrop" aria-hidden="true" @pointerdown="close"></div>
    <div class="bgs" role="dialog" aria-modal="false" aria-labelledby="bgs-title" data-test="bgs">
      <div class="bgs-handle" aria-hidden="true" @pointerdown="onSwipeStart" @pointerup="onSwipeEnd" @pointercancel="swipeY = null"><span></span></div>
      <header class="bgs-head">
        <button ref="closeEl" type="button" class="bgs-close" aria-label="Close the background tasks" title="Close" data-test="bgs-close" @click="close">
          <Icon icon="lucide:x" aria-hidden="true" />
        </button>
        <h2 id="bgs-title" class="bgs-title">Background tasks</h2>
      </header>
      <div class="bgs-body vm-scroll">
        <BackgroundTasksList @opened="close" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { confirmState } from '@/composables/useConfirm'
import BackgroundTasksList from './BackgroundTasksList.vue'

const emit = defineEmits(['close'])
const closeEl = ref(null)

function close() { emit('close') }

// A swipe down on the sheet's handle (phone) closes it.
const swipeY = ref(null)
function onSwipeStart(e) { swipeY.value = e.clientY }
function onSwipeEnd(e) {
  if (swipeY.value != null && e.clientY - swipeY.value > 48) close()
  swipeY.value = null
}

// Esc closes it wherever the focus is, except while the Stop question is open (Esc answers that one).
function onKey(e) {
  if (e.key !== 'Escape' || e.defaultPrevented || confirmState.open) return
  close()
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  nextTick(() => closeEl.value?.focus())
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.bgs-wrap { position: absolute; left: 0; right: 0; bottom: calc(100% + 6px); z-index: 30; }
.bgs-backdrop { position: fixed; inset: 0; z-index: 0; }
.bgs {
  position: relative; z-index: 1; display: flex; flex-direction: column; max-height: min(560px, 70vh);
  background: var(--vm-surface); color: var(--vm-ink); border: 1px solid var(--vm-line-2); border-radius: 12px;
  box-shadow: var(--vm-shadow-l, 0 12px 32px rgba(0, 0, 0, .18)); overflow: hidden; font: 13px var(--vm-font-sans);
}
.bgs-handle { display: none; }
.bgs-head { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; padding: 6px 8px; }
.bgs-title { margin: 0; text-align: center; font: 700 14px var(--vm-font-sans); text-wrap: balance; }
.bgs-close { justify-self: start; display: grid; place-items: center; width: 30px; height: 30px; border: none; border-radius: 8px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.bgs-close:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.bgs-close:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: 2px; }
.bgs-close :deep(svg) { width: 16px; height: 16px; }
.bgs-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 12px 12px; }

/* Phone: a full-width bottom sheet over a dimmed page. */
@media (max-width: 640px) {
  .bgs-wrap { position: fixed; inset: 0; z-index: 60; }
  .bgs-backdrop { background: color-mix(in srgb, #000 45%, transparent); }
  .bgs { position: absolute; left: 0; right: 0; bottom: 0; max-height: 80vh; border-radius: 16px 16px 0 0; border-bottom: none;
         padding-bottom: env(safe-area-inset-bottom, 0px); }
  .bgs-handle { display: grid; place-items: center; height: 20px; touch-action: none; user-select: none; cursor: grab; }
  .bgs-handle span { width: 40px; height: 4px; border-radius: 2px; background: var(--vm-line-2); }
  .bgs-head { padding: 0 8px 8px; }
  .bgs-title { font-size: 17px; }
  .bgs-close { width: 44px; height: 44px; }
  .bgs-body { padding: 4px 16px 12px; }
}
</style>
