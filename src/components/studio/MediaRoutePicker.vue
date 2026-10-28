<template>
  <div class="mrp" data-field="route_id">
    <label class="st-field">{{ label }}
      <select class="st-input" :value="modelValue" required :disabled="loading || !ready.length" data-test="media-route" @change="emit('update:modelValue', $event.target.value)">
        <option v-if="loading" value="">Loading models…</option>
        <option v-else-if="!ready.length" value="">No model is proven for this yet</option>
        <option v-for="route in ready" :key="route.route_id" :value="String(route.route_id)">{{ routeOptionLabel(route) }}</option>
        <optgroup v-if="unproven.length" label="Not yet proven"><option v-for="route in unproven" :key="route.route_id" :value="String(route.route_id)" disabled>{{ routeOptionLabel(route) }}</option></optgroup>
      </select>
    </label>
    <p v-if="failure" class="st-error" role="alert">{{ failure }} <button type="button" class="st-button" @click="load">Try again</button></p>
    <p v-else-if="!loading && !ready.length" class="st-muted mrp-note" role="status">No model you can use has passed a test run for this yet. Connect a provider in <RouterLink to="/dashboard/settings/providers" class="st-link">Settings → AI providers</RouterLink> or try again later.</p>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import api from '../../services/api'
import { routeOptionLabel } from '../../utils/studioPrice'
// The models a person may use for one media operation; only proven ones can be chosen (the others are shown greyed).
// `model`: offer only that model (e.g. the one that takes trained identities).
const props = defineProps({ modelValue: { type: String, default: '' }, operation: { type: String, required: true }, label: { type: String, default: 'Model' }, model: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue','routes'])
const routes = ref([]), loading = ref(false), failure = ref('')
const ready = computed(() => routes.value.filter(route => route.ready)), unproven = computed(() => routes.value.filter(route => !route.ready))
let sequence = 0, disposed = false
async function load() {
  const seq = ++sequence
  loading.value = true; failure.value = ''
  try {
    const { data } = await api.getMediaRoutes(props.operation)
    if (disposed || seq !== sequence) return
    routes.value = (data.routes || []).filter(route => !props.model || route.model === props.model)
    emit('routes', routes.value)
    if (!ready.value.some(route => String(route.route_id) === props.modelValue)) emit('update:modelValue', ready.value[0] ? String(ready.value[0].route_id) : '')
  } catch { if (!disposed && seq === sequence) failure.value = 'Could not load the models.' }
  finally { if (!disposed && seq === sequence) loading.value = false }
}
watch(() => props.operation, load, { immediate: true })
onBeforeUnmount(() => { disposed = true })
</script>
<style scoped>.mrp{display:grid;gap:8px;min-width:0}.mrp-note{font-size:12px;line-height:1.55}</style>
