// Unsaved edits are never lost without a question (ADM-1200). Leaving the Let's Code project, going to another page
// or closing the browser tab all dropped them silently; only a branch switch asked.
//
//   const guard = useUnsavedGuard(() => codeBrowser.value?.unsavedCount)
//   if (await guard.mayLeave()) closeProject()
//
// The route-leave check and the browser's own "leave site?" question are registered by the composable.
import { onMounted, onBeforeUnmount, unref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { confirm } from '@/composables/useConfirm'

export function unsavedQuestion(n) {
  return {
    title: n === 1 ? 'Leave with an unsaved file?' : `Leave with ${n} unsaved files?`,
    message: 'Edits you have not saved are lost. Save them first with Ctrl+S, or leave without saving.',
    confirmText: 'Leave without saving', cancelText: 'Stay', danger: true,
  }
}

export function useUnsavedGuard(getCount) {
  const count = () => Number(unref(getCount()) || 0)

  async function mayLeave() {
    const n = count()
    return n ? confirm(unsavedQuestion(n)) : true
  }

  function onBeforeUnload(e) {
    if (!count()) return
    e.preventDefault()
    e.returnValue = ''                 // the browser asks its own "leave site?" question
  }

  onBeforeRouteLeave(() => mayLeave())
  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

  return { mayLeave, onBeforeUnload }
}
