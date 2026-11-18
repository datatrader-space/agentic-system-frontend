<template>
  <div class="creative-form ads2">
    <div class="ads2-tabs" role="tablist" aria-label="Ads Studio">
      <button v-for="t in TABS" :key="t.id" type="button" role="tab" :aria-selected="tab === t.id" :class="{ on: tab === t.id }" :data-test="`ads-tab-${t.id}`" @click="tab = t.id">{{ t.label }}</button>
    </div>
    <CreativeError :error="shownError" locate />

    <!-- Video ads: the brand kit and video concepts, each with its price -->
    <template v-if="tab === 'video'">
      <!-- A brand kit is optional (backend ADS_CHAT_FLOW_PLAN.md): the product's photo is enough; a kit adds its colours, logo and voice. -->
      <label class="st-field" data-field="product_id">Saved product<select v-model="productId" class="st-input" data-test="video-product"><option value="">None, use a photo</option><option v-for="p in products" :key="p.product_id" :value="p.product_id">{{ p.name }}{{ p.usable === false ? ' (not approved yet)' : '' }}</option></select></label>
      <template v-if="!productId">
        <InputSlot label="Product photo" :kinds="['image']" :limit="8" :allow-upload="false" :items="videoPhotos" data-field="product_attachment_ids" @pick="addPhotos(videoPhotos, $event)" @remove="videoPhotos.splice(videoPhotos.indexOf($event),1)" />
        <label v-if="videoPhotos.length" class="st-field">Product name (as on the pack)<input v-model="videoProductName" class="st-input" maxlength="120" data-test="video-product-name" /></label>
      </template>
      <label class="st-field" data-field="brand_id">Brand kit (optional)<select v-model="brandId" class="st-input" data-test="video-brand"><option value="">No brand kit</option><option v-for="b in brands" :key="b.brand_id || b.id" :value="b.brand_id || b.id">{{ b.name }}{{ b.usable === false ? ' (not approved yet)' : '' }}</option></select></label>
      <label class="st-field" data-field="url">Brand website<input v-model="website" class="st-input" type="url" /></label><button class="st-button" :disabled="busy || !website" @click="readBrand">Read website</button>
      <StageProgress :stages="brandStages" label="Reading the brand website" />
      <p v-if="draft" class="st-muted">Review this draft before saving it.</p>
      <template v-if="draft">
        <label v-for="field in ['name','description','website','tagline','voice','audience']" :key="field" class="st-field">{{ words(field) }}<textarea v-model="draft[field]" class="st-input" rows="2" /></label>
        <label class="st-field">Colors (comma separated)<input v-model="colors" class="st-input" /></label>
        <InputSlot label="Brand images (logo first)" required :kinds="['image']" :limit="8" :allow-upload="false" :items="draft.images || []" @pick="addImages(draft, $event, 8)" @remove="draft.images.splice(draft.images.indexOf($event),1)" />
        <div v-for="(image,i) in draft.images || []" :key="image.attachment_id" class="creative-card"><span>{{ image.source_url }}</span><button class="st-button" :disabled="i === 0" @click="draft.images.unshift(...draft.images.splice(i,1))">Use as logo (first)</button><button class="st-button" @click="draft.images.splice(i,1)">Remove image</button></div>
        <ElementRightsFields v-model="brandRights" kind="brand" :name="draft.name" :schema="elementSchema" />
        <button class="st-button" :disabled="busy || !draft.name || !draft.images?.length || !rightsComplete('brand', brandRights)" data-test="brand-save" @click="saveBrand">Save reviewed brand</button>
        <p v-if="!draft.name || !draft.images?.length" class="st-muted" role="status" data-test="brand-save-needs">{{ !draft.name ? 'Give the brand a name' : 'Add at least one brand image, the logo first' }} to save it.</p>
        <p v-else-if="!rightsComplete('brand', brandRights)" class="st-muted" role="status" data-test="brand-save-rights">Confirm your rights to the brand to save it.</p>
      </template>
      <button v-if="!draft" class="st-button" @click="draft = { name:'', description:'', website:'', tagline:'', voice:'', audience:'', images:[] }">New brand</button>
      <label class="st-field" data-field="platform">Platform<select v-model="platform" class="st-input"><option v-for="p in adOptions.platforms" :key="p.id" :value="p.id">{{ p.label }}, {{ p.aspect_ratio }}, up to {{ p.max_seconds }} seconds</option></select></label>
      <label class="st-field" data-field="goal">Goal<select v-model="goal" class="st-input"><option v-for="g in adOptions.goals" :key="g" :value="g">{{ words(g) }}</option></select></label>
      <label class="st-field" data-field="notes">Notes<textarea v-model="notes" class="st-input" /></label><label class="st-field" data-field="n">Concept count<input v-model.number="count" type="number" min="1" :max="adOptions.max_concepts || 4" class="st-input" /></label>
      <button class="st-button primary" :disabled="busy || !platform || !(productId || videoPhotos.length || brandId)" data-test="video-concepts" @click="concepts">Develop concepts</button>
      <p v-if="!(productId || videoPhotos.length || brandId)" class="st-muted" role="status">Choose a saved product or add the product's photo.</p>
      <div v-for="(concept,i) in drafts" :key="i" class="creative-card">
        <p class="ads2-price" data-test="concept-price">{{ priceWords(concept.price) }}</p>
        <label v-for="field in ['title','hook','angle','cta']" :key="field" class="st-field">{{ words(field) }}<textarea v-model="concept[field]" class="st-input" /></label>
        <div v-for="(s,j) in concept.scenes" :key="j"><label v-for="field in ['visual','voiceover','on_screen_text','planned_ms']" :key="field" class="st-field">{{ words(field) }}<input v-model="s[field]" class="st-input" :type="field === 'planned_ms' ? 'number' : 'text'" /></label></div>
        <div class="creative-pair"><button class="st-button" :disabled="busy" data-test="concept-reprice" @click="priceAgain(concept)">Price again</button><button class="st-button" :disabled="busy" @click="makeProject(concept)">Use concept in Storyboard</button></div>
      </div>
    </template>

    <!-- Products: one shop page read into a product -->
    <template v-else-if="tab === 'products'">
      <label class="st-field" data-field="url">Product page<input v-model="productUrl" class="st-input" type="url" placeholder="https://" data-test="product-url" /></label>
      <button class="st-button primary" :disabled="busy || !productUrl" data-test="product-read" @click="readProduct('ask')">Read product page</button>
      <StageProgress :stages="productStages" label="Reading the product page" />
      <div v-if="productDraft?.needs_model_read" class="creative-card" role="group" aria-label="Read the page text with a model?" data-test="product-model-ask">
        <p>The page does not state its {{ (productDraft.missing || []).join(' or ') }}. A model can read its text for {{ productDraft.model_read_estimate?.estimate_usd ? `about ${usdWords(productDraft.model_read_estimate.estimate_usd)}` : 'a price that is not published' }}, paid from your balance.</p>
        <div class="creative-pair"><button class="st-button primary" :disabled="busy" data-test="product-model-yes" @click="readProduct('yes')">Read it with a model</button><button class="st-button" :disabled="busy" data-test="product-model-no" @click="readProduct('no')">Go on without</button></div>
      </div>
      <template v-else-if="productDraft">
        <p class="st-muted">Review this product before saving it.{{ productDraft.source ? ` Read from the page's ${productDraft.source}.` : '' }}</p>
        <label class="st-field" data-field="title">Name<input v-model="productDraft.title" class="st-input" /></label>
        <div class="creative-pair"><label class="st-field" data-field="price">Price<input v-model="productDraft.price" class="st-input" inputmode="decimal" /></label><label class="st-field" data-field="currency">Currency<input v-model="productDraft.currency" class="st-input" maxlength="3" /></label></div>
        <label class="st-field">Brand<input v-model="productDraft.brand" class="st-input" /></label>
        <label class="st-field">Description<textarea v-model="productDraft.description" class="st-input" rows="3" /></label>
        <InputSlot label="Product images" required :kinds="['image']" :limit="8" :allow-upload="false" :items="productDraft.images || []" @pick="addImages(productDraft, $event, 8)" @remove="productDraft.images.splice(productDraft.images.indexOf($event),1)" />
        <ElementRightsFields v-model="productRights" kind="product" :name="productDraft.title" :schema="elementSchema" />
        <button class="st-button" :disabled="busy || !productDraft.title || !productDraft.images?.length || !rightsComplete('product', productRights)" data-test="product-save" @click="saveProduct">Save product</button>
        <p v-if="productDraft.title && productDraft.images?.length && !rightsComplete('product', productRights)" class="st-muted" role="status" data-test="product-save-rights">Confirm your rights to the product to save it.</p>
      </template>
      <ul v-if="products.length" class="ads2-list" aria-label="Your products"><li v-for="p in products" :key="p.product_id"><strong>{{ p.name }}</strong><span class="st-muted">{{ p.price ? `${p.price} ${p.currency}` : 'No price' }}{{ p.usable === false ? ', not approved yet' : '' }}</span></li></ul>
      <p v-else class="st-empty"><strong>No products yet</strong>Read a product page to keep its name, price and photos for your ads.</p>
    </template>

    <!-- Static image ads: concepts for one product, made in one batch -->
    <template v-else-if="tab === 'static'">
      <label class="st-field" data-field="product_id">Product<select v-model="staticProduct" class="st-input" data-test="static-product"><option value="">None, use a photo</option><option v-for="p in products" :key="p.product_id" :value="p.product_id">{{ p.name }}{{ p.usable === false ? ' (not approved yet)' : '' }}</option></select></label>
      <template v-if="!staticProduct">
        <InputSlot label="Product photo" :kinds="['image']" :limit="8" :allow-upload="false" :items="staticPhotos" data-field="product_attachment_ids" @pick="addPhotos(staticPhotos, $event)" @remove="staticPhotos.splice(staticPhotos.indexOf($event),1)" />
        <label v-if="staticPhotos.length" class="st-field">Product name (as on the pack)<input v-model="staticProductName" class="st-input" maxlength="120" /></label>
      </template>
      <label class="st-field" data-field="brand_id">Brand kit (optional: its logo and colours)<select v-model="staticBrand" class="st-input"><option value="">No brand kit</option><option v-for="b in brands" :key="b.brand_id" :value="b.brand_id">{{ b.name }}</option></select></label>
      <label class="st-field" data-field="platform">Placement<select v-model="staticPlatform" class="st-input"><option v-for="p in adOptions.static_platforms || []" :key="p.id" :value="p.id">{{ p.label }}, {{ p.aspect_ratio }}</option></select></label>
      <MediaRoutePicker v-model="staticRoute" operation="edit_image" label="Picture model" />
      <label class="st-field" data-field="notes">Notes<textarea v-model="staticNotes" class="st-input" /></label><label class="st-field" data-field="n">Concept count<input v-model.number="staticCount" type="number" min="1" :max="adOptions.static_max_concepts || 6" class="st-input" /></label>
      <button class="st-button primary" :disabled="busy || !(staticProduct || staticPhotos.length) || !staticPlatform" data-test="static-concepts" @click="staticConcepts">Write concepts</button>
      <div v-for="(c,i) in staticDrafts" :key="i" class="creative-card" data-test="static-concept">
        <label class="ads2-pick"><input v-model="c.chosen" type="checkbox" /> Make this one</label>
        <p class="ads2-price" data-test="concept-price">{{ priceWords(c.price) }}</p>
        <label v-for="field in ['headline','primary_text','in_image_text','cta','visual']" :key="field" class="st-field">{{ words(field) }}<input v-model="c[field]" class="st-input" :maxlength="LIMITS[field]" /></label>
        <label class="st-field">Words go at the<select v-model="c.text_zone" class="st-input"><option value="top">Top</option><option value="bottom">Bottom</option></select></label>
      </div>
      <button v-if="staticDrafts.length" class="st-button primary" :disabled="busy || !chosen.length" data-test="static-batch" @click="staticBatch">Review estimates for {{ chosen.length }} {{ chosen.length === 1 ? 'ad' : 'ads' }}</button>
      <p v-if="staticDrafts.length" class="st-muted">Each picture waits for your Generate. Its words{{ staticBrand ? ' and logo are' : ' are' }} then placed exactly, at no cost.</p>
    </template>

    <!-- The Ad Multiplier: new hooks or calls to action for a finished ad -->
    <template v-else-if="tab === 'multiplier'">
      <InputSlot label="Your finished ad" required :kinds="['video']" :allow-upload="false" :items="adVideo ? [adVideo] : []" @pick="adVideo = $event[0]" @remove="adVideo = null" />
      <div class="creative-pair">
        <label class="st-field" data-field="section">Section<select v-model="section" class="st-input"><option value="hook">The hook (opening seconds)</option><option value="cta">The call to action (closing seconds)</option></select></label>
        <label class="st-field" data-field="seconds">Length (seconds)<input v-model.number="seconds" type="number" :min="mult.seconds?.[0] || 1" :max="mult.seconds?.[1] || 10" class="st-input" /></label>
      </div>
      <label class="st-field" data-field="mode">How<select v-model="mode" class="st-input" @change="loadVideoRoutes"><option value="recreate">Change the section you have</option><option value="replace">Make a new section</option></select></label>
      <label class="st-field" data-field="route_id">Video model<select v-model="multRoute" class="st-input" :disabled="videoLoading || !videoRoutes.length" data-test="mult-route"><option v-if="videoLoading" value="">Loading models…</option><option v-else-if="!videoRoutes.length" value="">No model you can use does this yet</option><option v-for="r in videoRoutes" :key="r.route_id" :value="String(r.route_id)">{{ routeOptionLabel(r) }}</option></select></label>
      <fieldset class="ads2-variants" data-field="variants"><legend>Variants, what each new section shows</legend>
        <div v-for="(v,i) in variants" :key="i" class="ads2-variant"><input v-model="variants[i]" class="st-input" maxlength="500" :aria-label="`Variant ${i + 1}`" /><button type="button" class="st-button" :disabled="variants.length === 1" :aria-label="`Remove variant ${i + 1}`" @click="variants.splice(i,1)">Remove</button></div>
        <button type="button" class="st-button" :disabled="variants.length >= (mult.max_variants || 5)" @click="variants.push('')">Add a variant</button>
      </fieldset>
      <button class="st-button primary" :disabled="busy || !adVideo || !multRoute || !variants.some(v => v.trim())" data-test="mult-make" @click="multiply">Review estimates for {{ variants.filter(v => v.trim()).length }} {{ variants.filter(v => v.trim()).length === 1 ? 'variant' : 'variants' }}</button>
    </template>

    <!-- Product recipes: entry points to the Product videos page -->
    <template v-else-if="tab === 'recipes'">
      <label class="st-field" data-field="product_id">Product<select v-model="recipeProduct" class="st-input"><option value="">Choose product</option><option v-for="p in products" :key="p.product_id" :value="p.product_id">{{ p.name }}</option></select></label>
      <div class="ads2-recipes"><button v-for="r in marketingRecipes" :key="r.id" type="button" class="st-button" :disabled="!r.ready" :data-test="`recipe-${r.id}`" @click="openRecipe(r)">{{ r.title }}{{ r.ready ? '' : ' (not ready yet)' }}</button></div>
      <p class="st-muted">Each opens Product videos with the recipe and your product's photo chosen.</p>
    </template>

    <AdBatchCard v-for="b in batches" :key="b.batch_id" :batch="b" :busy="busy" :not-started="left[b.batch_id] || []" @start="startBatch" />
  </div>
</template>
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'
import { useVideoStore } from '../../stores/useVideoStore'
import { priceAmount, routeOptionLabel, usd } from '../../utils/studioPrice'
import InputSlot from './InputSlot.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
import CreativeError from './CreativeError.vue'
import ElementRightsFields from '../video/ElementRightsFields.vue'
import { emptyRights, rightsComplete, rightsPayload } from '../video/elementKinds'
import StageProgress from './StageProgress.vue'
import AdBatchCard from './AdBatchCard.vue'
import { useCreativeForm } from '../../composables/useCreativeForm'
import { useStudioPreparedBrief } from '../../composables/useStudioPreparedBrief'
import { studioError, useStudioChat } from './studioForm'
// Ads Studio (ADS_STUDIO_V2_PLAN.md, ADS_CHAT_FLOW_PLAN.md): video ads from a product's photo or a saved product (a brand kit
// is optional), products read from a shop page, static image ads in
// batches, the Ad Multiplier and the product recipes. Every paid step waits for the person's Generate on its card.
const emit = defineEmits(['job'])
const router = useRouter(), video = useVideoStore(), { busy, error, run } = useCreativeForm()
const { chat, chatFields } = useStudioChat(() => 'ads')
const TABS = [{ id: 'video', label: 'Video ads' }, { id: 'products', label: 'Products' }, { id: 'static', label: 'Image ads' }, { id: 'multiplier', label: 'Ad Multiplier' }, { id: 'recipes', label: 'Product recipes' }]
const tab = ref('video')
const WORDS = { voice: 'How the brand speaks', audience: 'Who it is for', hook: 'Hook (the first two seconds)', angle: 'Why it works', cta: 'Call to action', visual: 'What the camera sees', on_screen_text: 'On-screen text', planned_ms: 'Length (milliseconds)', primary_text: 'Post text', in_image_text: 'Words on the picture' }
const LIMITS = { headline: 40, primary_text: 125, in_image_text: 40, cta: 20, visual: 500 }
const words = key => WORDS[key] || String(key || '').replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase())
const shownError = computed(() => studioError(error.value, ['brand_id','url','platform','goal','product_id','notes','n','title','price','currency','section','seconds','mode','route_id','variants','concepts']))
const usdWords = usd
// A concept's price before anything is made: the sum of its quoted steps, or why it has none (never $0).
function priceWords(p) {
  if (!p) return ''
  if (p.status === 'unpriced') return `No price yet: ${p.reason}`
  return `${priceAmount({ status: p.status === 'unknown' ? 'unknown' : Number(p.max_usd) > Number(p.estimate_usd) ? 'estimated' : 'exact', estimate: p.estimate_usd, most: p.max_usd })} before you make it`
}
const newReadId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : '')

// ── video ads ──
const brands = ref([]), brandId = ref(''), website = ref(''), draft = ref(null), colors = ref(''), adOptions = ref({}), platform = ref(''), goal = ref('awareness'), productId = ref(''), notes = ref(''), count = ref(3), drafts = ref([])
// The person's own Save with their rights statement approves a brand or a product, as on the Elements page.
const brandRights = ref(emptyRights()), productRights = ref(emptyRights()), elementSchema = ref(null)
video.loadIngredientSchema?.().then(sch => { elementSchema.value = sch })
// A product given by its photo (no saved product needed): its photos and the name on the pack.
const videoPhotos = ref([]), videoProductName = ref(''), staticPhotos = ref([]), staticProductName = ref('')
function addPhotos(list, items) {
  for (const item of items) {
    if (list.length >= 8) break
    if (item.attachment_id && !list.some(x => x.attachment_id === item.attachment_id)) list.push({ attachment_id: item.attachment_id, name: item.name || item.title, url: item.url, thumbnail_url: item.thumbnail_url, media_type: 'image' })
  }
}
const productFields = (id, photos, name) => id ? { product_id: id }
  : (photos.length ? { product_attachment_ids: photos.map(x => x.attachment_id), product: name.trim() ? { name: name.trim() } : {} } : {})
const brandRead = ref(''), brandAnswer = ref([])
const brandStages = computed(() => video.stages?.[brandRead.value] || brandAnswer.value)
function readBrand() { brandRead.value = newReadId(); brandAnswer.value = []; run(async alive => { const { data } = await api.post('/video/brands/read/', { url: website.value, ...(brandRead.value ? { read_id: brandRead.value } : {}), ...await chatFields() }); if (alive()) { brandAnswer.value = data.stages || []; draft.value = data; colors.value = (data.colors || []).join(', ') } }) }
function addImages(target, items, limit) {
  if (!target) return
  const images = target.images || (target.images = [])
  for (const item of items) {
    if (images.length >= limit) break
    if (item.attachment_id && !images.some(image => image.attachment_id === item.attachment_id)) images.push({ attachment_id: item.attachment_id, name: item.name || item.title })
  }
}
function saveBrand() { run(async alive => { const d = draft.value; const { data } = await api.post('/video/brands/', { name: d.name, description: d.description, traits: { colors: colors.value.split(',').map(v => v.trim()).filter(Boolean), website: d.website, tagline: d.tagline, voice: d.voice, audience: d.audience }, attachment_ids: (d.images || []).map(i => i.attachment_id), ...rightsPayload('brand', brandRights.value) }); if (alive()) { brands.value.push(data); brandId.value = data.brand_id || data.id; draft.value = null; brandRights.value = emptyRights() } }) }
const brief = () => ({ platform: platform.value, ...(brandId.value ? { brand_id: brandId.value } : {}), ...productFields(productId.value, videoPhotos.value, videoProductName.value) })
const normalized = concept => { const c = { ...concept, scenes: concept.scenes.map(s => ({ ...s, planned_ms: Number(s.planned_ms) })) }; delete c.price; c.total_ms = c.scenes.reduce((sum, s) => sum + s.planned_ms, 0); return c }
function concepts() { run(async alive => { const { data } = await api.post('/video/ads/concepts/', { ...brief(), goal: goal.value, notes: notes.value, n: count.value, ...await chatFields() }); if (alive()) drafts.value = data.concepts || [] }) }
function priceAgain(concept) { run(async alive => { const { data } = await api.post('/video/ads/concepts/price/', { concept: normalized(concept), platform: platform.value, ...await chatFields() }); if (alive()) concept.price = data }) }
function makeProject(concept) { run(async alive => { const { data } = await api.post('/video/ads/projects/', { ...brief(), concept: normalized(concept), ...await chatFields() }); if (alive()) router.push({ path: '/video-studio/storyboard', query: { project_id: data.project_id } }) }) }

// ── products ──
const products = ref([]), productUrl = ref(''), productDraft = ref(null), productRead = ref(''), productAnswer = ref([])
const productStages = computed(() => video.stages?.[productRead.value] || productAnswer.value)
function readProduct(model) { productRead.value = newReadId(); productAnswer.value = []; run(async alive => { const { data } = await api.post('/video/products/read/', { url: productUrl.value, model, ...(productRead.value ? { read_id: productRead.value } : {}), ...await chatFields() }); if (alive()) { productAnswer.value = data.stages || []; productDraft.value = data } }) }
function saveProduct() { run(async alive => { const d = productDraft.value; const { data } = await api.post('/video/products/', { title: d.title, price: d.price, currency: d.currency, brand: d.brand, description: d.description, url: d.url, attachment_ids: (d.images || []).map(i => i.attachment_id), ...rightsPayload('product', productRights.value) }); if (alive()) { products.value.unshift(data); productDraft.value = null; productAnswer.value = []; productRights.value = emptyRights(); staticProduct.value = data.product_id } }) }

// ── static image ads ──
const staticProduct = ref(''), staticBrand = ref(''), staticPlatform = ref(''), staticRoute = ref(''), staticNotes = ref(''), staticCount = ref(3), staticDrafts = ref([])
const chosen = computed(() => staticDrafts.value.filter(c => c.chosen))
const staticBody = () => ({ ...productFields(staticProduct.value, staticPhotos.value, staticProductName.value), platform: staticPlatform.value, ...(staticBrand.value ? { brand_id: staticBrand.value } : {}), ...(staticRoute.value ? { route_id: staticRoute.value } : {}) })
function staticConcepts() { run(async alive => { const { data } = await api.post('/video/ads/static/concepts/', { ...staticBody(), n: staticCount.value, notes: staticNotes.value, ...await chatFields() }); if (alive()) staticDrafts.value = (data.concepts || []).map(c => ({ ...c, chosen: true })) }) }
const cleanConcept = c => Object.fromEntries(['headline','primary_text','in_image_text','cta','visual','text_zone','angle'].map(k => [k, c[k] || '']))
function staticBatch() { run(async alive => { const { data } = await api.post('/video/ads/batches/', { ...staticBody(), concepts: chosen.value.map(cleanConcept), ...await chatFields() }); if (alive()) showBatch(data) }) }

// ── the Ad Multiplier ──
const adVideo = ref(null), section = ref('hook'), seconds = ref(3), mode = ref('recreate'), variants = ref(['']), multRoute = ref(''), videoRoutes = ref([]), videoLoading = ref(false)
const mult = computed(() => adOptions.value.multiplier || {})
let routeSeq = 0
async function loadVideoRoutes() {
  const mine = ++routeSeq
  videoLoading.value = true; videoRoutes.value = []; multRoute.value = ''
  const tasks = mode.value === 'recreate' ? ['edit_uploaded', 'edit_generated'] : ['text_to_video']
  try {
    const answers = await Promise.all(tasks.map(task => api.getStudioRoutes(task)))
    if (mine !== routeSeq) return
    const seen = new Set()
    videoRoutes.value = answers.flatMap(({ data }) => data?.routes || []).filter(r => !seen.has(r.route_id) && seen.add(r.route_id))
    multRoute.value = videoRoutes.value[0] ? String(videoRoutes.value[0].route_id) : ''
  } catch { if (mine === routeSeq) error.value = { message: 'Could not load the video models.' } }
  finally { if (mine === routeSeq) videoLoading.value = false }
}
watch(tab, t => { if (t === 'multiplier' && !videoRoutes.value.length) loadVideoRoutes(); if (t === 'recipes' && !marketingRecipes.value.length) loadRecipes() })
function multiply() { run(async alive => { const { data } = await api.post('/video/ads/multiply/', { attachment_id: adVideo.value.attachment_id, section: section.value, seconds: Number(seconds.value), mode: mode.value, variants: variants.value.map(v => v.trim()).filter(Boolean), route_id: multRoute.value, ...await chatFields() }); if (alive()) showBatch(data) }) }

// ── batches: kept current by the job frames the Studio already receives (no polling) ──
const batches = ref([]), left = ref({})
function showBatch(data) {
  batches.value = [data, ...batches.value.filter(b => b.batch_id !== data.batch_id)]
  for (const item of data.items || []) for (const s of [...(data.shared_steps || []), ...item.steps]) if (s.job) emit('job', s.job)
}
const jobSignature = computed(() => (chat.conversationId ? video.jobsFor(chat.conversationId) : []).map(j => `${j.job_id}:${j.state}`).sort().join('|'))
let refresh
watch(jobSignature, () => { if (!batches.value.length) return; clearTimeout(refresh); refresh = setTimeout(reloadBatches, 400) })
async function reloadBatches() {
  for (const b of batches.value) {
    try { const { data } = await api.get(`/video/ads/batches/${b.batch_id}/`); batches.value = batches.value.map(x => x.batch_id === data.batch_id ? data : x) } catch { /* the card keeps what it showed */ }
  }
}
function startBatch(b) { run(async alive => { const { data } = await api.post(`/video/ads/batches/${b.batch_id}/start/`, {}); if (!alive()) return; left.value = { ...left.value, [b.batch_id]: data.not_started || [] }; showBatch(data.batch) }) }

// ── product recipes ──
const marketingRecipes = ref([]), recipeProduct = ref('')
const ENTRY = ['ugc','unboxing','try-on','poster','marketplace','product-spin','product-hero','product-lifestyle','product-packshot']
async function loadRecipes() { try { const { data } = await api.getStudioRecipes('marketing'); marketingRecipes.value = (data.recipes || []).filter(r => ENTRY.includes(r.id)).sort((a, b) => ENTRY.indexOf(a.id) - ENTRY.indexOf(b.id)) } catch { error.value = { message: 'Could not load the recipes.' } } }
function openRecipe(r) { router.push({ path: '/video-studio/marketing', query: { recipe: r.id, ...(recipeProduct.value ? { product: recipeProduct.value } : {}) } }) }

onMounted(() => run(async alive => {
  const [b, o, prods] = await Promise.all([api.get('/video/brands/'), api.get('/video/ads/options/'), api.get('/video/products/')])
  if (!alive()) return
  brands.value = b.data?.brands || []; adOptions.value = o.data || {}; platform.value = o.data?.platforms?.[0]?.id || ''; staticPlatform.value = o.data?.static_platforms?.[0]?.id || ''
  products.value = prods.data?.products || []
}))
useStudioPreparedBrief(notes)
</script>
<style scoped>
.ads2-tabs{display:flex;gap:4px;overflow-x:auto;padding-bottom:2px;border-bottom:1px solid var(--vm-line);scrollbar-width:thin}
.ads2-tabs button{flex:none;min-height:44px;padding:8px 12px;border:0;border-bottom:2px solid transparent;background:none;color:var(--vm-ink-soft);font:500 13px/1.3 var(--vm-font-sans);cursor:pointer}
.ads2-tabs button:hover{color:var(--vm-ink)}.ads2-tabs button.on{color:var(--vm-ink);border-bottom-color:var(--vm-violet)}
.ads2-price{font-size:14px;font-weight:600;color:var(--vm-ink)}
.ads2-pick{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--vm-ink);min-height:32px}
.ads2-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}.ads2-list li{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 10px;padding:8px 10px;border:1px solid var(--vm-line);border-radius:6px;font-size:13px}
.ads2-variants{display:grid;gap:8px;margin:0;padding:0;border:0;min-width:0}.ads2-variants legend{padding:0 0 6px;font-size:13px;color:var(--vm-ink-soft)}
.ads2-variant{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}
.ads2-recipes{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
@media(max-width:480px){.creative-pair{grid-template-columns:minmax(0,1fr)}}
</style>
