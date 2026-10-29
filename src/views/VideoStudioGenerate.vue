<template>
  <StudioPage ref="page" :chat-expanded="isAgent && chatExpanded" :title="feature.label" :purpose="feature.purpose" :active-tab="tab" preset-picker @new="freshStart" :new-disabled="chat.isBusy || video.busy || !!chat.hitlRequests.length" @update:active-tab="tab = $event">
    <template #form="{ narrow }">
      <StudioModeSwitch />
      <StudioFirstVisit :hidden="hintHidden" @dismiss="dismissHint" />
      <div class="sg-preset"><span class="st-muted">Preset</span><strong class="sg-preset-chip">{{ selected?.title || 'Your own idea' }}</strong><button v-if="selected" type="button" class="st-button" aria-label="Clear preset" @click="selectedId = ''">Clear</button></div>
      <BottomSheet v-if="narrow" ref="presetSheet" label="Change preset" :summary="selected?.title || 'Your own idea'" test-id="studio-preset-picker"><PresetGallery :presets="presets" :selected="selectedId" @select="choose" /></BottomSheet>
      <p v-if="loading" class="st-status" role="status">Loading your models...</p><div v-if="error" class="st-error" role="alert">{{ error }}<button type="button" class="st-button" @click="initialize">Try again</button></div>
      <StudioReferenceInputs v-if="!isAgent" :groups="inputGroups" :unassigned="unassigned" @add-files="addFiles" @pick="pick" @remove="video.removeRef($event)" />
      <StudioAgentPanel v-show="isAgent" ref="agentPanel" v-model="agentDraft" v-model:expanded="chatExpanded" :label="feature.label" :purpose="feature.purpose" :ready="ready" @approved="tab = 'results'" />
      <div v-show="!isAgent" class="sg-manual">
      <div class="sg-help"><button type="button" class="st-button" data-test="studio-write-prompt" :disabled="!ready || chat.isBusy || !!helper" @click="askHelper('prompt')">Write it for me</button><button type="button" class="st-button" data-test="studio-suggest-settings" :disabled="!ready || chat.isBusy || !!helper" @click="askHelper('settings')">Suggest settings</button></div>
      <p v-if="helper" class="st-status" role="status">{{ helper === 'prompt' ? 'Writing a direction for you to edit...' : 'Preparing settings for you to review...' }}<button type="button" class="st-button" @click="chat.stop(); helper = ''">Stop</button></p>
      <p v-if="helperNote" class="sg-helper-note" data-test="studio-helper-note" role="status">{{ helperNote }}</p>
      <details :open="!selected || !!details"><summary class="sg-details">Add details{{ selected ? ' (optional)' : '' }}</summary><label class="st-field"><span>Creative direction</span><textarea v-model="details" class="st-input" rows="5" maxlength="8000" placeholder="Describe the subject, setting or changes you want." /></label></details>
      <p v-if="selected" class="st-muted sg-variant" role="status">Variation: {{ selected.variants[variant % selected.variants.length] }}</p>
      <StudioSettings :kind="kind" />
      </div>
      <p v-if="draftMessage" class="st-error" role="status">{{ draftMessage }}</p>
      <p v-if="formError" class="st-error" role="alert">{{ formError }}</p>
    </template>
    <template v-if="isAgent" #references><StudioReferenceInputs :groups="inputGroups" :unassigned="unassigned" @add-files="addFiles" @pick="pick" @remove="video.removeRef($event)" /></template>
    <template #presets><PresetGallery :presets="presets" :selected="selectedId" @select="choose" /></template>
    <template #results><ResultsFeed v-if="ready" :kind="kind" :conversation-id="video.conversationId" :show-approvals="!isAgent" @approved="tab = 'results'" @recreate="recreate" /><p v-else class="st-status">Open this session to see its results.</p></template>
    <template #quote><p v-if="isAgent" class="sg-agent-note st-muted">Send your idea to the agent. Review any price on its approval card.</p><QuoteBar v-else :summary="kind === 'image' ? `${video.image.n} image${Number(video.image.n) === 1 ? '' : 's'}` : `${video.settings.duration} s video`" :busy="submitting || video.busy || chat.isBusy" :disabled-reason="disabledReason" @shuffle="shuffle" @generate="generate" /></template>
  </StudioPage>
</template>
<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStudioSession } from '../composables/useStudioSession'
import { getStudioFeature } from '../services/studioFeatures'
import { readStudioDraft, keepStudioDraft } from '../services/studioDraftMemory'
import { plainText } from '../composables/useChatHistory'
import { composePreset, presetsFor } from '../services/studioPresets'
import StudioPage from '../components/studio/StudioPage.vue'
import StudioReferenceInputs from '../components/studio/StudioReferenceInputs.vue'
import { lazyComponent } from '../utils/lazyComponent'
const PresetGallery = lazyComponent(() => import('../components/studio/PresetGallery.vue'))
import QuoteBar from '../components/studio/QuoteBar.vue'
const ResultsFeed = lazyComponent(() => import('../components/studio/ResultsFeed.vue'))
import StudioSettings from '../components/studio/StudioSettings.vue'
import BottomSheet from '../components/video/BottomSheet.vue'
import StudioModeSwitch from '../components/studio/StudioModeSwitch.vue'
import StudioFirstVisit from '../components/studio/StudioFirstVisit.vue'
import StudioAgentPanel from '../components/studio/StudioAgentPanel.vue'
import { useStudioExperience } from '../composables/useStudioExperience'
const props = defineProps({ kind: { type: String, required: true } })
const router = useRouter(), route = useRoute(), { chat, video, ready, loading, error, initialize } = useStudioSession(props.kind)
const user = inject('studioUser', ref(null))
const { isAgent, hintHidden, dismissHint } = useStudioExperience(props.kind, route.query.useIn ? route.query.mode : null)
const agentDraft = ref(route.query.preset ? `Use this preset: ${presetsFor(props.kind).find(p => p.id === route.query.preset)?.title || 'Your own idea'}.` : ''), agentPanel = ref(null), helper = ref(''), helperNote = ref('')
const chatExpanded = ref(false)
watch(isAgent, agent => { if (!agent) chatExpanded.value = false })
let helperMessageCount = 0
const feature = computed(() => getStudioFeature(props.kind))
const presets = computed(() => presetsFor(props.kind))
const selectedId = ref(route.query.useIn ? '' : presets.value.some(p => p.id === route.query.preset) ? route.query.preset : presets.value[0]?.id || ''), selected = computed(() => presets.value.find(preset => preset.id === selectedId.value))
const presetSheet = ref(null)
// What the agent is told about this page with every message (the backend keeps known ids only).
const pageContext = () => ({ page: props.kind, ...(selected.value ? { preset: selected.value.id, preset_title: selected.value.title } : {}) })
watch([ready, selectedId], ([isReady]) => { if (isReady) chat.studioContext = pageContext() }, { immediate: true })
const details = ref(''), variant = ref(0), page = ref(null), tab = ref(route.query.results ? 'results' : 'presets'), submitting = ref(false), formError = ref(''), draftMessage = ref(''), records = ref([])
// Without a preset, the slots follow what the model takes (Agent mode: the most any offered model takes). A count
// of 0 hides that kind; no published limit allows up to the server's bound. A preset's own slots keep their limits.
const NO_LIMIT = 20
function defaultSlots() {
  if (props.kind === 'image') return [{ id: 'references', label: 'References', role: 'subject', required: false, kinds: ['image'], limit: Number(video.imageModel?.max_references) || 4 }]
  const lim = video.referenceLimits, frames = lim ? lim.frames : ['first_frame']
  const out = []
  if (frames.includes('first_frame')) out.push({ id: 'opening', label: 'Opening frame', role: 'first_frame', required: false, kinds: ['image'], limit: 1 })
  if (frames.includes('last_frame')) out.push({ id: 'closing', label: 'Closing frame', role: 'last_frame', required: false, kinds: ['image'], limit: 1 })
  const kinds = lim ? [['image', 'images'], ['video', 'videos'], ['audio', 'audio']].filter(([, key]) => lim[key] !== 0) : [['image', 'images']]
  if (kinds.length) out.push({ id: 'references', label: 'References', role: 'subject', required: false, kinds: kinds.map(([kind]) => kind),
    limit: lim ? kinds.reduce((sum, [, key]) => sum + (lim[key] == null ? NO_LIMIT : Number(lim[key])), 0) : 4 })
  return out
}
const slots = computed(() => selected.value?.slots || defaultSlots())
const refsFor = slot => video.refs.filter(item => item.studioSlot === slot.id || (!item.studioSlot && item.role === slot.role))
const inputGroups = computed(() => slots.value.map(slot => ({ ...slot, items: refsFor(slot) })))
const unassigned = computed(() => video.refs.filter(item => !slots.value.some(slot => refsFor(slot).includes(item))))
const values = computed(() => Object.fromEntries(slots.value.map(slot => [slot.id, refsFor(slot)])))
const disabledReason = computed(() => {
  if (loading.value) return 'Wait for your models to load.'
  if (error.value || !ready.value) return 'Open a working Studio session first.'
  const empty = slots.value.find(slot => slot.required && !refsFor(slot).length)
  if (empty) return `Add ${empty.label.toLowerCase()} to continue.`
  const full = slots.value.find(slot => refsFor(slot).length > slot.limit)
  if (full) return `${full.label} takes up to ${full.limit} file(s). Remove the extra inputs.`
  if (video.pendingSwitch) return 'Review the model change before continuing.'
  if (video.unusableRefs.length) return `${video.unusableRefs[0].name}: this model ${video.unusableRefs[0].problem}. Remove the input or choose another model.`
  if (!selected.value && !details.value.trim()) return 'Choose a preset or add a creative direction.'
  return ''
})
async function freshStart() {
  if (chat.isBusy || video.busy || chat.hitlRequests.length) return
  saveDraft(); leaving = true
  await router.replace({ path: route.path, query: {} })
  await initialize()
  selectedId.value = ''; details.value = ''; agentDraft.value = ''; video.refs = []; tab.value = 'presets'; formError.value = ''; leaving = false
  await nextTick(); page.value?.focusInputs()
}
function addFiles(slot, files) { for (const file of files) { video.addRef(file, slot.role); video.refs[video.refs.length - 1].studioSlot = slot.id } }
function pick(slot, items) { for (const item of items) { video.addExistingRef(item, slot.role); const ref = video.refs.find(ref => ref.attachment_id === item.attachment_id && ref.role === slot.role); if (ref) { ref.studioSlot = slot.id; ref.thumbnail_url = item.thumbnail_url } } }
async function choose(preset) {
  selectedId.value = preset.id; variant.value = 0; formError.value = ''
  // Presets suggest supported values only; picking one never silently changes a model or drops inputs.
  const target = props.kind === 'image' ? video.image : video.settings
  const allowed = props.kind === 'image' ? { aspect_ratio: video.imageShapes } : { duration: video.options.durations, aspect_ratio: video.options.aspectRatios }
  for (const [key,value] of Object.entries(preset.settings)) if (allowed[key]?.includes(value)) target[key] = value
  presetSheet.value?.hide()
  if (isAgent.value) agentDraft.value = `Use this preset: ${preset.title}.`
  await nextTick(); page.value?.focusInputs()
}
// Text assistance uses the existing chat path in Manual mode. Only allowlisted settings are applied;
// returned text never calls a media request, approves a card, or drops a reference.
async function askHelper(type) {
  if (!ready.value || chat.isBusy || helper.value) return
  helper.value = type; helperNote.value = ''; helperMessageCount = chat.messages.length
  const keptRefs = [...video.refs]
  const brief = composePreset(selected.value, values.value, details.value, variant.value)
  const choices = props.kind === 'image'
    ? { model: video.image.models.map(m => String(m.model_id)), shape: video.imageShapes, count: [1,2,3,4] }
    : { model: video.routes.map(m => String(m.route_id)), shape: video.options.aspectRatios, length: video.options.durations }
  const instruction = type === 'prompt'
    ? 'Write an editable creative prompt. Reply only with a JSON object {"prompt": string or null, "question": string or null}. If required inputs are missing, set prompt to null and ask one short question. Otherwise give a plain-text prompt and question null. Do not generate media, call media tools, request an estimate or start any job.'
    : `Suggest settings only as a JSON object with keys model, shape, length, count, question (string or null). If inputs are insufficient, ask one short question and leave settings null. Otherwise question must be null. Use these available choices: ${JSON.stringify(choices)}. Do not generate media, call media tools, request an estimate or start any job.`
  try {
    chat.studioContext = { ...pageContext(), helper: type }
    const sent = await video.sendAgentMessage({ prompt: `${instruction}\nPreset: ${selected.value?.title || 'My own idea'}. Inputs: ${video.refs.map(r => r.name).join(', ') || 'None yet'}.\nMissing required inputs: ${slots.value.filter(slot => slot.required && !refsFor(slot).length).map(slot => slot.label).join(', ') || 'None'}.\nCreative brief: ${brief}`, chat })
    if (!video.refs.length) video.refs = keptRefs
    if (!sent) { helperNote.value = 'The request was not sent. Your form is unchanged.'; helper.value = '' }
    else if (!chat.isBusy) finishHelper()
  } catch { helperNote.value = 'Could not prepare a suggestion. Your form is unchanged.'; helper.value = '' }
  finally { chat.studioContext = pageContext() }
}
function finishHelper() {
  if (!helper.value) return
  const reply = chat.messages.slice(helperMessageCount).filter(m => m.role === 'assistant' && typeof m.content === 'string' && m.content.trim()).at(-1)?.content
  if (!reply || chat.error) { helperNote.value = 'No suggestion was returned. Keep editing or try again.'; helper.value = ''; return }
  try {
    const suggestion = JSON.parse(reply.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim())
    if (!suggestion || typeof suggestion !== 'object' || Array.isArray(suggestion)) throw new Error('Invalid suggestion')
    if (suggestion.question != null && typeof suggestion.question !== 'string') throw new Error('Invalid question')
    const text = value => plainText(value).replace(/<[^>]*>/g, '').trim()
    if (text(suggestion.question)) {
      helperNote.value = `The agent needs: ${text(suggestion.question).slice(0,600)}`
    } else if (helper.value === 'prompt') {
      if (typeof suggestion.prompt !== 'string' || !text(suggestion.prompt)) throw new Error('Missing prompt')
      details.value = text(suggestion.prompt).slice(0,8000)
      helperNote.value = 'Prompt added. Edit it before generating.'
    } else {
      const target = props.kind === 'image' ? video.image : video.settings
      const shapes = props.kind === 'image' ? video.imageShapes : video.options.aspectRatios
      const supported = shapes.includes(suggestion.shape) || (props.kind === 'image'
        ? [1,2,3,4].includes(suggestion.count) || video.image.models.some(m => String(m.model_id) === String(suggestion.model))
        : video.options.durations.includes(suggestion.length) || video.routes.some(m => String(m.route_id) === String(suggestion.model)))
      if (!supported) throw new Error('No supported settings')
      if (shapes.includes(suggestion.shape)) target.aspect_ratio = suggestion.shape
      if (props.kind === 'image') {
        if ([1,2,3,4].includes(suggestion.count)) video.image.n = suggestion.count
        if (video.image.models.some(m => String(m.model_id) === String(suggestion.model))) video.pickImageModel(String(suggestion.model))
      } else {
        if (video.options.durations.includes(suggestion.length)) video.settings.duration = suggestion.length
        if (video.routes.some(m => String(m.route_id) === String(suggestion.model))) video.pickRoute(String(suggestion.model))
      }
      helperNote.value = 'Suggested settings added. Review the choices and any model change before generating.'
    }
  } catch {
    helperNote.value = helper.value === 'prompt'
      ? 'The agent could not write a prompt. Try again or describe your idea.'
      : 'The suggestion could not be applied. Your settings are unchanged; choose them below.'
  }
  helper.value = ''
}
watch(() => chat.isBusy, (busy, was) => { if (was && !busy) finishHelper() })
watch(() => video.sessionImages.map(item => item.attachment_id).join('|'), (now, was) => { if (now && now !== was && props.kind === 'image') tab.value = 'results' })
// A new queued/running/ready job is evidence of a server-side approval or the recorded session exception.
watch(() => video.jobsFor(video.conversationId).filter(j => ['queued','running','ready'].includes(j.state)).map(j => `${j.job_id}:${j.state}`).join('|'), (now, was) => { if (now && now !== was) tab.value = 'results' })
function shuffle() { if (selected.value) variant.value = (variant.value + 1 + Math.floor(Math.random() * (selected.value.variants.length - 1))) % selected.value.variants.length }
function cleanRefs(refs) { return refs.filter(ref => ref.attachment_id).map(ref => ({ attachment_id: ref.attachment_id, title: ref.name || ref.title || 'Reference', media_type: ref.isVideo ? 'video' : 'image', role: ref.role, studioSlot: ref.studioSlot })) }
function snapshot(refs = video.refs) { return { agentDraft: agentDraft.value, preset: selectedId.value, details: details.value, variant: variant.value, image: { modelId: video.image.modelId, aspect_ratio: video.image.aspect_ratio, n: video.image.n }, settings: { ...video.settings }, routeId: video.routeId, refs: cleanRefs(refs), localFiles: refs.filter(ref => !ref.attachment_id).length } }
async function generate() {
  if (disabledReason.value || submitting.value || video.busy || chat.isBusy) return
  submitting.value = true; formError.value = ''
  const prompt = composePreset(selected.value, values.value, details.value, variant.value), refs = [...video.refs], record = { ...snapshot(refs), at: new Date().toISOString() }
  try {
    // Existing paid-request paths only; image session approval follows the owner exception F-D7a.
    const sent = props.kind === 'image' ? await video.requestImage({ prompt, chat }) : await video.request({ prompt, chat })
    if (!sent) { formError.value = 'The request was not sent. Check the inputs and try again.'; return }
    records.value.unshift({ ...record, refs: cleanRefs(refs), prompt })
    tab.value = 'results'
  } catch { formError.value = 'Could not prepare the request. Nothing was started by this page.' }
  finally { submitting.value = false }
}
function restore(draft, replaceRefs = false) {
  if (!draft || typeof draft !== 'object') return
  selectedId.value = presets.value.some(preset => preset.id === draft.preset) ? draft.preset : ''
  agentDraft.value = typeof draft.agentDraft === 'string' ? draft.agentDraft.slice(0,8000) : ''
  details.value = typeof draft.details === 'string' ? draft.details.slice(0,8000) : ''
  variant.value = Number.isInteger(draft.variant) ? Math.max(0,draft.variant) : 0
  if (replaceRefs) video.refs = []
  if (!video.refs.length) for (const item of (Array.isArray(draft.refs) ? draft.refs : [])) if (item?.attachment_id) { video.addExistingRef(item, item.role); const last = video.refs[video.refs.length-1]; if (last) last.studioSlot = item.studioSlot }
  if (props.kind === 'image' && draft.image) {
    video.image.aspect_ratio = draft.image.aspect_ratio || video.image.aspect_ratio
    video.image.n = Math.max(1, Math.min(4, Number(draft.image.n) || 1))
    video.pickImageModel(draft.image.modelId || '')
  } else if (draft.settings) { for (const key of ['duration','aspect_ratio','resolution','sound']) if (Object.hasOwn(draft.settings,key)) video.settings[key] = draft.settings[key]; video.pickRoute(draft.routeId || '') }
  if (draft.localFiles) draftMessage.value = 'Reattach local files after reloading; uploaded Library references were kept.'
}
function recreate(item) {
  const time = item.created_at ? Date.parse(item.created_at) : Infinity
  const record = records.value.find(record => Date.parse(record.at) <= time) || records.value[0]
  if (record) restore(record, true)
  else { selectedId.value = ''; details.value = item.job?.effective_config?.prompt || chat.messages.filter(message => message.role === 'user').at(-1)?.content || ''; draftMessage.value = 'Review the creative direction and references before requesting a new run.' }
  tab.value = 'presets'; nextTick(() => page.value?.focusInputs())
}
function composeAgain(event) { selectedId.value = ''; details.value = String(event.detail?.text || '').slice(0,8000); tab.value = 'presets'; nextTick(() => page.value?.focusInputs()) }
onMounted(() => { window.addEventListener('video-compose', composeAgain); window.addEventListener('studio-save-draft', beforeHandoff) })
onBeforeUnmount(() => { window.removeEventListener('video-compose', composeAgain); window.removeEventListener('studio-save-draft', beforeHandoff) })
// Tab-scoped drafts are tied to an authenticated user id; no signed URLs or local File objects are persisted.
const draftKey = computed(() => user.value?.id ? `aadml.studio.f0.${user.value.id}.${props.kind}.${route.query.conversation || 'draft'}` : '')
let restoredKey = '', leaving = false
watch([ready, draftKey], ([isReady, key]) => {
  if (!isReady || !key || key === restoredKey) return
  restoredKey = key
  try { const stored = JSON.parse(sessionStorage.getItem(key) || 'null'); if (stored) { restore(stored); records.value = Array.isArray(stored.records) ? stored.records.filter(record => record && typeof record === 'object' && typeof record.at === 'string').slice(0,30) : [] } } catch { /* blocked storage never blocks the page */ }
  const memory = readStudioDraft(key)
  if (memory && !route.query.useIn) { restore(memory); video.refs = memory.transientRefs.map(item => ({ ...item })); draftMessage.value = '' }
  if (route.query.useIn) selectedId.value = ''
  else if (route.query.preset) { const preset = presets.value.find(p => p.id === route.query.preset); if (preset) choose(preset) }
}, { immediate: true })
function beforeHandoff() { saveDraft(); leaving = true }
function saveDraft() {
  if (leaving) return
  if (!ready.value || !draftKey.value) return
  keepStudioDraft(draftKey.value, { ...snapshot(), transientRefs: video.refs.map(item => ({ ...item })) })
  try { sessionStorage.setItem(draftKey.value, JSON.stringify({ ...snapshot(), records: records.value.slice(0,30) })) } catch { /* in-memory draft still works */ }
}
watch(() => [agentDraft.value, selectedId.value, details.value, variant.value, video.image, video.settings, video.routeId, video.refs, records.value], saveDraft, { deep: true })

</script>
<style scoped>
.sg-helper-note{margin:0;padding:10px 12px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface-2);font-size:13px;line-height:1.55}.sg-manual{display:grid;gap:18px}.sg-help{display:flex;flex-wrap:wrap;gap:7px}.sg-help button{font-size:12px;padding:7px 10px}.sg-agent-note{padding:16px 24px;font-size:12px;line-height:1.6}.sg-preset{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:12px}.sg-preset-chip{flex:1;padding:5px 8px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface-2);font-size:13px;font-weight:600}.sg-preset button{min-height:32px;font-size:11px;padding:5px 8px}.sg-details{cursor:pointer;color:var(--vm-ink-soft);font-size:13px;min-height:40px;padding:8px 0}.sg-variant{font-size:12px;line-height:1.6}@media(max-width:767px){.sg-preset button{min-height:44px}.sg-details{min-height:44px}}
</style>
