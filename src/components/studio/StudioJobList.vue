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
import VideoJobCard from '../video/VideoJobCard.vue'
const props = defineProps({ ids: { type: Array, default: () => [] } })
const emit = defineEmits(['settled'])
const video = useVideoStore(), error = ref('')
const rows = computed(() => props.ids.map(id => video.jobs[id]).filter(Boolean))
const terminalKeys = () => rows.value.filter(job => ['ready','failed','cancelled'].includes(job.state)).map(job => `${job.job_id}:${job.state}`)
const reported = new Set(terminalKeys())
watch(terminalKeys, keys => { for (const key of keys) if (!reported.has(key)) { reported.add(key); emit('settled') } })
let disposed = false, running = false
async function refresh() {
  if (running || disposed) return
  running = true
  try {
    for (const id of props.ids) {
      const job = video.jobs[id]
      if (job && ['ready','failed','cancelled'].includes(job.state)) continue
      const { data } = await api.getStudioJob(id)
      if (!disposed && props.ids.includes(id)) video._put(data)
    }
    error.value = ''
  } catch { if (!disposed) error.value = 'Could not refresh jobs. Retrying shortly.' }
  finally { running = false }
}
watch(() => [...props.ids], refresh, { immediate: true })
const timer = setInterval(refresh, 4000)
onBeforeUnmount(() => { disposed = true; clearInterval(timer) })
</script>
<style scoped>.studio-jobs{display:grid;gap:16px;min-width:0}</style>
