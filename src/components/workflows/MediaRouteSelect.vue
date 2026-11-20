<!--
  The proven media model for a media.generate step (ADM-1333, F4).

  F4: the old select wiped the saved `route_id` when the route list failed to load, or loaded without the saved route.
  Now loading never changes the saved value; only the person's own choice does (and changing the step's operation,
  which SchemaForm writes as one change with the route cleared). A failed load says so with Retry; a saved route that
  the list does not offer right now stays selected and is marked as such.
  Emits: update:modelValue (the chosen route id), only on the person's choice.
-->
<template>
  <div class="mrs">
    <select
      :id="id"
      class="mrs-in"
      aria-label="Media model"
      :value="selectValue"
      :disabled="loading"
      :aria-describedby="note ? noteId : undefined"
      @change="onChange"
    >
      <option value="">{{ loading ? 'Loading models…' : routes.length ? 'Choose a model' : 'No proven model available' }}</option>
      <option v-if="savedMissing" :value="String(modelValue)">Saved model {{ modelValue }} (not offered right now)</option>
      <option v-for="route in routes" :key="route.route_id" :value="String(route.route_id)">{{ route.name || route.model }} · {{ route.connection || 'AADML' }}</option>
    </select>
    <p v-if="error" :id="noteId" class="mrs-note mrs-note--err" role="alert">
      {{ error }} Your saved model is kept.
      <button type="button" class="mrs-retry" @click="load">Retry</button>
    </p>
    <p v-else-if="savedMissing && !loading" :id="noteId" class="mrs-note">
      The saved model is not in the proven list for this operation right now. It is kept; choose another to replace it.
    </p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import api from '../../services/api'

const props = defineProps({
  operation: { type: String, default: '' },
  modelValue: { type: [String, Number], default: '' },
  id: { type: String, default: undefined },
})
const emit = defineEmits(['update:modelValue'])
const noteId = `mrs-note-${useId()}`
const routes = ref([])
const loading = ref(false)
const error = ref('')
let sequence = 0

const hasValue = computed(() => props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined)
const savedMissing = computed(() => hasValue.value && !routes.value.some((r) => String(r.route_id) === String(props.modelValue)))
const selectValue = computed(() => (hasValue.value ? String(props.modelValue) : ''))
const note = computed(() => !!error.value || (savedMissing.value && !loading.value))

async function load() {
  const seq = ++sequence
  const operation = props.operation
  routes.value = []
  loading.value = true
  error.value = ''
  try {
    const { data } = await (operation === 'video'
      ? api.get('/video/routes/', { params: { task: 'text_to_video' } })
      : api.getMediaRoutes(operation))
    if (seq !== sequence) return
    // The video schema endpoint already filters to proven text-to-video routes.
    routes.value = (data.routes || []).filter((route) => (operation === 'video' ? route.ready !== false : route.ready === true))
  } catch {
    if (seq !== sequence) return
    error.value = 'Could not load the proven models.'
  } finally {
    if (seq === sequence) loading.value = false
  }
}

function onChange(e) {
  const v = e.target.value
  const route = routes.value.find((r) => String(r.route_id) === v)
  // The route id keeps the type the server gave it (a number stays a number).
  emit('update:modelValue', route ? route.route_id : v)
}

watch(() => props.operation, load, { immediate: true })
onBeforeUnmount(() => { sequence += 1 })
</script>

<style scoped>
.mrs-in {
  width: 100%; min-height: 34px; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.mrs-in:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.mrs-note { margin: 4px 0 0; font-size: 12px; line-height: 1.45; color: var(--vm-amber-ink); }
.mrs-note--err { color: var(--vm-red-ink); }
.mrs-retry {
  margin-left: 4px; min-height: 28px; padding: 2px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background: var(--vm-surface); color: var(--vm-link); font: inherit; font-size: 12px; cursor: pointer;
}
.mrs-retry:hover { background: var(--vm-surface-soft); }
.mrs-retry:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
@media (pointer: coarse) { .mrs-in, .mrs-retry { min-height: 44px; } }
</style>
