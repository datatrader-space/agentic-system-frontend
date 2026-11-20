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
    <p v-else-if="!loading && !ready.length && only && all.some(route => route.ready)" class="st-muted mrp-note" role="status" data-test="media-route-none-fits">{{ onlyNote }}</p>
    <p v-else-if="!loading && !ready.length" class="st-muted mrp-note" role="status">No model has passed a test run for this yet. A platform administrator adds them. <RouterLink to="/dashboard/billing" class="st-link">Billing</RouterLink> shows what you have to spend.</p>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import api from '../../services/api'
import { routeOptionLabel } from '../../utils/studioPrice'
// The models a person may use for one media operation; only proven ones can be chosen (the others are shown greyed).
// `model`: offer only that model (e.g. the one that takes trained identities). `only`: offer only these route ids (a
// recipe that needs more than the task, e.g. a model that can change a picture's shape); `onlyNote` says why none fits.
// A model that edits ONLY a marked area (requires_mask, ADM-1251) is offered only where the page sends a mask (`masked`).
const props = defineProps({ modelValue: { type: String, default: '' }, operation: { type: String, required: true }, label: { type: String, default: 'Model' }, model: { type: String, default: '' }, only: { type: Array, default: null }, onlyNote: { type: String, default: 'None of the models you can use can do this yet.' }, masked: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue','routes'])
const all = ref([]), loading = ref(false), failure = ref('')
const offered = route => (!props.model || route.model === props.model) && (!props.only || props.only.map(String).includes(String(route.route_id))) && (props.masked || !route.requires_mask)
const routes = computed(() => all.value.filter(offered))
const ready = computed(() => routes.value.filter(route => route.ready)), unproven = computed(() => routes.value.filter(route => !route.ready))
let sequence = 0, disposed = false
// The chosen model stays only while it is offered; otherwise the first proven one is chosen.
function choose() { if (!ready.value.some(route => String(route.route_id) === props.modelValue)) emit('update:modelValue', ready.value[0] ? String(ready.value[0].route_id) : '') }
async function load() {
  const seq = ++sequence
  loading.value = true; failure.value = ''
  try {
    const { data } = await api.getMediaRoutes(props.operation)
    if (disposed || seq !== sequence) return
    all.value = data.routes || []
    emit('routes', routes.value)
    choose()
  } catch { if (!disposed && seq === sequence) failure.value = 'Could not load the models.' }
  finally { if (!disposed && seq === sequence) loading.value = false }
}
watch(() => props.operation, load, { immediate: true })
watch(() => [props.only, props.model], () => { if (!loading.value && !failure.value) choose() })
onBeforeUnmount(() => { disposed = true })
</script>
<style scoped>.mrp{display:grid;gap:8px;min-width:0}.mrp-note{font-size:12px;line-height:1.55}</style>
