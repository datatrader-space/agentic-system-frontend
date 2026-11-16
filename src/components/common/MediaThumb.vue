<template>
  <!-- The thumbnail; the original only if it has none or it does not load. Classes and click handlers given to this
       component land on the element shown, so a card keeps its own look and its own "open the original". -->
  <img v-if="thumb && !failed" :src="thumb" :alt="alt" :loading="loading" decoding="async" data-thumb="1" @error="failed = true" />
  <video v-else-if="kind === 'video' && original" :src="original" preload="metadata" muted playsinline aria-hidden="true" />
  <img v-else-if="original" :src="original" :alt="alt" :loading="loading" decoding="async" />
</template>

<script setup>
// What a card shows for an image or a video (agentic-docs/MEDIA_THUMBNAILS_EVERYWHERE_PLAN.md): the server's small
// picture of it, never the whole file. `item` is any media row the app has (it needs `attachment_id` and its kind,
// or a `thumbnail_url`); `src` is the original, shown only when there is no thumbnail.
import { computed, ref, watch } from 'vue'
import { mediaKind, thumbnailFor } from '../../utils/mediaThumb'

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
watch(thumb, () => { failed.value = false })
</script>
