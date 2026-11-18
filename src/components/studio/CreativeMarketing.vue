<template>
  <div class="creative-form">
    <CreativeError v-if="kind !== 'ads'" :error="shownError" locate />
    <template v-if="kind !== 'ads'">
      <ConsentStep v-if="consent" :request="consent" @agreed="agreeConsent" @cancel="consent = null" />
      <label class="st-field" data-field="recipe_id">Recipe<select v-model="recipeId" class="st-input" @change="resetRecipe"><option value="">Choose recipe</option><option v-for="r in recipes" :key="r.id" :value="r.id" :disabled="!r.ready">{{ r.title }}{{ r.ready ? '' : ' — Not yet proven' }}</option></select></label>
      <template v-if="recipe">
        <MediaRoutePicker v-if="mediaRecipe" v-model="recipeRoute" :operation="recipe.operation" :only="recipe.needs ? recipe.route_ids || [] : null" :only-note="needsNote" />
        <template v-else>
          <label class="st-field" data-field="route_id">Model<select v-model="videoRouteId" class="st-input" data-test="recipe-video-route" :disabled="videoLoading || !videoRoutes.length"><option v-if="videoLoading" value="">Loading models…</option><option v-else-if="!videoRoutes.length" value="">No model you can use does this yet</option><option v-for="r in videoRoutes" :key="r.route_id" :value="String(r.route_id)">{{ routeOptionLabel(r) }}</option></select></label>
          <label v-if="resolutions.length" class="st-field">Resolution<select v-model="resolution" class="st-input" data-test="recipe-resolution"><option v-for="r in resolutions" :key="r" :value="r">{{ r }}</option></select></label>
        </template>
        <InputSlot v-for="slot in recipe.slots" :key="slot.name" :label="words(slot.name)" :data-field="`slots.${slot.name}`" :required="slot.required" :kinds="[slot.media_type]" :allow-upload="false" :items="slots[slot.name] ? [slots[slot.name]] : []" @pick="slots[slot.name] = $event[0]" @remove="delete slots[slot.name]" />
        <p v-if="kind === 'ad-remix'" class="st-muted">Choose your own ad video. The recipe changes the whole video, start to end.</p>
        <label v-for="(values,name) in recipe.options" :key="name" class="st-field">{{ words(name) }}<select v-model="options[name]" class="st-input"><option v-for="value in values" :key="value">{{ value }}</option></select></label>
        <button class="st-button primary" :disabled="busy || !recipe.ready || (mediaRecipe ? !recipeRoute : !videoRouteId)" @click="prepareRecipe()">Review recipe estimate</button>
        <template v-if="recipeSet">
          <button class="st-button" data-test="recipe-set" :disabled="busy || !recipe.ready || !recipeRoute" @click="prepareSet">Review estimates for the set ({{ recipeSet.values.length }})</button>
          <p class="st-muted" role="note">The set is {{ recipeSet.values.join(', ') }}: one picture each, each with its own estimate to approve in Results.</p>
        </template>
      </template>
      <Teleport v-if="monitor" defer :to="`#${monitor}`"><MediaMonitor :items="monitorItems" :empty="recipe ? 'Add the files this recipe needs to see them here.' : 'Choose a recipe, then add the files it needs.'" /></Teleport>
    </template>
    <AdsStudio v-else @job="emit('job', $event)" />
  </div>
</template>
<script setup>
import { useStudioPreparedBrief } from '../../composables/useStudioPreparedBrief'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import { loadStudioRoutes, schemaEnum } from '../../services/studioModelRoutes'
import { routeOptionLabel } from '../../utils/studioPrice'
import InputSlot from './InputSlot.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
import MediaMonitor from './MediaMonitor.vue'
import CreativeError from './CreativeError.vue'
import ConsentStep from './ConsentStep.vue'
import AdsStudio from './AdsStudio.vue'
import { useCreativeForm } from '../../composables/useCreativeForm'
import { modelAliases, studioError, useStudioChat } from './studioForm'
const props = defineProps({ kind:String }), emit = defineEmits(['job']), route = useRoute(), { busy,error,run } = useCreativeForm()
// The server's field and slot names ("on_screen_text", "light") said in words on the page.
const WORDS = { voice: 'How the brand speaks', audience: 'Who it is for', hook: 'Hook (the first two seconds)', angle: 'Why it works', cta: 'Call to action', visual: 'What the camera sees', on_screen_text: 'On-screen text', planned_ms: 'Length (milliseconds)', image: 'Photo', video: 'Your video' }
const words = key => WORDS[key] || String(key || '').replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase())
const recipes = ref([]), recipeId = ref(''), slots = ref({}), options = ref({}), recipe = computed(() => recipes.value.find(r => r.id === recipeId.value))
// Each request carries the open chat and this page (a Manual page sends no chat message), so its results stay in the
// chat. An error is shown at its field: the model the backend names ('model', 'model_id', 'route_id') at the model
// menu, 'references' at the recipe's first file; any other field as a general message.
const { chatFields } = useStudioChat(() => props.kind)
const shownError = computed(() => {
  const slotFields = (recipe.value?.slots || []).map(s => `slots.${s.name}`)
  return studioError(consent.value ? null : error.value, ['recipe_id','route_id',...slotFields], { ...modelAliases('route_id'), ...(slotFields[0] ? { references: slotFields[0] } : {}) })
})
// An image recipe runs on a media model the person chooses; a video recipe uses the Studio's video model.
const monitor = inject('studioMonitor', '')
const monitorItems = computed(() => (recipe.value?.slots || []).filter(s => slots.value[s.name]).map(s => ({ ...slots.value[s.name], media_type: slots.value[s.name].media_type || s.media_type, url: slots.value[s.name].url || slots.value[s.name].thumbnail_url, name: slots.value[s.name].title || slots.value[s.name].filename || s.name, role: s.name })))
const recipeRoute = ref(''), mediaRecipe = computed(() => !!recipe.value && !['video','change'].includes(recipe.value.operation))
const notes = ref('')
onMounted(() => { if (props.kind !== 'ads') run(async alive => { const {data} = await api.getStudioRecipes(props.kind); if (alive()) { recipes.value = data.recipes || []; await chooseLinkedRecipe() } }) })
// The Ads page links here with a recipe and a saved product (?recipe=ugc&product=<id>): the recipe is chosen and the
// product's first photo fills its product slot.
async function chooseLinkedRecipe() {
  const id = String(route?.query?.recipe || '')
  if (!id || !recipes.value.some(r => r.id === id)) return
  recipeId.value = id; resetRecipe()
  const pid = String(route.query.product || '')
  const slot = recipe.value.slots.find(s => s.name === 'product' && s.media_type === 'image')
  if (!pid || !slot) return
  const { data } = await api.get('/video/products/')
  const product = (data?.products || []).find(p => p.product_id === pid)
  if (product?.attachment_ids?.length) slots.value[slot.name] = { attachment_id: product.attachment_ids[0], name: product.name, media_type: 'image' }
}
function resetRecipe() { slots.value = {}; options.value = Object.fromEntries(Object.entries(recipe.value?.options || {}).map(([k,v]) => [k,v[0]])); loadVideoRoutes() }
// A video recipe runs on a video model the person chooses, at the size they choose, the smallest first (live 2026-10-28:
// with no choice it went to the Studio's default model, Kling 3.0 Pro, which cannot edit an upload, at its top size).
// An edit lists the models proven for either kind of clip: the server picks the task from the clip itself.
const videoRoutes = ref([]), videoRouteId = ref(''), videoLoading = ref(false), resolution = ref('')
const videoRoute = computed(() => videoRoutes.value.find(r => String(r.route_id) === videoRouteId.value))
const resolutions = computed(() => schemaEnum(videoRoute.value, 'resolution'))
watch(videoRoute, () => { resolution.value = resolutions.value[0] || '' })
let videoSeq = 0
async function loadVideoRoutes() {
  const mine = ++videoSeq
  videoRoutes.value = []; videoRouteId.value = ''
  if (!recipe.value || mediaRecipe.value) return
  const tasks = String(recipe.value.task || '').startsWith('edit_') ? ['edit_uploaded', 'edit_generated'] : [recipe.value.task]
  videoLoading.value = true
  try {
    const list = await loadStudioRoutes(tasks)
    if (mine !== videoSeq) return
    videoRoutes.value = list
    videoRouteId.value = videoRoutes.value[0] ? String(videoRoutes.value[0].route_id) : ''
  } catch { if (mine === videoSeq) error.value = { message: 'Could not load the models.' } }
  finally { if (mine === videoSeq) videoLoading.value = false }
}
function recipeBody(chosen) { return { ...(mediaRecipe.value ? { route_id:recipeRoute.value } : { route_id:videoRouteId.value, ...(resolution.value ? { params:{ resolution:resolution.value } } : {}) }), slots:Object.fromEntries(Object.entries(slots.value).map(([k,v]) => [k,v.attachment_id])), options:chosen } }
const consent = ref(null)
let retry = null
watch(error, e => { if (e?.code === 'consent_required' && retry) consent.value = { message: e.message, files: (e.alternatives || []).map(file => ({ ...file, name: Object.values(slots.value).find(v => v?.attachment_id === file.attachment_id)?.name || 'This photo' })) } })
function agreeConsent() { consent.value = null; retry?.() }
function prepareRecipe() { retry = prepareRecipe; run(async alive => { if (recipe.value.slots.some(s => s.required && !slots.value[s.name])) throw Error('Fill every required media slot.'); const { data } = await api.runStudioRecipe(recipeId.value,{ ...recipeBody(options.value), ...await chatFields() }); if (alive()) emit('job',data) }) }
// A recipe's set (Zooms and shots: close-up, medium, wide): one job per value, in order, each its own estimate card.
// A refusal stops the rest; the ones already made stay in Results.
const recipeSet = computed(() => { const [name, values] = Object.entries(recipe.value?.sets || {})[0] || []; return name && values?.length ? { name, values } : null })
function prepareSet() { retry = prepareSet; run(async alive => { if (recipe.value.slots.some(s => s.required && !slots.value[s.name])) throw Error('Fill every required media slot.'); const set = recipeSet.value; for (const value of set.values) { const { data } = await api.runStudioRecipe(recipeId.value,{ ...recipeBody({ ...options.value, [set.name]:value }), ...await chatFields() }); if (!alive()) return; emit('job',data) } }) }
// Why no model is offered for a recipe that needs more than its task.
const needsNote = computed(() => (recipe.value?.needs || []).includes('reshape') ? 'None of the models you can use can change the shape of a picture yet.' : 'None of the models you can use can do this yet.')
// A look that names a recipe (the Effects looks) chooses it, with the look's options, once the recipes are listed.
function chooseLookRecipe(value) {
  if (!value?.recipe || !recipes.value.some(r => r.id === value.recipe)) return
  recipeId.value = value.recipe; resetRecipe()
  for (const [k, v] of Object.entries(value.recipeOptions || {})) if (recipe.value.options?.[k]?.includes(v)) options.value[k] = v
}
const preparedLook = useStudioPreparedBrief(notes)
watch([preparedLook, recipes], ([value]) => chooseLookRecipe(value))
</script>
