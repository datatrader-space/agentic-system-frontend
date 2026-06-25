<template>
  <div ref="root">
    <slot v-if="shown" />
    <!-- Reserve some height so the scroll position + scroll-spy anchors stay stable
         before the real panel mounts. -->
    <div v-else class="lazy-mount-ph" :style="{ minHeight: placeholder }"></div>
  </div>
</template>

<script setup>
/**
 * Renders its slot only once it scrolls near the viewport, then keeps it mounted.
 * Used to defer heavy section panels (each of which fetches on mount) on long
 * single-scroll pages like the Agent Configure page — so opening the page doesn't
 * fire every panel's API calls at once; they load as the user scrolls to them.
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  // Placeholder height before the panel mounts (keeps layout/scroll stable).
  placeholder: { type: String, default: '120px' },
  // Mount a bit before the panel is actually visible for a seamless feel.
  rootMargin: { type: String, default: '400px' },
})

const root = ref(null)
const shown = ref(false)
let io = null

onMounted(() => {
  // No IntersectionObserver (old/test env) → render immediately, never hide content.
  if (typeof IntersectionObserver === 'undefined') { shown.value = true; return }
  io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      shown.value = true
      if (io) { io.disconnect(); io = null }
    }
  }, { rootMargin: props.rootMargin })
  io.observe(root.value)
})

onBeforeUnmount(() => { if (io) { io.disconnect(); io = null } })
</script>
