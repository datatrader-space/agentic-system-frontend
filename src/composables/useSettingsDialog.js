import { inject, onBeforeUnmount, ref, watch } from 'vue'

export function useSettingsDialog(open = ref(true)) {
  const settingsDialogHost = inject('settingsDialogHost', null)
  const active = inject('settingsOverlayActive', () => {})
  if (settingsDialogHost) {
    watch(open, value => active(!!value), { immediate: true, flush: 'post' })
    onBeforeUnmount(() => active(false))
  }
  return { settingsDialogHost }
}
