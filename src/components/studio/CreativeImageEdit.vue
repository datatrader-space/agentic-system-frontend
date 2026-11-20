<template>
  <form class="creative-form" @submit.prevent="prepare">
    <MediaRoutePicker v-model="routeId" operation="edit_image" masked @routes="routes = $event" />
    <MediaSlot v-model="source" label="Image to edit" field="references" :kinds="['image']" required />
    <label class="st-field" data-field="prompt">What to change<textarea v-model="prompt" class="st-input" rows="4" required placeholder="Replace the mug with a glass of water; keep the table and light." data-test="edit-prompt" /></label>
    <p v-if="source.length && !takesMask" class="st-muted ie-note" data-test="no-mask-note">This model changes the image from your description; it does not take a painted area.</p>
    <fieldset v-if="source.length && takesMask" class="ie-tools" data-test="mask-tools">
      <legend>Area to change{{ requiresMask ? '' : ' (optional)' }}</legend>
      <div class="ie-modes" role="radiogroup" aria-label="Tool">
        <button v-for="t in tools" :key="t.id" type="button" role="radio" :aria-checked="mode === t.id" :data-test="`mask-${t.id}`" :title="t.hint" @click="mode = t.id">{{ t.label }}</button>
      </div>
      <template v-if="segRoute">
        <label class="st-field">Or name it<input v-model="words" class="st-input" maxlength="200" placeholder="the mug on the left" data-test="mask-words" /></label>
        <p class="st-muted ie-note" data-test="mask-selection">{{ selectionSummary }}</p>
        <div class="ie-find">
          <button type="button" class="st-button" :disabled="!canFind || finding" data-test="mask-find" @click="find">{{ finding ? 'Preparing…' : 'Find the area' }}</button>
          <button v-if="points.length || box" type="button" class="st-button" data-test="mask-reset-points" @click="resetSelection">Remove the points</button>
          <span class="st-muted ie-price" role="status" aria-live="polite" data-test="mask-price">{{ findPrice }}</span>
        </div>
        <div v-if="selection && selection.state === 'awaiting_authorization'" class="ie-card" role="group" aria-label="Find the area: estimate" data-test="mask-estimate">
          <p><strong>Finding this area costs {{ selectionAmount }}.</strong> Nothing is spent until you press Generate.</p>
          <div class="ie-actions">
            <button type="button" class="st-button primary" :disabled="acting" data-test="mask-generate" @click="act('start')">Generate</button>
            <button type="button" class="st-button" :disabled="acting" data-test="mask-decline" @click="act('decline')">Decline</button>
          </div>
        </div>
        <p v-else-if="selectionRunning" class="st-muted ie-note" role="status" data-test="mask-finding">Finding the area…</p>
        <p v-if="selectionError" class="st-error ie-note" role="alert" data-test="mask-error">{{ selectionError }}</p>
      </template>
      <p v-else-if="segLoaded" class="st-muted ie-note" data-test="mask-no-select">Clicking to select an area is not available yet: paint it instead.</p>
      <label v-if="mode === 'paint' || mode === 'erase'" class="st-field ie-size">Brush size<input v-model.number="brush" type="range" min="6" max="160" step="2" /></label>
      <div class="ie-actions" role="group" aria-label="Refine the area">
        <button type="button" class="st-button" :disabled="!painted" data-test="mask-invert" @click="canvas?.invert()">Invert</button>
        <button type="button" class="st-button" :disabled="!painted" data-test="mask-grow" @click="canvas?.grow()">Grow</button>
        <button type="button" class="st-button" :disabled="!painted" data-test="mask-shrink" @click="canvas?.shrink()">Shrink</button>
        <button type="button" class="st-button" data-test="mask-undo" @click="canvas?.undo()">Undo</button>
        <button type="button" class="st-button" :disabled="!painted" data-test="mask-clear" @click="canvas?.clear()">Clear</button>
      </div>
      <p class="st-muted ie-note" data-test="mask-state">{{ painted ? `The marked area changes (${size.width} × ${size.height}, the image's own size); the rest stays as it is.` : requiresMask ? 'This model changes only a marked area: select or paint it on the picture.' : 'Optional: select or paint an area to limit the change to it.' }}</p>
    </fieldset>
    <label class="st-field" data-field="aspect_ratio">Shape<select v-model="aspectRatio" class="st-input" :disabled="marked"><option value="">Keep the image's shape</option><option v-for="shape in shapes" :key="shape">{{ shape }}</option></select></label>
    <CreativeError :error="error" />
    <LivePrice v-bind="livePrice" :empty="missing || 'Fill in the details to see the price.'" />
    <button class="st-button primary" :disabled="busy || !!missing" data-test="edit-prepare">{{ busy ? 'Preparing…' : 'Review estimate' }}</button>
    <p v-if="missing && !busy" class="st-muted ie-note" role="status">{{ missing }}</p>
    <Teleport v-if="monitor" defer :to="`#${monitor}`">
      <img v-if="!takesMask && (source[0]?.url || source[0]?.thumbnail_url)" class="ie-preview" :src="source[0].url || source[0].thumbnail_url" alt="The image to edit" data-test="edit-preview" />
      <MaskCanvas v-else-if="source[0]?.url || source[0]?.thumbnail_url" ref="canvas" :src="source[0].url || source[0].thumbnail_url" :brush="brush" :mode="mode" :points="points" :box="box" @change="painted = $event" @size="size = $event" @point="addPoint" @box="box = $event" />
      <p v-else class="st-empty"><strong>Nothing on the monitor yet</strong>Add the image to edit. You can then select or paint the area to change.</p>
    </Teleport>
  </form>
</template>
<script setup>
import { useStudioPreparedBrief } from '../../composables/useStudioPreparedBrief'
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import api from '../../services/api'
import CreativeError from './CreativeError.vue'
import MaskCanvas from './MaskCanvas.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
import LivePrice from './LivePrice.vue'
import { useLivePrice } from '../../composables/useLivePrice'
import { useChatStore } from '../../stores/useChatStore'
import { useVideoStore } from '../../stores/useVideoStore'
import MediaSlot from './MediaSlot.vue'
import { useMediaJob } from '../../composables/useMediaJob'
import { useStudioUpload } from '../../composables/useStudioUpload'
import { useSessionProject } from '../../composables/useSessionProject'
import { priceAmount, usd } from '../../utils/studioPrice'
const emit = defineEmits(['job'])
const monitor = inject('studioMonitor', '')
const shapes = ['1:1', '4:3', '3:4', '16:9', '9:16']
// "Edit" on a picture (useVideoStore.editFrom) queues it as the store's edit_source: the page starts with it in
// "Image to edit", as Enhance does for a video.
const video = useVideoStore()
const queued = (video.refs || []).find(item => item.role === 'edit_source' && item.attachment_id && !item.isVideo)
const routes = ref([]), routeId = ref(''), source = ref(queued ? [{ attachment_id: queued.attachment_id, name: queued.name || 'Image', media_type: 'image', url: queued.url || '', thumbnail_url: queued.thumbnail_url || queued.url || '' }] : []), prompt = ref(''), aspectRatio = ref(''), brush = ref(40), painted = ref(false), size = ref({ width: 0, height: 0 }), canvas = ref(null)
const { busy, error, submit } = useMediaJob(job => emit('job', job))
const { upload, error: uploadError } = useStudioUpload()
const chat = useChatStore()
const { session } = useSessionProject()
// A model that edits from the description alone takes no area (the routes API's takes_mask): no mask tools. One that
// edits ONLY a marked area (requires_mask: FLUX Fill) asks for one before the estimate.
const chosen = computed(() => routes.value.find(route => String(route.route_id) === String(routeId.value)))
const takesMask = computed(() => chosen.value?.takes_mask !== false)
const requiresMask = computed(() => !!(chosen.value?.requires_mask || chosen.value?.needs?.mask))
const marked = computed(() => painted.value && takesMask.value)
watch(takesMask, yes => { if (!yes) painted.value = false })

// ── Click to select (ADM-1251): SAM 3 finds the area from points, a box or words ────────────────────────
// Finding it is a small paid job: its price shows first, and it runs only on the person's Generate on its card.
const segRoutes = ref([]), segLoaded = ref(false)
const segRoute = computed(() => segRoutes.value.find(r => r.ready) || null)
Promise.resolve(api.getMediaRoutes('segment')).then(res => { segRoutes.value = res?.data?.routes || [] })
  .catch(() => { segRoutes.value = [] }).finally(() => { segLoaded.value = true })
const TOOLS = [
  { id: 'select', label: 'Select', hint: 'Click the part to change (Alt-click: not this part)', sam: true },
  { id: 'remove', label: 'Not this', hint: 'Click a part that should stay', sam: true },
  { id: 'box', label: 'Box', hint: 'Drag a box around the part to change', sam: true },
  { id: 'paint', label: 'Paint', hint: 'Paint the area to change' },
  { id: 'erase', label: 'Erase', hint: 'Rub out what should stay' },
]
const tools = computed(() => TOOLS.filter(t => !t.sam || segRoute.value))
const mode = ref('paint')
watch(segRoute, r => {
  if (r && mode.value === 'paint' && !painted.value) mode.value = 'select'
  if (!r && TOOLS.find(t => t.id === mode.value)?.sam) mode.value = 'paint'
})
const points = ref([]), box = ref(null), words = ref('')
const selection = ref(null), finding = ref(false), acting = ref(false), selectionError = ref('')
function addPoint(p) { points.value = [...points.value, p] }
function resetSelection() { points.value = []; box.value = null }
const positive = computed(() => points.value.filter(p => p.label === 1).length)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const selectionSummary = computed(() => {
  const parts = []
  if (positive.value) parts.push(`${plural(positive.value, 'point')} on it`)
  const off = points.value.length - positive.value
  if (off) parts.push(`${plural(off, 'point')} off it`)
  if (box.value) parts.push('a box')
  return parts.length ? `Selected: ${parts.join(', ')}.` : 'Click the part to change, drag a box around it, or name it.'
})
const segRequest = () => ({
  ...(points.value.length ? { points: points.value } : {}),
  ...(box.value ? { box: box.value } : {}),
  ...(words.value.trim() ? { prompt: words.value.trim() } : {}),
})
const segReferences = () => [{ attachment_id: source.value[0].attachment_id, role: 'edit_source' }]
const canFind = computed(() => !!(segRoute.value && source.value.length && (positive.value || box.value || words.value.trim())))
const segQuote = useLivePrice(() => canFind.value ? { kind: 'media', operation: 'segment', route_id: segRoute.value.route_id, request: segRequest(),
  references: segReferences(), ...(chat.conversationId ? { conversation_id: chat.conversationId } : {}) } : null)
const findPrice = computed(() => segQuote.loading.value ? 'Working out the price…' : segQuote.problem.value || (segQuote.price.value ? priceAmount(segQuote.price.value) : ''))
const selectionAmount = computed(() => usd(selection.value?.quote?.estimate_usd))
const RUNNING = ['queued', 'submitting', 'running', 'ingesting', 'provider_status_unknown', 'submission_uncertain']
const selectionRunning = computed(() => RUNNING.includes(selection.value?.state))
const errText = (e, fallback) => e?.response?.data?.error?.message || e?.message || fallback
async function find() {
  if (!canFind.value || finding.value) return
  finding.value = true; selectionError.value = ''
  try {
    const cid = await chat.ensureConversation()
    if (!cid) throw new Error('Could not start this Studio session. Try again.')
    const { data } = await api.prepareMediaJob({ operation: 'segment', route_id: segRoute.value.route_id, request: segRequest(), references: segReferences(), ...session(cid) })
    selection.value = data
    video._put?.(data)
  } catch (e) { selectionError.value = errText(e, 'The area could not be prepared. Nothing was started.') }
  finally { finding.value = false }
}
async function act(action) {
  const job = selection.value
  if (!job || acting.value) return
  acting.value = true; selectionError.value = ''
  try {
    const { data } = await api.post(`/video/jobs/${job.job_id}/${action}/`, action === 'start' ? { accept: true } : {})
    video._put?.(data)
    if (action === 'start') { selection.value = data; follow() } else selection.value = null
  } catch (e) { selectionError.value = errText(e, action === 'start' ? 'Finding the area could not start.' : 'It could not be declined. Try again.') }
  finally { acting.value = false }
}
// Follow the started selection until its mask is ready, then lay it on the picture.
let timer = null, alive = true
function stopFollowing() { clearTimeout(timer); timer = null }
function follow() {
  stopFollowing()
  const look = async () => {
    const job = selection.value
    if (!alive || !job) return
    try {
      const { data } = await api.getStudioJob(job.job_id)
      if (!alive || selection.value?.job_id !== job.job_id) return
      selection.value = data; video._put?.(data)
      if (data.state === 'ready') return applyMask(data)
      if (['failed', 'cancelled'].includes(data.state)) { selectionError.value = data.error?.message || 'The area could not be found.'; return }
    } catch { /* the next look tries again */ }
    timer = setTimeout(look, 1500)
  }
  timer = setTimeout(look, 1000)
}
async function applyMask(job) {
  try {
    const { data } = await api.getStudioJobMask(job.job_id)
    if (!(await canvas.value?.setMask(data))) throw new Error('The area could not be shown on the picture.')
    mode.value = 'paint'
  } catch (e) { selectionError.value = errText(e, 'The area could not be shown on the picture.') }
}
watch(source, () => { painted.value = false; resetSelection(); words.value = ''; stopFollowing(); selection.value = null; selectionError.value = '' })
onBeforeUnmount(() => { alive = false; stopFollowing() })

const missing = computed(() => !routeId.value ? 'Choose a model that is proven for image edits.' : !source.value.length ? 'Add the image to edit.' : !prompt.value.trim() ? 'Say what to change.' : requiresMask.value && !marked.value ? 'Select or paint the area to change first.' : '')
// A marked edit keeps the picture's own size, so no shape is sent with it.
const editRequest = () => ({ prompt: prompt.value.trim(), ...(aspectRatio.value && !marked.value ? { aspect_ratio: aspectRatio.value } : {}) })
// The price as the model, image and words change (UX pass, 2026-10-28). A model that needs the mask to price it
// (its quote checks the marked area) is priced on the estimate card instead.
const quote = useLivePrice(() => missing.value || requiresMask.value ? null : { kind: 'media', operation: 'edit_image', route_id: routeId.value,
  request: editRequest(), references: [{ attachment_id: source.value[0].attachment_id, role: 'edit_source' }], ...(chat.conversationId ? { conversation_id: chat.conversationId } : {}) })
const livePrice = computed(() => requiresMask.value && !missing.value
  ? { price: null, loading: false, problem: 'The price is worked out with the marked area when you review the estimate.' }
  : { price: quote.price.value, loading: quote.loading.value, problem: quote.problem.value })
function prepare() {
  if (missing.value) return
  submit(async s => {
    const references = [{ attachment_id: source.value[0].attachment_id, role: 'edit_source' }]
    const blob = marked.value ? await canvas.value?.toBlob() : null
    if (blob) {
      const mask = await upload(new File([blob], 'mask.png', { type: 'image/png' }))
      if (!mask) throw new Error(uploadError.value || 'The mask could not be saved.')
      references.push({ attachment_id: mask.attachment_id, role: 'mask' })
    } else if (requiresMask.value) throw new Error('Select or paint the area to change first.')
    return api.prepareMediaJob({ operation: 'edit_image', route_id: routeId.value, request: editRequest(), references, ...s })
  })
}
useStudioPreparedBrief(prompt)
</script>
<style scoped>
.ie-tools{display:grid;gap:10px;min-width:0;margin:0;padding:12px;border:1px solid var(--vm-line);border-radius:7px}
.ie-tools legend{padding:0 4px;font:600 13px var(--vm-font-sans);color:var(--vm-ink)}
.ie-modes{display:flex;flex-wrap:wrap;gap:3px;padding:3px;border:1px solid var(--vm-line);border-radius:7px;background:var(--vm-surface-2)}
.ie-modes button{flex:1 1 auto;min-height:34px;padding:0 10px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--vm-ink-soft);font:500 13px var(--vm-font-sans);cursor:pointer}
.ie-modes button[aria-checked=true]{background:var(--vm-surface);border-color:var(--vm-line);color:var(--vm-ink)}
.ie-modes button:focus-visible{outline:2px solid var(--vm-violet);outline-offset:2px}
.ie-size input{width:100%;accent-color:var(--vm-violet)}
.ie-actions,.ie-find{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.ie-price{font-size:12px}
.ie-card{display:grid;gap:8px;padding:10px 12px;border:1px solid var(--vm-line);border-radius:7px;background:var(--vm-violet-soft)}
.ie-card p{margin:0;font-size:13px;line-height:1.5;color:var(--vm-ink)}
.ie-note{font-size:12px;line-height:1.55}
.ie-preview{display:block;max-width:100%;max-height:70vh;margin:0 auto;border-radius:6px}
@media(max-width:767px){.ie-modes button,.ie-actions button,.ie-find button{min-height:44px}}
</style>
