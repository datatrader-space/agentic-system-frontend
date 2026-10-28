<template>
  <form class="creative-form" @submit.prevent="prepare">
    <div class="cw-modes" role="radiogroup" aria-label="What to do">
      <button v-for="m in modes" :key="m.id" type="button" role="radio" :aria-checked="mode === m.id" :data-test="`swap-${m.id}`" @click="mode = m.id">{{ m.label }}</button>
    </div>
    <p class="st-muted cw-note">{{ current.purpose }}</p>
    <div class="st-field" data-field="route_id">
      <label class="st-field">Model<select v-model="routeId" class="st-input" required :disabled="loading || !routes.length" data-test="swap-route"><option v-if="loading" value="">Loading models…</option><option v-else-if="!routes.length" value="">No model you can use edits footage yet</option><option v-for="r in routes" :key="r.route_id" :value="String(r.route_id)">{{ r.name }} · {{ r.connection }}</option></select></label>
      <p v-if="route?.inputs?.spec?.summary" class="st-muted cw-note" data-test="swap-reference-summary">{{ route.inputs.spec.summary }}</p>
      <p v-if="failure" class="st-error" role="alert">{{ failure }}</p>
    </div>
    <MediaSlot v-model="source" label="Your video" field="base_attachment_id" :kinds="['video']" required />
    <MediaSlot v-if="mode === 'swap' && subjectLimit" v-model="subject" label="What to put in" field="references" :kinds="['image']" :limit="subjectLimit" required />
    <p v-else-if="mode === 'swap'" class="st-muted cw-note cw-block" role="status" data-test="swap-no-references">{{ route?.name || 'This model' }} cannot swap in an object from a photo: it takes no reference images. Choose another model, or use <button type="button" class="st-link cw-inline" @click="mode = 'restyle'">Restyle</button> to describe the change in words.</p>
    <label class="st-field" data-field="prompt">{{ mode === 'swap' ? 'What to replace' : 'The new look' }}<textarea v-model="prompt" class="st-input" rows="4" required :placeholder="mode === 'swap' ? 'Replace the red bottle with the product in the photo.' : 'Hand-drawn watercolour, soft paper texture.'" data-test="swap-prompt" /></label>
    <CreativeError :error="error" />
    <button class="st-button primary" :disabled="busy || !!missing" data-test="swap-prepare">{{ busy ? 'Preparing…' : 'Review estimate' }}</button>
    <p v-if="missing && !busy" class="st-muted cw-note" role="status">{{ missing }}</p>
    <Teleport v-if="monitor" defer :to="`#${monitor}`"><MediaMonitor :items="[...source.map(f => ({ ...f, role: 'Your video' })), ...subject.map(f => ({ ...f, role: 'What to put in' }))]" empty="Add the video to change." /></Teleport>
  </form>
</template>
<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import api from '../../services/api'
import CreativeError from './CreativeError.vue'
import MediaMonitor from './MediaMonitor.vue'
import MediaSlot from './MediaSlot.vue'
import { useMediaJob } from '../../composables/useMediaJob'
// A change to the person's own footage, on the Video page's models that edit video. The server chooses the task from
// the clip: edit_uploaded for an upload, edit_generated for a Studio result. A model proven for either is listed.
const emit = defineEmits(['job'])
const monitor = inject('studioMonitor', '')
const modes = [{ id: 'swap', label: 'Swap object', purpose: 'Replace something in your video with what is in a photo; the movement is kept.' }, { id: 'restyle', label: 'Restyle', purpose: 'Give your video a new look; the movement and timing are kept.' }]
const mode = ref('swap'), routes = ref([]), routeId = ref(''), loading = ref(true), failure = ref(''), source = ref([]), subject = ref([]), prompt = ref('')
const current = computed(() => modes.find(m => m.id === mode.value))
const route = computed(() => routes.value.find(r => String(r.route_id) === routeId.value))
// The model's own limit (null: none published, the server decides).
const subjectLimit = computed(() => { const n = route.value?.inputs?.spec?.images; return n == null ? 4 : Number(n) })
const { busy, error, submit } = useMediaJob(job => emit('job', job))
let disposed = false
onMounted(async () => {
  try {
    const answers = await Promise.all(['edit_uploaded', 'edit_generated'].map(task => api.getStudioRoutes(task)))
    if (disposed) return
    const seen = new Set()
    routes.value = answers.flatMap(({ data }) => data.routes || []).filter(r => !seen.has(r.route_id) && seen.add(r.route_id))
    routeId.value = routes.value[0] ? String(routes.value[0].route_id) : ''
  }
  catch { if (!disposed) failure.value = 'Could not load the models.' }
  finally { if (!disposed) loading.value = false }
})
onBeforeUnmount(() => { disposed = true })
const missing = computed(() => {
  if (!routeId.value) return 'Choose a model that edits footage.'
  if (!source.value.length) return 'Add your video.'
  if (mode.value === 'swap' && !subjectLimit.value) return 'Choose a model that takes a reference image, or use Restyle.'
  if (mode.value === 'swap' && !subject.value.length) return 'Add a photo of what to put in.'
  if (subject.value.length > subjectLimit.value) return `This model takes up to ${subjectLimit.value} reference image${subjectLimit.value === 1 ? '' : 's'}.`
  return !prompt.value.trim() ? (mode.value === 'swap' ? 'Say what to replace.' : 'Describe the new look.') : ''
})
function prepare() {
  if (missing.value) return
  const references = mode.value === 'swap' ? subject.value.map(f => ({ attachment_id: f.attachment_id, role: 'subject' })) : []
  submit(s => api.prepareVideoJob({ operation: 'change', route_id: routeId.value, base_attachment_id: source.value[0].attachment_id, prompt: prompt.value.trim(), references, ...s }))
}
</script>
<style scoped>
.cw-modes{display:flex;gap:3px;padding:3px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface-2)}.cw-modes button{flex:1;min-height:36px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--vm-ink-soft);font:500 13px var(--vm-font-sans);cursor:pointer}.cw-modes button[aria-checked=true]{background:var(--vm-surface);border-color:var(--vm-line);color:var(--vm-ink)}.cw-note{font-size:12px;line-height:1.55}.cw-block{padding:10px 12px;border:1px solid var(--vm-line);border-radius:7px}.cw-inline{padding:0;border:0;background:none;font:inherit}@media(max-width:767px){.cw-modes button{min-height:44px}}
</style>
