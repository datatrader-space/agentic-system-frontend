<template>
  <!-- A Library file at full size (owner, 2026-10-20: "no option to preview the image or play the video"): the image
       whole, a video or sound with its player, the chat it came from, previous / next through the loaded files.
       A dialog: Escape or the backdrop closes it, arrow keys move, focus starts on Close and returns on close. -->
  <Teleport to="body">
    <div class="mv" role="dialog" aria-modal="true" :aria-label="'Preview: ' + item.title" data-test="media-viewer"
         @keydown.esc.prevent="emit('close')" @keydown.left.prevent="step(-1)" @keydown.right.prevent="step(1)"
         @click.self="emit('close')">
      <div class="mv-frame">
        <header class="mv-bar">
          <div class="mv-text">
            <p class="mv-title" :title="item.title">{{ item.title }}</p>
            <p class="mv-meta">{{ meta }}<template v-if="item.conversation_id">, from <router-link :to="chatLink" class="mv-chat"
                data-test="media-viewer-chat" @click="emit('leave')">{{ fromChat }}</router-link></template></p>
          </div>
          <a :href="item.url" target="_blank" rel="noopener noreferrer" class="mv-btn">Open original</a>
          <button ref="closeEl" type="button" class="mv-btn mv-icon" aria-label="Close preview" data-test="media-viewer-close" @click="emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div class="mv-stage">
          <button v-if="items.length > 1" type="button" class="mv-nav mv-prev" aria-label="Previous file" @click="step(-1)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <video v-if="item.media_type === 'video'" :key="item.url" :src="item.url" controls playsinline preload="metadata" class="mv-media" data-test="media-viewer-video"></video>
          <div v-else-if="item.media_type === 'audio'" class="mv-audio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 18V6l11-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>
            <audio :key="item.url" :src="item.url" controls preload="metadata" data-test="media-viewer-audio"></audio>
          </div>
          <img v-else :src="item.url" :alt="item.title" class="mv-media" data-test="media-viewer-image" />
          <button v-if="items.length > 1" type="button" class="mv-nav mv-next" aria-label="Next file" @click="step(1)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
        <p v-if="items.length > 1" class="mv-count">{{ index + 1 }} of {{ items.length }}</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  items: { type: Array, required: true },          // the files that can be previewed, in the order shown
  index: { type: Number, required: true },
})
const emit = defineEmits(['close', 'leave', 'update:index'])   // leave: its chat link was followed
const closeEl = ref(null)
const item = computed(() => props.items[props.index] || {})
// A Studio chat opens in the Studio; any other chat in the main chat.
const fromChat = computed(() => item.value.conversation_name || 'its chat')
const chatLink = computed(() => (item.value.conversation_in_studio
  ? { path: '/video-studio', query: { conversation: String(item.value.conversation_id) } }
  : `/dashboard/chat/${item.value.conversation_id}`))
function size(n) {
  const b = Number(n) || 0
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`
}
const meta = computed(() => {
  const it = item.value
  const day = it.created_at ? new Date(it.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
  return [it.source === 'generated' ? 'Made with AI' : 'Uploaded', day, it.size_bytes ? size(it.size_bytes) : ''].filter(Boolean).join(', ')
})
function step(d) {
  if (props.items.length < 2) return
  emit('update:index', (props.index + d + props.items.length) % props.items.length)
}
let returnTo = null
onMounted(async () => {
  returnTo = document.activeElement
  document.body.style.overflow = 'hidden'
  await nextTick()
  closeEl.value?.focus()
})
onBeforeUnmount(() => {
  document.body.style.overflow = ''
  if (returnTo && typeof returnTo.focus === 'function') returnTo.focus()
})
</script>

<style scoped>
.mv { position: fixed; inset: 0; z-index: 2000;   /* above the Library drawer (1900) it opens from */
  display: grid; place-items: center; padding: 24px; background: rgba(6, 7, 9, .86); }
.mv-frame { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 10px; width: min(1200px, 100%); height: min(860px, calc(100dvh - 48px)); }
.mv-bar { display: flex; align-items: center; gap: 10px; min-width: 0; }
.mv-text { flex: 1; min-width: 0; }
.mv-title { margin: 0; font-size: 15px; font-weight: 600; color: #ededef; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mv-meta { margin: 2px 0 0; font-size: 12.5px; color: #a7a8ae; }
.mv-chat { color: #8db4ff; text-decoration: underline; text-underline-offset: 2px; }
.mv-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 14px; border: 1px solid rgba(255, 255, 255, .18);
  border-radius: 6px; background: transparent; color: #ededef; font: inherit; font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer; }
.mv-btn:hover { background: rgba(255, 255, 255, .08); }
.mv-icon { width: 40px; padding: 0; }
.mv-icon svg { width: 18px; height: 18px; }
.mv-stage { position: relative; display: grid; place-items: center; min-height: 0; border-radius: 8px; background: #000; overflow: hidden; }
.mv-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; display: block; }
.mv-audio { display: grid; justify-items: center; gap: 18px; color: #a7a8ae; }
.mv-audio svg { width: 64px; height: 64px; }
.mv-audio audio { width: min(420px, 80vw); }
.mv-nav { position: absolute; z-index: 1; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 44px; height: 44px; border: 0;
  border-radius: 999px; background: rgba(0, 0, 0, .55); color: #ededef; cursor: pointer; }
.mv-nav:hover { background: rgba(0, 0, 0, .8); }
.mv-nav svg { width: 22px; height: 22px; }
.mv-prev { left: 10px; }
.mv-next { right: 10px; }
.mv-count { margin: 0; text-align: center; font-size: 12.5px; color: #a7a8ae; }
.mv-btn:focus-visible, .mv-nav:focus-visible, .mv-chat:focus-visible { outline: 2px solid #8db4ff; outline-offset: 2px; }
@media (max-width: 640px) {
  .mv { padding: 10px; }
  .mv-frame { height: calc(100dvh - 20px); }
  .mv-bar a.mv-btn { display: none; }
}
@media (prefers-reduced-motion: reduce) { .mv * { transition: none !important; } }
</style>
