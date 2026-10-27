<template>
  <div class="creative-form ci">
    <section class="creative-form" aria-labelledby="ci-list">
      <h2 id="ci-list" class="ci-h">Your identities</h2>
      <p v-if="loading" class="st-status" role="status">Loading…</p>
      <p v-else-if="!identities.length" class="st-muted ci-note">None yet. Train one from a character below.</p>
      <ul v-else class="ci-rows">
        <li v-for="item in identities" :key="item.identity_id" class="creative-card">
          <div class="ci-row-head"><strong>{{ characterName(item.character_id) }}</strong><span class="st-pill" :class="{ beta: item.state === 'ready' }">{{ stateLabel(item.state) }}</span></div>
          <p class="st-muted ci-note">Trigger word: <code>{{ item.trigger_word }}</code></p>
          <p v-if="item.error" class="st-error">{{ item.error }}</p>
          <div class="ci-actions">
            <button v-if="item.state === 'ready'" type="button" class="st-button" :aria-pressed="using?.identity_id === item.identity_id" @click="using = item">Make images</button>
            <button v-if="removing !== item.identity_id" type="button" class="st-button" :disabled="busy" @click="removing = item.identity_id">Delete</button>
          </div>
          <div v-if="removing === item.identity_id" class="ci-confirm" role="group" aria-label="Confirm delete"><p>Delete this identity here and at the provider? Images already made are kept.</p><div class="ci-actions"><button type="button" class="st-button" @click="removing = ''">Keep it</button><button type="button" class="st-button primary" :disabled="busy" data-test="identity-delete" @click="remove(item)">Delete</button></div></div>
          <p v-if="deleted[item.identity_id]" class="st-status ci-note" role="status">{{ deleted[item.identity_id] }}</p>
        </li>
      </ul>
    </section>

    <section v-if="using" class="creative-form" aria-labelledby="ci-make">
      <h2 id="ci-make" class="ci-h">Images of {{ characterName(using.character_id) }}</h2>
      <MediaRoutePicker v-model="imageRoute" operation="image" model="fal-ai/flux-lora" label="Identity model" />
      <label class="st-field" data-field="prompt">Describe the image<textarea v-model="prompt" class="st-input" rows="3" :placeholder="`${using.trigger_word} walking along a harbour at dawn`" data-test="identity-prompt" /></label>
      <p class="st-muted ci-note">Use the trigger word {{ using.trigger_word }} where the person should appear.</p>
      <label class="st-field" data-field="n">How many<select v-model.number="count" class="st-input"><option v-for="n in [1,2,3,4]" :key="n" :value="n">{{ n }}</option></select></label>
      <button type="button" class="st-button primary" :disabled="busy || !imageRoute || !prompt.trim()" data-test="identity-images" @click="images">{{ busy ? 'Preparing…' : 'Review image estimate' }}</button>
    </section>

    <section class="creative-form" aria-labelledby="ci-train">
      <h2 id="ci-train" class="ci-h">Train a new identity</h2>
      <label class="st-field" data-field="character_id">Character<select v-model="characterId" class="st-input" data-test="identity-character"><option value="">Choose a character</option><option v-for="c in characters" :key="c.ingredient_id" :value="c.ingredient_id">{{ c.name }} ({{ c.files.length }} image{{ c.files.length === 1 ? '' : 's' }})</option></select></label>
      <p v-if="!loading && !characters.length" class="st-muted ci-note">Make and save a character first on the <RouterLink class="st-link" to="/video-studio/characters">Characters</RouterLink> page.</p>
      <p v-else-if="character && character.files.length < 4" class="st-muted ci-note" role="status">This character has {{ character.files.length }} image{{ character.files.length === 1 ? '' : 's' }}; training needs at least 4. Add more on the Characters page.</p>
      <MediaRoutePicker v-model="trainRoute" operation="train" label="Training model" />
      <label class="st-field" data-field="trigger_word">Trigger word<input v-model.trim="trigger" class="st-input" maxlength="40" placeholder="mara_keeper" data-test="identity-trigger" /></label>
      <p class="st-muted ci-note">3 to 40 letters, digits or _, starting with a letter. You write it in a prompt to bring this person in.</p>
      <button type="button" class="st-button primary" :disabled="busy || !!trainMissing || !!consent" data-test="identity-train" @click="train">{{ busy ? 'Preparing…' : 'Review training estimate' }}</button>
      <p v-if="trainMissing && !busy" class="st-muted ci-note" role="status">{{ trainMissing }}</p>
    </section>
    <ConsentStep v-if="consent" :request="consent" @agreed="consent.retry()" @cancel="cancelConsent" />
    <CreativeError :error="error" />
    <Teleport v-if="monitor" defer :to="`#${monitor}`"><MediaMonitor :items="(character?.files || []).map(f => ({ ...f, name: f.title || f.filename || 'Image', media_type: 'image', role: character.name }))" empty="Choose a character to see the images it will be trained on." /></Teleport>
  </div>
</template>
<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import ConsentStep from './ConsentStep.vue'
import CreativeError from './CreativeError.vue'
import MediaMonitor from './MediaMonitor.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
import { useMediaJob } from '../../composables/useMediaJob'
const emit = defineEmits(['job'])
const route = useRoute(), monitor = inject('studioMonitor', '')
const identities = ref([]), characters = ref([]), loading = ref(true), characterId = ref(String(route.query.character || '')), trainRoute = ref(''), trigger = ref('')
const using = ref(null), imageRoute = ref(''), prompt = ref(''), count = ref(1), removing = ref(''), deleted = reactive({})
const { busy, error, consent, submit, cancelConsent } = useMediaJob(job => { emit('job', job); load() })
const character = computed(() => characters.value.find(c => c.ingredient_id === characterId.value))
const characterName = id => characters.value.find(c => c.ingredient_id === id)?.name || 'A character'
const stateLabel = state => ({ training: 'Training', ready: 'Ready', failed: 'Failed', awaiting_authorization: 'Waiting for your Generate' }[state] || state)
const trainMissing = computed(() => !characterId.value ? 'Choose a character.' : (character.value?.files.length || 0) < 4 ? 'The character needs at least 4 images.' : !trainRoute.value ? 'Choose a training model that is proven.' : !/^[A-Za-z][A-Za-z0-9_]{2,39}$/.test(trigger.value) ? 'Use 3 to 40 letters, digits or _, starting with a letter.' : '')
async function load() {
  try {
    const [ids, els] = await Promise.all([api.getIdentities(), api.getStudioElements()])
    identities.value = ids.data.identities || []
    characters.value = (els.data.ingredients || []).filter(item => item.kind === 'character')
  } catch { error.value = { message: 'Could not load your identities and characters.' } }
  finally { loading.value = false }
}
onMounted(load)
function train() {
  if (trainMissing.value) return
  const names = Object.fromEntries((character.value?.files || []).map(f => [f.attachment_id, f.title || f.filename || character.value.name]))
  submit(async s => { const res = await api.trainIdentity({ character_id: characterId.value, route_id: trainRoute.value, trigger_word: trigger.value, ...s }); return { ...res, data: res.data.job } }, names)
}
function images() { submit(s => api.prepareIdentityImages(using.value.identity_id, { route_id: imageRoute.value, prompt: prompt.value.trim(), n: count.value, ...s })) }
async function remove(item) {
  busy.value = true; error.value = null
  try {
    const { data } = await api.deleteIdentity(item.identity_id)
    deleted[item.identity_id] = `${data.deleted_here ? 'Deleted here' : 'Not deleted here'}; ${data.deleted_at_provider ? 'deleted at the provider' : `not deleted at the provider${data.error ? `: ${data.error}` : ''}`}.`
    removing.value = ''
    if (using.value?.identity_id === item.identity_id) using.value = null
    if (data.deleted_here) identities.value = identities.value.filter(i => i.identity_id !== item.identity_id)
  } catch (e) { error.value = e.response?.data?.error || { message: 'Could not delete the identity.' } }
  finally { busy.value = false }
}
</script>
<style scoped>
.ci-h{font-size:14px}.ci-note{font-size:12px;line-height:1.55}.ci-rows{display:grid;gap:8px;margin:0;padding:0;list-style:none}.ci-row-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.ci-actions{display:flex;flex-wrap:wrap;gap:6px}.ci-confirm{display:grid;gap:8px;padding:10px;border:1px solid var(--vs-warn-line);border-radius:6px;font-size:13px}.ci code{font-size:12px}
</style>
