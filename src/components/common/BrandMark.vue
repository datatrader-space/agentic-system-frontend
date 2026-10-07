<template>
  <img class="brand-mark-img" :src="markUrl" :alt="alt" :aria-hidden="alt ? undefined : 'true'" draggable="false" />
</template>

<script setup>
// The AADML mark. It fills the box its parent gives it, so every placement sets the size on its own
// wrapper. Leave `alt` empty where the name is written next to the mark.
import markUrl from '../../assets/brand/aadml-mark.png'

defineProps({ alt: { type: String, default: '' } })
</script>

<style scoped>
.brand-mark-img { display: block; width: 100%; height: 100%; object-fit: contain; user-select: none; }
</style>
