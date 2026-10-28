<template>
  <form class="creative-form" @submit.prevent="prepare">
    <label class="st-field">Model<select v-model="routeId" class="st-input" required><option value="">Choose model</option><option v-for="route in routes" :key="route.route_id" :value="route.route_id" :disabled="!route.ready">{{ route.name }} · {{ route.connection || route.provider }}{{ route.ready ? '' : ' — Not yet proven' }}</option></select></label>
    <CreativeError v-if="error?.field === 'route_id'" :error="error" />
    <label class="st-field">Music brief<textarea v-model="prompt" class="st-input" required rows="5" /></label>
    <CreativeError v-if="error?.field === 'prompt'" :error="error" />
    <p v-if="length.fixed_seconds" class="st-muted cm-note" data-test="music-fixed-length">This model always makes {{ length.fixed_seconds }} seconds.</p>
    <label v-else class="st-field">{{ length.by_description ? 'About how long, in seconds (optional)' : 'Duration (seconds)' }}<input v-model.number="duration" class="st-input" type="number" :min="length.min || 3" :max="length.max || 600" :required="!length.by_description" :placeholder="length.by_description ? 'The model chooses' : ''" data-test="music-duration" /></label>
    <p v-if="length.by_description" class="st-muted cm-note">A full song with vocals and lyrics unless you choose Instrumental. The length is a request the model follows closely, not an exact cut.</p>
    <CreativeError v-if="error?.field === 'duration'" :error="error" />
    <label><input v-model="instrumental" type="checkbox" /> Instrumental</label>
    <CreativeError v-if="!['route_id','prompt','duration'].includes(error?.field)" :error="error" />
    <LivePrice v-bind="livePrice" empty="Choose the model and describe the music to see the price." />
    <button class="st-button primary" :disabled="busy || !routeId">Review music estimate</button>
  </form>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../../services/api'
import CreativeError from './CreativeError.vue'
import LivePrice from './LivePrice.vue'
import { useLivePrice } from '../../composables/useLivePrice'
import { useCreativeForm } from '../../composables/useCreativeForm'
import { useMediaJob } from '../../composables/useMediaJob'
const emit = defineEmits(['job']), routes = ref([]), routeId = ref(''), prompt = ref(''), duration = ref(30), instrumental = ref(true)
// The job goes through the page's Studio session like every creative page: it belongs to this chat, so My results
// still shows it after a reload (it was sent with no chat and vanished on refresh, 2026-10-27).
const { busy, error: jobError, submit } = useMediaJob(job => emit('job', job))
const loading = useCreativeForm()
const error = computed(() => jobError.value || loading.error.value)
// How the chosen model takes a length (the backend's `length`): {min, max} seconds, {fixed_seconds}, or
// {by_description, min, max} (written into the description). A model with no rule takes 3 to 600 seconds.
const length = computed(() => routes.value.find(route => route.route_id === routeId.value)?.length || { min: 3, max: 600 })
onMounted(() => loading.run(async alive => { const { data } = await api.getMediaRoutes('music'); if (alive()) routes.value = data.routes || [] }))
// The price as the model, the words and the length change (UX pass, 2026-10-28); the checks stay on Review.
const quote = useLivePrice(() => {
  if (!routeId.value || !prompt.value.trim()) return null
  const rule = length.value, seconds = duration.value === '' || duration.value == null ? null : Number(duration.value)
  return { kind: 'media', operation: 'music', route_id: routeId.value, request: { prompt: prompt.value.trim(), instrumental: instrumental.value, ...(rule.fixed_seconds || seconds == null ? {} : { duration: seconds }) } }
})
const livePrice = computed(() => ({ price: quote.price.value, loading: quote.loading.value, problem: quote.problem.value }))
function prepare() { submit(session => {
  if (!routes.value.some(route => route.route_id === routeId.value && route.ready)) throw Error('Choose a proven model.')
  const rule = length.value, seconds = duration.value === '' || duration.value == null ? null : Number(duration.value)
  if (!prompt.value.trim()) throw Error('Enter a music brief.')
  if (!rule.fixed_seconds && !rule.by_description && (seconds == null || seconds < rule.min || seconds > rule.max)) throw Error(`Enter a duration from ${rule.min} to ${rule.max} seconds.`)
  if (rule.by_description && seconds != null && (seconds < rule.min || seconds > rule.max)) throw Error(`Ask for ${rule.min} to ${rule.max} seconds, or leave it empty.`)
  const request = { prompt: prompt.value.trim(), instrumental: instrumental.value, ...(rule.fixed_seconds || seconds == null ? {} : { duration: seconds }) }
  return api.prepareMediaJob({ operation: 'music', route_id: routeId.value, request, ...session })
}) }
</script>
<style scoped>.cm-note{font-size:12px;line-height:1.55}</style>
