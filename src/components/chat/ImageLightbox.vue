<!--
  Click-to-preview for an image rendered inside an answer (ADM-486).

  ONE component, because the preview lived only in ChatMessage.vue. A Work answer is drawn on the rail
  (RunTimeline.vue) with the same `enhanceChatMedia` markup, and ChatMessage suppresses its bubble there
  (`answerOnRail`), so on a Work run clicking an image did nothing: the handler that knew about images was
  in a component that was not on screen.

  The owner calls `open(src)` from its own delegated click handler (the answer is `v-html`, so there is no
  element to bind to). Teleported to <body> so it overlays the app whatever container it was opened from.
-->
<template>
  <Teleport to="body">
    <div v-if="src" class="img-lightbox" data-test="img-lightbox" @click="close">
      <img :src="src" class="img-lightbox-img" alt="preview" @click.stop />
      <button type="button" class="img-lightbox-close" aria-label="Close" @click="close">×</button>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const src = ref(null)
const open = (url) => { if (url) src.value = url }
const close = () => { src.value = null }
const onEsc = (e) => { if (e.key === 'Escape' && src.value) close() }
onMounted(() => window.addEventListener('keydown', onEsc))
onUnmounted(() => window.removeEventListener('keydown', onEsc))

defineExpose({ open, close })
</script>

<style scoped>
.img-lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  cursor: zoom-out;
}
.img-lightbox-img {
  max-width: 95vw;
  max-height: 92vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  cursor: default;
}
.img-lightbox-close {
  position: fixed;
  top: 16px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
.img-lightbox-close:hover { background: rgba(255, 255, 255, 0.3); }
</style>
