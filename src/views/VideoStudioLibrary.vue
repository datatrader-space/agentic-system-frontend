<template>
  <!-- The Library and Ingredients as full pages of Video Studio. "Use" queues the file for the Create page,
       which adds it to the open project once its agent and project are ready. -->
  <section class="vsl" :class="{ embedded }" data-test="video-studio-library">
    <VideoLibrary mode="page" :initial-tab="route.meta.libraryTab || 'files'" :preset="lookId" :key="route.path" @clear-preset="clearLook" />
    <!-- The person's likeness consents, so one can be revoked (ADM-1170). Not in the embedded Library. -->
    <StudioConsents v-if="!embedded" />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LOOK_ID } from '../services/studioLooks'
import VideoLibrary from '../components/video/VideoLibrary.vue'
import StudioConsents from '../components/studio/StudioConsents.vue'

const route = useRoute(), router = useRouter()
// ?preset=<look id>: the Library opened from a look's "See all" lists only the files made with that look.
const lookId = computed(() => typeof route.query?.preset === 'string' && LOOK_ID.test(route.query.preset) ? route.query.preset : '')
defineProps({ embedded: Boolean })
function clearLook() { router.replace({ path: route.path, query: { ...route.query, preset: undefined } }) }
</script>

<style scoped>
.vsl { height: 100%; min-height: 0; display: flex; }
.vsl :deep(.lib) { width: 100%; box-shadow: none; }
</style>

<style scoped>.vsl{padding:22px 30px;background:var(--vm-bg)}.vsl :deep(.lib){border:1px solid var(--vm-line);border-radius:11px;overflow:hidden;background:var(--vm-surface)}.vsl :deep(.lib-head){padding:24px}.vsl :deep(.lib-head h1){font-size:27px;letter-spacing:-.04em;font-weight:550}.vsl :deep(.lib-lead){font-size:12px;color:var(--vm-ink-soft);line-height:1.8}.vsl :deep(.lib-toolbar){background:var(--vm-surface)}@media(max-width:767px){.vsl{padding:12px}.vsl :deep(.lib-head){padding:18px 16px}.vsl :deep(.lib-head h1){font-size:23px}}</style>
<style scoped>.vsl.embedded{padding:0;height:auto;min-height:420px}.vsl.embedded :deep(.lib){border:0;border-radius:0}.vsl.embedded :deep(.lib-head){display:none}</style>

<style scoped>.vsl:not(.embedded){padding:32px 38px}.vsl:not(.embedded) :deep(.lib){border:0;border-radius:0;background:none}.vsl:not(.embedded) :deep(.lib-head){padding:0 0 24px;border:0}.vsl:not(.embedded) :deep(.lib-head h1){font-size:30px;font-weight:600;letter-spacing:-1px}.vsl:not(.embedded) :deep(.lib-lead){font-size:13px;line-height:1.8;margin-top:10px}.vsl:not(.embedded) :deep(.lib-toolbar){background:none;padding-inline:0;border-color:#333b49}@media(max-width:680px){.vsl:not(.embedded){padding:22px 16px}.vsl:not(.embedded) :deep(.lib-head h1){font-size:27px}}</style>

<style scoped>/* The Library, then the consents under it (ADM-1170). */.vsl:not(.embedded){flex-direction:column;gap:16px;overflow:auto}.vsl:not(.embedded) :deep(.lib){flex:1 0 auto}</style>
