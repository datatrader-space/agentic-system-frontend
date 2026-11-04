import { onBeforeUnmount, onMounted, ref } from 'vue'

// Mobile keyboards can shrink the visual viewport without resizing the layout viewport (iOS).
// Keep Studio's chat composer inside that visible area. Leave pinch zoom to the browser.
export function useStudioViewport() {
  const height = ref(null), keyboardOpen = ref(false)
  let viewport
  function update() {
    if (!viewport || Math.abs((viewport.scale || 1) - 1) > 0.05) {
      height.value = null
      keyboardOpen.value = false
      return
    }
    height.value = `${Math.round(viewport.height)}px`
    keyboardOpen.value = window.innerHeight - viewport.height > 120
  }
  onMounted(() => {
    viewport = window.visualViewport
    update()
    viewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)
  })
  onBeforeUnmount(() => {
    viewport?.removeEventListener('resize', update)
    window.removeEventListener('resize', update)
  })
  return { height, keyboardOpen }
}
