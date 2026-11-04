<template>
  <section v-if="look" class="slp" aria-label="Look preview">
    <div class="slp-intro"><span>YOUR RESULTS WITH THIS LOOK</span><RouterLink v-if="LOOK_ID.test(look.id || '')" class="slp-all" :to="{ path: '/video-studio/library', query: { preset: look.id } }" data-test="look-see-all" :aria-label="`See all your results with ${look.title}`">See all</RouterLink></div>
    <StudioLookMedia :key="look.id" :look="look" controls />
    <div class="slp-copy"><div><h2>{{ look.title }}</h2><p>{{ look.purpose }}</p></div><button type="button" class="st-button primary" @click="emit('select', look)">Use this look ↗</button></div>
    <StudioLookDetails :key="look.id" :look="look" :disabled="disabled" :settings="settings" @apply="emit('select', $event)" />
    <p class="st-muted slp-note">This shows the newest result you made with this look. Settings and cost depend on the compatible model selected for your brief.</p>
  </section>
</template>
<script setup>
import StudioLookMedia from './StudioLookMedia.vue'
import StudioLookDetails from './StudioLookDetails.vue'
import { LOOK_ID } from '../../services/studioLooks'
defineProps({ look: Object, disabled: Boolean, settings: { type: Object, default: null } })
const emit = defineEmits(['select'])
</script>
<style scoped>
.slp{display:grid;gap:18px;max-width:1200px;margin:auto}.slp-intro{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:10px;letter-spacing:.06em;color:var(--vm-ink-soft)}.slp :deep(.slm){aspect-ratio:16/10;max-height:52dvh;border:1px solid var(--vm-line);border-radius:10px}.slp-all{font-size:12px;letter-spacing:0;color:var(--vm-ink);text-decoration:underline;text-underline-offset:3px}.slp-all:hover{color:var(--vm-ink-soft)}.slp-copy{display:flex;gap:18px;align-items:center;justify-content:space-between}.slp-copy h2{font-size:25px;letter-spacing:-.04em}.slp-copy p{font-size:13px;color:var(--vm-ink-soft);margin-top:8px}.slp-note{font-size:12px;line-height:1.8;max-width:760px}@media(max-width:767px){.slp-copy{align-items:flex-start;flex-direction:column}.slp-copy h2{font-size:23px}.slp-intro{font-size:9px}.slp :deep(.slm){aspect-ratio:4/3;max-height:300px}}
</style>
