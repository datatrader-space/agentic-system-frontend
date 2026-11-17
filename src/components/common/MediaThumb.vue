<template>
  <!-- The thumbnail; the original only if it has none or it does not load. Classes and click handlers given to this
       component land on the element shown, so a card keeps its own look and its own "open the original". -->
  <img v-if="thumb && !failed" :src="thumb" :alt="alt" :loading="loading" decoding="async" data-thumb="1" @error="failed = true" />
  <video v-else-if="kind === 'video' && original" :src="original" preload="metadata" muted playsinline aria-hidden="true" />
  <!-- A caption, a sound or a document has no picture: a type icon, never a request for a thumbnail. -->
  <span v-else-if="isFile" class="media-thumb-file" role="img" :aria-label="alt || fileLabel" data-test="media-thumb-file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path v-if="declared === 'audio'" d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path v-else d="M14 3H6v18h12V7zM14 3v4h4M8 12h8M8 16h5"/></svg></span>
  <img v-else-if="original" :src="original" :alt="alt" :loading="loading" decoding="async" />
</template>

<script setup>
// What a card shows for an image or a video (agentic-docs/MEDIA_THUMBNAILS_EVERYWHERE_PLAN.md): the server's small
// picture of it, never the whole file. `item` is any media row the app has (it needs `attachment_id` and its kind,
// or a `thumbnail_url`); `src` is the original, shown only when there is no thumbnail.
import { computed, ref, watch } from 'vue'
import { declaredKind, mediaKind, thumbnailFor } from '../../utils/mediaThumb'

const props = defineProps({
  item: { type: Object, default: null },
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  // Load at once instead of lazily. A lazy picture with no size inside a dialog (the Jobs tray) never counted as near
  // the screen and never loaded (live 2026-11-16, ADM-1247); a place that shows only a few pictures passes this.
  eager: { type: Boolean, default: false },
})

const failed = ref(false)
const loading = computed(() => (props.eager ? 'eager' : 'lazy'))
const thumb = computed(() => thumbnailFor(props.item))
const kind = computed(() => mediaKind(props.item))
const original = computed(() => props.src || props.item?.url || '')
const declared = computed(() => declaredKind(props.item))
const isFile = computed(() => !!declared.value && declared.value !== 'image' && declared.value !== 'video')
const fileLabel = computed(() => (declared.value === 'audio' ? 'Sound file' : 'File'))
watch(thumb, () => { failed.value = false })
</script>

<style scoped>
.media-thumb-file { display: grid; place-items: center; color: var(--vm-ink-faint, currentColor); }
.media-thumb-file svg { width: 40%; max-width: 40px; height: auto; }
</style>
