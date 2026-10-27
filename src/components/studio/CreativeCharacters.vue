<template>
  <div class="creative-form cc">
    <ol class="cc-steps" aria-label="Steps">
      <li v-for="(s, i) in steps" :key="s.id"><button type="button" :aria-current="step === i ? 'step' : undefined" :data-test="`character-step-${s.id}`" @click="step = i"><span class="cc-num">{{ i + 1 }}</span>{{ s.label }}</button></li>
    </ol>

    <section v-show="step === 0" class="creative-form" aria-label="Describe the character">
      <p v-if="loadingTraits" class="st-status" role="status">Loading traits…</p>
      <div class="cc-traits">
        <label v-for="(options, key) in traitOptions" :key="key" class="st-field" :data-field="`traits.${key}`">{{ traitLabel(key) }}<select v-model="traits[key]" class="st-input"><option value="">Any</option><option v-for="o in options" :key="o">{{ o }}</option></select></label>
      </div>
      <label class="st-field" data-field="traits.details">Other details (optional)<textarea v-model="details" class="st-input" rows="3" :maxlength="detailsMax" placeholder="A small scar above the left eyebrow; round glasses." /></label>
      <MediaSlot v-model="photo" label="Start from a photo (optional)" field="photo_attachment_id" :kinds="['image']" hint="A photo of a real person needs their consent before it is used." />
      <button type="button" class="st-button primary" :disabled="!hasTraits" @click="step = 1">Next: portraits</button>
    </section>

    <section v-show="step === 1" class="creative-form" aria-label="Make portraits">
      <MediaRoutePicker v-model="portraitRoute" :operation="photo.length ? 'edit_image' : 'image'" label="Image model" />
      <label class="st-field" data-field="n">How many portraits<select v-model.number="count" class="st-input"><option v-for="n in [1,2,3,4]" :key="n" :value="n">{{ n }}</option></select></label>
      <p class="st-muted cc-note">Each portrait follows the traits exactly, so the same traits ask for the same person.</p>
      <button type="button" class="st-button primary" :disabled="busy || !hasTraits || !portraitRoute || !!consent" data-test="character-portraits" @click="portraits">{{ busy ? 'Preparing…' : 'Review portrait estimate' }}</button>
    </section>

    <section v-show="step === 2" class="creative-form" aria-label="Make a reference sheet">
      <MediaSlot v-model="portrait" label="The portrait to build on" field="portrait_attachment_id" :kinds="['image']" required :hint="'Choose one of your portraits from the Library once it is made.'" />
      <MediaRoutePicker v-model="sheetRoute" operation="edit_image" label="Image edit model" />
      <p class="st-muted cc-note">The sheet shows this person from the front, three-quarter, side and back, in the same clothes.</p>
      <button type="button" class="st-button primary" :disabled="busy || !portrait.length || !sheetRoute" data-test="character-sheet" @click="sheet">{{ busy ? 'Preparing…' : 'Review sheet estimate' }}</button>
    </section>

    <section v-show="step === 3" class="creative-form" aria-label="Save the character">
      <label class="st-field" data-field="name">Name<input v-model="name" class="st-input" maxlength="80" placeholder="Mara, the lighthouse keeper" data-test="character-name" /></label>
      <label class="st-field" data-field="description">Description (optional)<textarea v-model="description" class="st-input" rows="2" /></label>
      <MediaSlot v-model="keep" label="Images to keep" field="attachment_ids" :kinds="['image']" :limit="8" required hint="Your chosen portrait and its sheet. These become the character in Elements." />
      <button type="button" class="st-button primary" :disabled="busy || !name.trim() || !keep.length || !hasTraits" data-test="character-save" @click="save">{{ busy ? 'Saving…' : saved ? 'Save a new revision' : 'Save character' }}</button>
      <p v-if="saved" class="st-status cc-saved" role="status">Saved {{ saved.name }} (revision {{ saved.revision }}) to <RouterLink class="st-link" to="/video-studio/elements">Elements</RouterLink>.</p>
    </section>

    <ConsentStep v-if="consent" :request="consent" @agreed="consent.retry()" @cancel="cancelConsent" />
    <CreativeError :error="error" />
    <Teleport v-if="monitor" defer :to="`#${monitor}`"><MediaMonitor :items="[...photo.map(f => ({ ...f, role: 'Starting photo' })), ...portrait.map(f => ({ ...f, role: 'Chosen portrait' })), ...keep.map(f => ({ ...f, role: 'Kept' }))]" empty="Portraits you make appear in My results and in your Library. Choose one to build the sheet." /></Teleport>
  </div>
</template>
<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'
import api from '../../services/api'
import ConsentStep from './ConsentStep.vue'
import CreativeError from './CreativeError.vue'
import MediaMonitor from './MediaMonitor.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
import MediaSlot from './MediaSlot.vue'
import { useMediaJob } from '../../composables/useMediaJob'
const emit = defineEmits(['job'])
const monitor = inject('studioMonitor', '')
const steps = [{ id: 'describe', label: 'Describe' }, { id: 'portraits', label: 'Portraits' }, { id: 'sheet', label: 'Reference sheet' }, { id: 'save', label: 'Save' }]
const step = ref(0), traitOptions = ref({}), detailsMax = ref(300), loadingTraits = ref(true), traits = reactive({}), details = ref(''), photo = ref([])
const portraitRoute = ref(''), count = ref(4), portrait = ref([]), sheetRoute = ref(''), name = ref(''), description = ref(''), keep = ref([]), saved = ref(null)
const { busy, error, consent, submit, cancelConsent } = useMediaJob(job => emit('job', job))
const labels = { skin_tone: 'Skin tone', hair_color: 'Hair colour' }
const traitLabel = key => labels[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
const chosenTraits = computed(() => ({ ...Object.fromEntries(Object.entries(traits).filter(([, v]) => v)), ...(details.value.trim() ? { details: details.value.trim() } : {}) }))
const hasTraits = computed(() => Object.keys(chosenTraits.value).length > 0)
onMounted(async () => {
  try { const { data } = await api.getCharacterTraits(); traitOptions.value = data.traits || {}; detailsMax.value = data.details_max || 300; for (const key of Object.keys(traitOptions.value)) if (!(key in traits)) traits[key] = '' }
  catch { error.value = { message: 'Could not load the traits. Reload the page to try again.' } }
  finally { loadingTraits.value = false }
})
function portraits() {
  const names = Object.fromEntries(photo.value.map(f => [f.attachment_id, f.name]))
  submit(s => api.prepareCharacterPortraits({ route_id: portraitRoute.value, traits: chosenTraits.value, n: count.value, ...(photo.value[0] ? { photo_attachment_id: photo.value[0].attachment_id } : {}), ...s }), names)
}
function sheet() { submit(s => api.prepareCharacterSheet({ route_id: sheetRoute.value, portrait_attachment_id: portrait.value[0].attachment_id, ...s })) }
async function save() {
  error.value = null; busy.value = true
  try {
    const { data } = await api.saveCharacter({ name: name.value.trim(), traits: chosenTraits.value, attachment_ids: keep.value.map(f => f.attachment_id), description: description.value.trim(), ...(saved.value ? { character_id: saved.value.character_id } : {}) })
    saved.value = data
  } catch (e) { error.value = e.response?.data?.error || { message: 'Could not save the character.' } }
  finally { busy.value = false }
}
</script>
<style scoped>
.cc-steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin:0;padding:0;list-style:none}.cc-steps button{display:flex;align-items:center;gap:6px;width:100%;min-height:40px;padding:6px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface);color:var(--vm-ink-soft);font:500 12px var(--vm-font-sans);text-align:left;cursor:pointer}.cc-steps button[aria-current=step]{border-color:var(--vm-violet);color:var(--vm-ink);background:var(--vm-violet-soft)}.cc-num{display:grid;place-items:center;width:20px;height:20px;flex-shrink:0;border-radius:50%;background:var(--vm-surface-2);font-size:11px}.cc-traits{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cc-note{font-size:12px;line-height:1.55}.cc-saved{padding:0}@media(max-width:767px){.cc-steps button{min-height:44px}}
</style>
