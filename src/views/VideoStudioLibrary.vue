<template>
  <!-- The Library and Ingredients as full pages of Video Studio. "Use" queues the file for the Create page,
       which adds it to the open project once its agent and project are ready. -->
  <section class="vsl" data-test="video-studio-library">
    <VideoLibrary mode="page" :initial-tab="route.meta.libraryTab || 'files'" :key="route.path" />
  </section>
</template>

<script setup>
import { useRoute } from 'vue-router'
import VideoLibrary from '../components/video/VideoLibrary.vue'

const route = useRoute()
</script>

<style scoped>
.vsl { height: 100%; min-height: 0; display: flex; }
.vsl :deep(.lib) { width: 100%; box-shadow: none; }
</style>
