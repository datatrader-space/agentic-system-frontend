<template>
  <form class="creative-form" @submit.prevent="prepare">
    <MediaRoutePicker v-model="routeId" operation="edit_image" @routes="routes = $event" />
    <MediaSlot v-model="source" label="Image to edit" field="references" :kinds="['image']" required />
    <label class="st-field" data-field="prompt">What to change<textarea v-model="prompt" class="st-input" rows="4" required placeholder="Replace the mug with a glass of water; keep the table and light." data-test="edit-prompt" /></label>
    <p v-if="source.length && !takesMask" class="st-muted ie-note" data-test="no-mask-note">This model changes the image from your description; it does not take a painted area.</p>
    <div v-if="source.length && takesMask" class="ie-tools" role="group" aria-label="Mask">
      <div class="ie-modes" role="radiogroup" aria-label="Brush">
        <button v-for="m in ['paint','erase']" :key="m" type="button" role="radio" :aria-checked="mode === m" :data-test="`mask-${m}`" @click="mode = m">{{ m === 'paint' ? 'Paint' : 'Erase' }}</button>
      </div>
      <label class="st-field ie-size">Brush size<input v-model.number="brush" type="range" min="6" max="160" step="2" /></label>
      <div class="ie-actions"><button type="button" class="st-button" :disabled="!painted" @click="canvas?.undo()">Undo</button><button type="button" class="st-button" :disabled="!painted" data-test="mask-clear" @click="canvas?.clear()">Clear mask</button></div>
      <p class="st-muted ie-note">{{ painted ? `Mask painted (${size.width} × ${size.height}, the image's own size).` : 'Optional: paint on the preview to limit the change to one area.' }}</p>
    </div>
    <label class="st-field" data-field="aspect_ratio">Shape<select v-model="aspectRatio" class="st-input"><option value="">Keep the image's shape</option><option v-for="shape in shapes" :key="shape">{{ shape }}</option></select></label>
    <CreativeError :error="error" />
    <LivePrice v-bind="livePrice" :empty="missing || 'Fill in the details to see the price.'" />
    <button class="st-button primary" :disabled="busy || !!missing" data-test="edit-prepare">{{ busy ? 'Preparing…' : 'Review estimate' }}</button>
    <p v-if="missing && !busy" class="st-muted ie-note" role="status">{{ missing }}</p>
    <Teleport v-if="monitor" defer :to="`#${monitor}`">
      <img v-if="!takesMask && (source[0]?.url || source[0]?.thumbnail_url)" class="ie-preview" :src="source[0].url || source[0].thumbnail_url" alt="The image to edit" data-test="edit-preview" />
      <MaskCanvas v-else-if="source[0]?.url || source[0]?.thumbnail_url" ref="canvas" :src="source[0].url || source[0].thumbnail_url" :brush="brush" :mode="mode" @change="painted = $event" @size="size = $event" />
      <p v-else class="st-empty"><strong>Nothing on the monitor yet</strong>Add the image to edit. You can then paint the area to change.</p>
    </Teleport>
  </form>
</template>
<script setup>
import { computed, inject, ref, watch } from 'vue'
import api from '../../services/api'
import CreativeError from './CreativeError.vue'
import MaskCanvas from './MaskCanvas.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
import LivePrice from './LivePrice.vue'
import { useLivePrice } from '../../composables/useLivePrice'
import { useChatStore } from '../../stores/useChatStore'
import MediaSlot from './MediaSlot.vue'
import { useMediaJob } from '../../composables/useMediaJob'
import { useStudioUpload } from '../../composables/useStudioUpload'
const emit = defineEmits(['job'])
const monitor = inject('studioMonitor', '')
const shapes = ['1:1', '4:3', '3:4', '16:9', '9:16']
const routes = ref([]), routeId = ref(''), source = ref([]), prompt = ref(''), aspectRatio = ref(''), brush = ref(40), mode = ref('paint'), painted = ref(false), size = ref({ width: 0, height: 0 }), canvas = ref(null)
const { busy, error, submit } = useMediaJob(job => emit('job', job))
const { upload, error: uploadError } = useStudioUpload()
watch(source, () => { painted.value = false })
// A model that edits from the description alone takes no painted area (the routes API's takes_mask): no painter.
const takesMask = computed(() => routes.value.find(route => String(route.route_id) === String(routeId.value))?.takes_mask !== false)
watch(takesMask, yes => { if (!yes) painted.value = false })
const missing = computed(() => !routeId.value ? 'Choose a model that is proven for image edits.' : !source.value.length ? 'Add the image to edit.' : !prompt.value.trim() ? 'Say what to change.' : '')
// The price as the model, image and words change (UX pass, 2026-10-28); a painted area does not change it.
const chat = useChatStore()
const quote = useLivePrice(() => missing.value ? null : { kind: 'media', operation: 'edit_image', route_id: routeId.value,
  request: { prompt: prompt.value.trim(), ...(aspectRatio.value ? { aspect_ratio: aspectRatio.value } : {}) },
  references: [{ attachment_id: source.value[0].attachment_id, role: 'edit_source' }], ...(chat.conversationId ? { conversation_id: chat.conversationId } : {}) })
const livePrice = computed(() => ({ price: quote.price.value, loading: quote.loading.value, problem: quote.problem.value }))
function prepare() {
  if (missing.value) return
  submit(async s => {
    const references = [{ attachment_id: source.value[0].attachment_id, role: 'edit_source' }]
    const blob = painted.value && takesMask.value ? await canvas.value?.toBlob() : null
    if (blob) {
      const mask = await upload(new File([blob], 'mask.png', { type: 'image/png' }))
      if (!mask) throw new Error(uploadError.value || 'The mask could not be saved.')
      references.push({ attachment_id: mask.attachment_id, role: 'mask' })
    }
    return api.prepareMediaJob({ operation: 'edit_image', route_id: routeId.value, request: { prompt: prompt.value.trim(), ...(aspectRatio.value ? { aspect_ratio: aspectRatio.value } : {}) }, references, ...s })
  })
}
</script>
<style scoped>
.ie-tools{display:grid;gap:10px;padding:12px;border:1px solid var(--vm-line);border-radius:7px}.ie-modes{display:flex;gap:3px;padding:3px;border:1px solid var(--vm-line);border-radius:7px;background:var(--vm-surface-2)}.ie-modes button{flex:1;min-height:34px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--vm-ink-soft);font:500 13px var(--vm-font-sans);cursor:pointer}.ie-modes button[aria-checked=true]{background:var(--vm-surface);border-color:var(--vm-line);color:var(--vm-ink)}.ie-size input{width:100%;accent-color:var(--vm-violet)}.ie-actions{display:flex;flex-wrap:wrap;gap:6px}.ie-note{font-size:12px;line-height:1.55}.ie-preview{display:block;max-width:100%;max-height:70vh;margin:0 auto;border-radius:6px}@media(max-width:767px){.ie-modes button{min-height:44px}}
</style>
