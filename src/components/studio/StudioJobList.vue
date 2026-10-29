<template>
  <div class="studio-jobs">
    <p v-if="error" class="st-error" role="alert">{{ error }}</p>
    <VideoJobCard v-for="job in rows" :key="job.job_id" :job="job" in-studio />
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import api from '../../services/api'
import { useVideoStore } from '../../stores/useVideoStore'
import { usePoller } from '../../composables/usePoller'
import VideoJobCard from '../video/VideoJobCard.vue'
const props = defineProps({ ids: { type: Array, default: () => [] } })
const emit = defineEmits(['settled'])
const video = useVideoStore(), error = ref('')
const rows = computed(() => props.ids.map(id => video.jobs[id]).filter(Boolean))
const terminalKeys = () => rows.value.filter(job => ['ready','failed','cancelled'].includes(job.state)).map(job => `${job.job_id}:${job.state}`)
const reported = new Set(terminalKeys())
watch(terminalKeys, keys => { for (const key of keys) if (!reported.has(key)) { reported.add(key); emit('settled') } })
// Read only what can change by itself (live 2026-10-28: one card waiting for a decision was read 39 times a minute,
// because the page passes a new id list on every job update and each one started a full read):
// - when the list changes, only the jobs not seen yet;
// - every 4 s, the jobs on their way (queued, rendering, being saved), paused while the tab is hidden;
// - a job waiting for the person's Generate changes when they press a button (the store takes that answer), so it
//   is read about every 30 s only, in case it was started elsewhere (the agent, a workflow).
const TERMINAL = ['ready','failed','cancelled'], WAITING = 'awaiting_authorization', WAITING_EVERY = 8
let disposed = false, running = false, ticks = 0
async function refresh(pick) {
  if (running || disposed) return
  running = true
  try {
    for (const id of props.ids) {
      const job = video.jobs[id]
      if ((job && TERMINAL.includes(job.state)) || !pick(job)) continue
      const { data } = await api.getStudioJob(id)
      if (!disposed && props.ids.includes(id)) video._put(data)
    }
    error.value = ''
  } catch { if (!disposed) error.value = 'Could not refresh jobs. Retrying shortly.' }
  finally { running = false }
}
refresh(() => true)
watch(() => props.ids.join(','), () => refresh(job => !job))
usePoller(() => { ticks += 1; return refresh(job => !job || job.state !== WAITING || ticks % WAITING_EVERY === 0) }, { interval: 4000 }).start({ immediate: false })
onBeforeUnmount(() => { disposed = true })
</script>
<style scoped>.studio-jobs{display:grid;gap:16px;min-width:0}</style>
