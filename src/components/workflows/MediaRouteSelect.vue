<template>
  <select class="ins-in" aria-label="Media model" :value="modelValue" :disabled="loading || !routes.length" @change="$emit('update:modelValue', $event.target.value)">
    <option value="">{{ loading ? 'Loading models…' : routes.length ? 'Choose model' : 'No proven model available' }}</option>
    <option v-for="route in routes" :key="route.route_id" :value="route.route_id">{{ route.name || route.model }} · {{ route.connection || 'AADML' }}</option>
  </select>
  <p v-if="error" class="ins-hint" role="alert">{{ error }} <button type="button" @click="load">Try again</button></p>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import api from '../../services/api'
const props = defineProps({ operation: String, modelValue: [String, Number], context: Object })
const emit = defineEmits(['update:modelValue'])
const routes = ref([]), loading = ref(false), error = ref('')
let sequence = 0
async function load() {
  const seq = ++sequence, operation = props.operation
  routes.value = []; loading.value = true; error.value = ''
  try {
    const { data } = await (operation === 'video'
      ? api.get('/video/routes/', { params: { task: 'text_to_video' } })
      : api.getMediaRoutes(operation))
    if (seq !== sequence) return
    // The video schema endpoint already filters to proven text-to-video routes.
    routes.value = (data.routes || []).filter(route => operation === 'video' ? route.ready !== false : route.ready === true)
    if (props.modelValue && !routes.value.some(route => String(route.route_id) === String(props.modelValue))) emit('update:modelValue', '')
  } catch {
    if (seq !== sequence) return
    emit('update:modelValue', '')
    error.value = 'Could not load proven models.'
  } finally { if (seq === sequence) loading.value = false }
}
watch(() => [props.operation, props.context], ([operation, context], previous) => {
  // Editing this node's operation invalidates its route; opening another saved node does not.
  if (previous && previous[0] !== operation && previous[1] === context) emit('update:modelValue', '')
  load()
}, { immediate: true })
onBeforeUnmount(() => { sequence++ })
</script>
