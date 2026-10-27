<template>
  <form class="creative-form" @submit.prevent="prepare">
    <p class="st-muted cl-note">{{ page.note }}</p>
    <MediaRoutePicker v-model="routeId" :operation="kind" @routes="routes = $event" />
    <MediaSlot v-for="slot in page.slots" :key="slot.id" v-model="files[slot.id]" :label="slot.label" field="references" :kinds="slot.kinds" :required="slot.required" :hint="slot.hint" />
    <template v-if="kind === 'avatar'">
      <label v-if="!files.audio.length" class="st-field" data-field="prompt">Script<textarea v-model="prompt" class="st-input" rows="5" placeholder="What the presenter says." data-test="likeness-script" /></label>
      <label v-else class="st-field" data-field="prompt">How the presenter comes across<textarea v-model="direction" class="st-input" rows="2" placeholder="Looks at the camera, warm and calm." data-test="likeness-direction" /><span class="st-muted cl-note">The presenter speaks the voice track; some models also need this short direction.</span></label>
      <label v-if="!files.audio.length && voices.length" class="st-field" data-field="voice_id">Voice<select v-model="voiceId" class="st-input" data-test="likeness-voice-choice"><option value="">Choose a voice</option><option v-for="v in voices" :key="v">{{ v }}</option></select></label>
      <label v-else-if="!files.audio.length" class="st-field" data-field="voice_id">Voice ID<input v-model.trim="voiceId" class="st-input" maxlength="64" placeholder="The avatar provider's voice that reads the script" data-test="likeness-voice" /></label>
    </template>
    <template v-else-if="kind === 'motion'">
      <fieldset v-if="orientations.length" class="cl-choice" data-field="character_orientation"><legend>Follow the orientation of</legend>
        <label v-for="o in orientations" :key="o"><input v-model="orientation" type="radio" name="orientation" :value="o" :data-test="`orientation-${o}`" /> {{ ORIENTATION[o] || o }}</label>
      </fieldset>
      <label class="st-field" data-field="prompt">Direction (optional)<textarea v-model="prompt" class="st-input" rows="3" placeholder="Keep the outfit; plain studio background." /></label>
    </template>
    <label v-else-if="kind === 'lipsync' && needs.prompt" class="st-field" data-field="prompt">How the person comes across<textarea v-model="direction" class="st-input" rows="2" placeholder="Speaks calmly to the camera." data-test="likeness-direction" /><span class="st-muted cl-note">This model needs a short direction.</span></label>
    <ConsentStep v-if="consent" :request="consent" @agreed="consent.retry()" @cancel="cancelConsent" />
    <CreativeError :error="error" />
    <button class="st-button primary" :disabled="busy || !!consent || !!missing" data-test="likeness-prepare">{{ busy ? 'Preparing…' : 'Review estimate' }}</button>
    <p v-if="missing && !busy" class="st-muted cl-note" role="status">{{ missing }}</p>
    <Teleport v-if="monitor" defer :to="`#${monitor}`"><MediaMonitor :items="monitorItems" :empty="page.empty" /></Teleport>
  </form>
</template>
<script setup>
import { computed, inject, reactive, ref } from 'vue'
import api from '../../services/api'
import ConsentStep from './ConsentStep.vue'
import CreativeError from './CreativeError.vue'
import MediaMonitor from './MediaMonitor.vue'
import MediaRoutePicker from './MediaRoutePicker.vue'
import MediaSlot from './MediaSlot.vue'
import { useMediaJob } from '../../composables/useMediaJob'
// Motion transfer, talking avatars and lip-sync work on a real person's face or voice: each needs consent for its
// files, asked by the backend and answered in the consent step before the same request is sent again.
const PAGES = {
  motion: { note: 'A character performs the movement of a reference clip. Needs consent when the character is a real person.', empty: 'Add the character and the clip with the movement.',
    slots: [{ id: 'subject', role: 'subject', label: 'Character', kinds: ['image'], required: true }, { id: 'motion', role: 'motion', label: 'Clip with the movement', kinds: ['video'], required: true, hint: 'The body and camera movement of this clip is followed.' }] },
  avatar: { note: 'A presenter photo speaks your script or voice track. Needs consent from the person shown.', empty: 'Add the presenter photo, and a voice track or a script.',
    slots: [{ id: 'subject', role: 'subject', label: 'Presenter photo', kinds: ['image'], required: true }, { id: 'audio', role: 'audio', label: 'Voice track', kinds: ['audio'], required: false, hint: 'With a voice track, the presenter speaks it and the script is not used.' }] },
  lipsync: { note: 'The mouth in your footage moves to a new voice track. Needs consent from the person shown and heard.', empty: 'Add the footage of the person and the voice track.',
    slots: [{ id: 'source', role: 'edit_source', label: 'Footage or photo of the person', kinds: ['video', 'image'], required: true }, { id: 'audio', role: 'audio', label: 'Voice track', kinds: ['audio'], required: true }] },
}
const props = defineProps({ kind: { type: String, required: true } })
const emit = defineEmits(['job'])
const monitor = inject('studioMonitor', '')
const page = computed(() => PAGES[props.kind])
const routeId = ref(''), prompt = ref(''), direction = ref(''), voiceId = ref(''), orientation = ref(''), routes = ref([]), files = reactive({ subject: [], motion: [], audio: [], source: [] })
// What the chosen model needs beyond its files (the backend reads it from the model's own schema): a description, or a
// setting with fixed values such as the motion orientation or a named voice.
const needs = computed(() => routes.value.find(r => String(r.route_id) === routeId.value)?.needs || {})
const voices = computed(() => needs.value.choices?.voice || [])
const orientations = computed(() => needs.value.choices?.character_orientation || [])
// fal's own words for Kling motion control (read 2026-10-27).
const ORIENTATION = { video: 'The clip: better for complex movement; a clip of up to 30 seconds', image: 'The photo: better for camera movement; a clip of up to 10 seconds' }
const { busy, error, consent, submit, cancelConsent } = useMediaJob(job => emit('job', job))
const chosen = computed(() => page.value.slots.flatMap(slot => files[slot.id].map(file => ({ ...file, role: slot.label, apiRole: slot.role }))))
const monitorItems = computed(() => chosen.value)
const missing = computed(() => {
  if (!routeId.value) return 'Choose a model that is proven for this.'
  const empty = page.value.slots.find(slot => slot.required && !files[slot.id].length)
  if (empty) return `Add the ${empty.label.toLowerCase()}.`
  if (props.kind === 'avatar' && !files.audio.length && !prompt.value.trim()) return 'Write the script or add a voice track.'
  if (props.kind === 'avatar' && !files.audio.length && !voiceId.value) return 'Give the voice ID that reads the script.'
  if (props.kind === 'avatar' && files.audio.length && !direction.value.trim()) return 'Say in a few words how the presenter comes across.'
  if (props.kind === 'motion' && orientations.value.length && !orientation.value) return 'Choose whose orientation to follow.'
  if (props.kind === 'lipsync' && needs.value.prompt && !direction.value.trim()) return 'Say in a few words how the person comes across.'
  return ''
})
function prepare() {
  if (missing.value) return
  const references = chosen.value.map(file => ({ attachment_id: file.attachment_id, role: file.apiRole }))
  const request = props.kind === 'avatar' ? (files.audio.length ? { prompt: direction.value.trim() } : { prompt: prompt.value.trim(), voice_id: voiceId.value })
    : props.kind === 'motion' ? { ...(prompt.value.trim() ? { prompt: prompt.value.trim() } : {}), ...(orientations.value.length ? { character_orientation: orientation.value } : {}) }
    : props.kind === 'lipsync' && needs.value.prompt ? { prompt: direction.value.trim() } : {}
  const names = Object.fromEntries(chosen.value.map(file => [file.attachment_id, file.name]))
  submit(s => api.prepareMediaJob({ operation: props.kind, route_id: routeId.value, request, references, ...s }), names)
}
</script>
<style scoped>.cl-note{font-size:12px;line-height:1.55}.cl-choice{display:grid;gap:8px;margin:0;padding:0;border:0;font-size:13px}.cl-choice legend{margin-bottom:6px;color:var(--vm-ink-soft)}.cl-choice label{display:flex;align-items:flex-start;gap:8px;min-height:36px;line-height:1.5;cursor:pointer}.cl-choice input{width:18px;height:18px;margin-top:1px;flex-shrink:0}@media(max-width:767px){.cl-choice label{min-height:44px}}</style>
