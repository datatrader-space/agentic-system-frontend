<template>
  <!-- The open video jobs of this conversation, just above the composer. Finished renders are posted into
       the chat by the server; this tray keeps the estimates waiting for a decision and the renders in
       flight in view. State changes are announced politely for screen readers. -->
  <div v-if="visible.length" class="vjt" data-test="video-jobs-tray">
    <div class="vjt-live" aria-live="polite" role="status">{{ announcement }}</div>
    <VideoJobCard v-for="j in visible" :key="j.job_id" :job="j" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'
import VideoJobCard from './VideoJobCard.vue'

const props = defineProps({ conversationId: { type: [String, Number], default: null } })
const video = useVideoStore()

// Open work, plus failures (so the reason stays next to the job until dismissed) and results that could
// not be posted to a chat (a job with no conversation).
const visible = computed(() => video.jobsFor(props.conversationId).filter((j) =>
  !['ready', 'cancelled'].includes(j.state) || (j.state === 'ready' && !j.conversation_id)))

const announcement = ref('')
const seen = {}
watch(() => visible.value.map((j) => `${j.job_id}:${j.state}`).join('|'), () => {
  for (const j of video.jobsFor(props.conversationId)) {
    if (seen[j.job_id] && seen[j.job_id] !== j.state) {
      announcement.value = j.state === 'ready' ? 'Your video is ready.' : `Video: ${j.phase || j.state}.`
    }
    seen[j.job_id] = j.state
  }
})
</script>

<style scoped>
.vjt { display: grid; gap: 8px; padding: 6px 0 8px; }
.vjt-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
