<template>
  <!-- The thumbnail; the original only if it has none or it does not load. Classes and click handlers given to this
       component land on the element shown, so a card keeps its own look and its own "open the original". -->
  <img v-if="thumb && !failed" :src="thumb" :alt="alt" loading="lazy" decoding="async" data-thumb="1" @error="failed = true" />
  <video v-else-if="kind === 'video' && original" :src="original" preload="metadata" muted playsinline aria-hidden="true" />
  <img v-else-if="original" :src="original" :alt="alt" loading="lazy" decoding="async" />
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
})

const failed = ref(false)
const thumb = computed(() => thumbnailFor(props.item))
const kind = computed(() => mediaKind(props.item))
const original = computed(() => props.src || props.item?.url || '')
watch(thumb, () => { failed.value = false })
</script>
