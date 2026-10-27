<template>
  <div class="creative-form">
    <CreativeError :error="error" locate />
    <template v-if="kind !== 'ads'">
      <label class="st-field" data-field="recipe_id">Recipe<select v-model="recipeId" class="st-input" @change="resetRecipe"><option value="">Choose recipe</option><option v-for="r in recipes" :key="r.id" :value="r.id" :disabled="!r.ready">{{ r.title }}{{ r.ready ? '' : ' — Not yet proven' }}</option></select></label>
      <template v-if="recipe">
        <MediaRoutePicker v-if="mediaRecipe" v-model="recipeRoute" :operation="recipe.operation" />
        <InputSlot v-for="slot in recipe.slots" :key="slot.name" :label="slot.name" :data-field="`slots.${slot.name}`" :required="slot.required" :kinds="[slot.media_type]" :allow-upload="false" :items="slots[slot.name] ? [slots[slot.name]] : []" @pick="slots[slot.name] = $event[0]" @remove="delete slots[slot.name]" />
        <p v-if="kind === 'ad-remix'" class="st-muted">Choose your own ad video.</p>
        <label v-for="(values,name) in recipe.options" :key="name" class="st-field">{{ name }}<select v-model="options[name]" class="st-input"><option v-for="value in values" :key="value">{{ value }}</option></select></label>
        <button class="st-button primary" :disabled="busy || !recipe.ready || (mediaRecipe && !recipeRoute)" @click="prepareRecipe">Review recipe estimate</button>
      </template>
      <Teleport v-if="monitor" defer :to="`#${monitor}`"><MediaMonitor :items="monitorItems" :empty="recipe ? 'Add the files this recipe needs to see them here.' : 'Choose a recipe, then add the files it needs.'" /></Teleport>
    </template>
    <template v-else>
      <label class="st-field" data-field="brand_id">Brand<select v-model="brandId" class="st-input"><option value="">Choose brand</option><option v-for="brand in brands" :key="brand.brand_id || brand.id" :value="brand.brand_id || brand.id">{{ brand.name }}</option></select></label>
      <label class="st-field" data-field="url">Brand website<input v-model="website" class="st-input" type="url" /></label><button class="st-button" :disabled="busy || !website" @click="readBrand">Read website</button>
      <p v-if="draft" class="st-muted">Review this draft before saving it.</p>
      <template v-if="draft">
        <label v-for="field in ['name','description','website','tagline','voice','audience']" :key="field" class="st-field">{{ field }}<textarea v-model="draft[field]" class="st-input" rows="2" /></label>
        <label class="st-field">Colors (comma separated)<input v-model="colors" class="st-input" /></label>
        <InputSlot label="Brand images (logo first)" required :kinds="['image']" :limit="8" :allow-upload="false" :items="draft.images || []" @pick="addBrandImages" @remove="draft.images.splice(draft.images.indexOf($event),1)" />
        <div v-for="(image,i) in draft.images || []" :key="image.attachment_id" class="creative-card"><span>{{ image.source_url }}</span><button class="st-button" :disabled="i === 0" @click="draft.images.unshift(...draft.images.splice(i,1))">Use as logo (first)</button><button class="st-button" @click="draft.images.splice(i,1)">Remove image</button></div>
        <button class="st-button" :disabled="busy || !draft.name || !draft.images?.length" @click="saveBrand">Save reviewed brand</button>
      </template>
      <button v-if="!draft" class="st-button" @click="draft = { name:'', description:'', website:'', tagline:'', voice:'', audience:'', images:[] }">New brand</button>
      <label class="st-field" data-field="platform">Platform<select v-model="platform" class="st-input"><option v-for="p in adOptions.platforms" :key="p.id" :value="p.id">{{ p.label }} · {{ p.aspect_ratio }} · up to {{ p.max_seconds }} seconds</option></select></label>
      <label class="st-field" data-field="goal">Goal<select v-model="goal" class="st-input"><option v-for="g in adOptions.goals" :key="g">{{ g }}</option></select></label>
      <label class="st-field" data-field="product_id">Product Element (optional)<select v-model="productId" class="st-input"><option value="">No product</option><option v-for="p in products" :key="p.ingredient_id" :value="p.ingredient_id">{{ p.name }}</option></select></label>
      <label class="st-field" data-field="notes">Notes<textarea v-model="notes" class="st-input" /></label><label class="st-field" data-field="n">Concept count<input v-model.number="count" type="number" min="1" :max="adOptions.max_concepts || 4" class="st-input" /></label>
      <button class="st-button primary" :disabled="busy || !brandId || !platform" @click="concepts">Develop concepts</button>
      <div v-for="(concept,i) in drafts" :key="i" class="creative-card"><label v-for="field in ['title','hook','angle','cta']" :key="field" class="st-field">{{ field }}<textarea v-model="concept[field]" class="st-input" /></label><div v-for="(s,j) in concept.scenes" :key="j"><label v-for="field in ['visual','voiceover','on_screen_text','planned_ms']" :key="field" class="st-field">{{ field }}<input v-model="s[field]" class="st-input" :type="field === 'planned_ms' ? 'number' : 'text'" /></label></div><button class="st-button" :disabled="busy" @click="makeProject(concept)">Use concept in Storyboard</button></div>
    </template>
  </div>
</template>
<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'
import InputSlot from './InputSlot.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
import MediaMonitor from './MediaMonitor.vue'
import CreativeError from './CreativeError.vue'
import { useCreativeForm } from '../../composables/useCreativeForm'
const props = defineProps({ kind:String }), emit = defineEmits(['job']), router = useRouter(), { busy,error,run } = useCreativeForm()
const recipes = ref([]), recipeId = ref(''), slots = ref({}), options = ref({}), recipe = computed(() => recipes.value.find(r => r.id === recipeId.value))
// An image recipe runs on a media model the person chooses; a video recipe uses the Studio's video model.
const monitor = inject('studioMonitor', '')
const monitorItems = computed(() => (recipe.value?.slots || []).filter(s => slots.value[s.name]).map(s => ({ ...slots.value[s.name], media_type: slots.value[s.name].media_type || s.media_type, url: slots.value[s.name].url || slots.value[s.name].thumbnail_url, name: slots.value[s.name].title || slots.value[s.name].filename || s.name, role: s.name })))
const recipeRoute = ref(''), mediaRecipe = computed(() => !!recipe.value && !['video','change'].includes(recipe.value.operation))
const brands = ref([]), brandId = ref(''), website = ref(''), draft = ref(null), colors = ref(''), adOptions = ref({}), platform = ref(''), goal = ref('awareness'), productId = ref(''), products = ref([]), notes = ref(''), count = ref(3), drafts = ref([])
onMounted(() => run(async alive => {
  if (props.kind !== 'ads') { const {data} = await api.getStudioRecipes(props.kind); if (alive()) recipes.value = data.recipes || []; return }
  const [b,o,p] = await Promise.all([api.get('/video/brands/'), api.get('/video/ads/options/'), api.get('/video/ingredients/')])
  if (!alive()) return
  brands.value = b.data.brands || []; adOptions.value = o.data; platform.value = o.data.platforms?.[0]?.id || ''; products.value = (p.data.ingredients || []).filter(item => item.kind === 'product')
}))
function resetRecipe() { slots.value = {}; options.value = Object.fromEntries(Object.entries(recipe.value?.options || {}).map(([k,v]) => [k,v[0]])) }
function prepareRecipe() { run(async alive => { if (recipe.value.slots.some(s => s.required && !slots.value[s.name])) throw Error('Fill every required media slot.'); const { data } = await api.runStudioRecipe(recipeId.value,{ ...(mediaRecipe.value ? { route_id:recipeRoute.value } : {}), slots:Object.fromEntries(Object.entries(slots.value).map(([k,v]) => [k,v.attachment_id])), options:options.value }); if (alive()) emit('job',data) }) }
function readBrand() { run(async alive => { const {data} = await api.post('/video/brands/read/',{ url:website.value }); if (alive()) { draft.value = data; colors.value = (data.colors || []).join(', ') } }) }
function addBrandImages(items) {
  if (!draft.value) return
  const images = draft.value.images || (draft.value.images = [])
  for (const item of items) {
    if (images.length >= 8) break
    if (item.attachment_id && !images.some(image => image.attachment_id === item.attachment_id)) images.push({ attachment_id: item.attachment_id })
  }
}
function saveBrand() { run(async alive => { const d = draft.value; const {data} = await api.post('/video/brands/',{ name:d.name, description:d.description, traits:{ colors:colors.value.split(',').map(v => v.trim()).filter(Boolean), website:d.website, tagline:d.tagline, voice:d.voice, audience:d.audience }, attachment_ids:(d.images || []).map(i => i.attachment_id) }); if (alive()) { brands.value.push(data); brandId.value = data.brand_id || data.id; draft.value = null } }) }
const brief = () => ({ brand_id:brandId.value, platform:platform.value, ...(productId.value ? { product_id:productId.value } : {}) })
function concepts() { run(async alive => { const {data} = await api.post('/video/ads/concepts/',{ ...brief(), goal:goal.value, notes:notes.value, n:count.value }); if (alive()) drafts.value = data.concepts || [] }) }
function makeProject(concept) { run(async alive => { const normalized = { ...concept, scenes:concept.scenes.map(s => ({ ...s, planned_ms:Number(s.planned_ms) })) }; normalized.total_ms = normalized.scenes.reduce((sum,s) => sum+s.planned_ms,0); const {data} = await api.post('/video/ads/projects/',{ ...brief(), concept:normalized }); if (alive()) router.push({ path:'/video-studio/storyboard', query:{ project_id:data.project_id } }) }) }
</script>
