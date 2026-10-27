<template>
  <img class="brand-mark-img" :src="markUrl" :alt="alt" :aria-hidden="alt ? undefined : 'true'" draggable="false" />
</template>

<script setup>
// The AADML mark. It fills the box its parent gives it, so every placement sets the size on its own
// wrapper. Leave `alt` empty where the name is written next to the mark.
// 168 px lossless WebP (13 KB): the largest placement is 56 CSS px, so 3x screens need 168. It was a 256 px PNG
// (31 KB), the largest image on a chat page's first load.
import markUrl from '../../assets/brand/aadml-mark.webp'

defineProps({ alt: { type: String, default: '' } })
</script>

<style scoped>
.brand-mark-img { display: block; width: 100%; height: 100%; object-fit: contain; user-select: none; }
</style>
