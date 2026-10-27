<template>
  <!-- The open video jobs of this conversation, just above the composer. Finished renders are posted into
       the chat by the server; this tray keeps the estimates waiting for a decision and the renders in
       flight in view. State changes are announced politely for screen readers. -->
  <div v-if="visible.length" class="vjt" data-test="video-jobs-tray">
    <div class="vjt-live" aria-live="polite" role="status">{{ announcement }}</div>
    <VideoJobCard v-for="j in visible" :key="j.job_id" :job="j" :in-studio="inStudio" @open="emit('open')" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'
import VideoJobCard from './VideoJobCard.vue'

const props = defineProps({ conversationId: { type: [String, Number], default: null }, inStudio: { type: Boolean, default: false } })
const emit = defineEmits(['open'])
const video = useVideoStore()

// Open work, plus failures (so the reason stays next to the job until dismissed or a newer job replaces it) and
// results that could not be posted to a chat (a job with no conversation). A failure is SUPERSEDED once a newer job
// starts in this chat: the person asked again, so the old reason no longer stands above the box (owner, 2026-10-20:
// a refused render's card stayed after the retry had rendered).
const visible = computed(() => {
  const jobs = video.jobsFor(props.conversationId)          // oldest first
  return jobs.filter((j, i) => {
    if (j.state === 'failed') return !jobs.slice(i + 1).length
    return !['ready', 'cancelled'].includes(j.state) || (j.state === 'ready' && !j.conversation_id)
  })
})

const announcement = ref('')
const seen = {}
watch(() => visible.value.map((j) => `${j.job_id}:${j.state}`).join('|'), () => {
  for (const j of video.jobsFor(props.conversationId)) {
    if (seen[j.job_id] && seen[j.job_id] !== j.state) {
      // Said by what the job makes: a song or a speech take is never announced as a video.
      const kind = { image: 'image', audio: 'audio', text: 'transcript', training: 'identity training' }[j.modality] || 'video'
      announcement.value = j.state === 'ready' ? `Your ${kind} is ready.` : `${kind[0].toUpperCase()}${kind.slice(1)}: ${j.phase || j.state}.`
    }
    seen[j.job_id] = j.state
  }
}, { immediate: true })      // the states shown at first are recorded, so the first change after them is announced too
</script>

<style scoped>
.vjt { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 6px 0 8px; }
.vjt-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
