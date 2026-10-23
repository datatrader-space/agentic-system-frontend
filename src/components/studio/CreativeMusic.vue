<template>
  <form class="creative-form" @submit.prevent="prepare">
    <label class="st-field">Model<select v-model="routeId" class="st-input" required><option value="">Choose model</option><option v-for="route in routes" :key="route.route_id" :value="route.route_id" :disabled="!route.ready">{{ route.name }} · {{ route.connection || route.provider }}{{ route.ready ? '' : ' — Not yet proven' }}</option></select></label>
    <CreativeError v-if="error?.field === 'route_id'" :error="error" />
    <label class="st-field">Music brief<textarea v-model="prompt" class="st-input" required rows="5" /></label>
    <CreativeError v-if="error?.field === 'prompt'" :error="error" />
    <label class="st-field">Duration (seconds)<input v-model.number="duration" class="st-input" type="number" min="3" max="600" required /></label>
    <CreativeError v-if="error?.field === 'duration'" :error="error" />
    <label><input v-model="instrumental" type="checkbox" /> Instrumental</label>
    <CreativeError v-if="!['route_id','prompt','duration'].includes(error?.field)" :error="error" />
    <button class="st-button primary" :disabled="busy || !routeId">Review music estimate</button>
  </form>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import api from '../../services/api'
import CreativeError from './CreativeError.vue'
import { useCreativeForm } from '../../composables/useCreativeForm'
const emit = defineEmits(['job']), routes = ref([]), routeId = ref(''), prompt = ref(''), duration = ref(30), instrumental = ref(true)
const { busy, error, run } = useCreativeForm()
onMounted(() => run(async alive => { const { data } = await api.getMediaRoutes('music'); if (alive()) routes.value = data.routes || [] }))
function prepare() { run(async alive => {
  if (!routes.value.some(route => route.route_id === routeId.value && route.ready)) throw Error('Choose a proven model.')
  if (!prompt.value.trim() || duration.value < 3 || duration.value > 600) throw Error('Enter a music brief and a duration from 3 to 600 seconds.')
  const { data } = await api.prepareMediaJob({ operation: 'music', route_id: routeId.value, request: { prompt: prompt.value.trim(), duration: duration.value, instrumental: instrumental.value } })
  if (alive()) emit('job', data)
}) }
</script>
